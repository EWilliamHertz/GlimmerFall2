import os
from dotenv import load_dotenv
import psycopg2

load_dotenv()
conn = psycopg2.connect(os.environ["DATABASE_URL"])
c = conn.cursor()
try:
    c.execute("ALTER TABLE matches ADD COLUMN player1_deck VARCHAR(255)")
    c.execute("ALTER TABLE matches ADD COLUMN player2_deck VARCHAR(255)")
    conn.commit()
    print("Matches table altered.")
except Exception as e:
    print(f"Skipping matches alter: {e}")
    conn.rollback()
