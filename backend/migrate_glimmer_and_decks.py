"""
Idempotent migration for Glimmer currency, referrals, server-side decks,
and quest reward crediting. Run with:
    /root/.venv/bin/python /app/backend/migrate_glimmer_and_decks.py
"""
import os
import re
import sys
from pathlib import Path
from dotenv import load_dotenv

ROOT = Path(__file__).parent
load_dotenv(ROOT / ".env")

import psycopg2
from psycopg2.extras import RealDictCursor

conn = psycopg2.connect(os.environ["DATABASE_URL"])
conn.autocommit = True
cur = conn.cursor(cursor_factory=RealDictCursor)


def run(sql, params=None):
    cur.execute(sql, params or ())


print(">>> Adding glimmer_balance + referral_code to users")
run("ALTER TABLE users ADD COLUMN IF NOT EXISTS glimmer_balance INTEGER NOT NULL DEFAULT 0")
run("ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code VARCHAR(16)")
# Unique index (not constraint so we can add safely)
run("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code) WHERE referral_code IS NOT NULL")

print(">>> Backfilling referral_code for existing users")
cur.execute("SELECT id, nickname FROM users WHERE referral_code IS NULL")
rows = cur.fetchall()
for r in rows:
    base = re.sub(r"[^a-zA-Z0-9]", "", r["nickname"] or "user")[:8].lower() or "user"
    code = f"{base}{str(r['id']).rjust(4, '0')[-4:]}"
    # ensure uniqueness
    n = 0
    while True:
        try_code = code if n == 0 else f"{code}{n}"
        cur.execute("SELECT 1 FROM users WHERE referral_code=%s", (try_code,))
        if not cur.fetchone():
            break
        n += 1
    cur.execute("UPDATE users SET referral_code=%s WHERE id=%s", (try_code, r["id"]))
print(f"    backfilled {len(rows)} users")


print(">>> Adding reward_glimmer + reward_claimed to user_quests")
run("ALTER TABLE user_quests ADD COLUMN IF NOT EXISTS reward_glimmer INTEGER NOT NULL DEFAULT 0")
run("ALTER TABLE user_quests ADD COLUMN IF NOT EXISTS reward_claimed BOOLEAN NOT NULL DEFAULT FALSE")

print(">>> Parsing existing reward text -> reward_glimmer")
cur.execute("SELECT id, reward, reward_glimmer FROM user_quests")
q_rows = cur.fetchall()
_glim_re = re.compile(r"(\d+)\s*glimmer", re.IGNORECASE)
patched = 0
for q in q_rows:
    if q["reward_glimmer"] and q["reward_glimmer"] > 0:
        continue
    if not q["reward"]:
        continue
    m = _glim_re.search(q["reward"])
    if m:
        cur.execute("UPDATE user_quests SET reward_glimmer=%s WHERE id=%s", (int(m.group(1)), q["id"]))
        patched += 1
print(f"    parsed {patched} user_quest rewards")


print(">>> Creating glimmer_transactions ledger")
run("""
CREATE TABLE IF NOT EXISTS glimmer_transactions (
    id         SERIAL PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount     INTEGER NOT NULL,
    source     VARCHAR(40) NOT NULL,
    ref_id     VARCHAR(80),
    memo       VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
)
""")
run("CREATE INDEX IF NOT EXISTS idx_glimmer_tx_user ON glimmer_transactions(user_id, created_at DESC)")


print(">>> Creating referrals audit table")
run("""
CREATE TABLE IF NOT EXISTS referrals (
    id             SERIAL PRIMARY KEY,
    referrer_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    referee_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status         VARCHAR(20) NOT NULL DEFAULT 'pending',
    reward_amount  INTEGER NOT NULL DEFAULT 100,
    created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    verified_at    TIMESTAMP,
    UNIQUE(referee_id)
)
""")


print(">>> Adding user_id + is_public to decks")
run("ALTER TABLE decks ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE SET NULL")
run("ALTER TABLE decks ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT TRUE")
# All existing decks were community-facing, so keep is_public=TRUE (default). Link user_id from username.
print(">>> Linking existing decks.user_id from username")
cur.execute("""
    UPDATE decks d
    SET user_id = u.id
    FROM users u
    WHERE d.user_id IS NULL
      AND d.username IS NOT NULL
      AND lower(u.nickname) = lower(d.username)
""")
print(f"    linked {cur.rowcount} decks")


print(">>> Ensuring index for personal deck lookup")
run("CREATE INDEX IF NOT EXISTS idx_decks_user_public ON decks(user_id, is_public)")


print("\n✅ Migration complete.")
conn.close()
