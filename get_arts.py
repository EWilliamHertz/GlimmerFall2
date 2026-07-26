import os
import psycopg2
from dotenv import load_dotenv

load_dotenv("/home/ewilliamhe/GlimmerFall2/backend/.env")
conn = psycopg2.connect(os.environ["DATABASE_URL"])
cur = conn.cursor()
cur.execute("SELECT name, image_url FROM cards WHERE name IN ('Gaia', 'Emberwing Courier', 'Reality Fracture', 'Graveglass Oracle')")
for r in cur.fetchall():
    print(r[0], r[1])
