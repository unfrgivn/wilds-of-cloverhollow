# Plan

Milestones run in order unless marked parallel. A milestone is complete only
when its acceptance criteria pass and the gates in `AGENTS.md` are green.
Completed milestones carry `**Status:** ✅ Completed (YYYY-MM-DD)` in the
header line.

## Milestone 1: Web-first restart **Status:** ✅ Completed (2026-10-04)
- Godot build archived at tag `archive/godot-pixel`. `main` cleared except
  `NOTES.md` and `docs/art/concepts/`.
- New `spec.md`, `AGENTS.md`, `README.md`, this plan, and the project
  `opencode.json` MCP config.

## Milestone 2: Harness spike
Goal: prove build, control, inspect, step, and screenshot before any content.
- Vite, TypeScript, and PixiJS app boots in Chrome. A placeholder room (flat
  shapes) has a placeholder player that moves with arrows/WASD and collides
  with a blocker polygon.
- `src/core` implements spec section 3.1: fixed ticks, seeded PRNG in state,
  JSON state, and a stable hash.
- Dev hook API v1 (spec section 11) works paused and running and is absent
  from `just build` output.
- Vitest unit tests cover movement, collision sliding, the PRNG, and hash
  stability.
- Headless sim: the same 600-tick input script yields the same hash in Bun and
  in the browser.
- Playwright e2e: real key presses move the player; a screenshot baseline at
  1280x720.
- `justfile` recipes: `dev`, `check`, `e2e`, `build`, `sim`.
- A GitHub Actions workflow runs check, build, and e2e.

## Milestone 3: Art pipeline and Fae walk cycle (parallel with 2)
- `docs/art/style-bible.md` distilled from the concepts.
- `tools/art/` scripts: Gemini generation with reference images, background
  removal, feet-baseline alignment, and atlas packing with Pixi spritesheet
  JSON.
- Fae: 4-direction walk (6 frames; a mirrored right set is allowed) and idle,
  at the spec section 5 scale, with recipes.
- A contact sheet PNG for owner review. Owner approval is required before
  Milestone 5 bulk art.

## Milestone 4: iOS shell
- Capacitor 8 iOS project in `ios/`. `just ios-sim` builds and launches the
  game in an iPhone simulator.
- Landscape lock, safe-area-aware layout, and a touch virtual stick plus
  confirm button.
- A simulator screenshot shows the game, and a touch drag moves the player.

## Milestone 5: Bedroom and plaza
- Painted ground layers and props for both areas (per the style bible), walk
  and blocker polygons, y-sorting, and one door transition each way with
  spawns.
- Fae's sprite replaces the placeholder. An e2e test walks bedroom, plaza,
  bedroom with real keys; screenshots are reviewed.

## Milestone 6: Maddie follows
- Maddie's sprite set. She follows Fae at a consistent distance, including
  through transitions. Sim and e2e coverage.

## Milestone 7: Talk with a choice
- Interactable prompt and Ink dialogue in the sticker UI, with one choice that
  changes a later line. E2e with real keys.

## Milestone 8: Calm-down battle v0
- One chaos critter in the plaza starts a battle with the spec section 8
  actions. Winning awards a sticker. Deterministic sim tests cover outcomes;
  e2e with real keys.

## Milestone 9: Journal and save
- Journal (notes and sticker album) and one save slot. E2e: save, reload the
  page, and the state is restored.

## Later (not scheduled)
Audio and music, gamepad polish, device testing and TestFlight, Bubblegum Bay
and Pinecone Pass, Sue and Jordan, and tools (lantern, lasso, flute).
