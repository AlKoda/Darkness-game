# Veilfall

A browser-first pixel survival prototype about the struggle between human settlement builders and evolving monsters.

## Run locally

```bash
npm run dev
```

Choose **Human** or **Monster**, move with WASD/arrow keys, and interact with nearby resources using **E**. Trees must be chopped until they fall, then chopped again before their wood is collected; boulders also take several strikes. Humans can build a protective campfire with **1** after gathering four wood and two stone, or found a permanent settlement with **2** after gathering eight wood and six stone. Stand near its door and press **E** to enter the safety of your home, rest, and heal.

The project has no runtime dependencies. The included Node development server runs at `http://localhost:4173`.

## Engine direction

The prototype deliberately separates deterministic game rules (`src/systems.js`) from browser input/rendering (`src/main.js`). The next multiplayer milestone should move those same rules into an authoritative server tick and exchange compact player inputs/snapshots over WebSockets.

### Roadmap

1. **Vertical slice:** combat, inventory, crafting/build placement, creature AI, death and respawn.
2. **Authoritative multiplayer:** rooms, server ticks, interpolation, persistence, accounts, anti-cheat validation.
3. **Content systems:** human tech tree and settlement buildings; monster essence and branching evolution trees.
4. **World systems:** procedural biomes, resource respawns, day/night events, darkness and light propagation.
5. **Production:** real pixel assets/audio, accessibility, touch controls, load testing, moderation, deployment and analytics.
