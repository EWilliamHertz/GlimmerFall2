import os
from dotenv import load_dotenv
import psycopg2

load_dotenv()
conn = psycopg2.connect(os.environ["DATABASE_URL"])
c = conn.cursor()

# Verdict of Embers
c.execute("UPDATE cards SET description = replace(description, 'this Entity way', 'this way') WHERE name = 'Verdict of Embers'")

# Crown of Noon
c.execute("UPDATE cards SET description = replace(description, 'Whenever it attacks alone, it gains', 'It gains') WHERE name = 'Crown of Noon'")
# Alternative fix if the phrasing differs slightly:
c.execute("UPDATE cards SET description = replace(description, 'Whenever it attacks alone, it gains Overwhelm', 'It gains Overwhelm') WHERE name = 'Crown of Noon'")

# Purge the Gloom
c.execute("UPDATE cards SET description = 'Exile target Relic or Entity. Draw a card.', cost = 4, rarity = 'Rare' WHERE name = 'Purge the Gloom'")
conn.commit()

c.execute("SELECT name, description, cost, rarity FROM cards WHERE name IN ('Verdict of Embers', 'Crown of Noon', 'Purge the Gloom')")
print(c.fetchall())
