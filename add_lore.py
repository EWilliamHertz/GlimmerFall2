import os
import psycopg2
from dotenv import load_dotenv

load_dotenv("/home/ewilliamhe/GlimmerFall2/backend/.env")

conn = psycopg2.connect(os.environ["DATABASE_URL"])
cur = conn.cursor()

# 1. Add lore column
try:
    cur.execute("ALTER TABLE cards ADD COLUMN IF NOT EXISTS lore TEXT")
    conn.commit()
    print("Added lore column successfully.")
except Exception as e:
    conn.rollback()
    print("Error adding column or it already exists:", e)

# 2. Populate some awesome lore for specific cards
lore_data = {
    "Gaia, The World-Soul": "Before the first sun ignited, she dreamt of green. From her breath came the wild roots; from her sorrow, the deep oceans. She is the anchor of Terra, and so long as she slumbers, the world holds its shape.",
    "Emberwing Courier": "Born from the heart of a dying star, these celestial messengers traverse the void at the speed of light. They carry the decrees of the Solari Vanguard, their very presence scorching the atmosphere.",
    "Reality Fracture": "The Aether mages thought they were opening a window to another world. Instead, they shattered the mirror of existence. Now, time bleeds and space folds, a beautiful and terrifying mistake.",
    "Graveglass Oracle": "To look into the Graveglass is to see one's own demise reflected a thousand times. The Oracle does not predict the future; she merely observes the inevitable decay of all things Umbri.",
    "Solari Vanguard": "Clad in armor forged from compressed starlight, the Vanguard stands as the immovable shield of the sun. Where they march, shadows recoil and the night itself burns away.",
    "Aetherial Scholar": "In the grand archives floating above the material plane, the Scholars transcribe the music of the spheres. Every spell is just a note in their cosmic symphony.",
    "Murkborn Informant": "In the lowest levels of the undercity, secrets are currency. The Murkborn know every whisper, every lie, and every shadow—for the right price, they will unravel your enemy's mind.",
    "Ashen Penitent": "They survived the Great Cinder, but their souls were forever charred. Now, they seek redemption in the flames, burning away their weaknesses until only hardened resolve remains."
}

for name, lore_text in lore_data.items():
    cur.execute("UPDATE cards SET lore = %s WHERE name = %s", (lore_text, name))

conn.commit()
print("Populated initial lore for cards.")
