# Wilds of Cloverhollow: spec

Last updated: 2026-10-05 (Milestone 5 implementation)

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
  - Runtime: `pixi.js` 8, `inkjs` 2, `@capacitor/core` 8, `@capacitor/ios` 8,
    `@capacitor/preferences` 8 (the save slot; owner-approved 2026-10-05).
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
  ticks per animation frame (extra time is dropped at the cap; the
  `src/core/timing.ts` `drainTicks` function). While an area load is pending,
  the accumulator is reset and no ticks run. Rendering may
  interpolate between ticks for presentation only.
- Visual-only animation (walk frames, bobbing, text reveal, tweens) derives
  from state and tick and never feeds back into the core.
- `src/core` remains pure. The sole package import exception is `inkjs` in
  `src/core/ink.ts`; Ink is always loaded from a fresh Story per command.

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
- Harness and development builds emit `[cloverhollow]` JSON log lines:
  `state` (tick, area, x, y, facing, moving, and the targeted interactable)
  on the initial state, area, facing, movement, and target changes, and
  position changes at most four times per second; `dialogue` (open, speaker,
  text) on every line change; `dialogue-box` (the box's rect after it paints);
  `layout` (the confirm, cancel, and menu rects, once); and `pointer` (each
  press's position and target). Capacitor's Debug console forwards them to
  native stdout. Production builds contain neither the logger nor its marker.
- `just ios-smoke` launches with `--console-pty`, resolves AXe from `AXE_PATH`,
  PATH, or the bundled MobileBuildMCP npx cache, and reads the simulator frame
  (failing fast if it is portrait). It walks Fae to the window with short stick
  drags and position feedback, approaching from below and never stepping left
  (AXe sometimes releases a leftward drag late), taps confirm with `axe touch`
  down and up, reads the conversation to its close, checks that the dialogue
  box clears the buttons, walks left along the door's row into the plaza, and
  drags right there. Every gesture is checked against the `pointer` log and
  retried once; AXe's transient simulator errors are retried. It stores the
  console transcript and screenshots under `$TMPDIR`, with no OCR or
  fabricated state. If AXe keeps reporting that it cannot determine the
  simulator's rotation, reboot the simulator.

## 4. Presentation (locked)
- Logical view: 720 units tall. Width = 720 x screen aspect, clamped to
  960..1600 (4:3 to 20:9). Letterbox outside that range.
- Canvas backing resolution: devicePixelRatio, capped at 2. The canvas CSS size
  always equals the viewport (Pixi `autoDensity`); an e2e test at
  deviceScaleFactor 3 guards this, because iPhones report a ratio of 3.
- Dev and harness builds draw a `tick N · x,y` readout in the top-left so
  screenshots describe state. Production builds draw no debug text.
- Painted art, not pixel art: linear filtering with mipmaps. Runtime asset URLs
  are document-relative (`assets/...`), which works under Vite sub-paths and
  Capacitor's `capacitor://localhost` scheme.
- Source art is authored at 2x logical units (1 unit = 2 source pixels).
- The camera follows the player with a small dead zone, clamps to area bounds,
  and snaps to whole device pixels.
- Depth: the area ground layer is always at the back; props and characters
  y-sort by their foot baseline.
- Texture budget: at most 96 MB of decoded textures per loaded area (UI
  excluded), no single texture over 2048x2048, and the previous area unloads on
  transition. One `AreaView` (`src/render/area-view.ts`) owns an area's sprites
  and textures; swapping areas destroys them and unloads the textures, and the
  game neither ticks nor renders until the new area has loaded.

## 5. Characters and animation (locked)
- Frame-by-frame animation in 4 directions: down, up, left, right. Right may
  mirror left until a dedicated right set exists.
- Walk: 6 frames per direction (minimum 4). Frames advance with distance walked
  so feet do not slide: the core accumulates each tick's resolved displacement
  in `state.motion.distance` (sliding along a wall counts only the slide), and
  one full cycle spans `walkCycleUnits` (126). Idle shows when a tick's
  displacement is below epsilon.
- Idle: 1 to 4 frames per direction.
- Fae is about 140 units tall (about 280 source pixels).
- Sprite sheets: one PNG atlas plus JSON frame data per character (Pixi
  spritesheet format). Every frame shares a feet-centered pivot.
- Fae's atlas (`public/assets/characters/fae/`): 384x384 source-pixel frames
  (192x192 units), feet baseline at row 375 (anchor `{x: 0.5, y: 375/384}`),
  animations `walk_down`, `walk_up`, `walk_left` (6 frames each) and
  `idle_down`, `idle_up`, `idle_left` (1 frame each). Right mirrors left.
- Maddie's atlas (`public/assets/characters/maddie/`): 256x256 source-pixel
  frames (128x128 units), feet baseline at row 247 (anchor
  `{x: 0.5, y: 247/256}`), the same six animation names. She stands about 50
  units tall and sits about 65; one uniform scale covers every pose.
- `tools/art/validate-sprite.ts` must pass for every character atlas. All of its
  checks are mandatory (no switches); biped-only head checks are enabled by
  `"validator": { "biped": true }` in the character's `art/recipes/` file.
- Followers (Maddie) and NPCs follow the same rules. NPCs may ship idle-only.
- Maddie follows Fae using a capped recent-position trail. The follow tunables
  are `distance` 90, `stop` 60, `trailSpacing` 8, `trailMax` 64,
  `catchUp` 1.15, `radius` 12, `slot` 50, `heel` 52, `settleDelayTicks` 12,
  `sitDelayTicks` 30, and her `walkCycleUnits` 84. She uses hysteresis,
  line-of-sight proximity stopping, her own distance-based animation, and sits
  after the delay.
- Visibility is measured with feet-anchored boxes: Fae is 50x140 units and
  Maddie is 44x60 units. `hiddenFraction` is the overlap area divided by
  Maddie's box area when her feet are north of Fae; beside or in front is zero.
  Spawn and settling placement tries side heel slots at ±52 x and -6 y, then
  +24 y, before the ordinary rear/perpendicular fallbacks. Heel placement must
  be collision-valid, line-of-sight clear, and have zero hidden fraction.
  When Fae is standing still and Maddie has been stopped for `settleDelayTicks`
  (12) while more than 25% hidden, she walks to the first valid visible heel
  slot. `stillTicks` keeps counting during that short walk, so she sits soon
  after arriving. She may stay partly hidden while both are walking.

## 6. World
- Areas are discrete. `content/areas/<id>.json` is canonical (Tiled may be used
  for editing if its export matches): `id`, `width` and `height` in units, the
  `walkable` floor polygon, `blockers` (furniture footprints on the floor
  plane), `occluders` (`{ id, polygon, baseline }`), named `spawns`
  (`{ x, y, facing }`), and optional `ground` (the folder of its painting).
  Doors arrive in Milestone 6 and interactables in Milestone 8.
- Player collider: a circle of radius 20 units at the feet that slides along
  blockers.
- `content/tunables.json`: `walkSpeed` (240 units per second), `playerRadius`
  (20), and `walkCycleUnits` (126).
- Transitions: entering a trigger fades out, loads the target area, places the
  player at the named spawn facing the given direction, and fades in.
- Area triggers use `{ id, polygon, target: { area, spawn } }`. A trigger fires
  only when the player centre crosses from outside to inside. During the
  `doorFadeTicks` (18 ticks) fade-out and fade-in phases, input is ignored and
  motion is idle. The core state stores `transition: null` or
  `{ target, phase: "out" | "in", elapsed }`; the area and spawn switch at the
  boundary between phases.
- Content validation requires trigger targets and spawns to exist, trigger
  polygons to be reachable, and every spawn to be at least twice the player
  radius outside every trigger. Door spawns face away from the doorway into
  their destination area. The plaza fixture starts near its fountain.
- Every area spawn must have a valid Maddie follower slot behind Fae, or on one
  of the two perpendicular sides, with Maddie's radius clearance. At a door
  switch the trail resets to `[slot, spawn]` and both characters are frozen.
- Prototype areas: `bedroom` (from `hero_house_bedroom.png`), `kitchen`
  (the downstairs family room), `plaza` (from `town_center_plaza.png`), and
  `park` (Meadow Park, from `meadow_park_environment.png`). The house is wired
  bedroom door to the kitchen's stairs, the kitchen's front door to the plaza,
  and the plaza's house door back to the kitchen; the plaza's lower-right
  cobbled path leads to the park, and the park's exit path back.
  The placeholder `harness` area stays for deterministic tests (fixture
  `harness`). Areas have a display `name` (the title's Continue line).
- People: an area's `npcs` are `{ id, point, facing, knot, prompt }` (Mom and
  Oliver in the kitchen). Each is drawn from the atlas named for its id in
  `content/characters.json` (`{ atlas, idleTicks }`, where `idleTicks` are the
  ticks per `idle_down` frame: Mom holds her smile 180 ticks, then blinks for
  8), y-sorted with everyone else, and targeted like an interactable. While
  Fae talks to one (the dialogue's knot is theirs), they face her along the
  larger axis of the gap between them (`npcFacing`); otherwise they face as
  authored. Without a frame for that facing they show their front. Their
  footprint is an authored blocker.
- Area paintings: opaque WebP tiles (each at most 2048x2048) at 2 source px
  per unit, listed in `public/assets/areas/<id>/ground.json` (tile offsets in
  source px and the painting's `paper` margin colour). The paper colour fills
  the logical viewport behind the painting; the page colour `#f8edcf` shows
  only in letterbox bars outside it.
- Areas may define `interactables` with `{ id, knot, point, prompt }`. Each
  point must be reachable within the interaction range.
- Occluders: lossless cutouts of tall furniture, generated from the painting
  by `tools/art/area-occluders.ts` into the area's asset folder
  (`occluders.json` lists their unit offsets). An occluder draws over Fae while
  her feet are above (north of) its baseline. Workflow:
  `docs/art/area-authoring.md`.
- Hiding check (`src/content/area-checks.ts`, run by `just check`): from every
  spawn, no position reachable on a 5-unit grid may have 75% or more of Fae's
  body box (50x140 units above her feet) covered by occluders.
- Area scale rule: a standard door is about 1.4x Fae's height (about 200
  units) and furniture is proportional. Paintings are resampled uniformly to
  meet it, never stretched. The bedroom is 1050x700 units (the whole room fits
  on one phone screen); the plaza is 1750x1100 units.

## 7. Interaction and dialogue
- Targeting: the core targets the nearest interactable within
  `interact.range` (60 units) whose direction from Fae has a dot product of at
  least 0.34 with her facing. The shell shows the Talk prompt sticker (the
  interactable's `prompt` label in capitals) over that point. Nothing is
  targeted during a door transition or while dialogue is open.
- A confirm press (down this tick, up the previous tick) on a target starts
  its Ink knot.
- Dialogue is Ink (`content/story/*.ink`), compiled to committed JSON by
  `tools/ink/compile.ts`. inkjs runs inside the core through `src/core/ink.ts`:
  each command (start a knot, next line, choose) loads the saved Ink state,
  runs once, and saves it again; `storySeed` comes from the game seed. Ink
  variables are the canonical story flags; there is no separate flag system.
  Lines name their speaker with a `# speaker: Name` tag.
- The Ink adapter skips blank lines (a conditional line whose condition is
  false), and looks past blank lines after a line, so choices that follow
  them come with that line rather than as an empty step. The story's external
  `calmed(id)` is answered from the core's critter states for every command,
  not only a knot's first line.
- Dialogue state machine (core):

  ```
  typing ──confirm──▶ shown (the whole line at once)
  typing ──ticks────▶ shown (interact.revealPerTick characters per tick)
  shown, choices    ──up/down──▶ move the selection (wraps)
  shown, choices    ──confirm / touch choose──▶ Ink choose ▶ next line
  shown, no choices ──confirm──▶ Ink next ▶ next line, or closed when ended
  ```

  While a line is typing, directions and choice taps are ignored. While
  dialogue is open Fae doesn't move, doors don't fire, cancel and menu are
  ignored (v0), and Maddie keeps settling until she sits. The press that
  closes a dialogue cannot reopen it.
- Shell contract: the root element has `data-dialogue="open"` while a dialogue
  is open (CSS hides the movement stick) and loses it on close. Choices appear
  once the line has finished typing; the advance arrow shows only on a fully
  shown line without choices. A tap on a choice sticker reaches the core as
  `choose: index` in that tick's action frame.
- Ink choices are once-only by default, so every knot must still say
  something sensible on a revisit (the window's `again` stitch remembers the
  plan).
- The dialogue UI is the DOM overlay in the sticker style: cream paper,
  die-cut border, dark-brown rounded text, speaker name, and choices navigable
  by keyboard, gamepad, and touch.

### 7.1 Sticker UI layout
- The dialogue sticker is anchored inside the bottom safe area, at most 900 CSS
  pixels wide and about three lines tall. Body text is at least 18 CSS pixels and
  is limited to roughly 45 characters per line.
- Dialogue leaves the confirm, cancel, and menu touch buttons clear at 874x402,
  1180x820, and 1280x720. The virtual stick is hidden while dialogue is open.
- Choice stickers have at least 44 CSS pixel touch targets and body text has at
  least 7:1 contrast against the paper.
- Nunito's Latin variable font is shipped under OFL in
  `src/assets/fonts/nunito`. It was
  chosen for its friendly rounded forms and strong small-size legibility.
- UI safe-area insets are centralized as `--safe-top`, `--safe-right`,
  `--safe-bottom`, and `--safe-left`, sourced from the platform environment.
  Dialogue, choices, prompts, and touch controls all use these variables. A
  dialogue-open root attribute hides the virtual stick while preserving the
  confirm, cancel, and menu buttons.
- When touch controls are shown, the root has `data-touch="on"`, and CSS sets
  `--touch-reserve-right` to the confirm and cancel buttons' width plus their
  margin, the right inset, and 12 px. The dialogue box and choices end at that
  reserve, so they never cover the buttons. It is pure CSS (no measuring in
  JavaScript), so it follows the insets as iOS applies them; `just ios-smoke`
  asserts it on the simulator.
- Speaker tags are cream stickers with dark ink lettering, an ink outline,
  light die-cut rim, and a soft shadow. Dialogue panels and TALK prompts use a
  low-opacity inset dashed stitch border. Labels use Nunito 800, choices use
  600, and body copy uses 400 for readable small-size text.

### 7.2 Title screen layout
- The title screen (`src/ui/title.ts`) is the top layer (`--z-title`) over the
  area painting: the "Wilds of Cloverhollow" wordmark on a tilted cream
  sticker plate (Nunito 900, a clover sprig in the corner), with choice-style
  option stickers centred below it, at least 44 px tall.
- Modes: `fresh` (no save: New game only), `continue` (a save exists:
  Continue, with a detail line saying where Fae is and how many stickers she
  has, then New game), and `confirm` (choosing New game over a save asks
  "Start a new game? Your saved game will be replaced." with "Yes, start over"
  and "No, go back", No selected by default, on a modal card over a soft dim).
- `data-title="open"` on the root hides the touch controls; the option and
  confirm stickers take taps directly, and keys move the selection.

### 7.3 Boot and the title flow
- A real boot builds the game state (the restored save, or a new game) and
  opens on the title over that area's painting, with the game frozen: no core
  ticks run while the title is up, so Continue resumes the save exactly (the
  state hash matches). Fixture resets (the harness) skip the title.
- The flow is a pure function in `src/shell/title-flow.ts` (mode, selection,
  input edges or a tap) returning the next mode, selection, and action.
  Up/down move between the options and left/right between the confirm
  buttons; confirm picks; cancel backs out of the question. Defaults:
  Continue with a save, New game without; "No, go back" in the question,
  which returns to Continue.
- Continue starts ticking the restored state as it is. New game (with no
  save, or "Yes, start over") replaces the state with a new game and deletes
  the old save. A button held when the title closes stays hidden from the
  game until it is released, so the press that starts the game can't also
  act in it. The title reads its own input edges and never writes to the
  game state.
- The Continue detail is the area's `name` (area JSON) and the sticker count
  ("0 stickers", "1 sticker", "2 stickers").
- Dev builds log `[cloverhollow] title {mode, options}` (the visible buttons'
  rects, CSS px) when the mode changes; `just ios-smoke` taps New game from
  them on a fresh install and Continue after the relaunch.

## 8. Calm-down battles (v0)
- Critters: the Fizzy Frog (the plaza fountain; calm, the Fountain Frog) and
  the Zoomie Pup (the park pond; calm, the Pond Pup). They share the battle
  numbers for now; each has its own lines, atlas, sticker, and calm knot.
- Content: `content/critters/*.json` (validated by the loader) supplies every
  battle number and line: the touch radius, calm and energy maxima, snacks,
  command values, aim windows, the burst, the sticker, and the calm knot and
  prompt. Shared command labels and the Snack `×N` template live in
  `content/battle.json`. State adds `critters` (chaos or calm), `stickers`,
  `safeSpot`, and a nullable `battle`.
- Start: crossing into a chaos critter's touch circle (outside on the previous
  tick, inside now; exactly on the radius counts as inside) starts a battle and
  records `battle.entry`, Fae's position on the tick before. A calm critter
  never battles; it is a Talk target at its point with its `calmKnot`.
- Flow (messages type like dialogue: a confirm press shows the whole line, the
  next press advances):

  ```
  intro -> command --Soothe/Play--> aim (on the critter) -> result
                   --Snack--------> result
                   --Run----------> run -> ends at entry, facing away
  result -> soothed -> reward -> ends: critter calm, sticker added once
            (when calm reached calmMax)
         -> burst -> aim (on Fae) -> burstResult -> command
            (or rest when energy reaches 0)
  rest -> door-style fade to safeSpot; the critter stays chaos; nothing lost
  ```

- Commands: up/down edges skip disabled commands; confirm or a touch `choose`
  picks. The chosen command id is stored in the battle. Play rests for its
  content turns; Snack shows its count and is disabled at zero.
- Aim: the first confirm edge is graded by its distance in ticks from the
  target (great window, then good); no press by the end is a miss. Soothe and
  Play add their calm plus the grade bonus, clamped to `calmMax`. In a burst a
  seeded PRNG draw picks base damage 1 or 2 (`bigChance`); great, good, and
  miss deal 0, base minus 1, and base.
- While a battle runs Fae is frozen, doors don't fire, cancel and menu are
  ignored (v0), and Maddie keeps settling. `safeSpot` is set at new game and
  on every area arrival.
- Ink: the adapter binds a pure external `calmed(id)`, answered from facts the
  core passes in. Once the frog is calm the fountain has a new line, and the
  frog has his own talk (a first visit, then a revisit line).
- Overworld: each critter is drawn at its point, y-sorted with the characters
  and occluders, its figure `overworldHeight` units tall: chaos with its aura
  pulsing and turning behind it, calm without.
- Critters are generic entries in `content/critters/<id>.json`. Each entry owns
  its atlas, battle content, sticker, and measured `auraCentre` and
  `bodyCentre` frame-pixel centroids. Runtime atlases use `<id>-sheet`, aura
  placement uses those centroids, and render info names the active entry
  `battle.critter: { id, frame }`.
- Battle scene (render only), from one pure CSS-px layout
  (`src/render/battle-layout.ts`) at the overworld scale: the frog's figure is
  `battleHeight` units tall with its body centre at (0.5 W, 0.42 H); Fae, seen
  from behind, stands with her baseline at (0.22 W, 0.57 H) and Maddie sits
  beside her. This clears the HUD, command menu, message box, and touch
  buttons on phones and desktops. The aura turns about its own centroid on the
  frog's body. The timing ring is centred on the frog's (in a burst, Fae's)
  body centre with a radius of 0.55 times the figure height.
- Backdrop: the area painting itself, scaled so its painted interior (8% in
  from each side, past the watercolour's paper margins) covers the canvas plus
  a 32 px margin, centred on the critter and clamped, softly blurred, with a
  light cream wash. The overworld characters hide during the battle.
- Shell: `data-battle="open"` is on the root while a battle runs. Battle
  messages use the dialogue box with no speaker and hide when empty. Dev
  builds log `[cloverhollow] battle {phase, message}` and the command buttons'
  rects. `renderInfo().battle` reports, in CSS px, the layout, the drawn
  backdrop rect, the ring, the battle's critter (`{ id, frame }`), the aura
  alpha, and whether the
  overworld is visible; `renderInfo().critters` lists each overworld critter's
  frame.

### 8.1 Battle UI layout
- Battle UI is the sticker DOM layer (`src/ui/battle.ts`): a HUD, a command
  menu, a timing ring with its grade sticker, and a reward card. The game
  passes a full view to each `render` every frame; identical views change no
  DOM nodes. Battle messages use the dialogue box with no speaker.
- One stacking scale (`--z-*` in sticker.css), bottom to top: HUD, dialogue,
  commands, choices, prompt, ring and grade, reward.
- HUD: ENERGY (one leaf per point, spent leaves outlined) at the top left and
  the critter's CALM meter (its name in capitals) at the top right, left of
  the menu button, inside the safe area. It hides during the reward.
- Commands: a 2x2 grid of sticker buttons on phones (one column from 1000 px
  wide), right-aligned above confirm and cancel, clear of the HUD, the
  dialogue box, and the touch buttons. The selected command is lifted and
  green. Disabled commands are dashed and grey in explicit colours (never
  opacity), carry a detail line such as "resting", and never emit a choice.
- Timing ring: an SVG centred exactly on the CSS point the game passes (the
  critter or Fae on screen). The moving ring's radius is
  `radius * (1 - progress)` and the dashed target's is `radius * (1 - target)`.
  The grade sticker (GREAT! green, GOOD! teal, MISS cream) sits centred 6 px
  above the target circle.
- Reward card: a centred die-cut card with the title, one atlas frame cropped
  by CSS to 150 px wide, and the name. Stacked drop-shadows give the image a
  white rim and an ink outline that follow the critter's silhouette. Asset
  URLs are document-relative so they work on iOS.
- `data-battle="open"` on the root hides the movement stick; confirm and cancel
  stay. Every battle text pair measures at least 4.5:1 contrast in the gallery
  tests.
- The Pixi battle scene dims the loaded area painting and presents the critter,
  Fae, Maddie, and aura in a fixed logical composition. It is render-only. The
  shell logs `[cloverhollow] battle` with phase and message changes, and
  `renderInfo()` exposes the phase, timing-ring request, and critter frame.

## 9. Journal and stickers
- The journal is the pause menu: Notes (current goals, written from Ink) and a
  Sticker album. The map comes later.
- Stickers are collectibles and rewards.
- Core: `journalOpen` in state. A menu press (J or the journal button) opens
  it when no dialogue, battle, or door transition is running; a menu or cancel
  press (or the book's close button, which sends cancel) closes it. While it's
  open Fae is frozen, doors, battles, and interactions don't fire, and Maddie
  keeps settling.
- Notes: the `journal` Ink knot lists every note that applies, newest first
  (the calm pup and his clue toward the school; while only the frog is calm,
  the purple fizz leading to the park; the calm frog; the raccoon from the
  notice board; then the morning plan).
  `journalNotes(world, state)` runs it on a copy of the Ink state and keeps no
  result, so reading the journal never changes the story.
- Album: `content/stickers.json` (validated) holds the slot count and the
  catalogue (id, name, the critter whose atlas holds the art, and the frame).
  A sticker is owned when `state.stickers` has its id. The shell sets
  `data-journal="open"` while the book is open.

### 9.1 Journal layout
- The journal (`src/ui/journal.ts`) is a modal open book inside the safe area,
  above every other layer (`--z-journal`). The left page is NOTES: ruled notes
  in the order the game passes (newest first), an empty line ("Nothing yet.
  Look around!") when there are none, and scrolling only when they overflow.
  The right page is the STICKERS album: a 4-column grid where owned stickers
  show their atlas frame with a die-cut rim and their name, and unowned slots
  are dashed `?` outlines with no name.
- A cream JOURNAL label sits on the top edge and a close sticker (at least
  44 px) in the top-right corner; the close button is how touch players leave.
- `data-journal="open"` hides all touch controls while the book is open.
- The touch menu button is the JOURNAL sticker from the concept sheet: an open
  book with a teal quill (inline SVG, aria-label "journal").
- Shared pieces (`src/ui/atlas.ts`, `.die-cut` in sticker.css): atlas frames
  are cropped with percentage backgrounds, exact at any box size, and the
  die-cut rim is stacked hard drop-shadows that follow the image's silhouette.
  The reward card uses both.

## 10. Save and load
- One slot, key `cloverhollow-save`, stored with `@capacitor/preferences`:
  UserDefaults on iOS (which iOS doesn't clear the way it can clear web
  storage) and localStorage in the browser.
- Format: `{ version: 1, state }`, the whole core state, including the
  serialized Ink state (story variables and choices), stickers, critters, the
  PRNG, and the tick. Loading restores it exactly: the state hash matches, and
  `stableHash` skips undefined values (as JSON does) so a state and its saved
  copy hash the same.
- `parseSave(json, template)` accepts only a state with the template's exact
  shape (a fresh game state: every key, the same primitive types, all the way
  down; null slots may hold null or an object). Any other version or shape
  starts a new game instead of crashing later. A change to the state's shape
  bumps the version. Content growing is not a shape change: a critter added
  since the save was made starts in chaos when it loads (`parseSave` lays the
  saved critters over the template's).
- Autosave (the shell, never blocking a frame) when Fae arrives in an area,
  a battle ends, a dialogue closes, or the journal closes. The trigger is a
  pure function of the previous and next state (`autosaveNeeded`). Fixture
  resets don't save.
- Boot: a valid save resumes the game; otherwise a new game starts.

## 11. Harness and agent control (locked)
- The dev hook `window.__cloverhollow` exists in dev builds and in harness
  builds (`vite build --mode harness`). Production builds must not contain it;
  `just build` checks this.
- Hook API v1:
  - `version` is the literal number `1`; `isPaused()` reports the real-time
    loop state. `step()` returns `{ tick, x, y, facing }`.
  - `pause()` and `resume()`: stop or start real-time ticking.
  - `step(ticks)` returns a Promise. It pauses real-time ticking if it is
    running, advances exactly N ticks with the currently held input (queued
    `input()` frames first, then live devices), awaits area loads between ticks,
    then renders once. Pausing, holding real keys, then stepping gives
    deterministic tests with real key presses.
  - `input(frame, ticks)`: hold an action frame for the next N ticks, paused or
    running.
  - `getState()`: the full JSON state.
    It includes the serialized `ink` state and nullable `dialogue` state.
  - `hash()`: the deterministic state hash.
  - `reset({ seed, fixture })`: restart from a named fixture in
    `content/fixtures/` (test-only starting setups such as `new-game`), leaving
    the game paused. Returns a Promise that resolves once the fixture's area
    has loaded. The default is `new-game`; unknown names throw an error listing
    known fixtures.
  - `boot.title()`: the title's mode (`fresh`, `continue`, `confirm`), or
    null once the game has started.
  - `save`: `clear()` deletes the slot; `last()` is the tick and hash of the
    latest completed save write; `loaded()` is the tick and hash of the save
    restored at boot, or null for a new game.
  - `renderInfo()`: read-only render facts for tests: the loaded `area`, the
    fade alpha, `cachedAreaTextures` (area texture URLs still in Pixi's Assets
    cache), Maddie's `hidden` fraction, the depth layer's draw order
    (`{ label, zIndex }[]`, with `fae`, `maddie`, and `occluder:<id>`), and both
    characters' current animation and frame, plus prompt and dialogue summaries.
    `npcs` lists each person in the area as `{ id, frame, facing }`.
- While dialogue is open, HTML carries `data-dialogue="open"`; movement, doors,
  cancel, and menu are ignored. Confirm reveals the current line, advances it,
  or selects the highlighted choice. Up/down edges wrap the selection.
- Deliberately absent: arbitrary flag setting, teleporting, and eval. Fixtures
  are the only shortcut, and they are labeled test-only.
- Screenshots come from the browser (Playwright or Chrome DevTools MCP), so
  they include the DOM UI.
- The iOS shell's native evidence uses the untouched Capacitor SPM template
  for native code and AXe for simulator UI description and touch gestures.
  `just ios-smoke` is the automated native evidence step; it resolves an
  available simulator by name, uses a line-buffered `--console-pty` stream,
  and verifies a native conversation, a door, and a real rightward drag that
  changes x by at least 50 units.
- Evidence ladder: core unit tests (Vitest, no mocks), then headless sim
  scripts (`tests/sim`, Bun, thousands of ticks in milliseconds), then
  Playwright e2e with real keyboard input and screenshot comparison. Every
  gameplay feature has at least one e2e test that uses real key presses.
- Visual baselines live beside the e2e specs. Update them only after viewing
  the new image.
- Fixtures (`content/fixtures/<name>.json`) contain `area`, `spawn`, and an
  optional `seed`. Sim scripts live in `tests/sim/scripts/<fixture>/` and are
  arrays of `{ frame: ActionFrame, ticks: number }` segments; `bun run sim`
  starts each from its folder's fixture and checks collision every tick.
- The Playwright suite serves the harness build from the `/cloverhollow/`
  sub-path, so any root-relative asset URL fails in tests as it would on iOS.
- MCP (project `opencode.json`): Chrome DevTools MCP on an isolated Chrome at
  1280x720, MobileBuildMCP for the iOS Simulator, and Xcode MCP
  (`xcrun mcpbridge`) when Xcode has the iOS project open.

## 12. Art direction and pipeline
- Style source: `docs/art/concepts/`. Watercolor washes, thin warm-brown ink
  outlines, soft pastels, chibi proportions (head to body about 1:1.5 to 1:2),
  and a cozy sticker UI (cream paper, die-cut borders, dark-brown rounded
  lettering, soft drop shadows).
- Generation: Gemini image API (`gemini-3-pro-image` for finals), called from
  `tools/art/gemini-image.ts` with concept sheets as reference images. Each
  kept asset has a recipe in `art/recipes/` (model, prompt, reference images,
  date, post-processing steps). Selected raw outputs live in `art/source/`;
  scratch frames (`art/scratch/`) and review images (`art/review/`) are
  regenerable and not committed.
- Post-processing (ImageMagick): background key-out and despill, strip
  segmentation by connected components, trimming, one uniform scale per strip
  (never stretched), feet-baseline alignment, and atlas packing. Commands are
  in `docs/art/pipeline.md`; area rules are in `docs/art/areas.md`.
- Gate: the owner approves the style of the first character and the first area
  before bulk generation. Approved 2026-10-05: Fae v2 (larger chibi head, messy
  hair with bangs and a high bun, white sneakers with orange trim, journal in
  the backpack), the bedroom at 70% scale, the town plaza, Maddie, the chaos
  frog (chaos, burst, soothed, and calm frames plus the aura), the sticker UI
  with the owner's tweaks (cream speaker tags, stitched borders, bolder
  labels), the battle screen (the frog centred, Fae facing him from the left,
  the blurred plaza behind), and the journal (an open book with notes and a
  sticker album; the JOURNAL button with a teal quill).
- Style bible: `docs/art/style-bible.md`.

## 13. Out of scope until the owner adds it
Multiplayer, merch, speedrun, boss rush, New Game Plus, achievements,
analytics, voice acting, day/night, weather, fishing and bug minigames, photo
mode, home customization, and non-English localization. Keep player-facing
text in Ink or JSON so it stays translatable.
