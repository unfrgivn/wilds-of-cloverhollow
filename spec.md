# Wilds of Cloverhollow: spec

Last updated: 2026-10-18 (Milestones 53 to 58, and 60)

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
  hood, never named until the very end (owner, 2026-10-07). The kid is Milo,
  Fae's classmate (owner, 2026-10-17), and no line names him until the hood
  falls in the finale's calm-down. The kid knows their secret; the player
  doesn't. They're glimpsed running off and talked about through the story.
  Raccoons are an ordinary chaos critter species, met all over the world like
  the pups and the cats.
- The finale (owner, 2026-10-17; `docs/plan.md`, Milestones 53 to 56): Fae's
  three tools (the lantern, the lasso, and the flute) unseal the Enchanted
  Forest, and the calm-down under the Ancient Tree is Trace (she paints the
  kid's scribbles back) and then Talk (she reaches him with what the clues
  say).
- Finale twist: Mom wakes Fae up. It was all a dream. A short playable
  morning follows (Milo waits by the front door in a purple hoodie), then the
  credits and the title; Continue returns to the dream, the forest calm.

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
  -1..1) plus booleans `confirm`, `cancel`, and `menu`, and optional
  `lantern` and `flute`, each present only while pressed (like a touch
  `choose`): a blank
  frame, a recorded one, and a real key's frame then have the same shape, so a
  save's last input matches a new game's (section 10), and older recordings
  and their hashes stand. A trace check may additionally carry
  `pointer: { x, y }`, integer coordinates from 0 through 1000 in the trace
  square, only while a finger is down; `blankInput()` has no pointer. Only
  touch supplies it, and the device merge (`combineInputFrames`) passes it on
  untouched. Button
  edges (pressed this tick) are derived in the
  core from the previous frame.
- Taps are never lost: a key pressed since the previous tick counts as held for
  that tick, even if it was already released.
- Keyboard: arrows or WASD move; Z, Space, or Enter confirm; X or Escape
  cancel; J opens the journal (`menu`); L switches the blacklight lantern on or
  off (`lantern`); F plays the flute (`flute`, Milestone 47). On touch, a
  lantern button beside the journal button appears once Fae has the lantern
  and glows lavender while it's on, and a ♪ flute button beside it once she
  has the flute. The tool buttons step aside while a conversation or a battle
  is open: the tools do nothing then, and the dialogue reserves room for
  confirm and cancel only.
- Gamepad (standard mapping) and touch (virtual stick plus buttons, section
  3.2.1) map to the same frame. The left stick uses a radial 25% dead zone,
  rescaled so its remaining range is 0..1; d-pad directions (standard buttons
  12..15) override the stick. A/Cross confirms, B/Circle cancels, Y/Triangle
  or Start opens the journal, X/Square toggles the lantern, and the right
  shoulder (RB/R1, standard button 5) plays the flute. Only
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
  gameplay. Arcade transitions add `claw-move`, `claw-drop`, `claw-grab`,
  `claw-miss`, and `prize-won` for the claw machine, and `skee-aim`,
  `skee-roll`, `skee-score`, `skee-hundred`, and `tickets-won` for skee-ball,
  and `mole-pop`, `mole-boop`, and `mole-whiff` for Boop-a-Mole.
- `src/platform/audio.ts` creates the AudioContext first thing at boot,
  before anything awaits, and resumes it at every chance: right away, on each
  key, pointer, or touch, and whenever a cue plays while it isn't running.
  Browsers hold it (`suspended`, or WebKit's `interrupted`) until a key,
  click, or tap; a gamepad press is not a user activation in any browser, so a
  pad-only player on the web hears nothing until one. The iOS app's web view
  lets it run at once (Capacitor sets `mediaTypesRequiringUserActionForPlayback`
  to none), so pads get sound there from the start. It synthesizes short,
  gentle tones in code at a moderate master gain. Audio unavailable or held
  must never break the game. The context exists before the page has loaded:
  Playwright runs each evaluate in Chromium as a user gesture, and a context
  made after one would start without a key (`sound.spec.ts` slows every
  script to check).
- iOS: Web Audio keeps WebKit's default `ambient` session, so the ring/silent
  switch mutes the game (Apple's guidance for non-essential game sound).
- Sound is on by default. Mute is toggled by M or the `♪ on/off` pill on the
  journal's notes heading (a 44 px sticker pill, drawn taller than the coin
  and snack pills because it is a control), and is stored separately under
  `cloverhollow-audio` in Capacitor Preferences, never in the save.
- A four-step volume control (25%, 50%, 75%, 100%) sits beside the mute pill
  in the notes heading. It is a sticker-style 44 CSS-pixel control with a
  slider role: taps/clicks cycle through the levels, and arrows, Home, and End
  work from the keyboard without stealing the journal's page-flip arrows. Its
  visible value is accessible by keyboard, touch, and mouse. 100% keeps the
  existing moderate master gain. There is no zero step, so mute stays an
  independent choice and unmuting restores the selected level. The old
  boolean-only preference shape loads at 100%.
- Story lines may carry one of the closed `sound:` tags `chime-red`,
  `chime-yellow`, `chime-green`, `chime-blue`, or `flute`. The tag is carried
  by dialogue state and projected as a cue whenever that line opens or replaces
  another line, including when the text is repeated. Unknown story sounds are
  rejected by the content loader. The music-room recipes are synthesized
  xylophone bars (C5, E5, G5, C6) and a short breathy rising flute call.
- Footsteps use a closed surface set (`grass`, `sand`, `wood`, `snow`, `stone`,
  `tile`, `carpet`). Each area has a required `content/surfaces/<area>.json`
  with a default and first-match polygon regions in area units. The loader
  rejects unknown surfaces, malformed or out-of-bounds polygons, and a missing
  file throws an error naming `content/surfaces/<id>.json` and directing registration
  in `src/content/load.ts`. Surface lookup is pure and footstep cues are
  `footstep-<surface>`; the current platform recipes are synthesized and remain
  replaceable by clips pending the owner's pick. The plaza's default is stone,
  because it is a paved square.
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
- The Pond Pup's atlas (`public/assets/characters/pond-pup/`, Milestone 47):
  Maddie's frame contract (256x256, baseline 247, the same six animation
  names). He stands about 50 units tall, sits about 51, and his idle down is
  sitting. Built by `tools/art/build-pond-pup.ts` from whole figures
  (`tools/art/extract-figures.ts`), one scale per source sheet.
- The Acorn Squirrel's atlas (`public/assets/characters/acorn-squirrel/`,
  Milestone 60): the same frame contract. His walks are hops: upright toward
  and away from the camera, a bound on all fours to the side. He sits about
  46 units tall (his idle down is sitting up) and stands about 62 hopping
  toward the camera, his tail over his head. Built by
  `tools/art/build-acorn-squirrel.ts` the pup's way, one scale per source
  sheet, chosen so his acorn cap is one size from every side.
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
  game), an optional `joins` Ink variable (null for starters), an optional
  `befriended` Ink variable (true once the member is Fae's friend, where that
  differs from following her: a flute friend's `joins` is true only while it
  follows, so every flute friend names one and the loader refuses one
  without; the credits read it, section 7.4), an optional
  `flute` (a flute friend, below), and one battle `command` (`{ id, label,
  resting }`, section 8; null for a flute friend). Exactly one of `start: true`
  or a non-null `joins` is required, and a joins variable must be declared.
  Maddie is `maddie`: box 44x60, `walkCycleUnits` 84, sits, starts, command
  `play` / "Play" / "resting". Sue (`cast` / "Cast" / "reeling in", joins
  `sue_joined`) and Jordan (`juggle` / "Juggle" / "finding pinecones", joins
  `jordan_joined`) follow in roster order. A party of three fits at every
  spawn: members after the first also try wider diagonal heel slots, after the
  existing candidates, so no earlier placement moves and no spawn has to.
  `state.party` is the ordered list of members, each
  `{ id, x, y, facing, motion, stillTicks, trail }`. No one joins while
  `finale` isn't null: the morning's party is Maddie alone (section 7.4),
  though the dream's join variables are still true.
- Flute friends (Milestone 47): a roster member with `flute: true` is an
  animal friend Fae calls with her flute. It has `command: null` (no battle
  command) and a `joins` variable, and it's the only kind of member that
  leaves: while its variable isn't true, it's out of the party. It sits
  battles out: the battle party (`battleParty`) is the members with a
  command, so it gives no command and isn't drawn in the battle scene. A
  flute friend may name the recurring critter kind it is (`critter`, a
  critter id): joining while a calm one of that kind is out in Fae's area,
  the nearest steps out of the area into the party, where it stood (it
  leaves `state.wild` for the visit); otherwise it comes from a follower
  slot, like anyone joining. The Pond Pup is `pond-pup` ("Pond Pup"): box
  44x56, `walkCycleUnits` 84, sits, joins `pup_with_me`, befriended
  `pup_friend`, critter `pup`. After
  him, the Acorn Squirrel is `acorn-squirrel` ("Acorn Squirrel", Milestone
  60): box 40x56, `walkCycleUnits` 72, sits, joins `squirrel_with_me`,
  befriended `squirrel_friend`, critter `squirrel`, last in the roster. Both
  can come along at once: the whole roster fits behind Fae at every spawn
  (the area checks).
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
  The kitchen's front door `requires` `dreaming` (knot
  `front_door_morning_notice`), so it's shut only in the morning (section
  7.4).
- Every room is an open cutaway, a diorama with no front wall: its doors
  stand on its back and side walls, or its floor runs off the painting's
  edge. The school hallway's front doors are glass double doors at the left
  end of its back-left wall (trigger `front-doors`, a band along the whole
  painted door, to `plaza.school-path`; spawn `front-doors` (290, 625)
  facing down, by the doormat).
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
  counter, a claw machine, a skee-ball lane, a gumball machine). Its door is on the back-left
  wall: trigger `door` to `plaza.arcade-door`, spawn `door` (270, 535) facing
  right. The plaza's trigger `arcade-door` (the storefront's door, x
  1385-1440, y 455-500) leads to `arcade.door` and `requires`
  `clubhouse_claimed` (knot `arcade_closed`, the locked door); spawn
  `arcade-door` (1412, 560) faces down. Mr. Pip, the arcade keeper, is its
  set piece at (630, 392), at the left end of the ticket counter. Look
  points: `claw-machine` (prompt `Play`, at (908, 477), the left of its
  front, clear of the lane), `ticket-counter`, `star-racer` (a back-row
  cabinet), `boop-a-mole` (prompt `Play`, at (290, 462), the front of the
  first cabinet, Milestone 46), `comet-cruise` (prompt `Play`, at (366,
  433), the front of the teal second cabinet, Milestone 59), and `skee-ball`
  (prompt `Play`, at (850, 593), on the lane's foot near its left corner, so
  Fae plays from its left).
  Since Milestone 58 the room is nearer its concept
  (`art/recipes/arcade-concept-edits.json`): neon "ARCADE" (pink) and "PLAY"
  (teal) on its walls, "TICKETS" on the counter and "CLAW" on the claw
  machine. Milestone 61 rearranged it (`art/recipes/arcade-rearranged.json`):
  the skee-ball lane stands in the back-right corner, its hood against the
  wall in front of the claw machine's right side and its foot toward the
  middle of the room; one big red gumball machine, kid height, stands at the
  front corner facing into the room (its plain back to us); the floor between
  them stays open. The lane's first place on the front-left floor (Milestone
  45), the rocket cabinet and the gumball machine beside the claw machine
  (Milestone 58), and the three gumball machines on stands are gone: their
  floor is the approved painting's again, and the lane's hood was painted
  where the stands were.
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
  bleachers, a bench pair, and the back door to the playing field (trigger
  `back-door` to `field.gym`, `requires` `recess`, knot `back_door`, the shut
  door; spawn `back-door` (960, 490) facing down). Coach Ash, the
  PE teacher (`coach`, knot `coach`), stands at (560, 720). Look points:
  `hoop`, `ball-bin`, and `climbing-rope`. The gym pup is its set
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
- The clubhouse kitchen (Milestone 52): once the club is claimed, Mom gives it
  her old microwave and her old toy chest, first thing when Fae talks to her
  (`mom.kitchen`: `has_microwave`, `has_chest`). Both are added props in the
  clubhouse (section 6.2), cut from an edit of its painting
  (`clubhouse-kitchen.png`): the microwave on the fridge (prop `microwave`,
  sorted just in front of it) and the chest on the floor under the drawings
  (prop `chest`, solid), each `there` while its variable. Once the microwave's
  given, Mom's freezer (the kitchen's `fridge` look point) gives a box at a
  time: dino nuggets (`has_nuggets`) or mac n cheese (`has_mac`). With a box,
  the clubhouse fridge's look point offers to cook it (`play: cook-nuggets 0`
  or `play: cook-mac 0`, the cooking game, section 8.2; the box used up,
  `meals_cooked` up by one) or to open the fridge as ever. The chest's look
  point (`chest` at (410, 452); the drawings on the wall before the chest
  comes) shows what Fae has found, oldest first, each from the variable that
  says she found it: the pup's purple thread (`pup_calm`), the note from under
  the comics (always: the club is claimed), the hooded kid's marker
  (`saw_hood`), the Star Racer token (`stash_found`), the pond's tin
  (`pond_tin`), the treasure map (`has_map`), a bow from Rosie's kite
  (`kite_returned`), and the golden acorn (`acorn_found`, Milestone 60). The
  journal tells of the freezer, the box in hand, and the chest.
- Lasso spots (Milestone 49): once Fae has Coach Ash's lasso, three things
  are stuck out of reach, each an added prop (section 6.2) shown while
  `has_lasso` and hidden again once it's down. In Meadow Park, Rosie's kite
  hangs on the play tower (prop `kite`, state `stuck`; look point `tower` at
  (1040, 548)): lassoed down (`kite_seen`, `kite_down`), it goes back to Rosie
  in the classroom, after her first talk, for her six arcade coins
  (`kite_returned`, `gift: coins 6`). At Bubblegum Bay, a bottle bobs past the
  dock's end (prop `bottle`, state `bobbing`; look point `dock-end` at (1540,
  315)): reeled in (`bottle_seen`, `has_map`), it holds a treasure map, and
  digging between the two palms by the big log (look point `palms` at (1600,
  960)) finds twenty coins (`treasure_found`, `gift: coins 20`). At Pinecone
  Pass, the cocoa seller's scarf is caught on a lift chair (prop `scarf`, state
  `stuck`; look point `ski-lift` at (500, 412)); she misses it at the stand,
  and lassoed down (`scarf_seen`, `scarf_down`) and given back, it's a mug of
  cocoa on the house (`scarf_returned`, `gift: snack 1`). The journal tells
  each errand from when it's seen, then how it ended. Each placement's rules
  are `default` while its down variable, then the shown state while
  `has_lasso`.
- The Misty Path (Milestone 53) is area `mist`, named "Misty Path", in the
  `enchanted` land, 1650x1100 units. Its `field`, `stones`, and `forest` spawns
  are the field path, stepping-stone landing, and forest side of the seal. Its
  field trigger returns to `field.mist`. The `mist-band` crossing opens with
  `found_mist_way`, and `gully` opens with `rope_bridge`. Four bluebell glows
  lead to `mist_flowers`; reading the last one sets `found_mist_way` and uses a
  `travel:` line to move Fae to `mist.stones`. Look points are `mist-band`,
  `gully-posts`, and `seal`; the gully point pulls the bridge with `has_lasso`.
- The seal has red, yellow-green, and blue bell flowers. Its choices are Red,
  Yellow, Green, Blue, and Stop. The class song is red, yellow, blue, red. A
  wrong tune gives a hint. The four note lines carry `flute-red`,
  `flute-yellow`, `flute-green`, and `flute-blue`; the right tune sets
  `seal_open` and shows the open seal for Milestone 54. The journal tells each
  stretch as it opens. The map shows Enchanted Forest as `???` until Fae finds
  the Misty Path or enters that land.
 - The Misty Path's east arch mouth extends the walkable floor to x 1350 around
   y 530 to 625. Its thin `forest` trigger leads to `enchanted.mist` and requires
   `seal_open`, playing `mist_seal` while the seal is shut.
 - The Enchanted Forest (Milestone 54) is area `enchanted`, named "The Enchanted
   Forest", in the `enchanted` land, 1650x1100 units. Its `mist` spawn is the
   forest side of the seal. Its `mist-door` trigger returns to `mist.forest`.
   The Misty Path's `forest` trigger leads here and requires `seal_open`.
  - The forest has the hooded-kid battle set piece and four fairies: lavender, mint,
   sky, and peach. The lavender fairy's `fairy_lavender` knot alone sets
   `heard_wish`. The pond and Ancient Tree are look points, with their after-
    lore lines unlocked by that variable. Walking into the kid starts its battle;
    its calm `milo_calm` knot reveals Milo and has a short `again` line on later
    talks. No line before the soothed reveal names Milo. Seven ambient entries draw the butterflies and fairy lights from
   the tick, and `renderInfo().ambient` exposes the seven current flyers.
 - The forest's `forest_fizzy` variable starts true. `tree-scribbles`, the
   scribbled stones, and `pond-fizz` are chaos overlays with restored default
   states. Milestone 55 clears `forest_fizzy` as part of the calm-down.
 - The forest kit includes the painted lower-right stone and the chaos overlays
   as added props. Props use `flat` where nobody can stand behind what they are
   painted on. The scoped opt-in `"key": "bright"` selects dark-purple paint's
   bright key colour; it is not a global art-pipeline setting.
 - The forest journal notes cover the fairies, the fizzy pond, the dreaming tree,
   and the kid's secret forest, newest first as each clue is found.
- Flute friends (Milestone 47): once Fae has the flute, a calm Pond Pup's
  talk (`pup_calm`, after its first) offers Pet him and Share a snack; doing
  both, in either order, makes the pups her friends (`pup_petted`,
  `pup_fed`, `pup_friend`; a snack shared is `feed: snack 1`, and without one
  Fae says where snacks come from). Then a calm pup greets her as an old
  friend. The `flute` knot calls the Pond Pup (`pup_with_me`, so he joins)
  or sends him home; before she has a friend, nobody comes, yet. The park's
  pond is a look point (`pond` at (930, 838), its south rim): something
  glints at the bottom (`pond_seen`), out of reach; with the Pond Pup along,
  "Fetch, boy!" sends him swimming for an old tin of twelve coins
  (`pond_tin`, `gift: coins 12`), once. The journal tells of the tin, the
  glint until then, and the friend, on top.
- A second flute friend (Milestone 60): the Acorn Squirrel, the Cliffside
  Trail's recurring squirrel, bonds the pup's way. Once Fae has the flute, a
  calm squirrel's talk (`squirrel_calm`, after its first) offers Scratch his
  chin and Share a snack; both, in either order, make him her friend
  (`squirrel_petted`, `squirrel_fed`, `squirrel_friend`). Then a calm
  squirrel greets her as an old friend. The `flute` knot offers a call or a
  send-home for each friend (the pup's, then the squirrel's, then Just play),
  so with only the pup a friend its choices are what they were, and both
  can come along at once. In the Whispering Woods, the big west oak's painted
  knothole has a look point at the oak's foot (`knothole` at (400, 635)):
  something rattles inside (`knothole_seen`), too high to climb and too small
  for a hand, and no place for a lasso; with the Acorn Squirrel along, "Up
  you go!" sends him up for a golden acorn and a pile of hazelnuts
  (`acorn_found`, `gift: snack 3`), once. The journal tells of the acorn, the
  knothole until then, and the friend, above the pup's notes.
- The lodge keeper (Milestone 57): once Fae has calmed a hamster at Pinecone
  Pass (`calmed("hamster")`, its sticker), the lodge's note leads on
  (`lodge_door.back`): a snowball whizzes past, and its keeper, Mrs. Flurry,
  is home and fizzy (`keeper_back`), a set piece on her porch. Calmed, she
  tells of her runaway hamster Biscuit and the hooded kid's soda, and opens
  the lodge (`lodge_open`): its door is open (the pass's added prop
  `lodge-door`, state `open`, cut from `pass-lodge-open.png`), and walking
  into it (trigger `lodge`, `requires` `lodge_open`, knot `lodge_door`; spawn
  `lodge` (1195, 545) facing down) goes in. The journal tells of her fizzy,
  then calm.
- The lodge (Milestone 57): `lodge`, "Mountain Lodge", in the `pass` land, a
  1200x800 painted cutaway of the log lodge's one room, split into a kit (a
  counter with the cocoa pot and the guestbook, the stone fireplace, two
  armchairs and a side table, and Biscuit's house; all painted). Its door, in
  the left wall, leads back out (trigger `door` to `pass.lodge`; spawn `door`
  (270, 540) facing right). Look points: the fire (`lodge_fire`), the cocoa
  (`lodge_cocoa`: one mug to take along, `gift: snack 1`, once), the
  guestbook (`lodge_guestbook`: a name signed in purple marker and scribbled
  out, and a paper plane doodled in the corner), and Biscuit asleep
  (`lodge_hamster`). Its floor is wood, and its fixture `lodge` stands at the
  door with the whole party.
- The clubhouse (Milestone 43): `clubhouse`, "Clubhouse", in the `forest` land,
  is a 1200x800 painted cutaway of the Whispering Woods tree house's one room
  and its deck. The ladder at the tree house's front in the woods is a door
  (trigger `clubhouse` to `clubhouse.ladder`, `requires` `clubhouse_claimed`,
  knot `club_ladder`; the woods' spawn `clubhouse` (735, 548) faces down).
  Inside, the ladder's top in the deck's hole leads back down (trigger
  `ladder` to `woods.clubhouse`; spawn `ladder` (687, 493) facing up). Its
  floor is the plank floor and the deck inside the rope railing. Its props
  are the old fridge, the crate table with its comics, the beanbag, the
  two runs of rope railing, and the three planter boxes as one prop, the
  garden. Look points: `club-fridge` (knot `club_fridge`), `club-garden`
  (`club_garden`), `comics`, and `bottles` (the kid's purple soda bottles).
- The fix-up (Milestone 43): the fridge's `fixed` state (while
  `fridge_fixed`) and the garden's `planted`, `growing`, and `ripe` states
  (while `garden_planted`, `garden_sprouted`, and `garden_ripe`; the ripest
  that holds wins) are cut from three more paintings of the room. Sue fixes
  the fridge; Jordan plants strawberries. Through the calm hook (section 7)
  every calm after the planting grows the garden: one sprouts it, three ripen
  it, and a ripe garden waits to be picked. Picked (once the fridge works), a
  basket goes into the fridge (`fridge_baskets`) and the plants are left one
  calm along, so two more calms ripen them again. Each basket is three snacks
  (`gift: snack 3`), all taken at once.
- Recess (Milestone 39): the flute's last line rings the bell (`recess`), and
  Coach Ash props the gym's back door open. `field`, "Playing Field", is a
  1650x1100 painted schoolyard behind the school (no concept sheet): the
  school's back wall and its door (trigger `gym` to `gym.back-door`; spawn
  `gym` (615, 365) facing down), a hopscotch, bike racks, a soccer goal, a
  tetherball, a bench, a flowering hedge, an old oak whose branch reaches over
  a creek, and, on the creek's far bank, an old stump and a footbridge raised
  on its posts with a lever high on its post. Its floor is the painted ground,
  traced from the painting; the creek is blockers, and the deck's line across
  it is the crossing `creek` (opens with `bridge_down`, section 6.2).
  - The oak squirrel (set piece `oak-squirrel`, a squirrel, "Fizzy Squirrel"
    in battle) guards the oak. Calmed, it tells how the kid in the purple
    hood swung across the creek on the branch.
  - The gap: the Look point `oak-branch` (knot `oak_branch`) needs the
    squirrel calm and `has_lasso`; the lasso swings Fae over the creek
    (`swung`, `travel: field.east-bank`; spawn `east-bank` (1340, 330)),
    as often as she likes.
  - The far bank: the hooded kid's stash behind the stump (Look point
    `stash`, knot `hood_stash`, `stash_found`), and the lever (Look point
    `lever`, knot `bridge_lever`): the lasso pulls it (`bridge_down`), and
    the bridge's and lever's rules lay the footbridge across the creek and
    pull the lever down, opening the crossing for the way back.
  - Also: `hopscotch` and `tetherball` to look at. Nobody names the kid.
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
  east path; its floor is written by `tools/art/geometry/trail.ts` and every
  standing thing on it (its rocks, pines, bench, signpost, and reeds) is a
  kit prop, solid on its own footprint (section 6.2), so it has no blockers.
  Its ways in and out are thin triggers on the
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
- Ambient flyers (Milestone 54): an area may define `ambient` as flyers with
  `{ id, animation, path, loopTicks, phase, frameTicks, size }`. `path` is a
  closed loop of at least three in-bounds `[x, y]` world points; `loopTicks`
  and `phase` are integers with `loopTicks >= 120` and `0 <= phase <
  loopTicks`, `frameTicks` is an integer of at least 1, and `size` is the
  drawn height in world units. Animations are names in
  `public/assets/ambient/ambient.json`. Flyers move at constant arc-length
  speed with a small render-only bob, change atlas frames at `frameTicks`, and
  mirror while travelling left. They draw above overworld figures and props,
  below the fade, dusk tint, and glows, and are hidden in battles. They never
  enter simulation state, hashes, or saves.
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
  any of their states). Canopies, flat states, and hidden states don't count. The checks
  count every footprint of every prop state as solid, since the story may
  change a state, except where a crossing's flag settles it (section 6.2).
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
  arcade keeper (the arcade), the gym pup (the gym), and Mrs. Flurry, the
  lodge keeper (the pass, on her porch at (1300, 590), while `keeper_back`).
- Recurring critters, EarthBound style, are an area's `recurring`:
  `{ after?, dens: { point, radius, kinds, chance? }[] }`. On every arrival
  (a door, a bus ride, a rest's fade, and the start of a game or fixture)
  each den, in order, draws twice from the state's PRNG: is one out
  (`chance`, default 1), and which of its `kinds`. Every den draws whatever
  comes out, so an arrival's draws depend only on the content. Until
  `after` (a `calmed()` fact) is true the area draws nothing and is quiet:
  the plaza waits for the fountain frog. The ones out this visit are
  `state.wild`: `{ kind, den, mood, x, y, target, pauseTicks,
  cooldownTicks, facing, moving, notice }`, starting at their den in chaos,
  `notice` 0. One Fae
  calms stays calm, a Talk target, only until she leaves; the next arrival
  rolls the area fresh.
- A recurring critter wanders inside its den's radius and comes after a
  Fae it has noticed in its sight (section 8); its home is its den's
  point.
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
- Surface maps live beside props in `content/surfaces/<area>.json`: `{ default,
  precedence: "first", regions: [{ surface, polygon }] }`. `default` and each
  region's `surface` are from the closed set in section 3.3. Regions are tested
  in file order, polygons must have at least three finite points and stay inside
  the area's bounds, and every loaded area, including `harness`, has a file
  registered in `src/content/load.ts`.
- Collision: each prop's current footprint is solid for Fae, the party, and
  roaming critters, like a blocker (`sceneryArea`); spawning and joining
  party slots avoid them too.
- A flat state lies on the ground (Milestone 39, the lowered footbridge): it
  has no footprint, it's drawn on the ground layer under everyone (never in
  strips), and it never covers or hides anyone. `renderInfo().props` reports
  each prop's `flat`.
- A hidden state is a prop not being there (Milestone 49): in the catalogue it
  is only `{ "hidden": true }`, with no frame, no footprint, and an empty
  silhouette, so nothing is drawn and it covers nobody; a prop must have some
  state that isn't hidden. `renderInfo().props` reports each prop's `hidden`.
- Crossings (Milestone 39): an area's `crossings` are `{ id, polygon, opens }`:
  ground that's solid (water, say) until the Ink variable `opens` is true,
  then walkable (`sceneryArea`), like a bridge laid over it. The area checks
  walk every combination of an area's crossing flags as its own scenario,
  each prop in the states its rules allow then (a rule on an open flag
  settles the prop's state; one on a shut flag is skipped; any other rule may
  or may not hold): look points, set pieces, and party slots must work with
  every crossing shut, the floor must be one piece with every crossing open,
  and nothing may hide Fae in any scenario. A spawn may not stand on a
  crossing, a crossing may not overlap a door, and its flag must be a
  declared Ink variable.
- A kit subject can be a state of another (`stateOf: "<prop>.<state>"`) cut
  from another painting of the area at the same size (`painting`), so a
  state can be painted in place (the lowered footbridge and the pulled
  lever, from the field painted with the bridge down); it's registered
  against its prop's home and may be `flat`. `keepPieces` keeps every solid
  piece of an isolate in its crop (a deck a post cuts in two). An `exclude`
  polygon is part of neither the prop nor its hole: it stays in the plate.
- An added prop (`added: "<state>"`, Milestone 49) is an object the approved
  painting doesn't have, painted into an edit of it (`painting`, the same
  size) and cut there like a painted subject: it leaves no hole, since the
  plate is the painting without it. Its catalogue entry is hidden by default
  and drawn in the `added` state, which the area's rules show; it's drawn
  whole like a lifted prop (`painted` false). Rebuilding the default layout
  leaves it out.
- The Misty Path kit (Milestone 53) uses painted canopies and solids from its
  whole painting, plus a lifted rope bridge. The bridge's `across` state is a
  flat bridge from the second painting and is shown while `rope_bridge`.
  `mist-stones` and `seal-open` are added props from that second painting,
  hidden until `found_mist_way` and `seal_open` respectively. Only ink-outlined
  objects are taken from the second painting; its colour cast is not treated as
  new scenery.
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
  while it covers more than 5% of Fae's body box;
  `renderInfo().canopies` lists them.
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
  Fae never walks behind it), the school hallway (the trophy cabinet and the
  lockers on the nurse's block),
  the classroom, the gym, and the arcade (the five cabinets, the ticket
  counter, the claw machine, the skee-ball lane, and the gumball machine;
  the claw machine's `front` lists the lane, whose hood hides its right
  side). The kitchen's
  `stairs` spawn is (600, 650), facing right, so the whole party fits behind
  Fae at the foot of the stairs.
- The outdoor areas (Milestone 34) are kits too, so every area is: Meadow
  Park (the tree house, the tower, two bushes, the basket, five fence runs, the
  park sign, the pond), Bubblegum Bay (the near dock rail, the umbrella, the
  sign, three palms, two driftwood logs, three beach balls, the bucket, two
  spades, the picnic basket), Pinecone Pass (four pine stands, the lodge, the
  cocoa stand, three groups of benches, the bus shelter, the lift towers, the
  snowman, the signs), the Cliffside Trail (pines, rocks, the signpost, the
  lookout bench, the footbridge's near rail as one prop, two reed clumps),
  and the Whispering Woods (its trees, the tree house, three logs, two fern
  beds). Trees, ferns, reeds, the bay's sign and its umbrella fade while Fae
  is behind them (canopies).
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
- The finale tags (Milestone 56) take no argument (load validation refuses
  one) and act as their line's dialogue closes. `# ending` (the last line of
  `tree_ending`) emits an `ending-save` event carrying the dream as it stands,
  dialogue closed and `finale` null, then wakes Fae: `finale` becomes
  `morning`, she is in the bedroom at `bed` (her safe spot too) with Maddie
  alone, `morning_start` sets `awake` and clears `dreaming`, and Mom's `mom`
  knot opens. `# credits` (the last line of `front_door_morning`) sets
  `finale` to `credits`. A story with `# ending` must have the bedroom, its
  `bed` spawn, and the `morning_start` and `mom` knots (load validation). The
  morning and the credits are section 7.4.
- A line may carry `# buy: snack <price>`: as it's shown, Fae pays `price`
  coins for one snack if she has them (`purchaseSnack`). The story's
  `coins()` external answers her coins, so a shop only offers to sell when
  she can pay. The shops are the plaza bakery (interactable `bakery` at
  (1180, 420), under its window) and Pinecone Pass's cocoa stand
  (`cocoa_stand`), 5 coins a snack. Their choices are sticky (`+`), so they
  sell on every visit.
- A line may carry `# gift: snack <count>`: as it's shown, Fae gets `count`
  snacks for free (the clubhouse fridge, Milestone 43). `# gift: coins
  <count>` gives her coins (the pond's tin, Milestone 47), and `# feed: snack
  <count>` gives snacks away (a treat for an animal friend), never below
  none; the story only offers it when `snacks()` says she has one. Item tags
  (`buy`, `gift`, `feed`) act on every line they're on, a conversation's
  opening line and a locked door's included.
- Load validation reads every tag in the compiled story (`storyTags`: a
  tag's text follows its `#` command, and its `/#` may close in an enclosing
  container) and rejects a travel tag naming an unknown area or spawn, any
  `buy` tag but `snack <digits>`, any `gift` tag but `snack <count>` or
  `coins <count>`, any `feed` tag but `snack <count>`, each count 1 or more,
  and any `play` tag but `<game> <digits>` naming an arcade game (`claw`).
- A line may carry `# play: <game> <price>` (Milestone 44): the dialogue keeps
  it to its close, and then, if Fae has the coins, she pays them and the game
  opens (spec 8.2). It is the one place a game's price is set.
- A line may carry `# trade: <prize> <price>` (Milestone 45): as it's shown,
  Fae pays `price` tickets for the prize if she has them and hasn't won it,
  and it joins `state.prizes`. The loader allows only the ticket counter's
  prizes at their content prices (`storyTagErrors` is given the counter's
  prices), so the story's offers can't drift from the counter's.
- The Ink adapter skips blank lines (a conditional line whose condition is
  false), and looks past blank lines after a line, so choices that follow
  them come with that line rather than as an empty step. The story's
  externals, `calmed(name)`, `coins()` (Fae's coins), `snacks()` (her
  snacks, Milestone 47), `won(prize)` (a prize she has won),
  `plushesLeft()` (how many plushes are still in the claw machine), and
  `tickets()` (her tickets, Milestone 45), are answered from
  the core's state (`inkFacts`) for every command, not only a knot's first
  line. `calmed` answers a set piece by its id from its own mood, and a
  species once Fae owns its sticker (she has calmed one of them, anywhere).
- The flute (Milestone 47): a flute press, once `has_flute` is true and Fae is
  free (no dialogue, battle, journal, or door), opens the story's `flute` knot
  like a talk. Its first line plays the `flute` story sound.
- The calm hook (Milestone 43): after every battle that ends in a calm (the
  reward's last confirm), the core runs the story's `on_calm` knot, if it has
  one, with the facts as they are then, and keeps the variables it sets. It
  must print nothing: a hook that prints a line or offers a choice changes
  nothing. The story uses it to count calms for the clubhouse garden.
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
  chosen for its friendly rounded forms and strong small-size legibility. It
  loads with `font-display: swap`, so text measured to fit (an arcade
  close-up's marquee, the fridge's front) is measured again when the page's
  fonts finish loading: measured before, it was fitted to the fallback font.
- UI safe-area insets are centralized as `--safe-top`, `--safe-right`,
  `--safe-bottom`, and `--safe-left`, sourced from the platform environment.
  Dialogue, choices, prompts, and touch controls all use these variables. A
  dialogue-open root attribute hides the virtual stick while preserving the
  confirm, cancel, and menu buttons.
- When touch controls are shown, the root has `data-touch="on"`, and CSS sets
  `--touch-reserve-right` to the confirm and cancel buttons' width plus their
  margin, the right inset, and 12 px. The dialogue box and choices end at that
  reserve, so they never cover the buttons. While Comet Cruise is open,
  `--touch-reserve-left` is the room its two arrows take at the bottom left,
  and its close-up keeps clear of it. Five or more choices on a screen
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
- After the credits, the title opens in `continue` mode over the dream
  (section 7.4).
- In dev and harness builds only, Q on the title opens the QA save library. A
  long press on the logo does the same on touch. `?qa=<id>` boots that named
  pack directly; unknown ids show an error listing the known ids. The title's
  production appearance is unchanged. QA mode is left by reload or relaunch.
- The Continue detail is the area's `name` (area JSON) and the sticker count
  ("0 stickers", "1 sticker", "2 stickers").
- Dev builds log `[cloverhollow] title {mode, options}` (the visible buttons'
  rects, CSS px) when the mode changes; `just ios-smoke` taps New game from
  them on a fresh install and Continue after the relaunch.

### 7.4 The wake-up and the credits (Milestone 56)
- `state.finale` is `null` in the dream, `morning` once the ending wakes Fae,
  and `credits` once Milo's last line closes (section 7's finale tags).
- Milo's talk after the calm-down (`milo_calm.again`, under the restored
  Ancient Tree) offers [Watch the tree glow], which plays `tree_ending`, and
  [Not yet]. Both are sticky (`+`), so after Continue the ending can be
  watched again.
- The morning is small and playable. Fae and Maddie are alone (no one joins,
  section 5). Mom wakes her in the bedroom, where she shows only while
  `awake`; she's in the kitchen too, as in the dream. Talked to again,
  upstairs or down, Mom sends Fae to Milo (`mom.morning_again`). Downstairs,
  Milo (`milo-hoodie`, shown only while `awake`) waits in his purple hoodie by
  the front door. That door needs `dreaming` (section 6), so in the morning it
  plays `front_door_morning_notice` instead of opening; in the dream it still
  leads to the plaza. The lantern and the flute do nothing. Talking to Milo
  plays `front_door_morning`.
- From the wake-up on, nothing is saved: `autosaveNeeded` is false while
  `finale` isn't null (section 10). The `ending-save` event's snapshot is the
  save; the shell writes it and keeps it for the credits.
- The credits (`src/ui/credits.ts`) are a paper sheet over everything: "THE
  END", FRIENDS, MET ALONG THE WAY, and "Thank you for playing!", from
  `creditEntries` (`src/core/credits.ts`). FRIENDS is each roster member who
  starts with Fae or whose `befriended` (else `joins`) variable is true, in
  roster order, on the frame `down_idle_01`. MET is each sticker in
  `state.stickers`, by its name, on its critter's atlas at the sticker's
  frame. Each entry is a small sticker over its name; the names and the
  thanks are at least 18 px. At 1180x820 and 1280x720 the largest credits
  (every friend and the whole catalogue) fit without scrolling; on a phone the
  sheet scrolls. On touch only the confirm button shows, at least 44 px and
  clear of the entries.
- The shell steps the core on every credits tick, and the core holds the
  world still (only the tick, the previous input, and the resting pose
  change), so the ticks and their input stay a replay's.
- A confirm counts after a 12-tick beat (`CREDITS_BEAT_TICKS`,
  `creditsConfirmAllowed`), so a press still down from Milo's last line can't
  skip the credits. It puts the kept snapshot back as the state, with no core
  tick, and opens the title in `continue` mode over it: Continue resumes the
  dream at the save's exact hash, as a later boot does. The credits only
  follow an ending in the same session (the morning is never saved), so
  closing them without a snapshot is a bug and throws.

## 8. Calm-down battles (v0)
- Talk phases: a critter kind may carry `talk` (`label`, the command's name;
  `prompt`, the battle's line while Talk is the only command; `talkAt`; three
  Ink knots; and great/good/miss calm amounts) and `canRun` (default true).
  Once calm reaches `talkAt`, the command menu contains only Talk, under the
  `prompt` line, with no burst,
  wind-up, feelings, or PRNG draws. Talk uses a battle-local dialogue state,
  including typed speaker text, wrapped choices, touch selection, and a grade
  tag on each selected Ink response. The grade adds its configured calm and
  the three knots play once in turn order. While any Talk knot remains, a kind
  with Talk content is clamped to `calmMax - 1`, including ordinary battle
  commands before `talkAt`; its final graded Talk response fills the meter to
  `calmMax` regardless of grade. Every Talk knot therefore plays.
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
  has its own lines, atlas, sticker, and calm knot. Mrs. Flurry, the lodge
  keeper (`lodge-keeper`, Milestone 57; feelings zoomy, grumpy, hungry; 25
  coins), is the second person, with Mr. Pip's numbers, friend commands, and
  wind-up (a giant snowball), and snowballs to catch. Each person's battle
  atlas is built by `tools/art/build-person.ts <id>` from one 2x2 body sheet.
- Mini-boss numbers: the Grumpy Gull has `overworldHeight` 110 (ordinary
  critters are 66 or 70), `battleHeight` 260 (ordinary critters are 190),
  `touchRadius` 85 (ordinary critters are 70), `calmMax` 160 (ordinary
  critters are 100), and `energyMax` 6 (ordinary critters are 5). Its burst
  `bigChance` is 0.5 (ordinary critters are 0.3), so its gust can hit harder.
  Its friend-command values and checks are every critter's (a check belongs
  to its command, not to the critter); the extra difficulty comes from its
  larger meter, extra energy, larger reach, and stronger burst, and from its
  wind-ups (Milestone 50, below), which Mr. Pip shares.
- The hooded kid (`hooded-kid`) is the finale set piece under the Ancient Tree.
  It has `calmMax` 200, `energyMax` 6, `touchRadius` 95, and pays 40 coins.
  It cannot run. Its Trace tuning is `reachRadius` 105, `brushSpeed` 20, and
  `dryTicks` 180. Its Talk starts at `talkAt` 100, always plays all three
  knots, and the final knot fills the meter. The three Talk grades add 35, 25,
  or 20 calm. Its battle atlas contains the chaos, burst, soothed, and calm
  looks. The battle reward is Milo's sticker.
- Friend commands: Maddie's Play, Sue's Cast, and Jordan's Juggle (pinecones;
  calm 30, great 15, good 5, rest 2 on every critter). Each plays its own
  check (Milestone 40): Play the ring (Maddie's pounce), Cast a charge (Sue
  winds up and throws her bobber), Juggle a beat chain. The menu lists Soothe,
  each member's command in party order, then Snack and Run: six with the
  whole party, in one column on desktop and two on phones (section 8.1).
- Content: `content/critters/*.json` (validated by the loader) supplies every
  battle number and line: the touch radius, calm and energy maxima, the
  `coins` it pays when calmed (8 for ordinary critters, 25 for the gull),
  command values (`commands.soothe`, `commands.snack`, and
  `commands.friends.<command id>` with `{ calm, great, good, rest }` for every
  party command), the burst (`bigChance`, its `check`, and an optional `big`
  check of the same kind), the sticker, and the calm knot and prompt. Friends
  decide how Fae calms and critters how they burst: Soothe's check is
  `commands.soothe.check` in `content/battle.json`, each friend's is
  `command.check` in its `content/party/` entry, and critters carry none.
  Lines follow the same split: `lines.soothe` and
  `lines.friends.<command id>` are per-grade. The loader rejects a critter
  missing a roster command (numbers or lines), and a party command whose id is
  `soothe`, `snack`, or `run`, or another member's. The shared command labels
  (Soothe, Snack, Run), the Snack `×N` template, the check hints, and the
  feelings live in
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
  intro -> command --Soothe / a friend's command--> check (on the critter) -> result
                   --Snack--------> result
                   --Run----------> run -> ends at entry, facing away
  intro -> burst (turn 0: a recurring critter that caught Fae bursts first)
  soothed (at once: a recurring old friend) -> reward
  result -> soothed -> reward -> ends: critter calm, its coins paid, the
            (when calm reached calmMax)     species' sticker added if new
         -> burst -> check (on Fae) -> burstResult -> command
            (or rest when energy reaches 0)
         -> command (a wind-up puffing on: no burst)
         -> fizzle -> command (a wind-up's last turn, every bubble popped)
  rest -> door-style fade to safeSpot; the critter stays chaos; nothing lost
  ```

- Reward (Milestone 28): every calm pays the kind's `coins`; the species'
  sticker comes only the first time. As the reward shows, `rewardSticker` is
  set to the sticker if it's new (the reward card shows it, with "New
  sticker: ... +N coins.") or null (no card; the line is "+N coins!"). The
  reward ends the battle with the set piece's or the recurring critter's
  mood calm. The aura and the check are gone at the reward.

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
- Checks (Milestone 40): every Fae-side command (side `critter`) and every
  burst (side `fae`) plays a check, `battle.check` (the phase is `check`): a
  copy of its spec plus its own progress. It stays as it ended, with its
  grade, through its own result message, and goes (with `lastGrade`) when any
  other message or a new turn starts; before Milestone 50 it lingered over
  the next turn's menu. A check is
  created at tick 0; each later tick adds one to its `tick`, then applies that
  tick's input. A confirm edge is a confirm not held on the previous tick; a
  touch `choose` is never one. Every check ends in a grade:
  - `ring` (`ticks`, `targetTick`, `greatWindow`, `goodWindow`): the first
    confirm edge is graded by its distance in ticks from the target (great
    window, then good); no press by `ticks` is a miss.
  - `charge` (`waitTicks`, `maxTicks`, `targetTick`, `greatWindow`,
    `goodWindow`): charging starts only on a fresh confirm edge, so the press
    that chose the command can't start it (that tick `held` is 1), and every
    later tick with confirm still down adds one. The first tick it's let go
    grades `held` against `targetTick` like the ring. Reaching `maxTicks` is a
    miss (overwound), and so is no press by `waitTicks` (a press on that tick
    still starts the charge).
  - `chain` (`travelTicks`, `hitWindow`, `arrivals`, `look`: `pinecone`,
    `bubble`, or `dust`): beat j lands at `arrivals[j]` and is seen travelling
    for the `travelTicks` before. Each tick, a pending beat more than
    `hitWindow` past its arrival is a miss; then a confirm edge goes to the
    beat whose arrival is nearest (the earlier on a tie). If that beat is
    pending and has appeared, it's a hit within `hitWindow` (inclusive), else
    a miss; otherwise the press does nothing. One press resolves at most one
    beat, so mashing misses and a late press never costs the next beat. Every
    beat a hit grades great, at least half good, fewer a miss. Each hit plays
    the `battle-beat` sound.
  - `catch` (Milestone 41; `travelTicks`, `arrivals`, `toys`): only a burst's.
    Toys fly at Fae in three lanes (0 high, 1 middle, 2 low), toy j landing
    at `arrivals[j]` in `lanes[j]`, drawn when the burst starts. No button:
    each tick the catch first moves to the lane the stick or arrows point at
    (up past -0.5 high, down past 0.5 low, else the middle), then every
    pending toy landing on that tick is caught if the catch is in its lane,
    else missed. Every toy caught grades great, at least half good, fewer a
    miss, like a chain, and each catch plays `battle-beat`. `toys` are frames
    of the toy atlas (`content/battle.json` `toyAtlas`), thrown in turn.
  - `trace` (Milestone 55; `dryTicks`, `brushSpeed`, `reachRadius`, and
    authored paths of at least four integer points in the 0..1000 square): the
    brush starts on the first point, which is hit on the first tick, then moves
    at most `brushSpeed` toward the pointer, or by the stick vector capped at
    length 1 and scaled by `brushSpeed` (so a light tilt moves slowly and a
    diagonal is no faster than straight). It is clamped to the square and
    reaches at most one next point
    per tick within `reachRadius`. At `dryTicks`, unresolved points miss. All
    hits grade great, at least half good, fewer miss, and every hit plays
    `battle-beat`.
  - `lean` (Milestone 48; `puffTicks`, `starts`, `forces`, `steer`,
    `spring`): only a burst's. A gust's puffs push Fae's balance, which runs
    from -100 (blown over backward) to 100 (leaned over forward) and starts
    straight at 0. Puff j blows from `starts[j]` for `puffTicks` at the force
    in `strengths[j]`, drawn when the burst starts. No button: each tick the
    puff in play (one still pending) pushes her back by its force, and the
    stick or arrows lean her by `steer`, forward into the wind past 0.5
    (right, toward the critter) or back past -0.5; with no puff in play and
    no lean she settles back toward 0 by `spring`, never past it. The balance
    stays within -100 and 100. Reaching either end in a puff loses it: it
    stops blowing and she stands straight again. A puff that blows its whole
    time is held, on its last tick. Every puff held grades great, at least
    half good, fewer a miss, like a chain, and each held puff plays
    `battle-beat`.
- Soothe and a friend's command add their calm plus the grade bonus, clamped
  to `calmMax`, and show that command's line for the grade. A burst's check
  starts with seeded PRNG draws, in this order: first the big roll (under
  `bigChance` it's big, plays `burst.big`, or the burst's `check` if the kind
  has none, and its base damage is 2, else 1; after a wind-up there's no
  roll, as its pops set the size), then one draw per catch toy,
  `min(2, floor(value x 3))` its lane, or per lean puff, `forces[min(n - 1,
  floor(value x n))]` its force (with n forces, each as likely). Ring and
  chain bursts make the one draw (none after a wind-up). Great, good, and
  miss deal 0, base minus 1, and base.
- Check numbers (Milestone 40): Soothe and Maddie's Play are rings of 60
  ticks, target 39, windows 5 and 11. Soothe stays the ring (owner,
  2026-10-17), not the no-timing Pet the battle ideas proposed. Sue's Cast is a charge: wait 180, max
  60, target 44, windows 5 and 11. Jordan's Juggle is a pinecone chain:
  travel 36, hit window 8, arrivals 40, 64, 88, 112. Both frogs' bursts are
  bubble chains (travel 40, window 8, arrivals 44, 70, 96; big 44, 66, 88,
  110, 132), the bunny's a dust chain (travel 30, window 8, arrivals 40, 66,
  92; big 40, 62, 84, 106, 128). The nine flurry bursts are catches
  (Milestone 41): the Zoomie Pup and the gym pup throw tennis balls, the
  Pouncy Cat yarn, both squirrels acorns, the hamster snowballs, both
  raccoons bottle caps, Mr. Pip tickets and tokens, and Mrs. Flurry her own
  snowballs (`snowball-05` to `07`, cut from her throw); four toys land at 54,
  78, 102, and 126 (travel 50), six when big at 54, 74, 94, 114, 134, and 154.
  The three gusts (both bluebirds and the gull) are leans (Milestone 48): two
  puffs of 56 ticks from 44 and 116, each force 2 or 3; big, three of 36
  ticks from 44, 94, and 144, all force 3; steer 5 and spring 3. Left alone,
  a puff blows her over; leaning blindly through it tips her over the other
  way; leaning back toward straight holds it. The owl's is a ring of 60
  ticks, target 45, windows 5 and 11. Every timed part fits in 180 ticks; a
  charge's wait for its first press isn't timed play (the player picks the
  moment) and gives up after its 180 ticks.
- The loader validates every check: a known kind; integer ticks;
  `greatWindow <= goodWindow`; the target's good window inside the ring or
  the meter (`targetTick - goodWindow >= 1`, `targetTick + goodWindow` under
  `ticks` or `maxTicks`); `waitTicks >= 1`; for a chain, `hitWindow >= 1`, the
  first arrival at least `travelTicks`, each later one at least
  `2 x hitWindow + 2` after the one before, and a known look; for a catch,
  the first arrival at least `travelTicks`, each later one at least 8 after
  the one before, and at least one toy; for a lean, `puffTicks` and `spring`
  at least 1, the first start at least 1 and each later one at least
  `puffTicks` after the one before (one puff at a time), and one or more
  forces, each at least 1 and under `steer`. A `burst.big` must be its burst
  check's kind, every party command needs a check, and neither Soothe's nor
  a friend's may be a catch or a lean.
- Hints: while a charge waits for its first press, before a chain's first
  beat or a catch's first toy lands, or before a lean's first puff blows, the
  battle view carries that kind's hint from `content/battle.json`
  (`hints.charge`, `hints.chain`, `hints.catch`, `hints.lean`, and
  `hints.trace`). A trace hint is shown while its second checkpoint is pending.
  It never uses `battle.message`, whose reveal would eat a confirm press.
- Feelings (Milestone 42): once two friends fight beside Fae, each bringing
  a battle command (Sue's arrival; a party member without one doesn't
  count), a chaos critter shows what it feels each turn, and the command that
  answers it is worth `feelingBonus` (15) more calm. `content/battle.json`
  `feelings` maps the closed set to a label and its answer: zoomy, Play;
  curious, Cast; bored, Juggle; grumpy, Soothe; hungry, Snack. Each kind
  lists the feelings it can have (`feelings`, one or more, none twice; every
  kind has one Soothe, Play, or Cast answers). `battle.feelings` holds this
  turn's, the next turn's, and the one after (null where nothing it can feel
  has an answer Fae has now: that friend in the party, or a snack for
  hungry); `[]` while feelings are off, which draws nothing.
  - Draws: as the intro ends, three seeded PRNG values, one per feeling in
    order; at each new turn's menu (after a burst, with energy left) the row
    moves up one and one more is drawn. A value picks from the kind's
    feelings Fae can answer at that moment, spread evenly
    (`min(n - 1, floor(value x n))`). These and a wind-up's are the only
    draws outside a burst's.
  - Choosing a command sets `battle.answered` when it answers this turn's
    feeling. An answered Snack adds the bonus to its calm at once; Soothe or
    a friend's command adds it when its check resolves, whatever the grade.
    Calm stays clamped to `calmMax`. A new turn clears `answered`.
  - The lantern: once Fae has it, its button (L, X/Square, or the lantern
    sticker) in the command menu shows the turn after's feeling too, for the
    rest of the battle (`battle.lanternPeek`); it draws nothing, leaves the
    overworld lantern as it was, and plays `lantern-on`.
- Wind-ups (Milestone 50): a mini-boss (`windUp` in its kind: `start`,
  `every`, `bubbles`, and `lines.start`, `lines.puffing`, `lines.fizzle`)
  puffs up on turn `start`, then every `every` turns, feeling several things
  at once. The gull, Mr. Pip, and Mrs. Flurry start on turn 2, every 3
  turns, with 2 bubbles. `battle.turn` counts turns from 1; `battle.windUp`
  holds the bubbles' feelings, which are popped, and the turns `left` (this
  one too).
  - Starting: as that turn's menu opens, `bubbles` feelings are drawn, all
    different, from the kind's feelings Fae can answer then: one seeded
    value each, picked evenly from those not yet drawn, fewer if fewer are
    open (no wind-up if none are). It lasts a turn per bubble. Its menu says
    `lines.start`, later turns `lines.puffing`. Meanwhile `battle.feelings`
    waits: no move, no draw, and the cloud gives way to the bubbles. Wind-ups
    don't need feelings on: a mini-boss winds up beside Maddie alone.
  - Popping: a chosen command pops the first bubble not yet popped that it
    answers, which counts as answering (the feeling bonus); one that answers
    none earns nothing extra. Each command answering a bubble not yet popped
    wears its badge.
  - No burst comes between wind-up turns: after a result the next turn's
    menu opens. After the last turn's result it lets go: every bubble popped,
    it fizzles (phase `fizzle`, `lines.fizzle`, no burst) and the next turn
    comes; otherwise its burst follows with no big roll, big if nothing was
    popped, else small. Either way the feelings move up one on the next
    ordinary turn, as at any new turn, and the wind-up is over. Soothed
    mid-wind-up, it's over too.
  - The lantern does nothing during a wind-up: its bubbles show what the
    critter feels, and the cloud it would peek into is hidden.
  - The loader checks a wind-up never starts on turn 1, leaves a plain turn
    between two (`every > bubbles`), shows no more bubbles than the kind has
    feelings, and has all three lines.
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
  radius, pausing for 45 ticks, or chases Fae at 2.5 units per tick once it
  has noticed her. Wandering is 1.25 units per tick, deliberately slower
  than Fae's 4 units per tick.
- Noticing (Milestone 51): Fae is in a critter's sight within 180 units of
  it (and within its den plus twice sight, its leash; never while it cools
  down). Each tick she is, its `notice` counts one more, up to `noticeTicks`
  plus `alertTicks` (30 and 30); the first tick she isn't, it's 0 again. It
  has noticed her, and chases, from `noticeTicks`. A chaser gives up when she
  leaves its sight or its leash. It
  stays on the floor with the 12-unit follow radius. Dialogue, battles,
  transitions, and the journal freeze it. Touch is an outside-to-inside
  crossing by either mover; a battle with it (and Run, which also puts it
  back at its den) gives it a 240-tick cooldown, heading home, with its
  `notice` back to 0, and an arrival rolls the area fresh.
- First touch (Milestone 51): as a recurring critter meets Fae, whoever got
  the jump shows in the opening. She surprised it if it hadn't noticed her
  yet: the battle opens with `firstTouch.surprise` calm (25; never all of
  `calmMax`) and `firstTouch.lines.surprised`. It caught her if it had, and
  she wasn't walking toward it (standing, or any step whose dot product with
  the way to it isn't positive): the battle opens on turn 0 with
  `firstTouch.lines.caught`, and its intro leads to its burst (the intro's
  feelings drawn as ever) before turn 1's menu, whose feelings are the ones
  drawn, unmoved. Otherwise it opens plainly with the kind's intro. The
  lines name the kind (`{name}`): "The Zoomie Pup didn't see Fae coming!
  It's a little calmer already." and "The Zoomie Pup pounces before Fae is
  ready!" A set piece always opens plainly.
- Old friends (Milestone 51): `state.calms` counts every calm by species
  (set pieces too) as its reward ends the battle. Once Fae has calmed
  `oldFriends.calms` (3) of a species, a recurring critter of it calms on
  touch: the battle opens soothed, its calm full, with `oldFriends.line`
  ("The Zoomie Pup remembers Fae and calms right down!"), then pays its
  coins as any reward does. Set pieces always battle.
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
  frog's body. Checks are drawn from the same layout (`battleCheckGeometry`):
  a ring is centred on the critter's (in a burst, Fae's) body centre with a
  radius of 0.55 times the figure height. A charge meter (1.1 x Fae's height
  tall, max(22 px, 0.18 x her height) wide) stands on the acting friend's
  baseline on the side away from the critter, its right edge 0.3 x Fae's
  height left of them. A friend's chain drops its beats from 1.6 x Fae's
  height above their feet into a dashed target 0.6 x her height above them
  (radius 0.16 x her height); a burst's chain flies from the critter's body
  centre to a dashed target on Fae's (radius 0.3 x her height). Soothe's
  checks stand at Fae. A catch's three lanes are 1.05, 0.55, and 0.1 x Fae's
  height above her feet, its catch 0.7 x her height in front of her (radius
  0.2 x her height); toys set out from 0.35 x the critter's height in front
  of the critter and are drawn at the critter's own scale, since they were
  cut from its art. A lean's track (1.6 x Fae's height wide, max(12 px,
  0.12 x her height) tall) is centred over her, 1.45 x her height above her
  feet: just over her bun, which stands about 1.3 x her height, and under the
  HUD. Its swooshes are max(56 px, 0.6 x her height) long, in four rows 1.05,
  0.8, 0.55, and 0.3 x her height above her feet, each setting out centred 1
  x her height in front of her and drifting its own length toward her. A
  hint hangs just under the feet line (0.18 x Fae's height below it) under
  its check, kept 130 px from the screen's sides; a catch's hangs midway
  between the catch and the critter, and a lean's midway between Fae and the
  critter, clear of the touch arrows on a notched phone.
- Backdrop: the area painting itself, scaled so its painted interior (8% in
  from each side, past the watercolour's paper margins) covers the canvas plus
  a 32 px margin, centred on the critter where it stands (`battleFoe`) and
  clamped, softly blurred, with a
  light cream wash. The overworld characters hide during the battle.
- Shell: `data-battle="open"` is on the root while a battle runs. Battle
  messages use the dialogue box with no speaker and hide when empty. While
  `battle.talk` is non-null, that same box is a dialogue with its speaker,
  typed line, advance arrow when the line has no choices, and the shared choice
  stickers once the line is revealed. The command menu is hidden while a Talk
  line is open, and the HUD while a question's answers are on screen
  (`talkChoicesShown`): on a phone the band above the dialogue box is too short
  for the answers and the meters, and the calm meter only moves once an answer
  is picked. Talk choices use the same keyboard, gamepad, and touch
  selection as ordinary dialogue. Dev builds log
  `[cloverhollow] battle-talk {speaker, choices}` when those values change.
  Dev
  builds log `[cloverhollow] battle {phase, message}` and the command buttons'
  rects. `renderInfo().battle` reports, in CSS px, the layout, the drawn
  backdrop rect, the check (`{ kind, side, x, y, hintAt }` plus a ring's
  `radius`, a meter's `width` and `height`, a chain's `from`, `to`, and
  `radius`, a catch's `lanes`, `fromX`, `catcherX`, `radius`, and
  `toyScale`, or a lean's `track` (`{ x, y, width, height }`, its centre and
  size) and `wind` (`{ x, rows, length }`); `x, y` is a ring's centre, a
  meter's top-left, a chain's target, the catch where it is, or a lean's
  star where it is), the battle's critter (`{ id, frame }`),
  the aura alpha, and whether the
  overworld is visible; `renderInfo().critters` lists each overworld critter
  as `{ id, kind, frame, x, y }`, `id` its key (section 6.1).
  `renderInfo().battle.talk` is null outside Talk, otherwise
  `{ speaker, text, revealed, choices, selected }`.

### 8.1 Battle UI layout
- Battle UI is the sticker DOM layer (`src/ui/battle.ts`): a HUD, a command
  menu, a check overlay (a ring, a charge meter, a beat chain, a catch, or a
  lean) with its
  grade sticker and hint, and a reward card. The game passes a full view to
  each `render` every frame; identical views change no DOM nodes. Battle
  messages use the dialogue box with no speaker.
- One stacking scale (`--z-*` in sticker.css), bottom to top: HUD, dialogue,
  commands, choices, prompt, check and grade, reward.
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
- Charge meter (Milestone 40): a cream sticker capsule with a warm-brown ink
  outline; the fill rises from the bottom as Sue winds up, over a teal good
  band and a green great band (the GOOD!/GREAT! colours) with a tick at the
  great band's foot. The grade sticker sits above the meter.
- Beat chain (Milestone 40): a dashed target circle with a cream rim and a
  soft paper fill (so it reads over whoever it sits on) and the beats in
  flight, small inline-SVG icons drawn in code: a pinecone with ink scale
  marks, a round pink bubble with a shine (like the frog's own), a puff of
  dust. A hit pops (a quick grow and fade); a miss drops away grey. The grade
  sticker sits above the target. A chain with another look redraws its
  icons, and beats past a shorter chain's count are hidden.
- Catch (Milestone 41): small ink dots mark the three lanes, and the catch
  is the beat chain's sticker target, sliding between them. Toys are crops of
  the toy atlas in flight along their lanes; a caught toy pops into the
  catch (a quick grow and fade), a missed one sails on past Fae and fades.
  The grade sticker sits above the catch.
- Lean (Milestone 48): a sticker track, green in its middle half and coral
  in its outer tenths where Fae tips over, with a butter-yellow star riding
  on it at her balance (-1 at the left end, 1 at the right). A dot per puff
  sits over the track: teal and larger while it blows, green once held, grey
  once lost. While a puff blows, swooshes (ink streaks on a cream rim, curled
  at the end nearest Fae, at the ring's stroke weight) drift in at her and
  fade, each three times over a puff: three rows, all four when the puff's
  force is at least half her lean. The grade sticker hangs over her head,
  just under the track, since above it would meet the HUD on a phone. All of
  it is drawn in code; nothing is generated.
- Trace (Milestone 55): a square authored in 0..1000 coordinates sits in the
  open ground between Fae and the critter, clear of the HUD, menu, message box,
  and touch buttons. The purple marker scribble is a thick wobbly path with
  dotted checkpoints, a pastel painted trail, a brush tip, and a drying ring.
  The next checkpoint pulses, hits fill teal, and misses remain empty/grey, so
  colour is never the only cue. A finger maps to the square while held; its
  pointer is separate from the movement stick. The square is centred and sized
  by `battleCheckGeometry` for desktop and notched phone safe areas.
- The kid's reveal plays `milo_calm`, clears `forest_fizzy` through `on_calm`,
  and leaves Milo calm under the tree. The sticker catalogue has 13 slots,
  including the Milo sticker. The front-view NPC art is no longer loaded by
  the runtime. Its raw source and recipe remain in `art/source/` and
  `art/recipes/` for provenance.
- Feelings (Milestone 42): a thought cloud (a cream sticker) floats in the
  open ground between Fae's party and the critter (`battleFeelingAnchor`:
  centred between 0.45 x Fae's height past her and the critter's aura edge,
  0.62 x its height before it; its top 0.4 x Fae's height above the
  critter's head, but never higher than 96 px below the safe top, clear of
  the HUD). It shows this turn's feeling, big, with its label, and a trail of
  thought dots down toward the critter: the next turn's feeling in the
  middle dot and, once the lantern has peeked, the one after in the smallest,
  glowing lavender like the lantern. It shows in the menu and over the
  result, where a heart pops if the choice answered it; it steps aside for
  checks. The command that answers this turn's feeling wears the feeling as
  a small round badge on its top-right corner. The icons are drawn in code
  (`src/ui/icons.ts`, shared with the journal's coin and cookie): zoomy a
  lightning bolt, curious a question mark, bored a flat little face, grumpy
  a storm cloud, hungry a cookie.
- Wind-ups (Milestone 50): in the menu and over its result, where the cloud
  would float (the same anchor, kept below the HUD), a row of round bubbles
  (64 px; 52 px at 720 px wide and under, so the row keeps to about the
  cloud's width on an iPhone SE): cream-rimmed stickers tinted sky blue with
  a shine, every other one a little lower, each with a feeling's icon and
  label. A popped one bursts (a quick swell and fade) into a faint dashed
  ring. The critter swells from its feet, 6% a wind-up turn (`puff`),
  breathing a little as it puffs, aura and all, and is its own size again as
  it lets go or fizzles.
- Hint: a cream sticker label with the check's hint (section 8), shown only
  while the view carries one.
- Marks (Milestone 51): over a chaos recurring critter that has Fae in its
  sight, a small round sticker (28 px, cream rim, ink outline) hangs 6
  units over its head: "?" in cream until it notices her, then "!" in
  butter yellow, popping in, for `alertTicks`. Only while she walks free:
  none in a battle, a talk, the arcade, the journal, or a door's fade. They
  sit under every other sticker.
- Reward card: a centred die-cut card with the title, one atlas frame cropped
  by CSS to 150 px wide, and the name. Stacked drop-shadows give the image a
  white rim and an ink outline that follow the critter's silhouette. Asset
  URLs are document-relative so they work on iOS.
- `data-battle="open"` on the root hides the movement stick; confirm and cancel
  stay. While a catch or a lean is in play the shell sets `data-check` to its
  kind, and two arrow stickers (the cancel button's size) stand where the
  stick would: a catch's up above down, held, point the catch high or low;
  a lean's back beside forward (left and right) lean Fae, as the stick or
  arrows would. Let go, the catch returns to the middle and the lean stops;
  lifting one arrow never lets go of the other if a second finger holds it.
  Outside a catch, a lean, or a round of Boop-a-Mole the shell lets go of
  them, so one held as the check ends never walks Fae on. A round of
  Boop-a-Mole takes taps on its holes instead (spec 8.2): the outer four hold
  their arrow and the middle the confirm button while pressed, and, like a
  tapped button, a tapped arrow counts for the next frame however quickly it
  lifts. Every battle text pair measures at least
  4.5:1 contrast in the gallery tests.
- `content/fixtures/plaza-party.json` is the two-member visual and battle
  fixture: plaza fountain spawn, seed 1, party `["maddie", "sue"]`.
- The Pixi battle scene dims the loaded area painting and presents the critter,
  Fae, the party, and aura in a fixed logical composition. It is render-only. The
  shell logs `[cloverhollow] battle` with phase and message changes, and
  `renderInfo()` exposes the phase, the check's geometry, and critter frame.

## 9. Journal and stickers
- The journal is the pause menu: Notes (current goals, written from Ink), a
  Sticker album, and a painted MAP page. The map labels all six lands, shows
  `???` for the sealed Enchanted Forest until Fae finds the Misty Path or enters
  that land, puts a bobbing gold star over Fae's current land, and leads each
  stop's name with the bus line's sign (lands with `busStop`). It is
  presentation only, outside the core state and saves. The journal's view
  carries each land's display name (`mapLandName` in `src/core/journal.ts`,
  `???` while the forest is sealed), and the page shows it as given.
- Stickers are collectibles and rewards.
- Core: `journalOpen` in state. A menu press (J or the journal button) opens
  it when no dialogue, battle, or door transition is running; a menu or cancel
  press (or the book's close button, which sends cancel) closes it. While it's
  open Fae is frozen, doors, battles, and interactions don't fire, and the
  party keeps settling.
- Notes: the `journal` Ink knot lists every note that applies, newest first:
  on top, what's waiting at the clubhouse (cold strawberries in the fridge,
  then the ripe garden; Milestone 43); the playing field's footbridge laid
  down, the hooded kid's stash, the swing across the creek and the lever up
  on the post, the fizzy squirrel, and recess (Milestone 39); Ms. Willow's
  flute, the bluebird's note, the mallet given back, the bird with the
  mallet, how the class song starts, the scribbled song, and music next
  (Milestone 38); Coach Ash's lasso, once he has his things back; while Fae
  hunts for them, the stopwatch and the clipboard both found, the fizzy pup with his
  stopwatch, and where the clipboard is (somewhere up high, stuck on the hoop,
  then the lasso lent), and the kid knocking over his cart and running out
  the back door; time for PE; the locked gym doors, once Fae has tried them,
  until PE; the kid in the purple hood running off toward the gym; story
  time, until the glimpse; the way back to school for story time, until it
  starts; once Mr. Pip is calm, his fizzy soda from the kid in the purple hood and the
  scribbled-out Star Racer initials; before that, once the clubhouse is
  claimed, its note sending Fae to the arcade; the garden planted and the
  fridge fixed (Milestone 43), else the clubhouse claimed; the
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
- A chunky four-step sound volume slider sits beside the `♪ on/off` pill and
  fits the heading row at 874x402, including with `♪ off` and 999 coins. At
  narrow widths, the supplies wrap beneath NOTES so every control remains
  inside the page without overlapping its neighbors.
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
- The STICKERS page continues below the album with a PRIZES shelf from
  `world.arcade.prizes`. Owned prizes use the prize atlas frame, die-cut rim,
  and name; unowned prizes are dashed `?` slots without names. The shelf is
  part of the page scroll on phones.
  The shelf has a slot a prize: the claw machine's nine plushes, then the
  ticket counter's four toys. The PRIZES heading carries Fae's tickets in a
  pill like the notes page's Coins and Snacks (an orange ticket and the
  count, Milestone 45).

### 8.2 Arcade games (Milestones 44 to 46, and 59) and the clubhouse microwave (52)
- The claw machine, skee-ball, Boop-a-Mole, and Comet Cruise, once Mr. Pip
  is calm (`calmed("arcade-keeper")`): a line tagged `play: <game> <price>`
  (`claw`, `skee`, `mole`, or `comet`, 2 coins each) opens the game when the
  conversation closes, paying the price then; too few coins at the close
  opens nothing. `state.arcade` is the game in play (`game: "claw" | "skee" |
  "mole" | "comet"`) or null, `state.prizes` the prizes won, in order, and
  `state.tickets` Fae's tickets (Milestone 45). `src/core/arcade.ts` opens,
  steps, and views whichever is open; each game's rules are their own module
  (`claw.ts`, `skee.ts`, `mole.ts`, `comet.ts`).
- The claw machine's content (`claw` in `content/arcade.json`, validated by
  `parseArcade`): the box's floor is 1000 wide (x, left to right) by 460 deep
  (z, from the front glass to the back wall). The claw travels x 185..940 and z 140..420; its home, (185, 140),
  is over the prize chute, out of reach of every plush. Speed 4 units a tick on
  either axis, reach 48, and drop, grab, lift, and release last 40, 14, 40, and
  20 ticks. The heap is nine plushes, each `{ prize, x, z, level, on }`: level
  0 on the floor (`on` empty), level n resting on plushes one level down within
  three reaches (`on` names them). Today: the frog, the cat, the hamster, the
  owl, and the raccoon on the floor; the bunny on the frog and the owl, the
  squirrel on the raccoon, the bluebird on the hamster and the raccoon; and
  the pup on top, on the bunny and the squirrel. So the pup, the cat, and the
  bluebird are free at the start, and the raccoon only once the squirrel and
  the bluebird are won. The prize catalogue and its atlas are `content/prizes.json`.
- The claw takes two holds; only a fresh confirm press starts each:
  ```
  ready --press--> sliding --let go / rail end--> aiming --press--> pushing
  pushing --let go / back wall--> dropping --> grabbing --> lifting
  lifting --> returning --home, over the chute--> releasing --> result
  result --press (show it all)--> shown --press--> closed
  ```
  Each held tick slides x (then pushes z) by the speed, up to the end; the tick
  it's let go doesn't move. When grabbing ends, the claw closes on the topmost
  plush in reach (squared floor distance at most reach squared): the highest
  level, then the nearest, then content order. If another plush still in the
  heap rests on it, it's stuck and stays; otherwise it's won, carried home, and
  dropped into the chute. Returning moves both axes home by the speed a tick.
  The result line (`won` with the prize's name, `stuck`, or `missed`) types
  like dialogue. A won prize joins `state.prizes` once and leaves the heap.
- `clawView` (`arcadeView` gives the open game's view) is logical: the box,
  the travel, the reach, the claw (x, z,
  `drop` 0..1, `stop` the plush levels it comes down to, open or closed), the
  plushes still in the heap (x, z, level, held, `tug` for a stuck one being
  pulled, `fall` 0..1 into the chute), the hint (`slide` in ready, `push` in
  aiming), the result line, and the prize won.
- The close-up (`src/ui/claw.ts`, laid out by `layoutClaw` in
  `src/ui/claw-layout.ts`; `src/ui/arcade.ts` hands each game's view to its
  own close-up) is a painting of the machine's front with its glass
  box in one-point perspective (`public/assets/arcade/claw-machine.webp`) and
  its calibration in the painting's pixels (`claw-machine.json`, validated by
  `parseClawCalibration`): the window, the floor's front and back edges, where
  the ceiling meets the glass and the back wall, the chute's mouth, and the
  blank plate. The cabinet is as large as the safe area left of the touch
  buttons allows, keeping its shape, and draws under the dialogue box, the
  reward card, the touch buttons, and the journal (`--z-hud`).
- The floor in perspective: a depth share u of the box lies a share
  t = u / (s + (1 - s) u) up the painted floor, s being the back edge's width
  over the front's; the floor's edges, the ceiling, and a plush's size all
  follow t. A plush's box (its 320 px atlas frame, its base on row 300) is
  0.28 of the floor's width at its depth, standing at its spot on the floor
  and 0.45 of a box higher a level. Everything is drawn back to front by
  depth, the higher level first at the same depth, so whatever is nearer
  covers whatever is farther. The claw is half a box, its cable and the
  gantry (two rails along the ceiling's sides, the crossbar at the claw's
  depth, the carriage on it) drawn over the ceiling; dropping, its prong tips
  go down to the bare floor, or 0.3 of a box into the top of the plush it
  lands on. A held plush hangs by its head between the closed prongs and, in
  releasing, sinks into the chute's mouth, cut off at its front edge. A stuck
  plush tilts while the claw pulls at it. While Fae aims, a dashed pink
  ellipse as wide as the reach marks where the claw would come down. The hint
  is lettered on the plate (CLAW when there's none), on two balanced lines
  when it's long.
- The result line uses the shared speakerless dialogue box, and a prize won
  shows on the shared battle reward card (`prizeTitle` "NEW PRIZE!", the plush,
  its name), set high over the cabinet, clear of the dialogue box and the
  touch buttons. The backdrop is the blurred arcade, focused on Fae.
- The gallery's claw states are real game states (`src/dev/claw-gallery.ts`):
  ready, aiming, pushing, grabbing, lifting, a tug, releasing, and the result.
  `tests/unit/claw-layout.test.ts` checks the layout itself (the floor's
  corners, the shortening with depth, the claw's home over the chute, every
  plush on its level, nearer over farther, the claw over what's behind it and
  under what's in front, on a grid across the box), and the gallery e2e checks
  the DOM is that layout within a pixel, at 874x402 and 1280x720 in both
  engines (`tools/arcade-layout.ts` gives Node either game's layout from
  Bun). The
  recorded run `arcade/claw.json` (`tools/sim/record-claw.ts`, from the
  `arcade` fixture) calms Mr. Pip and plays four games, stuck on the raccoon,
  the pup won, a miss in the bare back corner, and the cat won; `claw.spec.ts`
  plays it with real keys and its state must hash the same as Bun's replay,
  and wins the pup with two holds of the touch confirm sticker on a phone, in
  both engines.
- While a game runs, Fae, doors, triggers, targeting, the menu, the journal,
  and cancel are ignored, and the party settles as in battle. A game's end
  autosaves. The claw's cues: `claw-move` (each hold starts), `claw-drop`,
  `claw-grab` or `claw-miss` (stuck or empty), and `prize-won`.
- Skee-ball (Milestone 45): the lane on the arcade's floor (spec 6), `play:
  skee 2`. Its content (`skee` in `content/arcade.json`, validated by
  `parseArcade`): five balls; a target board 600 wide (x -300..300) and 400
  tall (y up from the hump); rings round (0, 230) of radius 40, 80, 120, and
  160 for 50, 40, 30, and 20; two corner holes at (±240, 360), radius 32, for
  100; and the floor's pocket, 10, everywhere else. The arrow moves 6 a tick
  (`sweepStep`); each tick the press is held sends the ball 8 further up
  (`powerStep`), for at most 55 ticks (440, past the top). A ball rolls 45
  ticks, hops the hump in 15, and sits in its hole 40. A game pays its score
  over 10 in tickets, rounded down.
- Five balls, each in two presses; only a fresh confirm press starts each:
  ```
  aiming --press--> winding --press--> powering --let go / held to the end--> rolling
  rolling --> hopping --> scored --balls left--> aiming
  scored --the last ball--> result --press (show it all)--> shown --press--> closed
  ```
  The arrow starts at the board's left edge sweeping right, and turns exactly
  at each edge; the press that sets it doesn't move it. Powering counts the
  ticks held from 1; the tick it's let go rolls with the count as it is, and
  reaching the end rolls at once. The ball lands at (aim, held × `powerStep`):
  past the top, the floor's pocket; else a corner hole, else the smallest ring
  round the centre it's in (edges included), else the floor (`skeeZone`,
  `skeePoints`). After the last ball, the result line ("You scored {score}!
  +{tickets} tickets.") types like dialogue, and the tickets join
  `state.tickets` once. No timer and no random draw: aim decides left and
  right, the hold how far up.
- The loader checks: integers throughout; the arrow turns exactly at the
  board's edges; held to the end, the ball flies off the top; the rings grow
  outward, the outer one on the board; the corner holes on the board and clear
  of the rings; the floor at least 1; the result line has `{score}` and
  `{tickets}`.
- `skeeView` is logical: the board, its rings, corners, and floor; the arrow's
  aim; the meter while winding up (`fill` 0..1, and `top`, where on it the
  board's top falls); the ball in play (where it lands, its stage, rolling,
  hopping, or landed, how far along, its zone and points); the balls left;
  the score of the balls landed; the hint (`aim` while aiming, `power` winding
  up); and the result line.
- The close-up (`src/ui/skee.ts`, laid out by `layoutSkee` in
  `src/ui/skee-layout.ts`) is a painting looking up the lane from its foot in
  one-point perspective (`public/assets/arcade/skee-lane.webp`), calibrated in
  its pixels (`skee-lane.json`, validated by `parseSkeeCalibration`): the
  lane's surface at its foot and at the hump, the target board's flat face,
  and the blank marquee plate. It shows the hood and the upper half of the
  lane (`skeeFrame`: the middle 75% of the painting's width, from just above
  the plate down to halfway up the lane, fading out below), as large as the
  safe area left of the touch buttons allows, under the same UI as the claw.
- On it, the lane is a plane in one-point perspective like the claw machine's
  floor. The board's face is seen straight on, at one scale both ways (the
  board fits the face, its foot on the face's bottom edge), so the rings are
  round. The rings and holes are drawn in code (pastel collars with ink rims;
  the 50 and the corners dark holes; each band's points lettered on it), so
  what's drawn is exactly what scores. The arrow stands 0.58 up the lane at
  the aim, pointing up it, cream while it sweeps and green once set. Winding
  up, a dashed ghost ball shows where the ball would land now, red past the
  top. The ball sets off from the arrow, rolls up the lane (shrinking with
  it), hops the hump in an arc, and sinks into its hole, or, rolled too hard,
  drops from the top into the floor's pocket; its target lights, and its
  points pop up over it. A score sticker (SCORE, and a dot a ball, filled for
  those still to roll) sits in the paper left of the hood; the hint is
  lettered on the marquee (SKEE-BALL when there's none). The result line uses
  the shared speakerless dialogue box; tickets have no reward card.
- The gallery's skee-ball states are real game states scored by the core
  (`src/dev/skee-gallery.ts`): aiming, powering, over (wound past the top),
  rolling, hopping, fifty, corner, and the result.
  `tests/unit/skee-layout.test.ts` checks the layout itself (the lane's
  corners and its shortening, a round target on the board, the ball's way
  from the arrow without a jump at any stage, landing where the core scores
  it and lighting that target and no other, the ghost, the arrow, and the
  frame keeping every part in view), and the gallery e2e checks the DOM is
  that layout within a pixel at 874x402 and 1280x720 in both engines.
- Skee-ball's cues: `skee-aim` (the aim set), `skee-roll`, `skee-score` (or
  `skee-hundred` in a corner hole), and `tickets-won` at the result.
- The ticket counter (Milestone 45): Mr. Pip runs it once he's calm. Its
  prizes (`counter` in `content/arcade.json`) are the rainbow pinwheel (20
  tickets), the star bouncy ball (30), the toy rocket (50), and the Star Racer
  keychain (80): catalogue prizes, never a claw plush, each once, each at least
  a ticket. `ticket_counter` offers each while Fae has its price and hasn't
  won it, its line tagged `trade: <prize> <price>` (spec 7). With nothing she
  can pay for, Mr. Pip says how many tickets she has; with all four won, that
  she's a champ.
- Boop-a-Mole (Milestone 46): the first cabinet, `play: mole 2`. Its content
  (`mole` in `content/arcade.json`, validated by `parseArcade`): 16 moles a
  round, one at a time, after a 60-tick "Get ready!". Each rises over 8
  ticks, stays up for a window that shrinks from 64 ticks (the first mole)
  to 32 (the last) in even steps (`moleWindow`), and ducks over 8; booped,
  it winces and giggles for 24 ticks first, then ducks giggling; 16 ticks
  pass between moles. A round pays 2 tickets a boop. The loader checks
  positive integers, at least two moles, a window that shrinks or holds, a
  boop of at least two ticks (both faces show), and a result line with
  `{booped}`, `{moles}`, and `{tickets}`.
- The round's holes are drawn as it opens, one draw of the game's random
  generator a mole (`nextRandom`, `src/core/random.ts`), each among the five
  holes but the last mole's, so no hole comes twice in a row; the order is
  kept with the game, so a replay is exact. A fresh press (down now, not on
  the previous tick) of an arrow boops that hole, and of Z the middle; two at
  once, the middle, then up, down, left, right (`moleHole`). A swing at the
  mole's hole while it's rising or up boops it; at any other hole, or once
  it's booped or ducking, the hammer only squeaks. Nothing is ever lost.
  ```
  ready --readyTicks--> playing --the last mole down--> result
  result --press (show it all)--> shown --press--> closed
  a mole: rising --> up --its window--> ducking --> waiting --gapTicks--> the next
          rising or up --boop--> booped --> giggling --> waiting
  ```
  After the last mole, the result line ("You booped {booped} of {moles}
  moles! +{tickets} tickets.") types like dialogue, and the tickets join
  `state.tickets` once.
- `moleView` is logical: each hole and the mole in it, if one's out (how far
  risen, 0 to 1, and its face: up, booped for the first half of the boop,
  then giggle), the hammer's swing (its hole, how far through, and whether
  it booped), the boops, the moles still to come, the hint (`ready`, then
  `boop`), and the result line.
- The close-up (`src/ui/mole.ts`, laid out by `layoutMole` in
  `src/ui/mole-layout.ts`) is a painting of the cabinet's deck seen from
  where Fae stands, its five holes in a plus in one-point perspective under a
  blank marquee (`public/assets/arcade/mole-cabinet.webp`), calibrated in its
  pixels (`mole-cabinet.json`, validated by `parseMoleCalibration`: the
  plate, and each hole's opening, the ellipse where its dark inside meets the
  rim). It shows the painting's whole width from just above the marquee to
  past the near hole (`moleFrame`), the cabinet's front faded out, as large as
  the safe area left of the touch buttons allows.
- A mole is a frame of `public/assets/arcade/moles.json` (`mole-up`,
  `mole-booped`, `mole-giggle`: its upper body cut straight at the waist on
  the frame's last row), 2.1 times its hole's rx on a side, standing with its
  waist on the hole's near rim. Its box is clipped to everything above the
  hole's centre line plus the opening's lower half, so it rises out of the
  hole and the near rim hides its waist; rising and ducking slide it down
  inside the box. The squeaky hammer (drawn in code) comes down on the top of
  the mole's head, then lifts, turns back, and fades over `hammerTicks`;
  "Boop!" pops up over a wincing mole. With a keyboard, each hole's key (↑ ←
  Z → ↓) is lettered on a little cap just left of it; on touch the holes
  themselves are the targets (at least 48 px each way), so the caps are
  hidden. A score sticker (BOOPS, MOLES still to come) sits just left of the
  marquee, which is lettered with the hint (BOOP-A-MOLE when there's none).
  The result line uses the shared speakerless dialogue box.
- The gallery's Boop-a-Mole states are a real round's (`src/dev/mole-gallery.ts`):
  ready, rising, up, booped, giggling, a squeak at an empty hole, and the
  result. `tests/unit/mole-layout.test.ts` checks the layout itself (each
  mole standing in its hole with its waist on the rim, rising and ducking,
  the hammer on its head, Boop!, the keys, and the frame keeping every hole
  and risen mole in view), and the gallery e2e checks the DOM is that layout
  within a pixel at 874x402 (touch) and 1280x720 (keys) in both engines,
  `tools/arcade-layout.ts` giving Node the layout from Bun. The recorded run
  `arcade/mole.json` (`tools/sim/record-mole.ts`, from the `arcade` fixture)
  calms Mr. Pip and plays a round: fourteen moles booped (one while still
  rising), two let go, and two squeaks; `mole.spec.ts` plays it with real
  keys and its state must hash the same as Bun's replay, and boops two moles
  with quick taps on their holes on a phone, in both engines.
- Boop-a-Mole's cues: `mole-pop` as each mole starts rising, `mole-boop` or
  `mole-whiff` (a squeak) as the hammer lands, and `tickets-won` at the
  result.
- Comet Cruise (Milestone 59): the teal cabinet beside Boop-a-Mole's
  (`cabinet-second`), `play: comet 2`. A little rocket at the foot of the
  cabinet's screen steers between three lanes, catching the stars and
  slipping past the space rocks that come down them. Its content (`comet` in
  `content/arcade.json`, validated by `parseArcade`): 16 stars and 8 rocks a
  run, after a 60-tick "Get ready!". One sets off every 48 ticks
  (`gapTicks`), and each takes from 96 ticks (the first) down to 60 (the
  last), in even steps (`cometTravel`, like `moleWindow`), to come down to
  the rocket's row. A star that reaches the rocket's lane there is caught and
  pays 2 tickets; a rock there bumps the rocket, which wobbles for 24 ticks
  and can't steer. Anything else goes on past for 24 ticks (`passTicks`) and
  leaves the screen. Nothing is ever lost, and the run never ends early. The
  loader checks positive integers, at least one star, no more rocks than
  stars, a travel that shrinks or holds, a pass at least as long as a catch's
  sparkle (`flashTicks`, 16), and a result line with `{stars}`, `{total}`,
  and `{tickets}`.
- The run is drawn as it opens, by the game's random generator
  (`nextRandom`, `src/core/random.ts`): first where the rocks go, one draw a
  rock among the places after a star not yet taken, so a run starts with a
  star and no two rocks come in a row; then each one's lane, one draw each,
  among all three for the first and the two the one before isn't in for the
  rest. The run is kept with the game, so a replay is exact. A fresh press
  (down now, not on the previous tick) of left or right moves the rocket a
  lane that way, to the edge and no further, before anything reaches its row
  that tick; it slides there over 6 ticks (`moveTicks`), leaning into the
  turn. While it wobbles, presses do nothing; up, down, and confirm do
  nothing in a run.
  ```
  ready --readyTicks--> playing --the last one past--> result
  result --press (show it all)--> shown --press--> closed
  one: coming --its travel--> at the rocket's row --> caught (a star in its lane)
       | bumped (a rock in its lane) | passing --passTicks--> gone
  ```
  The run ends `passTicks` after the last one reaches the rocket's row. Then
  the result line ("You caught {stars} of {total} stars! +{tickets}
  tickets.") types like dialogue, and the tickets join `state.tickets` once.
- `cometView` is logical: the rocket (where it is across the lanes, 0 to 2,
  as it slides; which way it leans; how far through a wobble, 0 to 1), each
  one on the screen (star or rock, its lane, how far down, 0 at the screen's
  top and 1 at the rocket's row, more while it passes, and, caught or
  bumped, how far through its sparkle or puff), the stars caught, how many
  are still to come, the hint (`ready`, then `play`), and the result line.
- The close-up (`src/ui/comet.ts`, laid out by `layoutComet` in
  `src/ui/comet-layout.ts`) is a painting of the teal cabinet's front seen
  from where Fae stands: a blank marquee over the screen in its bezel, and
  the deck's stick and buttons below (`public/assets/arcade/comet-cabinet.webp`),
  calibrated in its pixels (`comet-cabinet.json`, validated by
  `parseCometCalibration`): the marquee; the screen, the box of its dark
  glass (a CRT's, its corners rounded and its edges bulging); the field, the
  largest box wholly inside the glass, where the run is drawn; and the deck,
  the stick and buttons. It shows the painting's whole width from a sixth of
  the marquee's height above it to the deck's foot, its top and bottom 6%
  faded out (the painted wing tips are cut flat), as large as the safe area
  left of the touch buttons allows (`cometFrame`).
- The run is drawn in code on the field, over the glass's own dark blue: a
  scatter of tiny stars at fixed places, and the two lines between the
  lanes, faint and dotted, in one-point perspective toward a point half the
  field's height above its top centre. The rocket's row is at 78% of the
  field's height, its three lanes centred at a sixth, a half, and five
  sixths of the field's width there. One coming down is on its lane's line,
  `progress` of the way from the field's top to the row, at 0.4 + 0.6 ×
  `progress` of its full size; a frame is 26% of the field's width at full
  size, so the rocket stands clear of the field's foot. Passing, it goes on
  down the same line, fading out between the row and the field's foot, and
  is clipped there. The rocket stands on its row at its `position` across the lanes:
  `rocket-left` or `rocket-right` while it leans that way, `rocket-wobble`
  while it wobbles. A caught star shows `star-sparkle` and a bumped rock
  `rock-puff`, on the row, fading out with their `flash`.
- The rocket, the stars, and the rocks are frames of
  `public/assets/arcade/comet.json` (`rocket`, `rocket-left`, `rocket-right`,
  `rocket-wobble`, `star`, `star-sparkle`, `rock`, `rock-puff`), each centred
  on its place. With a keyboard, ← and → are lettered on little caps on the
  cabinet's teal sides either side of the screen, level with the rocket's
  row. On touch the caps are hidden, and left and right arrow stickers stand
  where the stick would, like Lean's (spec 8.1), at least 48 px each way: the
  stick is hidden while the game is open and the arrows while its result
  reads, and a tap quicker than a frame moves the rocket too. A score sticker
  (STARS caught, LEFT still to come) sits just left of the marquee, which is
  lettered with the hint (COMET CRUISE when there's none). The result line
  uses the shared speakerless dialogue box.
- The gallery's Comet Cruise states are a real run's (`src/dev/comet-gallery.ts`):
  ready, coming (a star and a rock on the screen), sliding a lane, a star
  caught, a bump, and the result. `tests/unit/comet-layout.test.ts` checks
  the layout itself (each one in its lane and growing, the rocket on its row,
  the caps, and the frame keeping the screen in view), and the gallery e2e
  checks the DOM is that layout within a pixel at 874x402 (touch) and
  1280x720 (keys) in both engines, `tools/arcade-layout.ts` giving Node the
  layout from Bun. The recorded run `arcade/comet.json`
  (`tools/sim/record-comet.ts`, from the `arcade` fixture) calms Mr. Pip and
  plays a run: fourteen stars caught, two let go, and one rock bumped;
  `comet.spec.ts` plays it with real keys and its state must hash the same as
  Bun's replay, and steers by the arrow stickers on a phone to catch a star,
  in both engines.
- Comet Cruise's cues: `comet-move` as the rocket changes lanes,
  `comet-star` as it catches one, `comet-bump` as a rock bumps it, and
  `tickets-won` at the result.
- The clubhouse microwave's cooking game (Milestone 52) opens the same way,
  from the clubhouse fridge's look point with a box of Mom's in hand:
  `play: cook-nuggets 0` or `play: cook-mac 0`, free. `state.arcade` is then
  `{ game: "cook", dish: "nuggets" | "mac", phase, phaseTicks, cooked,
  message, revealed }` (`src/core/cook.ts`). A step returns what the game owns
  and Fae's snacks (`ArcadeStep`); only cooking changes the snacks.
- Its rules: `ready` until a press starts it (`cooking`); each tick the press
  is held, `cooked` goes up by one. Let go still frozen (`cooked` under the
  dish's `frozen` seconds) and it's `paused`, the frozen line showing, until a
  press cooks on from there. Let go later, or hold to the dish's `stop` (the
  microwave stops itself), and it dings (`ding`, `dingTicks`), then the
  `result`: how it came out pays its snacks into Fae's backpack and its line
  types out (a press shows it all; the next closes it). How it came out, at
  `cooked / ticksPerSecond` seconds: `burnt` from the dish's `burnt` on, else
  `golden` within `golden` seconds of its `time` (the box's), else `under` or
  `over`. No clock but the stop, no random draw: where Fae lets go decides it.
- Its content (`cook` in `content/arcade.json`, validated by `parseArcade`):
  `ticksPerSecond` 2 (the timer runs 30 seconds a real second), `golden` 10,
  the dishes (Dino nuggets: `time` 60, `frozen` 30, `burnt` 96, `stop` 120;
  Mac n cheese: 90, 45, 144, 180), the `snacks` each way pays (under 2, golden
  3, over 2, burnt 1), `dingTicks` 40, and the `lines` (`start` with the box's
  `{time}`, `frozen`, and one per way out with `{snacks}`). Whole numbers;
  each dish frozen, then under, golden, and over, then burnt, then the stop;
  every way out pays at least one.
- Its view (`cookView`): the dish's `label`, the `display` (m:ss of the
  seconds cooked) and `boxTime`, how the food looks (`frost` 1 to 0 by the
  frozen time; `steam` from then; `darkness` 0 to 1 from golden's end to
  burnt; `smoke` once burnt), `cooking` (the light on, the button held),
  `cooked`, the `zone` once it's dinged, the `hint` (the start line while
  ready, the frozen line while paused), and the message.
- The close-up (`src/ui/cook.ts`, laid out by `layoutCook`): the painted
  microwave on the clubhouse's navy fridge (`public/assets/arcade/
  microwave.webp`, 1600x1048, cut by `tools/art/build-microwave.ts`), fit to
  the safe area like skee-ball's. Its calibration (`microwave.json`, read by
  `parseCookCalibration`), in the image's pixels: the door's `glass` (with its
  corner radius `r`), the turntable's rim (`plate`), the `display`,
  the start `button`, and the fridge's `front`. Mom's dish
  (`public/assets/arcade/cook-food.json`: `nuggets` and `mac`, 512x320 cells
  anchored at the dish's foot, cut by `tools/art/build-cook-food.ts`) stands on
  the turntable at (plate.cx, plate.cy + 0.4 plate.ry), clipped to the glass;
  its frost is its own shape in white at 0.7 of `frost`; overcooking darkens
  it (brightness 1 - 0.62d, sepia 0.35d); the inside is dim with the light off
  and glows warm while it cooks; four puffs rise from it by the ticks cooked
  (steam, or smoke once burnt), never by a clock; and a sheen crosses the
  glass. The timer shows in green LCD digits, the button is pressed in while
  held, and the fridge's front is lettered with the hint, or the box and its
  time ("Dino nuggets · Heat 1:00"); in the result the line shows in the
  dialogue box instead.
- Its gallery states (`src/dev/cook-gallery.ts`), each a real game state the
  core cooked: `cook-ready`, `cook-golden` (cooking at the box's minute),
  `cook-frozen`, `cook-result` (mac n cheese, golden), and `cook-burnt`.

## 10. Save and load
- One slot, key `cloverhollow-save`, stored with `@capacitor/preferences`:
  UserDefaults on iOS (which iOS doesn't clear the way it can clear web
  storage) and localStorage in the browser.
- Format: `{ version: 9, state }`, the whole core state, including the
  serialized Ink state (story variables and choices), the party, stickers,
  the set pieces' moods, this visit's recurring critters, the calm counts,
  the lantern, coins and snacks, the PRNG, the tick, arcade state, prizes,
  and tickets. Version 1 (Maddie in `maddie` and
  `trail`), version 2 (no lantern), version 3 (no coins or snacks), and
  version 4 (one critter of each kind, no recurring critters) are refused and
  start a new game. Loading restores it exactly: the state hash matches, and
  `stableHash` skips undefined values (as JSON does) so a state and its saved
  copy hash the same.
- Older saves upgrade, gaining what later versions added as a new game
  starts it: version 5 `arcade: null`, `prizes: []`, `tickets: 0`, and
  `calms: {}`; version 6 `tickets: 0` and `calms: {}` (Milestone 45); version
  7 `calms: {}` (counted from then on); version 8 `finale: null` (Milestone
  56). Before version 8 every recurring
  critter gains `notice: 0` (Milestone 51). Version 4 and older, a version
  from the future, and any mid-game save are refused.
- `parseSave(json, template)` accepts only a state with the template's exact
  shape (a fresh game state: every key, the same primitive types, all the way
  down; null slots may hold null or an object; every element of an array
  matches the template array's first element, so each party member and trail
  point is checked; a new game has no recurring critters out, so `wild` is
  checked against a fixed shape). Any other version or shape starts a new
  game instead of crashing later. A change to the state's shape bumps the
  version. Content growing is not a shape change: a set piece added since the
  save was made starts in chaos when it loads (`parseSave` lays the saved
  critters over the template's). The battle slot is the one exception to
  bumping: a save is only written after a battle has ended, so `battle` is
  always null in a save, and `parseSave` refuses one where it isn't. The
  battle's own shape can change without a new version (Milestone 40 did).
  Nothing is saved in the morning or the credits either, so `parseSave`
  refuses a save whose `finale` isn't null (Milestone 56).
- Autosave (the shell, never blocking a frame) when Fae arrives in an area,
  a battle or arcade game ends, a dialogue closes, or the journal closes. The
  trigger is a pure function of the previous and next state
  (`autosaveNeeded`), and it is false while `finale` isn't null: the dream's
  last save is the ending's snapshot (section 7.4). Fixture resets don't save.
- Boot: a valid save resumes the game; otherwise a new game starts.
- QA mode never reads or writes `cloverhollow-save` and never autosaves. QA
  packs are separate files in the dev/harness-only save library; movement,
  doors, and ending events cannot change the player's slot.

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
    `input()` frames first, then live devices), loads the area it ends in,
    then renders once. It loads no area it only passes through (owner,
    2026-10-18): if it left its first area at any tick, the last is loaded
    afresh, so the view and camera are what loading each area in turn would
    leave. Pausing, holding real keys, then stepping gives deterministic
    tests with real key presses.
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
  - `qa.active()` reports whether a QA pack is loaded, and `qa.packs()` lists
    the dev/harness-only pack metadata.
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
    the area as `{ id, frame, facing }`. `ambient` lists current flyers as
    `{ id, x, y, frame }` in world units, and is empty for an area without
    flyers. `battle.layout` includes `party`, the
    members' CSS-px points, and `battle.check` the check's geometry
    (section 8). For Trace it is `{ kind: "trace", rect: { x, y, width,
    height }, brush: { x, y }, points: [{ x, y }], checkpoint, hintAt }`, all
    coordinates in CSS px except the brush and points, which are in the
    authored 0..1000 square. `marks` lists the recurring critters' "?" and "!" as
    `{ key, mark, x, y }`, each at its sticker's bottom centre in CSS px
    (Milestone 51). `finale` is the core's `finale` (`null`, `morning`, or
    `credits`); `credits` is `{ entries }` while the credits show (each
    `{ section, name, image }`, from `creditEntries`, section 7.4), otherwise
    null (Milestone 56).
- While dialogue is open, HTML carries `data-dialogue="open"`; movement, doors,
  cancel, and menu are ignored. Confirm reveals the current line, advances it,
  or selects the highlighted choice. Up/down edges wrap the selection.
- Deliberately absent: arbitrary flag setting, teleporting, and eval. Fixtures
  and QA save packs are the labeled test-only shortcuts; teleporting, eval, and
  arbitrary flag setting remain absent.
- Screenshots come from the browser (Playwright or Chrome DevTools MCP), so
  they include the DOM UI.
- `renderInfo().arcade` is null outside an arcade game, otherwise the open
  game's close-up as drawn, in CSS px, read back from the DOM. The claw:
  `{ game: "claw", phase, machine, glass, plate, chute, claw: { x, y, open },
  plushes: [{ id, x, y, size, held }] }`, the claw's `y` its prong tips and
  each plush's `x, y` where it stands (its base point). Skee-ball: `{ game:
  "skee", phase, machine (the whole painting), frame (the part shown), board,
  plate, hud, arrow: { x, y, set } | null, ghost: { x, y, over } | null,
  ball: { x, y, radius } | null, lit: { points, side } | null, pop: { x, y,
  text } | null, score }`, the arrow's `x, y` its foot, and `lit.side` -1 or
  1 for a corner hole (0 for the rest). Boop-a-Mole: `{ game: "mole", phase,
  machine (the part shown), plate, hud | null, holes: [{ hole, x, y, mole: {
  face, drop } | null }], hammer: { x, y } | null, pop: { x, y, text } | null,
  score }`, each hole's `x, y` its centre and a mole's `drop` how far below
  its full rise it is. Comet Cruise: `{ game: "comet", phase, machine (the
  part shown), field, marquee, hud | null, rocket: { x, y, frame }, objects:
  [{ kind, x, y, frame, opacity }], keys (the caps shown), score }`, each
  `x, y` a centre. The microwave: `{ game: "cook", phase, machine,
  glass, food, display, front, frost, darkness, light, wisps, smoke }`,
  `front` the fridge's lettering ("" in the result) and `frost` its frost's
  opacity. Harness builds log `[cloverhollow] arcade { phase, message }` when
  either value changes.
- `sound.log()` returns recent read-only `{ tick, cue, played }` entries,
  `sound.muted()` reports the separate audio preference, `sound.level()`
  reports the selected level (`0.25`, `0.5`, `0.75`, or `1`), and
  `sound.state()` returns the AudioContext's state string (`running`,
  `suspended`, `interrupted`, `closed`, or `unavailable`). Harness builds also log
  `[cloverhollow] audio {state}`
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
  gallery, journal and save, dialogue, battle scene, sound, harness, gamepad,
  and QA)
  plus the gameplay flows tagged `@smoke`; each gameplay flow already checks
  its state hash against Bun (JavaScriptCore) for cross-engine determinism.
- Visual baselines live beside the e2e specs. Update them only after viewing
  the new image. Chromium's are drawn on a Mac's GPU through Metal; one drawn
  by the software renderer differs at a few edge pixels and is redrawn (and
  viewed) like any other change.
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
  Locally, Chromium draws on the Mac's GPU (`--use-angle=metal`; WebKit
  already does) and the suite runs on half the cores.
- CI (`.github/workflows/ci.yml`) skips pushes of only docs, art sources, and
  Markdown, and checks out only what runs. A newer push to the same branch
  cancels the run it overtakes (owner, 2026-10-18), and the newer run tests
  both. One Linux job runs `check` and `build`. Chromium runs on five macOS
  runners, which have a GPU (Apple's paravirtual Metal device) and match the
  Chromium baselines, so CI compares its screenshots (each runner checks out
  only its own specs' baselines, in the background while its browser
  restores). The spec files listed in `tools/ci/shard.ts` (the UI gallery's
  checks, `ui-gallery-checks.spec.ts`) compare no screenshot and draw little,
  so Chromium runs them on two Linux runners instead (macOS allows five jobs
  at a time); a gameplay spec stays on the Macs, as Linux's software renderer
  draws its every step. WebKit runs on eight Linux runners, with the
  downloads of its system libraries cached per runner image, and leaves its
  screenshots to local runs: WebKit draws text and images with the operating
  system's libraries, so its baselines hold for the macOS they were drawn on.
  Each shard runs one worker. `tools/ci/shard.ts` splits each project by the
  recorded seconds per test in `tests/e2e/timings.json`, keeping a file's
  tests together and in order (only a file longer than half a shard is cut,
  into runs of about equal time in order); `just timings` refreshes the record
  from the last three green runs on main, each test's mean over them (runners
  differ by half again in speed).
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
  scratch frames (`art/scratch/`) are regenerable and not committed. Review
  images (`art/review/`) are committed with the work they review, as JPEG
  of a few MB at most: many are one-off composites, and an uncommitted
  folder of them was lost once (2026-10-18). Only the kit tool's mask dumps
  (`art/review/kit/`) stay out.
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
- Toys (Milestone 41): the atlas a catch throws (`public/assets/battle/toys/`)
  is cut, pixel for pixel, from the approved critters' `chaos_burst_01`
  frames, which already draw them as separate islands: tennis balls, yarn,
  acorns, snowballs, bottle caps, tickets, and tokens. No generation:
  `tools/art/build-toys.ts` rebuilds it from `art/recipes/toys.json`, and
  fails unless the atlas is RGBA and every toy equals its source pixels.
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
- Approved 2026-10-17: the thrown toys a catch throws (Milestone 41), cut
  from the critters' burst frames (`art/review/toys-sheet.jpg`).
- Approved 2026-10-18: the arcade's painting as Milestone 61 rearranged it
  (`art/review/m61-room.jpg`), with the neon words Milestone 58 painted into
  it ("ARCADE", "PLAY", "TICKETS", "CLAW").
- Approved 2026-10-18: Comet Cruise (Milestone 59) as built: its name,
  numbers, lines, the teal cabinet's close-up, and the rocket, star, and rock
  (`art/review/m59-comet-cabinet.jpg`, `m59-comet-sprites.jpg`).
- Waiting for the owner's review (Milestones 17 to 28, and art drawn ahead):
  Maddie at her true proportions, Sue's atlas and lines, the Bubblegum Bay
  painting, the bluebird and its lines, Jordan's atlas, the Pinecone Pass
  painting, the hamster hiker, the bus stop, the Cliffside Trail painting, the
  bunny and the squirrel, the blacklight lantern and its glows, the gull, the
  Whispering Woods and its owl, coins and shops, the recurring critters'
  cat and raccoon battle atlases and wording, and Mr. Pip
  (`docs/review-queue.md`). Also waiting: the school hallway
  repainted open (2026-10-16), its low front wall gone and its front doors
  on the back-left wall (`art/recipes/school.json`). The
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
