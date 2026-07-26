import os
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

load_dotenv("/home/ewilliamhe/GlimmerFall2/backend/.env")

conn = psycopg2.connect(os.environ["DATABASE_URL"])
cur = conn.cursor(cursor_factory=RealDictCursor)

# Get decks
cur.execute("SELECT id, deck_name FROM decks WHERE deck_name IN ('Cinder Ignition', 'Nature''s Wrath')")
print("Decks to delete:", cur.fetchall())

# Get Aether/Umbri cards to build new decks
cur.execute("SELECT name FROM cards WHERE faction = 'Aether' LIMIT 15")
print("Aether cards:", [r["name"] for r in cur.fetchall()])

cur.execute("SELECT name FROM cards WHERE faction = 'Umbri' LIMIT 15")
print("Umbri cards:", [r["name"] for r in cur.fetchall()])
