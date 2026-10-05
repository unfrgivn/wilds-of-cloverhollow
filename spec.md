# Wilds of Cloverhollow: spec

Last updated: 2026-10-04 (web-first restart)

This file is the single source of truth. If code changes behavior, interfaces,
file formats, or decisions, update this file in the same commit. The previous
Godot pixel-art build is archived at tag `archive/godot-pixel`; treat it as
reference material only.

## 1. Product

### 1.1 Audience and tone
- Kids 8 to 12, family friendly. Cozy, safe, playful magic realism. Nothing
  scary and nobody gets hurt.
- Story source: `NOTES.md` (owner's notes) plus this section.

### 1.2 Story spine
- Fae (10) wakes up in her bedroom in Cloverhollow. Chaos starts spreading
  through town.
- She balances school life with stopping it, helped by Maddie (the family cat,
  who follows her), Sue (met in Bubblegum Bay), and Jordan (met in Pinecone
  Pass).
- The culprit is a friend from school under a chaos spell. The hooded chaos
  raccoon is the chaos motif.
- Finale twist: Mom wakes Fae up. It was all a dream.

### 1.3 Creative frame
- The world is Fae's dream, painted in her own art: watercolor washes, thin
  warm-brown ink outlines, die-cut stickers.
- Her journal is the main menu (notes and sticker album now, map later).
- Chaos appears as scribbles and crumpled paper over the painting. Calming it
  restores the paint.
- Battles calm chaos-touched critters down. Nobody is hurt.

### 1.4 Pillars
1. Concept-art fidelity: the game should look like `docs/art/concepts/`.
2. Gentle puzzles and tool gating.
3. Short, readable, non-violent turn-based calm-downs.
4. Agent-buildable: every feature can be driven, inspected, stepped, and
   screenshotted through the harness (section 11).

## 2. Platforms and stack (locked)
- Ship target: iOS (iPhone and iPad, landscape only) via Capacitor 8.
  Development and tests run in desktop Chrome/Chromium.
- Nintendo Switch: deferred. It would be a separate port, so keep content
  portable (Ink, JSON, PNG).
- Language: TypeScript with `strict`. No `any`; avoid `as` casts by modeling
  real shapes and narrowing with type guards.
- Tooling: Vite (dev server and build), Bun (package manager and script
  runner), Node 24 LTS for Node-based tools (`.nvmrc`), `just` for tasks.
- Approved npm dependencies. Anything else needs the owner's approval first,
  then an update to this list:
  - Runtime: `pixi.js` 8, `inkjs` 2, `@capacitor/core` 8, `@capacitor/ios` 8.
  - Dev: `typescript`, `vite`, `vitest`, `@playwright/test`,
    `@capacitor/cli` 8, `@types/bun`.
- External tools (not npm dependencies): ImageMagick (art processing), ffmpeg,
  Xcode 27.

## 3. Architecture (locked)

```
src/core/       Pure simulation. No DOM, Pixi, timers, Date, Math.random, or I/O.
src/render/     PixiJS view. Reads core state; never mutates it.
src/ui/         DOM/CSS overlay: dialogue, prompts, menus, journal, HUD.
src/platform/   Input devices, storage, audio, Capacitor glue.
src/dev/        Dev-only harness hook (section 11). Excluded from production builds.
src/main.ts     Composition root that wires core, render, ui, and platform.
content/        Areas (JSON), story (Ink), fixtures (JSON), tunables (JSON).
public/assets/  Runtime art and audio, loaded by URL.
art/            Generation recipes and selected source images (never loaded at runtime).
tools/          Bun scripts: art pipeline, headless sim runner.
tests/          unit/ (Vitest), sim/ (headless scripted runs), e2e/ (Playwright).
ios/            Capacitor iOS project (from Milestone 4).
```

### 3.1 Simulation contract
- Fixed 60 Hz ticks: `step(world, state, input) -> { state, events }`. `world`
  is static content (areas, tunables) loaded by the shell and passed in;
  `input` is one tick's `ActionFrame`.
- `state` is plain JSON-serializable data. The seeded PRNG state lives inside
  `state`.
- Determinism: the same world, initial state, and action frames produce the
  same state hash in Chrome (V8) and in Bun (JavaScriptCore, the engine iOS
  uses).
- Canonical object keys in the state hash use plain JavaScript code-unit
  ordering, never locale-sensitive comparison.
- Core math uses only `+ - * /`, `Math.sqrt`, `Math.abs`, `min`, `max`,
  `floor`, `ceil`, `round`, `trunc`, `sign`, and `Math.imul`. Never
  `Math.sin`, `cos`, `tan`, `atan2`, `pow`, `**`, `exp`, `log`, or `hypot`:
  their results can differ between JavaScript engines.
- Real time drives ticks through an accumulator in `src/main.ts`, at most 5
  ticks per animation frame (extra time is dropped). Rendering may
  interpolate between ticks for presentation only.
- Visual-only animation (walk frames, bobbing, text reveal, tweens) derives
  from state and tick and never feeds back into the core.

### 3.2 Input
- Devices produce one `ActionFrame` per tick: a `move` vector (x and y in
  -1..1) plus booleans `confirm`, `cancel`, and `menu`. Button edges (pressed
  this tick) are derived in the core from the previous frame.
- Taps are never lost: a key pressed since the previous tick counts as held for
  that tick, even if it was already released.
- Keyboard: arrows or WASD move; Z, Space, or Enter confirm; X or Escape
  cancel; J opens the journal (`menu`).
- Gamepad (standard mapping) and touch (virtual stick plus buttons, section
  3.2.1) map to the same frame. Gamepad support is not built yet.

### 3.2.1 iOS shell decisions (Milestone 4)
- Capacitor is 8.5.2 with the Swift Package Manager iOS template. The
  placeholder bundle ID is `com.unfrgivn.cloverhollow`; it may change before
  TestFlight. The display name is Cloverhollow and the web directory defaults
  to `dist`, overridable with `CLOVERHOLLOW_WEB_DIR`.
- The iOS deployment target remains the Capacitor template default, iOS 15.0.
  The shell is landscape-only on iPhone and iPad, uses full screen, hides the
  status bar, disables WebView scrolling and zoom, and uses `#f8edcf` as its
  background.
- Touch controls are a temporary DOM sticker-style overlay. A floating stick
  uses a 56 CSS-pixel radius and 12% dead zone; confirm, cancel, and menu are
  cream outlined buttons with 20-pixel safe-area margins. Controls are shown
  natively or for coarse pointers, with `?touch=1` and `?touch=0` overrides.
- `just ios-sync` syncs the harness build, while `just ios-sim` resolves the
  simulator by name (default `iPhone 17`) and uses a gitignored
  `.derived-data` directory. Release web syncing is deferred until the
  TestFlight milestone. MobileBuildMCP is configured for simulator and UI
  automation workflows with telemetry off.
- Landscape safe areas include the left and right environment insets and the
  bottom inset. The resting stick uses the left inset, while the menu is a
  direct child of the root overlay and uses top/right insets, so it cannot
  overlap the action buttons. Chromium and desktop WebKit are both Playwright
  projects; WebKit has a dedicated 874x402 layout assertion.
- Harness and development builds emit the `[cloverhollow] state` JSON line
  with tick, area, x, y, and facing fields
  on initial state, area/facing changes, and position changes no more than
  four times per second. Capacitor's Debug console forwards these lines to
  native stdout. Production builds contain neither the logger nor its marker.
- `just ios-smoke` launches with `--console-pty`, resolves AXe from `AXE_PATH`,
  PATH, or the bundled MobileBuildMCP npx cache, reads the simulator frame,
  drags the stick, and stores the full console transcript plus before/after
  screenshots under `$TMPDIR`. It uses no OCR or fabricated state.

## 4. Presentation (locked)
- Logical view: 720 units tall. Width = 720 x screen aspect, clamped to
  960..1600 (4:3 to 20:9). Letterbox outside that range.
- Canvas backing resolution: devicePixelRatio, capped at 2. The canvas CSS size
  always equals the viewport (Pixi `autoDensity`); an e2e test at
  deviceScaleFactor 3 guards this, because iPhones report a ratio of 3.
- Dev and harness builds draw a `tick N · x,y` readout in the top-left so
  screenshots describe state. Production builds draw no debug text.
- Painted art, not pixel art: linear filtering with mipmaps.
- Source art is authored at 2x logical units (1 unit = 2 source pixels).
- The camera follows the player with a small dead zone, clamps to area bounds,
  and snaps to whole device pixels.
- Depth: the area ground layer is always at the back; props and characters
  y-sort by their foot baseline.
- Texture budget: at most 96 MB of decoded textures per loaded area (UI
  excluded), no single texture over 2048x2048, and the previous area unloads on
  transition.

## 5. Characters and animation (locked)
- Frame-by-frame animation in 4 directions: down, up, left, right. Right may
  mirror left until a dedicated right set exists.
- Walk: 6 frames per direction (minimum 4). Frames advance with distance walked
  so feet do not slide.
- Idle: 1 to 4 frames per direction.
- Fae is about 140 units tall (about 280 source pixels).
- Sprite sheets: one PNG atlas plus JSON frame data per character (Pixi
  spritesheet format). Every frame shares a feet-centered pivot.
- Followers (Maddie) and NPCs follow the same rules. NPCs may ship idle-only.

## 6. World
- Areas are discrete. `content/areas/<id>.json` defines size, ground image(s),
  props, walkable polygon(s), blocker polygons, triggers (doors and edges),
  interactables, and named spawn points. JSON is canonical; Tiled may be used
  for editing, but exported data must match this format.
- Player collider: a circle of radius 20 units at the feet that slides along
  blockers.
- Walk speed: 240 units per second (tunable in `content/tunables.json`).
- Transitions: entering a trigger fades out, loads the target area, places the
  player at the named spawn facing the given direction, and fades in.
- Prototype areas: `bedroom` (from `hero_house_bedroom.png`) and `plaza` (from
  `town_center_plaza.png`).

## 7. Interaction and dialogue
- The nearest interactable in front of the player (within 60 units) shows a
  sticker-style prompt; confirm triggers it.
- Dialogue is Ink (`content/story/*.ink`), compiled with inkjs. Ink variables
  are the canonical story flags; there is no separate flag system.
- The dialogue UI is the DOM overlay in the sticker style: cream paper,
  die-cut border, dark-brown rounded text, speaker name, and choices navigable
  by keyboard, gamepad, and touch.
- Player movement is frozen while dialogue is open.

## 8. Calm-down battles (v0)
- Touching a chaos-touched critter starts a battle. Battles are turn-based,
  short (under 2 minutes), and readable.
- Goal: fill the critter's Calm meter. Chaos bursts drain Fae's Energy. At
  zero Energy, Fae "needs a rest" and returns to the last safe spot with
  nothing lost.
- Prototype actions: Soothe, Play (Maddie), Snack, Run. A timed button press
  during an action adds a bonus; a timed press during a chaos burst softens it.
- Outcomes depend only on state, the seeded PRNG, and inputs.
- Winning turns the critter back to normal and awards a sticker.

## 9. Journal and stickers
- The journal is the pause menu: Notes (current goals, written from Ink) and a
  Sticker album. The map comes later.
- Stickers are collectibles and rewards.

## 10. Save and load
- Save data: version, area id, player position and facing, Ink state JSON,
  inventory, stickers, PRNG state, and tick.
- Prototype: one slot in `localStorage`. iOS persistence is revisited in the
  iOS milestones.

## 11. Harness and agent control (locked)
- The dev hook `window.__cloverhollow` exists in dev builds and in harness
  builds (`vite build --mode harness`). Production builds must not contain it;
  `just build` checks this.
- Hook API v1:
  - `version` is the literal number `1`; `isPaused()` reports the real-time
    loop state. `step()` returns `{ tick, x, y, facing }`.
  - `pause()` and `resume()`: stop or start real-time ticking.
  - `step(ticks)`: pause real-time ticking if it is running, advance exactly
    N ticks with the currently held input (queued `input()` frames first, then
    live devices), then render once. Returns a state summary. Pausing, holding
    real keys, then stepping gives deterministic tests with real key presses.
  - `input(frame, ticks)`: hold an action frame for the next N ticks, paused or
    running.
  - `getState()`: the full JSON state.
  - `hash()`: the deterministic state hash.
  - `reset({ seed, fixture })`: restart from a named fixture in
    `content/fixtures/` (test-only starting setups such as `new-game`).
    The default is `new-game`; unknown names throw an error listing known
    fixtures.
- Deliberately absent: arbitrary flag setting, teleporting, and eval. Fixtures
  are the only shortcut, and they are labeled test-only.
- Screenshots come from the browser (Playwright or Chrome DevTools MCP), so
  they include the DOM UI.
- The iOS shell's native evidence uses the untouched Capacitor SPM template
  for native code and AXe for simulator UI description and touch gestures.
  `just ios-smoke` is the automated native evidence step; it resolves an
  available simulator by name, uses a line-buffered `--console-pty` stream,
  and verifies a real rightward drag changes x by at least 50 units.
- Evidence ladder: core unit tests (Vitest, no mocks), then headless sim
  scripts (`tests/sim`, Bun, thousands of ticks in milliseconds), then
  Playwright e2e with real keyboard input and screenshot comparison. Every
  gameplay feature has at least one e2e test that uses real key presses.
- Visual baselines live beside the e2e specs. Update them only after viewing
  the new image.
- Milestone 2 content uses `content/areas/harness.json`: dimensions, a polygon
  `walkable`, polygon-array `blockers`, and named `spawns` with facing.
  Global `content/tunables.json` contains `walkSpeed` and `playerRadius`.
  Fixtures contain `area`, `spawn`, and optional `seed`.
  Script files are arrays of `{ frame: ActionFrame, ticks: number }` segments.
- MCP (project `opencode.json`): Chrome DevTools MCP on an isolated Chrome at
  1280x720, MobileBuildMCP for the iOS Simulator, and Xcode MCP
  (`xcrun mcpbridge`) when Xcode has the iOS project open.

## 12. Art direction and pipeline
- Style source: `docs/art/concepts/`. Watercolor washes, thin warm-brown ink
  outlines, soft pastels, chibi proportions (head to body about 1:1.5 to 1:2),
  and a cozy sticker UI (cream paper, die-cut borders, dark-brown rounded
  lettering, soft drop shadows).
- Generation: Gemini image API, called from `tools/art/` scripts with concept
  sheets as reference images. Each kept asset has a recipe in `art/recipes/`
  (model, prompt, reference images, date, post-processing steps).
- Post-processing (ImageMagick): background removal, trimming, feet-baseline
  alignment, scaling to the 2x source scale, and atlas packing.
- Gate: the owner approves the style of the first character and the first area
  before bulk generation.
- Style bible: `docs/art/style-bible.md` (Milestone 3).

## 13. Out of scope until the owner adds it
Multiplayer, merch, speedrun, boss rush, New Game Plus, achievements,
analytics, voice acting, day/night, weather, fishing and bug minigames, photo
mode, home customization, and non-English localization. Keep player-facing
text in Ink or JSON so it stays translatable.
