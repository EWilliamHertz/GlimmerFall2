import re

with open('/home/ewilliamhe/GlimmerFall2/backend/game_engine.py', 'r') as f:
    content = f.read()

# 1. Add spellsCastThisTurn to start_turn
start_old = """    pl["hasDrawnThisTurn"] = False
    pl["hasResonatedThisTurn"] = False
    for e in pl["battlefield"]:"""
start_new = """    pl["hasDrawnThisTurn"] = False
    pl["hasResonatedThisTurn"] = False
    pl["spellsCastThisTurn"] = 0
    for e in pl["battlefield"]:"""
content = content.replace(start_old, start_new)

# 2. Fix do_cast_spell for Voltage Savant
cast_old = """    if card["cost"] > pl["energy"]:
        raise ActionError("Not enough Energy.")

    # block targeting Stealth entities"""
cast_new = """    cost = card["cost"]
    
    # Voltage Savant cost reduction
    has_voltage = any(e["name"] == "Voltage Savant" for e in pl.get("battlefield", []))
    if has_voltage and pl.get("spellsCastThisTurn", 0) == 0:
        cost = max(0, cost - 1)
        
    if cost > pl["energy"]:
        raise ActionError("Not enough Energy.")
        
    pl["spellsCastThisTurn"] = pl.get("spellsCastThisTurn", 0) + 1
    pl["energy"] -= cost

    # block targeting Stealth entities"""

content = re.sub(r'    if card\["cost"\] > pl\["energy"\]:\n        raise ActionError\("Not enough Energy\."\)\n\n    # block targeting Stealth entities', cast_new, content)

# Remove the line `pl["energy"] -= card["cost"]` from further down in do_cast_spell
content = content.replace('pl["hand"].pop(idx)\n    pl["energy"] -= card["cost"]', 'pl["hand"].pop(idx)')

with open('/home/ewilliamhe/GlimmerFall2/backend/game_engine.py', 'w') as f:
    f.write(content)
