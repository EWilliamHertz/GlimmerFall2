import psycopg2

conn = psycopg2.connect('postgresql://neondb_owner:npg_NqCfXsR2a5pO@ep-round-lab-atbehctx-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require')
cur = conn.cursor()
cur.execute("SELECT name, keywords, description FROM cards WHERE keywords IS NOT NULL AND keywords != 'None' LIMIT 20")
cards = cur.fetchall()
for c in cards:
    print(c)
