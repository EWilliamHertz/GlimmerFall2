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
from pydantic import BaseModel, Field

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import stripe
stripe.api_key = os.environ.get("STRIPE_SECRET_KEY")

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


@api.delete("/decks/{deck_id}")
def delete_deck(deck_id: int, request: Request):
    user = get_user_from_request(request)
    with DB() as cur:
        cur.execute("DELETE FROM deck_cards WHERE deck_id IN (SELECT id FROM decks WHERE id=%s AND username=%s)", (deck_id, user['nickname']))
        cur.execute("DELETE FROM decks WHERE id=%s AND username=%s", (deck_id, user['nickname']))
        if cur.rowcount == 0:
            raise HTTPException(403, "Deck not found or access denied")
    return {"ok": True}

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


# ---------------- polls ----------------

class PollCreateReq(BaseModel):
    title: str
    description: Optional[str] = None
    finish_at: Optional[datetime.datetime] = None
    options: list[str]

class PollVoteReq(BaseModel):
    option_id: int

@api.get("/polls")
def get_polls():
    with DB() as cur:
        cur.execute("SELECT * FROM polls ORDER BY created_at DESC")
        polls = [dict(r) for r in cur.fetchall()]
        
        if not polls:
            return []
            
        poll_ids = tuple(p["id"] for p in polls)
        cur.execute("SELECT * FROM poll_options WHERE poll_id IN %s", (poll_ids,))
        options = [dict(r) for r in cur.fetchall()]
        
        cur.execute("SELECT option_id, COUNT(*) as vote_count FROM poll_votes WHERE poll_id IN %s GROUP BY option_id", (poll_ids,))
        vote_counts = {r["option_id"]: r["vote_count"] for r in cur.fetchall()}
        
        for opt in options:
            opt["vote_count"] = vote_counts.get(opt["id"], 0)
            
        for p in polls:
            p["created_at"] = str(p["created_at"])
            if p["finish_at"]:
                p["finish_at"] = str(p["finish_at"])
            p["options"] = [opt for opt in options if opt["poll_id"] == p["id"]]
            
        return polls

@api.post("/polls")
def create_poll(req: PollCreateReq, request: Request):
    user = get_user_from_request(request)
    if not user or not user.get("is_admin"):
        raise HTTPException(403, "Access denied")
        
    with DB() as cur:
        cur.execute(
            "INSERT INTO polls (title, description, finish_at) VALUES (%s, %s, %s) RETURNING id",
            (req.title, req.description, req.finish_at)
        )
        poll_id = cur.fetchone()["id"]
        
        for opt in req.options:
            cur.execute("INSERT INTO poll_options (poll_id, option_text) VALUES (%s, %s)", (poll_id, opt))
            
    return {"status": "success", "id": poll_id}

@api.post("/polls/{poll_id}/vote")
def vote_poll(poll_id: int, req: PollVoteReq, request: Request):
    user = get_user_from_request(request)
    if not user:
        raise HTTPException(401, "Not logged in")
        
    with DB() as cur:
        cur.execute("SELECT * FROM polls WHERE id=%s", (poll_id,))
        poll = cur.fetchone()
        if not poll:
            raise HTTPException(404, "Poll not found")
        if not poll["is_active"] or (poll["finish_at"] and poll["finish_at"] < datetime.datetime.now()):
            raise HTTPException(400, "Poll is closed")
            
        cur.execute("SELECT * FROM poll_options WHERE id=%s AND poll_id=%s", (req.option_id, poll_id))
        if not cur.fetchone():
            raise HTTPException(400, "Invalid option")
            
        cur.execute(
            "INSERT INTO poll_votes (poll_id, option_id, user_email) VALUES (%s, %s, %s) "
            "ON CONFLICT (poll_id, user_email) DO UPDATE SET option_id = EXCLUDED.option_id",
            (poll_id, req.option_id, user["email"])
        )
    return {"status": "success"}

# ---------------- decks ----------------

@api.get("/decks")
def get_all_decks(request: Request):
    user = get_user_from_request(request)
    user_email = user["email"] if user else None
    
    with DB() as cur:
        cur.execute("""
            SELECT d.id, d.username, d.deck_name, d.created_at, d.is_preconstructed,
                   (SELECT COUNT(*) FROM deck_likes dl WHERE dl.deck_id = d.id) as likes_count
            FROM decks d
            ORDER BY d.created_at DESC
            LIMIT 100
        """)
        decks = [dict(r) for r in cur.fetchall()]
        
        if not decks:
            return []
            
        deck_ids = tuple(d["id"] for d in decks)
        
        cur.execute("SELECT dc.deck_id, dc.card_name, dc.count, c.faction, c.image_url FROM deck_cards dc JOIN cards c ON dc.card_name = c.name WHERE dc.deck_id IN %s", (deck_ids,))
        cards = [dict(r) for r in cur.fetchall()]
        
        user_likes = set()
        if user_email:
            cur.execute("SELECT deck_id FROM deck_likes WHERE user_email=%s AND deck_id IN %s", (user_email, deck_ids))
            user_likes = {r["deck_id"] for r in cur.fetchall()}
            
        for d in decks:
            d["created_at"] = str(d["created_at"])
            d["cards"] = [c for c in cards if c["deck_id"] == d["id"]]
            d["liked_by_me"] = d["id"] in user_likes
            
        return decks

@api.post("/decks/{deck_id}/like")
def toggle_deck_like(deck_id: int, request: Request):
    user = get_user_from_request(request)
    if not user:
        raise HTTPException(401, "Not logged in")
        
    with DB() as cur:
        cur.execute("SELECT * FROM decks WHERE id=%s", (deck_id,))
        if not cur.fetchone():
            raise HTTPException(404, "Deck not found")
            
        cur.execute("SELECT * FROM deck_likes WHERE deck_id=%s AND user_email=%s", (deck_id, user["email"]))
        existing = cur.fetchone()
        
        if existing:
            cur.execute("DELETE FROM deck_likes WHERE deck_id=%s AND user_email=%s", (deck_id, user["email"]))
            liked = False
        else:
            cur.execute("INSERT INTO deck_likes (deck_id, user_email) VALUES (%s, %s)", (deck_id, user["email"]))
            liked = True
            
        cur.execute("SELECT COUNT(*) as likes_count FROM deck_likes WHERE deck_id=%s", (deck_id,))
        likes_count = cur.fetchone()["likes_count"]
        
    return {"status": "success", "liked": liked, "likes_count": likes_count}

class CommentCreateReq(BaseModel):
    content: str
    parent_id: Optional[int] = None

@api.get("/decks/{deck_id}/comments")
def get_deck_comments(deck_id: int):
    with DB() as cur:
        cur.execute("SELECT * FROM decks WHERE id=%s", (deck_id,))
        if not cur.fetchone():
            raise HTTPException(404, "Deck not found")
            
        cur.execute("SELECT * FROM deck_comments WHERE deck_id=%s ORDER BY created_at ASC", (deck_id,))
        comments = [dict(r) for r in cur.fetchall()]
        
        for c in comments:
            c["created_at"] = str(c["created_at"])
            
        return comments

@api.post("/decks/{deck_id}/comments")
def create_deck_comment(deck_id: int, req: CommentCreateReq, request: Request):
    user = get_user_from_request(request)
    if not user:
        raise HTTPException(401, "Not logged in")
        
    with DB() as cur:
        cur.execute("SELECT * FROM decks WHERE id=%s", (deck_id,))
        if not cur.fetchone():
            raise HTTPException(404, "Deck not found")
            
        if req.parent_id:
            cur.execute("SELECT * FROM deck_comments WHERE id=%s AND deck_id=%s", (req.parent_id, deck_id))
            if not cur.fetchone():
                raise HTTPException(404, "Parent comment not found")
                
        cur.execute(
            "INSERT INTO deck_comments (deck_id, user_email, content, parent_id) VALUES (%s, %s, %s, %s) RETURNING id, created_at",
            (deck_id, user["email"], req.content, req.parent_id)
        )
        res = cur.fetchone()
        
    return {"status": "success", "id": res["id"], "created_at": str(res["created_at"])}



# ---------------- matchmaking + match ----------------

class MatchmakeReq(BaseModel):
    username: str
    roomCode: Optional[str] = None
    faction: Optional[str] = None
    deckCards: Optional[list] = None
    deckName: Optional[str] = None
    vsAI: bool = False


class ActionReq(BaseModel):
    matchId: int
    slot: int
    action: str
    payload: Optional[dict] = None


def save_match(match_id, state):
    active_slot = str(state.get("activePlayer", 1))
    active_name = state["players"][active_slot]["username"]
    with DB() as cur:
        cur.execute("SELECT status, player1, player2, is_ranked FROM matches WHERE id=%s", (match_id,))
        old = cur.fetchone()
        if old and old["status"] != "ENDED" and state.get("phase") == "ENDED":
            w = state.get("winner")
            
            p1_name = old["player1"]
            p2_name = old["player2"]
            
            # Fetch current MMR if it's a ranked match
            if old["is_ranked"] and p1_name and p2_name and not state.get("isAI"):
                cur.execute("SELECT nickname, mmr FROM users WHERE nickname IN (%s, %s)", (p1_name, p2_name))
                users = cur.fetchall()
                p1_mmr = 1000
                p2_mmr = 1000
                for u in users:
                    if u["nickname"] == p1_name: p1_mmr = u["mmr"] or 1000
                    elif u["nickname"] == p2_name: p2_mmr = u["mmr"] or 1000
                
                # Basic Elo calculation (K=32)
                expected_p1 = 1 / (1 + 10 ** ((p2_mmr - p1_mmr) / 400))
                expected_p2 = 1 / (1 + 10 ** ((p1_mmr - p2_mmr) / 400))
                
                actual_p1 = 1 if w == 1 else (0 if w == 2 else 0.5)
                actual_p2 = 1 if w == 2 else (0 if w == 1 else 0.5)
                
                new_p1_mmr = max(0, int(p1_mmr + 32 * (actual_p1 - expected_p1)))
                new_p2_mmr = max(0, int(p2_mmr + 32 * (actual_p2 - expected_p2)))
                
                cur.execute("UPDATE users SET mmr = %s WHERE nickname = %s", (new_p1_mmr, p1_name))
                cur.execute("UPDATE users SET mmr = %s WHERE nickname = %s", (new_p2_mmr, p2_name))
            
            if w == 1:
                cur.execute("UPDATE users SET wins = wins + 1 WHERE nickname=%s", (p1_name,))
                if not state.get("isAI"):
                    cur.execute("UPDATE users SET losses = losses + 1 WHERE nickname=%s", (p2_name,))
            elif w == 2:
                if not state.get("isAI"):
                    cur.execute("UPDATE users SET wins = wins + 1 WHERE nickname=%s", (p2_name,))
                cur.execute("UPDATE users SET losses = losses + 1 WHERE nickname=%s", (p1_name,))

        cur.execute(
            "UPDATE matches SET state=%s, status=%s, current_turn=%s, active_player=%s WHERE id=%s",
            (Json(state), state.get("phase"), state.get("turn"), active_name, match_id),
        )


def insert_match(room_code, p1, p2, state, p1_deck=None, p2_deck=None, is_ranked=False):
    active_name = state["players"][state.get("activePlayer", 1) and str(state.get("activePlayer", 1))]["username"] if state.get("phase") == "PLAYING" else p1
    with DB() as cur:
        cur.execute(
            "INSERT INTO matches (room_code, player1, player2, status, current_turn, active_player, state, player1_deck, player2_deck, is_ranked) "
            "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id",
            (room_code, p1, p2, state.get("phase", "WAITING"), state.get("turn", 1), active_name, Json(state), p1_deck, p2_deck, is_ranked),
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
        import random
        with DB() as cur:
            cur.execute("SELECT id, deck_name FROM decks WHERE is_preconstructed = TRUE")
            precons = cur.fetchall()
            ai_deck = random.choice(precons) if precons else {"id": None, "deck_name": "Random Chaos"}
            
            ai_card_ids = None
            if ai_deck["id"]:
                cur.execute("SELECT c.id, dc.count FROM deck_cards dc JOIN cards c ON dc.card_name = c.name WHERE dc.deck_id = %s", (ai_deck["id"],))
                rows = cur.fetchall()
                if rows:
                    ai_card_ids = []
                    for r in rows:
                        for _ in range(r["count"]):
                            ai_card_ids.append(r["id"])
                            
        deck2 = ge.build_deck(pool, faction=None, card_ids=ai_card_ids)
        state = ge.new_match_state(req.username, deck1, ge.AI_NAME, deck2, is_ai=True)
        with DB() as cur:
            cur.execute("SELECT mmr FROM users WHERE nickname=%s", (req.username,))
            u_row = cur.fetchone()
            state["players"]["1"]["mmr"] = u_row["mmr"] if u_row else 1200
            state["players"]["2"]["mmr"] = 1200
        state["log"].insert(1, f"GlimmerBot is to play {ai_deck['deck_name']}.")
        room = _rand_room()
        mid = insert_match(room, req.username, ge.AI_NAME, state, req.deckName or "Custom", ai_deck.get("deck_name", "Random Chaos"))
        with DB() as cur:
            cur.execute("UPDATE matches SET player1_deck=%s, player2_deck=%s WHERE id=%s", (req.deckName or 'Unknown Deck', ai_deck['deck_name'], mid))
        return {"matchId": mid, "slot": 1, "roomCode": room, "status": "PLAYING", "vsAI": True}

    room = (req.roomCode or "").strip().upper()
    is_ranked = not bool(room)

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
                "SELECT * FROM matches WHERE status='WAITING' AND player2 IS NULL AND player1 != %s AND is_ranked = TRUE ORDER BY id DESC LIMIT 1", (req.username,)
            )
            waiting = cur.fetchone()
            if not waiting:
                # No opponent found, check if we already have our own waiting room
                cur.execute(
                    "SELECT * FROM matches WHERE status='WAITING' AND player2 IS NULL AND player1 = %s AND is_ranked = TRUE ORDER BY id DESC LIMIT 1", (req.username,)
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
            with DB() as cur:
                cur.execute("SELECT nickname, mmr FROM users WHERE nickname IN (%s, %s)", (waiting["player1"], req.username))
                for row in cur.fetchall():
                    if row["nickname"] == waiting["player1"]:
                        state["players"]["1"]["mmr"] = row["mmr"]
                    else:
                        state["players"]["2"]["mmr"] = row["mmr"]
                if "mmr" not in state["players"]["1"]: state["players"]["1"]["mmr"] = 1200
                if "mmr" not in state["players"]["2"]: state["players"]["2"]["mmr"] = 1200
                cur.execute("UPDATE matches SET player2=%s, player2_deck=%s WHERE id=%s", (req.username, req.deckName or "Custom", waiting["id"]))
            save_match(waiting["id"], state)
            return {"matchId": waiting["id"], "slot": 2, "roomCode": waiting["room_code"], "status": "PLAYING", "vsAI": False}

    # ----- create a new waiting room -----
    if not room:
        room = _rand_room()
    waiting_state = {"phase": "WAITING", "activePlayer": 1, "turn": 1,
                     "players": {"1": {"username": req.username}},
                     "p1_deck": deck1, "p1_deck_name": req.deckName or "Custom", "log": [f"{req.username} created room {room}. Waiting for an opponent..."]}
    mid = insert_match(room, req.username, None, waiting_state, req.deckName or "Custom", None, is_ranked=is_ranked)
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

def get_verification_email_html(nickname: str, token: str, origin: str) -> str:
    return f"""
    <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #0B0C10; color: #FFFFFF; padding: 40px; border-radius: 12px; border: 1px solid #1F2937;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="margin: 0; font-size: 36px; color: #F2A900; letter-spacing: 4px; text-transform: uppercase; font-weight: 900;">GLIMMER<span style="color: #00BFFF;">FALL</span></h1>
        <p style="margin: 10px 0 0; color: #A0A0A0; font-size: 14px; letter-spacing: 2px; text-transform: uppercase;">Awaken the Nexus. Master the Resonance.</p>
      </div>
      <p style="font-size: 18px; color: #F3F4F6;">Greetings, Summoner <strong>{nickname}</strong>.</p>
      <div style="background-color: #111827; padding: 20px; border-left: 4px solid #9B30FF; margin: 20px 0; font-style: italic; color: #D1D5DB; line-height: 1.6;">
        "Before time was given shape, there was only the radiance of the Glimmer and the silence of the Fall. Between them stood the Nexus, a crystalline heart that bound matter, memory, and possibility. The Nexus has shattered. Now, powerful Summoners channel Resonance to call Entities from the fragments of creation. You are one of them."
      </div>
      <p style="line-height: 1.6; color: #F3F4F6;">
        The war between Light and Void has begun. Before you can weave your spells and build your deck, you must awaken your account and secure your place in the arena.
      </p>
      <div style="text-align: center; margin: 40px 0;">
        <a href="{origin}/dashboard?verify={token}" style="background-color: #F2A900; color: #000000; padding: 16px 32px; text-decoration: none; font-weight: bold; border-radius: 8px; font-size: 16px; display: inline-block; text-transform: uppercase; letter-spacing: 1px; box-shadow: 0 4px 14px rgba(242,169,0,0.4);">Verify Account</a>
      </div>
      <hr style="border: 0; border-top: 1px solid #374151; margin-top: 40px; margin-bottom: 20px;" />
      <p style="font-size: 12px; color: #6B7280; text-align: center;">
        If you did not request this summons, please ignore this email. The Void shall consume it soon enough.<br/>
        &copy; 2026 GlimmerFall TCG. All rights reserved.
      </p>
    </div>
    """

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
            "from": "GlimmerFall <noreply@glimmerfalltcg.com>",
            "to": [req.email],
            "subject": "Awaken Your GlimmerFall Account",
            "html": get_verification_email_html(nickname, token, origin)
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
            "from": "GlimmerFall <noreply@glimmerfalltcg.com>",
            "to": [req.email],
            "subject": "Awaken Your GlimmerFall Account",
            "html": get_verification_email_html(u['nickname'], token, origin)
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

class AvatarReq(BaseModel):
    avatar_url: str

@api.put("/auth/me/avatar")
def update_avatar(req: AvatarReq, request: Request):
    user = get_user_from_request(request)
    with DB() as cur:
        cur.execute("UPDATE users SET avatar=%s WHERE id=%s", (req.avatar_url, user["id"]))
    return {"ok": True, "avatar": req.avatar_url}

# ----- SOCIAL & META FEATURES -----

@api.get("/leaderboard")
def get_leaderboard():
    with DB() as cur:
        cur.execute("SELECT nickname, mmr, wins, losses, faction, avatar FROM users ORDER BY mmr DESC NULLS LAST, wins DESC LIMIT 100")
        return cur.fetchall()

@api.get("/auth/me/matches")
def get_my_matches(request: Request):
    user = get_user_from_request(request)
    with DB() as cur:
        cur.execute("SELECT id, player1, player2, player1_deck, player2_deck, status, created_at, state->>'winner' as winner, state->>'turn' as turn FROM matches WHERE (player1=%s OR player2=%s) AND status='ENDED' ORDER BY id DESC LIMIT 20", (user['nickname'], user['nickname']))
        return cur.fetchall()

@api.get("/auth/me/quests")
def get_my_quests(request: Request):
    user = get_user_from_request(request)
    with DB() as cur:
        cur.execute("SELECT * FROM user_quests WHERE user_id=%s AND created_at >= NOW() - INTERVAL '1 day'", (user['id'],))
        quests = cur.fetchall()
        
        # Check if there is an approved global daily quest for today that the user doesn't have
        cur.execute("SELECT * FROM daily_quests WHERE quest_date = CURRENT_DATE AND is_approved = TRUE")
        daily_quest = cur.fetchone()
        
        if daily_quest:
            # Check if user already has this specific quest active
            has_it = any(q['description'] == daily_quest['description'] for q in quests)
            if not has_it:
                cur.execute("INSERT INTO user_quests (user_id, description, target_value, reward) VALUES (%s, %s, %s, %s) RETURNING *", (user['id'], daily_quest['description'], daily_quest['target_value'], daily_quest['reward']))
                quests.append(cur.fetchone())
                
        # Fallback to random if they have nothing and there's no global quest
        if not quests:
            import random
            q_types = [
                ("Win 3 games", 3, "1 Booster Pack"),
                ("Play 10 Rites", 10, "50 Glimmer"),
            ]
            for desc, tgt, rw in random.sample(q_types, 1):
                cur.execute("INSERT INTO user_quests (user_id, description, target_value, reward) VALUES (%s, %s, %s, %s) RETURNING *", (user['id'], desc, tgt, rw))
                quests.append(cur.fetchone())
        return quests

@api.get("/auth/me/friends")
def get_friends(request: Request):
    user = get_user_from_request(request)
    with DB() as cur:
        cur.execute('''
            SELECT f.id, f.status, u.nickname, u.avatar, u.mmr,
                   CASE WHEN f.user_id = %s THEN 'outgoing' ELSE 'incoming' END as direction,
                   (SELECT id FROM matches m WHERE (m.player1 = u.nickname OR m.player2 = u.nickname) AND m.status = 'PLAYING' ORDER BY m.id DESC LIMIT 1) as current_match_id,
                   (SELECT CASE WHEN player1 = u.nickname THEN 1 ELSE 2 END FROM matches m WHERE (m.player1 = u.nickname OR m.player2 = u.nickname) AND m.status = 'PLAYING' ORDER BY m.id DESC LIMIT 1) as current_match_slot,
                   (SELECT room_code FROM matches m WHERE (m.player1 = u.nickname OR m.player2 = u.nickname) AND m.status = 'PLAYING' ORDER BY m.id DESC LIMIT 1) as current_room_code
            FROM friendships f
            JOIN users u ON (f.user_id = u.id OR f.friend_id = u.id)
            WHERE (f.user_id = %s OR f.friend_id = %s) AND u.id != %s
        ''', (user['id'], user['id'], user['id'], user['id']))
        return cur.fetchall()

class FriendReq(BaseModel):
    nickname: str

@api.post("/auth/me/friends/request")
def request_friend(req: FriendReq, request: Request):
    user = get_user_from_request(request)
    if user['nickname'].lower() == req.nickname.lower():
        raise HTTPException(400, "Cannot add yourself.")
    with DB() as cur:
        cur.execute("SELECT id FROM users WHERE nickname ILIKE %s", (req.nickname,))
        target = cur.fetchone()
        if not target:
            raise HTTPException(404, "User not found")
        cur.execute("INSERT INTO friendships (user_id, friend_id, status) VALUES (%s, %s, 'pending') ON CONFLICT (user_id, friend_id) DO NOTHING", (user['id'], target['id']))
    return {"ok": True}

@api.post("/auth/me/friends/{fid}/accept")
def accept_friend(fid: int, request: Request):
    user = get_user_from_request(request)
    with DB() as cur:
        cur.execute("UPDATE friendships SET status='accepted' WHERE id=%s AND friend_id=%s", (fid, user['id']))
    return {"ok": True}


@api.get("/admin/quests")
def get_admin_quests(request: Request):
    if not get_user_from_request(request).get('is_admin'): raise HTTPException(403)
    with DB() as cur:
        cur.execute("SELECT * FROM daily_quests ORDER BY quest_date ASC")
        return cur.fetchall()

class GenerateQuestsReq(BaseModel):
    days: int

@api.post("/admin/quests/generate")
def generate_admin_quests(req: GenerateQuestsReq, request: Request):
    if not get_user_from_request(request).get('is_admin'): raise HTTPException(403)
    import random
    from datetime import date, timedelta
    q_types = [
        ("Win 3 games", 3, "1 Booster Pack"),
        ("Play 10 Rites", 10, "50 Glimmer"),
        ("Deal 50 damage to enemy Nexus", 50, "100 Glimmer"),
        ("Play 5 Solari Entities", 5, "25 Glimmer"),
        ("Cast 5 Flash spells", 5, "25 Glimmer")
    ]
    with DB() as cur:
        # Get the latest quest date, or start from today
        cur.execute("SELECT MAX(quest_date) as max_date FROM daily_quests")
        max_date = cur.fetchone()["max_date"]
        start_date = max_date + timedelta(days=1) if max_date else date.today()
        
        for i in range(req.days):
            target_date = start_date + timedelta(days=i)
            desc, tgt, rw = random.choice(q_types)
            try:
                cur.execute("INSERT INTO daily_quests (quest_date, description, target_value, reward) VALUES (%s, %s, %s, %s)", (target_date, desc, tgt, rw))
            except:
                pass
    return {"ok": True}

@api.post("/admin/quests/{qid}/approve")
def approve_admin_quest(qid: int, request: Request):
    if not get_user_from_request(request).get('is_admin'): raise HTTPException(403)
    with DB() as cur:
        cur.execute("UPDATE daily_quests SET is_approved = TRUE WHERE id = %s", (qid,))
    return {"ok": True}

@api.delete("/admin/quests/{qid}")
def delete_admin_quest(qid: int, request: Request):
    if not get_user_from_request(request).get('is_admin'): raise HTTPException(403)
    with DB() as cur:
        cur.execute("DELETE FROM daily_quests WHERE id = %s", (qid,))
    return {"ok": True}

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
                       SUM(CASE WHEN CAST(state->>'winner' AS INTEGER) = 1 THEN 1 ELSE 0 END) as wins,
                       COUNT(id) as total_games
                FROM matches WHERE status='ENDED' AND player1_deck IS NOT NULL
                GROUP BY player1_deck
                UNION ALL
                SELECT player2_deck as deck_name, 
                       SUM(CASE WHEN CAST(state->>'winner' AS INTEGER) = 2 THEN 1 ELSE 0 END) as wins,
                       COUNT(id) as total_games
                FROM matches WHERE status='ENDED' AND player2_deck IS NOT NULL
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
        cur.execute("SELECT COUNT(*) as c FROM matches WHERE status='ENDED' AND CAST(state->>'winner' AS INTEGER) = 1")
        p1_wins = cur.fetchone()["c"]
        cur.execute("SELECT COUNT(*) as c FROM matches WHERE status='ENDED' AND CAST(state->>'winner' AS INTEGER) = 2")
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
        cur.execute("SELECT * FROM shop_orders ORDER BY created_at DESC")
        return cur.fetchall()


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



@api.put("/admin/shop/products/{product_id}")
async def update_admin_product(product_id: int, request: Request):
    user = get_user_from_request(request)
    if not user or not user.get("is_admin"): raise HTTPException(403)
    data = await request.json()
    with DB() as cur:
        cur.execute('''
            UPDATE shop_products 
            SET name = %s, description = %s, price = %s, stock = %s, 
                is_preorder = %s, eta = %s, weight_kg = %s, image_url = %s, cost_price = %s
            WHERE id = %s
        ''', (
            data.get('name'), data.get('description'), data.get('price'), data.get('stock'),
            data.get('is_preorder'), data.get('eta'), data.get('weight_kg'), data.get('image_url'),
            data.get('cost_price', 0), product_id
        ))
        return {"success": True}

class CheckoutItem(BaseModel):
    id: int
    quantity: int

class CheckoutReq(BaseModel):
    items: list[CheckoutItem]

@api.post("/shop/checkout")
def shop_checkout(req: CheckoutReq, request: Request):
    user = get_user_from_request(request)
    with DB() as cur:
        line_items = []
        total_weight = 0.0
        total_amount = 0.0
        
        products_info = []
        for item in req.items:
            cur.execute("SELECT id, name, price, image_url, weight_kg, buy_in_price FROM shop_products WHERE id=%s", (item.id,))
            prod = cur.fetchone()
            if not prod: continue
            
            total_weight += float(prod.get("weight_kg") or 0.0) * item.quantity
            total_amount += float(prod.get("price") or 0.0) * item.quantity
            products_info.append((prod, item.quantity))
            
            line_item = {
                "price_data": {
                    "currency": "usd",
                    "product_data": {
                        "name": prod["name"],
                    },
                    "unit_amount": int(float(prod["price"]) * 100),
                },
                "quantity": item.quantity,
            }
            if prod["image_url"]:
                line_item["price_data"]["product_data"]["images"] = [prod["image_url"]]
            line_items.append(line_item)
            
        if not line_items:
            raise HTTPException(400, "Invalid products")
            
        session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            line_items=line_items,
            mode="payment",
            shipping_address_collection={
                "allowed_countries": ["US", "CA", "GB", "SE", "DE", "FR", "AU", "NZ", "IT", "ES", "NL", "FI", "DK", "NO"]
            },
            phone_number_collection={
                "enabled": True
            },
            shipping_options=[
                {
                    "shipping_rate_data": {
                        "type": "fixed_amount",
                        "fixed_amount": {"amount": 900, "currency": "usd"},
                        "display_name": "Standard Shipping (PostNord)",
                        "delivery_estimate": {
                            "minimum": {"unit": "business_day", "value": 3},
                            "maximum": {"unit": "business_day", "value": 7},
                        },
                    },
                },
                {
                    "shipping_rate_data": {
                        "type": "fixed_amount",
                        "fixed_amount": {"amount": 1900, "currency": "usd"},
                        "display_name": "Express / International",
                        "delivery_estimate": {
                            "minimum": {"unit": "business_day", "value": 1},
                            "maximum": {"unit": "business_day", "value": 3},
                        },
                    },
                }
            ],
            success_url=request.headers.get("origin", "http://localhost:3000") + "/shop?success=true",
            cancel_url=request.headers.get("origin", "http://localhost:3000") + "/shop?canceled=true",
        )
        
        # Save pending order
        cur.execute(
            "INSERT INTO shop_orders (user_id, stripe_session_id, status, total_weight_kg, total_amount, total_cogs) VALUES (%s, %s, 'PENDING', %s, %s, %s) RETURNING id",
            (user['id'] if user else None, session.id, total_weight, total_amount, sum(float(p.get("buy_in_price") or 0.0) * q for p, q in products_info))
        )
        order_id = cur.fetchone()["id"]
        
        for prod, qty in products_info:
            cur.execute(
                "INSERT INTO shop_order_items (order_id, product_id, quantity, price_at_purchase, buy_in_price_at_purchase) VALUES (%s, %s, %s, %s, %s)",
                (order_id, prod["id"], qty, prod["price"], prod.get("buy_in_price") or 0.0)
            )
            
        return {"url": session.url}

@api.post("/shop/webhook")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")
    webhook_secret = os.environ.get("STRIPE_WEBHOOK_SECRET", "")
    
    event = None
    try:
        if webhook_secret:
            event = stripe.Webhook.construct_event(payload, sig_header, webhook_secret)
        else:
            event = json.loads(payload)
    except Exception as e:
        logger.error(f"Webhook error: {e}")
        raise HTTPException(400, "Webhook Error")

    if event['type'] == 'checkout.session.completed':
        session = event['data']['object']
        session_id = session.get('id')
        
        shipping = session.get('shipping_details')
        customer_email = session.get('customer_details', {}).get('email')
        phone = session.get('customer_details', {}).get('phone')
        
        address_str = ""
        country = ""
        first_name = ""
        last_name = ""
        shipping_json = json.dumps(shipping) if shipping else None
        customer_name = ""
        
        if shipping:
            customer_name = shipping.get('name', '')
            name_parts = customer_name.split(' ', 1)
            first_name = name_parts[0] if name_parts else ""
            last_name = name_parts[1] if len(name_parts) > 1 else ""
            addr = shipping.get('address', {})
            country = addr.get('country', '')
            address_str = f"{addr.get('line1', '')}, {addr.get('line2', '')}, {addr.get('city', '')}, {addr.get('state', '')}, {addr.get('postal_code', '')}, {country}"
        total_details = session.get('total_details', {})
        shipping_cost = (total_details.get('amount_shipping') or 0) / 100.0
        tax_amount = (total_details.get('amount_tax') or 0) / 100.0
            
        with DB() as cur:
            cur.execute(
                "UPDATE shop_orders SET status='PAID', first_name=%s, last_name=%s, address=%s, country=%s, shipping_cost=%s, tax_amount=%s, phone=%s, user_email=%s, customer_name=%s, shipping_address=%s WHERE stripe_session_id=%s RETURNING id",
                (first_name, last_name, address_str.strip(", "), country, shipping_cost, tax_amount, phone, customer_email, customer_name, shipping_json, session_id)
            )
            updated = cur.fetchone()
            if updated and customer_email:
                order_id = updated["id"]
                # Send receipt via Resend
                receipt_html = f"<h2>Thank you for your GlimmerFall order!</h2><p>Your Order ID is <b>#{order_id}</b>.</p><p>We will ship your items to:<br>{first_name} {last_name}<br>{address_str.strip(', ')}</p><p>You will receive another email when your order ships.</p>"
                try:
                    resend.Emails.send({
                        "from": "GlimmerFall <noreply@glimmerfalltcg.com>",
                        "to": [customer_email],
                        "subject": f"Receipt for GlimmerFall Order #{order_id}",
                        "html": receipt_html
                    })
                except Exception as e:
                    logger.error(f"Failed to send receipt: {e}")

    return {"status": "success"}

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

@api.get("/matchmaking/queue_size")
def get_queue_size():
    with DB() as cur:
        cur.execute("SELECT COUNT(*) as c FROM matches WHERE status='WAITING' AND player2 IS NULL AND is_ranked = TRUE")
        row = cur.fetchone()
        return {"queue_size": row["c"] if row else 0}
