#!/usr/bin/env python3
"""
GlimmerFall TCG — First Edition: The Awakening (AWK)
Deterministic Prepress Packaging Engine:
  1. Booster Display Box (125 x 144 x 67 mm, 30 Packs x 12 Cards) on `Booster Box Template.pdf`
  2. Booster Pack Design 1 — Emberwing Courier (72 x 125 mm sealed / 170 x 125 mm flat + 3mm bleed) on `Booster Pack 72x125.pdf`
  3. Booster Pack Design 2 — Reality Fracture (72 x 125 mm sealed / 170 x 125 mm flat + 3mm bleed) on `Booster Pack 72x125.pdf`

Prepress Compliance (Super Board Game Manufacturing, Shenzhen):
  - Exact factory Adobe Illustrator PDF page geometry & Optional Content Groups (OCG layers) preserved.
  - 300+ DPI supersampled artwork converted to ICC-profiled CMYK (`default_cmyk.icc`, TAC <= 295%).
  - Artwork placed on the dedicated artwork OCG (`DESIGN` on Booster Box; `图层 2` on Booster Pack)
    with `overlay=False` underneath the toggleable factory vector dieline OCG (`图层 1`).
  - All typography, logos, barcodes, and callouts strictly inside panel Safe Areas, clear of folds,
    cuts, crimp seals, back fin seals, and glue flaps.
"""

import io
import math
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from PIL import Image, ImageCms, ImageDraw, ImageEnhance, ImageFilter, ImageFont
import pymupdf as fitz

ENGINE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = ENGINE_DIR.parent
PRINT_DIR = PROJECT_ROOT / "print"
FONT_DIR = ENGINE_DIR / "fonts"
ICC_DIR = ENGINE_DIR / "icc"

BOX_TEMPLATE_PDF = Path("/home/ewilliamhe/Booster Box Template.pdf")
PACK_TEMPLATE_PDF = Path("/home/ewilliamhe/Booster Pack 72x125.pdf")

HANDOFF_DIR = (
    PROJECT_ROOT
    / "Bhuvan_Instructions"
    / "Bhuvan Instructions"
    / "0.1 GlimmerFall Tuck-Box Production Handoff"
)
ART_DIR = HANDOFF_DIR / "03_Card_Art"
FACTION_DIR = HANDOFF_DIR / "04_Faction_Logos"
CREST_LOGO_PATH = PROJECT_ROOT / "frontend" / "public" / "glimmerfall-logo.png"

PT_TO_MM = 25.4 / 72.0
MM_TO_PT = 72.0 / 25.4


# ---------------------------------------------------------------------------
# Color & ICC CMYK Utilities
# ---------------------------------------------------------------------------
class CMYKConverter:
    def __init__(self):
        self.srgb = ImageCms.getOpenProfile(str(ICC_DIR / "srgb.icc"))
        self.cmyk = ImageCms.getOpenProfile(str(ICC_DIR / "default_cmyk.icc"))
        self.xform = ImageCms.buildTransformFromOpenProfiles(
            self.srgb, self.cmyk, "RGB", "CMYK", renderingIntent=ImageCms.Intent.PERCEPTUAL
        )

    def rgb_to_cmyk(self, rgb_img: Image.Image, max_tac_pct: float = 295.0) -> Image.Image:
        cmyk = ImageCms.applyTransform(rgb_img.convert("RGB"), self.xform)
        limit = int(round(max_tac_pct * 2.55))
        raw = bytearray(cmyk.tobytes())
        for i in range(0, len(raw), 4):
            s = raw[i] + raw[i + 1] + raw[i + 2] + raw[i + 3]
            if s > limit:
                k = raw[i + 3]
                cmy = raw[i] + raw[i + 1] + raw[i + 2]
                target_cmy = max(0, limit - k)
                if cmy > 0:
                    scale = target_cmy / cmy
                    raw[i] = int(raw[i] * scale)
                    raw[i + 1] = int(raw[i + 1] * scale)
                    raw[i + 2] = int(raw[i + 2] * scale)
        return Image.frombytes("CMYK", cmyk.size, bytes(raw))


def tac_stats(cmyk_img: Image.Image) -> float:
    sample = cmyk_img.resize((120, 120), Image.Resampling.BILINEAR).tobytes()
    return max(
        (sample[i] + sample[i + 1] + sample[i + 2] + sample[i + 3]) / 2.55
        for i in range(0, len(sample), 4)
    )


def load_font(filename: str, size_px: int, weight: Optional[int] = None) -> ImageFont.FreeTypeFont:
    font = ImageFont.truetype(str(FONT_DIR / filename), max(8, int(round(size_px))))
    if weight is not None:
        try:
            font.set_variation_by_axes([weight])
        except Exception:
            pass
    return font


def lerp_rgb(c1: Tuple[int, int, int], c2: Tuple[int, int, int], t: float) -> Tuple[int, int, int]:
    t = max(0.0, min(1.0, t))
    return (
        int(round(c1[0] + (c2[0] - c1[0]) * t)),
        int(round(c1[1] + (c2[1] - c1[1]) * t)),
        int(round(c1[2] + (c2[2] - c1[2]) * t)),
    )


def make_vertical_gradient(w: int, h: int, top: Tuple[int, int, int], bot: Tuple[int, int, int]) -> Image.Image:
    strip = Image.new("RGB", (1, max(2, h)))
    for y in range(max(2, h)):
        strip.putpixel((0, y), lerp_rgb(top, bot, y / max(1, h - 1)))
    return strip.resize((w, h), Image.Resampling.BILINEAR).convert("RGBA")


# ---------------------------------------------------------------------------
# ISO/IEC 15420 Scannable EAN-13 Retail Barcode Renderer
# ---------------------------------------------------------------------------
_EAN_L = {
    "0": "0001101", "1": "0011001", "2": "0010011", "3": "0111101", "4": "0100011",
    "5": "0110001", "6": "0101111", "7": "0111011", "8": "0110111", "9": "0001011",
}
_EAN_G = {
    "0": "0100111", "1": "0110011", "2": "0011011", "3": "0100001", "4": "0011101",
    "5": "0111001", "6": "0000101", "7": "0010001", "8": "0001001", "9": "0010111",
}
_EAN_R = {
    "0": "1110010", "1": "1100110", "2": "1101100", "3": "1000010", "4": "1011100",
    "5": "1001110", "6": "1010000", "7": "1000100", "8": "1001000", "9": "1110100",
}
_EAN_PARITY = {
    "0": "LLLLLL", "1": "LLGLGG", "2": "LLGGLG", "3": "LLGGGL", "4": "LGLLGG",
    "5": "LGGLLG", "6": "LGGGLL", "7": "LGLGLG", "8": "LGLGGL", "9": "LGGLGL",
}


def compute_ean13(digits12: str) -> str:
    assert len(digits12) == 12 and digits12.isdigit()
    total = sum((3 if idx % 2 == 1 else 1) * int(ch) for idx, ch in enumerate(digits12))
    check = (10 - (total % 10)) % 10
    return digits12 + str(check)


def render_ean13_box(digits12: str, sku_label: str, w: int, h: int) -> Image.Image:
    code = compute_ean13(digits12)
    parity = _EAN_PARITY[code[0]]
    bits = ["101"]
    for i, ch in enumerate(code[1:7]):
        bits.append(_EAN_L[ch] if parity[i] == "L" else _EAN_G[ch])
    bits.append("01010")
    for ch in code[7:]:
        bits.append(_EAN_R[ch])
    bits.append("101")
    bit_str = "".join(bits)  # 95 modules

    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    dr = ImageDraw.Draw(im)
    rad = max(6, int(round(min(w, h) * 0.05)))
    dr.rounded_rectangle((0, 0, w - 1, h - 1), radius=rad, fill=(252, 252, 254, 255), outline=(210, 175, 90, 255), width=max(2, w // 140))

    sku_f = load_font("Outfit-Variable.ttf", max(10, int(h * 0.115)), weight=700)
    num_f = load_font("Rajdhani-Bold.ttf", max(11, int(h * 0.155)))

    sb = sku_f.getbbox(sku_label)
    dr.text(((w - (sb[2] - sb[0])) / 2 - sb[0], int(h * 0.05) - sb[1]), sku_label, font=sku_f, fill=(28, 32, 42, 255))

    quiet_left = int(w * 0.12)
    avail_w = int(w * 0.80)
    mod_w = max(1.0, avail_w / 95.0)
    bar_top = int(h * 0.21)
    bar_bot_short = int(h * 0.78)
    bar_bot_guard = int(h * 0.85)

    guard_indices = set(range(0, 3)) | set(range(45, 50)) | set(range(92, 95))
    for idx, b in enumerate(bit_str):
        if b == "1":
            x0 = int(round(quiet_left + idx * mod_w))
            x1 = max(x0 + 1, int(round(quiet_left + (idx + 1) * mod_w)))
            y1 = bar_bot_guard if idx in guard_indices else bar_bot_short
            dr.rectangle((x0, bar_top, x1 - 1, y1), fill=(12, 14, 18, 255))

    y_num = int(h * 0.79)
    dr.text((int(w * 0.035), y_num), code[0], font=num_f, fill=(12, 14, 18, 255))
    left_grp = code[1:7]
    lb = num_f.getbbox(left_grp)
    lx = quiet_left + 24 * mod_w - (lb[2] - lb[0]) / 2
    dr.text((lx, y_num), left_grp, font=num_f, fill=(12, 14, 18, 255))
    right_grp = code[7:]
    rb = num_f.getbbox(right_grp)
    rx = quiet_left + 71 * mod_w - (rb[2] - rb[0]) / 2
    dr.text((rx, y_num), right_grp, font=num_f, fill=(12, 14, 18, 255))
    return im


# ---------------------------------------------------------------------------
# Artwork & Brand Lockup Helpers
# ---------------------------------------------------------------------------
def load_clean_art(name: str) -> Image.Image:
    p = ART_DIR / name
    im = Image.open(p).convert("RGB")
    if "graveglass" in name:
        # Strip outer white frame in graveglass_oracle.webp
        w, h = im.size
        im = im.crop((int(w * 0.055), int(h * 0.055), int(w * 0.945), int(h * 0.945)))
    return im


def cover_crop(im: Image.Image, target_w: int, target_h: int, focus_y: float = 0.45, focus_x: float = 0.5) -> Image.Image:
    src_w, src_h = im.size
    scale = max(target_w / src_w, target_h / src_h)
    nw, nh = max(target_w, int(round(src_w * scale))), max(target_h, int(round(src_h * scale)))
    resized = im.resize((nw, nh), Image.Resampling.LANCZOS)
    max_ox = nw - target_w
    max_oy = nh - target_h
    ox = int(round(max_ox * max(0.0, min(1.0, focus_x))))
    oy = int(round(max_oy * max(0.0, min(1.0, focus_y))))
    return resized.crop((ox, oy, ox + target_w, oy + target_h)).convert("RGBA")


def load_crest(size_px: int) -> Image.Image:
    im = Image.open(CREST_LOGO_PATH).convert("RGBA")
    bbox = im.getbbox()
    if bbox:
        im = im.crop(bbox)
    w, h = im.size
    scale = size_px / max(w, h)
    return im.resize((max(1, int(round(w * scale))), max(1, int(round(h * scale)))), Image.Resampling.LANCZOS)


def load_faction_icon(faction: str, size_px: int) -> Image.Image:
    im = Image.open(FACTION_DIR / f"{faction.lower()}_nobg.png").convert("RGBA")
    bbox = im.getbbox()
    if bbox:
        im = im.crop(bbox)
    w, h = im.size
    scale = size_px / max(w, h)
    return im.resize((max(1, int(round(w * scale))), max(1, int(round(h * scale)))), Image.Resampling.LANCZOS)


def draw_glimmerfall_wordmark(
    canvas: Image.Image,
    cx: int,
    cy: int,
    font_px: int,
    with_crest_above: bool = False,
    with_crest_left: bool = False,
    crest_px: int = 0,
    subtitle: Optional[str] = None,
    sub_px: int = 0,
    sub_color: Tuple[int, int, int] = (220, 228, 242),
):
    """
    Renders the canonical GlimmerFall 3.0 brand lockup:
      `GLIMMER` (luminous ivory) + `FALL` (burnished Solari gold #F2A900)
      with soft drop-shadow + optional shattered-crown Crest above or to the left.
    """
    f_main = load_font("Cinzel-Variable.ttf", font_px, weight=800)
    part1, part2 = "GLIMMER", "FALL"
    b1 = f_main.getbbox(part1)
    b2 = f_main.getbbox(part2)
    w1 = f_main.getlength(part1)
    w2 = b2[2] - b2[0]
    total_text_w = w1 + w2
    text_h = max(b1[3] - b1[1], b2[3] - b2[1])

    crest_im = None
    gap = max(8, int(font_px * 0.24))
    if (with_crest_above or with_crest_left) and crest_px > 0:
        crest_im = load_crest(crest_px)

    if with_crest_left and crest_im is not None:
        full_w = crest_im.width + gap + total_text_w
        start_x = int(round(cx - full_w / 2))
        canvas.alpha_composite(crest_im, (start_x, int(round(cy - crest_im.height / 2))))
        tx = start_x + crest_im.width + gap
        ty = int(round(cy - text_h / 2 - b1[1]))
    else:
        if with_crest_above and crest_im is not None:
            canvas.alpha_composite(
                crest_im,
                (int(round(cx - crest_im.width / 2)), int(round(cy - text_h / 2 - crest_im.height - int(font_px * 0.18)))),
            )
        tx = int(round(cx - total_text_w / 2))
        ty = int(round(cy - text_h / 2 - b1[1]))

    # Soft dark glow + crisp drop shadow
    glow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    sh = max(2, int(round(font_px * 0.06)))
    for ox, oy in ((-sh, 0), (sh, 0), (0, -sh), (0, sh), (0, sh * 2)):
        gd.text((tx + ox, ty + oy), part1 + part2, font=f_main, fill=(0, 0, 0, 210))
    glow = glow.filter(ImageFilter.GaussianBlur(radius=max(2, font_px * 0.08)))
    canvas.alpha_composite(glow)

    dr = ImageDraw.Draw(canvas)
    dr.text((tx + sh, ty + sh), part1 + part2, font=f_main, fill=(6, 8, 12, 235))
    dr.text((tx, ty), part1, font=f_main, fill=(248, 250, 255, 255))
    dr.text((tx + w1, ty), part2, font=f_main, fill=(244, 174, 12, 255))

    if subtitle:
        f_sub = load_font("Cinzel-Variable.ttf", max(10, sub_px or int(font_px * 0.34)), weight=700)
        sb = f_sub.getbbox(subtitle)
        sw = sb[2] - sb[0]
        sh_sub = sb[3] - sb[1]
        sy = int(round(cy + text_h / 2 + int(font_px * 0.24) - sb[1]))
        sx = int(round(cx - sw / 2 - sb[0]))
        pad_px = max(8, int(sh_sub * 0.65))
        pad_py = max(3, int(sh_sub * 0.28))
        bx0 = int(round(cx - sw / 2 - pad_px))
        by0 = int(round(sy + sb[1] - pad_py))
        bx1 = int(round(cx + sw / 2 + pad_px))
        by1 = int(round(sy + sb[3] + pad_py))
        dr.rounded_rectangle((bx0, by0, bx1, by1), radius=(by1 - by0) // 2, fill=(8, 11, 18, 196))
        dr.text((sx + 1, sy + 1), subtitle, font=f_sub, fill=(0, 0, 0, 220))
        dr.text((sx, sy), subtitle, font=f_sub, fill=(*sub_color, 255))
        line_y = (by0 + by1) // 2
        line_len = max(12, int(font_px * 0.55))
        pad_l = max(6, int(font_px * 0.16))
        dr.line((bx0 - pad_l - line_len, line_y, bx0 - pad_l, line_y), fill=(242, 169, 0, 195), width=max(1, font_px // 28))
        dr.line((bx1 + pad_l, line_y, bx1 + pad_l + line_len, line_y), fill=(242, 169, 0, 195), width=max(1, font_px // 28))


def draw_centered_text(
    dr: ImageDraw.ImageDraw,
    cx: float,
    y: float,
    text: str,
    font: ImageFont.FreeTypeFont,
    fill: Tuple[int, int, int, int],
    shadow: bool = True,
) -> int:
    bb = font.getbbox(text)
    tw = bb[2] - bb[0]
    th = bb[3] - bb[1]
    x = cx - tw / 2 - bb[0]
    yy = y - bb[1]
    if shadow:
        dr.text((x + 2, yy + 2), text, font=font, fill=(0, 0, 0, 215))
    dr.text((x, yy), text, font=font, fill=fill)
    return th


def draw_pill_badge(
    dr: ImageDraw.ImageDraw,
    cx: float,
    cy: float,
    text: str,
    font: ImageFont.FreeTypeFont,
    bg: Tuple[int, int, int, int],
    border: Tuple[int, int, int, int],
    fg: Tuple[int, int, int, int],
    pad_x: int,
    pad_y: int,
):
    bb = font.getbbox(text)
    tw, th = bb[2] - bb[0], bb[3] - bb[1]
    w = tw + 2 * pad_x
    h = th + 2 * pad_y
    x0, y0 = int(round(cx - w / 2)), int(round(cy - h / 2))
    dr.rounded_rectangle((x0, y0, x0 + w, y0 + h), radius=h // 2, fill=bg, outline=border, width=max(2, h // 18))
    dr.text((cx - tw / 2 - bb[0], cy - th / 2 - bb[1]), text, font=font, fill=fg)


def wrap_lines(text: str, font: ImageFont.FreeTypeFont, max_w: int) -> List[str]:
    words = text.split()
    lines: List[str] = []
    cur = ""
    for w in words:
        cand = f"{cur} {w}".strip()
        bb = font.getbbox(cand)
        if bb[2] - bb[0] <= max_w or not cur:
            cur = cand
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def draw_ce_and_age_badges(dr: ImageDraw.ImageDraw, cx: int, y: int, h: int, accent: Tuple[int, int, int]):
    """Draws centered retail compliance badges (`AGES 13+` + `CE` + `1ST ED.`)."""
    f = load_font("Outfit-Variable.ttf", int(h * 0.48), weight=800)
    labels = ("AGES 13+", "CE", "1ST ED.")
    gap = int(h * 0.20)
    boxes = []
    for label in labels:
        bb = f.getbbox(label)
        tw, th = bb[2] - bb[0], bb[3] - bb[1]
        bw = tw + int(h * 0.56)
        boxes.append((label, bb, tw, th, bw))
    tot_w = sum(b[4] for b in boxes) + gap * (len(boxes) - 1)
    cur_x = int(round(cx - tot_w / 2))
    for label, bb, tw, th, bw in boxes:
        dr.rounded_rectangle(
            (cur_x, y, cur_x + bw, y + h),
            radius=max(4, h // 5),
            fill=(18, 22, 32, 235),
            outline=(*accent, 210),
            width=max(2, h // 16),
        )
        dr.text((cur_x + (bw - tw) / 2 - bb[0], y + (h - th) / 2 - bb[1]), label, font=f, fill=(242, 245, 252, 255))
        cur_x += bw + gap


# ---------------------------------------------------------------------------
# 1. BOOSTER PACK 72x125 GENERATOR (2 Designs: Emberwing Courier & Reality Fracture)
# ---------------------------------------------------------------------------
PACK_THEMES: List[Dict] = [
    {
        "slug": "Emberwing_Courier",
        "title": "Emberwing Courier",
        "art_file": "emberwing_courier.webp",
        "focus_x": 0.48,
        "focus_y": 0.42,
        "accent": (242, 169, 0),
        "accent_bright": (255, 224, 128),
        "accent_deep": (118, 68, 6),
        "crimp_top": (36, 26, 12),
        "crimp_bot": (16, 12, 8),
        "foil_pill_bg": (58, 36, 6, 238),
        "ean12": "200202600011",
        "sku": "SKU: GF-AWK-BP01",
        "edition_tag": "SOLARI EDITION ART",
    },
    {
        "slug": "Reality_Fracture",
        "title": "Reality Fracture",
        "art_file": "reality_fracture.webp",
        "focus_x": 0.50,
        "focus_y": 0.46,
        "accent": (18, 198, 255),
        "accent_bright": (168, 240, 255),
        "accent_deep": (12, 64, 122),
        "crimp_top": (14, 24, 42),
        "crimp_bot": (9, 13, 24),
        "foil_pill_bg": (12, 42, 78, 238),
        "ean12": "200202600012",
        "sku": "SKU: GF-AWK-BP02",
        "edition_tag": "AETHER RIFT ART",
    },
]


def build_booster_pack(theme: Dict, cmyk_conv: CMYKConverter, dpi: int = 450) -> Tuple[Path, Path, float]:
    """
    Builds one press-ready Booster Pack PDF + WebP proof directly on `Booster Pack 72x125.pdf`.
    Exact template PDF geometry (pt):
      Cut box [17]:        x = 92.14 .. 574.03 (170.00 mm), y = 78.11 .. 432.44 (125.00 mm)
      Bleed box (+3.0 mm): x = 83.64 .. 582.53 (176.00 mm), y = 69.61 .. 440.94 (131.00 mm)
      Horizontal zones:
        Top crimp (12.5mm):    y = 78.11 .. 113.55
        Live body (100.0mm):   y = 113.55 .. 397.01
        Bottom crimp (12.5mm): y = 397.01 .. 432.44
      Vertical zones:
        Left fin (13mm):       x = 92.14 .. 128.99
        Back Right-half (36mm):x = 128.99 .. 231.04
        FRONT PANEL (72mm):    x = 231.04 .. 435.14
        Back Left-half (36mm): x = 435.14 .. 537.18
        Right fin (13mm):      x = 537.18 .. 574.03
    """
    bleed_pt = 3.0 * MM_TO_PT  # 8.5039 pt
    bx0, by0 = 92.14 - bleed_pt, 78.11 - bleed_pt
    bx1, by1 = 574.03 + bleed_pt, 432.44 + bleed_pt
    bleed_rect = fitz.Rect(bx0, by0, bx1, by1)

    pt_to_px = dpi / 72.0
    mm = dpi / 25.4

    def px_x(pt_x: float) -> int:
        return int(round((pt_x - bx0) * pt_to_px))

    def px_y(pt_y: float) -> int:
        return int(round((pt_y - by0) * pt_to_px))

    cw = int(round(bleed_rect.width * pt_to_px))
    ch = int(round(bleed_rect.height * pt_to_px))

    accent = theme["accent"]
    accent_hi = theme["accent_bright"]

    # Base obsidian canvas
    canvas = make_vertical_gradient(cw, ch, (15, 18, 27), (9, 11, 17))
    dr = ImageDraw.Draw(canvas)

    # Subtle cosmic grid lines across back panels
    step = int(round(6.0 * mm))
    for gx in range(0, cw, step):
        dr.line((gx, 0, gx, ch), fill=(255, 255, 255, 7), width=1)
    for gy in range(0, ch, step):
        dr.line((0, gy, cw, gy), fill=(255, 255, 255, 7), width=1)

    # --- FRONT PANEL FULL ARTWORK (with 2mm wraparound into adjacent back edges for zero fold seam) ---
    wrap_px = int(round(1.5 * mm))
    fx0, fx1 = px_x(231.04) - wrap_px, px_x(435.14) + wrap_px
    fy0, fy1 = 0, ch
    art_im = load_clean_art(theme["art_file"])
    front_art = cover_crop(art_im, fx1 - fx0, fy1 - fy0, focus_y=theme["focus_y"], focus_x=theme["focus_x"])
    canvas.alpha_composite(front_art, (fx0, fy0))

    # Top & bottom atmospheric vignettes on front panel so brand lockup & title pop cleanly
    vig = Image.new("RGBA", (fx1 - fx0, fy1 - fy0), (0, 0, 0, 0))
    vd = ImageDraw.Draw(vig)
    live_top = px_y(113.55)
    live_bot = px_y(397.01)
    top_fade_end = live_top + int(round(31.0 * mm))
    bot_fade_start = live_bot - int(round(32.0 * mm))
    for y in range(0, top_fade_end):
        t = 1.0 - max(0.0, (y - live_top) / max(1, top_fade_end - live_top))
        alpha = int(round(225 * (t ** 1.45))) if y >= live_top else 232
        vd.line((0, y, fx1 - fx0, y), fill=(8, 10, 16, min(240, alpha)))
    for y in range(bot_fade_start, fy1 - fy0):
        t = min(1.0, (y - bot_fade_start) / max(1, live_bot - bot_fade_start))
        alpha = int(round(238 * (t ** 1.35))) if y <= live_bot else 242
        vd.line((0, y, fx1 - fx0, y), fill=(8, 10, 16, min(244, alpha)))
    # Soft side edge feather at wrap seams
    feather_w = int(round(3.0 * mm))
    for i in range(feather_w):
        a = int(round(220 * (1.0 - i / feather_w)))
        vd.line((i, 0, i, fy1 - fy0), fill=(11, 13, 20, a))
        vd.line((fx1 - fx0 - 1 - i, 0, fx1 - fx0 - 1 - i, fy1 - fy0), fill=(11, 13, 20, a))
    canvas.alpha_composite(vig, (fx0, fy0))

    # --- METALLIC CRIMP SEAL BANDS (Top 12.5mm + bleed, Bottom 12.5mm + bleed) ---
    crimp_ov = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
    cd = ImageDraw.Draw(crimp_ov)
    for y0, y1 in ((0, live_top), (live_bot, ch)):
        cd.rectangle((0, y0, cw, y1), fill=(*theme["crimp_bot"], 236))
        # Subtle vertical crimp ribbing pattern across seal zone
        rib_step = max(4, int(round(1.35 * mm)))
        for rx in range(0, cw, rib_step):
            cd.line((rx, y0, rx, y1), fill=(*accent, 34), width=max(1, rib_step // 3))
    # Clean metallic accent trim rules just inside the live 100mm body (2.2mm safe from crimp dashed line)
    trim_off = int(round(2.0 * mm))
    cd.line((px_x(128.99), live_top + trim_off, px_x(537.18), live_top + trim_off), fill=(*accent, 205), width=max(2, int(0.35 * mm)))
    cd.line((px_x(128.99), live_bot - trim_off, px_x(537.18), live_bot - trim_off), fill=(*accent, 205), width=max(2, int(0.35 * mm)))
    canvas.alpha_composite(crimp_ov)
    dr = ImageDraw.Draw(canvas)

    # --- BACK FIN SEAL ZONES (Left 13mm + bleed, Right 13mm + bleed) — Keep free of text ---
    fin_ov = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
    fd = ImageDraw.Draw(fin_ov)
    fd.rectangle((0, live_top, px_x(128.99), live_bot), fill=(10, 12, 18, 245))
    fd.rectangle((px_x(537.18), live_top, cw, live_bot), fill=(10, 12, 18, 245))
    diag_step = int(round(3.5 * mm))
    for yy in range(live_top, live_bot, diag_step):
        fd.line((px_x(94.0), yy, px_x(125.0), yy + diag_step // 2), fill=(*accent, 28), width=2)
        fd.line((px_x(539.0), yy, px_x(570.0), yy + diag_step // 2), fill=(*accent, 28), width=2)
    canvas.alpha_composite(fin_ov)
    dr = ImageDraw.Draw(canvas)

    # --- CENTER FRONT PANEL TYPOGRAPHY & LOCKUP (Strictly inside 72 x 100 mm safe area) ---
    front_cx = (px_x(231.04) + px_x(435.14)) // 2
    front_w = px_x(435.14) - px_x(231.04)

    # Top pill: FIRST EDITION • AWK
    f_pill_top = load_font("Outfit-Variable.ttf", int(round(2.45 * mm)), weight=800)
    draw_pill_badge(
        dr,
        front_cx,
        live_top + int(round(6.6 * mm)),
        "FIRST EDITION  •  EXPANSION AWK",
        f_pill_top,
        bg=(12, 15, 24, 220),
        border=(*accent, 235),
        fg=(*accent_hi, 255),
        pad_x=int(round(2.8 * mm)),
        pad_y=int(round(0.95 * mm)),
    )

    # Official GlimmerFall Crest + Wordmark at top of front face
    draw_glimmerfall_wordmark(
        canvas,
        cx=front_cx,
        cy=live_top + int(round(20.8 * mm)),
        font_px=int(round(6.1 * mm)),
        with_crest_left=True,
        crest_px=int(round(11.2 * mm)),
        subtitle="TRADING CARD GAME",
        sub_px=int(round(2.15 * mm)),
        sub_color=accent_hi,
    )
    dr = ImageDraw.Draw(canvas)

    # Bottom Expansion Title Plate: THE AWAKENING + 12 GAME CARDS + 1 FOIL PER PACK
    plate_w = int(round(front_w * 0.88))
    plate_h = int(round(13.2 * mm))
    plate_x0 = front_cx - plate_w // 2
    plate_y0 = live_bot - int(round(23.6 * mm))
    dr.rounded_rectangle(
        (plate_x0, plate_y0, plate_x0 + plate_w, plate_y0 + plate_h),
        radius=int(round(2.0 * mm)),
        fill=(10, 13, 22, 226),
        outline=(*accent, 235),
        width=max(2, int(round(0.42 * mm))),
    )
    dr.rounded_rectangle(
        (plate_x0 + int(0.9 * mm), plate_y0 + int(0.9 * mm), plate_x0 + plate_w - int(0.9 * mm), plate_y0 + plate_h - int(0.9 * mm)),
        radius=int(round(1.4 * mm)),
        outline=(242, 169, 0, 95),
        width=max(1, int(round(0.2 * mm))),
    )
    f_exp = load_font("Cinzel-Variable.ttf", int(round(4.45 * mm)), weight=800)
    draw_centered_text(dr, front_cx, plate_y0 + int(round(2.3 * mm)), "THE AWAKENING", f_exp, (255, 248, 230, 255))
    f_booster = load_font("Outfit-Variable.ttf", int(round(2.35 * mm)), weight=700)
    draw_centered_text(dr, front_cx, plate_y0 + int(round(8.3 * mm)), "BOOSTER PACK", f_booster, (*accent_hi, 255))

    # Bottom twin retail pills: `12 GAME CARDS` | `1 HOLO FOIL`
    f_call = load_font("Outfit-Variable.ttf", int(round(2.25 * mm)), weight=800)
    call_y = live_bot - int(round(6.6 * mm))
    draw_pill_badge(
        dr,
        front_cx - int(round(16.2 * mm)),
        call_y,
        "12 GAME CARDS",
        f_call,
        bg=(16, 20, 30, 238),
        border=(242, 169, 0, 220),
        fg=(255, 245, 220, 255),
        pad_x=int(round(2.3 * mm)),
        pad_y=int(round(0.9 * mm)),
    )
    draw_pill_badge(
        dr,
        front_cx + int(round(16.2 * mm)),
        call_y,
        "1 FOIL CARD",
        f_call,
        bg=theme["foil_pill_bg"],
        border=(*accent_hi, 240),
        fg=(255, 255, 255, 255),
        pad_x=int(round(2.5 * mm)),
        pad_y=int(round(0.9 * mm)),
    )

    # --- BACK COLUMN A: Right 36mm on flat sheet (x = 435.14 .. 537.18 pt) = Left half on sealed back ---
    col_margin = int(round(3.6 * mm))
    ca_x0 = px_x(435.14) + col_margin
    ca_x1 = px_x(537.18) - col_margin
    ca_cx = (ca_x0 + ca_x1) // 2
    ca_w = ca_x1 - ca_x0
    cy_cur = live_top + int(round(8.2 * mm))

    draw_glimmerfall_wordmark(
        canvas,
        cx=ca_cx,
        cy=cy_cur + int(round(6.8 * mm)),
        font_px=int(round(3.05 * mm)),
        with_crest_above=True,
        crest_px=int(round(7.4 * mm)),
    )
    dr = ImageDraw.Draw(canvas)
    cy_cur += int(round(11.4 * mm))

    f_col_hdr = load_font("Cinzel-Variable.ttf", int(round(2.3 * mm)), weight=800)
    cy_cur += draw_centered_text(dr, ca_cx, cy_cur, "THE AWAKENING", f_col_hdr, (*accent_hi, 255)) + int(round(1.8 * mm))

    lore_str = (
        "Across the shattered leylines of Glimmerfall, four ancient orders awaken. "
        "Wield Solari radiance, Umbri shadow, Terra might, and Aether mastery to claim the Nexus."
    )
    f_lore = load_font("CrimsonPro-Italic-Variable.ttf", int(round(2.2 * mm)), weight=500)
    for ln in wrap_lines(lore_str, f_lore, ca_w):
        cy_cur += draw_centered_text(dr, ca_cx, cy_cur, ln, f_lore, (218, 224, 236, 255), shadow=False) + int(round(0.75 * mm))

    cy_cur += int(round(2.0 * mm))
    # Pack contents info box
    box_h = int(round(26.5 * mm))
    dr.rounded_rectangle(
        (ca_x0, cy_cur, ca_x1, cy_cur + box_h),
        radius=int(round(1.6 * mm)),
        fill=(16, 20, 32, 232),
        outline=(*accent, 175),
        width=max(2, int(round(0.28 * mm))),
    )
    f_box_t = load_font("Outfit-Variable.ttf", int(round(2.0 * mm)), weight=800)
    draw_centered_text(dr, ca_cx, cy_cur + int(round(1.8 * mm)), "EACH PACK CONTAINS", f_box_t, (242, 169, 0, 255), shadow=False)
    f_item = load_font("Outfit-Variable.ttf", int(round(1.88 * mm)), weight=600)
    iy = cy_cur + int(round(5.8 * mm))
    for bullet in (
        "• 7 Common Cards",
        "• 3 Uncommon Cards",
        "• 1 Rare or Epic (Epic 1:5)",
        "• 1 Holographic Foil Card",
        "• 322 Cards in Set AWK",
    ):
        dr.text((ca_x0 + int(round(1.8 * mm)), iy), bullet, font=f_item, fill=(234, 239, 248, 255))
        iy += int(round(3.8 * mm))

    cy_cur += box_h + int(round(2.6 * mm))
    # 4 Faction Emblems row
    fac_sz = int(round(5.2 * mm))
    fac_names = ["Solari", "Umbri", "Terra", "Aether"]
    total_fac_w = 4 * fac_sz + 3 * int(round(1.5 * mm))
    fx_start = ca_cx - total_fac_w // 2
    for idx, fn in enumerate(fac_names):
        fic = load_faction_icon(fn, fac_sz)
        canvas.alpha_composite(fic, (fx_start + idx * (fac_sz + int(round(1.5 * mm))), cy_cur))
    dr = ImageDraw.Draw(canvas)

    f_url = load_font("Outfit-Variable.ttf", int(round(2.3 * mm)), weight=800)
    draw_centered_text(dr, ca_cx, live_bot - int(round(7.4 * mm)), "GlimmerFallTCG.com", f_url, (242, 169, 0, 255))

    # --- BACK COLUMN B: Left 36mm on flat sheet (x = 128.99 .. 231.04 pt) = Right half on sealed back ---
    cb_x0 = px_x(128.99) + col_margin
    cb_x1 = px_x(231.04) - col_margin
    cb_cx = (cb_x0 + cb_x1) // 2
    cb_w = cb_x1 - cb_x0
    by_cur = live_top + int(round(6.2 * mm))

    f_tag = load_font("Outfit-Variable.ttf", int(round(1.95 * mm)), weight=800)
    by_cur += draw_centered_text(dr, cb_cx, by_cur, theme["edition_tag"], f_tag, (*accent_hi, 255), shadow=False) + int(round(1.8 * mm))
    f_sub2 = load_font("Outfit-Variable.ttf", int(round(1.82 * mm)), weight=500)
    spec_lines = (
        "2-Player Strategic TCG  •  20–30 Min\n"
        "Requires a 40-card deck per player to play. "
        "Collect all 322 First Edition cards across four sovereign factions."
    )
    for para in spec_lines.split("\n"):
        for ln in wrap_lines(para, f_sub2, cb_w):
            by_cur += draw_centered_text(dr, cb_cx, by_cur, ln, f_sub2, (206, 214, 228, 255), shadow=False) + int(round(0.8 * mm))
        by_cur += int(round(1.2 * mm))

    # EAN-13 Retail Barcode inside 28.8mm safe width
    bc_w = cb_w
    bc_h = int(round(20.5 * mm))
    bc_y = by_cur + int(round(2.2 * mm))
    bc_im = render_ean13_box(theme["ean12"], theme["sku"], bc_w, bc_h)
    canvas.alpha_composite(bc_im, (cb_x0, bc_y))
    dr = ImageDraw.Draw(canvas)
    by_cur = bc_y + bc_h + int(round(3.4 * mm))

    # Age & CE Badges centered cleanly inside safe column
    badge_h = int(round(3.85 * mm))
    draw_ce_and_age_badges(dr, cb_cx, by_cur, badge_h, accent)
    by_cur += badge_h + int(round(3.0 * mm))

    f_legal = load_font("Outfit-Variable.ttf", int(round(1.62 * mm)), weight=500)
    legal_txt = (
        "WARNING: Not suitable for children under 36 months due to small parts. "
        "© 2026 GlimmerFall TCG. All rights reserved. First Edition (AWK). "
        "Manufactured in Shenzhen, Guangdong, China. Retain packaging for future reference."
    )
    for ln in wrap_lines(legal_txt, f_legal, cb_w):
        by_cur += draw_centered_text(dr, cb_cx, by_cur, ln, f_legal, (164, 174, 192, 255), shadow=False) + int(round(0.65 * mm))

    # --- CONVERT TO ICC CMYK & INSERT INTO FACTORY TEMPLATE PDF ---
    cmyk_im = cmyk_conv.rgb_to_cmyk(canvas.convert("RGB"))
    max_tac = tac_stats(cmyk_im)

    jpg_buf = io.BytesIO()
    cmyk_im.save(jpg_buf, format="JPEG", quality=96, subsampling=0)

    doc = fitz.open(str(PACK_TEMPLATE_PDF))
    page = doc[0]
    # OCG 6 = '图层 2' (Artwork layer), underneath OCG 7 = '图层 1' (Dieline + Dimensions)
    art_ocg = 6 if 6 in doc.get_ocgs() else doc.add_ocg("图层 2", on=True)
    page.insert_image(bleed_rect, stream=jpg_buf.getvalue(), overlay=False, oc=art_ocg)

    PRINT_DIR.mkdir(parents=True, exist_ok=True)
    out_pdf = PRINT_DIR / f"Booster Pack 72x125 - {theme['title']}.pdf"
    doc.save(str(out_pdf), deflate=True, garbage=3)

    # Render crisp WebP proof (with factory dieline visible for instant preflight inspection)
    pix = page.get_pixmap(dpi=220)
    proof_im = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
    out_webp = PRINT_DIR / f"Booster Pack 72x125 - {theme['title']} Preview.webp"
    proof_im.save(out_webp, "WEBP", quality=93)
    doc.close()

    return out_pdf, out_webp, max_tac


# ---------------------------------------------------------------------------
# 2. BOOSTER DISPLAY BOX 125x144x67mm GENERATOR (30 Packs x 12 Cards)
# ---------------------------------------------------------------------------
def build_exact_bleed_mask_from_template(doc: fitz.Document, dpi: int) -> Image.Image:
    """
    Reconstructs the exact 58-segment green bleeding polygon [21] from `Booster Box Template.pdf`
    as a sub-pixel-accurate grayscale mask at `dpi`, while keeping the outer adhesive strip of
    Glue Flap [08] (x < 132.98 pt, i.e. >3mm past the fold crease) unprinted white for maximum glue bond.
    """
    src_page = doc[0]
    d21 = src_page.get_drawings()[21]

    mask_doc = fitz.open()
    mp = mask_doc.new_page(width=src_page.rect.width, height=src_page.rect.height)
    sh = mp.new_shape()
    sh.draw_rect(mp.rect)
    sh.finish(fill=(0, 0, 0), color=None)
    sh.commit()

    sh_poly = mp.new_shape()
    for it in d21["items"]:
        op = it[0]
        if op == "l":
            sh_poly.draw_line(it[1], it[2])
        elif op == "c":
            sh_poly.draw_bezier(it[1], it[2], it[3], it[4])
        elif op == "re":
            sh_poly.draw_rect(it[1])
    sh_poly.finish(fill=(1, 1, 1), color=None, closePath=True)
    sh_poly.commit()

    # Keep outer glue-bonding zone on Glue Flap [08] (x = 90 .. 132.98 pt, y = 497 .. 675 pt) unprinted white
    # while leaving a full 3.0mm (8.50 pt) ink bleed overlap across the fold crease at x = 141.48 pt!
    sh_glue = mp.new_shape()
    sh_glue.draw_rect(fitz.Rect(88.0, 496.8, 132.98, 675.0))
    sh_glue.finish(fill=(0, 0, 0), color=None)
    sh_glue.commit()

    pix = mp.get_pixmap(dpi=dpi, colorspace=fitz.csGRAY)
    mask = Image.frombytes("L", (pix.width, pix.height), pix.samples)
    mask_doc.close()
    return mask


def render_box_front_panel(w: int, h: int, mm: float) -> Image.Image:
    """Front Wall [04]: 144.0 x 66.85 mm (Safe inset 3.0 mm all sides)."""
    panel = make_vertical_gradient(w, h, (14, 17, 26), (8, 10, 16))
    # Dual hero panoramic blend: Emberwing Courier (left) + Reality Fracture (right)
    left_art = cover_crop(load_clean_art("emberwing_courier.webp"), int(w * 0.56), h, focus_y=0.38, focus_x=0.45)
    right_art = cover_crop(load_clean_art("reality_fracture.webp"), int(w * 0.56), h, focus_y=0.44, focus_x=0.52)

    # Smooth horizontal alpha masks so center blends into rich dark obsidian behind logo
    l_mask = Image.new("L", left_art.size, 0)
    ld = ImageDraw.Draw(l_mask)
    for x in range(left_art.width):
        t = x / max(1, left_art.width - 1)
        a = int(round(220 * max(0.0, 1.0 - (t ** 1.35))))
        ld.line((x, 0, x, h), fill=a)
    left_art.putalpha(l_mask)

    r_mask = Image.new("L", right_art.size, 0)
    rd = ImageDraw.Draw(r_mask)
    for x in range(right_art.width):
        t = 1.0 - x / max(1, right_art.width - 1)
        a = int(round(225 * max(0.0, 1.0 - (t ** 1.35))))
        rd.line((x, 0, x, h), fill=a)
    right_art.putalpha(r_mask)

    panel.alpha_composite(left_art, (0, 0))
    panel.alpha_composite(right_art, (w - right_art.width, 0))

    # Top & bottom vignette for razor-sharp contrast
    vig = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    vd = ImageDraw.Draw(vig)
    for y in range(h):
        dist_center = abs(y - h * 0.48) / (h * 0.52)
        a = int(round(95 + 115 * (dist_center ** 1.6)))
        vd.line((0, y, w, y), fill=(8, 10, 16, min(215, a)))
    panel.alpha_composite(vig)

    dr = ImageDraw.Draw(panel)
    cx = w // 2
    f_top = load_font("Outfit-Variable.ttf", int(round(2.35 * mm)), weight=800)
    draw_pill_badge(
        dr,
        cx,
        int(round(9.4 * mm)),
        "FIRST EDITION  •  EXPANSION AWK",
        f_top,
        bg=(12, 15, 24, 228),
        border=(242, 169, 0, 230),
        fg=(255, 226, 138, 255),
        pad_x=int(round(3.2 * mm)),
        pad_y=int(round(0.85 * mm)),
    )

    draw_glimmerfall_wordmark(
        panel,
        cx=cx,
        cy=int(round(26.5 * mm)),
        font_px=int(round(9.2 * mm)),
        with_crest_left=True,
        crest_px=int(round(16.8 * mm)),
        subtitle="THE AWAKENING",
        sub_px=int(round(3.8 * mm)),
        sub_color=(255, 238, 196),
    )
    dr = ImageDraw.Draw(panel)

    # Bottom retail strip inside safe zone
    pill_y = h - int(round(10.4 * mm))
    f_p = load_font("Outfit-Variable.ttf", int(round(2.45 * mm)), weight=800)
    draw_pill_badge(
        dr,
        cx - int(round(38.0 * mm)),
        pill_y,
        "30 BOOSTER PACKS",
        f_p,
        bg=(48, 32, 6, 238),
        border=(242, 169, 0, 240),
        fg=(255, 232, 156, 255),
        pad_x=int(round(3.0 * mm)),
        pad_y=int(round(1.05 * mm)),
    )
    draw_pill_badge(
        dr,
        cx,
        pill_y,
        "12 CARDS PER PACK",
        f_p,
        bg=(14, 20, 32, 238),
        border=(200, 212, 232, 200),
        fg=(248, 250, 255, 255),
        pad_x=int(round(3.0 * mm)),
        pad_y=int(round(1.05 * mm)),
    )
    draw_pill_badge(
        dr,
        cx + int(round(38.0 * mm)),
        pill_y,
        "1 FOIL EVERY PACK",
        f_p,
        bg=(10, 42, 74, 238),
        border=(24, 198, 255, 240),
        fg=(178, 242, 255, 255),
        pad_x=int(round(3.0 * mm)),
        pad_y=int(round(1.05 * mm)),
    )
    return panel


def render_box_side_panel(
    w: int,
    h: int,
    mm: float,
    art_name: str,
    factions: Tuple[str, str],
    accent: Tuple[int, int, int],
    bottom_stat: str,
) -> Image.Image:
    """Side Walls [02] & [06]: 125.0 x 67.0 mm (Safe inset 3.0 mm)."""
    panel = make_vertical_gradient(w, h, (13, 16, 24), (8, 10, 16))
    art = cover_crop(load_clean_art(art_name), int(w * 0.54), h, focus_y=0.32, focus_x=0.50)
    amask = Image.new("L", art.size, 0)
    ad = ImageDraw.Draw(amask)
    for x in range(art.width):
        t = x / max(1, art.width - 1)
        ad.line((x, 0, x, h), fill=int(round(235 * max(0.0, 1.0 - (t ** 1.45)))))
    art.putalpha(amask)
    panel.alpha_composite(art, (0, 0))

    dr = ImageDraw.Draw(panel)
    right_cx = int(w * 0.62)
    # Two faction icons above lockup
    ic_sz = int(round(8.8 * mm))
    ic1 = load_faction_icon(factions[0], ic_sz)
    ic2 = load_faction_icon(factions[1], ic_sz)
    panel.alpha_composite(ic1, (right_cx - ic_sz - int(round(2.2 * mm)), int(round(8.5 * mm))))
    panel.alpha_composite(ic2, (right_cx + int(round(2.2 * mm)), int(round(8.5 * mm))))

    draw_glimmerfall_wordmark(
        panel,
        cx=right_cx,
        cy=int(round(28.5 * mm)),
        font_px=int(round(6.6 * mm)),
        with_crest_left=True,
        crest_px=int(round(12.0 * mm)),
        subtitle="THE AWAKENING",
        sub_px=int(round(2.85 * mm)),
        sub_color=(245, 232, 198),
    )
    dr = ImageDraw.Draw(panel)
    f_stat = load_font("Outfit-Variable.ttf", int(round(2.35 * mm)), weight=800)
    draw_pill_badge(
        dr,
        right_cx,
        h - int(round(11.0 * mm)),
        bottom_stat,
        f_stat,
        bg=(14, 18, 28, 235),
        border=(*accent, 225),
        fg=(248, 250, 255, 255),
        pad_x=int(round(3.2 * mm)),
        pad_y=int(round(1.0 * mm)),
    )
    return panel


def render_box_back_panel(w: int, h: int, mm: float) -> Image.Image:
    """Back Wall [00]: 144.0 x 67.0 mm (Safe inset 3.0 mm)."""
    panel = make_vertical_gradient(w, h, (14, 18, 28), (9, 11, 18))
    dr = ImageDraw.Draw(panel)

    # Left-center column (x = 7.5mm .. 95mm)
    lx0 = int(round(8.0 * mm))
    lw = int(round(86.0 * mm))
    lcx = lx0 + lw // 2

    draw_glimmerfall_wordmark(
        panel,
        cx=lx0 + int(round(34.0 * mm)),
        cy=int(round(12.2 * mm)),
        font_px=int(round(5.4 * mm)),
        with_crest_left=True,
        crest_px=int(round(9.8 * mm)),
    )
    dr = ImageDraw.Draw(panel)

    # 4 Faction crests top-right of left column
    fsz = int(round(6.2 * mm))
    fx0 = lx0 + int(round(61.5 * mm))
    for i, fn in enumerate(("Solari", "Umbri", "Terra", "Aether")):
        panel.alpha_composite(load_faction_icon(fn, fsz), (fx0 + i * int(round(6.6 * mm)), int(round(9.0 * mm))))
    dr = ImageDraw.Draw(panel)

    lore = (
        "Awaken the fractured Nexus! Command 322 First Edition cards across four sovereign orders—Solari, "
        "Umbri, Terra, and Aether—featuring Entities, Rites, Instant Flashes, and Relics."
    )
    f_lore = load_font("CrimsonPro-Italic-Variable.ttf", int(round(2.45 * mm)), weight=500)
    ly = int(round(19.2 * mm))
    for ln in wrap_lines(lore, f_lore, lw):
        dr.text((lx0, ly), ln, font=f_lore, fill=(224, 230, 242, 255))
        ly += int(round(3.15 * mm))

    # Box Configuration Summary Table
    box_y = int(round(30.6 * mm))
    box_h = int(round(21.5 * mm))
    dr.rounded_rectangle(
        (lx0, box_y, lx0 + lw, box_y + box_h),
        radius=int(round(1.6 * mm)),
        fill=(18, 23, 36, 235),
        outline=(242, 169, 0, 175),
        width=max(2, int(round(0.25 * mm))),
    )
    f_bh = load_font("Outfit-Variable.ttf", int(round(2.15 * mm)), weight=800)
    dr.text((lx0 + int(round(3.0 * mm)), box_y + int(round(2.0 * mm))), "DISPLAY BOX CONTENTS  •  360 TOTAL GAME CARDS", font=f_bh, fill=(242, 169, 0, 255))

    f_bi = load_font("Outfit-Variable.ttf", int(round(1.98 * mm)), weight=600)
    col1 = (
        "• 30 Sealed Booster Packs (2 × 15 Columns)",
        "• 12 Cards per Pack (63×88mm R3)",
        "• 1 Holographic Foil Card in Every Pack",
    )
    col2 = (
        "• 7 Commons + 3 Uncommons per Pack",
        "• 1 Rare or Epic per Pack (Epic 1:5 Packs)",
        "• Official Rules & Card DB: GlimmerFallTCG.com",
    )
    for idx, txt in enumerate(col1):
        dr.text((lx0 + int(round(3.0 * mm)), box_y + int(round(6.6 * mm)) + idx * int(round(4.4 * mm))), txt, font=f_bi, fill=(235, 240, 248, 255))
    for idx, txt in enumerate(col2):
        dr.text((lx0 + int(round(44.5 * mm)), box_y + int(round(6.6 * mm)) + idx * int(round(4.4 * mm))), txt, font=f_bi, fill=(235, 240, 248, 255))

    # Bottom compliance line on left
    f_foot = load_font("Outfit-Variable.ttf", int(round(1.72 * mm)), weight=500)
    dr.text(
        (lx0, h - int(round(9.4 * mm))),
        "© 2026 GlimmerFall TCG. All rights reserved. First Edition: The Awakening (AWK). Printed in Shenzhen, China.",
        font=f_foot,
        fill=(165, 175, 194, 255),
    )

    # Right column: Retail EAN-13 Display Box Barcode + CE / Ages 13+ + Website URL
    rx0 = int(round(98.0 * mm))
    rw = int(round(38.0 * mm))
    rcx = rx0 + rw // 2

    bc_im = render_ean13_box("200202600301", "SKU: GF-AWK-BB01 (30CT)", rw, int(round(25.5 * mm)))
    panel.alpha_composite(bc_im, (rx0, int(round(9.0 * mm))))
    dr = ImageDraw.Draw(panel)

    draw_ce_and_age_badges(dr, rcx, int(round(37.5 * mm)), int(round(4.9 * mm)), (242, 169, 0))

    f_web = load_font("Outfit-Variable.ttf", int(round(2.75 * mm)), weight=800)
    draw_centered_text(dr, rcx, int(round(46.2 * mm)), "GlimmerFallTCG.com", f_web, (242, 169, 0, 255))
    f_warn = load_font("Outfit-Variable.ttf", int(round(1.65 * mm)), weight=500)
    draw_centered_text(dr, rcx, int(round(51.2 * mm)), "HS 9504904000 • FSC / EN71 / CPC", f_warn, (175, 184, 202, 255), shadow=False)

    return panel


def render_box_top_lid_panel(w: int, h: int, mm: float) -> Image.Image:
    """
    Top Lid + Pop-Up Display Crown [09]: 144.0 x 125.0 mm.
    Rendered UPRIGHT in customer view first, then rotated 180° when placed on flat PDF [09]
    (`x = 141.48 .. 549.67 pt`, `y = 136.41 .. 490.74 pt`), so that:
      - When closed on shelf, customer facing Front Wall [04] reads Top Lid 100% upright.
      - When popped open along U-cut [16]/[17]/[18] (`114.41mm` wide centered, extending from
        front edge `0mm` up to `102.69mm` tall U-arch!), the ENTIRE hero showcase & GlimmerFall
        logo sit cleanly inside the `114.4 x 102.7 mm` pop-up crown with ZERO clipped letters!
    """
    panel = make_vertical_gradient(w, h, (11, 14, 22), (8, 10, 16))

    # U-cut pop-up crown safe zone in upright customer coordinates:
    # Total lid: 144.0mm W x 125.0mm H.
    # Back outer collar (stays flat behind U-arch): top 0 .. 22.3mm (since 125 - 102.69 = 22.31mm).
    # Left/Right outer wings: 0 .. 14.8mm and 129.2 .. 144.0mm.
    # Pop-up Crown Billboard interior: x = 14.8 .. 129.2mm (114.4mm W), y = 22.3 .. 125.0mm (102.7mm H)!
    ux0 = int(round(18.5 * mm))
    ux1 = w - int(round(18.5 * mm))
    uy0 = int(round(26.5 * mm))
    uy1 = h - int(round(5.5 * mm))
    uw = ux1 - ux0
    uh = uy1 - uy0
    ucx = w // 2

    # Full-lid dramatic cosmic backdrop (seamless across U-cut so there's zero jump at perforation!)
    bg_art = cover_crop(load_clean_art("reality_fracture.webp"), w, h, focus_y=0.45, focus_x=0.50)
    bg_art = ImageEnhance.Brightness(bg_art.convert("RGB")).enhance(0.38).convert("RGBA")
    panel.alpha_composite(bg_art, (0, 0))

    # Crisp focal hero vignette inside the U-arch pop-up crown (Emberwing Courier + Gaia + Reality Fracture)
    hero_h = int(round(52.0 * mm))
    hero_w = uw
    hero = cover_crop(load_clean_art("emberwing_courier.webp"), hero_w, hero_h, focus_y=0.36, focus_x=0.48)
    # Rounded mask with soft feathered edges so nothing hard-clips near U-cut
    hmask = Image.new("L", (hero_w, hero_h), 0)
    ImageDraw.Draw(hmask).rounded_rectangle(
        (int(2 * mm), int(2 * mm), hero_w - int(2 * mm), hero_h - int(2 * mm)),
        radius=int(round(6.0 * mm)),
        fill=235,
    )
    hmask = hmask.filter(ImageFilter.GaussianBlur(radius=int(round(2.4 * mm))))
    hero.putalpha(hmask)
    panel.alpha_composite(hero, (ux0, uy0 + int(round(20.5 * mm))))

    # Dark readability gradient over top & bottom of U-billboard
    ov = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    od = ImageDraw.Draw(ov)
    # 4 Faction emblems centered in the permanent back collar strip (above the U-arch!)
    csz = int(round(8.2 * mm))
    gap_c = int(round(5.0 * mm))
    tot_cw = 4 * csz + 3 * gap_c
    cx_start = ucx - tot_cw // 2
    for idx, fn in enumerate(("Solari", "Umbri", "Terra", "Aether")):
        ov.alpha_composite(load_faction_icon(fn, csz), (cx_start + idx * (csz + gap_c), int(round(7.8 * mm))))

    # Dark vignette behind U-crown header & footer
    od.rounded_rectangle(
        (ux0, uy0, ux1, uy0 + int(round(25.0 * mm))),
        radius=int(round(5.0 * mm)),
        fill=(9, 12, 20, 212),
    )
    od.rounded_rectangle(
        (ux0, uy1 - int(round(26.5 * mm)), ux1, uy1),
        radius=int(round(4.0 * mm)),
        fill=(9, 12, 20, 226),
        outline=(242, 169, 0, 215),
        width=max(2, int(round(0.35 * mm))),
    )
    panel.alpha_composite(ov)
    dr = ImageDraw.Draw(panel)

    # Pop-Up Crown Top Lockup (inside U-arch safe zone: y = 28mm .. 50mm)
    draw_glimmerfall_wordmark(
        panel,
        cx=ucx,
        cy=uy0 + int(round(10.8 * mm)),
        font_px=int(round(7.6 * mm)),
        with_crest_left=True,
        crest_px=int(round(14.0 * mm)),
        subtitle="TRADING CARD GAME",
        sub_px=int(round(2.65 * mm)),
        sub_color=(175, 238, 255),
    )
    dr = ImageDraw.Draw(panel)

    # Pop-Up Crown Bottom Banner (inside U-billboard safe zone: y = 93mm .. 119mm)
    f_exp = load_font("Cinzel-Variable.ttf", int(round(6.2 * mm)), weight=800)
    draw_centered_text(dr, ucx, uy1 - int(round(23.2 * mm)), "THE AWAKENING", f_exp, (255, 246, 224, 255))

    f_sub = load_font("Outfit-Variable.ttf", int(round(2.55 * mm)), weight=700)
    draw_centered_text(
        dr,
        ucx,
        uy1 - int(round(14.5 * mm)),
        "FIRST EDITION BOOSTER DISPLAY",
        f_sub,
        (242, 169, 0, 255),
    )

    f_b = load_font("Outfit-Variable.ttf", int(round(2.35 * mm)), weight=800)
    py = uy1 - int(round(6.2 * mm))
    draw_pill_badge(
        dr,
        ucx - int(round(26.5 * mm)),
        py,
        "30 BOOSTER PACKS",
        f_b,
        bg=(48, 32, 6, 240),
        border=(242, 169, 0, 240),
        fg=(255, 232, 156, 255),
        pad_x=int(round(2.8 * mm)),
        pad_y=int(round(0.9 * mm)),
    )
    draw_pill_badge(
        dr,
        ucx + int(round(26.5 * mm)),
        py,
        "12 CARDS / PACK",
        f_b,
        bg=(12, 42, 74, 240),
        border=(24, 198, 255, 240),
        fg=(182, 242, 255, 255),
        pad_x=int(round(2.8 * mm)),
        pad_y=int(round(0.9 * mm)),
    )

    # Rotate 180° for exact flat-sheet alignment on Top Lid [09]!
    return panel.rotate(180, expand=False)


def build_booster_box(cmyk_conv: CMYKConverter, dpi: int = 300) -> Tuple[Path, Path, float]:
    """
    Builds the press-ready 125x144x67mm Booster Display Box on `Booster Box Template.pdf`.
    """
    doc = fitz.open(str(BOX_TEMPLATE_PDF))
    page = doc[0]
    pw_pt, ph_pt = page.rect.width, page.rect.height
    pt_to_px = dpi / 72.0
    mm = dpi / 25.4

    cw = int(round(pw_pt * pt_to_px))
    ch = int(round(ph_pt * pt_to_px))

    def r_px(x0_pt: float, y0_pt: float, x1_pt: float, y1_pt: float) -> Tuple[int, int, int, int]:
        return (
            int(round(x0_pt * pt_to_px)),
            int(round(y0_pt * pt_to_px)),
            int(round(x1_pt * pt_to_px)),
            int(round(y1_pt * pt_to_px)),
        )

    # Full bleed artwork layer (starts as deep obsidian across the box interior; masked to green bleed [21] at end)
    design_rgb = make_vertical_gradient(cw, ch, (12, 15, 23), (8, 10, 16))
    dd = ImageDraw.Draw(design_rgb)

    # Subtle gold trim accent on Lid Tuck Tongue [11] (142.90..548.26, 96.72..136.41)
    tx0, ty0, tx1, ty1 = r_px(142.90, 96.72, 548.26, 136.41)
    tuck_im = Image.new("RGBA", (tx1 - tx0, ty1 - ty0), (11, 14, 22, 255))
    draw_glimmerfall_wordmark(
        tuck_im,
        cx=(tx1 - tx0) // 2,
        cy=(ty1 - ty0) // 2,
        font_px=int(round(4.2 * mm)),
        with_crest_left=True,
        crest_px=int(round(7.5 * mm)),
    )
    # Tuck tongue also folds with Top Lid (180° on flat sheet so upright when tucked/opened!)
    tuck_im = tuck_im.rotate(180, expand=False)
    design_rgb.alpha_composite(tuck_im, (tx0, ty0))

    # 1. Back Wall [00]: (141.49, 490.74, 549.67, 680.66)
    bx0, by0, bx1, by1 = r_px(141.49, 490.74, 549.67, 680.66)
    design_rgb.alpha_composite(render_box_back_panel(bx1 - bx0, by1 - by0, mm), (bx0, by0))

    # 2. Left Side Wall [02]: (549.67, 490.74, 904.00, 680.66)
    lx0, ly0, lx1, ly1 = r_px(549.67, 490.74, 904.00, 680.66)
    design_rgb.alpha_composite(
        render_box_side_panel(
            lx1 - lx0,
            ly1 - ly0,
            mm,
            art_name="gaia_the_world-soul.webp",
            factions=("Solari", "Terra"),
            accent=(36, 212, 118),
            bottom_stat="30 PACKS  •  360 CARDS",
        ),
        (lx0, ly0),
    )

    # 3. Front Wall [04]: (904.01, 491.17, 1312.19, 680.66)
    fx0, fy0, fx1, fy1 = r_px(904.01, 491.17, 1312.19, 680.66)
    design_rgb.alpha_composite(render_box_front_panel(fx1 - fx0, fy1 - fy0, mm), (fx0, fy0))

    # 4. Right Side Wall [06]: (1312.19, 491.17, 1665.11, 680.66) — extend 3mm right bleed into green bleed margin!
    rx0, ry0, rx1, ry1 = r_px(1312.19, 491.17, 1665.11, 680.66)
    right_panel = render_box_side_panel(
        rx1 - rx0,
        ry1 - ry0,
        mm,
        art_name="graveglass_oracle.webp",
        factions=("Umbri", "Aether"),
        accent=(162, 62, 255),
        bottom_stat="322-CARD SET  •  1ST ED.",
    )
    design_rgb.alpha_composite(right_panel, (rx0, ry0))
    # Extend right-edge pixels 3.5mm right so green bleed margin at x=1665..1674 matches seamlessly
    edge_strip = right_panel.crop((right_panel.width - 2, 0, right_panel.width, right_panel.height)).resize(
        (int(round(4.0 * mm)), right_panel.height), Image.Resampling.NEAREST
    )
    design_rgb.alpha_composite(edge_strip, (rx1, ry0))

    # 5. Top Lid + Pop-Up Display Crown [09]: (141.48, 136.41, 549.67, 490.74)
    top_x0, top_y0, top_x1, top_y1 = r_px(141.48, 136.41, 549.67, 490.74)
    top_panel = render_box_top_lid_panel(top_x1 - top_x0, top_y1 - top_y0, mm)
    design_rgb.alpha_composite(top_panel, (top_x0, top_y0))
    # Extend left & right 3.5mm outer bleed strips of Top Lid [09]
    tl_strip = top_panel.crop((0, 0, 2, top_panel.height)).resize((int(round(4.0 * mm)), top_panel.height), Image.Resampling.NEAREST)
    tr_strip = top_panel.crop((top_panel.width - 2, 0, top_panel.width, top_panel.height)).resize((int(round(4.0 * mm)), top_panel.height), Image.Resampling.NEAREST)
    design_rgb.alpha_composite(tl_strip, (top_x0 - int(round(4.0 * mm)), top_y0))
    design_rgb.alpha_composite(tr_strip, (top_x1, top_y0))

    # Apply exact sub-pixel green bleeding contour mask [21] onto pure white sheet background
    bleed_mask = build_exact_bleed_mask_from_template(doc, dpi=dpi)
    if bleed_mask.size != (cw, ch):
        bleed_mask = bleed_mask.resize((cw, ch), Image.Resampling.BILINEAR)
    white_sheet = Image.new("RGB", (cw, ch), (255, 255, 255))
    final_rgb = Image.composite(design_rgb.convert("RGB"), white_sheet, bleed_mask)

    # Convert to ICC CMYK & embed on OCG 7 ('DESIGN') underneath OCG 8 ('图层 1' Dielines)
    cmyk_im = cmyk_conv.rgb_to_cmyk(final_rgb)
    max_tac = tac_stats(cmyk_im)

    jpg_buf = io.BytesIO()
    cmyk_im.save(jpg_buf, format="JPEG", quality=95, subsampling=0)

    design_ocg = 7 if 7 in doc.get_ocgs() else doc.add_ocg("DESIGN", on=True)
    page.insert_image(page.rect, stream=jpg_buf.getvalue(), overlay=False, oc=design_ocg)

    PRINT_DIR.mkdir(parents=True, exist_ok=True)
    out_pdf = PRINT_DIR / "Booster Box Template - GlimmerFall AWK.pdf"
    doc.save(str(out_pdf), deflate=True, garbage=3)

    pix = page.get_pixmap(dpi=160)
    proof_im = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
    out_webp = PRINT_DIR / "Booster Box Template - GlimmerFall AWK Preview.webp"
    proof_im.save(out_webp, "WEBP", quality=92)
    doc.close()

    return out_pdf, out_webp, max_tac


def main():
    print("[*] Initializing ICC CMYK Prepress Converter (Perceptual GCR, TAC <= 295%)...")
    cmyk_conv = CMYKConverter()

    for theme in PACK_THEMES:
        print(f"[*] Building Booster Pack 72x125: {theme['title']} ...")
        pdf_p, webp_p, tac = build_booster_pack(theme, cmyk_conv, dpi=450)
        print(f"    [OK] {pdf_p.name} ({pdf_p.stat().st_size / 1024:.0f} KB) | Preview: {webp_p.name} | Max TAC: {tac:.1f}%")

    print("[*] Building Booster Display Box 125x144x67mm (30 Packs x 12 Cards)...")
    box_pdf, box_webp, box_tac = build_booster_box(cmyk_conv, dpi=300)
    print(f"    [OK] {box_pdf.name} ({box_pdf.stat().st_size / 1024:.0f} KB) | Preview: {box_webp.name} | Max TAC: {box_tac:.1f}%")


if __name__ == "__main__":
    main()
