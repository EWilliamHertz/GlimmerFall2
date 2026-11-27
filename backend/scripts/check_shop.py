from server import DB
with DB() as cur:
    cur.execute("SELECT * FROM shop_products")
    print(cur.fetchall())
