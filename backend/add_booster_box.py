import os
import requests
from server import DB

IMGBB_API_KEY = "b2492f987920d3e2a7903861b72ae3a4"
image_path = "/home/ewilliamhe/.gemini/antigravity-cli/brain/a390226e-f8e9-4bcc-936b-2212d495461a/booster_box_mockup_1785352991522.jpg"

print(f"Uploading Booster Box image...")
with open(image_path, "rb") as file:
    res = requests.post(
        f"https://api.imgbb.com/1/upload?key={IMGBB_API_KEY}",
        files={"image": file}
    )
    data = res.json()
    if data["success"]:
        img_url = data["data"]["url"]
        print(f"Uploaded! URL: {img_url}")
        
        with DB() as cur:
            cur.execute("""
                INSERT INTO shop_products (name, description, price, stock, is_preorder, eta, weight_kg, image_url)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                "The Awakening Booster Box",
                "Secure your physical collector's box. Each booster box contains 30 booster packs, with 10 cards per pack including guaranteed rare or higher drops.",
                62.00,
                0,
                True,
                "December 2026",
                0.8,
                img_url
            ))
            print("Added to DB!")
    else:
        print("Failed to upload image.")
        print(data)
