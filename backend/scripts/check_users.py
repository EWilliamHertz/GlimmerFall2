import os
from dotenv import load_dotenv
import psycopg2

load_dotenv()
conn = psycopg2.connect(os.environ["DATABASE_URL"])
c = conn.cursor()
c.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'users'")
for row in c.fetchall():
    print(row[0])
