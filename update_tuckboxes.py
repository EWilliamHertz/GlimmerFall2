#!/usr/bin/env python3
"""
GlimmerFall Starter Deck & Tuckbox Synchronization Utility
Validates and syncs physical tuckbox specifications, starter decks, and shop product data.
"""

import sys
import argparse
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
ASSIGNMENTS_MD = SCRIPT_DIR / "tuckbox_deck_assignments.md"

TUCKBOX_CATALOG = {
    "gaias_loop": {
        "name": "Gaia's Loop",
        "faction": "Terra",
        "art": "gaia_the_world-soul.webp",
        "theme": "Unstoppable natural growth, giant elemental beasts, and the cyclical power of the earth.",
        "mythic_card": "Gaia, the World-Soul",
        "price_usd": 19.99,
        "price_sek": 219,
        "weight_kg": 0.25,
    },
    "solar_singularity": {
        "name": "Solar Singularity",
        "faction": "Solari",
        "art": "emberwing_courier.webp",
        "theme": "Blinding speed, radiant fire, and overwhelming aggressive Light magic.",
        "mythic_card": "Solari Sun-Caller",
        "price_usd": 19.99,
        "price_sek": 219,
        "weight_kg": 0.25,
    },
    "fractured_continuum": {
        "name": "Fractured Continuum",
        "faction": "Aether",
        "art": "reality_fracture.webp",
        "theme": "Time manipulation, spell echoing, and disruption of reality itself.",
        "mythic_card": "Chronomancer Supreme",
        "price_usd": 19.99,
        "price_sek": 219,
        "weight_kg": 0.25,
    },
    "the_graveglass_veil": {
        "name": "The Graveglass Veil",
        "faction": "Umbri",
        "art": "graveglass_oracle.webp",
        "theme": "Necromancy, forbidden knowledge, and sacrificial shadow magic.",
        "mythic_card": "Graveglass Oracle",
        "price_usd": 19.99,
        "price_sek": 219,
        "weight_kg": 0.25,
    }
}

def validate_assets():
    base_art = SCRIPT_DIR / "Bhuvan_Instructions" / "Bhuvan Instructions" / "0.1 GlimmerFall Tuck-Box Production Handoff" / "03_Card_Art"
    print(f"[*] Validating tuckbox card assets in: {base_art}")
    all_ok = True
    for key, data in TUCKBOX_CATALOG.items():
        art_path = base_art / data["art"]
        if art_path.exists():
            print(f"  [✓] {data['name']} ({data['faction']}): art file exists ({art_path.name})")
        else:
            print(f"  [✗] {data['name']}: missing art at {art_path}")
            all_ok = False
    return all_ok

def run_build(dpi=300):
    from build_tuckboxes import DECKS, build_deck_tuckbox
    out_dir = SCRIPT_DIR / "Bhuvan_Instructions"
    for d in DECKS:
        build_deck_tuckbox(d, out_dir=out_dir, dpi=dpi, preview=True)
    print("\n[✓] All tuckbox production PDFs and previews generated successfully!")

def main():
    parser = argparse.ArgumentParser(description="Synchronize GlimmerFall starter decks and tuckboxes")
    parser.add_argument("--validate", action="store_true", help="Validate tuckbox art assets and specifications")
    parser.add_argument("--build", action="store_true", help="Regenerate all 4 tuckbox print-ready PDFs")
    parser.add_argument("--dpi", type=int, default=300, help="DPI for generation (default: 300)")
    args = parser.parse_args()

    print("=== GlimmerFall Starter Deck & Tuckbox Tooling ===")
    ok = validate_assets()
    if not ok:
        print("[!] Warnings encountered during validation.")

    if args.build or not (args.validate):
        run_build(dpi=args.dpi)

if __name__ == "__main__":
    main()
