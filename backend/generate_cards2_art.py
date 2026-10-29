#!/usr/bin/env python3
"""
GlimmerFall - Batch Card Art Generator & Vercel Blob Uploader
Generates card illustrations using AI image generation APIs (e.g. Fal.ai / Replicate)
and directly stores them in Vercel Blob, writing the URLs to NEONDB cards2 table.
"""

import os
import re
import sys
import time
import json
import argparse
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
REPLICATE_API_TOKEN = os.environ.get("REPLICATE_API_TOKEN")

def slugify(text):
    text = str(text).lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    return re.sub(r"[\s_-]+", "_", text)

def upload_to_vercel_blob(pathname, data, content_type="image/webp"):
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

def generate_art_fal(prompt, model="fal-ai/flux/schnell", fal_key=None):
    """
    Generates an image via Fal.ai API.
    FLUX.1 [schnell] is extremely fast (~1-2 seconds per image) and costs ~$0.003/image.
    """
    api_key = fal_key or os.environ.get("FAL_KEY")
    if not api_key:
        raise ValueError("Missing FAL_KEY. Set FAL_KEY in .env or pass --api-key.")

    # Enhance prompt with trading-card framing rules if needed
    enhanced_prompt = prompt
    if "vertical 2:3 composition" not in prompt:
        enhanced_prompt = (
            f"Premium fantasy trading card game illustration of {prompt}. "
            "Cinematic volumetric lighting, intricate details, vivid atmospheric colors, "
            "vertical 2:3 composition, crisp silhouette, highly detailed digital painting."
        )

    url = f"https://fal.run/{model}"
    headers = {
        "Authorization": f"Key {api_key}",
        "Content-Type": "application/json"
    }
    payload = {
        "prompt": enhanced_prompt,
        "image_size": {
            "width": 768,
            "height": 1024
        },
        "num_inference_steps": 4 if "schnell" in model else 28,
        "enable_safety_checker": False
    }

    resp = requests.post(url, headers=headers, json=payload, timeout=60)
    if resp.status_code != 200:
        raise RuntimeError(f"Fal.ai request failed ({resp.status_code}): {resp.text}")

    result = resp.json()
    images = result.get("images") or []
    if not images or not images[0].get("url"):
        raise RuntimeError(f"No image URL returned by Fal: {result}")

    img_url = images[0]["url"]
    img_resp = requests.get(img_url, timeout=30)
    if img_resp.status_code != 200:
        raise RuntimeError(f"Failed to download generated image from {img_url}")

    return img_resp.content, "image/webp"

def generate_art_replicate(prompt, replicate_token=None):
    """
    Generates an image via Replicate API (FLUX.1-schnell).
    """
    token = replicate_token or os.environ.get("REPLICATE_API_TOKEN")
    if not token:
        raise ValueError("Missing REPLICATE_API_TOKEN.")

    url = "https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Prefer": "wait"
    }
    payload = {
        "input": {
            "prompt": prompt,
            "aspect_ratio": "2:3",
            "output_format": "webp"
        }
    }
    resp = requests.post(url, headers=headers, json=payload, timeout=90)
    result = resp.json()
    output = result.get("output")
    if not output:
        raise RuntimeError(f"Replicate error: {result}")
    img_url = output[0] if isinstance(output, list) else output
    img_resp = requests.get(img_url, timeout=30)
    return img_resp.content, "image/webp"

def process_card(card, provider="fal", model="fal-ai/flux/schnell", api_key=None):
    card_id = str(card["id"])
    name = card["name"]
    prompt = card.get("ai_art_prompt") or card.get("image_prompt") or f"A fantasy card named {name}"

    try:
        if provider == "fal":
            img_data, ctype = generate_art_fal(prompt, model=model, fal_key=api_key)
        elif provider == "replicate":
            img_data, ctype = generate_art_replicate(prompt, replicate_token=api_key)
        else:
            raise ValueError(f"Unknown provider: {provider}")

        # Upload directly to Vercel Blob
        pathname = f"glimmerfall/cards2/{slugify(name)}_{card_id[:8]}.webp"
        blob_url = upload_to_vercel_blob(pathname, img_data, content_type=ctype)
        return card_id, name, blob_url, None
    except Exception as e:
        return card_id, name, None, str(e)

def main():
    parser = argparse.ArgumentParser(description="Batch generate card art for NEONDB cards2 into Vercel Blob.")
    parser.add_argument("--provider", default="fal", choices=["fal", "replicate"], help="AI Provider (default: fal)")
    parser.add_argument("--model", default="fal-ai/flux/schnell", help="Model name (e.g. fal-ai/flux/schnell or fal-ai/flux/dev)")
    parser.add_argument("--api-key", default=None, help="API key for the provider (or set FAL_KEY in .env)")
    parser.add_argument("--limit", type=int, default=222, help="Number of cards to process (default: 222)")
    parser.add_argument("--workers", type=int, default=5, help="Number of concurrent generation workers (default: 5)")
    parser.add_argument("--dry-run", action="store_true", help="Inspect cards to process without generating")
    args = parser.parse_args()

    if not DATABASE_URL:
        print("ERROR: DATABASE_URL not set in .env")
        sys.exit(1)
    if not BLOB_TOKEN and not args.dry_run:
        print("ERROR: BLOB_READ_WRITE_TOKEN not set in .env")
        sys.exit(1)

    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor(cursor_factory=RealDictCursor)

    # Query cards needing art in cards2
    cur.execute("""
        SELECT id, name, ai_art_prompt, image_prompt, set_name, set_code 
        FROM cards2 
        WHERE (image_url IS NULL OR image_url = '') 
          AND (ai_art_prompt IS NOT NULL OR image_prompt IS NOT NULL)
        ORDER BY id
        LIMIT %s;
    """, (args.limit,))
    cards = cur.fetchall()

    print("=" * 65)
    print(f" GlimmerFall Batch Card Art Generation")
    print(f" Provider: {args.provider.upper()} ({args.model})")
    print(f" Target cards to generate: {len(cards)} (Requested limit: {args.limit})")
    print("=" * 65)

    if not cards:
        print("No cards found needing art in cards2!")
        return

    if args.dry_run:
        print(f"\n[DRY RUN] Found {len(cards)} cards ready for generation:")
        for idx, c in enumerate(cards[:10], 1):
            p = (c.get('ai_art_prompt') or c.get('image_prompt') or '')[:70]
            print(f"  {idx}. [{c['id'][:8]}] {c['name']} ({c['set_code']}): {p}...")
        if len(cards) > 10:
            print(f"  ... and {len(cards) - 10} more.")
        return

    key = args.api_key or (FAL_KEY if args.provider == "fal" else REPLICATE_API_TOKEN)
    if not key:
        print(f"\n[ERROR] Missing API key for {args.provider}.")
        print(f"Please pass --api-key <YOUR_KEY> or add FAL_KEY in backend/.env")
        return

    print(f"\nStarting generation of {len(cards)} pictures with {args.workers} workers...")
    success_count = 0
    fail_count = 0

    with ThreadPoolExecutor(max_workers=args.workers) as executor:
        futures = {
            executor.submit(process_card, card, args.provider, args.model, key): card
            for card in cards
        }
        for idx, fut in enumerate(as_completed(futures), 1):
            card_id, name, blob_url, err = fut.result()
            if err:
                fail_count += 1
                print(f"[{idx}/{len(cards)}] FAILED {name}: {err}")
            else:
                success_count += 1
                # Write to database immediately
                cur.execute("UPDATE cards2 SET image_url = %s WHERE id = %s", (blob_url, card_id))
                conn.commit()
                print(f"[{idx}/{len(cards)}] SUCCESS {name} -> {blob_url}")

    cur.close()
    conn.close()
    print("\n" + "=" * 65)
    print(f"Done! Successfully generated and uploaded: {success_count}, Failed: {fail_count}")
    print("=" * 65)

if __name__ == "__main__":
    main()
