"""Idempotent, additive schema migration for the GlimmerFall remodel (Nov 2026).

Only CREATE TABLE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS / CREATE INDEX IF NOT EXISTS.
Safe to run repeatedly on startup or standalone via CLI.
"""
import os
from pathlib import Path
import sys
import psycopg2
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

STATEMENTS = [
    # matches: lifecycle + mode metadata
    "ALTER TABLE matches ADD COLUMN IF NOT EXISTS mode TEXT",
    "ALTER TABLE matches ADD COLUMN IF NOT EXISTS lobby_code TEXT",
    "ALTER TABLE matches ADD COLUMN IF NOT EXISTS p1_last_seen TIMESTAMPTZ",
    "ALTER TABLE matches ADD COLUMN IF NOT EXISTS p2_last_seen TIMESTAMPTZ",
    "ALTER TABLE matches ADD COLUMN IF NOT EXISTS last_polled TIMESTAMPTZ DEFAULT NOW()",
    "ALTER TABLE matches ADD COLUMN IF NOT EXISTS is_ranked BOOLEAN DEFAULT FALSE",
    "ALTER TABLE matches ADD COLUMN IF NOT EXISTS history JSONB DEFAULT '[]'::jsonb",
    "CREATE INDEX IF NOT EXISTS matches_status_idx ON matches (status)",
    "CREATE INDEX IF NOT EXISTS matches_players_idx ON matches (player1, player2)",
    # users: placement + tutorial
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS placement_games_left INT",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS tutorial_done BOOLEAN DEFAULT FALSE",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS mmr INT DEFAULT 1400",
    # Existing players keep their MMR; those with < 10 PvP games get remaining placement games.
    """UPDATE users SET placement_games_left = GREATEST(0, 10 - (COALESCE(wins,0) + COALESCE(losses,0)))
       WHERE placement_games_left IS NULL""",
    "ALTER TABLE users ALTER COLUMN placement_games_left SET DEFAULT 10",
    # queue
    """CREATE TABLE IF NOT EXISTS queue_entries (
           id SERIAL PRIMARY KEY,
           player TEXT NOT NULL UNIQUE,
           mode TEXT NOT NULL,
           mmr INT NOT NULL DEFAULT 1400,
           deck JSONB NOT NULL,
           deck_name TEXT,
           joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
           last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
           match_id INT
       )""",
    "CREATE INDEX IF NOT EXISTS queue_mode_idx ON queue_entries (mode, match_id)",
    # lobbies
    """CREATE TABLE IF NOT EXISTS lobbies (
           code TEXT PRIMARY KEY,
           host TEXT NOT NULL,
           guest TEXT,
           host_ready BOOLEAN NOT NULL DEFAULT FALSE,
           guest_ready BOOLEAN NOT NULL DEFAULT FALSE,
           host_deck JSONB,
           guest_deck JSONB,
           host_deck_name TEXT,
           guest_deck_name TEXT,
           settings JSONB DEFAULT '{}'::jsonb,
           match_id INT,
           created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
           updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
       )""",
    # rating history
    """CREATE TABLE IF NOT EXISTS rating_history (
           id SERIAL PRIMARY KEY,
           nickname TEXT NOT NULL,
           match_id INT,
           mmr_before INT NOT NULL,
           mmr_after INT NOT NULL,
           created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
       )""",
    "CREATE INDEX IF NOT EXISTS rating_history_nick_idx ON rating_history (nickname, id DESC)",
]


def run_statements(cur):
    for s in STATEMENTS:
        cur.execute(s)


def migrate(dsn):
    conn = psycopg2.connect(dsn)
    try:
        with conn, conn.cursor() as cur:
            run_statements(cur)
    finally:
        conn.close()


if __name__ == "__main__":
    dsn = os.environ.get("DATABASE_URL")
    if not dsn:
        sys.exit("DATABASE_URL not set")
    migrate(dsn)
    print("migration ok")
