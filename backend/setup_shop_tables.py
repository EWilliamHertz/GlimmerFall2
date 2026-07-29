import os
from dotenv import load_dotenv
import psycopg2

load_dotenv()
conn = psycopg2.connect(os.environ["DATABASE_URL"])
c = conn.cursor()

c.execute("""
CREATE TABLE IF NOT EXISTS shop_products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    stock INT NOT NULL DEFAULT 0,
    is_preorder BOOLEAN DEFAULT FALSE,
    eta VARCHAR(100),
    weight_kg DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    image_url VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
""")

c.execute("""
CREATE TABLE IF NOT EXISTS shop_orders (
    id SERIAL PRIMARY KEY,
    user_id INT,
    stripe_session_id VARCHAR(255),
    status VARCHAR(50) DEFAULT 'pending',
    country VARCHAR(100),
    total_weight_kg DECIMAL(10, 2),
    shipping_cost DECIMAL(10, 2),
    total_amount DECIMAL(10, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
""")

c.execute("""
CREATE TABLE IF NOT EXISTS shop_order_items (
    id SERIAL PRIMARY KEY,
    order_id INT REFERENCES shop_orders(id) ON DELETE CASCADE,
    product_id INT REFERENCES shop_products(id) ON DELETE CASCADE,
    quantity INT NOT NULL,
    price_at_purchase DECIMAL(10, 2)
);
""")

# Insert initial 4 starter decks if empty
c.execute("SELECT COUNT(*) FROM shop_products")
if c.fetchone()[0] == 0:
    decks = [
        ("Solari Starter Deck", "Aggressive light faction pre-built deck.", 19.99, 100, False, "", 0.25),
        ("Umbri Starter Deck", "Control void faction pre-built deck.", 19.99, 100, False, "", 0.25),
        ("Terra Starter Deck", "Growth nature faction pre-built deck.", 19.99, 0, True, "October 2026", 0.25),
        ("Aether Starter Deck", "Spell focused techno faction pre-built deck.", 19.99, 0, True, "October 2026", 0.25),
    ]
    for d in decks:
        c.execute("""
        INSERT INTO shop_products (name, description, price, stock, is_preorder, eta, weight_kg)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, d)

conn.commit()
print("Shop tables created and seeded!")
