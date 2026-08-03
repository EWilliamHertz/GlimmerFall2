import psycopg2
import os

conn = psycopg2.connect(os.environ["DATABASE_URL"])
conn.autocommit = True
cur = conn.cursor()

try:
    cur.execute("ALTER TABLE matches ADD COLUMN IF NOT EXISTS last_polled TIMESTAMP DEFAULT CURRENT_TIMESTAMP")
    print("Added last_polled column.")
except Exception as e:
    print(f"Error: {e}")

cur.close()
conn.close()
