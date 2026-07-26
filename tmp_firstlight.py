import os
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

load_dotenv("/home/ewilliamhe/GlimmerFall2/backend/.env")

conn = psycopg2.connect(os.environ["DATABASE_URL"])
cur = conn.cursor(cursor_factory=RealDictCursor)
cur.execute("SELECT name, card_type, description FROM cards WHERE name ILIKE '%Firstlight%'")
for r in cur.fetchall():
    print(r)
