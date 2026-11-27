from server import DB
with DB() as cur:
    cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'starter_decks'")
    print([r['column_name'] for r in cur.fetchall()])
