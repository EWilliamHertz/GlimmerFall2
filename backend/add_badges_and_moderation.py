import psycopg2
import os

conn = psycopg2.connect(os.environ["DATABASE_URL"])
conn.autocommit = True
cur = conn.cursor()

try:
    cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS badges JSONB DEFAULT '[]'::jsonb")
    cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active'")
    print("Successfully added badges and status columns to users table.")
except Exception as e:
    print(f"Error: {e}")

cur.close()
conn.close()
