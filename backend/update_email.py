from server import DB
import resend
import os
from dotenv import load_dotenv

load_dotenv()
resend.api_key = os.environ.get("RESEND_API_KEY")

def send_receipt(order_id, email, name, address, items, total_amount, shipping_cost):
    items_html = ""
    for item in items:
        items_html += f"""
        <tr>
            <td style="padding: 12px; border-bottom: 1px solid #333; color: #fff;">{item['product_name']}</td>
            <td style="padding: 12px; border-bottom: 1px solid #333; color: #aaa; text-align: center;">x{item['quantity']}</td>
            <td style="padding: 12px; border-bottom: 1px solid #333; color: #22E07B; text-align: right;">${item['price_at_purchase']}</td>
        </tr>
        """
        
    html = f"""
    <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #0d0d0d; color: #ffffff; padding: 40px 20px; max-width: 600px; margin: 0 auto; border-radius: 8px;">
        <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #F2A900; margin: 0; font-size: 28px; text-transform: uppercase; letter-spacing: 2px;">GlimmerFall</h1>
            <p style="color: #00BFFF; font-size: 14px; margin-top: 5px;">The Multiverse TCG</p>
        </div>
        
        <p style="font-size: 16px; line-height: 1.5; color: #e0e0e0;">
            Greetings <strong>{name}</strong>,<br><br>
            The Void acknowledges your tribute. Your order <strong>#{order_id}</strong> has been secured and is being prepared by our scribes. Whether you wield the blinding light of the Solari, the raw elemental wrath of Gaia, the necrotic persistence of the Graveglass, or the chronomancy of the Fractured Continuum, your journey is about to ascend.
        </p>
        
        <div style="background-color: #1a1a1a; border-radius: 8px; padding: 20px; margin-top: 30px;">
            <h3 style="color: #F2A900; margin-top: 0; border-bottom: 1px solid #333; padding-bottom: 10px;">Order Summary</h3>
            <table style="width: 100%; border-collapse: collapse;">
                {items_html}
            </table>
            <div style="margin-top: 20px; text-align: right;">
                <p style="color: #aaa; margin: 5px 0;">Shipping: ${shipping_cost}</p>
                <p style="color: #F2A900; font-size: 18px; font-weight: bold; margin: 5px 0;">Total Paid: ${total_amount}</p>
            </div>
        </div>
        
        <div style="background-color: #1a1a1a; border-radius: 8px; padding: 20px; margin-top: 20px;">
            <h3 style="color: #00BFFF; margin-top: 0; border-bottom: 1px solid #333; padding-bottom: 10px;">Shipping Destination</h3>
            <p style="color: #ccc; line-height: 1.5; margin-bottom: 0;">
                {address}
            </p>
        </div>
        
        <p style="text-align: center; color: #666; font-size: 12px; margin-top: 40px;">
            May the Glimmer guide your path.<br>
            © 2026 GlimmerFall TCG
        </p>
    </div>
    """
    
    try:
        resend.Emails.send({
            "from": "GlimmerFall <noreply@glimmerfalltcg.com>",
            "to": [email],
            "subject": f"Your GlimmerFall Order #{order_id} is Confirmed",
            "html": html
        })
        print(f"Sent receipt to {email}")
    except Exception as e:
        print(f"Failed to send: {e}")

if __name__ == "__main__":
    with DB() as cur:
        # Fetch Peter's order
        cur.execute("SELECT * FROM shop_orders WHERE id = 2")
        order = cur.fetchone()
        
        cur.execute("""
            SELECT i.*, p.name as product_name 
            FROM shop_order_items i
            LEFT JOIN shop_products p ON i.product_id = p.id
            WHERE i.order_id = 2
        """)
        items = cur.fetchall()
        
        if order and items:
            send_receipt(
                order['id'], 
                order['user_email'], 
                order['first_name'] + " " + order['last_name'], 
                order['address'] + ", " + order['country'],
                items,
                order['total_amount'],
                order['shipping_cost']
            )
