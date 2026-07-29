from server import DB
with DB() as cur:
    cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema='public'")
    print([r['table_name'] for r in cur.fetchall()])
