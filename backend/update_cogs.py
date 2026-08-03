from server import DB

with DB() as cur:
    cur.execute("UPDATE shop_orders SET total_cogs = 4.70 WHERE id = 2")
    print("Fixed order 2 COGS")
