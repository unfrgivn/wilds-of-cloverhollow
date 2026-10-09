# Wilds of Cloverhollow: spec

Last updated: 2026-10-08 (Milestone 38, the music room and the flute)

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
- The culprit is a friend from school under a chaos spell: a kid in a purple
  hood, never named until the very end (owner, 2026-10-07). The kid knows
  their secret; the player doesn't. They're glimpsed running off and talked
  about through the story. Raccoons are an ordinary chaos critter species,
  met all over the world like the pups and the cats.
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
content/        Areas, critters, party, fixtures, tunables (JSON); story (Ink).
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
- The shell draws the canvas from its own animation-frame callback (Pixi's
  automatic per-frame render is removed). While the harness has the game
  paused, it draws only after something changes: a step or reset, an area
  load, a resize, or a pointer press. Running, it draws every frame.
- Visual-only animation (walk frames, bobbing, text reveal, tweens) derives
  from state and tick and never feeds back into the core.
- `src/core` remains pure. The sole package import exception is `inkjs` in
  `src/core/ink.ts`; Ink is always loaded from a fresh Story per command.

### 3.2 Input
- Devices produce one `ActionFrame` per tick: a `move` vector (x and y in
  -1..1) plus booleans `confirm`, `cancel`, and `menu`, and an optional
  `lantern`, present only while it's pressed (like a touch `choose`): a blank
  frame, a recorded one, and a real key's frame then have the same shape, so a
  save's last input matches a new game's (section 10), and older recordings
  and their hashes stand. Button edges (pressed this tick) are derived in the
  core from the previous frame.
- Taps are never lost: a key pressed since the previous tick counts as held for
  that tick, even if it was already released.
- Keyboard: arrows or WASD move; Z, Space, or Enter confirm; X or Escape
  cancel; J opens the journal (`menu`); L switches the blacklight lantern on or
  off (`lantern`). On touch, a lantern button beside the journal button
  appears once Fae has the lantern and glows lavender while it's on.
- Gamepad (standard mapping) and touch (virtual stick plus buttons, section
  3.2.1) map to the same frame. The left stick uses a radial 25% dead zone,
  rescaled so its remaining range is 0..1; d-pad directions (standard buttons
  12..15) override the stick. A/Cross confirms, B/Circle cancels, Y/Triangle
  or Start opens the journal, and X/Square toggles the lantern. Only
  standard-mapping pads count; connected pads merge with button OR and first
  non-zero movement.
  When devices provide different movement vectors, touch wins, then keyboard,
  then gamepad.

### 3.2.1 iOS shell decisions (Milestone 4)
- WKWebView exposes the Gamepad API when the web view is first responder. With
  Capacitor's default initial focus, gamepads are expected to work on iOS 18+
  (including when focus is acquired later); support on iOS 15..17 and physical
  hardware remains unverified.
- Capacitor is 8.5.2 with the Swift Package Manager iOS template. The
  placeholder bundle ID is `com.unfrgivn.cloverhollow`; it may change before
  TestFlight. The display name is Cloverhollow and the web directory defaults
  to `dist`, overridable with `CLOVERHOLLOW_WEB_DIR`.
- The iOS deployment target remains the Capacitor template default, iOS 15.0.
- Signing (owner, 2026-10-06): the owner's Apple developer account is unpaid
  for now, so device builds use free personal-team signing (7-day profiles,
  up to three devices, no TestFlight) until it's paid.
- Device builds (`tools/ios/device.ts`): `just ios-device-build` builds the
  production web bundle into `dist`, checks it for the harness hook, syncs it
  with `CLOVERHOLLOW_WEB_DIR=dist`, and compiles the Release app for
  `generic/platform=iOS` unsigned. `just ios-device` signs it automatically
  with `DEVELOPMENT_TEAM=$CLOVERHOLLOW_TEAM_ID` (`-allowProvisioningUpdates`,
  device registration allowed), then installs and launches it with `xcrun
  devicectl` on the first connected physical iPhone, or the one named by
  `CLOVERHOLLOW_DEVICE`. The team id lives only in the gitignored `.env.ios`,
  which `just` loads; `.env.ios.example` documents it. Missing team or phone
  fails with a one-paragraph message.
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
  `state` (tick, area, x, y, facing, moving, the targeted interactable,
  whether the journal is open, and `fading` during a door fade) on the initial
  state, area, facing, movement, target, journal, and fade changes, and
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
  simulator's rotation, reboot the simulator. Under heavy load (a concurrent
  Playwright run) AXe's coordinate probe fails ("Unable to determine
  coordinate mapping"), so run it on a quiet machine. Arrival screenshots wait
  for the latest state line to be in the new area with `fading: false`; an
  earlier version shot the plaza while the door fade still covered it.

### 3.3 Gameplay sound (Milestone 37)
- Sound effects only: no music, ambience beds, or voice. `src/core/sound.ts`
  derives a closed set of `SoundCue` values from state diffs; it has no DOM,
  timers, clock, randomness, or I/O. The cue layer is source-agnostic, so a
  later synthesized or generated clip can replace a recipe without changing
  gameplay.
- `src/platform/audio.ts` creates the AudioContext at boot and resumes it at
  every chance: right away, on each key, pointer, or touch, and whenever a cue
  plays while it isn't running. Browsers hold it (`suspended`, or WebKit's
  `interrupted`) until a key, click, or tap; a gamepad press is not a user
  activation in any browser, so a pad-only player on the web hears nothing
  until one. The iOS app's web view lets it run at once (Capacitor sets
  `mediaTypesRequiringUserActionForPlayback` to none), so pads get sound there
  from the start. It synthesizes short, gentle tones in code at a moderate
  master gain. Audio unavailable or held must never break the game.
- iOS: Web Audio keeps WebKit's default `ambient` session, so the ring/silent
  switch mutes the game (Apple's guidance for non-essential game sound).
- Sound is on by default. Mute is toggled by M or the `♪ on/off` pill on the
  journal's notes heading (drawn like the coin and snack pills, with a larger
  invisible hit area), and is stored separately under `cloverhollow-audio` in
  Capacitor Preferences, never in the save.
- Story lines may carry one of the closed `sound:` tags `chime-red`,
  `chime-yellow`, `chime-green`, `chime-blue`, or `flute`. The tag is carried
  by dialogue state and projected as a cue whenever that line opens or replaces
  another line, including when the text is repeated. Unknown story sounds are
  rejected by the content loader. The music-room recipes are synthesized
  xylophone bars (C5, E5, G5, C6) and a short breathy rising flute call.
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
- Depth: the area ground layer is always at the back; characters y-sort by
  their feet, and props sort against them column by column by the front edge
  of their footprints (section 6.2).
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
- Followers (the party) and NPCs follow the same rules. NPCs may ship
  idle-only.
- The party: the friends who walk behind Fae and fight beside her. The roster
  is `content/party/<id>.json` (validated by the loader; `world.party` keeps
  roster order): `id`, `name`, `atlas`, the feet-anchored `box`
  (`{ width, height }`), `walkCycleUnits`, `sits` (sits down after
  `sitDelayTicks`; otherwise idles standing), `start` (in the party at a new
  game), an optional `joins` Ink variable (null for starters), and one battle
  `command` (`{ id, label, resting }`, section 8). Exactly one of `start: true`
  or a non-null `joins` is required, and a joins variable must be declared.
  Maddie is `maddie`: box 44x60, `walkCycleUnits` 84, sits, starts, command
  `play` / "Play" / "resting". Sue (`cast` / "Cast" / "reeling in", joins
  `sue_joined`) and Jordan (`juggle` / "Juggle" / "finding pinecones", joins
  `jordan_joined`) follow in roster order. A party of three fits at every
  spawn: members after the first also try wider diagonal heel slots, after the
  existing candidates, so no earlier placement moves and no spawn has to.
  `state.party` is the ordered list of members, each
  `{ id, x, y, facing, motion, stillTicks, trail }`.
- Chain rule: member 0 follows Fae; member i follows member i-1, with the same
  algorithm, the leader being the member ahead *after* its own move this tick
  (the party updates in order). Each member keeps its own breadcrumb trail of
  its leader's recent positions. Followers never collide with Fae or with each
  other, only with the floor, blockers, and people.
- Each member follows its leader using a capped recent-position trail. The
  follow tunables are `distance` 90, `stop` 60, `trailSpacing` 8, `trailMax`
  64, `catchUp` 1.15, `radius` 12, `slot` 50, `heel` 52, `settleDelayTicks`
  12, and `sitDelayTicks` 30; each member's `walkCycleUnits` is in its party
  content. A member uses hysteresis, line-of-sight proximity stopping, its own
  distance-based animation, and (if it `sits`) sits after the delay.
- Visibility is measured with feet-anchored boxes: Fae is 50x140 units
  (`faeBox` in the core) and each member's box comes from its content (Maddie
  44x60). `hiddenFraction(follower, followerBox, leader, leaderBox)` is the
  overlap area divided by the follower's box area when its feet are north of
  its leader's; beside or in front is zero. For members after member 0, a
  settled member also moves when it hides more than 25% of anyone ahead or is
  hidden more than 25% by anyone ahead; the candidate must make both overlaps
  at most 25%. Every member uses that same rule for spawn, join, and settle:
  collision-valid, line-of-sight clear, two radii from everyone ahead, and both
  hidden fractions at most 25%. Placement tries side heel slots at ±52 x and
  -6 y, then +24 y, before the ordinary rear/perpendicular fallbacks. Chained
  members additionally try diagonal heels at ±36 x with -40 y and +36 y
  offsets, which give Sue's tall box more natural clearance. When the leader is
  standing still and
  the member has been stopped for `settleDelayTicks` (12) while more than 25%
  hidden, it walks to the first valid visible heel slot. `stillTicks` keeps
  counting during that short walk, so Maddie sits soon after arriving. A
  member may stay partly hidden while everyone is walking.

## 6. World
- Areas are discrete. `content/areas/<id>.json` is canonical (Tiled may be used
  for editing if its export matches): `id`, `width` and `height` in units, the
  optional `land`, the `walkable` floor polygon, `blockers` (floor-plane
  footprints of walls nobody walks behind), `props` (its scenery, section
  6.2), named `spawns` (`{ x, y, facing }`), and optional `ground` (the
  folder of its painting or ground plate).
  Doors arrive in Milestone 6 and interactables in Milestone 8. An area's
  `critters` are its story set pieces and its optional `recurring` its
  recurring critters (section 6.1).
- Player collider: a circle of radius 20 units at the feet that slides along
  blockers. Each step is resolved by the solver; in a gap narrower than the
  collider, where its pushes fight and it would stop inside a shape, the step
  slides along one axis instead, or stays put (`resolveMove`). Followers and
  roaming critters move the same way. Where the solver succeeds the step is
  exactly the solver's, so areas without props move as before.
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
- A trigger may need a story variable: `requires: { variable, knot }`. While
  the Ink variable isn't true, crossing in plays `knot` as a dialogue (like an
  interaction) instead of starting a transition; Fae stands in the doorway, so
  it plays again only after she steps out and back in. Once the variable is
  true, it's an ordinary door. The core reads variables with
  `inkVariable(story, ink, name)`. The school's front doors need `hall_pass`
  during class.
- Content validation requires trigger targets and spawns to exist, trigger
  polygons to be reachable, and every spawn to be at least twice the player
  radius outside every trigger. Door spawns face away from the doorway into
  their destination area. The plaza fixture starts near its fountain.
- Every area spawn must have a valid slot for every roster member, chained:
  member 0 at Fae's heel (or behind her, or on one of the two perpendicular
  sides), member i at member i-1's, each with the follow radius clearance and
  two radii clear of Fae and the members ahead (`partySlots`; member 0 retains
  its original heel and perpendicular candidates, while chained members get
  additional diagonal heel candidates before rear fallbacks; the area checks
  test the whole roster so any party fits). At a door switch every member is
  placed in its slot, its trail resets to `[slot, leader]`, and everyone is
  frozen.
- Prototype areas: `bedroom` (from `hero_house_bedroom.png`), `kitchen`
  (the downstairs family room), `plaza` (from `town_center_plaza.png`), and
  `park` (Meadow Park, from `meadow_park_environment.png`), `school` (the
  school hallway, from `school_interior.png`), and `bay` (Bubblegum Bay, from
  `beach_cove_environment.png`). The house is wired bedroom door to the
  kitchen's stairs, the kitchen's front door to the plaza, and the plaza's
  house door back to the kitchen; the plaza's lower-right cobbled path leads to
  the park, the lower-left path to the school's front doors, and the east road
  (its doorway at the plaza's right edge, x 1600-1625, y 500-610) to the bay,
  and each leads back. The east road `requires` `club_open` (knot
  `bay_road_closed`): Fae goes to the bay once the tree house club is open.
- Bubblegum Bay: a sandy cove with a dock reaching into the water, palms, a
  blank sign, and a picnic under an umbrella. Fae arrives on the path at the
  left edge (spawn `plaza-road`, (180, 545) facing right). Its floor is the
  sand and the dock's planks between the rails; it was traced against a map of
  the painting itself (`tools/art/paint-map.ts`, checked by
  `tests/unit/bay-paint.test.ts`). The dock's near (south) rail is one prop,
  `dock-rail-south`, footed along its posts' feet, so it sorts column by
  column in front of Fae on the planks; the far rail stays in the painting and
  is never drawn over her (`tests/unit/bay-depth.test.ts`). Sue fishes at the
  dock's far end (a person, `npcs`, until she joins).
- Pinecone Pass: a snowy mountain clearing with trails, a lodge, cocoa stand,
  snowman, ski lifts, and a bus stop. Fae arrives at `pass.bus`; the plaza's
  standing bus stop prop is an `npcs` entry at the star sign, with a solid
  footprint and a `Look` prompt. The pass stop returns to `plaza.bus-stop`.
  The placeholder `harness` area stays for deterministic tests (fixture
  `harness`). Areas have a display `name` (the title's Continue line).
- The arcade (Milestone 29): `arcade`, "Cloverhollow Arcade", a 1200x800
  painted cutaway from `arcade_interior.png` (arcade cabinets, the ticket
  counter, a claw machine, gumball machines). Its door is on the back-left
  wall: trigger `door` to `plaza.arcade-door`, spawn `door` (270, 535) facing
  right. The plaza's trigger `arcade-door` (the storefront's door, x
  1385-1440, y 455-500) leads to `arcade.door` and `requires`
  `clubhouse_claimed` (knot `arcade_closed`, the locked door); spawn
  `arcade-door` (1412, 560) faces down. Mr. Pip, the arcade keeper, is its
  set piece at (820, 610). Look points: `claw-machine`, `ticket-counter`, and
  `star-racer` (a back-row cabinet).
- Story time (Milestone 30): the school hallway's classroom door (trigger
  `classroom-door`, the porthole door on the back-left wall) leads to
  `classroom.door` and `requires` `story_time` (knot `classroom_closed`);
  spawn `classroom-door` (700, 450) faces down. Ms. Maple in the hall is
  `visibleWhile` `maple_in_hall` (she goes in at story time). The kid in the
  purple hood (person `hooded-kid`, knot `hood_glimpse`, a single back view)
  stands at the east end of the hall while `hood_waiting`, by the gym doors.
  `classroom`, "Ms. Maple's Classroom", is a 1200x800
  painted cutaway: its floor a diamond, the door on the back-left wall
  (trigger `door` to `school.classroom-door`, a band along the whole painted
  door; spawn `door` (280, 535) facing right). People: Ms. Maple (`teacher`,
  knot `classroom_teacher`) at (850, 470) by the reading corner, Milo (knot
  `milo`) at (520, 610), and Rosie (knot `rosie`) at (270, 470) by the door.
  Look points: `art-wall`, `cubbies`, and `reading-corner`. Its props
  (section 6.2) are each desk with its chair, the teacher's desk, the cubbies,
  the bookshelf, and the two beanbags; the strip under the wall-hung
  chalkboard is a blocker.
- The gym (Milestone 31): its double doors are in the east hall (below),
  locked until `pe_time` (knot `gym_hall`). Ms. Maple sets `pe_time` the first time Fae talks to her in the classroom
  after glimpsing the hood (`saw_hood`): story time is over. If Fae hasn't
  heard her dragon story yet, she reads it first, in the same talk. `gym`,
  "School Gym", is a 1400x900 painted cutaway in the school's style (no
  concept sheet): a honey-wood court, double doors on the
  back-left wall (trigger `door` to `east-hall.gym-doors`, a slanted band along
  the whole painted door; spawn `door` (350, 650) facing right), a basketball
  hoop, a climbing rope with a bell, a bin of bouncy balls, the blue mats,
  bleachers, a bench pair, and the back door to the playing field, which is a
  Look point and never a trigger (it only opens from outside). Coach Ash, the
  PE teacher (`coach`, knot `coach`), stands at (560, 720). Look points:
  `hoop`, `ball-bin`, `climbing-rope`, and `back-door`. The gym pup is its set
  piece at (850, 650), out on the court. Its props (section 6.2) are the
  bleachers, the ball bin (footed on its four wheels), the mats, and the
  bench pair; blockers fill the pocket behind the mats, the gaps too narrow
  to walk through between the bench pair, the bin, and the bleachers, and
  the floor's front edge under the bench pair.
- The lasso (Milestone 31) is a story item, `has_lasso`, not a button: Coach
  Ash lends it for his clipboard on the hoop and lets Fae keep it. A Look
  point's knot checks it (the gym's `hoop`), so a lasso spot needs no engine
  support until one changes the world (a lever, a gap).
- The east hall (Milestone 38): the hall's floor runs off the painting's east
  edge into it. Trigger `east-hall`, a band along that whole edge (x
  1330-1355, y 614-795), leads to `east-hall.west`; spawn `east-hall` (1250,
  700) faces left. `east-hall`, "East Hall", is a 1400x800 painted corridor in
  the hall's style. Fae comes in at its west end (trigger `west`, the wedge
  where its floor runs off the left edge, back to `school.east-hall`; spawn
  `west` (260, 620) facing right, so the whole party lines up behind her). On
  its walls: the gym's double doors (trigger `gym-doors` to `gym.door`,
  `requires` `pe_time`, knot `gym_hall`; spawn `gym-doors` (220, 575) facing
  right), the music room door (trigger `music-door` to `music.door`,
  `requires` `music_time`, knot `music_closed`; spawn `music-door` (500, 450)
  facing down), and a closed door with a palette sign (Look point `art-room`).
  Its props are the lockers and the bench; a blocker fills the pocket under
  the wall fountain.
- The music room (Milestone 38): `music`, "Music Room", a 1200x800 painted
  cutaway on the classroom's frame. Its door is on the left back wall
  (trigger `door` to `east-hall.music-door`; spawn `door` (280, 545) facing
  right). Ms. Willow, the music teacher (`music-teacher`, knot
  `music_teacher`), stands by the piano at (735, 410). Look points: `piano`,
  `song-poster`, `music-window`, `instrument-shelf`, and the `xylophone`
  (prompt `Play`). The music bird, a bluebird set piece, flutters at (560,
  620). Its props are the xylophone, the piano with its bench, and the
  instrument shelf.
- The flute (Milestone 38): Coach Ash's thanks set `music_time`. Ms. Willow
  tells Fae how the class song starts, red, yellow, blue (`song_start`); the
  kid in the purple hood scribbled over the rest. A calm music bird has
  dropped her mallet (`calmed("music-bird")`), and listening to it
  (`heard_bird`) gives the last note: red. The xylophone takes four bars from
  the choices Red, Yellow, Green, and Blue (or Stop), each line carrying its
  bar's `sound:` tag, then judges the song: red, yellow, blue, red earns Ms.
  Willow's very first flute, the painted wooden one (`has_flute`), which Fae
  plays once (`sound: flute`); a wrong song ends with a hint. After that the
  xylophone is free play. Like the lasso, the flute is a story item with no
  button yet.
- The six painted lands are `cloverhollow` (Cloverhollow), `bay` (Bubblegum
  Bay), `pass` (Pinecone Pass), `trail` (Cliffside Trail), `forest` (The Forest),
  and `enchanted` (The Enchanted Forest), in that order. Every non-harness area
  belongs to one. Bubblegum Bay has a bus-stop prop at (355, 505), with spawn
  `bus-stop` at (355, 545), by the welcome sign.
- At the pass, Jordan stands by the snowman (person `jordan`, knot `jordan`,
  `Talk`) watching the Snowball Hamster, a critter loose in the clearing at
  (850, 760). He joins whatever Fae answers (`jordan_joined`); the calm
  hamster gets him to hand her his blacklight lantern (`has_lantern`).
- Cliffside Trail (Milestone 21): the first trail between lands, a painted
  1750x1100 area climbing from Bubblegum Bay's south beach to Pinecone Pass's
  east path; its floor and blockers are written by
  `tools/art/geometry/trail.ts`, its scenery is a kit (section 6.2). Its ways in and out are thin triggers on the
  floor's outer edges: the pass's east edge to the trail's west edge
  (`trail.pass`, facing right) and back (`pass.trail`, facing left); the bay's
  south edge to the trail's beach (`trail.bay`, facing up) and back
  (`bay.trail`, facing up). The bay's way requires `rode_bus` (knot
  `bay_cliff_path` while it's false). Look points: `trail-signpost`,
  `lookout-bench`, and the pass's `pass-trail-sign`. The Grumpy Gull stands at
  (1440, 480), between the lookout rock and bench, guarding the bench until its
  mini-boss battle is calmed. Bunnies and squirrels roam the upper and lower
  meadows (section 6.1).
- The back-link rule: after Fae arrives through a door, the trigger that leads
  straight back to the area she came from doesn't fire while she keeps holding
  the direction she was walking when she left (`state.backLink`); letting go
  or turning re-arms it. Earlier links all keep her direction, so it matters
  only where a link turns her round (the bay's south edge and the trail's
  beach), where a kid holding down would otherwise bounce between them.
- People: an area's `npcs` are `{ id, point, facing, knot, prompt, footprint,
  visibleWhile? }` (Ms. Maple the teacher and Nurse Holly in the school
  hallway, and the kid in the purple hood there for a moment; Ms. Maple,
  Milo, and Rosie in the classroom; Coach Ash in the gym; Mom and Oliver in
  the kitchen). Each is
  drawn from the atlas named for its id in
  `content/characters.json` (`{ atlas, idleTicks }`, where `idleTicks` are the
  ticks per `idle_down` frame: Mom holds her smile 180 ticks, then blinks for
  8), y-sorted with everyone else, and targeted like an interactable. While
  Fae talks to one (the dialogue's knot is theirs), they face her along the
  larger axis of the gap between them (`npcFacing`); otherwise they face as
  authored. Without a frame for that facing they show their front.
  Standing props such as the plaza bus stop use the same person entry and
  y-sorted renderer, but are props rather than people.
- A person's `footprint` polygon is solid, for Fae and for the party, like a
  blocker. A person with `visibleWhile` (an Ink variable) is only there while
  it's true; otherwise they aren't drawn, can't be talked to, and aren't
  solid (`npcVisible`). The area checks count every footprint as solid, since
  someone may be standing there. Story variables are read per tick through
  `world.storyVariable(ink, name)`: one Story built at load, reused for each
  read, since building one costs about 0.2 ms.
- Area paintings: opaque WebP tiles (each at most 2048x2048) at 2 source px
  per unit, listed in `public/assets/areas/<id>/ground.json` (tile offsets in
  source px and the painting's `paper` margin colour). The paper colour fills
  the logical viewport behind the painting; the page colour `#f8edcf` shows
  only in letterbox bars outside it.
- Areas may define `interactables` with `{ id, knot, point, prompt }`;
  `prompt` is `Look`, or `Play` for something Fae plays (the music room's
  xylophone). Each point must be reachable within the interaction range.
- Glows (the blacklight lantern, Milestone 23): an area's `glows` are
  `{ id, frame, point, knot?, prompt?, flip? }`, a frame of
  `assets/glows/glows.json` (light painted on black, lifted by brightness).
  They're never solid. While the lantern is on (`state.lantern`, switched by a
  lantern press once `has_lantern` is true and Fae is free), the overworld
  drops to a deep violet dusk (55%) and each glow is added on top with a
  gentle pulse (render-only); a glow with a knot is a Look target
  (`glow:<id>`) only then. `flip` mirrors the decal. At Pinecone Pass, three
  glowing paw prints lead from the clearing to a trail marker on the west
  pines (`old_trail_marker`, which sets `found_old_trail`), and a doodle is
  painted on the north ski-lift tower (`lift_note`). `renderInfo().lantern`
  reports `{ on, glows }`, the ids drawn.
- Canopies: a prop with `canopy: true` is a tree Fae can walk under (a palm,
  crown and trunk cut whole, its front edge at the trunk's foot). While it
  draws over more than 5% of her body box (its picture, in the columns where
  her feet are north of its front edge), it fades to 40% (0.08 a tick,
  render-only), so she's drawn behind it and still seen; it eases back once
  she steps out. `renderInfo().canopies` reports each one's alpha. Bubblegum
  Bay's palms are canopy props (`tests/unit/canopy.test.ts`,
  `tests/e2e/canopy.spec.ts`).
- Hiding check (`src/content/area-checks.ts`, run by `just check`): from every
  spawn, no position reachable on a 5-unit grid may have 75% or more of Fae's
  body box (50x140 units above her feet) covered by props (in
  any of their states). Canopies don't count: they fade instead. The checks
  count every footprint of every prop state as solid, since the story may
  change a state.
- Area scale rule: a standard door is about 1.4x Fae's height (about 200
  units) and furniture is proportional. Paintings are resampled uniformly to
  meet it, never stretched. The bedroom is 1050x700 units (the whole room fits
  on one phone screen); the plaza is 1750x1100 units.

### 6.1 Critters out in an area (Milestone 28)
- Critters come two ways. Story set pieces are an area's `critters`,
  `{ id, point, visibleWhile? }`: each a critter kind placed once, standing
  still, calm or chaos for the whole game (`state.critters`, keyed by id).
  `visibleWhile` (an Ink variable) puts one there only while it's true. The
  set pieces are the fountain frog (plaza), the school raccoon (plaza, while
  `raccoon_waiting`), the grumpy gull (the trail's lookout), Mr. Pip, the
  arcade keeper (the arcade), and the gym pup (the gym).
- Recurring critters, EarthBound style, are an area's `recurring`:
  `{ after?, dens: { point, radius, kinds, chance? }[] }`. On every arrival
  (a door, a bus ride, a rest's fade, and the start of a game or fixture)
  each den, in order, draws twice from the state's PRNG: is one out
  (`chance`, default 1), and which of its `kinds`. Every den draws whatever
  comes out, so an arrival's draws depend only on the content. Until
  `after` (a `calmed()` fact) is true the area draws nothing and is quiet:
  the plaza waits for the fountain frog. The ones out this visit are
  `state.wild`: `{ kind, den, mood, x, y, target, pauseTicks,
  cooldownTicks, facing, moving }`, starting at their den in chaos. One Fae
  calms stays calm, a Talk target, only until she leaves; the next arrival
  rolls the area fresh.
- A recurring critter wanders inside its den's radius and comes after a
  Fae within sight (section 8); its home is its den's point.
- The starting roster (owner, 2026-10-07): Cloverhollow's plaza (after the
  fountain frog) and the park, raccoons, pups, and cats; Bubblegum Bay,
  frogs and bluebirds; the Cliffside Trail, bunnies and squirrels; Pinecone
  Pass, hamsters; the Whispering Woods, owls and raccoons. A species the
  story needs has a den of its own with `chance` 1: the park's pond (pups),
  the bay's sand (bluebirds), and the pass's clearing (hamsters).
- `presentCritters(world, state)` lists every critter out in Fae's area, set
  pieces first, each with a `key` (a set piece's id, or `wild:<den>`) used
  for its Talk target (`critter:<key>`) and its render labels and info.
- Authoring checks (`src/content/area-checks.ts`): a den must be on the
  floor; farther from every spawn than sight plus its kinds' touch radius,
  so Fae never arrives in a critter's sight; clear of every door by its
  radius plus that touch; and mostly in view (of 48 sample spots on rings
  round it, no more than a tenth with over half of a critter's body, 50 by
  70 units, drawn behind scenery). The loader
  (`critterErrors`) checks that set pieces are kinds placed once, dens list
  only the other kinds, a species has one sticker and it's in the album,
  and `after` names a set piece or a species.

### 6.2 Props and area kits (Milestone 32)
- An area's scenery (everything Fae can walk behind or bump into) is props:
  sprites cut from its painting, each with a ground footprint (solid), its
  own depth, and states. The ground plate is the painting with the lifted
  props and their cast shadows painted out.
- A prop is one object, and its picture is that whole object, top to feet,
  and nothing else. Furniture that reads as one piece is one prop (a desk and
  its chair). Things fixed to a wall (boards, signs, windows) stay in the
  painting: nobody walks behind them. A prop's footprint is its own ground
  contact (from the wall to its front, for wall-backed furniture); anything
  else solid that isn't an object (a pocket behind furniture nobody should
  enter, a gap too narrow to walk through, a strip along a wall) is a plain
  blocker. The authoring check `propDrawingErrors`
  (`src/content/area-checks.ts`, run by `just check`) holds every prop to its
  footprint: its picture covers every 5-unit column its footprint covers
  (one may go spare at an end), except where another prop in front of it
  there covers its footprint's front with its own picture (a tree's crown
  high above covers nothing), and in those columns reaches to within 15 units
  of its front. Its companion `propBlockerErrors` keeps plain blockers off
  props: a blocker over half or more of a footprint's cells is that prop's
  collision drawn again as a box.
- A catalogue, `content/props/<area>.json` (written by `tools/art/kit.ts`),
  lists the area's atlases (Pixi spritesheets in
  `public/assets/areas/<area>/props-N.json`, frames anchored at the prop's
  home point, 2 source px per unit, each a whole number of 5-unit columns
  wide) and its props: `{ canopy, painted, home: [x, y], states }`, every
  state `{ frame, shadow, footprint, silhouette }`. A `footprint` is a list
  of polygons relative to home (an arch has one per leg; a pile of planks
  none); `shadow` is a multiply decal frame or null; `silhouette` is
  `{ left, step: 5, columns }`, each column the frame's opaque runs as
  "top bottom ..." in units relative to home. Every prop has a `default`
  state.
- The area places them: `props: [{ id, prop, x, y, flip?, state?, rules? }]`.
  `rules` are `{ state, while }`: the first whose Ink variable is true sets
  the state, else `state` (default `default`). A `painted` prop is still on
  the plate (its neighbours overlap it there), so it must stay at home,
  unflipped, in its default state, with no rules. The loader resolves every
  placement into world units and rejects unknown props or states, duplicate
  ids, moved painted props, and rules reading undeclared Ink variables
  (`propRuleErrors`).
- Collision: each prop's current footprint is solid for Fae, the party, and
  roaming critters, like a blocker (`sceneryArea`); spawning and joining
  party slots avoid them too.
- Depth: each prop's front edge is its footprint's southmost y in every
  5-unit column (`frontEdge`): straight across gaps between its polygons
  (between an arch's legs), flat past its ends, and the home y with no
  footprint. Someone whose feet are north of the front edge in a column is
  behind the prop there. The renderer draws each prop as vertical strips,
  sub-textures of its frame where consecutive columns share a front y, each
  strip sorted at that y with the characters' feet; the strips together draw
  exactly the frame. `propCovers` measures the same rule for the checks. A
  painted prop's strips are drawn only where they overlap someone in the
  depth layer (the plate already shows it everywhere else), which keeps a kit
  area as cheap to draw as its painting; `renderInfo().drawOrder` lists the
  strips drawn.
- Shadows are multiply decals on the ground layer, under everyone, and move
  with their prop.
- A canopy prop (the trees, the notice board) fades to 40% (0.08 a tick)
  while it covers more than 5% of Fae's body box; `renderInfo().canopies`
  lists them.
- The battle backdrop is rendered from the plate with every prop on it.
- The plaza (Milestone 32) is a kit: 20 props (the fountain; six benches;
  the four lamp arches, each one prop with a footprint per leg; the two
  planters and the flowerbed; the notice board; three trees; two bushes).
  Lifted (movable, with shadows): the fountain, the north, northwest,
  southeast, and south benches, and the two planters; bench-north was
  finished where the fountain hid its legs. bench-southeast has a `smashed`
  state (a pile of planks with purple scribbles, footprint empty). The rest
  are painted. Its blockers are the house and the four shops. The south-west
  critter den moved to (620, 810), clear of the arch.
- The indoor rooms (Milestone 33) are kits too, every prop painted (nothing
  indoors moves or changes yet; any can be lifted later): the bedroom (the
  bed, the desk, the desk chair, the shelf, the cat bed), the kitchen (the
  island, the dining set (the table, its four chairs, and the high chair),
  the sofa, the stair's newel post; the banister stays in the painting, since
  Fae never walks behind it), the school hallway (the trophy cabinet, the
  lockers on the nurse's block, the post at the end of the low front wall),
  the classroom, the gym, and the arcade (the five cabinets, the ticket
  counter, the claw machine, the three gumball machines). The kitchen's
  `stairs` spawn is (600, 650), facing right, so the whole party fits behind
  Fae at the foot of the stairs.
- The outdoor areas (Milestone 34) are kits too, so every area is: Meadow
  Park (the tree house, the tower, two bushes, the basket, five fence runs, the
  park sign, the pond), Bubblegum Bay (the near dock rail, the umbrella, the
  sign, three palms, two driftwood logs, three beach balls, the bucket, two
  spades, the picnic basket), Pinecone Pass (four pine stands, the lodge, the
  cocoa stand, three groups of benches, the bus shelter, the lift towers, the
  snowman, the signs), the Cliffside Trail (pines, rocks, the signpost, the
  lookout bench, the footbridge's near rail as one prop), and the Whispering
  Woods (its trees, the tree house, three logs, two fern beds). Trees, ferns,
  the bay's sign and its umbrella fade while Fae is behind them (canopies).
  Every prop is painted but the woods' south log, which is lifted; the plates
  are the approved paintings but for its hole.
- An area's floor is one piece: from any spawn, Fae can walk to every other
  (`areaConnectionErrors` reports a floor split by furniture).

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
- A line may carry `# travel: <area>.<spawn>`. The target remains in the
  dialogue state through that line and its close, then starts the same 18-tick
  fade as a door, placing Fae and the party at the named spawn and autosaving
  on arrival. Load validation rejects travel tags naming an unknown area or
  spawn. The bus line (Milestone 24) is three stops' knots (`bus_stop`,
  `bay_bus_stop`, `pass_bus_stop`) travelling between `plaza.bus-stop`,
  `bay.bus-stop`, and `pass.bus`: the bay once `club_open`, the pass once the
  bluebird is calm (setting `rode_bus`), home any time.
- A line may carry `# buy: snack <price>`: as it's shown, Fae pays `price`
  coins for one snack if she has them (`purchaseSnack`). The story's
  `coins()` external answers her coins, so a shop only offers to sell when
  she can pay. The shops are the plaza bakery (interactable `bakery` at
  (1180, 420), under its window) and Pinecone Pass's cocoa stand
  (`cocoa_stand`), 5 coins a snack. Their choices are sticky (`+`), so they
  sell on every visit.
- Load validation reads every tag in the compiled story (`storyTags`: a
  tag's text follows its `#` command, and its `/#` may close in an enclosing
  container) and rejects a travel tag naming an unknown area or spawn, and
  any `buy` tag but `snack <digits>`.
- The Ink adapter skips blank lines (a conditional line whose condition is
  false), and looks past blank lines after a line, so choices that follow
  them come with that line rather than as an empty step. The story's
  externals, `calmed(name)` and `coins()` (Fae's coins), are answered from
  the core's state (`inkFacts`) for every command, not only a knot's first
  line. `calmed` answers a set piece by its id from its own mood, and a
  species once Fae owns its sticker (she has calmed one of them, anywhere).
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
  plan). A choice offered on every visit (the shops, the bus stops, the
  teacher and nurse) is sticky (`+`).
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
  reserve, so they never cover the buttons. Five or more choices on a screen
  at most 560 px tall sit in two columns, filled top to bottom, so every
  choice stays on screen at its 44 px height. It is pure CSS (no measuring in
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
- Critter kinds (`content/critters/<id>.json`, the file named for its `id`),
  each of a `species`; kinds of one species share its sticker (spec 9). The
  set pieces (section 6.1): the Fizzy Frog (`fountain-frog`, the plaza
  fountain; calm, the Fountain Frog), the school raccoon (`school-raccoon`,
  calm, the Ringtail Raccoon, who tells the club password it overheard), the
  Grumpy Gull at the lookout (calm, the Lookout Gull), and the gym pup
  (`gym-pup`, a pup with indoor lines; calm, the Gym Pup, who drops Coach
  Ash's stopwatch; its sticker is the Pond Pup's). The recurring kinds:
  the Zoomie Pup (calm, the Pond Pup), the Pouncy Cat (the Cozy Cat, who bats
  yarn balls), the Sneaky Raccoon (the Ringtail Raccoon, who flings bottle
  caps), the bay's Fizzy Frog (`frog`, the fountain frog's species; calm, the
  Beach Frog), the Flappy Bluebird (the Bay Bluebird, whose burst kicks a gust
  of sand at Fae), the Snowball Hamster (the Hiker Hamster, who flings
  snowballs), the Thumpy Bunny and Zippy Squirrel (the Ribbon Bunny and the
  Acorn Squirrel), and the Screeching Owl (the Whispering Owl). The gull is
  the first mini-boss: it is larger and tougher, stands still, and blocks the
  route to the bench until calmed. Mr. Pip, the arcade keeper
  (`arcade-keeper`, his own species; calm, Mr. Pip), is the second, and the
  first person under the chaos spell: a person is a kind like any critter,
  with the gull's mini-boss numbers, `overworldHeight` 160 (about 1.15x Fae)
  and `battleHeight` 280. The others share the battle numbers for now; each
  has its own lines, atlas, sticker, and calm knot.
- Mini-boss numbers: the Grumpy Gull has `overworldHeight` 110 (ordinary
  critters are 66 or 70), `battleHeight` 260 (ordinary critters are 190),
  `touchRadius` 85 (ordinary critters are 70), `calmMax` 160 (ordinary
  critters are 100), and `energyMax` 6 (ordinary critters are 5). Its burst
  `bigChance` is 0.5 (ordinary critters are 0.3), so its gust can hit harder.
  Its friend-command values and timing windows remain readable and fair; the
  extra difficulty comes from its larger meter, extra energy, larger reach,
  and stronger burst.
- Friend commands: Maddie's Play, Sue's Cast, and Jordan's Juggle (pinecones;
  calm 30, great 15, good 5, rest 2 on every critter). The menu lists Soothe,
  each member's command in party order, then Snack and Run: six with the
  whole party, in one column on desktop and two on phones (section 8.1).
- Content: `content/critters/*.json` (validated by the loader) supplies every
  battle number and line: the touch radius, calm and energy maxima, the
  `coins` it pays when calmed (8 for ordinary critters, 25 for the gull),
  command values (`commands.soothe`, `commands.snack`, and
  `commands.friends.<command id>` with `{ calm, great, good, rest }` for every
  party command), aim windows, the burst, the sticker, and the calm knot and
  prompt. Lines follow the same split: `lines.soothe` and
  `lines.friends.<command id>` are per-grade. The loader rejects a critter
  missing a roster command (numbers or lines), and a party command whose id is
  `soothe`, `snack`, or `run`, or another member's. The shared command labels
  (Soothe, Snack, Run) and the Snack `×N` template live in
  `content/battle.json`; each friend's label and resting detail live in its
  `content/party/` entry; the reward lines, `rewards.sticker` ("New sticker:
  {sticker}! +{coins} coins.") and `rewards.coins` ("+{coins} coins!"), in
  `content/battle.json`. State adds `critters` (the set pieces' moods),
  `wild` (section 6.1), `stickers`, `safeSpot`, a nullable `battle`, and
  Fae's `coins` (0 in a new game) and `snacks` (2).
- Start: crossing into a chaos critter's touch circle (outside on the previous
  tick, inside now; exactly on the radius counts as inside) starts a battle and
  records `battle.entry`, Fae's position on the tick before. `battle.critterId`
  is the kind and `battle.den` the recurring critter's den, or null for a set
  piece. A calm critter never battles; it is a Talk target where it stands
  with its `calmKnot`.
- Flow (messages type like dialogue: a confirm press shows the whole line, the
  next press advances):

  ```
  intro -> command --Soothe / a friend's command--> aim (on the critter) -> result
                   --Snack--------> result
                   --Run----------> run -> ends at entry, facing away
  result -> soothed -> reward -> ends: critter calm, its coins paid, the
            (when calm reached calmMax)     species' sticker added if new
         -> burst -> aim (on Fae) -> burstResult -> command
            (or rest when energy reaches 0)
  rest -> door-style fade to safeSpot; the critter stays chaos; nothing lost
  ```

- Reward (Milestone 28): every calm pays the kind's `coins`; the species'
  sticker comes only the first time. As the reward shows, `rewardSticker` is
  set to the sticker if it's new (the reward card shows it, with "New
  sticker: ... +N coins.") or null (no card; the line is "+N coins!"). The
  reward ends the battle with the set piece's or the recurring critter's
  mood calm. The aura and the timing ring are gone at the reward.

- Commands are composed from the party: Soothe, then one command per party
  member in party order (Maddie's Play), then Snack and Run
  (`battleCommands`). Up/down edges skip disabled commands; confirm or a touch
  `choose` picks. The chosen command id (`soothe` or a friend's id) is stored
  in `battle.command`. `battle.rest` maps each friend's command id to the
  turns it still rests (missing means ready): choosing a friend's command sets
  its rest to the critter's content `rest` for it, and every command choice
  (Soothe, Snack, or a friend's) takes one turn off every other resting
  friend. A resting command is disabled with its member's `resting` detail.
  Snack spends one of Fae's `snacks` (gone for good, whatever happens next),
  shows how many she has (`×N`), and is disabled at zero.
- Aim: the first confirm edge is graded by its distance in ticks from the
  target (great window, then good); no press by the end is a miss. Soothe and
  a friend's command add their calm plus the grade bonus, clamped to
  `calmMax`, and show that command's line for the grade. In a burst a seeded
  PRNG draw picks base damage 1 or 2 (`bigChance`); great, good, and miss deal
  0, base minus 1, and base.
- While a battle runs Fae is frozen, doors don't fire, cancel and menu are
  ignored (v0), and the party keeps settling. `safeSpot` is set at new game
  and on every area arrival.
- Ink: the adapter binds a pure external `calmed(name)`, answered from facts
  the core passes in (section 7). Once the fountain frog is calm the fountain
  has a new line, and the frog has his own talk (a first visit, then a revisit
  line). A calm recurring critter's talk is its kind's knot: the first talk
  with any of that kind plays its story clue, later ones the revisit line.
- Overworld: each critter is drawn where it stands, y-sorted with the
  characters and props, its figure `overworldHeight` units tall: chaos
  with its aura pulsing and turning behind it, calm without. The view keeps
  one sprite pair per present critter (`critter:<key>`), rebuilt when who is
  out changes.
- A recurring critter is drawn, sorted, and collided at its current position.
  While Fae is free it wanders to seeded random points inside its den's
  radius, pausing for 45 ticks, or chases Fae within 180 units at 2.5 units
  per tick. Wandering is 1.25 units per tick, deliberately slower than Fae's
  4 units per tick. A chaser gives up beyond its den plus twice sight. It
  stays on the floor with the 12-unit follow radius. Dialogue, battles,
  transitions, and the journal freeze it. Touch is an outside-to-inside
  crossing by either mover; a battle with it (and Run, which also puts it
  back at its den) gives it a 240-tick cooldown, heading home, and an
  arrival rolls the area fresh.
- Critter kinds own their atlas, battle content, sticker, and measured
  `auraCentre` and `bodyCentre` frame-pixel centroids. Kinds may share an
  atlas (the fountain frog and the bay's frogs), so atlases load and are
  found by their URL; aura placement uses those centroids, and render info
  names the active kind `battle.critter: { id, frame }`. Sue uses the generic party renderer with
  `assets/characters/sue/sue.json`: walk animation advances from her own
  displacement and `walkCycleUnits` (126), idle follows her facing, and right
  mirrors left. She never sits. `renderInfo().party` reports each member's id,
  animation, and frame, and the depth labels include `sue` when present.
- Battle scene (render only), from one pure CSS-px layout
  (`src/render/battle-layout.ts`) at the overworld scale: the frog's figure is
  `battleHeight` units tall with its body centre at (0.5 W, 0.42 H); Fae, seen
  from behind, stands with her baseline at (0.22 W, 0.57 H). The party shares
  her baseline (`layout.party`, one point per member): member 0 is 42 units
  toward the critter (where Maddie sits), and member i>0 stands i x 64 units
  on Fae's far side, away from the critter. A member that `sits` shows its
  `idle_down` frame; anyone else is seen from behind (`idle_up`). Members are
  drawn from their own atlas at the overworld scale. This clears the HUD,
  command menu, message box, and touch buttons on phones and desktops. The aura turns about its own centroid on the
  frog's body. The timing ring is centred on the frog's (in a burst, Fae's)
  body centre with a radius of 0.55 times the figure height.
- Backdrop: the area painting itself, scaled so its painted interior (8% in
  from each side, past the watercolour's paper margins) covers the canvas plus
  a 32 px margin, centred on the critter where it stands (`battleFoe`) and
  clamped, softly blurred, with a
  light cream wash. The overworld characters hide during the battle.
- Shell: `data-battle="open"` is on the root while a battle runs. Battle
  messages use the dialogue box with no speaker and hide when empty. Dev
  builds log `[cloverhollow] battle {phase, message}` and the command buttons'
  rects. `renderInfo().battle` reports, in CSS px, the layout, the drawn
  backdrop rect, the ring, the battle's critter (`{ id, frame }`), the aura
  alpha, and whether the
  overworld is visible; `renderInfo().critters` lists each overworld critter
  as `{ id, kind, frame, x, y }`, `id` its key (section 6.1).

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
- Commands: a two-column grid of sticker buttons on phones (one column from
  1000 px wide), right-aligned above confirm and cancel, clear of the HUD, the
  dialogue box, and the touch buttons. The menu grows with the party: four
  commands with Maddie alone, up to six (three rows on a phone) with Sue and
  Jordan; the gallery previews a bigger party with `?party=N`. The selected command is lifted and
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
- `content/fixtures/plaza-party.json` is the two-member visual and battle
  fixture: plaza fountain spawn, seed 1, party `["maddie", "sue"]`.
- The Pixi battle scene dims the loaded area painting and presents the critter,
  Fae, the party, and aura in a fixed logical composition. It is render-only. The
  shell logs `[cloverhollow] battle` with phase and message changes, and
  `renderInfo()` exposes the phase, timing-ring request, and critter frame.

## 9. Journal and stickers
- The journal is the pause menu: Notes (current goals, written from Ink), a
  Sticker album, and a painted MAP page. The map labels all six lands, shows
  `???` for the sealed Enchanted Forest, puts a bobbing gold star over Fae's
  current land, and leads each stop's name with the bus line's sign (lands
  with `busStop`). It is presentation only, outside the core state and saves.
- Stickers are collectibles and rewards.
- Core: `journalOpen` in state. A menu press (J or the journal button) opens
  it when no dialogue, battle, or door transition is running; a menu or cancel
  press (or the book's close button, which sends cancel) closes it. While it's
  open Fae is frozen, doors, battles, and interactions don't fire, and the
  party keeps settling.
- Notes: the `journal` Ink knot lists every note that applies, newest first:
  Coach Ash's lasso, once he has his things back; while Fae hunts for them,
  the stopwatch and the clipboard both found, the fizzy pup with his
  stopwatch, and where the clipboard is (somewhere up high, stuck on the hoop,
  then the lasso lent), and the kid knocking over his cart and running out
  the back door; time for PE; the locked gym doors, once Fae has tried them,
  until PE; the kid in the purple hood running off toward the gym; story
  time, until the glimpse; the way back to school for story time, until it
  starts; once Mr. Pip is calm, his fizzy soda from the kid in the purple hood and the
  scribbled-out Star Racer initials; before that, once the clubhouse is
  claimed, its note sending Fae to the arcade; the clubhouse claimed; the
  hooded kid's glowing trail toward the Whispering
  Woods; the grumpy gull; Jordan's lantern and the secret trail only it
  shows; Jordan on the team; the Cliffside Trail's bunnies and squirrels
  calmed (one of each); after the ride, Pinecone Pass's snow, lodge, cocoa,
  and the hooded kid somewhere up there; before the ride, once a bluebird is
  calm, the bus note; a calm bluebird's clue toward the mountains; Sue on the
  team; the purple hood's school name tag; while the club is open and Sue
  hasn't joined, the east road to Bubblegum Bay; the club password; the hall
  pass; a calm pup's purple thread toward the school; while only the
  fountain frog is calm, the purple fizz leading to the park; while Fae has
  coins, the bakery's snacks; the calm fountain frog; the kid in the purple
  hood from the notice board; then the morning plan. The troublemaker is
  always "a kid in a purple hood" (or "the hooded kid"), never named.
  `journalNotes(world, state)` runs it on a copy of the Ink state and keeps no
  result, so reading the journal never changes the story.
- Album: `content/stickers.json` (validated) holds the slot count and the
  catalogue (id, name, the critter whose atlas holds the art, and the frame):
  eleven stickers, one per species and one per mini-boss, in eleven slots,
  the town's four first.
  A sticker is owned when `state.stickers` has its id. The shell sets
  `data-journal="open"` while the book is open.

### 9.1 Journal layout
- The journal (`src/ui/journal.ts`) is a modal open book inside the safe area,
  above every other layer (`--z-journal`). The left page is NOTES: ruled notes
  in the order the game passes (newest first), an empty line ("Nothing yet.
  Look around!") when there are none, and scrolling only when they overflow.
  The right page is the STICKERS album: a 5-column grid (a phone's page
  shows two rows and scrolls to the rest, like the notes) where owned
  stickers
  show their atlas frame with a die-cut rim and their name, and unowned slots
  are dashed `?` outlines with no name.
- Fae's supplies sit at the right of the NOTES heading row: two small cream
  stickers with ink outlines, `Coins N` with a gold coin and `Snacks N` with
  a cookie (inline SVG, like the map's bus-stop sign).
- A cream JOURNAL label sits on the top edge and a close sticker (at least
  44 px) in the top-right corner; the close button is how touch players leave.
- Bookmark tabs (at least 44 px) flip between NOTES & STICKERS and MAP. The
  journal opens on notes; ArrowLeft/ArrowRight and A/D also flip pages.
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
- Format: `{ version: 5, state }`, the whole core state, including the
  serialized Ink state (story variables and choices), the party, stickers,
  the set pieces' moods, this visit's recurring critters, the lantern, coins
  and snacks, the PRNG, and the tick. Version 1 (Maddie in `maddie` and
  `trail`), version 2 (no lantern), version 3 (no coins or snacks), and
  version 4 (one critter of each kind, no recurring critters) are refused and
  start a new game. Loading restores it exactly: the state hash matches, and
  `stableHash` skips undefined values (as JSON does) so a state and its saved
  copy hash the same.
- `parseSave(json, template)` accepts only a state with the template's exact
  shape (a fresh game state: every key, the same primitive types, all the way
  down; null slots may hold null or an object; every element of an array
  matches the template array's first element, so each party member and trail
  point is checked; a new game has no recurring critters out, so `wild` is
  checked against a fixed shape). Any other version or shape starts a new
  game instead of crashing later. A change to the state's shape bumps the
  version. Content growing is not a shape change: a set piece added since the
  save was made starts in chaos when it loads (`parseSave` lays the saved
  critters over the template's).
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
    cache), the depth layer's draw order (`{ label, zIndex }[]`, with `fae`,
    each party member's id such as `maddie`, and `prop:<id>`, one entry per
    strip), `props` (each prop's `{ id, state,
    strips }`, every strip's world `left`, `right`, and `zIndex`), Fae's
    current `animation` and `frame`, `party` (each member in party order as
    `{ id, hidden, animation, frame }`, `hidden` being its fraction behind its
    leader), plus prompt and dialogue summaries. `npcs` lists each person in
    the area as `{ id, frame, facing }`. `battle.layout` includes `party`, the
    members' CSS-px points.
- While dialogue is open, HTML carries `data-dialogue="open"`; movement, doors,
  cancel, and menu are ignored. Confirm reveals the current line, advances it,
  or selects the highlighted choice. Up/down edges wrap the selection.
- Deliberately absent: arbitrary flag setting, teleporting, and eval. Fixtures
  are the only shortcut, and they are labeled test-only.
- Screenshots come from the browser (Playwright or Chrome DevTools MCP), so
  they include the DOM UI.
- `sound.log()` returns recent read-only `{ tick, cue, played }` entries,
  `sound.muted()` reports the separate audio preference, and `sound.state()`
  the AudioContext's state (`running`, `suspended`, `interrupted`, `closed`,
  or `unavailable`). Harness builds also log `[cloverhollow] audio {state}`
  on every state change and `[cloverhollow] sound {tick, cue, played}` per
  cue, for native checks. These are harness only and are absent from
  production.
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
- Playwright projects: Chromium runs every e2e spec. WebKit (the iOS engine)
  runs the layout, UI, and input-device specs (title, title gallery, UI
  gallery, journal and save, dialogue, battle scene, sound, harness, gamepad)
  plus the gameplay flows tagged `@smoke`; each gameplay flow already checks
  its state hash against Bun (JavaScriptCore) for cross-engine determinism.
- Visual baselines live beside the e2e specs. Update them only after viewing
  the new image.
- Fixtures (`content/fixtures/<name>.json`) contain `area`, `spawn`, an
  optional `seed`, and an optional `party` (member ids, overriding the
  roster's `start` members; test-only). Sim scripts live in
  `tests/sim/scripts/<fixture>/` and are arrays of
  `{ frame: ActionFrame, ticks: number }` segments; `bun run sim` starts each
  from its folder's fixture and checks collision for Fae and every party
  member every tick, then runs `tools/sim/party-chain.ts` (a two-member party
  through the harness: valid, never teleporting, Maddie unchanged).
- `new-game/chapter-one.json` plays the whole story so far from a new game
  (both battles won, every door, the conversations, the tree house); a unit
  test pins its ending and the browser and Bun must agree on its hash. It is
  recorded by `tools/sim/chapter-one.ts`, which plays through the core like a
  careful player; rerun it after a story or map change (it names the step
  that no longer fits). Newer recorders (`tools/sim/record-*.ts`) build on
  `tools/sim/recorder.ts` (navigate, talk, battle), which records only arrows
  and Z, so the e2e can play every run back with real keys.
- The Playwright suite serves the harness build from the `/cloverhollow/`
  sub-path, so any root-relative asset URL fails in tests as it would on iOS.
  Locally it runs on 30% of the cores: headless Chromium renders in software,
  and more workers starve each other's GPU processes.
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
- Area kits (owner, 2026-10-08): an area is painted whole, approved, then
  split into a ground plate and props by `tools/art/kit.ts`
  (`docs/art/kit.md`). Every visible default prop pixel is the approved
  painting's; generated pixels only fill plate holes, finish a prop's parts
  hidden behind another prop, or become masks. The approved painting is kept
  in `art/source/areas/<area>/painting/`; the chosen Gemini samples in
  `art/source/areas/<area>/kit/`, so a rebuild makes no calls. Each
  subject's samples record the crop they came from (`crop.json`); a changed
  crop draws its subject again. `masks` reports a subject's errors (its seed
  or footprint outside its crop), which `pack` refuses, and warnings (its mask
  running into its crop's edge: the object cut off, or a neighbour leaked in).
- Gate: the owner approves the style of the first character and the first area
  before bulk generation. Approved 2026-10-05: Fae v2 (larger chibi head, messy
  hair with bangs and a high bun, white sneakers with orange trim, journal in
  the backpack), the bedroom at 70% scale, the town plaza, Maddie, the chaos
  frog (chaos, burst, soothed, and calm frames plus the aura), the sticker UI
  with the owner's tweaks (cream speaker tags, stitched borders, bolder
  labels), the battle screen (the frog centred, Fae facing him from the left,
  the blurred plaza behind), and the journal (an open book with notes and a
  sticker album; the JOURNAL button with a teal quill).
- Approved 2026-10-06 ("for now", open to iteration): the title screen, the
  kitchen and living room, Mom, Oliver, Meadow Park, the Zoomie Pup, the
  school hallway (with its stray letter fragment), Ms. Maple and Nurse Holly,
  and the raccoon in the purple hood; and all the wording the agents chose
  for Milestones 9 to 15 (the frog's and pup's calm lines, the journal notes,
  Mom and Oliver, the hall-pass puzzle, the raccoon and the tree house).
  "Ms. Maple" stays as the teacher's name for now.
- Waiting for the owner's review (Milestones 17 to 28, and art drawn ahead):
  Maddie at her true proportions, Sue's atlas and lines, the Bubblegum Bay
  painting, the bluebird and its lines, Jordan's atlas, the Pinecone Pass
  painting, the hamster hiker, the bus stop, the Cliffside Trail painting, the
  bunny and the squirrel, the blacklight lantern and its glows, the gull, the
  Whispering Woods and its owl, coins and shops, the recurring critters'
  cat and raccoon battle atlases and wording, and the arcade's painting and
  Mr. Pip (`docs/review-queue.md`). The
  talking raccoon's atlas (approved 2026-10-06) left the game with the
  talking raccoon; its recipe and raw sources stay
  (`art/recipes/raccoon-npc.json`).
- Style bible: `docs/art/style-bible.md`.

## 13. Out of scope until the owner adds it
Multiplayer, merch, speedrun, boss rush, New Game Plus, achievements,
analytics, voice acting, day/night, weather, fishing and bug minigames, photo
mode, home customization, and non-English localization. Keep player-facing
text in Ink or JSON so it stays translatable.

### Milestone 26 additions, The Whispering Woods
The west Pinecone Pass arrow trigger requires `found_old_trail` and leads to the
`woods` area, whose reverse trigger returns to the pass. The Whispering Woods is
a 1750x1100 forest clearing in the `forest` land, with a north clubhouse,
roaming `owl`, and `clubhouse` interactable. The owl uses `owl.json`, has chaos
screeches and swoops, a wise `owl_calm` knot, and the full Soothe, Play, Cast,
Juggle, Snack, and Run command set. The clubhouse knot records the purple soda,
comic books, half-eaten fizzy cracker, and lantern-revealed note about meeting
“the boss” at the sealed Ancient Tree in the Enchanted Forest. Once the owl is
calm it sets `clubhouse_claimed`; Sue promises a fridge and Jordan a garden.
Journal output records the trail, owl, and clubhouse beats newest first.
Its stream is water (blockers along its banks); Fae crosses it on the stepping
stones. Its floor is the painted clearing, one polygon round the open ground
and the stream's banks: the forest behind the clearing, the big trunks, and
the ground behind the clubhouse are off it, and corridors behind the edge
trunks keep its two exits.
