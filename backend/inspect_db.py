import psycopg2
import json

DATABASE_URL = "postgresql://neondb_owner:npg_c8rRimgWC1OG@ep-round-lab-atbehctx-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"

conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()

cur.execute("""
SELECT table_name FROM information_schema.tables
WHERE table_schema='public' ORDER BY table_name;
""")
tables = [r[0] for r in cur.fetchall()]
print("TABLES:", tables)

for t in tables:
    cur.execute("""
        SELECT column_name, data_type FROM information_schema.columns
        WHERE table_name=%s ORDER BY ordinal_position;
    """, (t,))
    cols = cur.fetchall()
    cur.execute(f'SELECT COUNT(*) FROM "{t}"')
    cnt = cur.fetchone()[0]
    print(f"\n=== {t} ({cnt} rows) ===")
    for c in cols:
        print(f"  {c[0]}: {c[1]}")

# sample cards
print("\n\n=== SAMPLE CARDS ===")
cur.execute('SELECT * FROM cards LIMIT 5')
colnames = [d[0] for d in cur.description]
for row in cur.fetchall():
    print(json.dumps(dict(zip(colnames, [str(x) for x in row])), indent=2))

print("\n=== DISTINCT factions / card_types / rarities ===")
for col in ['faction','card_type','rarity','set_name']:
    try:
        cur.execute(f'SELECT DISTINCT {col} FROM cards')
        print(col, ":", [r[0] for r in cur.fetchall()])
    except Exception as e:
        print(col, "ERR", e)
        conn.rollback()

cur.close()
conn.close()
