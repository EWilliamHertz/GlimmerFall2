import os
import json
import traceback
import stripe
from dotenv import load_dotenv
from server import DB

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(ROOT_DIR, ".env"))

stripe.api_key = os.environ.get("STRIPE_SECRET_KEY")

def sync_pending_orders():
    with DB() as cur:
        cur.execute("SELECT id, stripe_session_id FROM shop_orders WHERE status = 'PENDING'")
        pending_orders = cur.fetchall()

    if not pending_orders:
        return

    success_count = 0
    with DB() as cur:
        for order in pending_orders:
            session_id = order["stripe_session_id"]
            if not session_id:
                continue
                
            try:
                session = stripe.checkout.Session.retrieve(session_id)
                if session.payment_status == 'paid':
                    customer_details = getattr(session, 'customer_details', None) or {}
                    shipping_details = getattr(session, 'shipping_details', None) or {}
                    
                    customer_email = customer_details.get('email') if isinstance(customer_details, dict) else getattr(customer_details, 'email', None)
                    customer_name = customer_details.get('name') if isinstance(customer_details, dict) else getattr(customer_details, 'name', None)
                    
                    phone = (customer_details.get('phone') if isinstance(customer_details, dict) else getattr(customer_details, 'phone', None)) or \
                            (shipping_details.get('phone') if isinstance(shipping_details, dict) else getattr(shipping_details, 'phone', None))
                    
                    shipping_address = shipping_details.get('address') if isinstance(shipping_details, dict) else getattr(shipping_details, 'address', {})
                    if not shipping_address:
                        shipping_address = {}
                        
                    address_parts = [
                        shipping_address.get('line1') if isinstance(shipping_address, dict) else getattr(shipping_address, 'line1', None),
                        shipping_address.get('line2') if isinstance(shipping_address, dict) else getattr(shipping_address, 'line2', None),
                        shipping_address.get('city') if isinstance(shipping_address, dict) else getattr(shipping_address, 'city', None),
                        shipping_address.get('state') if isinstance(shipping_address, dict) else getattr(shipping_address, 'state', None),
                        shipping_address.get('postal_code') if isinstance(shipping_address, dict) else getattr(shipping_address, 'postal_code', None)
                    ]
                    address_str = ", ".join([p for p in address_parts if p])
                    country = shipping_address.get('country') if isinstance(shipping_address, dict) else getattr(shipping_address, 'country', None)
                    
                    s_name = shipping_details.get('name') if isinstance(shipping_details, dict) else getattr(shipping_details, 'name', None)
                    name_parts = (s_name or customer_name or "").split(" ", 1)
                    first_name = name_parts[0] if len(name_parts) > 0 else ""
                    last_name = name_parts[1] if len(name_parts) > 1 else ""
                    
                    shipping_json = json.dumps(dict(shipping_address) if hasattr(shipping_address, 'keys') else {})
                    
                    total_details = getattr(session, 'total_details', None) or {}
                    shipping_cost = (total_details.get('amount_shipping') if isinstance(total_details, dict) else getattr(total_details, 'amount_shipping', 0)) or 0
                    tax_amount = (total_details.get('amount_tax') if isinstance(total_details, dict) else getattr(total_details, 'amount_tax', 0)) or 0
                    
                    shipping_cost /= 100.0
                    tax_amount /= 100.0
                    
                    cur.execute(
                        """
                        UPDATE shop_orders 
                        SET status='PAID', first_name=%s, last_name=%s, address=%s, country=%s, 
                            shipping_cost=%s, tax_amount=%s, phone=%s, user_email=%s, customer_name=%s, 
                            shipping_address=%s 
                        WHERE id=%s
                        """,
                        (first_name, last_name, address_str.strip(", "), country, shipping_cost, 
                         tax_amount, phone, customer_email, customer_name, shipping_json, order["id"])
                    )
                    success_count += 1
                    print(f"Synced order {order['id']}")
            except Exception as e:
                print(f"Failed to sync order {order['id']}:")
                traceback.print_exc()

if __name__ == "__main__":
    sync_pending_orders()
