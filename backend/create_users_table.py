import os
import psycopg2
DATABASE_URL = "postgresql://neondb_owner:npg_c8rRimgWC1OG@ep-round-lab-atbehctx-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
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
    mmr INTEGER DEFAULT 1200,
    rank VARCHAR(20) DEFAULT 'Bronze IV',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
""")
conn.commit()
print("Success")
