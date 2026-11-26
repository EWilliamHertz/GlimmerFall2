#!/usr/bin/env python3
"""
GlimmerFall TCG — First Edition: The Awakening (AWK)
Bespoke Retail Starter Deck Tuck-In Box Prepress Engine (65 x 90 x 15 mm, 40 Cards)

Designed 100% from scratch in the sculpted metallic & jewel-toned architectural style
of the GlimmerFall AWK Card Engine (zero Bhuvan template reuse):
  - Jewel-toned faction metallic chassis across spines, lids, and flaps (Solari Burnished Gold,
    Umbri Imperial Amethyst, Aether Astral Sapphire-Cyan, Terra Verdant Emerald-Bronze)
  - Full-bleed vibrant hero illustration on the Front Cover with sculpted 8-sided chamfered
    metallic title plaque, overlapping circular Faction Medallion crest, and corner filigree
  - Dynamic 3-Card Fan of real rendered AWK cards on the Back Panel + chamfered lore scroll,
    contents breakdown, scannable EAN-13 barcode, CE / Ages 13+ badges, and GlimmerFallTCG.com
  - Exact +3.0 mm contour bleed on `/home/ewilliamhe/TuckInBox.pdf` + 3.0 mm glue-crease ink wrap
    with unvarnished white adhesive bonding strip, exported at 300 DPI ICC CMYK (TAC <= 295%)
    on OCG layer `DESIGN` underneath toggleable factory dieline OCG `图层 1`.
"""

import io
import math
from pathlib import Path
from typing import Dict, List, Tuple

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter
import pymupdf as fitz

from generate_packaging import (
    CMYKConverter,
    cover_crop,
    draw_centered_text,
    draw_glimmerfall_wordmark,
    load_clean_art,
    load_crest,
    load_faction_icon,
    load_font,
    lerp_rgb,
    make_vertical_gradient,
    render_ean13_box,
    tac_stats,
    wrap_lines,
)

ENGINE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = ENGINE_DIR.parent
PRINT_DIR = PROJECT_ROOT / "print" / "updates"
RESULTS_TRIM_DIR = PROJECT_ROOT / "frontend" / "public" / "results" / "trim"
TUCK_TEMPLATE_PDF = Path("/home/ewilliamhe/TuckInBox.pdf")
if not TUCK_TEMPLATE_PDF.exists():
    TUCK_TEMPLATE_PDF = (
        PROJECT_ROOT
        / "Bhuvan_Instructions"
        / "Bhuvan Instructions"
        / "0.1 GlimmerFall Tuck-Box Production Handoff"
        / "01_Template"
        / "TuckInBox.pdf"
    )


TUCK_DECKS: List[Dict] = [
    {
        "title": "Solar Singularity",
        "upper_title": "SOLAR SINGULARITY",
        "faction": "Solari",
        "archetype": "SOLARI AGGRO & RADIANCE DECK",
        "back_kicker": "UNLEASH THE FURY OF THE SUN",
        "filename_stem": "TuckInBox - Solar Singularity (Solari)",
        "art_file": "emberwing_courier.webp",
        "focus_x": 0.48,
        "focus_y": 0.38,
        "fan_cards": [3, 11, 5],  # Dawnblade Templar, Emberwing Courier (Hero), Decree of the Sun
        # Bespoke Faction Palette (Rich Burnished Gold & Amber Bronze — NOT flat black!)
        "metal_hi": (255, 232, 152),
        "metal_mid": (236, 164, 12),
        "metal_deep": (122, 72, 6),
        "chassis_top": (58, 38, 12),
        "chassis_mid": (36, 23, 8),
        "chassis_bot": (22, 14, 6),
        "plaque_top": (44, 29, 10),
        "plaque_bot": (20, 13, 6),
        "ribbon_bg": (92, 56, 6),
        "ean12": "200202600401",
        "sku": "GF-AWK-TD01",
        "lore": (
            "Strike with the fury of a dying star! Deploy swift celestial Emberwings "
            "to overwhelm enemy defenses before they can recover, burning through every "
            "shadow with blinding Solari radiance."
        ),
    },
    {
        "title": "The Graveglass Veil",
        "upper_title": "THE GRAVEGLASS VEIL",
        "faction": "Umbri",
        "archetype": "UMBRI VOID & SACRIFICE DECK",
        "back_kicker": "COMMAND THE UNDYING VOID",
        "filename_stem": "TuckInBox - The Graveglass Veil (Umbri)",
        "art_file": "graveglass_oracle.webp",
        "focus_x": 0.50,
        "focus_y": 0.34,
        "fan_cards": [31, 36, 30],  # Shadow Cloak, Graveglass Oracle (Hero), The Nightfall King
        # Bespoke Faction Palette (Royal Imperial Amethyst & Velvet Plum)
        "metal_hi": (234, 192, 255),
        "metal_mid": (172, 72, 255),
        "metal_deep": (78, 22, 138),
        "chassis_top": (48, 22, 76),
        "chassis_mid": (30, 14, 50),
        "chassis_bot": (17, 9, 30),
        "plaque_top": (38, 18, 62),
        "plaque_bot": (18, 9, 32),
        "ribbon_bg": (68, 22, 118),
        "ean12": "200202600402",
        "sku": "GF-AWK-TD02",
        "lore": (
            "Gaze beyond the veil of mortality! Turn your Void into a second hand—"
            "sacrifice fallen Entities to unleash forbidden Rites and overwhelm foes "
            "with an undying tide of Umbri shadows."
        ),
    },
    {
        "title": "Fractured Continuum",
        "upper_title": "FRACTURED CONTINUUM",
        "faction": "Aether",
        "archetype": "AETHER TEMPORAL CONTROL DECK",
        "back_kicker": "SHATTER TIME & BEND REALITY",
        "filename_stem": "TuckInBox - Fractured Continuum (Aether)",
        "art_file": "reality_fracture.webp",
        "focus_x": 0.50,
        "focus_y": 0.45,
        "fan_cards": [82, 84, 81],  # Aetheric Blast, Reality Fracture (Hero), The Infinite Loop
        # Bespoke Faction Palette (Astral Sapphire-Cobalt & Electric Cyan)
        "metal_hi": (178, 242, 255),
        "metal_mid": (18, 194, 255),
        "metal_deep": (10, 78, 142),
        "chassis_top": (16, 42, 78),
        "chassis_mid": (11, 27, 54),
        "chassis_bot": (8, 16, 34),
        "plaque_top": (14, 34, 66),
        "plaque_bot": (8, 18, 38),
        "ribbon_bg": (12, 68, 124),
        "ean12": "200202600403",
        "sku": "GF-AWK-TD03",
        "lore": (
            "Rewrite the laws of time and space! Echo arcane Flashes, counter enemy "
            "Rites, and trap opposing Entities in temporal loops until reality "
            "collapses completely in your favor."
        ),
    },
    {
        "title": "Gaia’s Loop",
        "upper_title": "GAIA’S LOOP",
        "faction": "Terra",
        "archetype": "TERRA RESONANCE RAMP DECK",
        "back_kicker": "AWAKEN THE LIVING WORLD-SOUL",
        "filename_stem": "TuckInBox - Gaia's Loop (Terra)",
        "art_file": "gaia_the_world-soul.webp",
        "focus_x": 0.50,
        "focus_y": 0.35,
        "fan_cards": [61, 55, 59],  # Mossback Forager, Gaia The World-Soul (Hero), Primordial Growth
        # Bespoke Faction Palette (Ancient Verdant Emerald & Forest Gold)
        "metal_hi": (172, 255, 210),
        "metal_mid": (38, 214, 120),
        "metal_deep": (12, 92, 48),
        "chassis_top": (16, 54, 34),
        "chassis_mid": (11, 35, 22),
        "chassis_bot": (8, 20, 13),
        "plaque_top": (14, 44, 28),
        "plaque_bot": (8, 22, 14),
        "ribbon_bg": (16, 82, 44),
        "ean12": "200202600404",
        "sku": "GF-AWK-TD04",
        "lore": (
            "Embrace the primal heartbeat of the earth! Accelerate your Glimmer Nodes "
            "at breathtaking speed to summon colossal Terra behemoths and let the "
            "ancient forest reclaim the battlefield."
        ),
    },
]


# ---------------------------------------------------------------------------
# Sculpted Vector / Chamfered Geometry Primitives
# ---------------------------------------------------------------------------
def chamfer_pts(x0: int, y0: int, x1: int, y1: int, c: int) -> List[Tuple[int, int]]:
    c = min(c, (x1 - x0) // 3, (y1 - y0) // 3)
    return [
        (x0 + c, y0),
        (x1 - c, y0),
        (x1, y0 + c),
        (x1, y1 - c),
        (x1 - c, y1),
        (x0 + c, y1),
        (x0, y1 - c),
        (x0, y0 + c),
    ]


def draw_chamfered_metallic_plaque(
    canvas: Image.Image,
    x0: int,
    y0: int,
    x1: int,
    y1: int,
    chamfer: int,
    fill_top: Tuple[int, int, int],
    fill_bot: Tuple[int, int, int],
    border_outer: Tuple[int, int, int],
    border_inner: Tuple[int, int, int],
    alpha: int = 244,
    border_w: int = 3,
):
    w, h = x1 - x0, y1 - y0
    grad = make_vertical_gradient(w, h, fill_top, fill_bot)
    mask = Image.new("L", (w, h), 0)
    ImageDraw.Draw(mask).polygon(chamfer_pts(0, 0, w - 1, h - 1, chamfer), fill=alpha)
    grad.putalpha(mask)

    # Soft drop shadow underneath plaque
    sh = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).polygon(chamfer_pts(x0 + 2, y0 + 5, x1 + 2, y1 + 5, chamfer), fill=(0, 0, 0, 165))
    sh = sh.filter(ImageFilter.GaussianBlur(radius=max(3, chamfer // 2)))
    canvas.alpha_composite(sh)

    canvas.alpha_composite(grad, (x0, y0))
    dr = ImageDraw.Draw(canvas)
    dr.polygon(chamfer_pts(x0, y0, x1, y1, chamfer), outline=(*border_outer, 255), width=border_w)
    ins = max(3, border_w + 2)
    dr.polygon(
        chamfer_pts(x0 + ins, y0 + ins, x1 - ins, y1 - ins, max(2, chamfer - ins)),
        outline=(*border_inner, 165),
        width=max(1, border_w // 2),
    )


def draw_faction_medallion(canvas: Image.Image, cx: int, cy: int, radius: int, deck: Dict):
    """Renders a sculpted metallic circular Faction Medallion crest with inner jewel gradient & glow."""
    glow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse((cx - radius - 8, cy - radius - 8, cx + radius + 8, cy + radius + 8), fill=(*deck["metal_mid"], 95))
    glow = glow.filter(ImageFilter.GaussianBlur(radius=max(4, radius // 3)))
    canvas.alpha_composite(glow)

    diam = radius * 2
    disc = make_vertical_gradient(diam, diam, deck["chassis_top"], deck["chassis_bot"])
    dmask = Image.new("L", (diam, diam), 0)
    ImageDraw.Draw(dmask).ellipse((0, 0, diam - 1, diam - 1), fill=255)
    disc.putalpha(dmask)
    canvas.alpha_composite(disc, (cx - radius, cy - radius))

    dr = ImageDraw.Draw(canvas)
    bw = max(2, radius // 8)
    dr.ellipse((cx - radius, cy - radius, cx + radius, cy + radius), outline=(*deck["metal_hi"], 255), width=bw)
    ir = radius - bw - 2
    dr.ellipse((cx - ir, cy - ir, cx + ir, cy + ir), outline=(*deck["metal_mid"], 195), width=max(1, bw // 2))

    ic = load_faction_icon(deck["faction"], int(round(radius * 1.38)))
    canvas.alpha_composite(ic, (cx - ic.width // 2, cy - ic.height // 2))


def draw_corner_filigree(dr: ImageDraw.ImageDraw, x0: int, y0: int, x1: int, y1: int, arm: int, cham: int, col: Tuple[int, int, int], w: int):
    """Draws subtle 45°-chamfered metallic corner brackets at top-left and top-right."""
    # Top-left bracket
    dr.line([(x0, y0 + arm), (x0, y0 + cham), (x0 + cham, y0), (x0 + arm, y0)], fill=(*col, 215), width=w)
    # Top-right bracket
    dr.line([(x1 - arm, y0), (x1 - cham, y0), (x1, y0 + cham), (x1, y0 + arm)], fill=(*col, 215), width=w)


def add_faction_crystalline_texture(canvas: Image.Image, deck: Dict, opacity: int = 24):
    """Paints subtle diagonal crystalline light facets & leyline arcs so surfaces feel rich & metallic."""
    w, h = canvas.size
    ov = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    od = ImageDraw.Draw(ov)
    step = max(48, w // 14)
    for x in range(-h, w + h, step):
        od.line((x, 0, x + h, h), fill=(*deck["metal_hi"], opacity), width=2)
        od.line((x + step // 2, h, x + step // 2 + h, 0), fill=(*deck["metal_mid"], opacity // 2), width=1)
    canvas.alpha_composite(ov)


# ---------------------------------------------------------------------------
# Exact +3.0 mm TuckInBox Bleed Silhouette Extractor
# ---------------------------------------------------------------------------
def build_tuckbox_bleed_mask(doc: fitz.Document, dpi: int, bleed_mm: float = 3.0) -> Image.Image:
    src_p = doc[0]
    mdoc = fitz.open()
    mp = mdoc.new_page(width=src_p.rect.width, height=src_p.rect.height)

    sh_bg = mp.new_shape()
    sh_bg.draw_rect(mp.rect)
    sh_bg.finish(fill=(1, 1, 1), color=None)
    sh_bg.commit()

    sh_cut = mp.new_shape()
    for d in src_p.get_drawings():
        if d["rect"].x1 < 900 and (not d["dashes"] or d["dashes"] == "[] 0"):
            c = d["color"]
            if c and c[0] < 0.5:
                for it in d["items"]:
                    if it[0] == "l":
                        sh_cut.draw_line(it[1], it[2])
                    elif it[0] == "c":
                        sh_cut.draw_bezier(it[1], it[2], it[3], it[4])
                    elif it[0] == "re":
                        sh_cut.draw_rect(it[1])
    sh_cut.finish(color=(0, 0, 0), fill=None, width=2.4)
    sh_cut.commit()

    work_dpi = 150
    pix = mp.get_pixmap(dpi=work_dpi, colorspace=fitz.csGRAY)
    mdoc.close()

    im_rgb = Image.frombytes("L", (pix.width, pix.height), pix.samples).convert("RGB")
    ImageDraw.floodfill(im_rgb, (5, 5), (255, 0, 0), thresh=50)
    raw = im_rgb.tobytes()
    inside_bytes = bytearray(pix.width * pix.height)
    for i in range(0, len(raw), 3):
        inside_bytes[i // 3] = 0 if (raw[i] > 220 and raw[i + 1] < 30 and raw[i + 2] < 30) else 255
    mask_low = Image.frombytes("L", (pix.width, pix.height), bytes(inside_bytes))

    rad_px = int(round(bleed_mm * work_dpi / 25.4))
    for _ in range(rad_px):
        mask_low = mask_low.filter(ImageFilter.MaxFilter(3))

    target_w = int(round(src_p.rect.width * dpi / 72.0))
    target_h = int(round(src_p.rect.height * dpi / 72.0))
    mask = mask_low.resize((target_w, target_h), Image.Resampling.BILINEAR)
    mask = Image.eval(mask, lambda v: 255 if v >= 128 else 0)

    # Leave unprinted white adhesive bonding strip on Right Glue Flap (>3.0 mm past x=733.50 pt crease)
    pt_to_px = dpi / 72.0
    ImageDraw.Draw(mask).rectangle(
        (
            int(round(742.00 * pt_to_px)),
            int(round(286.5 * pt_to_px)),
            int(round(788.0 * pt_to_px)),
            int(round(531.0 * pt_to_px)),
        ),
        fill=0,
    )
    return mask


# ---------------------------------------------------------------------------
# Panel Renderers (100% Bespoke Architectural Design)
# ---------------------------------------------------------------------------
def render_bespoke_front(w: int, h: int, bleed_bot_px: int, mm: float, deck: Dict) -> Image.Image:
    """
    65.0 x 90.3 mm Front Cover:
      - Vivid full-bleed hero artwork with luminous faction edge-glow
      - Sculpted top canopy with GlimmerFall Crest + Wordmark + chamfered corner filigree
      - Custom 8-sided chamfered metallic title plaque at bottom with overlapping circular
        Faction Medallion crest and integrated `40-CARD STARTER DECK • 1 HOLO FOIL` ribbon
    """
    tot_h = h + bleed_bot_px
    art = load_clean_art(deck["art_file"])
    panel = cover_crop(art, w, tot_h, focus_y=deck["focus_y"], focus_x=deck["focus_x"])
    # Slightly boost saturation & crispness so print CMYK pops vividly
    panel = ImageEnhance.Color(panel.convert("RGB")).enhance(1.12).convert("RGBA")

    # Top canopy & lower ambient faction-tinted gradient (rich jewel-toned depth, NOT flat black!)
    vig = Image.new("RGBA", (w, tot_h), (0, 0, 0, 0))
    vd = ImageDraw.Draw(vig)
    top_h = int(round(24.5 * mm))
    bot_start = h - int(round(32.0 * mm))
    ctop = deck["chassis_bot"]
    for y in range(top_h):
        t = 1.0 - y / max(1, top_h)
        vd.line((0, y, w, y), fill=(*ctop, int(round(208 * (t ** 1.4)))))
    for y in range(bot_start, tot_h):
        t = min(1.0, (y - bot_start) / max(1, h - bot_start))
        vd.line((0, y, w, y), fill=(*ctop, int(round(236 * (t ** 1.25)))))
    panel.alpha_composite(vig)

    dr = ImageDraw.Draw(panel)
    cx = w // 2
    safe = int(round(4.4 * mm))

    # Sculpted 45° chamfered corner filigree at top-left & top-right
    draw_corner_filigree(
        dr,
        safe,
        safe,
        w - safe,
        h - safe,
        arm=int(round(9.5 * mm)),
        cham=int(round(2.6 * mm)),
        col=deck["metal_hi"],
        w=max(2, int(round(0.42 * mm))),
    )

    # Top GlimmerFall Shattered-Crown Crest + Wordmark
    draw_glimmerfall_wordmark(
        panel,
        cx=cx,
        cy=int(round(11.8 * mm)),
        font_px=int(round(5.35 * mm)),
        with_crest_left=True,
        crest_px=int(round(9.8 * mm)),
        subtitle="FIRST EDITION  •  AWK",
        sub_px=int(round(1.90 * mm)),
        sub_color=deck["metal_hi"],
    )

    # Lower Sculpted 8-Sided Chamfered Metallic Title Plaque
    px0 = int(round(4.6 * mm))
    px1 = w - px0
    py0 = h - int(round(25.8 * mm))
    py1 = h - int(round(10.6 * mm))
    draw_chamfered_metallic_plaque(
        panel,
        px0,
        py0,
        px1,
        py1,
        chamfer=int(round(3.0 * mm)),
        fill_top=deck["plaque_top"],
        fill_bot=deck["plaque_bot"],
        border_outer=deck["metal_hi"],
        border_inner=deck["metal_mid"],
        border_w=max(2, int(round(0.45 * mm))),
    )

    # Overlapping Circular Faction Medallion perched on top ridge of plaque!
    med_r = int(round(5.2 * mm))
    draw_faction_medallion(panel, cx, py0, med_r, deck)

    dr = ImageDraw.Draw(panel)
    title_str = deck["upper_title"]
    t_mm = 3.50 if len(title_str) <= 13 else (3.00 if len(title_str) <= 17 else 2.75)
    f_title = load_font("Cinzel-Variable.ttf", int(round(t_mm * mm)), weight=800)
    draw_centered_text(dr, cx, py0 + int(round(5.6 * mm)), title_str, f_title, (255, 250, 238, 255))

    f_arch = load_font("Outfit-Variable.ttf", int(round(1.92 * mm)), weight=800)
    draw_centered_text(dr, cx, py0 + int(round(10.6 * mm)), deck["archetype"], f_arch, (*deck["metal_hi"], 255))

    # Integrated Chamfered Ribbon Footer (`40-CARD DECK • 1 HOLO FOIL`)
    rx0 = int(round(7.8 * mm))
    rx1 = w - rx0
    ry0 = h - int(round(9.2 * mm))
    ry1 = h - int(round(4.4 * mm))
    draw_chamfered_metallic_plaque(
        panel,
        rx0,
        ry0,
        rx1,
        ry1,
        chamfer=int(round(1.4 * mm)),
        fill_top=deck["ribbon_bg"],
        fill_bot=deck["chassis_mid"],
        border_outer=deck["metal_mid"],
        border_inner=deck["metal_hi"],
        border_w=max(2, int(round(0.30 * mm))),
    )
    dr = ImageDraw.Draw(panel)
    f_rib = load_font("Outfit-Variable.ttf", int(round(1.92 * mm)), weight=800)
    draw_centered_text(
        dr,
        cx,
        ry0 + int(round(1.15 * mm)),
        "40-CARD DECK  •  1 HOLO FOIL",
        f_rib,
        (255, 248, 230, 255),
    )
    return panel


def render_3card_fan(canvas: Image.Image, cx: int, top_y: int, mm: float, deck: Dict):
    """
    Composites a dynamic 3-card fan of actual rendered AWK cards onto the Back Panel,
    with soft drop shadows and a luminous faction-foil rim on the center flagship card.
    """
    c_left_cn, c_mid_cn, c_right_cn = deck["fan_cards"]
    side_w, side_h = int(round(18.5 * mm)), int(round(25.8 * mm))
    mid_w, mid_h = int(round(20.6 * mm)), int(round(28.8 * mm))

    def load_card_thumb(cn: int, tw: int, th: int, foil_rim: bool = False) -> Image.Image:
        im = Image.open(RESULTS_TRIM_DIR / f"AWK_{cn:03d}_trim.webp").convert("RGBA")
        im = im.resize((tw, th), Image.Resampling.LANCZOS)
        if foil_rim:
            ImageDraw.Draw(im).rounded_rectangle(
                (1, 1, tw - 2, th - 2),
                radius=max(4, int(round(1.0 * mm))),
                outline=(*deck["metal_hi"], 245),
                width=max(2, int(round(0.32 * mm))),
            )
        return im

    left_c = load_card_thumb(c_left_cn, side_w, side_h).rotate(12, resample=Image.Resampling.BICUBIC, expand=True)
    right_c = load_card_thumb(c_right_cn, side_w, side_h).rotate(-12, resample=Image.Resampling.BICUBIC, expand=True)
    mid_c = load_card_thumb(c_mid_cn, mid_w, mid_h, foil_rim=True)

    def paste_with_shadow(card_rgba: Image.Image, x: int, y: int):
        sh = Image.new("RGBA", card_rgba.size, (0, 0, 0, 0))
        sh.putalpha(card_rgba.getchannel("A").point(lambda a: int(a * 0.72)))
        sh_canvas = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
        sh_canvas.alpha_composite(sh, (x + int(0.6 * mm), y + int(1.0 * mm)))
        sh_canvas = sh_canvas.filter(ImageFilter.GaussianBlur(radius=max(2, int(0.8 * mm))))
        canvas.alpha_composite(sh_canvas)
        canvas.alpha_composite(card_rgba, (x, y))

    # Radial glow behind 3-card fan
    glow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    gr = int(round(21.0 * mm))
    gy = top_y + mid_h // 2
    ImageDraw.Draw(glow).ellipse((cx - gr, gy - int(gr * 0.7), cx + gr, gy + int(gr * 0.7)), fill=(*deck["metal_mid"], 72))
    glow = glow.filter(ImageFilter.GaussianBlur(radius=int(round(4.5 * mm))))
    canvas.alpha_composite(glow)

    spread_x = int(round(13.2 * mm))
    paste_with_shadow(left_c, cx - spread_x - left_c.width // 2, top_y + int(round(2.0 * mm)))
    paste_with_shadow(right_c, cx + spread_x - right_c.width // 2, top_y + int(round(2.0 * mm)))
    paste_with_shadow(mid_c, cx - mid_c.width // 2, top_y)


def render_bespoke_back(w: int, h: int, mm: float, deck: Dict) -> Image.Image:
    """
    65.0 x 90.0 mm Back Panel:
      - Rich faction jewel-toned metallic slate with crystalline facets
      - Clears top thumb notch (`y = 0 .. 8.0 mm`) cleanly at `y = 10.6 mm`
      - Showcases real 3-card AWK fan + sculpted chamfered lore & contents scroll + barcode & URL
    """
    panel = make_vertical_gradient(w, h, deck["chassis_top"], deck["chassis_bot"])
    add_faction_crystalline_texture(panel, deck, opacity=22)

    cx = w // 2
    safe_x = int(round(4.6 * mm))
    dr = ImageDraw.Draw(panel)

    # 1. Header Kicker safely below 8.0 mm thumb notch (`y = 10.4 mm`)
    f_kick = load_font("Cinzel-Variable.ttf", int(round(2.22 * mm)), weight=800)
    draw_centered_text(dr, cx, int(round(10.4 * mm)), deck["back_kicker"], f_kick, (*deck["metal_hi"], 255))

    # Gold/Faction divider rule under kicker
    ry = int(round(14.0 * mm))
    dr.line((safe_x + int(4 * mm), ry, w - safe_x - int(4 * mm), ry), fill=(*deck["metal_mid"], 190), width=max(1, int(0.25 * mm)))

    # 2. Real 3-Card AWK Showcase Fan (`y = 15.6 .. 45.2 mm`)
    render_3card_fan(panel, cx, int(round(15.6 * mm)), mm, deck)

    # 3. Sculpted Chamfered Lore & Box Contents Scroll (`y = 46.8 .. 69.8 mm`)
    sx0, sx1 = safe_x, w - safe_x
    sy0, sy1 = int(round(46.6 * mm)), int(round(69.8 * mm))
    draw_chamfered_metallic_plaque(
        panel,
        sx0,
        sy0,
        sx1,
        sy1,
        chamfer=int(round(2.2 * mm)),
        fill_top=deck["plaque_top"],
        fill_bot=deck["plaque_bot"],
        border_outer=deck["metal_mid"],
        border_inner=deck["metal_hi"],
        border_w=max(2, int(round(0.32 * mm))),
    )
    dr = ImageDraw.Draw(panel)

    lore_pad = int(round(2.8 * mm))
    f_lore = load_font("CrimsonPro-Italic-Variable.ttf", int(round(2.28 * mm)), weight=500)
    ly = sy0 + int(round(2.2 * mm))
    for ln in wrap_lines(deck["lore"], f_lore, (sx1 - sx0) - 2 * lore_pad):
        ly += draw_centered_text(dr, cx, ly, ln, f_lore, (238, 242, 250, 255), shadow=False) + int(round(0.70 * mm))

    # Divider inside scroll + Ready-to-Play contents spec
    div_y = sy1 - int(round(6.3 * mm))
    dr.line((sx0 + lore_pad, div_y, sx1 - lore_pad, div_y), fill=(*deck["metal_mid"], 145), width=max(1, int(0.22 * mm)))
    f_spec = load_font("Outfit-Variable.ttf", int(round(1.78 * mm)), weight=800)
    draw_centered_text(
        dr,
        cx,
        sy1 - int(round(4.8 * mm)),
        "INCLUDES: 39 REGULAR + 1 HOLO FOIL CARD",
        f_spec,
        (*deck["metal_hi"], 255),
        shadow=False,
    )

    # 4. Retail Footer (`y = 71.4 .. 85.0 mm`): Barcode (Left) + GlimmerFall Brand & URL (Right)
    fy0 = int(round(71.4 * mm))
    bc_w = int(round(26.8 * mm))
    bc_h = int(round(12.8 * mm))
    bc_im = render_ean13_box(deck["ean12"], f"SKU: {deck['sku']}", bc_w, bc_h)
    panel.alpha_composite(bc_im, (safe_x, fy0))

    rx0 = safe_x + bc_w + int(round(2.0 * mm))
    rcx = (rx0 + (w - safe_x)) // 2
    draw_glimmerfall_wordmark(
        panel,
        cx=rcx,
        cy=fy0 + int(round(3.2 * mm)),
        font_px=int(round(2.55 * mm)),
        with_crest_left=True,
        crest_px=int(round(4.8 * mm)),
    )
    dr = ImageDraw.Draw(panel)
    f_meta = load_font("Outfit-Variable.ttf", int(round(1.62 * mm)), weight=700)
    draw_centered_text(dr, rcx, fy0 + int(round(6.5 * mm)), "2 PLAYERS • AGES 13+ • CE", f_meta, (218, 226, 240, 255), shadow=False)

    f_url = load_font("Outfit-Variable.ttf", int(round(2.12 * mm)), weight=800)
    draw_centered_text(dr, rcx, fy0 + int(round(9.4 * mm)), "GlimmerFallTCG.com", f_url, (242, 169, 0, 255))

    return panel


def render_bespoke_spine(w: int, h: int, mm: float, deck: Dict) -> Image.Image:
    """
    15.0 x 90.0 mm Jewel-Toned Faction Metallic Spine:
      - Faceted faction metallic gradient + inner gold pinstripes
      - Top sculpted Faction Medallion
      - Vertical `GLIMMERFALL • <DECK TITLE>`
      - Bottom chamfered `40 CARDS` shield
    """
    sp = make_vertical_gradient(w, h, deck["chassis_top"], deck["chassis_bot"])
    add_faction_crystalline_texture(sp, deck, opacity=28)
    dr = ImageDraw.Draw(sp)
    cx = w // 2

    # Twin vertical metallic pinstripes inside spine safe zone
    inset_x = int(round(2.0 * mm))
    dr.line((inset_x, int(4 * mm), inset_x, h - int(4 * mm)), fill=(*deck["metal_mid"], 135), width=max(1, int(0.24 * mm)))
    dr.line((w - inset_x, int(4 * mm), w - inset_x, h - int(4 * mm)), fill=(*deck["metal_mid"], 135), width=max(1, int(0.24 * mm)))

    # Top Faction Medallion
    draw_faction_medallion(sp, cx, int(round(10.5 * mm)), int(round(4.6 * mm)), deck)

    # Bottom Chamfered `40` Shield Badge
    bx0, bx1 = int(round(2.6 * mm)), w - int(round(2.6 * mm))
    by0, by1 = h - int(round(15.2 * mm)), h - int(round(5.4 * mm))
    draw_chamfered_metallic_plaque(
        sp,
        bx0,
        by0,
        bx1,
        by1,
        chamfer=int(round(1.5 * mm)),
        fill_top=deck["ribbon_bg"],
        fill_bot=deck["plaque_bot"],
        border_outer=deck["metal_hi"],
        border_inner=deck["metal_mid"],
        border_w=max(2, int(round(0.28 * mm))),
    )
    dr = ImageDraw.Draw(sp)
    f_40 = load_font("Rajdhani-Bold.ttf", int(round(3.8 * mm)))
    draw_centered_text(dr, cx, by0 + int(round(0.8 * mm)), "40", f_40, (255, 248, 230, 255))
    f_cd = load_font("Outfit-Variable.ttf", int(round(1.55 * mm)), weight=800)
    draw_centered_text(dr, cx, by0 + int(round(5.6 * mm)), "CARDS", f_cd, (*deck["metal_hi"], 255), shadow=False)

    # Center Vertical Title (reading bottom-to-top on shelf)
    mid_top = int(round(17.5 * mm))
    mid_bot = h - int(round(17.5 * mm))
    mid_h = mid_bot - mid_top
    rot = Image.new("RGBA", (mid_h, w), (0, 0, 0, 0))
    draw_glimmerfall_wordmark(rot, cx=mid_h // 2, cy=int(round(w * 0.36)), font_px=int(round(3.65 * mm)))
    rd = ImageDraw.Draw(rot)
    t_sz = 2.15 if len(deck["upper_title"]) <= 16 else 1.95
    f_sub = load_font("Cinzel-Variable.ttf", int(round(t_sz * mm)), weight=800)
    draw_centered_text(rd, mid_h // 2, int(round(w * 0.63)), deck["upper_title"], f_sub, (*deck["metal_hi"], 255))
    sp.alpha_composite(rot.rotate(90, expand=True), (0, mid_top))
    return sp


def render_bespoke_lid(w: int, h: int, mm: float, deck: Dict) -> Image.Image:
    """
    65.0 x 14.35 mm Top & Bottom End-Cap Lids (upright 0° so readable when holding the adjacent panel!):
      - Rich faction metallic gradient + beveled gold rules + Medallion + GlimmerFall + Deck Title
    """
    lid = make_vertical_gradient(w, h, deck["chassis_top"], deck["chassis_bot"])
    add_faction_crystalline_texture(lid, deck, opacity=26)
    dr = ImageDraw.Draw(lid)
    pad_y = int(round(1.8 * mm))
    dr.line((int(4 * mm), pad_y, w - int(4 * mm), pad_y), fill=(*deck["metal_mid"], 150), width=max(1, int(0.24 * mm)))
    dr.line((int(4 * mm), h - pad_y, w - int(4 * mm), h - pad_y), fill=(*deck["metal_mid"], 150), width=max(1, int(0.24 * mm)))

    cy = h // 2
    crest_ic = load_crest(int(round(8.6 * mm)))
    lid.alpha_composite(crest_ic, (int(round(5.5 * mm)), cy - crest_ic.height // 2))
    draw_faction_medallion(lid, w - int(round(9.5 * mm)), cy, int(round(4.1 * mm)), deck)

    draw_glimmerfall_wordmark(lid, cx=w // 2, cy=int(round(h * 0.38)), font_px=int(round(3.45 * mm)))
    dr = ImageDraw.Draw(lid)
    f_sub = load_font("Cinzel-Variable.ttf", int(round(1.98 * mm)), weight=800)
    draw_centered_text(dr, w // 2, int(round(h * 0.64)), deck["upper_title"], f_sub, (*deck["metal_hi"], 255))
    return lid


def build_single_tuckbox(deck: Dict, bleed_mask: Image.Image, cmyk_conv: CMYKConverter, dpi: int = 300) -> Tuple[Path, Path, float]:
    doc = fitz.open(str(TUCK_TEMPLATE_PDF))
    page = doc[0]
    pt_to_px = dpi / 72.0
    mm = dpi / 25.4

    cw = int(round(page.rect.width * pt_to_px))
    ch = int(round(page.rect.height * pt_to_px))

    def r_px(x0: float, y0: float, x1: float, y1: float) -> Tuple[int, int, int, int]:
        return (
            int(round(x0 * pt_to_px)),
            int(round(y0 * pt_to_px)),
            int(round(x1 * pt_to_px)),
            int(round(y1 * pt_to_px)),
        )

    # Rich Faction Jewel-Tone Metallic Sheet Base (populates all tuck tongues, dust flaps & 3mm bleed!)
    design = make_vertical_gradient(cw, ch, deck["chassis_mid"], deck["chassis_bot"])
    add_faction_crystalline_texture(design, deck, opacity=20)

    # Subtle Faction Emblem watermark centered on Top Tuck Tongue (`x=322.30..506.55`, `y=196.64..239.73`)
    ttx0, tty0, ttx1, tty1 = r_px(322.30, 196.64, 506.55, 239.73)
    wm_ic = load_faction_icon(deck["faction"], int(round(8.5 * mm)))
    wm_ic.putalpha(wm_ic.getchannel("A").point(lambda a: int(a * 0.55)))
    design.alpha_composite(wm_ic, ((ttx0 + ttx1 - wm_ic.width) // 2, (tty0 + tty1 - wm_ic.height) // 2))

    # 1. Front Cover (`x = 322.30 .. 506.55 pt`, `y = 280.40 .. 536.37 pt` + 3.6mm bottom bleed)
    fx0, fy0, fx1, fy1 = r_px(322.30, 280.40, 506.55, 536.37)
    bleed_bot_px = int(round(3.6 * mm))
    front_im = render_bespoke_front(fx1 - fx0, fy1 - fy0, bleed_bot_px, mm, deck)
    design.alpha_composite(front_im, (fx0, fy0))

    # 2. Back Panel (`x = 549.25 .. 733.50 pt`, `y = 281.25 .. 536.37 pt`)
    bx0, by0, bx1, by1 = r_px(549.25, 281.25, 733.50, 536.37)
    back_im = render_bespoke_back(bx1 - bx0, by1 - by0, mm, deck)
    design.alpha_composite(back_im, (bx0, by0))

    # 3. Left Spine (`x = 280.17 .. 322.30 pt`, `y = 281.25 .. 536.37 pt`) + 4mm left bleed extension
    ls0, ly0, ls1, ly1 = r_px(280.17, 281.25, 322.30, 536.37)
    lsp_im = render_bespoke_spine(ls1 - ls0, ly1 - ly0, mm, deck)
    design.alpha_composite(lsp_im, (ls0, ly0))
    l_ext = lsp_im.crop((0, 0, 2, lsp_im.height)).resize((int(round(4.0 * mm)), lsp_im.height), Image.Resampling.NEAREST)
    design.alpha_composite(l_ext, (ls0 - int(round(4.0 * mm)), ly0))

    # 4. Center Spine (`x = 506.55 .. 549.25 pt`, `y = 281.25 .. 536.37 pt`)
    cs0, cy0, cs1, cy1 = r_px(506.55, 281.25, 549.25, 536.37)
    csp_im = render_bespoke_spine(cs1 - cs0, cy1 - cy0, mm, deck)
    design.alpha_composite(csp_im, (cs0, cy0))

    # 5. Top Lid (`x = 322.30 .. 506.55 pt`, `y = 239.73 .. 280.40 pt` — upright 0° readable from Front!)
    tx0, ty0, tx1, ty1 = r_px(322.30, 239.73, 506.55, 280.40)
    design.alpha_composite(render_bespoke_lid(tx1 - tx0, ty1 - ty0, mm, deck), (tx0, ty0))

    # 6. Bottom Lid (`x = 549.25 .. 733.50 pt`, `y = 537.22 .. 577.90 pt` — upright 0° readable from Back!)
    bl0, bly0, bl1, bly1 = r_px(549.25, 537.22, 733.50, 577.90)
    design.alpha_composite(render_bespoke_lid(bl1 - bl0, bly1 - bly0, mm, deck), (bl0, bly0))

    # Apply exact +3.0 mm contour bleed mask onto pure white press sheet
    white_sheet = Image.new("RGB", (cw, ch), (255, 255, 255))
    final_rgb = Image.composite(design.convert("RGB"), white_sheet, bleed_mask)

    # Convert to ICC CMYK & place on `DESIGN` OCG layer underneath toggleable `图层 1` dieline
    cmyk_im = cmyk_conv.rgb_to_cmyk(final_rgb)
    max_tac = tac_stats(cmyk_im)

    jpg_buf = io.BytesIO()
    cmyk_im.save(jpg_buf, format="JPEG", quality=96, subsampling=0)

    design_ocg = doc.add_ocg("DESIGN", on=True)
    page.insert_image(page.rect, stream=jpg_buf.getvalue(), overlay=False, oc=design_ocg)

    PRINT_DIR.mkdir(parents=True, exist_ok=True)
    out_pdf = PRINT_DIR / f"{deck['filename_stem']}.pdf"
    doc.save(str(out_pdf), deflate=True, garbage=3)

    pix = page.get_pixmap(dpi=190)
    proof_im = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
    out_webp = PRINT_DIR / f"{deck['filename_stem']} Preview.webp"
    proof_im.save(out_webp, "WEBP", quality=94)
    doc.close()

    return out_pdf, out_webp, max_tac


def main():
    print("[*] Initializing ICC CMYK Converter & Building Exact +3.0 mm TuckInBox Bleed Mask...")
    cmyk_conv = CMYKConverter()
    ref_doc = fitz.open(str(TUCK_TEMPLATE_PDF))
    bleed_mask = build_tuckbox_bleed_mask(ref_doc, dpi=300, bleed_mm=3.0)
    ref_doc.close()

    for deck in TUCK_DECKS:
        print(f"[*] Building Bespoke Tuck-In Box: {deck['title']} ({deck['faction']})...")
        pdf_p, webp_p, tac = build_single_tuckbox(deck, bleed_mask, cmyk_conv, dpi=300)
        print(f"    [OK] {pdf_p.name} ({pdf_p.stat().st_size / 1024:.0f} KB) | Preview: {webp_p.name} | Max TAC: {tac:.1f}%")


if __name__ == "__main__":
    main()
