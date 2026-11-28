# Wilds of Cloverhollow: spec

Last updated: 2026-11-27 (Milestone 173)

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
  Development and tests run in desktop Chrome/Chromium. `index.html` links a
  standalone landscape web app manifest (`public/manifest.webmanifest`,
  `#f8edcf` paper theme/background, referencing `icons/icon-512.png` alongside
  the inline SVG icon), iOS web-app shell meta tags
  (`apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`,
  `apple-mobile-web-app-title`, `theme-color`, `description`),
  `<link rel="apple-touch-icon" sizes="180x180" href="./icons/apple-touch-icon.png">`,
  and an inline four-leaf clover SVG favicon matching the title plate emblem
  (Milestone 97, expanded with bespoke storybook PNGs in Milestone 112). The
  deterministic generator `tools/art/build-brand-icons.ts` builds the custom
  hand-inked storybook four-leaf clover iOS App Icon
  (`ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png`,
  1024x1024 opaque 24-bit RGB PNG with zero alpha channel), the seamless
  `#f8edcf` iOS Launch Splash medallion (`Splash.imageset/splash-2732x2732*.png`,
  2732x2732 opaque RGB PNGs), and the PWA icons (`public/icons/icon-512.png`,
  512x512; `public/icons/apple-touch-icon.png`, 180x180).
- Nintendo Switch: deferred. It would be a separate port, so keep content
  portable (Ink, JSON, PNG).
- Language: TypeScript with `strict`. No `any`; avoid `as` casts by modeling
  real shapes and narrowing with type guards.
- Tooling: Vite 8 / Rolldown (dev server and production/harness builds with
  `build.rolldownOptions.output.codeSplitting` into `vendor-pixi`, `vendor-ink`,
  `story-content`, `area-content`, `audio-scores`, `render-engine`
  (`includeDependenciesRecursively: false`), `world-content`, and
  `index`/`game` app chunks, keeping all non-vendor app and content chunks
  under 500 kB, enforced automatically on production builds by
  `tools/check-dist.ts` via `just build`, Milestone 154), Bun (package manager
  and script runner), Node 24 LTS for Node-based tools (`.nvmrc`), `just` for
  tasks. Owner-approved (2026-11-27): compiled Ink story JSON may move out of
  the static JS bundle to a runtime-fetched asset at
  `public/assets/story/main.ink.json` (read directly from disk in Bun/Vitest/sim
  loaders) with `tools/ink/compile.ts` supporting Ink `INCLUDE` modules.
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
  the accumulator is reset and no ticks run. In live running play (not paused,
  same area, no door transition), `src/main.ts` passes `previousState` and
  sub-tick `alpha = min(1, accumulator / (1000 / 60))` into `GameView.render`
  to linearly interpolate (`interpolatePoint` in `src/render/camera.ts`) the
  drawn positions of Fae, matching party members, and matching roaming critters
  at 120 Hz for presentation only. When paused in the harness or crossing
  areas, rendering snaps to `alpha = 1`.
- The shell draws the canvas from its own animation-frame callback (Pixi's
  automatic per-frame render is removed). While the harness has the game
  paused, it draws only after something changes: a step or reset, an area
  load, a resize, or a pointer press. Running, it draws every frame.
- Visual-only animation (walk frames, bobbing, text reveal, tweens) derives
  from state and tick and never feeds back into the core.
- `src/core` remains pure. The sole package import exception is `inkjs` in
  `src/core/ink.ts`; Ink is always loaded from a fresh Story per command.
  Core simulation helpers are split cleanly across pure modules
  (`src/core/geometry.ts` for polygon/collision math, `src/core/party.ts` for
  party formation, follower slots, trail following, and battle party helpers,
  `src/core/roam.ts` for recurring critter rolling, wandering, sight, touch
  checks, and `inkFacts`, `src/core/battle-view.ts` for pure read-only battle
  view projection, command lists, treat tray items, assist views, and battle
  scoring helpers, and `src/core/battle.ts` for the turn-based calm-down battle
  state machine and treat inventory mutations, re-exporting all public battle
  views), all re-exported through `src/core/sim.ts` and `src/core/index.ts`
  (Milestones 91, 96, 125).
- Battle stage mood washes, Flute Friend on-stage cameo poses, and battle VFX
  anchor resolution live in `src/render/battle-stage.ts` (Milestone 91), while
  pure battle VFX particle/theater builders (`SnackTheaterKind`,
  `classifySnackTheater`, `isTalkTheater`, `isRecoverTheater`, `radialBurst`,
  `applyTalkTheater`, `applySnackTheater`, `applyRecoverTheater`,
  `applyTogetherReady`, `applyTogetherActive`, `applyWindUpAndFizzle`,
  `applySoothedAndReward`) live in Pixi-free `src/render/battle-vfx.ts` and the
  six stage VFX choreography emitters
  (`isLassoActionActive`, `emitRainbowLassoVfx`, `echoNoteColor`,
  `emitEchoChimeVfx`, `emitSoothedConfettiVfx`, `emitLeanWindVfx`,
  `emitPeekabooVfx`, `emitTraceBrushVfx`) live in Pixi-free
  `src/render/battle-vfx-stage.ts` (re-exported identically through
  `src/render/battle-vfx.ts` and `src/render/battle-choreography.ts`,
  Milestones 137 & 157). The Pixi battle stage container, sprites, check
  geometry, and `renderBattle` orchestration live in `BattleViewController`
  (`src/render/battle-view.ts`, mounted by `GameView` in `src/render/view.ts`),
  delegating blurred backdrop texture caching/invalidation, stage wash scrim,
  painted lighting waves, spotlight, ground ellipse, sunburst rays, contact
  shadows, flute cameo staging, and pooled stage VFX sprites
  (`BATTLE_VFX_POOL_SIZE = 80`) to `BattleStageRenderer`
  (`src/render/battle-stage-render.ts`, Milestone 155),
  and the eight active battle timing-check DOM overlays (`ring`, `charge`,
  `chain`, `catch`, `lean`, `trace`, `peekaboo`, `echo`) live in
  `src/ui/battle-checks.ts` (re-exported through `src/ui/battle.ts`, Milestone
  105), while the secondary battle DOM overlays (`createCommandMenu`,
  `createFeelingBubble`, `createWindUpBubbles`, `createRewardSticker`, and
  `battleCommandPreview`) live in `src/ui/battle-overlays.ts` (re-exported
  identically through `src/ui/battle.ts`, Milestone 134).
- Lazy DOM atlas metadata caching, single-decode image warming, frame crop
  resolvers (`stickerArt`, `prizeArt`, `speakerPortrait`, `fishArt`, `toyArt`),
  and per-area close-up overlays (`ensureClawOverlay`, `ensureSkeeOverlay`,
  `ensureMoleOverlay`, `ensureCometOverlay`, `ensureArcadeOverlay`,
  `ensureCookOverlay`, `ensureFishOverlay`, `warmAreaOverlays`,
  `warmAreaMedia`, `warmJournalAssets`, `warmBattlePortraits`) live in
  `src/shell/assets.ts`, while the pure shell UI view-model projectors
  (`cropCreditFrame`, `battleCheckOverlay`, `buildBattleHudView`,
  `buildCreditsView`, `buildDialogueView`, `buildHudHintsView`,
  `buildJournalView`, `buildRewardStickerView`) live in Pixi-free
  `src/shell/view-models.ts` (re-exported identically through
  `src/shell/assets.ts`, Milestone 137); pure gameplay
  feedback and outcome helpers (`petEffectForCompanion`, `hapticForTick`,
  `buildSoundContext`, `resolveArcadeOutcome`, `collectLevelUpNotices`,
  `shouldClearRest`, `isOverworldConfirm`, `stepJukeboxTrack`,
  `resolveSoundtrack`, `createAreaBannerTracker`, `createJournalNotesCache`,
  `captureAreaPostcard`, `deliverAreaPostcard`, `shouldPlayToolEventChime`,
  `createToolEventChimeSync`, `createNpcChatterSync`) live in `src/shell/feedback.ts`; desktop mouse/pen
  overworld press-and-hold steering and near-player tap detection
  (`computeOverworldSteer`, `isOverworldTap`, `bindOverworldPointerSteer`) live
  in `src/shell/overworld-pointer.ts`; and
  shell keyboard/gamepad overlay & journal shortcut orchestration
  (`canPhotoMode`, `canPhotoFromJournal`, `canBattlePeek`, `canOverworldSteer`,
  `isJournalShortcutActive`, `isOverworldFree`, `isBannerEligible`,
  `createInputShortcuts`) lives in `src/shell/input-shortcuts.ts`; dynamic
  browser tab title formatting (`formatDocumentTitle`) lives in
  `src/shell/document-title.ts`, serialized area loading and door-fade target
  prefetching (`createAreaLoader`) live in `src/shell/area-loader.ts`, and
  dev/harness-only QA menu, console, badge, and pack/slot session management
  (`loadQaBoot`, `createQaSession`) live in `src/shell/qa-session.ts`
  (dynamically imported only outside production builds, Milestone 138) so
  `src/main.ts` stays cleanly under 950 lines and focused on composition and
  lifecycle.
- WebGL context-loss recovery and cozy boot-error fallback
  (`src/shell/lifecycle.ts`, `src/render/battle-view.ts`, `src/render/view.ts`,
  `src/main.ts`, Milestone 141): `LifecycleContext` carries optional
  `contextLost?: boolean` so `shouldFreezeLiveLoop` freezes fixed-timestep
  accumulation and rendering whenever GPU context is lost. `bindWebGlRecovery`
  listens on the game canvas for `webglcontextlost` (calling
  `event.preventDefault()` so the GPU context can be restored, clearing live
  inputs, zeroing the accumulator, and flushing any eligible save) and
  `webglcontextrestored` (invalidating the cached blurred battle/arcade
  backdrop via `view.invalidateBackdrop()`, reloading the active area via
  `areaLoader.ensureArea(true)`, and redrawing). If `boot()` ever rejects,
  `renderBootError` mounts a self-contained inline-styled `#f8edcf` / `#47321f`
  storybook recovery card (`"Cloverhollow hit a bump!"`, safe error summary,
  and `"Reload"` button) inside `#app` with zero cost on normal boot.
- Tactile haptics (`src/platform/haptics.ts`, Milestones 91, 121, 122, 142 &
  165):
  progressive enhancement with zero new npm dependencies. `createHaptics()`
  checks for a native Capacitor Haptics plugin (`Capacitor.Plugins.Haptics`) via
  strict type guards, then fires dual-rumble Gamepad haptic actuators via
  `triggerGamepadRumble(pads, kind)` (`GAMEPAD_RUMBLE_EFFECTS`: `light` 35 ms
  0.08/0.22, `medium` 70 ms 0.22/0.45, `celebrate` 150 ms 0.38/0.65; probed by
  `hasRumbleGamepad(pads)` across `navigator.getGamepads?.()`), and finally
  falls back to `navigator.vibrate` (`light: 10`, `medium: 18`,
  `celebrate: [14, 40, 22]`), respecting both OS
  `prefers-reduced-motion: reduce` and the in-game Reduced Motion toggle via
  `isReducedMotionActive()` (`src/platform/reduced-motion.ts`) and no-oping
  safely on unsupported browsers or during synthetic harness steps.
  Projected via `hapticForTick` (`src/shell/feedback.ts`) with strict priority
  `"celebrate"` > `"medium"` > `"light"`:
  `"celebrate"` on Golden Chef (`goldenCooked`), `soothed` transition,
  `battle-together`, `prize-won`, `fish-catch`, `level-up`, `sticker`,
  `skee-hundred`, and `taco-order`; `"medium"` on `GREAT!` `battle-hit`,
  `comet-bump`, `lasso-twirl`, `cook-ding`, `taco-oops`, and `battle-faint`;
  and `"light"` on `battle-recover`, `claw-grab`, `mole-boop`, `taco-top`, `fish-bite`,
  `skee-score`, `comet-star`, `flute`, `lantern-on`, `coin`, `item`, and
  companion pet.

### 3.2 Input
- Devices produce one `ActionFrame` per tick: a `move` vector (x and y in
  -1..1) plus booleans `confirm`, `cancel`, and `menu`, and optional
  `lantern`, `flute`, and `lasso`, each present only while pressed (like a
  touch `choose`): a blank
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
  off (`lantern`); F plays the flute (`flute`, Milestone 47); R twirls Coach
  Ash's rainbow lasso in battle (`lasso`). Game keys never
  respond while a text field has focus: the QA console's input owns the
  keyboard then (section 11), so typing a command never moves Fae or submits
  the dialogue. On touch, a
  lantern button beside the journal button appears once Fae has the lantern
  and glows lavender while it's on, and a ♪ flute button beside it once she
  has the flute. The tool buttons step aside while a conversation or a battle
  is open: the tools do nothing then, and the dialogue reserves room for
  confirm and cancel only.
- Gamepad (standard mapping) and touch (virtual stick plus buttons, section
  3.2.1) map to the same frame. The left stick uses a radial 25% dead zone,
  rescaled so its remaining range is 0..1; d-pad directions (standard buttons
  12..15) override the stick. A/Cross confirms, B/Circle cancels, Y/Triangle
  or Start opens the journal, X/Square toggles the lantern, the left shoulder
  (LB/L1, standard button 4) twirls the lasso in battle, and the right
  shoulder (RB/R1, standard button 5) plays the flute. Select/Back/View
  (standard button 8, read via pure `gamepadSelectPressed` and
  `gamepadPhotoButtons` in `src/platform/gamepad.ts` without altering
  `ActionFrame`, Milestones 115 & 117)
  toggles the Battle Field Guide Peek card during battle `command` phase or
  Photo Mode in the free overworld; while Photo Mode is active, gamepad A
  (button 0) snaps a framed Postcard (swallowing overworld confirm) and B
  (button 1) exits Photo Mode; while Battle Peek is open, gamepad B dismisses
  only the peek card (swallowing `cancel`). `gamepadHasActivity` detects active
  standard-pad stick movement (`> 0.25`, left or right stick Y) or button
  presses (`0..15`) so the HUD Key Hints ribbon (including `P`/`View` Photo and
  `I`/`View` Field Guide), Journal `OPTIONS` Controls card, battle action
  badges, and Boop-a-Mole's middle hole cap (`Z`/`A`) adapt dynamically between
  keyboard and gamepad glyphs. While the Journal
  is open without an overlay, `gamepadRightStickY` (`axes[3]`),
  `gamepadNavDirection` (D-Pad `12..15` or left stick past `0.55`), and
  `GamepadInput.consumeNavStep` / `consumeConfirmEdge` / `rightStickY` drive
  smooth page scrolling, focus cycling, Land Guide pin stepping, and option
  activation alongside `LB`/`RB` tab flipping (Milestone 124). Only
  standard-mapping pads count; connected pads merge with button OR and first
  non-zero movement.
  When devices provide different movement vectors, touch wins, then keyboard,
  then gamepad.
- Overworld desktop mouse/pen steering and near-player tap actions
  (`src/shell/overworld-pointer.ts`, Milestones 129 & 130): pressing and holding
  the primary mouse or pen button (`(pointerType === "mouse" || pointerType ===
  "pen") && button === 0`) on the overworld canvas steers Fae toward the cursor
  via `computeOverworldSteer` using `GameView.playerScreenPoint(state)` (18 px
  dead radius so Fae stops cleanly beside the cursor without jitter; smooth
  linear speed ramp out to 64 px at full stride, fed through
  `TouchInput.setPointerArrow` clamped to `-1..1` without interfering with touch
  virtual-stick controls). Active holds recompute per tick via `sync()` and
  release idempotently on pointer end, lost capture, window blur, hidden
  visibility, harness reset, or opening any overlay, transition, battle,
  dialogue, arcade game, journal, photo mode, title, or QA panel
  (`canOverworldSteer` in `src/shell/input-shortcuts.ts`). On `pointerup`, a
  brief low-drag click near Fae (`isOverworldTap`: `<= 12 px` drag, `<= 260 ms`,
  within `96 px` of `playerScreen`) invokes `onTapNearPlayer`, which triggers
  overworld `confirm` only when Fae is resting (`view.isResting()`), at a rest
  spot (`findRestSpot`), or beside a pettable companion (`findPettableCompanion`)
  so random canvas clicks never open unintended dialogue while clicking near
  Maddie or a bench cleanly pets or rests.

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

### 3.3 Gameplay sound, soundtrack, and ambience
- Sound effects, synthesized cozy JRPG soundtrack, and procedural ambience beds
  (still no voice acting, section 13). `src/core/sound.ts` derives a closed set
  of `SoundCue` values from state diffs, and `src/core/music.ts` projects
  `soundtrackFor(world, state, { titleOpen })` to `{ track, ambience, duck, title }`;
  both stay 100% pure with no DOM, timers, clock, randomness, or I/O. The cue
  and soundtrack layers are source-agnostic, so generated or recorded clips can
  replace synthesized voices without changing gameplay. Arcade transitions add
  `claw-move`, `claw-drop`, `claw-grab`, `claw-miss`, and `prize-won` for the
  claw machine, and `skee-aim`, `skee-roll`, `skee-score`, `skee-hundred`, and
  `tickets-won` for skee-ball, and `mole-pop`, `mole-boop`, and `mole-whiff`
  for Boop-a-Mole, `comet-move`, `comet-star`, and `comet-bump` for Comet
  Cruise, `cook-start`, `cook-frozen`, and `cook-ding` for the clubhouse
  microwave, `fish-cast`, `fish-nibble`, `fish-bite`, `fish-reel`, and
  `fish-catch` for Bubblegum Bay fishing, and `taco-top`, `taco-oops`, and
  `taco-order` for Chef Mateo's Taco Truck Kitchen (Milestone 165). Battle
  depth adds `battle-together` (a rising C-major-9th sparkle arpeggio when
  Together! launches, replacing `battle-command`), `battle-recover` (emitted
  instead of `battle-hit` when entering `battle.phase === "result"` with
  `battle.command === "recover"`, Milestone 172), `battle-faint` (emitted on
  entering `battle.phase === "rest"` when Fae runs out of energy and plays her
  cozy fainting choreography, Milestone 165), projects `flute` when Flute
  Friends assist in battle, and adds `lasso-twirl` (a rising rope whoosh and
  wooden star ping) when Fae twirls Coach Ash's rainbow lasso in battle.
- Soundtrack projection (`src/core/music.ts`): closed track set `title`
  ("Watercolor Morning"), `home` ("Cloverhollow Town"), `cafe` ("Cinnamon
  Waltz"), `market` ("Pippin's Basket Waltz", 102 BPM 3/4 G major corner-grocer
  waltz for `market`), `parlor` ("Sweet Scoop Rag", 112 BPM 4/4 Bb major parlor
  ragtime for `parlor`), `loft` ("Paper Plane Sketchbook", 96 BPM 4/4 C major /
  A minor daydream for `milo-house`), `bloom` ("Rosie's Flower Window", 94 BPM
  3/4 F major pastoral waltz for `rosie-cottage`), `hills` ("Clover Meadow"),
  `road` ("Sunberry Road", 104 BPM 4/4 sunny F major 5-voice country road
  stroll for connected East Road areas `lane` over `"town-breeze"` and
  `crossing` over `"forest"`, keeping `boardwalk` on `bay` over `"ocean"`,
  Milestone 172),
  `sanctuary` ("Meadow of Friends", pre-reveal Wildlife Sanctuary), `festival`
  ("Cloverhollow Jubilee", 108 BPM 4/4 D major / G major celebration jubilee for
  post-finale `sanctuary` once `milo_revealed === true`, over `"forest"`
  ambience), `school` ("Bell & Chalk"), `bay`
  ("Bubblegum Breeze"), `fishing` ("Docked by the Tide", unducked over
  `"ocean"` ambience while `state.arcade.game === "fish"` at Bubblegum Bay's
  dock, ducking only when dialogue opens), `cottage` ("Sea-Glass Sunroom", 88
  BPM 4/4 Eb major coastal lullaby for `sue-cottage`), `island` ("Starlight
  Beacon", 86 BPM 4/4 D major / Lydian coastal nocturne for `island`), `pass`
  ("Pinecone Snowfall"), `lodge` ("Hearth & Cocoa"), `cabin` ("Timber & Tea",
  92 BPM 3/4 A major alpine folk air for `jordan-cabin`), `summit` ("Above the
  Pines", 90 BPM 3/4 G major soaring alpine vista waltz for `summit`), `cavern`
  ("Crystal Echoes"), `woods` ("Whispering Canopy"), `clubhouse` ("Our Secret
  Treehouse"), `arcade` ("Star Racer Tokens"), `taco` ("Mateo's Fiesta Truck",
  120 BPM 4/4 A major festive kitchen groove, unducked over `"town-breeze"`
  ambience while `state.arcade.game === "taco"`, ducking only when dialogue
  opens), `enchanted` ("Misty Dream"), `enchanted-calm` ("Ancient Tree's Song",
  once `forest_fizzy` is false), `battle` ("Fizzy Calm-Down!"), `boss` ("The
  Purple Hood", for wind-up mini-bosses, Talk battles, or non-runnable
  battles), `talk` ("Listening Heart", once Talk opens or calm reaches
  `talkAt`), `morning` ("Waking Up", during the morning and credits finale),
  and `silent` ("Quiet", for `harness`). `jukeboxTracks` exports all 31
  non-silent themes in story/album order (`title`, `home`, `cafe`, `market`,
  `parlor`, `loft`, `bloom`, `school`, `bay`, `fishing`, `cottage`, `island`,
  `pass`, `lodge`, `cabin`, `summit`, `cavern`, `woods`, `clubhouse`, `hills`,
  `road`, `sanctuary`, `festival`, `arcade`, `taco`, `enchanted`,
  `enchanted-calm`, `battle`, `boss`, `talk`, `morning`) for the Journal OPTIONS
  Music Box (shell-only
  override, never saved, plays unducked while the journal is open and returns
  smoothly to the live area theme on close, title, or reset). Ambience beds
  (`none`, `town-breeze`, `ocean`, `mountain-wind`, `hearth`, `forest`,
  `enchanted-shimmer`, `arcade-hum`, `cavern-drips`, `cafe-murmur`) match each
  outdoor area, the café, the lodge, the cavern, and the arcade, and pause in
  battles. Music ducks smoothly during dialogue, the journal, non-fishing /
  non-taco arcade games (and clubhouse microwave cooking), battle rewards, and
  cozy battle-faint rest (`battle.phase === "rest"`, Milestone 165).
- `src/platform/audio.ts` creates a single AudioContext first thing at boot,
  before anything awaits, and resumes it at every chance: right away, on each
  key, pointer, or touch, and whenever a cue plays while it isn't running.
  Its master chain routes SFX, music (`src/platform/music.ts` over the 30
  multi-voice scores split across `src/platform/scores-helpers.ts`,
  `src/platform/scores-town.ts`, `src/platform/scores-wilds.ts`,
  `src/platform/scores-interiors.ts`, and `src/platform/scores-expansion.ts`,
  re-exported by `src/platform/scores.ts`, dry plus warm stereo ConvolverNode
  reverb), and procedural ambience (`src/platform/ambience.ts`) through a
  shared `DynamicsCompressorNode`. Music arranges its 10 instrument voices
  across a balanced stereo chamber soundstage (`VOICE_PAN` in
  `src/platform/music.ts`, within `[-0.4, 0.4]` via feature-guarded per-voice
  `StereoPannerNode`s cleaned up on track crossfade) and shapes every note with
  deterministic `phraseDynamics` (a smooth 16-step sinusoidal phrase breath in
  `[0.92, 1.07]`, subtle `0..8 ms` pluck micro-timing on melodic voices with
  zero drift on rhythmic anchors, and a whisper-soft `0.16x` celesta octave
  shimmer on loop-2+ bar 1 and mid-score downbeats for harp/piano notes
  `<= 76`). Music crossfades (~0.55 s) on track changes, ducks smoothly over
  ~0.3 s to 0.55x gain while gently rolling off highs through a feature-guarded
  warm low-pass `BiquadFilterNode` (`Q = 0.55`, `duckFilterCutoff` ramping
  between `DUCK_FILTER_DUCKED_HZ = 2600` Hz and `DUCK_FILTER_OPEN_HZ = 18000`
  Hz so character voice prosody stays clear, Milestone 152), resumes
  exploration themes on the nearest bar downbeat after battles or shop visits
  via `resumeBarStep` (preserving `stepsPerBar` alignment across 4/4 and 3/4
  waltz scores while `FRESH_START_TRACKS` (`title`, `taco`, `battle`, `boss`,
  `talk`, and `morning`) always start fresh at step 0, Milestones 152 & 160),
  and pauses cleanly on `visibilitychange` when backgrounded; when returning
  visible on `visibilitychange` or `pageshow` (Milestone 132), pure
  `shouldResumeAudioOnVisible(hidden, state)` (`src/platform/audio.ts`)
  triggers `unlock()` before `syncPlayers()` whenever the context is
  `interrupted` or was previously unlocked by a user gesture (`suspended`),
  so iOS WKWebView and Safari auto-resume music and ambience after lock-screen
  or app-switch interruptions without violating initial browser autoplay gates;
  ambience crossfades (~0.7 s), schedules spatialized one-shot biome accents
  across all 9 active ambience beds via `AMBIENCE_ACCENT_CADENCE_MS` (including
  `mountain-wind` sweeping alpine pine gusts with whisper-soft D6/F6 frost-bell
  harmonics and `arcade-hum` distant Star Racer cabinet twinkles, Milestone 152)
  and deterministic `ambiencePan` (`[-0.55, 0.55]`, guarded `StereoPannerNode`s
  disconnected on `onended`), and cleans up all nodes and timers on stop.
  Character-voiced talking blips and key-aligned UI clicks
  (`src/platform/voices.ts`, Milestones 80, 142, 152 & 160) give every named cast
  member, `"Fizzy "` mini-boss (via optional leading `"fizzy "` prefix stripping
  after exact lookup, plus `"Fizzy Kid"` / `"Kid"` mapped to `MYSTERY_VOICE`),
  fairy, critter archetype, and narrator a distinct warm sine/triangle register
  (with optional gentle pitch glide or harmonic overtone and pauses on
  spaces/punctuation, achieving 100% cast voice coverage across all compiled
  story speakers and battle critters), apply deterministic sentence-aware voice
  prosody (`dialogueProsody(text, revealed)` and
  `blipFrequency(speaker, step, char, prosody)` in `src/platform/voices.ts`,
  wired in `dialogueBlipRecipe` in `src/platform/audio.ts`, Milestone 152:
  inquisitive rising tail on `?` clauses, bright enthusiastic lift on `!`, soft
  hushed tone on trailing/leading `...`/`…` whispers, and gentle pitch/gain
  emphasis on uppercase words like `REALLY`/`THAT'S`, clamped to `[0.85, 1.25]`
  pitch and `[0.65, 1.25]` gain with bit-identical output when `prosody` is
  omitted or `NEUTRAL_PROSODY`), and pitch `choice-move`, `battle-command`, and
  `choice-select` clicks to the active soundtrack's pentatonic scale (across all
  31 tracks + `silent`).
  Browsers hold the context (`suspended`, or WebKit's `interrupted`) until a
  key, click, or tap; a gamepad press is not a user activation in any browser,
  so a pad-only player on the web hears nothing until one. The iOS app's web
  view lets it run at once (Capacitor sets
  `mediaTypesRequiringUserActionForPlayback` to none), so pads get sound there
  from the start. Audio unavailable or held must never break the game. The
  context exists before the page has loaded: Playwright runs each evaluate in
  Chromium as a user gesture, and a context made after one would start without
  a key (`sound.spec.ts` slows every script to check).
- iOS: Web Audio keeps WebKit's default `ambient` session, so the ring/silent
  switch mutes the game (Apple's guidance for non-essential game sound).
- Sound, music (default 75%), and ambience are on by default. Master mute is
  toggled by M (ignored while typing in an input or textarea), the `♪ on/off`
  pill on the journal's notes heading, or Sound Effects on the journal's
  OPTIONS page; music mute, four-step music volume (25%..100%), and ambience
  mute live on the OPTIONS page. All five preferences are stored together under
  `cloverhollow-audio` in Capacitor Preferences, never in the save, while
  remaining backwards-compatible with legacy boolean and `{ muted, level }`
  shapes.
- A four-step volume control (25%, 50%, 75%, 100%) sits beside the mute pill
  in the notes heading (and mirrors Sound Effects volume on OPTIONS). It is a
  sticker-style 44 CSS-pixel control with a slider role: taps/clicks cycle
  through the levels, and arrows, Home, and End work from the keyboard without
  stealing the journal's page-flip arrows. Its visible value is accessible by
  keyboard, touch, and mouse. 100% keeps the existing moderate master gain.
  There is no zero step, so mute stays an independent choice and unmuting
  restores the selected level. The old boolean-only preference shape loads at
  100% SFX and 75% music.
- Story lines may carry one of the closed `sound:` tags `chime-red`,
  `chime-yellow`, `chime-green`, `chime-blue`, or `flute`. The tag is carried
  by dialogue state and projected as a cue whenever that line opens or replaces
  another line, including when the text is repeated. Unknown story sounds are
  rejected by the content loader. The music-room recipes are synthesized
  xylophone bars (C5, E5, G5, C6) and a short breathy rising flute call. Echo
  Chimes battle checks (`kind: "echo"`) reuse `chime-red`, `chime-yellow`,
  `chime-green`, and `chime-blue` (notes `0` through `3`) on each demo note
  start and each echoed note press.
- Footsteps use a closed surface set (`grass`, `sand`, `wood`, `snow`, `stone`,
  `tile`, `carpet`). Each area has a required `content/surfaces/<area>.json`
  with a default and first-match polygon regions in area units. The loader
  rejects unknown surfaces, malformed or out-of-bounds polygons, and a missing
  file throws an error naming `content/surfaces/<id>.json` and directing registration
  in `src/content/load.ts`. Surface lookup is pure and footstep cues are
  `footstep-<surface>`, emitted on walk half-cycles (`walkCycleUnits / 2`) while
  moving. The platform shell (`src/platform/audio.ts`) synthesizes multi-layer
  acoustic Web Audio foley for all seven surfaces (`grass`, `sand`, `wood`,
  `snow`, `stone`, `tile`, `carpet`) with deterministic per-stride organic pitch
  variation (`footstepPitchFactor(tick)` in `src/platform/voices.ts`,
  `0.94..1.06`, zero `Math.random()`), remaining replaceable by clips pending
  the owner's pick. The plaza's default is stone, because it is a paved square.
- Celebration fanfares & camera shutter audio (Milestone 107, `src/platform/audio.ts`):
  `sticker` plays a warm 6-note storybook harp/celesta sparkle flourish
  (C5→E5→G5→B5→C6 + C7 sparkle overtone, ~0.48 s); `level-up` plays an uplifting
  7-note celebratory RPG arpeggio (C5→D5→E5→G5→A5→C6→E6 over a C4 bass root +
  C7 shimmer, ~0.55 s); and `AudioController.playEffect` adds `"camera-shutter"`
  (dual-transient mechanical click + soft lowpass lens whirr, ~0.12 s). Pure
  static cue recipe tables (`soundCueRecipes`, `soundCueRecipe`, `AudioSegment`,
  `AudioRecipe`) live in `src/platform/audio-recipes.ts` (Milestone 114), while
  the 14 shell companion & UI foley recipes (`CompanionAudioEffect`,
  `effectRecipes`, `effectRecipe`) live in modular `src/platform/audio-effects.ts`
  (Milestone 172, type-only import of `AudioRecipe` from `./audio-recipes`, zero
  circular runtime dependency) and are re-exported identically from
  `src/platform/audio-recipes.ts` and `src/platform/audio.ts` for
  backwards-compatible unit verification.
- Tactile storybook UI foley & haptic micro-feedback (Milestone 133,
  `src/platform/audio-recipes.ts`, `src/platform/audio.ts`,
  `src/shell/title-flow.ts`, `src/ui/journal-field-note.ts`,
  `src/ui/journal.ts`, `src/shell/input-shortcuts.ts`, `src/main.ts`): extends
  `CompanionAudioEffect` / `effectRecipes` with seven gentle (`<= 0.08` gain,
  zero square wave) acoustic recipes: `"title-move"` (soft wooden-marimba
  cursor tick), `"title-start"` (4-note sunlit harp/celesta chord with gentle
  harmonic bloom), `"page-turn"` (feathery lowpass paper-rustle + bookmark tap),
  `"card-open"` (crisp cardstock lift + rising chime), `"card-close"` (soft
  cardstock tuck + settling tone), `"toggle-on"` (cheerful wooden-button click),
  and `"toggle-off"` (gentle wooden-button release). `AudioController` records
  played non-core effects in a rolling 64-entry buffer (`effects()`, cleared via
  `clearEffects()` on harness resets) while keeping `log()` strictly
  `SoundCue[]`. Title transitions map via pure `titleEffectForTransition`
  (adding `"light"` haptic on `"title-start"`), Journal tab flips fire
  `onPageChange` (`"page-turn"` + `"light"` haptic without double-playing
  `"choice-move"`), painted Valley Map pin clicks and keyboard/gamepad land-pin
  steps fire `onMapSelect` (`"title-move"` wooden-marimba pin tick + `"light"`
  haptic, Milestone 169), Field Note / Field Treasures cards fire
  `onOverlayChange`
  only on real user open/dismiss flips (`"card-open"` / `"card-close"` +
  `"light"` haptic on open), Battle Field Guide Peek plays `"card-open"` /
  `"card-close"` during active battle only, Photo Mode plays `"toggle-on"` /
  `"toggle-off"` during live overworld transitions (silent on harness reset or
  backup import), and Journal `OPTIONS` toggles (`Sound Effects` when unmuting,
  `Music`, `Ambience`, `Gentle Timing`, `Key Hints`, `Text Speed`, and `Reduced
  Motion`) play `"toggle-on"` / `"toggle-off"` + `"light"` haptic. Interactive
  NPC tool micro-events also play `"tool-sparkle"` (Milestone 155: delicate
  3-note sunlit celesta shimmer, `sine` 659 -> 880 -> 1318.5 Hz at `0 / 0.055 /
  0.11 s`, gentle gains `0.055 / 0.05 / 0.045`, zero square waves) + `"light"`
  haptic once per fresh activation in live overworld play via
  `shouldPlayToolEventChime` / `createToolEventChimeSync`
  (`src/shell/feedback.ts`, `src/main.ts`).
- Celebratory minigame audio flourishes (Milestone 152,
  `src/platform/audio-recipes.ts`, re-exported via `src/platform/audio.ts`):
  upgrades three key minigame reward cues into warm multi-segment storybook
  flourishes (gains `<= 0.10`, zero core `SoundCue` changes): `skee-hundred`
  plays a 6-segment boardwalk bullseye bell arpeggio (C5->E5->G5->C6->E6 +
  2637 Hz high harmonic shimmer, 0.46 s); `cook-ding` plays a 5-segment vintage
  microwave bell resonance (1319 Hz, 2637 Hz, 3951 Hz) with a warm two-note
  golden chime (1047 -> 1568 Hz, 0.42 s); and `tickets-won` plays a 6-segment
  ascending ticket/coin twinkle cascade (784 -> 880 -> 1047 -> 1175 -> 1568 Hz +
  3136 Hz sparkle overtone, 0.40 s).
- Bespoke Taco Truck Kitchen foley & battle-faint lullaby (Milestone 165,
  `src/platform/audio-recipes.ts`, re-exported via `src/platform/audio.ts`):
  `taco-top` plays a cheerful marimba topping pop (`587.33 -> 783.99 Hz`
  triangle/sine pluck + whisper crisp crunch burst at `lowpass: 3200`, `0.09 s`);
  `taco-oops` plays a soft playful wooden klunk (`340 -> 235 Hz` triangle bend +
  low woody body, `0.11 s`, peak gain `0.055`); `taco-order` pairs a crisp
  vintage kitchen service bell (`1568 Hz` + `3136 Hz` sine resonance) with a
  3-note fiesta bell trill (`783.99 -> 987.77 -> 1174.66 Hz`, `0.36 s`); and
  `battle-faint` plays a tender descending music-box lullaby (`659.25 -> 587.33
  -> 523.25 -> 440 Hz`, warm sine + triangle blend, `0.50 s`, gains `<= 0.065`);
  and `battle-recover` (Milestone 172) plays a warm ascending leaf-breath triad
  (`523.25 -> 659.25 -> 783.99 -> 1046.5 Hz` sine + soft triangle shimmer,
  `0.36 s`, gains `<= 0.08`).
## 4. Presentation (locked)
- Logical view: 720 units tall. Width = 720 x screen aspect, clamped to
  960..1600 (4:3 to 20:9). Letterbox outside that range.
- Canvas backing resolution: devicePixelRatio, capped at 2. The canvas CSS size
  always equals the viewport (Pixi `autoDensity`); an e2e test at
  deviceScaleFactor 3 guards this, because iPhones report a ratio of 3.
- Dev and harness builds draw a `tick N · x,y` readout in the top-left (centred
  at the top edge during battles so it stays clear of the energy sticker) so
  screenshots describe state. Production builds draw no debug text.
- Painted art, not pixel art: linear filtering with mipmaps. Runtime asset URLs
  are document-relative (`assets/...`), which works under Vite sub-paths and
  Capacitor's `capacitor://localhost` scheme.
- Source art is authored at 2x logical units (1 unit = 2 source pixels).
- The camera follows the player with a small dead zone, clamps to area bounds,
  and snaps to whole device pixels. `smoothFollowCamera` (`src/render/camera.ts`)
  delegates straight to `followCamera` when `snap` is true (area load, reset,
  `harness`, or paused harness stepping); during live running play (`snap`
  false), it applies a subtle facing look-ahead (`±22u` x / `±14u` y) through
  `followCamera` and smoothly damps toward it (`0.14` per frame, snapping within
  `0.15u`), clamped cleanly to area bounds.
- Depth: the area ground layer is always at the back; characters y-sort by
  their feet, and props sort against them column by column by the front edge
  of their footprints (section 6.2).
- Procedural watercolor VFX kit (`src/render/vfx-textures.ts` composing the thirteen
  keepsake builders from `src/render/keepsake-textures.ts` and
  `src/render/keepsake-textures-expansion.ts` and re-exporting
  `KeepsakeTextureKey`, Milestones 72–73,
  84, 88, 93, 95–96, 98, 114, 164): thirty-four small cached offscreen-canvas Pixi
  textures (`contactShadow`, `softGlow`, `sparkle`, `starGemCharm`, `petal`,
  `waterGlint`, `mistWisp`, `sunbeam`, `sunburst`, `paperGrain`, `puff`, `heart`,
  `energyRing`, eight hand-inked 48x48 comic emote bubbles `emoteQuestion`,
  `emoteExclaim`, `emoteNote`, `emoteZzz`, `emoteHeart`, `emoteSparkle`,
  `emoteWave`, and `emoteWorry`, plus thirteen hand-inked 48x48 quest keepsake
  tokens `keepsakeCrystal`, `keepsakePin`, `keepsakeGeode`, `keepsakeFeather`,
  `keepsakeTaco`, `keepsakeWreath`, `keepsakeCompass`, `keepsakeClover`,
  `keepsakeWhistle`, `keepsakeSketch`, `keepsakeAurora`, `keepsakeShell`, and
  `keepsakeRibbon`), rendered with warm plum-brown shadows (`#52455F`), warm
  `#47321F` ink outlines, pastel washes, gouache puffs, and seamless cold-press
  paper tooth. In non-harness areas, a `shadowLayer` sits directly above `ground`
  and below `depth` (with a pooled `footstepLayer` above it) to ground Fae, party
  members, visible NPCs (hover shadows under the four fairies, skipping the
  painted `bus-stop`, soft indoor `0.24` alpha across all 18 indoor rooms in
  `INDOOR_AREAS` including `cafe`, `market`, `parlor`, `sue-cottage`,
  `jordan-cabin`, `milo-house`, and `rosie-cottage` vs `0.30` outdoors, and `52 px` adult contact shadows / `132 px`
  adult emote head clearance across all 15 adult townspeople in `ADULT_NPCS`:
  `mom`, `dad`, `teacher`, `nurse`, `coach`, `music-teacher`, `fern`, `chef`,
  `barnaby`, `bree`, `buster`, `bay-keeper`, `pass-keeper`, `pippin`, and
  `penny`, Milestone 123), and
  overworld critters (scaling slightly as characters
  bounce or hover); a deterministic `BiomeAtmosphere` (`src/render/atmosphere.ts`,
  with pure stateless zero-Pixi particle recipes modularized across
  `src/render/atmosphere-shared.ts`,
  `src/render/atmosphere-outdoor.ts`,
  `src/render/atmosphere-indoor.ts`, and the `< 120`-line dispatcher barrel
  `src/render/atmosphere-recipes.ts`, re-exported from `atmosphere.ts`,
  Milestones 118 and 136; zero `Math.random()`) adds per-biome water glints, lamp pools, drifting
  petals/pollen, snow and lodge chimney smoke, sunbeams, lavender mist, fairy
  aura halos, hearth glow, arcade neon blooms, blooming clubhouse planter-deck
  pollen sparkles (while `garden_sprouted` or `garden_ripe`), Milestone 108
  story-reactive world atmosphere accents (`cafeCinnamonSteam` in `cafe` when
  `spice_returned` and (`buster_reward` or `taco-chef` calmed): 6 warm amber
  `#FFE2A8` rising cinnamon wisps and sparkles over Chef Bea's counter;
  `plazaStarGlow` in `plaza` when `buster_reward`: 8 pastel-gold `#FFE89A` and
  sky-blue `#B8E8FF` fountain mist sparkles; `passHearthWisps` in `pass` when
  `sanctuary_gift`: 6 cream-gold `#FFF5DF` chimney smoke curls above Mrs.
  Flurry's Ski Lodge roof; plus Milestone 159 bounded accents via
  `addBoundedSparkles`: `marketOrchardGlow` in `market` when
  `market_note_read` and `sunberry_harvests > 0`: 5 golden-honey `#FFE399` /
  `#FFD2A6` sparkles over the produce bins; `parlorSundaeSparkle` in `parlor`
  when `parlor_note_read` and `buster_reward`: 5 berry/mint `#FFB8D2` /
  `#AEEBD8` sparkles above the gelato case; `cavernChimeShimmer` in `cavern`
  when `cavern_chime_rung` and `buster_reward`: 6 additive prismatic `#9AE8FF`
  / `#D8B8FF` / `#FFE89E` sparkles over the cavern waters; `musicRoomHarmony`
  in `music` when `has_flute` and `buster_reward`: 5 golden-lavender `#FFE29A`
  / `#D6C2FF` acoustic sparkles above the piano and chimes; and
  `artRoomPaletteGlow` in `art-room` when `art_open` and `buster_reward`: 5
  pastel watercolor `#FFA8C5` / `#FFE082` / `#9CE3B4` / `#9AD4FF` sparkles
  under the studio skylight; plus Milestone 161 `sanctuaryFestival` in
  `sanctuary` when `milo_revealed`: 14 sunlit pastel clover-petal and
  golden-star sparkles drifting gently across the picnic meadow; all biomes
  and story-reactive accents respect
  `reducedMotion` by holding positions and pulses steady across ticks,
  Milestones 119 and 159), and an `emissive`
  light layer mounted above `lanternLayer` (`emissiveLayer`, boosted smoothly
  during lantern dusk for cavern crystals/lanterns, enchanted fairies, plaza lamp
  arches, lodge hearth, and café counter glows, plus cool subterranean edge
  framing and crossing shimmer rings in `cavern`); a pooled `emoteLayer` sits
  above `depth` and below `paperGrain`; and a world-anchored `paperGrain`
  `TilingSprite` (`multiply`, alpha `0.035`) gently unifies sprites, shadows, and
  paintings.
  Door fades use cubic smoothstep easing (`fadeAlpha`) paired with a subtle
  viewport-centered page-turn zoom (`transitionZoom` in `src/render/fade.ts`:
  `1.00 -> 1.022` on `"out"`, `0.972 -> 1.00` on `"in"`, strictly clipped inside
  `viewportMask` and `1` outside transitions or in `harness`) and a whisper-soft
  paper-rustle noise tail in the `"door"` sound recipe (`src/platform/audio.ts`).
- Story-driven time-of-day lighting arc (`src/render/time-of-day.ts`, Milestone
  90): pure presentation-only `storyTimeOfDay(world, state)` computes a subtle
  `TimeOfDayGrade` (`morning`, `day`, `golden-hour`, `enchanted-twilight`,
  `golden-meadow`, or `sunrise`), rendered inside `viewport` (strictly clipped
  by `viewportMask`, mounted right after `scene` and before `lanternLayer`) as a
  cached viewport tint plus a soft diagonal top-left additive sun wash
  (`vfx.softGlow`). It always stays neutral (`day`, zero alpha) on `harness`,
  during battles or arcade close-ups, and while the lantern is on. `sunrise`
  warms the Morning Wake-Up finale (`state.finale !== null`);
  `enchanted-twilight` washes `mist` and fizzy `enchanted`; `golden-meadow`
  warms calmed `enchanted` (`forest_fizzy === false`) and post-finale
  `sanctuary` (`milo_revealed === true`); `golden-hour` bathes outdoor
  adventure areas (`plaza`, `park`, `lane`, `crossing`, `boardwalk`, `bay`,
  `island`, `pass`, `summit`, `trail`, `woods`, `hills`,
  `sanctuary`, `field`) once `has_lantern` is set; and `morning` washes `bedroom` and
  `kitchen` before any sticker is earned and before `has_lantern`.
- Photo / Showcase mode (Milestone 90), Postcard Camera (Milestone 107),
  Gamepad Parity (Milestone 114), Touch Camera Controls (Milestone 118),
  Desktop Click-to-Snap / Right-Click-to-Exit (Milestone 151), Touch Journal
  Photo Mode Launcher (Milestone 154), & Mobile Web Share Delivery + Accessible
  Photo Toast (Milestone 160):
  pressing `P` (`KeyP`), gamepad Select (standard button 8), or tapping the
  touch-only `Photo Mode` button (`.journal-photo-btn`) inside Journal
  `OPTIONS`'s `CONTROLS` card (shown strictly under `:root[data-touch="on"]`
  when `canPhotoFromJournal` is true in the free overworld, closing the Journal
  and entering Photo Mode with zero keyboard input) while exploring the free
  overworld (ignored inside inputs, on title, dialogue, battle, arcade,
  transition, finale, loading, or QA overlays, and ignored on `P`/Select while
  the Journal is open) toggles
  `data-photo="on"` on the root, hiding `.sticker-prompt`, `.touch-controls`,
  `.hud-hints`, `.area-banner`, `.qa-badge`, `.notice-marks`, and the dev debug
  readout (`view.setPhotoMode`) for unobstructed storybook views. On touch devices
  (`:root[data-touch="on"][data-photo="on"]`), `createPhotoTouchBar`
  (`src/ui/postcard.ts`, styled in `src/ui/sticker.css`) displays `.photo-touch-bar`
  (`role="group"`, `aria-label="Photo mode controls"`) in the bottom-right safe
  area with two 44×44 px warm cream (`#fbf6e8`) circular `#47321f`-inked buttons:
  `.photo-touch-snap` (`aria-label="Snap postcard"`, shared exported
  `cameraIcon()` inline SVG with zero `<text>` nodes) and `.photo-touch-close`
  (`aria-label="Exit photo mode"`,
  `×`), completely hidden on desktop and outside Photo Mode and excluded from Pixi
  `extract.canvas` captures. While Photo Mode
  is active, pressing `Enter`, `Space`, gamepad A (button 0), or left-clicking
  the canvas on desktop (via pure `photoModePointerAction` in
  `src/shell/overworld-pointer.ts`, requiring `<= 12 px` drag from `pointerdown`
  and ignoring touch UI or `pointerType === "touch"`) (swallowing
  confirm so it never interacts
  or scrolls) plays `camera-shutter`, triggers a gentle `light` haptic tap and a
  240 ms warm-cream `.photo-shutter-flash` overlay (softened to a subtle 220 ms
  pulse under Reduced Motion, hidden cleanly on exit or reset), extracts the live
  viewport via Pixi `app.renderer.extract.canvas`,
  frames it inside a warm cream watercolor postcard border (`#fbf6e8` margin,
  `#47321f` hand-inked inner rule, four-leaf clover emblem, region + active
  companion subcaption via `formatPostcardCompanions` / `postcardMetadata` in
  `src/ui/postcard.ts` and `captureAreaPostcard` / `deliverAreaPostcard` in
  `src/shell/feedback.ts`,
  stamping `"with Maddie"`, `"with Maddie & Sue"`, `"with Maddie, Sue & Jordan"`,
  or trimming `> 4` followers to the first 3 plus `"& friends"`, Milestone 136,
  and bottom-right `"<Area> · Wilds of Cloverhollow"` stamp),
  and delivers `cloverhollow-postcard-<areaId>.png` via `deliverPostcard`
  (`src/ui/postcard.ts`, Milestone 160): on touch/iOS (`preferShare` active when
  `data-touch="on"`), `dataUrlToPngFile` decodes the PNG into a `File`
  (`image/png`) and opens the native Web Share sheet (`navigator.share` gated by
  `navigator.canShare`, treating `AbortError` as `"cancelled"` without double
  downloading, and falling back to `triggerPostcardDownload` on unsupported or
  non-abort errors); on desktop it downloads immediately. After non-cancelled
  delivery (`"shared"` or `"downloaded"`), `createPhotoToast` renders a gentle
  top-center `.photo-toast` storybook pill (`role="status"`, `aria-live="polite"`,
  `#47321f` ink on `#fbf6e8`, `pointer-events: none`, excluded from Pixi WebGL
  capture, defensively hidden whenever `:root:not([data-photo="on"])`, with full
  `@media (prefers-reduced-motion: reduce)` and `:root[data-reduced-motion="on"]`
  transition/animation suppression) announcing `"Postcard shared · <Area>"` or
  `"Postcard saved · <Area>"` via `postcardToastMessage` for `1800 ms` and hiding
  immediately on Photo Mode exit or harness reset. Pressing `P` again,
  `Escape`, gamepad Select/B (button 8 / button 1), right-clicking the canvas on
  desktop (`contextmenu` prevented via `photoModePointerAction`), or opening any
  overlay exits Photo Mode automatically.
- Texture budget: at most 96 MB of decoded textures per loaded area (UI
  excluded) and no single texture over 2048x2048. Every Pixi spritesheet and
  ground tile loads with `autoGenerateMipmaps: true`. One `AreaView`
  (`src/render/area-view.ts`) owns an area's sprites; swapping areas destroys
  them, and the game neither ticks nor renders until the new area has loaded.
  At boot, `GameView` loads only permanent core sheets (`fae-sheet`, party
  members in `world.party`, `glow-sheet`, `ambient-sheet`, and the battle toy
  atlas — deduplicating party members that also appear in `world.characters`).
  Per-area NPC and critter atlases (`areaEntityAtlases`, extracted with pure
  stateless overworld render helpers into `src/render/overworld-render.ts`, with
  Pixi-free overworld VFX, lantern, companion emote, backdrop, and Star Gem glint
  math extracted into `src/render/overworld-vfx-math.ts` and re-exported
  identically through `src/render/overworld-render.ts`, Milestone 160, and
  re-exported from `src/render/view.ts`, alongside pooled overworld visual
  effects in `OverworldEffectsController` inside `src/render/overworld-effects.ts`
  (Milestone 120), overworld entity sprite pools (player, party followers, NPCs,
  critters, and ambient flyers) in `OverworldEntityLayer` inside
  `src/render/entity-layer.ts` (Milestone 130), Pixi-free camera/viewport,
  eviction, story-atmosphere, prompt, chatter-anchor, notice-mark, and render-info
  projections in `src/render/view-projections.ts` (Milestone 167), reusable
  primitive/geometry JSON validators in
  `src/content/parsers.ts`, Milestone 97, arcade/minigame content &
  calibration parsers in `src/content/arcade-parsers.ts`, Milestone 110, and
  battle/critter/party/feeling/sticker/level/treat parsers & validators in
  `src/content/battle-parsers.ts`, Milestone 121, and pure area/lands/tunables/
  fixture/character/ground/map/surface parsers in `src/content/area-parsers.ts`,
  re-exported from `src/content/load.ts`, Milestone 154) load on demand with
  their area (and warm on door fade-out prefetch) and unload on the same
  bounded current + previous area residency window as ground tiles and prop
  atlases, so the way back through a door is a cache hit instead of a reload
  (owner, 2026-11-23: every door crossing held a paper-white screen for the
  whole target reload). DOM-only sticker/prize/credits frame crops read tiny
  atlas JSON metadata without loading unused WebGL textures or decoding all
  critter sheets up front; arcade, clubhouse microwave, fishing dock, and taco
  truck close-ups (paintings and DOM atlases) load on demand when entering
  `arcade`, `clubhouse`, `bay`, or `hills`.
  Runtime spritesheet and prop atlases under `public/assets/` ship as WebP with
  lossless alpha (`cwebp -q 90/92 -alpha_q 100 -m 6`, falling back to
  `-lossless -z 9` if PSNR < 42 dB, via `tools/art/optimize-atlases.ts`,
  Milestone 91; standalone `public/assets/items/lantern/lantern.png` stays PNG
  for the CSS touch button), and DOM callers resolve image paths from
  `meta.image` via `atlasImagePath` (`src/ui/atlas.ts`).

## 5. Characters and animation (locked)
- Frame-by-frame animation in 4 directions: down, up, left, right. Right may
  mirror left until a dedicated right set exists.
- Walk: 6 frames per direction (minimum 4). Frames advance with distance walked
  so feet do not slide: the core accumulates each tick's resolved displacement
  in `state.motion.distance` (sliding along a wall counts only the slide), and
  one full cycle spans `walkCycleUnits` (126). Idle shows when a tick's
  displacement is below epsilon.
- Procedural living motion (`src/render/motion.ts`, Milestones 73 & 84,
  non-harness areas): pure deterministic pose offsets from `(state, tick)` apply
  subtle stride-synced vertical bounce and elastic squash-stretch (`walkPose`,
  with parabolic airborne bounds for `acorn-squirrel` side walks), gentle
  feet-anchored idle breathing (`idleBreathing`, skipping `bus-stop`), 8-tick
  landing squash-pop when sitters settle (`sitSquash`), distinct companion idle
  personality poses after 180 ticks of stillness (`companionIdlePose`: Maddie's
  cozy loaf nap breathing, Pond Pup's happy mini-hop & tail wag, Acorn
  Squirrel's double-perk hop, Ribbon Bunny's gentle ear-bounce hop, and
  standing friends' relaxed weight-shift sway; falling back to `idleBreathing`
  below 180 ticks), continuous hover bob and banking tilt on `fairy-*` NPCs
  (`fairyHover`, with grounded altitude-scaled shadows), and playful startle
  jumps, snappy hops, and forward lean on roaming critters (`roamerHop`). In
  live play (advancing 1..5 ticks per render in the same non-harness area), each
  Fae half-stride spawns two surface-tinted gouache `puff` particles
  (`surfaceAt` in `footstepLayer`) behind her feet; when Reduced Motion is
  active (`isReducedMotionActive()`), `updateFootsteps` clears active puffs and
  returns early so walking stays calm and particle-free (Milestone 119).
- Hand-painted overworld emote bubbles (`src/render/emotes.ts`, Milestones 85 &
  144, render-only, skipped on `harness`, dialogue, battles, and arcades): pure
  deterministic `evaluateOverworldEmotes` drives a pooled 20-slot `emoteLayer`
  (`vfx-textures.ts` adds hand-inked 48x48 `emoteSparkle`, `emoteWave`, and
  `emoteWorry` beside `emoteQuestion`, `emoteExclaim`, `emoteNote`, `emoteZzz`,
  and `emoteHeart`) with `emoteQuestion` / `emoteExclaim` over noticing/chasing
  chaos roamers, contented drifting `emoteNote` (`♪`) on a 90-tick loop over
  calmed critters within 185 units of Fae, sleepy `emoteZzz` on a 100-tick loop
  over napping Maddie (`stillTicks >= 240`), a rising warm `emoteHeart` for 38
  ticks after finishing a chat with an NPC or calm critter, and reactive NPC
  emotes (skipping any NPC displaying an active chatter bubble or post-talk
  heart). When `reducedMotion` is `true` (Milestone 139), every overworld emote
  holds upright (`rotation = 0`) at a steady anchor without bob, bounce, sway,
  or vertical drift (`emoteNote` and `emoteZzz` at fixed `scale: 0.66`,
  `alpha: 0.85`; `emoteHeart` keeping gentle fade in/out at `x = talk.x`).
- Living NPC Intelligence & Organic World Cast (Milestones 144–145,
  `src/core/npc-context.ts`, `content/npc-profiles.json`,
  `src/render/npc-life.ts`, `src/ui/npc-chatter.ts`, `src/render/motion.ts`):
  - Twenty-eight additional blinking 4-direction hand-painted watercolor NPCs
    (`tools/art/build-living-npcs.ts`, `art/recipes/living-npcs.json`; lossless
    WebP atlases, 15 adults mass-calibrated in `[0.44, 0.50]` and 13 kids
    mass-calibrated in `[0.42, 0.47]`, Milestone 159)
    populate Cloverhollow's plaza, grocery market, ice cream parlor, park,
    arcade, school east hall, playing field, art room, Bubblegum Bay, Cliffside
    Trail, Pinecone Pass, Mountain Lodge, Crystal Cavern, Whispering Woods,
    Clover Hills, and Misty Path: `flora`, `gus`, `sammy`, `poppy`, `pippa`,
    `hazel`, `leo`, `maya`, `theo`, `bert`, `sal`, `kai`, `nora`, `lark`,
    `bramble`, `mina`, `tuck`, `otis`, `clara`, `pebble`, `gemma`, `moss`,
    `wren`, `sunny`, `bram`, `sage`, `marigold` (`market` at `(520, 640)`,
    facing `right`, knot `npc_marigold`), and `danny` (`parlor` at `(360, 450)`,
    facing `right`, knot `npc_danny`), each with bespoke voice profiles
    (`src/platform/voices.ts`) and circular die-cut dialogue portraits
    (`src/ui/portraits.ts`). Every Living NPC placement across all 16 inhabited
    areas maintains `>= 220` units separation outdoors and `>= 190` units indoors
    (across all strolling waypoints too), bans flat `Δy = 0` mannequin lineups
    (`|Δy| >= 40` or distance `>= 300`), and stays `0%` occluded and clear of
    all recorded simulation trails (Milestone 159).
  - Dynamic story relocations via optional NPC schedule fields (`hiddenWhile`,
    `visibleAfterCalm`, `hiddenAfterCalm`, validated in
    `src/content/npc-parsers.ts`): Sammy moves from `plaza` into `arcade`
    (joined by Poppy) once `arcade-keeper` is calmed; Leo moves from
    `east-hall` to `field` once `recess` is true; Maya moves from `field` to
    `art-room` (joined by Theo) once `art_open` is true.
  - Pure deterministic `npcWorldSituation`, `reactionRippleTicks`, and
    `evaluateNpcLife` (zero banned trig, zero `State` or save-version changes)
    read `content/npc-profiles.json` (53 named character profiles covering the
    entire town cast with 100% bespoke voice, non-default speaker accent, and
    painted bust-portrait parity across every profile, banter pair, party
    banter entry, and tool event speaker including `"Nurse Clover"` aliased to
    Nurse Holly's warm clinical timbre, `"school"` accent, and `["nurse",
    "adult"]` portrait in Milestone 155, 34 biome-wide NPC-to-NPC social
    banter entries including shop duos and six post-finale celebration banter
    pairs, 17 traveling party companion banter entries `partyBanter` including
    two Alpine Summit Overlook scenes, and 8 interactive tool micro-events
    `toolEvents` across `lantern`, `flute`, and `lasso` including party-only
    `summit-aurora-lantern` on the NPC-free Alpine Summit Overlook, skipping
    `bus-stop` and `sanctuary-*` critters) to drive live organic facing,
    distance-rippled
    attention (`dialogue` > `lantern-awe` > `celebrate` > `music-delight` >
    `chaos-worry` > `companion-greet` > `player-greet` > `social-chat` > `idle`,
    preserving authored arrival facing during a 48-tick arrival grace window),
    party companion attention (`party: PartyLifeEntry[]` with `lantern-awe`,
    `celebrate`, `music-delight`, `party-chat`, and `idle`, rendering floating
    party emotes during active tool micro-events and party chat while skipping
    napping Maddie and respecting `reducedMotion`), interactive tool
    micro-events (`activeToolEventId` with 180-tick turn alternation, pooled
    celebration sparkles on fresh activation skipped under `reducedMotion` and
    `harness`, and live `"tool-sparkle"` celesta chime + light haptic via
    `createToolEventChimeSync`), traveling party companion banter anchored
    at live `(member.x, member.y)` coordinates on a calm 360-tick cycle
    staggered cleanly around area NPC banter, post-finale `forest_calm`
    celebration warmth (festive `heart`/`sparkle` emotes for `player-greet` and
    `idle` NPCs within 240 units after arrival grace, plus `warm` chatter tone
    on matching `notVariable: "forest_fizzy"` / `calmed: "hooded-kid"` ambient
    rules), personality-driven living motion (`npcLivingPose` including
    `mystic`, `celebrate`, and 6-tick turn-squash, respecting `reducedMotion`),
    pooled celebration sparkles (skipped under `reducedMotion`), whisper-soft
    voiced ambient chatter chimes during live running play
    (`AudioController.playAmbientChatter`), and at most one crisp die-cut
    watercolor overworld chatter bubble (`.npc-chatter` with six high-contrast
    tones `normal`, `lantern`, `worry`, `warm`, `banter`, and `music`, inline
    SVG emblems, smart top-or-side placement clamping
    `data-side="top|left|right"`, `TALK`-prompt yielding, reduced-motion &
    Safari tap-selection hygiene including `-webkit-touch-callout: none`, and
    defensive CSS hiding across all root overlay flags `data-photo="on"`,
    `data-battle="open"`, `data-journal="open"`, `data-title="open"`,
    `data-credits="open"`, and `data-arcade="open"` plus `harness`, Milestone
    148).
    `renderInfo().npcLife` exposes read-only
    `{ stage, activeToolEventId, npcs, party, chatter }` (with each `npcs` entry
    including live `{ id, x, y, moving, attention, facing, emote }`).
  - Deterministic Kinetic Strolling NPCs (Milestone 156,
    `src/core/npc-stroll.ts`, `src/content/npc-parsers.ts`,
    `src/content/area-checks.ts`, `src/render/entity-layer.ts`,
    `src/render/overworld-effects.ts`): optional `stroll: { waypoints, speed,
    pauseTicks }` on outdoor NPCs (strictly validated: `>= 2` finite waypoints
    starting at `npc.point`, `speed` in `(0, 2]`, integer `pauseTicks >= 30`,
    and every waypoint and segment midpoint inside `area.walkable`, clear of
    static blockers/props/crossings, and within interaction reach). Seven
    outdoor townspeople stroll along sunlit closed loops (`bay.sal`, `bay.nora`,
    `hills.sunny`, `hills.bram`, `pass.tuck`, `woods.wren`, `field.leo`):
    `npcStrollAt` glides linearly between `pauseTicks` rests (holding incoming
    segment facing during pauses, or `"down"` at `waypoints[0]`) with exact
    walked `distance` and cycle periodicity; `npcLivePoint` freezes a strolling
    NPC in place via `dialogue.partnerPoint` for the full duration of a
    conversation (`state.dialogue` remains `null` in saves so save shape and
    version stay unchanged); `npcLiveFootprint` translates solid collision and
    interaction targets live; presentation interpolates at 120 Hz with
    Paper-Mario `walkPose(distance, 72, true)` bounce, lift-scaled contact
    shadows, seamless y-sorting, and surface-tinted footstep dust puffs on
    walk half-cycles (`Math.floor(distance / 36)`), while honoring 100%
    `reducedMotion` parity (holding strolling NPCs calmly at `waypoints[0]`
    with `NEUTRAL_POSE`, anchored chatter/emotes, and zero footstep puffs).
  - Cross-biome living errands, automatic Journal `NOTES` tracking &
    snack-sharing (all stitch-gated with zero new global Ink `VAR`s): Mailman
    Gus's Postal Chain (`Gus -> Captain Sal -> Mina -> Gus`), Wren's Botanical
    & Crystal Sketchbook (`Wren -> Professor Pebble & Sunny -> Wren ->
    Maya/Theo`), automatic Fae-voice Journal `NOTES` entries in the `journal`
    knot driven purely by native Ink stitch visit counts (zero impact on
    baseline 0-visit saves), shop regular thank-you treats/coins (`npc_marigold`
    and `npc_danny`), and cozy neighbor snack-sharing (`# feed: snack 1`) with
    Otis, Grandma Hazel, Tuck, Hiker Lark, and Clara.
- Idle: 1 to 4 frames per direction.
- Fae is about 140 units tall (about 280 source pixels).
- Sprite sheets: one WebP atlas (lossless alpha, generated from lossless PNG
  sources in `art/source/` via `tools/art/optimize-atlases.ts`) plus JSON frame
  data per character (Pixi spritesheet format, `meta.image` naming the sibling
  image). Every frame shares a feet-centered pivot.
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
  roster order): `id`, `name`, `atlas`, optional positive finite `scale`
  (default `0.5`; Sue and Jordan use `0.46` to match Fae's crown height), the
  feet-anchored `box`
  (`{ width, height }`), `walkCycleUnits`, `sits` (sits down after
  `sitDelayTicks`; otherwise idles standing; settled standing members turn
  render-only toward Fae's active dialogue partner or match Fae's facing when
  idle), `start` (in the party at a new
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
  `jordan_joined`) are standing human friends (`sits: false`). Canonical party
  ordering (`orderPartyContent`, `orderPartyIds`, `orderPartyMembers` in
  `src/core/party.ts`) always places standing/human friends (`sits === false`,
  e.g. `sue`, `jordan`) ahead of pet/animal companions (`sits === true`, e.g.
  `maddie`, `pond-pup`, `acorn-squirrel`, `ribbon-bunny`), preserving relative
  order within each group. `spawnParty` orders IDs before placing slots,
  `syncParty` maintains this order when members join, leave, or load from older
  saves (refreshing any member's `trail` to `[member, newLeader]` whenever its
  leader changes), and `areaConnectionErrors` checks all spawns against the
  canonical ordered roster. A full 6-member party fits at every spawn: members
  after the first also try wider diagonal heel slots and narrow-mouth fallbacks,
  after the existing candidates, so no earlier placement moves and no spawn has
  to. `state.party` is the ordered list of members, each
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
  befriended `squirrel_friend`, critter `squirrel`. Last in the roster is
  Ribbon Bunny (`ribbon-bunny`, "Ribbon Bunny", Milestone 80): atlas
  `assets/characters/ribbon-bunny/ribbon-bunny.json`, box 40x56,
  `walkCycleUnits` 72, sits, joins `bunny_with_me`, befriended `bunny_friend`,
  critter `bunny`. All three can come along at once: the whole 6-member roster
  fits behind Fae at every spawn (the area checks).
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
- Player collider: a circle of radius 14 units at the feet that slides along
  blockers. Each step is resolved by the solver (`resolveMove` in
  `src/core/geometry.ts`). Where the solver succeeds and moves cleanly
  (`moved >= 0.15 * desiredLen`), the step is exactly the solver's. When a step
  stalls against a corner near an opening, asymmetric corner-funneling nudges
  Fae smoothly around the corner into the gap (while dead-center hits on wide
  obstacles stop cleanly). In a tight gap or acute corner where opposing pushes
  fight, multi-constraint tangent and open-bisector sliding replaces pure-axis
  dead stops so characters glide smoothly through corridors. Followers and
  roaming critters move the same way.
- Navigation field & smart pathing (`src/core/nav.ts`, `src/shell/nav-steer.ts`,
  `src/render/nav-overlay.ts`, `tools/audit-navigation.ts`): a deterministic
  10-unit signed clearance field (`NavField`, zero trig) powers clearance-
  weighted A* with line-of-sight string-pulling (`findPath`), medial-axis
  gradient queries (`gradientAt`), and navigation auditing
  (`auditAreaNavigation`, `navigationQualityErrors` in
  `src/content/area-checks.ts`). Crisp ground clicks/taps outside the
  near-player pet/rest radius (`onTapGround` in `src/shell/overworld-pointer.ts`)
  walk Fae smoothly around obstacles along the corridor centerline, cancelling
  immediately on any manual directional/button input or overlay. Playable areas
  show subtle diegetic exit approach cues near triggers and a warm watercolor
  destination ring while pathing (respecting `reducedMotion`); the dev hook
  exposes `navOverlay(visible?)` to toggle a live clearance/pinch heatmap
  overlay over the area painting.
- `content/tunables.json`: `walkSpeed` (240 units per second), `playerRadius`
  (14), and `walkCycleUnits` (126).
- Transitions: entering a trigger fades out, loads the target area, places the
  player at the named spawn facing the given direction, and fades in. The
  target's art is prefetched as the fade-out begins and its tiles and prop
  atlases load concurrently, so the fade covers the load.
- Storybook area arrival banner (`src/ui/area-banner.ts`, `area-banner.css`,
  Milestone 85, render/UI-only): on genuine area arrivals (never on initial
  boot, fixture resets, QA loads, or `harness`), once the door transition
  finishes, a die-cut parchment ribbon (`z-index: var(--z-hud)`,
  `pointer-events: none`, high-contrast `#47321f`/`#543d2a` on `#f7f2e3`,
  botanical leaf/star sprigs, `max-width: min(340px, calc(100vw - 220px))` to
  clear touch buttons on 874x402 phones, shifting down cleanly below `.qa-badge`
  when a QA pack is active, reduced-motion guarded) glides in over 150 ticks
  (~2.5 s) showing the area's display title (`areaBannerInfo`) and its land
  region eyebrow (omitted when the land name matches the area name). It hides
  immediately on dialogue, battles, arcade close-ups, journal, title/QA
  overlays, finale, or another transition.
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
  additional diagonal heel candidates before rear fallbacks plus wide
  shallow-vertical fallback offsets tried only if all earlier candidates fail,
  ensuring narrow spawns like `mist.field` fit a 6-member party without
  shifting any 1-to-5-member placement; the area checks
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
  (its doorway at the plaza's right edge, x 1600-1625, y 500-610) through three
  2520x1080 open-world coastal route areas (`lane` "Sunberry Lane", `crossing`
  "Willowbrook Crossing", and `boardwalk` "Salt-Marsh Boardwalk", totaling 7,560
  logical units across ~6 desktop screens) to the bay, and each leads back. The
  east road `requires` `club_open` (knot `bay_road_closed`): Fae walks the east
  road to the bay once the tree house club is open.
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
- The plaza's north storefronts host three active shops: the bakery (`bakery` at
  (1180, 420), selling plain snacks for 5 coins), the Grocery Market (`grocery`
  at (655, 345), knot `grocery`, selling `Orchard Apple` and `Fish Cracker` for
  8 coins each), and the Ice Cream Shop (`ice-cream` at (895, 340), knot
  `ice_cream`, selling `Berry Swirl Cone` for 10 coins and `Cozy Cocoa Sundae`
  for 12 coins). Regional souvenir stands extend specialty treats across the
  bus line (Milestones 91–92): Bubblegum Bay's coastal shopkeeper NPC (`bay-keeper`
  in `content/characters.json`, scale `0.48`, adult portrait in `src/ui/portraits.ts`,
  at (785, 455), knot `bay_souvenirs`, `Bay keeper`) sells `Sea-Salt Taffy` for 9
  coins, and Pinecone Pass's mountain shopkeeper NPC (`pass-keeper` in
  `content/characters.json`, scale `0.48`, adult portrait in `src/ui/portraits.ts`,
  at (1190, 910), knot `pass_souvenirs`, `Pass keeper`) sells `Maple Pine Brittle`
  for 11 coins.
  Buster the Bus Driver (`buster` in `content/characters.json`, scale `0.48`,
  adult portrait in `src/ui/portraits.ts`, warm baritone triangle voice in
  `src/platform/voices.ts`) stands beside the plaza's Star-Line bus stop at
  (515, 780) (knot `buster`, `Talk`) and hands Fae his Star-Line Stamp Card
  (`buster_quest`): visiting `bay_souvenirs` stamps `stamp_bay` (`chime-blue`)
  and `pass_souvenirs` stamps `stamp_pass` (`chime-green`) for free, and
  returning to Buster awards `+25` coins, `+2` snacks, and his Golden Star-Line
  Whistle keepsake (`buster_reward`, `chime-yellow`) recorded in the journal
  and `club_chest`. Specialty treats are authored in `content/treats.json` and
  validated at load (`parseTreats`): unique valid ids, positive integer
  `price`/`energy`/`calm`/`favouriteCalm` (`favouriteCalm >= calm`), and
  non-empty `favourites` species lists covering every critter species in the
  game (six treats total).
- Living World Landmarks (Milestone 94):
  - **Nurse Holly's Clinic Care** (`nurse` stitch `thanks` in
    `content/story/main.ink`): keeps the pre-`hall_pass` hall-pass quest
    byte-identical; once `hall_pass` is true, Nurse Holly reacts to story
    progress (`milo_revealed` / `calmed("hooded-kid")`, `calmed("principal")`,
    `art_open` / `calmed("art-teacher")` / `has_flute`, or a warm default
    check-in) and offers a free cozy apple-juice & cracker pack (`+2` snacks,
    `chime-green`) via sticky choice whenever `snacks() < 2`, or a warm
    stocked-backpack check-in when `snacks() >= 2`.
  - **Bubblegum Bay Boat Rental** (`bay-boats` interactable in
    `content/areas/bay.json` at `(1350, 650)`, knot `bay_boats`, prompt
    `Look`): free community pastel rowboats beside the south pier rail with
    reactive companion banter (`sue_joined`, `jordan_joined`, `pup_with_me` /
    Maddie). The first sunny cove cruise sets `bay_boat_charm = true`, awards
    `+10` coins (`chime-blue`) for finding a Sea-Glass Clover, and logs a
    Journal note; revisits cruise peacefully without repeating coins. Once
    `sue_joined` holds, choice 1 (`[Row out to Starlight Island!]`) glides
    across Bubblegum Bay to `island.pier` with `chime-blue`.
  - **Pinecone Pass Wildlife Sanctuary** (`pass-sanctuary` interactable in
    `content/areas/pass.json` at `(1400, 640)`, knot `pass_sanctuary`, prompt
    `Look`): carved pine trail board tallying Fae's calmed mountain and
    woodland species (`hamster`, `penguin`, `owl`, `squirrel`, `lamb`,
    `hedgehog`, `bat`, `crystal-mole`, out of 8). Calming at least 3 species
    awards a one-time Sanctuary Ranger Basket (`sanctuary_gift = true`, `+12`
    coins, `+2` snacks, `chime-yellow`) and logs a Journal note; reaching 8 of
    8 adds a valley celebration line.
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
  facing down), and the art room's door with a palette sign (Look point
  `art-room`, knot `art_room`; once open, trigger `art-door` to
  `art-room.door`, `requires` `art_open`, knot `art_room`; spawn `art-room`
  (760, 380) facing right). Its props are the lockers, the bench, and the art
  room's door (`art-room-door`, hidden by default and `open` while `art_open`,
  cut from `east-hall-art-open.png`, with no footprint); a blocker fills the
  pocket under the wall fountain.
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
  xylophone is free play. From Milestone 47, once Fae has the flute, F, RB/R1,
  or the touch `♪` button plays it.
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
  (`kite_returned`), the golden acorn (`acorn_found`, Milestone 60), and
  Buster's Golden Star-Line Whistle (`buster_reward`, Milestone 91). The
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
- A third flute friend & collectible Star Gems (Milestone 80): Ribbon Bunny,
  the recurring trail and hills bunny, bonds like the pup and squirrel. Once
  Fae has the flute, a calm Ribbon Bunny's talk (`bunny_calm`, after its first)
  offers Smooth her ribbon (`bunny_petted`) and Share a snack (`bunny_fed`,
  `feed: snack 1`, or a snack hint when `snacks() == 0`); both, in either
  order, make her Fae's friend (`bunny_friend`). Revisit greets Fae as an old
  friend. The `flute` knot appends Call Ribbon Bunny / Send Ribbon Bunny home
  (`bunny_with_me`) after the pup and squirrel choices (leaving earlier choices
  unchanged when `bunny_friend` is false). Seven collectible Star Gems
  (`gem_park`, `gem_bay`, `gem_trail`, `gem_pass`, `gem_cavern`, `gem_woods`,
  `gem_hills`, counted by pure `starGemsFound` in `src/core/journal.ts` and
  `gem_count()` in Ink) hide across seven areas, each awarding `+5` coins and a
  chime:
  1. Meadow Park (`park-gem-glow`, `park_gem`): blacklight lantern glow in the
     north meadow (Amethyst Star Gem, `chime-blue`).
  2. Bubblegum Bay (`bay-gem`, `bay_gem`): east tide pool surf, fetched by Pond
     Pup (`pup_with_me`, Aqua Star Gem, `chime-blue`).
  3. Cliffside Trail (`trail-gem`, `trail_gem`): rocky cliffside burrow, fetched
     by Ribbon Bunny (`bunny_with_me`, Citrine Star Gem, `chime-yellow`).
  4. Pinecone Pass (`pass-gem`, `pass_gem`): high snow-dusted pine branch,
     reeled down with Coach Ash's lasso (`has_lasso`, Frost Star Gem,
     `chime-blue`).
  5. Crystal Cavern (`cavern-gem-glow`, `cavern_gem`): blacklight lantern glow
     on the east crystal grotto floor (Prism Star Gem, `chime-red`).
  6. Whispering Woods (`woods-gem`, `woods_gem`): mossy east tree hollow,
     fetched by Acorn Squirrel (`squirrel_with_me`, Amber Star Gem,
     `chime-yellow`).
  7. Clover Hills (`hills-gem`, `hills_gem`): meadow boulder clover burrow,
     fetched by Ribbon Bunny (`bunny_with_me`, Clover Star Gem, `chime-green`).
  Uncollected Star Gems shimmer in the overworld via pure
  `evaluateStarGemGlints` (`src/render/overworld-render.ts`, Milestone 120),
  rendered on `emissiveLayer` by `OverworldEffectsController`
  (`src/render/overworld-effects.ts`): an additive pastel halo cycling smoothly
  across lavender (`0xd4b2ff`), aqua (`0x9be7f2`), and butter-gold (`0xffe58f`,
  steady `0xffe58f` at `haloAlpha: 0.42` under Reduced Motion) paired with a
  rotating bespoke 48x48 hand-inked 4-point storybook star sparkle charm
  (`starGemCharm` in `src/render/vfx-textures.ts`, Milestone 121: golden-cream
  radial fill `#fffdf0` -> `#ffe37a` -> `#f4b93a`, warm cocoa-brown ink outline
  `#47321f`, ivory center glint dot, drawn at `starScale * 1.15`, stationary
  under Reduced Motion). The five open-air interactable gems shimmer whenever uncollected;
  the two blacklight-secret glow gems (`park_gem`, `cavern_gem`) shimmer only
  while Fae's lantern is active (`state.lantern === true`), and all glints hide
  during battle, arcade, `harness`, or once collected.
  Grandpa Barnaby (`barnaby` in Bon Appetit Cafe) celebrates Fae's gem count,
  awarding `+15` coins (`gem_reward_3`, `chime-yellow`) at 3+ gems and `+50`
  coins, `+2` snacks (`chime-red`), and the Rainbow Star Geode keepsake for
  `club_chest` (`gem_reward_all`) when all 7 are found. The journal records
  Ribbon Bunny's friendship, Star Gem progress, and the Rainbow Star Geode.
- Peekaboo check, Starry Owl & Chef Mateo (Milestone 81):
  - First-class battle burst check `kind: "peekaboo"` (`PeekabooSpec`:
    `ticks` 1..180, `goal >= 1`, `warningTicks >= 1`, `graceTicks >= 0`,
    non-empty sorted non-overlapping `peeks: { start, end }[]` with safe ticks
    `>= goal`; disallowed on Soothe/friend commands; zero extra PRNG draws
    beyond the burst `bigChance` roll). Holding confirm while the critter looks
    away (`"safe"` or `"warning"`) increments `progress`; holding confirm at or
    past `start + graceTicks` inside an unspotted peek marks that peek spotted
    and nudges `progress` back by 8. Cleanly freezing through a peek's end
    increments `peeksCleared` (triggering `battle-beat`). Reaching `goal` with
    zero spots wins early (`"great"`); on timeout, zero spots at `goal` is
    `"great"`, at most 1 spot at `ceil(goal * 0.55)` is `"good"`, else `"miss"`.
    `gentleCheckSpec` widens `warningTicks` (+6, cap 28), `graceTicks` (+5, cap
    10), and softens `goal` (`round(goal * 0.78)`, floor 20 when `goal >= 20`).
    Rendered as a die-cut sticker overlay above Fae (`battleCheckGeometry`
    `kind: "peekaboo"`, `battle-peekaboo` gallery state) with inline SVG eyes
    (`"LOOKING AWAY · HOLD!"`, `"TURN SOON..."`, `"WATCHING · FREEZE!"`), a
    cream progress bar to a gold star, and peek dots; choreography tiptoes Fae
    forward while safe, freezes her low when watching, and snaps the critter
    wide-eyed tall while watching.
  - Starey Owl / Starry Owl (`moon-owl`, Lv 8, 160 calmMax, 6 energyMax, 25
    coins, 80 XP, sticker `starry-owl`): optional Whispering Woods Peekaboo
    mini-boss summoned in the quiet southeast clearing (`moon-perch` Look point
    once `clubhouse_claimed`, setting `moon_owl_out` with `chime-blue`). Calm
    talk (`moon_owl_calm`) gifts the Moon Feather keepsake in `club_chest` and
    hints toward Clover Hills (never names Milo).
  - Fizzy Chef Mateo / Chef Mateo (`taco-chef`, Lv 7, 160 calmMax, 6 energyMax,
    25 coins, 70 XP, sticker `taco-chef`): optional Clover Hills Taco Truck
    Talk mini-boss (`canRun: true`, dust-cloud `chain` bursts, `talkAt: 85`,
    3 graded Talk knots `mateo_talk_1`..`3` referencing Bon Appetit's Tuesday
    crispy tacos chalkboard, Principal Bell's lunch announcement, and sharing
    snacks with friends, never naming Milo) summoned via `taco-flyer`
    (`taco_chef_out`). Calm talk (`taco_chef_calm`) gifts 2 snacks
    (`mateo_snacks_given`) + Golden Taco Badge keepsake in `club_chest`, and
    sells crispy taco snacks for 4 coins (`buy: snack 4`).
  - Sticker catalogue expands to 24 slots (`starry-owl`, `taco-chef`);
    Favourite Treats add `moon-owl` (`orchard-apple`, `cocoa-sundae`) and
    `taco-chef` (`berry-cone`, `fish-cracker`).
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
- The art teacher (Milestone 63): once Fae has found the hooded kid's stash
  (`stash_found`), purple paint seeps under the art room door
  (`art_room.paint`), and reading it brings the art teacher, Ms. Rowan, out
  into the east hall, fizzy (`art_teacher_out`), a set piece. Calmed, she
  tells of the hooded kid's soda and the borrowed purple markers, and opens
  the art room (`art_open`): its door stands open, and walking into it goes
  in. She stays in the hall, calm; later talks get her `again` line. The
  journal tells of her fizzy ("Ms. Rowan is fizzy in the east hall, swishing
  wild purple paint."), then calm ("I calmed Ms. Rowan, the art teacher. Her
  room is open, and every purple marker is missing!").
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
- Crystal Cavern: `cavern`, "Crystal Cavern", in the `pass` land, a 1650x1100
  painted glowing cave off Pinecone Pass's north snow gap (trigger `cavern`
  at x=795..875, y=155..185, `requires` `has_lantern`, knot `cavern_dark`;
  return spawn `pass.cavern` at (940, 185) facing down). Inside, the SW
  snow-dusted archway exits back to Pinecone Pass (`entrance` spawn at
  (365, 785) facing up; east bank spawn `grotto` at (1005, 560) facing right).
  Its kit has 8 props: five crystal clusters, two mossy stone lanterns, and
  `crystal-steps` (hidden by default; `lit`, flat, while `cavern_bridge_lit`).
  A turquoise stream and crystal pool split the cavern; the mid-stream
  crossing `spring` opens on `cavern_bridge_lit`. Blacklight lantern glows
  (`cavern-mote-1..3`, `cavern-mural-glow`) lead to the NW carved tablet where
  `cavern_mural` lights the three crystal stepping stones (`chime-blue`). On
  the east bank, `star-chime` (`cavern_chime`) uses Coach Ash's lasso for
  15 coins and a Shimmering Star Crystal keepsake in `club_chest`, and
  `crystal-spring` (`cavern_spring`) lets the Pond Pup dive for 2 snacks and
  10 coins. Five `fairy_light` ambient flyers drift over the crystals and
  water; stone is the default surface with sand on the mineral paths. Two
  recurring dens roll two cave critters: `bat` (Duzzy Bat / Cozy Bat, Lv 6,
  `lean` burst, `cozy-bat` sticker, `bat_calm`) on the west floor and
  `crystal-mole` (Glimmer Mole / Gem Mole, Lv 7, `chain` dust burst,
  `gem-mole` sticker, `crystal_mole_calm`) on the east floor. Its fixture
  `cavern` starts at `entrance` with Maddie, Sue, Jordan, lantern, lasso,
  flute, and Pond Pup befriended. Its atmosphere (`src/render/atmosphere.ts`)
  adds soft pulsing crystal halos, turquoise water glints, and pastel crystal
  sparkle motes; its soundtrack plays `"cavern"` ("Crystal Echoes") with
  `"cavern-drips"` ambience (`src/core/music.ts`); `bat` favours `orchard-apple` and
  `berry-cone` and `crystal-mole` favours `cocoa-sundae` and `orchard-apple`
  (`content/treats.json`).
- Bon Appetit Café & Cloverhollow Town Life (Milestone 79): `cafe`, "Bon
  Appetit Café", in the `cloverhollow` land, a 1200x800 painted isometric
  cutaway off the plaza's muted-teal bakery/café doorway (plaza trigger
  `cafe-door` at x=1040..1096, y=378..412 -> `cafe.door`; return spawn
  `plaza.cafe-door` at (1068, 452) facing down, keeping `bakery`, `grocery`,
  and `ice-cream` storefront talk windows untouched). Inside, the NW teal door
  returns to `plaza.cafe-door` (`door` spawn at (360, 538) facing right). Its
  five-prop kit lifts `table-west`, `table-east`, `counter`, `plant-east`, and
  `stand-south`; floor surface is wood with a carpet doormat; three Look spots
  cover `cafe-pastries` (`cafe_pastries`), `cafe-menu` (`cafe_menu`), and
  `cafe-window` (`cafe_window`). Five blinking Cloverhollow townspeople
  (`content/characters.json`: `dad`, `chef`, `barnaby`, `bree`, and `toby` at
  kid scale `0.47`) inhabit the café: Dad (`dad`, first-visit journal pep talk
  and `gift: snack 1` + `gift: coins 10`, dynamic progress revisits), Chef Bea
  (`chef_bea`, Lost Star Cinnamon errand to Meadow Park's `spice-tin` /
  `park_spice_tin` for `gift: snack 2`, `gift: coins 15`, and the Bon Appetit
  Star Pin keepsake in `club_chest`, plus sticky 5-coin cinnamon bun sales),
  Grandpa Barnaby (`barnaby`, Cloverhollow lore, calmed-critter milestones, and
  one-time `gift: coins 15` after calming an out-of-town critter), Bree
  (`bree`, Star Bus info and Crystal Cavern hint after `rode_bus` or
  `has_lantern`), and Toby (`toby`, arcade hype and Favourite Treats battle
  tip). Its fixture `cafe` starts at `door` with Maddie, Sue, and Jordan; its
  atmosphere (`src/render/atmosphere.ts`) adds warm counter glows, two NW
  window sunbeams, and ten rising cocoa-steam motes; its soundtrack plays
  `"cafe"` ("Cinnamon Waltz") with `"cafe-murmur"` ambience (`src/core/music.ts`).
- Cloverhollow's Final Two Plaza Shops (`market` & `parlor`, making all five
  painted buildings on Cloverhollow Town Plaza enterable):
  - `market`, "Cloverhollow Grocery Market", in the `cloverhollow` land, a
    1200x800 painted isometric cutaway off the plaza's Grocery Store door
    (plaza trigger `market-door` at x=672..728, y=335..368 -> `market.door`;
    return spawn `plaza.market-door` at (685, 415) facing down, keeping
    sidewalk talk windows `grocery` at (655, 345) and `ice-cream` at (895, 340)
    untouched). Inside, the back-left sage door returns to `plaza.market-door`
    (`door` spawn at (315, 535) facing right). Its 2-prop alpha-WebP kit lifts
    `produce-island` at (668, 496) and `berry-barrel` at (756, 680); floor
    surface is wood with carpet polygons for the entrance doormat and checkout
    counter rug. Blinking adult shopkeeper Grocer Pippin (`pippin`, `grocer_pippin`)
    greets Fae on first visit (`market_visited`) with a free Orchard Apple sample
    (`gift: snack 1`) and runs a sticky treat & snack shop (`orchard-apple` 8,
    `fish-cracker` 8, `snack` 5). Three Look spots (`market-produce`,
    `market-shelves`, `market-berries`) and one blacklight lantern glow
    `market-list-glow` (`frame: "ink_note"`, `market_list_glow`, sets
    `market_note_read`, `gift: coins 10`, `chime-yellow`) share orchard treat
    tips. Its fixture `market` starts at `door` with Maddie, Sue, Jordan, and
    the blacklight lantern; its atmosphere adds two golden NW window sunbeams
    and ten produce-stand warmth motes; its soundtrack plays `"market"`
    ("Pippin's Basket Waltz") with `"cafe-murmur"` ambience.
  - `parlor`, "Sweet Scoop Ice Cream Parlor", in the `cloverhollow` land, a
    1200x800 painted isometric cutaway off the plaza's Ice Cream Parlor door
    (plaza trigger `parlor-door` at x=912..964, y=335..364 -> `parlor.door`;
    return spawn `plaza.parlor-door` at (948, 410) facing down). Inside, the
    back-left sky-blue door returns to `plaza.parlor-door` (`door` spawn at
    (280, 555) facing right). Its 2-prop alpha-WebP kit lifts `table-west` at
    (415, 660) and `table-east` at (670, 696); floor surface is tile with a
    carpet polygon for the scalloped cream doormat. Blinking adult shopkeeper
    Scooper Penny (`penny`, `scooper_penny`) offers a first-visit free
    "Cloverhollow Dream Sundae" tasting choice (`Strawberry Swirl!`, `Mint Cloud
    Chip!`, or `Warm Honey Caramel!` with Maddie/Sue/Jordan reactions,
    `gift: snack 1`, `chime-blue`, `parlor_visited`) and runs a sticky treat
    shop (`berry-cone` 10, `cocoa-sundae` 12). Three Look spots (`parlor-gelato`,
    `parlor-menu`, `parlor-window`) and one blacklight lantern glow
    `parlor-secret-glow` (`frame: "ink_note"`, `parlor_secret_glow`, sets
    `parlor_note_read`, `gift: coins 10`, `chime-yellow`) reveal the "Secret
    Sundae Club" doodle. Its fixture `parlor` starts at `door` with Maddie, Sue,
    Jordan, and the blacklight lantern; its atmosphere adds two pastel window
    sunbeams and ten mint-pink gelato-case shimmer sparkles; its soundtrack
    plays `"parlor"` ("Sweet Scoop Rag") with `"cafe-murmur"` ambience.
  - Quiet shop-exit arrival (`src/core/roam.ts` & `src/content/area-checks.ts`):
    `rollWild` always draws two PRNG values per den (preserving RNG cadence) and
    suppresses spawning a wild critter from any den within `sight + touch` of
    Fae's arrival position so stepping out of single-door plaza shops (`market`,
    `parlor`) back onto Cloverhollow Plaza never ambushes Fae beside the north
    plaza den.
- The Wildlife Sanctuary: `sanctuary`, "Wildlife Sanctuary", in the `hills`
  land, a 1650x1100 sunlit alpine meadow branching east off Clover Hills
  (`hills` trigger `sanctuary` at x=1555..1615, y=375..445 ->
  `sanctuary.entrance` at (545, 710) facing right; return trigger `hills` at
  the SW timber archway road x=140..310, y=800..910 -> `hills.sanctuary` at
  (1495, 405) facing left). Its 7-prop depth-sorted kit lifts `bulletin-board`,
  `birdbath`, `hay-trough`, `hay-barn`, `hollow-oak` (canopy), `moss-boulders`,
  and `picnic-basket`, with the NW lily pond as a solid water blocker, 5
  ambient butterflies, grass default surface with sand footpaths and a carpet
  gingham picnic blanket, and three Look spots (`sanctuary-board`,
  `sanctuary-picnic`, `sanctuary-barn`). Caretaker Ranger Fern (`fern` in
  `content/characters.json`, `ranger_fern`) welcomes Fae (`sanctuary_visited`),
  counts calmed valley animals (`sanctuary_count()` out of 17), and awards
  progressive rewards at 3 (`sanctuary_reward_3`: +15 coins, +1 snack), 8
  (`sanctuary_reward_8`: +25 coins, +2 snacks), and 14+ (`sanctuary_reward_14`:
  +40 coins, +2 snacks, plus the Sanctuary Clover Wreath keepsake in
  `club_chest`). All 17 calmed valley animal species (`fountain-frog`, `pup`,
  `cat`, `raccoon`, `bluebird`, `crab`, `hamster`, `penguin`, `bunny`,
  `squirrel`, `gull`, `owl`, `lamb`, `hedgehog`, `bat`, `crystal-mole`,
  `moon-owl`) visit their meadow habitats as `visibleWhenCalmed` NPCs with
  `prompt: "Pet"` and unique `pet_*` reactions. Its fixture `sanctuary`
  populates 8 calmed animals with Maddie, Sue, and Jordan; its atmosphere adds
  warm alpine sunbeams, NW lily-pond water glints, and golden wildflower pollen
  motes; its pre-reveal soundtrack plays `"sanctuary"` ("Meadow of Friends")
  with `"forest"` ambience, shifting to `"festival"` ("Cloverhollow Jubilee")
  once `milo_revealed` is true.
  - **Post-Finale "Sunny Cloverhollow" Epilogue & Sanctuary Celebration
    Festival**: once `milo_revealed` is true (never beforehand, keeping Milo
    100% unnamed before `calmed("hooded-kid")` and `milo_revealed`), four
    beloved Cloverhollow friends gather in `sanctuary` as `visibleWhile:
    "milo_revealed"` NPCs (`milo` at `(840, 758)`, knot `festival_milo`;
    `rosie` at `(975, 645)`, knot `festival_rosie`; `dad` at `(735, 635)`, knot
    `festival_dad`; `chef` at `(1040, 742)`, knot `festival_chef`), using their
    existing character atlases, voices, portraits, and 53 living NPC profiles.
    Five bottom-appended Ink `VAR`s track the celebration
    (`festival_milo_talked`, `festival_rosie_gift`, `festival_dad_talked`,
    `festival_chef_talked`, `festival_toast_done`): Milo sketches the crew by
    the picnic blanket (`chime-yellow`, reacting to `milo_loft_visited` and
    `sue_joined`/`jordan_joined`); Rosie weaves clover garlands and hands Fae
    Clover Festival Lemonade (`gift: snack 1`, `chime-green`, reacting to
    `rosie_cottage_visited`); Dad celebrates Fae's courage and dynamic
    `sanctuary_count()` plus Chef Mateo's fiesta tacos; Chef Bea serves warm
    honey-clover tarts with a tart-sampling choice (and Maddie's purr).
    `ranger_fern` keeps all pre-finale milestone rewards intact and adds a
    post-finale Sunny Cloverhollow Festival Toast menu (`festival_toast`: sets
    `festival_toast_done`, ensemble toast with Ranger Fern, Milo, Rosie, Dad,
    Chef Bea, Sue, Jordan, Maddie, and Fae, awarding the Festival Star Pouch
    `gift: coins 30`, `gift: snack 2`, `chime-red`; replayable via
    `festival_toast_replay` without duplicate gifts). Post-finale epilogue
    echoes enrich `sanctuary_picnic` (Milo sketching Maddie), `mom.again`,
    `buster`, `club_chest` (celebrating `milo_loft_visited` +
    `rosie_cottage_visited`, `summit_aurora_read`, `island_shells_solved`, and
    `festival_toast_done`), and `journal`. Post-finale `sanctuary` shifts
    `storyTimeOfDay` to `golden-meadow` and enables `sanctuaryFestival`
    atmosphere sparkles. Its fixture `festival` (`content/fixtures/festival.json`)
    starts at `sanctuary.entrance` with Maddie, Sue, Jordan, `milo_revealed`,
    cleared `forest_fizzy`, world-expansion milestones, and all 17 valley
    animals plus `hooded-kid` calmed.
- Other Kids' Houses: Sue's Beach Cottage & Jordan's Mountain Cabin:
  - `sue-cottage`, "Sue's Beach Cottage", in the `bay` land, a 1200x800 painted
    isometric cutaway entered from Bubblegum Bay's NW sandy cove (`bay` trigger
    `sue-cottage` at x=215..355, y=62..112 -> `sue-cottage.door`, gated on
    `sue_joined` via `sue_cottage_locked`; return spawn `bay.sue-cottage` at
    (285, 190) facing down). Inside, the back-left driftwood porthole door
    returns to `bay.sue-cottage` (`door` spawn at (290, 540) facing right). Its
    1-prop alpha-WebP kit lifts the depth-sorted wicker `snack-basket` at
    (870, 628); its floor surface is wood with carpet polygons for the braided
    coastal center rug and jute doormat. Four Look spots cover `sue-workbench`
    (`sue_workbench`: fishing tip for the Golden Starfish Crown in the golden
    `RARE` band, sets `sue_cottage_visited` & `sue_compass`, awards Sue's
    Sea-Glass Compass keepsake in `club_chest` + 10 coins with `chime-blue`),
    `sue-bed` (`sue_bed`: mom's coral bandana patchwork quilt), `sue-lamp`
    (`sue_lamp`: aqua sea-glass jar lamp hinting at a secret glow-ink doodle),
    and `sue-snacks` (`sue_snacks`: one-time `gift: snack 2` via
    `sue_basket_taken`), plus one blacklight lantern glow `sue-secret-note`
    (`frame: "ink_note"`, `sue_secret_note`: Sue's glow-ink "Bay Explorers Club"
    star chart, sets `sue_note_read`, `gift: coins 10`, `chime-yellow`). Its
    fixture `sue-cottage` starts at `door` with Maddie, Sue, Jordan, and the
    blacklight lantern; its atmosphere adds warm coastal window sunbeams, an
    emissive aqua-mint sea-glass lamp halo at (756, 305), and 10 sunlit sea-dust
    motes; its soundtrack plays `"cottage"` ("Sea-Glass Sunroom") with `"ocean"`
    ambience.
  - `jordan-cabin`, "Jordan's Mountain Cabin", in the `pass` land, a 1200x800
    painted isometric cutaway entered from Pinecone Pass's west snow trail
    (`pass` trigger `jordan-cabin` at x=170..235, y=555..605 ->
    `jordan-cabin.door`, gated on `jordan_joined` via `jordan_cabin_locked`;
    return spawn `pass.jordan-cabin` at (325, 575) facing right). Inside, the
    back-left cedar door returns to `pass.jordan-cabin` (`door` spawn at
    (290, 545) facing right). Its 1-prop alpha-WebP kit lifts the depth-sorted
    woven `firewood-basket` at (885, 622); its floor surface is wood with carpet
    polygons for the braided wool center rug and plaid doormat. Four Look spots
    cover `jordan-table` (`jordan_table`: grandma's pressed alpine wildflowers,
    strawberry seeds, and steaming copper cocoa pot, sets `jordan_cabin_visited`
    & `jordan_clover`, awards the Pressed Alpine Clover keepsake in `club_chest`
    + `gift: snack 1` with `chime-green`), `jordan-bed` (`jordan_bed`: plaid
    mountain quilts banter), `jordan-rack` (`jordan_rack`: hiking pack, trail
    rope, and brass camp lantern hinting at invisible trail-blaze map marks),
    and `jordan-firewood` (`jordan_firewood`: cedar logs), plus one blacklight
    lantern glow `jordan-map-glow` (`frame: "trail_marker"`, `jordan_map_glow`:
    secret trail-blaze compass marks linking Pinecone Pass to Crystal Cavern and
    Clover Hills to the Wildlife Sanctuary, sets `jordan_note_read`,
    `gift: coins 10`, `chime-blue`). Its fixture `jordan-cabin` starts at `door`
    with Maddie, Sue, Jordan, and the blacklight lantern; its atmosphere adds a
    crisp snowy window sunbeam, warm amber emissive halos over the steaming
    cocoa kettle (890, 360) and brass camp lantern (1080, 380), and rising warm
    cocoa-steam wisps; its soundtrack plays `"cabin"` ("Timber & Tea") with
    `"hearth"` ambience.
  - `milo-house`, "Milo's Sketch Loft", in the `cloverhollow` land, a 1200x800
    painted isometric cutaway entered from Meadow Park's west-northwest fence
    gap (`park` trigger `milo-house` at x=110..165, y=445..510 ->
    `milo-house.door`; return spawn `park.milo-house` at (235, 465) facing
    right). Inside, the back-left door returns to `park.milo-house` (`door`
    spawn at (290, 545) facing right). Its 1-prop alpha-WebP kit lifts the
    depth-sorted woven `cushion-stack` at (780, 686); its floor surface is wood
    with carpet polygons for the starry center rug and starry doormat. Four Look
    spots cover `milo-desk` (`milo_desk`: rocket watercolor sketchbooks,
    classmate comic panels, colored markers, and Star Racer token jar, sets
    `milo_loft_visited` & `milo_desk_checked`, one-time `gift: coins 10` with
    `chime-yellow`), `milo-bed` (`milo_bed`: periwinkle-and-plum striped quilt
    with sketchbook under the pillow), `milo-comics` (`milo_comics`: space
    comics crate, skateboard shelf, and school trophies), and `milo-cushion`
    (`milo_cushion`: floor reading nook hinting at glow ink), plus one
    blacklight lantern glow `milo-loft-glow` (`frame: "ink_note"`,
    `milo_loft_glow`: subtle invisible-ink rocket margin note with zero
    hooded-kid spoilers before `calmed("hooded-kid")`, sets
    `milo_loft_glow_read`, one-time `gift: coins 10` with `chime-blue`). After
    `milo_revealed` is true, Milo stands on his starry rug at (670, 518) facing
    down (`milo_loft_talk`) for a post-finale watercolor hangout. Its fixture
    `milo-house` starts at `door` with Maddie, Sue, Jordan, and the blacklight
    lantern; its atmosphere adds 2 arched-window sunbeams and 10 stardust motes;
    its soundtrack plays `"loft"` ("Paper Plane Sketchbook") with `"none"` ambience.
  - `rosie-cottage`, "Rosie's Flower Cottage", in the `cloverhollow` land, a
    1200x800 painted isometric cutaway entered from Meadow Park's
    north-northwest sunlit meadow gap (`park` trigger `rosie-cottage` at
    x=430..500, y=244..292 -> `rosie-cottage.door`; return spawn
    `park.rosie-cottage` at (490, 340) facing down). Inside, the back-left
    rose-wood door returns to `park.rosie-cottage` (`door` spawn at (295, 540)
    facing right). Its 1-prop alpha-WebP kit lifts the depth-sorted
    `rattan-stool` at (891, 607); its floor surface is wood with carpet polygons
    for the oval floral center rug and daisy doormat. Once `hall_pass` is true,
    Rosie stands in front of her craft table at (775, 495) facing down
    (`rosie_home`: welcomes Fae on first visit with `rosie_cottage_visited` and
    a Sunlit Clover Tea Snack `gift: snack 1` with `chime-green`, awards a
    Pressed Clover Craft lucky ribbon `gift: coins 15` with `chime-yellow` via
    `rosie_clover_gift` once `visited_hills` or `sanctuary_visited` is true, and
    shares neighborhood tips on revisits). Three Look spots cover `rosie-table`
    (`rosie_table`: pressed flowers, watercolors, cloches, and ribbon spools),
    `rosie-bed` (`rosie_bed`: lavender-scented peach-and-rose patchwork quilt),
    and `rosie-plants` (`rosie_plants`: potted clover, daisies, and succulents
    hinting at a window fairy doodle), plus one blacklight lantern glow
    `rosie-cottage-glow` (`frame: "bluebell_4"`, `rosie_cottage_glow`: Rosie's
    Four-Leaf Clover Fairy Doodle hinting at Enchanted Forest wildflowers, sets
    `rosie_cottage_glow_read`, one-time `gift: coins 10` with `chime-yellow`).
    Its fixture `rosie-cottage` starts at `door` with Maddie, Sue, Jordan, the
    blacklight lantern, and `hall_pass`; its atmosphere adds 2 floral-window
    sunbeams and 10 pastel petal/sunbeam motes; its soundtrack plays `"bloom"`
    ("Rosie's Flower Window") with `"none"` ambience.
- Alpine Summit Overlook & Rideable Pinecone Pass Ski Lift: `summit`,
  "Alpine Summit Overlook", in the `pass` land, is a 1650x1100 snow-capped
  mountaintop clearing reached by riding Pinecone Pass's ski lift (`ski_lift`
  keeps `{has_lasso and not scarf_down: -> scarf}` first, and once
  `calmed("lodge-keeper")` holds, offers riding up to `summit.lift-top` with
  `sound: chime-blue` and `travel: summit.lift-top`; returning via `summit-lift`
  at (425, 875), knot `summit_lift`, glides back to `pass.ski-lift` at (485,
  490) facing down). Its 2-prop alpha-WebP kit lifts the depth-sorted
  `stone-cairn` at (436, 581) and `bench-thermos` at (1305, 816); a thin rear
  blocker behind the cairn keeps Fae cleanly visible; its floor surface is snow
  with stone polygons under the cabin stepping stones and stone cairn ring and
  wood along the ski-lift unloading deck. Four Look spots cover `summit-lift`
  (`summit_lift`), `summit-telescope` at (1015, 365) (`summit_telescope`: sets
  `summit_visited` & `summit_telescope_used`, awards one-time `gift: coins 10`
  with `chime-yellow`, and opens a sticky 4-direction lookout menu over
  Cloverhollow, Bubblegum Bay, Whispering Woods & the Ancient Tree without
  pre-finale Milo spoilers, or stepping back), `summit-thermos` at (1270, 810)
  (`summit_thermos`: sets `summit_cocoa_taken` and awards one-time
  `gift: snack 2` with `chime-green` from Mrs. Flurry's cocoa thermos), and
  `summit-cabin` at (1205, 720) (`summit_cabin`: ski-patrol warming hut plaque
  hinting at blacklight cairn runes). A blacklight aurora trail (`summit-aurora-1..3`
  using `bluebell_1..3` leading to `summit-cairn-glow` at (530, 560),
  `frame: "trail_marker"`, knot `summit_cairn_glow`) reveals the Alpine Aurora
  Legend (`summit_aurora_read`, one-time `gift: coins 15` with `chime-red`). Its
  fixture `summit` starts at `lift-top` (525, 825, facing up) with Maddie, Sue,
  Jordan, `has_lantern`, `has_lasso`, `lodge_open`, and `lodge-keeper` calmed;
  its outdoor atmosphere emits 6 pastel aurora `softGlow` ribbons + 3 `sunbeam`
  curtains (`y = 70..220`), 22 mountain snowflakes, and 6 warming-hut chimney
  smoke wisps from `(1458, 380)`; its soundtrack plays `"summit"` ("Above the
  Pines") with `"mountain-wind"` ambience; its rest spot `summit-bench` sits at (1335, 860).
- Starlight Island & Bubblegum Bay Rowboat Crossing: `island`,
  "Starlight Island", in the `bay` land, is a 1650x1100 sunlit coastal islet
  with a coral-striped Tide-Pool Lighthouse reached by rowing from Bubblegum
  Bay's south pier (`bay_boats` keeps choice 0 sunny cove unchanged, and once
  `sue_joined` holds, offers choice 1 rowing to `island.pier` at (560, 700)
  facing right with `sound: chime-blue`; returning via `island-boat` at (365,
  830) on the SW landing pier, knot `island_boat`, glides back to `bay.boats`
  at (1450, 685) facing left, >250u clear of every bay den). Its 4-prop
  alpha-WebP kit lifts the depth-sorted `lighthouse` at (1260, 426),
  `driftwood-log` at (1270, 782), and fading canopy palms `west-palm` at (254,
  546) and `east-palm` at (1429, 722); blockers cover the NW sparkling tide
  pool, all 4 giant pastel seashells, the east tide-pool rocks, and the north
  palm trunk. Its floor surface is sand with wood along the SW landing pier
  deck, carpet over the SE woven beach mat, and grass across the central clover
  meadow and NE lighthouse bluff; 4 looping ambient butterflies (`butterfly_pink`
  and `butterfly_blue`) glide over the meadow and shells. Four Look spots cover
  `island-boat` (`island_boat`), `island-shells` at (545, 472) (`island_shells`:
  4-note pastel seashell chime puzzle playing `chime-red`, `chime-yellow`,
  `chime-green`, `chime-blue` with a silver-flute harmony bonus when `has_flute`
  holds, setting `island_shells_solved` and awarding one-time `gift: coins 20`
  from the Tide-Pool Pearl Cache, plus a playful random-chord try-again option
  and post-solve replay), `island-lighthouse` at (1205, 432) (`island_lighthouse`:
  sets `island_visited` & `island_lighthouse_checked` and awards one-time
  `gift: snack 2` with `chime-yellow` from the Lighthouse Sea-Breeze Snack Tin),
  and `island-bottle` at (1255, 825) (`island_bottle`: sets `island_bottle_found`
  and awards one-time `gift: coins 15` with `chime-green` from an old Bubblegum
  Bay explorer's note). A blacklight rune trail (`island-star-1..2` using
  `bluebell_1..2` leading to `island-beacon-glow` at (980, 440),
  `frame: "bluebell_4"`, knot `island_beacon_glow`) reveals the bioluminescent
  Starlight Beacon Verse (`island_glow_read`, one-time `gift: coins 10` with
  `chime-red`). Its fixture `island` starts at `pier` with Maddie, Sue, Jordan,
  `sue_joined`, `has_lantern`, and `has_flute`; its outdoor atmosphere emits a
  2-layer emissive golden Lighthouse Beacon Halo at `(1260, 152)`, 14 turquoise
  bay/tide-pool `waterGlint`s, and 10 drifting sea-breeze sparkle motes; its
  soundtrack plays `"island"` ("Starlight Beacon") with `"ocean"` ambience; its rest spot `island-mat`
  sits at (1150, 796) on the SE woven beach mat.
- The lifeguard (Milestone 64): once Sue has joined (`sue_joined`), the bay's
  picnic leads on (`bay_picnic.back`): a whistle blasts, and the picnic's
  owner, Ms. Coral, the bay's lifeguard, is back and fizzy (`lifeguard_back`),
  a set piece on the sand by the dock approach. Until then the picnic reads as
  it always has. Calmed, she tells of the hooded kid's soda and shares her
  watermelon (`gift: snack 3`, once); the picnic then has its shared line
  (`bay_picnic.shared`). The journal tells of her fizzy, then calm.
- The art room (Milestone 63): `art-room`, "Art Room", in the
  `cloverhollow` land, a 1200x800 painted cutaway in the school's style,
  split into a three-prop kit: the two easels are lifted, with a shadow; the
  work table, with the empty marker box on it, and the supply shelves stay
  painted. Blockers hold the drying rack and the low cubbies, back to the
  wall, and the floor just behind the easels; the sink hangs on the wall over
  open floor. Its floor is tile with a carpet rug. Its door, in the left wall,
  leads back out (trigger `door` to
  `east-hall.art-room`; spawn `door` (270, 540) facing right). Look points are
  the easels (`art_easels`), the class art wall (`art_paintings`), the sink
  (`art_sink`), and the empty purple marker box (`art_markers`).
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
  it, and a ripe garden waits to be picked. Picked (once the fridge works), the
  first harvest (`fridge_baskets == 0` and `sunberry_harvests == 0`) puts a
  strawberry basket into the fridge (`fridge_baskets`) and leaves the plants one
  calm along, so two more calms ripen them again. Each basket is three snacks
  (`gift: snack 3`), all taken at once. On subsequent ripe harvests
  (`fridge_baskets > 0` or `sunberry_harvests > 0`, Milestone 111), warm golden
  shimmer motes (`0xffd966`, `evaluateSunberryMotes` in
  `src/render/clubhouse-display.ts`) float above the planter boxes, and Jordan
  offers a choice between picking a strawberry basket or plucking a homegrown
  magical Golden Sunberry (`sunberry-nectar`, `# gift: treat sunberry-nectar 1`,
  `sunberry_harvests += 1`, restoring 4 energy and +45 calm, or +60 for woodland
  and magical favourites, with its own journal note).
- Living Clubhouse display, companion petting & cozy resting (Milestone 88,
  pure presentation shell — zero `src/core` state or replay hash changes):
  - `evaluateClubhouseDisplay` (`src/render/clubhouse-display.ts`) places every
    owned arcade prize from `state.prizes` (all 13 catalogue prizes, lazily
    loading `world.arcade.atlas` under alias `clubhouse-prizes` only when
    entering `clubhouse` and evicting it on the same current + previous area
    residency window) onto non-blocking Clubhouse perches (beanbag cushion,
    right-wall shelves, crate top, and wall nooks) alongside Fae's thirteen
    shimmering hand-inked quest keepsakes (`star-crystal` on `cavern_chime_rung`,
    `star-pin` on `spice_returned`, `star-geode` on `gem_reward_all`,
    `moon-feather` on sticker `starry-owl`, `taco-badge` on sticker `taco-chef`,
    `clover-wreath` on `sanctuary_reward_14` mounted on the left wood wall at
    `(468, 314)`, `sea-compass` on `sue_compass` perched on the crate
    front-right corner at `(796, 350)`, `alpine-clover` on `jordan_clover`
    mounted beside the wreath at `(516, 308)`, `star-whistle` on
    `buster_reward` perched on the round window sill at `(805, 259)`,
    `loft-sketch` on `milo_loft_visited && rosie_cottage_visited` pinned on the
    back-left lower plank wall at `(326, 376)`, `aurora-rubbing` on
    `summit_aurora_read` hung on the upper-left plank wall at `(492, 184)`,
    `shell-shard` on `island_shells_solved` mounted on the front-left timber
    post at `(280, 330)`, and `festival-ribbon` on `festival_toast_done` hung on
    the front-right timber post at `(976, 344)` — 26 total Living Clubhouse
    items, with Milestone 107 & Milestone 164 spacing polish across the upper
    and lower right shelves, beanbag 2×2 cuddle arc, crate keepsake row, wall
    planks, timber posts, and left floor perches), each grounded with a
    miniature contact shadow and subtle breathing sparkle aura.
  - `findPettableCompanion` & `findRestSpot` (`src/render/companions.ts`): on a
    fresh overworld confirm press when no real interactable (`targetInteractable`)
    or overlay is active, Fae can pet Maddie or any active Flute Friend
    (`pond-pup`, `acorn-squirrel`, `ribbon-bunny`) within range (triggering a
    42-tick joyful squash-and-stretch double bounce, affectionate nod, 3 rising
    `emoteHeart` + pastel `sparkle` puffs, and a synthesized species affection
    cue via `AudioController.playEffect`), or relax at curated painted benches,
    chairs, rugs, picnic blanket, glades, overlooks, and the Clubhouse beanbag
    across all 32 playable areas (`plaza`, `park`, `bay`, `island`, `cafe`,
    `market`, `parlor`, `lodge`, `clubhouse`, `sue-cottage`, `jordan-cabin`,
    `milo-house`, `rosie-cottage`, `sanctuary`, `bedroom`, `kitchen`, `pass`,
    `summit`, `trail`, `woods`, `hills`, `enchanted`, `cavern`, `mist`,
    `field`, `music`, `art-room`, `arcade`, `school`, `east-hall`, `classroom`,
    and `gym` — 33 curated spots in total, 100% playable-world coverage,
    Milestone 159), settling into a cozy seated-rest
    pose with a warm harp chord and lazily drifting `emoteNote` (`♪`) until any
    movement, cancel, menu, or confirm input stands her back up.
  - `renderInfo()` exposes `clubhouseDisplay` (visible display item count),
    `atmosphereParticles` (active `BiomeAtmosphere` particle count),
    `footstepPuffs` (active footstep gouache puff count),
    `starGemGlints` (active prismatic Star Gem glint count),
    `petting` (currently petted companion id or `null`), and `resting` (active
    rest spot id or `null`).
  - Living Valley Townspeople & Epilogue Heart (Milestones 108 and 159,
    `content/story/main.ink`): zero-drift late-game and post-completion revisit
    dialogue across twenty-six beloved valley characters — ten townspeople &
    biome friends (`dad`, `chef_bea`, `barnaby`, `bree`, `toby`, `buster`,
    `lodge_keeper`, `lifeguard`, `principal`, and `ranger_fern`, Milestone 108)
    plus sixteen shopkeepers, school faculty, classmates, family, and
    Enchanted Forest fairies (`grocer_pippin`, `scooper_penny`,
    `bay_souvenirs`, `pass_souvenirs`, `classroom_teacher`, `rosie`, `coach`,
    `music_teacher`, `art_teacher`, `mom`, `oliver`, `milo`, `fairy_lavender`,
    `fairy_mint`, `fairy_sky`, and `fairy_peach`, Milestone 159) — reacting
    warmly to cross-biome achievements (`milo_revealed`, never naming Milo
    beforehand; `gem_reward_all`; `sanctuary_reward_14`; `sanctuary_visited`;
    `sanctuary_gift`; `buster_reward`; `cavern_chime_rung`;
    `sunberry_harvests > 0`; `kite_returned`; `sue_compass` and
    `jordan_clover`; `sue_cottage_visited` and `jordan_cabin_visited`;
    `bay_boat_charm`; and calmed school/town friends `taco-chef`, `principal`,
    and `art-teacher`), with every new line sized `<= 105` characters to fit
    cleanly in 2 lines inside `.sticker-box`.
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
- The seven painted lands are `cloverhollow` (Cloverhollow), `bay` (Bubblegum
  Bay), `pass` (Pinecone Pass), `trail` (Cliffside Trail), `forest` (The Forest),
  `enchanted` (The Enchanted Forest), and `hills` (Clover Hills), in that order.
  Every non-harness area belongs to one. Bubblegum Bay has a bus-stop prop at
  (355, 505), with spawn `bus-stop` at (355, 545), by the welcome sign. Clover
  Hills has no bus stop and its map label is hidden until Fae first arrives there,
  then remains revealed in saves and after she leaves. Its west door is on the painted
  path at the left edge and its north door is on the path exit at x=1000..1080; the
  return spawns are on those paths, at (180,650) from the park and (1040,180) from
  the woods. The painted lookout cache is by the oak's stepping stones at (1130,345).
  Its open meadow ground is traced from the painting and its den rolls the new lamb
  and hedgehog kinds alongside bunny at (450,850), plus a second den of squirrels
  and raccoons at (700,200). The lookout cache is the Acorn Squirrel's secret: with
  Fae's flute friend along, he climbs and returns two snacks; without him it is only
  a view. The dirt path sounds like sand and the lookout's stepping stones sound like
  stone. These recurring encounters use the same arrival rolls, calm rewards, stickers,
  and temporary calm state as the trail. Map labels are data-driven: lands with no
  `revealVariable` are always known, while Hills uses `visited_hills` and reveals on
  its silent arrival hook. The Hills doors are the painted park gap by the play tower
  and signpost and the north path exit to the woods; there is no bus stop.
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
  (`bay.trail`, facing up). The bay's way requires `bluebird_calmed` (set by
  `on_calm` once the Bay Bluebird is calmed; knot `bay_cliff_path` while it's
  false), letting Fae hike up Cliffside Trail to Pinecone Pass on foot. Look
  points: `trail-signpost`,
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
  visibleWhile?, hiddenWhile?, visibleWhenCalmed?, visibleAfterCalm?,
  hiddenAfterCalm? }` (Ms. Maple the teacher and Nurse Holly
  in the school hallway, and the kid in the purple hood there for a moment; Ms.
  Maple, Milo, and Rosie in the classroom; Coach Ash in the gym; Mom and Oliver
  in the kitchen; Ranger Fern and the 17 calm-animal visitors in the Wildlife
  Sanctuary; plus Cloverhollow's expanded living townspeople, classmates, and
  biome residents from Milestone 144). `prompt` is `"Look"`, `"Talk"`, or
  `"Pet"`. Regular NPCs are
  drawn from the atlas named for their id in `content/characters.json` (`{ atlas,
  idleTicks, scale? }`, where `idleTicks` are the ticks per `idle_down` frame:
  Mom holds her smile 180 ticks, then blinks for 8, and optional positive finite
  `scale` defaults to `0.5`, with `0.46` for Sue and Jordan and `0.47` for
  kid NPCs); an NPC with `visibleWhenCalmed` names a critter kind in
  `world.critters`, renders its `calm_idle_01` frame scaled to
  `overworldHeight / figureHeight` with gentle calm breathing and a contact
  shadow, and appears only once `isSpeciesCalmed(world, state, species)` is
  true. Everyone is y-sorted with the party and props, and targeted like an
  interactable. Every NPC must have at least one reachable floor point within
  `interact.range` (`areaConnectionErrors`). While Fae talks to one (the
  dialogue's knot is theirs), they face her along the larger axis of the gap
  between them (`npcFacing`), mirroring `idle_left` when facing right without an
  `idle_right` animation, and Fae turns render-only toward her conversation
  partner (`dialogueFacing`, also for calm critters, which mirror toward Fae
  while speaking); outside dialogue, non-prop people use `evaluateNpcLife` for
  organic facing and living motion after the 48-tick arrival grace window.
  Without a frame for that facing they show their front.
  Standing props such as the plaza bus stop use the same person entry and
  y-sorted renderer, but are props rather than people.
- A person's `footprint` polygon is solid, for Fae and for the party, like a
  blocker. A person with `visibleWhile` / `hiddenWhile` (Ink variables),
  `visibleWhenCalmed` (a calmed critter kind/species), or `visibleAfterCalm` /
  `hiddenAfterCalm` (`calmedFact` critter/species ids) is only there while all
  specified conditions hold; otherwise they aren't drawn, can't be talked to or
  petted, and aren't solid (`npcVisible`). The area checks count every footprint
  as solid, since someone may be standing there. Story variables are read per
  tick through `world.storyVariable(ink, name)`: one Story built at load, reused
  for each read, since building one costs about 0.2 ms.
- Area paintings: opaque WebP tiles (each at most 2048x2048) at 2 source px
  per unit, listed in `public/assets/areas/<id>/ground.json` (tile offsets in
  source px and the painting's `paper` margin colour). The paper colour fills
  the logical viewport behind the painting; the page colour `#f8edcf` shows
  only in letterbox bars outside it.
- Areas may define `interactables` with `{ id, knot, point, prompt }`;
  `prompt` is `Look`, or `Play` for something Fae plays (the music room's
  xylophone). Each point must be reachable within the interaction range.
- Glows (the blacklight lantern, Milestone 23; overhauled Milestone 72): an
  area's `glows` are `{ id, frame, point, knot?, prompt?, flip? }`, a frame of
  `assets/glows/glows.json` (light painted on black, lifted by brightness).
  They're never solid. While the lantern is on (`state.lantern`, switched by a
  lantern press once `has_lantern` is true and Fae is free), the viewport
  (clipped inside `viewportMask`, never tinting letterbox bars) eases smoothly
  into a deep indigo-plum dusk (`0x170b33`, up to 56% alpha) with an additive
  radial UV blacklight pool (`0xb084ff`) and 12 drifting lavender UV motes
  centred on Fae, and each glow is added on top with staggered pulse phases,
  a subtle bloom pulse, and proximity brightening within 320 units (all
  render-only); a glow with a knot is a Look target (`glow:<id>`) only then.
  `flip` mirrors the decal. At Pinecone Pass, three glowing paw prints lead
  from the clearing to a trail marker on the west pines (`old_trail_marker`,
  which sets `found_old_trail`), and a doodle is painted on the north ski-lift
  tower (`lift_note`). `renderInfo().lantern` reports `{ on, glows }`, the ids
  drawn.
- Ambient flyers (Milestone 54; Catmull-Rom splines Milestone 72; valley-wide
  wildlife Milestone 106): an area may define `ambient` as flyers with
  `{ id, animation, path, loopTicks, phase, frameTicks, size }`. `path` is a
  closed loop of at least three in-bounds `[x, y]` world points; `loopTicks`
  and `phase` are integers with `loopTicks >= 120` and `0 <= phase <
  loopTicks`, `frameTicks` is an integer of at least 1, and `size` is the
  drawn height in world units. Animations are names in
  `public/assets/ambient/ambient.json` (`butterfly_pink`, `butterfly_blue`,
  `fairy_light`). Across the valley, butterflies and fireflies drift in
  `enchanted`, `sanctuary`, `cavern`, `park`, `hills`, `field`, `trail`,
  `woods`, `mist`, and `plaza`. Flyers follow a closed uniform Catmull-Rom spline
  through `path` at constant chord-parameter speed with a small render-only
  bob, cycle across their animation's full frame count at `frameTicks`, and
  mirror from the smooth spline tangent while travelling left. They draw above
  overworld figures and props, below the fade, dusk tint, and glows, and are
  hidden in battles. Via `computeFlyerVisual` (`src/render/overworld-render.ts`,
  Milestone 117), butterflies project subtle grounded contact shadows onto
  `shadowLayer` (`y + 18`, `size * 0.72 x size * 0.28`, alpha `0.16`), and
  `fairy_light` fireflies cast warm-gold additive halos (`0xffe484`,
  `size * 2.6`, pulsing alpha `0.34..0.58` from a deterministic id phase or
  steady `0.44` under Reduced Motion) onto `emissiveLayer` above twilight and
  blacklight dusk (hidden on `harness` and outside the overworld). Under
  Reduced Motion (Milestone 139), `OverworldEntityLayer.renderAmbient`
  evaluates `flyerAt(flyer, 0)` with steady `frame: 0` so butterflies and
  fireflies stay calmly perched/hovering instead of sweeping across the scene.
  They never enter simulation state, hashes, or saves.
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

### 6.1 Critters out in an area (Milestone 28)
- Critters come two ways. Story set pieces are an area's `critters`,
  `{ id, point, visibleWhile? }`: each a critter kind placed once, standing
  still, calm or chaos for the whole game (`state.critters`, keyed by id).
  `visibleWhile` (an Ink variable) puts one there only while it's true. The
  set pieces are the fountain frog (plaza), the school raccoon (plaza, while
  `raccoon_waiting`), the grumpy gull (the trail's lookout), Mr. Pip, the
  arcade keeper (the arcade), the gym pup (the gym), Mrs. Flurry, the lodge
  keeper (the pass, on her porch at (1300, 590), while `keeper_back`), Ms.
  Coral, the lifeguard (the bay, on the sand by the dock approach at (760,
  590), while `lifeguard_back`), and Ms. Rowan, the art teacher (the east
  hall, at (1040, 500), while `art_teacher_out`), and Mr. Bell, the
  principal (the school hall, by the south lockers, while `principal_out`,
  Milestone 69).
- Recurring critters, EarthBound style, are an area's `recurring`:
  `{ after?, dens: { point, radius, kinds, chance?, after? }[] }`. On every
  arrival (a door, a bus ride, a rest's fade, and the start of a game or
  fixture) each den, in order, draws twice from the state's PRNG: is one out
  (`chance`, default 1), and which of its `kinds`. Every den draws whatever
  comes out, so an arrival's draws depend only on the content. Until
  `after` (a `calmed()` fact) is true the area draws nothing and is quiet:
  the plaza waits for the fountain frog. A den's own `after` keeps that one
  den quiet alone (Milestone 69), so a new kind can join an area's dens
  without disturbing what the dens before it roll: the bay's crabs wait for
  the lifeguard and the pass's penguins for the lodge keeper. The ones out
  this visit are `state.wild`: `{ kind, den, mood, x, y, home?, target,
  pauseTicks, cooldownTicks, facing, moving, notice }`, starting in chaos
  with `notice` 0. Each spawning critter derives a deterministic 32-bit
  local PRNG sub-stream from the post-pick `rng` and den index (preserving
  the exact two-draw-per-den cadence on `state.rng`) and samples up to 32
  walkable spots across the area's floor bounding box, choosing the first
  spot clear of floor edges (`playerRadius + 8`) and solids (blockers,
  closed crossings, prop footprints, and visible NPC footprints by
  `playerRadius`), outside Fae's arrival sight (`roam.sight + touch`),
  clear of door triggers (`touch + 60`), not over half occluded behind
  non-canopy scenery (`50 × 70` body box), separated from active set pieces
  (`>= 180`), visible NPCs (`>= 100`), and earlier wild critters (`>= 220`),
  and reachable from `den.point` on the player-passable floor (25-unit
  BFS), falling back to `den.point` if all samples fail; initial
  `facing` and `pauseTicks` (`0..roam.pauseTicks`) are drawn from the same
  local sub-stream. One Fae calms stays calm, a Talk target, only until she
  leaves; the next arrival rolls the area fresh.
- A recurring critter wanders inside its den's radius around its rolled
  visit `home` (older saves without `home` fall back to `den.point`),
  returns there on cooldown, and comes after a Fae it has noticed in its
  sight (section 8).
- The starting roster (owner, 2026-10-07): Cloverhollow's plaza (after the
  fountain frog) and the park, raccoons, pups, and cats; Bubblegum Bay,
  frogs and bluebirds, and after its lifeguard, crabs; the Cliffside Trail,
  bunnies and squirrels; Pinecone Pass, hamsters, and after its lodge keeper,
  penguins; the Whispering Woods, owls and raccoons. A species the
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
  The art room (Milestone 63) is also a kit: its two easels are lifted with a
  shadow, while its work table and supply shelves stay painted; the drying rack
  and the low cubbies are blockers. The table stays painted because a lifted
  table showed its plate's fill round its legs and papers; painted, the room
  is the approved painting pixel for pixel, and the table's silhouette (its
  top and everything on it) still hides Fae behind it.
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
  spawn. The bus line (Milestone 24, updated for open-world discovery) is three
  stops' knots (`bus_stop`, `bay_bus_stop`, `pass_bus_stop`) travelling between
  `plaza.bus-stop`, `bay.bus-stop`, and `pass.bus`. Towns must be discovered on
  foot before fast-traveling to them: silent arrival knots (`arrive_bay`,
  `arrive_pass`) set `visited_bay` and `visited_pass` when Fae arrives in `bay`
  or `pass`. Bubblegum Bay unlocks once `visited_bay` (or legacy `sue_joined`)
  is true; Pinecone Pass unlocks once `visited_pass` (or legacy `rode_bus`) is
  true; riding back home to Cloverhollow is available any time.
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
  she can pay. The snack shops are the plaza bakery (interactable `bakery` at
  (1180, 420), under its window) and Pinecone Pass's cocoa stand
  (`cocoa_stand`), 5 coins a snack. Their choices are sticky (`+`), so they
  sell on every visit.
- A line may carry `# buy-treat: <treat-id> <price>`: as it's shown, if Fae has
  `price` coins she pays them and gains one of `<treat-id>` in `state.treats`
  (capped at 99 per treat, `purchaseTreat`), emitting the `item` sound cue. Load
  validation (`storyTagErrors`) checks every `buy-treat` tag against
  `content/treats.json` so only known treats at their exact content prices are
  accepted. The plaza's `grocery` and `ice_cream` knots use sticky choices
  (`+`) gated on `coins()` with zero new Ink `VAR` declarations.
- A line may carry `# gift: snack <count>`: as it's shown, Fae gets `count`
  snacks for free (the clubhouse fridge, Milestone 43). `# gift: coins
  <count>` gives her coins (the pond's tin, Milestone 47), `# gift: treat
  <treat-id> <count>` (Milestone 111) grants `count` of a known treat from
  `content/treats.json` via `addTreat` (capped at 99), and `# feed: snack
  <count>` gives snacks away (a treat for an animal friend), never below
  none; the story only offers it when `snacks()` says she has one. Item tags
  (`buy`, `gift`, `feed`) act on every line they're on, a conversation's
  opening line and a locked door's included.
- Load validation (`src/content/story-checks.ts`, re-exported identically from
  `src/content/load.ts` via `parseStoryJson`, `storyTags`, `storyTagErrors`,
  and `endingContentErrors`, Milestone 148) reads every tag in the compiled
  story (`storyTags`: a
  tag's text follows its `#` command, and its `/#` may close in an enclosing
  container) and rejects a travel tag naming an unknown area or spawn, any
  `buy` tag but `snack <digits>`, any `gift` tag but `snack <count>`,
  `coins <count>`, or `treat <known-treat-id> <count>`, any `feed` tag but
  `snack <count>`, each count 1 or more,
  and any `play` tag but `<game> <digits>` naming an arcade, cooking, fishing,
  or taco truck game (`claw`, `skee`, `mole`, `comet`, `cook-nuggets`,
  `cook-mac`, `fish`, `taco`).
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
  `plushesLeft()` (how many plushes are still in the claw machine),
  `tickets()` (her tickets, Milestone 45), `withParty(id)`, `lanternOn()`,
  `areaCalm()`, `level()`, `stickers()`, `treats()`, and `bossesCalmed()`
  (Milestone 144), are answered from the core's state (`inkFacts`) for every
  command, not only a knot's first line. `calmed` answers a set piece by its id
  from its own mood, and a species once Fae owns its sticker (she has calmed one
  of them, anywhere).
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
- Pointer and touch click-to-advance ergonomics (Milestone 126):
  - `shouldAdvanceDialogueClick` (`src/ui/sticker.ts`) returns `true` when the
    dialogue card is visible and either still revealing characters
    (`revealed < text.length`) or advanceable without choices
    (`canAdvance && choices.length === 0`). `createDialogueBox` exposes
    `onAdvance` and toggles `.is-clickable` (`cursor: pointer; pointer-events: auto`)
    on `.sticker-dialogue`; clicking or tapping `.sticker-dialogue` (ignoring
    clicks inside `.sticker-choice` / `.sticker-choices`) emits a `confirm` tap
    via `touch.tapButton("confirm")` in `src/main.ts`, so players can reveal and
    advance overworld, battle, arcade, and level-up dialogue directly without
    accidentally picking an open choice or confirming a battle command prompt.
  - `createPrompt` (`src/ui/sticker.ts`) marks `.sticker-prompt` as an
    interactive button (`role="button"`, `aria-label` synced to `view.label`
    while visible, `cursor: pointer; pointer-events: auto; touch-action: manipulation`
    with `.sticker-prompt-arrow` kept at `pointer-events: none`) and exposes
    `onActivate`, wired to `touch.tapButton("confirm")` so clicking the
    floating `TALK`/`LOOK`/`PLAY`/`PET` pill on desktop opens the interaction
    directly. Under `:root[data-touch="on"]`, `.sticker-prompt` stays
    pass-through (`pointer-events: none`) so world prompts near the lower-left
    touch stick never intercept movement drags (touch players use the dedicated
    confirm thumb sticker).
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
- Speaker tags are cream or subtle pastel-tinted stickers (`speakerAccent` in
  `src/ui/portraits.ts`, Milestones 80 & 142, >= 8:1 dark ink contrast) with
  dark ink lettering, an ink outline, light die-cut rim, and a soft shadow.
  `speakerAccent` also strips an optional leading `"fizzy "` prefix and maps
  `"Fizzy Kid"` to `"mystery"`, so every non-sign story speaker and all six
  mini-bosses (`Fizzy Mr. Pip`, `Fizzy Mrs. Flurry`, `Fizzy Ms. Coral`,
  `Fizzy Ms. Rowan`, `Fizzy Mr. Bell`, `Fizzy Kid`) wear their true speaker
  accent. Every non-sign speaker across all compiled `# speaker:` tags and
  critters (113/113 = 100%, including Plaza sidewalk windows `Baker` -> `chef`,
  `Grocer` -> `pippin`, `Scoops` -> `penny`, and Pinecone Pass `Cocoa seller`
  -> `pass-keeper`, Milestone 151) also displays a 46 px circular
  die-cut portrait medallion (`.sticker-portrait`, cropped by
  `cropPortraitFrame` from cached atlas metadata, shifting the speaker tag right
  without changing the dialogue box width or text measure). Talking bob motion
  (`portrait-bob`) is scoped strictly to
  `.sticker-portrait.is-talking .sticker-portrait-img` in `src/ui/sticker.css`
  (suppressed under both `@media (prefers-reduced-motion: reduce)` and
  `:root[data-reduced-motion="on"]`) so removing `.is-talking` when a line
  finishes revealing never restarts `sticker-medallion-pop` on
  `.sticker-portrait`. Dialogue panels and choice stickers use brief
  reduced-motion-guarded pop-in motion; dialogue panels and TALK prompts use a
  low-opacity inset dashed stitch border. Labels use Nunito 800, choices use
  600, and body copy uses 400 for readable small-size text.

### 7.2 Title screen layout
- The title screen (`src/ui/title.ts`, Milestone 97 polish) is the top layer
  (`--z-title`) over a warm radial cream halo (`#fffaf070` -> `#fffaf028` ->
  `#f8edcf18`) above the area painting: the "Wilds of Cloverhollow" wordmark
  (`Nunito 900`) on a gently tilted (`-1.2deg`) warm cream-to-ivory parchment
  die-cut sticker plate (`.title-plate`) with inset warm-brown dashed stitching
  (`::after`), an upper-right four-leaf clover sprig (`.title-clover`), and a
  complementary bottom-left botanical wildflower/clover sprig (`.title-blossom`,
  `aria-hidden="true"`, zero text). Choice-style option stickers sit centred
  below it, at least 44 px tall: unselected buttons use warm cream paper
  (`--sticker-paper`), while the selected button uses `--sticker-green` with a
  subtle spring lift (`translateY(-2px)`), a zero-text CSS leaf/pip selection
  indicator (`::before`), and deepened dark-espresso detail ink (`#362313`,
  > 7.5:1 contrast on `--sticker-green`). All transitions and motion respect
  `prefers-reduced-motion: reduce`.
- Modes: `fresh` (no save: New game only), `continue` (a save exists:
  Continue, with a detail line saying where Fae is and how many stickers she
  has, then New game), and `confirm` (choosing New game over a save asks
  "Start a new game? Your saved game will be replaced." with "Yes, start over"
  and "No, go back", No selected by default, on a stitched parchment modal card
  over a soft dim, with matching `::before` selection pip).
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
  which returns to Continue. Pure `titleEffectForTransition(before, after)`
  maps title transitions to `"title-start"`, `"card-open"` / `"card-close"`,
  `"title-move"`, or `null` (Milestone 133).
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
  pack directly; unknown ids show an error listing the known ids and freeze
  without reading the player's save. The title's production appearance is
  unchanged. The menu can be cancelled back to the prior title mode, and a
  harness fixture reset clears the active pack and badge. QA mode is also left
  by reload or relaunch.
- The Continue detail (`continueDetail` in `src/shell/title-flow.ts`) is the
  area's `name` (area JSON) and the sticker count (`"0 stickers"`,
  `"1 sticker"`, `"2 stickers"`), followed by up to two non-zero adventure
  highlights from `journalProgress` in order (`"<found>/<total> gems"`,
  `"<n> keepsake(s)"`, `"<n> fish"`), separated by `" · "` (Milestone 111;
  unchanged when all three are zero). Once `valleyCompletion(progress).complete`
  is true (all 63 valley collectibles across stickers, prizes, fish, keepsakes,
  and gems), `continueDetail` crowns the save as
  `"<area> · ★ 100% Valley Explorer"` (Milestone 168).
- Dev builds log `[cloverhollow] title {mode, options}` (the visible buttons'
  rects, CSS px) when the mode changes; `just ios-smoke` taps New game from
  them on a fresh install and Continue after the relaunch.
- Dynamic browser tab title (`src/shell/document-title.ts`, Milestone 138):
  `formatDocumentTitle(world, state, { titleOpen, creditsOpen })` keeps
  `document.title` in sync on change only (zero per-frame DOM churn):
  `"Wilds of Cloverhollow"` on the title screen or `harness`, `"Thank You for
  Playing · Wilds of Cloverhollow"` during credits, `"Calming <Critter> · Wilds
  of Cloverhollow"` during calm-down battles, `"<Minigame> · Wilds of
  Cloverhollow"` across all six minigames (`Claw Machine`, `Skee-Ball`,
  `Boop-a-Mole`, `Comet Cruise`, `Clubhouse Microwave`, `Bubblegum Bay
  Fishing`), and `"<Area Name> · Wilds of Cloverhollow"` in overworld areas.

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
- The credits (`src/ui/credits.ts`) are a paper sheet over everything
  (`--z-credits` and shared `--sticker-*` tokens, with `.die-cut` on entry
  images and centred desktop layout from 1000 px wide): "THE END", FRIENDS,
  MET ALONG THE WAY, an optional Journey Summary ribbon (`.credits-summary`,
  populated from pure `creditsSummary` in `src/core/journal.ts` with compact
  pills for each non-zero collection category among Stickers, Star Gems, Fish,
  Keepsakes, and Prizes, hidden when empty; when `valleyCompletion` reaches
  100% across all five collections, `creditsSummary` prepends a golden
  `.credits-summary-pill.is-master` pill `"★ 100% Valley Explorer!"`,
  Milestone 120), and "Thank you for playing!", from `creditEntries` (`src/core/credits.ts`). FRIENDS is each roster member who
  starts with Fae or whose `befriended` (else `joins`) variable is true, in
  roster order, on the frame `down_idle_01`; small animal party frames
  (`<= 280x280`, via `cropCreditFrame` in `src/shell/view-models.ts`,
  re-exported through `src/shell/assets.ts`) tightly crop
  to their lower-centre figure so they match Sue, Jordan, and critters in scale.
  MET is each sticker in `state.stickers`, by its name, on its critter's atlas
  at the sticker's frame. Each entry is a small sticker over its name; the
  stickers show together, once their atlases are decoded (decoded whole, WebKit
  draws them the same way every time). The names and the thanks are at least
  18 px. At 1180x820 and 1280x720 the largest credits (every friend and the
  whole catalogue) fit without scrolling; on a phone the sheet scrolls. On
  touch only the confirm button shows, at least 44 px and clear of the entries.
- The shell steps the core on every credits tick, and the core holds the
  world still (only the tick, the previous input, and the resting pose
  change), so the ticks and their input stay a replay's.
- A confirm counts after a 12-tick beat (`CREDITS_BEAT_TICKS`,
  `creditsConfirmAllowed`), so a press still down from Milo's last line can't
  skip the credits. Clicking or tapping `.credits-screen` (`createCredits`
  `onClose`, Milestone 126; with `:root[data-credits="open"] .touch-controls`
  set to `pointer-events: none` so touch taps reach the sheet while
  `.touch-buttons` keeps `pointer-events: auto`) emits a `confirm` tap through
  the same beat guard. It puts the kept snapshot back as the state, with no core
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
  wind-up (a giant snowball), and snowballs to catch. Ms. Coral, the lifeguard
  (`lifeguard`, Milestone 64; feelings grumpy, hungry, curious; 25 coins), is
  the third person, with Mr. Pip's numbers and friend commands, a wind-up (a
  giant beach ball), and beach balls to catch, cut from the bay's painting and
  drawn at her `toyScale` (0.5). Ms. Rowan, the art teacher (`art-teacher`,
  Milestone 63; feelings curious, zoomy, grumpy; 25 coins), is the fourth
  person, with Mrs. Flurry's numbers and a wind-up (a giant paint bucket); her
  bursts are Trace, not catches, and she has no Talk phase. Snack costs one
  snack and restores 2 energy, as for the other person battles. Each person's
  battle atlas is built by `tools/art/build-person.ts <id>` from one 2x2 body
  sheet.
- Mini-boss numbers: the Grumpy Gull has `overworldHeight` 110 (ordinary
  critters are 66 or 70), `battleHeight` 260 (ordinary critters are 145;
  bosses remain 260–280 so small critters stand ~70% of Fae's battle height
  while bosses tower over her),
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
- Friend commands & per-member turns: Maddie's Play, Sue's Cast, and Jordan's
  Juggle (pinecones; calm 30, great 15, good 5, rest 2 on every critter). Each
  plays its own check (Milestone 40): Play the ring (Maddie's pounce), Cast a
  charge (Sue winds up and throws her bobber), Juggle a beat chain. Battle
  turns rotate through `battleTurnRoster(world, state)` (`Fae`, then fighting
  party members in canonical order via `battle.actorIndex`, resetting to `0` on
  `intro -> command`, after a turn-0 caught burst, and during Talk mode). Each
  turn's menu shows only the active member's signature move (`Soothe` for Fae,
  or `Cast`/`Juggle`/`Play` for a party member), `Recover` (`+1 leaf`), `Snack`,
  and `Run` (when `critter.canRun`).
- Content: `content/critters/*.json` (validated by the loader) supplies every
  battle number and line: the touch radius, calm and energy maxima, the
  `coins` it pays when calmed (8 for ordinary critters, 25 for the gull and
  the people under the chaos spell, 40 for the kid in the purple hood),
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
  rest -> cozy fainting animation + twilight dim, then dark blackout fade
          (`transition.tone = "dark"`) to `safeSpot` (autosave deferred until
          respawn finishes); the critter stays chaos; nothing lost
  ```

- Reward (Milestone 28): every calm pays the kind's `coins`; the species'
  sticker comes only the first time. As the reward shows, `rewardSticker` is
  set to the sticker if it's new (the reward card shows it, with "New
  sticker: ... +N coins.") or null (no card; the line is "+N coins!"). The
  reward ends the battle with the set piece's or the recurring critter's
  mood calm. The aura and the check are gone at the reward.

- Rest (losing a battle when `energy <= 0`): enters `phase: "rest"`, dims the
  battle stage with `stageMood: "rest"` and a twilight wash (`0x120d1f`,
  ramping `0.25 -> 0.62` over 36 ticks; steady `0.55` under reduced motion),
  and plays Fae's cozy fainting animation (ticks `0..14` dizzy sway, `14..32`
  smoothstep sideways slump with settle squash, `32+` slow resting breath, 3
  orbiting pastel-gold/lavender overhead sparkle stars, and sympathetic party
  droop; reduced motion holds a static slump and 2 overhead stars). Confirming
  out of `rest` clears `battle` and starts a dark blackout transition
  (`transition: { target: state.safeSpot, phase: "out", elapsed: 0, tone: "dark" }`,
  preserving `tone: "dark"` across `"out" -> "in"`): the full-viewport
  `0x0f0b18` fade sits above the battle stage, holds the fainted stage through
  `"out"` (zero overworld flash), reaches `1.0` blackout by `65%` of `"out"`,
  holds `1.0` through the first `35%` of `"in"` with `transitionZoom = 1`, and
  fades cleanly up on Fae respawned at `state.safeSpot` with the critter still
  in chaos. `autosaveNeeded` returns `false` whenever `next.transition !== null`,
  deferring the post-rest autosave until the respawn transition finishes.

- Commands & per-member turn rotation: outside Talk mode, `battleCommands`
  builds the active actor's menu (`activeBattleActor(world, state)`): their
  signature command (`soothe` for Fae; `cast`, `juggle`, or `play` for a party
  member), `recover` (`"Recover"`, `"+1 leaf"`), `snack`, and `run` (when
  `critter.canRun`). On entering a command menu, `selected` defaults to the
  first enabled command (`firstEnabledCommand`) so the cursor never starts on a
  resting move. Up/down edges skip disabled commands; confirm or a touch
  `choose` picks. Choosing `recover` restores `+1` energy (clamped to
  `critter.energyMax`), ticks `battle.rest`, clears any rest cooldown on the
  active member's own command, sets `battle.command = "recover"`, and enters
  `"result"` with a character-specific breath/stretch line. The chosen command
  id (`soothe`, `recover`, or a friend's id) is stored in `battle.command`.
  `battle.rest` maps each friend's command id to the turns it still rests
  (missing means ready): choosing a friend's command sets its rest to the
  critter's content `rest` for it, and every command choice (Soothe, Recover,
  Snack, or a friend's) takes one turn off every other resting friend. A
  resting command is disabled with its member's `resting` detail. Snack spends
  one of Fae's `snacks` (gone for good, whatever happens next), shows her
  combined snack and specialty treat count (`×N`), and is disabled at zero.
- Specialty Treats & Battle Treat Tray (`content/treats.json`): when Fae carries
  zero specialty treats, choosing `Snack` spends a plain snack immediately as
  before. When Fae carries one or more specialty treats (`totalTreatCount > 0`),
  choosing `Snack` opens the die-cut Battle Treat Tray (`battle.treatMenu`,
  `battleView.treatTray`, `.battle-treat-tray`) inside the command menu slot,
  listing Plain Snack (if `snacks > 0`), each carried specialty treat in
  catalogue order, and `Back`. Up/down wraps the tray selection; Cancel (`X` /
  Escape, without firing Together!) or `Back` closes the tray without spending
  a turn; confirm or click/tap picks. Once Fae owns a critter's sticker in her
  album, any carried treat listing that critter's species displays a coral-cream
  heart `Fav!` badge (inline SVG). Using a specialty treat decrements its count
  (dropping the key at zero and omitting `state.treats` when empty), restores
  `treat.energy` leaves, adds `treat.favouriteCalm` (if the critter's species is
  a favourite) or `treat.calm` calm, answers a `hungry` feeling or pops a
  `hungry` wind-up bubble for the feeling bonus, ticks resting friends, and
  shows `treat.favouriteLine` or `treat.useLine`.
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
    `bubble`, `dust`, or `star`): beat j lands at `arrivals[j]` and is seen travelling
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
  - `echo` (Milestone 85; `notes`, `demoTicks`, `gapTicks`, `inputTicks`): only
    a burst's (Clover Hills' Bouncy Lamb). Draws `notes` chime values in `0..3`
    (`0` up/red, `1` right/yellow, `2` down/green, `3` left/blue) from the
    seeded PRNG (`min(3, floor(value x 4))`). Plays each note for `demoTicks`
    with `gapTicks` silence between them (ignoring player input while demoing),
    then scores fresh directional edges (deterministic priority up, right,
    down, left) or taps on the four chime stickers against the sequence until
    all notes are entered or `inputTicks` elapse. All hits grade `great`, at
    least half `good`, fewer `miss`.
  - **Gentle Timing accessibility** (`gentleCheckSpec` in `src/core/checks.ts`,
    `StepOptions.gentleTiming` in `src/core/sim.ts`): an optional preference
    (default `false`, stored outside the save slot under `cloverhollow-settings`
    in `@capacitor/preferences`) that softens every check when enabled: wider
    `ring` and `charge` great/good windows (clamped inside the check), wider
    non-overlapping `chain` hit windows, slower `catch` travel (+20%) and wider
    gaps (+4 ticks between toys), gentler `lean` gusts (`forces - 1`, `steer + 1`,
    `spring + 1`), larger `trace` reach (+35%), brush speed (+20%), and dry
    time (+40%), gentler `peekaboo` (`warningTicks + 6` cap 28, `graceTicks + 5`
    cap 10, `goal * 0.78`), and slower `echo` (`demoTicks + 4`,
    `inputTicks + 36`), plus all six minigames threaded through `stepArcade` /
    `arcadeView` (`src/core/arcade.ts`, Milestone 112): Claw Machine (+35% grab
    reach on both `stepClaw` and `clawView`, 0.75x aiming gantry speed, and
    unpinned plush priority inside reach), Skee-Ball (0.72x aim sweep and power
    meter speed), Boop-a-Mole (+35% `moleWindow` stay-up ticks), Comet Cruise
    (0.78x scroll speed and +22% star collection tolerance without widening rock
    collisions), Microwave Cooking (+35% clamped golden window half-width in
    both `stepCook` and `cookView`, reflected in `goldenWindow`, `darkness`, and
    `zone`), and Bubblegum Bay Fishing (+20 tick bite window, +0.08 catch zone
    half-width, halved reel drain). When `gentleTiming` is `false` or omitted,
    `step()` is bit-for-bit identical to standard timing.
  - **Dialogue & Battle Text Speed** (`TextSpeed = "cozy" | "brisk" | "instant"`,
    `revealCharacters`, and `StepOptions.textSpeed` in `src/core/sim.ts`): an
    optional preference (default `"cozy"`, stored under `cloverhollow-settings`
    alongside `gentleTiming`, `keyHints`, and `reducedMotion`) controlling text
    reveal speed across overworld dialogue, battle messages, and battle Talk
    lines. `"cozy"` (and omitted) uses `world.tunables.interact.revealPerTick`
    bit-identically (zero replay hash drift), `"brisk"` reveals 2.5x faster,
    and `"instant"` reveals each line in full immediately.
  - **In-Game Reduced Motion** (`reducedMotion` in `src/platform/game-settings.ts`,
    default `false`): synced to `document.documentElement.dataset.reducedMotion`
    (`"on"` / `"off"`) and checked alongside OS
    `prefers-reduced-motion: reduce` via `isReducedMotionActive()`
    (`src/platform/reduced-motion.ts`). When active, it collapses UI CSS
    animations/transitions across every UI stylesheet with explicit
    `:root[data-reduced-motion="on"]` parity mirroring every
    `@media (prefers-reduced-motion: reduce)` rule (all 7 minigames:
    `claw.css`, `skee.css`, `mole.css`, `comet.css`, `cook.css`, `fish.css`,
    `taco.css`, plus `area-banner.css`, `title.css`, `touch-controls.css`,
    `battle.css`, `journal.css`, `sticker.css`, `save-toast.css`, and
    `arcade-popups.css`, Milestone 140), silences
    haptics (`src/platform/haptics.ts`), keeps door transitions as calm opacity
    fades (`transitionZoom = 1`), snaps camera follow (`smoothFollowCamera`
    with `snap = true`, zero look-ahead swing), holds overworld figures in
    grounded stillness (skipping `walkPose` bounce/squash, `idleBreathing`,
    `fairyHover` tilt, `roamerHop`, `companionIdlePose`, and `petReaction`
    shake while keeping contact shadows), holds overworld emotes, companion
    pet/rest particles (`computeCompanionEmoteSpecs`), blacklight lantern
    motes/spotlight/glows (`computeLanternMote`, `computeGlowTransform`),
    clubhouse keepsake sparkles, chaos critter auras, and ambient flyers
    (`flyerAt(flyer, 0)`, steady `frame: 0`) calm, upright, and tick-invariant
    (Milestone 139), and calms battle presentation
    (skipping `battleIntro` slide/zoom, zeroing `stageShake` in both
    `battle-view.ts` and `computeBattleChoreography` impact/`burstResult`,
    suppressing critter wind-up high-frequency micro-tremble and spinning fizz,
    holding `Together!` ready/active sparkles, hearts, rings, and Relief Bloom
    petals calm and upright in `src/render/battle-vfx.ts` (Milestone 140),
    holding `battleSunburst` at steady orientation, and freezing ambient mood
    wash drift/pulse in `src/render/battle-view.ts`).
  - **Universal Safari / iOS Tap-Selection Hygiene** (Milestones 139–140):
    interactive game UI controls, tap surfaces, and all 6 direct press-and-hold
    minigame overlays/cabinets across `src/ui/title.css`,
    `src/ui/battle.css`, `src/ui/journal.css`, `src/ui/sticker.css`,
    `src/ui/touch-controls.css`, `src/ui/credits.css`, `src/ui/claw.css`,
    `src/ui/skee.css`, `src/ui/mole.css`, `src/ui/comet.css`, `src/ui/cook.css`,
    `src/ui/fish.css`, and `src/ui/taco.css` declare
    `user-select: none; -webkit-user-select: none; -webkit-touch-callout: none;`
    so rapid taps and long-presses on Safari/WebKit and iOS never trigger
    accidental text selection or link callouts, while keeping dev QA console
    output and text inputs selectable.
- Every critter kind has a content `level`; `content/levels.json` maps it to
  `calmMax`, burst base/big strength, and calm XP. On `great` or `good` timing,
  Soothe and a friend's command use the actor's Power (20 at level 1, +2 per
  level), with Magic (+1), plus `feelingBonus` if the command answered this
  turn's feeling or popped a wind-up bubble, clamped to `calmMax`. Missing an
  ordinary critter-side timing check (`miss`) deals `0` calm (no base Power, no
  feeling bonus, leaves wind-up bubbles unpopped, and triggers no hit-stop or
  stage shake); `Together!` keeps its 3-star finisher scaling, and `Snack` /
  specialty treats have no timing check so they apply immediately. Fae earns
  every calm; a friend earns it
  only when that friend's command was used. A burst's check
  starts with seeded PRNG draws, in this order: first the big roll (under
  `bigChance` it's big, plays `burst.big`, or the burst's `check` if the kind
  has none; after a wind-up there's no
  roll, as its pops set the size), then one draw per catch toy,
  `min(2, floor(value x 3))` its lane, or per lean puff, `forces[min(n - 1,
  floor(value x n))]` its force (with n forces, each as likely). Ring and
  chain bursts make the one draw (none after a wind-up). Great, good, and
 miss deal 0, base minus 1, and base, less Fae's Guard (one per five levels),
 except a miss always costs at least one leaf. Great timing costs zero.
  `levels.json` stores cumulative XP thresholds through level 99 (level 2 is
  20 XP, level 5 is 339 XP, level 10 is 2,200 XP), command Power and Magic,
  Life (5 at level 1, +1 every 3 levels), and Guard (1 every 5 levels).
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
  ticks, target 45, windows 5 and 11. Clover Hills' Bouncy Lamb uses `echo`
  (3 notes, demo 20, gap 6, input 102; big 4 notes, demo 18, gap 5, input 88).
  Every timed part fits in 180 ticks; a
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
  forces, each at least 1 and under `steer`; for `peekaboo`, `ticks` 1..180,
  `goal >= 1`, `warningTicks >= 1`, `graceTicks >= 0`, sorted non-overlapping
  `peeks` inside `1..ticks` leaving at least `goal` safe ticks; for `echo`,
  integer `notes >= 2`, `demoTicks >= 4`, `gapTicks >= 1`, and
  `inputTicks >= notes * 10`. A `burst.big` must be its burst
  check's kind, every party command needs a check, and neither Soothe's nor
  a friend's may be a catch, lean, trace, peekaboo, or echo.
- Hints: while a charge waits for its first press, before a chain's first
  beat or a catch's first toy lands, before a lean's first puff blows, before a
  peekaboo moves (`tick < 28 && progress === 0`), or while an echo is in demo
  or has `entered === 0`, the battle view carries that kind's hint from
  `content/battle.json` (`hints.charge`, `hints.chain`, `hints.catch`,
  `hints.lean`, `hints.trace`, `hints.peekaboo`, and `hints.echo`). A trace
  hint is shown while its second checkpoint is pending.
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
  - An answered Snack or specialty treat sets `battle.answered` and adds the
    bonus to its calm at once. Soothe and friend commands evaluate
    `answerFeeling` when their check resolves: `great` or `good` sets
    `battle.answered` and adds `feelingBonus`, while `miss` leaves `answered`
    false and deals `0` calm. Calm stays clamped to `calmMax`. A new turn clears
    `answered`.
  - The lantern: once Fae has it, its button (L, X/Square, or the lantern
    sticker) in the command menu shows the turn after's feeling too, for the
    rest of the battle (`battle.lanternPeek`); it draws nothing, leaves the
    overworld lantern as it was, and plays `lantern-on`.
- Wind-ups (Milestone 50): a mini-boss (`windUp` in its kind: `start`,
  `every`, `bubbles`, and `lines.start`, `lines.puffing`, `lines.fizzle`)
  puffs up on turn `start`, then every `every` turns, feeling several things
  at once. The gull, Mr. Pip, Mrs. Flurry, and Ms. Rowan start on turn 2,
  every 3
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
  - Popping: a Snack (or specialty treat) pops the first matching bubble at
    once, and a check-based command pops it when its check lands (`great` or
    `good`), counting as answering (the feeling bonus); a missed check leaves
    the bubble unpopped and deals `0` calm, and a command that answers none
    earns nothing extra. Each command answering a bubble not yet popped wears
    its badge.
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
- Together! party sparkle finisher (`together` in `content/battle.json`,
  validated by `parseBattleContent`: positive integer `chargeMax`, non-empty
  `label` and `hint`, a Fae-side `chain` `check`, and non-empty `lines` for
  `great`, `good`, and `miss`):
  - Active whenever at least two battle party members are along
    (`battleParty.length >= 2`) and the battle is not in Talk mode.
  - Any check (Fae or friend command except `together`, plus enemy bursts)
    resolving `great` adds 1 to `battle.sparkle`, capped at `chargeMax` (3).
    `good` and `miss` leave `sparkle` unchanged; `sparkle` is omitted when 0.
  - In the `command` phase (once the message has revealed) with
    `sparkle >= chargeMax` and outside Talk mode, a fresh `cancel` press (X,
    Escape, or tapping the Together! sticker) launches `command: "together"`
    as a `critter`-side chain check (`look: "star"`, travel 34, hit window 9,
    arrivals 38, 60, 82; widened by `gentleTiming`), resets `sparkle`, sets
    `answered: true`, pops every active mini-boss wind-up bubble, ticks resting
    friends down by 1 without resting anyone, and plays `battle-together`.
  - Before the first star lands, `battleView.hint` carries `together.hint`.
  - Resolution sums Fae's Soothe Power plus each `battleParty` member's command
    Power at their current levels: `great` adds `teamPower + feelingBonus`,
    `good` adds `round(teamPower * 0.75)`, and `miss` adds
    `round(teamPower * 0.5)`, clamped to `calmLimit(critter)` (`calmMax - 1`
    on Talk bosses until Talk finishes), and shows `together.lines[grade]`.
    Winning a battle whose final command was `together` awards `+xp` to Fae
    and to every `battleParty` member (excluding flute friends).
- Flute Friends in battle (`fluteAssist` in `content/battle.json`, validated by
  `parseBattleContent`: positive integers `pupCalm`, `squirrelEnergy`,
  `squirrelSoften`, `bunnyCalm`, `bunnyTogether`, and non-empty `lines` for
  `pup`, `squirrel`, `bunny`, `both`, `pupBunny`, `squirrelBunny`, and `all`):
  - Once per battle (`battle.fluteUsed`), in the `command` phase (after reveal)
    outside Talk mode when `has_flute` is true and at least one of `pup_friend`,
    `squirrel_friend`, or `bunny_friend` is true, a fresh `flute` press (F or
    tapping the flute sticker) calls Fae's befriended animals and plays `flute`.
    The HUD pill names the single befriended friend (`Pond Pup`, `Acorn
    Squirrel`, or `Ribbon Bunny`) or `Flute Friends` when two or more are
    befriended.
  - Pond Pup (`pup_friend`) adds `pupCalm` (25) calm (clamped to
    `calmLimit(critter)`). Acorn Squirrel (`squirrel_friend`) restores
    `squirrelEnergy` (1) leaf (capped at `energyMax`) and adds `squirrelSoften`
    (1) to `battle.burstSoften`. Ribbon Bunny (`bunny_friend`) adds `bunnyCalm`
    (15) calm and `bunnyTogether` (1) Together! sparkle star charge (clamped to
    `chargeMax` when `battleParty` has at least two members). Multiple
    befriended animals combine all of their effects.
  - If calm reaches `calmMax`, the battle transitions straight to `soothed`
    (clearing any wind-up); otherwise it stays in `command` with the assist
    line so Fae still takes her turn.
  - When a burst resolves with raw damage above 0 while `burstSoften > 0`,
    damage is reduced by `burstSoften` (clamped at 0) and `burstSoften` clears;
    a `great` 0-damage burst preserves `burstSoften` for the next damaging
    burst.
- Coach Ash's Rainbow Lasso in battle (`lassoAssist` in `content/battle.json`,
  validated by `parseBattleContent`: positive integers `calm` and `coins`, and
  non-empty `lines.windUp` and `lines.snag`):
  - Once per battle (`battle.lassoUsed`), in the `command` phase (after reveal)
    outside Talk mode (`!talkMode`, `battle.talk === null`) when `has_lasso` is
    true, a fresh `lasso` press (R, gamepad LB/L1, or clicking/tapping
    `.battle-lasso-btn`) twirls the lasso without consuming Fae's turn and
    emits `lasso-twirl`.
  - If an active mini-boss wind-up has any unpopped bubble, the lasso pops the
    first unpopped bubble, adds `lassoAssist.calm` (15, clamped to
    `calmLimit(critter)`), and displays `lines.windUp`.
  - Otherwise (Steady Snag), it adds `lassoAssist.calm` (15, clamped to
    `calmLimit(critter)`), grants `lassoAssist.coins` (+4 coins), sets
    `battle.lassoSteady = true`, and displays `lines.snag`. While `lassoSteady`
    is set, the critter's next burst keeps its seeded `bigChance` PRNG draw
    order untouched but cannot upgrade to `big`, clearing `lassoSteady` as that
    burst starts.
  - If calm reaches `calmMax`, the battle transitions straight to `soothed`
    (clearing any wind-up); otherwise it stays in `command` so Fae still takes
    her turn.
- While a battle runs Fae is frozen, doors don't fire, menu is ignored (v0),
  cancel is ignored unless Together! is ready, and the party keeps settling.
  `safeSpot` is set at new game and on every area arrival.
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
  `auraCentre` and `bodyCentre` frame-pixel centroids, and may set a
  `toyScale` (a number above 0, 1 unless set; section 8.1). Kinds may share an
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
  of the critter and are drawn at the critter's own scale (most were cut from
  its art) times its kind's `toyScale`: the lifeguard's beach balls, cut from
  the bay's painting, are drawn at 0.5, about 50 battle units across.
  A lean's track (1.6 x Fae's height wide, max(12 px,
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
  clamped, softly blurred, with a light cream wash. In battle, a soft centred
  warm-cream spotlight (`screen`, keeping the four corners untouched) and
  multiply contact shadows sit behind Fae, her fighting party, and the critter
  (scaling with wind-up swell); during the `intro` phase, the backdrop zoom,
  layer fade, and opposing slide-in ease smoothly to their marks. The overworld
  characters hide during the battle.
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
  grade sticker and hint, and a reward card (`.battle-reward`, which exposes
  `role="status"` and `aria-live="polite"` in Milestone 138 and
  `onConfirm` in Milestone 126 with `cursor: pointer; pointer-events: auto` so
  clicking or tapping the reward sticker or arcade prize card emits a `confirm`
  tap). For confirm-driven checks (`ring`, `charge`, `chain`, `peekaboo`,
  classified by `isConfirmCheckKind` in `src/ui/pointer-hold.ts`, Milestone
  127) and directional checks (`catch`, `lean`, classified by
  `isDirectionalCheckKind`, Milestone 128), `createBattleCheck` pre-mounts a
  transparent full-stage `.battle-check-tap` (`z-index: 9`, below
  `.touch-controls` at `10`, `.battle-hud`, and `.battle-echo`, hidden whenever
  inactive or graded). Confirm checks bind via `bindPointerHold` and wire
  through `onConfirmHold` to `confirm` press and hold; directional checks bind
  via `bindPointerMoveHold` (`resolveCatchDirection` across the three lane
  heights, `resolveLeanDirection` around `track.x`) and wire through
  `onDirectionHold` to `TouchInput.setPointerArrow` (kept separate from touch
  arrow stickers so `.touch-reach` and `.touch-lean` stay unobstructed while
  direct taps/drags reach the stage; with `:root[data-battle="open"]
  .touch-controls` at `pointer-events: none` and `.touch-button` keeping
  `pointer-events: auto`). Combined with `trace` (direct pointer drawing) and
  `echo` (clickable chime stickers), all 8 battle timing checks support direct
  mouse and touch pointer play. The game passes a full view to
  each `render` every frame; identical views change no DOM nodes. Battle
  messages use the dialogue box with no speaker.
- One stacking scale (`--z-*` in sticker.css), bottom to top: HUD, dialogue,
  commands, choices, prompt, check and grade, reward.
- HUD: ENERGY (showing Fae's own level from `levelForXp`; one leaf per point up
  to 10, compact for 6..10, and capped at 10 proportionally filled leaves plus
  a `current/max` count above 10; spent leaves outlined) at the top left and
  the critter's fizz/calm countdown meter (its level and name in capitals,
  a track starting full at `100%` and counting down to `0%` via
  `battleMeterRemaining(calm) = 1 - clamp01(calm)` as Fae calms the critter,
  exposing `<name> fizz` and remaining percentage on `.battle-calm-track`,
  a cozy heart emblem beside the track that warms to soft coral-pink in the
  final 25% of remaining fizz / `calm >= 0.75`, and subtle 25% / 50% / 75%
  vertical milestone tick marks inside `.battle-calm-track`) at
  the top right, left of the menu button, inside the safe area. Directly under
  ENERGY sits `.battle-actions-left` (a compact wrapping horizontal row on
  phones and desktops, clear of ENERGY, thought clouds, wind-ups, commands,
  dialogue, and touch controls): `.battle-sparkle-pill` (filled gold and
  outlined stars while sparkle is 1..2), `.battle-together-btn` (sunny gold
  44 px sticker button with a reduced-motion-guarded diagonal sheen sweep and
  `X` key badge hidden on touch when sparkle is ready), `.battle-flute-btn`
  (soft mint 44 px sticker button naming Pond Pup, Acorn Squirrel, Ribbon
  Bunny, or Flute Friends with `F` key badge hidden on touch while available),
  `.battle-lasso-btn` (warm peach-cream `#fdecd8` 44 px sticker button with an
  inline SVG coiled-lasso-with-star icon, `"Lasso"` or `"Pop Bubble!"` during
  an unpopped wind-up, and `R` key badge hidden on touch while available),
  `.battle-soften-pill` (`Softened` badge while Acorn Squirrel's burst soften
  is active), and `.battle-steady-pill` (`✦ Steady` cream badge while
  `lassoSteady` is active). The action keycap badges on `.battle-together-btn`,
  `.battle-lasso-btn`, and `.battle-flute-btn` (plus the `.battle-calm` field
  guide tooltip) adapt dynamically between keyboard (`X`, `R`, `F`, `I`) and
  gamepad (`B`, `LB`, `RB`, `View`) glyphs via `battleActionKeys(mode)` in
  `src/ui/battle.ts` (Milestone 134, defaulting to `"keyboard"` so existing
  baselines stay unchanged). Beside ENERGY on desktop viewports (`>= 960 px`,
  hidden on compact phone screens `< 960 px`) sits `.battle-portraits`, a row
  of 42 px circular die-cut party medallions (`src/ui/battle-portraits.ts`,
  Milestone 90) for Fae and each active fighting party member (excluding flute
  friends), reusing cached bust crops (`speakerPortraitSource` +
  `cropPortraitFrame`) with mood rings and zero-text inline SVG corner badges
  for `cozy`, `eager`, `cheering`, `flustered`, and `radiant` (with
  reduced-motion guards). Like the feelings cloud, `.battle-actions-left`
  steps aside
  during active checks and burst results (`phase === "check"` or
  `"burstResult"`) so check overlays such as Lean's balance track stay
  completely clear on notched phones. The HUD hides during the reward.
  The dialogue box hides its advance triangle (`▼`) during the command phase,
  and during live command selection (outside Talk and the treat tray) displays
  a high-contrast `.sticker-subtitle` preview line (`battleCommandPreview`)
  describing the highlighted command, any active feeling match, or cooldown.
- Die-cut Paper-Mario battle popups (Milestone 107, extended Milestone 134,
  `src/ui/battle-popups.ts` & `src/ui/battle.ts`): purely UI-driven by diffing
  consecutive live battle HUD snapshots (zero `src/core` changes, zero popups on
  battle open/close/switch or static gallery renders). Ephemeral `.battle-popup`
  pills mount inside `.battle-popups` (`z-index: 28`, `pointer-events: none`,
  `aria-live="polite"`, `aria-atomic="false"`, Milestone 138),
  rising and fading over 850 ms (or a calm 450 ms fade under
  `prefers-reduced-motion: reduce` and `data-reduced-motion="on"`), clearing
  immediately on battle end/reset: calm gains spawn over the critter (`+N`
  mint-cream `#dff2cf`, `+N ★` butter-yellow `#ffe896` for `>= 28`, `+N ♥`
  coral-pink `#ffd7e2` for `>= 45` or favourite-treat text), popped wind-up
  bubbles spawn sky-blue `"POP!"` (`#d6eefc`), energy restores spawn peach-mint
  `+N ⚡` (`#e6f5d5`) over Fae (and when per-member `Recover` fires at full
  energy, transitioning `recovered: false -> true` with `next.energy <=
  prev.energy`, `classifyBattlePopup` spawns `READY! ✦` with `kind: "energy"`
  over Fae without double-popping when `+1 ⚡` already fired, Milestone 172),
  and live tactical assist transitions spawn
  WCAG-AAA `#47321f`-ink pills: Flute Friends (`FLUTE! ♪`, `.battle-popup-assist`,
  sky-meadow teal `#c7f0e8`, over Fae), Lasso (`STEADY! ✦`, `.battle-popup-steady`,
  buttercup gold `#ffe484`, over the critter), Lantern Mood Peek (`MOOD PEEK! ✦`,
  `.battle-popup-peek`, pastel lavender `#ede0ff`, over the critter), and
  `Together!` (`TOGETHER! ★`, `kind: "big"`, butter-yellow `#ffe896`, over Fae).
- **Battle Field Guide Peek** (Milestone 110, gamepad parity Milestone 114,
  `src/ui/battle-peek.ts`,
  `src/ui/battle.ts`, `src/main.ts`): during live battle `command` phase
  (outside Talk and QA overlays), pressing `I`, gamepad Select (standard button
  8), or clicking/tapping the top-right
  foe plate (`.battle-calm`, styled identically at rest so existing battle
  baselines stay unchanged) toggles a compact warm-paper `.battle-peek-card`
  (`role="region"`, `aria-label="Critter field guide"`, `tabindex="-1"`, `hidden`
  by default, `z-index: var(--z-prompt)`, `#fbf6e8` card with `#47321f`
  dark-ink text and pills; opening moves focus to `.battle-peek-card` without
  altering its 2 px ink outline and closing restores focus to the prior
  connected, visible trigger element when battle remains active, Milestone
  152). It shows critter name, level, familiarity (`New Friend` /
  `Befriended ✓` / `Old Friend ★` using `state.calms[species]` and
  `world.battle.oldFriends.calms`), region name, check mechanic badge
  (`checkMechanicLabel`, exhaustive over all 8 `CheckSpec["kind"]` values),
  known feelings (revealed after calming once or carrying the lantern, else a
  gentle hint), discovered favourite treats (revealed only after calming once so
  undiscovered favourites are never spoiled), and a concise `<= 72`-char
  tactical tip tailored to Talk, Peekaboo, Echo Chimes, wind-ups, or burst check
  kind. Pressing `Escape`, `X` (`KeyX`), touch `×`, or gamepad B (button 1)
  dismisses only the peek card (swallowing `cancel` and returning early from
  `tick` in `src/main.ts` so `stepBattle` never receives a leaked `cancel` press
  such as launching `Together!` or backing out of the treat tray, Milestone
  125), and leaving `command` phase or closing battle auto-hides it. Responsive
  layout keeps it clear of HUD meters, party medallions, commands, dialogue,
  sprites, and touch buttons at `1280x720`, `874x402`, and `667x375`.
- Battle staging, facing & proportions: Fae (`scale: 0.72`) and all fighting
  party members (`((content.scale ?? 0.5) / 0.5) * 0.72`; flute cameos match
  this `0.72` base scale) face right toward the critter using horizontally
  mirrored `idle_left` frames (`-scaleX`, positive `scaleY`). `battleLayout`
  places Fae at the front (`x = width * 0.27`, `baseline = height * 0.59`),
  all fighting party members lined up behind her (`x = fae.x - (index + 1) *
  68 * scale`, `y = fae.baseline`, keeping pets like Maddie at the end of the
  line), and the critter at `x = width * 0.5`, `baseline = height * 0.42 +
  (critterHeight * scale) / 2`. During `command` phase, the active turn actor
  steps `+16` logical units forward toward the critter with a floating golden
  and cream die-cut chevron (`battle:turn-indicator`, static under reduced
  motion, hidden outside `command` phase) above their head, and party
  medallions highlight `view.activeActor.id` directly.
- Commands: a two-column grid of sticker buttons on phones (one column from
  1000 px wide), right-aligned above confirm and cancel, clear of the HUD, the
  dialogue box, and the touch buttons. A compact `.battle-turn-header` badge at
  the top of `.battle-commands` (`FAE'S TURN`, `SUE'S TURN`, `MADDIE'S TURN`,
  `data-actor`, spanning both columns on phones, updating `aria-label` to
  `<Name>'s battle commands`) announces whose turn it is above that member's
  four actions (signature move, `Recover`, `Snack`, `Run`; three when
  `!critter.canRun`). Each button
  renders a zero-text inline-SVG storybook icon (`.battle-command-icon`,
  including a leaf-sparkle icon for `recover`), its
  label/detail column, and a feeling-match badge tucked cleanly inside its
  right edge (never clipping outside the button border). Commands matching a
  current feeling receive `.is-match` (warm golden-honey accent border and
  reduced-motion-guarded pulse). The selected command is lifted, green, and
  marked with a zero-text CSS leaf/pill accent (`::before`). Disabled commands
  are dashed and grey in explicit colours (never opacity), carry a detail line
  such as "resting", and never emit a choice.
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
  marks, a round pink bubble with a shine (like the frog's own), a butter-gold
  five-point star with cream sparkle highlights (Together!), or a puff of
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
  Ms. Rowan's Trace paths are `flower`, `spiral`, and `rainbow`; her big paths
  are `big-flower` and `big-rainbow`. They use the kid's tuning:
  `brushSpeed` 20, `reachRadius` 105, and `dryTicks` 180. The flower reads as
  a four-petal flower or a star.
- Echo Chimes (Milestone 85): a handcrafted cream die-cut board on the open
  right stage (`x = min(width - (width >= 1000 ? 164 : 206), max(critter.x +
  critter.height * 0.56 + 132, round(width * 0.77)))`, `y = max(width >= 1000 ?
  214 : 166, round(critterCentre.y))`, keeping Fae and the critter completely
  unobstructed while commands hide), showing note progress dots (`is-demo`,
  pulsing `is-current`, teal `✓` hit, grey `×` miss), a phase pill
  (`LISTEN...` / `YOUR TURN!`), a thin input timer strip, and four
  clickable/tappable directional pastel chime stickers (`>= 44 px` touch
  targets, `>= 7:1` ink contrast) in a diamond layout (Up Red `#f4a6a0`, Right
  Yellow `#f7df85`, Down Green `#a8d99c`, Left Blue `#9ecaf2`). Tapping or
  clicking any chime fires a directional tap via `touch.tapArrow(...)`,
  matching keyboard arrows and gamepad directions. Live choreography bounces
  the critter on each demo note and Fae on each echoed note.
- Battle stage VFX choreography (Milestone 155, `src/render/battle-vfx.ts`,
  `src/render/battle-vfx-stage.ts`, `src/render/battle-choreography.ts`,
  `src/render/battle-view.ts` with `BATTLE_VFX_POOL_SIZE = 80` and `"mistWisp"`
  in `BattleVfxTexture`): six reduced-motion-aware stage VFX emitters (all
  holding `rotation: 0` and steady positions across ticks when `reducedMotion`
  is enabled) join Snack Theater (Milestone 135) and Talk Theater (Milestone
  136) to complete 8-of-8 battle stage choreography with zero `src/core`
  changes:
  - Rainbow Lasso Arc (`LASSO_ARC_DURATION = 32`, `RAINBOW_LASSO_COLORS`,
    `isLassoActionActive`, `emitRainbowLassoVfx`): during live Rainbow Lasso
    command lines (`phaseTicks < 32`), Fae leans forward while a 7-color pastel
    rainbow arc (`alpha <= 0.96`) whips across `anchor: "between"` into a double
    shimmering critter loop with orbiting sparkles, plus 4 golden Steady Snag
    glints (`lassoSteady === true`) or 4 sky-blue wind-up bubble-pop puffs &
    sparkles.
  - Synesthetic Echo Chimes (`EchoColor`, `EchoChimeMotion`,
    `ECHO_CHIME_COLORS`, `echoNoteColor`, `emitEchoChimeVfx`): maps each
    `EchoNote` (`0..3`) to `red`/`yellow`/`green`/`blue`, emitting a
    color-matched glow, ripple ring, and 4 rising sparkles over the critter on
    demo notes or arcing from Fae on echoed notes, paired with gentle musical
    sway (held neutral under `reducedMotion`).
  - Wind-Gust Lean (`LEAN_WIND_TINTS` `[0x7ac7ea, 0x82d8be]`,
    `emitLeanWindVfx`): strictly while a Lean gust is `blowing`, emits 6 crisp
    sky-blue/seafoam-mint horizontal `mistWisp` ribbons and 3 wind sparkles
    streaming right-to-left across `anchor: "between"` (`t = 0.66 -> 0.16`,
    strictly clear of both sprites; held steady in `0.22..0.66` under
    `reducedMotion`).
  - Starry Owl Peekaboo Freeze (`PEEKABOO_WARNING_TINT`,
    `PEEKABOO_WATCH_TINTS`, `PEEKABOO_DUST_TINT`, `emitPeekabooVfx`): emits an
    amber-gold alert halo + 3 sparkles above the critter during `"warning"`, a
    luminous moonbeam watch ring + lavender-blue gaze glow + 4 starlight flecks
    during `"watching"`, and 2 subtle tiptoe dust `puff`s behind Fae during
    `"safe"` when `progress > 0` (all held steady under `reducedMotion`).
  - Shape Trace Watercolor Brush Choreography (`TRACE_BRUSH_COLORS`,
    `TraceBrushMotion`, `emitTraceBrushVfx`): emits 0 particles and neutral sway
    before tracing starts (`progress <= 0 && !drawing`); once actively painting,
    blooms 1 pastel `softGlow` + 2–6 pastel `sparkle` particles (scaling with
    progress) beside Fae's right hand (`anchor: "fae"`, `offsetX: 24..64`,
    `offsetY: -56..-10`, strictly clear of Fae's face and the Trace canvas) with
    gentle painting sway (`faeOffsetX`, `faeOffsetY`, `faeRotation`), holding
    zero sway and zero particle rotation across ticks under `reducedMotion`.
  - Soothed Victory Confetti (`SOOTHED_CONFETTI_COLORS`,
    `emitSoothedConfettiVfx`): strictly during `phase === "soothed"`, frames the
    critter outside `|offsetX| >= 90` with a warm golden halo and 10 pastel
    petals & sparkles (5 petals + 5 sparkles), leaving `phase === "reward"` (8
    Relief Bloom petals) untouched.
  - Battle `Recover` Hit-Stop Guard (Milestone 173): skips the critter result
    recoil/hit-stop/heart-burst block whenever `isRecoverTheater(battle)` holds
    (so prior-turn `"great"` / `answered` state never triggers `hitStop`,
    `stageShake`, critter recoil, or critter heart bursts during `Recover`),
    paired with bespoke `"battle-recover"` audio & `"light"` haptic feedback.
- The kid's reveal plays `milo_calm`, clears `forest_fizzy` through `on_calm`,
  and leaves Milo calm under the tree. The sticker catalogue has 24 slots,
  including Milo, Cozy Bat, Gem Mole, Starry Owl, and Chef Mateo. The front-view NPC art is no longer
  loaded by the runtime. Its raw source and recipe remain in `art/source/` and
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
- Reward messages include the coin and XP payout. Level-up notices queue in
  order (one per confirm), name the member and new level with only positive
  stat gains (`levelUpLine` omits `+0` deltas), and play the level-up cue. The
  critter plate shows `Lv N`, the journal shows each member's XP bar and stats,
  and the battle leaves cap at 10 with a `current/max` count above ten.
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
  Fae (at scale `0.58`), the party (each at `((scale ?? 0.5) / 0.5) * 0.58` so
  classmates match Fae's crown height), and aura in a fixed logical
  composition. It is render-only. Inside the central 70% of the viewport (leaving
  all four painted corners bright and textured), `battleLayer` draws a sunlit
  butter-cream ground stage oval framing the combatants' shared baseline and two
  slowly drifting sinusoidal watercolour mood washes (`battleMoodWaveA`,
  `battleMoodWaveB`) tinted dynamically by `battleStageMood` (`"calm-normal"`,
  `"windup"`, `"together-ready"`, `"together-active"`, `"soothed"`).
  `computeBattleChoreography` (`src/render/battle-choreography.ts`, paired with
  pure theater VFX helpers in `src/render/battle-vfx.ts` and
  `src/render/battle-vfx-stage.ts`, Milestones
  73, 82, 135, 136, 137, and 155) drives deterministic Paper Mario / EarthBound combat poses,
  `stageMood`, `hitStop`, and pooled `battleVfxLayer` particles (`sparkle`,
  `heart`, `energyRing`, `puff`, `petal`, `softGlow`, `mistWisp`, pool size 80): staggered breathing,
  highlighted actor step-forward on command selection, Heart-to-Heart `Talk`
  climax choreography classified by `isTalkTheater` (Fae's warm empathetic lean
  forward `offsetX: 6`, Milo/critter's calm lowered listening posture wrapped in
  a warm amber-cream `softGlow` `0xffebb8` at `alpha: 0.24..0.34`, 4 pastel
  hearts `0xffb7cf`/`0xffe599`/`0xc5e8d5`/`0xd8c4ff` and 3 warm golden sparkles
  `0xfff0b2` drifting gently along `"between"` `t: 0.22..0.82`, plus 3 extra
  soft rising golden sparkles around Milo during graded Talk replies when
  `battle.talk.grade !== null`, holding steady with `rotation: 0` and zero
  oscillation under `reducedMotion`), Soothe hops with luminous
  aqua energy ripples, Maddie pounce arcs, Sue charge lean-back proportional to
  `fill` and pastel cast arcs, Jordan beat-synced juggle tosses, three-tier
  Snack & Specialty Treat sharing theater classified by `classifySnackTheater`
  (`"snack"`: Fae refreshed bob + warm `softGlow` + 5 rising sunlit green-gold
  restorative sparkles `0x9be38a`/`0xffe58a`; `"treat"`: Fae toss lean +
  critter happy munch bounce + 4 arcing pastel hearts/sparkles along
  `"between"`; `"favourite"` / Golden Sunberry: Fae toss lean + bigger critter
  munch bounce + 7 golden/rainbow arcing hearts & sparkles + golden critter
  `softGlow` + 6-heart / 6-sparkle `radialBurst`, collapsing to steady non-
  bouncing glow/hearts when `reducedMotion` is enabled), per-member `Recover`
  theater classified by `isRecoverTheater` & applied by `applyRecoverTheater`
  (Milestone 172: cozy inhale-exhale bob `offsetY: -7 * arc` with subtle
  squash/stretch on the active recovering character only, a warm clover-meadow
  `softGlow` `0x9be38a`, and 6 rising clover-green & golden-leaf restorative
  sparkles `0x9be38a`/`0xc5f0b8`/`0xffe58a` anchored on `"fae"` or `"party"`
  with `actorId`, collapsing to zero bob and steady upright glow/sparkles under
  `reducedMotion`), live Lean balance
  tilting, live Catch lane posing with
  caught-toy sparkles, critter burst crouch-and-lunge, 3-tick render-only
  impact hit-stop (`phaseTicks < 4` on `great` / `answered` / `together`
  results: critter squash-stretch, golden starburst flash, and damped `±3.5 px`
  directional stage shake), `great`/`good`/`miss` reactions and rainbow bursts,
  on-field `Together!` ready eager bounce and curving golden sparkle tether,
  synchronized team wave-hop, rotating/breathing 12-ray watercolor
  `battleSunburst` behind the party over a deepened `0x201042` (`0.54`) twilight
  stage wash, and a 6-heart pastel rainbow + golden ring/sparkle cascade during
  `Together!` activation, damped Fae recoil with warm blush flash and gentle 3 px stage
  shake on spent energy, wind-up micro-tremble and fizzle wide squash-deflate,
  expanding aura dissolve with celebratory hearts, sparkles, and 8 gently rising
  pastel watercolour Relief Bloom petals on `soothed`/`reward`, and a ~45-tick
  on-stage hopping cameo with aqua/gold sparkles from resident flute-friend
  atlases when Fae plays her flute in battle. The shell logs `[cloverhollow]
  battle` with phase and message changes, and `renderInfo()` exposes the phase,
  the check's geometry, and critter frame.

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
  Z → ↓) is lettered on a little cap just left of it; with gamepad input active,
  `layoutMole` switches the middle hole cap from `Z` to `A` (`↑ ← A → ↓`,
  Milestone 135); on touch the holes
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
  seconds cooked) and `boxTime`, the normalized `goldenWindow` (`start`/`end` in
  `[0, 1]` relative to `dish.stop`, widened by +35% under Gentle Timing), how
  the food looks (`frost` 1 to 0 by the frozen time; `steam` from then;
  `darkness` 0 to 1 from golden's end to burnt; `smoke` once burnt), `cooking`
  (the light on, the button held), `cooked`, the `zone` once it's dinged, the
  `hint` (the start line while ready, the frozen line while paused), and the
  message.
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
- Bubblegum Bay's fishing spot (`dock_end` in `content/story/main.ink`) opens
  once `sue_joined` is true (preserving the lasso bottle quest whenever
  `has_lasso and not has_map`) via `play: fish 0`, free. `state.arcade` is then
  `FishGame` (`src/core/fish.ts`, phases `aim`, `casting`, `waiting`, `bite`,
  `reeling`, `result`). During `aim`, cast power sweeps smoothly `0..1..0` over
  `aimPeriod` ticks via pure algebraic interpolation (`fishAimPower`); pressing
  Confirm rolls deterministic `castX`, `castY` (farther casts unlock rarer
  species), 1-2 nibbles, nibble gaps, and a weighted species from `fish.catches`
  (`minnow`, `perch`, `shell`, `koi`, `jelly`, `starfish`) in
  `content/arcade.json`, then arcs out over `castTicks`. During `waiting`,
  Cancel packs up cleanly, early Confirm ends with `lines.early`, and nibbles
  emit `fish-nibble` until the `bite` splash (`biteTicks`, widened by +20 ticks
  under Gentle Timing). Pressing Confirm during `bite` starts `reeling`: hold
  or tap Confirm to keep the catch zone (`zoneHalf`, widened by +0.08 with
  halved drain under Gentle Timing) over the deterministic swimming wave
  (`fishWavePosition`) until `reelProgress` reaches 1. Landing a catch awards
  the species' `coins` and `snacks`, records species counts in optional
  `state.caughtFish` (omitted when empty, validated alongside `treats` in save
  version 10), and shows the Catch Reveal card alongside the dialogue line.
- The fishing close-up (`src/ui/fish.ts`, laid out by `layoutFish` in
  `src/ui/fish-layout.ts`, loaded on demand in `bay`) renders the painted dock
  vista (`public/assets/arcade/fishing-dock.{webp,json}`, parsed by
  `parseFishCalibration`), the 6-item catch atlas (`public/assets/arcade/
  fish-catches.{png,json}`, built by `tools/art/build-fish.ts`), a live SVG
  wooden fishing rod, quadratic Bezier line, cork bobber, water ripples, and
  submerged fish shadow, plus the top-left Bubblegum Bay Catch Book (`N / 6`),
  touch-aware pack-up pill, Cast Power Gauge, Watercolor Reel-In Meter,
  `! BITE !` sticker, and 2-column Catch Reveal card. Its gallery states
  (`src/dev/fish-gallery.ts`) are `arcade-fish-aim`, `arcade-fish-reeling`, and
  `arcade-fish-catch`.
- Chef Mateo's Taco Truck Kitchen (`taco_chef_calm.mateo_shop` in
  `content/story/main.ink`, choice 1 `Help run the Taco Truck kitchen!`, keeping
  choice 0's 4-coin crispy taco snack unchanged) opens via `play: taco 0`, free.
  `state.arcade` is then `TacoGame` (`src/core/taco.ts`, phases `ready`,
  `serving`, `order-clear`, `result`). When opened, `newTaco` deterministically
  draws `orders` (3) distinct customers from `taco.customers` in
  `content/arcade.json` (parsed by `parseArcade` in
  `src/content/arcade-parsers.ts`) and 3 topping recipes (`orderSizes`
  `[3, 4, 5]`, capped at `[3, 4, 4]` under Gentle Timing) with no 3 identical
  toppings in a row. During `ready`, fresh `cancel` exits cleanly (`arcade:
  null`) and fresh `confirm` starts the lunch shift (`shiftTicks` 1080 = 18 s,
  widened to 1620 = 27 s under Gentle Timing). During `serving`, fresh
  directional edges map directly to the 4 toppings (`up` `beans`, `right`
  `cheese`, `down` `salsa`, `left` `avocado`): matching the next ticket step
  advances `stepIndex`, adds +10 score, and emits `taco-top`; a wrong topping
  increments `mistakes`, sets `oopsTicks` (20) for a gentle wobble without
  resetting progress, and emits `taco-oops`. Completing an order adds +25
  bonus, enters `order-clear` (`clearTicks` 42), and emits `taco-order`. Serving
  all 3 orders (or timing out) enters `result`, awarding `coinsPerOrder` (5)
  coins per order (+5 spotless bonus for 3/3 with 0 mistakes -> up to 20 coins)
  and 1 snack for 2+ orders or 2 snacks for a spotless 3/3 shift (emitting
  `prize-won` on spotless shifts alongside standard `coin` / `item` cues), while
  the soundtrack plays `"taco"` ("Mateo's Fiesta Truck", unducked over
  `"town-breeze"` ambience, fresh-starting at bar 1).
- The Taco Truck close-up (`src/ui/taco.ts`, laid out by `layoutTaco` in
  `src/ui/taco-layout.ts`, styled in `src/ui/taco.css`, loaded on demand in
  `hills` via `ensureTacoOverlay` in `src/shell/assets.ts`) renders the painted
  serving counter (`public/assets/arcade/taco-truck.{webp,json}`, parsed by
  `parseTacoCalibration`), the 6-item ingredient atlas
  (`public/assets/arcade/taco-ingredients.{webp,json}`: `shell`, `beans`,
  `cheese`, `salsa`, `avocado`, `lime`), the top-left hanging customer order
  ticket, top-right shift timer/orders/score pill (plus touch-aware Leave pill
  during `ready`), center live layered taco assembly on the woven placemat with
  star-lime garnish and `ORDER UP! ★` ribbon on clear, four direct-click /
  direct-tap painted topping bowls (`onPickTopping` via
  `createTacoToppingHandler`), and the bottom counter caption bar. Its gallery
  states (`src/dev/taco-gallery.ts`) are `arcade-taco-serving` and
  `arcade-taco-clear`; `renderInfo().arcade` reports `TacoInfo` (`game: "taco"`,
  `phase`, `stage`, `ticket`, `hud`, `shell`, `bowls`, `orderBanner`, `served`,
  `totalOrders`, `orderIndex`, `stepIndex`, `timeLeft`, `score`, `front`).
  Recorded run `new-game/taco.json` (`tools/sim/record-taco.ts`, chaining from
  `new-game/m81-festival.json`) plays a spotless 3/3 shift (`+20 coins`,
  `+2 snacks`) and is verified in `tests/unit/taco-replay.test.ts` and
  `tests/e2e/taco.spec.ts` (real keys + direct mouse bowl click `@smoke`).
- Direct mouse & touch pointer play across all 6 minigames (Milestones 127 and
  128): `createClaw`, `createFish`, `createCook`, `createSkee`, `createComet`,
  `createArcade`, and `createShellAssets` accept an optional
  `onConfirmHold?: (held: boolean) => void` callback bound via the shared
  sticky-proof `bindPointerHold` helper (`src/ui/pointer-hold.ts`), releasing
  automatically when hidden (`view === null`), on pointer end / lost capture,
  or on window blur. `createComet`, `createArcade`, and `createShellAssets`
  also accept an optional `onLaneStep?: (delta: -1 | 1) => void` callback
  wired to `touch.tapArrow({ x: delta, y: 0 })`: during `playing`, clicking or
  tapping `.comet-key.is-left` / `.comet-key.is-right` or the three horizontal
  lanes of `.comet-field` (`resolveCometLaneStep`) steps the rocket one lane
  toward the target, while pressing `.comet-machine` in `ready` or `result`
  emits confirm through `bindPointerHold`. Only the visible close-up stage
  (`.arcade-machine`, `.comet-machine` + `.comet-key`, `.fish-stage`,
  `.cook-machine`, `.skee-frame`, alongside Boop-a-Mole's clickable holes)
  enables `pointer-events: auto; cursor: pointer; touch-action: none;` so
  `.touch-controls` buttons outside each close-up remain unobstructed and
  gallery baselines stay pixel-identical.
- Minigame & UI micro-animation polish (Milestone 73, extended with
  `:root[data-reduced-motion="on"]` in-game parity and Safari/iOS press-and-hold
  `user-select: none; -webkit-user-select: none; -webkit-touch-callout: none;`
  hygiene in Milestone 140; all CSS transitions and keyframes guarded by both
  `@media (prefers-reduced-motion: reduce)` and `:root[data-reduced-motion="on"]`): Claw Machine
  tug wiggle and sliding/returning pendulum tilt; Skee-Ball contact shadow
  lifting while hopping and bouncy `.skee-pop` entrance; Boop-a-Mole boop squash
  (via CSS `scale` without clobbering `translateY`) and bouncy `.mole-pop`
  entrance; Comet Cruise scrolling starfield during live `playing` and bumped
  rocket glow/wobble (paused in `.gallery-body` so gallery measurements stay
  exact); Clubhouse Microwave deterministic turntable oval sway while cooking
  and celebratory pop on `ding`; smooth choice/command/title transitions,
  `.touch-button:active` tactile squash, and subtle inner-label float on
  `.sticker-prompt` keeping its arrow tip anchored. Universal desktop tactile
  hover feedback (`@media (hover: hover) and (pointer: fine)` so touch devices
  never stick) and WCAG 2.4.7 `:focus-visible` rings (`3px solid #6b9e56`) apply
  across Title (`src/ui/title.css`), Dialogue (`src/ui/sticker.css`), Battle
  (`src/ui/battle.css`), and Journal (`src/ui/journal.css`) with zero resting
  pixel changes and full `@media (prefers-reduced-motion: reduce)` +
  `:root[data-reduced-motion="on"]` hover-transform suppression parity
  (Milestone 169).
- Tactile Minigame Personal Bests & Die-Cut Arcade Score Popups (Milestone 112,
  extended to Clubhouse Microwave in Milestone 118, Claw Machine popups in
  Milestone 137, and Chef Mateo's Taco Truck Kitchen personal bests in
  Milestone 163):
  persistent local personal bests (`src/platform/minigame-records.ts`, stored
  outside the save slot via `@capacitor/preferences` under
  `"cloverhollow-records"` with keys `skee`, `mole`, `comet`, consecutive
  fishing catch streak `fish`, cumulative Golden Dishes cooked `cook`, and Taco
  Truck Kitchen high score `taco`, cleanly upgrading legacy 4-key and 5-key
  JSON with `cook: 0` / `taco: 0`; zero `src/core` changes and zero save-version
  bump) and live Paper-Mario die-cut arcade score popups (`src/ui/arcade-popups.ts`
  and `src/ui/arcade-popups.css`). Pure classifiers (`classifySkeePopup`,
  `classifyMolePopup`, `classifyCometPopup`, `classifyFishPopup`,
  `classifyCookPopup`, `classifyClawPopup`, `classifyTacoPopup`) stay silent on
  initial open, reset, or static `ui-gallery` renders, and spawn crisp
  `#47321f`-inked `.arcade-popup` pills (`+N`, `+50!`, `+100 ★!`, `BOOP! +2`,
  `★ +1`, `NICE CATCH!`, `★ RARE!`, `★ GOLDEN!`, `GOT IT! ★`, `TUG!`,
  `★ PRIZE!`, `ORDER UP! ★`, `★ SPOTLESS!`) in the upper-right margin inside
  `.arcade-popups` (`aria-live="polite"`, `aria-atomic="false"`, Milestone 138)
  on live gains or minigame clear/prize transitions.
  When a live round enters `phase === "result"`, the minigame renders a die-cut
  `.arcade-best-badge` pill (`★ NEW BEST! <best>` in gold when beating a
  non-zero record, or `Best: <best>` in warm cream otherwise) in the vacated
  HUD/escape slot (centered on the mint bezel above the glass in `src/ui/cook.ts`
  and centered on the striped awning header in `src/ui/taco.ts`);
  static gallery callers omit the optional second `record`
  argument so gallery baselines stay pixel-identical. All popup and badge
  animations respect both `@media (prefers-reduced-motion: reduce)` and
  `:root[data-reduced-motion="on"]`.
- Minigame `Cancel` (`X` / `Escape` / Gamepad `B`) exit ergonomics
  (`src/core/{claw,skee,mole,comet,cook,fish}.ts`, Milestone 141): across all
  six minigames, a fresh `cancel` edge press during `phase === "result"`
  matches `confirm` (finishing any still-typing reveal line first, then
  closing the minigame cleanly). In the free Clubhouse Microwave (`cook`), a
  fresh `cancel` edge press during `phase === "ready"` also closes the
  microwave cleanly without cooking (matching free Bubblegum Bay Fishing's
  `aim` / `waiting` cancel exit), while paid arcade machines (`claw`, `skee`,
  `mole`, `comet`) never exit on `ready` so players cannot accidentally forfeit
  spent coins.

## 9. Journal and stickers
- Experience is saved as XP for Fae and each party member. A member's level is
  read from `content/levels.json` (cap 99), and the journal presents level, XP
 progress, Power, Magic, Life (5 at level 1, +1 every 3 levels), and Guard;
 friends show their Power and Magic command stats.
- The Milestone 66 balance route is deliberately careful rather than a grind:
  Fae calms each recurring critter that chases her once per visit on the story
  route. The headless balance check requires ordinary area critters to be within
  one level of Fae on arrival, and named encounters (mini-bosses and the hooded
  kid) to be no more than two levels ahead. There are no chapter-end exemptions.
- The journal is the pause menu: Notes (current goals, written from Ink), a
  Sticker album, and a painted MAP page. The map labels all seven lands, shows
  `???` only for lands with an unmet `revealVariable` (currently the Hills and
  sealed Enchanted Forest), puts a bobbing gold star over Fae's current land,
  and leads each
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
  twenty-four stickers, one per species and one per mini-boss, in twenty-four
  slots, the town's four first.
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
  a cookie (inline SVG, like the map's bus-stop sign). Once Fae has found at
  least one Star Gem (`starGemsFound(world, state).found > 0`), a pale lavender
  `Gems N/7` button pill (`button.journal-supply.journal-gems` with the faceted
  amethyst `gemIconSvg` from `src/ui/icons.ts`, pixel-identical at rest with
  `@media (hover: hover) and (pointer: fine)` lift and WCAG `:focus-visible`
  ring) appears beside Coins and Snacks on a dedicated second pill row under
  NOTES while the audio controls stay on the first row; when 0 gems are found,
  the pill is hidden and the original single-row heading layout is preserved.
  Clicking or activating `.journal-gems` (keyboard `Enter`/`Space`, gamepad `A`,
  mouse, or touch) opens the die-cut **Star Gem Field Ledger** modal
  (`src/ui/journal-gems-ledger.ts`, composed into `createJournalFieldOverlays`
  in `src/ui/journal-field-note.ts` and backed by pure `journalStarGems` /
  `StarGemId` / `StarGemEntry` in `src/core/journal.ts`, Milestone 171) listing
  all 7 valley Star Gems (`Amethyst`, `Aqua`, `Citrine`, `Frost`, `Prism`,
  `Amber`, `Clover`) in canonical `STAR_GEM_VARIABLES` order with faceted
  jewel-tinted SVG icons (zero `<text>` nodes), found locations/notes for
  collected gems, Grandpa Barnaby's gentle italic field hints for undiscovered
  gems, a `N/7` or golden `★ 7/7 COMPLETE!` header badge, and clean dismiss on
  backdrop click, `×` close button (44×44 px), `Escape`, `X`, or Gamepad `B`
  restoring focus directly to `.journal-gems` and playing `card-open` /
  `card-close` UI foley via `onOverlayChange`.
- A chunky four-step sound volume slider sits beside the `♪ on/off` pill and
  fits the heading row at 874x402, including with `♪ off` and 999 coins. At
  narrow widths, the supplies wrap beneath NOTES so every control remains
  inside the page without overlapping its neighbors.
- A cream JOURNAL label sits on the top edge and a close sticker (at least
  44 px) in the top-right corner; the close button is how touch players leave.
- Bookmark tabs (at least 44 px, stacked in a non-overlapping flex column clear
  of the close sticker) flip between NOTES, MAP, and OPTIONS. The journal opens
  on notes; ArrowLeft/ArrowRight and A/D step between pages without stealing
  arrow keys from any focused volume slider.
- The painted MAP page (extracted cleanly into `src/ui/journal-map.ts` via
  `createJournalMapPage`, `busRoutePath`, and `busStopIcon`, Milestone 123)
  overlays hand-drawn SVG bus routes (`mapBusRoutes` in
  `src/core/journal.ts`, dashed sky-blue with cream halo when open, subtle
  dashed ink when locked) connecting the three bus-stop lands, shows crisp `✓`
  completion badges beside revealed lands whose discoverable stickers are all
  owned (`landStickerProgress` in `src/core/journal.ts`), and sits above a
  compact footer strip displaying the active or clicked/hovered land's sticker
  progress alongside total Stickers, total Prizes, and the Bus legend (and when
  `valleyCompletion` in `src/core/journal.ts` reaches 100%, a gleaming golden
  `.journal-master-crest` pill `"★ 100% Valley Explorer!"` prepended to
  `.journal-map-summary` with `#ffe68a` fill, `#c98f22` inner accent, and
  `#47321f` ink, detached whenever below 100%, Milestone 120; under
  `.journal-map-footer.has-master-crest`, the footer wraps cleanly so
  `.journal-map-detail` never truncates beside the 7 completion pills,
  Milestone 121). Clicking
  or hovering any revealed land pin enriches the footer detail line with
  `landFieldGuide` (`src/core/journal.ts`, Milestone 110): sticker progress,
  Star Gem status (`★ Gem` / `◇ Gem` once any Star Gem is found or `gem_quest`
  is active), Star-Line bus stop status (`cloverhollow`, `bay`, `pass`), and
  iconic land highlights (with expansion highlights `Sanctuary & Taco Truck` for
  `hills` and `Lodge, Summit & Cavern` for `pass`, keeping `bay` as
  `Fishing, Boats & Cottage`, Milestone 165), while keeping the default
  un-selected `"Here: ..."` line unchanged.
- The OPTIONS spread (extracted into `src/ui/journal-options.ts` via
  `createJournalOptionsPage`, with `journalControlsLines`, `formatJukeboxLabel`,
  `JournalControlsTools`, `JournalControlsLines`, `JournalInputMode`, and
  `JukeboxMeta` re-exported from `src/ui/journal.ts`, Milestone 146) is a
  two-page open-book layout matching NOTES/STICKERS:
  the left page (`SOUND & MUSIC`) shows the interactive Music Box pill
  (`.journal-jukebox`: `role="group"`, 44 px `‹` `.journal-jukebox-prev` and `›`
  `.journal-jukebox-next` buttons flanking the interactive `.journal-now-playing`
  button, `♫ <title>`, cycling all 24 `jukeboxTracks` unducked while the journal
  is open; focusing `.journal-jukebox` or any button inside it scrubs tracks with
  `ArrowLeft` / `ArrowRight` without flipping journal pages, exposes the active
  track index in `aria-label` / `title` via `formatJukeboxLabel`, and clicking or
  pressing `Enter` / `Space` on `.journal-now-playing` while previewing resets
  smoothly to the live area theme via `onResetJukebox`, as does closing the
  journal) and touch-sized (>= 44 px)
  controls for Sound Effects (on/off + volume slider), Music (on/off + volume
  slider), and Ambience (on/off); the right page (`GAMEPLAY`) shows touch-sized
  controls for Gentle Timing, Key Hints, Text Speed (`Cozy` / `Brisk` /
  `Instant`), and Reduced Motion (`Off` / `On`, stored under
  `cloverhollow-settings`, upgrading legacy preferences cleanly) above a compact
  adaptive Controls reference card (`journalControlsLines` in
  `src/ui/journal-options.ts`, re-exported from `src/ui/journal.ts`,
  Milestone 122 / Milestone 146): in default `"keyboard"` mode it displays
  `Move: Arrows / WASD · Talk: Z · Journal: J · Mute: M` plus unlocked tools
  (`Lantern: L`, `Flute: F`, `Lasso: R`); when a gamepad is active (`"gamepad"`
  mode) it switches cleanly to
  `Move: Stick / D-Pad · Talk: A · Back: B · Journal: Y` plus unlocked tools
  (`Lantern: X`, `Flute: RB`, `Lasso: LB`) and `Photo / Guide: View`. On touch
  devices (`:root[data-touch="on"]`) when `canPhotoFromJournal` is true
  (Milestone 154), `.journal-controls-card.has-photo` replaces the desktop
  keyboard-shortcut text lines with a 44 px tall warm-cream `#fbf6e8` die-cut
  `.journal-photo-btn` pill (`aria-label="Enter Photo Mode"`, shared
  `cameraIcon()` SVG + `"Photo Mode"`, dark-ink `#47321f` border/text, full
  `prefers-reduced-motion` + `:root[data-reduced-motion="on"]` guards and
  iOS/Safari tap-selection hygiene); on desktop and in `ui-gallery` it stays
  `display: none` and skipped by `isElementVisible` during keyboard/gamepad
  focus cycling. Both pages
  fit without scrolling or overlap at 667x375, 874x402, 1180x820, and 1280x720
  (switching Gameplay into a 2x2 touch tile grid at `max-height: 500px`).
  While the Journal is open (outside Title / QA overlays), pressing `[` /
  `PageUp` or `]` / `PageDown`, or Gamepad `LB` (button 4) / `RB` (button 5),
  cycles tabs with wrap-around via `stepJournalPage` / `journal.stepPage`
  (`notes` -> `map` -> `options` -> `notes`), closes any open Field Note or
  Field Treasures card, and plays the in-key `choice-move` page-flip ping
  without intercepting `ArrowLeft` / `ArrowRight` slider navigation.
- **Full Keyboard & Gamepad Journal Navigation** (Milestone 124 / Milestone 148,
  `src/ui/journal-nav.ts`, `src/ui/journal.ts`, `src/ui/journal-map.ts`,
  `src/platform/gamepad.ts`, `src/main.ts`): while the Journal is open with no
  field modal overlay, `journal.scrollActivePage`, `journal.navigateFocus`, and
  `journal.activateFocused` provide mouse-free navigation across all three tabs
  using pure `cycleIndex`, `computeJournalScrollDelta`, `pickNotesScrollTarget`,
  and `isElementVisible`:
  - `NOTES` / `STICKERS`: `.journal-notes-page` is keyboard focusable
    (`tabindex="0"`, `aria-label="Journal notes"`, crisp `:focus-visible`
    outline with zero resting pixel change). `ArrowDown` / `ArrowUp` (when no
    inspectable slot is focused) and Gamepad right stick Y route vertical
    scrolling through `pickNotesScrollTarget` (`scrollActivePage`), scrolling
    `.journal-stickers-page` first and seamlessly continuing into
    `.journal-notes-page` once `.journal-stickers-page` reaches its top/bottom
    limit (or immediately when `.journal-stickers-page` does not overflow), or
    preferring `.journal-notes-page` when focus is inside it. Pressing
    `Shift+ArrowDown` / `Shift+ArrowUp` anywhere on the `NOTES` spread, or
    plain `ArrowDown` / `ArrowUp` while `.journal-notes-page` has focus,
    scrolls `.journal-notes-page` directly by `±72 px` while keeping Fae
    frozen. Focusing any `.journal-slot.is-inspectable` (or pressing Gamepad
    D-Pad / Left Stick) cycles focus across visible Critter, Arcade Prize,
    Fish, and Keepsake slots (`Enter` / `Space` / `A` opens the Field Note
    card).
  - `MAP`: revealed land pins (`.journal-map-land.is-revealed`) are keyboard
    focusable (`tabindex="0"`, `role="button"`) with crisp `:focus-visible`
    outlines; `ArrowUp` / `ArrowDown` (and `ArrowLeft` / `ArrowRight` once a
    map pin or `.journal-treasures-btn` has focus, or Gamepad D-Pad / Left Stick
    in any direction) steps across revealed Land Guide pins and the visible
    Field Treasures button via `mapPage.stepLandFocus`, immediately updating
    `.journal-map-detail` and playing the wooden-marimba `"title-move"` pin-select
    foley + `"light"` haptic via `onSelectLand` / `journal.onMapSelect` (also
    fired when clicking a revealed land pin, Milestone 169), while `ArrowLeft` /
    `ArrowRight` with no map pin focused keeps tab-flipping compatibility.
  - `OPTIONS`: `ArrowUp` / `ArrowDown` (skipping focused volume sliders so
    existing ARIA slider adjustment stays intact) and Gamepad D-Pad / Left Stick
    cycle visible option buttons (`scrollIntoView({ block: "nearest" })`);
    `ArrowLeft` / `ArrowRight` step focused sliders or scrub Music Box tracks;
    `Enter` / `Space` / Gamepad `A` activates the focused control cleanly.
- **Interactive Field Treasures Card** (`treasuresSummary` in
  `src/core/treasures.ts`, `src/ui/journal-field-note.ts` mounted by
  `src/ui/journal.ts`): summarizes Fae's Star-Line
  Stamp Card (`buster_quest`, `stamp_bay`, `stamp_pass`, `buster_reward`),
  all thirteen Clubhouse Keepsakes (`star-crystal`, `star-pin`, `star-geode`,
  `moon-feather`, `taco-badge`, `clover-wreath`, `sea-compass`, `alpine-clover`,
  `star-whistle`, `loft-sketch`, `aurora-rubbing`, `shell-shard`,
  `festival-ribbon`), and all six Bubblegum Bay Catch
  Book species (`world.arcade.fish.catches` vs `state.caughtFish`). When
  `hasAny` is true, a golden clickable `Treasures · N/13` pill
  (`.journal-treasures-btn`) appears in the MAP page footer beside Stickers and
  Prizes (hidden when `hasAny` is false so early-game MAP baselines stay
  untouched). Clicking it opens the Field Treasures Card modal
  (`.journal-treasures-card`) inside `.journal-book`; clicking its 44 px `×`
  button, clicking the backdrop, pressing Escape (which stops propagation so the
  Journal stays open), pressing `cancel` (`X`, gamepad `B`, or touch `×`, which
  dismisses the open overlay via `journal.dismissOverlay()`, swallows `cancel`
  for that tick, plays `choice-move`, and keeps the Journal open until the next
  `cancel` press, Milestone 117), switching tabs, or closing the Journal
  dismisses it.
- Optional desktop Key Hints ribbon (`src/ui/hud-hints.ts`): when Key Hints is
  enabled on non-touch desktop/gamepad setups, a cream die-cut ribbon anchored
  in the bottom-left safe area (`--z-hud`) shows keycap pills for Journal
  (`J` / `Y`), context-aware Confirm (`Z` / `A`, resolved via
  `resolveHudInteractHint`: active interactable prompt or `Talk`, `Stand` while
  resting, `Pet` when actively facing a pettable companion with forward dot
  `>= 0.15`, `Rest` at a rest spot, or inactive `Talk`), Lantern (`L` / `X`,
  shown once unlocked and glowing lavender when lit), Flute (`F` / `RB`, shown
  once unlocked), Mute (`M`), and Photo (`P` / `View`, `[data-hint="photo"]`,
  shown beside Mute whenever `canPhoto` is true in the free overworld outside
  Photo Mode). During battle `command` phase (outside the treat tray and touch
  mode) with Key Hints enabled, a single compact die-cut pill
  (`.hud-battle-hint`, `[data-hint="battle-guide"]`: `I` / `View` `Field
  Guide`, resolved via `resolveHudHintVisibility`) docks cleanly at bottom-right
  clear of commands, dialogue, portraits, and the Field Guide Peek card. Key
  badges (including `photo` and `guide`, Milestone 135) adapt automatically
  between `"keyboard"` and `"gamepad"` via
  `hudHintKeys(mode)` (defaulting to `"keyboard"`, switching to `"gamepad"` on
  standard-pad activity and back to `"keyboard"` on real keydowns, Milestone
  117). Every visible `.hud-hint` pill and `.hud-battle-hint` is directly
  clickable and keyboard-activatable (`HudHintAction`, `onAction`,
  `role="button"`, `tabindex="0"`, synced `aria-label`, click + `Enter`/`Space`
  with propagation stopped so clicks never trigger canvas steering, Milestone
  130), letting one-handed mouse/trackpad players open Journal, interact
  (`Talk`/`Pet`/`Rest`/`Stand`), toggle Lantern/Flute/Mute, enter Photo Mode,
  and toggle the Battle Field Guide while keeping identical visual geometry.
  Both hide automatically when Key Hints is off or during touch mode,
  title, dialogue, arcade, journal, credits, or QA overlays.
- `data-journal="open"` hides all touch controls while the book is open.
- The touch menu button is the JOURNAL sticker from the concept sheet: an open
  book with a teal quill (inline SVG, aria-label "journal").
- Shared pieces (`src/ui/atlas.ts`, `.die-cut` in sticker.css): atlas frames
  resolve their image file from `meta.image` via `atlasImagePath` (falling back
  to `.png` when absent), are cropped with percentage backgrounds, exact at any
  box size, and the die-cut rim is stacked hard drop-shadows that follow the
  image's silhouette. The reward card uses both.
- Backpack Treats Strip: when Fae carries one or more specialty treats
  (`carriedTreats`), a dashed cream strip (`.journal-treats-strip`) renders
  below the `NOTES` heading row showing each carried treat pill (`<Name> ×N`).
  When Fae carries no specialty treats, the strip stays hidden.
- Interactive Journal Critter Compendium (`critterFieldNote` in
  `src/core/journal.ts`, modal DOM and `fieldNoteBlurb` in
  `src/ui/journal-field-note.ts`): every owned sticker slot in `.journal-stickers` is
  clickable and keyboard-focusable (`role="button"`, `tabindex="0"`, Enter/Space
  or click/tap). Selecting an owned sticker opens a die-cut Field Note Card
  (`.journal-field-note`) centered inside `.journal-book` (max 520 px wide,
  warm paper gradient, dotted divider, reduced-motion-guarded spring pop-in),
  showing its calm portrait grounded on a circular sage-cream watercolor
  specimen wash with dashed collector ring, name, `Lv N · <chaosName>`, a
  golden `★ Old Friend` ribbon when recurring and `calms >= 3`, revealed lands
  where it lives, calm count, inline SVG feeling pills, individual coral-cream
  heart pills for each favourite treat, and a short 1-line naturalist caption.
  Dismissing via its 44 px `×` button, clicking the backdrop, pressing Escape
  (which stops propagation so the journal stays open), switching tabs, or
  closing the journal closes the card.
- The STICKERS page continues below the album with a PRIZES shelf from
  `world.arcade.prizes`. Owned prizes use the prize atlas frame, die-cut rim,
  and name; unowned prizes are dashed `?` slots without names. The shelf is
  part of the page scroll on phones.
  The shelf has a slot a prize: the claw machine's nine plushes, then the
  ticket counter's four toys. The PRIZES heading carries Fae's tickets in a
  pill like the notes page's Coins and Snacks (an orange ticket and the
  count, Milestone 45).
- **Journal Arcade Records Strip** (Milestone 116, `formatArcadeRecordPills` in
  `src/platform/minigame-records.ts`): attached directly below `.journal-prizes`
  on the right page of `NOTES` (`role="region"`, `aria-label="Arcade and fishing
  records"`, `.journal-records-strip`) only when at least one local minigame
  personal best is `> 0` (omitted when all six are `0` so fresh Journal layouts
  stay unchanged). Displays a warm-gold `BESTS` label and rounded pastel pills
  in canonical order (`★ Skee-Ball · N`, `★ Boop-a-Mole · N boops`, `★ Comet
  Cruise · N stars`, `★ Fishing Streak · N`, `★ Golden Dishes · N`,
  `★ Taco Truck · N pts`) with
  `>= 8.5:1` `#47321f` ink
  contrast and zero horizontal overflow across desktop and phone viewports.
- Complete Journal Collection Showcase (Milestone 94, pure helpers
  `journalKeepsakes`, `journalFish`, `journalProgress` in `src/core/journal.ts`
  with zero save-format or replay-hash shifts):
  - **Fish Catch Book shelf**: attached below `PRIZES` only once Fae has caught
    at least one Bubblegum Bay species (`journalFish(world, state)`). Displays
    `.journal-fish-heading` (`FISH`, `N/6` count badge, and golden
    `★ Complete!` ribbon when all 6 are caught) above a 3-column `.journal-fish`
    grid showing lazily decoded catch frames from `assets/arcade/fish-catches.json`
    via `atlasImagePath` (zero boot decode when 0 fish are caught) or dashed `?`
    for uncaught species, with a warm gold highlight on caught rare catches
    (`Moonlight Jelly`, `Golden Starfish Crown`).
  - **13 Keepsakes Gallery shelf**: attached below `FISH` (or `PRIZES`) only once
    at least one keepsake is owned (`journalKeepsakes(world, state)`:
    `star-crystal`, `star-pin`, `star-geode`, `moon-feather`, `taco-badge`,
    `clover-wreath`, `sea-compass`, `alpine-clover`, `star-whistle`,
    `loft-sketch`, `aurora-rubbing`, `shell-shard`, `festival-ribbon`). Displays
    `.journal-keepsakes-heading` (`KEEPSAKES`, `N/13` count badge, and golden
    `★ Complete!` ribbon when all 13 are unlocked; `scroll-margin-top: 8px;
    padding-top: 8px` on `.journal-fish-heading` and `.journal-keepsakes-heading`
    so pill borders stay clear of the top scroll edge) above a 4-column
    `.journal-keepsakes` grid rendering hand-crafted inline SVG charms
    (`keepsakeIcon` in `src/ui/icons.ts`, zero `<text>` nodes) + names for owned
    keepsakes or dashed `?` for locked keepsakes.
  - **Interactive Collection Field Note Cards (all 4 shelves: Critters, Arcade
    Prizes, Fish, and Keepsakes)**: owned slots in `.journal-stickers`,
    `.journal-prizes`, `.journal-fish`, and `.journal-keepsakes` are clickable
    and keyboard-focusable (`role="button"`, `tabindex="0"`, Enter/Space or
    click/tap, subtle reduced-motion-guarded hover/focus lift) and reuse the
    die-cut `.journal-field-note` card centered inside `.journal-book`
    (`Escape`, `X`, Gamepad `B`, `×`, backdrop click, tab switch, or closing
    the journal dismisses only the card and fires `"card-open"` /
    `"card-close"` paper foley):
    - Owned Arcade Prizes (`kind: "prize"`, `prizeFieldNote` in
      `src/ui/journal-field-note.ts`, `data-prize`, `data-owned`,
      `aria-label="Inspect <Name> prize note"`, Milestone 143): displays the
      prize's zoomed `AtlasImage` via `applyAtlasCrop`, name,
      `"Arcade Prize"`, `Found: <origin>` (`"Claw Machine · Mr. Pip's Arcade"`
      for the 9 claw plushies, `"Ticket Counter · Mr. Pip's Arcade"` for the 4
      counter toys, with graceful fallback for unknown IDs),
      `Home: Clubhouse Shelf`, and a bespoke storybook `blurb`. Unowned prizes
      remain non-inspectable `?` slots, and losing ownership closes an active
      prize card cleanly.
    - Caught Fish (`kind: "fish"`): displays the fish's `AtlasImage` (with a
      golden specimen ring when `rare`), name, `"Bubblegum Bay · Rare Catch"`
      or `"Bubblegum Bay · Bay Catch"`, `Found in: Bubblegum Bay Dock`,
      `Reward: +<coins> coins` (with `, +<snacks> snack` when `snacks > 0`),
      and Fae's 1-line catch note (`JournalFish.blurb`).
    - Owned Keepsakes (`kind: "keepsake"`): displays a large inline SVG charm
      (`keepsakeIcon` in `.journal-field-charm`), name, `"Clubhouse Keepsake"`,
      `Found in: <source>`, `Displayed: <displaySpot>`, and Fae's 1-line
      memory (`JournalKeepsake.memory`).
    - **Interactive Scrapbook Specimen Browser** (Milestone 146, pure
      `inspectableShelfIds` & `stepInspectedItem` in `src/ui/journal-field-note.ts`,
      wired via `journal.stepOverlay` / `journal.onOverlayStep` and
      `src/shell/input-shortcuts.ts`): when at least 2 inspectable entries are
      owned on the open card's shelf (`sticker`, `prize`, `fish`, or
      `keepsake`), a compact storybook pager (`.journal-field-pager`: `‹`
      `.journal-field-prev`, `aria-live="polite"` `.journal-field-counter`
      showing `1 / N`, and `›` `.journal-field-next`, hidden whenever fewer than
      2 entries are owned) renders beneath the specimen portrait / `Old Friend`
      pill. Clicking `‹` / `›`, pressing `ArrowLeft` / `ArrowRight`, or flicking
      Gamepad D-Pad / Left Stick Left or Right flips directly across owned
      entries on that shelf with wrap-around, firing `"page-turn"` foley and a
      light haptic without leaving the card.
    - **WCAG 2.4.3 Modal Focus Management & Browse-Synced Restoration**
      (Milestone 155, pure `focusRestoreSelector` in
      `src/ui/journal-field-note.ts`, `data-sticker` on sticker slots in
      `src/ui/journal.ts`): `.journal-field-note` and `.journal-treasures-card`
      carry `tabindex="-1"` while preserving their 2 px storybook ink outline on
      focus (zero browser ring or pixel shift). User opening moves focus into
      the active dialog card (`preventScroll: true`), and user dismissal (`×`,
      backdrop click, `Escape`, `X`, Gamepad `B`, skipping programmatic clears
      on Journal close or tab switch) restores focus directly onto the
      currently inspected entry's visible slot via `focusRestoreSelector` (e.g.
      browsing `Frog Plush` -> `Pup Plush` with `ArrowRight` restores focus
      onto `[data-prize="pup-plush"]`), falling back to the saved trigger
      element if still connected and visible. `.journal-treasures-card`
      similarly saves and restores focus to its trigger button on dismissal.
  - **Completion Ribbons & MAP Footer Pills**: `STICKERS` and `PRIZES` headings
    also show the golden `★ Complete!` ribbon once every entry in their shelf is
    owned. The MAP footer dynamically attaches `Fish N/6` and `Keepsakes N/13`
    pills whenever their owned count is greater than 0 (detached at 0).

## 10. Save and load
- One slot, key `cloverhollow-save`, stored with `@capacitor/preferences`:
  UserDefaults on iOS (which iOS doesn't clear the way it can clear web
  storage) and localStorage in the browser.
- Format: `{ version: 10, state }`, the whole core state, including the
  serialized Ink state (story variables and choices), the party, stickers,
  the set pieces' moods, this visit's recurring critters, the calm counts,
  the lantern, coins and snacks, optional specialty `treats` (omitted when
  empty so saves without treats remain bit-identical at version 10; validated
  when present as a record of valid treat ids with integer counts `1..99`), the
  PRNG, the tick, arcade state, prizes,
  XP and the party's XP are included. Version 1 (Maddie in `maddie` and
  `trail`), version 2 (no lantern), version 3 (no coins or snacks), and
  version 4 (one critter of each kind, no recurring critters) are refused and
  start a new game. Loading restores it exactly: the state hash matches, and
  `stableHash` skips undefined values (as JSON does) so a state and its saved
  copy hash the same.
- Older saves upgrade, gaining what later versions added as a new game
  starts it: version 5 `arcade: null`, `prizes: []`, `tickets: 0`, and
  `calms: {}`; version 6 `tickets: 0` and `calms: {}` (Milestone 45); version
  7 `calms: {}` (counted from then on); version 8 `finale: null` (Milestone
  56). Version 9 upgrades calm counts to XP using the current critter table and
  starts friends at Fae's resulting level. Before version 8 every recurring
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
  In live unpaused gameplay outside QA packs, title, and the harness room, a
  successful autosave displays a compact non-blocking die-cut quill pill
  (`createSaveToast` in `src/ui/save-toast.ts`, `"Saved"`, bottom-right on
  desktop and bottom-center on touch devices under `data-touch="on"` so it
  never overlaps the bottom-right `✓`/`×` buttons, auto-hiding after 1800 ms,
  respecting reduced motion, and hidden during photo, battle, journal, title,
  and credits overlays).
- Resilient save storage queue (`createSaveStore` & `shouldShowSaveToast` in
  `src/shell/save-storage.ts`, Milestone 122): wraps Capacitor `Preferences`
  behind an injectable `SaveStorageAdapter` (`{ get, set, remove }`) and
  serializes concurrent `write()` and `clear()` operations on a strict FIFO
  queue that always recovers from errors. A rejected `set()` (e.g. Safari
  Private Mode or storage quota failure) resolves to `false`, leaves `last()`
  untouched, suppresses the `"Saved"` toast, and never poisons subsequent saves;
  a rejected `get()` returns `null` cleanly, and `clear()` resets `last()` even
  if `remove()` rejects.
- Shared resilient preference store (`createPreferenceStore` in
  `src/platform/preference-store.ts`, Milestone 125): wraps a single
  `@capacitor/preferences` key behind an injectable `PreferenceAdapter`
  (`{ get, set }`), serializes writes on a self-recovering FIFO queue (so a
  rejected `set()` returns `false` without poisoning future writes), and always
  marks `isLoaded() === true` even if `get()` rejects (delivering `null`
  cleanly). Used by `src/platform/audio.ts` (`cloverhollow-audio`),
  `src/platform/game-settings.ts` (`cloverhollow-settings`), and
  `src/platform/minigame-records.ts` (`cloverhollow-records`).
- Tab/iOS background lifecycle and `pagehide` flush (`src/shell/lifecycle.ts`,
  Milestone 119): `shouldFreezeLiveLoop` pauses live fixed-timestep ticking,
  drops elapsed accumulator time, and avoids background WebGL redraws while
  `document.hidden` during unpaused play (or while an area loads) without
  affecting paused harness stepping. On `visibilitychange` when hidden, the
  shell clears held keys (`Keyboard.clearAll()`), gamepad taps, and touch
  arrows, resets the accumulator, and (along with `pagehide`) flushes a quiet
  autosave without showing the save toast whenever `shouldFlushSaveOnHide`
  confirms eligible unsaved live overworld progress (never in QA mode, title,
  harness, finale/credits, or mid-battle/arcade). On returning visible, the
  ticker clock resets cleanly and queues a fresh draw.
- Boot: a valid save resumes the game; otherwise a new game starts.
- Portable save backup envelope (`src/shell/save-backup.ts`, Milestone 132):
  pure export/import helpers wrapping `serializeSave` without bumping the core
  save version (`SaveBackupEnvelope` with `app: "wilds-of-cloverhollow"`,
  `format: 1`, `exportedAt`, `area`, `areaName`, `stickers`, `save`),
  `saveBackupFilename(area, tick)` sanitizing area ids to lowercase
  `[a-z0-9-]`, `formatSaveBackup(state, world, exportedAtIso)` emitting
  pretty-printed JSON, and `parseSaveBackup(raw, fresh, speciesXp, thresholds)`
  strictly validating either a `SaveBackupEnvelope` or a raw `serializeSave`
  JSON string via `parseSave` and returning `null` (never throwing) on any
  malformed, unknown-app, unknown-format, or corrupted payload.
- QA mode never reads or writes `cloverhollow-save` and never autosaves. QA
  packs are separate files in the dev/harness-only save library; movement,
  doors, and ending events cannot change the player's slot. Opening the QA
  console during normal live gameplay leaves `cloverhollow-save` untouched;
  applying any state-mutating cheat outside an active pack activates a synthetic
  `Sandbox` pack (`QA · Sandbox`), immediately blocking autosave and writes to
  `cloverhollow-save`. Switching to a QA pack or saved QA slot from inside the
  console loads it cleanly in-place without touching the player's slot. The QA
  menu can be cancelled back to the prior title mode, and a harness fixture
  reset clears the active pack and badge. The console's `save` command (section
  11) keeps slots under `cloverhollow-qa-save:<name>`, indexed by
  `cloverhollow-qa-slots`, never inside the player's key.
- `tools/qa/build-saves.ts` is the only writer of the save library: it cuts
  story packs from the golden path's recorded runs (Milestone 68, one
  continuous story from a new game to the credits) and setup packs from a QA
  fixture's first tick. `just check` fails when a pack or
  `content/qa/saves.json` differs from what it writes, or when a pack file has
  no spec there.

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
    2026-10-18), and warms none either (2026-11-23): the door fade's prefetch
    (section 4, transitions) belongs to the real-time loop, and a replay
    warming every room it crossed left each one's decoded art in the Assets
    cache with no swap to unload it, minutes of cost in CI's software-rendered
    WebKit. If the step left its first area at any tick, the last is loaded
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
    restored at boot, or null for a new game; optional `exportBackup()` formats
    the active state as a `SaveBackupEnvelope` JSON string and optional
    `importBackup(raw)` validates, persists, and reloads a backup envelope or
    raw save string (returning `false` on invalid input or in QA mode).
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
    authored 0..1000 square. For Echo it is `{ kind: "echo", side, x, y,
    hintAt }` in CSS px. `marks` lists the recurring critters' "?" and "!" as
    `{ key, mark, x, y }`, each at its sticker's bottom centre in CSS px
    (Milestone 51). `finale` is the core's `finale` (`null`, `morning`, or
    `credits`); `credits` is `{ entries }` while the credits show (each
    `{ section, name, image }`, from `creditEntries`, section 7.4), otherwise
    null (Milestone 56). `timeOfDay` reports the active `TimeOfDayPhase`, and
    `photoMode` reports whether Photo Mode is active (`settings.photoMode` /
    `settings.setPhotoMode` expose the same flag on the dev hook).
- While dialogue is open, HTML carries `data-dialogue="open"`; movement, doors,
  cancel, and menu are ignored. Confirm reveals the current line, advances it,
  or selects the highlighted choice. Up/down edges wrap the selection.
- The QA console (Milestone 67, upgraded to a unified tabbed storybook GUI),
  dev and harness builds only: built lazily on first open so its DOM never sits
  on the page while unused. Backquote (`` ` ``) toggles it during gameplay
  (normal or QA mode); holding `Q` (`KeyQ`) for `500 ms` opens it from anywhere
  (normal gameplay, QA gameplay, title, or `.qa-menu`, ignored in text inputs,
  while a quick tap of `Q` on the title still opens `.qa-menu`); tapping
  `.qa-badge` opens it in QA mode; and on touch (`data-touch="on"`), a compact
  dev/harness-only `.qa-touch-trigger` (`"QA"`) opens it during live gameplay
  when no QA pack is active (hidden on title, credits, photo mode, QA menu, and
  while open, and replaced by `.qa-badge` once a pack or `Sandbox` activates).
  Backquote, Escape, or `Close (Esc)` closes it. Opening via keyboard focuses
  `.qa-console-input`. While open the world is frozen (no core ticks run), and
  the root carries `data-qa-console="open"`. Its header shows `"QA console"`,
  the active mode badge (pack label or `"Live game (edits enter QA)"`), and
  three tabs (`Cheats`, `Saves`, `Settings`) above an always-visible bottom
  `.qa-console-log` and `.qa-console-form`:
  - `Cheats`: Supplies range sliders (`Coins` 0–999, `Snacks` 0–99, `Tickets`
    0–999), Party Level member selector + slider (1–99 with live `Lv N (XP)`),
    Tools toggles (`Lantern`, `Lasso`, `Flute`, `Map`), and Collections & Story
    controls (`Keepsakes`, `Star Gems`, `Fish` toggles; `All Stickers`, `All
    Prizes`, `+1 All Treats`, `Ripen Garden`). Every GUI state edit routes
    through `runConsoleCommand` and re-syncs from live `State`.
  - `Saves`: inline QA slot saver (`data-qa-slot-input` + `Save Slot`), `Export
    Save` (`[data-qa-export]` in the log), `New Game (Clean Reset)`
    (`[data-qa-reset]`), and a scrollable list of all QA packs
    and saved QA slots (`.qa-console-pack`, marking active with
    `aria-current="true"`), clicking any entry loads it immediately in-game,
    resets transient overlays, reloads the target area cleanly, and closes the
    console.
  - `Settings`: live toggles (`Gentle Timing`, `Key Hints`, `Reduced Motion`,
    `Mute Audio`, and `Photo Mode` when in the free overworld) plus `Text Speed`
    segmented buttons (`Cozy`, `Brisk`, `Instant`).
  - Its commands are pure functions (`runConsoleCommand` in the dev module) over
    the real state: `help`; `xp <fae|member> <n>` and `level <fae|member> <n>`
    (levels 1 to 99; a level moves XP to its threshold); `coins`, `snacks`, and
    `tickets` (capped at 999, 99, and 999, the layouts the journal and battle
    menu were tested at); `treats all|<id>` (adding +1 of every specialty treat
    or the named treat id, capped at 99); `stickers all|<id>` and `prizes
    all|<id>` (granting from the catalogues); `fish all|clear` (catching every
    Bubblegum Bay species or clearing `caughtFish`); `gems all|clear` (setting
    the closed seven `STAR_GEM_VARIABLES` `gem_park`, `gem_bay`, `gem_trail`,
    `gem_pass`, `gem_cavern`, `gem_woods`, `gem_hills` to true or false,
    Milestone 120); `lantern|lasso|flute|map on|off`, which set exactly the four
    tool story variables `has_lantern`, `has_lasso`, `has_flute`, and `has_map`;
    `keepsakes on|off`, which toggles the closed twelve quest-keepsake story
    variables (`cavern_chime_rung`, `spice_returned`, `gem_reward_all`,
    `sanctuary_reward_14`, `sue_compass`, `jordan_clover`, `buster_reward`,
    `milo_loft_visited`, `rosie_cottage_visited`, `summit_aurora_read`,
    `island_shells_solved`, `festival_toast_done`; an undeclared story variable
    is an error); and `garden ripe` (ripening the clubhouse garden). `save
    <name>` keeps the state in a QA-only slot listed in the QA menu and `Saves`
    tab; `export` shows the state's save file for a bug report or the library;
    `reset` (and the `New Game (Clean Reset)` button in `Saves`) exits QA mode,
    clears stale transient runtime state, resets `cloverhollow-save`, reloads
    the fresh starting area, and closes the console. Nothing else the console
    does autosaves or touches the player's slot.
- Deliberately absent: arbitrary flag setting, teleporting, and eval. Fixtures
  and QA save packs are the labeled test-only shortcuts; teleporting, eval, and
  arbitrary flag setting remain absent, and the console's settable story
  variables are its closed tool and keepsake sets.
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
  opacity. Bubblegum Bay fishing: `{ game: "fish", phase, stage, water,
  bobber: { x, y, visible }, power, reelProgress, inZone, caught, catchCard,
  caughtSpecies, totalSpecies, front }`. Harness builds log
  `[cloverhollow] arcade { phase, message }` when either value changes.
- `sound.log()` returns recent read-only `{ tick, cue, played }` entries,
  `sound.effects()` returns the rolling list (up to 64 entries) of played
  non-core `CompanionAudioEffect` cues (cleared on harness resets),
  `sound.muted()` reports the separate audio preference, `sound.level()`
  reports the selected level (`0.25`, `0.5`, `0.75`, or `1`), `sound.state()`
  returns the AudioContext's state string (`running`, `suspended`,
  `interrupted`, `closed`, or `unavailable`), and `sound.music()` returns
  `{ track, ambience, duck, title, playing, muted, level, ambienceMuted }`.
  Harness builds also log `[cloverhollow] audio {state}` on every state change,
  `[cloverhollow] music {track, ambience, duck, title}` on soundtrack changes,
  and `[cloverhollow] sound {tick, cue, played}` per cue, for native checks.
  These are harness only and are absent from production.
- `settings` exposes `gentleTiming()`, `setGentleTiming(on)`, `keyHints()`,
  `setKeyHints(on)`, `textSpeed()`, `setTextSpeed(speed)`, `reducedMotion()`,
  `setReducedMotion(on)`, `photoMode()`, `setPhotoMode(on)`,
  `snapPostcard(options?)`, and `minigameRecords()` for toggling and reading
  gameplay preferences, testing Photo Mode postcard captures, and verifying
  persisted local minigame Personal Bests in harness tests.
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
  optional `seed`, an optional `party` (member ids, overriding the
  roster's `start` members; test-only), and optional declared boolean
  `variables` for deterministic QA fixtures. Sim scripts live in
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
  restores). Chromium's jobs install only its headless shell, the browser
  headless runs launch. The spec files listed in `tools/ci/shard.ts` (the UI
  gallery's checks, `ui-gallery-checks.spec.ts`) compare no screenshot and
  draw little, so Chromium runs them on two Linux runners instead (macOS
  allows five jobs at a time); a gameplay spec stays on the Macs, as Linux's
  software renderer draws its every step. WebKit runs on eight Linux runners,
  with the downloads of its system libraries cached per runner image, and
  leaves its screenshots to local runs: WebKit draws text and images with the
  operating system's libraries, so its baselines hold for the macOS they were
  drawn on. Each shard runs one worker. `tools/ci/shard.ts` splits each
  project by the recorded seconds per test in `tests/e2e/timings.json`,
  keeping a file's tests together and in order (only a file longer than half
  a shard is cut, into runs of about equal time in order); `just timings`
  refreshes the record from the last three green runs on main, each test's
  mean over them (runners differ by half again in speed).
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
  acorns, snowballs, bottle caps, tickets, and tokens; and the lifeguard's
  beach balls from the bay's painted ones (its `props-1` atlas, Milestone 64).
  No generation:
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
- Approved 2026-11-27 (Elevation Master Roadmap): owner authorized batched
  Gemini image generation Waves A (multi-expression dialogue portraits and
  expressive character pose strips), B (spatial puzzle prop kits, Clubhouse
  garden/workbench, Charm Pin icons, and battle check props/VFX), and C
  (watercolor chaos-to-paint area restoration layers and 5 scenic travel
  vignettes), plus story canon expansion (5 pre-finale Milo foreshadowing
  cutscenes while keeping his culprit identity strictly secret until the finale
  hood-drop, and 6 optional party Heart-to-Hearts). Every kept generated asset
  still records its recipe in `art/recipes/` and commits JPEG review sheets to
  `art/review/`.
- Style bible: `docs/art/style-bible.md`.

## 13. Out of scope until the owner adds it
Multiplayer, merch, speedrun, New Game Plus, analytics, voice acting, bug
minigames, and non-English localization. Keep player-facing text in Ink or JSON
so it stays translatable.

Unlocked by owner (2026-11-27) for the Elevation Master Roadmap:
- Dynamic Cozy Weather (gentle biome weather cycles integrated with mood, fish,
  and garden growth).
- Cozy Replay Shrine / Boss Encore (optional post-finale replay of mini-bosses
  and the Ancient Tree finale with remixed Star Challenge rules).
- Valley Merit Ribbons (in-game hand-stitched Journal achievement ribbon page).
