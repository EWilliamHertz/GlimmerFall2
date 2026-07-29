from server import DB
with DB() as cur:
    cur.execute("SELECT id, name, faction, lore FROM cards")
    cards = cur.fetchall()
    no_lore = [c for c in cards if not c['lore'] or len(c['lore'].strip()) == 0]
    for c in no_lore[:10]:
        print(f"{c['faction']} - {c['name']}")
