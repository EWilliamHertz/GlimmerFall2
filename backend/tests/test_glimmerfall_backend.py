"""GlimmerFall TCG backend integration tests."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://glimmerfall-tcg.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="session")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


# ---------------- static endpoints ----------------

def test_cards(s):
    r = s.get(f"{API}/cards", timeout=30)
    assert r.status_code == 200
    cards = r.json()
    assert len(cards) == 100, f"expected 100 cards got {len(cards)}"
    for c in cards:
        assert c.get("faction")
        assert c.get("image_url")
        assert c["card_type"] in ("Entity", "Flash", "Rite", "Relic"), f"bad type {c['card_type']}"
        assert c["card_type"] != "Hex"


def test_rules(s):
    r = s.get(f"{API}/rules", timeout=15)
    assert r.status_code == 200
    rules = r.json()
    assert len(rules) > 0
    orders = [x["display_order"] for x in rules]
    assert orders == sorted(orders)


def test_booster(s):
    r = s.get(f"{API}/booster", timeout=15)
    assert r.status_code == 200
    assert len(r.json()) == 10


def test_starter_decks(s):
    r = s.get(f"{API}/starter-decks", timeout=15)
    assert r.status_code == 200
    decks = r.json()
    assert len(decks) == 4
    for d in decks:
        assert isinstance(d.get("cards"), list) and len(d["cards"]) > 0


# ---------------- match session ----------------

@pytest.fixture(scope="module")
def match(s):
    r = s.post(f"{API}/matchmaking", json={"username": "TESTER", "vsAI": True, "faction": "Solari"}, timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["status"] == "PLAYING"
    assert data["slot"] == 1
    assert data["vsAI"] is True
    assert data["roomCode"]
    return data


def _get_match(s, mid, slot=1):
    r = s.get(f"{API}/match", params={"id": mid, "slot": slot}, timeout=15)
    assert r.status_code == 200
    return r.json()


def _action(s, mid, slot, action, payload=None, expect_ok=True):
    r = s.post(f"{API}/action", json={"matchId": mid, "slot": slot, "action": action, "payload": payload or {}}, timeout=30)
    if expect_ok:
        assert r.status_code == 200, r.text
        return r.json()
    return r


def test_matchmaking_created(match):
    assert match["matchId"] > 0


def test_get_match_redacts(s, match):
    m = _get_match(s, match["matchId"], 1)
    st = m["state"]
    assert "p1_deck" not in st
    for slot in ("1", "2"):
        pl = st["players"][slot]
        assert "library" not in pl
        assert "libraryCount" in pl
    # opponent hand hidden
    opp_hand = st["players"]["2"]["hand"]
    assert all(c.get("hidden") for c in opp_hand)


def test_draw_and_double_draw_rejected(s, match):
    mid = match["matchId"]
    before = _get_match(s, mid, 1)["state"]["players"]["1"]["handCount"]
    _action(s, mid, 1, "DRAW_CARD")
    after = _get_match(s, mid, 1)["state"]["players"]["1"]["handCount"]
    assert after == before + 1
    # second draw same turn rejected
    r = _action(s, mid, 1, "DRAW_CARD", expect_ok=False)
    assert r.status_code == 400


def test_resonance_play_and_double_rejected(s, match):
    mid = match["matchId"]
    m = _get_match(s, mid, 1)
    p1 = m["state"]["players"]["1"]
    max_before = p1["maxEnergy"]
    # get a card from hand (we need instanceId; hand for own player has full data)
    card_id = p1["hand"][0]["instanceId"]
    _action(s, mid, 1, "PLAY_CARD", {"instanceId": card_id, "destination": "resonance"})
    m2 = _get_match(s, mid, 1)
    assert m2["state"]["players"]["1"]["maxEnergy"] == max_before + 1
    # second resonance rejected
    card_id2 = m2["state"]["players"]["1"]["hand"][0]["instanceId"]
    r = _action(s, mid, 1, "PLAY_CARD", {"instanceId": card_id2, "destination": "resonance"}, expect_ok=False)
    assert r.status_code == 400


def test_end_turn_vs_ai_advances_by_2(s, match):
    mid = match["matchId"]
    m = _get_match(s, mid, 1)
    turn_before = m["state"]["turn"]
    _action(s, mid, 1, "END_TURN")
    m2 = _get_match(s, mid, 1)
    # ai plays and returns; turn should increment by 2 (player -> AI -> player)
    assert m2["state"]["turn"] == turn_before + 2, f"turn was {turn_before}, now {m2['state']['turn']}"
    assert m2["state"]["activePlayer"] == 1


def test_not_your_turn_rejected(s):
    # create fresh AI match, then try to act as slot 2 (never our turn since AI auto-plays)
    r = requests.post(f"{API}/matchmaking", json={"username": "TESTER2", "vsAI": True}, timeout=30).json()
    mid = r["matchId"]
    resp = requests.post(f"{API}/action", json={"matchId": mid, "slot": 2, "action": "DRAW_CARD", "payload": {}}, timeout=15)
    assert resp.status_code == 400


# ---------------- entity deploy + effects + attachment ----------------

def _fresh_ai_match(s, username="TESTER_FX"):
    r = s.post(f"{API}/matchmaking", json={"username": username, "vsAI": True}, timeout=30)
    return r.json()


def _find_hand_card(state_p1, predicate):
    for c in state_p1["hand"]:
        if predicate(c):
            return c
    return None


def test_play_entity_deducts_energy(s):
    m = _fresh_ai_match(s, "TESTER_ENT")
    mid = m["matchId"]
    # get enough energy: keep resonating & ending turns
    # First bring energy up by playing resonance a couple of times across turns
    for _ in range(4):
        st = _get_match(s, mid, 1)["state"]
        p1 = st["players"]["1"]
        if p1["maxEnergy"] < 5:
            card = p1["hand"][0]
            _action(s, mid, 1, "PLAY_CARD", {"instanceId": card["instanceId"], "destination": "resonance"})
        _action(s, mid, 1, "END_TURN")
        if _get_match(s, mid, 1)["state"]["phase"] == "ENDED":
            pytest.skip("match ended during setup")
    st = _get_match(s, mid, 1)["state"]
    p1 = st["players"]["1"]
    energy = p1["energy"]
    ent = _find_hand_card(p1, lambda c: c["cardType"] == "Entity" and c["cost"] <= energy)
    if not ent:
        pytest.skip("no affordable entity in hand")
    bf_before = len(p1["battlefield"])
    _action(s, mid, 1, "PLAY_CARD", {"instanceId": ent["instanceId"], "destination": "battlefield"})
    st2 = _get_match(s, mid, 1)["state"]
    p1b = st2["players"]["1"]
    assert p1b["energy"] == energy - ent["cost"]
    assert len(p1b["battlefield"]) >= bf_before + 1


def test_win_condition_via_direct_hp_mutation():
    """Unit test of engine directly to verify win-condition sets ENDED/winner."""
    import sys, importlib
    sys.path.insert(0, "/app/backend")
    ge = importlib.import_module("game_engine")
    pool = [{"id": i, "name": f"c{i}", "faction": "Solari", "card_type": "Entity", "cost": 1, "power": 1,
             "health": 1, "keywords": None, "description": "", "rarity": "Common", "collector_number": i,
             "image_url": "x"} for i in range(10)]
    d1 = ge.build_deck(pool, None)
    d2 = ge.build_deck(pool, None)
    state = ge.new_match_state("A", d1, "B", d2, is_ai=False)
    state["players"]["2"]["hp"] = 0
    ge.check_win(state)
    assert state["phase"] == "ENDED"
    assert state["winner"] == 1


def test_radiant_shield_attachment(s):
    """Verify Radiant Shield relic buffs strongest friendly entity and grants Guard."""
    import sys, importlib
    sys.path.insert(0, "/app/backend")
    ge = importlib.import_module("game_engine")
    # Build a controlled state
    pool = [{"id": 1, "name": "Grunt", "faction": "Solari", "card_type": "Entity", "cost": 1, "power": 2, "health": 2,
             "keywords": None, "description": "", "rarity": "Common", "collector_number": 1, "image_url": "x"}]
    deck = [ge.make_instance(pool[0]) for _ in range(30)]
    state = ge.new_match_state("A", deck, "B", list(deck), is_ai=False)
    # put an entity on battlefield
    ent = ge.make_instance(pool[0])
    state["players"]["1"]["battlefield"].append(ent)
    # craft Radiant Shield card in hand
    relic = {"id": 99, "name": "Radiant Shield", "faction": "Solari", "card_type": "Relic", "cost": 0,
             "power": None, "health": None, "keywords": None,
             "description": "Attached Entity gets +1/+2 and Guard.",
             "rarity": "Rare", "collector_number": 99, "image_url": "x"}
    relic_inst = ge.make_instance(relic)
    state["players"]["1"]["hand"].append(relic_inst)
    state["players"]["1"]["energy"] = 5
    ge.do_play_card(state, "1", {"instanceId": relic_inst["instanceId"], "destination": "battlefield"})
    assert ent["power"] == 3
    assert ent["health"] == 4
    assert "Guard" in ent["keywords"]
