import re

with open('/home/ewilliamhe/GlimmerFall2/backend/game_engine.py', 'r') as f:
    content = f.read()

# 1. Update apply_action to handle pendingChoice
apply_action_old = """def apply_action(state, slot, action_type, payload):
    slot = str(slot)"""
apply_action_new = """def apply_action(state, slot, action_type, payload):
    slot = str(slot)
    
    if state.get("pendingChoice"):
        if state["pendingChoice"]["player"] != slot:
            raise ActionError("Waiting for opponent to make a choice.")
        if action_type != "MAKE_CHOICE":
            raise ActionError("You must make a choice first.")
        
        # Apply scry choice
        keep = payload.get("keep")
        dump = payload.get("void")
        state["pendingChoice"] = None
        
        state["players"][slot]["library"].insert(0, keep)
        state["players"][slot]["void"].append(dump)
        log(state, f"{state['players'][slot]['username']} put {dump['name']} into the Void and left {keep['name']} on top of deck.")
        
        cleanup_dead(state)
        check_win(state)
        return
"""
content = content.replace(apply_action_old, apply_action_new)

# 2. Update resolve_effect for Refracted Fate
scry_old = """    if "look at the top two cards of your deck" in low and "void" in low:
        library = state["players"][slot]["library"]
        if len(library) >= 2:
            c1 = library.pop(0)
            c2 = library.pop(0)
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
        elif len(library) == 1:"""

scry_new = """    if "look at the top two cards of your deck" in low and "void" in low:
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
        elif len(library) == 1:"""

content = content.replace(scry_old, scry_new)

with open('/home/ewilliamhe/GlimmerFall2/backend/game_engine.py', 'w') as f:
    f.write(content)
