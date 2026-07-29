import os
from dotenv import load_dotenv
import psycopg2

load_dotenv()
conn = psycopg2.connect(os.environ["DATABASE_URL"])
c = conn.cursor()

c.execute("UPDATE cards SET description = REPLACE(description, 'combat damage', 'damage')")
c.execute("UPDATE cards SET description = REPLACE(description, 'Combat damage', 'Damage')")
conn.commit()

c.execute("SELECT name, description FROM cards WHERE description ILIKE '%deals damage%'")
for row in c.fetchall():
    print(f"{row[0]}: {row[1]}")
