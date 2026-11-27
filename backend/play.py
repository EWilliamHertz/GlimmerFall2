"""GlimmerFall play services: identity, queues, private lobbies, match lifecycle,
rating, guided tutorial, and realtime (WebSocket) push.

Wired into server.py via `register(api, app, deps)` so this module never imports
server.py (avoids circular imports). All match mutations go through `commit_state()`
inside a transactional `DBTx()` block, bumping `state["version"]`, applying Elo
once on ENDED, updating series scores, and notifying WebSocket subscribers.
"""
import asyncio
import json
import logging
import random
import re
import secrets
import string
import threading
import time
from typing import Optional

import jwt
from fastapi import HTTPException, Request, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from psycopg2.extras import Json

import game_engine as ge
import rating

log = logging.getLogger("glimmerfall.play")

RANKED_TURN_SECONDS = 90
CASUAL_TURN_SECONDS = 120
DICE_ROLL_SECONDS = 20
DISCONNECT_FORFEIT_SECONDS = 60
QUEUE_STALE_SECONDS = 12
LOBBY_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # unambiguous: no 0/O/1/I


# ---------------------------------------------------------------- identity

class Identity:
    def __init__(self, name: str, registered: bool, user_id=None, is_admin=False):
        self.name = name
        self.registered = registered
        self.user_id = user_id
        self.is_admin = is_admin


def decode_identity(token: Optional[str], secret: str) -> Optional[Identity]:
    if not token:
        return None
    try:
        data = jwt.decode(token, secret, algorithms=["HS256"])
    except Exception:
        return None
    if data.get("typ") == "guest" and data.get("guest"):
        return Identity(data["guest"], registered=False)
    if data.get("nickname"):
        return Identity(data["nickname"], True, data.get("id"), bool(data.get("is_admin")))
    return None


def token_from_request(request: Request) -> Optional[str]:
    auth = request.headers.get("Authorization") or ""
    if auth.startswith("Bearer "):
        return auth.split(" ", 1)[1].strip()
    return None


def slot_for(match_row, name: Optional[str]) -> int:
    """1 / 2 if `name` is a player in the match, else 0 (spectator)."""
    if not name:
        return 0
    if match_row.get("player1") == name:
        return 1
    if match_row.get("player2") == name:
        return 2
    return 0


def _code(n: int) -> str:
    return "".join(secrets.choice(LOBBY_ALPHABET) for _ in range(n))


# ---------------------------------------------------------------- realtime hub

class Hub:
    """In-process pub/sub keyed by topic ("match:12", "lobby:ABC123", "queue:Name").

    Sync code (FastAPI threadpool) calls notify(); async WebSocket handlers
    await wait(). Uses per-subscriber queues/events so multiple spectators and
    both players all wake up on every broadcast!
    """

    def __init__(self):
        self.loop: Optional[asyncio.AbstractEventLoop] = None
        self.subs: dict[str, set[asyncio.Event]] = {}
        self.lock = threading.Lock()

    def subscribe(self, topic: str) -> asyncio.Event:
        ev = asyncio.Event()
        with self.lock:
            self.subs.setdefault(topic, set()).add(ev)
        return ev

    def unsubscribe(self, topic: str, ev: asyncio.Event):
        with self.lock:
            s = self.subs.get(topic)
            if s:
                s.discard(ev)
                if not s:
                    self.subs.pop(topic, None)

    def notify(self, topic: str):
        loop = self.loop
        if not loop or loop.is_closed():
            return
        with self.lock:
            targets = list(self.subs.get(topic, ()))
        if not targets:
            return

        def _wake():
            for ev in targets:
                ev.set()

        try:
            loop.call_soon_threadsafe(_wake)
        except RuntimeError:
            pass

    async def wait_event(self, ev: asyncio.Event, timeout: float):
        try:
            await asyncio.wait_for(ev.wait(), timeout)
        except asyncio.TimeoutError:
            pass
        ev.clear()


hub = Hub()


# ---------------------------------------------------------------- schemas

class GuestCreateReq(BaseModel):
    nickname: Optional[str] = None


class QueueJoinReq(BaseModel):
    mode: str = "casual"  # ranked | casual
    faction: Optional[str] = None
    deckCards: Optional[list] = None
    deckName: Optional[str] = None


class LobbyCreateReq(BaseModel):
    turnSeconds: int = CASUAL_TURN_SECONDS
    bestOf: int = 1
    allowSpectators: bool = True


class LobbySettingsReq(BaseModel):
    turnSeconds: Optional[int] = None
    bestOf: Optional[int] = None
    allowSpectators: Optional[bool] = None


class LobbyDeckReq(BaseModel):
    faction: Optional[str] = None
    deckCards: Optional[list] = None
    deckName: Optional[str] = None


class LobbyReadyReq(BaseModel):
    ready: bool = True


class BotReq(BaseModel):
    faction: Optional[str] = None
    deckCards: Optional[list] = None
    deckName: Optional[str] = None


class ActionV2(BaseModel):
    action: str
    payload: Optional[dict] = None


# ---------------------------------------------------------------- registration

def register(api, app, deps):
    """deps: DB, DBTx, load_cards, redact_state, get_rank_tier, JWT_SECRET, run_migrations"""
    DB = deps["DB"]
    DBTx = deps["DBTx"]
    load_cards = deps["load_cards"]
    redact_state = deps["redact_state"]
    get_rank_tier = deps["get_rank_tier"]
    SECRET = deps["JWT_SECRET"]
    run_migrations = deps.get("run_migrations")

    ticker_task: dict = {"task": None}

    @app.on_event("startup")
    async def _startup():
        hub.loop = asyncio.get_running_loop()
        if run_migrations:
            try:
                await asyncio.to_thread(run_migrations)
            except Exception as e:
                log.warning("Startup migration skipped/failed: %s", e)
        ticker_task["task"] = asyncio.create_task(_background_ticker())

    @app.on_event("shutdown")
    async def _stop_ticker():
        t = ticker_task.get("task")
        if t:
            t.cancel()

    async def _background_ticker():
        """Every 3s, enforce dice-roll, turn-rope, and disconnect timeouts on active matches."""
        while True:
            await asyncio.sleep(3.0)
            try:
                await asyncio.to_thread(_sweep_active_matches)
            except asyncio.CancelledError:
                break
            except Exception as e:
                log.debug("Ticker sweep skipped: %s", e)

    def _sweep_active_matches():
        try:
            with DB() as cur:
                cur.execute(
                    "SELECT id FROM matches WHERE status IN ('PLAYING', 'DICE_ROLL') "
                    "AND last_polled > NOW() - INTERVAL '10 minutes' LIMIT 50"
                )
                ids = [r["id"] for r in cur.fetchall()]
        except Exception:
            return
        for mid in ids:
            try:
                with DBTx() as cur:
                    m = load_match(cur, mid, lock=True)
                    tick(cur, m)
            except Exception:
                pass

    # ---------------- identity helpers ----------------
    def ident(request: Request, required=True) -> Optional[Identity]:
        who = decode_identity(token_from_request(request), SECRET)
        if required and not who:
            raise HTTPException(401, "Sign in or start a guest session to play.")
        if who and who.registered:
            with DB() as cur:
                cur.execute("SELECT status FROM users WHERE nickname=%s", (who.name,))
                u = cur.fetchone()
            if u and u.get("status") in ("suspended", "banned"):
                raise HTTPException(403, f"Account is {u['status']}")
        return who

    deps["ident"] = ident

    @api.post("/guest")
    def create_guest(req: Optional[GuestCreateReq] = None):
        raw = (req.nickname if req and req.nickname else "").strip()
        clean = re.sub(r"[^A-Za-z0-9 _\-]", "", raw).strip()[:16]
        suffix = "".join(random.choices(string.digits, k=4))
        # Guaranteed '#' separator prevents any collision with registered users.nickname
        name = f"{clean} #{suffix}" if clean else f"Guest #{suffix}"
        tok = jwt.encode(
            {"typ": "guest", "guest": name, "iat": int(time.time())},
            SECRET,
            algorithm="HS256",
        )
        return {"token": tok, "name": name, "registered": False}

    @api.get("/whoami")
    def whoami(request: Request):
        who = ident(request, required=False)
        if not who:
            return {"name": None, "registered": False}
        return {"name": who.name, "registered": who.registered, "userId": who.user_id}

    # ---------------- state commit / rating ----------------
    def apply_rating(cur, m, state):
        """Apply Elo exactly once when a ranked PvP match ends."""
        if not m.get("is_ranked") or state.get("isAI") or state.get("ratingResult"):
            return
        p1, p2 = m["player1"], m["player2"]
        if not p1 or not p2:
            return
        cur.execute(
            "SELECT nickname, mmr, COALESCE(placement_games_left, 0) AS pl "
            "FROM users WHERE nickname IN (%s, %s)",
            (p1, p2),
        )
        rows = {r["nickname"]: r for r in cur.fetchall()}
        r1, r2 = rows.get(p1, {}), rows.get(p2, {})
        res = rating.rate_match(
            r1.get("mmr"), r2.get("mmr"), state.get("winner"),
            r1.get("pl", 0), r2.get("pl", 0),
        )
        for slot, name in (("1", p1), ("2", p2)):
            info = res[slot]
            tier = get_rank_tier(info["after"])
            prev_tier = get_rank_tier(info["before"])
            info["rank"] = tier["name"]
            info["tier"] = tier["tier"]
            info["division"] = tier["division"]
            info["rankColor"] = tier["color"]
            info["promoted"] = tier["tier_rank"] > prev_tier["tier_rank"] or (
                tier["tier_rank"] == prev_tier["tier_rank"] and tier["name"] != prev_tier["name"] and info["delta"] > 0
            )
            cur.execute(
                "UPDATE users SET mmr=%s, rank=%s, placement_games_left=%s WHERE nickname=%s",
                (info["after"], tier["name"], info["placement_games_left"], name),
            )
            cur.execute(
                "INSERT INTO rating_history (nickname, match_id, mmr_before, mmr_after) VALUES (%s,%s,%s,%s)",
                (name, m["id"], info["before"], info["after"]),
            )
        state["ratingResult"] = res

    def record_result(cur, m, state):
        if state.get("isTutorial"):
            return
        w = state.get("winner")
        p1, p2 = m["player1"], m["player2"]
        if state.get("isAI"):
            if w == 1:
                cur.execute("UPDATE users SET ai_wins = COALESCE(ai_wins,0)+1 WHERE nickname=%s", (p1,))
            elif w == 2:
                cur.execute("UPDATE users SET ai_losses = COALESCE(ai_losses,0)+1 WHERE nickname=%s", (p1,))
            return
        if w in (1, 2) and p1 and p2:
            winner, loser = (p1, p2) if w == 1 else (p2, p1)
            cur.execute("UPDATE users SET wins = COALESCE(wins,0)+1 WHERE nickname=%s", (winner,))
            cur.execute("UPDATE users SET losses = COALESCE(losses,0)+1 WHERE nickname=%s", (loser,))
        # Update private lobby series score if linked
        lcode = m.get("lobby_code")
        if lcode and w in (1, 2):
            cur.execute("SELECT settings FROM lobbies WHERE code=%s FOR UPDATE", (lcode,))
            lb = cur.fetchone()
            if lb:
                settings = dict(lb["settings"] or {})
                score = dict(settings.get("score") or {"host": 0, "guest": 0})
                key = "host" if w == 1 else "guest"
                score[key] = int(score.get(key, 0)) + 1
                settings["score"] = score
                cur.execute("UPDATE lobbies SET settings=%s, updated_at=NOW() WHERE code=%s", (Json(settings), lcode))

    def commit_state(cur, m, state):
        """Persist a new state for match row `m` (which must be the pre-change row)."""
        state["version"] = int(state.get("version") or 0) + 1
        newly_ended = m["status"] != "ENDED" and state.get("phase") == "ENDED"
        if newly_ended:
            apply_rating(cur, m, state)
            record_result(cur, m, state)
        active_slot = str(state.get("activePlayer", 1))
        active_name = (state.get("players", {}).get(active_slot) or {}).get("username")
        cur.execute(
            "UPDATE matches SET state=%s, status=%s, current_turn=%s, active_player=%s, "
            "history = history || %s::jsonb WHERE id=%s",
            (Json(state), state.get("phase"), state.get("turn"), active_name, Json([state]), m["id"]),
        )
        m["status"] = state.get("phase")
        m["state"] = state
        hub.notify(f"match:{m['id']}")
        if m.get("lobby_code"):
            hub.notify(f"lobby:{m['lobby_code']}")

    deps["commit_state"] = commit_state

    def end_by_forfeit(cur, m, loser_slot: int, reason: str):
        state = m["state"]
        if state.get("phase") == "ENDED":
            return
        state["phase"] = "ENDED"
        state["winner"] = 2 if loser_slot == 1 else 1
        loser = state["players"][str(loser_slot)]["username"]
        state.setdefault("log", []).append(f"[P0] {loser} {reason}.")
        state["endReason"] = reason
        commit_state(cur, m, state)

    def _default_turn_seconds(m, state) -> int:
        if state.get("isAI") or state.get("isTutorial"):
            return 0
        raw = state.get("turnSeconds")
        if raw is not None:
            return int(raw)
        return RANKED_TURN_SECONDS if m.get("is_ranked") else CASUAL_TURN_SECONDS

    def tick(cur, m):
        """Enforce disconnect forfeit, dice-roll timeout, and turn timer."""
        state = m["state"]
        if m["status"] not in ("PLAYING", "DICE_ROLL") or state.get("phase") not in ("PLAYING", "DICE_ROLL"):
            return
        now = time.time()
        if not state.get("isAI"):
            for s in (1, 2):
                seen = m.get(f"p{s}_last_seen")
                if seen is not None and (now - seen.timestamp()) > DISCONNECT_FORFEIT_SECONDS:
                    end_by_forfeit(cur, m, s, "disconnected and forfeited")
                    return
        # Auto-roll dice after DICE_ROLL_SECONDS so no one can stall pre-game (re-rolling ties)
        if state.get("phase") == "DICE_ROLL" and state.get("turnStartedAt"):
            if (now * 1000 - state["turnStartedAt"]) > DICE_ROLL_SECONDS * 1000:
                changed = False
                for _ in range(12):
                    if state.get("phase") != "DICE_ROLL":
                        break
                    for s in ("1", "2"):
                        if state.get("diceRolls", {}).get(s) is None:
                            try:
                                state = ge.apply_action(state, s, "ROLL_DICE", {})
                                changed = True
                            except ge.ActionError:
                                pass
                            if state.get("phase") == "PLAYING":
                                break
                if changed:
                    commit_state(cur, m, state)
                return
        # Turn rope (0 = untimed)
        limit = _default_turn_seconds(m, state)
        if limit > 0 and state.get("phase") == "PLAYING" and state.get("turnStartedAt"):
            if (now * 1000 - state["turnStartedAt"]) > limit * 1000:
                # If stuck on pendingChoice when timer expires, auto-pick option 0 first
                if state.get("pendingChoice"):
                    chooser = str(state["pendingChoice"].get("player", state.get("activePlayer", 1)))
                    try:
                        state = ge.apply_action(state, chooser, "MAKE_CHOICE", {"optionIndex": 0})
                    except ge.ActionError:
                        state["pendingChoice"] = None
                if state.get("phase") == "PLAYING":
                    active = str(state.get("activePlayer", 1))
                    try:
                        state = ge.apply_action(state, active, "END_TURN", {})
                        state.setdefault("log", []).append("[P0] Turn timer expired.")
                        commit_state(cur, m, state)
                    except ge.ActionError:
                        pass

    def load_match(cur, match_id, lock=False):
        cur.execute("SELECT * FROM matches WHERE id=%s" + (" FOR UPDATE" if lock else ""), (match_id,))
        m = cur.fetchone()
        if not m:
            raise HTTPException(404, "Match not found")
        return m

    def view(m, viewer_slot):
        state = m["state"]
        ended = m["status"] == "ENDED"
        st = redact_state(state, 0 if ended else viewer_slot)
        limit = _default_turn_seconds(m, state)
        return {
            "matchId": m["id"],
            "roomCode": m["room_code"],
            "status": m["status"],
            "turn": state.get("turn", m.get("current_turn")),
            "activePlayer": state.get("activePlayer"),
            "player1": m["player1"],
            "player2": m["player2"],
            "is_ranked": m["is_ranked"],
            "mode": m.get("mode") or ("ranked" if m["is_ranked"] else "casual"),
            "lobbyCode": m.get("lobby_code"),
            "slot": viewer_slot,
            "turnSeconds": limit,
            "serverTime": int(time.time() * 1000),
            "version": state.get("version", 0),
            "rematchMatchId": state.get("rematchMatchId"),
            "rematchOffers": state.get("rematchOffers") or [],
            "state": st,
        }

    deps["view_match"] = view

    def match_tick_and_view(
        match_id,
        who: Optional[Identity],
        since: Optional[int] = None,
        spectate=False,
        legacy_slot: Optional[int] = None,
    ):
        with DBTx() as cur:
            m = load_match(cur, match_id, lock=True)
            state = m["state"] or {}
            if spectate:
                if state.get("allowSpectators") is False and not (who and slot_for(m, who.name)):
                    raise HTTPException(403, "Spectating is disabled for this private match.")
                s = 0
            elif who:
                s = slot_for(m, who.name)
            elif state.get("legacyAnonAI") and legacy_slot in (1, 2):
                s = int(legacy_slot)
            else:
                s = 0
            if s in (1, 2) and m["status"] in ("PLAYING", "DICE_ROLL"):
                cur.execute(
                    f"UPDATE matches SET p{s}_last_seen=NOW(), last_polled=NOW() "
                    f"WHERE id=%s RETURNING p1_last_seen, p2_last_seen",
                    (match_id,),
                )
                m.update(cur.fetchone())
            elif m["status"] == "WAITING":
                cur.execute("UPDATE matches SET last_polled=NOW() WHERE id=%s", (match_id,))
            tick(cur, m)
        if since is not None and int(m["state"].get("version") or 0) == since:
            return {"unchanged": True, "version": since, "serverTime": int(time.time() * 1000)}
        return view(m, s)

    deps["match_tick_and_view"] = match_tick_and_view

    # ---------------- match endpoints (v2) ----------------
    @api.get("/v2/match/{match_id}")
    def get_match_v2(match_id: int, request: Request, since: Optional[int] = None, spectate: bool = False):
        who = ident(request, required=False)
        return match_tick_and_view(match_id, who, since, spectate)

    @api.post("/v2/match/{match_id}/action")
    def action_v2(match_id: int, req: ActionV2, request: Request):
        who = ident(request)
        with DBTx() as cur:
            m = load_match(cur, match_id, lock=True)
            s = slot_for(m, who.name)
            if not s:
                raise HTTPException(403, "You are not a player in this match.")
            if m["state"].get("phase") == "WAITING":
                raise HTTPException(400, "Match has not started yet.")
            try:
                new_state = ge.apply_action(m["state"], s, req.action, req.payload or {})
            except ge.ActionError as e:
                raise HTTPException(400, str(e))
            cur.execute(f"UPDATE matches SET p{s}_last_seen=NOW(), last_polled=NOW() WHERE id=%s", (match_id,))
            commit_state(cur, m, new_state)
        return view(m, s)

    @api.post("/v2/match/{match_id}/concede")
    def concede(match_id: int, request: Request):
        who = ident(request)
        with DBTx() as cur:
            m = load_match(cur, match_id, lock=True)
            s = slot_for(m, who.name)
            if not s:
                raise HTTPException(403, "You are not a player in this match.")
            end_by_forfeit(cur, m, s, "conceded")
        return view(m, s)

    # ---------------- vs bot & guided tutorial ----------------
    def resolve_deck(pool, faction, cards):
        return ge.build_deck(pool, faction, cards)

    def insert_match(cur, p1, p2, state, p1_deck, p2_deck, mode, is_ranked, lobby_code=None, room=None):
        state.setdefault("version", 1)
        if "turnSeconds" not in state:
            state["turnSeconds"] = 0 if state.get("isAI") else (RANKED_TURN_SECONDS if is_ranked else CASUAL_TURN_SECONDS)
        active_slot = str(state.get("activePlayer", 1))
        cur.execute(
            "INSERT INTO matches (room_code, player1, player2, status, current_turn, active_player, state, "
            "player1_deck, player2_deck, is_ranked, history, mode, lobby_code, p1_last_seen, p2_last_seen, last_polled) "
            "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,NOW(),NOW(),NOW()) RETURNING id",
            (
                room or lobby_code or _code(5), p1, p2, state.get("phase"), state.get("turn", 1),
                state["players"][active_slot]["username"], Json(state), p1_deck, p2_deck, is_ranked,
                Json([state]), mode, lobby_code,
            ),
        )
        return cur.fetchone()["id"]

    deps["insert_match_v2"] = insert_match

    def _build_bot_state(cur, player_name, pool, deck1):
        cur.execute("SELECT id, deck_name FROM decks WHERE is_preconstructed = TRUE")
        precons = cur.fetchall()
        ai_deck = random.choice(precons) if precons else {"id": None, "deck_name": "Random Chaos"}
        ai_names = None
        if ai_deck["id"]:
            cur.execute("SELECT card_name, count FROM deck_cards WHERE deck_id=%s", (ai_deck["id"],))
            ai_names = [r["card_name"] for r in cur.fetchall() for _ in range(r["count"])] or None
        deck2 = ge.build_deck(pool, None, ai_names)
        state = ge.new_match_state(player_name, deck1, ge.AI_NAME, deck2, is_ai=True)
        state["log"].insert(1, f"[P0] GlimmerBot is playing {ai_deck['deck_name']}.")
        return state, ai_deck["deck_name"]

    @api.post("/v2/bot")
    def play_bot(req: BotReq, request: Request):
        who = ident(request)
        pool = load_cards()
        deck1 = resolve_deck(pool, req.faction, req.deckCards)
        with DBTx() as cur:
            state, ai_deck_name = _build_bot_state(cur, who.name, pool, deck1)
            state["p1_deck_cards"] = [c["cardId"] for c in deck1 if c.get("cardId") is not None]
            mid = insert_match(cur, who.name, ge.AI_NAME, state, req.deckName or "Custom", ai_deck_name, "bot", False)
        return {"matchId": mid, "slot": 1, "mode": "bot"}

    @api.post("/tutorial/start")
    def start_tutorial(request: Request):
        who = ident(request)
        pool = load_cards()
        state = ge.new_tutorial_state(who.name, pool)
        with DBTx() as cur:
            mid = insert_match(cur, who.name, ge.TUTORIAL_AI_NAME, state, "Solari Training Deck", "Construct Deck", "tutorial", False)
        return {"matchId": mid, "slot": 1, "mode": "tutorial"}

    @api.post("/v2/match/{match_id}/rematch")
    def rematch(match_id: int, request: Request):
        who = ident(request)
        pool = load_cards()
        with DBTx() as cur:
            m = load_match(cur, match_id, lock=True)
            s = slot_for(m, who.name)
            if not s:
                raise HTTPException(403, "You are not a player in this match.")
            if m["status"] != "ENDED":
                raise HTTPException(400, "Match is still in progress.")
            if m.get("is_ranked"):
                raise HTTPException(400, "Ranked matches use the matchmaking queue for fair Elo pairing.")

            state = m["state"]
            if state.get("rematchMatchId"):
                new_id = state["rematchMatchId"]
                cur.execute("SELECT player1 FROM matches WHERE id=%s", (new_id,))
                nm = cur.fetchone()
                return {"status": "started", "matchId": new_id, "slot": 1 if nm and nm["player1"] == who.name else 2}

            # Tutorial rematch -> fresh tutorial
            if state.get("isTutorial"):
                tstate = ge.new_tutorial_state(who.name, pool)
                new_id = insert_match(cur, who.name, ge.TUTORIAL_AI_NAME, tstate, "Solari Training Deck", "Construct Deck", "tutorial", False)
                state["rematchMatchId"] = new_id
                commit_state(cur, m, state)
                return {"status": "started", "matchId": new_id, "slot": 1}

            # Bot rematch -> fresh bot match with same deck
            if state.get("isAI"):
                saved_ids = state.get("p1_deck_cards")
                deck1 = ge.build_deck(pool, None, saved_ids)
                bstate, ai_deck_name = _build_bot_state(cur, who.name, pool, deck1)
                bstate["p1_deck_cards"] = saved_ids
                new_id = insert_match(cur, who.name, ge.AI_NAME, bstate, m.get("player1_deck") or "Custom", ai_deck_name, "bot", False)
                state["rematchMatchId"] = new_id
                commit_state(cur, m, state)
                return {"status": "started", "matchId": new_id, "slot": 1}

            # Private lobby rematch -> mark caller ready in lobby; auto-starts when both ready
            if m.get("lobby_code"):
                code = m["lobby_code"]
                cur.execute("SELECT * FROM lobbies WHERE code=%s FOR UPDATE", (code,))
                lb = cur.fetchone()
                if lb:
                    role = "host" if who.name == lb["host"] else ("guest" if who.name == lb["guest"] else None)
                    if role and lb.get(f"{role}_deck") is not None:
                        cur.execute(f"UPDATE lobbies SET {role}_ready=TRUE, updated_at=NOW() WHERE code=%s", (code,))
                        cur.execute("SELECT * FROM lobbies WHERE code=%s", (code,))
                        lb = cur.fetchone()
                        started_id = lobby_maybe_start(cur, lb)
                        hub.notify(f"lobby:{code}")
                        if started_id:
                            state["rematchMatchId"] = started_id
                            commit_state(cur, m, state)
                            return {"status": "started", "matchId": started_id, "slot": 1 if role == "host" else 2}
                    return {"status": "lobby", "lobbyCode": code}

            # Casual PvP rematch -> offer & start once both accept
            offers = list(state.get("rematchOffers") or [])
            if who.name not in offers:
                offers.append(who.name)
            state["rematchOffers"] = offers
            if m["player1"] in offers and m["player2"] in offers:
                d1 = ge.build_deck(pool, None, state.get("p1_deck_cards"))
                d2 = ge.build_deck(pool, None, state.get("p2_deck_cards"))
                nstate = ge.new_match_state(m["player1"], d1, m["player2"], d2, is_ai=False)
                nstate["p1_deck_cards"] = state.get("p1_deck_cards")
                nstate["p2_deck_cards"] = state.get("p2_deck_cards")
                new_id = insert_match(cur, m["player1"], m["player2"], nstate, m.get("player1_deck"), m.get("player2_deck"), "casual", False)
                state["rematchMatchId"] = new_id
                commit_state(cur, m, state)
                return {"status": "started", "matchId": new_id, "slot": s}
            commit_state(cur, m, state)
            return {"status": "waiting", "offers": offers}

    # ---------------- queues ----------------
    def try_pair(cur, me_name: str, mode: str):
        """Inside an open DBTx, atomically pair `me_name` with the closest compatible player."""
        cur.execute(
            "SELECT *, EXTRACT(EPOCH FROM NOW()-joined_at) AS wait "
            "FROM queue_entries WHERE player=%s AND mode=%s FOR UPDATE",
            (me_name, mode),
        )
        me = cur.fetchone()
        if not me or me["match_id"]:
            return me["match_id"] if me else None
        wait_sec = max(0.0, float(me["wait"] or 0.0))
        window = rating.search_window(wait_sec) if mode == "ranked" else (300.0 + 50.0 * wait_sec)
        win_sql = 1e9 if window == float("inf") else window
        cur.execute(
            """SELECT * FROM queue_entries
               WHERE mode=%s AND player<>%s AND match_id IS NULL
                 AND last_seen > NOW() - (%s * INTERVAL '1 second')
                 AND ABS(mmr - %s) <= GREATEST(
                     %s,
                     CASE WHEN %s = 'casual' THEN 300 + 50 * EXTRACT(EPOCH FROM NOW()-joined_at)
                          WHEN EXTRACT(EPOCH FROM NOW()-joined_at) >= 60 THEN 1e9
                          ELSE 100 + 25 * EXTRACT(EPOCH FROM NOW()-joined_at)
                     END
                 )
               ORDER BY ABS(mmr - %s) ASC, joined_at ASC
               LIMIT 1 FOR UPDATE SKIP LOCKED""",
            (mode, me_name, QUEUE_STALE_SECONDS, me["mmr"], win_sql, mode, me["mmr"]),
        )
        opp = cur.fetchone()
        if not opp:
            return None
        # Earlier joiner becomes Player 1
        a, b = (opp, me) if opp["joined_at"] <= me["joined_at"] else (me, opp)
        state = ge.new_match_state(a["player"], a["deck"], b["player"], b["deck"], is_ai=False)
        state["players"]["1"]["mmr"] = a["mmr"]
        state["players"]["2"]["mmr"] = b["mmr"]
        state["p1_deck_cards"] = [c["cardId"] for c in a["deck"] if c.get("cardId") is not None]
        state["p2_deck_cards"] = [c["cardId"] for c in b["deck"] if c.get("cardId") is not None]
        is_ranked = mode == "ranked"
        mid = insert_match(cur, a["player"], b["player"], state, a["deck_name"], b["deck_name"], mode, is_ranked)
        cur.execute("UPDATE queue_entries SET match_id=%s WHERE id IN (%s,%s)", (mid, a["id"], b["id"]))
        return mid

    deps["try_pair"] = try_pair

    def _queue_step(who: Identity):
        notify_players = []
        with DBTx() as cur:
            cur.execute(
                "UPDATE queue_entries SET last_seen=NOW() WHERE player=%s "
                "RETURNING *, EXTRACT(EPOCH FROM NOW()-joined_at) AS wait",
                (who.name,),
            )
            me = cur.fetchone()
            if not me:
                return {"status": "idle"}
            mid = me["match_id"]
            if not mid:
                mid = try_pair(cur, who.name, me["mode"])
                if mid:
                    cur.execute("SELECT player1, player2 FROM matches WHERE id=%s", (mid,))
                    mrow = cur.fetchone()
                    if mrow:
                        notify_players = [mrow["player1"], mrow["player2"]]
            if mid:
                cur.execute("DELETE FROM queue_entries WHERE player=%s", (who.name,))
                cur.execute("SELECT player1, player2 FROM matches WHERE id=%s", (mid,))
                row = cur.fetchone()
                slot = 1 if row and row["player1"] == who.name else 2
                opp_name = row["player2"] if slot == 1 else (row["player1"] if row else None)
                res = {"status": "matched", "matchId": mid, "slot": slot, "opponent": opp_name, "mode": me["mode"]}
            else:
                wait = max(0.0, float(me["wait"] or 0.0))
                win = rating.search_window(wait) if me["mode"] == "ranked" else (300.0 + 50.0 * wait)
                res = {
                    "status": "searching",
                    "mode": me["mode"],
                    "mmr": me["mmr"],
                    "waitSeconds": int(wait),
                    "searchRange": None if win >= 1e8 else int(win),
                    "suggestBot": wait >= 45,
                }
        for pname in notify_players:
            hub.notify(f"queue:{pname}")
        return res

    @api.post("/queue/join")
    def queue_join(req: QueueJoinReq, request: Request):
        who = ident(request)
        mode = req.mode if req.mode in ("ranked", "casual") else "casual"
        if mode == "ranked" and not who.registered:
            raise HTTPException(403, "Create a free account to play Ranked and earn Elo.")
        pool = load_cards()
        deck = resolve_deck(pool, req.faction, req.deckCards)
        with DBTx() as cur:
            mmr = rating.DEFAULT_MMR
            if who.registered:
                cur.execute("SELECT mmr FROM users WHERE nickname=%s", (who.name,))
                u = cur.fetchone()
                if u and u.get("mmr") is not None:
                    mmr = u["mmr"]
            cur.execute("DELETE FROM queue_entries WHERE last_seen < NOW() - INTERVAL '5 minutes'")
            cur.execute(
                """INSERT INTO queue_entries (player, mode, mmr, deck, deck_name, joined_at, last_seen, match_id)
                   VALUES (%s,%s,%s,%s,%s,NOW(),NOW(),NULL)
                   ON CONFLICT (player) DO UPDATE SET
                       mode=EXCLUDED.mode, mmr=EXCLUDED.mmr, deck=EXCLUDED.deck,
                       deck_name=EXCLUDED.deck_name, joined_at=NOW(), last_seen=NOW(), match_id=NULL""",
                (who.name, mode, mmr, Json(deck), req.deckName or "Custom"),
            )
        return _queue_step(who)

    @api.post("/queue/heartbeat")
    def queue_heartbeat(request: Request):
        who = ident(request)
        return _queue_step(who)

    @api.post("/queue/leave")
    def queue_leave(request: Request):
        who = ident(request)
        with DBTx() as cur:
            cur.execute("DELETE FROM queue_entries WHERE player=%s AND match_id IS NULL", (who.name,))
        hub.notify(f"queue:{who.name}")
        return {"status": "idle"}

    @api.get("/queue/stats")
    def queue_stats():
        with DB() as cur:
            cur.execute(
                "SELECT mode, COUNT(*) AS c FROM queue_entries "
                "WHERE match_id IS NULL AND last_seen > NOW() - (%s * INTERVAL '1 second') "
                "GROUP BY mode",
                (QUEUE_STALE_SECONDS,),
            )
            q = {r["mode"]: r["c"] for r in cur.fetchall()}
            cur.execute(
                "SELECT COUNT(*) AS c FROM matches "
                "WHERE status IN ('PLAYING','DICE_ROLL') AND last_polled > NOW() - INTERVAL '2 minutes'"
            )
            live = cur.fetchone()["c"]
        return {"ranked": q.get("ranked", 0), "casual": q.get("casual", 0), "liveMatches": live}

    @api.get("/me/active-match")
    def active_match(request: Request):
        who = ident(request, required=False)
        if not who:
            return {"matchId": None}
        with DB() as cur:
            cur.execute(
                """SELECT id, player1, player2, mode, is_ranked, lobby_code
                   FROM matches
                   WHERE status IN ('PLAYING','DICE_ROLL')
                     AND (player1=%s OR player2=%s)
                     AND last_polled > NOW() - INTERVAL '2 minutes'
                   ORDER BY id DESC LIMIT 1""",
                (who.name, who.name),
            )
            r = cur.fetchone()
        if not r:
            return {"matchId": None}
        slot = 1 if r["player1"] == who.name else 2
        opp_name = r["player2"] if slot == 1 else r["player1"]
        return {
            "matchId": r["id"],
            "slot": slot,
            "opponent": opp_name,
            "mode": r.get("mode") or ("ranked" if r["is_ranked"] else "casual"),
            "lobbyCode": r.get("lobby_code"),
        }

    @api.get("/me/rating-history")
    def rating_history(request: Request):
        who = ident(request)
        with DB() as cur:
            cur.execute(
                "SELECT match_id, mmr_before, mmr_after, (mmr_after - mmr_before) AS delta, created_at "
                "FROM rating_history WHERE nickname=%s ORDER BY id DESC LIMIT 50",
                (who.name,),
            )
            rows = cur.fetchall()
        return [{**r, "created_at": str(r["created_at"])} for r in rows]

    # ---------------- private lobbies ----------------
    def lobby_view(cur, code, who: Optional[Identity]):
        cur.execute("SELECT * FROM lobbies WHERE code=%s", (code,))
        lb = cur.fetchone()
        if not lb:
            raise HTTPException(404, "Lobby not found or expired.")
        match_status = None
        if lb["match_id"]:
            cur.execute("SELECT status FROM matches WHERE id=%s", (lb["match_id"],))
            r = cur.fetchone()
            match_status = r["status"] if r else None
        me = who.name if who else None
        settings = dict(lb["settings"] or {})
        settings.setdefault("turnSeconds", CASUAL_TURN_SECONDS)
        settings.setdefault("bestOf", 1)
        settings.setdefault("allowSpectators", True)
        settings.setdefault("score", {"host": 0, "guest": 0})
        return {
            "code": lb["code"],
            "host": lb["host"],
            "guest": lb["guest"],
            "hostReady": lb["host_ready"],
            "guestReady": lb["guest_ready"],
            "hostDeck": lb["host_deck_name"],
            "guestDeck": lb["guest_deck_name"],
            "hostHasDeck": lb["host_deck"] is not None,
            "guestHasDeck": lb["guest_deck"] is not None,
            "settings": settings,
            "matchId": lb["match_id"],
            "matchStatus": match_status,
            "you": "host" if me == lb["host"] else ("guest" if me == lb["guest"] else None),
            "slot": 1 if me == lb["host"] else (2 if me == lb["guest"] else 0),
        }

    def lobby_lock(cur, code):
        cur.execute("SELECT * FROM lobbies WHERE code=%s FOR UPDATE", (code,))
        lb = cur.fetchone()
        if not lb:
            raise HTTPException(404, "Lobby not found or expired.")
        return lb

    def lobby_maybe_start(cur, lb) -> Optional[int]:
        if not (lb["guest"] and lb["host_ready"] and lb["guest_ready"] and lb["host_deck"] and lb["guest_deck"]):
            return None
        if lb["match_id"]:
            cur.execute("SELECT status FROM matches WHERE id=%s", (lb["match_id"],))
            r = cur.fetchone()
            if r and r["status"] != "ENDED":
                return None
        settings = lb["settings"] or {}
        state = ge.new_match_state(lb["host"], lb["host_deck"], lb["guest"], lb["guest_deck"], is_ai=False)
        raw_secs = settings.get("turnSeconds", CASUAL_TURN_SECONDS)
        state["turnSeconds"] = int(raw_secs) if raw_secs is not None else CASUAL_TURN_SECONDS
        state["allowSpectators"] = bool(settings.get("allowSpectators", True))
        mid = insert_match(
            cur, lb["host"], lb["guest"], state,
            lb["host_deck_name"], lb["guest_deck_name"],
            "private", False, lobby_code=lb["code"],
        )
        cur.execute("UPDATE lobbies SET match_id=%s, host_ready=FALSE, guest_ready=FALSE, updated_at=NOW() WHERE code=%s", (mid, lb["code"]))
        return mid

    @api.post("/lobby")
    def lobby_create(req: LobbyCreateReq, request: Request):
        who = ident(request)
        secs = 0 if req.turnSeconds == 0 else max(30, min(300, int(req.turnSeconds or CASUAL_TURN_SECONDS)))
        best_of = 3 if req.bestOf == 3 else 1
        settings = {
            "turnSeconds": secs,
            "bestOf": best_of,
            "allowSpectators": bool(req.allowSpectators),
            "score": {"host": 0, "guest": 0},
        }
        with DBTx() as cur:
            cur.execute("DELETE FROM lobbies WHERE updated_at < NOW() - INTERVAL '6 hours'")
            for _ in range(12):
                code = _code(6)
                cur.execute(
                    "INSERT INTO lobbies (code, host, settings) VALUES (%s,%s,%s) "
                    "ON CONFLICT DO NOTHING RETURNING code",
                    (code, who.name, Json(settings)),
                )
                if cur.fetchone():
                    return lobby_view(cur, code, who)
        raise HTTPException(500, "Could not allocate a lobby code, try again.")

    @api.get("/lobby/{code}")
    def lobby_get(code: str, request: Request):
        who = ident(request, required=False)
        with DB() as cur:
            return lobby_view(cur, code.strip().upper(), who)

    def lobby_mutate(code, request, fn):
        who = ident(request)
        code = code.strip().upper()
        with DBTx() as cur:
            lb = lobby_lock(cur, code)
            fn(cur, lb, who)
            cur.execute("SELECT * FROM lobbies WHERE code=%s", (code,))
            lb = cur.fetchone()
            if lb:
                lobby_maybe_start(cur, lb)
                cur.execute("UPDATE lobbies SET updated_at=NOW() WHERE code=%s", (code,))
                out = lobby_view(cur, code, who)
            else:
                out = {"code": code, "closed": True}
        hub.notify(f"lobby:{code}")
        return out

    @api.post("/lobby/{code}/join")
    def lobby_join(code: str, request: Request):
        def fn(cur, lb, who):
            if who.name in (lb["host"], lb["guest"]):
                return
            if lb["guest"]:
                raise HTTPException(409, "Lobby is already full.")
            cur.execute(
                "UPDATE lobbies SET guest=%s, guest_ready=FALSE, guest_deck=NULL, guest_deck_name=NULL WHERE code=%s",
                (who.name, lb["code"]),
            )
        return lobby_mutate(code, request, fn)

    @api.post("/lobby/{code}/settings")
    def lobby_settings(code: str, req: LobbySettingsReq, request: Request):
        def fn(cur, lb, who):
            if who.name != lb["host"]:
                raise HTTPException(403, "Only the lobby host can change match settings.")
            s = dict(lb["settings"] or {})
            if req.turnSeconds is not None:
                s["turnSeconds"] = 0 if req.turnSeconds == 0 else max(30, min(300, int(req.turnSeconds)))
            if req.bestOf is not None:
                s["bestOf"] = 3 if req.bestOf == 3 else 1
            if req.allowSpectators is not None:
                s["allowSpectators"] = bool(req.allowSpectators)
            cur.execute(
                "UPDATE lobbies SET settings=%s, host_ready=FALSE, guest_ready=FALSE WHERE code=%s",
                (Json(s), lb["code"]),
            )
        return lobby_mutate(code, request, fn)

    @api.post("/lobby/{code}/deck")
    def lobby_deck(code: str, req: LobbyDeckReq, request: Request):
        deck = resolve_deck(load_cards(), req.faction, req.deckCards)

        def fn(cur, lb, who):
            role = "host" if who.name == lb["host"] else ("guest" if who.name == lb["guest"] else None)
            if not role:
                raise HTTPException(403, "You are not in this lobby.")
            cur.execute(
                f"UPDATE lobbies SET {role}_deck=%s, {role}_deck_name=%s, {role}_ready=FALSE WHERE code=%s",
                (Json(deck), req.deckName or "Custom", lb["code"]),
            )
        return lobby_mutate(code, request, fn)

    @api.post("/lobby/{code}/ready")
    def lobby_ready(code: str, req: LobbyReadyReq, request: Request):
        def fn(cur, lb, who):
            role = "host" if who.name == lb["host"] else ("guest" if who.name == lb["guest"] else None)
            if not role:
                raise HTTPException(403, "You are not in this lobby.")
            if req.ready and lb[f"{role}_deck"] is None:
                raise HTTPException(400, "Choose your deck before readying up.")
            cur.execute(f"UPDATE lobbies SET {role}_ready=%s WHERE code=%s", (req.ready, lb["code"]))
        return lobby_mutate(code, request, fn)

    @api.post("/lobby/{code}/leave")
    def lobby_leave(code: str, request: Request):
        def fn(cur, lb, who):
            if who.name == lb["host"]:
                cur.execute("DELETE FROM lobbies WHERE code=%s", (lb["code"],))
            elif who.name == lb["guest"]:
                s = dict(lb["settings"] or {})
                s["score"] = {"host": 0, "guest": 0}
                cur.execute(
                    "UPDATE lobbies SET guest=NULL, guest_ready=FALSE, guest_deck=NULL, "
                    "guest_deck_name=NULL, host_ready=FALSE, settings=%s WHERE code=%s",
                    (Json(s), lb["code"]),
                )
        return lobby_mutate(code, request, fn)

    @api.post("/lobby/{code}/kick")
    def lobby_kick(code: str, request: Request):
        def fn(cur, lb, who):
            if who.name != lb["host"]:
                raise HTTPException(403, "Only the host can remove a challenger.")
            s = dict(lb["settings"] or {})
            s["score"] = {"host": 0, "guest": 0}
            cur.execute(
                "UPDATE lobbies SET guest=NULL, guest_ready=FALSE, guest_deck=NULL, "
                "guest_deck_name=NULL, host_ready=FALSE, settings=%s WHERE code=%s",
                (Json(s), lb["code"]),
            )
        return lobby_mutate(code, request, fn)

    # ---------------- tutorial completion ----------------
    @api.post("/me/tutorial-done")
    def tutorial_done(request: Request):
        who = ident(request, required=False)
        if who and who.registered:
            with DB() as cur:
                cur.execute("UPDATE users SET tutorial_done=TRUE WHERE nickname=%s", (who.name,))
        return {"ok": True}

    # ---------------- websockets ----------------
    @app.websocket("/api/ws/match/{match_id}")
    async def ws_match(ws: WebSocket, match_id: int, token: Optional[str] = None, spectate: bool = False):
        await ws.accept()
        who = decode_identity(token, SECRET)
        topic = f"match:{match_id}"
        ev = hub.subscribe(topic)
        last_version = None
        try:
            while True:
                data = await asyncio.to_thread(match_tick_and_view, match_id, who, None, spectate)
                ver = (data.get("version"), data.get("rematchMatchId"), tuple(data.get("rematchOffers") or ()))
                if ver != last_version:
                    last_version = ver
                    await ws.send_json({"type": "state", "match": data})
                else:
                    await ws.send_json({"type": "ping", "serverTime": data["serverTime"]})
                if data["status"] == "ENDED" and data.get("rematchMatchId"):
                    break
                await hub.wait_event(ev, 4.0)
        except WebSocketDisconnect:
            pass
        except HTTPException as e:
            try:
                await ws.send_json({"type": "error", "detail": e.detail})
            except Exception:
                pass
        except Exception as e:  # pragma: no cover
            log.exception("ws_match error: %s", e)
        finally:
            hub.unsubscribe(topic, ev)
            try:
                await ws.close()
            except Exception:
                pass

    @app.websocket("/api/ws/queue")
    async def ws_queue(ws: WebSocket, token: Optional[str] = None):
        await ws.accept()
        who = decode_identity(token, SECRET)
        if not who:
            await ws.send_json({"type": "error", "detail": "Unauthorized"})
            await ws.close()
            return
        topic = f"queue:{who.name}"
        ev = hub.subscribe(topic)
        try:
            while True:
                st = await asyncio.to_thread(_queue_step, who)
                await ws.send_json({"type": "queue", **st})
                if st.get("status") in ("matched", "idle"):
                    break
                await hub.wait_event(ev, 2.5)
        except WebSocketDisconnect:
            pass
        except Exception as e:  # pragma: no cover
            log.exception("ws_queue error: %s", e)
        finally:
            hub.unsubscribe(topic, ev)
            try:
                await ws.close()
            except Exception:
                pass

    @app.websocket("/api/ws/lobby/{code}")
    async def ws_lobby(ws: WebSocket, code: str, token: Optional[str] = None):
        await ws.accept()
        who = decode_identity(token, SECRET)
        code = code.strip().upper()
        topic = f"lobby:{code}"
        ev = hub.subscribe(topic)

        def snapshot():
            with DB() as cur:
                return lobby_view(cur, code, who)

        last = None
        try:
            while True:
                data = await asyncio.to_thread(snapshot)
                blob = json.dumps(data, sort_keys=True, default=str)
                if blob != last:
                    last = blob
                    await ws.send_json({"type": "lobby", "lobby": data})
                await hub.wait_event(ev, 6.0)
        except WebSocketDisconnect:
            pass
        except HTTPException as e:
            try:
                await ws.send_json({"type": "closed", "detail": e.detail})
            except Exception:
                pass
        except Exception as e:  # pragma: no cover
            log.exception("ws_lobby error: %s", e)
        finally:
            hub.unsubscribe(topic, ev)
            try:
                await ws.close()
            except Exception:
                pass
