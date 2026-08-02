import re

with open('/home/ewilliamhe/GlimmerFall2/backend/game_engine.py', 'r') as f:
    content = f.read()

enters_func = """
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

def create_tokens(state, slot, desc):"""

content = content.replace("def create_tokens(state, slot, desc):", enters_func)

# Now inject it into create_tokens
token_inject = """        for _ in range(n):
            new_token = make_token(tname, faction, p, h, kws)
            state["players"][slot]["battlefield"].append(new_token)
            apply_enters_trigger(state, slot, new_token)
        msgs.append(f"created {n} {p}/{h} {tname} token(s)")"""
        
content = re.sub(r'        for _ in range\(n\):\n            state\["players"\]\[slot\]\["battlefield"\].append\(make_token\(tname, faction, p, h, kws\)\)\n        msgs.append\(f"created {n} {p}/{h} {tname} token\(s\)"\)', token_inject, content)

# Now inject it into do_play_card
play_inject = """        card["exhausted"] = False  # no summoning sickness
        pl["battlefield"].append(card)
        log(state, f"{pl['username']} deployed {card['name']}.")
        apply_enters_trigger(state, slot, card)
        low = (card.get("description") or "").lower()"""

content = content.replace("""        card["exhausted"] = False  # no summoning sickness
        pl["battlefield"].append(card)
        log(state, f"{pl['username']} deployed {card['name']}.")
        low = (card.get("description") or "").lower()""", play_inject)


with open('/home/ewilliamhe/GlimmerFall2/backend/game_engine.py', 'w') as f:
    f.write(content)

