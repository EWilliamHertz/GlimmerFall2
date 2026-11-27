"""Unit tests for game_engine security fixes, cards2 deck resolution, and guided tutorial."""
from pathlib import Path
import sys
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import game_engine as ge  # noqa: E402


def _sample_pool():
    pool = []
    for i in range(1, 21):
        pool.append({
            "id": f"awk2-{i}" if i > 10 else i,
            "name": f"Expansion Card {i}" if i > 10 else f"Base Card {i}",
            "faction": "Solari" if i % 2 == 0 else "Umbri",
            "card_type": "Entity",
            "cost": (i % 4) + 1,
            "power": 2,
            "health": 2,
            "keywords": None,
            "description": "",
            "rarity": "Common",
            "collector_number": i,
            "image_url": None,
        })
    return pool


def test_build_deck_resolves_names_and_caps_copies():
    pool = _sample_pool()
    # Pass 10 copies of an expansion card BY NAME plus 10 copies by ID -> capped at 3 each,
    # and undersized list (<30) is topped up to DECK_SIZE (40) legally!
    raw = ["Expansion Card 15"] * 10 + [2] * 10
    deck = ge.build_deck(pool, card_ids=raw)
    assert len(deck) == ge.DECK_SIZE
    by_name = {}
    for inst in deck:
        by_name[inst["name"]] = by_name.get(inst["name"], 0) + 1
    assert by_name["Expansion Card 15"] == 3
    assert by_name["Base Card 2"] == 3
    assert all(cnt <= ge.COPY_MAX for cnt in by_name.values())


def test_pending_choice_rejects_forged_card_payload():
    pool = _sample_pool()
    d1 = ge.build_deck(pool, "Solari")
    d2 = ge.build_deck(pool, "Umbri")
    state = ge.new_match_state("Alice", d1, "Bob", d2, is_ai=False)
    state["phase"] = "PLAYING"
    state["activePlayer"] = 1
    real_card = state["players"]["1"]["library"].pop(0)
    state["pendingChoice"] = {
        "player": "1",
        "prompt": "Scry 1",
        "type": "scry_1",
        "options": [
            {"text": "Top", "payload": {"card": real_card, "action": "top"}},
            {"text": "Bottom", "payload": {"card": real_card, "action": "bottom"}},
        ],
    }
    forged_card = {
        "instanceId": "forged-999",
        "name": "Omnipotent Cheat",
        "cardType": "Entity",
        "cost": 0,
        "power": 99,
        "health": 99,
        "curHealth": 99,
        "keywords": ["Evasive"],
    }
    with pytest.raises(ge.ActionError, match="Invalid choice"):
        ge.apply_action(state, 1, "MAKE_CHOICE", {"card": forged_card, "action": "top"})

    # Valid option succeeds
    ge.apply_action(state, 1, "MAKE_CHOICE", {"optionIndex": 0})
    assert state["pendingChoice"] is None
    assert state["players"]["1"]["library"][0]["instanceId"] == real_card["instanceId"]


def test_guided_tutorial_full_playthrough():
    state = ge.new_tutorial_state("Apprentice")
    assert state["phase"] == "PLAYING"
    assert state["isTutorial"] is True
    assert state["players"]["2"]["hp"] == 4

    # Turn 1: Draw (Soul Drain), Resonate (Sunfire Colossus), Deploy (Solari Vanguard), Attack Nexus (4 -> 2), End Turn
    ge.apply_action(state, 1, "DRAW_CARD", {})
    p1 = state["players"]["1"]
    assert any(c["name"] == "Soul Drain" and c["collector_number"] == 176 for c in p1["hand"])

    colossus = next(c for c in p1["hand"] if c["name"] == "Sunfire Colossus")
    ge.apply_action(state, 1, "PLAY_CARD", {"instanceId": colossus["instanceId"], "destination": "resonance"})
    assert p1["energy"] == 1 and p1["maxEnergy"] == 1

    vanguard = next(c for c in p1["hand"] if c["name"] == "Solari Vanguard")
    ge.apply_action(state, 1, "PLAY_CARD", {"instanceId": vanguard["instanceId"], "destination": "battlefield"})
    assert len(p1["battlefield"]) == 1

    ge.apply_action(state, 1, "ATTACK_NEXUS", {"attackerId": vanguard["instanceId"]})
    assert state["players"]["2"]["hp"] == 2

    # Ending turn triggers Nexus Construct to deploy Astral Beacon (0/3 Guard, #269) and pass back
    ge.apply_action(state, 1, "END_TURN", {})
    assert state["activePlayer"] == 1
    enemy_bf = state["players"]["2"]["battlefield"]
    assert len(enemy_bf) == 1
    assert enemy_bf[0]["name"] == "Astral Beacon"
    assert enemy_bf[0]["collector_number"] == 269
    assert "Guard" in enemy_bf[0]["keywords"]

    # Attacking Nexus directly is blocked by Guard!
    with pytest.raises(ge.ActionError, match="Guard"):
        ge.apply_action(state, 1, "ATTACK_NEXUS", {"attackerId": vanguard["instanceId"]})

    # Turn 2: Draw, Resonate 2nd Node for 2/2 Energy, Cast Soul Drain on Astral Beacon, then Attack Nexus for lethal!
    ge.apply_action(state, 1, "DRAW_CARD", {})
    courier = next(c for c in p1["hand"] if c["name"] == "Emberwing Courier")
    ge.apply_action(state, 1, "PLAY_CARD", {"instanceId": courier["instanceId"], "destination": "resonance"})
    assert p1["energy"] == 2 and p1["maxEnergy"] == 2

    soul_drain = next(c for c in p1["hand"] if c["name"] == "Soul Drain")
    # Entity-only spell rejects targeting Nexus directly without wasting card/energy
    with pytest.raises(ge.ActionError, match="Entity"):
        ge.apply_action(
            state, 1, "CAST_SPELL",
            {"instanceId": soul_drain["instanceId"], "targetType": "nexus", "targetSlot": 2},
        )
    assert p1["energy"] == 2

    ge.apply_action(
        state, 1, "CAST_SPELL",
        {"instanceId": soul_drain["instanceId"], "targetType": "entity", "targetId": enemy_bf[0]["instanceId"]},
    )
    assert len(state["players"]["2"]["battlefield"]) == 0

    ge.apply_action(state, 1, "ATTACK_NEXUS", {"attackerId": vanguard["instanceId"]})
    assert state["phase"] == "ENDED"
    assert state["winner"] == 1
