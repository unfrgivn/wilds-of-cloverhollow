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

## Milestone 2: Harness spike **Status:** ✅ Completed (2026-10-04)
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

## Milestone 3: Art pipeline and Fae walk cycle **Status:** ✅ Completed (2026-10-05)
- `docs/art/style-bible.md`, `docs/art/pipeline.md`, and `docs/art/areas.md`.
- `tools/art/` scripts: Gemini generation with reference images, strip
  segmentation, key-out and despill, feet-baseline alignment, atlas packing
  with Pixi spritesheet JSON, contact sheets, and an objective sprite
  validator.
- Fae v2: 4-direction walk (6 frames; right mirrors left) and idle, with
  recipes. Owner approved Fae v2 and the bedroom painting at 70% scale.
- Follow-up (fix commit): `idle_down` hair and three side-walk backpack edges
  have crop cuts; re-extract from the kept sources and make the validator
  catch cuts in every direction.

## Milestone 4: iOS shell **Status:** ✅ Completed (2026-10-05)
- Capacitor 8 iOS project in `ios/`. `just ios-sim` builds and launches the
  game in an iPhone simulator.
- Landscape lock, safe-area-aware layout, and a touch virtual stick plus
  confirm button.
- A simulator screenshot shows the game, and a touch drag moves the player.

## Milestone 5: Fae in her bedroom **Status:** ✅ Completed (2026-10-05)
- Fae's atlas replaces the placeholder circle: walk frames advance with
  distance walked (no foot sliding), idle per facing, right mirrors left.
- The bedroom painting renders from its tiles over its paper colour; the
  camera centres a room smaller than the view.
- Walkable floor and blocker polygons traced against the painting; y-sorted
  occluder cutouts where Fae can walk behind tall furniture.
- `new-game` starts in the bedroom; the harness area stays as a test-only
  fixture for the existing sim and e2e tests.
- Unit, sim, and e2e coverage with real keys; reviewed screenshot baselines;
  `just ios-smoke` passes in the bedroom.

## Milestone 6: Plaza and doors **Status:** ✅ Completed (2026-10-05)
- Painted plaza (per the area scale rule) with y-sorted props and occluders.
- The bedroom door leads to the plaza and back: fade, target spawn, facing,
  and unloading the previous area's textures.
- E2e walks bedroom, plaza, bedroom with real keys; screenshots reviewed.

## Milestone 7: Maddie follows
- Owner-approved Maddie atlas; the sprite validator passes with every check on.
- Core: Maddie follows Fae's recent path (a bounded breadcrumb trail in state)
  about 90 units behind, so she walks around furniture exactly where Fae did
  and never needs her own pathfinding. She stops about 60 units away and sits
  when Fae stops. Through a door she arrives with Fae, placed behind her.
- She y-sorts with Fae and occluders; her walk frames follow her own distance.
- Unit, sim (door round trip with invariants for both), and e2e (real keys:
  she follows within a distance band, crosses doors, sorts behind occluders);
  reviewed baselines; `just ios-smoke` passes.

## Milestone 8: Talk with a choice
- Ink pipeline: `content/story/*.ink` compiled by a dev-only Bun script to
  committed JSON; `just check` fails if the JSON is stale or the story uses
  POW. The runtime ships only the inkjs engine (no compiler).
- Core adapter `src/core/ink.ts`, the only core file allowed a package import
  (`inkjs`): each dialogue action builds a fresh Story, loads `state.ink`,
  acts, and saves it back (0.15 ms per action in Bun). Fresh Ink state is
  seeded from the game seed (the Date-based default is never observed). The
  purity check enforces the import allowlist.
- Interactables in area JSON; the nearest one in front within 60 units gets a
  sticker prompt. Confirm opens its knot without also advancing; while open,
  movement is frozen, up/down choose, confirm reveals then advances, and a
  touch tap on a choice picks it directly (a new input field). Text reveal is
  driven by the core, so replays are exact.
- Sticker-style DOM dialogue box (speaker tag, choices as stickers,
  `aria-live`).
- Content: the bedroom window (investigate now, or school first), the journal
  under Fae's pillow (its line depends on that choice), and the plaza notice
  board (sets up the chaos critter).
- Unit, sim, cross-engine hash with dialogue, e2e (real keys and touch taps),
  reviewed baselines, `just ios-smoke`.

## Milestone 9: Calm-down battle v0
- Art: one chaos-touched critter in chaos and calm states (owner review).
- Core battle state machine (spec 8): Calm meter, Energy, Soothe / Play
  (Maddie) / Snack / Run, timed-press windows measured in ticks, chaos bursts,
  seeded PRNG; zero Energy means a rest and a retry, never a loss of progress.
- Winning turns the critter calm in the plaza and awards a sticker.
- Unit (meter math, timing windows), sim (win, rest, run), cross-engine hash,
  e2e with real keys, reviewed baselines.

## Milestone 10: Journal and save
- The journal is the pause menu (J or the menu button): notes written from Ink
  and a sticker album, in the sticker UI style.
- One save slot: version plus the full game state; loading restores it exactly
  (the state hash matches).
- E2e: play, save, reload the page, continue with an identical hash. iOS: the
  save survives an app relaunch.

## Later (not scheduled)
Audio and music, gamepad polish, device testing and TestFlight, Bubblegum Bay
and Pinecone Pass, Sue and Jordan, and tools (lantern, lasso, flute).
