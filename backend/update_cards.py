import os
from dotenv import load_dotenv
import psycopg2

load_dotenv()
conn = psycopg2.connect(os.environ["DATABASE_URL"])
c = conn.cursor()

c.execute("UPDATE cards SET description = replace(description, 'this Entity round', 'until the end of next turn') WHERE name = 'Brilliant Reversal'")
c.execute("UPDATE cards SET description = replace(description, 'Flashes', 'Spells') WHERE name = 'Nexus Weaver'")
c.execute("UPDATE cards SET description = replace(description, 'Flash', 'Spell') WHERE name = 'Voltage Savant'")
conn.commit()

c.execute("SELECT name, description FROM cards WHERE name IN ('Brilliant Reversal', 'Nexus Weaver', 'Voltage Savant')")
print(c.fetchall())
