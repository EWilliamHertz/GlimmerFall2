"""Integration tests for secure auth/slot enforcement, concurrent SKIP LOCKED queues,
Elo + rating_history, private lobbies + series rematch, timeouts, and WebSockets.

Skips cleanly only if TEST_DATABASE_URL / DATABASE_URL is not configured.
"""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
import json
import os
from pathlib import Path
import sys
import bcrypt
import psycopg2
import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

TEST_DSN = os.environ.get("TEST_DATABASE_URL") or os.environ.get("DATABASE_URL")
pytestmark = pytest.mark.skipif(not TEST_DSN, reason="No TEST_DATABASE_URL / DATABASE_URL configured")


def _bootstrap_schema(dsn: str):
    conn = psycopg2.connect(dsn)
    try:
        with conn, conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id SERIAL PRIMARY KEY,
                    email TEXT UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL,
                    nickname TEXT UNIQUE NOT NULL,
                    faction TEXT DEFAULT 'Solari',
                    avatar TEXT DEFAULT 'default_avatar.png',
                    is_admin BOOLEAN DEFAULT FALSE,
                    is_verified BOOLEAN DEFAULT TRUE,
                    verification_token TEXT,
                    wins INT DEFAULT 0,
                    losses INT DEFAULT 0,
                    ai_wins INT DEFAULT 0,
                    ai_losses INT DEFAULT 0,
                    mmr INT DEFAULT 1400,
                    rank TEXT DEFAULT 'Gold II',
                    referrals INT DEFAULT 0,
                    referral_code TEXT,
                    glimmer_balance INT DEFAULT 0,
                    bookings INT DEFAULT 0,
                    badges JSONB DEFAULT '[]'::jsonb,
                    status TEXT DEFAULT 'active',
                    created_at TIMESTAMPTZ DEFAULT NOW()
                );
                CREATE TABLE IF NOT EXISTS cards (
                    id SERIAL PRIMARY KEY,
                    name TEXT NOT NULL,
                    card_type TEXT NOT NULL,
                    cost INT DEFAULT 1,
                    power INT,
                    health INT,
                    description TEXT DEFAULT '',
                    image_url TEXT DEFAULT 'https://example.com/card.webp',
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    faction TEXT DEFAULT 'Solari',
                    keywords TEXT,
                    rarity TEXT DEFAULT 'Common',
                    ai_art_prompt TEXT,
                    set_name TEXT DEFAULT 'The Awakening',
                    collector_number INT,
                    set_code TEXT DEFAULT 'AWK',
                    lore TEXT
                );
                CREATE TABLE IF NOT EXISTS cards2 (LIKE cards INCLUDING ALL);
                CREATE TABLE IF NOT EXISTS decks (
                    id SERIAL PRIMARY KEY,
                    username TEXT,
                    deck_name TEXT NOT NULL,
                    user_id INT,
                    is_public BOOLEAN DEFAULT FALSE,
                    is_preconstructed BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMPTZ DEFAULT NOW()
                );
                CREATE TABLE IF NOT EXISTS deck_cards (
                    id SERIAL PRIMARY KEY,
                    deck_id INT NOT NULL,
                    card_name TEXT NOT NULL,
                    count INT NOT NULL DEFAULT 1
                );
                CREATE TABLE IF NOT EXISTS deck_likes (
                    deck_id INT,
                    user_email TEXT,
                    PRIMARY KEY (deck_id, user_email)
                );
                CREATE TABLE IF NOT EXISTS matches (
                    id SERIAL PRIMARY KEY,
                    room_code TEXT,
                    player1 TEXT,
                    player2 TEXT,
                    status TEXT DEFAULT 'WAITING',
                    current_turn INT DEFAULT 1,
                    active_player TEXT,
                    state JSONB,
                    player1_deck TEXT,
                    player2_deck TEXT,
                    is_ranked BOOLEAN DEFAULT FALSE,
                    history JSONB DEFAULT '[]'::jsonb,
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    last_polled TIMESTAMPTZ DEFAULT NOW()
                );
                CREATE TABLE IF NOT EXISTS user_quests (
                    id SERIAL PRIMARY KEY,
                    user_id INT,
                    description TEXT,
                    current_value INT DEFAULT 0,
                    target_value INT DEFAULT 1,
                    is_completed BOOLEAN DEFAULT FALSE,
                    reward_claimed BOOLEAN DEFAULT FALSE,
                    reward TEXT,
                    created_at TIMESTAMPTZ DEFAULT NOW()
                );
                CREATE TABLE IF NOT EXISTS daily_quests (
                    id SERIAL PRIMARY KEY,
                    quest_date DATE,
                    description TEXT,
                    target_value INT,
                    reward TEXT,
                    is_approved BOOLEAN DEFAULT TRUE
                );
            """)
            cur.execute("SELECT COUNT(*) FROM cards")
            if cur.fetchone()[0] == 0:
                for i in range(1, 16):
                    fac = ["Solari", "Umbri", "Terra", "Aether"][i % 4]
                    cur.execute(
                        "INSERT INTO cards (name, card_type, cost, power, health, faction, collector_number) "
                        "VALUES (%s, 'Entity', %s, 2, 2, %s, %s)",
                        (f"Test Entity {i}", (i % 3) + 1, fac, i),
                    )
                cur.execute(
                    "INSERT INTO cards2 (name, card_type, cost, power, health, faction, collector_number) "
                    "VALUES ('Expansion Starblade', 'Entity', 2, 3, 2, 'Aether', 101)"
                )
        from migrations.remodel_2026_11 import migrate
        migrate(dsn)
    finally:
        conn.close()


@pytest.fixture(scope="module")
def client():
    os.environ["DATABASE_URL"] = TEST_DSN
    os.environ["JWT_SECRET"] = "test_secret_key_for_glimmerfall_suite"
    _bootstrap_schema(TEST_DSN)
    import importlib
    import server
    importlib.reload(server)
    with TestClient(server.app) as c:
        yield c


def _make_user(client, nickname: str, mmr: int = 1400):
    import server
    email = f"{nickname.lower()}@example.com"
    pw_hash = bcrypt.hashpw(b"secret123", bcrypt.gensalt()).decode()
    with server.DBTx() as cur:
        cur.execute(
            """INSERT INTO users (email, password_hash, nickname, mmr, placement_games_left, is_verified)
               VALUES (%s, %s, %s, %s, 10, TRUE)
               ON CONFLICT (nickname) DO UPDATE SET mmr=EXCLUDED.mmr
               RETURNING id""",
            (email, pw_hash, nickname, mmr),
        )
    r = client.post("/api/auth/login", json={"email": email, "password": "secret123"})
    assert r.status_code == 200, r.text
    return r.json()["token"]


def _hdr(token: str):
    return {"Authorization": f"Bearer {token}"}


def test_guest_cannot_join_ranked_but_can_play_casual_and_bot(client):
    g = client.post("/api/guest", json={"nickname": "Nyx"}).json()
    assert g["name"].startswith("Nyx #")
    tok = g["token"]

    r_ranked = client.post("/api/queue/join", json={"mode": "ranked"}, headers=_hdr(tok))
    assert r_ranked.status_code == 403

    r_bot = client.post("/api/v2/bot", json={"faction": "Solari"}, headers=_hdr(tok))
    assert r_bot.status_code == 200
    assert r_bot.json()["matchId"] > 0


def test_slot_spoofing_rejected_and_opponent_hand_redacted(client):
    t1 = _make_user(client, "SecAlice", 1450)
    t2 = _make_user(client, "SecBob", 1450)

    r1 = client.post("/api/queue/join", json={"mode": "ranked", "faction": "Solari"}, headers=_hdr(t1)).json()
    assert r1["status"] == "searching"
    r2 = client.post("/api/queue/join", json={"mode": "ranked", "faction": "Umbri"}, headers=_hdr(t2)).json()
    assert r2["status"] == "matched"
    mid = r2["matchId"]

    # Alice inspects match: her hand is visible, Bob's hand is strictly redacted even if she passes ?slot=2 on legacy!
    m_v2 = client.get(f"/api/v2/match/{mid}", headers=_hdr(t1)).json()
    assert m_v2["slot"] == 1
    assert all(not c.get("hidden") for c in m_v2["state"]["players"]["1"]["hand"])
    assert all(c.get("hidden") for c in m_v2["state"]["players"]["2"]["hand"])

    m_legacy_spoof = client.get(f"/api/match?id={mid}&slot=2", headers=_hdr(t1)).json()
    assert m_legacy_spoof["slot"] == 1
    assert all(c.get("hidden") for c in m_legacy_spoof["state"]["players"]["2"]["hand"])

    # Outsider cannot act on the match (403)
    t3 = _make_user(client, "SecMallory", 1400)
    spoof = client.post(f"/api/v2/match/{mid}/action", json={"action": "ROLL_DICE"}, headers=_hdr(t3))
    assert spoof.status_code == 403

    # History endpoint is blocked while match is still active (403)
    hist_live = client.get(f"/api/match/{mid}/history")
    assert hist_live.status_code == 403

    # Concede ends the match and updates Elo + rating_history!
    conc = client.post(f"/api/v2/match/{mid}/concede", headers=_hdr(t1))
    assert conc.status_code == 200
    ended = conc.json()
    assert ended["status"] == "ENDED"
    rr = ended["state"]["ratingResult"]
    assert rr["2"]["delta"] > 0
    assert rr["1"]["delta"] < 0

    rh = client.get("/api/me/rating-history", headers=_hdr(t2)).json()
    assert any(row["match_id"] == mid and row["delta"] > 0 for row in rh)


def test_concurrent_queue_20_players_no_double_pairing(client):
    import server
    with server.DBTx() as cur:
        cur.execute("DELETE FROM queue_entries")

    tokens = [_make_user(client, f"ConcP{i:02d}", 1400 + (i * 5)) for i in range(20)]

    def _join_and_poll(tok):
        res = client.post("/api/queue/join", json={"mode": "ranked", "faction": "Solari"}, headers=_hdr(tok)).json()
        for _ in range(10):
            if res.get("status") == "matched":
                return res["matchId"], res["slot"]
            res = client.post("/api/queue/heartbeat", headers=_hdr(tok)).json()
        return None, None

    with ThreadPoolExecutor(max_workers=10) as pool:
        results = list(pool.map(_join_and_poll, tokens))

    matched_ids = [mid for mid, _ in results if mid is not None]
    assert len(matched_ids) == 20, f"Expected all 20 players matched, got {results}"
    # Exactly 10 distinct matches, each containing exactly 2 players (slot 1 and slot 2)
    counts = {}
    for mid, slot in results:
        counts.setdefault(mid, set()).add(slot)
    assert len(counts) == 10
    assert all(slots == {1, 2} for slots in counts.values())


def test_private_lobby_lifecycle_and_series_rematch(client):
    host_tok = client.post("/api/guest", json={"nickname": "HostHero"}).json()["token"]
    guest_tok = client.post("/api/guest", json={"nickname": "Challenger"}).json()["token"]

    lb = client.post("/api/lobby", json={"turnSeconds": 60, "bestOf": 3}, headers=_hdr(host_tok)).json()
    code = lb["code"]
    assert len(code) == 6

    # Challenger joins
    j = client.post(f"/api/lobby/{code}/join", headers=_hdr(guest_tok)).json()
    assert j["guest"] is not None

    # Ready before deck fails cleanly (400)
    bad_rdy = client.post(f"/api/lobby/{code}/ready", json={"ready": True}, headers=_hdr(host_tok))
    assert bad_rdy.status_code == 400

    # Both lock decks and ready up -> match auto-starts!
    client.post(f"/api/lobby/{code}/deck", json={"faction": "Solari", "deckName": "Sun"}, headers=_hdr(host_tok))
    client.post(f"/api/lobby/{code}/deck", json={"faction": "Terra", "deckName": "Roots"}, headers=_hdr(guest_tok))
    client.post(f"/api/lobby/{code}/ready", json={"ready": True}, headers=_hdr(host_tok))
    started = client.post(f"/api/lobby/{code}/ready", json={"ready": True}, headers=_hdr(guest_tok)).json()
    assert started["matchId"] is not None
    mid1 = started["matchId"]

    # Challenger concedes game 1 -> series score becomes host 1 - 0 guest
    client.post(f"/api/v2/match/{mid1}/concede", headers=_hdr(guest_tok))
    lb_after = client.get(f"/api/lobby/{code}", headers=_hdr(host_tok)).json()
    assert lb_after["settings"]["score"] == {"host": 1, "guest": 0}

    # Both click Rematch -> game 2 auto-starts!
    rm1 = client.post(f"/api/v2/match/{mid1}/rematch", headers=_hdr(host_tok)).json()
    assert rm1["status"] == "lobby"
    rm2 = client.post(f"/api/v2/match/{mid1}/rematch", headers=_hdr(guest_tok)).json()
    assert rm2["status"] == "started"
    assert rm2["matchId"] != mid1


def test_dice_timeout_turn_timeout_and_disconnect_forfeit(client):
    import server
    t1 = _make_user(client, "TimerA", 1400)
    t2 = _make_user(client, "TimerB", 1400)
    client.post("/api/queue/join", json={"mode": "casual", "faction": "Solari"}, headers=_hdr(t1))
    m = client.post("/api/queue/join", json={"mode": "casual", "faction": "Umbri"}, headers=_hdr(t2)).json()
    mid = m["matchId"]

    # 1) Backdate turnStartedAt by 25s during DICE_ROLL -> auto-rolls to PLAYING!
    with server.DBTx() as cur:
        cur.execute("SELECT state FROM matches WHERE id=%s FOR UPDATE", (mid,))
        st = cur.fetchone()["state"]
        st["turnStartedAt"] = int((datetime.now(timezone.utc).timestamp() - 25) * 1000)
        cur.execute("UPDATE matches SET state=%s WHERE id=%s", (json.dumps(st), mid))

    v = client.get(f"/api/v2/match/{mid}", headers=_hdr(t1)).json()
    assert v["state"]["phase"] == "PLAYING"
    turn_before = v["state"]["turn"]

    # 2) Backdate turnStartedAt past casual rope (125s) -> auto-ends turn!
    with server.DBTx() as cur:
        cur.execute("SELECT state FROM matches WHERE id=%s FOR UPDATE", (mid,))
        st = cur.fetchone()["state"]
        st["turnStartedAt"] = int((datetime.now(timezone.utc).timestamp() - 125) * 1000)
        cur.execute("UPDATE matches SET state=%s WHERE id=%s", (json.dumps(st), mid))

    v2 = client.get(f"/api/v2/match/{mid}", headers=_hdr(t1)).json()
    assert v2["state"]["turn"] == turn_before + 1

    # 3) Backdate p2_last_seen by 75s -> Player 2 forfeits due to disconnect!
    stale = datetime.now(timezone.utc) - timedelta(seconds=75)
    with server.DBTx() as cur:
        cur.execute("UPDATE matches SET p2_last_seen=%s WHERE id=%s", (stale, mid))

    v3 = client.get(f"/api/v2/match/{mid}", headers=_hdr(t1)).json()
    assert v3["status"] == "ENDED"
    assert v3["state"]["winner"] == 1


def test_websocket_match_push_and_legacy_anon_ai_compat(client):
    g_tok = client.post("/api/guest", json={"nickname": "WsHero"}).json()["token"]
    tut = client.post("/api/tutorial/start", headers=_hdr(g_tok)).json()
    mid = tut["matchId"]

    with client.websocket_connect(f"/api/ws/match/{mid}?token={g_tok}") as ws:
        msg = ws.receive_json()
        assert msg["type"] == "state"
        assert msg["match"]["matchId"] == mid
        v0 = msg["match"]["version"]

        # Trigger an action via REST -> WebSocket pushes updated state!
        r = client.post(f"/api/v2/match/{mid}/action", json={"action": "DRAW_CARD"}, headers=_hdr(g_tok))
        assert r.status_code == 200
        msg2 = ws.receive_json()
        assert msg2["type"] == "state"
        assert msg2["match"]["version"] > v0

    # Legacy unauthenticated vsAI flow still works for existing test suites
    leg = client.post("/api/matchmaking", json={"username": "LEGACY_BOT_TESTER", "vsAI": True, "faction": "Solari"})
    assert leg.status_code == 200
    lmid = leg.json()["matchId"]
    lg = client.get(f"/api/match?id={lmid}&slot=1")
    assert lg.status_code == 200
    bad_turn = client.post("/api/action", json={"matchId": lmid, "slot": 2, "action": "DRAW_CARD", "payload": {}})
    assert bad_turn.status_code == 400
