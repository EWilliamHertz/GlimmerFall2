import os
from dotenv import load_dotenv
import psycopg2

load_dotenv()
conn = psycopg2.connect(os.environ["DATABASE_URL"])
c = conn.cursor()

c.execute("UPDATE cards SET description = 'When this Entity attacks, create a 1/1 Solari Recruit token.' WHERE name = 'Gilded Pegasus'")
c.execute("UPDATE cards SET description = 'Target Entity gets +2/+0 and Overwhelm until End Phase.' WHERE name = 'Cinder Oath'")
c.execute("UPDATE cards SET description = 'Create a 3/3 Beast token with Guard.' WHERE name = 'Canopy Ambush'")
c.execute("UPDATE cards SET description = 'Other Solari Entities you control get +1/+0 during your turn.' WHERE name = 'Aurora Marshal'")
c.execute("UPDATE cards SET description = 'Whenever this Entity is attacked, deal 1 damage to the attacker.' WHERE name = 'Thornweave Matron'")
c.execute("UPDATE cards SET description = 'Exile target exhausted Entity until the End Phase.' WHERE name = 'Displacement Field'")

conn.commit()

c.execute("SELECT name, description FROM cards WHERE name IN ('Gilded Pegasus', 'Cinder Oath', 'Canopy Ambush', 'Aurora Marshal', 'Thornweave Matron', 'Displacement Field')")
for row in c.fetchall():
    print(f"{row[0]}: {row[1]}")
