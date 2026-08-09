import os
import json
import logging
import re
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
                p1_mmr = 1400
                p2_mmr = 1400
                for u in users:
                    if u["nickname"] == p1_name: p1_mmr = u["mmr"] or 1400
                    elif u["nickname"] == p2_name: p2_mmr = u["mmr"] or 1400
                
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
                if state.get("isAI"):
                    cur.execute("UPDATE users SET ai_wins = COALESCE(ai_wins, 0) + 1 WHERE nickname=%s", (p1_name,))
                else:
                    cur.execute("UPDATE users SET wins = wins + 1 WHERE nickname=%s", (p1_name,))
                    cur.execute("UPDATE users SET losses = losses + 1 WHERE nickname=%s", (p2_name,))
            elif w == 2:
                if state.get("isAI"):
                    cur.execute("UPDATE users SET ai_losses = COALESCE(ai_losses, 0) + 1 WHERE nickname=%s", (p1_name,))
                else:
                    cur.execute("UPDATE users SET wins = wins + 1 WHERE nickname=%s", (p2_name,))
                    cur.execute("UPDATE users SET losses = losses + 1 WHERE nickname=%s", (p1_name,))

        cur.execute(
            "UPDATE matches SET state=%s, status=%s, current_turn=%s, active_player=%s, history = history || %s::jsonb WHERE id=%s",
            (Json(state), state.get("phase"), state.get("turn"), active_name, Json([state]), match_id),
        )


def insert_match(room_code, p1, p2, state, p1_deck=None, p2_deck=None, is_ranked=False):
    active_name = state["players"][state.get("activePlayer", 1) and str(state.get("activePlayer", 1))]["username"] if state.get("phase") == "PLAYING" else p1
    with DB() as cur:
        cur.execute(
            "INSERT INTO matches (room_code, player1, player2, status, current_turn, active_player, state, player1_deck, player2_deck, is_ranked, history) "
            "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id",
            (room_code, p1, p2, state.get("phase", "WAITING"), state.get("turn", 1), active_name, Json(state), p1_deck, p2_deck, is_ranked, Json([state])),
        )
        return cur.fetchone()["id"]



@api.delete("/matchmaking/{match_id}")
def cancel_matchmaking(match_id: int):
    with DB() as cur:
        cur.execute("DELETE FROM matches WHERE id=%s AND status='WAITING'", (match_id,))
    return {"status": "cancelled"}

def _rand_room():
    import random, string
    return "".join(random.choices(string.ascii_uppercase + string.digits, k=5))


@api.post("/matchmaking")
def matchmaking(req: MatchmakeReq):
    with DB() as cur:
        # 1. Clean up abandoned queue lobbies first (last ping > 10s ago)
        cur.execute("DELETE FROM matches WHERE status='WAITING' AND last_polled < NOW() - INTERVAL '10 seconds'")
        
        cur.execute("SELECT status FROM users WHERE nickname=%s", (req.username,))
        u = cur.fetchone()
        if u and u["status"] in ["suspended", "banned"]:
            raise HTTPException(403, f"Account is {u['status']}")

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
            state["players"]["1"]["mmr"] = u_row["mmr"] if u_row else 1400
            state["players"]["2"]["mmr"] = 1400
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
                if "mmr" not in state["players"]["1"]: state["players"]["1"]["mmr"] = 1400
                if "mmr" not in state["players"]["2"]: state["players"]["2"]["mmr"] = 1400
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
        if v != "0" and slot != v:
            pl["handCount"] = len(pl.get("hand", []))
            if not pl.get("handRevealed"):
                pl["hand"] = [c if c.get("revealed") else {"instanceId": c["instanceId"], "hidden": True} for c in pl.get("hand", [])]
        else:
            pl["handCount"] = len(pl.get("hand", []))
    return s


@api.get("/match")
def get_match(id: int = Query(...), slot: int = Query(1), isSpectator: bool = Query(False)):
    import time
    from game_engine import apply_action
    
    with DB() as cur:
        cur.execute("SELECT * FROM matches WHERE id=%s", (id,))
        m = cur.fetchone()
        
        if not m:
            raise HTTPException(404, "Match not found")
            
        if m["status"] in ("WAITING", "PLAYING"):
            cur.execute("UPDATE matches SET last_polled=CURRENT_TIMESTAMP WHERE id=%s", (id,))
        
        state = m["state"]
        
        # Enforce turn timer for ranked matches
        if m["is_ranked"] and state.get("phase") == "PLAYING" and state.get("turnStartedAt"):
            elapsed_ms = int(time.time() * 1000) - state["turnStartedAt"]
            if elapsed_ms > 90000: # 90 seconds rope
                try:
                    active = str(state.get("activePlayer", 1))
                    state = apply_action(state, active, "END_TURN", {})
                    cur.execute(
                        "UPDATE matches SET current_turn=%s, active_player=%s, state=%s, history = history || %s::jsonb WHERE id=%s",
                        (state["turn"], state["activePlayer"], json.dumps(state), json.dumps([state]), id)
                    )
                except Exception as e:
                    pass

    return {
        "matchId": m["id"],
        "roomCode": m["room_code"],
        "status": m["status"],
        "turn": state.get("turn", m["current_turn"]),
        "activePlayer": state.get("activePlayer"),
        "player1": m["player1"],
        "player2": m["player2"],
        "is_ranked": m["is_ranked"],
        "state": redact_state(state, 0 if (m["status"] == "ENDED" or isSpectator) else slot),
    }

@api.get("/match/{id}/history")
def get_match_history(id: int):
    with DB() as cur:
        cur.execute("SELECT history FROM matches WHERE id=%s", (id,))
        m = cur.fetchone()
        if not m:
            raise HTTPException(404, "Match not found")
        # Ensure we don't return null
        history = m.get("history") or []
        # We don't redact history because it's only for replays of ended games (or could add a status check)
        return {"history": history}

@api.get("/featured")
def get_featured_matches():
    with DB() as cur:
        cur.execute("SELECT id, player1, player2, room_code, created_at FROM matches WHERE status='PLAYING' AND last_polled > NOW() - INTERVAL '2 minutes' AND is_ranked=true ORDER BY created_at DESC LIMIT 5")
        ranked = cur.fetchall()
        if len(ranked) < 5:
            cur.execute("SELECT id, player1, player2, room_code, created_at FROM matches WHERE status='PLAYING' AND last_polled > NOW() - INTERVAL '2 minutes' AND is_ranked=false ORDER BY created_at DESC LIMIT %s", (5 - len(ranked),))
            ranked.extend(cur.fetchall())
        return [{"id": m["id"], "player1": m["player1"], "player2": m["player2"], "room_code": m["room_code"], "created_at": str(m["created_at"])} for m in ranked]

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
    referrer_code: Optional[str] = None

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

    # generate unique referral_code for the new user
    import re as _re_reg
    base = _re_reg.sub(r"[^a-zA-Z0-9]", "", nickname)[:8].lower() or "user"

    with DB() as cur:
        try:
            # find unused code
            new_code = None
            for suffix in range(0, 999):
                cand = base if suffix == 0 else f"{base}{suffix}"
                cand = cand[:16]
                cur.execute("SELECT 1 FROM users WHERE referral_code=%s", (cand,))
                if not cur.fetchone():
                    new_code = cand
                    break
            cur.execute("""
                INSERT INTO users (email, password_hash, nickname, faction, is_admin, verification_token, referral_code)
                VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id, nickname
            """, (req.email, hashed, nickname, req.faction, is_admin, token, new_code))
            u = cur.fetchone()
        except psycopg2.IntegrityError:
            raise HTTPException(400, "Email already exists")

        # If a referrer_code was supplied, insert a pending referral (matured on verify)
        if req.referrer_code:
            cur.execute(
                "SELECT id, is_verified FROM users WHERE referral_code=%s",
                (req.referrer_code.strip().lower(),),
            )
            ref = cur.fetchone()
            if ref and ref["is_verified"] and ref["id"] != u["id"]:
                try:
                    cur.execute(
                        "INSERT INTO referrals (referrer_id, referee_id, status) "
                        "VALUES (%s, %s, 'pending') ON CONFLICT (referee_id) DO NOTHING",
                        (ref["id"], u["id"]),
                    )
                except Exception as e:
                    logger.warning(f"referral insert failed: {e}")

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
    if u.get("status") == "banned":
        raise HTTPException(403, "Account is banned")
    
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
            "referral_code": u.get("referral_code"),
            "glimmer_balance": u.get("glimmer_balance") or 0,
            "bookings": u["bookings"],
            "badges": u.get("badges") or [],
            "status": u.get("status") or "active",
            "matchmaking": {"mmr": u["mmr"], "rank": u["rank"]}
        }
    }


@api.get("/auth/me")
def get_me(request: Request):
    u = get_user_from_request(request)
    if not u:
        raise HTTPException(401, "Not logged in")
    with DB() as cur:
        cur.execute("SELECT * FROM users WHERE id=%s", (u["id"],))
        db_u = cur.fetchone()
    if not db_u:
        raise HTTPException(401, "User not found")
        
    return {
        "id": db_u["id"],
        "email": db_u["email"],
        "nickname": db_u["nickname"],
        "isAdmin": db_u["is_admin"],
        "isVerified": db_u["is_verified"],
        "faction": db_u["faction"],
        "avatar": db_u["avatar"],
        "wins": db_u["wins"] or 0,
        "losses": db_u["losses"] or 0,
        "ai_wins": db_u.get("ai_wins") or 0,
        "ai_losses": db_u.get("ai_losses") or 0,
        "referrals": db_u["referrals"] or 0,
        "referral_code": db_u.get("referral_code"),
        "glimmer_balance": db_u.get("glimmer_balance") or 0,
        "bookings": db_u.get("bookings") or 0,
        "badges": db_u.get("badges") or [],
        "status": db_u.get("status") or "active",
        "matchmaking": {"mmr": db_u.get("mmr") or 1400, "rank": db_u.get("rank") or "Unranked"}
    }

@api.get("/users/{nickname}")
def get_user_profile(nickname: str):
    with DB() as cur:
        cur.execute("SELECT id, nickname, faction, avatar, wins, losses, mmr, rank FROM users WHERE nickname ILIKE %s", (nickname,))
        db_u = cur.fetchone()
        if not db_u:
            raise HTTPException(404, "User not found")
        
        # Get recent matches
        cur.execute("""
            SELECT m.id, m.created_at, m.status, m.player1, m.player2, m.state
            FROM matches m
            WHERE (m.player1 = %s OR m.player2 = %s) AND m.status = 'ENDED'
            ORDER BY m.created_at DESC
            LIMIT 10
        """, (db_u['nickname'], db_u['nickname']))
        recent_matches = []
        for m in cur.fetchall():
            state = m['state'] or {}
            winner_slot = str(state.get('winner', '0'))
            
            p1_name = m['player1']
            p2_name = m['player2']
            
            if winner_slot == '1':
                winner_name = p1_name
            elif winner_slot == '2':
                winner_name = p2_name
            else:
                winner_name = "Draw"
                
            opponent = p2_name if p1_name == db_u['nickname'] else p1_name
            is_win = (winner_name == db_u['nickname'])
            
            recent_matches.append({
                "id": m['id'],
                "date": m['created_at'].isoformat() if m['created_at'] else None,
                "opponent": opponent,
                "result": "Win" if is_win else "Loss",
                "winner": winner_name
            })
            
    return {
        "id": db_u["id"],
        "nickname": db_u["nickname"],
        "faction": db_u["faction"],
        "avatar": db_u["avatar"],
        "wins": db_u["wins"] or 0,
        "losses": db_u.get("losses") or 0,
        "badges": db_u.get("badges") or [],
        "status": db_u.get("status") or "active",
        "matchmaking": {"mmr": db_u.get("mmr") or 1400, "rank": db_u.get("rank") or "Unranked"},
        "matchHistory": recent_matches
    }
@api.post("/auth/verify")

def verify(token: str):
    with DB() as cur:
        cur.execute("UPDATE users SET is_verified=TRUE, verification_token=NULL WHERE verification_token=%s RETURNING id, nickname, email", (token,))
        u = cur.fetchone()
        if not u:
            raise HTTPException(400, "Invalid or expired token")

        # Signup bonus for the newly verified user
        try:
            grant_glimmer(cur, u["id"], 50, "signup_bonus", memo="Welcome to GlimmerFall")
        except HTTPException:
            pass

        # Mature any pending referral where this user is the referee
        cur.execute(
            "SELECT id, referrer_id, reward_amount FROM referrals "
            "WHERE referee_id=%s AND status='pending' FOR UPDATE",
            (u["id"],),
        )
        ref = cur.fetchone()
        if ref:
            try:
                grant_glimmer(
                    cur, ref["referrer_id"], ref["reward_amount"],
                    "referral", ref_id=str(u["id"]),
                    memo=f"Referred {u['nickname']}"
                )
                # Bonus to referee for verifying via referral
                grant_glimmer(
                    cur, u["id"], 50, "referral_bonus",
                    ref_id=str(ref["referrer_id"]),
                    memo="Bonus for joining via referral"
                )
                cur.execute(
                    "UPDATE referrals SET status='rewarded', verified_at=NOW() WHERE id=%s",
                    (ref["id"],),
                )
                cur.execute(
                    "UPDATE users SET referrals = COALESCE(referrals,0) + 1 WHERE id=%s",
                    (ref["referrer_id"],),
                )
                # notify referrer via email
                cur.execute("SELECT email, nickname FROM users WHERE id=%s", (ref["referrer_id"],))
                referrer = cur.fetchone()
                if referrer:
                    try:
                        resend.Emails.send({
                            "from": "GlimmerFall <noreply@glimmerfalltcg.com>",
                            "to": [referrer["email"]],
                            "subject": "Your friend joined GlimmerFall! +100 Glimmer",
                            "html": f"""
                            <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background:#0B0C10; color:#fff; padding:40px; border-radius:12px; border:1px solid #1F2937;">
                              <h1 style="color:#F2A900; text-align:center;">+100 Glimmer earned</h1>
                              <p>Greetings <strong>{referrer['nickname']}</strong>,</p>
                              <p>Your friend <strong>{u['nickname']}</strong> just verified their GlimmerFall account. As a thank-you for spreading the Resonance, <strong>100 Glimmer</strong> has been added to your balance.</p>
                              <p style="opacity:.6; font-size:12px;">Keep sharing your referral link to earn more.</p>
                            </div>
                            """
                        })
                    except Exception as e:
                        logger.warning(f"Failed referral email: {e}")
            except Exception as e:
                logger.warning(f"Referral maturation failed: {e}")

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
        cur.execute("SELECT nickname, mmr, wins, losses, ai_wins, ai_losses, faction, avatar FROM users ORDER BY mmr DESC NULLS LAST, wins DESC LIMIT 100")
        return cur.fetchall()

@api.get("/giveaway/eligible")
def get_giveaway_eligible():
    with DB() as cur:
        cur.execute("SELECT nickname, avatar FROM users WHERE (COALESCE(ai_wins, 0) + COALESCE(ai_losses, 0)) >= 3 AND COALESCE(referrals, 0) >= 1")
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
        
        # 2b. Top Referrers (User Referral Links)
        cur.execute("""
            SELECT u.nickname as referrer, COUNT(r.id) as count
            FROM referrals r
            JOIN users u ON r.referrer_id = u.id
            GROUP BY u.nickname
            ORDER BY count DESC
            LIMIT 50
        """)
        top_referrers = [dict(r) for r in cur.fetchall()]
        
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
        "top_referrers": top_referrers,
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


class UserStatusReq(BaseModel):
    status: str

@api.put("/admin/users/{target_id}/status")
def admin_set_user_status(target_id: int, req: UserStatusReq, request: Request):
    user = get_user_from_request(request)
    if not user or not user.get("is_admin"): raise HTTPException(403)
    if req.status not in ["active", "suspended", "banned"]:
        raise HTTPException(400, "Invalid status")
    with DB() as cur:
        cur.execute("UPDATE users SET status=%s WHERE id=%s", (req.status, target_id))
    return {"status": "success", "new_status": req.status}

@api.get("/admin/shop/orders")
def admin_get_shop_orders(request: Request):
    user = get_user_from_request(request)
    if not user or not user.get("is_admin"):
        raise HTTPException(403, "Access denied")
    with DB() as cur:
        cur.execute("SELECT * FROM shop_orders WHERE status != 'PENDING' ORDER BY created_at DESC")
        orders = cur.fetchall()
        for o in orders:
            cur.execute("""
                SELECT i.*, p.name as product_name 
                FROM shop_order_items i
                LEFT JOIN shop_products p ON i.product_id = p.id
                WHERE i.order_id = %s
            """, (o["id"],))
            o["items"] = cur.fetchall()
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
        cur.execute("SELECT COUNT(*) as total_orders, COALESCE(SUM(total_amount), 0) as total_revenue FROM shop_orders WHERE status != 'PENDING'")
        stats = cur.fetchone()
        cur.execute("SELECT country, COUNT(*) as count FROM shop_orders WHERE status != 'PENDING' GROUP BY country")
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
            success_url=request.headers.get("origin", "http://localhost:3000") + "/shop?success=true&session_id={CHECKOUT_SESSION_ID}",
            cancel_url=request.headers.get("origin", "http://localhost:3000") + "/shop?canceled=true",
        )
        
        # Save pending order
        cur.execute(
            "INSERT INTO shop_orders (user_id, stripe_session_id, status, total_weight_kg, total_amount, total_cogs) VALUES (%s, %s, 'PENDING', %s, %s, %s) RETURNING id",
            (user['id'] if user else None, session.id, total_weight, total_amount, sum(float(p.get("cost_price") or p.get("buy_in_price") or 0.0) * q for p, q in products_info))
        )
        order_id = cur.fetchone()["id"]
        
        for prod, qty in products_info:
            cur.execute(
                "INSERT INTO shop_order_items (order_id, product_id, quantity, price_at_purchase, buy_in_price_at_purchase) VALUES (%s, %s, %s, %s, %s)",
                (order_id, prod["id"], qty, prod["price"], prod.get("cost_price") or prod.get("buy_in_price") or 0.0)
            )
            
        return {"url": session.url}

@api.get("/shop/orders/session/{session_id}")
def get_order_by_session(session_id: str):
    with DB() as cur:
        cur.execute("SELECT * FROM shop_orders WHERE stripe_session_id = %s", (session_id,))
        order = cur.fetchone()
        if not order:
            raise HTTPException(404, "Order not found")
        
        cur.execute("""
            SELECT i.*, p.name as product_name 
            FROM shop_order_items i
            LEFT JOIN shop_products p ON i.product_id = p.id
            WHERE i.order_id = %s
        """, (order["id"],))
        order["items"] = cur.fetchall()
        
        # Add a rough ETA string based on current data
        # If it's a pre-order, the ETA is the product's ETA. Otherwise, 3-7 days.
        order["delivery_eta"] = "3-7 business days"
        return order

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
        
        shipping = session.get('shipping_details') or {}
        customer_details = session.get('customer_details') or {}
        customer_email = customer_details.get('email')
        phone = customer_details.get('phone') or shipping.get('phone')
        
        # Address fallback to customer_details if shipping_details is empty
        addr_dict = shipping.get('address') or customer_details.get('address') or {}
        country = addr_dict.get('country', '')
        
        address_parts = [
            addr_dict.get('line1'),
            addr_dict.get('line2'),
            addr_dict.get('city'),
            addr_dict.get('state'),
            addr_dict.get('postal_code')
        ]
        address_str = ", ".join([p for p in address_parts if p])
        
        customer_name = shipping.get('name') or customer_details.get('name') or ""
        name_parts = customer_name.split(' ', 1)
        first_name = name_parts[0] if name_parts else ""
        last_name = name_parts[1] if len(name_parts) > 1 else ""
        
        shipping_json = json.dumps(addr_dict)
        
        total_details = session.get('total_details') or {}
        shipping_cost = (total_details.get('amount_shipping') or 0) / 100.0
        tax_amount = (total_details.get('amount_tax') or 0) / 100.0
        total_amount = (session.get('amount_total') or 0) / 100.0
            
        with DB() as cur:
            cur.execute(
                "UPDATE shop_orders SET status='PAID', first_name=%s, last_name=%s, address=%s, country=%s, shipping_cost=%s, tax_amount=%s, phone=%s, user_email=%s, customer_name=%s, shipping_address=%s, total_amount=%s WHERE stripe_session_id=%s RETURNING id",
                (first_name, last_name, address_str.strip(", "), country, shipping_cost, tax_amount, phone, customer_email, customer_name, shipping_json, total_amount, session_id)
            )
            updated = cur.fetchone()
            if updated and customer_email:
                order_id = updated["id"]
                
                # Fetch items for the email
                cur.execute("""
                    SELECT i.*, p.name as product_name 
                    FROM shop_order_items i
                    LEFT JOIN shop_products p ON i.product_id = p.id
                    WHERE i.order_id = %s
                """, (order_id,))
                items = cur.fetchall()
                
                items_html = ""
                for item in items:
                    items_html += f'''
                    <tr>
                        <td style="padding: 12px; border-bottom: 1px solid #333; color: #fff;">{item.get('product_name', 'Unknown Product')}</td>
                        <td style="padding: 12px; border-bottom: 1px solid #333; color: #aaa; text-align: center;">x{item.get('quantity', 1)}</td>
                        <td style="padding: 12px; border-bottom: 1px solid #333; color: #22E07B; text-align: right;">${item.get('price_at_purchase', 0)}</td>
                    </tr>
                    '''
                
                # Send receipt via Resend
                receipt_html = f'''
                <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #0d0d0d; color: #ffffff; padding: 40px 20px; max-width: 600px; margin: 0 auto; border-radius: 8px;">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <h1 style="color: #F2A900; margin: 0; font-size: 28px; text-transform: uppercase; letter-spacing: 2px;">GlimmerFall</h1>
                        <p style="color: #00BFFF; font-size: 14px; margin-top: 5px;">The Multiverse TCG</p>
                    </div>
                    
                    <p style="font-size: 16px; line-height: 1.5; color: #e0e0e0;">
                        Greetings <strong>{first_name} {last_name}</strong>,<br><br>
                        The Void acknowledges your tribute. Your order <strong>#{order_id}</strong> has been secured and is being prepared by our scribes. Whether you wield the blinding light of the Solari, the raw elemental wrath of Gaia, the necrotic persistence of the Graveglass, or the chronomancy of the Fractured Continuum, your journey is about to ascend.
                    </p>
                    
                    <div style="background-color: #1a1a1a; border-radius: 8px; padding: 20px; margin-top: 30px;">
                        <h3 style="color: #F2A900; margin-top: 0; border-bottom: 1px solid #333; padding-bottom: 10px;">Order Summary</h3>
                        <table style="width: 100%; border-collapse: collapse;">
                            {items_html}
                        </table>
                        <div style="margin-top: 20px; text-align: right;">
                            <p style="color: #aaa; margin: 5px 0;">Shipping: ${shipping_cost}</p>
                            <p style="color: #F2A900; font-size: 18px; font-weight: bold; margin: 5px 0;">Total Paid: ${total_amount}</p>
                        </div>
                    </div>
                    
                    <div style="background-color: #1a1a1a; border-radius: 8px; padding: 20px; margin-top: 20px;">
                        <h3 style="color: #00BFFF; margin-top: 0; border-bottom: 1px solid #333; padding-bottom: 10px;">Shipping Destination</h3>
                        <p style="color: #ccc; line-height: 1.5; margin-bottom: 0;">
                            {address_str.strip(", ")}<br>{country}
                        </p>
                    </div>
                    
                    <p style="text-align: center; color: #666; font-size: 12px; margin-top: 40px;">
                        May the Glimmer guide your path.<br>
                        © 2026 GlimmerFall TCG
                    </p>
                </div>
                '''
                
                try:
                    resend.Emails.send({
                        "from": "GlimmerFall <noreply@glimmerfalltcg.com>",
                        "to": [customer_email],
                        "subject": f"Your GlimmerFall Order #{order_id} is Confirmed",
                        "html": receipt_html
                    })
                except Exception as e:
                    logger.error(f"Failed to send receipt: {e}")

    return {"status": "success"}


# ============================================================================
# GLIMMER CURRENCY + REFERRALS + QUEST CLAIMS + PERSONAL DECKS
# ============================================================================

def grant_glimmer(cur, user_id: int, amount: int, source: str,
                  ref_id: str = None, memo: str = None) -> int:
    """Atomic credit/debit. Returns new balance. Raises 400 on insufficient."""
    if amount < 0:
        cur.execute("SELECT glimmer_balance FROM users WHERE id=%s FOR UPDATE", (user_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(404, "User not found")
        if (row["glimmer_balance"] or 0) + amount < 0:
            raise HTTPException(400, "Insufficient Glimmer")
    cur.execute(
        "INSERT INTO glimmer_transactions (user_id, amount, source, ref_id, memo) "
        "VALUES (%s, %s, %s, %s, %s)",
        (user_id, amount, source, ref_id, memo),
    )
    cur.execute(
        "UPDATE users SET glimmer_balance = COALESCE(glimmer_balance, 0) + %s "
        "WHERE id=%s RETURNING glimmer_balance",
        (amount, user_id),
    )
    return cur.fetchone()["glimmer_balance"]


@api.get("/glimmer/balance")
def get_glimmer_balance(request: Request):
    user = get_user_from_request(request)
    if not user:
        raise HTTPException(401, "Not logged in")
    with DB() as cur:
        cur.execute("SELECT glimmer_balance, referral_code FROM users WHERE id=%s", (user["id"],))
        row = cur.fetchone()
        if not row:
            raise HTTPException(404)
    return {"balance": row["glimmer_balance"] or 0, "referral_code": row["referral_code"]}


@api.get("/glimmer/transactions")
def get_glimmer_transactions(request: Request):
    user = get_user_from_request(request)
    if not user:
        raise HTTPException(401, "Not logged in")
    with DB() as cur:
        cur.execute(
            "SELECT id, amount, source, ref_id, memo, created_at "
            "FROM glimmer_transactions WHERE user_id=%s "
            "ORDER BY created_at DESC LIMIT 50",
            (user["id"],),
        )
        rows = cur.fetchall()
        for r in rows:
            r["created_at"] = str(r["created_at"])
        return rows


@api.post("/quests/{qid}/claim")
def claim_quest_reward(qid: int, request: Request):
    user = get_user_from_request(request)
    if not user:
        raise HTTPException(401, "Not logged in")
    with DB() as cur:
        cur.execute(
            "SELECT id, reward_glimmer, is_completed, reward_claimed, description, reward "
            "FROM user_quests WHERE id=%s AND user_id=%s FOR UPDATE",
            (qid, user["id"]),
        )
        q = cur.fetchone()
        if not q:
            raise HTTPException(404, "Quest not found")
        if not q["is_completed"]:
            raise HTTPException(400, "Quest is not yet completed")
        if q["reward_claimed"]:
            raise HTTPException(400, "Reward already claimed")
        cur.execute("UPDATE user_quests SET reward_claimed=TRUE WHERE id=%s", (qid,))
        credited = q["reward_glimmer"] or 0
        new_balance = user.get("glimmer_balance") or 0
        if credited > 0:
            new_balance = grant_glimmer(
                cur, user["id"], credited, "quest",
                ref_id=str(qid), memo=q["description"][:250]
            )
        
        reward_str = q.get("reward") or ""
        credited_items = []
        if "Booster Pack" in reward_str or "Pack" in reward_str:
            import re
            m = re.search(r'(\d+)\s*x\s*(.*Pack.*)', reward_str, re.IGNORECASE)
            qty = int(m.group(1)) if m else 1
            item_name = m.group(2).strip() if m else reward_str.strip()
            cur.execute("""
                INSERT INTO user_inventory (user_id, item_name, quantity)
                VALUES (%s, %s, %s)
                ON CONFLICT (user_id, item_name)
                DO UPDATE SET quantity = user_inventory.quantity + EXCLUDED.quantity
            """, (user["id"], item_name, qty))
            credited_items.append(f"{qty}x {item_name}")
            
    return {"ok": True, "credited": credited, "balance": new_balance, "credited_items": credited_items}

@api.get("/auth/me/inventory")
def get_my_inventory(request: Request):
    user = get_user_from_request(request)
    if not user:
        raise HTTPException(401, "Not logged in")
    with DB() as cur:
        cur.execute("SELECT item_name, quantity FROM user_inventory WHERE user_id=%s AND quantity > 0", (user['id'],))
        return cur.fetchall()


# ---------- quest progress bumping (called from game_engine hooks) ----------
_QUEST_TRIGGERS = [
    # (regex on description.lower(), event, extra tag)
    (re.compile(r"\brites?\b"),                     "play_rite",   None),
    (re.compile(r"\bflash spells?\b"),              "play_flash",  None),
    (re.compile(r"damage to (enemy |the enemy )?nexus"), "nexus_damage", None),
    (re.compile(r"solari entit"),                   "play_faction_entity", "solari"),
    (re.compile(r"umbri entit"),                    "play_faction_entity", "umbri"),
    (re.compile(r"terra entit"),                    "play_faction_entity", "terra"),
    (re.compile(r"aether entit"),                   "play_faction_entity", "aether"),
    (re.compile(r"\bwin \d+ (game|match|matches)"), "win_game",    None),
    (re.compile(r"destroy \d+ (enemy )?entit"),     "entity_kill", None),
    (re.compile(r"draw \d+ cards?"),                "draw_card",   None),
]


def _quest_matches(description: str, event: str, meta: dict) -> bool:
    if not description:
        return False
    d = description.lower()
    for regex, ev, tag in _QUEST_TRIGGERS:
        if not regex.search(d):
            continue
        if ev != event:
            continue
        if tag and (meta.get("faction", "").lower() != tag):
            continue
        return True
    return False


def bump_quest_progress(nickname: str, event: str, meta: dict = None):
    """Increment matching user_quests. Called from game_engine hooks.
    Safe: swallow all exceptions so gameplay is never blocked."""
    if not nickname or nickname == "GlimmerBot":
        return
    meta = meta or {}
    amount = int(meta.get("amount", 1))
    try:
        with DB() as cur:
            cur.execute("SELECT id FROM users WHERE nickname=%s", (nickname,))
            u = cur.fetchone()
            if not u:
                return
            cur.execute(
                "SELECT id, description, target_value, current_value "
                "FROM user_quests WHERE user_id=%s AND is_completed=FALSE "
                "AND created_at >= NOW() - INTERVAL '1 day'",
                (u["id"],),
            )
            quests = cur.fetchall()
            for q in quests:
                if not _quest_matches(q["description"], event, meta):
                    continue
                new_val = min((q["current_value"] or 0) + amount, q["target_value"])
                done = new_val >= q["target_value"]
                cur.execute(
                    "UPDATE user_quests SET current_value=%s, is_completed=%s WHERE id=%s",
                    (new_val, done, q["id"]),
                )
    except Exception as e:
        logger.warning(f"bump_quest_progress error: {e}")


# Wire quest bumper into game engine (avoids circular import).
ge.set_quest_hook(bump_quest_progress)


# ---------- Personal (server-side) decks ----------
class PersonalDeckReq(BaseModel):
    deck_name: str
    deck_cards: list  # [{card_name: str, count: int}]


@api.get("/auth/me/decks")
def list_my_decks(request: Request):
    user = get_user_from_request(request)
    if not user:
        raise HTTPException(401, "Not logged in")
    with DB() as cur:
        cur.execute("""
            SELECT d.id, d.deck_name, d.is_public, d.created_at,
                   (SELECT COUNT(*) FROM deck_likes dl WHERE dl.deck_id = d.id) as likes_count
            FROM decks d
            WHERE d.user_id=%s
            ORDER BY d.created_at DESC
            LIMIT 60
        """, (user["id"],))
        decks = [dict(r) for r in cur.fetchall()]
        if not decks:
            return []
        deck_ids = tuple(d["id"] for d in decks)
        cur.execute(
            "SELECT dc.deck_id, dc.card_name, dc.count, c.faction, c.image_url, c.id as card_id "
            "FROM deck_cards dc LEFT JOIN cards c ON dc.card_name = c.name "
            "WHERE dc.deck_id IN %s",
            (deck_ids,),
        )
        cards = [dict(r) for r in cur.fetchall()]
        for d in decks:
            d["created_at"] = str(d["created_at"])
            d["cards"] = [c for c in cards if c["deck_id"] == d["id"]]
        return decks


@api.post("/auth/me/decks")
def create_my_deck(req: PersonalDeckReq, request: Request):
    user = get_user_from_request(request)
    if not user:
        raise HTTPException(401, "Not logged in")
    with DB() as cur:
        cur.execute(
            "INSERT INTO decks (username, deck_name, user_id, is_public) "
            "VALUES (%s, %s, %s, FALSE) RETURNING id",
            (user["nickname"], req.deck_name, user["id"]),
        )
        deck_id = cur.fetchone()["id"]
        for c in req.deck_cards:
            cur.execute(
                "INSERT INTO deck_cards (deck_id, card_name, count) VALUES (%s, %s, %s)",
                (deck_id, c.get("card_name") or c.get("name"), int(c.get("count", 1))),
            )
    return {"ok": True, "deck_id": deck_id}


@api.put("/auth/me/decks/{deck_id}")
def update_my_deck(deck_id: int, req: PersonalDeckReq, request: Request):
    user = get_user_from_request(request)
    if not user:
        raise HTTPException(401, "Not logged in")
    with DB() as cur:
        cur.execute("SELECT id FROM decks WHERE id=%s AND user_id=%s", (deck_id, user["id"]))
        if not cur.fetchone():
            raise HTTPException(404, "Deck not found")
        cur.execute("UPDATE decks SET deck_name=%s WHERE id=%s", (req.deck_name, deck_id))
        cur.execute("DELETE FROM deck_cards WHERE deck_id=%s", (deck_id,))
        for c in req.deck_cards:
            cur.execute(
                "INSERT INTO deck_cards (deck_id, card_name, count) VALUES (%s, %s, %s)",
                (deck_id, c.get("card_name") or c.get("name"), int(c.get("count", 1))),
            )
    return {"ok": True}


@api.delete("/auth/me/decks/{deck_id}")
def delete_my_deck(deck_id: int, request: Request):
    user = get_user_from_request(request)
    if not user:
        raise HTTPException(401, "Not logged in")
    with DB() as cur:
        cur.execute("DELETE FROM deck_cards WHERE deck_id IN (SELECT id FROM decks WHERE id=%s AND user_id=%s)", (deck_id, user["id"]))
        cur.execute("DELETE FROM decks WHERE id=%s AND user_id=%s", (deck_id, user["id"]))
        if cur.rowcount == 0:
            raise HTTPException(404, "Deck not found")
    return {"ok": True}


@api.post("/decks/{deck_id}/clone")
def clone_deck(deck_id: int, request: Request):
    """Copy a public deck into the caller's private decks."""
    user = get_user_from_request(request)
    if not user:
        raise HTTPException(401, "Not logged in")
    with DB() as cur:
        cur.execute("SELECT deck_name, is_public FROM decks WHERE id=%s", (deck_id,))
        src = cur.fetchone()
        if not src:
            raise HTTPException(404, "Deck not found")
        if not src["is_public"]:
            raise HTTPException(403, "Deck is private")
        cur.execute(
            "INSERT INTO decks (username, deck_name, user_id, is_public) "
            "VALUES (%s, %s, %s, FALSE) RETURNING id",
            (user["nickname"], src['deck_name'], user["id"]),
        )
        new_id = cur.fetchone()["id"]
        cur.execute("SELECT card_name, count FROM deck_cards WHERE deck_id=%s", (deck_id,))
        for c in cur.fetchall():
            cur.execute(
                "INSERT INTO deck_cards (deck_id, card_name, count) VALUES (%s, %s, %s)",
                (new_id, c["card_name"], c["count"]),
            )
    return {"ok": True, "deck_id": new_id}


@api.post("/auth/me/decks/{deck_id}/publish")
def publish_my_deck(deck_id: int, request: Request):
    user = get_user_from_request(request)
    if not user:
        raise HTTPException(401, "Not logged in")
    with DB() as cur:
        cur.execute(
            "UPDATE decks SET is_public=TRUE WHERE id=%s AND user_id=%s RETURNING id",
            (deck_id, user["id"]),
        )
        if not cur.fetchone():
            raise HTTPException(404, "Deck not found")
    return {"ok": True}


@api.post("/auth/me/decks/{deck_id}/unpublish")
def unpublish_my_deck(deck_id: int, request: Request):
    user = get_user_from_request(request)
    if not user:
        raise HTTPException(401, "Not logged in")
    with DB() as cur:
        cur.execute(
            "UPDATE decks SET is_public=FALSE WHERE id=%s AND user_id=%s RETURNING id",
            (deck_id, user["id"]),
        )
        if not cur.fetchone():
            raise HTTPException(404, "Deck not found")
    return {"ok": True}


# ---------- Community deck browser with sort ----------
@api.get("/decks/community")
def get_community_decks_sorted(
    sort: str = Query("upvotes", regex="^(upvotes|newest|trending)$"),
    faction: Optional[str] = None,
    request: Request = None,
):
    user = get_user_from_request(request) if request else None
    user_email = user["email"] if user else None

    order_sql = {
        "upvotes":  "likes_count DESC, d.created_at DESC",
        "newest":   "d.created_at DESC",
        "trending": "recent_likes DESC, d.created_at DESC",
    }[sort]

    with DB() as cur:
        cur.execute(f"""
            SELECT d.id, d.username, d.deck_name, d.created_at, d.is_preconstructed,
                   COALESCE(d.is_public, TRUE) as is_public,
                   (SELECT COUNT(*) FROM deck_likes dl WHERE dl.deck_id = d.id) as likes_count,
                   (SELECT COUNT(*) FROM deck_likes dl WHERE dl.deck_id = d.id AND dl.created_at >= NOW() - INTERVAL '7 days') as recent_likes
            FROM decks d
            WHERE COALESCE(d.is_public, TRUE) = TRUE
            ORDER BY {order_sql}
            LIMIT 80
        """)
        decks = [dict(r) for r in cur.fetchall()]
        if not decks:
            return []
        deck_ids = tuple(d["id"] for d in decks)
        cur.execute(
            "SELECT dc.deck_id, dc.card_name, dc.count, c.faction, c.image_url "
            "FROM deck_cards dc LEFT JOIN cards c ON dc.card_name = c.name "
            "WHERE dc.deck_id IN %s",
            (deck_ids,),
        )
        cards = [dict(r) for r in cur.fetchall()]
        user_likes = set()
        if user_email:
            cur.execute(
                "SELECT deck_id FROM deck_likes WHERE user_email=%s AND deck_id IN %s",
                (user_email, deck_ids),
            )
            user_likes = {r["deck_id"] for r in cur.fetchall()}
        result = []
        for d in decks:
            d["created_at"] = str(d["created_at"])
            d["cards"] = [c for c in cards if c["deck_id"] == d["id"]]
            d["liked_by_me"] = d["id"] in user_likes
            if faction:
                # faction filter: at least one card in the deck matches
                if not any(c.get("faction", "").lower() == faction.lower() for c in d["cards"]):
                    continue
            result.append(d)
        return result


# ---------- Referral link fetch for logged-in user ----------
@api.get("/auth/me/referral")
def get_my_referral(request: Request):
    user = get_user_from_request(request)
    if not user:
        raise HTTPException(401, "Not logged in")
    with DB() as cur:
        cur.execute("SELECT referral_code, referrals FROM users WHERE id=%s", (user["id"],))
        u = cur.fetchone()
        cur.execute(
            "SELECT COUNT(*) as c, COALESCE(SUM(reward_amount),0) as g "
            "FROM referrals WHERE referrer_id=%s AND status='rewarded'",
            (user["id"],),
        )
        stats = cur.fetchone()
    return {
        "referral_code": u["referral_code"] if u else None,
        "referrals": (u["referrals"] if u else 0) or 0,
        "verified_referrals": stats["c"] if stats else 0,
        "glimmer_from_referrals": stats["g"] if stats else 0,
    }


# ---------- Moved from tail: routes must be BEFORE include_router ----------

@api.get("/matchmaking/queue_size")
def get_queue_size():
    with DB() as cur:
        cur.execute("SELECT COUNT(*) as c FROM matches WHERE status='WAITING' AND player2 IS NULL AND is_ranked = TRUE")
        row = cur.fetchone()
        return {"queue_size": row["c"] if row else 0}


class OrderUpdateReq(BaseModel):
    status: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    address: Optional[str] = None
    country: Optional[str] = None


@api.put("/admin/shop/orders/{order_id}")
def update_admin_shop_order(order_id: int, req: OrderUpdateReq, request: Request):
    user = get_user_from_request(request)
    if not user or not user.get("is_admin"):
        raise HTTPException(403)
    with DB() as cur:
        cur.execute("""
            UPDATE shop_orders
            SET status=COALESCE(%s, status), first_name=COALESCE(%s, first_name),
                last_name=COALESCE(%s, last_name), address=COALESCE(%s, address),
                country=COALESCE(%s, country)
            WHERE id=%s
        """, (req.status, req.first_name, req.last_name, req.address, req.country, order_id))
    return {"status": "success"}


@api.delete("/admin/shop/orders/{order_id}")
def delete_admin_shop_order(order_id: int, request: Request):
    user = get_user_from_request(request)
    if not user or not user.get("is_admin"):
        raise HTTPException(403)
    with DB() as cur:
        cur.execute("DELETE FROM shop_order_items WHERE order_id=%s", (order_id,))
        cur.execute("DELETE FROM shop_orders WHERE id=%s", (order_id,))
    return {"status": "success"}


@api.post("/admin/users/{target_id}/reset-password")
def admin_reset_user_password_v2(target_id: int, request: Request):
    user = get_user_from_request(request)
    if not user or not user.get("is_admin"):
        raise HTTPException(403)
    import string, random
    new_password = ''.join(random.choices(string.ascii_letters + string.digits, k=10))
    hashed = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    with DB() as cur:
        cur.execute("SELECT email, nickname FROM users WHERE id=%s", (target_id,))
        target = cur.fetchone()
        if not target:
            raise HTTPException(404, "User not found")
        cur.execute("UPDATE users SET password_hash=%s WHERE id=%s", (hashed, target_id))
    html = f"""
    <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #0B0C10; color: #FFFFFF; padding: 40px; border-radius: 12px;">
      <h1 style="color: #00BFFF; text-align: center;">Password Reset</h1>
      <p>Hello {target['nickname']},</p>
      <p>Your new temporary password is:</p>
      <h2 style="text-align: center; color: #F2A900; background-color: #1a1a1a; padding: 10px; border-radius: 8px;">{new_password}</h2>
    </div>
    """
    try:
        resend.Emails.send({
            "from": "GlimmerFall <noreply@glimmerfalltcg.com>",
            "to": [target['email']],
            "subject": "Your GlimmerFall Password Has Been Reset",
            "html": html
        })
    except Exception as e:
        logger.error(f"Failed to send reset email: {e}")
    return {"status": "success", "message": "Password reset email sent."}

# --- Leadership & Diplomacy API ---

@api.get("/admin/leadership/transactions")
def get_leadership_transactions(request: Request):
    user = get_user_from_request(request)
    if not user or not user.get("is_admin"): raise HTTPException(403)
    with DB() as cur:
        # Shop orders total revenue
        cur.execute("SELECT SUM(total_price) as total_usd FROM shop_orders WHERE status != 'cancelled'")
        usd = cur.fetchone()["total_usd"] or 0.0
        # Glimmer purchases total
        cur.execute("SELECT SUM(amount) as total_glimmer FROM glimmer_transactions WHERE type='purchase'")
        glimmer = cur.fetchone()["total_glimmer"] or 0
        # Recent transactions
        cur.execute("SELECT id, email, total_price, status, created_at FROM shop_orders ORDER BY created_at DESC LIMIT 10")
        recent_shop = cur.fetchall()
        return {"total_usd": usd, "total_glimmer": glimmer, "recent_shop": recent_shop}

@api.get("/admin/leadership/campaigns")
def get_leadership_campaigns(request: Request):
    user = get_user_from_request(request)
    if not user or not user.get("is_admin"): raise HTTPException(403)
    with DB() as cur:
        cur.execute("SELECT * FROM campaigns ORDER BY created_at DESC")
        camps = cur.fetchall()
        for c in camps:
            sd = c["start_date"]
            ed = c.get("end_date") or '2099-01-01'
            cur.execute("SELECT COUNT(*) as rc FROM users WHERE created_at BETWEEN %s AND %s", (sd, ed))
            c["registrations"] = cur.fetchone()["rc"]
            cur.execute("SELECT COUNT(*) as mc FROM matches WHERE created_at BETWEEN %s AND %s", (sd, ed))
            c["matches_played"] = cur.fetchone()["mc"]
            cur.execute("SELECT COUNT(*) as pc FROM page_views WHERE created_at BETWEEN %s AND %s", (sd, ed))
            c["page_views"] = cur.fetchone()["pc"]
        return camps

@api.post("/admin/leadership/campaigns")
def create_leadership_campaign(req: dict, request: Request):
    user = get_user_from_request(request)
    if not user or not user.get("is_admin"): raise HTTPException(403)
    with DB() as cur:
        cur.execute("INSERT INTO campaigns (title, description, start_date, end_date) VALUES (%s, %s, %s, %s) RETURNING id",
                    (req.get("title"), req.get("description"), req.get("start_date"), req.get("end_date")))
    return {"status": "success"}

@api.get("/admin/leadership/suggestions")
def get_leadership_suggestions(request: Request):
    user = get_user_from_request(request)
    if not user or not user.get("is_admin"): raise HTTPException(403)
    with DB() as cur:
        cur.execute("SELECT * FROM suggestions ORDER BY created_at DESC")
        return cur.fetchall()

@api.post("/admin/leadership/suggestions")
def create_leadership_suggestion(req: dict, request: Request):
    user = get_user_from_request(request)
    if not user: raise HTTPException(403)
    with DB() as cur:
        cur.execute("INSERT INTO suggestions (user_email, suggestion_type, content) VALUES (%s, %s, %s)",
                    (user["email"], req.get("type", "Suggestion"), req.get("content")))
    return {"status": "success"}

@api.post("/admin/leadership/suggestions/{sid}/vote")
def vote_leadership_suggestion(sid: int, req: dict, request: Request):
    user = get_user_from_request(request)
    if not user or not user.get("is_admin"): raise HTTPException(403)
    new_status = req.get("status")
    with DB() as cur:
        if new_status:
            cur.execute("UPDATE suggestions SET status=%s WHERE id=%s", (new_status, sid))
        else:
            cur.execute("UPDATE suggestions SET upvotes = upvotes + 1 WHERE id=%s", (sid,))
    return {"status": "success"}

# --- Upcoming Cards (Set 2) API ---

@api.get("/upcoming-cards")
def get_upcoming_cards(request: Request):
    user = get_user_from_request(request)
    email = user["email"] if user else None
    with DB() as cur:
        # Fetch all cards from cards2 along with total score and the user's vote
        query = """
            SELECT c.*, 
                   COALESCE(SUM(v.vote), 0) as vote_score,
                   (SELECT vote FROM cards2_votes WHERE card_id = c.id AND user_email = %s) as user_vote
            FROM cards2 c
            LEFT JOIN cards2_votes v ON c.id = v.card_id
            GROUP BY c.id
            ORDER BY c.collector_number ASC
        """
        cur.execute(query, (email,))
        return cur.fetchall()

@api.post("/upcoming-cards/{card_id}/vote")
def vote_upcoming_card(card_id: str, req: dict, request: Request):
    user = get_user_from_request(request)
    if not user: raise HTTPException(401)
    vote_val = req.get("vote")
    if vote_val not in (1, -1): raise HTTPException(400)
    
    with DB() as cur:
        # Upsert the vote
        cur.execute("""
            INSERT INTO cards2_votes (card_id, user_email, vote)
            VALUES (%s, %s, %s)
            ON CONFLICT (card_id, user_email) 
            DO UPDATE SET vote = EXCLUDED.vote
        """, (card_id, user["email"], vote_val))
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

