import random
from server import DB

templates = {
    "Solari": [
        "The {} stands as a beacon of unwavering light against the encroaching shadow.",
        "Forged in the heart of the sun, {} cleanses the impure.",
        "None shall escape the radiant judgement of {}.",
        "A testament to the Decree of the Sun, {} brings order to chaos."
    ],
    "Umbri": [
        "In the whispers of the Void, {} finds a terrible power.",
        "The darkness conceals many secrets, but none as deadly as {}.",
        "To summon {} is to invite the shadows into your own soul.",
        "A manifestation of forbidden sacrifice, {} thrives on despair."
    ],
    "Terra": [
        "Rooted deep within the Nexus, {} commands the untamed forces of nature.",
        "As old as the soil and as fierce as the storm, {} awakens.",
        "The earth trembles when {} answers the call of the wild.",
        "A primal guardian born of stone and vine, {} protects the ancient balance."
    ],
    "Aether": [
        "Bending time and space, {} reshapes the very fabric of reality.",
        "The cosmic currents obey the will of {}.",
        "A marvel of arcane engineering, {} defies the laws of physics.",
        "Echoes of a fractured continuum whisper through {}."
    ]
}

with DB() as cur:
    cur.execute("SELECT id, name, faction, lore FROM cards")
    cards = cur.fetchall()
    
    updates = []
    for c in cards:
        if not c['lore'] or len(c['lore'].strip()) == 0:
            faction = c['faction']
            name = c['name']
            if faction in templates:
                lore = random.choice(templates[faction]).format(name)
                updates.append((lore, c['id']))
    
    for lore, cid in updates:
        cur.execute("UPDATE cards SET lore = %s WHERE id = %s", (lore, cid))
        
    print(f"Updated lore for {len(updates)} cards.")
