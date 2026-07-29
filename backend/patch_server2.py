import os
import psycopg2

with open('backend/server.py', 'r') as f:
    content = f.read()

# Add Request to imports if not there
if "from fastapi import Request" not in content and "Request" not in content.split("from fastapi import")[1].split("\n")[0]:
    content = content.replace("from fastapi import FastAPI,", "from fastapi import FastAPI, Request,")

# Fix telemetry SQL
old_sql = \"\"\"SELECT d.id, d.name,
                SUM(CASE WHEN m.winner = d.user_id THEN 1 ELSE 0 END) as wins,
                COUNT(m.id) as total_games
            FROM decks d
            JOIN matches m ON (m.player_1_deck_id = d.id OR m.player_2_deck_id = d.id)
            WHERE m.status = 'FINISHED'
            GROUP BY d.id, d.name
            ORDER BY total_games DESC, wins DESC\"\"\"

new_sql = \"\"\"SELECT COALESCE(deck_name, 'Unknown Deck') as deck, SUM(wins) as wins, SUM(total_games) as total_games
        FROM (
            SELECT player1_deck as deck_name, 
                   SUM(CASE WHEN winner=(SELECT id FROM users WHERE username=player1 LIMIT 1) THEN 1 ELSE 0 END) as wins,
                   COUNT(id) as total_games
            FROM matches WHERE status='FINISHED' AND player1_deck IS NOT NULL
            GROUP BY player1_deck
            UNION ALL
            SELECT player2_deck as deck_name, 
                   SUM(CASE WHEN winner=(SELECT id FROM users WHERE username=player2 LIMIT 1) THEN 1 ELSE 0 END) as wins,
                   COUNT(id) as total_games
            FROM matches WHERE status='FINISHED' AND player2_deck IS NOT NULL
            GROUP BY player2_deck
        ) as combined
        GROUP BY deck_name
        ORDER BY total_games DESC, wins DESC\"\"\"

if old_sql in content:
    content = content.replace(old_sql, new_sql)
else:
    # Use fallback replace block
    import re
    content = re.sub(r'cur\.execute\(\"\"\"\s*SELECT d\.id.*?ORDER BY total_games DESC, wins DESC\s*\"\"\"\)', 
           'cur.execute(\"\"\"' + new_sql + '\"\"\")', content, flags=re.DOTALL)

with open('backend/server.py', 'w') as f:
    f.write(content)

print("Server updated")

# Alter DB to add player1_deck and player2_deck
from dotenv import load_dotenv
load_dotenv()
conn = psycopg2.connect(os.environ["DATABASE_URL"])
c = conn.cursor()
try:
    c.execute("ALTER TABLE matches ADD COLUMN player1_deck VARCHAR(255)")
    c.execute("ALTER TABLE matches ADD COLUMN player2_deck VARCHAR(255)")
    conn.commit()
    print("Matches table altered.")
except Exception as e:
    print(f"Skipping matches alter: {e}")
    conn.rollback()
