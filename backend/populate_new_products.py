import os
import requests
import base64
from server import DB

IMGBB_API_KEY = "b2492f987920d3e2a7903861b72ae3a4"
ARTIFACTS_DIR = "/home/ewilliamhe/.gemini/antigravity-cli/brain/a390226e-f8e9-4bcc-936b-2212d495461a"

images = {
    "Gaia's Loop": "gaias_loop_frontside_1785349203965.jpg",
    "Solar Singularity": "solar_singularity_frontside_1785349444792.jpg",
    "Fractured Continuum": "fractured_continuum_frontside_1785349461611.jpg",
    "The Graveglass Veil": "graveglass_veil_frontside_1785349513409.jpg"
}

descriptions = {
    "Gaia's Loop": "Unstoppable natural growth, giant elemental beasts, and the cyclical power of the earth.",
    "Solar Singularity": "Blinding speed, radiant fire, and overwhelming aggressive Light magic.",
    "Fractured Continuum": "Time manipulation, spell echoing, and disruption of reality itself.",
    "The Graveglass Veil": "Necromancy, forbidden knowledge, and sacrificial shadow magic."
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
    print("Deleting old products...")
    cur.execute("DELETE FROM shop_products")
    
    for name, filename in images.items():
        print(f"Uploading {name}...")
        img_url = upload_to_imgbb(os.path.join(ARTIFACTS_DIR, filename))
        print(f"Uploaded to {img_url}")
        
        cur.execute("""
            INSERT INTO shop_products (name, description, price, stock, is_preorder, eta, weight_kg, image_url)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            name, descriptions[name], 19.99, 0, True, "October 2026", 0.25, img_url
        ))
    
    print("Successfully populated new products in DB!")
