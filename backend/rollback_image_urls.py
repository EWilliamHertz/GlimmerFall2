#!/usr/bin/env python3
import os
import json
import psycopg2
from dotenv import load_dotenv

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(ROOT_DIR, ".env"))

DATABASE_URL = os.environ.get("DATABASE_URL")
BACKUP_FILE = os.path.join(ROOT_DIR, "migration_backup_urls.json")

def main():
    if not os.path.exists(BACKUP_FILE):
        print(f"No backup file found at {BACKUP_FILE}")
        return
        
    with open(BACKUP_FILE, "r") as f:
        data = json.load(f)
        
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    
    for c in data.get("cards", []):
        cur.execute("UPDATE cards SET image_url = %s WHERE id = %s", (c["image_url"], c["id"]))
        
    for s in data.get("shop_products", []):
        cur.execute("UPDATE shop_products SET image_url = %s WHERE id = %s", (s["image_url"], s["id"]))
        
    for u in data.get("users", []):
        cur.execute("UPDATE users SET avatar = %s WHERE id = %s", (u["avatar"], u["id"]))
        
    conn.commit()
    cur.close()
    conn.close()
    print("Successfully restored original image URLs from backup!")

if __name__ == "__main__":
    main()
