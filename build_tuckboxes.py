#!/usr/bin/env python3
"""
GlimmerFall Tuck-Box Production Tooling
Generates print-ready high-resolution (300 DPI) PDF tuck-box layouts with dielines,
front panel artwork, lore back panel, spine wrap, and web-ready PNG proofs.
"""

import os
import sys
import argparse
import textwrap
import tempfile
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageEnhance

try:
    import pymupdf as fitz
except ImportError:
    try:
        import fitz
    except ImportError:
        print("Error: PyMuPDF is required. Run 'pip install pymupdf Pillow'", file=sys.stderr)
        sys.exit(1)

SCRIPT_DIR = Path(__file__).resolve().parent
BASE_DIR = SCRIPT_DIR / "Bhuvan_Instructions" / "Bhuvan Instructions" / "0.1 GlimmerFall Tuck-Box Production Handoff"
TEMPLATE_PDF = BASE_DIR / "01_Template" / "TuckInBox.pdf"
LOGO_PATH = BASE_DIR / "02_Logo" / "GlimmerFall_official_multicolor_logo.png"

DECKS = [
    {
        "name": "Gaia's Loop",
        "faction": "Terra",
        "art": "03_Card_Art/gaia_the_world-soul.webp",
        "deckbox_3_0": "deckboxes_3.0/IMG_5655.PNG",
        "lore": "The cycle of life and nature is unending. Embrace the power of Terra to crush your foes with overwhelming growth.",
        "accent": (46, 204, 113, 255)
    },
    {
        "name": "Solar Singularity",
        "faction": "Solari",
        "art": "03_Card_Art/emberwing_courier.webp",
        "deckbox_3_0": "deckboxes_3.0/IMG_5654.PNG",
        "lore": "Harness the blinding light of the Solari. Burn away the shadows and strike with furious radiance.",
        "accent": (242, 169, 0, 255)
    },
    {
        "name": "Fractured Continuum",
        "faction": "Aether",
        "art": "03_Card_Art/reality_fracture.webp",
        "deckbox_3_0": "deckboxes_3.0/IMG_5656.PNG",
        "lore": "Time and space bend to your will. Manipulate reality with Aether and outsmart your opponent's every move.",
        "accent": (0, 191, 255, 255)
    },
    {
        "name": "The Graveglass Veil",
        "faction": "Umbri",
        "art": "03_Card_Art/graveglass_oracle.webp",
        "deckbox_3_0": "deckboxes_3.0/IMG_5653.PNG",
        "lore": "Step into the shadows of the Umbri. Command the fallen and drain the life force from those who oppose you.",
        "accent": (155, 48, 255, 255)
    }
]

# Standard Dieline points (Points in 72 DPI PDF coordinates)
PANEL_WIDTH = 184.25
PANEL_HEIGHT = 255.1
BACK_RECT = fitz.Rect(323.4, 281.3, 323.4 + PANEL_WIDTH, 281.3 + PANEL_HEIGHT)
FRONT_RECT = fitz.Rect(550.4, 281.3, 550.4 + PANEL_WIDTH, 281.3 + PANEL_HEIGHT)
SPINE_WIDTH = 42.7
SPINE_RECT = fitz.Rect(507.7, 281.3, 507.7 + SPINE_WIDTH, 281.3 + PANEL_HEIGHT)

def get_fonts(dpi=300):
    scale = dpi / 300.0
    font_paths = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
        "/System/Library/Fonts/Helvetica.ttc"
    ]
    font_small_paths = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
        "/System/Library/Fonts/Helvetica.ttc"
    ]
    
    font = None
    for p in font_paths:
        if os.path.exists(p):
            try:
                font = ImageFont.truetype(p, int(48 * scale))
                break
            except Exception:
                pass
    if font is None:
        font = ImageFont.load_default()

    font_small = None
    for p in font_small_paths:
        if os.path.exists(p):
            try:
                font_small = ImageFont.truetype(p, int(34 * scale))
                break
            except Exception:
                pass
    if font_small is None:
        font_small = ImageFont.load_default()

    return font, font_small

def build_deck_tuckbox(deck, out_dir: Path, dpi: int = 300, preview: bool = True, use_3_0: bool = False):
    print(f"[*] Building tuckbox for: {deck['name']} ({deck['faction']} Faction)...")
    art_path = BASE_DIR / deck["art"]
    if use_3_0 and "deckbox_3_0" in deck:
        candidate_3_0 = SCRIPT_DIR / "Bhuvan_Instructions" / deck["deckbox_3_0"]
        if candidate_3_0.exists():
            art_path = candidate_3_0
            print(f"  [i] Utilizing 3.0 deckbox asset: {candidate_3_0.name}")

    if not art_path.exists():
        raise FileNotFoundError(f"Card art not found at: {art_path}")
    if not TEMPLATE_PDF.exists():
        raise FileNotFoundError(f"Template PDF not found at: {TEMPLATE_PDF}")

    px_w = int((PANEL_WIDTH / 72.0) * dpi)
    px_h = int((PANEL_HEIGHT / 72.0) * dpi)
    px_spine_w = int((SPINE_WIDTH / 72.0) * dpi)

    font, font_small = get_fonts(dpi)

    base_img = Image.open(str(art_path)).convert("RGBA")
    img_ratio = base_img.width / base_img.height
    panel_ratio = px_w / px_h
    if img_ratio > panel_ratio:
        new_w = int(base_img.height * panel_ratio)
        offset = (base_img.width - new_w) // 2
        cropped_img = base_img.crop((offset, 0, offset + new_w, base_img.height))
    else:
        new_h = int(base_img.width / panel_ratio)
        offset = (base_img.height - new_h) // 2
        cropped_img = base_img.crop((0, offset, base_img.width, offset + new_h))

    with tempfile.TemporaryDirectory() as tmpdir:
        tmp_path = Path(tmpdir)
        front_temp = tmp_path / "front.png"
        back_temp = tmp_path / "back.png"
        spine_temp = tmp_path / "spine.png"

        # 1. Front Panel
        front_img = cropped_img.resize((px_w, px_h), Image.Resampling.LANCZOS)
        draw = ImageDraw.Draw(front_img)
        text = deck["name"]
        bbox = draw.textbbox((0, 0), text, font=font)
        tw = bbox[2] - bbox[0]
        # Text with subtle drop shadow
        draw.text(((px_w - tw) // 2 + 2, px_h - int(100 * (dpi / 300.0)) + 2), text, font=font, fill=(0, 0, 0, 255))
        draw.text(((px_w - tw) // 2, px_h - int(100 * (dpi / 300.0))), text, font=font, fill=(255, 255, 255, 255))
        front_img.save(front_temp)

        # 2. Back Panel
        back_img = cropped_img.resize((px_w, px_h), Image.Resampling.LANCZOS)
        enhancer = ImageEnhance.Brightness(back_img)
        back_img = enhancer.enhance(0.2)
        draw = ImageDraw.Draw(back_img)

        wrapped_lore = textwrap.wrap(deck["lore"], width=30)
        y_text = int(200 * (dpi / 300.0))
        for line in wrapped_lore:
            bbox = draw.textbbox((0, 0), line, font=font_small)
            tw = bbox[2] - bbox[0]
            draw.text(((px_w - tw) // 2, y_text), line, font=font_small, fill=(255, 255, 255, 255))
            y_text += int(48 * (dpi / 300.0))

        url = "GlimmerFallTCG.com"
        bbox = draw.textbbox((0, 0), url, font=font)
        tw = bbox[2] - bbox[0]
        draw.text(((px_w - tw) // 2, px_h - int(100 * (dpi / 300.0))), url, font=font, fill=(255, 200, 50, 255))

        if LOGO_PATH.exists():
            logo = Image.open(str(LOGO_PATH)).convert("RGBA")
            logo_w = int(px_w * 0.7)
            logo_h = int(logo.height * (logo_w / logo.width))
            logo = logo.resize((logo_w, logo_h), Image.Resampling.LANCZOS)
            back_img.alpha_composite(logo, ((px_w - logo_w) // 2, px_h - int(140 * (dpi / 300.0)) - logo_h))

        back_img.save(back_temp)

        # 3. Spine Panel
        spine_img = cropped_img.crop(((cropped_img.width - px_spine_w) // 2, 0, (cropped_img.width + px_spine_w) // 2, cropped_img.height))
        spine_img = spine_img.resize((px_spine_w, px_h), Image.Resampling.LANCZOS)
        spine_enhancer = ImageEnhance.Brightness(spine_img)
        spine_img = spine_enhancer.enhance(0.4)
        spine_img.save(spine_temp)

        # 4. Composite into PDF
        doc = fitz.open(str(TEMPLATE_PDF))
        page = doc[0]

        page.insert_image(FRONT_RECT, filename=str(front_temp), overlay=False)
        page.insert_image(BACK_RECT, filename=str(back_temp), overlay=False)
        page.insert_image(SPINE_RECT, filename=str(spine_temp), overlay=False)

        safe_name = deck["name"].replace(" ", "_").replace("'", "")
        out_pdf = out_dir / f"GlimmerFall_{safe_name}_TuckBox.pdf"
        doc.save(str(out_pdf))
        print(f"  [✓] PDF created: {out_pdf.name}")

        if preview:
            pix = page.get_pixmap(dpi=150)
            out_png = out_dir / f"GlimmerFall_{safe_name}_TuckBox.png"
            pix.save(str(out_png))
            print(f"  [✓] Preview rendered: {out_png.name}")

def main():
    parser = argparse.ArgumentParser(description="GlimmerFall Tuck-Box Tooling")
    parser.add_argument("--all", action="store_true", default=True, help="Build all 4 tuckbox decks")
    parser.add_argument("--deck", type=str, help="Build specific deck by name or faction (e.g. 'Gaia', 'Solari', 'Aether', 'Umbri')")
    parser.add_argument("--dpi", type=int, default=300, help="Print DPI (default: 300)")
    parser.add_argument("--outdir", type=str, default=str(SCRIPT_DIR / "Bhuvan_Instructions"), help="Output directory")
    parser.add_argument("--use-3-0", action="store_true", help="Use 3.0 deckbox render assets")
    parser.add_argument("--no-preview", action="store_true", help="Skip PNG proof rendering")
    args = parser.parse_args()

    out_dir = Path(args.outdir)
    out_dir.mkdir(parents=True, exist_ok=True)

    targets = DECKS
    if args.deck:
        q = args.deck.lower()
        targets = [d for d in DECKS if q in d["name"].lower() or q in d["faction"].lower()]
        if not targets:
            print(f"No deck matching '{args.deck}'. Available: {[d['name'] for d in DECKS]}", file=sys.stderr)
            sys.exit(1)

    for d in targets:
        build_deck_tuckbox(d, out_dir=out_dir, dpi=args.dpi, preview=not args.no_preview, use_3_0=args.use_3_0)

    print("\nAll requested tuckbox packages successfully processed!")

if __name__ == "__main__":
    main()
