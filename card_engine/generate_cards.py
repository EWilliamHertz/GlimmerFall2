#!/usr/bin/env python3
"""
GlimmerFall TCG — First Edition: The Awakening (AWK)
Deterministic Prepress & Card Layout Engine (63x88mm R3 Trim + 3mm Bleed = 69x94mm CMYK)

Matches the exact Shenzhen press specification from Super Board Game Manufacturing
(`SuperBoardGameQuote.pdf` + `Back side卡牌-62张-卡背.pdf`):
  - Trim Size:      63.00 x 88.00 mm (178.583 x 249.449 pt), R3 (3.00 mm) corners
  - Bleed Canvas:   69.00 x 94.00 mm (195.591 x 266.457 pt), 3.00 mm bleed on all 4 sides
  - Color Space:    ICC-profiled CMYK (TAC <= 300%, GCR separation) for 4C+4C offset/digital print
  - PDF Layers:     3 Optional Content Groups (OCGs) matching the approved Backside PDF:
                      1. 图层 2 (Bleed Background)
                      2. 图层 1 (Card Artwork CMYK)
                      3. 图层 3 (Dieline R3 63x88mm) — 100% M + 100% Y vector cut line
  - Data Integrity: 100% database-driven from `/api/designer/cards` (`designer_cards_322.json`).
                    Zero manual transcription of names, collector numbers, stats, or rules text.
"""

import argparse
from concurrent.futures import ProcessPoolExecutor, ThreadPoolExecutor, as_completed
import io
import json
import math
import os
import re
import time
import urllib.request
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from PIL import Image, ImageCms, ImageDraw, ImageFilter, ImageFont
import pymupdf

ENGINE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = ENGINE_DIR.parent
FONT_DIR = ENGINE_DIR / "fonts"
ICC_DIR = ENGINE_DIR / "icc"
CACHE_DIR = ENGINE_DIR / "cache"
ASSETS_DIR = ENGINE_DIR / "assets"
FACTION_LOGO_DIR = PROJECT_ROOT / "factionlogos"
CATALOG_JSON = ENGINE_DIR / "designer_cards_322.json"
OFFICIAL_BACK_PDF = ASSETS_DIR / "official_cardback_press.pdf"

# Physical dimensions in millimeters (Super Board Game Manufacturing spec)
BLEED_MM = 3.0
TRIM_W_MM = 63.0
TRIM_H_MM = 88.0
CORNER_R_MM = 3.0
CANVAS_W_MM = TRIM_W_MM + 2.0 * BLEED_MM  # 69.0 mm
CANVAS_H_MM = TRIM_H_MM + 2.0 * BLEED_MM  # 94.0 mm

MM_TO_PT = 72.0 / 25.4
PAGE_W_PT = round(CANVAS_W_MM * MM_TO_PT, 3)  # 195.591 pt (matches Back side PDF)
PAGE_H_PT = round(CANVAS_H_MM * MM_TO_PT, 3)  # 266.457 pt (matches Back side PDF)
BLEED_PT = round(BLEED_MM * MM_TO_PT, 4)      # 8.5039 pt (3.000 mm)

# Default 12-card showcase spanning all 4 factions, all 4 types, all 4 rarities, and set extremes
DEFAULT_SAMPLE_CNS = [1, 11, 24, 30, 31, 36, 55, 61, 82, 84, 251, 318]

FACTION_THEMES: Dict[str, Dict] = {
    "Solari": {
        "primary": (242, 169, 0),
        "highlight": (255, 230, 145),
        "mid": (198, 130, 8),
        "deep": (96, 58, 4),
        "chassis_top": (26, 20, 12),
        "chassis_bot": (16, 12, 8),
        "core_top": (132, 80, 6),
        "core_bot": (48, 26, 2),
        "pill_bg": (64, 42, 6),
        "pill_text": (255, 224, 130),
        "type_bar_top": (42, 31, 14),
        "type_bar_bot": (22, 16, 8),
        "logo": "solari_nobg.png",
    },
    "Umbri": {
        "primary": (162, 62, 255),
        "highlight": (224, 178, 255),
        "mid": (118, 34, 204),
        "deep": (58, 14, 108),
        "chassis_top": (22, 14, 32),
        "chassis_bot": (12, 9, 19),
        "core_top": (104, 30, 178),
        "core_bot": (34, 8, 66),
        "pill_bg": (46, 18, 78),
        "pill_text": (226, 184, 255),
        "type_bar_top": (32, 20, 48),
        "type_bar_bot": (17, 11, 27),
        "logo": "umbri_nobg.png",
    },
    "Terra": {
        "primary": (36, 212, 118),
        "highlight": (158, 255, 202),
        "mid": (20, 156, 84),
        "deep": (10, 78, 42),
        "chassis_top": (13, 25, 18),
        "chassis_bot": (9, 15, 11),
        "core_top": (20, 118, 62),
        "core_bot": (6, 42, 22),
        "pill_bg": (12, 54, 30),
        "pill_text": (152, 252, 196),
        "type_bar_top": (16, 36, 24),
        "type_bar_bot": (10, 20, 14),
        "logo": "terra_nobg.png",
    },
    "Aether": {
        "primary": (12, 190, 255),
        "highlight": (170, 238, 255),
        "mid": (8, 134, 208),
        "deep": (8, 62, 116),
        "chassis_top": (12, 21, 34),
        "chassis_bot": (8, 13, 22),
        "core_top": (14, 102, 184),
        "core_bot": (5, 34, 72),
        "pill_bg": (10, 44, 78),
        "pill_text": (158, 234, 255),
        "type_bar_top": (15, 29, 48),
        "type_bar_bot": (9, 17, 29),
        "logo": "aether_nobg.png",
    },
}

RARITY_THEMES: Dict[str, Dict] = {
    "Common": {
        "code": "C",
        "top": (236, 242, 248),
        "mid": (148, 163, 184),
        "bot": (68, 80, 98),
        "glow": (176, 190, 205),
    },
    "Uncommon": {
        "code": "U",
        "top": (224, 246, 255),
        "mid": (56, 189, 248),
        "bot": (12, 88, 148),
        "glow": (72, 198, 255),
    },
    "Rare": {
        "code": "R",
        "top": (255, 250, 205),
        "mid": (245, 190, 18),
        "bot": (142, 88, 4),
        "glow": (255, 212, 52),
    },
    "Epic": {
        "code": "E",
        "top": (246, 224, 255),
        "mid": (182, 88, 255),
        "bot": (88, 18, 148),
        "glow": (198, 118, 255),
    },
    "Founders Foil": {
        "code": "F",
        "top": (255, 226, 255),
        "mid": (224, 64, 251),
        "bot": (112, 16, 142),
        "glow": (236, 112, 255),
    },
}


def lerp_color(c1: Tuple[int, int, int], c2: Tuple[int, int, int], t: float) -> Tuple[int, int, int]:
    t = max(0.0, min(1.0, t))
    return (
        int(round(c1[0] + (c2[0] - c1[0]) * t)),
        int(round(c1[1] + (c2[1] - c1[1]) * t)),
        int(round(c1[2] + (c2[2] - c1[2]) * t)),
    )


def load_font(filename: str, size_px: int, weight: Optional[int] = None) -> ImageFont.FreeTypeFont:
    font = ImageFont.truetype(str(FONT_DIR / filename), max(8, int(round(size_px))))
    if weight is not None:
        try:
            font.set_variation_by_axes([weight])
        except Exception:
            pass
    return font


def parse_keywords(raw) -> List[str]:
    if not raw or str(raw).strip() in ("", "None"):
        return []
    if isinstance(raw, list):
        return [str(k).strip() for k in raw if str(k).strip() and str(k).strip() != "None"]
    return [k.strip() for k in str(raw).split(",") if k.strip() and k.strip() != "None"]


def clean_text(raw) -> str:
    if raw is None:
        return ""
    s = str(raw).strip()
    return "" if s == "None" else s


def ensure_cached_art(card: Dict) -> Path:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cn = int(card.get("collector_number") or 0)
    cache_path = CACHE_DIR / f"awk_{cn:03d}.webp"
    if not cache_path.exists():
        url = card.get("raw_image_url") or card.get("image_url")
        if not url:
            raise ValueError(f"Card #{cn:03d} ({card.get('name')}) has no artwork URL")
        req = urllib.request.Request(url, headers={"User-Agent": "GlimmerFall-Prepress/1.0"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            cache_path.write_bytes(resp.read())
    return cache_path


def fetch_raw_art(card: Dict) -> Image.Image:
    return Image.open(ensure_cached_art(card)).convert("RGB")


def detect_inner_art_box(im: Image.Image) -> Tuple[int, int, int, int]:
    """
    Automatically strips:
      1. AI-generated studio walls / silver picture frames (#030 The Nightfall King, #031 Shadow Cloak)
      2. Thin bright edge bars (#036 Graveglass Oracle)
      3. Symmetric vertical painted inner border pillars (#001 Solari Vanguard)
    Leaves true full-bleed illustrations 100% untouched.
    """
    w, h = im.size
    small = im.resize((240, 240), Image.Resampling.BILINEAR).convert("RGB")
    px = small.load()
    sw, sh = 240, 240

    def col_stats(x: int, y0: int = 20, y1: int = 220) -> Tuple[float, float, float]:
        lumas = []
        desats = 0
        for y in range(y0, y1):
            r, g, b = px[x, y]
            mx, mn = max(r, g, b), min(r, g, b)
            sat = (mx - mn) / (mx + 1e-5)
            luma = 0.299 * r + 0.587 * g + 0.114 * b
            lumas.append(luma)
            if sat < 0.24 and luma > 88:
                desats += 1
        mean_l = sum(lumas) / len(lumas)
        std_l = (sum((v - mean_l) ** 2 for v in lumas) / len(lumas)) ** 0.5
        return desats / len(lumas), mean_l, std_l

    perim = []
    for i in range(10, sw - 10):
        perim.extend([px[i, 3], px[i, sh - 4], px[3, i], px[sw - 4, i]])
    desat_perim = sum(
        1
        for r, g, b in perim
        if (max(r, g, b) - min(r, g, b)) / (max(r, g, b) + 1e-5) < 0.22
        and (0.299 * r + 0.587 * g + 0.114 * b) > 95
    ) / len(perim)

    has_outer_wall = desat_perim >= 0.72

    left, right, top, bottom = 0, sw - 1, 0, sh - 1

    if has_outer_wall:
        while left < int(sw * 0.36) and col_stats(left, 45, 195)[0] > 0.75:
            left += 1
        while right > int(sw * 0.64) and col_stats(right, 45, 195)[0] > 0.75:
            right -= 1

        def row_desat(y: int, x0: int, x1: int) -> float:
            cnt = 0
            for x in range(x0, x1):
                r, g, b = px[x, y]
                mx, mn = max(r, g, b), min(r, g, b)
                if (mx - mn) / (mx + 1e-5) < 0.24 and (0.299 * r + 0.587 * g + 0.114 * b) > 88:
                    cnt += 1
            return cnt / max(1, x1 - x0)

        while top < int(sh * 0.22) and row_desat(top, max(left, 60), min(right, 180)) > 0.76:
            top += 1
        while bottom > int(sh * 0.78) and row_desat(bottom, max(left, 60), min(right, 180)) > 0.76:
            bottom -= 1

        pad_x = int(sw * 0.024) if left > 3 else 0
        pad_y = int(sh * 0.024) if top > 3 else 0
        left += pad_x
        right -= pad_x
        top += pad_y
        bottom -= pad_y
    else:
        # Check thin symmetric vertical white bars near outer edges (e.g. #036 Graveglass Oracle)
        for probe in range(1, 14):
            _, ml_L, sl_L = col_stats(probe, 30, 210)
            _, ml_R, sl_R = col_stats(sw - 1 - probe, 30, 210)
            if ml_L > 205 and sl_L < 38 and ml_R > 205 and sl_R < 38:
                left = probe + 4
                right = sw - 1 - probe - 4

        # Check symmetric straight vertical frame bars (e.g. #001 Solari Vanguard cream inner frame)
        if left == 0:
            bar_end = 0
            for probe in range(36, 56):
                _, ml_L, sl_L = col_stats(probe, 18, 222)
                _, ml_R, sl_R = col_stats(sw - 1 - probe, 18, 222)
                if ml_L > 195 and sl_L < 12 and ml_R > 195 and sl_R < 12:
                    bar_end = probe
            if bar_end > 0:
                left = bar_end + 5
                right = sw - 1 - bar_end - 5

    x0 = int(left / sw * w)
    x1 = int((right + 1) / sw * w)
    y0 = int(top / sh * h)
    y1 = int((bottom + 1) / sh * h)
    if x1 - x0 < w * 0.28 or y1 - y0 < h * 0.45:
        return (0, 0, w, h)
    return (x0, y0, x1, y1)


def smart_crop_to_aspect(im: Image.Image, target_w: int, target_h: int) -> Image.Image:
    box = detect_inner_art_box(im)
    im = im.crop(box)
    src_w, src_h = im.size
    target_ratio = target_w / target_h
    src_ratio = src_w / src_h

    if src_ratio > target_ratio:
        new_w = int(round(src_h * target_ratio))
        x0 = (src_w - new_w) // 2
        cropped = im.crop((x0, 0, x0 + new_w, src_h))
    else:
        new_h = int(round(src_w / target_ratio))
        anchor = 0.34 if src_ratio < 0.85 else 0.42
        y0 = int(round((src_h - new_h) * anchor))
        y0 = max(0, min(src_h - new_h, y0))
        cropped = im.crop((0, y0, src_w, y0 + new_h))

    return cropped.resize((target_w, target_h), Image.Resampling.LANCZOS)


def make_vertical_gradient(
    w: int, h: int, c_top: Tuple[int, int, int], c_bot: Tuple[int, int, int]
) -> Image.Image:
    strip = Image.new("RGB", (1, h))
    px = strip.load()
    for y in range(h):
        px[0, y] = lerp_color(c_top, c_bot, y / max(1, h - 1))
    return strip.resize((w, h), Image.Resampling.BILINEAR)


def make_diagonal_metallic(
    w: int,
    h: int,
    c_deep: Tuple[int, int, int],
    c_mid: Tuple[int, int, int],
    c_high: Tuple[int, int, int],
) -> Image.Image:
    gw, gh = min(160, max(16, w // 6)), min(220, max(16, h // 6))
    im = Image.new("RGB", (gw, gh))
    px = im.load()
    for y in range(gh):
        ny = y / max(1, gh - 1)
        for x in range(gw):
            nx = x / max(1, gw - 1)
            d = 0.58 * ny + 0.42 * nx
            if d < 0.25:
                c = lerp_color(c_mid, c_high, d / 0.25)
            elif d < 0.55:
                c = lerp_color(c_high, c_mid, (d - 0.25) / 0.30)
            elif d < 0.82:
                c = lerp_color(c_mid, c_deep, (d - 0.55) / 0.27)
            else:
                c = lerp_color(c_deep, c_mid, (d - 0.82) / 0.18)
            px[x, y] = c
    return im.resize((w, h), Image.Resampling.BICUBIC)


def chamfer_rect_poly(
    x0: float, y0: float, x1: float, y1: float, c_tl: float, c_tr: float, c_br: float, c_bl: float
) -> List[Tuple[float, float]]:
    pts = []
    if c_tl > 0:
        pts.extend([(x0, y0 + c_tl), (x0 + c_tl, y0)])
    else:
        pts.append((x0, y0))
    if c_tr > 0:
        pts.extend([(x1 - c_tr, y0), (x1, y0 + c_tr)])
    else:
        pts.append((x1, y0))
    if c_br > 0:
        pts.extend([(x1, y1 - c_br), (x1 - c_br, y1)])
    else:
        pts.append((x1, y1))
    if c_bl > 0:
        pts.extend([(x0 + c_bl, y1), (x0, y1 - c_bl)])
    else:
        pts.append((x0, y1))
    return pts


def load_faction_emblem(logo_filename: str) -> Optional[Image.Image]:
    p = FACTION_LOGO_DIR / logo_filename
    if not p.exists():
        return None
    im = Image.open(p).convert("RGBA")
    bbox = im.getbbox()
    if bbox:
        im = im.crop(bbox)
    return im


def draw_celestial_chassis_pattern(
    canvas: Image.Image,
    rect: Tuple[int, int, int, int],
    theme: Dict,
    px_per_mm: float,
):
    x0, y0, x1, y1 = rect
    w, h = x1 - x0, y1 - y0
    overlay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(overlay)
    prim = theme["primary"]
    hi = theme["highlight"]

    step = int(round(3.6 * px_per_mm))
    line_col = (*prim, 22)
    node_col = (*hi, 34)
    for gx in range(-h, w + h, step):
        d.line([(gx, 0), (gx + h, h)], fill=line_col, width=max(1, int(0.12 * px_per_mm)))
        d.line([(gx, h), (gx + h, 0)], fill=line_col, width=max(1, int(0.12 * px_per_mm)))

    cx, cy_top, cy_bot = w // 2, int(4.0 * px_per_mm), h - int(4.0 * px_per_mm)
    for r_mm in (14.0, 21.0, 28.0):
        r = int(round(r_mm * px_per_mm))
        d.ellipse((cx - r, cy_top - r, cx + r, cy_top + r), outline=(*prim, 28), width=max(1, int(0.16 * px_per_mm)))
        d.ellipse((cx - r, cy_bot - r, cx + r, cy_bot + r), outline=(*prim, 28), width=max(1, int(0.16 * px_per_mm)))

    cr = int(round(2.6 * px_per_mm))
    inset = int(round(3.4 * px_per_mm))
    for ccx, ccy in [(inset, h - inset), (w - inset, h - inset), (w - inset, inset)]:
        d.ellipse((ccx - cr, ccy - cr, ccx + cr, ccy + cr), outline=node_col, width=max(1, int(0.16 * px_per_mm)))

    canvas.alpha_composite(overlay, (x0, y0))


def draw_rarity_gem(canvas: Image.Image, cx: int, cy: int, radius: int, rarity_name: str):
    rt = RARITY_THEMES.get(rarity_name, RARITY_THEMES["Common"])
    size = radius * 3
    layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    mc = size // 2
    r = radius

    glow_layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow_layer)
    gd.polygon([(mc, mc - r - 4), (mc + r + 4, mc), (mc, mc + r + 4), (mc - r - 4, mc)], fill=(*rt["glow"], 105))
    glow_layer = glow_layer.filter(ImageFilter.GaussianBlur(radius=max(2, r // 4)))
    layer.alpha_composite(glow_layer)

    bz = r + max(2, r // 6)
    d.polygon([(mc, mc - bz), (mc + bz, mc), (mc, mc + bz), (mc - bz, mc)], fill=(10, 12, 18, 245))

    top_pt, right_pt, bot_pt, left_pt, ctr = (mc, mc - r), (mc + r, mc), (mc, mc + r), (mc - r, mc), (mc, mc)
    d.polygon([top_pt, ctr, left_pt], fill=(*rt["top"], 255))
    d.polygon([top_pt, right_pt, ctr], fill=(*lerp_color(rt["top"], rt["mid"], 0.55), 255))
    d.polygon([left_pt, ctr, bot_pt], fill=(*rt["mid"], 255))
    d.polygon([ctr, right_pt, bot_pt], fill=(*rt["bot"], 255))

    lw = max(1, r // 9)
    d.line([top_pt, bot_pt], fill=(255, 255, 255, 135), width=lw)
    d.line([left_pt, right_pt], fill=(255, 255, 255, 135), width=lw)
    d.polygon([top_pt, right_pt, bot_pt, left_pt], outline=(255, 255, 255, 215), width=max(1, r // 8))

    ir = max(2, int(round(r * 0.28)))
    d.polygon([(mc, mc - ir), (mc + ir, mc), (mc, mc + ir), (mc - ir, mc)], fill=(255, 255, 255, 210))
    canvas.alpha_composite(layer, (cx - mc, cy - mc))


def draw_card_type_glyph(
    d: ImageDraw.ImageDraw, cx: int, cy: int, r: int, card_type: str, color: Tuple[int, int, int, int]
):
    lw = max(2, r // 4)
    if card_type == "Entity":
        d.line([(cx - r + 2, cy + r - 2), (cx + r - 2, cy - r + 2)], fill=color, width=lw + 1)
        d.line([(cx - r // 2, cy - r // 6), (cx + r // 6, cy + r // 2)], fill=color, width=lw)
        d.polygon([(cx + r - 1, cy - r + 1), (cx + r // 3, cy - r + 2), (cx + r - 2, cy - r // 3)], fill=color)
    elif card_type == "Flash":
        pts = [
            (cx + r * 0.22, cy - r),
            (cx - r * 0.65, cy + r * 0.10),
            (cx - r * 0.05, cy + r * 0.10),
            (cx - r * 0.28, cy + r),
            (cx + r * 0.65, cy - r * 0.12),
            (cx + r * 0.05, cy - r * 0.12),
        ]
        d.polygon(pts, fill=color)
    elif card_type == "Rite":
        d.ellipse((cx - r, cy - r, cx + r, cy + r), outline=color, width=lw)
        sr = int(r * 0.62)
        d.polygon(
            [
                (cx, cy - sr),
                (cx + sr * 0.3, cy - sr * 0.3),
                (cx + sr, cy),
                (cx + sr * 0.3, cy + sr * 0.3),
                (cx, cy + sr),
                (cx - sr * 0.3, cy + sr * 0.3),
                (cx - sr, cy),
                (cx - sr * 0.3, cy - sr * 0.3),
            ],
            fill=color,
        )
    else:
        pts = [
            (cx, cy - r),
            (cx + r * 0.82, cy - r * 0.42),
            (cx + r * 0.82, cy + r * 0.42),
            (cx, cy + r),
            (cx - r * 0.82, cy + r * 0.42),
            (cx - r * 0.82, cy - r * 0.42),
        ]
        d.polygon(pts, outline=color, width=lw)
        ir = int(r * 0.42)
        d.polygon([(cx, cy - ir), (cx + ir, cy), (cx, cy + ir), (cx - ir, cy)], fill=color)


def draw_mini_sword(d: ImageDraw.ImageDraw, cx: int, cy: int, r: int, color: Tuple[int, int, int, int]):
    lw = max(2, r // 4)
    d.line([(cx - r * 0.72, cy + r * 0.72), (cx + r * 0.72, cy - r * 0.72)], fill=color, width=lw + 1)
    d.line([(cx - r * 0.58, cy + r * 0.12), (cx - r * 0.12, cy + r * 0.58)], fill=color, width=lw)
    d.ellipse((cx - r * 0.88, cy + r * 0.56, cx - r * 0.56, cy + r * 0.88), fill=color)


def draw_mini_shield(d: ImageDraw.ImageDraw, cx: int, cy: int, r: int, color: Tuple[int, int, int, int]):
    lw = max(2, r // 4)
    pts = [
        (cx, cy - r * 0.85),
        (cx + r * 0.76, cy - r * 0.52),
        (cx + r * 0.66, cy + r * 0.18),
        (cx, cy + r * 0.88),
        (cx - r * 0.66, cy + r * 0.18),
        (cx - r * 0.76, cy - r * 0.52),
    ]
    d.polygon(pts, outline=color, width=lw)
    ir = r * 0.36
    d.polygon([(cx, cy - ir), (cx + ir * 0.7, cy), (cx, cy + ir), (cx - ir * 0.7, cy)], fill=color)


def split_title_two_lines(title: str) -> Tuple[str, str]:
    words = title.split()
    if len(words) <= 1:
        return (title, "")
    best_pair = (title, "")
    best_diff = 9999
    for i in range(1, len(words)):
        l1 = " ".join(words[:i])
        l2 = " ".join(words[i:])
        diff = abs(len(l1) - len(l2))
        if diff < best_diff:
            best_diff = diff
            best_pair = (l1, l2)
    return best_pair


def wrap_lines_variable_width(
    text: str,
    font: ImageFont.FreeTypeFont,
    y_start: float,
    line_h: float,
    full_w: float,
    narrow_w: float,
    narrow_y_threshold: float,
) -> List[str]:
    paragraphs = [p.strip() for p in text.splitlines() if p.strip()]
    lines: List[str] = []
    cur_y = y_start

    for p_idx, para in enumerate(paragraphs):
        words = para.split()
        cur = ""
        for word in words:
            max_w = narrow_w if (cur_y + line_h) >= narrow_y_threshold else full_w
            candidate = f"{cur} {word}".strip() if cur else word
            if font.getlength(candidate) <= max_w:
                cur = candidate
            else:
                if cur:
                    lines.append(cur)
                    cur_y += line_h
                cur = word
        if cur:
            lines.append(cur)
            cur_y += line_h
        if p_idx < len(paragraphs) - 1:
            cur_y += line_h * 0.25

    return lines


def resolve_effective_lore(rules_text: str, lore_text: str, lore_mode: str) -> str:
    """
    Controls flavor/lore inclusion:
      - 'none':  Strictly Oracle/Rules text ONLY (0 lore clutter).
      - 'smart': Keeps lore ONLY on vanilla cards (0 rules) or ultra-short 1-line cards
                 (rules <= 52 chars AND lore <= 130 chars) so dense cards like Graveglass Oracle
                 stay 100% clean.
      - 'all':   Includes all lore with automatic font scaling so nothing ever overflows.
    """
    if lore_mode == "none" or not lore_text:
        return ""
    if lore_mode == "smart":
        if not rules_text and len(lore_text) <= 185:
            return lore_text
        if len(rules_text) <= 65 and len(lore_text) <= 135:
            return lore_text
        return ""
    return lore_text


def layout_rules_and_lore(
    rules_text: str,
    lore_text: str,
    box_top: float,
    box_bot: float,
    full_w: float,
    narrow_w: float,
    narrow_y_threshold: float,
    px_per_pt: float,
):
    box_h = box_bot - box_top
    pad_y = 3.0 * px_per_pt

    if rules_text and not lore_text:
        pt_candidates = [9.2, 8.8, 8.4, 8.0, 7.6, 7.2, 6.8, 6.4, 6.0]
    elif lore_text and not rules_text:
        pt_candidates = [8.4, 8.0, 7.6, 7.2, 6.8, 6.4, 6.0]
    else:
        pt_candidates = [8.0, 7.6, 7.2, 6.8, 6.4, 6.0, 5.7, 5.4, 5.1, 4.8]

    best = None
    for base_pt in pt_candidates:
        rules_font = load_font("Chivo-Variable.ttf", int(round(base_pt * px_per_pt)), weight=470)
        lore_pt = base_pt * (1.04 if not rules_text else 0.94)
        lore_font = load_font("CrimsonPro-Italic-Variable.ttf", int(round(lore_pt * px_per_pt)), weight=460)

        rules_lh = base_pt * 1.28 * px_per_pt
        lore_lh = lore_pt * 1.20 * px_per_pt
        div_gap = (base_pt * 0.60 * px_per_pt) if (rules_text and lore_text) else 0.0

        r_lines = (
            wrap_lines_variable_width(
                rules_text, rules_font, box_top + pad_y, rules_lh, full_w, narrow_w, narrow_y_threshold
            )
            if rules_text
            else []
        )
        after_r_y = box_top + pad_y + len(r_lines) * rules_lh + div_gap
        formatted_lore = f"“{lore_text}”" if lore_text else ""
        l_lines = (
            wrap_lines_variable_width(
                formatted_lore, lore_font, after_r_y, lore_lh, full_w, narrow_w, narrow_y_threshold
            )
            if formatted_lore
            else []
        )

        total_h = len(r_lines) * rules_lh + div_gap + len(l_lines) * lore_lh
        start_y = box_top + max(pad_y, (box_h - total_h) * 0.44)

        # Re-wrap at true centered start_y so P/H plaque wrap threshold is exact
        r_lines = (
            wrap_lines_variable_width(
                rules_text, rules_font, start_y, rules_lh, full_w, narrow_w, narrow_y_threshold
            )
            if rules_text
            else []
        )
        after_r_y = start_y + len(r_lines) * rules_lh + div_gap
        l_lines = (
            wrap_lines_variable_width(
                formatted_lore, lore_font, after_r_y, lore_lh, full_w, narrow_w, narrow_y_threshold
            )
            if formatted_lore
            else []
        )
        total_h = len(r_lines) * rules_lh + div_gap + len(l_lines) * lore_lh
        start_y = box_top + max(pad_y * 0.85, (box_h - total_h) * 0.44)

        best = (rules_font, lore_font, rules_lh, lore_lh, div_gap, r_lines, l_lines, start_y, total_h)
        if start_y + total_h <= box_bot - pad_y * 0.95:
            break

    return best


def render_card_master_rgba(card: Dict, render_dpi: int = 900, lore_mode: str = "none") -> Image.Image:
    mm = render_dpi / 25.4
    pt = render_dpi / 72.0
    W = int(round(CANVAS_W_MM * mm))
    H = int(round(CANVAS_H_MM * mm))

    faction = card.get("faction") or "Aether"
    theme = FACTION_THEMES.get(faction, FACTION_THEMES["Aether"])
    rarity = card.get("rarity") or "Common"
    card_type = card.get("card_type") or "Entity"
    is_entity = card_type == "Entity"

    # 1. Base Full-Bleed Obsidian Background (0..69mm x 0..94mm)
    canvas = Image.new("RGBA", (W, H), (13, 14, 19, 255))
    draw = ImageDraw.Draw(canvas)

    # 2. Inner Architectural Faction Chassis (5.8..63.2mm x 5.8..88.2mm -> 3.0mm safe border inside trim)
    fx0, fy0 = int(round(5.8 * mm)), int(round(5.8 * mm))
    fx1, fy1 = int(round(63.2 * mm)), int(round(88.2 * mm))
    fw, fh = fx1 - fx0, fy1 - fy0
    chamfer_outer = 2.4 * mm

    chassis_poly = chamfer_rect_poly(fx0, fy0, fx1, fy1, chamfer_outer, chamfer_outer, chamfer_outer, chamfer_outer)
    chassis_mask = Image.new("L", (W, H), 0)
    ImageDraw.Draw(chassis_mask).polygon(chassis_poly, fill=255)

    metal_full = make_diagonal_metallic(fw, fh, theme["deep"], theme["primary"], theme["highlight"]).convert("RGBA")
    metal_layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    metal_layer.paste(metal_full, (fx0, fy0))
    canvas = Image.composite(metal_layer, canvas, chassis_mask)

    inset1 = 0.65 * mm
    in_poly = chamfer_rect_poly(
        fx0 + inset1,
        fy0 + inset1,
        fx1 - inset1,
        fy1 - inset1,
        chamfer_outer * 0.8,
        chamfer_outer * 0.8,
        chamfer_outer * 0.8,
        chamfer_outer * 0.8,
    )
    in_mask = Image.new("L", (W, H), 0)
    ImageDraw.Draw(in_mask).polygon(in_poly, fill=255)
    chassis_grad = make_vertical_gradient(fw, fh, theme["chassis_top"], theme["chassis_bot"]).convert("RGBA")
    chassis_bg = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    chassis_bg.paste(chassis_grad, (fx0, fy0))
    canvas = Image.composite(chassis_bg, canvas, in_mask)

    filigree_canvas = canvas.copy()
    draw_celestial_chassis_pattern(filigree_canvas, (fx0, fy0, fx1, fy1), theme, mm)
    canvas = Image.composite(filigree_canvas, canvas, in_mask)
    draw = ImageDraw.Draw(canvas)

    rail_in = 1.25 * mm
    rail_poly = chamfer_rect_poly(
        fx0 + rail_in,
        fy0 + rail_in,
        fx1 - rail_in,
        fy1 - rail_in,
        chamfer_outer * 0.65,
        chamfer_outer * 0.65,
        chamfer_outer * 0.65,
        chamfer_outer * 0.65,
    )
    draw.polygon(rail_poly, outline=(*theme["primary"], 115), width=max(2, int(round(0.18 * mm))))
    draw.polygon(chassis_poly, outline=(*theme["highlight"], 180), width=max(2, int(round(0.18 * mm))))

    # 3. Centerpiece Artwork Viewport (7.0..62.0mm x 14.5..60.4mm -> 55.0mm x 45.9mm)
    ax0, ay0 = int(round(7.0 * mm)), int(round(14.5 * mm))
    ax1, ay1 = int(round(62.0 * mm)), int(round(60.4 * mm))
    aw, ah = ax1 - ax0, ay1 - ay0
    art_poly = chamfer_rect_poly(ax0, ay0, ax1, ay1, 3.6 * mm, 2.2 * mm, 1.4 * mm, 1.4 * mm)

    raw_art = fetch_raw_art(card)
    framed_art = smart_crop_to_aspect(raw_art, aw, ah).convert("RGBA")

    art_shade = Image.new("RGBA", (aw, ah), (0, 0, 0, 0))
    sd = ImageDraw.Draw(art_shade)
    top_vign = int(round(3.0 * mm))
    bot_vign = int(round(5.0 * mm))
    for y in range(top_vign):
        a = int(85 * (1.0 - y / max(1, top_vign)) ** 1.6)
        sd.line([(0, y), (aw, y)], fill=(6, 8, 14, a))
    for y in range(bot_vign):
        a = int(125 * (y / max(1, bot_vign)) ** 1.6)
        sd.line([(0, ah - bot_vign + y), (aw, ah - bot_vign + y)], fill=(6, 8, 14, a))
    framed_art.alpha_composite(art_shade)

    art_mask = Image.new("L", (W, H), 0)
    ImageDraw.Draw(art_mask).polygon(art_poly, fill=255)
    art_layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    art_layer.paste(framed_art, (ax0, ay0))
    canvas = Image.composite(art_layer, canvas, art_mask)
    draw = ImageDraw.Draw(canvas)

    draw.polygon(art_poly, outline=(8, 10, 16, 235), width=max(3, int(round(0.55 * mm))))
    draw.polygon(art_poly, outline=(*theme["primary"], 235), width=max(2, int(round(0.32 * mm))))
    inner_art_poly = chamfer_rect_poly(
        ax0 + 0.25 * mm,
        ay0 + 0.25 * mm,
        ax1 - 0.25 * mm,
        ay1 - 0.25 * mm,
        3.45 * mm,
        2.05 * mm,
        1.25 * mm,
        1.25 * mm,
    )
    draw.polygon(inner_art_poly, outline=(*theme["highlight"], 115), width=max(1, int(round(0.12 * mm))))

    # 4. Top Card Nameplate & Faction Medallion (15.4..62.0mm x 7.1..13.9mm)
    nx0, ny0 = int(round(15.4 * mm)), int(round(7.1 * mm))
    nx1, ny1 = int(round(62.0 * mm)), int(round(13.9 * mm))
    name_poly = chamfer_rect_poly(nx0, ny0, nx1, ny1, 1.2 * mm, 1.8 * mm, 1.2 * mm, 1.2 * mm)

    shadow_layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(shadow_layer).polygon([(x, y + 0.45 * mm) for x, y in name_poly], fill=(0, 0, 0, 170))
    shadow_layer = shadow_layer.filter(ImageFilter.GaussianBlur(radius=int(0.55 * mm)))
    canvas.alpha_composite(shadow_layer)

    name_grad = make_vertical_gradient(
        nx1 - nx0, ny1 - ny0, lerp_color(theme["type_bar_top"], (26, 30, 42), 0.35), (12, 14, 21)
    ).convert("RGBA")
    name_mask = Image.new("L", (W, H), 0)
    ImageDraw.Draw(name_mask).polygon(name_poly, fill=255)
    name_layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    name_layer.paste(name_grad, (nx0, ny0))
    canvas = Image.composite(name_layer, canvas, name_mask)
    draw = ImageDraw.Draw(canvas)

    draw.polygon(name_poly, outline=(*theme["primary"], 220), width=max(2, int(round(0.28 * mm))))
    trace_y = ny0 + int(round(0.75 * mm))
    draw.line(
        [
            (nx0 + int(3.0 * mm), trace_y),
            (nx1 - int(11.0 * mm), trace_y),
            (nx1 - int(9.8 * mm), trace_y + int(0.65 * mm)),
        ],
        fill=(*theme["highlight"], 85),
        width=max(1, int(round(0.12 * mm))),
    )

    med_cx = int(round(58.4 * mm))
    med_cy = (ny0 + ny1) // 2
    med_r = int(round(2.70 * mm))
    draw.ellipse(
        (med_cx - med_r - int(0.3 * mm), med_cy - med_r - int(0.3 * mm), med_cx + med_r + int(0.3 * mm), med_cy + med_r + int(0.3 * mm)),
        fill=(10, 12, 18, 255),
        outline=(*theme["primary"], 215),
        width=max(2, int(round(0.22 * mm))),
    )
    emblem = load_faction_emblem(theme["logo"])
    if emblem is not None:
        em_dim = int(round(med_r * 1.62))
        ew, eh = emblem.size
        scale = min(em_dim / ew, em_dim / eh)
        em_resized = emblem.resize((max(1, int(ew * scale)), max(1, int(eh * scale))), Image.Resampling.LANCZOS)
        canvas.alpha_composite(em_resized, (med_cx - em_resized.width // 2, med_cy - em_resized.height // 2))
        draw = ImageDraw.Draw(canvas)

    # Card Name Typography (Cinzel Bold — single-line up to ~27 chars, 2-line balanced stack for ultra-long names)
    card_name = clean_text(card.get("name"))
    name_left_x = int(round(18.5 * mm))
    name_right_x = med_cx - med_r - int(round(2.0 * mm))
    avail_name_w = name_right_x - name_left_x
    sh_off = max(2, int(round(0.22 * mm)))

    single_font = None
    for pt_size in [11.5, 11.0, 10.4, 9.8, 9.2, 8.6, 8.0, 7.5]:
        f_cand = load_font("Cinzel-Variable.ttf", int(round(pt_size * pt)), weight=760)
        b = f_cand.getbbox(card_name)
        if (b[2] - b[0]) <= avail_name_w:
            single_font = f_cand
            break

    if single_font is not None:
        nb = single_font.getbbox(card_name)
        name_y = (ny0 + ny1) / 2.0 - (nb[3] - nb[1]) / 2.0 - nb[1] + 0.12 * mm
        draw.text((name_left_x + sh_off, name_y + sh_off), card_name, font=single_font, fill=(0, 0, 0, 235))
        draw.text((name_left_x, name_y), card_name, font=single_font, fill=(252, 250, 245, 255))
    else:
        l1, l2 = split_title_two_lines(card_name)
        two_font = load_font("Cinzel-Variable.ttf", int(round(6.8 * pt)), weight=760)
        for pt_size in [7.4, 7.0, 6.6, 6.2, 5.8]:
            f_cand = load_font("Cinzel-Variable.ttf", int(round(pt_size * pt)), weight=760)
            w1 = f_cand.getbbox(l1)[2] - f_cand.getbbox(l1)[0]
            w2 = f_cand.getbbox(l2)[2] - f_cand.getbbox(l2)[0]
            if max(w1, w2) <= avail_name_w:
                two_font = f_cand
                break
        b1 = two_font.getbbox(l1)
        b2 = two_font.getbbox(l2)
        h1, h2 = b1[3] - b1[1], b2[3] - b2[1]
        gap_2 = 0.55 * mm
        tot_2h = h1 + gap_2 + h2
        y1_t = (ny0 + ny1) / 2.0 - tot_2h / 2.0 - b1[1] + 0.15 * mm
        y2_t = y1_t + b1[1] + h1 + gap_2 - b2[1]
        draw.text((name_left_x + sh_off, y1_t + sh_off), l1, font=two_font, fill=(0, 0, 0, 235))
        draw.text((name_left_x, y1_t), l1, font=two_font, fill=(252, 250, 245, 255))
        draw.text((name_left_x + sh_off, y2_t + sh_off), l2, font=two_font, fill=(0, 0, 0, 235))
        draw.text((name_left_x, y2_t), l2, font=two_font, fill=(252, 250, 245, 255))

    # 5. Top-Left Resonance Cost Crystal Crest (5.4..17.6mm x 5.4..18.8mm)
    cx0, cy0 = 5.4 * mm, 5.4 * mm
    cx1, cy1 = 17.6 * mm, 18.8 * mm
    crest_outer = [
        (cx0 + 1.8 * mm, cy0),
        (cx1, cy0),
        (cx1 - 2.3 * mm, cy0 + 8.8 * mm),
        (cx0 + 4.8 * mm, cy0 + 11.2 * mm),
        (cx0, cy1),
        (cx0, cy0 + 1.8 * mm),
    ]

    c_shad = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(c_shad).polygon([(x + 0.35 * mm, y + 0.65 * mm) for x, y in crest_outer], fill=(0, 0, 0, 200))
    c_shad = c_shad.filter(ImageFilter.GaussianBlur(radius=int(0.75 * mm)))
    canvas.alpha_composite(c_shad)

    cw_px = int(round(cx1 - cx0 + 2 * mm))
    ch_px = int(round(cy1 - cy0 + 2 * mm))
    crest_metal = make_diagonal_metallic(cw_px, ch_px, theme["deep"], theme["primary"], theme["highlight"]).convert("RGBA")
    crest_mask = Image.new("L", (W, H), 0)
    ImageDraw.Draw(crest_mask).polygon(crest_outer, fill=255)
    crest_metal_layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    crest_metal_layer.paste(crest_metal, (int(cx0), int(cy0)))
    canvas = Image.composite(crest_metal_layer, canvas, crest_mask)

    pad_c = 0.95 * mm
    crest_inner = [
        (cx0 + 1.8 * mm + pad_c * 0.4, cy0 + pad_c),
        (cx1 - pad_c * 1.15, cy0 + pad_c),
        (cx1 - 2.3 * mm - pad_c * 0.85, cy0 + 8.8 * mm - pad_c * 0.45),
        (cx0 + 4.4 * mm, cy0 + 10.4 * mm - pad_c * 0.3),
        (cx0 + pad_c, cy1 - pad_c * 1.65),
        (cx0 + pad_c, cy0 + 1.8 * mm + pad_c * 0.4),
    ]
    inner_c_mask = Image.new("L", (W, H), 0)
    ImageDraw.Draw(inner_c_mask).polygon(crest_inner, fill=255)

    # Proper RGBA alpha_composite for crystal facet sheen (preserves opaque rich jewel core!)
    jewel_grad = make_vertical_gradient(cw_px, ch_px, theme["core_top"], theme["core_bot"]).convert("RGBA")
    facet_ov = Image.new("RGBA", (cw_px, ch_px), (0, 0, 0, 0))
    fd = ImageDraw.Draw(facet_ov)
    fd.polygon([(0, 0), (cw_px, 0), (int(cw_px * 0.48), int(ch_px * 0.50)), (0, int(ch_px * 0.68))], fill=(*theme["highlight"], 48))
    fd.polygon([(0, 0), (int(cw_px * 0.52), 0), (int(cw_px * 0.22), int(ch_px * 0.35)), (0, int(ch_px * 0.40))], fill=(255, 255, 255, 38))
    jewel_grad.alpha_composite(facet_ov)

    jewel_layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    jewel_layer.paste(jewel_grad, (int(cx0), int(cy0)))
    canvas = Image.composite(jewel_layer, canvas, inner_c_mask)
    draw = ImageDraw.Draw(canvas)

    draw.polygon(crest_outer, outline=(10, 12, 18, 230), width=max(2, int(round(0.32 * mm))))
    draw.polygon(crest_inner, outline=(*theme["highlight"], 185), width=max(2, int(round(0.18 * mm))))

    cost_str = str(card.get("cost") if card.get("cost") is not None else 0)
    cost_pt = 23.5 if len(cost_str) == 1 else 19.0
    cost_font = load_font("Rajdhani-Bold.ttf", int(round(cost_pt * pt)))
    cb = cost_font.getbbox(cost_str)
    cost_w, cost_h = cb[2] - cb[0], cb[3] - cb[1]
    num_cx = cx0 + 5.55 * mm
    num_cy = cy0 + 5.45 * mm
    num_x = num_cx - cost_w / 2.0 - cb[0]
    num_y = num_cy - cost_h / 2.0 - cb[1]

    stroke_px = max(3, int(round(0.38 * mm)))
    draw.text(
        (num_x + int(0.28 * mm), num_y + int(0.36 * mm)),
        cost_str,
        font=cost_font,
        fill=(0, 0, 0, 225),
        stroke_width=stroke_px,
        stroke_fill=(0, 0, 0, 225),
    )
    draw.text(
        (num_x, num_y),
        cost_str,
        font=cost_font,
        fill=(255, 255, 255, 255),
        stroke_width=max(2, stroke_px // 2),
        stroke_fill=(12, 14, 20, 245),
    )

    chev_x = fx0 + 1.75 * mm
    for idx in range(4):
        cy_tick = cy1 + (1.2 + idx * 1.55) * mm
        draw.polygon(
            [
                (chev_x, cy_tick),
                (chev_x + 0.75 * mm, cy_tick - 0.55 * mm),
                (chev_x + 0.75 * mm, cy_tick + 0.35 * mm),
                (chev_x, cy_tick + 0.90 * mm),
            ],
            outline=(*theme["primary"], 130),
            width=max(1, int(round(0.11 * mm))),
        )

    # 6. Lower Oracle/Rules Text Chamber (7.0..62.0mm x 63.0..83.7mm -> 20.7mm height)
    rules_text = clean_text(card.get("description"))
    raw_lore = clean_text(card.get("lore"))
    effective_lore = resolve_effective_lore(rules_text, raw_lore, lore_mode)

    tx0, ty0 = int(round(7.0 * mm)), int(round(63.0 * mm))
    tx1, ty1 = int(round(62.0 * mm)), int(round(83.7 * mm))
    tw_box, th_box = tx1 - tx0, ty1 - ty0
    text_poly = chamfer_rect_poly(tx0, ty0, tx1, ty1, 0.0, 0.0, 1.6 * mm, 1.6 * mm)

    text_bg = make_vertical_gradient(tw_box, th_box, (15, 18, 27), (10, 12, 18)).convert("RGBA")
    if emblem is not None:
        # Slightly stronger centered watermark (11%) on pure vanilla Entities so chamber feels crafted
        is_empty_chamber = not rules_text and not effective_lore
        wm_scale = 0.72 if is_empty_chamber else 0.78
        wm_alpha = 0.12 if is_empty_chamber else 0.055
        wm_h = int(round(th_box * wm_scale))
        ew, eh = emblem.size
        wm_w = max(1, int(round(ew * (wm_h / eh))))
        wm = emblem.resize((wm_w, wm_h), Image.Resampling.LANCZOS)
        r_ch, g_ch, b_ch, a_ch = wm.split()
        a_ch = a_ch.point(lambda p: int(p * wm_alpha))
        wm = Image.merge("RGBA", (r_ch, g_ch, b_ch, a_ch))
        wm_x = (tw_box - wm_w) // 2 - (int(2.5 * mm) if (is_empty_chamber and is_entity) else 0)
        text_bg.alpha_composite(wm, (wm_x, (th_box - wm_h) // 2))

    tbd = ImageDraw.Draw(text_bg)
    brk = int(round(2.2 * mm))
    m_pad = int(round(0.95 * mm))
    brk_col = (*theme["primary"], 75)
    lw_brk = max(1, int(round(0.12 * mm)))
    tbd.line([(m_pad, th_box - m_pad - brk), (m_pad, th_box - m_pad), (m_pad + brk, th_box - m_pad)], fill=brk_col, width=lw_brk)
    if not is_entity:
        tbd.line(
            [(tw_box - m_pad - brk, th_box - m_pad), (tw_box - m_pad, th_box - m_pad), (tw_box - m_pad, th_box - m_pad - brk)],
            fill=brk_col,
            width=lw_brk,
        )

    text_mask = Image.new("L", (W, H), 0)
    ImageDraw.Draw(text_mask).polygon(text_poly, fill=255)
    text_layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    text_layer.paste(text_bg, (tx0, ty0))
    canvas = Image.composite(text_layer, canvas, text_mask)
    draw = ImageDraw.Draw(canvas)
    draw.polygon(text_poly, outline=(*theme["primary"], 185), width=max(2, int(round(0.24 * mm))))

    # 7. Mid-Card Type, Rarity Gem & Keyword Bar (7.0..62.0mm x 58.2..63.6mm)
    bx0, by0 = int(round(7.0 * mm)), int(round(58.2 * mm))
    bx1, by1 = int(round(62.0 * mm)), int(round(63.6 * mm))
    bar_poly = chamfer_rect_poly(bx0, by0, bx1, by1, 1.3 * mm, 1.3 * mm, 0.8 * mm, 0.8 * mm)

    b_shad = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(b_shad).polygon([(x, y + 0.35 * mm) for x, y in bar_poly], fill=(0, 0, 0, 185))
    b_shad = b_shad.filter(ImageFilter.GaussianBlur(radius=int(0.45 * mm)))
    canvas.alpha_composite(b_shad)

    bar_grad = make_vertical_gradient(bx1 - bx0, by1 - by0, theme["type_bar_top"], theme["type_bar_bot"]).convert("RGBA")
    wedge_ov = Image.new("RGBA", (bx1 - bx0, by1 - by0), (0, 0, 0, 0))
    bd = ImageDraw.Draw(wedge_ov)
    wedge_w = int(round(8.0 * mm))
    bd.polygon(
        [(0, 0), (wedge_w, 0), (wedge_w - int(1.8 * mm), by1 - by0), (0, by1 - by0)],
        fill=(*theme["deep"], 185),
    )
    bd.line(
        [(wedge_w, 0), (wedge_w - int(1.8 * mm), by1 - by0)],
        fill=(*theme["highlight"], 185),
        width=max(2, int(round(0.20 * mm))),
    )
    bar_grad.alpha_composite(wedge_ov)

    bar_mask = Image.new("L", (W, H), 0)
    ImageDraw.Draw(bar_mask).polygon(bar_poly, fill=255)
    bar_layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    bar_layer.paste(bar_grad, (bx0, by0))
    canvas = Image.composite(bar_layer, canvas, bar_mask)
    draw = ImageDraw.Draw(canvas)

    draw.polygon(bar_poly, outline=(*theme["primary"], 235), width=max(2, int(round(0.28 * mm))))
    draw.line(
        [(bx0 + int(1.4 * mm), by0 + int(0.22 * mm)), (bx1 - int(1.4 * mm), by0 + int(0.22 * mm))],
        fill=(*theme["highlight"], 150),
        width=max(1, int(round(0.12 * mm))),
    )

    gem_cx = bx0 + int(round(3.7 * mm))
    gem_cy = (by0 + by1) // 2
    draw_rarity_gem(canvas, gem_cx, gem_cy, int(round(1.90 * mm)), rarity)
    draw = ImageDraw.Draw(canvas)

    glyph_cx = bx0 + int(round(9.5 * mm))
    glyph_cy = (by0 + by1) // 2
    draw_card_type_glyph(draw, glyph_cx, glyph_cy, int(round(1.20 * mm)), card_type, (*theme["highlight"], 240))

    type_label = f"{faction.upper()} • {card_type.upper()}"
    type_font = load_font("Outfit-Variable.ttf", int(round(7.4 * pt)), weight=760)
    tb = type_font.getbbox(type_label)
    type_x = bx0 + int(round(11.7 * mm))
    type_y = (by0 + by1) / 2.0 - (tb[3] - tb[1]) / 2.0 - tb[1]
    draw.text((type_x + int(0.18 * mm), type_y + int(0.20 * mm)), type_label, font=type_font, fill=(0, 0, 0, 220))
    draw.text((type_x, type_y), type_label, font=type_font, fill=(248, 250, 252, 255))

    # Keyword Callout Pills — dynamically sized so 1 or 2+ keywords NEVER touch the Type label
    kws = parse_keywords(card.get("keywords"))
    if kws:
        min_kw_left = type_x + (tb[2] - tb[0]) + int(round(1.8 * mm))
        max_kw_right = bx1 - int(round(1.4 * mm))
        avail_kw_span = max_kw_right - min_kw_left

        chosen_kw = None
        for kw_pt, h_pad_mm, gap_mm in [
            (6.1, 2.8, 0.9),
            (5.7, 2.4, 0.8),
            (5.3, 2.0, 0.7),
            (4.9, 1.7, 0.6),
            (4.5, 1.5, 0.5),
        ]:
            kf = load_font("Outfit-Variable.ttf", int(round(kw_pt * pt)), weight=780)
            widths = [(kf.getbbox(k.upper())[2] - kf.getbbox(k.upper())[0]) + int(round(h_pad_mm * mm)) for k in kws]
            tot_w = sum(widths) + int(round(gap_mm * mm)) * (len(kws) - 1)
            chosen_kw = (kf, int(round(h_pad_mm * mm)), int(round(gap_mm * mm)))
            if tot_w <= avail_kw_span:
                break

        kw_font, pad_px, gap_px = chosen_kw
        cur_right = max_kw_right
        pill_h = int(round(3.35 * mm))
        pill_y0 = (by0 + by1 - pill_h) // 2
        pill_y1 = pill_y0 + pill_h
        for kw in reversed(kws):
            kw_up = kw.upper()
            kb = kw_font.getbbox(kw_up)
            kw_tw, kw_th = kb[2] - kb[0], kb[3] - kb[1]
            pill_w = kw_tw + pad_px
            px0_p = cur_right - pill_w
            px1_p = cur_right
            p_poly = chamfer_rect_poly(px0_p, pill_y0, px1_p, pill_y1, 0.65 * mm, 0.65 * mm, 0.65 * mm, 0.65 * mm)
            draw.polygon(p_poly, fill=(*theme["pill_bg"], 248), outline=(*theme["primary"], 235), width=max(2, int(round(0.18 * mm))))
            tx_kw = px0_p + (pill_w - kw_tw) / 2.0 - kb[0]
            ty_kw = pill_y0 + (pill_h - kw_th) / 2.0 - kb[1]
            draw.text((tx_kw, ty_kw), kw_up, font=kw_font, fill=(*theme["pill_text"], 255))
            cur_right = px0_p - gap_px

    # 8. Oracle/Rules Text Rendering
    text_pad_x = 2.6 * mm
    full_text_w = (tx1 - tx0) - 2.0 * text_pad_x
    ph_x0 = int(round(46.2 * mm))
    ph_y0 = int(round(76.4 * mm))
    ph_x1 = int(round(62.2 * mm))
    ph_y1 = int(round(83.9 * mm))

    narrow_text_w = (ph_x0 - tx0) - text_pad_x - 1.6 * mm if is_entity else full_text_w
    narrow_thresh_y = (ph_y0 - 0.8 * mm) if is_entity else (ty1 + 999)

    if rules_text or effective_lore:
        r_font, l_font, r_lh, l_lh, div_gap, r_lines, l_lines, cur_y, _ = layout_rules_and_lore(
            rules_text=rules_text,
            lore_text=effective_lore,
            box_top=by1 + 0.35 * mm,
            box_bot=ty1 - 0.45 * mm,
            full_w=full_text_w,
            narrow_w=narrow_text_w,
            narrow_y_threshold=narrow_thresh_y,
            px_per_pt=pt,
        )

        text_left = tx0 + text_pad_x
        for line in r_lines:
            draw.text((text_left + int(0.14 * mm), cur_y + int(0.16 * mm)), line, font=r_font, fill=(0, 0, 0, 210))
            draw.text((text_left, cur_y), line, font=r_font, fill=(244, 246, 250, 255))
            cur_y += r_lh

        if r_lines and l_lines:
            mid_div_y = cur_y + div_gap * 0.48
            div_right = (ph_x0 - 1.8 * mm) if (is_entity and mid_div_y >= narrow_thresh_y) else (tx1 - text_pad_x)
            div_cx = (text_left + div_right) / 2.0
            half_span = min(13.0 * mm, (div_right - text_left) * 0.36)
            dr = 0.46 * mm
            draw.line(
                [(div_cx - half_span, mid_div_y), (div_cx - dr * 2.2, mid_div_y)],
                fill=(*theme["primary"], 130),
                width=max(1, int(round(0.12 * mm))),
            )
            draw.line(
                [(div_cx + dr * 2.2, mid_div_y), (div_cx + half_span, mid_div_y)],
                fill=(*theme["primary"], 130),
                width=max(1, int(round(0.12 * mm))),
            )
            draw.polygon(
                [(div_cx, mid_div_y - dr), (div_cx + dr, mid_div_y), (div_cx, mid_div_y + dr), (div_cx - dr, mid_div_y)],
                fill=(*theme["highlight"], 195),
            )
            cur_y += div_gap

        center_lore = not r_lines and (not is_entity or (cur_y + len(l_lines) * l_lh < narrow_thresh_y))
        for line in l_lines:
            lx = (tx0 + tx1 - l_font.getlength(line)) / 2.0 if center_lore else text_left
            draw.text((lx + int(0.12 * mm), cur_y + int(0.14 * mm)), line, font=l_font, fill=(0, 0, 0, 200))
            draw.text((lx, cur_y), line, font=l_font, fill=(192, 201, 216, 255))
            cur_y += l_lh

    # 9. Entity Combat Stat Plaque (Power / Health — Entities Only)
    if is_entity and card.get("power") is not None and card.get("health") is not None:
        ph_poly = chamfer_rect_poly(ph_x0, ph_y0, ph_x1, ph_y1, 1.5 * mm, 1.5 * mm, 1.5 * mm, 1.5 * mm)
        ph_shad = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        ImageDraw.Draw(ph_shad).polygon([(x, y + 0.35 * mm) for x, y in ph_poly], fill=(0, 0, 0, 210))
        ph_shad = ph_shad.filter(ImageFilter.GaussianBlur(radius=int(0.45 * mm)))
        canvas.alpha_composite(ph_shad)

        ph_w, ph_h = ph_x1 - ph_x0, ph_y1 - ph_y0
        ph_metal = make_diagonal_metallic(ph_w, ph_h, theme["deep"], theme["primary"], theme["highlight"]).convert("RGBA")
        ph_mask = Image.new("L", (W, H), 0)
        ImageDraw.Draw(ph_mask).polygon(ph_poly, fill=255)
        ph_m_layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        ph_m_layer.paste(ph_metal, (ph_x0, ph_y0))
        canvas = Image.composite(ph_m_layer, canvas, ph_mask)

        ph_in_pad = 0.55 * mm
        ph_in_poly = chamfer_rect_poly(
            ph_x0 + ph_in_pad,
            ph_y0 + ph_in_pad,
            ph_x1 - ph_in_pad,
            ph_y1 - ph_in_pad,
            1.15 * mm,
            1.15 * mm,
            1.15 * mm,
            1.15 * mm,
        )
        ph_in_mask = Image.new("L", (W, H), 0)
        ImageDraw.Draw(ph_in_mask).polygon(ph_in_poly, fill=255)

        ph_core = Image.new("RGBA", (ph_w, ph_h), (14, 16, 24, 255))
        pcd = ImageDraw.Draw(ph_core)
        pcd.polygon([(0, 0), (int(ph_w * 0.53), 0), (int(ph_w * 0.45), ph_h), (0, ph_h)], fill=(44, 22, 18, 225))
        pcd.polygon([(int(ph_w * 0.53), 0), (ph_w, 0), (ph_w, ph_h), (int(ph_w * 0.45), ph_h)], fill=(14, 36, 28, 225))
        pcd.line(
            [(int(ph_w * 0.53), int(0.9 * mm)), (int(ph_w * 0.45), ph_h - int(0.9 * mm))],
            fill=(*theme["highlight"], 195),
            width=max(2, int(round(0.22 * mm))),
        )

        ph_c_layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        ph_c_layer.paste(ph_core, (ph_x0, ph_y0))
        canvas = Image.composite(ph_c_layer, canvas, ph_in_mask)
        draw = ImageDraw.Draw(canvas)
        draw.polygon(ph_poly, outline=(8, 10, 16, 235), width=max(2, int(round(0.24 * mm))))

        stat_font = load_font("Rajdhani-Bold.ttf", int(round(14.6 * pt)))
        pwr_str = str(card.get("power"))
        hlt_str = str(card.get("health"))
        mid_py = (ph_y0 + ph_y1) / 2.0

        draw_mini_sword(draw, int(round(ph_x0 + 2.05 * mm)), int(round(mid_py)), int(round(1.05 * mm)), (255, 196, 128, 215))
        draw_mini_shield(draw, int(round(ph_x1 - 2.05 * mm)), int(round(mid_py)), int(round(1.05 * mm)), (148, 242, 192, 215))

        pb = stat_font.getbbox(pwr_str)
        pw_w, pw_h = pb[2] - pb[0], pb[3] - pb[1]
        px_txt = ph_x0 + 5.35 * mm - pw_w / 2.0 - pb[0]
        py_txt = mid_py - pw_h / 2.0 - pb[1]
        draw.text((px_txt + int(0.2 * mm), py_txt + int(0.24 * mm)), pwr_str, font=stat_font, fill=(0, 0, 0, 235))
        draw.text((px_txt, py_txt), pwr_str, font=stat_font, fill=(255, 244, 224, 255))

        hb = stat_font.getbbox(hlt_str)
        hw_w, hw_h = hb[2] - hb[0], hb[3] - hb[1]
        hx_txt = ph_x1 - 5.35 * mm - hw_w / 2.0 - hb[0]
        hy_txt = mid_py - hw_h / 2.0 - hb[1]
        draw.text((hx_txt + int(0.2 * mm), hy_txt + int(0.24 * mm)), hlt_str, font=stat_font, fill=(0, 0, 0, 235))
        draw.text((hx_txt, hy_txt), hlt_str, font=stat_font, fill=(234, 255, 242, 255))

    # 10. Collector & Authenticity Footer Rail (y = 85.75 mm — crisp separation between Left, Center ◆, Right)
    foot_cy = 85.75 * mm
    set_code = (card.get("set_code") or "AWK").upper()
    cn_num = int(card.get("collector_number") or 0)
    rt_info = RARITY_THEMES.get(rarity, RARITY_THEMES["Common"])

    coll_str = f"{set_code} #{cn_num:03d} / 322"
    coll_font = load_font("Rajdhani-Bold.ttf", int(round(5.9 * pt)))
    cb_f = coll_font.getbbox(coll_str)
    coll_x = 8.4 * mm
    coll_y = foot_cy - (cb_f[3] - cb_f[1]) / 2.0 - cb_f[1]
    draw.text((coll_x, coll_y), coll_str, font=coll_font, fill=(232, 238, 248, 245))

    rar_badge_x = coll_x + (cb_f[2] - cb_f[0]) + 1.25 * mm
    rb_r = 0.98 * mm
    draw.ellipse(
        (rar_badge_x - rb_r, foot_cy - rb_r, rar_badge_x + rb_r, foot_cy + rb_r),
        fill=(14, 16, 24, 255),
        outline=(*rt_info["mid"], 235),
        width=max(2, int(round(0.16 * mm))),
    )
    rc_font = load_font("Outfit-Variable.ttf", int(round(4.4 * pt)), weight=800)
    rcb = rc_font.getbbox(rt_info["code"])
    draw.text(
        (rar_badge_x - (rcb[2] - rcb[0]) / 2.0 - rcb[0], foot_cy - (rcb[3] - rcb[1]) / 2.0 - rcb[1]),
        rt_info["code"],
        font=rc_font,
        fill=(*rt_info["top"], 255),
    )

    mid_x = W / 2.0
    fin_r = 0.80 * mm
    draw.line(
        [(mid_x - 3.0 * mm, foot_cy), (mid_x - fin_r * 1.9, foot_cy)],
        fill=(*theme["primary"], 150),
        width=max(1, int(round(0.14 * mm))),
    )
    draw.line(
        [(mid_x + fin_r * 1.9, foot_cy), (mid_x + 3.0 * mm, foot_cy)],
        fill=(*theme["primary"], 150),
        width=max(1, int(round(0.14 * mm))),
    )
    draw.polygon(
        [
            (mid_x, foot_cy - fin_r),
            (mid_x + fin_r * 0.42, foot_cy - fin_r * 0.42),
            (mid_x + fin_r, foot_cy),
            (mid_x + fin_r * 0.42, foot_cy + fin_r * 0.42),
            (mid_x, foot_cy + fin_r),
            (mid_x - fin_r * 0.42, foot_cy + fin_r * 0.42),
            (mid_x - fin_r, foot_cy),
            (mid_x - fin_r * 0.42, foot_cy - fin_r * 0.42),
        ],
        fill=(*theme["highlight"], 230),
    )

    stamp_str = "1ST ED.  •  © GLIMMERFALL"
    stamp_font = load_font("Outfit-Variable.ttf", int(round(4.3 * pt)), weight=600)
    sb = stamp_font.getbbox(stamp_str)
    stamp_x = 60.6 * mm - (sb[2] - sb[0]) - sb[0]
    stamp_y = foot_cy - (sb[3] - sb[1]) / 2.0 - sb[1]
    draw.text((stamp_x, stamp_y), stamp_str, font=stamp_font, fill=(156, 166, 182, 220))

    return canvas


class CMYKConverter:
    def __init__(self):
        srgb_path = ICC_DIR / "srgb.icc"
        cmyk_path = ICC_DIR / "default_cmyk.icc"
        self.srgb = ImageCms.getOpenProfile(str(srgb_path))
        self.cmyk = ImageCms.getOpenProfile(str(cmyk_path))
        self.xform = ImageCms.buildTransformFromOpenProfiles(
            self.srgb, self.cmyk, "RGB", "CMYK", renderingIntent=ImageCms.Intent.PERCEPTUAL
        )

    def rgb_to_cmyk(self, rgb_img: Image.Image) -> Image.Image:
        return ImageCms.applyTransform(rgb_img.convert("RGB"), self.xform)


def append_cmyk_card_page(doc: pymupdf.Document, bleed_cmyk: Image.Image, ocgs: Optional[Tuple[int, int, int]] = None):
    page = doc.new_page(width=PAGE_W_PT, height=PAGE_H_PT)
    mb = page.mediabox
    trim_rect = pymupdf.Rect(BLEED_PT, BLEED_PT, mb.width - BLEED_PT, mb.height - BLEED_PT)
    page.set_trimbox(trim_rect)
    page.set_artbox(trim_rect)
    page.set_bleedbox(mb)

    if ocgs is None:
        ocg_bg = doc.add_ocg("图层 2 (Bleed Background)", on=True)
        ocg_art = doc.add_ocg("图层 1 (Card Artwork CMYK)", on=True)
        ocg_cut = doc.add_ocg("图层 3 (Dieline R3 63x88mm)", on=True)
    else:
        ocg_bg, ocg_art, ocg_cut = ocgs

    bg_shape = page.new_shape()
    bg_shape.draw_rect(mb)
    bg_shape.finish(fill=(0.70, 0.65, 0.62, 0.90), color=None, oc=ocg_bg)
    bg_shape.commit()

    tiff_buf = io.BytesIO()
    bleed_cmyk.save(tiff_buf, format="TIFF", compression="tiff_adobe_deflate")
    page.insert_image(mb, stream=tiff_buf.getvalue(), oc=ocg_art)

    cut_shape = page.new_shape()
    cut_shape.draw_rect(trim_rect, radius=BLEED_PT / trim_rect.width)
    cut_shape.finish(color=(0.0, 1.0, 1.0, 0.0), fill=None, width=0.75, oc=ocg_cut)
    cut_shape.commit()


def _worker_render_one(task: Tuple[Dict, str, int, int, str]) -> Dict:
    card, out_dir_str, render_dpi, export_dpi, lore_mode = task
    out_dir = Path(out_dir_str)
    cmyk_conv = CMYKConverter()

    master_rgba = render_card_master_rgba(card, render_dpi=render_dpi, lore_mode=lore_mode)

    mm_out = export_dpi / 25.4
    out_w = int(round(CANVAS_W_MM * mm_out))
    out_h = int(round(CANVAS_H_MM * mm_out))

    bleed_rgba = master_rgba.resize((out_w, out_h), Image.Resampling.LANCZOS)
    bleed_rgb = bleed_rgba.convert("RGB")
    bleed_cmyk = cmyk_conv.rgb_to_cmyk(bleed_rgb)

    cn = int(card.get("collector_number") or 0)
    safe_slug = re.sub(r"[^a-zA-Z0-9]+", "_", card.get("name") or "Card").strip("_")
    base_name = f"AWK_{cn:03d}_{safe_slug}"

    pdf_dir = out_dir / "pdf_cmyk"
    trim_dir = out_dir / "png_trim"
    proof_dir = out_dir / "png_bleed_proof"
    pdf_dir.mkdir(parents=True, exist_ok=True)
    trim_dir.mkdir(parents=True, exist_ok=True)
    proof_dir.mkdir(parents=True, exist_ok=True)

    b_px = int(round(BLEED_MM * mm_out))
    trim_w = out_w - 2 * b_px
    trim_h = out_h - 2 * b_px
    r3_px = int(round(CORNER_R_MM * mm_out))

    cropped_trim = bleed_rgba.crop((b_px, b_px, b_px + trim_w, b_px + trim_h))
    mask_ss = Image.new("L", (trim_w * 2, trim_h * 2), 0)
    ImageDraw.Draw(mask_ss).rounded_rectangle(
        (0, 0, trim_w * 2 - 1, trim_h * 2 - 1), radius=r3_px * 2, fill=255
    )
    trim_mask = mask_ss.resize((trim_w, trim_h), Image.Resampling.LANCZOS)
    cropped_trim.putalpha(trim_mask)

    trim_png_path = trim_dir / f"{base_name}_TRIM_63x88mm_R3.png"
    cropped_trim.save(trim_png_path, dpi=(export_dpi, export_dpi))

    proof_img = bleed_rgba.copy()
    pd = ImageDraw.Draw(proof_img)
    pd.rounded_rectangle(
        (b_px, b_px, out_w - b_px - 1, out_h - b_px - 1),
        radius=r3_px,
        outline=(237, 28, 36, 255),
        width=max(3, int(round(0.32 * mm_out))),
    )
    proof_png_path = proof_dir / f"{base_name}_BLEED_DIELINE_69x94mm.png"
    proof_img.convert("RGB").save(proof_png_path, dpi=(export_dpi, export_dpi))

    doc = pymupdf.open()
    append_cmyk_card_page(doc, bleed_cmyk)
    pdf_path = pdf_dir / f"{base_name}_PRINT_CMYK_69x94mm.pdf"
    doc.save(str(pdf_path), deflate=True, garbage=3)
    doc.close()

    cmyk_bytes = bleed_cmyk.resize((80, 110), Image.Resampling.BILINEAR).tobytes()
    max_tac = max(
        (cmyk_bytes[i] + cmyk_bytes[i + 1] + cmyk_bytes[i + 2] + cmyk_bytes[i + 3]) / 2.55
        for i in range(0, len(cmyk_bytes), 4)
    )

    return {
        "collector_number": cn,
        "collector_label": f"AWK #{cn:03d}",
        "name": card.get("name"),
        "faction": card.get("faction"),
        "card_type": card.get("card_type"),
        "rarity": card.get("rarity"),
        "cost": card.get("cost"),
        "power": card.get("power"),
        "health": card.get("health"),
        "keywords": parse_keywords(card.get("keywords")),
        "description": clean_text(card.get("description")),
        "lore_included": bool(resolve_effective_lore(clean_text(card.get("description")), clean_text(card.get("lore")), lore_mode)),
        "raw_image_url": card.get("raw_image_url"),
        "existing_framed_prototype_url": card.get("framed_image_url"),
        "pdf_cmyk": f"pdf_cmyk/{pdf_path.name}",
        "png_trim": f"png_trim/{trim_png_path.name}",
        "png_bleed_proof": f"png_bleed_proof/{proof_png_path.name}",
        "max_tac_percent": round(max_tac, 1),
        "dpi": export_dpi,
    }


def build_combined_press_deck_pdf(out_dir: Path, manifest_items: List[Dict]):
    combined = pymupdf.open()
    if OFFICIAL_BACK_PDF.exists():
        back_doc = pymupdf.open(str(OFFICIAL_BACK_PDF))
        combined.insert_pdf(back_doc)
        pix = back_doc[0].get_pixmap(dpi=300)
        pix.save(str(out_dir / "AWK_000_Official_Card_Back_BLEED_DIELINE.png"))
        back_doc.close()

    for item in manifest_items:
        card_pdf = pymupdf.open(str(out_dir / item["pdf_cmyk"]))
        combined.insert_pdf(card_pdf)
        card_pdf.close()

    out_pdf = out_dir / "GlimmerFall_AWK_Sample_Pack_With_Back_CMYK_69x94mm.pdf"
    combined.save(str(out_pdf), deflate=True, garbage=3)
    combined.close()
    return out_pdf


def build_contact_sheet(out_dir: Path, manifest_items: List[Dict], lore_mode: str):
    cols = 4
    rows = math.ceil(len(manifest_items) / cols)
    thumb_w, thumb_h = 480, 670
    pad = 36
    header_h = 130
    sheet_w = pad + cols * (thumb_w + pad)
    sheet_h = header_h + pad + rows * (thumb_h + pad)

    sheet = make_vertical_gradient(sheet_w, sheet_h, (13, 16, 24), (8, 10, 16)).convert("RGBA")
    sd = ImageDraw.Draw(sheet)
    title_f = load_font("Cinzel-Variable.ttf", 44, weight=800)
    sub_f = load_font("Outfit-Variable.ttf", 22, weight=500)

    mode_lbl = "Oracle/Rules Text Only" if lore_mode == "none" else f"Lore Mode: {lore_mode}"
    sd.text((pad, 30), "GLIMMERFALL TCG — FIRST EDITION: THE AWAKENING (AWK)", font=title_f, fill=(242, 169, 0, 255))
    sd.text(
        (pad, 84),
        f"Press-Ready Prepress Sheet ({mode_lbl})  •  63×88mm R3 (+3mm Bleed = 69×94mm)  •  450 DPI ICC CMYK",
        font=sub_f,
        fill=(182, 192, 208, 255),
    )

    for idx, item in enumerate(manifest_items):
        r, c = divmod(idx, cols)
        x = pad + c * (thumb_w + pad)
        y = header_h + r * (thumb_h + pad)
        im = Image.open(out_dir / item["png_trim"]).convert("RGBA")
        im_r = im.resize((thumb_w, thumb_h), Image.Resampling.LANCZOS)
        sheet.alpha_composite(im_r, (x, y))

    sheet_path = out_dir / "GlimmerFall_AWK_Sample_Contact_Sheet.png"
    sheet.convert("RGB").save(sheet_path, quality=95)
    return sheet_path


def main():
    parser = argparse.ArgumentParser(description="GlimmerFall AWK Prepress Card Generator")
    parser.add_argument("--samples", action="store_true", help="Generate the 12-card showcase sample pack")
    parser.add_argument("--cards", type=str, help="Comma-separated collector numbers (e.g. 1,11,55,318)")
    parser.add_argument("--all", action="store_true", help="Generate all 322 cards in Expansion 1: The Awakening")
    parser.add_argument(
        "--lore-mode",
        choices=["none", "smart", "all"],
        default="none",
        help="Flavor text policy: 'none' (Oracle/rules text only, default), 'smart' (short-text cards only), 'all'",
    )
    parser.add_argument("--dpi", type=int, default=450, help="Output print DPI (default: 450, supersampled from 900)")
    parser.add_argument("--workers", type=int, default=os.cpu_count() or 4, help="Parallel worker processes")
    parser.add_argument(
        "--outdir",
        type=str,
        default=str(PROJECT_ROOT / "results"),
        help="Target output directory (default: /results in workspace)",
    )
    args = parser.parse_args()

    t0 = time.time()
    with open(CATALOG_JSON, "r", encoding="utf-8") as f:
        catalog = json.load(f)
    catalog.sort(key=lambda c: int(c.get("collector_number") or 999999))
    by_cn = {int(c["collector_number"]): c for c in catalog}

    if args.all:
        targets = catalog
    elif args.cards:
        cns = [int(x.strip()) for x in args.cards.split(",") if x.strip()]
        targets = [by_cn[cn] for cn in cns if cn in by_cn]
    else:
        targets = [by_cn[cn] for cn in DEFAULT_SAMPLE_CNS if cn in by_cn]

    out_dir = Path(args.outdir)
    out_dir.mkdir(parents=True, exist_ok=True)
    render_dpi = max(600, args.dpi * 2)

    print(f"[*] Prefetching Vercel Blob artwork for {len(targets)} cards...")
    with ThreadPoolExecutor(max_workers=16) as pool:
        list(pool.map(ensure_cached_art, targets))

    print(f"[*] Rendering {len(targets)} GlimmerFall AWK cards ({args.workers} workers, lore_mode={args.lore_mode}) -> {out_dir}")
    tasks = [(c, str(out_dir), render_dpi, args.dpi, args.lore_mode) for c in targets]

    manifest_items: List[Dict] = []
    with ProcessPoolExecutor(max_workers=args.workers) as pool:
        futures = {pool.submit(_worker_render_one, t): t[0] for t in tasks}
        done_cnt = 0
        for fut in as_completed(futures):
            done_cnt += 1
            meta = fut.result()
            manifest_items.append(meta)
            print(f"  [{done_cnt:03d}/{len(targets):03d}] AWK #{meta['collector_number']:03d} — {meta['name']}")

    manifest_items.sort(key=lambda m: m["collector_number"])
    combined_pdf = build_combined_press_deck_pdf(out_dir, manifest_items)
    contact_sheet = build_contact_sheet(out_dir, manifest_items, args.lore_mode)

    elapsed = time.time() - t0
    manifest = {
        "game": "GlimmerFall TCG",
        "expansion": "The Awakening (AWK)",
        "edition": "First Edition",
        "lore_mode": args.lore_mode,
        "total_catalog_cards": len(catalog),
        "generated_count": len(manifest_items),
        "elapsed_seconds": round(elapsed, 1),
        "press_specification": {
            "manufacturer": "Super Board Game Manufacturing (Shenzhen, CN)",
            "trim_mm": "63.00 x 88.00 mm",
            "corner_radius_mm": "3.00 mm (R3)",
            "bleed_mm": "3.00 mm all sides",
            "bleed_canvas_mm": "69.00 x 94.00 mm",
            "color_space": "ICC CMYK (4C+4C, TAC <= 300%)",
            "paper_stock": "300gsm artpaper (Common/Uncommon) & 300gsm holographic paper (Rare/Epic)",
            "finish": "Glossy varnishing",
            "dieline_layer": "图层 3 (Dieline R3 63x88mm) — CMYK (0, 100%, 100%, 0) separate OCG layer",
        },
        "combined_press_pdf": combined_pdf.name,
        "contact_sheet_png": contact_sheet.name,
        "official_back_preview": "AWK_000_Official_Card_Back_BLEED_DIELINE.png",
        "cards": manifest_items,
    }
    (out_dir / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\n[✓] Complete in {elapsed:.1f}s! ({elapsed / max(1, len(manifest_items)):.2f}s/card)")


if __name__ == "__main__":
    main()
