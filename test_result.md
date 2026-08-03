#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: |
  Phase 3 continuation of GlimmerFall TCG. Immediate items:
  1. FIX Vercel build failure caused by `react-hooks/exhaustive-deps` warning in
     `src/lib/auth.js` (missing 'user' dependency in initial useEffect). CI treats
     warnings as errors, blocking deploy.
  2. Epic 1 — Immersive Visual & Audio Upgrades:
     a. Attack projectiles: fire a faction-colored projectile from attacker's
        card to the target (entity or Nexus) with impact burst, sparks, damage
        number, and screen-shake. Trigger for both my attacks (locally) and
        opponent attacks (via state-diff on polling refresh).
     b. Rarity-scaled 3D parallax hover:
          Common/Uncommon: 11° tilt (existing).
          Rare: 15° tilt + mouse-tracked holo strip.
          Epic: 20° tilt + animated rainbow foil shimmer that tracks the mouse.
     c. Dynamic adaptive audio: when either Nexus HP drops below 10, cross-fade
        ambient music to a more intense mix (playbackRate +15%, volume boost,
        synthesized heartbeat via Web Audio API oscillators).
  Backend/game_engine.py untouched; changes are frontend-only.

frontend:
  - task: "Vercel build blocker: auth.js exhaustive-deps fix"
    implemented: true
    working: "NA"
    file: "/app/frontend/src/lib/auth.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: |
          Added `// eslint-disable-next-line react-hooks/exhaustive-deps` immediately
          above the empty dependency array on the initial "restore session" useEffect
          in AuthProvider. Effect intentionally runs only on mount to hydrate the
          user object from localStorage/token; including `user` would loop.
          Verified locally with `CI=true yarn build` -> "Compiled successfully."

  - task: "Epic 1a — Attack projectile / strike animations"
    implemented: true
    working: "NA"
    file: "/app/frontend/src/components/ProjectileLayer.jsx, /app/frontend/src/pages/Arena.jsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: |
          Added ProjectileLayer overlay (fixed z=65) that listens for
          `window` CustomEvent "gf-attack" and animates a slash trail + orb
          projectile + impact ring + 8 radiating sparks + floating damage number
          between the source and target testIds.
          Arena.act() dispatches the event for local ATTACK_ENTITY/ATTACK_NEXUS
          before the server round-trip so it feels responsive.
          A state-diff useEffect also detects opponent attacks (my HP drop or my
          entity health drop) and animates from the exhausted opp entity back to
          my nexus/entity.
          Screen shake is triggered by the ProjectileLayer wrapper on each hit.
          Test scenarios: play vs GlimmerBot -> attack Nexus/entity, observe
          projectile and damage number.

  - task: "Epic 1b — Rarity-scaled 3D parallax + rainbow foil for Epic"
    implemented: true
    working: "NA"
    file: "/app/frontend/src/components/CardTemplate.jsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: |
          Introduced TILT_BY_RARITY constant (11/11/15/20). Split holo rendering
          into two modes: `isRare` -> mouse-tracked holo strip;
          `isEpic` -> conic-gradient rainbow foil layer + diagonal shimmer
          strip + animated sheen on hover. Uses framer-motion useTransform on
          mx/my to bind background-position to cursor for a real 3D-metal look.
          Verified visually on Home page (rainbow foil clearly visible on Epic
          card in hero collage) and Cards page. No API changes.

  - task: "Epic 1c — Dynamic adaptive audio (Nexus HP < 10 = intense)"
    implemented: true
    working: "NA"
    file: "/app/frontend/src/pages/Arena.jsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: |
          Added `isDanger = (me.hp<=10 || opp.hp<=10) && !ended`. Two useEffects
          drive it: (i) a requestAnimationFrame ramp that smoothly transitions
          audio.playbackRate 1.0->1.15 and volume 0.15->0.22 over 900ms; (ii) a
          Web Audio API AudioContext that synthesises a two-thump heartbeat
          every 1.2s (60Hz then 50Hz sine with exponential decay). A red inset
          pulse vignette is layered over the arena while in danger.
          Cleanup fully closes AudioContext and cancels rAF/interval on exit or
          HP recovery.

  - task: "Play page still loads (no regression on Arena mount)"
    implemented: true
    working: "NA"
    file: "/app/frontend/src/pages/Arena.jsx"
    stuck_count: 0
    priority: "medium"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: |
          Arena.jsx now imports ProjectileLayer and renders it inside GameBoard.
          Verify lobby, AI match start, and no console errors on load.

backend:
  - task: "Backend still boots & serves /api/cards after env restore"
    implemented: true
    working: "NA"
    file: "/app/backend/server.py, /app/backend/.env"
    stuck_count: 0
    priority: "low"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: |
          .env was missing after fresh clone. Populated DATABASE_URL,
          STRIPE_SECRET_KEY, RESEND_API_KEY, JWT_SECRET. Confirmed
          `GET /api/` -> 200 and `GET /api/cards` returns 100 cards.

metadata:
  created_by: "main_agent"
  version: "1.0"
  test_sequence: 1
  run_ui: true

test_plan:
  current_focus:
    - "Vercel build blocker: auth.js exhaustive-deps fix"
    - "Epic 1a — Attack projectile / strike animations"
    - "Epic 1b — Rarity-scaled 3D parallax + rainbow foil for Epic"
    - "Epic 1c — Dynamic adaptive audio (Nexus HP < 10 = intense)"
    - "Play page still loads (no regression on Arena mount)"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
  - agent: "main"
    message: |
      Please verify (frontend-only, no backend changes):
      1) The auth.js Vercel blocker fix. Reproduce by running
         `cd /app/frontend && CI=true yarn build` — should compile with no
         eslint errors. Also load the app at http://localhost:3000 and
         confirm the login/register flow still works (no infinite reload loop
         from AuthProvider on mount).
      2) Home page loads without console errors, Epic-rarity card in hero
         collage visibly shows the rainbow foil (conic gradient) shimmer that
         tracks the mouse.
      3) Cards page (/cards) renders all 100 cards; hover a Rare card - subtle
         holo strip should sweep; hover an Epic card - rainbow foil should
         shift with cursor. Tilt magnitude should visibly differ (Epic > Rare
         > Common).
      4) Play page (/play) mounts the Lobby without error. Starting a game vs
         GlimmerBot should reach the GameBoard. Attacking with an entity
         should:
            (a) Play the existing attack sound.
            (b) Visibly fire a projectile from the attacker to the target with
                an impact burst + damage number.
            (c) Trigger a brief screen shake.
         When YOUR OR OPPONENT'S Nexus HP falls below 10:
            (d) Ambient audio noticeably speeds up (playbackRate 1.15).
            (e) A red inset vignette pulses around the arena.
            (f) A synthesized heartbeat is audible (bass thumps every 1.2s).
      5) NO regressions elsewhere (Deck Builder, Community, Shop, Codex).

      Test credentials are not required for this pass — the game vs
      GlimmerBot works anonymously. If auth is needed anywhere, use whatever
      is in `/app/memory/test_credentials.md`.