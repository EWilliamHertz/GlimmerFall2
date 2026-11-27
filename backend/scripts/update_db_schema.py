import os
from dotenv import load_dotenv
import psycopg2

load_dotenv()
conn = psycopg2.connect(os.environ["DATABASE_URL"])
c = conn.cursor()

# Add referral_source to users
try:
    c.execute("ALTER TABLE users ADD COLUMN referral_source VARCHAR(255)")
except Exception as e:
    print(f"Skipping referral_source: {e}")
    conn.rollback()

# Add detailed fields to shop_orders
try:
    c.execute("ALTER TABLE shop_orders ADD COLUMN first_name VARCHAR(100)")
    c.execute("ALTER TABLE shop_orders ADD COLUMN last_name VARCHAR(100)")
    c.execute("ALTER TABLE shop_orders ADD COLUMN address TEXT")
except Exception as e:
    print(f"Skipping shop_orders fields: {e}")
    conn.rollback()

conn.commit()
print("DB Schema Updated.")
