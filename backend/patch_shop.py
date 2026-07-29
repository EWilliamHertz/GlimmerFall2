with open("backend/server.py", "r") as f:
    content = f.read()

shop_routes = """
@api.get("/shop/products")
def get_public_products():
    with DB() as cur:
        cur.execute("SELECT * FROM shop_products ORDER BY id ASC")
        return cur.fetchall()

@api.get("/admin/shop/products")
def get_admin_products(request: Request):
    user = get_user_from_request(request)
    if not user or not user.get("is_admin"): raise HTTPException(403)
    with DB() as cur:
        cur.execute("SELECT * FROM shop_products ORDER BY id ASC")
        return cur.fetchall()

@api.get("/admin/shop/stats")
def get_admin_shop_stats(request: Request):
    user = get_user_from_request(request)
    if not user or not user.get("is_admin"): raise HTTPException(403)
    with DB() as cur:
        cur.execute("SELECT COUNT(*) as total_orders, COALESCE(SUM(total_amount), 0) as total_revenue FROM shop_orders")
        stats = cur.fetchone()
        cur.execute("SELECT country, COUNT(*) as count FROM shop_orders GROUP BY country")
        stats['by_country'] = cur.fetchall()
        return stats

@api.get("/admin/shop/orders")
def get_admin_shop_orders(request: Request):
    user = get_user_from_request(request)
    if not user or not user.get("is_admin"): raise HTTPException(403)
    with DB() as cur:
        cur.execute("SELECT * FROM shop_orders ORDER BY created_at DESC")
        return cur.fetchall()
"""

if "/shop/products" not in content:
    with open("backend/server.py", "w") as f:
        # append right before the cors middleware
        f.write(content.replace("app.include_router(api)", shop_routes + "\napp.include_router(api)"))
