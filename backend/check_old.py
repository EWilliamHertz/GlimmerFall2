from server import DB
with DB() as cur:
    cur.execute("SELECT email, is_admin FROM users WHERE email='ernst@hatake.eu'")
    print(cur.fetchone())
