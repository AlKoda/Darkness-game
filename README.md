# Veilfall

A browser-first pixel survival prototype about the struggle between human settlement builders and evolving monsters. The supplied sprite sheets are kept as textual data URLs in `src/art-data.js`, which preserves the original pixel art without committing binary image files.

## Play in your browser

The latest version is deployed automatically to GitHub Pages whenever a change is
merged into `main`:

**[Play Veilfall on GitHub Pages](https://alkoda.github.io/Darkness-game/)**

If the link is not live yet, open the repository's **Settings → Pages** screen and
set **Source** to **GitHub Actions**. After that one-time setup, the **Deploy
Veilfall to GitHub Pages** workflow publishes every update. Pull requests also run
the game's automated tests and verify that the browser build succeeds before they
are merged.

## Run locally

```bash
npm run dev
```

Deployment platforms that launch Node applications with `npm start` are also
supported; that command creates and serves the production build on the host's
`PORT`.

Choose **Human** or **Monster**, move with WASD/arrow keys, and interact with nearby resources using **E**. Each harvest completes on the final animation frame; trees must be chopped until they fall, then chopped again before their wood is collected, while boulders also take several strikes. Humans can open grid placement for a protective campfire with **1**, a permanent settlement with **2**, a watchtower with **3**, or a stone wall with **4**. Move the mouse to choose a clear tile, click or press **Enter** to build, press **R** to rotate walls, and press **Esc** to cancel. Trees, rocks, and structures have visible footprints and block movement. Stand near a settlement's door and press **E** to enter, rest, and heal.

The project has no runtime dependencies. The included Node development server runs at `http://localhost:4173`.

## Share feedback

When you find something that needs adjustment, open a GitHub issue and include:

- whether you played as Human or Monster;
- what you expected and what happened instead;
- the browser and device you used; and
- a screenshot or short recording, if the issue is visual.

## Engine direction

The prototype deliberately separates deterministic game rules (`src/systems.js`) from browser input/rendering (`src/main.js`). The next multiplayer milestone should move those same rules into an authoritative server tick and exchange compact player inputs/snapshots over WebSockets.

### Roadmap

1. **Vertical slice:** combat, inventory, crafting/build placement, creature AI, death and respawn.
2. **Authoritative multiplayer:** rooms, server ticks, interpolation, persistence, accounts, anti-cheat validation.
3. **Content systems:** human tech tree and settlement buildings; monster essence and branching evolution trees.
4. **World systems:** procedural biomes, resource respawns, day/night events, darkness and light propagation.
5. **Production:** real pixel assets/audio, accessibility, touch controls, load testing, moderation, deployment and analytics.
