"""GlimmerFall TCG — server-authoritative game engine.

All mutating logic lives here. The FastAPI layer only loads/saves the match
`state` JSONB and delegates to `apply_action`. Turn limits are enforced here so
they cannot be bypassed by a client refresh.
"""
import random
import uuid
from copy import deepcopy

VANGUARD_HP = 25
HAND_START = 5
DECK_SIZE = 30
MAX_ENERGY = 12
AI_NAME = "GlimmerBot"


def _uid(prefix="i"):
    return f"{prefix}_{uuid.uuid4().hex[:9]}"


def keyword_list(card):
    kw = card.get("keywords")
    if not kw or kw == "None":
        return []
    return [k.strip() for k in str(kw).split(",") if k.strip()]


def make_instance(card):
    """Turn an oracle card row into a live instance object."""
    return {
        "instanceId": _uid("c"),
        "cardId": card["id"],
        "name": card["name"],
        "faction": card["faction"],
        "cardType": card["card_type"],
        "cost": int(card["cost"] or 0),
        "power": int(card["power"]) if card.get("power") not in (None, "None") else None,
        "health": int(card["health"]) if card.get("health") not in (None, "None") else None,
        "curHealth": int(card["health"]) if card.get("health") not in (None, "None") else None,
        "description": card.get("description") or "",
        "keywords": keyword_list(card),
        "rarity": card.get("rarity") or "Common",
        "image_url": card.get("image_url"),
        "collector_number": card.get("collector_number"),
        "exhausted": False,
    }


def build_deck(pool, faction=None):
    """Build a legal 30-card deck (max 3 copies of a card)."""
    cards = [c for c in pool if (faction is None or c["faction"] == faction)]
    if len(cards) < 8:
        cards = list(pool)
    bag = []
    for c in cards:
        for _ in range(3):
            bag.append(c)
    random.shuffle(bag)
    deck = [make_instance(c) for c in bag[:DECK_SIZE]]
    return deck


def new_player(username, deck):
    hand = deck[:HAND_START]
    library = deck[HAND_START:]
    return {
        "username": username,
        "hp": VANGUARD_HP,
        "energy": 0,
        "maxEnergy": 0,
        "library": library,
        "hand": hand,
        "battlefield": [],
        "resonanceRow": [],
        "relics": [],
        "void": [],
        "hasDrawnThisTurn": False,
        "hasResonatedThisTurn": False,
    }


def new_match_state(p1_name, deck1, p2_name, deck2, is_ai=False):
    state = {
        "players": {"1": new_player(p1_name, deck1), "2": new_player(p2_name, deck2)},
        "turn": 1,
        "activePlayer": 1,
        "phase": "PLAYING",
        "winner": None,
        "isAI": is_ai,
        "log": [f"Match begins! {p1_name} vs {p2_name}.", f"{p1_name}'s turn 1."],
    }
    # active player gets first energy potential; energy refills at start of turn
    return state


# ---------- helpers ----------

def opp(slot):
    return "2" if str(slot) == "1" else "1"


def find_in(zone, instance_id):
    for i, c in enumerate(zone):
        if c["instanceId"] == instance_id:
            return i, c
    return -1, None


def has_guard(player):
    return any("Guard" in e["keywords"] and "Stealth" not in e["keywords"] for e in player["battlefield"])


def log(state, msg):
    state["log"].append(msg)
    state["log"] = state["log"][-60:]


# ---------- effect engine ----------
import re as _re

WORDNUM = {"a": 1, "an": 1, "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7}
GRANT_KEYWORDS = ["Guard", "Evasive", "Stealth", "Lethal", "Overwhelm", "Swift"]


def _num(tok):
    tok = str(tok).strip().lower()
    if tok.isdigit():
        return int(tok)
    return WORDNUM.get(tok, 0)


def make_token(name, faction, power, health, keywords=None):
    return {
        "instanceId": _uid("t"),
        "cardId": None,
        "name": name,
        "faction": faction,
        "cardType": "Entity",
        "cost": 0,
        "power": power,
        "health": health,
        "curHealth": health,
        "description": "Token.",
        "keywords": keywords or [],
        "rarity": "Common",
        "image_url": None,
        "collector_number": None,
        "exhausted": False,
        "token": True,
    }


def draw_cards(state, slot, n):
    pl = state["players"][slot]
    for _ in range(n):
        if pl["library"]:
            pl["hand"].append(pl["library"].pop(0))
        else:
            pl["hp"] -= 1


def parse_buff(desc):
    m = _re.search(r"([+-]\s*\d+)\s*/\s*([+-]\s*\d+)", desc)
    if not m:
        return (0, 0)
    return (int(m.group(1).replace(" ", "")), int(m.group(2).replace(" ", "")))


def enemy_entities(state, slot):
    return state["players"][opp(slot)]["battlefield"]


def strongest(entities):
    live = [e for e in entities if (e.get("power") or 0) >= 0]
    return max(live, key=lambda e: (e.get("power") or 0)) if live else None


def deal_damage_entity(entity, amount):
    entity["curHealth"] = (entity["curHealth"] or 0) - amount


def create_tokens(state, slot, desc):
    """Handle 'create [N] X/Y ... token[s] [with KW]'."""
    msgs = []
    for m in _re.finditer(r"create\s+(a|an|one|two|three|\d+)?\s*(\d+)\s*/\s*(\d+)\s+([A-Za-z ]+?)\s+tokens?(\s+with\s+([A-Za-z, ]+))?", desc, _re.I):
        n = _num(m.group(1) or "a") or 1
        p, h = int(m.group(2)), int(m.group(3))
        tname = m.group(4).strip().title()
        kws = []
        if m.group(6):
            kws = [k.strip().title() for k in m.group(6).split(",") if k.strip().title() in GRANT_KEYWORDS]
        fac = state["players"][slot]["hand"] and state["players"][slot] or None
        faction = "Aether"
        for _ in range(n):
            state["players"][slot]["battlefield"].append(make_token(tname, faction, p, h, kws))
        msgs.append(f"created {n} {p}/{h} {tname} token(s)")
    return msgs


def resolve_effect(state, slot, card, payload, auto=False):
    """Apply the parseable parts of a card's oracle text. Returns list of log fragments."""
    desc = card.get("description") or ""
    low = desc.lower()
    who = state["players"][slot]["username"]
    frags = []
    tgt_type = payload.get("targetType")
    tgt_id = payload.get("targetId")
    tgt_slot = str(payload.get("targetSlot")) if payload.get("targetSlot") else opp(slot)

    def resolve_target_entity():
        if tgt_id:
            for s in ("1", "2"):
                for e in state["players"][s]["battlefield"]:
                    if e["instanceId"] == tgt_id:
                        return s, e
        if auto:  # deploy effect with no explicit target -> hit strongest enemy
            e = strongest(enemy_entities(state, slot))
            if e:
                return opp(slot), e
        return None, None

    # ---- damage ----
    dm = _re.search(r"deal\s+(\d+)\s+damage", low)
    if "damage to all opposing entit" in low or "damage to all opposing" in low:
        amt = int(dm.group(1)) if dm else 2
        for e in list(enemy_entities(state, slot)):
            deal_damage_entity(e, amt)
        frags.append(f"dealt {amt} to all enemy Entities")
    elif "damage to all non-terra" in low:
        amt = int(dm.group(1)) if dm else 3
        for s in ("1", "2"):
            for e in list(state["players"][s]["battlefield"]):
                if e["faction"] != "Terra":
                    deal_damage_entity(e, amt)
        frags.append(f"dealt {amt} to all non-Terra Entities")
    elif dm or "deal damage" in low:
        if dm:
            amt = int(dm.group(1))
        elif "equal to cards in your hand" in low:
            amt = len(state["players"][slot]["hand"])
        else:
            amt = 2
        if ("nexus" in low or "vanguard" in low) and "to target entity" not in low and tgt_type != "entity":
            state["players"][tgt_slot]["hp"] -= amt
            frags.append(f"dealt {amt} to {state['players'][tgt_slot]['username']}'s Nexus")
        else:
            ts, te = resolve_target_entity()
            if te:
                deal_damage_entity(te, amt)
                frags.append(f"dealt {amt} to {te['name']}")
            elif tgt_type == "vanguard":
                state["players"][tgt_slot]["hp"] -= amt
                frags.append(f"dealt {amt} to a Nexus")
            elif auto:
                state["players"][opp(slot)]["hp"] -= amt
                frags.append(f"dealt {amt} to enemy Nexus")

    # ---- destroy ----
    if "destroy target" in low or "destroy all entities" in low:
        if "destroy all entities with power" in low:
            mp = _re.search(r"power\s+(\d+)\s+or\s+greater", low)
            thr = int(mp.group(1)) if mp else 4
            for s in ("1", "2"):
                for e in list(state["players"][s]["battlefield"]):
                    if (e.get("power") or 0) >= thr:
                        e["curHealth"] = 0
            frags.append("destroyed high-power Entities")
        else:
            ts, te = resolve_target_entity()
            if te:
                te["curHealth"] = 0
                frags.append(f"destroyed {te['name']}")

    # ---- bounce (return to hand) ----
    if "return target entity to its owner" in low or ("return target" in low and "to its owner" in low and "hand" in low):
        ts, te = resolve_target_entity()
        if te:
            state["players"][ts]["battlefield"].remove(te)
            state["players"][ts]["hand"].append(te)
            frags.append(f"returned {te['name']} to hand")

    # ---- exhaust ----
    if "exhaust target" in low or "exhaust two target" in low:
        n = 2 if "two target" in low else 1
        if tgt_id:
            ts, te = resolve_target_entity()
            if te:
                te["exhausted"] = True
                frags.append(f"exhausted {te['name']}")
        elif auto:
            for e in sorted(enemy_entities(state, slot), key=lambda x: -(x.get("power") or 0))[:n]:
                e["exhausted"] = True
            if enemy_entities(state, slot):
                frags.append("exhausted enemy Entities")

    # ---- buffs on target ----
    dp, dh = parse_buff(desc)
    if (dp or dh) and ("target entity" in low or "attached entity" not in low):
        ts, te = resolve_target_entity()
        if te:
            te["power"] = max(0, (te.get("power") or 0) + dp)
            te["health"] = (te.get("health") or 0) + dh
            te["curHealth"] = (te.get("curHealth") or 0) + dh
            for kw in GRANT_KEYWORDS:
                if kw.lower() in low and kw not in te["keywords"]:
                    te["keywords"].append(kw)
            frags.append(f"buffed {te['name']} ({dp:+}/{dh:+})")

    # ---- heal nexus ----
    hm = _re.search(r"heal your nexus\s+(\d+)", low)
    if hm:
        amt = int(hm.group(1))
        state["players"][slot]["hp"] = min(VANGUARD_HP, state["players"][slot]["hp"] + amt)
        frags.append(f"healed Nexus {amt}")

    # ---- draw ----
    drm = _re.search(r"draw\s+(a|an|one|two|three|\d+)\s+cards?", low)
    if drm:
        n = _num(drm.group(1))
        draw_cards(state, slot, n)
        frags.append(f"drew {n}")

    # ---- tokens ----
    frags += create_tokens(state, slot, desc)

    return frags


def check_win(state):
    p1 = state["players"]["1"]
    p2 = state["players"]["2"]
    if p1["hp"] <= 0 and p2["hp"] <= 0:
        state["phase"] = "ENDED"
        state["winner"] = 0
    elif p2["hp"] <= 0:
        state["phase"] = "ENDED"
        state["winner"] = 1
        log(state, f"{p1['username']} wins the match!")
    elif p1["hp"] <= 0:
        state["phase"] = "ENDED"
        state["winner"] = 2
        log(state, f"{p2['username']} wins the match!")


def apply_death_trigger(state, slot, entity):
    low = (entity.get("description") or "").lower()
    if "destroyed" not in low:
        return
    frags = []
    # deal damage to enemy nexus
    dm = _re.search(r"deal\s+(\d+)\s+damage to the enemy nexus", low)
    if dm:
        state["players"][opp(slot)]["hp"] -= int(dm.group(1))
        frags.append(f"deals {dm.group(1)} to enemy Nexus")
    # create token
    tm = _re.search(r"create\s+a\s+(\d+)\s*/\s*(\d+)\s+([A-Za-z ]+?)\s+token", low)
    if tm:
        state["players"][slot]["battlefield"].append(
            make_token(tm.group(3).strip().title(), entity["faction"], int(tm.group(1)), int(tm.group(2)))
        )
        frags.append("spawns a token")
    # draw
    if "draw a card" in low:
        draw_cards(state, slot, 1)
        frags.append("draws a card")
    # opponent discards at random
    if "discard" in low and "opponent" in low:
        oh = state["players"][opp(slot)]["hand"]
        if oh:
            state["players"][opp(slot)]["void"].append(oh.pop(random.randrange(len(oh))))
            frags.append("forces a discard")
    if frags:
        log(state, f"{entity['name']}'s death: {', '.join(frags)}.")


def cleanup_dead(state):
    for slot in ("1", "2"):
        pl = state["players"][slot]
        alive = []
        dead = []
        for e in pl["battlefield"]:
            if e["curHealth"] is not None and e["curHealth"] <= 0:
                dead.append(e)
            else:
                alive.append(e)
        pl["battlefield"] = alive
        for e in dead:
            log(state, f"{e['name']} was destroyed.")
            pl["void"].append(e)
            apply_death_trigger(state, slot, e)


# ---------- action handlers ----------

class ActionError(Exception):
    pass


def start_turn(state, slot):
    pl = state["players"][slot]
    pl["energy"] = pl["maxEnergy"]
    pl["hasDrawnThisTurn"] = False
    pl["hasResonatedThisTurn"] = False
    for e in pl["battlefield"]:
        e["exhausted"] = False


def do_draw(state, slot):
    pl = state["players"][slot]
    if pl["hasDrawnThisTurn"]:
        raise ActionError("You have already drawn a card this turn.")
    if not pl["library"]:
        # fatigue: lose 1 hp
        pl["hp"] -= 1
        log(state, f"{pl['username']} has no cards left and takes 1 fatigue damage.")
        pl["hasDrawnThisTurn"] = True
        check_win(state)
        return
    card = pl["library"].pop(0)
    pl["hand"].append(card)
    pl["hasDrawnThisTurn"] = True
    log(state, f"{pl['username']} drew a card.")


def do_play_card(state, slot, payload):
    """PLAY_CARD -> destination 'battlefield' (Entity/Relic) or 'resonance'."""
    pl = state["players"][slot]
    dest = payload.get("destination", "battlefield")
    idx, card = find_in(pl["hand"], payload.get("instanceId"))
    if card is None:
        raise ActionError("Card not found in hand.")

    if dest == "resonance":
        if pl["hasResonatedThisTurn"]:
            raise ActionError("You already played a Resonance Node this turn.")
        if pl["maxEnergy"] >= MAX_ENERGY:
            raise ActionError("Maximum Energy reached.")
        pl["hand"].pop(idx)
        pl["resonanceRow"].append(card)
        pl["maxEnergy"] += 1
        pl["energy"] += 1
        pl["hasResonatedThisTurn"] = True
        log(state, f"{pl['username']} charged a Resonance Node (Energy {pl['energy']}/{pl['maxEnergy']}).")
        return

    # to battlefield: Entity or Relic
    if card["cardType"] not in ("Entity", "Relic"):
        raise ActionError(f"{card['cardType']} cards cannot be placed on the battlefield. Cast them instead.")
    if card["cost"] > pl["energy"]:
        raise ActionError("Not enough Energy.")
    pl["hand"].pop(idx)
    pl["energy"] -= card["cost"]
    if card["cardType"] == "Relic":
        low = (card.get("description") or "").lower()
        if "attached entity" in low:
            targets = [e for e in pl["battlefield"] if e.get("power") is not None]
            if not targets:
                # refund and reject
                pl["energy"] += card["cost"]
                pl["hand"].insert(idx, card)
                raise ActionError("Deploy an Entity first — this Relic attaches to one of your Entities.")
            tgt = strongest(targets) or targets[0]
            dp, dh = parse_buff(card.get("description") or "")
            tgt["power"] = max(0, (tgt.get("power") or 0) + dp)
            tgt["health"] = (tgt.get("health") or 0) + dh
            tgt["curHealth"] = (tgt.get("curHealth") or 0) + dh
            granted = []
            for kw in GRANT_KEYWORDS:
                if kw.lower() in low and kw not in tgt["keywords"]:
                    tgt["keywords"].append(kw)
                    granted.append(kw)
            card["attachedTo"] = tgt["instanceId"]
            tgt.setdefault("attachments", []).append(card["name"])
            pl["relics"].append(card)
            extra = f" granting {', '.join(granted)}" if granted else ""
            log(state, f"{pl['username']} attached {card['name']} to {tgt['name']} ({dp:+}/{dh:+}){extra}.")
        else:
            pl["relics"].append(card)
            log(state, f"{pl['username']} deployed Relic {card['name']}.")
            frags = resolve_effect(state, slot, card, payload, auto=True)
            if frags:
                log(state, f"{card['name']}: {', '.join(frags)}.")
    else:
        card["exhausted"] = False  # no summoning sickness
        pl["battlefield"].append(card)
        log(state, f"{pl['username']} deployed {card['name']}.")
        low = (card.get("description") or "").lower()
        if "when deployed" in low or "when this entity is deployed" in low:
            frags = resolve_effect(state, slot, card, payload, auto=True)
            if frags:
                log(state, f"{card['name']}: {', '.join(frags)}.")
    cleanup_dead(state)
    check_win(state)


def do_cast_spell(state, slot, payload):
    pl = state["players"][slot]
    idx, card = find_in(pl["hand"], payload.get("instanceId"))
    if card is None:
        raise ActionError("Spell not found in hand.")
    if card["cardType"] not in ("Rite", "Flash"):
        raise ActionError("That card is not a spell.")
    if card["cardType"] == "Rite" and str(state["activePlayer"]) != str(slot):
        raise ActionError("Rite (slow) spells can only be cast on your own turn.")
    if card["cost"] > pl["energy"]:
        raise ActionError("Not enough Energy.")

    # block targeting Stealth entities
    if payload.get("targetType") == "entity" and payload.get("targetId"):
        for e in enemy_entities(state, slot):
            if e["instanceId"] == payload["targetId"] and "Stealth" in e["keywords"]:
                raise ActionError("Stealth entities cannot be targeted.")

    pl["energy"] -= card["cost"]
    pl["hand"].pop(idx)

    frags = resolve_effect(state, slot, card, payload, auto=False)
    if frags:
        log(state, f"{pl['username']} cast {card['name']}: {', '.join(frags)}.")
    else:
        log(state, f"{pl['username']} cast {card['name']}. ({card['description']})")

    pl["void"].append(card)
    cleanup_dead(state)
    check_win(state)


def do_attack_entity(state, slot, payload):
    pl = state["players"][slot]
    dslot = opp(slot)
    dp = state["players"][dslot]
    ai, atk = find_in(pl["battlefield"], payload.get("attackerId"))
    ti, tgt = find_in(dp["battlefield"], payload.get("targetId"))
    if atk is None:
        raise ActionError("Attacker not found.")
    if tgt is None:
        raise ActionError("Target not found.")
    if atk["exhausted"]:
        raise ActionError("That entity is exhausted and cannot attack.")
    if "Stealth" in tgt["keywords"]:
        raise ActionError("Stealth entities cannot be targeted.")
    if has_guard(dp) and "Guard" not in tgt["keywords"] and "Evasive" not in atk["keywords"]:
        raise ActionError("You must attack a Guard entity first.")

    atk_pow = atk["power"] or 0
    tgt_pow = tgt["power"] or 0

    # attacker hits target
    if "Lethal" in atk["keywords"] and atk_pow > 0:
        overflow = 0
        if "Overwhelm" in atk["keywords"] and "Guard" in tgt["keywords"]:
            overflow = max(0, atk_pow - (tgt["curHealth"] or 0))
        tgt["curHealth"] = 0
    else:
        before = tgt["curHealth"] or 0
        tgt["curHealth"] = before - atk_pow
        overflow = 0
        if "Overwhelm" in atk["keywords"] and "Guard" in tgt["keywords"] and atk_pow > before:
            overflow = atk_pow - before
    if overflow > 0:
        dp["hp"] -= overflow
        log(state, f"{atk['name']} overwhelms for {overflow} spill damage to {dp['username']}'s Vanguard.")

    # target strikes back
    if tgt_pow > 0:
        if "Lethal" in tgt["keywords"]:
            atk["curHealth"] = 0
        else:
            atk["curHealth"] = (atk["curHealth"] or 0) - tgt_pow

    atk["exhausted"] = True
    if "Stealth" in atk["keywords"]:
        atk["keywords"].remove("Stealth")
    log(state, f"{atk['name']} clashed with {tgt['name']}.")
    cleanup_dead(state)
    check_win(state)


def do_attack_vanguard(state, slot, payload):
    pl = state["players"][slot]
    dslot = opp(slot)
    dp = state["players"][dslot]
    ai, atk = find_in(pl["battlefield"], payload.get("attackerId"))
    if atk is None:
        raise ActionError("Attacker not found.")
    if atk["exhausted"]:
        raise ActionError("That entity is exhausted and cannot attack.")
    if has_guard(dp) and "Evasive" not in atk["keywords"]:
        raise ActionError("A Guard blocks the way — attack the Guard first.")
    dmg = atk["power"] or 0
    dp["hp"] -= dmg
    atk["exhausted"] = True
    if "Stealth" in atk["keywords"]:
        atk["keywords"].remove("Stealth")
    log(state, f"{atk['name']} struck {dp['username']}'s Vanguard for {dmg}.")
    check_win(state)


def do_end_turn(state, slot):
    nxt = opp(slot)
    state["activePlayer"] = int(nxt)
    state["turn"] += 1
    start_turn(state, nxt)
    log(state, f"{state['players'][nxt]['username']}'s turn {state['turn']}.")


# ---------- simple AI ----------

def ai_take_turn(state):
    slot = "2"
    ai = state["players"][slot]
    # draw
    if not ai["hasDrawnThisTurn"]:
        do_draw(state, slot)
    if state["phase"] == "ENDED":
        return
    # play a resonance node using the highest-cost card (least useful early)
    if not ai["hasResonatedThisTurn"] and ai["hand"] and ai["maxEnergy"] < MAX_ENERGY:
        node = max(ai["hand"], key=lambda c: c["cost"])
        do_play_card(state, slot, {"instanceId": node["instanceId"], "destination": "resonance"})
    # deploy entities/relics while affordable (highest cost first)
    skip = set()
    while True:
        playable = [c for c in ai["hand"] if c["cardType"] in ("Entity", "Relic") and c["cost"] <= ai["energy"] and c["instanceId"] not in skip]
        if not playable:
            break
        pick = max(playable, key=lambda c: c["cost"])
        try:
            do_play_card(state, slot, {"instanceId": pick["instanceId"], "destination": "battlefield"})
        except ActionError:
            skip.add(pick["instanceId"])
        if state["phase"] == "ENDED":
            return
    # cast a damaging spell at the enemy vanguard if affordable
    for c in list(ai["hand"]):
        if c["cardType"] in ("Rite", "Flash") and c["cost"] <= ai["energy"] and c["faction"] != "Terra":
            try:
                do_cast_spell(state, slot, {"instanceId": c["instanceId"], "targetType": "vanguard"})
            except ActionError:
                continue
            if state["phase"] == "ENDED":
                return
            break
    # attack
    enemy = state["players"]["1"]
    for e in list(ai["battlefield"]):
        if e["exhausted"] or not (e.get("power") or 0):
            continue
        if has_guard(enemy) and "Evasive" not in e["keywords"]:
            guards = [g for g in enemy["battlefield"] if "Guard" in g["keywords"] and "Stealth" not in g["keywords"]]
            if guards:
                do_attack_entity(state, slot, {"attackerId": e["instanceId"], "targetId": guards[0]["instanceId"]})
        else:
            do_attack_vanguard(state, slot, {"attackerId": e["instanceId"]})
        if state["phase"] == "ENDED":
            return
    do_end_turn(state, slot)


ACTION_MAP = {
    "DRAW_CARD": lambda s, slot, p: do_draw(s, slot),
    "PLAY_CARD": do_play_card,
    "CAST_SPELL": do_cast_spell,
    "ATTACK_ENTITY": do_attack_entity,
    "ATTACK_VANGUARD": do_attack_vanguard,
    "END_TURN": lambda s, slot, p: do_end_turn(s, slot),
}


def apply_action(state, slot, action_type, payload):
    """Validate turn ownership + dispatch. Returns new state."""
    slot = str(slot)
    if state["phase"] == "ENDED":
        raise ActionError("The match has ended.")
    if action_type not in ACTION_MAP:
        raise ActionError(f"Unknown action {action_type}.")

    # Flash spells may be cast off-turn; everything else requires it to be your turn.
    is_flash = False
    if action_type == "CAST_SPELL":
        _, c = find_in(state["players"][slot]["hand"], payload.get("instanceId"))
        is_flash = bool(c and c["cardType"] == "Flash")
    if not is_flash and str(state["activePlayer"]) != slot:
        raise ActionError("It is not your turn.")

    ACTION_MAP[action_type](state, slot, payload or {})

    # If vs AI and the turn passed to the AI, let it play immediately.
    if state.get("isAI") and state["phase"] != "ENDED" and str(state["activePlayer"]) == "2":
        ai_take_turn(state)
    return state
