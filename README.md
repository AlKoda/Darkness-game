# Veilfall

A browser-first pixel survival prototype about the struggle between human settlement builders and evolving monsters.

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

Choose **Human** or **Monster**, move with WASD/arrow keys, and interact with nearby resources using **E**. Trees must be chopped until they fall, then chopped again before their wood is collected; boulders also take several strikes. Humans can quick-build a protective campfire with **1**, found a permanent settlement with **2**, raise a sweeping-light watchtower with **3**, or place a stone wall with **4**. New structures are placed in the direction you last moved. Stand near a settlement's door and press **E** to enter, rest, and heal.

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
