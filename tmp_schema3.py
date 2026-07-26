import os
import psycopg2
from dotenv import load_dotenv

load_dotenv("/home/ewilliamhe/GlimmerFall2/backend/.env")

conn = psycopg2.connect(os.environ["DATABASE_URL"])
cur = conn.cursor()
cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'starter_deck_cards'")
print("Schema:", [r[0] for r in cur.fetchall()])
cur.execute("SELECT * FROM starter_deck_cards LIMIT 1")
print("First row:", cur.fetchall())
