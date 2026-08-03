import os
import stripe
from dotenv import load_dotenv

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(ROOT_DIR, ".env"))

stripe.api_key = os.environ.get("STRIPE_SECRET_KEY")

session = stripe.checkout.Session.retrieve("cs_live_a1XSGCcbVl9W2yJGNFRbX5DeTZk5jPrz907CWHSzKAtEZyFSCZw6nvoqEr")
print("Currency:", session.currency)
print("Amount Subtotal:", getattr(session, 'amount_subtotal', None))
print("Amount Total:", getattr(session, 'amount_total', None))
print("Total Details:", getattr(session, 'total_details', None))
print("Shipping Address:", getattr(getattr(session, 'shipping_details', None), 'address', None))
