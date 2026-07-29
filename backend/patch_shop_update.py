with open("backend/server.py", "r") as f:
    content = f.read()

update_route = """
@api.put("/admin/shop/products/{product_id}")
async def update_admin_product(product_id: int, request: Request):
    user = get_user_from_request(request)
    if not user or not user.get("is_admin"): raise HTTPException(403)
    data = await request.json()
    with DB() as cur:
        cur.execute('''
            UPDATE shop_products 
            SET name = %s, description = %s, price = %s, stock = %s, 
                is_preorder = %s, eta = %s, weight_kg = %s, image_url = %s
            WHERE id = %s
        ''', (
            data.get('name'), data.get('description'), data.get('price'), data.get('stock'),
            data.get('is_preorder'), data.get('eta'), data.get('weight_kg'), data.get('image_url'),
            product_id
        ))
        return {"success": True}
"""

if "/admin/shop/products/{product_id}" not in content:
    with open("backend/server.py", "w") as f:
        f.write(content.replace("app.include_router(api)", update_route + "\napp.include_router(api)"))
