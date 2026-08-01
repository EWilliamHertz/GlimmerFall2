import re
with open('/home/ewilliamhe/GlimmerFall2/backend/server.py', 'r') as f:
    content = f.read()

new_checkout = """
@api.post("/shop/checkout")
def shop_checkout(req: CheckoutReq, request: Request):
    user = get_user_from_request(request)
    with DB() as cur:
        line_items = []
        total_weight = 0.0
        total_amount = 0.0
        
        products_info = []
        for item in req.items:
            cur.execute("SELECT id, name, price, image_url, weight_kg FROM shop_products WHERE id=%s", (item.id,))
            prod = cur.fetchone()
            if not prod: continue
            
            total_weight += float(prod.get("weight_kg") or 0.0) * item.quantity
            total_amount += float(prod.get("price") or 0.0) * item.quantity
            products_info.append((prod, item.quantity))
            
            line_item = {
                "price_data": {
                    "currency": "usd",
                    "product_data": {
                        "name": prod["name"],
                    },
                    "unit_amount": int(float(prod["price"]) * 100),
                },
                "quantity": item.quantity,
            }
            if prod["image_url"]:
                line_item["price_data"]["product_data"]["images"] = [prod["image_url"]]
            line_items.append(line_item)
            
        if not line_items:
            raise HTTPException(400, "Invalid products")
            
        session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            line_items=line_items,
            mode="payment",
            shipping_address_collection={
                "allowed_countries": ["US", "CA", "GB", "SE", "DE", "FR", "AU", "NZ", "IT", "ES", "NL", "FI", "DK", "NO"]
            },
            success_url=request.headers.get("origin", "http://localhost:3000") + "/shop?success=true",
            cancel_url=request.headers.get("origin", "http://localhost:3000") + "/shop?canceled=true",
        )
        
        # Save pending order
        cur.execute(
            "INSERT INTO shop_orders (user_id, stripe_session_id, status, total_weight_kg, total_amount) VALUES (%s, %s, 'PENDING', %s, %s) RETURNING id",
            (user['id'] if user else None, session.id, total_weight, total_amount)
        )
        order_id = cur.fetchone()["id"]
        
        for prod, qty in products_info:
            cur.execute(
                "INSERT INTO shop_order_items (order_id, product_id, quantity, price_at_purchase) VALUES (%s, %s, %s, %s)",
                (order_id, prod["id"], qty, prod["price"])
            )
            
        return {"url": session.url}

@api.post("/shop/webhook")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")
    webhook_secret = os.environ.get("STRIPE_WEBHOOK_SECRET", "")
    
    event = None
    try:
        if webhook_secret:
            event = stripe.Webhook.construct_event(payload, sig_header, webhook_secret)
        else:
            event = json.loads(payload)
    except Exception as e:
        logger.error(f"Webhook error: {e}")
        raise HTTPException(400, "Webhook Error")

    if event['type'] == 'checkout.session.completed':
        session = event['data']['object']
        session_id = session.get('id')
        
        shipping = session.get('shipping_details')
        customer_email = session.get('customer_details', {}).get('email')
        
        address_str = ""
        country = ""
        first_name = ""
        last_name = ""
        
        if shipping:
            name_parts = shipping.get('name', '').split(' ', 1)
            first_name = name_parts[0] if name_parts else ""
            last_name = name_parts[1] if len(name_parts) > 1 else ""
            addr = shipping.get('address', {})
            country = addr.get('country', '')
            address_str = f"{addr.get('line1', '')}, {addr.get('line2', '')}, {addr.get('city', '')}, {addr.get('state', '')}, {addr.get('postal_code', '')}, {country}"
            
        with DB() as cur:
            cur.execute(
                "UPDATE shop_orders SET status='PAID', first_name=%s, last_name=%s, address=%s, country=%s WHERE stripe_session_id=%s RETURNING id",
                (first_name, last_name, address_str.strip(", "), country, session_id)
            )
            updated = cur.fetchone()
            if updated and customer_email:
                order_id = updated["id"]
                # Send receipt via Resend
                receipt_html = f"<h2>Thank you for your GlimmerFall order!</h2><p>Your Order ID is <b>#{order_id}</b>.</p><p>We will ship your items to:<br>{first_name} {last_name}<br>{address_str.strip(', ')}</p><p>You will receive another email when your order ships.</p>"
                try:
                    resend.Emails.send({
                        "from": "GlimmerFall <noreply@glimmerfalltcg.com>",
                        "to": [customer_email],
                        "subject": f"Receipt for GlimmerFall Order #{order_id}",
                        "html": receipt_html
                    })
                except Exception as e:
                    logger.error(f"Failed to send receipt: {e}")

    return {"status": "success"}
"""

content = re.sub(r'@api\.post\("/shop/checkout"\).*?return \{"url": session\.url\}', new_checkout.strip(), content, flags=re.DOTALL)

with open('/home/ewilliamhe/GlimmerFall2/backend/server.py', 'w') as f:
    f.write(content)
