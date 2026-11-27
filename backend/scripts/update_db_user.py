import os
from dotenv import load_dotenv
import psycopg2

load_dotenv()
conn = psycopg2.connect(os.environ["DATABASE_URL"])
c = conn.cursor()
try:
    c.execute("UPDATE users SET email='swagyser9@gmail.com', nickname='Swagyser' WHERE email='ernst@hatake.eu' OR nickname ILIKE 'ernst'")
    conn.commit()
    print(f"Updated {c.rowcount} rows in DB.")
except Exception as e:
    print(f"Error: {e}")
    conn.rollback()
