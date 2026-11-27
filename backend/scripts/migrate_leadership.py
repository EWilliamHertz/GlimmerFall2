import psycopg2, os
from dotenv import load_dotenv

load_dotenv()
conn = psycopg2.connect(os.environ["DATABASE_URL"])
cur = conn.cursor()

cur.execute("""
CREATE TABLE IF NOT EXISTS campaigns (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS page_views (
    id SERIAL PRIMARY KEY,
    path VARCHAR(255) NOT NULL,
    user_email VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS suggestions (
    id SERIAL PRIMARY KEY,
    user_email VARCHAR(255),
    suggestion_type VARCHAR(50) NOT NULL, -- 'Proposal', 'Goal', 'Task'
    content TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'Pending',
    upvotes INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
""")
conn.commit()
print("Leadership tables created.")
cur.close()
conn.close()
