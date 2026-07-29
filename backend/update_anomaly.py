import os
from dotenv import load_dotenv
import psycopg2

load_dotenv()
conn = psycopg2.connect(os.environ["DATABASE_URL"])
c = conn.cursor()

c.execute("UPDATE cards SET description = 'When destroyed, draw a card.' WHERE name = 'Static Anomaly'")
conn.commit()

c.execute("SELECT name, description FROM cards WHERE name = 'Static Anomaly'")
print(c.fetchone())
