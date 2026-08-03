# Emergent Master Prompt: GlimmerFall Phase 3 Development

Welcome back to GlimmerFall! We have laid down a rock-solid foundation. The core game engine is stable, multiplayer matchmaking and MMR are active, the backend API is secure, and our e-commerce Stripe integration is live with custom HTML receipt emails and a beautiful post-purchase success modal. 

Your overarching goal for this sprint is to **elevate the player experience** with dynamic visual flair and build out the **meta-progression** systems that will keep players engaged long-term. GlimmerFall should feel like a premium, state-of-the-art digital TCG.

Please prioritize the following feature epics in order:

## Epic 1: Immersive Visual & Audio Upgrades (High Priority)
The game board needs to feel alive. We want our players to feel the impact of their actions.
- **Attack Projectiles & Animations:** Implement visual projectiles or slash animations when entities attack each other or strike the Nexus. 
- **3D Parallax Hover Effects:** Apply a subtle 3D tilt/parallax effect when hovering over cards in the hand or on the battlefield, especially for cards with Epic or Legendary rarity.
- **Dynamic Adaptive Audio:** Enhance the `Arena.jsx` background music logic. The music should dynamically shift to a more intense, dramatic track when a player's Nexus HP drops below 10.

## Epic 2: Meta-Progression & Quest System
Players need short-term and long-term goals outside of just climbing the Ranked ladder.
- **Daily Quest System:** Implement a daily quest system (e.g., "Play 15 Aether spells", "Destroy 5 enemy entities"). Track quest progress in the backend when actions occur in the game engine, and reward players with in-game currency upon completion.
- **Achievement Badges:** Create a badge system for player profiles. Examples: "10-Win Streak", "Flawless Victory" (win with full Nexus HP), or "Early Adopter". Display these badges on the newly created `UserProfile.jsx` page.

## Epic 3: Deck Publishing & Community Hub
Our backend already has the schema for `deck_likes` and `deck_comments`. We need to bring this to life on the frontend.
- **Deck Publishing:** Allow users in the Deck Builder to publish their custom decks to the public Community Hub.
- **Community Hub UI:** Create a dedicated page where players can browse published decks, sort by most upvoted, view the decklist, and click a button to copy/clone the deck to their own account.

## Epic 4: Advanced Admin Logistics
As our physical product sales grow, we need better tools in the Admin Dashboard.
- **CSV Order Exports:** Add a button in the Admin Shop Orders tab to export all `PAID` orders to a CSV formatted specifically for importing into ShipStation or PirateShip (Columns: Order ID, First Name, Last Name, Address, Country, Items, Weight).
- **User Moderation:** Add the ability for Admins to Suspend or Ban malicious users from the User Management table.

### Design Guidelines & Constraints:
- **Aesthetics First:** Continue using the premium glassmorphic UI design language. UI elements should use dark, rich colors, translucent panels, and vibrant accent colors (e.g., `#F2A900` for primary actions, `#00BFFF` for tech/info).
- **Tech Stack:** React, TailwindCSS, Framer Motion, FastAPI, PostgreSQL.
- **Architecture:** Keep backend game logic strictly in `game_engine.py` and API routes in `server.py`. 
- **Quality Assurance:** Do not break the existing multiplayer socket architecture or the stripe webhook synchronization.

You are cleared to begin execution on Epic 1!
