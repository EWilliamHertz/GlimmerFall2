#!/usr/bin/env python3
import os
import re
import json
import time
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed
import psycopg2
from dotenv import load_dotenv

# Load environment
ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(ROOT_DIR, ".env"))

DATABASE_URL = os.environ.get("DATABASE_URL")
BLOB_TOKEN = os.environ.get("BLOB_READ_WRITE_TOKEN")

if not DATABASE_URL or not BLOB_TOKEN:
    raise ValueError("Missing DATABASE_URL or BLOB_READ_WRITE_TOKEN in .env")

BACKUP_FILE = os.path.join(ROOT_DIR, "migration_backup_urls.json")
SESSION = requests.Session()
SESSION.headers.update({"User-Agent": "curl/8.5.0"})

def slugify(text):
    text = str(text).lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    return re.sub(r"[\s_-]+", "_", text)

def get_content_type(url, content):
    if url.endswith(".webp") or content[:4] == b"RIFF":
        return "image/webp", "webp"
    elif url.endswith(".png") or content[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png", "png"
    elif url.endswith(".svg") or b"<svg" in content[:200]:
        return "image/svg+xml", "svg"
    else:
        return "image/jpeg", "jpg"

def upload_to_vercel_blob(pathname, data, content_type):
    url = f"https://blob.vercel-storage.com/{pathname}"
    headers = {
        "Authorization": f"Bearer {BLOB_TOKEN}",
        "x-api-version": "7",
        "content-type": content_type
    }
    resp = requests.put(url, headers=headers, data=data, timeout=30)
    if resp.status_code not in (200, 201):
        raise RuntimeError(f"Vercel Blob upload failed ({resp.status_code}): {resp.text}")
    return resp.json()["url"]

def migrate_asset(item):
    item_type, item_id, name, old_url = item
    try:
        # Download old image
        res = SESSION.get(old_url, timeout=20)
        res.raise_exception = True
        if res.status_code != 200:
            return item, None, f"HTTP {res.status_code}"
        
        data = res.content
        ctype, ext = get_content_type(old_url, data)
        
        # Determine blob pathname
        if item_type == "card":
            pathname = f"glimmerfall/cards/{slugify(name)}.{ext}"
        elif item_type == "shop":
            pathname = f"glimmerfall/products/{slugify(name)}.{ext}"
        elif item_type == "user":
            pathname = f"glimmerfall/avatars/{item_id}.{ext}"
        elif item_type == "static":
            pathname = f"glimmerfall/static/{slugify(name)}.{ext}"
        else:
            pathname = f"glimmerfall/misc/{slugify(name)}.{ext}"
            
        new_url = upload_to_vercel_blob(pathname, data, ctype)
        return item, new_url, None
    except Exception as e:
        return item, None, str(e)

def main():
    print("=" * 60)
    print(" GlimmerFall -> Vercel Blob Image Migration")
    print("=" * 60)
    
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    
    # 1. Collect all assets to migrate
    cur.execute("SELECT id, name, image_url FROM cards WHERE image_url IS NOT NULL AND image_url != '';")
    cards = [("card", str(r[0]), r[1], r[2]) for r in cur.fetchall()]
    
    cur.execute("SELECT id, name, image_url FROM shop_products WHERE image_url IS NOT NULL AND image_url != '';")
    shop_products = [("shop", str(r[0]), r[1], r[2]) for r in cur.fetchall()]
    
    cur.execute("SELECT id, 'User Avatar', avatar FROM users WHERE avatar IS NOT NULL AND avatar LIKE 'http%';")
    users = [("user", str(r[0]), "avatar", r[2]) for r in cur.fetchall()]
    
    static_assets = [
        ("static", "cardback", "baked_cardback", "https://res.cloudinary.com/dfyh7cs1g/image/upload/v1784376716/glimmerfall/baked_cardback.png"),
        ("static", "rarity_common", "rarity_common", "https://res.cloudinary.com/dfyh7cs1g/image/upload/v1784383884/glimmerfall/rarity_icons/common.svg"),
        ("static", "rarity_uncommon", "rarity_uncommon", "https://res.cloudinary.com/dfyh7cs1g/image/upload/v1784383885/glimmerfall/rarity_icons/uncommon.svg"),
        ("static", "rarity_mythic", "rarity_mythic", "https://res.cloudinary.com/dfyh7cs1g/image/upload/v1784383891/glimmerfall/rarity_icons/mythic.svg"),
        ("static", "rarity_rare", "rarity_rare", "https://res.cloudinary.com/dfyh7cs1g/image/upload/v1784383889/glimmerfall/rarity_icons/rare.svg"),
        ("static", "hero_bg", "hero_bg", "https://static.prod-images.emergentagent.com/jobs/b8c31a9c-2781-4f44-b53e-2f632cd70450/images/6b32b9586616bef4733ae73acd6ec2dcad2406fd070f4347b9c293262a10af01.png")
    ]
    
    all_items = cards + shop_products + users + static_assets
    print(f"Total items to migrate: {len(all_items)}")
    print(f"  - Cards: {len(cards)}")
    print(f"  - Shop products: {len(shop_products)}")
    print(f"  - User avatars: {len(users)}")
    print(f"  - Static assets: {len(static_assets)}")
    
    # 2. Save backup
    backup_data = {
        "timestamp": time.time(),
        "cards": [{ "id": c[1], "name": c[2], "image_url": c[3] } for c in cards],
        "shop_products": [{ "id": s[1], "name": s[2], "image_url": s[3] } for s in shop_products],
        "users": [{ "id": u[1], "avatar": u[3] } for u in users],
        "static": [{ "id": st[1], "name": st[2], "url": st[3] } for st in static_assets]
    }
    with open(BACKUP_FILE, "w") as f:
        json.dump(backup_data, f, indent=2)
    print(f"\n[Backup] Stored backup snapshot in {BACKUP_FILE}")
    
    # 3. Concurrent upload
    print("\n[Migration] Uploading assets to Vercel Blob...")
    results = {}
    errors = []
    
    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = {executor.submit(migrate_asset, item): item for item in all_items}
        done_count = 0
        for fut in as_completed(futures):
            item, new_url, err = fut.result()
            done_count += 1
            if err:
                print(f"  [{done_count}/{len(all_items)}] FAILED {item[0]} {item[2]}: {err}")
                errors.append((item, err))
            else:
                results[item] = new_url
                if done_count % 10 == 0 or done_count == len(all_items):
                    print(f"  Progress: [{done_count}/{len(all_items)}] uploaded")

    print(f"\n[Migration Complete] Successfully uploaded: {len(results)}, Failed: {len(errors)}")
    
    # 4. Update Database
    print("\n[Database] Updating DB records with Vercel Blob URLs...")
    updated_cards = 0
    for item, new_url in results.items():
        item_type, item_id, name, _ = item
        if item_type == "card":
            cur.execute("UPDATE cards SET image_url = %s WHERE id = %s", (new_url, item_id))
            updated_cards += 1
        elif item_type == "shop":
            cur.execute("UPDATE shop_products SET image_url = %s WHERE id = %s", (new_url, item_id))
        elif item_type == "user":
            cur.execute("UPDATE users SET avatar = %s WHERE id = %s", (new_url, item_id))
            
    conn.commit()
    print(f"  - Updated {updated_cards} cards in NEONDB")
    print(f"  - Updated shop products and user avatars in NEONDB")
    
    # 5. Output static asset URLs for code replacement
    static_map = {}
    for item, new_url in results.items():
        if item[0] == "static":
            static_map[item[1]] = new_url
            
    with open(os.path.join(ROOT_DIR, "migrated_static_assets.json"), "w") as f:
        json.dump(static_map, f, indent=2)
        
    print("\n[Static Assets Migration Result]:")
    for k, v in static_map.items():
        print(f"  {k}: {v}")
        
    cur.close()
    conn.close()
    print("\n[Done] All assets migrated to Vercel Blob and paths fixed!")

if __name__ == "__main__":
    main()
