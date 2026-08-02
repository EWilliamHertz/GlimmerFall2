"""GlimmerFall TCG — server-authoritative game engine.

All mutating logic lives here. The FastAPI layer only loads/saves the match
`state` JSONB and delegates to `apply_action`. Turn limits are enforced here so
they cannot be bypassed by a client refresh.
"""
import random
import uuid
from copy import deepcopy

NEXUS_HP = 25
HAND_START = 5
DECK_SIZE = 40
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


def build_deck(pool, faction=None, card_ids=None):
    """Build a legal 30-card deck (max 3 copies of a card)."""
    import random
    if card_ids:
        card_map = {c["id"]: c for c in pool}
        bag = [card_map[cid] for cid in card_ids if cid in card_map]
        random.shuffle(bag)
        return [make_instance(c) for c in bag]
    if faction:
        factions = [f.strip() for f in faction.split(",")]
        cards = [c for c in pool if c["faction"] in factions]
    else:
        cards = list(pool)
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
        "hp": NEXUS_HP,
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
    # If playing against AI, we just skip the dice roll to keep it simple, or auto-roll it.
    # Let's set phase to DICE_ROLL.
    state = {
        "players": {"1": new_player(p1_name, deck1), "2": new_player(p2_name, deck2)},
        "turn": 1,
        "activePlayer": 1,
        "phase": "DICE_ROLL",
        "diceRolls": {"1": None, "2": None},
        "winner": None,
        "isAI": is_ai,
        "log": [f"Match begins! {p1_name} vs {p2_name}."],
    }
    
    if is_ai:
        # Auto-roll for both
        import random
        r1, r2 = random.randint(1, 6), random.randint(1, 6)
        while r1 == r2:
            r1, r2 = random.randint(1, 6), random.randint(1, 6)
        state["diceRolls"] = {"1": r1, "2": r2}
        state["log"].append(f"{p1_name} rolled a {r1}. GlimmerBot rolled a {r2}.")
        winner = 1 if r1 > r2 else 2
        state["activePlayer"] = winner
        state["phase"] = "PLAYING"
        state["log"].append(f"{p1_name if winner == 1 else p2_name} goes first!")
        state["log"].append(f"{p1_name if winner == 1 else p2_name}'s turn 1.")

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
    active = state.get("activePlayer", "0")
    state["log"].append(f"[P{active}] {msg}")


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



def apply_enters_trigger(state, slot, new_entity):
    for e in state["players"][slot]["battlefield"]:
        if e["instanceId"] == new_entity["instanceId"]:
            continue
        low = (e.get("description") or "").lower()
        if "whenever another" in low and "enters" in low:
            # check faction match
            m = re.search(r"whenever another\s+([a-z]+)\s+entity\s+enters", low)
            if m:
                req_faction = m.group(1).title()
                if new_entity.get("faction") != req_faction:
                    continue
            
            # extract the effect (everything after the comma)
            effect_part = low.split("enters,")[-1].strip() if "enters," in low else low
            
            # currently only handles "heal your nexus X"
            hm = re.search(r"heal your nexus\s+(\d+)", effect_part)
            if hm:
                amt = int(hm.group(1))
                state["players"][slot]["hp"] += amt
                log(state, f"{e['name']}'s passive triggered: healed Nexus {amt}")

def create_tokens(state, slot, desc):
    """Handle 'create [N] X/Y ... token[s] [with KW]'."""
    msgs = []
    for m in _re.finditer(r"create\s+(a|an|one|two|three|\d+)?\s*(\d+)\s*/\s*(\d+)\s+([A-Za-z ]+?)\s+tokens?(?:\s+with\s+([A-Za-z, \.]+))?", desc, _re.I):
        n = _num(m.group(1) or "a") or 1
        p, h = int(m.group(2)), int(m.group(3))
        tname = m.group(4).strip().title()
        kws = []
        if m.group(5):
            kws = [k.strip(".").strip().title() for k in m.group(5).split(",") if k.strip(".").strip().title() in GRANT_KEYWORDS]
        fac = state["players"][slot]["hand"] and state["players"][slot] or None
        faction = "Unknown"
        for f in ["Solari", "Terra", "Aether", "Mecha", "Graveglass", "Umbra"]:
            if f in tname:
                faction = f
                break
        if faction == "Unknown":
            faction = "Aether"
        for _ in range(n):
            new_token = make_token(tname, faction, p, h, kws)
            state["players"][slot]["battlefield"].append(new_token)
            apply_enters_trigger(state, slot, new_token)
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
        if ("nexus" in low or "nexus" in low) and "to target entity" not in low and tgt_type != "entity":
            state["players"][tgt_slot]["hp"] -= amt
            frags.append(f"dealt {amt} to {state['players'][tgt_slot]['username']}'s Nexus")
        else:
            ts, te = resolve_target_entity()
            if te:
                deal_damage_entity(te, amt)
                frags.append(f"dealt {amt} to {te['name']}")
            elif tgt_type == "nexus":
                state["players"][tgt_slot]["hp"] -= amt
                frags.append(f"dealt {amt} to a Nexus")
            elif auto:
                state["players"][opp(slot)]["hp"] -= amt
                frags.append(f"dealt {amt} to enemy Nexus")

    # ---- exile ----
    if "exile target" in low:
        ts, te = resolve_target_entity()
        if te:
            state["players"][ts]["battlefield"].remove(te)
            state["players"][ts]["void"].append(te)
            frags.append(f"exiled {te['name']}")

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

    # ---- sacrifice ----
    if "sacrifices an entity with the lowest power" in low:
        target = opp(slot)
        entities = state["players"][target]["battlefield"]
        if entities:
            lowest = min(entities, key=lambda x: x.get("power") or 0)
            lowest["curHealth"] = 0
            frags.append(f"forced {state['players'][target]['username']} to sacrifice {lowest['name']}")

    if "each player sacrifices two entities" in low:
        for s in ("1", "2"):
            pl_entities = state["players"][s]["battlefield"]
            if pl_entities:
                # Sacrifice lowest power first
                pl_entities.sort(key=lambda x: x.get("power") or 0)
                sacrificed = []
                for e in pl_entities[:2]:
                    e["curHealth"] = 0
                    sacrificed.append(e["name"])
                if sacrificed:
                    frags.append(f"{state['players'][s]['username']} sacrificed {', '.join(sacrificed)}")

    # ---- bounce (return to hand) ----
    if "return target entity to its owner" in low or ("return target" in low and "to its owner" in low and "hand" in low):
        ts, te = resolve_target_entity()
        if te:
            state["players"][ts]["battlefield"].remove(te)
            state["players"][ts]["hand"].append(te)
            frags.append(f"returned {te['name']} to hand")

    if "from your void to your hand" in low:
        # e.g., "return target entity with cost 2 or less from your void to your hand"
        cost_limit = 99
        cm = _re.search(r"cost\s+(\d+)\s+or\s+less", low)
        if cm:
            cost_limit = int(cm.group(1))
            
        valid_cards = [c for c in state["players"][slot]["void"] if c.get("cardType") == "Entity" and c.get("cost", 0) <= cost_limit]
        if valid_cards:
            best_card = max(valid_cards, key=lambda c: (c.get("cost", 0), c.get("power", 0) or 0))
            state["players"][slot]["void"].remove(best_card)
            state["players"][slot]["hand"].append(best_card)
            frags.append(f"returned {best_card['name']} from the Void to hand")

    # ---- exhaust ----
    if "exhaust target" in low or "exhaust two target" in low or "exhaust it" in low:
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
            granted = []
            for kw in GRANT_KEYWORDS:
                if kw.lower() in low and kw not in te["keywords"]:
                    te["keywords"].append(kw)
                    granted.append(kw)
            
            if "until end phase" in low:
                te.setdefault("tempBuffs", []).append({
                    "power": dp,
                    "health": dh,
                    "keywords": granted
                })
                
            verb = "buffed" if (dp > 0 or dh > 0) else "targeted"
            frags.append(f"{verb} {te['name']} ({dp:+}/{dh:+})")

    # ---- heal nexus ----
    hm = _re.search(r"heal your nexus\s+(\d+)", low)
    if hm:
        amt = int(hm.group(1))
        state["players"][slot]["hp"] += amt
        frags.append(f"healed Nexus {amt}")

    # ---- draw ----
    drm = _re.search(r"draw\s+(a|an|one|two|three|\d+)\s+cards?", low)
    if drm:
        n = _num(drm.group(1))
        draw_cards(state, slot, n)
        frags.append(f"drew {n}")

    # ---- tokens ----
    frags += create_tokens(state, slot, desc)

    # ---- resonance / glimmer nodes ----
    if "put the top card of your deck face-down into your resonance row" in low:
        if state["players"][slot]["library"]:
            c = state["players"][slot]["library"].pop(0)
            state["players"][slot]["resonanceRow"].append(c)
            state["players"][slot]["maxEnergy"] += 1
            state["players"][slot]["energy"] += 1
            frags.append("added a Glimmer Node from deck")

    # ---- look at top card / scry ----
    if "look at the top card of your deck" in low:
        if state["players"][slot]["library"]:
            top_card = state["players"][slot]["library"].pop(0)
            if state.get("isAI") and slot == "2":
                if top_card.get("cost", 0) > state["players"][slot]["maxEnergy"] + 1:
                    state["players"][slot]["library"].append(top_card)
                    frags.append(f"looked at the top card and put {top_card['name']} on the bottom")
                else:
                    state["players"][slot]["library"].insert(0, top_card)
                    frags.append(f"looked at the top card and left {top_card['name']} on top")
            else:
                state["pendingChoice"] = {
                    "player": slot,
                    "prompt": f"Looked at top card: {top_card['name']} (Cost {top_card.get('cost', 0)})",
                    "type": "scry_1",
                    "options": [
                        {"text": f"Leave {top_card['name']} on Top", "payload": {"card": top_card, "action": "top"}},
                        {"text": f"Put {top_card['name']} on Bottom", "payload": {"card": top_card, "action": "bottom"}}
                    ]
                }
                return frags

    if "look at the top two cards of your deck" in low and "void" in low:
        library = state["players"][slot]["library"]
        if len(library) >= 2:
            c1 = library.pop(0)
            c2 = library.pop(0)
            
            if state.get("isAI") and slot == "2":
                energy = state["players"][slot]["maxEnergy"]
                def score(c):
                    cost = c.get("cost", 0)
                    if cost <= energy + 1:
                        return cost + (c.get("power") or 0) * 0.1
                    return -cost
                
                if score(c1) >= score(c2):
                    keep, dump = c1, c2
                else:
                    keep, dump = c2, c1
                    
                library.insert(0, keep)
                state["players"][slot]["void"].append(dump)
                frags.append(f"put {dump['name']} into the Void and left {keep['name']} on top of deck")
            else:
                state["pendingChoice"] = {
                    "player": slot,
                    "prompt": "Choose a card to put into the Void",
                    "options": [
                        {"text": f"Void {c1['name']}, Keep {c2['name']}", "payload": {"void": c1, "keep": c2}},
                        {"text": f"Void {c2['name']}, Keep {c1['name']}", "payload": {"void": c2, "keep": c1}}
                    ]
                }
                return frags # Stop resolving and wait for choice
        elif len(library) == 1:
            dump = library.pop(0)
            state["players"][slot]["void"].append(dump)
            frags.append(f"put {dump['name']} into the Void")
    if "look at the top three cards of your deck" in low and "hand" in low and "bottom" in low:
        library = state["players"][slot]["library"]
        if library:
            n = min(3, len(library))
            cards = [library.pop(0) for _ in range(n)]
            if state.get("isAI") and slot == "2":
                energy = state["players"][slot]["maxEnergy"]
                def score(c):
                    cost = c.get("cost", 0)
                    if cost <= energy + 1:
                        return cost + (c.get("power") or 0) * 0.1
                    return -cost
                    
                cards.sort(key=score, reverse=True)
                keep = cards[0]
                rest = cards[1:]
                
                state["players"][slot]["hand"].append(keep)
                library.extend(rest)
                frags.append(f"looked at the top {n} cards, put {keep['name']} in hand, and put the rest on the bottom")
            else:
                state["pendingChoice"] = {
                    "player": slot,
                    "prompt": f"Choose a card to put in your hand",
                    "type": "scry_3",
                    "options": [
                        {"text": f"Take {c['name']}", "payload": {"keep": c, "rest": [x for x in cards if x["instanceId"] != c["instanceId"]]}} for c in cards
                    ]
                }
                return frags

    if "look at your opponent" in low and "hand" in low and "discard" in low:
        enemy_slot = opp(slot)
        enemy_hand = state["players"][enemy_slot]["hand"]
        if enemy_hand:
            if state.get("isAI") and slot == "2":
                spells = [c for c in enemy_hand if c.get("cardType", "").lower() in ("rite", "flash")]
                if "spell" in low and spells:
                    spells.sort(key=lambda c: c.get("cost", 0), reverse=True)
                    dump = spells[0]
                    enemy_hand.remove(dump)
                    state["players"][enemy_slot]["void"].append(dump)
                    frags.append(f"looked at {state['players'][enemy_slot]['username']}'s hand and forced them to discard {dump['name']}")
                elif "spell" in low and not spells:
                    frags.append(f"looked at {state['players'][enemy_slot]['username']}'s hand but found no Spells")
                else:
                    enemy_hand.sort(key=lambda c: c.get("cost", 0), reverse=True)
                    dump = enemy_hand[0]
                    enemy_hand.remove(dump)
                    state["players"][enemy_slot]["void"].append(dump)
                    frags.append(f"looked at {state['players'][enemy_slot]['username']}'s hand and forced them to discard {dump['name']}")
            else:
                valid_targets = [c for c in enemy_hand if (c.get("cardType", "").lower() in ("rite", "flash")) or "spell" not in low]
                if not valid_targets:
                    frags.append(f"looked at {state['players'][enemy_slot]['username']}'s hand but found no valid cards to discard")
                else:
                    state["pendingChoice"] = {
                        "player": slot,
                        "prompt": f"Choose a card from {state['players'][enemy_slot]['username']}'s hand to discard",
                        "type": "discard",
                        "options": [
                            {"text": f"Discard {c['name']} ({c['cardType']}, Cost {c['cost']})", "payload": {"dump": c}} for c in valid_targets
                        ]
                    }
                    return frags

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
    pl["spellsCastThisTurn"] = 0
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
    pl["energy"] -= card["cost"]
    pl["hand"].pop(idx)
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
        apply_enters_trigger(state, slot, card)
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
    cost = card["cost"]
    
    # Voltage Savant cost reduction
    has_voltage = any(e["name"] == "Voltage Savant" for e in pl.get("battlefield", []))
    if has_voltage and pl.get("spellsCastThisTurn", 0) == 0:
        cost = max(0, cost - 1)
        
    if cost > pl["energy"]:
        raise ActionError("Not enough Energy.")
        
    pl["spellsCastThisTurn"] = pl.get("spellsCastThisTurn", 0) + 1
    pl["energy"] -= cost

    if payload.get("targetType") == "entity" and payload.get("targetId"):
        for e in enemy_entities(state, slot):
            if e["instanceId"] == payload["targetId"] and "Stealth" in e["keywords"]:
                if "target" in (card.get("description") or "").lower():
                    raise ActionError("Stealth entities cannot be targeted.")

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

    desc_tgt = (tgt.get("description") or "").lower()
    if "whenever this entity is attacked, deal 1 damage to the attacker" in desc_tgt:
        atk["curHealth"] = (atk["curHealth"] or 0) - 1
        log(state, f"{tgt['name']} dealt 1 damage to attacking {atk['name']}.")

    # attacker hits target
    if "Lethal" in atk["keywords"] and atk_pow > 0:
        overflow = 0
        if "Overwhelm" in atk["keywords"]:
            overflow = max(0, atk_pow - (tgt["curHealth"] or 0))
        tgt["curHealth"] = 0
    else:
        before = tgt["curHealth"] or 0
        tgt["curHealth"] = before - atk_pow
        overflow = 0
        if "Overwhelm" in atk["keywords"] and atk_pow > before:
            overflow = atk_pow - before
    if overflow > 0:
        dp["hp"] -= overflow
        log(state, f"{atk['name']} overwhelms for {overflow} spill damage to {dp['username']}'s Nexus.")
        trigger_nexus_damage(state, slot, atk, dp)

    # generic combat damage triggers
    desc_atk = (atk.get("description") or "").lower()
    if atk_pow > 0:
        if "deals damage," in desc_atk and "create" in desc_atk:
            tfrags = create_tokens(state, slot, desc_atk)
            if tfrags:
                log(state, f"{atk['name']} dealt damage and {', '.join(tfrags)}.")

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


def do_attack_nexus(state, slot, payload):
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
    log(state, f"{atk['name']} struck {dp['username']}'s Nexus for {dmg}.")

    trigger_nexus_damage(state, slot, atk, dp)
        
    check_win(state)

def trigger_nexus_damage(state, slot, atk, dp):
    pl = state["players"][slot]
    active_descs = [(atk.get("description") or "").lower()]
    for r in pl.get("relics", []):
        if r.get("attachedTo") == atk["instanceId"]:
            active_descs.append((r.get("description") or "").lower())
            
    for desc_low in active_descs:
        if "ready one glimmer node" in desc_low:
            pl["energy"] = min(pl["maxEnergy"], pl["energy"] + 1)
            log(state, f"{atk['name']} readied a Glimmer Node (+1 Energy).")
        
        if "reveals their hand" in desc_low:
            for c in dp["hand"]:
                c["revealed"] = True
            log(state, f"{dp['username']}'s hand was revealed by {atk['name']}!")

        if ("deals damage to a nexus" in desc_low or "deals damage," in desc_low) and "create" in desc_low:
            tfrags = create_tokens(state, slot, desc_low)
            if tfrags:
                log(state, f"{atk['name']} {', '.join(tfrags)}.")
                
        if "that player discards a card" in desc_low:
            if dp["hand"]:
                discarded = random.choice(dp["hand"])
                dp["hand"].remove(discarded)
                dp["void"].append(discarded)
                log(state, f"{atk['name']} forced {dp['username']} to discard {discarded['name']}!")
                
        if "sacrifice borrowed face" in desc_low:
            bf = next((r for r in pl.get("relics", []) if r.get("attachedTo") == atk["instanceId"] and r["name"] == "Borrowed Face"), None)
            if bf:
                pl["relics"].remove(bf)
                pl["void"].append(bf)
                log(state, f"Borrowed Face was sacrificed after {atk['name']} struck the Nexus.")
                
        if "return target opposing relic" in desc_low:
            if dp.get("relics"):
                bounced = random.choice(dp["relics"])
                dp["relics"].remove(bounced)
                dp["hand"].append(bounced)
                log(state, f"{atk['name']} bounced {bounced['name']} to {dp['username']}'s hand!")


def do_end_turn(state, slot):
    nxt = opp(slot)
    state["activePlayer"] = int(nxt)
    state["turn"] += 1
    
    # clear temp buffs
    for s in ("1", "2"):
        for e in state["players"][s]["battlefield"]:
            if "tempBuffs" in e:
                for buff in e["tempBuffs"]:
                    e["power"] = max(0, (e.get("power") or 0) - buff.get("power", 0))
                    e["health"] = max(1, (e.get("health") or 1) - buff.get("health", 0))
                    e["curHealth"] = min(e.get("curHealth", 1), e.get("health", 1))
                    for kw in buff.get("keywords", []):
                        if kw in e["keywords"]:
                            e["keywords"].remove(kw)
                e["tempBuffs"] = []
                
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
    # cast a damaging spell at the enemy nexus if affordable
    for c in list(ai["hand"]):
        if c["cardType"] in ("Rite", "Flash") and c["cost"] <= ai["energy"] and c["faction"] != "Terra":
            try:
                do_cast_spell(state, slot, {"instanceId": c["instanceId"], "targetType": "nexus"})
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
            do_attack_nexus(state, slot, {"attackerId": e["instanceId"]})
        if state["phase"] == "ENDED":
            return
    do_end_turn(state, slot)


ACTION_MAP = {
    "DRAW_CARD": lambda s, slot, p: do_draw(s, slot),
    "PLAY_CARD": do_play_card,
    "CAST_SPELL": do_cast_spell,
    "ATTACK_ENTITY": do_attack_entity,
    "ATTACK_NEXUS": do_attack_nexus,
    "END_TURN": lambda s, slot, p: do_end_turn(s, slot),
}


def update_auras(state):
    # Clear all aura buffs
    for s in ("1", "2"):
        for e in state["players"][s]["battlefield"]:
            aura = e.get("aura_power", 0)
            if aura:
                e["power"] = max(0, (e.get("power") or 0) - aura)
                e["aura_power"] = 0
            
    # Apply new aura buffs
    for s in ("1", "2"):
        pl = state["players"][s]
        # Aurora Marshal aura only active during their turn
        if str(state.get("activePlayer")) != s:
            continue
            
        marshals = [e for e in pl["battlefield"] if e.get("name") == "Aurora Marshal" and (e.get("power") or 0) >= 0]
        for m in marshals:
            for e in pl["battlefield"]:
                if e.get("faction") == "Solari" and e["instanceId"] != m["instanceId"]:
                    e["aura_power"] = e.get("aura_power", 0) + 1
                    e["power"] = (e.get("power") or 0) + 1

def apply_action(state, slot, action_type, payload):
    """Validate turn ownership + dispatch. Returns new state."""
    slot = str(slot)

    if state.get("pendingChoice"):
        if state["pendingChoice"]["player"] != slot:
            raise ActionError("Waiting for opponent to make a choice.")
        if action_type != "MAKE_CHOICE":
            raise ActionError("You must make a choice first.")
        
        choice_type = state["pendingChoice"].get("type", "scry_2")
        state["pendingChoice"] = None
        
        if choice_type == "scry_2":
            keep = payload.get("keep")
            dump = payload.get("void")
            state["players"][slot]["library"].insert(0, keep)
            state["players"][slot]["void"].append(dump)
            log(state, f"{state['players'][slot]['username']} put {dump['name']} into the Void and left {keep['name']} on top of deck.")
        elif choice_type == "scry_3":
            keep = payload.get("keep")
            rest = payload.get("rest", [])
            state["players"][slot]["hand"].append(keep)
            state["players"][slot]["library"].extend(rest)
            log(state, f"{state['players'][slot]['username']} put {keep['name']} in hand and the rest on the bottom.")
        elif choice_type == "scry_1":
            action = payload.get("action")
            card = payload.get("card")
            if action == "top":
                state["players"][slot]["library"].insert(0, card)
                log(state, f"{state['players'][slot]['username']} left {card['name']} on top.")
            else:
                state["players"][slot]["library"].append(card)
                log(state, f"{state['players'][slot]['username']} put {card['name']} on the bottom.")
        elif choice_type == "discard":
            dump = payload.get("dump")
            enemy_slot = opp(slot)
            # find and remove from enemy hand
            idx, c = find_in(state["players"][enemy_slot]["hand"], dump["instanceId"])
            if c:
                state["players"][enemy_slot]["hand"].pop(idx)
                state["players"][enemy_slot]["void"].append(dump)
                log(state, f"{state['players'][slot]['username']} forced {state['players'][enemy_slot]['username']} to discard {dump['name']}.")
            else:
                log(state, f"{state['players'][slot]['username']} tried to discard {dump['name']} but it was no longer in hand.")
                
        cleanup_dead(state)
        check_win(state)
        update_auras(state)
        return state

    if state["phase"] == "ENDED":
        raise ActionError("The match has ended.")
        
    if action_type == "ROLL_DICE":
        if state.get("phase") != "DICE_ROLL":
            raise ActionError("Not in dice roll phase.")
        if state["diceRolls"].get(slot) is not None:
            raise ActionError("You already rolled.")
            
        import random
        roll = random.randint(1, 6)
        state["diceRolls"][slot] = roll
        log(state, f"{state['players'][slot]['username']} rolled a {roll}.")
        
        # Check if both rolled
        r1, r2 = state["diceRolls"]["1"], state["diceRolls"]["2"]
        if r1 is not None and r2 is not None:
            if r1 == r2:
                log(state, "It's a tie! Re-rolling...")
                state["diceRolls"] = {"1": None, "2": None}
            else:
                winner = "1" if r1 > r2 else "2"
                state["activePlayer"] = int(winner)
                state["phase"] = "PLAYING"
                log(state, f"{state['players'][winner]['username']} goes first!")
                log(state, f"{state['players'][winner]['username']}'s turn 1.")
        return state

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
    update_auras(state)
    return state
