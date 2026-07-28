import os
from dotenv import load_dotenv
import psycopg2

load_dotenv()
conn = psycopg2.connect(os.environ["DATABASE_URL"])
c = conn.cursor()

c.execute("SELECT id, title, content FROM rulebook_sections")
for r in c.fetchall():
    print(r[0], r[1])
    print(r[2])
    print("---")
