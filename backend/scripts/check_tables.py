from server import DB
with DB() as cur:
    cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema='public'")
    for row in cur.fetchall():
        print(row['table_name'])
