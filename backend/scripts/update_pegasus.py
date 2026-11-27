import os
from dotenv import load_dotenv
import psycopg2

load_dotenv()
conn = psycopg2.connect(os.environ["DATABASE_URL"])
c = conn.cursor()

c.execute("UPDATE cards SET description = 'When this Entity deals combat damage, create a 1/1 Solari Recruit token.' WHERE name = 'Gilded Pegasus'")
conn.commit()

c.execute("SELECT name, description FROM cards WHERE name = 'Gilded Pegasus'")
print(c.fetchone())
