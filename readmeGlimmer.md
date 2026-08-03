# readmeGlimmer.md — Glimmer Currency Implementation Spec

> **Audience:** Any AI/dev picking up implementation of the "Glimmer" in-game
> currency system for GlimmerFall2. This file is a **complete spec** — read it
> end-to-end before writing a single line. It documents (a) what already exists,
> (b) what's missing, (c) the exact schema/API/UI contracts to build, and
> (d) test scenarios to verify.

---

## 0. TL;DR

Glimmer is a soft in-game currency. Players **earn** it (quests, referrals,
milestones) and **spend** it (shop discounts). It is displayed as a
**shiny rock icon + number**, pinned to the left of the "Dashboard" link in
the top navbar, always visible when logged in. The visual metaphor: a
faceted crystal that pulses softly.

**Two golden rules**
1. Currency is server-authoritative. The client never adds/subtracts Glimmer
   directly; it only reads the balance and calls `POST /api/glimmer/redeem`
   or receives credit responses from other endpoints.
2. Every credit/debit MUST write a row to `glimmer_transactions` (audit
   trail). Balance = sum of transactions (or a materialized column that is
   kept in lock-step; see §2).

---

## 1. What Already Exists (audit — do NOT rebuild)

### 1.1 Quest system (partial)
- **Tables:**
  - `daily_quests(id, quest_date, description, target_value, reward, is_approved)` — admin curates.
  - `user_quests(id, user_id, description, target_value, current_value, reward, is_completed, created_at)` — per-user active copy.
- **Endpoints:**
  - `GET  /api/auth/me/quests` — returns active quests; if today's approved daily quest is not yet on user, inserts it; falls back to random if none.
  - `GET  /api/admin/quests` — list all daily quests.
  - `POST /api/admin/quests/generate` — bulk-generate N days from a hardcoded quest pool.
  - `POST /api/admin/quests/{qid}/approve` — mark daily quest as approved.
  - `DELETE /api/admin/quests/{qid}` — remove daily quest.
- **UI:** `Dashboard.jsx` → PlayerDashboard renders the quest cards with a
  progress bar and reward text ("50 Glimmer", "1 Booster Pack", …).
- **What is BROKEN / MISSING:**
  1. `current_value` is **never incremented anywhere**. No hooks in
     `game_engine.py` to bump progress when a Rite is played, a Flash is
     cast, damage is dealt to Nexus, or a game is won.
  2. `is_completed` is never set.
  3. Even if `is_completed=true`, **no reward is granted**. Reward is a
     free-text string (`"50 Glimmer"`, `"100 Glimmer"`, `"1 Booster Pack"`) —
     nothing parses it.

### 1.2 Referrals (name-only)
- Columns on `users`: `referrals INTEGER` (count of successful referrals),
  `referral_source VARCHAR` (free-form marketing attribution — NOT the same
  as friend-referrals!).
- `RegisterReq` (POST /api/auth/register) **does NOT accept a referrer**.
- The `referrals` column is **never incremented** anywhere in the codebase.
- Admin dashboard reads `referral_source` for a pie chart only.
- **What is MISSING:**
  1. `RegisterReq` should accept `referrer_nickname` (or `referrer_code`).
  2. Register endpoint should validate the referrer exists, is verified, and
     is not the same email.
  3. Reward should be credited **only when the referee verifies their email**
     (defer to `POST /api/auth/verify`) — this prevents throwaway spam
     accounts from farming Glimmer.

### 1.3 Community hub (mostly complete backend, incomplete frontend)
- Deck publishing: `POST /api/decks` (unauth — no ownership binding beyond
  `username` string), `GET /api/community-decks`, `GET /api/decks` (adds
  `likes_count` and `liked_by_me`).
- Deck likes: `POST /api/decks/{id}/like` toggle.
- Deck comments: `GET/POST /api/decks/{id}/comments`.
- Custom card "Forge": `POST /api/custom-cards` + `POST
  /api/custom-cards/{id}/upvote`.
- **Frontend gap:** `Community.jsx` shows Polls + Forge + Discord CTA but
  does **not** render the published community decks browser (no sort by
  upvotes, no clone-to-my-decks button). `DeckBuilder.jsx` does show a list
  but it's the raw admin list.
- Since the user said this already exists — the **BE contract is done**, only
  the discoverability UI is missing (see §7.3).

### 1.4 Shop
- Products: `shop_products(id, name, price, image_url, category, stock,
  is_preorder, ...)`. Live Stripe checkout via `STRIPE_SECRET_KEY`.
- Orders: `shop_orders(id, user_email, customer_name, total_amount,
  address, country, status, ...)` + `shop_order_items(...)`.
- **No discount/coupon/redemption code at all.** No column for "glimmer_used"
  on orders.

---

## 2. Data Model — What to Add

### 2.1 `users` table — add columns
```sql
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS glimmer_balance INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS referral_code VARCHAR(16) UNIQUE;
-- Backfill referral_code (short slug of nickname + user id or nanoid)
UPDATE users
  SET referral_code = LOWER(SUBSTR(REGEXP_REPLACE(nickname,'[^a-zA-Z0-9]','','g'),1,8) || LPAD(id::text,4,'0'))
  WHERE referral_code IS NULL;
```
- `glimmer_balance` = materialized balance for fast reads. Must be
  kept in lock-step with `glimmer_transactions`.
- `referral_code` = the short, sharable code that goes in referral URLs
  (e.g. `https://glimmerfall.tcg/?ref=eww1234`).

### 2.2 New `glimmer_transactions` ledger
```sql
CREATE TABLE IF NOT EXISTS glimmer_transactions (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount       INTEGER NOT NULL,                -- signed. Positive = credit, Negative = debit.
  source       VARCHAR(40) NOT NULL,            -- 'quest' | 'referral' | 'signup_bonus' | 'shop_redemption' | 'admin_grant' | 'refund'
  ref_id       VARCHAR(80),                     -- e.g. quest id, referred user id, shop order id
  memo         VARCHAR(255),
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_glimmer_tx_user ON glimmer_transactions(user_id, created_at DESC);
```
- Invariant: `users.glimmer_balance == SUM(glimmer_transactions.amount) WHERE user_id = u`.
- Use a **helper** in `server.py` for every credit/debit — never write to
  `glimmer_balance` directly:
  ```python
  def grant_glimmer(cur, user_id: int, amount: int, source: str,
                    ref_id: str | None = None, memo: str | None = None) -> int:
      """Atomically credit/debit Glimmer. Returns the new balance."""
      cur.execute(
          "INSERT INTO glimmer_transactions (user_id, amount, source, ref_id, memo) "
          "VALUES (%s, %s, %s, %s, %s)",
          (user_id, amount, source, ref_id, memo),
      )
      cur.execute(
          "UPDATE users SET glimmer_balance = glimmer_balance + %s "
          "WHERE id=%s RETURNING glimmer_balance", (amount, user_id))
      return cur.fetchone()["glimmer_balance"]
  ```
  - For debits (`amount < 0`), verify `users.glimmer_balance + amount >= 0`
    **inside the same transaction** — raise `HTTPException(400, "Insufficient Glimmer")` otherwise. Use `SELECT ... FOR UPDATE`.

### 2.3 `user_quests` — 2 new columns
```sql
ALTER TABLE user_quests
  ADD COLUMN IF NOT EXISTS reward_glimmer INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reward_claimed BOOLEAN NOT NULL DEFAULT FALSE;
```
- Migrate the existing `reward` text → parse `"50 Glimmer"` → set
  `reward_glimmer = 50`. Leave `reward` as-is for display fallback.
- `reward_claimed` prevents double-credit if the client re-completes the same
  quest.

### 2.4 `referrals` audit table (optional but recommended)
```sql
CREATE TABLE IF NOT EXISTS referrals (
  id             SERIAL PRIMARY KEY,
  referrer_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referee_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status         VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending' | 'verified' | 'rewarded'
  reward_amount  INTEGER NOT NULL DEFAULT 100,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  verified_at    TIMESTAMP,
  UNIQUE(referee_id)  -- one referrer per referee, forever
);
```

### 2.5 `shop_orders` — 2 new columns for Glimmer redemption
```sql
ALTER TABLE shop_orders
  ADD COLUMN IF NOT EXISTS glimmer_used INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_cents INTEGER NOT NULL DEFAULT 0;
```

---

## 3. Backend Endpoints to Add

All under `/api`, all authenticated unless noted.

### 3.1 Read balance
`GET  /api/glimmer/balance` → `{ balance: 250, updated_at: "..." }`
Used by the navbar widget on every route change.

### 3.2 Transaction history
`GET  /api/glimmer/transactions?limit=50` → last 50 tx rows (for a modal
that opens when you click the shiny rock).

### 3.3 Claim quest reward
`POST /api/quests/{quest_id}/claim` → 200 `{ balance, credited }`.
Server verifies `is_completed=true AND reward_claimed=false AND
user_id=me`, credits `reward_glimmer`, sets `reward_claimed=true`. Idempotent.

### 3.4 Referral submission (on register)
Modify `RegisterReq`:
```python
class RegisterReq(BaseModel):
    email: str
    password: str
    faction: Optional[str] = None
    referrer_code: Optional[str] = None   # NEW
```
In `POST /api/auth/register`, if `referrer_code` is provided:
- Lookup the referrer by `referral_code`. Must exist and be `is_verified=true`
  (prevents fresh-account daisy-chains).
- Insert `referrals` row (`status='pending'`).
- DO NOT credit yet.

### 3.5 Referral maturation (on verify)
In `POST /api/auth/verify` — when the newly verified user has a pending
`referrals` row as referee:
- Credit the **referrer** 100 Glimmer via `grant_glimmer(..., source='referral', ref_id=referrer_id, memo=f'Referred {referee.nickname}')`.
- Optionally credit the **referee** 50 Glimmer as a signup bonus.
- Update `users.referrals` on the referrer (`+= 1`) — keeps existing UI.
- Set `referrals.status='rewarded'`, `verified_at=NOW()`.
- Fire a **Resend email** to the referrer: "Your friend just joined — you earned 100 Glimmer!"

### 3.6 Redeem Glimmer in shop checkout
Two-phase: quote → apply.
- `POST /api/glimmer/quote { cart_subtotal_cents, glimmer_to_spend }` →
  `{ max_glimmer, discount_cents, final_total_cents }`.
  - **Conversion rate:** `100 Glimmer = $1.00 USD` (1 Glimmer = 1 cent).
  - **Max cap per order:** min(user balance, 30% of cart_subtotal_cents).
  - Server does the math authoritatively. Never trust client math.
- `POST /api/shop/checkout` should accept `glimmer_to_spend` and:
  - Re-run the same quote logic server-side.
  - Debit Glimmer at the moment of `payment_intent.succeeded` webhook (NOT
    at checkout session creation) — this prevents debiting Glimmer for
    abandoned carts.
  - Persist to `shop_orders.glimmer_used` and `shop_orders.discount_cents`.
  - Reduce the Stripe payment amount accordingly.

### 3.7 Admin grant / adjust
`POST /api/admin/glimmer/grant { user_id, amount, memo }` → grants (or
debits with negative amount). Admin only. Source = `admin_grant`.

---

## 4. Game Engine Hooks (quest progress)

Currently `game_engine.py` never touches `user_quests`. Add a light
callback layer so quest progress increments automatically.

### 4.1 Where to hook
The `apply_action` (or equivalent action dispatcher) already handles
`PLAY_CARD`, `CAST_SPELL`, `ATTACK_NEXUS`, `ATTACK_ENTITY`, `END_TURN`,
`DRAW_CARD`. After the action mutates state, emit a **quest event**:

```python
# server.py or a new quests.py helper
def bump_quest_progress(user_nickname: str, event: str, meta: dict):
    """
    event: 'play_rite' | 'play_flash' | 'nexus_damage' | 'entity_kill'
           | 'win_game' | 'play_faction_entity:solari' | ...
    meta:  {'amount': 5, 'faction': 'Solari', ...}
    """
    with DB() as cur:
        cur.execute("SELECT id FROM users WHERE nickname=%s", (user_nickname,))
        u = cur.fetchone()
        if not u: return
        cur.execute(
            "SELECT id, description, target_value, current_value, reward_glimmer "
            "FROM user_quests WHERE user_id=%s AND is_completed=FALSE",
            (u["id"],))
        for q in cur.fetchall():
            if not _quest_matches(q["description"], event, meta):
                continue
            new_val = min(q["current_value"] + meta.get("amount", 1),
                          q["target_value"])
            done = new_val >= q["target_value"]
            cur.execute(
                "UPDATE user_quests SET current_value=%s, is_completed=%s "
                "WHERE id=%s", (new_val, done, q["id"]))
```

### 4.2 Quest-description → event matcher
Provide a **small regex/keyword matcher** so admin-written descriptions map
to events. Suggested vocabulary:
| Description contains…             | Event                     |
|-----------------------------------|---------------------------|
| "Rite" or "Rites"                 | `play_rite`               |
| "Flash spells"                    | `play_flash`              |
| "damage to enemy Nexus"           | `nexus_damage` (amount)   |
| "Solari Entities"                 | `play_faction_entity:solari` |
| "Umbri Entities"                  | `play_faction_entity:umbri`  |
| "Terra Entities"                  | `play_faction_entity:terra`  |
| "Aether Entities"                 | `play_faction_entity:aether` |
| "Win N games"                     | `win_game`                |
| "Destroy N enemy entities"        | `entity_kill`             |
| "Draw N cards"                    | `draw_card`               |

### 4.3 Call sites in game engine
- On `apply_action("PLAY_CARD", ...)`:
  - If card.card_type == "Rite": `bump("play_rite", {"amount": 1})`
  - If card.card_type == "Entity": `bump(f"play_faction_entity:{card.faction.lower()}", {"amount": 1})`
- On `apply_action("CAST_SPELL", ...)` with card.card_type == "Flash": `bump("play_flash", {"amount": 1})`
- On `apply_action("ATTACK_NEXUS", ...)`: `bump("nexus_damage", {"amount": attacker.power})`
- On entity death resolution: `bump("entity_kill", {"amount": 1})` for the attacker's owner
- On match end: `bump("win_game", {"amount": 1})` for the winner

**IMPORTANT:** Do NOT fire quest hooks for AI matches (GlimmerBot) if you
want to prevent farming — gate on `match.player2 != 'GlimmerBot'` or
`match.is_ranked`. Discuss with product before locking this down.

---

## 5. UI — Frontend Contracts

### 5.1 The "shiny rock" widget (Navbar)
- **Location:** `frontend/src/components/Navbar.jsx`, positioned
  **immediately to the left of the "Dashboard" link** (or the profile
  avatar dropdown), only rendered when `user` is truthy.
- **Component name:** `<GlimmerPurse />`
- **Visual spec:**
  ```
  ┌──────────────────────┐
  │  💎  1 250           │
  └──────────────────────┘
  ```
  - Left: a small SVG or emoji of a faceted crystal. Use `#00BFFF`-ish
    (Aether blue) with a subtle golden inner glow (`#F2A900`). It should
    **pulse slowly** (2s cycle) using framer-motion.
  - Right: the balance, formatted with a thin non-breaking space every 3
    digits (`1 250`, `12 300`). Use `font-num` (existing Tailwind class).
  - Height should match nav items (~32px).
  - Hover: expand to show a small caret + tooltip "Glimmer Balance".
  - Click: open a `<GlimmerHistoryModal>` with the last 50 transactions
    (sourced from `GET /api/glimmer/transactions`).
- **Data:** Use SWR or React Query to poll `GET /api/glimmer/balance` every
  60s AND revalidate on `focus`. On any successful quest-claim or shop
  checkout, `mutate()` the SWR key to refresh instantly.
- **Storage of balance in AuthContext:** ALSO cache the balance on
  `useAuth().user.glimmer_balance` so components can render instantly
  without waiting for the fetch. Update the cache on every response.
- **Accessibility:** `aria-label="Glimmer balance: 1250. Click to view history."`

Example implementation sketch:
```jsx
// frontend/src/components/GlimmerPurse.jsx
import React, { useState } from "react";
import useSWR from "swr";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import GlimmerHistoryModal from "./GlimmerHistoryModal";

const fetcher = (url) => api.get(url).then(r => r.data);
const fmt = (n) => String(n ?? 0).replace(/\B(?=(\d{3})+(?!\d))/g, "\u2009");

export default function GlimmerPurse() {
  const { data } = useSWR("/glimmer/balance", fetcher, { refreshInterval: 60_000 });
  const [open, setOpen] = useState(false);
  const balance = data?.balance ?? 0;
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label={`Glimmer balance: ${balance}. Click to view history.`}
        className="flex items-center gap-2 h-8 px-3 rounded-full glass border border-[#00BFFF]/30 hover:border-[#00BFFF]/60 transition-all shadow-[0_0_15px_rgba(0,191,255,0.15)]"
      >
        <motion.span
          animate={{ scale: [1, 1.08, 1], filter: ["drop-shadow(0 0 4px #00BFFF)","drop-shadow(0 0 8px #00BFFF)","drop-shadow(0 0 4px #00BFFF)"] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
          className="text-lg leading-none"
          aria-hidden
        >💎</motion.span>
        <span className="font-num text-sm font-semibold text-[#7FDBFF]">{fmt(balance)}</span>
      </button>
      {open && <GlimmerHistoryModal onClose={() => setOpen(false)} />}
    </>
  );
}
```
> Prefer a hand-drawn **SVG crystal** over the 💎 emoji for a more premium
> feel. Optional stretch: 3D tilted crystal with framer-motion parallax like
> the CardTemplate.

### 5.2 Dashboard — new "Claim Reward" button
- When `quest.is_completed && !quest.reward_claimed`, replace the check
  icon with a golden "Claim +50 💎 Glimmer" button that calls
  `POST /api/quests/{id}/claim`, then updates `quests` and the navbar
  balance (via SWR mutate).
- Toast on success: `Claimed 50 Glimmer!`.

### 5.3 Registration form — referrer code input
- Add a subtle "Referral code (optional)" input under the faction picker
  in `AuthModal.jsx` (register tab).
- Also read `?ref=abc123` from `window.location.search` on modal open and
  pre-fill.
- Pass through `register(email, password, faction, referrerCode)` and
  extend `useAuth().register` to send `referrer_code`.

### 5.4 Shop — Redeem Glimmer step
- In `Shop.jsx` cart dialog, add a new panel above the checkout button:
  ```
  Redeem your Glimmer   (You have 💎 1250)
  [ 500 ] Glimmer → -$5.00 discount   Max: 500 (30% of subtotal)
  ```
  - Slider from 0 to `min(balance, floor(subtotal * 0.30 * 100))`.
  - Live re-quote via `POST /api/glimmer/quote` on debounce (300ms).
  - Show "Final total: $X.XX" and pass `glimmer_to_spend` to Stripe
    checkout session creation.

### 5.5 Dashboard — Referral card
- Show the user's own `referral_code` prominently with a "Copy Link"
  button that copies `https://<origin>/?ref=<code>`.
- Show `referrals` count (already tracked) and total Glimmer earned from
  referrals (sum of `glimmer_transactions WHERE source='referral'`).

---

## 6. Economic Balance — Suggested Numbers

Tune later, but seed with these defaults so admins have sensible clay:

| Source                                | Glimmer                |
|---------------------------------------|------------------------|
| Signup bonus (email verified)         | +50                    |
| Referral matures (referee verifies)   | +100 to referrer, +50 to referee |
| Daily quest completion                | +25 to +100 (per quest)|
| Win a Ranked match                    | +10                    |
| First win of the day                  | +50                    |
| Reach a new Rank tier                 | +200                   |
| Report bug that admin marks "valid"   | +150                   |

**Sinks (spend):**
| Action                                | Cost                   |
|---------------------------------------|------------------------|
| Shop discount                         | Up to 30% of cart, 100 Glimmer = $1 |
| Cosmetic playmat (future)             | 500                    |
| Extra avatar frame (future)           | 250                    |
| Booster pack (future digital)         | 300                    |

**Anti-abuse:**
- No Glimmer for GlimmerBot (AI) matches.
- Referrals require **email verification** to mature (already the plan).
- Referrer must themselves be verified.
- Max 3 referrals credited per calendar day per referrer.

---

## 7. Ordered Implementation Plan (do this in this order)

**Phase A — Foundation (backend, ~1 day)**
1. Migration: add columns/tables from §2, backfill `referral_code`.
2. Add `grant_glimmer(...)` helper and unit-test it (positive/negative,
   insufficient balance rejection).
3. Add `GET /api/glimmer/balance` and `GET /api/glimmer/transactions`.
4. Add `POST /api/admin/glimmer/grant` for manual QA.

**Phase B — Navbar widget (frontend, half day)**
5. Build `<GlimmerPurse>` and wire into `Navbar.jsx`.
6. Extend `useAuth()` user object with `glimmer_balance`.
7. Have admin manually grant yourself 500 Glimmer, verify UI shows it,
   ticks up on new grants.

**Phase C — Quest completion & claiming (backend, ~1 day)**
8. Parse existing `reward` text → `reward_glimmer` column.
9. Add `POST /api/quests/{qid}/claim`.
10. Add quest-progress hooks in `game_engine.py` per §4.
11. Dashboard "Claim" button + toast + SWR mutate.

**Phase D — Referrals (backend + frontend, ~1 day)**
12. Add `referrer_code` to `RegisterReq`, insert `referrals` row on register.
13. Credit on `verify` endpoint. Send Resend email to referrer.
14. Add referral input to `AuthModal.jsx` + `?ref=` URL param support.
15. Add "Your Referral Link" card to Dashboard.

**Phase E — Shop redemption (backend + frontend, ~1-2 days)**
16. `POST /api/glimmer/quote` (server-authoritative math).
17. Modify Stripe checkout session creation to reduce amount by discount
    and store `glimmer_to_spend` in session metadata.
18. On `payment_intent.succeeded` webhook, debit Glimmer atomically.
19. Add redeem-Glimmer slider to `Shop.jsx` cart.

**Phase F — Admin tools (backend + frontend, half day)**
20. Admin can view/edit any user's balance + tx history.
21. Admin can grant/debit with a memo.

---

## 8. Test Scenarios (before shipping each phase)

- **A.** Create user → balance = 0. Admin grants 250 → balance = 250 in
  navbar within 60s (or immediately if SWR mutate is called).
- **B.** Try to grant -300 → 400 Insufficient Glimmer.
- **C.** Claim a quest twice → second call returns 400 already claimed.
- **D.** Referee registers with valid `referrer_code`, does NOT verify →
  referrer still has old balance. Referee verifies → referrer +100.
- **E.** Referee registers with unknown code → 400 or silently drop
  (product call — recommend silent drop, log a warning).
- **F.** Two users use the same code → both credit the referrer
  independently, but count against the 3-per-day cap.
- **G.** Shop cart total $50, user has 800 Glimmer, tries to redeem 800 →
  quote returns `max_glimmer = 1500` (30% of $50 = $15 = 1500 Glimmer) but
  user only has 800, so max applied = 800, discount = $8.00, final = $42.
- **H.** Stripe checkout abandoned → NO Glimmer debited (verify with a
  test webhook that only debits on `payment_intent.succeeded`).
- **I.** Refund order in admin → refund the debited Glimmer via
  `grant_glimmer(source='refund', ...)`.
- **J.** Quest bump: play 10 Rites in an AI match — quest still says 0/10
  (AI matches don't count). Play 10 Rites vs human — completes.

---

## 9. Files You'll Touch

**Backend**
- `backend/server.py` — endpoints (§3), `grant_glimmer` helper, register/verify hooks.
- `backend/game_engine.py` — quest progress hooks (§4).
- `backend/migrate_glimmer.py` — **new** script with all §2 DDL.
- `backend/quest_matcher.py` — **new**, the description→event matcher.

**Frontend**
- `frontend/src/components/GlimmerPurse.jsx` — **new**.
- `frontend/src/components/GlimmerHistoryModal.jsx` — **new**.
- `frontend/src/components/Navbar.jsx` — insert `<GlimmerPurse />`.
- `frontend/src/components/AuthModal.jsx` — referrer code input.
- `frontend/src/lib/auth.js` — extend `register()` signature; cache balance.
- `frontend/src/pages/Dashboard.jsx` — claim button, referral card, tx modal link.
- `frontend/src/pages/Shop.jsx` — redemption slider + quote call.

---

## 10. Non-Goals (for this pass)

- Glimmer trading between users (P2P) — no.
- Glimmer expiry — no.
- Multi-currency (Glimmer + a premium "Voidshards" currency) — separate
  spec if/when premium currency is introduced. Do NOT design Glimmer with
  premium properties (no purchase-to-refill).
- Season-pass Glimmer boosts — post-launch.

---

## 11. Gotchas & Notes for the Implementing Agent

- **Never** modify `users.glimmer_balance` outside `grant_glimmer(...)`.
- Wrap credit + balance update in the same DB transaction (autocommit is
  fine for single-statement writes but for the `SELECT ... FOR UPDATE` /
  UPDATE pair use an explicit `BEGIN/COMMIT`).
- Server responses that debit Glimmer should always return the NEW balance
  so the frontend can mutate its SWR cache without a follow-up GET.
- Do **not** trust `glimmer_to_spend` from the client — always recompute
  the cap server-side.
- Referral URL should use existing `origin` header logic (already in
  `register` for the verify email).
- Preserve idempotency on `POST /api/quests/{id}/claim`: use
  `WHERE reward_claimed=FALSE ... RETURNING id` and only credit if a row was
  returned.

---

*Last updated by main_agent (Phase 3 audit) — GlimmerFall2 codebase snapshot.*
