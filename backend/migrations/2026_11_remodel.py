import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from migrations.remodel_2026_11 import STATEMENTS, migrate  # noqa: F401, E402

if __name__ == "__main__":
    dsn = os.environ.get("DATABASE_URL")
    if not dsn:
        sys.exit("DATABASE_URL not set")
    migrate(dsn)
    print("migration ok")
