# GlimmerFall TCG — PRD

## Problem Statement
A fully playable digital Trading Card Game. React frontend + FastAPI backend connected to NeonDB PostgreSQL (pre-populated with 100 cards, rulebook, starter decks). Four factions (Solari/yellow, Umbri/purple, Terra/green, Aether/blue). Card types: Entity, Rite (slow spell), Flash (fast spell), Relic. Keywords: Guard, Evasive, Stealth, Lethal, Overwhelm, Swift. Resonance Node energy system; Vanguard/Nexus = 25 HP. Pages: Home, Arena (play), Cards, Deck Builder, Booster, Rulebook, Print hub. Original spec targeted Vercel Serverless + Vite; delivered on the platform's React + FastAPI stack with identical `/api/*` routes and game logic.

## Architecture
- Backend: FastAPI (`server.py`) + connection pool to NeonDB Postgres. Server-authoritative game engine (`game_engine.py`). All routes under `/api`.
- Frontend: React (CRA/craco), TailwindCSS, framer-motion, @dnd-kit, react-router, react-markdown, JSZip.
- Card art: Cloudinary baked illustrations; stats/text overlaid by `CardTemplate`.

## Implemented (2026-06)
- Iteration 1: All pages + APIs. Card DB with filters/modal, Booster with holo reveal, Deck Builder (localStorage), Rulebook, Arena (lobby + drag-drop board, polling, 2-player rooms + GlimmerBot AI). Server-side turn limits (1 draw, 1 resonance/turn), combat with keywords (Guard/Evasive/Lethal/Overwhelm/Stealth), win condition. State redaction hides opponent hand + libraries. Cloudinary images mapped to all 100 cards; generated cardback + hero.
- Iteration 2:
  - Fixed card rendering: `CardTemplate` overlays faction-colored cost badge, name, type badge, oracle text (~68% textbox), keywords, and a combined power/health pill (bottom-right) for Entities — used everywhere.
  - Renamed slow spell Hex -> Rite (DB already Rite; fixed engine + UI).
  - Card-effect engine: deploy effects, death triggers, attachment relics (Radiant Shield etc.), spell resolution (damage/heal/draw/buff/destroy/exhaust/tokens/bounce). Best-effort parser over oracle text.
  - Deck Builder: load Starter/Tournament decks from DB; Proxy print buttons.
  - Print Hub `/print`: choose source (Complete Set or any deck), read blurb, Hobby (9/A4 page PDF) or Professional (1 card/page, 63x88mm +3mm bleed, backside first) with SVG(.zip) export. Subtle footer link.
  - Logo integrated in navbar, footer, print hub.

## Testing
- Backend + frontend suites: 100% pass (see /app/test_reports/iteration_1.json). Backend tests at /app/backend/tests/test_glimmerfall_backend.py.

## Backlog / Next
- P1: Implement remaining complex card effects (auras, ongoing passives, triggered "on attack/block", scry/search) — engine parser currently best-effort.
- P1: Relic attachment target selection UI (currently auto-attaches to strongest entity).
- P2: `create token` faction inference (currently defaults Aether for spells).
- P2: Extend logo usage (booster pack, hero watermark), animations for combat strikes.
- P2: Deck legality validation for Arena (custom deck selection into a match).
