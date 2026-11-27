from server import DB

with DB() as cur:
    # 1. Quests table
    cur.execute("""
    CREATE TABLE IF NOT EXISTS user_quests (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        description VARCHAR(255) NOT NULL,
        target_value INTEGER NOT NULL,
        current_value INTEGER DEFAULT 0,
        reward VARCHAR(255),
        is_completed BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)
    
    # 2. Friendships table
    cur.execute("""
    CREATE TABLE IF NOT EXISTS friendships (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        friend_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, friend_id)
    )
    """)
    print("Database tables created successfully!")
