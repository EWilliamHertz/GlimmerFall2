import fitz
import os
from PIL import Image, ImageDraw, ImageFont, ImageEnhance
import textwrap

BASE_DIR = "/home/ewilliamhe/GlimmerFall2/Bhuvan_Instructions/Bhuvan Instructions/0.1 GlimmerFall Tuck-Box Production Handoff/"
TEMPLATE_PDF = BASE_DIR + "01_Template/TuckInBox.pdf"
LOGO_PATH = BASE_DIR + "02_Logo/GlimmerFall_official_multicolor_logo.png"

DECKS = [
    {
        "name": "Gaia's Loop",
        "art": "03_Card_Art/gaia_the_world-soul.webp",
        "lore": "The cycle of life and nature is unending. Embrace the power of Terra to crush your foes with overwhelming growth."
    },
    {
        "name": "Solar Singularity",
        "art": "03_Card_Art/emberwing_courier.webp",
        "lore": "Harness the blinding light of the Solari. Burn away the shadows and strike with furious radiance."
    },
    {
        "name": "Fractured Continuum",
        "art": "03_Card_Art/reality_fracture.webp",
        "lore": "Time and space bend to your will. Manipulate reality with Aether and outsmart your opponent's every move."
    },
    {
        "name": "The Graveglass Veil",
        "art": "03_Card_Art/graveglass_oracle.webp",
        "lore": "Step into the shadows of the Umbri. Command the fallen and drain the life force from those who oppose you."
    }
]

# Dieline points
PANEL_WIDTH = 184.25
PANEL_HEIGHT = 255.1
BACK_RECT = fitz.Rect(323.4, 281.3, 323.4 + PANEL_WIDTH, 281.3 + PANEL_HEIGHT)
FRONT_RECT = fitz.Rect(550.4, 281.3, 550.4 + PANEL_WIDTH, 281.3 + PANEL_HEIGHT)
SPINE_WIDTH = 42.7
SPINE_RECT = fitz.Rect(507.7, 281.3, 507.7 + SPINE_WIDTH, 281.3 + PANEL_HEIGHT)

DPI = 300
PX_W = int((PANEL_WIDTH / 72.0) * DPI) # ~767
PX_H = int((PANEL_HEIGHT / 72.0) * DPI) # ~1062
PX_SPINE_W = int((SPINE_WIDTH / 72.0) * DPI)

try:
    font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 48)
    font_small = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 36)
except:
    font = ImageFont.load_default()
    font_small = ImageFont.load_default()

for deck in DECKS:
    # 1. Front Panel
    art_path = BASE_DIR + deck["art"]
    base_img = Image.open(art_path).convert("RGBA")
    
    # Crop/Resize to fit panel
    img_ratio = base_img.width / base_img.height
    panel_ratio = PX_W / PX_H
    if img_ratio > panel_ratio:
        # Image is wider
        new_w = int(base_img.height * panel_ratio)
        offset = (base_img.width - new_w) // 2
        base_img = base_img.crop((offset, 0, offset + new_w, base_img.height))
    else:
        # Image is taller
        new_h = int(base_img.width / panel_ratio)
        offset = (base_img.height - new_h) // 2
        base_img = base_img.crop((0, offset, base_img.width, offset + new_h))
        
    front_img = base_img.resize((PX_W, PX_H), Image.Resampling.LANCZOS)
    

    # Add deck name
    draw = ImageDraw.Draw(front_img)
    text = deck["name"]
    # poor man's text bounding box
    bbox = draw.textbbox((0,0), text, font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    # draw text with shadow
    draw.text(((PX_W - tw)//2 + 2, PX_H - 100 + 2), text, font=font, fill=(0,0,0,255))
    draw.text(((PX_W - tw)//2, PX_H - 100), text, font=font, fill=(255,255,255,255))
    
    front_temp = f"/tmp/front_{deck['name'].replace(' ', '_')}.png"
    front_img.save(front_temp)
    
    # 2. Back Panel
    back_img = base_img.resize((PX_W, PX_H), Image.Resampling.LANCZOS)
    # darken image heavily
    enhancer = ImageEnhance.Brightness(back_img)
    back_img = enhancer.enhance(0.2)
    draw = ImageDraw.Draw(back_img)
    
    wrapped_lore = textwrap.wrap(deck["lore"], width=30)
    y_text = 200
    for line in wrapped_lore:
        bbox = draw.textbbox((0,0), line, font=font_small)
        tw = bbox[2] - bbox[0]
        draw.text(((PX_W - tw)//2, y_text), line, font=font_small, fill=(255,255,255,255))
        y_text += 50
        
    url = "GlimmerFallTCG.com"
    bbox = draw.textbbox((0,0), url, font=font)
    tw = bbox[2] - bbox[0]
    draw.text(((PX_W - tw)//2, PX_H - 100), url, font=font, fill=(255,200,50,255))
    
    # Add logo to back panel above the URL
    logo = Image.open(LOGO_PATH).convert("RGBA")
    logo_w = int(PX_W * 0.7)
    logo_h = int(logo.height * (logo_w / logo.width))
    logo = logo.resize((logo_w, logo_h), Image.Resampling.LANCZOS)
    # Place logo around y = PX_H - 100 - logo_h - 40
    back_img.alpha_composite(logo, ((PX_W - logo_w)//2, PX_H - 140 - logo_h))
    
    back_temp = f"/tmp/back_{deck['name'].replace(' ', '_')}.png"
    back_img.save(back_temp)
    
    # 3. Composite into PDF
    doc = fitz.open(TEMPLATE_PDF)
    page = doc[0]
    
    # Insert images at lowest z-order but wait, dielines are usually on top.
    # PyMuPDF insert_image inserts ON TOP.
    # To put images BEHIND the dieline, we need to create a new page, insert images, then overlay the template, OR just insert them and hope the dieline has no fill.
    # Actually, we can use `overlay=False` in insert_image to place them behind!
    # Create Spine Panel (Darkened crop of the center of base_img)
    spine_img = base_img.crop(((base_img.width - PX_SPINE_W)//2, 0, (base_img.width + PX_SPINE_W)//2, base_img.height))
    spine_img = spine_img.resize((PX_SPINE_W, PX_H), Image.Resampling.LANCZOS)
    spine_enhancer = ImageEnhance.Brightness(spine_img)
    spine_img = spine_enhancer.enhance(0.4)
    spine_temp = f"/tmp/spine_{deck['name'].replace(' ', '_')}.png"
    spine_img.save(spine_temp)

    page.insert_image(FRONT_RECT, filename=front_temp, overlay=False)
    page.insert_image(BACK_RECT, filename=back_temp, overlay=False)
    page.insert_image(SPINE_RECT, filename=spine_temp, overlay=False)
    
    out_pdf = f"/home/ewilliamhe/GlimmerFall2/Bhuvan_Instructions/GlimmerFall_{deck['name'].replace(' ', '_')}_TuckBox.pdf"
    doc.save(out_pdf)
    
    # Render PNG proof
    pix = page.get_pixmap(dpi=150)
    pix.save(f"/home/ewilliamhe/GlimmerFall2/Bhuvan_Instructions/GlimmerFall_{deck['name'].replace(' ', '_')}_TuckBox.png")
    
    print(f"Generated {deck['name']}!")
