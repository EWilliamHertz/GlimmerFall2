import os
import sys

# Ensure backend directory is in path if run from root
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from server import DB

def migrate():
    print("Running migrations...")
    with DB() as cur:
        # 1. Add is_preconstructed to decks if not exists
        try:
            cur.execute("ALTER TABLE decks ADD COLUMN IF NOT EXISTS is_preconstructed BOOLEAN DEFAULT FALSE")
        except Exception as e:
            print(f"Error altering decks table: {e}")

        # 2. Create polls table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS polls (
                id SERIAL PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                finish_at TIMESTAMP,
                is_active BOOLEAN DEFAULT TRUE
            )
        """)

        # 3. Create poll_options table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS poll_options (
                id SERIAL PRIMARY KEY,
                poll_id INTEGER REFERENCES polls(id) ON DELETE CASCADE,
                option_text VARCHAR(255) NOT NULL
            )
        """)

        # 4. Create poll_votes table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS poll_votes (
                id SERIAL PRIMARY KEY,
                poll_id INTEGER REFERENCES polls(id) ON DELETE CASCADE,
                option_id INTEGER REFERENCES poll_options(id) ON DELETE CASCADE,
                user_email VARCHAR(255) NOT NULL,
                UNIQUE(poll_id, user_email)
            )
        """)

        # 5. Create deck_likes table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS deck_likes (
                deck_id INTEGER REFERENCES decks(id) ON DELETE CASCADE,
                user_email VARCHAR(255) NOT NULL,
                PRIMARY KEY (deck_id, user_email)
            )
        """)

        # 6. Create deck_comments table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS deck_comments (
                id SERIAL PRIMARY KEY,
                deck_id INTEGER REFERENCES decks(id) ON DELETE CASCADE,
                user_email VARCHAR(255) NOT NULL,
                content TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                parent_id INTEGER REFERENCES deck_comments(id) ON DELETE CASCADE
            )
        """)
        
    print("Migration successful.")

if __name__ == "__main__":
    migrate()
