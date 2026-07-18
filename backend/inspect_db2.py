import psycopg2, json
DATABASE_URL = "postgresql://neondb_owner:npg_c8rRimgWC1OG@ep-round-lab-atbehctx-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
conn = psycopg2.connect(DATABASE_URL); cur = conn.cursor()

cur.execute("SELECT COUNT(*) FROM cards WHERE image_url IS NOT NULL AND image_url <> '' AND image_url <> 'None'")
print("cards with real image_url:", cur.fetchone()[0])
cur.execute("SELECT name, image_url FROM cards WHERE image_url IS NOT NULL LIMIT 8")
for r in cur.fetchall(): print(" ", r[0], "=>", (r[1] or "")[:90])

for col in ['faction','card_type','rarity']:
    cur.execute(f'SELECT {col}, COUNT(*) FROM cards GROUP BY {col} ORDER BY 2 DESC')
    print(col, ":", cur.fetchall())

cur.execute("SELECT keywords, COUNT(*) FROM cards GROUP BY keywords ORDER BY 2 DESC")
print("keywords:", cur.fetchall())

print("\n=== card_rarities ===")
cur.execute("SELECT * FROM card_rarities")
for r in cur.fetchall(): print(" ", r)

print("\n=== starter_decks ===")
cur.execute("SELECT * FROM starter_decks")
for r in cur.fetchall(): print(" ", r)

print("\n=== starter_deck_cards sample ===")
cur.execute("SELECT * FROM starter_deck_cards LIMIT 10")
for r in cur.fetchall(): print(" ", r)

print("\n=== rulebook_sections ===")
cur.execute("SELECT title, display_order, content FROM rulebook_sections ORDER BY display_order")
for r in cur.fetchall(): print(" TITLE:", r[0], "| order", r[1], "| content len", len(r[2] or ""), "\n", (r[2] or "")[:400])

print("\n=== matches sample state ===")
cur.execute("SELECT id, room_code, player1, player2, status, active_player, current_turn FROM matches ORDER BY id DESC LIMIT 5")
for r in cur.fetchall(): print(" ", r)
cur.execute("SELECT state FROM matches WHERE state IS NOT NULL ORDER BY id DESC LIMIT 1")
row = cur.fetchone()
if row and row[0]:
    print("STATE KEYS:", json.dumps(row[0], indent=2)[:1500])

cur.close(); conn.close()
