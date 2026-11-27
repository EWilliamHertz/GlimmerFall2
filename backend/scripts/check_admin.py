from server import DB
with DB() as cur:
    cur.execute("SELECT email, is_admin FROM users WHERE email='swagyser9@gmail.com'")
    print(cur.fetchone())
