# GlimmerFall Roadmap & Feature Suggestions

Welcome to the **GlimmerFall** development roadmap! This document outlines potential functions, improvements, suggestions, and tips & tricks to elevate the website and game experience as we move from Alpha to full release.

---

## 🚀 Phase 1: Alpha Polish & User Experience

### 1. Deckbuilder Enhancements
*   **Drag & Drop Interface:** Implement drag-and-drop functionality for adding cards to a deck or moving them out. 
*   **Deck Statistics:** Add visual charts (e.g., bar charts or pie charts) in the deckbuilder showing the mana/energy curve, card type distribution (Entities, Rites, Relics, Flash), and faction breakdown.
*   **Save & Share Decks:** Allow users to save their decks to their profiles and generate a "Deck Code" (a short string) to share with others.

DONE

### 2. Interactive Tutorial & Onboarding
*   **Tooltips for Keywords:** On the Cards page, hover over a keyword (e.g., Guard, Evasive) to see a tooltip with its description, preventing the need to constantly flip back to the Rulebook.

DONE


### 3. Faction Mixing Decision (The Alpha Dilemma)
*   **Community Poll Feature:** Since mixing factions is currently undetermined in the Alpha stage, implement a voting/feedback form on the website directly asking testers for their experiences. 

DONE


*   **A/B Testing Playlists:** Host an event where Queue A locks you into a single faction and Queue B allows mixing. Analyze the balance data and player feedback to finalize the rule.

---

## ⚔️ Phase 2: Beta & Gameplay Expansion

### 1. Account Progression & Metagame
*   **User Accounts & Profiles:** Players can create accounts, choose an avatar (based on card art), and track their match history and win rates.
*   **Quests & Rewards:** Daily/Weekly missions (e.g., "Play 20 Rites," "Win 3 games as the Shield faction") to encourage regular play.


DONE


### 2. Enhanced In-Game Immersion
*   **Micro-Animations & VFX:** Add particle effects when a card is drawn, played, or destroyed. Framer Motion is already being used; expand its usage to board interactions.
*   **Sound Design:** Implement ambient background tracks based on the active faction, along with crisp, punchy SFX for attacks and spells.

### 3. Competitive Infrastructure
*   **Ranked Ladder:** Introduce an Elo/MMR-based matchmaking system with visual tiers (Bronze, Silver, Gold, etc.).
*   **Leaderboards:** A dedicated page showing the top 100 players globally or per region.

---

## 🌍 Phase 3: Community & Scaling

### 1. Social Features
*   **Friends List & Direct Challenges:** Allow players to add friends and send direct match invites.
*   **Spectator Mode:** Let players watch their friends' matches live, with a slight delay to prevent stream-sniping.
*   **Match Replays:** Save past matches so players can review their misplays or share epic comebacks.

DONE

### 2. Lore Integration
*   **Lore Compendium:** Expand the Rulebook into a "Library" or "Codex" where players can read the deep lore of GlimmerFall, the origin of the factions, and short stories.

DONE

---

## 💡 Developer Tips & Tricks

### Website Optimization
*   **Image Caching & Lazy Loading:** Card art can get heavy. Ensure images are optimized (WebP format) and use lazy loading (`loading="lazy"`) so the Cards page doesn't lag.
*   **API Response Caching:** The `/rules` and `/cards` endpoints (and others that don't change often) should be cached on the frontend using something like React Query or SWR to reduce unnecessary database hits and speed up page loads.

### UI/UX Best Practices
*   **Keyboard Shortcuts:** Implement hotkeys for power users (e.g., pressing `Esc` to close card modals, or numbers `1-5` to navigate main tabs).

DONE
*   **Accessibility (a11y):** Ensure contrast ratios are high enough, and add `aria-labels` to interactive elements. The game should be playable with a screen reader where possible.
*   **Responsive Design Polish:** Keep iterating on the mobile view. Card games are notoriously hard to fit on phone screens, so testing the deckbuilder and active board on mobile is critical.

### Balance Analytics
*   **Heatmaps & Metrics:** Start collecting telemetry data on which cards are most frequently drafted, which factions have the highest win rates, and whether going first vs. second presents an unfair advantage. Build an internal Admin Dashboard to view these metrics.

DONE