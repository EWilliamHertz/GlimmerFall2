"""Tests specifically for DB resilience fix (stale NeonDB pooled connection recycle)."""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://glimmerfall-tcg.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def s():
    return requests.Session()


def _assert_2xx(r, ctx):
    assert 200 <= r.status_code < 300, f"{ctx} -> {r.status_code}: {r.text[:200]}"


def test_hammer_static_endpoints(s):
    """Call each endpoint ~10x in a loop; expect zero 500s."""
    for ep in ("/cards", "/rules", "/booster", "/starter-decks"):
        for i in range(10):
            r = s.get(f"{API}{ep}", timeout=30)
            _assert_2xx(r, f"GET {ep} iter{i}")


def test_arena_full_action_sequence_vs_ai(s):
    r = s.post(f"{API}/matchmaking", json={"username": "Nyx", "vsAI": True, "faction": "Terra"}, timeout=30)
    _assert_2xx(r, "matchmaking")
    m = r.json()
    mid = m["matchId"]
    assert m["status"] == "PLAYING"

    for turn in range(5):
        gm = s.get(f"{API}/match", params={"id": mid, "slot": 1}, timeout=15)
        _assert_2xx(gm, f"get match turn{turn}")
        st = gm.json()["state"]
        if st.get("phase") == "ENDED":
            break
        p1 = st["players"]["1"]
        # play resonance
        if p1["hand"]:
            rr = s.post(f"{API}/action", json={"matchId": mid, "slot": 1, "action": "PLAY_CARD",
                                               "payload": {"instanceId": p1["hand"][0]["instanceId"],
                                                           "destination": "resonance"}}, timeout=15)
            assert rr.status_code in (200, 400), f"resonance -> {rr.status_code}: {rr.text[:200]}"
        # draw
        rd = s.post(f"{API}/action", json={"matchId": mid, "slot": 1, "action": "DRAW_CARD", "payload": {}}, timeout=15)
        assert rd.status_code in (200, 400), f"draw -> {rd.status_code}: {rd.text[:200]}"
        # try entity to battlefield
        gm2 = s.get(f"{API}/match", params={"id": mid, "slot": 1}, timeout=15).json()
        p1b = gm2["state"]["players"]["1"]
        for c in p1b["hand"]:
            if c.get("cardType") == "Entity" and c.get("cost", 99) <= p1b.get("energy", 0):
                rp = s.post(f"{API}/action", json={"matchId": mid, "slot": 1, "action": "PLAY_CARD",
                                                   "payload": {"instanceId": c["instanceId"],
                                                               "destination": "battlefield"}}, timeout=15)
                assert rp.status_code in (200, 400), f"entity -> {rp.status_code}: {rp.text[:200]}"
                break
        # end turn
        re_ = s.post(f"{API}/action", json={"matchId": mid, "slot": 1, "action": "END_TURN", "payload": {}}, timeout=30)
        assert re_.status_code in (200, 400), f"end_turn -> {re_.status_code}: {re_.text[:200]}"

    # explicit final: no 500 encountered means test passes


def test_idle_gap_recycles_dead_connection(s):
    """Two GET /api/cards separated by ~25s idle time -- second must still be 200."""
    r1 = s.get(f"{API}/cards", timeout=30)
    _assert_2xx(r1, "cards #1")
    time.sleep(25)
    r2 = s.get(f"{API}/cards", timeout=30)
    _assert_2xx(r2, "cards #2 after idle")
    assert len(r2.json()) == 100
