import os
from dotenv import load_dotenv
import psycopg2
import json

load_dotenv()
conn = psycopg2.connect(os.environ["DATABASE_URL"])
c = conn.cursor()
c.execute("SELECT state FROM matches LIMIT 1")
row = c.fetchone()
if row:
    state = row[0]
    if isinstance(state, str):
        state = json.loads(state)
    print(list(state.keys()))
