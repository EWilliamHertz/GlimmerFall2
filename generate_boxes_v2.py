import os
import urllib.request
import requests
from io import BytesIO
from PIL import Image, ImageDraw, ImageFont, ImageFilter

# We will use the system DejaVu font
cinzel_path = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
montserrat_path = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

ARTIFACTS_DIR = "/home/ewilliamhe/GlimmerFall2/tuck_boxes"
os.makedirs(ARTIFACTS_DIR, exist_ok=True)

decks = [
    {
        "id": "gaias_loop",
        "name": "Gaia's Loop",
        "art_url": "https://res.cloudinary.com/dfyh7cs1g/image/upload/glimmerfall/card_renders/gaia_the_world-soul.webp",
        "color": (34, 224, 123)  # #22E07B
    },
    {
        "id": "solar_singularity",
        "name": "Solar Singularity",
        "art_url": "https://res.cloudinary.com/dfyh7cs1g/image/upload/v1783959854/glimmerfall/card_renders/emberwing_courier.webp",
        "color": (242, 169, 0)  # #F2A900
    },
    {
        "id": "aetherial_distortion",
        "name": "Aetherial Distortion",
        "art_url": "https://res.cloudinary.com/dfyh7cs1g/image/upload/v1783960001/glimmerfall/card_renders/reality_fracture.webp",
        "color": (56, 204, 255)  # #38CCFF
    },
    {
        "id": "graveglass_prophecy",
        "name": "Graveglass Prophecy",
        "art_url": "https://res.cloudinary.com/dfyh7cs1g/image/upload/v1783959905/glimmerfall/card_renders/graveglass_oracle.webp",
        "color": (155, 48, 255)  # #9B30FF
    }
]

logo_path = "/home/ewilliamhe/GlimmerFall2/frontend/public/glimmerfall-logo.png"
if os.path.exists(logo_path):
    logo = Image.open(logo_path).convert("RGBA")
else:
    logo = Image.new("RGBA", (400, 150), (255, 255, 255, 0))
logo.thumbnail((550, 550), Image.Resampling.LANCZOS)

WIDTH = 2067
HEIGHT = 1063

try:
    font_title = ImageFont.truetype(cinzel_path, 80)
    font_sub = ImageFont.truetype(montserrat_path, 42)
    font_spine = ImageFont.truetype(cinzel_path, 60)
except:
    font_title = ImageFont.load_default()
    font_sub = ImageFont.load_default()
    font_spine = ImageFont.load_default()

def draw_text_with_shadow(draw, pos, text, font, fill, shadow_color=(0,0,0,200), offset=(3,3), anchor="mm"):
    x, y = pos
    draw.text((x+offset[0], y+offset[1]), text, font=font, fill=shadow_color, anchor=anchor)
    draw.text((x, y), text, font=font, fill=fill, anchor=anchor)

def create_gradient_overlay(w, h):
    gradient = Image.new('RGBA', (w, h), (0,0,0,0))
    draw = ImageDraw.Draw(gradient)
    # Top gradient (dark to transparent)
    for y in range(350):
        alpha = int(255 * (1 - y/350))
        draw.line([(0, y), (w, y)], fill=(0,0,0,alpha))
    # Bottom gradient (transparent to dark)
    for y in range(h - 300, h):
        alpha = int(255 * ((y - (h - 300))/300))
        draw.line([(0, y), (w, y)], fill=(0,0,0,alpha))
    return gradient

for deck in decks:
    print(f"Generating premium {deck['name']}...")
    img = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 255))
    
    # Fetch artwork
    resp = requests.get(deck["art_url"])
    art = Image.open(BytesIO(resp.content)).convert("RGBA")
    
    # 1. Create full wrap blurred background
    bg_art = art.copy()
    bg_ratio = bg_art.width / bg_art.height
    canvas_ratio = WIDTH / HEIGHT
    if bg_ratio > canvas_ratio:
        new_w = int(HEIGHT * bg_ratio)
        bg_art = bg_art.resize((new_w, HEIGHT), Image.Resampling.LANCZOS)
        left = (new_w - WIDTH) // 2
        bg_art = bg_art.crop((left, 0, left + WIDTH, HEIGHT))
    else:
        new_h = int(WIDTH / bg_ratio)
        bg_art = bg_art.resize((WIDTH, new_h), Image.Resampling.LANCZOS)
        top = (new_h - HEIGHT) // 2
        bg_art = bg_art.crop((0, top, WIDTH, top + HEIGHT))
        
    bg_art = bg_art.filter(ImageFilter.GaussianBlur(radius=25))
    img.paste(bg_art, (0,0))
    # Darken background
    dark_overlay = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 160))
    img = Image.alpha_composite(img, dark_overlay)
    
    draw = ImageDraw.Draw(img)

    # 2. Prepare sharp panel artwork
    panel_w, panel_h = 768, 1063
    art_ratio = art.width / art.height
    panel_ratio = panel_w / panel_h
    
    if art_ratio > panel_ratio:
        new_w = int(panel_h * art_ratio)
        panel_art = art.resize((new_w, panel_h), Image.Resampling.LANCZOS)
        left = (new_w - panel_w) // 2
        panel_art = panel_art.crop((left, 0, left + panel_w, panel_h))
    else:
        new_h = int(panel_w / art_ratio)
        panel_art = art.resize((panel_w, new_h), Image.Resampling.LANCZOS)
        top = (new_h - panel_h) // 2
        panel_art = panel_art.crop((0, top, panel_w, top + panel_h))

    # Add gradient overlay to panel art for text readability
    grad_overlay = create_gradient_overlay(panel_w, panel_h)
    panel_art = Image.alpha_composite(panel_art, grad_overlay)

    # 3. Paste panels
    back_x = 177
    front_x = 177 + 768 + 177
    img.paste(panel_art, (back_x, 0))
    img.paste(panel_art, (front_x, 0))
    
    # 4. Draw Premium Borders
    fc = deck["color"]
    for px in [back_x, front_x]:
        # Outer thick border
        draw.rectangle([px, 0, px + panel_w - 1, HEIGHT - 1], outline=fc, width=8)
        # Inner thin border
        draw.rectangle([px + 15, 15, px + panel_w - 16, HEIGHT - 16], outline=(255,255,255,100), width=2)
        
    # 5. Draw Spines (darker overlay)
    draw.rectangle([0, 0, 177, HEIGHT], fill=(0,0,0,200)) # glue
    draw.rectangle([177+768, 0, 177+768+177, HEIGHT], fill=(0,0,0,200)) # left spine
    draw.rectangle([177+768+177+768, 0, WIDTH, HEIGHT], fill=(0,0,0,200)) # right spine
    
    # Spine borders
    draw.line([(177+768, 0), (177+768, HEIGHT)], fill=fc, width=4)
    draw.line([(177+768+177, 0), (177+768+177, HEIGHT)], fill=fc, width=4)

    # Spine text
    spine_txt = Image.new("RGBA", (HEIGHT, 177), (0,0,0,0))
    spine_draw = ImageDraw.Draw(spine_txt)
    draw_text_with_shadow(spine_draw, (HEIGHT//2, 177//2), deck["name"], font=font_spine, fill=(255,255,255,255))
    spine_txt_rot = spine_txt.rotate(90, expand=True)
    img.paste(spine_txt_rot, (177 + 768, 0), spine_txt_rot)

    # 6. Draw Panel Content (Front & Back)
    def draw_panel_content(base_x):
        cx = base_x + panel_w // 2
        
        # Glow behind logo
        glow = Image.new("RGBA", (logo.width+200, logo.height+200), (0,0,0,0))
        glow_draw = ImageDraw.Draw(glow)
        glow_draw.ellipse([0, 0, glow.width, glow.height], fill=fc + (80,))
        glow = glow.filter(ImageFilter.GaussianBlur(radius=50))
        
        logo_y = HEIGHT // 2 - logo.height // 2 + 30
        img.paste(glow, (cx - glow.width // 2, logo_y + logo.height//2 - glow.height//2), glow)
        img.paste(logo, (cx - logo.width // 2, logo_y), logo)
        
        # Deck Name
        title_y = 180
        draw_text_with_shadow(draw, (cx, title_y), deck["name"], font=font_title, fill=(255,255,255,255))
        # Divider line under title
        tw = font_title.getlength(deck["name"])
        draw.line([(cx - tw//2, title_y + 50), (cx + tw//2, title_y + 50)], fill=fc, width=4)
        
        # 40 CARDS DECK
        draw_text_with_shadow(draw, (cx, 930), "40 CARDS DECK", font=font_sub, fill=(220,220,220,255), offset=(2,2))

    draw_panel_content(back_x)
    draw_panel_content(front_x)
    
    out_path = os.path.join(ARTIFACTS_DIR, f"{deck['id']}_tuckbox.png")
    img.save(out_path)
    
    # Also save to artifacts for display
    art_out_path = os.path.join("/home/ewilliamhe/.gemini/antigravity-cli/brain/a390226e-f8e9-4bcc-936b-2212d495461a", f"{deck['id']}_tuckbox.png")
    img.save(art_out_path)
    
    print(f"Saved {out_path}")

print("Done generating premium tuck box designs.")
