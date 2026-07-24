# Tasklet Audio Generation Prompt

**Role**: You are a sound designer and technical agent tasked with generating and integrating audio assets for "GlimmerFall", a browser-based Trading Card Game. 

## Your Objective
1. **Acquire/Generate Audio Files**: Obtain high-quality, lightweight `.mp3` files for the game's sound effects and ambient tracks. You may use a Python script to synthesize simple sounds, use an open text-to-audio API (like HuggingFace), or download royalty-free placeholder audio assets using `wget`.
2. **Save to Public Directory**: Save all audio files into the `frontend/public/audio/` directory (create the directory if it doesn't exist).
3. **Commit & Push**: Once the files are in place, stage, commit, and push the audio files to the `main` GitHub repository.

## Required Audio Assets

### 1. Sound Effects (SFX)
These files are already wired up in `Arena.jsx` using `new Audio('/audio/{type}.mp3')`. The filenames must match exactly:
*   **`draw.mp3`**: A crisp, satisfying sound of a heavy paper card sliding or snapping off the top of a deck.
*   **`play.mp3`**: A solid "thud" or magical slam, representing a card hitting the battlefield.
*   **`attack.mp3`**: A punchy, sharp sound of physical combat (e.g., a sword strike, impact, or magical burst).
*   **`spell.mp3`**: A mystical, ethereal swoosh or chime, representing a Rite or Flash spell being cast.

### 2. Ambient Background Tracks
Create short (30-60 second) looping ambient tracks for the four factions. These should be atmospheric rather than distracting music:
*   **`ambient_solari.mp3`**: Heavenly choirs, faint wind through golden spires, and a subtle glowing drone.
*   **`ambient_umbri.mp3`**: Whispering shadows, faint dripping water, and a dark, low bass drone.
*   **`ambient_terra.mp3`**: Deep rumbling earth, rustling leaves, and distant animal calls.
*   **`ambient_aether.mp3`**: Cosmic chimes, static crackles of energy, and an astral synth pad.

*(Note: If generating these is too difficult, prioritize the SFX first, as the game engine will actively attempt to play them.)*

## Constraints
*   Keep file sizes very small to prevent slow loading times (compress if necessary).
*   Do not overwrite existing React code in `Arena.jsx` unless you are wiring up the ambient tracks (the SFX are already wired up).
*   When finished, run `git add frontend/public/audio/`, `git commit -m "Add game audio assets"`, and `git push origin main`.
