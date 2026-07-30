import os
import requests
import base64
from server import DB

IMGBB_API_KEY = "b2492f987920d3e2a7903861b72ae3a4"
ARTIFACTS_DIR = "/home/ewilliamhe/.gemini/antigravity-cli/brain/a390226e-f8e9-4bcc-936b-2212d495461a"

images = {
    "Gaia's Loop": "gaia_box_40_cards_1785390817524.jpg",
    "Solar Singularity": "solar_box_40_cards_1785390835727.jpg",
    "Fractured Continuum": "fractured_box_40_cards_1785391123094.jpg",
    "The Graveglass Veil": "graveglass_box_40_cards_1785391133979.jpg"
}

def upload_to_imgbb(image_path):
    with open(image_path, "rb") as file:
        url = "https://api.imgbb.com/1/upload"
        payload = {
            "key": IMGBB_API_KEY,
            "image": base64.b64encode(file.read()),
        }
        res = requests.post(url, payload)
        return res.json()["data"]["url"]

with DB() as cur:
    for name, filename in images.items():
        print(f"Uploading {name}...")
        img_url = upload_to_imgbb(os.path.join(ARTIFACTS_DIR, filename))
        print(f"Uploaded to {img_url}")
        
        cur.execute("UPDATE shop_products SET image_url=%s WHERE name=%s", (img_url, name))
        print(f"Updated {name} in DB.")
    
    print("Successfully updated all images to 40 cards!")
