import os
from dotenv import load_dotenv
import psycopg2

load_dotenv()
conn = psycopg2.connect(os.environ["DATABASE_URL"])
c = conn.cursor()

c.execute("SELECT name, description FROM cards WHERE name ILIKE 'Comet Array' OR name ILIKE 'Fading Memory' OR name ILIKE 'CounterCurrent'")
print(c.fetchall())
