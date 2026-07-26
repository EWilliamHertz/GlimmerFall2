import os
import psycopg2
from dotenv import load_dotenv

load_dotenv("/home/ewilliamhe/GlimmerFall2/backend/.env")

conn = psycopg2.connect(os.environ["DATABASE_URL"])
cur = conn.cursor()

# Get cards for new decks
cur.execute("SELECT name FROM cards WHERE faction = 'Aether' AND name != 'Reality Fracture' LIMIT 14")
aether_cards = cur.fetchall()
cur.execute("SELECT name FROM cards WHERE name = 'Reality Fracture'")
aether_cards.insert(0, cur.fetchone())

cur.execute("SELECT name FROM cards WHERE faction = 'Umbri' AND name != 'Graveglass Oracle' LIMIT 14")
umbri_cards = cur.fetchall()
cur.execute("SELECT name FROM cards WHERE name = 'Graveglass Oracle'")
umbri_cards.insert(0, cur.fetchone())

# Delete old
cur.execute("DELETE FROM starter_deck_cards WHERE starter_deck_id IN (1, 2)")
cur.execute("DELETE FROM starter_decks WHERE id IN (1, 2)")

# Insert Aether and Umbri decks
cur.execute("""
    INSERT INTO starter_decks (id, deck_key, deck_name, description, color_theme)
    VALUES 
    (1, 'umbri_shadows', 'Graveglass Prophecy', 'A dark Umbri deck specializing in void manipulation and assassinations.', '#9B30FF'),
    (2, 'aether_control', 'Aetherial Distortion', 'An Aether deck focused on reality distortion, card draw, and spells.', '#38CCFF')
""")

# Insert cards
# For Umbri
for i, card in enumerate(umbri_cards):
    count = 3 if i < 10 else 2
    cur.execute("INSERT INTO starter_deck_cards (starter_deck_id, card_name, count) VALUES (%s, %s, %s)", (1, card[0], count))

# For Aether
for i, card in enumerate(aether_cards):
    count = 3 if i < 10 else 2
    cur.execute("INSERT INTO starter_deck_cards (starter_deck_id, card_name, count) VALUES (%s, %s, %s)", (2, card[0], count))

conn.commit()
print("Updated starter decks in DB successfully.")
