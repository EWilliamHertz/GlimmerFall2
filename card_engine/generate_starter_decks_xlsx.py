#!/usr/bin/env python3
"""
GlimmerFall TCG — First Edition: The Awakening (AWK)
Generates the 4-Tab Balanced Starter Decklists Excel Workbook (`GlimmerFall_AWK_Starter_Decks.xlsx`)
and syncs the canonical 40-card mono-faction Starter Decks to PostgreSQL (`starter_decks` & `starter_deck_cards`).

Verified via 6,000 full 1v1 tactical matches (1,000 matches per pairing, 50% P1 / 50% P2):
  - Solar Singularity   (Solari) : 48.97% overall (1,469.0 / 3,000)
  - The Graveglass Veil (Umbri)  : 49.90% overall (1,497.0 / 3,000)
  - Fractured Continuum (Aether) : 50.07% overall (1,502.0 / 3,000)
  - Gaia's Loop         (Terra)  : 51.07% overall (1,532.0 / 3,000)

Rules strictly enforced across all 4 decks:
  - 40 cards exact per deck: 39 Regular (300gsm Artpaper) + 1 Holographic Foil (300gsm Holo)
  - Maximum 3 copies of any card (counting Regular + HOLO combined)
  - 100% pure mono-faction cards
  - 100% of the 3 showcase cards pictured on the backside of each Tuck-In Box included
  - Explicit split notation for the Holo card (e.g. `2 Emberwing Courier` + `1 Emberwing Courier (HOLO)`)
"""

import html
import json
import os
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Dict, List, Tuple

ENGINE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = ENGINE_DIR.parent
PRINT_DIR = PROJECT_ROOT / "print"
UPDATES_DIR = PRINT_DIR / "updates"

with open(ENGINE_DIR / "designer_cards_322.json", "r", encoding="utf-8") as f:
    ALL_CARDS = json.load(f)

BY_NAME = {c["name"]: c for c in ALL_CARDS}

STARTER_DECKS: List[Dict] = [
    {
        "db_id": 3,
        "deck_key": "solar_singularity",
        "tab_name": "Solar Singularity",
        "faction": "Solari",
        "sku": "GF-AWK-TD01",
        "color_theme": "from-amber-900 to-slate-950",
        "header_hex": "8A5400",
        "sub_hex": "FFF3D1",
        "description": "A radiant Solari aggro-midrange deck deploying swift celestial threats, Guard shields, and sunfire judgements.",
        "holo_card": "Emberwing Courier",
        "backside_showcase": {"Emberwing Courier", "Dawnblade Templar", "Decree of the Sun"},
        "overall_winrate": "48.97% (1,469 / 3,000 simulated games)",
        "matchups": [
            ("vs. The Graveglass Veil (Umbri)", "45.9% Win  /  54.1% Loss (1,000 games)"),
            ("vs. Fractured Continuum (Aether)", "53.3% Win  /  46.7% Loss (1,000 games)"),
            ("vs. Gaia's Loop (Terra)", "47.7% Win  /  52.3% Loss (1,000 games)"),
        ],
        "cards": [
            ("Firstlight Scout", 1),
            ("Sunspire Acolyte", 3),
            ("Emberwing Courier", 3),        # Splits -> 2 Emberwing Courier + 1 Emberwing Courier (HOLO)
            ("Luminous Guide", 2),
            ("Radiant Blessing", 2),
            ("Radiant Shield", 2),
            ("Dawnblade Templar", 3),
            ("Solari Standard Bearer", 2),
            ("Judgement of the Sun", 3),
            ("Haloed Bastion", 2),
            ("Golden Lion", 3),
            ("Zenith Inquisitor", 2),
            ("Decree of the Sun", 2),
            ("Morningstar Knight", 3),
            ("Sunspire Archon", 2),
            ("Divine Verdict", 2),
            ("Sunfire Drake", 2),
            ("Blazing Seraph", 1),
        ],
    },
    {
        "db_id": 1,
        "deck_key": "graveglass_veil",
        "tab_name": "The Graveglass Veil",
        "faction": "Umbri",
        "sku": "GF-AWK-TD02",
        "color_theme": "from-violet-950 to-slate-950",
        "header_hex": "4B1882",
        "sub_hex": "F2E6FF",
        "description": "An Umbri Void-recursion and attrition deck wielding Lethal stalkers, Lifesteal drains, and The Nightfall King.",
        "holo_card": "Graveglass Oracle",
        "backside_showcase": {"Shadow Cloak", "Graveglass Oracle", "The Nightfall King"},
        "overall_winrate": "49.90% (1,497 / 3,000 simulated games)",
        "matchups": [
            ("vs. Solar Singularity (Solari)", "54.1% Win  /  45.9% Loss (1,000 games)"),
            ("vs. Fractured Continuum (Aether)", "50.0% Win  /  50.0% Loss (1,000 games)"),
            ("vs. Gaia's Loop (Terra)", "45.6% Win  /  54.4% Loss (1,000 games)"),
        ],
        "cards": [
            ("Shadow Cloak", 2),
            ("Void Stalker", 3),
            ("Gloom Bat", 3),
            ("Soul Drain", 3),
            ("Graveglass Oracle", 3),        # Splits -> 2 Graveglass Oracle + 1 Graveglass Oracle (HOLO)
            ("Soul Tithe", 2),
            ("Abyssal Hound", 3),
            ("Nightblade Infiltrator", 3),
            ("Ebon Duelist", 2),
            ("Gloam Reaper", 2),
            ("Unmake", 3),
            ("Abyssal Grasp", 3),
            ("Ravenous Echo", 3),
            ("Sepulcher Warden", 2),
            ("The Nightfall King", 3),
        ],
    },
    {
        "db_id": 2,
        "deck_key": "fractured_continuum",
        "tab_name": "Fractured Continuum",
        "faction": "Aether",
        "sku": "GF-AWK-TD03",
        "color_theme": "from-sky-900 to-indigo-950",
        "header_hex": "0B4F8A",
        "sub_hex": "E3F5FF",
        "description": "An Aether spell-tempo and control deck bending time with Evasive flyers, Gravity Wells, and Reality Fracture.",
        "holo_card": "Reality Fracture",
        "backside_showcase": {"Aetheric Blast", "Reality Fracture", "The Infinite Loop"},
        "overall_winrate": "50.07% (1,502 / 3,000 simulated games)",
        "matchups": [
            ("vs. Solar Singularity (Solari)", "46.7% Win  /  53.3% Loss (1,000 games)"),
            ("vs. The Graveglass Veil (Umbri)", "50.0% Win  /  50.0% Loss (1,000 games)"),
            ("vs. Gaia's Loop (Terra)", "53.5% Win  /  46.5% Loss (1,000 games)"),
        ],
        "cards": [
            ("Formula of Sparks", 2),
            ("Riftblade Scout", 2),
            ("Flowbook", 3),
            ("Chrono Shift", 2),
            ("Gravity Warden", 3),
            ("Gravity Well", 3),
            ("Temporal Duelist", 3),
            ("Mind Sculptor", 3),
            ("Aetheric Blast", 3),
            ("Stormweaver", 2),
            ("Astral Drake", 3),
            ("Phasewing Drake", 2),
            ("Aether Golem", 3),
            ("Rift Titan", 3),
            ("Reality Fracture", 2),         # Splits -> 1 Reality Fracture + 1 Reality Fracture (HOLO)
            ("The Infinite Loop", 1),
        ],
    },
    {
        "db_id": 4,
        "deck_key": "gaias_loop",
        "tab_name": "Gaia's Loop",
        "faction": "Terra",
        "sku": "GF-AWK-TD04",
        "color_theme": "from-emerald-950 to-slate-950",
        "header_hex": "116139",
        "sub_hex": "E4FAEE",
        "description": "A primal Terra Resonance-ramp deck accelerating Glimmer Nodes to unleash towering Guards and Gaia, The World-Soul.",
        "holo_card": "Gaia, The World-Soul",
        "backside_showcase": {"Mossback Forager", "Primordial Growth", "Gaia, The World-Soul"},
        "overall_winrate": "51.07% (1,532 / 3,000 simulated games)",
        "matchups": [
            ("vs. Solar Singularity (Solari)", "52.3% Win  /  47.7% Loss (1,000 games)"),
            ("vs. The Graveglass Veil (Umbri)", "54.4% Win  /  45.6% Loss (1,000 games)"),
            ("vs. Fractured Continuum (Aether)", "46.5% Win  /  53.5% Loss (1,000 games)"),
        ],
        "cards": [
            ("Sapling Defender", 1),
            ("Nature's Bounty", 2),
            ("Rootbound Mystic", 2),
            ("Mossback Forager", 3),
            ("Bramble Stag", 3),
            ("Boulderhide Charger", 2),
            ("Canopy Ambush", 2),
            ("Seismic Stomp", 2),
            ("Renewal Spring", 2),
            ("Forest Warden", 3),
            ("Thornweave Matron", 3),
            ("Ironwood Armor", 2),
            ("Landslide Verdict", 2),
            ("Granite Behemoth", 3),
            ("Primordial Growth", 2),
            ("Stonekin Elder", 2),
            ("Avalanche Herd", 1),
            ("Gaia, The World-Soul", 3),     # Splits -> 2 Gaia, The World-Soul + 1 Gaia, The World-Soul (HOLO)
        ],
    },
]


def col_letter(col_idx_1based: int) -> str:
    res = ""
    n = col_idx_1based
    while n > 0:
        n, rem = divmod(n - 1, 26)
        res = chr(65 + rem) + res
    return res


def esc(val) -> str:
    return html.escape(str(val), quote=True)


def build_sheet_xml(deck: Dict, header_style_id: int) -> str:
    """
    Builds one SpreadsheetML worksheet XML with:
      - Title banner & SKU/Faction metadata
      - 12-column structured 40-card decklist splitting the HOLO card into its own `(HOLO)` row
      - Live Excel `=SUM(...)` formula verifying `40` total cards (`39 Regular + 1 HOLO`)
      - 6,000-Match Simulated Balance & Head-to-Head Matchup Summary block
    """
    col_widths = [34, 7, 30, 28, 13, 10, 10, 7, 22, 11, 22, 66]
    cols_xml = "".join(
        f'<col min="{i}" max="{i}" width="{w}" customWidth="1"/>'
        for i, w in enumerate(col_widths, start=1)
    )

    rows_xml: List[str] = []

    def make_cell(r: int, c: int, val, style_idx: int = 0, is_num: bool = False, formula: str = "") -> str:
        ref = f"{col_letter(c)}{r}"
        if formula:
            return f'<c r="{ref}" s="{style_idx}"><f>{esc(formula)}</f><v>{val}</v></c>'
        if is_num:
            return f'<c r="{ref}" s="{style_idx}"><v>{val}</v></c>'
        return f'<c r="{ref}" s="{style_idx}" t="inlineStr"><is><t xml:space="preserve">{esc(val)}</t></is></c>'

    # Row 1: Deck Title Banner
    r1_cells = [
        make_cell(
            1,
            1,
            f"GLIMMERFALL TCG — {deck['tab_name'].upper()} ({deck['faction'].upper()} STARTER DECK  •  {deck['sku']})",
            style_idx=header_style_id,
        )
    ] + [make_cell(1, c, "", style_idx=header_style_id) for c in range(2, 13)]
    rows_xml.append(f'<row r="1" ht="28" customHeight="1">{"".join(r1_cells)}</row>')

    # Row 2: Subtitle / Deck Spec
    r2_cells = [
        make_cell(
            2,
            1,
            f"40-Card Ready-to-Play Deck (39 Regular 300gsm + 1 Holographic Foil 300gsm)  |  Max 3 Copies/Card  |  Simulated Win Rate: {deck['overall_winrate']}",
            style_idx=5,
        )
    ] + [make_cell(2, c, "", style_idx=5) for c in range(2, 13)]
    rows_xml.append(f'<row r="2" ht="20" customHeight="1">{"".join(r2_cells)}</row>')

    # Row 3: Blank spacer
    rows_xml.append('<row r="3" ht="8" customHeight="1"/>')

    # Row 4: Table Column Headers
    headers = [
        "Decklist Entry (Print Format)",
        "Qty",
        "Card Name",
        "Card Stock / Finish",
        "Collector #",
        "Faction",
        "Type",
        "Cost",
        "Stats / Keywords",
        "Rarity",
        "Tuck-Box Backside?",
        "Official Oracle Rules Text",
    ]
    r4_cells = [make_cell(4, idx, h_txt, style_idx=6) for idx, h_txt in enumerate(headers, start=1)]
    rows_xml.append(f'<row r="4" ht="24" customHeight="1">{"".join(r4_cells)}</row>')

    # Expand deck rows, splitting the HOLO card into (N-1) Regular + 1 (HOLO)
    expanded_rows: List[Tuple[int, str, bool, Dict]] = []
    tot_verify = 0
    for card_name, total_qty in deck["cards"]:
        assert 1 <= total_qty <= 3, f"{card_name} invalid qty {total_qty}"
        c_obj = BY_NAME[card_name]
        assert c_obj["faction"] == deck["faction"], f"Off-faction card {card_name} in {deck['tab_name']}!"
        tot_verify += total_qty
        if card_name == deck["holo_card"]:
            if total_qty > 1:
                expanded_rows.append((total_qty - 1, card_name, False, c_obj))
            expanded_rows.append((1, f"{card_name} (HOLO)", True, c_obj))
        else:
            expanded_rows.append((total_qty, card_name, False, c_obj))
    assert tot_verify == 40, f"{deck['tab_name']} total={tot_verify} != 40!"
    for req in deck["backside_showcase"]:
        assert any(c_name == req for c_name, _ in deck["cards"]), f"Missing backside card {req}!"

    cur_row = 5
    first_data_row = cur_row
    for idx, (qty, disp_name, is_holo, c_obj) in enumerate(expanded_rows):
        # Style: 9 = Gold HOLO highlight row, 7 = White row, 8 = Zebra tint row
        row_style = 9 if is_holo else (8 if idx % 2 == 1 else 7)
        center_style = 12 if is_holo else (11 if idx % 2 == 1 else 10)

        cn = int(c_obj["collector_number"])
        kws = c_obj.get("keywords")
        kw_clean = "" if not kws or kws == "None" else str(kws).strip()
        if c_obj["card_type"] == "Entity":
            stat_str = f"{c_obj['power']}/{c_obj['health']}" + (f" • {kw_clean}" if kw_clean else "")
        else:
            stat_str = kw_clean or "—"

        base_name = c_obj["name"]
        on_back = "YES — On Box Back" if base_name in deck["backside_showcase"] else "—"
        finish_str = "HOLO FOIL (300gsm Holographic)" if is_holo else "Regular (300gsm Artpaper)"
        oracle_str = (c_obj.get("description") or "").strip()
        if oracle_str == "None" or not oracle_str:
            oracle_str = "(Vanilla Entity)"

        entry_line = f"{qty} {disp_name}"

        c_xml = [
            make_cell(cur_row, 1, entry_line, style_idx=row_style),
            make_cell(cur_row, 2, qty, style_idx=center_style, is_num=True),
            make_cell(cur_row, 3, disp_name, style_idx=row_style),
            make_cell(cur_row, 4, finish_str, style_idx=row_style),
            make_cell(cur_row, 5, f"AWK #{cn:03d}", style_idx=center_style),
            make_cell(cur_row, 6, c_obj["faction"], style_idx=center_style),
            make_cell(cur_row, 7, c_obj["card_type"], style_idx=center_style),
            make_cell(cur_row, 8, int(c_obj["cost"] or 0), style_idx=center_style, is_num=True),
            make_cell(cur_row, 9, stat_str, style_idx=center_style),
            make_cell(cur_row, 10, c_obj["rarity"], style_idx=center_style),
            make_cell(cur_row, 11, on_back, style_idx=center_style),
            make_cell(cur_row, 12, oracle_str, style_idx=row_style),
        ]
        rows_xml.append(f'<row r="{cur_row}" ht="20" customHeight="1">{"".join(c_xml)}</row>')
        cur_row += 1

    last_data_row = cur_row - 1

    # Total Row
    tot_cells = [
        make_cell(cur_row, 1, "TOTAL DECK CARDS (39 REGULAR + 1 HOLO)", style_idx=13),
        make_cell(cur_row, 2, 40, style_idx=14, is_num=True, formula=f"SUM(B{first_data_row}:B{last_data_row})"),
        make_cell(cur_row, 3, f"1x {deck['holo_card']} (HOLO) + 39x Regular", style_idx=13),
        make_cell(cur_row, 4, "All 3 Box-Back Cards Confirmed", style_idx=13),
    ] + [make_cell(cur_row, c, "", style_idx=13) for c in range(5, 13)]
    rows_xml.append(f'<row r="{cur_row}" ht="24" customHeight="1">{"".join(tot_cells)}</row>')
    cur_row += 2

    # Simulation Balance Summary Block at bottom of tab
    sim_hdr = [
        make_cell(cur_row, 1, "SIMULATED BATTLE BALANCE AUDIT (6,000 TOTAL 1v1 MATCHES • 50% GOING 1ST / 50% GOING 2ND)", style_idx=6),
    ] + [make_cell(cur_row, c, "", style_idx=6) for c in range(2, 7)]
    rows_xml.append(f'<row r="{cur_row}" ht="22" customHeight="1">{"".join(sim_hdr)}</row>')
    merge_sim_row = cur_row
    cur_row += 1

    summary_lines = [
        ("Overall Tournament Win Rate", deck["overall_winrate"]),
        *deck["matchups"],
        ("Backside Showcase Audit", "100% Verified — All 3 cards shown on Tuck-In Box back panel are in this 40-card deck"),
    ]
    sim_merges = [f'<mergeCell ref="A{merge_sim_row}:F{merge_sim_row}"/>']
    for s_idx, (k_lbl, v_lbl) in enumerate(summary_lines):
        st = 8 if s_idx % 2 == 1 else 7
        s_cells = [
            make_cell(cur_row, 1, k_lbl, style_idx=st),
            make_cell(cur_row, 2, "", style_idx=st),
            make_cell(cur_row, 3, v_lbl, style_idx=st),
            make_cell(cur_row, 4, "", style_idx=st),
            make_cell(cur_row, 5, "", style_idx=st),
            make_cell(cur_row, 6, "", style_idx=st),
        ]
        rows_xml.append(f'<row r="{cur_row}" ht="20" customHeight="1">{"".join(s_cells)}</row>')
        sim_merges.append(f'<mergeCell ref="A{cur_row}:B{cur_row}"/>')
        sim_merges.append(f'<mergeCell ref="C{cur_row}:F{cur_row}"/>')
        cur_row += 1

    merges_all = [
        '<mergeCell ref="A1:L1"/>',
        '<mergeCell ref="A2:L2"/>',
        *sim_merges,
    ]

    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        '<sheetViews><sheetView workbookViewId="0">'
        '<pane ySplit="4" topLeftCell="A5" activePane="bottomLeft" state="frozen"/>'
        "</sheetView></sheetViews>"
        '<sheetFormatPr defaultRowHeight="19"/>'
        f"<cols>{cols_xml}</cols>"
        f"<sheetData>{''.join(rows_xml)}</sheetData>"
        f'<mergeCells count="{len(merges_all)}">{"".join(merges_all)}</mergeCells>'
        "</worksheet>"
    )


def save_xlsx(out_path: Path):
    styles_xml = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="7">
    <font><sz val="10.5"/><color rgb="FF1C2333"/><name val="Calibri"/></font>
    <font><b/><sz val="13.5"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
    <font><b/><sz val="10"/><color rgb="FF1C2333"/><name val="Calibri"/></font>
    <font><b/><sz val="10.5"/><color rgb="FFF2A900"/><name val="Calibri"/></font>
    <font><b/><sz val="10.5"/><color rgb="FF6B4500"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><color rgb="FFFFE082"/><name val="Calibri"/></font>
  </fonts>
  <fills count="11">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF8A5400"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF4B1882"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF0B4F8A"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF116139"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFEEF2F8"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF0F1626"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF7F9FC"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFFF4CC"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF182238"/></patternFill></fill>
  </fills>
  <borders count="3">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border>
      <left style="thin"><color rgb="FFD4DCE8"/></left>
      <right style="thin"><color rgb="FFD4DCE8"/></right>
      <top style="thin"><color rgb="FFD4DCE8"/></top>
      <bottom style="thin"><color rgb="FFD4DCE8"/></bottom>
      <diagonal/>
    </border>
    <border>
      <left style="thin"><color rgb="FFE6A817"/></left>
      <right style="thin"><color rgb="FFE6A817"/></right>
      <top style="medium"><color rgb="FFE6A817"/></top>
      <bottom style="medium"><color rgb="FFE6A817"/></bottom>
      <diagonal/>
    </border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="15">
    <!-- 0: default -->
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <!-- 1..4: Faction Title Banners (Solari, Umbri, Aether, Terra) -->
    <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" indent="1"/></xf>
    <xf numFmtId="0" fontId="1" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" indent="1"/></xf>
    <xf numFmtId="0" fontId="1" fillId="4" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" indent="1"/></xf>
    <xf numFmtId="0" fontId="1" fillId="5" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" indent="1"/></xf>
    <!-- 5: Subtitle strip -->
    <xf numFmtId="0" fontId="2" fillId="6" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" indent="1"/></xf>
    <!-- 6: Dark Midnight Column Header -->
    <xf numFmtId="0" fontId="3" fillId="7" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <!-- 7: Data White Left -->
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>
    <!-- 8: Data Zebra Left -->
    <xf numFmtId="0" fontId="0" fillId="8" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>
    <!-- 9: Data HOLO Gold Left -->
    <xf numFmtId="0" fontId="4" fillId="9" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>
    <!-- 10: Data White Center -->
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <!-- 11: Data Zebra Center -->
    <xf numFmtId="0" fontId="0" fillId="8" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <!-- 12: Data HOLO Gold Center -->
    <xf numFmtId="0" fontId="4" fillId="9" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <!-- 13: Total Row Left -->
    <xf numFmtId="0" fontId="5" fillId="10" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>
    <!-- 14: Total Row Sum Center -->
    <xf numFmtId="0" fontId="6" fillId="10" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
  </cellXfs>
</styleSheet>"""

    sheets_meta = "".join(
        f'<sheet name="{esc(d["tab_name"])}" sheetId="{idx}" r:id="rIdSheet{idx}"/>'
        for idx, d in enumerate(STARTER_DECKS, start=1)
    )
    workbook_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
        f"<sheets>{sheets_meta}</sheets></workbook>"
    )

    wb_rels_items = "".join(
        f'<Relationship Id="rIdSheet{idx}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet{idx}.xml"/>'
        for idx in range(1, 5)
    )
    wb_rels = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
        f"{wb_rels_items}</Relationships>"
    )

    root_rels = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
        "</Relationships>"
    )

    sheet_overrides = "".join(
        f'<Override PartName="/xl/worksheets/sheet{idx}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
        for idx in range(1, 5)
    )
    content_types = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        '<Default Extension="xml" ContentType="application/xml"/>'
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
        f"{sheet_overrides}</Types>"
    )

    out_path.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(out_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("[Content_Types].xml", content_types)
        zf.writestr("_rels/.rels", root_rels)
        zf.writestr("xl/workbook.xml", workbook_xml)
        zf.writestr("xl/_rels/workbook.xml.rels", wb_rels)
        zf.writestr("xl/styles.xml", styles_xml)
        for idx, d in enumerate(STARTER_DECKS, start=1):
            sheet_xml = build_sheet_xml(d, header_style_id=idx)
            ET.fromstring(sheet_xml)  # strict XML validation!
            zf.writestr(f"xl/worksheets/sheet{idx}.xml", sheet_xml)


def sync_database():
    import psycopg2

    env_path = Path("/home/ewilliamhe/.env.txt")
    if not env_path.exists():
        return
    env = {}
    for ln in env_path.read_text(encoding="utf-8").splitlines():
        if "=" in ln and not ln.strip().startswith("#"):
            k, v = ln.strip().split("=", 1)
            env[k.strip()] = v.strip().strip('"').strip("'")
    db_url = env.get("TCG_DATABASE_URL")
    if not db_url:
        return

    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    for d in STARTER_DECKS:
        cur.execute(
            """
            UPDATE starter_decks
               SET deck_key = %s,
                   deck_name = %s,
                   description = %s,
                   color_theme = %s
             WHERE id = %s
            """,
            (d["deck_key"], d["tab_name"], d["description"], d["color_theme"], d["db_id"]),
        )
        cur.execute("DELETE FROM starter_deck_cards WHERE starter_deck_id = %s", (d["db_id"],))
        for card_name, qty in d["cards"]:
            cur.execute(
                "INSERT INTO starter_deck_cards (starter_deck_id, card_name, count) VALUES (%s, %s, %s)",
                (d["db_id"], card_name, qty),
            )
    conn.commit()
    conn.close()
    print("[DB] Synced all 4 canonical 40-card mono-faction Starter Decks to PostgreSQL (`starter_decks` & `starter_deck_cards`).")


def main():
    UPDATES_DIR.mkdir(parents=True, exist_ok=True)
    xlsx_updates = UPDATES_DIR / "GlimmerFall_AWK_Starter_Decks.xlsx"
    save_xlsx(xlsx_updates)

    xlsx_print_root = PRINT_DIR / "GlimmerFall_AWK_Starter_Decks.xlsx"
    if xlsx_print_root.exists():
        xlsx_print_root.unlink()
    os.link(xlsx_updates, xlsx_print_root)

    print(f"[XLSX] Created 4-tab workbook: {xlsx_updates} ({xlsx_updates.stat().st_size / 1024:.1f} KB)")
    sync_database()


if __name__ == "__main__":
    main()
