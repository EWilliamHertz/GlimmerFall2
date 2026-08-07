import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()
DATABASE_URL = os.environ.get("DATABASE_URL")
conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()
cur.execute("""
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    nickname VARCHAR(50) NOT NULL,
    faction VARCHAR(20),
    is_admin BOOLEAN DEFAULT FALSE,
    is_verified BOOLEAN DEFAULT FALSE,
    verification_token VARCHAR(255),
    referrals INTEGER DEFAULT 0,
    bookings INTEGER DEFAULT 0,
    mmr INTEGER DEFAULT 1400,
    rank VARCHAR(20) DEFAULT 'Bronze IV',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
""")
conn.commit()
print("Success")
