#!/usr/bin/env python3
"""
GlimmerFall - Batch Card Art Generator & Vercel Blob Uploader
Generates high-definition card illustrations using Fal.ai FLUX.1 [dev]
(https://fal.ai/models/fal-ai/flux/dev/api) and directly stores them in Vercel Blob,
writing the URLs to the NEONDB cards2 table.
"""

import os
import re
import sys
import time
import json
import argparse
import hashlib
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

# Load environment
ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(ROOT_DIR, ".env"))

DATABASE_URL = os.environ.get("DATABASE_URL")
BLOB_TOKEN = os.environ.get("BLOB_READ_WRITE_TOKEN")
FAL_KEY = os.environ.get("FAL_KEY")

FAL_FLUX_DEV_MODEL = "fal-ai/flux/dev"

def slugify(text):
    text = str(text).lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    return re.sub(r"[\s_-]+", "_", text)

def upload_to_vercel_blob(pathname, data, content_type="image/webp"):
    """
    Directly streams image binary to Vercel Blob store using the read-write token.
    """
    url = f"https://blob.vercel-storage.com/{pathname}"
    headers = {
        "Authorization": f"Bearer {BLOB_TOKEN}",
        "x-api-version": "7",
        "content-type": content_type
    }
    resp = requests.put(url, headers=headers, data=data, timeout=45)
    if resp.status_code not in (200, 201):
        raise RuntimeError(f"Vercel Blob upload failed ({resp.status_code}): {resp.text}")
    return resp.json()["url"]

def generate_art_fal_dev(prompt, api_key=None, aspect_ratio="3:4", num_steps=28, guidance_scale=3.5):
    """
    Calls Fal.ai FLUX.1 [dev] API (https://fal.ai/models/fal-ai/flux/dev/api).
    Handles both direct synchronous endpoints and queue polling for maximum reliability.
    """
    key = api_key or FAL_KEY
    if not key:
        raise ValueError("Missing FAL_KEY. Please provide --api-key or set FAL_KEY in backend/.env")

    # Polish card art framing if prompt does not already specify style
    enhanced_prompt = prompt
    if "trading card" not in prompt.lower():
        enhanced_prompt = (
            f"Masterpiece fantasy trading card illustration of {prompt}. "
            "Epic composition, cinematic dramatic lighting, intricate digital painting, "
            "rich colors, atmospheric depth, crisp character focal point."
        )

    headers = {
        "Authorization": f"Key {key}",
        "Content-Type": "application/json"
    }

    # Dimensions tailored for portrait TCG card frames (3:4 ratio)
    payload = {
        "prompt": enhanced_prompt,
        "image_size": {
            "width": 768,
            "height": 1024
        },
        "num_inference_steps": num_steps,
        "guidance_scale": guidance_scale,
        "enable_safety_checker": False
    }

    # Attempt synchronous execution
    sync_url = f"https://fal.run/{FAL_FLUX_DEV_MODEL}"
    try:
        resp = requests.post(sync_url, headers=headers, json=payload, timeout=90)
        if resp.status_code == 200:
            result = resp.json()
            images = result.get("images") or []
            if images and images[0].get("url"):
                img_url = images[0]["url"]
                dl_resp = requests.get(img_url, timeout=30)
                if dl_resp.status_code == 200:
                    return dl_resp.content, "image/webp"
    except requests.exceptions.RequestException:
        pass

    # Fallback to queue API if synchronous endpoint times out or queues
    queue_url = f"https://queue.fal.run/{FAL_FLUX_DEV_MODEL}"
    q_resp = requests.post(queue_url, headers=headers, json=payload, timeout=30)
    if q_resp.status_code not in (200, 201):
        raise RuntimeError(f"Fal queue submission failed ({q_resp.status_code}): {q_resp.text}")
    
    q_data = q_resp.json()
    status_url = q_data.get("status_url")
    response_url = q_data.get("response_url")

    # Poll queue status
    for _ in range(60):
        time.sleep(2)
        s_resp = requests.get(status_url, headers=headers, timeout=15)
        if s_resp.status_code == 200:
            s_data = s_resp.json()
            if s_data.get("status") == "COMPLETED":
                r_resp = requests.get(response_url, headers=headers, timeout=15)
                res = r_resp.json()
                images = res.get("images") or []
                if images and images[0].get("url"):
                    img_url = images[0]["url"]
                    dl_resp = requests.get(img_url, timeout=30)
                    return dl_resp.content, "image/webp"
            elif s_data.get("status") in ("FAILED", "CANCELLED"):
                raise RuntimeError(f"Fal generation failed: {s_data}")

    raise TimeoutError("Fal.ai FLUX.1 [dev] queued task timed out after 120s")

def process_card(card, api_key):
    """
    Generates art for a single card and uploads to Vercel Blob.
    Returns (card_id, card_name, blob_url, error)
    """
    card_id = card["id"]
    name = card["name"]
    prompt = card.get("ai_art_prompt") or card.get("image_prompt") or name

    try:
        img_bytes, mime_type = generate_art_fal_dev(prompt, api_key=api_key)
        
        # Unique blob pathname
        slug = slugify(name)
        short_hash = hashlib.md5(card_id.encode()).hexdigest()[:8]
        pathname = f"glimmerfall/cards2/{slug}_{short_hash}.webp"

        blob_url = upload_to_vercel_blob(pathname, img_bytes, mime_type)
        return (card_id, name, blob_url, None)
    except Exception as e:
        return (card_id, name, None, str(e))

def main():
    parser = argparse.ArgumentParser(description="Generate card art with Fal.ai FLUX.1 [dev] and upload to Vercel Blob")
    parser.add_argument("--api-key", default=None, help="Fal.ai API key (overrides FAL_KEY in .env)")
    parser.add_argument("--limit", type=int, default=222, help="Number of cards to process (default: 222)")
    parser.add_argument("--workers", type=int, default=4, help="Number of concurrent workers (default: 4)")
    parser.add_argument("--card-id", default=None, help="Process a single card by UUID")
    parser.add_argument("--dry-run", action="store_true", help="Preview cards and prompts without generating")
    args = parser.parse_args()

    if not DATABASE_URL:
        print("ERROR: DATABASE_URL not set in backend/.env")
        sys.exit(1)
    if not BLOB_TOKEN and not args.dry_run:
        print("ERROR: BLOB_READ_WRITE_TOKEN not set in backend/.env")
        sys.exit(1)

    key = args.api_key or FAL_KEY
    if not key and not args.dry_run:
        print("=" * 70)
        print("ERROR: FAL_KEY is not set.")
        print("You can set FAL_KEY in backend/.env or pass --api-key <YOUR_KEY>.")
        print("Example:")
        print("  python3 backend/generate_cards2_art.py --api-key 'key_...' --limit 222")
        print("=" * 70)
        sys.exit(1)

    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor(cursor_factory=RealDictCursor)

    if args.card_id:
        cur.execute("""
            SELECT id, name, ai_art_prompt, image_prompt, set_name, set_code, faction 
            FROM cards2 
            WHERE id = %s
        """, (args.card_id,))
    else:
        cur.execute("""
            SELECT id, name, ai_art_prompt, image_prompt, set_name, set_code, faction 
            FROM cards2 
            WHERE (image_url IS NULL OR image_url = '') 
              AND (ai_art_prompt IS NOT NULL OR image_prompt IS NOT NULL)
              AND name NOT IN (SELECT name FROM cards)
            ORDER BY collector_number NULLS LAST, id
            LIMIT %s;
        """, (args.limit,))

    cards = cur.fetchall()

    print("=" * 70)
    print(f" GlimmerFall Batch Card Art Generator")
    print(f" Model: {FAL_FLUX_DEV_MODEL}")
    print(f" Target cards: {len(cards)} (Requested limit: {args.limit})")
    print("=" * 70)

    if not cards:
        print("All cards in cards2 already have art! No cards left to generate.")
        return

    if args.dry_run:
        print(f"\n[DRY RUN] Found {len(cards)} cards ready for generation:")
        for idx, c in enumerate(cards[:15], 1):
            prompt = (c.get("ai_art_prompt") or c.get("image_prompt") or "")[:85]
            print(f"  {idx:3d}. [{c['set_code'] or 'EXP1'}] {c['name']} ({c['faction']})")
            print(f"       Prompt: {prompt}...")
        if len(cards) > 15:
            print(f"  ... and {len(cards) - 15} more cards.")
        print("\nDry run completed successfully. Run without --dry-run to generate.")
        return

    print(f"\nStarting batch generation of {len(cards)} cards using {args.workers} workers...")
    success = 0
    failed = 0
    start_time = time.time()

    with ThreadPoolExecutor(max_workers=args.workers) as executor:
        futures = {
            executor.submit(process_card, card, key): card
            for card in cards
        }
        for idx, fut in enumerate(as_completed(futures), 1):
            card_id, name, blob_url, err = fut.result()
            if err:
                failed += 1
                print(f"[{idx:3d}/{len(cards)}] FAILED {name}: {err}")
            else:
                success += 1
                # Save to database immediately
                cur.execute("UPDATE cards2 SET image_url = %s WHERE id = %s", (blob_url, card_id))
                conn.commit()
                elapsed = int(time.time() - start_time)
                print(f"[{idx:3d}/{len(cards)}] OK [{elapsed}s] {name} -> {blob_url}")

    cur.close()
    conn.close()
    print("\n" + "=" * 70)
    print(f"Batch generation complete!")
    print(f"Successfully generated & uploaded: {success}")
    print(f"Failed: {failed}")
    print(f"Elapsed time: {int(time.time() - start_time)} seconds")
    print("=" * 70)

if __name__ == "__main__":
    main()
