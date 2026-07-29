import os
import json
import logging
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, APIRouter, HTTPException, Query, Request
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

def get_user_from_request(request: Request):
    auth = request.headers.get("Authorization")
    if not auth or not auth.startswith("Bearer "):
        return None
    token = auth.split(" ")[1]
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except:
        return None


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


@api.post("/decks")
def save_community_deck(payload: dict):
    # payload: { username, deck_name, deck_cards: [{card_name, count}] }
    username = payload.get("username", "Anonymous")
    deck_name = payload.get("deck_name", "Untitled Deck")
    cards = payload.get("deck_cards", [])
    
    with DB() as cur:
        # insert deck
        cur.execute("INSERT INTO decks (username, deck_name) VALUES (%s, %s) RETURNING id", (username, deck_name))
        deck_id = cur.fetchone()["id"]
        
        # insert cards
        for c in cards:
            cur.execute("INSERT INTO deck_cards (deck_id, card_name, count) VALUES (%s, %s, %s)",
                        (deck_id, c["card_name"], c["count"]))
                        
    return {"status": "success", "deck_id": deck_id}


@api.get("/community-decks")
def get_community_decks():
    with DB() as cur:
        # fetch all decks
        cur.execute("SELECT d.id, d.username, d.deck_name, d.created_at FROM decks d ORDER BY d.created_at DESC LIMIT 50")
        decks = [dict(r) for r in cur.fetchall()]
        
        if not decks:
            return []
            
        deck_ids = tuple(d["id"] for d in decks)
        
        # fetch all associated cards for these decks
        cur.execute("SELECT dc.deck_id, dc.card_name, dc.count, c.faction, c.image_url FROM deck_cards dc JOIN cards c ON dc.card_name = c.name WHERE dc.deck_id IN %s", (deck_ids,))
        cards = [dict(r) for r in cur.fetchall()]
        
    for d in decks:
        # Format dates properly
        d["created_at"] = str(d["created_at"])
        d["cards"] = [c for c in cards if c["deck_id"] == d["id"]]
        
    return decks


# ---------------- the forge (custom cards) ----------------

@api.get("/custom-cards")
def get_custom_cards():
    with DB() as cur:
        cur.execute("SELECT * FROM custom_cards ORDER BY upvotes DESC, created_at DESC LIMIT 50")
        cards = [dict(r) for r in cur.fetchall()]
        for c in cards:
            c["created_at"] = str(c["created_at"])
        return cards

@api.post("/custom-cards")
def create_custom_card(payload: dict):
    # Payload matches the custom_cards schema
    name = payload.get("name", "Untitled")
    faction = payload.get("faction", "Neutral")
    card_type = payload.get("card_type", "Entity")
    cost = payload.get("cost", 0)
    power = payload.get("power", None)
    health = payload.get("health", None)
    description = payload.get("description", "")
    lore = payload.get("lore", "")
    author = payload.get("author", "Anonymous")

    with DB() as cur:
        cur.execute("""
            INSERT INTO custom_cards (name, faction, card_type, cost, power, health, description, lore, author)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id
        """, (name, faction, card_type, cost, power, health, description, lore, author))
        card_id = cur.fetchone()["id"]
        
    return {"status": "success", "id": card_id}

@api.post("/custom-cards/{card_id}/upvote")
def upvote_custom_card(card_id: int):
    with DB() as cur:
        cur.execute("UPDATE custom_cards SET upvotes = upvotes + 1 WHERE id = %s RETURNING upvotes", (card_id,))
        res = cur.fetchone()
        if not res:
            raise HTTPException(status_code=404, detail="Card not found")
        return {"status": "success", "upvotes": res["upvotes"]}


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
            waiting = cur.fetchone()
        else:
            # Look for an opponent first
            cur.execute(
                "SELECT * FROM matches WHERE status='WAITING' AND player2 IS NULL AND player1 != %s ORDER BY id DESC LIMIT 1", (req.username,)
            )
            waiting = cur.fetchone()
            if not waiting:
                # No opponent found, check if we already have our own waiting room
                cur.execute(
                    "SELECT * FROM matches WHERE status='WAITING' AND player2 IS NULL AND player1 = %s ORDER BY id DESC LIMIT 1", (req.username,)
                )
                waiting = cur.fetchone()

    if waiting:
        if waiting["player1"] == req.username:
            # Rejoin our own waiting room (update deck just in case)
            waiting_state = waiting["state"]
            waiting_state["p1_deck"] = deck1
            with DB() as cur:
                cur.execute("UPDATE matches SET state=%s WHERE id=%s", (Json(waiting_state), waiting["id"]))
            return {"matchId": waiting["id"], "slot": 1, "roomCode": waiting["room_code"], "status": "WAITING", "vsAI": False}
        else:
            # Join as player 2
            with DB() as cur:
                # Clean up any stale waiting rooms we might have created
                cur.execute("DELETE FROM matches WHERE status='WAITING' AND player1=%s", (req.username,))
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
            if not pl.get("handRevealed"):
                pl["hand"] = [c if c.get("revealed") else {"instanceId": c["instanceId"], "hidden": True} for c in pl.get("hand", [])]
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
def register(req: RegisterReq, request: Request):
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
        origin = request.headers.get("origin", "http://localhost:3000")
        resend.Emails.send({
            "from": "GlimmerFall <onboarding@resend.dev>",
            "to": [req.email],
            "subject": "Verify Your GlimmerFall Account",
            "html": f"<p>Welcome {nickname}! Please verify your account by clicking <a href='{origin}/dashboard?verify={token}'>here</a>.</p>"
        })
    except Exception as e:
        logger.error(f"Resend error: {e}")
        
    return {"ok": True, "message": "Registered! Please check your email to verify."}

class ResendVerifyReq(BaseModel):
    email: str

@api.post("/auth/resend-verify")
def resend_verify(req: ResendVerifyReq, request: Request):
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
        origin = request.headers.get("origin", "http://localhost:3000")
        resend.Emails.send({
            "from": "GlimmerFall <onboarding@resend.dev>",
            "to": [req.email],
            "subject": "Verify Your GlimmerFall Account",
            "html": f"<p>Welcome {u['nickname']}! Please verify your account by clicking <a href='{origin}/dashboard?verify={token}'>here</a>.</p>"
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
            "avatar": u["avatar"],
            "wins": u["wins"],
            "losses": u["losses"],
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
        "gross_revenue": preorders * 80
    }

@api.get("/admin/stats/game")
def admin_telemetry(request: Request):
    with DB() as cur:
        # 1. Deck Win Rates
        cur.execute("""
            SELECT COALESCE(deck_name, 'Unknown Deck') as deck, SUM(wins) as wins, SUM(total_games) as total_games
            FROM (
                SELECT player1_deck as deck_name, 
                       SUM(CASE WHEN CAST(state->>'winner' AS INTEGER) = 0 THEN 1 ELSE 0 END) as wins,
                       COUNT(id) as total_games
                FROM matches WHERE status='FINISHED' AND player1_deck IS NOT NULL
                GROUP BY player1_deck
                UNION ALL
                SELECT player2_deck as deck_name, 
                       SUM(CASE WHEN CAST(state->>'winner' AS INTEGER) = 1 THEN 1 ELSE 0 END) as wins,
                       COUNT(id) as total_games
                FROM matches WHERE status='FINISHED' AND player2_deck IS NOT NULL
                GROUP BY player2_deck
            ) as combined
            GROUP BY deck_name
            ORDER BY total_games DESC, wins DESC
        """)
        raw_decks = cur.fetchall()
        deck_win_rates = []
        for rd in raw_decks:
            win_rate = (rd["wins"] / rd["total_games"]) * 100 if rd["total_games"] > 0 else 0
            deck_win_rates.append({
                "deck": rd["deck"],
                "winRate": round(win_rate, 1),
                "totalGames": rd["total_games"]
            })

        # 2. Referrals
        cur.execute("SELECT COALESCE(referral_source, 'Direct/Organic') as source, COUNT(*) as count FROM users GROUP BY source")
        referrals = [dict(r) for r in cur.fetchall()]
        
        # 3. First vs Second
        cur.execute("SELECT COUNT(*) as c FROM matches WHERE status='FINISHED' AND CAST(state->>'winner' AS INTEGER) = 0")
        p1_wins = cur.fetchone()["c"]
        cur.execute("SELECT COUNT(*) as c FROM matches WHERE status='FINISHED' AND CAST(state->>'winner' AS INTEGER) = 1")
        p2_wins = cur.fetchone()["c"]
        
        total_p = p1_wins + p2_wins
        first_win = round((p1_wins / total_p * 100), 1) if total_p > 0 else 50
        second_win = round((p2_wins / total_p * 100), 1) if total_p > 0 else 50

    return {
        "deck_win_rates": deck_win_rates,
        "referrals": referrals,
        "first_vs_second": {
            "first": first_win,
            "second": second_win
        }
    }

class ReportReq(BaseModel):
    username: str
    title: str
    description: str

@api.get("/reports")
def get_reports():
    with DB() as cur:
        cur.execute("SELECT * FROM reports ORDER BY created_at DESC LIMIT 100")
        reports = [dict(r) for r in cur.fetchall()]
        for r in reports:
            r["created_at"] = str(r["created_at"])
        return reports

@api.post("/reports")
def create_report(req: ReportReq):
    with DB() as cur:
        cur.execute(
            "INSERT INTO reports (username, title, description) VALUES (%s, %s, %s) RETURNING id",
            (req.username, req.title, req.description)
        )
        report_id = cur.fetchone()["id"]
    return {"status": "success", "id": report_id}

@api.get("/admin/users")
def get_admin_users(request: Request):
    user = get_user_from_request(request)
    if not user or not user.get("is_admin"):
        raise HTTPException(403, "Access denied")
    with DB() as cur:
        cur.execute("SELECT id, nickname as username, email, is_admin FROM users ORDER BY id DESC")
        return [dict(r) for r in cur.fetchall()]

@api.post("/admin/users/{target_id}/toggle_admin")
def toggle_admin(target_id: int, request: Request):
    user = get_user_from_request(request)
    if not user:
        raise HTTPException(401, "Not logged in")
    
    # Check if caller is one of the owners
    owner_emails = ["swagyser9@gmail.com"]
    if user.get("email") not in owner_emails:
        raise HTTPException(403, "Only owners can modify admin roles")
        
    with DB() as cur:
        cur.execute("SELECT is_admin FROM users WHERE id=%s", (target_id,))
        target = cur.fetchone()
        if not target:
            raise HTTPException(404, "User not found")
        
        new_status = not target["is_admin"]
        cur.execute("UPDATE users SET is_admin=%s WHERE id=%s", (new_status, target_id))
    return {"status": "success", "is_admin": new_status}

@api.get("/admin/shop/orders")
def admin_get_shop_orders(request: Request):
    user = get_user_from_request(request)
    if not user or not user.get("is_admin"):
        raise HTTPException(403, "Access denied")
    with DB() as cur:
        cur.execute("""
            SELECT o.id, u.email as user_email, o.first_name, o.last_name, 
                   o.address, o.country, o.shipping_cost, o.total_amount, o.status, o.created_at
            FROM shop_orders o
            LEFT JOIN users u ON o.user_id = u.id
            ORDER BY o.created_at DESC
        """)
        orders = []
        for r in cur.fetchall():
            rd = dict(r)
            rd["created_at"] = str(rd["created_at"])
            t = float(rd["total_amount"] or 0)
            s = float(rd["shipping_cost"] or 0)
            rd["net_profit"] = t - s
            orders.append(rd)
        return orders


@api.get("/shop/products")
def get_public_products():
    with DB() as cur:
        cur.execute("SELECT * FROM shop_products ORDER BY id ASC")
        return cur.fetchall()

@api.get("/admin/shop/products")
def get_admin_products(request: Request):
    user = get_user_from_request(request)
    if not user or not user.get("is_admin"): raise HTTPException(403)
    with DB() as cur:
        cur.execute("SELECT * FROM shop_products ORDER BY id ASC")
        return cur.fetchall()

@api.get("/admin/shop/stats")
def get_admin_shop_stats(request: Request):
    user = get_user_from_request(request)
    if not user or not user.get("is_admin"): raise HTTPException(403)
    with DB() as cur:
        cur.execute("SELECT COUNT(*) as total_orders, COALESCE(SUM(total_amount), 0) as total_revenue FROM shop_orders")
        stats = cur.fetchone()
        cur.execute("SELECT country, COUNT(*) as count FROM shop_orders GROUP BY country")
        stats['by_country'] = cur.fetchall()
        return stats

@api.get("/admin/shop/orders")
def get_admin_shop_orders(request: Request):
    user = get_user_from_request(request)
    if not user or not user.get("is_admin"): raise HTTPException(403)
    with DB() as cur:
        cur.execute("SELECT * FROM shop_orders ORDER BY created_at DESC")
        return cur.fetchall()

app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
def _shutdown():
    DB_POOL.closeall()
