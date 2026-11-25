# GlimmerFall TCG — First Edition: The Awakening (`AWK`) Prepress Samples

All files in this directory are generated deterministically from `/api/designer/cards` (`card_engine/designer_cards_322.json`) with **zero manual re-typing** of card names, collector numbers, stats, or Oracle text.

## Press Specifications (Super Board Game Manufacturing, Shenzhen)
- **Finished Trim Size:** `63.00 × 88.00 mm` (`R3 = 3.00 mm` rounded corners)
- **Full Bleed Canvas:** `69.00 × 94.00 mm` (`3.00 mm` bleed on all 4 sides + `2.8 mm` safe inner obsidian border matching `Back side卡牌-62张-卡背.pdf`)
- **Resolution:** `450 DPI` press export (supersampled from `900 DPI` master)
- **Color Space:** ICC-profiled `CMYK` (`4C+4C`, Perceptual GCR separation, Total Ink Limit `TAC ≤ 300%`)
- **PDF Layers (OCGs):** Exact 3-layer structure matching `Back side卡牌-62张-卡背.pdf`:
  1. `图层 2 (Bleed Background)`
  2. `图层 1 (Card Artwork CMYK)`
  3. `图层 3 (Dieline R3 63x88mm)` — toggleable `C=0, M=100%, Y=100%, K=0` vector cut path

## Directory Contents
- `GlimmerFall_AWK_Sample_Contact_Sheet.png` — Visual overview of all 12 sample cards
- `GlimmerFall_AWK_Sample_Pack_With_Back_CMYK_69x94mm.pdf` — Combined 13-page CMYK press PDF (Page 1 = Official Card Back + Pages 2–13 = 12 Sample Fronts)
- `pdf_cmyk/` — Individual 3-layer CMYK press-ready PDFs (`69×94mm` w/ `TrimBox`, `BleedBox`, and toggleable `R3` dieline)
- `png_trim/` — Die-cut `63×88mm R3` PNGs for web/digital review
- `png_bleed_proof/` — `69×94mm` bleed proofs showing the red `R3` cut line
- `optional_smart_lore_preview/` — Optional comparison previews (`--lore-mode smart`) showing flavor text included **only** on vanilla / ultra-short 1-line cards while keeping dense cards like `Graveglass Oracle` 100% Oracle-only

## Generating All 322 Cards Locally (Zero AI Credits)
Run from the repository root:

```bash
# Pure Oracle/Rules text only (Default — recommended for tournament clarity):
python3 card_engine/generate_cards.py --all --lore-mode none --outdir results_all_322

# Optional Smart Lore mode (flavor text ONLY on vanilla / very short 1-line cards):
python3 card_engine/generate_cards.py --all --lore-mode smart --outdir results_all_322_smart
```
