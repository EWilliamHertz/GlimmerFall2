#!/usr/bin/env python3
"""
Generates `/home/ewilliamhe/Glimmerfall2/print/InquiryForKenzi.docx` —
a stylized, Google Drive / Google Docs & Microsoft Word compatible OOXML (.docx)
Factory Production Inquiry & Collation Specification for Kenzi Zhao
(Super Board Game Manufacturing, Shenzhen), complete with:
  - 3 custom-rendered inline Animated GIFs (natively animated in Google Docs & Word!)
  - 3 high-resolution prepress proof figures (Booster Box, Booster Packs Pair, Card Grid)
  - Executive GlimmerFall obsidian-and-gold styled OOXML tables, callout banners,
    headers/footers, and Google Fonts typography (`Cinzel`, `Outfit`, `Roboto Mono`).
"""

import html
import io
import math
import shutil
import zipfile
from pathlib import Path
from typing import List, Optional, Tuple

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont

ENGINE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = ENGINE_DIR.parent
PRINT_DIR = PROJECT_ROOT / "print"
UPDATES_DIR = PRINT_DIR / "updates"
FONT_DIR = ENGINE_DIR / "fonts"
RESULTS_DIR = PROJECT_ROOT / "frontend" / "public" / "results"
CREST_PATH = PROJECT_ROOT / "frontend" / "public" / "glimmerfall-logo.png"
TMP_BUILD = Path("/tmp/kenzi_docx_build")

EMU_PER_INCH = 914400


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


def make_grad(w: int, h: int, top: Tuple[int, int, int], bot: Tuple[int, int, int]) -> Image.Image:
    strip = Image.new("RGB", (1, max(2, h)))
    for y in range(max(2, h)):
        strip.putpixel((0, y), lerp_rgb(top, bot, y / max(1, h - 1)))
    return strip.resize((w, h), Image.Resampling.BILINEAR).convert("RGBA")


def save_animated_gif(frames_rgba: List[Image.Image], out_path: Path, duration_ms: int = 110, dither: bool = False):
    """Quantizes each frame with its own optimal 256-color local GIF89a palette."""
    d_mode = Image.Dither.FLOYDSTEINBERG if dither else Image.Dither.NONE
    p_frames = [
        f.convert("RGB").quantize(colors=256, method=Image.Quantize.MEDIANCUT, dither=d_mode)
        for f in frames_rgba
    ]
    p_frames[0].save(
        out_path,
        save_all=True,
        append_images=p_frames[1:],
        duration=duration_ms,
        loop=0,
        optimize=False,
    )


def rainbow_color(phase: float) -> Tuple[int, int, int]:
    r = int(165 + 90 * math.sin(phase))
    g = int(165 + 90 * math.sin(phase + 2.094))
    b = int(185 + 70 * math.sin(phase + 4.188))
    return (max(0, min(255, r)), max(0, min(255, g)), max(0, min(255, b)))


# ---------------------------------------------------------------------------
# ANIMATION 1: Executive Hero Showcase + Holographic Foil Shimmer Sweep
# ---------------------------------------------------------------------------
def build_anim_01_hero(out_gif: Path) -> Tuple[int, int]:
    W, H = 820, 360
    crest = Image.open(CREST_PATH).convert("RGBA")
    cb = crest.getbbox()
    if cb:
        crest = crest.crop(cb)
    crest = crest.resize((74, int(74 * crest.height / crest.width)), Image.Resampling.LANCZOS)

    # Load actual rendered AWK cards for realistic fan + foil shimmer
    c_nums = [11, 55, 36, 84]
    cards_im = []
    for cn in c_nums:
        im = Image.open(RESULTS_DIR / "trim" / f"AWK_{cn:03d}_trim.webp").convert("RGBA")
        im = im.resize((138, 193), Image.Resampling.LANCZOS)
        cards_im.append(im)

    # Crop front panels of the two Booster Pack previews
    pack1_full = Image.open(PRINT_DIR / "Booster Pack 72x125 - Emberwing Courier Preview.webp").convert("RGBA")
    pw, ph = pack1_full.size
    pack1_front = pack1_full.crop((int(pw * 0.311), int(ph * 0.136), int(pw * 0.585), int(ph * 0.753))).resize((116, 200), Image.Resampling.LANCZOS)

    pack2_full = Image.open(PRINT_DIR / "Booster Pack 72x125 - Reality Fracture Preview.webp").convert("RGBA")
    pack2_front = pack2_full.crop((int(pw * 0.311), int(ph * 0.136), int(pw * 0.585), int(ph * 0.753))).resize((116, 200), Image.Resampling.LANCZOS)

    f_kicker = load_font("Outfit-Variable.ttf", 13, weight=800)
    f_title = load_font("Cinzel-Variable.ttf", 30, weight=800)
    f_sub = load_font("Cinzel-Variable.ttf", 13, weight=700)
    f_stat_n = load_font("Rajdhani-Bold.ttf", 26)
    f_stat_l = load_font("Outfit-Variable.ttf", 11, weight=600)
    f_tag = load_font("Outfit-Variable.ttf", 12, weight=800)

    n_frames = 18
    frames: List[Image.Image] = []

    for fi in range(n_frames):
        t = fi / n_frames
        angle = 2 * math.pi * t
        bg = make_grad(W, H, (12, 16, 28), (7, 9, 16))
        dr = ImageDraw.Draw(bg)

        # Subtle gold outer frame
        dr.rounded_rectangle((8, 8, W - 9, H - 9), radius=16, outline=(242, 169, 0, 150), width=2)

        # Animated ambient starlight particles
        for si in range(18):
            px = int((55 + si * 97 + fi * (3 + si % 3)) % (W - 30)) + 15
            py = int((35 + si * 53 - fi * (2 + si % 2)) % (H - 30)) + 15
            alpha = int(55 + 75 * (0.5 + 0.5 * math.sin(angle + si)))
            col = (242, 195, 80, alpha) if si % 2 == 0 else (40, 205, 255, alpha)
            dr.ellipse((px - 2, py - 2, px + 2, py + 2), fill=col)

        # Left column: Crest + Title + Key Production KPIs
        bg.alpha_composite(crest, (28, 28))
        dr.text((114, 32), "OFFICIAL MANUFACTURING & PREPRESS INQUIRY", font=f_kicker, fill=(36, 204, 255, 255))
        w_glim = f_title.getlength("GLIMMER")
        dr.text((114, 52), "GLIMMER", font=f_title, fill=(248, 250, 255, 255))
        dr.text((114 + w_glim, 52), "FALL", font=f_title, fill=(242, 169, 0, 255))
        dr.text((114, 90), "THE AWAKENING (AWK)  •  FIRST EDITION", font=f_sub, fill=(228, 214, 178, 255))

        # 4 KPI Cards on left
        kpis = [
            ("500", "DISPLAY BOXES", (242, 169, 0)),
            ("15,000", "BOOSTER PACKS", (36, 204, 255)),
            ("180,000", "TOTAL CARDS", (46, 218, 128)),
            ("15,000", "HOLO FOIL CARDS", (196, 108, 255)),
        ]
        for idx, (num_s, lbl_s, acc) in enumerate(kpis):
            kx = 28 + (idx % 2) * 192
            ky = 138 + (idx // 2) * 84
            dr.rounded_rectangle((kx, ky, kx + 180, ky + 72), radius=10, fill=(18, 23, 38, 235), outline=(*acc, 185), width=2)
            dr.text((kx + 14, ky + 10), num_s, font=f_stat_n, fill=(*acc, 255))
            dr.text((kx + 14, ky + 44), lbl_s, font=f_stat_l, fill=(214, 222, 236, 255))

        dr.text((28, 318), "Prepared for Kenzi Zhao  •  Super Board Game Manufacturing (Shenzhen)", font=f_stat_l, fill=(176, 186, 204, 255))

        # Right showcase: 2 Booster Packs + Shimmering Holographic Foil Card #12
        bob1 = int(round(4.0 * math.sin(angle)))
        bob2 = int(round(4.0 * math.sin(angle + 1.8)))
        bob3 = int(round(5.0 * math.sin(angle + 3.4)))

        # Pack B (Reality Fracture)
        p2_rot = pack2_front.rotate(7, resample=Image.Resampling.BICUBIC, expand=True)
        bg.alpha_composite(p2_rot, (442, 56 + bob2))

        # Pack A (Emberwing Courier)
        p1_rot = pack1_front.rotate(-6, resample=Image.Resampling.BICUBIC, expand=True)
        bg.alpha_composite(p1_rot, (528, 48 + bob1))

        # Featured Foil Card with live animated diagonal rainbow holographic sheen!
        foil_card = cards_im[(fi // 5) % len(cards_im)].copy()
        fw, fh = foil_card.size
        holo = Image.new("RGBA", (fw, fh), (0, 0, 0, 0))
        hd = ImageDraw.Draw(holo)
        band_pos = int(-fh + (fw + 2 * fh) * ((fi % 9) / 8.0))
        for y in range(fh):
            for band_w, alpha in ((38, 42), (20, 78), (8, 118)):
                x_center = band_pos - int(y * 0.55)
                rc = rainbow_color(angle * 2 + y * 0.04)
                hd.line((x_center - band_w, y, x_center + band_w, y), fill=(*rc, alpha))
        # Mask holo strictly to card alpha
        holo.putalpha(Image.composite(holo.getchannel("A"), Image.new("L", (fw, fh), 0), foil_card.getchannel("A")))
        foil_card.alpha_composite(holo)
        # Holographic sparkle border
        rc_b = rainbow_color(angle * 2)
        ImageDraw.Draw(foil_card).rounded_rectangle((1, 1, fw - 2, fh - 2), radius=8, outline=(*rc_b, 235), width=2)

        bg.alpha_composite(foil_card, (648, 58 + bob3))
        dr = ImageDraw.Draw(bg)

        # Caption pill below right showcase
        dr.rounded_rectangle((438, 286, 792, 322), radius=18, fill=(18, 24, 38, 240), outline=(242, 169, 0, 210), width=2)
        dr.text((456, 297), "2 PACK DESIGNS (50/50)  +  1 HOLO FOIL / PACK", font=f_tag, fill=(255, 232, 162, 255))

        frames.append(bg)

    save_animated_gif(frames, out_gif, duration_ms=105, dither=True)
    return W, H


# ---------------------------------------------------------------------------
# ANIMATION 2: 12-Card Booster Pack Slot-by-Slot Collation Lineup
# ---------------------------------------------------------------------------
def build_anim_02_pack_collation(out_gif: Path) -> Tuple[int, int]:
    W, H = 820, 390
    f_hdr = load_font("Cinzel-Variable.ttf", 20, weight=800)
    f_sub = load_font("Outfit-Variable.ttf", 13, weight=600)
    f_num = load_font("Rajdhani-Bold.ttf", 19)
    f_lbl = load_font("Outfit-Variable.ttf", 11, weight=800)
    f_desc = load_font("Outfit-Variable.ttf", 13, weight=700)

    slots = [
        ("01", "C", "Common", (150, 162, 184)),
        ("02", "C", "Common", (150, 162, 184)),
        ("03", "C", "Common", (150, 162, 184)),
        ("04", "C", "Common", (150, 162, 184)),
        ("05", "C", "Common", (150, 162, 184)),
        ("06", "C", "Common", (150, 162, 184)),
        ("07", "C", "Common", (150, 162, 184)),
        ("08", "U", "Uncommon", (46, 198, 255)),
        ("09", "U", "Uncommon", (46, 198, 255)),
        ("10", "U", "Uncommon", (46, 198, 255)),
        ("11", "R/E", "Rare / Epic", (242, 169, 0)),
        ("12", "FOIL", "Holo Foil", (214, 102, 255)),
    ]

    stage_banners = [
        (0, 6, "STEP 1 — SLOTS 01–07:  7 × COMMON CARDS (300gsm Non-Foil Artpaper • Distinct Cards, ≥3 Factions)", (180, 192, 214)),
        (7, 9, "STEP 2 — SLOTS 08–10:  3 × UNCOMMON CARDS (300gsm Non-Foil Artpaper • Zero Duplicates)", (64, 208, 255)),
        (10, 10, "STEP 3 — SLOT 11 (HIT SLOT):  80% RARE (24/Box)  or  20% EPIC (6/Box) • 300gsm Non-Foil", (255, 196, 46)),
        (11, 11, "STEP 4 — SLOT 12 (BACK CARD):  100% HOLOGRAPHIC FOIL (50% C • 30% U • 13.3% R • 6.7% E)", (226, 134, 255)),
    ]

    frames: List[Image.Image] = []
    # 20 frames across 4 stages (5 frames per stage)
    for fi in range(20):
        stage_idx = min(3, fi // 5)
        s_lo, s_hi, banner_txt, banner_col = stage_banners[stage_idx]
        pulse = 0.5 + 0.5 * math.sin((fi % 5) / 5.0 * math.pi)

        bg = make_grad(W, H, (13, 17, 28), (8, 11, 19))
        dr = ImageDraw.Draw(bg)
        dr.rounded_rectangle((6, 6, W - 7, H - 7), radius=14, outline=(242, 169, 0, 145), width=2)

        dr.text((26, 18), "12-CARD BOOSTER PACK COLLATION LINEUP (FRONT -> BACK)", font=f_hdr, fill=(248, 250, 255, 255))
        dr.text(
            (26, 46),
            "All 12 cards upright & facing forward  •  Slot 01 Front faces Front Foil Art  •  Slot 12 Back faces Rear Fin Seal",
            font=f_sub,
            fill=(186, 198, 218, 255),
        )

        # Front Wrapper marker on far left + Rear Seal marker on far right
        dr.rounded_rectangle((18, 86, 52, 266), radius=8, fill=(44, 32, 10, 240), outline=(242, 169, 0, 220), width=2)
        for idx_ch, ch in enumerate("FRONT"):
            dr.text((29, 126 + idx_ch * 20), ch, font=f_lbl, fill=(255, 224, 132, 255))

        dr.rounded_rectangle((W - 52, 86, W - 18, 266), radius=8, fill=(26, 18, 42, 240), outline=(196, 108, 255, 220), width=2)
        for idx_ch, ch in enumerate("SEAL"):
            dr.text((W - 40, 136 + idx_ch * 20), ch, font=f_lbl, fill=(228, 176, 255, 255))

        # Draw 12 card slots across x = 60 .. 760
        slot_w = 52
        gap = 6
        start_x = 64
        for idx, (s_num, code, name_s, col) in enumerate(slots):
            sx = start_x + idx * (slot_w + gap)
            active = s_lo <= idx <= s_hi
            revealed = idx <= s_hi
            lift = -14 - int(4 * pulse) if active else (0 if revealed else 8)
            sy = 98 + lift
            sh = 158

            if idx == 11 and revealed:
                # Rainbow foil shimmer fill on Slot 12!
                rc = rainbow_color(fi * 0.55)
                fill_c = (int(rc[0] * 0.35), int(rc[1] * 0.28), int(rc[2] * 0.42), 250)
                out_c = (*rc, 255)
            elif active:
                fill_c = (int(col[0] * 0.28), int(col[1] * 0.28), int(col[2] * 0.32), 250)
                out_c = (*col, 255)
            elif revealed:
                fill_c = (22, 28, 44, 240)
                out_c = (*col, 185)
            else:
                fill_c = (15, 19, 30, 180)
                out_c = (65, 75, 96, 120)

            dr.rounded_rectangle((sx, sy, sx + slot_w, sy + sh), radius=8, fill=fill_c, outline=out_c, width=3 if active else 2)
            dr.text((sx + 15, sy + 10), f"#{s_num}", font=f_lbl, fill=(220, 228, 242, 255 if revealed else 130))

            # Center rarity badge
            bb = f_num.getbbox(code)
            tw = bb[2] - bb[0]
            dr.rounded_rectangle((sx + 6, sy + 56, sx + slot_w - 6, sy + 94), radius=6, fill=(10, 13, 22, 220), outline=out_c, width=1)
            dr.text((sx + (slot_w - tw) / 2 - bb[0], sy + 63), code, font=f_num, fill=out_c)

            # Bottom material tag
            mat = "HOLO" if idx == 11 else "300g"
            mb = f_lbl.getbbox(mat)
            dr.text((sx + (slot_w - (mb[2] - mb[0])) / 2, sy + 128), mat, font=f_lbl, fill=(210, 218, 234, 230 if revealed else 110))

        # Bracket summary bars below slots
        by = 278
        brackets = [
            (start_x, start_x + 7 * (slot_w + gap) - gap, "7 × COMMON (105,000)", (150, 162, 184)),
            (start_x + 7 * (slot_w + gap), start_x + 10 * (slot_w + gap) - gap, "3 × UNC (45k)", (46, 198, 255)),
            (start_x + 10 * (slot_w + gap), start_x + 11 * (slot_w + gap) - gap, "R/E (15k)", (242, 169, 0)),
            (start_x + 11 * (slot_w + gap), start_x + 12 * (slot_w + gap) - gap, "FOIL (15k)", (214, 102, 255)),
        ]
        for bx0, bx1, btxt, bcol in brackets:
            dr.line((bx0, by, bx1, by), fill=(*bcol, 220), width=3)
            bb = f_lbl.getbbox(btxt)
            if bx1 - bx0 >= (bb[2] - bb[0]):
                dr.text(((bx0 + bx1 - (bb[2] - bb[0])) / 2, by + 6), btxt, font=f_lbl, fill=(*bcol, 255))

        # Active step callout bar at bottom
        dr.rounded_rectangle((22, 322, W - 22, 370), radius=10, fill=(18, 24, 40, 245), outline=(*banner_col, 235), width=2)
        dr.text((38, 338), banner_txt, font=f_desc, fill=(*banner_col, 255))

        frames.append(bg)

    save_animated_gif(frames, out_gif, duration_ms=175)
    return W, H


# ---------------------------------------------------------------------------
# ANIMATION 3: 30-Pack Display Box 2x15 Stacking & Alternating Wrapper Fill
# ---------------------------------------------------------------------------
def build_anim_03_box_stacking(out_gif: Path) -> Tuple[int, int]:
    W, H = 820, 380
    f_hdr = load_font("Cinzel-Variable.ttf", 20, weight=800)
    f_sub = load_font("Outfit-Variable.ttf", 13, weight=600)
    f_lbl = load_font("Outfit-Variable.ttf", 12, weight=800)
    f_sm = load_font("Outfit-Variable.ttf", 11, weight=600)
    f_big = load_font("Rajdhani-Bold.ttf", 24)

    frames: List[Image.Image] = []
    # 19 frames: frames 0..15 stack layers 1..15, frames 16..18 hold full 30-pack display!
    for fi in range(19):
        filled_rows = min(15, fi + 1)
        bg = make_grad(W, H, (13, 17, 28), (8, 11, 19))
        dr = ImageDraw.Draw(bg)
        dr.rounded_rectangle((6, 6, W - 7, H - 7), radius=14, outline=(36, 204, 255, 145), width=2)

        dr.text((26, 18), "DISPLAY BOX 30-PACK ASSEMBLY:  2 COLUMNS × 15 PACKS (125×144×67 mm)", font=f_hdr, fill=(248, 250, 255, 255))
        dr.text(
            (26, 46),
            "Checkerboard 50/50 wrapper alternation:  15 × Emberwing Courier (Gold)  +  15 × Reality Fracture (Cyan)  =  30 Packs / Box",
            font=f_sub,
            fill=(186, 198, 218, 255),
        )

        # LEFT DIAGRAM: Front Cross-Section of Display Box (144mm Wide x 67mm Tall)
        bx0, by0, bx1, by1 = 48, 96, 444, 326
        # Pop-up U-Crown header behind box
        dr.rounded_rectangle((bx0 + 36, 72, bx1 - 36, by0 + 6), radius=10, fill=(20, 26, 42, 235), outline=(242, 169, 0, 195), width=2)
        dr.text((bx0 + 96, 77), "POP-UP U-CROWN HEADER [Wall 09]", font=f_sm, fill=(255, 226, 146, 255))

        # Box interior cavity
        dr.rounded_rectangle((bx0, by0, bx1, by1), radius=6, fill=(10, 13, 21, 250), outline=(220, 228, 242, 225), width=3)
        mid_x = (bx0 + bx1) // 2
        dr.line((mid_x, by0, mid_x, by1), fill=(255, 255, 255, 55), width=1)

        # Stack 15 packs from bottom to top in BOTH columns
        pack_h = 13
        pack_gap = 2
        col_pad = 10
        cw_col = (bx1 - bx0) // 2 - 2 * col_pad

        gold_cnt = 0
        cyan_cnt = 0
        for row in range(filled_rows):
            py_bot = by1 - 6 - row * (pack_h + pack_gap)
            py_top = py_bot - pack_h
            # Left column: even row -> Gold (Emberwing), odd row -> Cyan (Fracture)
            l_is_gold = (row % 2 == 0)
            r_is_gold = not l_is_gold
            gold_cnt += int(l_is_gold) + int(r_is_gold)
            cyan_cnt += int(not l_is_gold) + int(not r_is_gold)

            l_fill = (218, 148, 8, 245) if l_is_gold else (16, 168, 228, 245)
            l_out = (255, 222, 128, 255) if l_is_gold else (158, 238, 255, 255)
            r_fill = (218, 148, 8, 245) if r_is_gold else (16, 168, 228, 245)
            r_out = (255, 222, 128, 255) if r_is_gold else (158, 238, 255, 255)

            dr.rounded_rectangle((bx0 + col_pad, py_top, mid_x - col_pad, py_bot), radius=3, fill=l_fill, outline=l_out, width=1)
            dr.rounded_rectangle((mid_x + col_pad, py_top, bx1 - col_pad, py_bot), radius=3, fill=r_fill, outline=r_out, width=1)

        # Dimension callouts below box
        dr.text((bx0 + 22, by1 + 10), "Left Column: 72 mm (15 Packs)", font=f_sm, fill=(255, 220, 128, 255))
        dr.text((mid_x + 18, by1 + 10), "Right Column: 72 mm (15 Packs)", font=f_sm, fill=(148, 232, 255, 255))
        dr.text((bx0 + 96, by1 + 28), "<--- Total Interior Width: 144 mm --->", font=f_lbl, fill=(242, 169, 0, 255))

        # RIGHT PANEL: Live Counter & Orientation Checklist
        rx0, ry0, rx1, ry1 = 482, 84, 792, 352
        dr.rounded_rectangle((rx0, ry0, rx1, ry1), radius=12, fill=(18, 24, 38, 242), outline=(242, 169, 0, 180), width=2)

        total_p = filled_rows * 2
        total_c = total_p * 12
        dr.text((rx0 + 20, ry0 + 16), f"PACKS LOADED:  {total_p:02d} / 30", font=f_big, fill=(255, 232, 152, 255))
        dr.text((rx0 + 20, ry0 + 48), f"CARDS IN BOX:   {total_c:03d} / 360  ({filled_rows * 2} Foils)", font=f_lbl, fill=(64, 212, 255, 255))

        # Color legend pills
        dr.rounded_rectangle((rx0 + 20, ry0 + 78, rx1 - 20, ry0 + 108), radius=6, fill=(52, 36, 8, 240), outline=(242, 169, 0, 220), width=1)
        dr.text((rx0 + 32, ry0 + 86), f"Emberwing Courier (BP01):  {gold_cnt:02d} / 15", font=f_sm, fill=(255, 228, 148, 255))

        dr.rounded_rectangle((rx0 + 20, ry0 + 116, rx1 - 20, ry0 + 146), radius=6, fill=(10, 40, 68, 240), outline=(36, 204, 255, 220), width=1)
        dr.text((rx0 + 32, ry0 + 124), f"Reality Fracture (BP02):     {cyan_cnt:02d} / 15", font=f_sm, fill=(168, 238, 255, 255))

        rules = [
            "• Pack Depth: 125 mm front-to-back",
            "• Stack Height: 15 × ~4.3 mm = 64.5 mm (<67 mm)",
            "• Pack Front faces UP toward Top Lid",
            "• Top Crimp points to BACK HINGE [Wall 00]",
            "• Seal each Display Box in clear POF shrink",
            "• Pack 12 Boxes / Master Carton (42 Cartons)",
        ]
        ry_t = ry0 + 160
        for rl in rules:
            dr.text((rx0 + 20, ry_t), rl, font=f_sm, fill=(218, 226, 240, 255))
            ry_t += 17

        frames.append(bg)

    save_animated_gif(frames, out_gif, duration_ms=160)
    return W, H


# ---------------------------------------------------------------------------
# STATIC HIGH-RES FIGURES FOR PREPRESS VERIFICATION
# ---------------------------------------------------------------------------
def build_static_figures(out_box_png: Path, out_packs_png: Path, out_tuck_png: Path, out_cards_png: Path) -> List[Tuple[int, int]]:
    # 1. Booster Box Dieline Proof
    box_im = Image.open(PRINT_DIR / "Booster Box Template - GlimmerFall AWK Preview.webp").convert("RGB")
    bw = 1300
    bh = int(round(box_im.height * (bw / box_im.width)))
    box_r = box_im.resize((bw, bh), Image.Resampling.LANCZOS)
    box_r.save(out_box_png, "PNG", optimize=True)

    # 2. Side-by-Side Booster Packs Pair
    p1 = Image.open(PRINT_DIR / "Booster Pack 72x125 - Emberwing Courier Preview.webp").convert("RGB")
    p2 = Image.open(PRINT_DIR / "Booster Pack 72x125 - Reality Fracture Preview.webp").convert("RGB")
    tw = 630
    th = int(round(p1.height * (tw / p1.width)))
    p1r = p1.resize((tw, th), Image.Resampling.LANCZOS)
    p2r = p2.resize((tw, th), Image.Resampling.LANCZOS)
    pair = Image.new("RGB", (tw * 2 + 24, th + 16), (14, 18, 28))
    pair.paste(p1r, (8, 8))
    pair.paste(p2r, (tw + 16, 8))
    pair.save(out_packs_png, "PNG", optimize=True)

    # 3. 2x2 Quartet of 65x90x15mm Starter Deck Tuck-In Boxes
    tuck_names = [
        "TuckInBox - Solar Singularity (Solari) Preview.webp",
        "TuckInBox - The Graveglass Veil (Umbri) Preview.webp",
        "TuckInBox - Fractured Continuum (Aether) Preview.webp",
        "TuckInBox - Gaia's Loop (Terra) Preview.webp",
    ]
    cell_w = 630
    t_imgs = []
    for tn in tuck_names:
        im = Image.open(UPDATES_DIR / tn).convert("RGB")
        # Crop whitespace margins around tuck-box + 63x88 reference card for crisp detail
        iw, ih = im.size
        im_c = im.crop((int(iw * 0.14), int(ih * 0.16), int(iw * 0.86), int(ih * 0.87)))
        ch_t = int(round(im_c.height * (cell_w / im_c.width)))
        t_imgs.append(im_c.resize((cell_w, ch_t), Image.Resampling.LANCZOS))
    cw_t, ch_t = t_imgs[0].size
    tuck_grid = Image.new("RGB", (cw_t * 2 + 24, ch_t * 2 + 24), (14, 18, 28))
    tuck_grid.paste(t_imgs[0], (8, 8))
    tuck_grid.paste(t_imgs[1], (cw_t + 16, 8))
    tuck_grid.paste(t_imgs[2], (8, ch_t + 16))
    tuck_grid.paste(t_imgs[3], (cw_t + 16, ch_t + 16))
    tuck_grid.save(out_tuck_png, "PNG", optimize=True)

    # 4. Sample Cards + Official Card Back Strip
    sheet = Image.open(RESULTS_DIR / "GlimmerFall_AWK_Sample_Contact_Sheet.webp").convert("RGB")
    sw_target = 1280
    cropped = sheet.crop((0, 0, sheet.width, int(sheet.height * 0.375)))
    sh_target = int(round(cropped.height * (sw_target / cropped.width)))
    cards_r = cropped.resize((sw_target, sh_target), Image.Resampling.LANCZOS)
    cards_r.save(out_cards_png, "PNG", optimize=True)

    return [(bw, bh), pair.size, tuck_grid.size, cards_r.size]


# ---------------------------------------------------------------------------
# PURE OOXML (.DOCX) BUILDER (100% Google Docs / Google Drive & Word Native)
# ---------------------------------------------------------------------------
class DocxBuilder:
    def __init__(self):
        self.body_parts: List[str] = []
        self.media_files: List[Tuple[str, Path, str]] = []  # (rId, path, media_name)
        self._doc_pr_id = 1

    def add_media(self, path: Path) -> Tuple[str, str]:
        idx = len(self.media_files) + 1
        r_id = f"rIdMedia{idx}"
        media_name = f"image{idx}{path.suffix.lower()}"
        self.media_files.append((r_id, path, media_name))
        return r_id, media_name

    @staticmethod
    def _esc(text: str) -> str:
        return html.escape(text, quote=True)

    def _run_xml(
        self,
        text: str,
        font: str = "Outfit",
        size_pt: float = 10.5,
        color: str = "1E2433",
        bold: bool = False,
        italic: bool = False,
    ) -> str:
        sz_half = int(round(size_pt * 2))
        b_tag = "<w:b/><w:bCs/>" if bold else ""
        i_tag = "<w:i/><w:iCs/>" if italic else ""
        ef = self._esc(font)
        return (
            f"<w:r><w:rPr>"
            f'<w:rFonts w:ascii="{ef}" w:hAnsi="{ef}" w:cs="{ef}"/>'
            f"{b_tag}{i_tag}"
            f'<w:color w:val="{color}"/>'
            f'<w:sz w:val="{sz_half}"/><w:szCs w:val="{sz_half}"/>'
            f'</w:rPr><w:t xml:space="preserve">{self._esc(text)}</w:t></w:r>'
        )

    def add_paragraph(
        self,
        runs: List[Tuple],
        align: str = "left",
        space_before_pt: float = 0,
        space_after_pt: float = 6,
        line_mult: float = 1.18,
        keep_next: bool = False,
        bottom_border_color: Optional[str] = None,
    ):
        sb = int(round(space_before_pt * 20))
        sa = int(round(space_after_pt * 20))
        ln = int(round(line_mult * 240))
        kn = "<w:keepNext/>" if keep_next else ""
        bdr = ""
        if bottom_border_color:
            bdr = (
                f'<w:pBdr><w:bottom w:val="single" w:sz="12" w:space="4" w:color="{bottom_border_color}"/></w:pBdr>'
            )
        runs_xml = "".join(self._run_xml(*r) for r in runs)
        self.body_parts.append(
            f"<w:p><w:pPr>"
            f'<w:jc w:val="{align}"/>'
            f'<w:spacing w:before="{sb}" w:after="{sa}" w:line="{ln}" w:lineRule="auto"/>'
            f"{kn}{bdr}"
            f"</w:pPr>{runs_xml}</w:p>"
        )

    def add_section_heading(self, num_badge: str, title: str):
        self.add_paragraph(
            [
                (f"{num_badge}  ", "Outfit", 11.5, "C98200", True, False),
                (title, "Cinzel", 14.5, "0F1626", True, False),
            ],
            space_before_pt=14,
            space_after_pt=6,
            keep_next=True,
            bottom_border_color="E6A817",
        )

    def add_callout_banner(
        self,
        title: str,
        lines: List[Tuple[str, bool]],
        bg_hex: str = "101626",
        accent_hex: str = "F2A900",
        title_color: str = "F2A900",
        text_color: str = "EBEEF5",
    ):
        p_xml = []
        p_xml.append(
            f'<w:p><w:pPr><w:spacing w:before="40" w:after="60"/></w:pPr>'
            f'{self._run_xml(title, "Cinzel", 11.5, title_color, True, False)}</w:p>'
        )
        for txt, is_bold in lines:
            p_xml.append(
                f'<w:p><w:pPr><w:spacing w:before="20" w:after="40" w:line="270" w:lineRule="auto"/></w:pPr>'
                f'{self._run_xml(txt, "Outfit", 9.8, text_color, is_bold, False)}</w:p>'
            )
        inner = "".join(p_xml)
        self.body_parts.append(
            f"<w:tbl><w:tblPr>"
            f'<w:tblW w:w="9720" w:type="dxa"/>'
            f'<w:tblBorders>'
            f'<w:top w:val="single" w:sz="6" w:space="0" w:color="{accent_hex}"/>'
            f'<w:left w:val="single" w:sz="28" w:space="0" w:color="{accent_hex}"/>'
            f'<w:bottom w:val="single" w:sz="6" w:space="0" w:color="{accent_hex}"/>'
            f'<w:right w:val="single" w:sz="6" w:space="0" w:color="{accent_hex}"/>'
            f"</w:tblBorders>"
            f'<w:tblCellMar><w:top w:w="140" w:type="dxa"/><w:left w:w="200" w:type="dxa"/>'
            f'<w:bottom w:w="140" w:type="dxa"/><w:right w:w="180" w:type="dxa"/></w:tblCellMar>'
            f"</w:tblPr>"
            f'<w:tblGrid><w:gridCol w:w="9720"/></w:tblGrid>'
            f"<w:tr><w:tc><w:tcPr>"
            f'<w:tcW w:w="9720" w:type="dxa"/>'
            f'<w:shd w:val="clear" w:color="auto" w:fill="{bg_hex}"/>'
            f"</w:tcPr>{inner}</w:tc></w:tr></w:tbl>"
        )
        self.add_paragraph([("", "Outfit", 4, "FFFFFF", False, False)], space_before_pt=0, space_after_pt=4)

    def add_image(self, path: Path, px_size: Tuple[int, int], width_inches: float, caption: Optional[str] = None):
        r_id, media_name = self.add_media(path)
        cx = int(round(width_inches * EMU_PER_INCH))
        cy = int(round(cx * (px_size[1] / max(1, px_size[0]))))
        doc_id = self._doc_pr_id
        self._doc_pr_id += 1

        drawing_xml = (
            f"<w:p><w:pPr><w:jc w:val=\"center\"/><w:spacing w:before=\"80\" w:after=\"40\"/>"
            + ("<w:keepNext/>" if caption else "")
            + f"</w:pPr><w:r><w:drawing>"
            f'<wp:inline distT="0" distB="0" distL="0" distR="0">'
            f'<wp:extent cx="{cx}" cy="{cy}"/>'
            f'<wp:effectExtent l="0" t="0" r="0" b="0"/>'
            f'<wp:docPr id="{doc_id}" name="{self._esc(media_name)}"/>'
            f"<wp:cNvGraphicFramePr>"
            f'<a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/>'
            f"</wp:cNvGraphicFramePr>"
            f'<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">'
            f'<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">'
            f'<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">'
            f"<pic:nvPicPr>"
            f'<pic:cNvPr id="{doc_id}" name="{self._esc(media_name)}"/>'
            f"<pic:cNvPicPr/>"
            f"</pic:nvPicPr>"
            f"<pic:blipFill>"
            f'<a:blip r:embed="{r_id}"/>'
            f"<a:stretch><a:fillRect/></a:stretch>"
            f"</pic:blipFill>"
            f"<pic:spPr>"
            f'<a:xfrm><a:off x="0" y="0"/><a:ext cx="{cx}" cy="{cy}"/></a:xfrm>'
            f'<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>'
            f"</pic:spPr>"
            f"</pic:pic></a:graphicData></a:graphic>"
            f"</wp:inline></w:drawing></w:r></w:p>"
        )
        self.body_parts.append(drawing_xml)
        if caption:
            self.add_paragraph(
                [(caption, "Outfit", 8.8, "546078", False, True)],
                align="center",
                space_before_pt=1,
                space_after_pt=8,
            )

    def add_styled_table(
        self,
        headers: List[str],
        rows: List[List[str]],
        col_pcts: List[int],
        aligns: Optional[List[str]] = None,
        highlight_last_row: bool = False,
    ):
        total_dxa = 9720  # 6.75 inches printable width
        col_widths = [int(round(total_dxa * p / 100.0)) for p in col_pcts]
        col_widths[-1] += total_dxa - sum(col_widths)
        if aligns is None:
            aligns = ["left"] * len(headers)

        grid_xml = "".join(f'<w:gridCol w:w="{w}"/>' for w in col_widths)
        trs = []

        # Header row (Deep Midnight #0F1626 with Gold #F2A900 text)
        h_tcs = []
        for idx, h_txt in enumerate(headers):
            al = aligns[idx]
            h_tcs.append(
                f"<w:tc><w:tcPr>"
                f'<w:tcW w:w="{col_widths[idx]}" w:type="dxa"/>'
                f'<w:shd w:val="clear" w:color="auto" w:fill="0F1626"/>'
                f'<w:vAlign w:val="center"/>'
                f"</w:tcPr>"
                f'<w:p><w:pPr><w:jc w:val="{al}"/><w:spacing w:before="40" w:after="40"/></w:pPr>'
                f'{self._run_xml(h_txt, "Outfit", 9.5, "F2A900", True, False)}</w:p></w:tc>'
            )
        trs.append(f"<w:tr><w:trPr><w:tblHeader/><w:cantSplit/></w:trPr>{''.join(h_tcs)}</w:tr>")

        # Body rows
        for r_idx, row in enumerate(rows):
            is_last = highlight_last_row and (r_idx == len(rows) - 1)
            bg = "162038" if is_last else ("F7F9FC" if r_idx % 2 == 1 else "FFFFFF")
            fg = "FFE082" if is_last else "1C2333"
            tcs = []
            for c_idx, cell_txt in enumerate(row):
                al = aligns[c_idx]
                bold_cell = is_last or (c_idx == 0)
                cell_fg = "FFFFFF" if (is_last and c_idx == 0) else fg
                tcs.append(
                    f"<w:tc><w:tcPr>"
                    f'<w:tcW w:w="{col_widths[c_idx]}" w:type="dxa"/>'
                    f'<w:shd w:val="clear" w:color="auto" w:fill="{bg}"/>'
                    f'<w:vAlign w:val="center"/>'
                    f"</w:tcPr>"
                    f'<w:p><w:pPr><w:jc w:val="{al}"/><w:spacing w:before="35" w:after="35"/></w:pPr>'
                    f'{self._run_xml(cell_txt, "Outfit", 9.3, cell_fg, bold_cell, False)}</w:p></w:tc>'
                )
            trs.append(f"<w:tr><w:trPr><w:cantSplit/></w:trPr>{''.join(tcs)}</w:tr>")

        self.body_parts.append(
            f"<w:tbl><w:tblPr>"
            f'<w:tblW w:w="{total_dxa}" w:type="dxa"/>'
            f"<w:tblBorders>"
            f'<w:top w:val="single" w:sz="8" w:space="0" w:color="C98A00"/>'
            f'<w:left w:val="single" w:sz="6" w:space="0" w:color="D0D7E5"/>'
            f'<w:bottom w:val="single" w:sz="10" w:space="0" w:color="0F1626"/>'
            f'<w:right w:val="single" w:sz="6" w:space="0" w:color="D0D7E5"/>'
            f'<w:insideH w:val="single" w:sz="4" w:space="0" w:color="DCE2EE"/>'
            f'<w:insideV w:val="single" w:sz="4" w:space="0" w:color="E5EAF3"/>'
            f"</w:tblBorders>"
            f'<w:tblCellMar><w:top w:w="75" w:type="dxa"/><w:left w:w="115" w:type="dxa"/>'
            f'<w:bottom w:w="75" w:type="dxa"/><w:right w:w="115" w:type="dxa"/></w:tblCellMar>'
            f"</w:tblPr>"
            f"<w:tblGrid>{grid_xml}</w:tblGrid>"
            f"{''.join(trs)}</w:tbl>"
        )
        self.add_paragraph([("", "Outfit", 4, "FFFFFF", False, False)], space_before_pt=0, space_after_pt=4)

    def save(self, out_docx: Path):
        content_types = (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            '<Default Extension="xml" ContentType="application/xml"/>'
            '<Default Extension="png" ContentType="image/png"/>'
            '<Default Extension="gif" ContentType="image/gif"/>'
            '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
            '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>'
            '<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>'
            '<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>'
            "</Types>"
        )

        root_rels = (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
            "</Relationships>"
        )

        media_rels_xml = "".join(
            f'<Relationship Id="{r_id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/{m_name}"/>'
            for r_id, _, m_name in self.media_files
        )
        doc_rels = (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
            '<Relationship Id="rIdHdr1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>'
            '<Relationship Id="rIdFtr1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>'
            f"{media_rels_xml}"
            "</Relationships>"
        )

        styles_xml = (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
            "<w:docDefaults><w:rPrDefault><w:rPr>"
            '<w:rFonts w:ascii="Outfit" w:hAnsi="Outfit" w:cs="Outfit"/>'
            '<w:sz w:val="21"/><w:szCs w:val="21"/><w:color w:val="1E2433"/>'
            "</w:rPr></w:rPrDefault></w:docDefaults>"
            '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>'
            "</w:styles>"
        )

        header_xml = (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
            '<w:p><w:pPr><w:jc w:val="right"/>'
            '<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="4" w:color="E6A817"/></w:pBdr>'
            "</w:pPr>"
            f'{self._run_xml("GLIMMERFALL TCG — FIRST EDITION (AWK)  •  PRODUCTION INQUIRY FOR KENZI ZHAO", "Outfit", 8.5, "6A748A", True, False)}'
            "</w:p></w:hdr>"
        )

        footer_xml = (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
            '<w:p><w:pPr><w:jc w:val="center"/>'
            '<w:pBdr><w:top w:val="single" w:sz="6" w:space="4" w:color="D0D7E5"/></w:pBdr>'
            "</w:pPr>"
            f'{self._run_xml("Buyer: ErnstWilliam Hertz  •  https://GlimmerFallTCG.com  •  Super Board Game Manufacturing (Shenzhen)  •  HS 9504904000", "Outfit", 8.5, "6A748A", False, False)}'
            "</w:p></w:ftr>"
        )

        sect_pr = (
            "<w:sectPr>"
            '<w:headerReference w:type="default" r:id="rIdHdr1"/>'
            '<w:footerReference w:type="default" r:id="rIdFtr1"/>'
            '<w:pgSz w:w="12240" w:h="15840"/>'
            '<w:pgMar w:top="1080" w:right="1260" w:bottom="1080" w:left="1260" w:header="540" w:footer="540" w:gutter="0"/>'
            "</w:sectPr>"
        )

        document_xml = (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<w:document '
            'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" '
            'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" '
            'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">'
            f"<w:body>{''.join(self.body_parts)}{sect_pr}</w:body></w:document>"
        )

        with zipfile.ZipFile(out_docx, "w", compression=zipfile.ZIP_DEFLATED) as zf:
            zf.writestr("[Content_Types].xml", content_types)
            zf.writestr("_rels/.rels", root_rels)
            zf.writestr("word/_rels/document.xml.rels", doc_rels)
            zf.writestr("word/styles.xml", styles_xml)
            zf.writestr("word/header1.xml", header_xml)
            zf.writestr("word/footer1.xml", footer_xml)
            zf.writestr("word/document.xml", document_xml)
            for _, m_path, m_name in self.media_files:
                zf.write(m_path, f"word/media/{m_name}")


# ---------------------------------------------------------------------------
# MAIN DOCUMENT ASSEMBLY
# ---------------------------------------------------------------------------
def main():
    if TMP_BUILD.exists():
        shutil.rmtree(TMP_BUILD)
    TMP_BUILD.mkdir(parents=True, exist_ok=True)
    PRINT_DIR.mkdir(parents=True, exist_ok=True)

    print("[1/3] Rendering 3 animated prepress & collation GIFs...")
    gif1 = TMP_BUILD / "anim_01_hero_showcase.gif"
    gif2 = TMP_BUILD / "anim_02_pack_collation.gif"
    gif3 = TMP_BUILD / "anim_03_box_stacking.gif"
    s_gif1 = build_anim_01_hero(gif1)
    s_gif2 = build_anim_02_pack_collation(gif2)
    s_gif3 = build_anim_03_box_stacking(gif3)

    print("[2/3] Rendering 4 high-resolution static prepress proof figures...")
    fig_box = TMP_BUILD / "fig_04_booster_box.png"
    fig_packs = TMP_BUILD / "fig_05_booster_packs.png"
    fig_tucks = TMP_BUILD / "fig_06_tuckboxes.png"
    fig_cards = TMP_BUILD / "fig_07_sample_cards.png"
    s_box, s_packs, s_tucks, s_cards = build_static_figures(fig_box, fig_packs, fig_tucks, fig_cards)

    print("[3/3] Assembling stylized OOXML InquiryForKenzi.docx...")
    doc = DocxBuilder()

    # --- ANIMATED HERO SHOWCASE ---
    doc.add_image(
        gif1,
        s_gif1,
        width_inches=6.75,
        caption="Live Overview: GlimmerFall TCG First Edition (AWK) — 500 Display Boxes × 30 Booster Packs (2 Designs) × 12 Cards (incl. 1 Holographic Foil/Pack).",
    )

    # --- INQUIRY GREETING & QUOTE UPDATE CALLOUT ---
    doc.add_callout_banner(
        "PRODUCTION INQUIRY & FINAL PREPRESS HANDOFF — ATTN: KENZI ZHAO",
        [
            ("To: Kenzi Zhao, Sales Manager — Super Board Game Manufacturing (Guangming, Shenzhen, CN | kenzi@superboardgame.com)", True),
            ("From: ErnstWilliam Hertz — GlimmerFall TCG (https://GlimmerFallTCG.com)  |  Ref: Previous Quote Dated 2026/07/21", True),
            (
                "Dear Kenzi — All 100% press-ready CMYK PDFs for GlimmerFall TCG First Edition: The Awakening (AWK) are now uploaded in this shared Google Drive folder (322 Card Fronts + 1 Official Card Back + 1 Display Box + 2 Booster Pack Wrappers). Please review the updated final specification below (12 cards per pack using your official 72×125mm pack and 125×144×67mm box templates) and send your updated Proforma Invoice & pre-production sample timeline.",
                False,
            ),
        ],
        bg_hex="0F1626",
        accent_hex="F2A900",
        title_color="F2A900",
        text_color="F0F3FA",
    )

    # --- SECTION 1: MASTER ORDER QUANTITIES & DELTA FROM PRELIMINARY QUOTE ---
    doc.add_section_heading("01", "MASTER ORDER SUMMARY & SPECIFICATION UPDATES")
    doc.add_paragraph(
        [
            (
                "Please note the updated final card count (12 cards/pack = 180,000 total cards) and updated official factory template dimensions compared to our preliminary 2026/07/21 quote:",
                "Outfit",
                10.0,
                "2A3347",
                False,
                False,
            )
        ]
    )

    doc.add_styled_table(
        headers=["Component", "Preliminary Quote (2026/07/21)", "FINAL PRODUCTION SPEC", "Material & Finishing", "Final Qty"],
        rows=[
            [
                "Regular Non-Foil Cards",
                "9 per pack (135,000 cards)",
                "11 per pack (Slots 01–11)",
                "300gsm Artpaper, 63×88mm R3, 4C+4C, Glossy TCG Varnish",
                "165,000 Cards",
            ],
            [
                "Holographic Foil Cards",
                "1 per pack (15,000 cards)",
                "1 per pack (Slot 12 — 100%)",
                "300gsm Holographic Foil Paper, 63×88mm R3, 4C+4C, Glossy",
                "15,000 Cards",
            ],
            [
                "Foil Booster Pack — Design A",
                "80×140mm (1 design)",
                "72×125mm Sealed (170×125mm Flat)",
                "0.6mm Aluminum Foil Bag, 4C CMYK — Emberwing Courier",
                "7,500 Bags (50%)",
            ],
            [
                "Foil Booster Pack — Design B",
                "—",
                "72×125mm Sealed (170×125mm Flat)",
                "0.6mm Aluminum Foil Bag, 4C CMYK — Reality Fracture",
                "7,500 Bags (50%)",
            ],
            [
                "Countertop Display Box",
                "~165×145×35mm (500 boxes)",
                "125×144×67mm (30 Packs / Box)",
                "350g C1S Artpaper + W9 Fluted, 4C CMYK, Matte Lamination + POF Shrink",
                "500 Boxes",
            ],
            [
                "TOTAL PRINT RUN",
                "500 Boxes / 15,000 Packs / 150k Cards",
                "500 Boxes × 30 Packs × 12 Cards",
                "Packed 12 Display Boxes/Carton (41×12 + 1×8 = 42 Cartons)",
                "180,000 Cards",
            ],
        ],
        col_pcts=[21, 20, 22, 24, 13],
        aligns=["left", "left", "left", "left", "right"],
        highlight_last_row=True,
    )

    # --- SECTION 2: DELIVERED PREPRESS FILES & OCG LAYER GUIDE ---
    doc.add_section_heading("02", "PREPRESS FILE INVENTORY & ADOBE ILLUSTRATOR LAYER (OCG) GUIDE")
    doc.add_paragraph(
        [
            (
                "Every PDF in this folder is ICC-profiled CMYK (TAC ≤ 295%–300%) built directly on your official dieline templates with Optional Content Groups (OCGs) so your prepress engineer can toggle cut/fold dielines OFF in 1 click prior to plating:",
                "Outfit",
                10.0,
                "2A3347",
                False,
                False,
            )
        ]
    )

    doc.add_styled_table(
        headers=["File / Folder in Google Drive", "Trim / Assembled Size", "Bleed / Flat Size", "CMYK Artwork Layer", "Dieline Layer (TURN OFF FOR PLATE)"],
        rows=[
            [
                "Booster Box Template - GlimmerFall AWK.pdf",
                "125 × 144 × 67 mm",
                "Exact Green Bleed (+3mm)",
                "DESIGN (300 DPI CMYK)",
                "图层 1 (Cut/Fold/Safe) & 角线图层",
            ],
            [
                "Booster Pack 72x125 - Emberwing Courier.pdf",
                "72 × 125 mm Sealed",
                "176 × 131 mm (170×125 +3mm)",
                "图层 2 (450 DPI CMYK)",
                "图层 1 (Fin/Crimp/Dimensions)",
            ],
            [
                "Booster Pack 72x125 - Reality Fracture.pdf",
                "72 × 125 mm Sealed",
                "176 × 131 mm (170×125 +3mm)",
                "图层 2 (450 DPI CMYK)",
                "图层 1 (Fin/Crimp/Dimensions)",
            ],
            [
                "TuckInBox - Solar Singularity / Graveglass / Fractured / Gaia's Loop (4 PDFs)",
                "65 × 90 × 15 mm (40 Cards)",
                "Exact +3.0mm Contour Bleed",
                "DESIGN (300 DPI CMYK)",
                "图层 1 (Cut/Fold + 63×88 Ref)",
            ],
            [
                "cards_cmyk/AWK_000_Official_Card_Back...pdf",
                "63 × 88 mm (R3)",
                "69 × 94 mm (+3mm all sides)",
                "图层 1 & 图层 2",
                "图层 3 (Red R3 Cut Line)",
            ],
            [
                "cards_cmyk/AWK_001 ... AWK_322 (322 PDFs)",
                "63 × 88 mm (R3)",
                "69 × 94 mm (+3mm all sides)",
                "图层 1 & 图层 2 (300 DPI CMYK)",
                "图层 3 (Red R3 Cut Line)",
            ],
        ],
        col_pcts=[31, 16, 19, 17, 17],
    )

    doc.add_image(
        fig_box,
        s_box,
        width_inches=6.75,
        caption="Prepress Proof 1 — `Booster Box Template - GlimmerFall AWK.pdf` (125×144×67 mm): Top Lid [Wall 09] rotated 180° inside the U-Arch Pop-Up Crown; Left Glue Flap [08] includes 3mm ink wrap + unvarnished white bonding strip.",
    )
    doc.add_image(
        fig_packs,
        s_packs,
        width_inches=6.75,
        caption="Prepress Proof 2 — Twin 72×125 mm Booster Pack Designs: `Emberwing Courier` (Left, SKU GF-AWK-BP01, 7,500 bags) & `Reality Fracture` (Right, SKU GF-AWK-BP02, 7,500 bags).",
    )
    doc.add_image(
        fig_tucks,
        s_tucks,
        width_inches=6.75,
        caption="Prepress Proof 3 — Four 65×90×15 mm 40-Card Starter Deck Tuck-In Boxes (`Solar Singularity`, `The Graveglass Veil`, `Fractured Continuum`, and `Gaia’s Loop`).",
    )
    doc.add_image(
        fig_cards,
        s_cards,
        width_inches=6.75,
        caption="Prepress Proof 4 — Sample from `cards_cmyk/` (All 322 Unique AWK Cards rendered at 300 DPI ICC CMYK, 63×88mm R3 trim inside 69×94mm full bleed).",
    )

    # --- SECTION 3: 12-CARD PACK COLLATION & CARD ORIENTATION ---
    doc.add_section_heading("03", "12-CARD BOOSTER PACK LINEUP, FOIL SLOT & COLLATION RULES")
    doc.add_image(
        gif2,
        s_gif2,
        width_inches=6.75,
        caption="Animated Collation Sequence: Exact Front-to-Back 12-Card Order inside every 72×125 mm Booster Pack.",
    )

    doc.add_styled_table(
        headers=["Pack Slot(s)", "Card Stock", "Rarity / Pull Rule", "Orientation & Collation Rule"],
        rows=[
            [
                "Slots 01 – 07 (7 Cards)",
                "300gsm Artpaper (Non-Foil)",
                "100% Common (7 Commons per pack)",
                "Card #01 Front faces Front Wrapper Art; 7 distinct Commons across ≥3 Factions.",
            ],
            [
                "Slots 08 – 10 (3 Cards)",
                "300gsm Artpaper (Non-Foil)",
                "100% Uncommon (3 Uncommons per pack)",
                "3 distinct Uncommons per pack (zero duplicate collector numbers in Slots 01–11).",
            ],
            [
                "Slot 11 — HIT SLOT (1 Card)",
                "300gsm Artpaper (Non-Foil)",
                "80.0% Rare (24/box)  |  20.0% Epic (6/box)",
                "Guaranteed Rare or Epic in every pack (exact 4:1 Rare-to-Epic ratio per box).",
            ],
            [
                "Slot 12 — FOIL SLOT (1 Card)",
                "300gsm Holographic Paper",
                "50% Foil C | 30% Foil U | 13.33% Foil R | 6.67% Foil E",
                "100% Guaranteed Foil in every pack! Official Card Back faces Rear Fin Seal.",
            ],
        ],
        col_pcts=[22, 21, 27, 30],
    )

    doc.add_callout_banner(
        "CRITICAL ANTI-DUPLICATION & RANDOMIZATION RULES",
        [
            ("1. Zero Duplicate Non-Foil Cards per Pack: Slots 01–11 must contain 11 distinct Collector Numbers (#001–#322).", True),
            ("2. Faction Balance: Use shifted collation strips so every pack's 7 Commons include at least 3 of the 4 Factions (Solari, Umbri, Terra, Aether).", False),
            ("3. Wrapper Independence: Emberwing Courier and Reality Fracture foil wrappers must receive identical randomized card collation (no artwork mapping).", False),
        ],
        bg_hex="141D30",
        accent_hex="24CCFF",
        title_color="5CE1FF",
        text_color="EDF2FA",
    )

    # --- SECTION 4: COMPLETE RARITY, FOIL & PER-CARD IMPOSITION NUMBERS ---
    doc.add_section_heading("04", "EXACT RARITY, FOIL & PER-CARD PRINT QUANTITIES (#001–#322)")
    doc.add_paragraph(
        [
            (
                "Expansion 1: The Awakening (AWK) contains exactly 322 unique cards (97 Commons, 85 Uncommons, 89 Rares, 51 Epics across Solari 81, Umbri 81, Terra 80, Aether 80). Below is the exact card-level production math:",
                "Outfit",
                10.0,
                "2A3347",
                False,
                False,
            )
        ]
    )

    doc.add_styled_table(
        headers=["Stock & Rarity Tier", "Unique Cards in AWK", "Per Pack", "Per 30-Pack Box", "500 Boxes (15,000 Packs)", "Copies Printed per Unique Card"],
        rows=[
            [
                "Non-Foil Common (Slots 1–7)",
                "97 Unique Commons",
                "7.00",
                "210 cards",
                "105,000 cards",
                "1,083 copies × 97 = 105,051 (+51 QA)",
            ],
            [
                "Non-Foil Uncommon (Slots 8–10)",
                "85 Unique Uncommons",
                "3.00",
                "90 cards",
                "45,000 cards",
                "530 copies × 85 = 45,050 (+50 QA)",
            ],
            [
                "Non-Foil Rare (Slot 11 @ 80%)",
                "89 Unique Rares",
                "0.80",
                "24 cards",
                "12,000 cards",
                "135 copies × 89 = 12,015 (+15 QA)",
            ],
            [
                "Non-Foil Epic (Slot 11 @ 20%)",
                "51 Unique Epics",
                "0.20",
                "6 cards",
                "3,000 cards",
                "59 copies × 51 = 3,009 (+9 QA)",
            ],
            [
                "Holographic Foil Common (50%)",
                "97 Unique Commons",
                "0.50",
                "15 foils",
                "7,500 foils",
                "78 copies × 97 = 7,566 (+66 QA)",
            ],
            [
                "Holographic Foil Uncommon (30%)",
                "85 Unique Uncommons",
                "0.30",
                "9 foils",
                "4,500 foils",
                "53 copies × 85 = 4,505 (+5 QA)",
            ],
            [
                "Holographic Foil Rare (13.33%)",
                "89 Unique Rares",
                "0.1333",
                "4 foils",
                "2,000 foils",
                "23 copies × 89 = 2,047 (+47 QA)",
            ],
            [
                "Holographic Foil Epic (6.67%)",
                "51 Unique Epics",
                "0.0667",
                "2 foils",
                "1,000 foils",
                "20 copies × 51 = 1,020 (+20 QA)",
            ],
            [
                "GRAND TOTAL (NET COLLATED)",
                "322 Unique Cards",
                "12.00 Cards",
                "360 Cards (30 Foils)",
                "180,000 Cards",
                "165k Regular + 15k Holo Foil",
            ],
        ],
        col_pcts=[24, 15, 10, 14, 16, 21],
        aligns=["left", "center", "right", "right", "right", "left"],
        highlight_last_row=True,
    )

    # --- SECTION 5: 30-PACK DISPLAY BOX PACKING & EXPORT CARTONS ---
    doc.add_section_heading("05", "30-PACK DISPLAY BOX PACKING (2×15 COLUMNS) & EXPORT CARTONS")
    doc.add_image(
        gif3,
        s_gif3,
        width_inches=6.75,
        caption="Animated Assembly Guide: 2 Side-by-Side Columns × 15 Stacked Packs (72mm + 72mm = 144mm Width × 125mm Depth × 67mm Height).",
    )

    doc.add_styled_table(
        headers=["Packaging / Logistics Item", "Specification & Orientation Requirement"],
        rows=[
            [
                "2 × 15 Column Fit (30 Packs/Box)",
                "Left Column (15 packs) + Right Column (15 packs) = 30 packs. Alternate Emberwing Courier and Reality Fracture so every box contains exactly 15 packs of each design.",
            ],
            [
                "Pack Orientation Inside Box",
                "All packs lie FACE-UP (front art facing Top Lid) with TOP CRIMP pointing toward BACK HINGE [Wall 00], so packs face customers right-side-up when the retail U-Crown is popped open.",
            ],
            [
                "Individual Box Tamper Seal",
                "Each of the 500 assembled Display Boxes must be sealed in crystal-clear POF shrink film.",
            ],
            [
                "EAN-13 Barcodes on Artwork",
                "Box: 2002026003018 (GF-AWK-BB01)  |  Pack A: 2002026000116 (GF-AWK-BP01)  |  Pack B: 2002026000123 (GF-AWK-BP02).",
            ],
            [
                "Master Export Cartons (42 CTNs)",
                "Cartons 01–41: 41 × 12 Display Boxes = 492 Boxes  |  Carton 42: 1 × 8 Display Boxes (padded snugly with EPE foam) = 500 Boxes total.",
            ],
        ],
        col_pcts=[28, 72],
    )

    # --- SECTION 6: QUOTATION & SAMPLE CONFIRMATION QUESTIONS FOR KENZI ---
    doc.add_section_heading("06", "QUOTATION & PRODUCTION CHECKLIST FOR KENZI ZHAO")
    doc.add_callout_banner(
        "PLEASE CONFIRM THESE 5 ITEMS IN YOUR REPLY / UPDATED PROFORMA INVOICE",
        [
            ("1. Updated Unit & Total Price for 12 Cards/Pack: Confirm revised pricing for 500 Display Boxes × 30 Packs × 12 Cards (165,000 × 300gsm Regular Cards + 15,000 × 300gsm Holographic Foil Cards = 180,000 Cards total).", True),
            ("2. Two Booster Foil Bag Designs (7,500 + 7,500): Confirm cylinder/plate setup cost for printing 7,500 bags of Emberwing Courier + 7,500 bags of Reality Fracture on 72×125mm 0.6mm aluminum foil.", True),
            ("3. Automated 12-Card Hopper Collation: Confirm your collation line will assemble Slots 01–07 (7C), Slots 08–10 (3U), Slot 11 (80% R / 20% E), and Slot 12 (100% Holographic Foil: 50% C / 30% U / 13.33% R / 6.67% E) with zero duplicate non-foils per pack.", True),
            ("4. Prepress Preflight & 4 Starter Deck Tuck-In Boxes: Confirm all 330 CMYK PDFs (`Booster Box`, `2 Booster Packs`, `4 Starter Deck Tuck-In Boxes`, `322 Card Fronts`, `1 Official Card Back`) pass your prepress RIP preflight cleanly with dieline OCGs switched off, and quote tier pricing for the 4 Starter Deck Tuck-In Boxes (40 cards: 39 regular + 1 holo foil each).", True),
            ("5. Physical Pre-Production Sample & DDP Shipping: Confirm sample cost & 5–7 day lead time for 1 complete pre-production sample set (assembled Display Box + sealed Foil Packs + Regular & Holo cards), plus updated DDP Sea vs. DDP Air shipping quote to Sweden.", True),
        ],
        bg_hex="0F1626",
        accent_hex="F2A900",
        title_color="F2A900",
        text_color="F0F3FA",
    )

    UPDATES_DIR.mkdir(parents=True, exist_ok=True)
    out_docx = UPDATES_DIR / "InquiryForKenzi.docx"
    doc.save(out_docx)

    # Remove superseded plain-text info.txt so `print/` is clean for Google Drive upload
    old_info = PRINT_DIR / "info.txt"
    if old_info.exists():
        old_info.unlink()

    shutil.rmtree(TMP_BUILD, ignore_errors=True)
    print(f"[DONE] Created {out_docx} ({out_docx.stat().st_size / (1024 * 1024):.2f} MB)")


if __name__ == "__main__":
    main()
