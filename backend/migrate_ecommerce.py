import psycopg2
from server import DB

def migrate_ecommerce():
    with DB() as cur:
        # Add buy_in_price to shop_products if it doesn't exist
        print("Checking shop_products for buy_in_price...")
        cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name='shop_products' AND column_name='buy_in_price'")
        if not cur.fetchone():
            cur.execute("ALTER TABLE shop_products ADD COLUMN buy_in_price DECIMAL(10, 2) DEFAULT 0.00")
            print("Added buy_in_price to shop_products")
        
        # Create shop_orders table to track shipping and fulfillment
        print("Creating shop_orders table...")
        cur.execute("""
            CREATE TABLE IF NOT EXISTS shop_orders (
                id SERIAL PRIMARY KEY,
                stripe_session_id VARCHAR(255) UNIQUE,
                user_email VARCHAR(255),
                customer_name VARCHAR(255),
                shipping_address JSONB,
                phone VARCHAR(50),
                total_amount DECIMAL(10, 2),
                total_cogs DECIMAL(10, 2),
                status VARCHAR(50) DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Create shop_order_items table
        print("Creating shop_order_items table...")
        cur.execute("""
            CREATE TABLE IF NOT EXISTS shop_order_items (
                id SERIAL PRIMARY KEY,
                order_id INTEGER REFERENCES shop_orders(id) ON DELETE CASCADE,
                product_id INTEGER REFERENCES shop_products(id),
                quantity INTEGER,
                price_at_purchase DECIMAL(10, 2),
                buy_in_price_at_purchase DECIMAL(10, 2)
            )
        """)

        print("Migration complete!")

if __name__ == "__main__":
    migrate_ecommerce()
