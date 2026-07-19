import os
import json
import logging
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, APIRouter, HTTPException, Query
from starlette.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from pydantic import BaseModel
import psycopg2
from psycopg2.extras import RealDictCursor, Json
from psycopg2 import pool as pgpool

import game_engine as ge
import resend
import bcrypt
import jwt
import datetime
import uuid

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("glimmerfall")

DATABASE_URL = os.environ["DATABASE_URL"]
CARDBACK_URL = os.environ.get("CARDBACK_URL", "")

DB_POOL = pgpool.ThreadedConnectionPool(
    1, 10, dsn=DATABASE_URL,
    keepalives=1, keepalives_idle=30, keepalives_interval=10, keepalives_count=5,
)


class DB:
    """Resilient DB context manager. Validates the pooled connection and
    recycles it if NeonDB has dropped it (SSL connection closed unexpectedly)."""

    def __enter__(self):
        last_err = None
        for _ in range(3):
            self.conn = DB_POOL.getconn()
            try:
                self.conn.autocommit = True
                self.cur = self.conn.cursor(cursor_factory=RealDictCursor)
                self.cur.execute("SELECT 1")
                return self.cur
            except (psycopg2.OperationalError, psycopg2.InterfaceError) as e:
                last_err = e
                try:
                    DB_POOL.putconn(self.conn, close=True)
                except Exception:
                    pass
                self.conn = None
        raise last_err

    def __exit__(self, exc_type, *a):
        try:
            if self.cur:
                self.cur.close()
        except Exception:
            pass
        try:
            if self.conn:
                # discard the connection if the request errored on it
                DB_POOL.putconn(self.conn, close=exc_type is not None)
        except Exception:
            pass


app = FastAPI(title="GlimmerFall TCG API")
api = APIRouter(prefix="/api")


def load_cards():
    with DB() as cur:
        cur.execute("SELECT * FROM cards ORDER BY collector_number NULLS LAST")
        return [dict(r) for r in cur.fetchall()]


# ---------------- static content endpoints ----------------

@api.get("/")
def root():
    return {"game": "GlimmerFall TCG", "status": "online", "cardback": CARDBACK_URL}


@api.get("/cards")
def get_cards():
    return load_cards()


@api.get("/rules")
def get_rules():
    with DB() as cur:
        cur.execute("SELECT id, title, content, display_order FROM rulebook_sections ORDER BY display_order")
        return [dict(r) for r in cur.fetchall()]


@api.get("/booster")
def get_booster():
    with DB() as cur:
        cur.execute("SELECT * FROM cards ORDER BY RANDOM() LIMIT 10")
        return [dict(r) for r in cur.fetchall()]


@api.get("/starter-decks")
def get_starter_decks():
    with DB() as cur:
        cur.execute("SELECT * FROM starter_decks ORDER BY id")
        decks = [dict(r) for r in cur.fetchall()]
        cur.execute("SELECT * FROM starter_deck_cards ORDER BY id")
        cards = [dict(r) for r in cur.fetchall()]
    for d in decks:
        d["cards"] = [c for c in cards if c["starter_deck_id"] == d["id"]]
    return decks


# ---------------- matchmaking + match ----------------

class MatchmakeReq(BaseModel):
    username: str
    roomCode: Optional[str] = None
    faction: Optional[str] = None
    deckCards: Optional[list] = None
    vsAI: bool = False


class ActionReq(BaseModel):
    matchId: int
    slot: int
    action: str
    payload: Optional[dict] = None


def save_match(match_id, state):
    active_slot = str(state["activePlayer"])
    active_name = state["players"][active_slot]["username"]
    with DB() as cur:
        cur.execute(
            "UPDATE matches SET state=%s, status=%s, current_turn=%s, active_player=%s WHERE id=%s",
            (Json(state), state["phase"], state["turn"], active_name, match_id),
        )


def insert_match(room_code, p1, p2, state):
    active_name = state["players"][state.get("activePlayer", 1) and str(state.get("activePlayer", 1))]["username"] if state.get("phase") == "PLAYING" else p1
    with DB() as cur:
        cur.execute(
            "INSERT INTO matches (room_code, player1, player2, status, current_turn, active_player, state) "
            "VALUES (%s,%s,%s,%s,%s,%s,%s) RETURNING id",
            (room_code, p1, p2, state.get("phase", "WAITING"), state.get("turn", 1), active_name, Json(state)),
        )
        return cur.fetchone()["id"]


def _rand_room():
    import random, string
    return "".join(random.choices(string.ascii_uppercase + string.digits, k=5))


@api.post("/matchmaking")
def matchmaking(req: MatchmakeReq):
    pool = load_cards()
    deck1 = ge.build_deck(pool, req.faction, req.deckCards)

    # ----- vs AI -----
    if req.vsAI:
        ai_faction = None
        deck2 = ge.build_deck(pool, ai_faction)
        state = ge.new_match_state(req.username, deck1, ge.AI_NAME, deck2, is_ai=True)
        room = _rand_room()
        mid = insert_match(room, req.username, ge.AI_NAME, state)
        return {"matchId": mid, "slot": 1, "roomCode": room, "status": "PLAYING", "vsAI": True}

    room = (req.roomCode or "").strip().upper()

    # ----- join an existing waiting room -----
    with DB() as cur:
        if room:
            cur.execute(
                "SELECT * FROM matches WHERE room_code=%s AND status='WAITING' AND player2 IS NULL ORDER BY id DESC LIMIT 1",
                (room,),
            )
        else:
            cur.execute(
                "SELECT * FROM matches WHERE status='WAITING' AND player2 IS NULL ORDER BY id DESC LIMIT 1"
            )
        waiting = cur.fetchone()

    if waiting and waiting["player1"] != req.username:
        wstate = waiting["state"]
        deck_p1 = wstate["p1_deck"]
        state = ge.new_match_state(waiting["player1"], deck_p1, req.username, deck1, is_ai=False)
        save_match(waiting["id"], state)
        return {"matchId": waiting["id"], "slot": 2, "roomCode": waiting["room_code"], "status": "PLAYING", "vsAI": False}

    # ----- create a new waiting room -----
    if not room:
        room = _rand_room()
    waiting_state = {"phase": "WAITING", "activePlayer": 1, "turn": 1,
                     "players": {"1": {"username": req.username}},
                     "p1_deck": deck1, "log": [f"{req.username} created room {room}. Waiting for an opponent..."]}
    mid = insert_match(room, req.username, None, waiting_state)
    return {"matchId": mid, "slot": 1, "roomCode": room, "status": "WAITING", "vsAI": False}


def redact_state(state, viewer_slot):
    """Hide opponent's hand contents + both libraries before sending to a client."""
    if state.get("phase") == "WAITING":
        return {"phase": "WAITING", "log": state.get("log", []), "players": state.get("players", {})}
    s = json.loads(json.dumps(state))  # deep copy
    s.pop("p1_deck", None)
    v = str(viewer_slot)
    for slot in ("1", "2"):
        pl = s["players"][slot]
        pl["libraryCount"] = len(pl.get("library", []))
        pl.pop("library", None)
        if slot != v:
            pl["handCount"] = len(pl.get("hand", []))
            pl["hand"] = [{"instanceId": c["instanceId"], "hidden": True} for c in pl.get("hand", [])]
        else:
            pl["handCount"] = len(pl.get("hand", []))
    return s


@api.get("/match")
def get_match(id: int = Query(...), slot: int = Query(1)):
    with DB() as cur:
        cur.execute("SELECT * FROM matches WHERE id=%s", (id,))
        m = cur.fetchone()
    if not m:
        raise HTTPException(404, "Match not found")
    state = m["state"]
    return {
        "matchId": m["id"],
        "roomCode": m["room_code"],
        "status": m["status"],
        "turn": m["current_turn"],
        "activePlayer": state.get("activePlayer"),
        "player1": m["player1"],
        "player2": m["player2"],
        "state": redact_state(state, slot),
    }


@api.post("/action")
def post_action(req: ActionReq):
    with DB() as cur:
        cur.execute("SELECT * FROM matches WHERE id=%s", (req.matchId,))
        m = cur.fetchone()
    if not m:
        raise HTTPException(404, "Match not found")
    state = m["state"]
    if state.get("phase") == "WAITING":
        raise HTTPException(400, "Match has not started yet.")
    try:
        new_state = ge.apply_action(state, req.slot, req.action, req.payload or {})
    except ge.ActionError as e:
        raise HTTPException(400, str(e))
    save_match(req.matchId, new_state)
    return {"ok": True, "state": redact_state(new_state, req.slot)}

resend.api_key = os.environ.get("RESEND_API_KEY")
JWT_SECRET = "glimmerfall_super_secret_key"

class RegisterReq(BaseModel):
    email: str
    password: str
    faction: Optional[str] = None

class LoginReq(BaseModel):
    email: str
    password: str

@api.post("/auth/register")
def register(req: RegisterReq):
    hashed = bcrypt.hashpw(req.password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    nickname = req.email.split('@')[0]
    token = str(uuid.uuid4())
    is_admin = req.email.lower().endswith('@hatake.eu')
    
    with DB() as cur:
        try:
            cur.execute("""
                INSERT INTO users (email, password_hash, nickname, faction, is_admin, verification_token)
                VALUES (%s, %s, %s, %s, %s, %s) RETURNING id, nickname
            """, (req.email, hashed, nickname, req.faction, is_admin, token))
            u = cur.fetchone()
        except psycopg2.IntegrityError:
            raise HTTPException(400, "Email already exists")
    
    try:
        resend.Emails.send({
            "from": "GlimmerFall <onboarding@resend.dev>",
            "to": [req.email],
            "subject": "Verify Your GlimmerFall Account",
            "html": f"<p>Welcome {nickname}! Please verify your account by clicking <a href='http://localhost:3000/dashboard?verify={token}'>here</a>.</p>"
        })
    except Exception as e:
        logger.error(f"Resend error: {e}")
        
    return {"ok": True, "message": "Registered! Please check your email to verify."}

class ResendVerifyReq(BaseModel):
    email: str

@api.post("/auth/resend-verify")
def resend_verify(req: ResendVerifyReq):
    with DB() as cur:
        cur.execute("SELECT nickname, verification_token, is_verified FROM users WHERE email=%s", (req.email,))
        u = cur.fetchone()
    if not u:
        raise HTTPException(404, "User not found")
    if u["is_verified"]:
        return {"ok": True, "message": "Already verified"}
    
    token = u["verification_token"]
    if not token:
        token = str(uuid.uuid4())
        with DB() as cur:
            cur.execute("UPDATE users SET verification_token=%s WHERE email=%s", (token, req.email))
    
    try:
        resend.Emails.send({
            "from": "GlimmerFall <onboarding@resend.dev>",
            "to": [req.email],
            "subject": "Verify Your GlimmerFall Account",
            "html": f"<p>Welcome {u['nickname']}! Please verify your account by clicking <a href='http://localhost:3000/dashboard?verify={token}'>here</a>.</p>"
        })
    except Exception as e:
        logger.error(f"Resend error: {e}")
        
    return {"ok": True, "message": "Verification email resent!"}

@api.post("/auth/login")
def login(req: LoginReq):
    with DB() as cur:
        cur.execute("SELECT * FROM users WHERE email=%s", (req.email,))
        u = cur.fetchone()
    if not u or not bcrypt.checkpw(req.password.encode('utf-8'), u['password_hash'].encode('utf-8')):
        raise HTTPException(401, "Invalid credentials")
    
    token = jwt.encode({
        "id": u["id"],
        "email": u["email"],
        "nickname": u["nickname"],
        "is_admin": u["is_admin"]
    }, JWT_SECRET, algorithm="HS256")
    
    return {
        "token": token,
        "user": {
            "id": u["id"],
            "email": u["email"],
            "nickname": u["nickname"],
            "isAdmin": u["is_admin"],
            "isVerified": u["is_verified"],
            "faction": u["faction"],
            "referrals": u["referrals"],
            "bookings": u["bookings"],
            "matchmaking": {"mmr": u["mmr"], "rank": u["rank"]}
        }
    }

@api.post("/auth/verify")
def verify(token: str):
    with DB() as cur:
        cur.execute("UPDATE users SET is_verified=TRUE, verification_token=NULL WHERE verification_token=%s RETURNING id", (token,))
        if not cur.fetchone():
            raise HTTPException(400, "Invalid or expired token")
    return {"ok": True, "message": "Account verified!"}

@api.get("/admin/stats")
def admin_stats():
    with DB() as cur:
        cur.execute("SELECT COUNT(*) as c FROM users")
        gamers = cur.fetchone()["c"]
        cur.execute("SELECT COUNT(*) as c FROM matches WHERE status='PLAYING'")
        matches = cur.fetchone()["c"]
        cur.execute("SELECT SUM(bookings) as b FROM users")
        preorders = cur.fetchone()["b"] or 0
    return {
        "registered_gamers": gamers,
        "active_matches": matches,
        "total_preorders": preorders,
        "gross_revenue": preorders * 60
    }

app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
def _shutdown():
    DB_POOL.closeall()
