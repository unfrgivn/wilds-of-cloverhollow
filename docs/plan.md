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

## Milestone 7: Maddie follows **Status:** ✅ Completed (2026-10-05)
- Owner-approved Maddie atlas; the sprite validator passes with every check on.
- Core: Maddie follows Fae's recent path (a bounded breadcrumb trail in state)
  about 90 units behind, so she walks around furniture exactly where Fae did
  and never needs her own pathfinding. She stops about 60 units away and sits
  when Fae stops, settling at her heel (beside her, never hidden behind
  her). Through a door she arrives with Fae, placed at her heel.
- She y-sorts with Fae and occluders; her walk frames follow her own distance.
- Unit, sim (door round trip with invariants for both), and e2e (real keys:
  she follows within a distance band, crosses doors, sorts behind occluders);
  reviewed baselines; `just ios-smoke` passes.

## Milestone 8: Talk with a choice **Status:** ✅ Completed (2026-10-05)
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
- Notes: the dialogue is an explicit state machine (spec 7): a confirm press
  while a line types shows all of it, and choices appear and accept input only
  once it is shown. Ink choices are once-only, so the window has an `again`
  stitch for revisits. Natively, AXe needs `--tap-style physical` (the default
  `tapAt` never reaches the web view), and `just ios-smoke` walks to the window
  with position feedback because one swipe moves Fae 60 to 180 units. The
  simulator showed the dialogue box covering the confirm button: the reserve
  was measured once in JavaScript before iOS applied its insets, and was capped
  below what the buttons need. It is now pure CSS (spec 7.1), and the smoke run
  asserts the box clears the buttons.

## Milestone 9: Calm-down battle v0 **Status:** ✅ Completed (2026-10-05)
- Art: the owner-approved chaos frog (chaos, burst, soothed, and calm frames,
  plus a separate aura layer the engine pulses and turns).
- Core battle state machine (spec 8): Calm meter, Energy, Soothe / Play
  (Maddie) / Snack / Run, timed-press windows measured in ticks, chaos bursts,
  seeded PRNG; zero Energy means a rest and a retry, never a loss of progress.
- Winning turns the critter calm in the plaza and awards a sticker.
- Unit (meter math, timing windows), sim (win, rest, run), cross-engine hash,
  e2e with real keys, reviewed baselines.
- Notes: the battle UI is the sticker kit from cf210b7. The scene follows the
  approved mock but moves the frog to the centre, because on a phone the
  command grid owns the right side; one CSS-px layout keeps both combatants
  clear of every DOM element at phone and desktop sizes (a contract test
  checks it). The backdrop is the area painting itself, scaled past the
  watercolour's paper margins and blurred, rather than a captured texture.
  The overworld frog was missing despite an earlier report; it is drawn and
  tested now. Player-facing strings (command labels, the calm frog's Talk
  prompt) live in content. `just ios-smoke` walks into the frog with right and
  down steps only, opens the battle, checks the command buttons clear the
  touch controls, and runs away.

## Milestone 10: Journal and save **Status:** ✅ Completed (2026-10-05)
- The journal is the pause menu (J or the menu button): notes written from Ink
  and a sticker album, in the sticker UI style.
- One save slot: version plus the full game state; loading restores it exactly
  (the state hash matches).
- E2e: play, save, reload the page, continue with an identical hash. iOS: the
  save survives an app relaunch.
- Notes: autosave rather than a save button (kids forget to save): on
  arrival, after battles, dialogue, and the journal. A save must match a fresh
  state's exact shape or the game starts fresh. The journal notes come from
  one Ink knot read on a copy of the story state. Owner-approved storage
  plugin: `@capacitor/preferences`.

## Milestone 11: Title screen **Status:** ✅ Completed (2026-10-06)
- A real boot shows the sticker title over the area painting: New game with no
  save, Continue (where Fae is, her stickers) and New game with one. Continue
  resumes the save exactly; New game over a save asks first.
- Keys and taps both work; harness fixtures skip the title.
- E2e (real keys and taps), unit tests for the title flow, `just ios-smoke`
  starts from the title.
- Notes: the game is frozen behind the title, so Continue is the save exactly;
  the first version wrote the title's input into the game state, which broke
  that, and tapping Continue on a fresh title started a game. The title look
  is queued for the owner's review (`docs/review-queue.md`). `just ios-smoke`
  now reinstalls the app for a clean start (Capacitor Preferences can't be
  cleared from outside the app) and reaches the frog along the left flower
  box, so every drag goes right or down.

## Milestone 12: Downstairs at home **Status:** ✅ Completed (2026-10-06)
- The painted kitchen and living room between the bedroom and the plaza:
  stairs up, the front door out, Mom by the kitchen island, baby Oliver on the
  rug, and things to look at (breakfast, the fridge drawings, the pancake
  batter).
- People in areas (spec 6): drawn from their own atlas, y-sorted, solid, and
  talked to like interactables; they face Fae while she talks to them. Mom
  greets Fae, reacts to her morning plan, and remembers breakfast.
- E2e with real keys (the door routes, Mom's conversation and facing, Mom
  blocking the way), unit tests for the new rules, the door sims, and
  `just ios-smoke` walking bedroom, kitchen, plaza.
- Notes: built while the owner was away; the kitchen, Mom, and Oliver are
  queued for the owner's review (`docs/review-queue.md`). The first art round
  had geometry for an imagined layout, duplicate and mislabelled frames, an
  Oliver with an unkeyed magenta box (hidden by a new validator exception),
  and a blink with a magenta outline; the geometry is now measured from the
  painting on a unit grid, Oliver is rebuilt by `tools/art/build-oliver.ts`,
  and the validator checks each sprite's own key colour (spill and leftover
  key pixels) with no exceptions. The Ink adapter now skips blank lines and
  answers `calmed()` on every line.

## Milestone 13: Meadow Park **Status:** ✅ Completed (2026-10-06)
- A second painted outdoor area, Meadow Park (from `meadow_park_environment.png`):
  the hollow tree house, the cardboard play tower, a picnic blanket, the pond
  and its little bridge, reached from the plaza's lower-right path.
- Critters become generic content (spec 8): a second chaos critter, the
  baseball-cap puppy from `npc_critter_set.png`, waits by the pond with his own
  battle lines and sticker; the engine has no frog-specific code left.
- The journal album gains the puppy's sticker slot; the journal points Fae
  toward the park once the fountain is calm.
- Unit (generic critters with a real second critter), sims (the pup's win),
  cross-engine hash, e2e with real keys (plaza to park and back, the pup's
  battle), reviewed baselines, `just ios-smoke` through the park.
- Notes: the pup is the "Zoomie Pup" (calm: the Pond Pup), with the frog's
  battle numbers and his own lines; calming him turns up a tennis ball with a
  raccoon paw print, pointing to the school road. The journal points to the
  park once the frog is calm. Saves made before a critter existed still load
  (the new critter starts in chaos). The park geometry is measured from the
  painting (its walkable edge traced from the paint itself); the tree's two
  bushes have their own occluders, or Fae standing in front of them would sort
  behind the tree. The pup's art was fixed after the art round: a lime band the
  generator painted round his tennis balls (keyed at 45% fuzz), a debris
  sliver, and a bark frame that faced the other way without the chaos eyes
  (one edit). tools/art/critter-check.ts is now a real gate (it exited 0 on
  failures before) with keying checks shown to catch each defect.
  `just ios-smoke` goes round the top of the plaza to the park and back, then
  meets the frog from the right.

## Milestone 14: School day **Status:** ✅ Completed (2026-10-06)
- The school hallway (from `school_interior.png`), reached by the plaza's
  lower-left cobbled path (the road the Pond Pup points to): lockers, the
  bulletin board, the trophy cabinet, the classroom and nurse's office doors.
- Two of the school staff (`school_staff_npcs.png`) as people in the area: the
  classroom teacher by her door, and Holly the nurse by hers.
- The first "get out of school" puzzle (NOTES.md): during class the front
  doors need a hall pass. Saying the right thing earns one. Engine: a door
  trigger can require a story variable; without it, its knot plays instead
  and Fae stays inside.
- Unit (the conditional door, reading story variables), a sim (earning the
  pass and leaving), cross-engine hash, e2e with real keys (locked doors, the
  conversation, leaving), reviewed baselines.
- Notes: the puzzle is Ms. Maple's hint that Nurse Holly needs a helper; a
  fib about a tummy ache gets a gentle no (and she asks again), an honest
  offer gets the hall pass. "Ms. Maple" is a placeholder name (NOTES.md leaves
  the teacher TBD). The painting took three tries: the first followed the
  concept's close-up (doors nearly three times Fae's height), the second
  overcorrected; the third is at the kitchen's scale. One small letter
  fragment remains by the front doors. The first engine version kept a
  per-trigger "blocked" list in the state; the outside-to-inside rule already
  replays the knot only after Fae steps out, so it was removed.

## Milestone 15: The raccoon in the purple hood **Status:** ✅ Completed (2026-10-06)
- With the hall pass, Fae walks out into the plaza and meets the raccoon from
  the notice board (`chaos_raccoon.png`): he taunts her, vanishes in a puff of
  purple fizz, and drops the password to the club in the park's tree house.
  At the tree house the password works, and his purple hood hangs inside, a
  clue for the next chapter.
- Engine: people can come and go with the story. An area person may be
  `visibleWhile` an Ink variable; hidden, they aren't drawn, can't be talked
  to, and aren't solid. Each person's solid footprint moves from the area's
  blockers into the person (`footprint`).
- Unit (visibility, footprints), a sim (the raccoon scene), cross-engine
  hash, e2e with real keys, reviewed baselines, `just ios-smoke` unchanged.
- Notes: the raccoon appears in the plaza once Nurse Holly gives the pass,
  blabs the password ("Fizzlesticks... Oops") whichever way Fae asks, and
  vanishes; the tree house opens with it, and the purple hood inside has a
  Cloverhollow School name tag, pointing at a classmate (NOTES.md: the boss is
  a kid at Fae's school). The first engine version read a story variable by
  building a whole Story (0.2 ms) several times a tick, left Maddie walking
  through people, and kept drawing someone after they'd gone; each was fixed,
  with a test that fails without the fix. The first raccoon build cut his
  tail with fixed panel crops; the build now extracts whole figures.

## Roadmap after Milestone 15 (proposed, not scheduled)
- Audio: a gentle music bed per area and soft UI sounds (needs the owner's
  okay on any new dependency or paid generation).
- Device testing and TestFlight (needs the owner: store and account actions).

## Later (not scheduled)
Audio and music, gamepad polish, device testing and TestFlight, Bubblegum Bay
and Pinecone Pass, Sue and Jordan, and tools (lantern, lasso, flute).
