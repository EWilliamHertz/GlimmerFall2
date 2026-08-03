# GlimmerFall — New Features & Enhancements

> Prioritized wishlist for future sprints. **Bold** = shovel-ready (small
> scope, no external deps). *Italic* = requires product decision or
> external dependency. Everything else = medium complexity.
> See `readmeGlimmer.md` for the full Glimmer currency spec.

---

## 🏆 P0 — Do Next (foundation for everything else)

### 1. **Glimmer Currency (soft economy)**
See dedicated spec: `readmeGlimmer.md`.
Adds a real balance, quest reward crediting, referral rewards on
email-verify, shop redemption, and a shiny-rock purse widget in the navbar.

### 2. **Wire quest progress in the game engine**
Currently `user_quests.current_value` never moves. Add hooks in
`game_engine.py` for `play_rite`, `play_flash`, `nexus_damage`,
`play_faction_entity:<f>`, `entity_kill`, `win_game`, and `draw_card`.
(§4 of `readmeGlimmer.md`.)

### 3. **Referral link on Dashboard**
`https://<origin>/?ref=<referral_code>` + a "Copy link" button + a small
success counter ("You've brought 3 new Summoners to the Nexus").

---

## 🎮 P1 — High-Impact Player Retention

### 4. Achievement Badges (bronze/silver/gold/platinum)
Static catalog of ~30 badges. Awarded server-side by checking after every
match end. Displayed on `UserProfile.jsx` and in the Leaderboard row.

**Examples:**
- First Blood — win your first ranked match
- Untouchable — win a game with 25/25 Nexus HP (Flawless Victory)
- Streak Master — 10-win streak
- Faction Sovereign (×4) — 50 wins with a single faction
- Card Collector — see 100/100 cards in the DB while logged in
- Founder — signed up during Alpha
- Combo Weaver — cast 5 spells in one turn
- Nexus Breaker — deal 20+ damage in a single turn
- Verified Elder — email verified for 30+ days
- Community Contributor — publish a deck that gets 25+ likes

Backend:
```sql
CREATE TABLE badges (
  code VARCHAR(40) PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  description TEXT NOT NULL,
  tier VARCHAR(10) NOT NULL,     -- bronze/silver/gold/platinum
  icon_url VARCHAR(200)
);
CREATE TABLE user_badges (
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  badge_code VARCHAR(40) REFERENCES badges(code),
  earned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, badge_code)
);
```

### 5. Player XP + Levels
Every action grants small XP. `users.xp` and `users.level` columns.
Displayed as a subtle ring around the avatar. Level-up = +200 Glimmer.

### 6. Post-Match Statistics Screen
Show damage dealt/taken, cards played, biggest single-turn damage, MVP card
(the one that contributed the most damage this match). Big shareable image
that can be downloaded/tweeted.

### 7. Interactive AI Tutorial
A scripted GlimmerBot match with tooltips: "Now play your Resonance Node",
"Attack with your Entity", "Cast your Rite". Grants 200 Glimmer + Founders
Badge on completion (once per account).

### 8. Match Emotes (6 quick expressions)
Small emote picker on the arena. Framer-motion pop above the player's
Nexus card. Anti-spam: 3s cooldown per emote per player. No text chat
(prevents toxicity).

---

## 🎨 P1 — Visual Polish (extends Epic 1)

### 9. Card play impact ring
When a card lands on the battlefield, expanding shockwave from the drop
target — 300ms framer-motion animation.

### 10. Faction-themed particle backgrounds
Behind the battlefield: subtle drifting embers for Solari, glowing spores
for Terra, void whispers for Umbri, arcane runes for Aether. Pick the
faction of the player whose turn it is.

### 11. Turn transition cinematic banner
Between turns, a horizontal wipe with the active player's name + faction
sigil. 500ms. Skippable with any click.

### 12. Card "just drawn" glow
Cards drawn this turn get a soft golden pulse for 6 seconds so players
notice new cards mid-turn.

### 13. Combat targeting arrow (upgrade)
Replace the current dashed line with a hand-drawn ink-style curve using
SVG path + gradient stroke. Same idea as MTG Arena's attack arrow.

### 14. "New card" reveal in Booster (Hearthstone-style)
When opening a pack, cards flip in from center with particle bursts;
Epic cards flash rainbow before revealing. Framer motion + AudioContext
sizzle sound.

---

## 👥 P1 — Social & Community

### 15. Community Hub deck browser (frontend only — BE exists)
`Community.jsx` already renders Polls + Forge. **Add a "Published Decks"
section** below with:
- Sort: Most upvoted / Newest / Trending (last 7d)
- Filter: faction chips
- Click deck → modal shows full decklist + comments + "Clone to my
  account" button (POSTs to `/api/decks` copying the card list under the
  current user's `nickname`).

### 16. Friends List — direct challenge invites
Table + endpoint already exists. Add UI: type nickname → send request →
accepted friends appear in dashboard. "Invite to match" creates a
private room and DMs the room code (or emails via Resend as a fallback).

### 17. Spectator mode
Backend already exposes read-only match state. Add a "Watch top-ranked
players" page listing currently-live public matches.

### 18. Match replays
Save state snapshots per turn. Playback with a scrubber. Every match
already stores state so this is mostly a UI job.

### 19. Discord bot integration
- Weekly digest: top decks, top players, biggest come-from-behind win.
- `/glimmer` slash-command showing your balance & pending quests.
- Announcements when someone hits Diamond rank.

---

## 🛒 P1 — Shop & Admin

### 20. **CSV order export (ShipStation/PirateShip format)**
Admin Shop Orders tab → "Export Paid" button. Columns:
`Order ID, First Name, Last Name, Address 1, Address 2, City, State,
Postal Code, Country, Items (SKU:Qty pipe-joined), Weight (oz), Value`.

### 21. **User suspend / ban**
`users.status = 'active' | 'suspended' | 'banned'` (default active).
Ban prevents login. Suspend prevents Ranked play only. Admin UI in User
Management table.

### 22. Refund initiator
Admin can trigger `stripe.Refund.create(charge=...)` from the order row.
On success, `shop_orders.status = 'refunded'` and any Glimmer used is
credited back.

### 23. Discount codes
`discount_codes(code, percent OR flat_cents, max_uses, expires_at,
uses INTEGER)`. Apply at Stripe checkout via a promo input.

### 24. Low-stock alerts
When `shop_products.stock < 5`, cron sends a Resend email to admin.

### 25. Newsletter subscriber export
Simple CSV of `waitlist` table.

### 26. Bulk order status update
Multi-select checkboxes in admin orders → "Mark shipped" fires one
Resend email per row + updates status.

---

## 🧠 P2 — Analytics & Balance

### 27. Card win-rate heatmap
For each card, `wins_with / played_in` across all ranked matches.
Weekly report as a colored grid in admin.

### 28. Faction meta report
Weekly digest: faction pickrate, faction winrate, faction Nexus damage
avg, most-mulligan'd cards.

### 29. Deck archetype clustering
Cluster published decks by card overlap → tag ("Aggro", "Control",
"Combo"). Show cluster on deck cards in Community Hub.

---

## 🎓 P2 — Onboarding

### 30. First-win reward pop-up
Confetti + framer-motion celebration + 100 Glimmer + first-win badge.

### 31. Curated starter deck gallery
Deck Builder shows a "New Player? Try these" section with 4 curated
decks (one per faction) with beginner-friendly notes.

### 32. Guided tour on first login
`react-joyride` overlay pointing at "your quests are here", "your
Glimmer is here", "your decks are here". Skippable, one-time.

---

## ♿ P2 — Accessibility

### 33. Colorblind-safe pattern differentiators
Faction backgrounds already use distinct hues. Add subtle pattern
overlays (diagonal, dot, cross-hatch) for full color-blind support.

### 34. Configurable animation intensity
Settings: Off / Subtle / Full. "Off" removes screen shake and heartbeat
audio. Persist in localStorage.

### 35. Screen-reader board announcements
`aria-live="polite"` region that announces "You played Solari Vanguard.
Enemy Nexus at 18 HP." after each action.

### 36. Keyboard-only combat
Full keyboard nav: `Tab` cycles battlefield entities, `Enter` selects
attacker, arrow keys pick target, `Space` ends turn.

---

## 💎 P3 — Cosmetics & Progression Depth

### 37. Cosmetic Playmats
Buy with Glimmer (500) — decorative Arena background for the player.

### 38. Avatar Frames
Awarded with rank tiers. Bronze/Silver/Gold/Diamond/Master frames.

### 39. Card Backs
Alternative card backs unlockable via achievements or Glimmer shop.

### 40. Season Pass
90-day seasons. Free track + Premium track. Ranked reset. Season
leaderboards preserved in a hall-of-fame.

### 41. Custom Nexus skins
Different visual for the HP indicator per faction affinity.

---

## 🔧 P3 — DevX / Ops

### 42. Real-time WebSocket layer for match state
Current design polls. A single websocket per match halves DB load and
enables spectator mode with sub-second lag.

### 43. Redis matchmaking queue
Right now matchmaking is a DB row scan. Redis sorted-set by MMR would be
faster and cleaner.

### 44. Card art pre-warming
Cloudinary URLs are already served but CDN cache is cold on first visit
in some regions. Add a `<link rel="preconnect">` to Cloudinary in
`index.html` and a `<link rel="preload">` for the current page's first 4
card images.

### 45. Sentry error monitoring
Wire `SENTRY_DSN` for both FE and BE. Auto-report unhandled exceptions.

### 46. Automated deployment on push to main
GitHub Actions workflow → Vercel deploy hook. Slack/Discord notification
on success/failure.

---

## 🎁 Sparks — "Would love, didn't ask"

- **Ranked seasonal cosmetic cardback** — each Season winner gets a
  unique cardback that no one else can craft. Ultra-flex.
- **Nickname reactions** — right-click an opponent's nickname mid-match
  to send "GG!" without cluttering chat.
- **Physical First-Edition owner badge** — anyone who preorders a
  physical Booster Box gets a permanent glowing frame on their profile.
- **Faction-themed sign-in music** — the login screen ambient loop
  matches the user's chosen faction (Solari fanfare, Umbri whispers…).
- **Weekly "Prophecy" quest** — a much harder 7-day quest with a chunky
  Glimmer reward (500+). Rotates every Monday.

---

*Owner: EWilliamHertz. Contact `main_agent` before implementing to avoid
overlapping work.*
