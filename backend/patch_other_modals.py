import re

with open('/home/ewilliamhe/GlimmerFall2/backend/game_engine.py', 'r') as f:
    content = f.read()

# 1. Scry 3 (look at top 3, hand, bottom)
scry3_old = """    if "look at the top three cards of your deck" in low and "hand" in low and "bottom" in low:
        library = state["players"][slot]["library"]
        if library:
            n = min(3, len(library))
            cards = [library.pop(0) for _ in range(n)]
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
            frags.append(f"looked at the top {n} cards, put {keep['name']} in hand, and put the rest on the bottom")"""

scry3_new = """    if "look at the top three cards of your deck" in low and "hand" in low and "bottom" in low:
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
                return frags"""
content = content.replace(scry3_old, scry3_new)

# 2. Opponent hand discard (Fading Memory)
discard_old = """    if "look at your opponent" in low and "hand" in low and "discard" in low:
        enemy_slot = opp(slot)
        enemy_hand = state["players"][enemy_slot]["hand"]
        if enemy_hand:
            spells = [c for c in enemy_hand if c.get("cardType", "").lower() == "spell"]
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
                frags.append(f"looked at {state['players'][enemy_slot]['username']}'s hand and forced them to discard {dump['name']}")"""

discard_new = """    if "look at your opponent" in low and "hand" in low and "discard" in low:
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
                    return frags"""
content = content.replace(discard_old, discard_new)

with open('/home/ewilliamhe/GlimmerFall2/backend/game_engine.py', 'w') as f:
    f.write(content)
