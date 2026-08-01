import re

with open('/home/ewilliamhe/GlimmerFall2/build_tuckboxes.py', 'r') as f:
    content = f.read()

# 1. Add SPINE_RECT
rect_old = """BACK_RECT = fitz.Rect(323.4, 281.3, 323.4 + PANEL_WIDTH, 281.3 + PANEL_HEIGHT)
FRONT_RECT = fitz.Rect(550.4, 281.3, 550.4 + PANEL_WIDTH, 281.3 + PANEL_HEIGHT)"""
rect_new = """BACK_RECT = fitz.Rect(323.4, 281.3, 323.4 + PANEL_WIDTH, 281.3 + PANEL_HEIGHT)
FRONT_RECT = fitz.Rect(550.4, 281.3, 550.4 + PANEL_WIDTH, 281.3 + PANEL_HEIGHT)
SPINE_WIDTH = 42.7
SPINE_RECT = fitz.Rect(507.7, 281.3, 507.7 + SPINE_WIDTH, 281.3 + PANEL_HEIGHT)
PX_SPINE_W = int((SPINE_WIDTH / 72.0) * DPI)"""
content = content.replace(rect_old, rect_new)

# 2. Remove Logo from Front
logo_front = """    # Add logo
    logo = Image.open(LOGO_PATH).convert("RGBA")
    logo_w = int(PX_W * 0.8)
    logo_h = int(logo.height * (logo_w / logo.width))
    logo = logo.resize((logo_w, logo_h), Image.Resampling.LANCZOS)
    front_img.alpha_composite(logo, ((PX_W - logo_w)//2, 50))
    """
content = content.replace(logo_front, "")

# 3. Add Logo to Back Panel
back_url_old = """    url = "GlimmerFallTCG.com"
    bbox = draw.textbbox((0,0), url, font=font)
    tw = bbox[2] - bbox[0]
    draw.text(((PX_W - tw)//2, PX_H - 150), url, font=font, fill=(255,200,50,255))"""

back_url_new = """    url = "GlimmerFallTCG.com"
    bbox = draw.textbbox((0,0), url, font=font)
    tw = bbox[2] - bbox[0]
    draw.text(((PX_W - tw)//2, PX_H - 100), url, font=font, fill=(255,200,50,255))
    
    # Add logo to back panel above the URL
    logo = Image.open(LOGO_PATH).convert("RGBA")
    logo_w = int(PX_W * 0.7)
    logo_h = int(logo.height * (logo_w / logo.width))
    logo = logo.resize((logo_w, logo_h), Image.Resampling.LANCZOS)
    # Place logo around y = PX_H - 100 - logo_h - 40
    back_img.alpha_composite(logo, ((PX_W - logo_w)//2, PX_H - 140 - logo_h))"""
content = content.replace(back_url_old, back_url_new)

# 4. Create Spine Image and Insert it
insert_old = """    page.insert_image(FRONT_RECT, filename=front_temp, overlay=False)
    page.insert_image(BACK_RECT, filename=back_temp, overlay=False)"""

insert_new = """    # Create Spine Panel (Darkened crop of the center of base_img)
    spine_img = base_img.crop(((base_img.width - PX_SPINE_W)//2, 0, (base_img.width + PX_SPINE_W)//2, base_img.height))
    spine_img = spine_img.resize((PX_SPINE_W, PX_H), Image.Resampling.LANCZOS)
    spine_enhancer = ImageEnhance.Brightness(spine_img)
    spine_img = spine_enhancer.enhance(0.4)
    spine_temp = f"/tmp/spine_{deck['name'].replace(' ', '_')}.png"
    spine_img.save(spine_temp)

    page.insert_image(FRONT_RECT, filename=front_temp, overlay=False)
    page.insert_image(BACK_RECT, filename=back_temp, overlay=False)
    page.insert_image(SPINE_RECT, filename=spine_temp, overlay=False)"""
content = content.replace(insert_old, insert_new)

with open('/home/ewilliamhe/GlimmerFall2/build_tuckboxes.py', 'w') as f:
    f.write(content)
