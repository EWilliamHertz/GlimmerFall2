import psycopg2
import re

conn = psycopg2.connect('postgresql://neondb_owner:npg_NqCfXsR2a5pO@ep-round-lab-atbehctx-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require')
cur = conn.cursor()

cur.execute("SELECT id, name, keywords, description FROM cards WHERE description IS NOT NULL AND description != ''")
cards = cur.fetchall()

updates = []
for cid, name, kws, desc in cards:
    original_desc = desc
    
    # Check if the description matches the pattern: "Keyword1, Keyword2 — Rest of text"
    # Or just "Keyword1"
    
    # We can match anything before " — " if it looks like a list of keywords
    match = re.match(r'^([a-zA-Z,\s]+)\s*(?:—|-)\s*(.*)$', desc)
    if match:
        prefix = match.group(1).strip()
        # verify prefix looks like keywords
        words = [w.strip() for w in prefix.split(",")]
        is_kw = all(w in ["Guard", "Evasive", "Stealth", "Echo", "Overwhelm", "Lethal", "Swift"] for w in words)
        if is_kw:
            desc = match.group(2).strip()
    else:
        # Check if the entire description is just a list of keywords
        words = [w.strip() for w in desc.split(",")]
        is_kw = all(w in ["Guard", "Evasive", "Stealth", "Echo", "Overwhelm", "Lethal", "Swift"] for w in words)
        if is_kw:
            desc = ""

    # Fix the Void Stalker bug directly just in case
    if name == 'Void Stalker' and original_desc == 'Stealth — Cannot be blocked.':
        desc = 'Cannot be blocked.'
        
    if desc != original_desc:
        updates.append((desc, cid))

for desc, cid in updates:
    cur.execute("UPDATE cards SET description = %s WHERE id = %s", (desc, cid))

conn.commit()
print(f"Updated {len(updates)} cards!")
