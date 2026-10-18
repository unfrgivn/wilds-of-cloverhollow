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

## Milestone 16: On the owner's iPhone **Status:** ✅ Completed (2026-10-06)
- `just ios-device-build` builds the production web bundle (no harness hook),
  syncs it into the native shell, and compiles the Release app for a real
  arm64 iPhone, unsigned. `just ios-device` does the same with free
  personal-team signing and installs and launches it on the connected phone
  over USB (`tools/ios/device.ts`, `xcodebuild -destination
  generic/platform=iOS -allowProvisioningUpdates`, `xcrun devicectl`).
- The team id stays out of the repo: `.env.ios` (gitignored, loaded by `just`)
  holds `CLOVERHOLLOW_TEAM_ID` and an optional `CLOVERHOLLOW_DEVICE`;
  `.env.ios.example` shows the shape.
- Evidence: the unsigned device build compiles (arm64, Info.plist bundle id
  `com.unfrgivn.cloverhollow`, minimum iOS 15.0, no `__cloverhollow` in the
  bundled scripts); both missing-team and no-phone cases fail with a plain
  message, no stack trace.
- Notes: no iPhone was attached while this was built, so the install step is
  untested on hardware. Owner steps (once, at the Mac): sign in to Xcode >
  Settings > Accounts, copy the Personal Team id into `.env.ios`, plug the
  phone in, tap Trust, turn on Developer Mode, then `just ios-device`; after
  the first install, trust the developer app under Settings > General > VPN &
  Device Management. Free profiles last 7 days; rerun to refresh.

## Milestone 17: Followers who fight **Status:** ✅ Completed (2026-10-06)
- Engine: Maddie becomes member 0 of a party (spec 5). `content/party/<id>.json`
  rosters each friend: atlas, feet-anchored body box, `walkCycleUnits`, whether
  they sit, whether they start in the party, and one battle command. Member 0
  follows Fae and member i follows member i-1 with the same trail algorithm,
  each with its own breadcrumb trail; `state.maddie` and `state.trail` are
  gone, `state.party` holds the ordered members. Sue and Jordan arrive with
  their art later; a content-less second member proves the chain in the core
  tests and `tools/sim/party-chain.ts`.
- Battles compose their menu from the party: Soothe, each member's command in
  party order, Snack, Run. Each critter answers every roster command in
  `commands.friends` and `lines.friends`; rest is tracked per command id.
- Save version 2. The render draws every roster member from its own atlas and
  places the party along Fae's baseline in the battle scene; `renderInfo()`
  reports `party`.
- Unit (the pinned contract `tests/unit/party.test.ts`: Maddie's end state in
  every replay script is unchanged to 1e-9; a second member spawns and chains
  validly; the whistle command's numbers and rest), sims (every member checked
  each tick, plus the two-member chain), e2e with real keys (`party.spec.ts`:
  Maddie as the party in the plaza, Soothe / Play / Snack / Run in the frog's
  menu), reviewed baselines.
- Notes and assumptions:
  - Milestone 44 uses a 1000 by 460 logical heap floor, nine authored plushes
    in three levels, and the raccoon is freed only after the squirrel and
    bluebird are won. The claw's two holds use separate x and z phases; the
    painted-box UI is being redone by the UI worker.
  - Maddie's overworld sprite was drawn 2x too tall: only `scale.x` was set, so
    Pixi's default `scale.y` of 1 stretched her (the old plaza baseline shows
    an orange smear beside Fae). The generic follower uses one uniform scale,
    as spec 5 always said. Every baseline with Maddie in it changed and was
    viewed; her positions are unchanged (the contract fixture pins them).
  - A chained spawn slot must also clear Fae and the members ahead by two
    radii; without it the second member's first heel candidate can land on
    Fae's feet when Maddie took the right heel. Member 0's slots never came
    within two radii of Fae, so this changes nothing for her.
  - Battle scene spacing: member 0 keeps Maddie's spot (42 units toward the
    critter); member i>0 stands i x 64 units on Fae's far side.
  - Rest entries are dropped at zero, so `rest: {}` means everyone is ready.
  - `parseSave` now checks array elements against the template's first
    element (party members and trail points), where before any array passed.
  - The area checks now require a chained slot for the whole roster at every
    spawn (not just Maddie), so any party fits anywhere.

## Milestone 18: Sue joins **Status:** ✅ Completed (2026-10-06)
- Sue is the second roster member. Starter/joining content validates exactly one
  entry path and declared Ink variables; `sue_joined` adds her at the end of a
  free tick, at her person point or a chained slot.
- All followers use the same two-way 25% visibility and two-radius slot rule.
  Member 0 retains its original candidate order; chained members add named
  diagonal heel candidates for tall followers.
- Frog and pup have Sue's Cast command and owner-requested ribbon bobber lines.
  The journal follows Ink's conditional note rule directly. The headless
  `sue-join` sim compiles the real story with its test knot, walks to Sue,
  joins her, walks on, and checks the party each tick.
- Phase 2 adds Sue's generic overworld rendering, behind-Fae battle rendering,
  the `plaza-party` fixture, real-key e2e coverage, and reviewed screenshots at
  1280x720 and 874x402. Owner review items are Sue's art and her Cast lines.
- Cast wording: frog great `Sue casts her ribbon bobber into the fountain. The
  frog chases the ripples, giggling!`; good `Sue's bobber bobs past. The frog
  can't stop watching it.`; miss `Sue's bobber plops into a flower box. The
  frog blinks... and almost smiles.` Pup great `Sue casts her ribbon bobber
  across the grass. The pup races after it, tail wagging!`; good `Sue's bobber
  wiggles by. The pup tilts his head and wags.`; miss `Sue's bobber snags on
  the fence. The pup gives it a curious sniff.`
- Notes and assumptions:
  - Sue's atlas (`tools/art/build-sue.ts`, 10 generation calls) is keyed on
    magenta, since her hoodie and one sock are teal. Her first back walk was a
    taller, long-legged figure in a brighter hoodie; it was regenerated from the
    model sheet's back view as two three-frame strips, like Fae's.
  - Her first atlas also flopped the side idle, which already faced left, so
    she turned around whenever she stopped. Silhouettes can't catch that (a bob
    and a backpack are nearly symmetric), so `validate-sprite.ts` now compares
    the side idle's head-and-torso colours with the side walk's, as drawn and
    mirrored; Fae and Maddie pass it unchanged.
  - The journal no longer hides the park note unless Fae has read the notice
    or is in the park (it searched the saved Ink text for a variable name): the
    note shows once the frog is calm and the pup isn't, as Ink says.
    `journal-save.spec.ts` now expects it after the frog battle.
  - `followerSlot` is gone; `partySlots` places any party, Maddie alone
    included.
  - Walking toward the camera, the party trails straight behind Fae and Maddie
    is hidden until they stop; the e2e screenshots wait for the party to settle.

## Milestone 19: Bubblegum Bay **Status:** ✅ Completed (2026-10-07)
- Once the tree house club is open, the plaza's east road leads to Bubblegum
  Bay (before that it plays `bay_road_closed`). Sue is fishing at the dock's
  far end; whatever Fae answers, she joins. A fizzy bluebird is loose on the
  sand; Fae calms it with Soothe, Maddie's Play, or Sue's Cast and wins the
  Bay Bluebird sticker, and the calm bluebird points toward the mountains.
- Engine: nothing new; the bay is content (an area, a person, a critter, a
  story variable). The journal gains the bay, Sue, and the mountains.
- Evidence: unit (`bay.test.ts`, `bay-paint.test.ts`, `bay-depth.test.ts`,
  `bay-replay.test.ts`), the recorded run `tests/sim/scripts/bay/bay.json`
  (Sue joins, Cast, the sticker; it replays in Bun and the browser with
  matching hashes), and e2e with real keys (`bay.spec.ts`: the closed road,
  chapter one replayed then walked down the east road, the dock to Sue, and
  Cast in the bluebird battle), with viewed baselines at 1280x720 and 874x402.
- Wording for the owner:
  - The closed road: "The east road goes to Bubblegum Bay!" / "But I want to
    follow the raccoon's trail first."
  - Sue: "Whoa, hi! Careful, these planks are a little wobbly." / "I'm Sue. I
    fish here every day... but today the fish are all fizzy!" / "And that
    flappy bluebird keeps kicking sand in my bait bucket." / "Wait. Purple
    fizz? Was it a raccoon in a hood?" Choices: "Yes! I'm following his
    trail." ("I knew it! Count me in.") / "I think so. Want to help me find
    out?" ("Are you kidding? Of course! Let me grab my rod.")
  - The sign: "BUBBLEGUM BAY. Fishing, splashing, and sandcastles welcome!"
    The picnic: "A beach picnic: watermelon slices, a sun hat, and a sandy
    towel." and, until the bluebird is calm, "Everything's covered in sand.
    That bluebird again!" The shells: "Pretty shells! They sound like tiny
    waves when I shake them."
  - The bluebird, calm: "Chirp! Thank you, Fae. My wings feel calm again." /
    "The raccoon zipped off toward the mountains!", then "Chirp-chirp! The bay
    is peaceful now." Its battle lines are in `content/critters/bluebird.json`.
  - Journal: "The east road leads to Bubblegum Bay. The club's fizzy purple
    soda smelled just like the fountain's bubblegum bubbles." / "Sue is on my
    team now! She knows every good fishing spot." / "The Bay Bluebird says the
    raccoon zipped off toward the mountains."
- Notes and assumptions:
  - The bay's first geometry was drawn by eye and didn't match the painting
    (a quarter of the beach was off the floor, blockers stood on bare sand, an
    occluder sat on the sea). It is now checked against the paint itself:
    `tools/art/paint-map.ts` reads the painting into 5-unit cells, and two
    contracts compare the floor, blockers, and occluders with them.
  - The dock's near rail is drawn in 25-unit slivers, each with the baseline
    of its east end: a diagonal object can't have one baseline that is right
    at both ends. Blocker bands keep Fae from walking through the rails where
    the beach meets the dock.
  - `tests/unit/party.test.ts` pinned Maddie's end state for every replay
    script, which forbade new scripts; it now pins the scripts it recorded and
    allows new ones.
  - The bluebird's first build sorted figures by centroid and named the burst
    "idle" (and shrank it 11%); it now names each figure by its cell in the
    generated sheet and uses one scale for all four.
  - Browser replays queue a whole script in one round trip (`queueScript` in
    `tests/e2e/helpers.ts`). One round trip per segment made the chapter-one
    replay take 72 s in Chromium under load, near its 90 s budget, and the new
    bay flow timed out; now they take 9 s and 30 s.
  - Fixed after the milestone (2026-10-07): only the palms' trunks were cut
    out, so Fae walking north of a palm was drawn over its crown. Each palm is
    now cut whole (crown and trunk, outlined from the painting's green fronds
    and the old trunk outline) as a canopy that fades while she's behind it
    (spec 6). The bay's pinned depth and paint contracts pass unchanged.

## Milestone 20: Pinecone Pass and the bus **Status:** ✅ Completed (2026-10-07)
- Once the bluebird is calm (it pointed toward the mountains), Fae can ride
  the bus from the plaza's new stop, between the two lower flower boxes, up to
  Pinecone Pass, and back. The pass is walkable: the bus stop, the clearing,
  the lodge (locked: its owner is out looking for a runaway hamster), the
  cocoa stand, the snowman, the trail sign, and the ski lift as scenery.
- Engine: a story line tagged `# travel: <area>.<spawn>` sends Fae there when
  the conversation closes, with a door's fade, safe spot, autosave, and party
  placement; the loader rejects a tag naming an area or spawn that doesn't
  exist.
- Evidence: unit (`bus.test.ts`, `travel.test.ts`, `pass-paint.test.ts`, the
  ride's replay), the recorded ride `tests/sim/scripts/bay/bus.json` with
  matching browser and Bun hashes, and real-key e2e (`bus.spec.ts`: the stop
  goes nowhere before the bluebird is calm; after the bay run, out to the
  plaza, to the stop, the ride, the pass, home; Fae behind the snowman, drawn
  over her). The twelve plaza baselines changed only by the new stop.
- Wording for the owner: "The bus waits by the star sign, but there's no
  reason to leave town yet." / "Maybe once I find a clue that leads up the
  mountain." / "The bus to Pinecone Pass is here!" ("All aboard!": "Up we
  go!"; "Not yet.": "Not yet. I'll stay in Cloverhollow a little longer.") /
  "The bus is ready to roll back to Cloverhollow." ("Back to town!" / "Not
  yet. I want to look around a little more.") / Sign: "PINECONE PASS. Trails,
  sledding, and the best cocoa in the mountains!" / "The snowman has a carrot
  nose and a very serious pebble smile." / "The cocoa stand is open, but
  nobody's behind the counter." / "The lodge is locked. A note says: Back
  soon, gone looking for a runaway hamster." / Journal: "The bus at the
  plaza's star sign goes up into the mountains, to Pinecone Pass!", then
  "Pinecone Pass is covered in snow, with a lodge and a cocoa stand. The
  raccoon must be up here somewhere."
- Notes and assumptions:
  - The pass's geometry comes from `tools/art/geometry/pass.ts`: each thing
    standing in the painting is outlined by hand with the row its foot stands
    on; a building, a stand of trees, or the benches block their whole
    outline, while a sign, a post, or the snowman block only their bottom 30
    units so Fae can walk behind them; every thing is cut out and drawn over
    her north of its foot. `pass-paint.test.ts` checks it against the painting
    read by `tools/art/paint-map.ts`, which gained a snow palette (snow is as
    white as the paper margin, so cells are classed by mean colour and
    texture, and paper only counts when it touches the image's edge).
  - The first travel version read the target only from the tagged line, so a
    travel line followed by any other line lost it; it now carries forward.
  - The pass's tile manifest named its tiles with full paths, which the game
    would have joined to the area folder and failed to load; it uses bare
    file names like every other area.
  - The plaza stop is a narrow prop (121 units) because the only place no
    recorded route crosses is the gap between the lower flower boxes.

## Milestone 21: The Cliffside Trail **Status:** ✅ Completed (2026-10-07)
- The first trail between lands, walked EarthBound style: the Cliffside Trail
  climbs from Bubblegum Bay (its beach, at the bottom) to Pinecone Pass (its
  snowy path, at the left edge), past two meadows, a signpost, a footbridge
  over a stream, and a lookout bench above the sea. From the pass it's always
  open (down the east path, where the pass's signpost points); from the bay's
  south beach it opens once Fae has ridden the bus up the mountain
  (`rode_bus`), so the story still goes by bus first.
- Roaming critters: an area critter with `roam: { radius }` wanders near home,
  comes after Fae when she's within sight, a little slower than she walks
  (wander 1.25 and chase 2.5 units a tick; she walks 4), starts a battle when
  it touches her, leaves her alone for 240 ticks after she runs and wanders
  home, holds still while she's busy, and stands still once calm. A chaser
  gives up beyond its home radius plus twice its sight. A fizzy bunny roams
  the upper meadow and a fizzy squirrel the lower one.
- The back-link rule: after Fae arrives through a door, the way straight back
  stays shut while she keeps holding the direction she arrived holding. The
  bay's south edge and the trail's beach face opposite ways, so without it a
  kid holding down would bounce between them forever.
- Evidence: unit (`trail.test.ts`, `roam.test.ts`, both replays), two
  recordings with matching browser and Bun hashes (`pass/trail.json`: from the
  pass down to the bay, calming the bunny and running from the squirrel;
  `trail/lookout.json`: over the footbridge to the bench and into the bay,
  holding down), and real-key e2e that plays each recording as key presses and
  checks it on the way (the arrival at both sizes, the bunny closing in, its
  battle, the squirrel leaving Fae alone after she runs, the bridge rail drawn
  over her feet, the bench, the bay), ending on the same hash as Bun.
- Wording for the owner: the closed cliff path ("A sandy path climbs the
  cliffs, way up toward the mountains." / "That's a long walk, and I don't know
  where it goes yet."), the trail's signpost ("CLIFFSIDE TRAIL. Up: Pinecone
  Pass. Down: Bubblegum Bay." / "Over the bridge: the lookout!"), the pass's
  trail sign ("CLIFFSIDE TRAIL. Down the mountain to Bubblegum Bay."), the
  bench ("What a view! The sea sparkles all the way to the sky." / "I can see
  Sue's dock way down there. It looks tiny!"), the calm bunny ("Thank you! I
  was hopping in circles all morning." / "A raccoon in a purple hood zipped
  by, and everything went all fizzy!" / Fae: "That raccoon again!"; again: "The
  clover up here is extra sweet. Want some?"), the calm squirrel ("Phew! Sorry
  about all the acorns." / "A raccoon traded me a shiny bottle cap for my best
  acorn." / "Then, fizz! I couldn't stop throwing things."; again: "I'm saving
  my acorns for winter now. Nobody gets bonked!"), the journal ("The Cliffside
  Trail runs between Pinecone Pass and Bubblegum Bay. Its bunny and squirrel
  are calm again!"), and the Thumpy Bunny's and Zippy Squirrel's battle lines
  in `content/critters/bunny.json` and `squirrel.json`.
- Notes and assumptions:
  - The trail's floor, blockers, and occluders are written by
    `tools/art/geometry/trail.ts` from outlines on its painting. Stands of
    trees and boulders block their whole outline, so nothing hides Fae; the
    signpost blocks only its foot; the bridge's near rail is cut in slivers
    drawn over her on the deck.
  - Each trigger is a thin strip on its floor's outer edge (the pass's painting
    ends at x 1520, with paper beyond). Arrivals face into the land: the pass's
    east edge leads to the trail's west edge, keeping Fae's direction; the
    bay's south edge leads to the trail's beach, turning her round, hence the
    back-link rule.
  - Roamers are part of the state with no save version change: saves from
    before them start fresh (the shape check).
  - The `trail` fixture starts on the trail's beach for the lookout run; the
    `pass` fixture is unchanged.
## Milestone 22: Jordan **Status:** ✅ Completed (2026-10-07)
- At Pinecone Pass, Jordan stands by the snowman, watching a fizzy Snowball
  Hamster tear round the clearing. He joins Fae's party whatever she answers
  and brings his battle command, Juggle (pinecones; it rests two turns,
  "finding pinecones"), so a battle with the whole party offers six commands.
  Calmed, the hamster says the raccoon took a secret trail you can only see at
  night, and Jordan hands Fae his blacklight lantern (`has_lantern`).
- A party of three fits at every spawn of every area: members after the first
  also try wider diagonal heel slots, after the existing candidates, so no
  earlier placement or recorded route changed.
- Evidence: unit (`jordan.test.ts`, the replay), the recording
  `pass-party/jordan.json` (written by `tools/sim/record-jordan.ts`) with
  matching browser and Bun hashes, and real-key e2e (`jordan.spec.ts`: walk to
  Jordan and talk; the party of four at the pass; the six-command battle at
  both sizes; Juggle chosen with the arrow keys, then Soothe to the win; the
  lantern from the calm hamster).
- Wording for the owner: Jordan: "Whoa, watch out! That hamster's gone
  totally fizzy!" / "It keeps throwing snowballs at everyone. Even at the
  snowman!" / "I'm Jordan, by the way. I've hiked every trail up here."; the
  choices "Let's calm it down together!" ("You got it! I'll keep it busy.") and
  "Did a raccoon in a purple hood come by?" ("He zoomed past on a sled,
  laughing his head off! Let's go after him."). The calm hamster: "Squeak!
  Thank you. My head feels all cozy again." / "The raccoon? He ran off down a
  secret trail. You can only see it at night..." / Fae: "A trail you can only
  see at night?" / Jordan: "Trail markers glow under blacklight! Here, Fae,
  take my lantern." / "Jordan hands Fae his blacklight lantern: a big round
  purple lens on a rainbow handle."; again: "Squeak! Watch out for snowballs.
  Hee hee." The journal: "Jordan gave me his blacklight lantern. The raccoon
  took a secret trail you can only see in its light!" and "Jordan is on my team
  now! He's hiked every trail on the mountain." The Snowball Hamster's battle
  lines and every critter's Juggle lines are in `content/critters/`.
- Notes and assumptions:
  - Jordan stands at (1100, 700) by the snowman and the hamster at (850, 760)
    in the clearing, off the recorded bus routes. Milestone 20's walk behind
    the snowman now steps round him, and the pass's screenshots show them.
  - Jordan's runs start from the `pass-party` fixture (the pass with Maddie
    and Sue); the `pass` fixture is unchanged, so earlier runs keep their
    party and their battle menus.
- Juggle has the same numbers on every critter: calm 30, great 15, good 5,
  rest 2.

## Milestone 23: The blacklight lantern **Status:** ✅ Completed (2026-10-07)
- Fae's blacklight lantern, from Jordan, is drawn as the owner's concept: a
  magnifying glass with a purple lens on a rainbow handle. L (or the touch
  lantern button, which appears once she has it and glows while it's on)
  switches it on and off. While it's on, the pass drops to a violet dusk and
  what the raccoon left behind glows on top: a trail of raccoon paw prints
  across the clearing to a glowing arrow on the west pines, and a doodle on
  the north ski-lift tower. Reading the arrow finds the old pine trail toward
  the Whispering Woods (`found_old_trail`), the next land.
- Evidence: unit (`lantern.test.ts`, the replay), the recorded run
  `pass-party/lantern.json` (`tools/sim/record-lantern.ts`: Jordan's meeting,
  then the lantern on, the doodle, the prints, the arrow, the lantern off)
  with matching browser and Bun hashes, and real-key e2e that plays the
  lantern part as key presses (on, the glows drawn, both lines read, the
  journal's note, off) and taps the touch button at phone size.
- Wording for the owner: Jordan: "Switch it on and look around. Raccoon tracks
  glow!"; the doodle: "Glowing raccoon doodles on the lift tower! A masked
  face, a swirl, and a star." / "The squiggles look like secret writing. Was
  the raccoon leaving a message for someone?"; the arrow: "A glowing arrow,
  painted on a tree! It points west, deep into the pines." / Jordan: "That's
  the old pine trail! It goes all the way down to the Whispering Woods." / "An
  old trail, hidden in the snow. You can only see it with the lantern!";
  again: "The glowing arrow still points west, toward the Whispering Woods.";
  the journal: "The raccoon's glowing trail goes west through the pines,
  toward the Whispering Woods."
- Notes and assumptions:
  - Saves are version 3; version-2 saves start fresh.
  - The glows are light painted on black, added over a 55% violet dusk; on
    bright snow, light added without the dusk only saturated to white.
  - The glow atlas's frame sizes were written as `{ width, height }`, which
    Pixi doesn't read, so no glow drew at all; `build-lantern.ts` now writes
    `{ w, h }`. The arrow is mirrored (`flip`) so it points into the pines.
  - The touch button's lit style set the whole `background`, erasing its icon;
    it now sets only the colour.

## Milestone 24: The bus line and the map **Status:** ✅ Completed (2026-10-07)
- The bus is now a line through the three towns with a stop: Cloverhollow's
  plaza, Bubblegum Bay (a new stop by the welcome sign, where the road from
  town comes in), and Pinecone Pass. From any stop it goes to any other the
  story has opened: the bay once the east road is open (`club_open`), the pass
  once the bluebird has pointed Fae toward the mountains (riding there is the
  first ride, `rode_bus`), and home any time.
- The journal has a MAP page: the painted map of the lands, every land named
  (the sealed Enchanted Forest as "???"), a gold star over the land Fae is in,
  and the bus line's sign beside each stop. Bookmark tabs, or the arrow keys,
  flip between NOTES & STICKERS and MAP; the journal opens on its notes. Every
  area belongs to one of six lands (`content/lands.json`, `area.land`).
- Evidence: unit (`bus-line.test.ts`: the lands, the bay's stop, every ride
  and its story gates), and real-key e2e (`map.spec.ts`: the map at both
  sizes, flipped by keys and by the touch bookmark; `bus-line.spec.ts`: from
  the end of chapter one, out of the park to the plaza's stop, the ride to the
  bay, the star at Bubblegum Bay, and the ride home).
- Wording for the owner: the plaza: "The bus is here! Where to?" ("Pinecone
  Pass!": "Up we go!"; "Bubblegum Bay!": "To the beach!"; "Not yet.": "Not
  yet. I'll stay in Cloverhollow a little longer."); the bay: "The bus stops
  here on its way between the towns. Where to?" ("Cloverhollow!": "Home to
  town!"; "Pinecone Pass!": "Up we go!"; "Not yet.": "Not yet. I want to stay
  at the beach a little longer."); the pass: "The bus is ready to roll. Where
  to?" ("Cloverhollow!": "Back to town!"; "Bubblegum Bay!": "Down to the
  beach!"; "Not yet.": "Not yet. I want to look around a little more."). These
  replace Milestone 20's "The bus to Pinecone Pass is here!" and "The bus is
  ready to roll back to Cloverhollow."
- Notes and assumptions:
  - The map page is presentation only, outside the core and saves; the land
    centres come from the map painting's `world-map.json`.
  - Before the east road opens and while the bluebird is fizzy, the plaza's
    stop still says there's no reason to leave town.
  - `bus.test.ts`'s list of travel targets now has three.
## Milestone 25: The grumpy gull **Status:** ✅ Completed (2026-10-07)
- The Grumpy Gull is the first mini-boss, a large stationary chaos critter at
  the Cliffside Trail lookout. It blocks the route from the footbridge to the
  bench, and after its Soothe battle becomes the friendly Lookout Gull with a
  sticker and a talk knot.
- Evidence: `tests/unit/gull.test.ts`, the lookout replay with a Soothe battle,
  and the real-key trail e2e screenshot at 874x402 (`trail-gull-battle.png`).
- Wording for the owner: intro "A grumpy gull puffs up on the lookout bench. It
  wants ALL the snacks!"; command "How can Fae calm the gull?"; Soothe great
  "Fae hums a gentle sea shanty. The gull's feathers settle down!", good "Fae
  hums softly. The gull tilts its head.", miss "The gull squawks right over
  Fae's humming."; Play great "Maddie pounces after a floating feather. The
  gull flaps along, delighted!", good "Maddie bats at a feather. The gull peers
  down at her.", miss "Maddie chases her own tail. The gull rolls its eyes.";
  Cast great "Sue casts her ribbon bobber out over the cliff. The gull swoops
  after it!", good "Sue's bobber bobs in the wind. The gull's eyes follow it.",
  miss "Sue's line catches the breeze and tangles. The gull snorts."; Juggle
  great "Jordan juggles three pinecones. The gull catches one, very proud!",
  good "Jordan tosses a pinecone high. The gull eyes it hungrily.", miss "A
  pinecone bonks Jordan on the head. The gull squawks with laughter."; Snack
  "Fae shares a whole sandwich. The gull gobbles it and looks a little less
  grumpy."; burst "The gull flaps a huge gust of feathers and sea spray at Fae!";
  burst results "Fae ducks under the feathers!" / "Fae dodges most of the spray!"
  / "Splash! Fae gets a face full of sea spray."; soothed "The gull lets out a
  long, happy sigh. The fizzy spell blows away on the breeze!"; reward "New
  sticker: Lookout Gull!"; rest "Fae is too windblown to go on. Time for a
  rest."; run "Fae backs off the lookout. The gull guards the bench." The calm
  knot is "Squawk! Sorry about your snacks. I couldn't help myself!" / "A
  raccoon in a purple hood fed me a fizzy cracker. Then I wanted ALL the
  snacks!" / "A fizzy cracker? Everywhere that raccoon goes, things go fizzy."
  / "I'm keeping watch over the sea now. No more snack snatching!"; the journal
  note is "The grumpy gull at the lookout was fizzy too. That raccoon gets
  around!"
- Notes and assumptions:
  - The gull is deliberately a mini-boss rather than a recoloured trail
    critter: `overworldHeight` 110, `battleHeight` 260, `touchRadius` 85,
    `calmMax` 160, `energyMax` 6, and burst `bigChance` 0.5, compared with
    ordinary critters' 66/70 overworld height, 190 battle height, 70 touch
    radius, 100 calm, 5 energy, and 0.3 burst chance. It has no roam entry.

## Milestone 26: The Whispering Woods **Status:** ✅ Completed (2026-10-07)
The old pine trail west of Pinecone Pass now opens only after the blacklight
arrow is found. Fae enters a 1750x1100 green clearing with pines, oaks, ferns,
mossy logs, mushrooms, a stream, stepping stones, and the raccoon's clubhouse
at its north edge. The clubhouse contains purple soda bottles, comics, and a
half-eaten fizzy cracker. With the lantern on, its wall reveals the raccoon's
note: meet “the boss” at the Ancient Tree in the sealed Enchanted Forest.

A chaos owl roams the clearing. Its commands are Soothe, Play, Cast, Juggle,
Snack, and Run, with a screeching/swooping battle and a wise whispering calm
knot. After the owl is calm, the clubhouse becomes Fae's club. Sue promises a
fridge and Jordan promises a garden. Journal notes are newest first, including
the old trail, the owl, and the clubhouse claim.

## Milestone 27: Coins and shops **Status:** ✅ Completed (2026-10-07)
- Fae carries coins and snacks (save version 4; older saves start fresh). A
  new game has 0 coins and 2 snacks. Calming a critter pays its coins as the
  battle ends: 8 for the ordinary critters, 25 for the grumpy gull. Snack
  spends one of Fae's own snacks, shows how many she has, and is disabled at
  none; critters no longer bring their own.
- Shops: the plaza bakery (talk at its window) and Pinecone Pass's cocoa stand
  sell a snack for 5 coins, on every visit. Ink asks `coins()`; a line tagged
  `# buy: snack 5` takes the coins as it's shown.
- The journal: the NOTES heading row shows two small stickers, Coins (a gold
  coin) and Snacks (a cookie); while Fae has coins, a note sends her to the
  bakery.
- Evidence: unit (`coins.test.ts`: the payout, sticky shops, the short purse,
  the snack supply, save version 4, the tag checks; `bakery-replay.test.ts`),
  the recorded run `plaza/bakery.json` (`tools/sim/record-bakery.ts`: calm the
  frog, buy at the bakery, eat the snack in the pup's battle) with matching
  browser and Bun hashes, and the real-key e2e `shop.spec.ts`, which plays it
  and shoots the bakery's choice, the selected Snack ×3, and the journal's
  supplies at 1280x720 and 874x402.
- Wording for the owner: the bakery, "The bakery smells like warm cinnamon
  buns." ("Buy a snack for 5 coins": "A fresh snack, wrapped up just for
  you!"; "Not now": "No rush! Come back when you're hungry."; short of coins:
  "You need 5 coins for a snack. Keep exploring!"); the cocoa stand, "The
  cocoa stand steams beside the snowy trail." ("Buy a mug of cocoa for 5
  coins": "Here you go, a warm mug of cocoa!"; "Not now": "All right! Stay
  cozy out there."; short: "A mug of cocoa costs 5 coins. Maybe calm a
  critter first?"), replacing "The cocoa stand is open, but nobody's behind
  the counter."; each reward line adds the coins ("New sticker: Fountain
  Frog! +8 coins."); the journal note, "I have coins! The bakery in the plaza
  sells snacks for 5 coins."
- Notes and assumptions:
  - Lantern finds pay no coins. The proposal had them, but Milestone 28 makes
    every calm pay, which is plenty for snacks.
  - The shops' choices were once-only (`*`), so each sold one snack a game,
    and after a last 5 coins were spent the baker still said they cost 5.
    They're sticky now, and the short line only plays when Fae is short.
  - The journal's coin note was third person ("Fae has coins now!") on top of
    every note; it's in Fae's voice now, just above the frog's note, where it
    first comes true. `journalNotes` answered `coins()` only on its first
    line (0 after), which hid it there; Ink's externals are now one value,
    `inkFacts(state)`. The shell's journal cache refreshes on a coin change
    too (it watched only the story and the critters).
  - Load validation never saw a travel tag: compiled tags carry a `^` text
    prefix. Both travel and buy tags are now read properly (`storyTags`).
  - The local long-flow e2e budget is 180 s (it was 90): a full run in both
    browsers took the trail walk past 90 s. Local runs use 30% of the cores
    as workers (3 on a 10-core laptop; Playwright's default is half): five
    software-rendering Chromiums starved each other and timed out the long
    real-key flows, and three ran the whole suite green in 10.4 minutes.
  - `pass/trail.json` waits 13 ticks longer on the bunny's reward, which now
    types its coins too.
  - New recorders share `tools/sim/recorder.ts` (navigate, talk, battle;
    arrows and Z only, so the e2e can play them with real keys).

## Milestone 28: Recurring bad guys **Status:** ✅ Completed (2026-10-07)
- Critters are species met all over the world, EarthBound style. An area's
  dens roll their chaos critters fresh from the seeded PRNG every time Fae
  arrives (a door, the bus, a rest); one she calms stays calm until she
  leaves. Every calm pays its coins; each species gives its sticker once
  ("+8 coins!" and no card after that). The roster: the plaza (once the
  fountain frog is calm) and the park, raccoons, pups, and cats; Bubblegum
  Bay, frogs and bluebirds; the Cliffside Trail, bunnies and squirrels;
  Pinecone Pass, hamsters; the Whispering Woods, owls and raccoons. Story
  set pieces stay unique and never respawn: the fountain frog, the grumpy
  gull, and the school raccoon.
- New battle art: the Pouncy Cat (an orange tabby in a blue bandana, from the
  owner's critter sheet) and the Sneaky Raccoon (`chaos_raccoon.png`: purple
  patchwork hood, teal cape; calm, the hood pushed back). Ten stickers now,
  one per species.
- The talking raccoon is now a raccoon battle by the school path: calmed, it
  tells the password it overheard a kid in a purple hood whisper at the tree
  house. Everything that named "the raccoon" as the troublemaker (the notice
  board, the journal, the critters' clues, the clubhouse, Sue, Jordan, the
  lantern) now says "a kid in a purple hood", never named.
- Evidence: unit (`recurring.test.ts`: the roll's draws, dens' kinds and
  chances, the quiet plaza, calm until she leaves, a rest rolls again, the
  story's species facts, the loader and authoring checks;
  `recurring-replay.test.ts`; the reworked `raccoon.test.ts`; every replay
  test re-pinned), the recorded run `park/recurring.json`
  (`tools/sim/record-recurring.ts`: a pup calmed, out and back, a fresh pup
  calmed again) with matching browser and Bun hashes, every recording
  re-recorded on the shared recorder, and real-key e2e (`recurring.spec.ts`:
  the run as key presses, the return and the coins-only reward at both
  sizes, and a cat's battle in the plaza; `raccoon.spec.ts`: the school
  raccoon's battle, reward, and password, at both sizes).
- Wording for the owner: the notice board, "Has anyone seen a kid in a
  purple hood? They ran off from the fountain, giggling." ("A kid in a
  purple hood? I bet that's who did it." / "A kid in a purple hood, fizzing
  up the fountain? Weird."); the school raccoon, intro "A fizzy raccoon pops
  out by the school path, chattering at Fae!", calm "Chitter-chitter!
  Thanks, Fae. My head feels all clear now." / "A kid in a purple hood gave
  me a fizzy cracker. Then I couldn't stop chattering!" / "I heard that kid
  whisper a secret word at the tree house in the park: "Fizzlesticks!"" /
  "A secret password for a tree house club? I have to see this!" / "The
  raccoon waves its striped tail and scampers off."; the raccoons' and cats'
  battle lines (`content/critters/raccoon.json`, `cat.json`) and calm talks
  ("Chitter! Sorry, Fae. The fizz made me grab every shiny thing in sight."
  / "A kid in a purple hood keeps leaving fizzy crackers around. They're SO
  tasty."; "Mrrow! Thanks, Fae. That fizz made my whiskers all twitchy." /
  "The cat curls around Fae's ankles, purring like a little motor."); the
  bay's frogs ("A fizzy frog bounces across the sand, puffing pink
  bubbles!"; calm, the Beach Frog: "Ribbit! The sand feels nice and cool
  again. Thanks, Fae!"); the pup's clue is now "a purple thread stuck to
  it... from a purple hood!"; the coins-only reward "+8 coins!"; and every
  journal note and clue that said "the raccoon" (listed in the diff of
  `content/story/main.ink`).
- Notes and assumptions:
  - Kinds and species: a kind is a critter's battle content
    (`content/critters/<id>.json`); kinds of one species share its sticker.
    The fountain frog (`fountain-frog`) and the bay's frogs (`frog`) are
    both frogs; the school raccoon (`school-raccoon`) and the roaming ones
    (`raccoon`) are both raccoons. The story's `calmed(name)` answers a
    species from the stickers and a set piece from its own mood, so the bus
    up the mountain still waits on a calm bluebird.
  - Saves are version 5 (the state's critters changed shape).
  - An arrival draws twice per den whatever comes out, so the PRNG's place
    after an arrival depends only on the content. Every den the story needs
    (the pond's pups, the bay's bluebirds, the clearing's hamsters) has
    `chance` 1. The plaza stays quiet until the fountain frog is calm, so a
    new game's first battle is still him.
  - Dens are checked like spawns: on the floor, out of sight of every spawn
    on arrival, clear of doors, and in view (one was first placed behind the
    park's play tower, which hid its critter).
  - The bus stops' choices were once-only, so each ride could be taken once
    a game; they're sticky now (a test rides up and down three times).
  - The talking raccoon's atlas left the game; its recipe and raw sources
    stay (`art/recipes/raccoon-npc.json`). The park's 44x24 solid tuft under
    the old pup (a footprint for a critter that stood still) is gone; pups
    wander there now.
  - The reward's aura and timing ring are hidden: they peeked out from
    behind the sticker card before, and a coins-only reward has no card.
  - Recorders all share `tools/sim/recorder.ts` now (`meet` walks into a
    battle with a given kind, routing round the rest; `clear` calms what's
    out before a long walk; `approach` walks up to a talk target).
  - Real-key e2e that walked hand-written key paths through critter areas
    now play recordings instead (`new-game/east-road.json`,
    `new-game/bus-line.json`, `bay/bus.json`): a fresh critter can be
    anywhere in its den, and the recorder routes round it. `playAfter`
    (`tests/e2e/helpers.ts`) replays a run's shared start and plays the rest
    with keys. Jordan's e2e finds the calm hamster wherever it stands.
  - The album is five columns (ten stickers in two rows): four columns put a
    third row past the bottom of a phone's page.
  - The `woods` fixture's seed (26) is used now; the loader had hard-coded
    the fixture without it.

## Milestone 29: The arcade keeper **Status:** ✅ Completed (2026-10-07)
- The first person under the chaos spell. Claiming the clubhouse in the
  Whispering Woods turns up the hooded kid's note ("NEXT STOP: THE ARCADE.
  FIZZ THE HIGH SCORES!"), and the plaza's arcade door, locked until then,
  opens onto a painted arcade (from `arcade_interior.png`): a row of arcade
  cabinets, the ticket counter, a claw machine, and gumball machines.
- Mr. Pip, the arcade keeper (owner's NOTES.md "arcade operator"), stands
  fizzy on the floor: a mini-boss set piece with the gull's numbers, 1.15x
  Fae's height. Calmed, he pays 25 coins and his own sticker, and tells what
  the kid in the purple hood did: a purple fizzy soda that made him want
  only the high score, and a record on Star Racer whose initials they then
  scribbled out. The journal notes that the spell works on people too.
- A person is a critter kind like any other in the engine (his own species;
  battle content, atlas, and sticker), so no new battle rules were needed.
- Evidence: unit (`arcade.test.ts`: the clubhouse note, the locked door and
  its opening, Mr. Pip's numbers and set piece, the battle on touch, the
  reward and his talk, his talk point, the look points, the journal), the
  recorded run `pass-party/arcade.json` (`tools/sim/record-arcade.ts`: the
  woods run, back over the old trail, the bus home, the arcade, the battle,
  and his talk) with matching browser and Bun hashes, and real-key e2e
  (`arcade.spec.ts`: the locked door from the plaza; the run as key presses,
  shooting the arrival, the battle, and the reward at both sizes).
- Wording for the owner: the clubhouse's note (Jordan: "Hey, there's a note
  under the comics: "NEXT STOP: THE ARCADE. FIZZ THE HIGH SCORES!"" / Fae:
  "The arcade back in Cloverhollow? We'd better hurry!"); the locked door
  ("The arcade's door is locked. A sign says BACK SOON!" / "Beeps and boops
  are coming from inside..."); Mr. Pip's battle (`content/critters/
  arcade-keeper.json`: intro "Mr. Pip, the arcade keeper, spins round with
  swirly eyes. "NOBODY beats my high scores!"", his burst of prize tickets
  and tokens, and every command's lines); his talk ("Whoa... what happened?
  My head was all fizzy, like a shaken-up soda!" / "A kid in a purple hood
  played every game in here this morning." / "They gave me a purple fizzy
  soda to say thanks. One sip, and all I wanted was the high score!" / Fae:
  "So the fizz works on people too..." / "That kid set a new record on Star
  Racer, then scribbled out their initials in purple marker. Sneaky!" /
  "Thank you, Fae. You and your friends can play here any time."; again:
  "Mr. Pip polishes the claw machine. "Come back and play any time!""); the
  claw machine, the ticket counter, and Star Racer's lines; and the journal
  ("A note in the clubhouse said "NEXT STOP: THE ARCADE." The arcade is in
  the plaza, back home." then "Mr. Pip, the arcade keeper, drank a fizzy
  soda from the kid in the purple hood. The spell works on people too!" and
  "The hooded kid scribbled out their initials on the Star Racer high score.
  Someone from school again...").
- Notes and assumptions:
  - The arcade operator was "TBD" in NOTES.md: named Mr. Pip here, a jolly
    keeper in a striped paper hat and a teal apron full of tokens.
  - The arcade door trigger covers the whole painted door along the wall,
    and the spawn faces into the room.
  - The album now has eleven stickers; it stays five columns (a sticker and
    its name stay readable on a desktop), and a phone's page scrolls to the
    third row, like the notes (an e2e checks the last slot can be reached).
  - The gull's "bigger than any critter" test now compares it only with the
    recurring kinds; Mr. Pip, also a mini-boss, is taller.
  - `bay/bus.json` was re-recorded: its old walk through the plaza crossed
    the new arcade door, and the bus e2e's hand-written route to the stop
    goes round it now.

## Milestone 30: Story time **Status:** ✅ Completed (2026-10-08)
- The school chapter begins. Once Mr. Pip is calm ("Someone from school
  again..."), the journal sends Fae back to school. Ms. Maple, in the
  hallway, says story time is starting and goes into her classroom, and its
  door, shut until then, opens.
- Ms. Maple's classroom (a new painted room: chalkboard, the class art wall,
  cubbies, a reading corner with beanbags, five desks, the teacher's desk).
  Two classmates: Milo, who only knows someone beat the Star Racer high score
  and scribbled out their initials; and Rosie, who saw a purple hood peek in
  the door. The art wall has a nameless drawing of a masked face, a swirl,
  and a star: the doodle the lantern showed on the ski lift.
- Out in the hall, the kid in the purple hood is glimpsed, from behind, and
  runs off toward the gym, dropping a purple marker (the Star Racer
  scribbles' purple). Who they are stays a secret (owner, 2026-10-07): they
  are seen only from behind, and no line names them.
- Evidence: unit (`school-chapter.test.ts`: story time and Ms. Maple leaving
  the hall, the classroom door shut then open, the classroom's people on
  open floor and each talkable from a standable spot, the look points and the
  art wall's lantern line, Ms. Maple's story, Milo, Rosie and the hood's
  appearance, the glimpse and the kid leaving, nobody named, the journal),
  the recorded run `pass-party/school.json` (`tools/sim/record-school.ts`:
  the arcade run, then school, story time, the classroom, and the glimpse)
  with matching browser and Bun hashes, and the real-key e2e
  `school-chapter.spec.ts` (the classroom, the hall with the hood, and the
  glimpse, at both sizes).
- Wording for the owner: Ms. Maple ("There you are, Fae! Story time is about
  to start." / "Hang your backpack in your cubby and find a spot on the
  rug."; Fae: "Story time! Maybe someone in my class saw the kid in the
  purple hood."); the shut door ("The classroom door is shut. Story time
  hasn't started yet."); her story ("Today's story is about a dragon who
  sneezes bubbles instead of fire!" / Fae: "Bubbles... like the fountain this
  morning." / "Everyone in the village got very sticky. Settle in,
  everyone!"; again: "Remember, Fae: a kind word can calm almost
  anything."); Milo ("Fae! Did you hear? Somebody beat the Star Racer high
  score at the arcade!" / "I've been trying all year. And they scribbled out
  their initials, so nobody knows who!" / "Whoever it was must be really,
  REALLY good at Star Racer."; again: "Milo folds a paper airplane. "This
  one's a Star Racer!""); Rosie ("Psst, Fae! Somebody in a purple hood just
  peeked in the door!" / "Then they ran off down the hall." / Fae: "A purple
  hood? Here, at school? I have to see!"; again: "Hurry, Fae! They went down
  the hall!" or "Did you catch them? They're SO fast."); the glimpse ("Hey!
  You in the purple hood! Wait!" / "The kid zips around the corner, toward
  the gym. So fast!" / "They dropped something... a purple marker." / "The
  same purple as the scribbled-out Star Racer initials!"); the art wall, the
  cubbies, the reading corner, and the gym hall ("The hall to the gym. The
  doors are locked during story time." / "Tiny purple footprints lead right
  up to them..."); and the journal ("Ms. Maple said to be back in time for
  story time. Back to school!", then "Story time! Rosie and Milo are in my
  class. Maybe somebody saw the kid in the purple hood.", then "A kid in a
  purple hood ran off toward the gym! They dropped a purple marker, the same
  purple as the Star Racer scribbles.").
- Notes and assumptions:
  - Milo and Rosie are placeholder names for the two classmates NOTES.md
    lists as TBD; the music, art, and PE teachers and the principal are
    still to come. The gym is next: its doors lock during story time.
  - The hooded kid's single frame is a back view of a running kid, the hood
    up, nothing that could identify them. They stand at the top of the east
    hall, toward the gym, and Fae calls to them from their left, so both are
    in view on a phone (first placed lower in the hall, the dialogue box hid
    them).
  - The classroom's first geometry ran its floor off the painted floor, put
    Ms. Maple and Milo inside furniture, and gave the desks no occluders (Fae
    was drawn over them); it was retraced and checked with a depth preview
    (`art/review/classroom-depth.png`). The talk checks in the arcade's and
    the classroom's tests now require a spot where Fae can actually stand.

## Milestone 31: The gym and the lasso **Status:** ✅ Completed (2026-10-08)
- The school chapter goes on. After the glimpse of the kid in the purple
  hood, Ms. Maple ends story time: time for PE. The gym doors at the east end
  of the hall, locked until then, open on the school gym (a new painted room:
  a basketball court, the hoop, a climbing rope with a bell, a bin of bouncy
  balls, the blue mats, bleachers, and the back door to the playing field).
- Coach Ash, the PE teacher: the kid in the purple hood dashed through,
  knocked over his equipment cart, and ran out the back door. His stopwatch
  and his clipboard are missing. A fizzy pup zooms round the court with the
  stopwatch (a pup set piece with indoor lines; calmed, it drops it), and the
  clipboard is hooked on the basketball hoop, too high to reach, so Coach Ash
  lends Fae his lasso (twisted rainbow rope, a wooden star on its handle,
  from the owner's tools concept). The lasso loops the clipboard down, and
  with both back he lets her keep it: "It can pull down things that are up
  high, and swing you across gaps, too!" (NOTES.md). The back door only opens
  from outside; purple footprints lead to it.
- Evidence: unit (`gym.test.ts`: PE time and Ms. Maple, the gym doors locked
  then open and the way back, Coach Ash and the look points talkable from
  standable spots, the gym pup a pup with the pup's sticker, clear of the door
  and the coach, its battle and calm talk, the hunt in every order, the lasso,
  nobody named, and the journal; `gym-replay.test.ts`), the recorded run
  `pass-party/gym.json` (`tools/sim/record-gym.ts`: the school run, then PE,
  the gym, the pup, the hoop, the lasso, Coach Ash's thanks, and the back
  door) with matching browser and Bun hashes, and the real-key e2e
  `gym.spec.ts` (arriving in the gym, the pup's battle, and the lasso, at
  both sizes). The school run now ends by walking into the locked gym doors.
- Wording for the owner: Ms. Maple ("That's the end of our story! Time for
  PE, everyone." / "Coach Ash is waiting for you in the gym, at the end of
  the hall."; Fae: "The gym! That's where the kid in the purple hood was
  headed."); Coach Ash ("TWEET! Oh, hi, Fae! Whew, what a morning." / "A kid
  in a purple hood dashed through here and knocked over my equipment cart!" /
  "Then they ran straight out the back door, to the playing field. Fast
  kid!" / "My clipboard went flying, and a fizzy pup ran off with my
  stopwatch!"; choices "I'll get them back!" ("That's the spirit!") and "Did
  you see who it was?" ("Nope. Just a purple hood and a cloud of dust! Can
  you help me find my things?"); with the pup already calm: "Hey, you've got
  my stopwatch! The pup had it? Thanks, Fae!" / "Now if only I could find my
  clipboard. It went flying!"; the hunt: "How's the hunt going?" / "That
  fizzy pup still has my stopwatch! Calm it down, and maybe it'll drop it." /
  "My clipboard went flying. I heard it clatter somewhere up high." / "Give
  that lasso a twirl at the hoop!"; the lasso: "Up on the hoop? I can't reach
  that either." / "Here, take my lasso! I used to rope cones with it at
  summer camp." / "Coach Ash hands Fae a lasso of twisted rainbow rope, with
  a wooden star on its handle."; thanks: "My stopwatch AND my clipboard!
  You're a star, Fae!" / "Keep the lasso. It can pull down things that are up
  high, and swing you across gaps, too!"; again: "Keep that lasso handy, Fae!
  And watch out for that purple hood."); the hoop ("There's Coach Ash's
  clipboard, hooked on the rim! It's way too high to reach." (or "There's a
  clipboard hooked on the rim!" before he asks) / "Fae twirls the lasso once,
  twice... and loops it right over the clipboard!" / "Got it! Coach Ash's
  clipboard." / "The basketball hoop. Nothing stuck up there now!"); the ball
  bin, the climbing rope, and the back door ("The back door to the playing
  field. It clicked shut behind the kid in the purple hood." / "It only opens
  from outside. Purple footprints lead right up to it..."); the gym pup
  ("A fizzy pup zooms around the gym with something shiny in its mouth!", its
  bouncy-ball Play and burst, "The pup flops down with a happy sigh, and drops
  what it was carrying: a shiny stopwatch!"; calm: "Woof! The pup flops down
  and wags its whole body." / "I've got Coach Ash's stopwatch back. Good pup!"
  or "It dropped a shiny stopwatch. Whose could it be?"); and the journal
  ("The gym doors are locked during story time. Ms. Maple will know when it's
  over.", "Time for PE! The gym is at the end of the hall.", the hunt's notes,
  and "Coach Ash gave me his lasso! It can pull down things that are up high,
  and maybe swing across gaps too.").
- Notes and assumptions:
  - Coach Ash is a placeholder name (the plant names of Ms. Maple and Nurse
    Holly); his look is the PE teacher on the owner's staff sheet, drawn
    without the lasso, stopwatch, or clipboard, since the story takes them
    away. The gym has no concept sheet, so it was painted in the school's
    style to sit beside the hallway and the classroom.
  - NOTES.md has the lasso "after completing a quest" for the PE teacher. The
    quest reuses what the game has (a set piece battle, Look points, story
    variables) rather than a new mechanic. The lasso is a story item for now
    (`has_lasso`, checked by the hoop's knot): no button, no prompt of its
    own, and nothing in the world changes yet. Pulling levers and swinging
    across gaps wait for a place that needs them.
  - The gym pup is a pup, so it shares the Pond Pup sticker (each species
    gives its sticker once); a Fae who already has it gets 8 coins.
  - The hall's `gym-hall` Look point became the gym doors (a trigger along
    the floor's east edge, like the arcade's door): the same locked line,
    then the way in. The school run was re-recorded to walk into them.
  - The gym's first geometry let Fae walk onto and behind the mats, gave the
    bench pair no blocker or occluder, left the right half of the double door
    out of its trigger, and ran the floor past the paint; a flood fill of
    every standable spot over the painting found them, and a second pass
    fixed them. The bench pair's occluder then reached up to 75 units above
    the bench's painted top, over the court where the pup stands; it was
    retraced to the bench's measured outline.
  - So the next room's first review catches these, the area overlay
    (`tools/art/area-overlay.ts`) now reads the area with the game's own
    parser and also draws, in green, every spot Fae's feet can reach from a
    spawn, plus the doors and people's footprints
    (`docs/art/area-authoring.md`).

## Milestone 32: The props engine and the plaza kit **Status:** ✅ Completed (2026-10-08)
- The owner chose the area kit (2026-10-08, after a spike on the plaza: "the
  new version is way better. Refactor everything in this manner"). An area is
  painted whole, approved, then split into a ground plate and props: every
  object Fae can walk behind or bump into is a prop with its own ground
  footprint (solid), its own depth (column by column, from the front edge of
  its footprint), a multiply shadow decal, and states (spec 6.2).
- Engine: props in `src/core/props.ts` (state rules from Ink, the scenery
  area, front edges, cover) and `src/content/props.ts` (catalogues and
  placements, resolved into world units by the loader); the renderer draws
  each prop as strips of its frame sorted by their front edge, shadows on the
  ground layer, canopy props fading like canopies, and the battle backdrop
  from the plate with its props. Colliders step with `resolveMove`, which
  slides along one axis, or stays, where a gap narrower than the collider
  defeats the solver. The area checks count every footprint of every state as
  solid, and the hiding and den checks include props.
- The plaza is the first kit: 20 props (the fountain; six benches; four lamp
  arches; two planters and the flowerbed; the notice board; three trees; two
  bushes). Seven are lifted, with their ground painted in and their shadows
  as decals: the fountain, the north, northwest, southeast, and south benches,
  and the two planters. The rest are painted (they overlap a neighbour at the
  plate). bench-southeast has a smashed state. The house and the four shops
  stay blockers; the plaza has no occluders.
- Pipeline: `tools/art/kit.ts` (`gen`, `masks`, `fill`, `pack`, `place`) with
  one config per area (`art/kit/<area>.json`) and its docs
  (`docs/art/kit.md`). The approved painting is kept in
  `art/source/areas/plaza/painting/`, the chosen samples in
  `art/source/areas/plaza/kit/`; a rebuild makes no Gemini calls and writes
  byte-identical files.
- Evidence: unit (`props.test.ts`: placing and flipping, state rules from real
  Ink, solid only in the current state, front edges across gaps, cover
  column by column, the narrow gap, Fae stopped by the south bench, the
  loader's refusals, the area checks, and every catalogue frame in its atlas),
  the re-recorded runs (below) with matching browser and Bun hashes, and the
  real-key e2e `plaza.spec.ts` (the south-east arch over Fae north of it and
  under her south of it; the east bench stopping her at its painted edge,
  where the old box let her 59 units into it). Viewed in game: behind the
  north-east arch's leg, behind the notice board (fading), the frog battle's
  backdrop.
- Notes and assumptions:
  - The new rule changes nothing where it isn't used: with the plaza as it
    was, every unit test, replay, and hash matched main.
  - Gemini calls: 104 in the spike (kept), 18 in rejected spike passes, and
    18 in this milestone (the new subjects' isolates and bench-north's
    completion).
  - bench-north is finished where the fountain hid its front legs, so it
    stays whole when the fountain moves (the kit's `complete`).
  - The den check measured one point (a critter's middle); a thin lamp post
    over that point counted the critter hidden while most of it showed. It
    now counts a spot hidden when over half a critter's body (50 by 70 units)
    is behind scenery: the park's tower den still fails, every real den
    passes. The south-west plaza den moved from (620, 770) to (620, 810),
    clear of the arch.
  - The trail check in `core.test.ts` walks south of the fountain: its loop
    ran into the north-east arch's back leg, which is solid now.
  - Re-recorded (their old runs no longer fit the plaza): chapter one, the
    east road, the bus line, the bay bus, the bakery, the arcade, the school
    run, and the gym; `follower-ends.json` re-pinned for the six scripts
    that cross the plaza.
  - The notice board's footprint is a bar along its foot line: its panel
    hangs at Fae's chest height between the posts, and two post feet let her
    walk through it. The kit docs say so for boards and signs.
  - Drawing every painted prop over the plate made a plaza frame about 18%
    slower in software-rendered Chromium (a 10-tick step and a state read,
    189 ms against 160), and four long real-key flows ran past their 180 s
    budget there. A painted prop is now drawn only where it overlaps someone:
    the plate already shows it everywhere else. Frames cost what they did on
    main (165 and 151 ms against 165 and 151).
  - The plaza's decoded textures: the plate 30.8 MB and two prop pages
    17.5 MB, under the 96 MB budget.
  - E2E: the specs' five copies of `walk` became one shared helper, which
    ends the walk when a door's fade starts (the caller steps through it);
    one copy kept holding the key through the fade and walked on in the next
    room. The bus stop route was found again with the recorder, whose
    `approach` now counts props as solid; the cat meets Fae 6 ticks sooner
    in the re-recorded chapter one.

## Milestone 33: The indoor kits **Status:** ✅ Completed (2026-10-08)
- The six indoor rooms are kits (spec 6.2), as the owner asked: the bedroom,
  the kitchen, the school hallway, Ms. Maple's classroom, the gym, and the
  arcade. Each piece of furniture is a prop cut from the approved painting,
  with its own ground footprint and depth; none of the rooms has occluders
  left, and every painting is byte for byte as it was (the props are all
  painted, so no plate was touched).
- What a prop is (spec 6.2, `docs/art/kit.md`): one object, whole from its
  top to its feet, and nothing else. A desk and its chair, or a table and its
  chairs, are one prop; things fixed to a wall (the classroom's chalkboard,
  the kitchen's banister run) stay in the painting; a pocket nobody should
  enter, or a gap too narrow to walk through, is a plain blocker, not part of
  a footprint. A prop's footprint is its own floor contact, from the wall to
  its front for wall-backed furniture.
- Checks that hold the kits to that, all run by `just check`:
  - `propDrawingErrors` (`src/content/area-checks.ts`): each prop's picture
    covers every column of its footprint (where no neighbour stands in front
    of it) and reaches to within 15 units of its front. The first indoor
    pass failed it 38 times: pictures that were the tops of objects, a claw
    machine cut down to a speck, a bed footprint 44 units past the bed.
  - One floor per room (`areaConnectionErrors`): every spawn reaches every
    other. A sofa footprint cut the kitchen in two, stairs from front door.
  - `tools/art/kit.ts` stamps each subject's samples with the crop they came
    from (`crop.json`): a changed crop draws its subject again, and stale
    kept samples are passed over. `masks` reports errors (a seed or footprint
    outside the crop), which `pack` refuses, and warnings (a mask running into
    its crop's edge).
  - Review tools: `tools/art/prop-frames.ts` (every packed picture on teal,
    with its footprint and front edge), `tools/art/depth-preview.ts` (Fae
    behind and in front of each prop, by the renderer's rule), and the area
    overlay, which now draws prop footprints and uses the area checks' own
    flood fill.
- Evidence: unit (`props.test.ts`: every prop drawn whole, the drawing check
  failing on a footprint pushed off its picture, a wall of crates splitting a
  room; `core.test.ts`: the bedroom corridor test on the bed prop, the kitchen
  spawn), the recorded kit walks (`tools/sim/record-kits.ts`: in each room,
  behind a prop, in front of it, and into it) with matching browser and Bun
  hashes, the real-key e2e `kits.spec.ts` (each walk with real keys: the prop
  drawn over Fae behind it and under her in front), and `bedroom.spec.ts` on
  the bed prop. The sim gate and the test helpers count props as solid.
- Notes and assumptions:
  - Every indoor prop is painted, not lifted: nothing indoors moves or breaks
    yet, painted props need no generated floor, and the plates stay the
    approved paintings. Any prop can be lifted later by giving it a hole.
  - Gemini calls: 102 for the six rooms (the arcade 41, the classroom 15, the
    bedroom and the kitchen 14 each, the gym and the school 9 each), most of
    them second samples after the first crops proved too small.
  - One worker's pass replaced six arcade and school samples with images
    built by hand from the old occluder cutouts. They were replaced with the
    model's real outputs, and `docs/art/kit.md` now says every kept sample is
    the model's own.
  - The kitchen's `stairs` spawn moved from (500, 650) to (600, 650): a third
    party member had nowhere to stand at the old one. The door round trip's
    walk back to the stairs is 25 ticks longer for it.
  - The island's footprint covers its base, so its counter is no longer
    walkable. The bed's footboard is an upright edge so a walk along the wall
    stops square at it (the morning run's route is unchanged).
  - Re-recorded where they cross these rooms: chapter one, the east road,
    the bus line, the school run, and the gym; `follower-ends.json` re-pinned
    for the bedroom, chapter one, the door round trip, and the morning.
  - Milestone 34 (the outdoor kits) checks a footprint against its drawing in
    `kit.ts` with a 30-unit limit; this milestone's `propDrawingErrors` holds
    every area to 15 in `just check`. When Milestone 34 rebases, the outdoor
    kits meet the shared check.

## Milestone 34: The outdoor kits **Status:** ✅ Completed (2026-10-08)
- The five outdoor areas are kits (spec 6.2): Meadow Park, Bubblegum Bay,
  Pinecone Pass, the Cliffside Trail, and the Whispering Woods. With
  Milestone 33 every area is a kit and none has occluders left.
- Each prop is its own object cut from the approved painting, footed on its
  own ground contact, with the M33 checks (`propDrawingErrors`, one floor per
  area, the hiding check) holding every area in `just check`. Trees and ferns
  Fae walks behind are canopies. Every prop is painted but the woods' south
  log, which is lifted with its ground inpainted.
- Notable props: the bay's dock rail is one prop (`dock-rail-south`) in place
  of 24 occluder slivers, since a prop sorts column by column along its foot;
  the trail's footbridge is one near-rail prop (the deck and the far rail
  stay in the painting); the pass's footprints are its old tested blockers,
  so every pass replay walks exactly as before.
- Evidence: the area checks and `props.test.ts` over every area; the bay's
  depth tests and the canopy tests ported to props; the replays re-recorded
  where they changed (the park's chapter-one chain, the trail's lookout, and
  the lantern run) with matching browser and Bun hashes; the e2e specs that
  named occluders (the snowman, the palm canopy, the footbridge) read prop
  strips.
- Notes and assumptions:
  - Gemini calls: 123 (the woods 44, the pass 25, the bay 20, the park and
    the trail 17 each), many of them re-isolates after crops that missed the
    object or seeds placed on the wrong thing.
  - `tools/art/geometry/pass.ts` and `woods.ts` are gone; `trail.ts` still
    writes the trail's floor and blockers.
  - Added blockers where the floor behind an object shouldn't be entered: the
    pocket behind the park's tower, the forest behind the woods' tree house,
    and one under the woods' west log. The park's two side fences became props
    in place of their blockers.
  - The woods' west and north logs stayed painted after their inpainted
    ground failed `pack`'s fill check; the park's basket too.
  - Owner review of every area's props is deferred (owner, 2026-10-08: "we'll
    review everything later"): `art/review/<area>-kit-frames.png`,
    `<area>-kit-depth.png`, `<area>-kit-overlay.png`.

## Milestone 35: Occluders retired **Status:** ✅ Completed (2026-10-08)
- Props are the only scenery path. Gone: the area format's `occluders`, the
  cutout manifest and its parser, the occluder halves of the hiding check and
  of canopy fading, the renderer's cutout sprites (`occluder:<id>`),
  `tools/art/area-occluders.ts`, and the occluder layer of
  `tools/art/area-overlay.ts`. `tools/art/geometry/trail.ts` writes only the
  trail's floor and blockers and reproduces `content/areas/trail.json` byte
  for byte.
- Tests: three tests looped over occluder lists that had been empty since
  Milestone 34. The bay's is gone (`bay-depth` checks its props against the
  paint map), the pass's checks every pass prop against its paint map (all at
  or above its 0.4 threshold), and the canopy test's shade is a real canopy
  prop. One test now holds every area's asset folder to its plate and prop
  atlases, in place of the bay's own.
- Evidence: `just check` (417 tests: the bay's two above are the only ones
  gone), `just build`, and `just e2e` (376 passed, 2 skipped) against
  unchanged baselines; no recording changed.
- Notes: no content, runtime art, recordings, or baselines changed.

## Milestone 38: The music room and the flute **Status:** ✅ Completed (2026-10-09)
- The school chapter goes on after PE. When Coach Ash thanks Fae, he sends
  her to music class (`music_time`): "Oh, and music's next! Ms. Willow's room
  is down the east hall."
- The east hall (area `east-hall`, painted whole and split into a kit): the
  school hall's floor ran off its east edge "toward the gym", and that
  corridor is now a room of its own. It holds the gym's double doors (locked
  until `pe_time`, knot `gym_hall`, as before), the music room door (locked
  until `music_time`, knot `music_closed`), and a closed door with a palette
  sign for later (Look point `art-room`). The hall's east edge leads into it
  (trigger and spawn `east-hall`, in place of `gym-doors`), and the gym's door
  leads back out into it.
- The music room (area `music`, painted whole on the classroom's frame and
  split into a kit): a rainbow xylophone on the rug, an upright piano with its
  bench, a shelf of small instruments, the class song poster scribbled over in
  purple, and the open window the kid climbed through.
- Ms. Willow, the music teacher (a placeholder name; the owner's staff sheet:
  curly hair, music-note earrings and scarf, her silver flute). Before class,
  someone in a purple hood climbed in through her window, scribbled purple
  all over the class song, and climbed back out, and a bluebird flew in after
  them and took her chime mallet.
- The quest:
  - The music bird (set piece `music-bird`, a bluebird, "Flappy Bluebird" in
    battle) flutters round the room. Calmed, it has dropped the mallet, like
    the gym pup's stopwatch; listening to it (`heard_bird`) gives the song's
    last note, the one under the scribbles: a bright note like the red bar.
  - Ms. Willow remembers how the song starts: red, yellow, blue
    (`song_start`).
  - The xylophone (prompt `Play`) takes four bars from Red, Yellow, Green,
    and Blue, or Stop. Each line shows the tune so far and plays its bar's
    note; after four, the song is judged. A wrong song ends with a hint
    toward whatever Fae is missing.
  - Red, yellow, blue, red earns Ms. Willow's very first flute, the painted
    wooden one from the owner's tools concept. Fae plays it once, its own
    little melody (`has_flute`). After that the xylophone is free play.
- The flute is a story item for now, like the lasso: no button. Calling
  animal friends (NOTES.md) is a milestone of its own.
- Sound: a story line may carry a `sound:` tag naming a story sound (the four
  xylophone notes, a wooden-bar tone with an overtone; the flute, with a
  breath of noise under it). The dialogue state carries it, and the sound
  projection plays it when the line appears, a repeated line included.
- Five or more dialogue choices on a short screen sit in two columns, filled
  top to bottom: the xylophone's five ran off the top of an 874x402 phone.
- Evidence: unit tests (`music.test.ts`: the story in every order, the song
  right and wrong, Stop, free play, the journal, the sound projection;
  `east-hall.test.ts`: the doors both ways and their locks; the area checks
  and the drawing check over both rooms; the music replay), the recorded runs
  `pass-party/school.json` and `gym.json` re-recorded through the east hall
  and the new `pass-party/music.json` (`tools/sim/record-music.ts`: Coach
  Ash's thanks, the east hall, Ms. Willow, the bird, the song, the flute),
  kit walks for both rooms, and the real-key e2e `music.spec.ts` (the east
  hall, the music room, the xylophone, and the flute at both sizes; the cue
  log plays the bird's red note, then red, yellow, blue, red, then the flute;
  browser and Bun hashes match). The UI gallery's five-choice state keeps
  every choice on screen at every size, in Chromium and WebKit; without the
  two-column rule that check fails. `just check` 435 tests, `just build`,
  and `just e2e` (387 passed, 2 skipped). Every changed screenshot was viewed.
- Notes and assumptions:
  - The school hall has no free wall for another door (lockers, the notice
    board, windows, and the nurse's door fill it), and adding one to the
    approved painting would mean replacing something. So the corridor the
    hall already runs into became the east hall, which has room for more
    school rooms later (the art teacher, the principal: NOTES.md).
  - Ms. Willow is a placeholder name, after Ms. Maple, Nurse Holly, and Coach
    Ash. She keeps her silver flute (the staff sheet draws her with it);
    Fae's is the wooden one from the tools concept.
  - The music bird is a bluebird, so it shares the bluebird's sticker (each
    species gives its sticker once).
  - Gemini calls: 23 (the east hall's painting 7, including a repaint; the
    music room's 2; the kits 12; Ms. Willow 2). The east hall's first painting
    was drawn about 1.75x the hall's scale in another palette, and was
    repainted with the hall as the first reference.
  - Both rooms' first geometry was a rectangle over the whole painting, with
    every prop a canopy and door triggers mid-floor; it was retraced: the
    music room on the classroom's floor, the east hall from the walls'
    wainscot line, column by column. Footprints are each object's base.
  - The east hall's `west` spawn is at (260, 620), clear of the narrow wedge
    where the floor runs off its left edge, so the whole party lines up
    behind Fae; the kit walks start from each room's real spawn.
  - Ms. Willow's look and name, both paintings, and the wording are in the
    owner's review queue, with the earlier deferred reviews.

## Milestone 39: Recess on the playing field **Status:** ✅ Completed (2026-10-16)
- The school chapter goes on after music. Ms. Willow's flute rings the bell:
  recess (`recess`). Coach Ash props the gym's back door open; it leads out to
  the playing field behind the school (area `field`, painted whole and split
  into a kit), where the kid in the purple hood ran at PE.
- The lasso changes the world for the first time:
  - A gap: a fizzy squirrel (set piece `oak-squirrel`, a squirrel) pelts
    acorns from the old oak by the creek. Calmed, it tells how the kid swung
    across the creek on the oak's branch, so Fae loops the lasso over it and
    swings across (a `travel:` within the field, as often as she likes).
  - The far bank: the hooded kid's stash behind the stump (purple markers, a
    fizzy soda, a Star Racer token), and a glimpse that's gone again.
  - A lever: high on the old footbridge's post, too high to reach; the lasso
    pulls it (`bridge_down`). The footbridge swings down across the creek
    and the lever drops, and that's the way back.
- The engine gains crossings and flat prop states (spec 6.2): water that's
  solid until a story flag lays a way over it, and a prop state that lies
  on the ground (the lowered bridge), drawn under everyone. The area checks
  walk every combination of an area's crossing flags, each prop in the
  states its rules allow then. The kit cuts a state from a second painting
  of the area (`stateOf`, `painting`).
- Evidence: unit tests (`field.test.ts`: recess, the back door shut then
  open, the crossing shut then open with real steps, the bridge and lever
  states, the swing, the stash, the lever, the squirrel's tale, every look
  point and the squirrel within reach, the journal, nobody named;
  `field-replay.test.ts`; `crossings.test.ts`; a props test that the area
  checks lay a crossing's way open with the props its flag switches, which
  fails without them), the recorded run `pass-party/field.json`
  (`tools/sim/record-field.ts`, on from the music run), and the real-key e2e
  `field.spec.ts` (arriving, the squirrel's battle, the far bank, the bridge
  coming down with its strips gone, and walking over it, at both sizes).
  On the tree rebased onto main: `just check` (494 tests), `just build`,
  and `just e2e` (392 passed, 2 skipped). Every new or changed screenshot
  was viewed.
- Notes and assumptions:
  - The playing field has no concept sheet; it was painted in the outdoor
    areas' style (art/recipes/field.json): one painting, an edit raising the
    footbridge for the default state, and an edit lowering it, cut by the kit
    into the bridge's and lever's second states. 12 painting calls and 75 kit
    calls (art/recipes/field-kit.json).
  - The field's first floor was traced from the painting's colours and ran
    up into the pines and the bushes on the east bank and over the hedge;
    it was retraced along their feet.
  - The pocket behind the raised bridge and its back post is a blocker:
    the raised deck and the posts would hide Fae there, and the lowered
    deck lands beside it. The bridge's posts are a canopy: they fade while
    Fae crosses the landing behind the front post.
  - The kit keeps an `exclude` polygon in the plate: a lifted prop's hole
    skips it (the lever's post and hub stay painted; only its handle lifts).
  - The gym run now ends by walking into the shut back door; the music run
    is re-recorded after it, the same beats.
  - The squirrel is a squirrel, so it shares the Acorn Squirrel sticker.
  - The playing field, its two paintings, the squirrel's lines, and the
    wording are in the owner's review queue.

## Milestone 40: Battle checks **Status:** ✅ Completed (2026-10-17)
- Battles stop being one ring for everything (owner, 2026-10-17, "I like the
  suggestion order, work on those", from `docs/battle-ideas.md`). Every
  Fae-side command and every burst plays a check (`battle.check`) that ends
  in the grade the old calm and energy math already reads: the ring (Soothe,
  Maddie's Play as her pounce, and most bursts), a charge (Sue's Cast: hold
  confirm and let go in the green), or a beat chain (Jordan's Juggle, both
  frogs' bubbles, the bunny's thumps: press as each one lands).
- Friends decide how Fae calms and critters how they burst: Soothe's check is
  in `content/battle.json`, each friend's in its party file, and a critter's
  burst names its own (`burst.check`, with an optional bigger `burst.big`).
  The sixteen critters' identical `timing` blocks are gone.
- The big roll is made when a burst's check starts (one draw, before anything
  else it generates), so a big chain shows its extra beats; a ring burst comes
  out as before for the same seed and presses. A chain gives each press to
  the beat whose arrival is nearest and resolves at most one beat with it, so
  mashing misses and a late press never costs the next beat.
- On screen: Sue's meter stands beside her, Jordan's pinecones drop into his
  hands, the frog's pink bubbles fly at Fae, and a hint sticker hangs under
  the party while a check waits for its first press. The beats are small
  stickers drawn in code. Each hit pops with a new `battle-beat` sound.
  `renderInfo().battle.check` replaces `.ring`.
- Save: no new version. A save is only written after a battle ends, so
  `battle` is always null in one, and `parseSave` now refuses one where it
  isn't (spec 10).
- Evidence: core unit tests for each check's rules, the loader's rejections,
  the battle wiring and the burst's roll, the sounds, and the save
  (`checks.test.ts`, `check-loader.test.ts`, `battle-wiring.test.ts`,
  `sound.test.ts`, `save.test.ts`); every recorded run with a Cast, a Juggle,
  a frog, or a bunny re-recorded, with the runs that start from them; a
  recorder for the frog's win and rest (`tools/sim/record-frog.ts`), which
  had been timed by hand; and real-key e2e: the frog's bubble chain, Sue's
  Cast held on a key and on the touch sticker, Jordan's pinecones, and the
  gallery's new states. Gates: `just check` (544 unit tests, every sim,
  purity, lint), `just build`, and `just e2e` (426 passed, 2 skipped, on
  Chromium and WebKit). Every changed screenshot was viewed: 30 differ only
  in the harness readout's tick (checked pixel for pixel outside it), 33 by
  the later tick's roaming critters, aura phases, and party spacing, and 10
  are new (the frog's GREAT ring, Sue's meter, Jordan's pinecones, the
  gallery's charge and chains).
- Notes and assumptions:
  - Starting numbers (spec 8): Cast holds to 44 of 60 ticks (windows 5 and
    11), Juggle's four pinecones land 24 ticks apart, the frogs' three
    bubbles (five when big) and the bunny's three thumps (five) have an
    8-tick window. Every timed part fits in 180 ticks; a charge waits up to
    180 ticks for its first press, untimed.
  - The chain spec's window is `hitWindow`: a field named `window` would
    have needed the core purity check to stop banning the browser global.
  - Soothe stays the ring (the owner confirmed it, 2026-10-17), and the
    proposal's gentle-timing setting isn't built; it is still an open
    question in `docs/battle-ideas.md`.
  - `tools/sim/roam.ts` meant to run from its roaming frog but chose Run
    while the prompt was still typing (ignored), so its battles had ended by
    resting. It waits for the prompt now and really runs.
  - The fixed follower ends (`tests/unit/fixtures/follower-ends.json`) for
    chapter one and the frog's win and rest are refreshed. Chapter one ends
    exactly where it did, 189 ticks later.
  - Battle screenshots taken after a battle show a later tick in the
    harness readout; those baselines were updated after viewing them.
  - Found on the way: the new check overlay first left its grade sticker in
    the page outside battles (an empty sticker in the top-left corner of
    every screenshot); it starts hidden now. A chain also reused the last
    chain's icons, so bubbles after pinecones would have kept the pinecone
    drawings; a gallery test checks the switch and a shorter chain.
  - The bay's Cast test pressed after a fixed 70 ticks; it plays the charge
    now and checks Sue's GREAT line. The plaza cat test's pinned meeting tick
    moved with chapter one (3011 to 3200).

## Milestone 41: Catch **Status:** ✅ Completed (2026-10-17)
- The nine "flurry" bursts become something to catch (owner, 2026-10-17,
  `docs/battle-ideas.md`): tennis balls (the Zoomie Pup and the gym pup),
  yarn (the Pouncy Cat), acorns (both squirrels), snowballs (the hamster),
  bottle caps (both raccoons), and tickets and tokens (Mr. Pip) fly at Fae in
  three lanes, and she holds up, nothing, or down to have her catch in each
  toy's lane as it lands. No button: a new check kind, `catch`, reads the
  stick or arrows (spec 8). Every toy caught is great, half good, like a
  chain, and each catch plays `battle-beat`.
- The big burst is now something the player sees: four toys, or six when
  the roll comes up big (base damage 2, as before). A burst draws its big
  roll first, then one lane per toy, so ring and chain bursts draw exactly
  what they did.
- The toys are cut from the approved critters' burst frames, pixel for pixel
  (no generation; `art/recipes/toys.json`, `tools/art/build-toys.ts`), into
  one atlas the battle overlay crops, drawn at the critter's own scale. The
  build fails unless the atlas is RGBA and every toy equals its source: the
  first cut wrote a greyscale atlas, every toy grey, which its byte-identical
  rebuild check had only proved reproducible.
- On touch the stick is hidden in battle, so two arrow stickers stand in its
  place while a catch is in play (`data-check="catch"`). The shell lets go of
  them outside a catch, so an arrow held as the catch ends can't walk Fae
  off in the overworld.
- The squirrels', hamster's, and raccoons' burst lines said Fae ducked or
  dodged; they say she catches now. Mr. Pip's good line too.
- Evidence: core unit tests for the catch's rules, the lanes, the burst's
  draw order and damage, the loader, the content (every toy frame exists),
  and the sound (`checks.test.ts`, `battle-wiring.test.ts`,
  `check-loader.test.ts`, `catch-content.test.ts`, `sound.test.ts`); every
  recorded run meeting a flurry critter re-recorded, with the runs that start
  from them, the recorder catching each toy in its lane on arrows only;
  real-key e2e (`catch.spec.ts`: a pup's catch on held arrow keys, and the
  arrow stickers on touch at 874x402) and the gallery's catch state. Gates:
  `just check` (565 unit tests, every sim, purity, lint), `just build`, and
  `just e2e` (439 passed, 2 skipped, on Chromium and WebKit). Every changed
  screenshot was viewed: 24 differ only in the harness readout's tick
  (checked pixel for pixel outside it), 28 by the later tick's roaming
  critters, aura phases, and party spacing (the plaza cat battle by its
  blurred backdrop, read from the bus-line run now), and 7 are new (the
  catch mid-flight on keys and on touch, the hint clear of the arrows, and
  the gallery's catch).
- Notes and assumptions:
  - Lanes are heights, not left and right: the battle is staged side-on,
    toys flying right to left from the critter to Fae, so three heights read
    at a glance where left and right spots wouldn't until a toy landed.
  - Toys land 24 ticks apart (20 when big), 50 ticks in flight: time to see
    each one's lane and move. A catch ends by tick 154.
  - The first toy can't land before its 50 ticks of flight, and the hint
    ("Hold up or down to catch each one!") shows until it does. It hangs
    midway between the catch and the critter: first drawn under Fae, it sat
    behind the touch arrows on a notched iPhone, where the arrows stand past
    the safe-area inset. `catch.spec.ts` emulates that notch and checks the
    hint clears both arrows.
  - The lane draws follow the big roll in the same PRNG, so every later
    roll in a run shifts. Chapter one's plaza now rolls two raccoons where it
    rolled a cat (Fae calms both: 40 coins, three stickers); the cat battle
    test reads the bus-line run instead, which still meets one. The runs that
    never meet a flurry critter (the bay, the bus, the trail, the hall pass,
    the lookout, the frog's win and rest) re-recorded byte for byte.
  - The e2e plays the pup run's second catch, a big one whose six toys use
    all three lanes, so the keys and the stickers are each tested high,
    middle, and low.

## Milestone 42: Feelings **Status:** ✅ Completed (2026-10-17)
- The menu becomes a choice (owner, 2026-10-17, `docs/battle-ideas.md`):
  once Sue has joined, a chaos critter shows what it feels each turn in a
  thought cloud (zoomy, curious, bored, grumpy, or hungry), and the command
  that answers it (Play, Cast, Juggle, Soothe, or Snack) wears the feeling as
  a badge and is worth 15 more calm. The next turn's feeling rides in the
  cloud's trail of thought dots, so a player can save Sue for the curious
  turn; the lantern, once Fae has it, shows the one after too.
- Each kind lists the three feelings it can have (`feelings`): the pups and
  squirrels zoomy and hungry, the cats and raccoons curious, the owl and the
  gull grumpy, Mr. Pip bored. A feeling Fae can't answer now never shows:
  without Sue no curious, without Jordan no bored, without a snack no hungry.
- The draws (spec 8): three as the intro ends, then one at each new turn's
  menu, from the same seeded PRNG. With feelings off (Maddie alone) nothing
  is drawn, so every battle before Sue joins plays exactly as it did.
- The thought cloud first sat in the HUD row, between the ENERGY and CALM
  stickers: on a 667 px iPhone SE, or with a notch, that band is 70 px wide
  or less, and the cloud overran CALM. It floats in the open ground between
  the party and the critter now (`battleFeelingAnchor`), placed from the
  battle layout, and was checked at 667, 812, 852, 874, and 1280 px wide.
- The journal's coin and cookie moved into `src/ui/icons.ts` with the feeling
  icons, so hungry is the same cookie as Fae's snacks.
- Evidence: core unit tests (`feelings.test.ts`: off with Maddie alone and
  no draws; the three draws and each one's pick; the availability filter;
  the turn boundary; the bonus for Snack, Soothe, and a friend's command,
  on a miss too, clamped; the badges; the view by phase; the lantern peek
  with a real lantern from Jordan's run, its sound, and the overworld
  lantern untouched; `check-loader.test.ts`: the content's rejections);
  every recorded run re-recorded; real-key e2e (`feelings.spec.ts`: the
  frog curious, Cast badged and answered with a held key for 60 calm, and no
  feelings with Maddie alone; the lantern's peek on a real L in the woods
  owl's battle; the cloud clear of the HUD, the commands, the message, and
  the touch buttons on a notched 874 px phone and a 667 px iPhone SE); and
  the gallery's feeling states at both sizes. Gates, on the tree rebased
  onto Milestone 43: `just check` (599 unit tests, every sim, purity, lint),
  `just build`, and `just e2e` (468 passed, 2 skipped, on Chromium and
  WebKit; the battle flows run again after counting only fighting friends). Every changed screenshot was viewed: 28 differ only in the
  harness readout's tick (checked pixel for pixel outside it; 10 of them the
  clubhouse run's, which reaches the same screens 307 ticks sooner), 34 by
  the battles' new clouds and badges and the later runs' ticks, roaming
  critters, and idle frames, and 11 are new (the frog's menu and answered
  turn on both browsers, the lantern's peek, the two phone clouds, and the
  gallery's feeling states).
- Notes and assumptions:
  - The bonus is a flat 15, not the proposal's "half again the base": half
    of Snack's 5 calm would have been 2, too small to notice for the turn a
    hungry critter wants a snack.
  - Feelings start with two fighting friends, not on an Ink flag: the
    fixtures and the story agree (Sue is the second), and no story variable
    is read in battle for it. Only friends with a battle command count, so
    Milestone 47's flute friends, who follow Fae with no command, won't
    switch feelings on beside Maddie alone.
  - Run answers nothing; the loader refuses a feeling answered by a command
    Fae can never have.
  - The peek costs nothing and lasts the battle; pressing again does
    nothing. With feelings off the lantern does nothing in battle.
  - A feeling is drawn up to two turns before it shows, from what Fae could
    answer then. So a critter can still be hungry after her last snack, or
    curious while Sue rests: the answering command wears the badge,
    disabled. That's kept on purpose: it says what the critter wants even
    when Fae can't give it, and the trail shows it coming.
  - Milestone 43 (the clubhouse fix-up) landed on main while this was
    built, so it was rebased onto it. The clubhouse run starts from the
    woods run, whose battles feelings change, so it was re-recorded on top
    of the new woods run along with every other chain, and the gates ran on
    the merged tree.

## Milestone 43: The clubhouse fix-up **Status:** ✅ Completed (2026-10-17)
- Sue and Jordan keep the promises they made when the Whispering Woods
  clubhouse became Fae's club (Milestone 26): a fridge for snacks, and a
  garden (NOTES.md: the clubhouse ideas).
- Inside the clubhouse (area `clubhouse`, painted whole and split into a
  kit): once the club is claimed, the tree house's ladder in the woods is a
  door (trigger `clubhouse`, `requires` `clubhouse_claimed`, knot
  `club_ladder`: "It isn't ours to climb into... yet."). The room is a
  cutaway of the tree house's one room and its deck: plank walls, the round
  window, string lights, the beanbag, a crate table with comics, the kid's
  purple soda bottles, an old fridge, and three planter boxes along the
  deck's railing. The ladder's top in the deck leads back down.
- Sue fixes the fridge (`fridge_fixed`): its door hangs open and it's warm
  inside until her hip bumps it shut and back to life. Jordan plants
  strawberries (`garden_planted`): "a garden grows best when everything
  around it is calm." Every calm after that,
  anywhere, grows it: one sprouts it, three ripen it. Ripe strawberries go
  into the fridge a basket at a time (once it works), and each basket is
  three snacks. The plants keep growing: two more calms ripen them again.
- The fridge's fixed look and the garden's planted, growing, and ripe looks
  are prop states cut from three more paintings of the room (spec 6.2).
- Engine:
  - The calm hook: after every calm the core runs the story's `on_calm`
    knot silently (spec 7), so the story can count calms.
  - A `gift: snack <count>` line tag gives Fae snacks as the line is shown,
    like `buy:`. Item tags now apply on a conversation's opening line and
    a locked door's too.
  - The kit's fill check ignores hairline differences (spec 6.2,
    `docs/art/kit.md`): a painted line redrawn a pixel off doesn't show,
    while a wrong patch still fails.
- Evidence: unit tests (`clubhouse.test.ts`: the fridge, the garden's stages
  and their prop states, the calm hook through a real battle (it fails with
  the hook off), the gift tag through the core's own dialogue, the opening
  line included (fails without it), the snacks, the ladder shut then open and
  back down, the journal, and the area checks; `clubhouse-replay.test.ts`),
  the recorded run `pass-party/clubhouse.json`
  (`tools/sim/record-clubhouse.ts`, on from the woods run: the lantern off,
  the fix-up, calms in the woods, climbing up and back down for fresh
  critters, until the strawberries are ripe, the picking, and the snacks), and
  its real-key e2e `clubhouse.spec.ts` (arriving, the fridge humming, the
  garden growing and ripe, the snacks, at both sizes; the props' states in
  order; browser and Bun hashes match). Gates: `just check` (582 unit tests,
  the sim, purity, lint), `just build`, and `just e2e` (440 passed, 2
  skipped).
- Notes and assumptions:
  - Growth by calms, not by time: spec 13 keeps day and night out of scope,
    and every calm already pays, so the garden is a gentle bonus (two calms,
    three snacks) rather than a farm.
  - The fix-up is story beats, not decorating: spec 13 keeps home
    customization out of scope.
  - No existing run changes: the woods run ends where it did, and the ladder
    door is off its path. The clubhouse run branches from the woods run's
    end (like the arcade run), so the chain to the field doesn't move.
  - The old fridge and the garden are lifted (their states change); the
    crate, the beanbag, and the rope railing are painted. The ladder's hole
    is the floor's notch between the two runs of railing.
  - The kit's fill check counted every pixel over 12% off, so the fills of
    the clubhouse's planks, whose painted lines the model redraws a pixel off,
    failed at 20.6% and 12.5% though they continue the planks. Opened by a
    3x3 square, they measure 5.3% and 3.6%; the same fills misaligned by 9
    px or flattened to one colour measure 15-39%, so wrong fills still fail.
  - Gemini calls: 37 (the painting and its three edits 6; the kit 31).
  - The clubhouse, its four paintings, the props, and the wording are in
    the owner's review queue.

## Milestone 44: The claw machine **Status:** ✅ Completed (2026-10-17)
- The arcade's games start working. NOTES.md asks for an arcade "with
  playable mini-games like skee-ball, whack-a-mole, claw machine", and Mr.
  Pip tells Fae she can "play here any time", but until now there was
  nothing to play. Milestones 44 to 46 build the three games. The claw
  machine is first because it already stands in the painting.
- Once Mr. Pip is calm, the claw machine (`claw-machine`, prompt Play)
  offers "Play for 2 coins" when Fae has them, a sticky choice like the
  bakery's. Before he's calm the machine is fizzing with purple scribbles. A
  line tagged `play: claw 2` opens the game when the conversation closes and
  takes the coins then, the way a `travel:` line waits for the close.
- The game (owner, 2026-10-17: "more 3d with animals piled on top of each
  other, not a linear lineup"; then two holds, more plushes, and a painted
  inside): a close-up of the machine over the blurred arcade, its glass box
  painted in perspective, with nine plush critters heaped in it in three
  layers: the frog, the pup, and the very smug raccoon, with a cat, a bunny, a
  bluebird, a hamster, a squirrel, and an owl. The claw works like a real one,
  in two holds (Z, the confirm button, or A): hold and it slides right, let go
  and it stops; hold again and it moves back into the box, let go and it
  drops. It comes down on whatever is on top of the heap there and grabs the
  topmost plush within its reach, unless another plush rests on that one
  ("It's stuck under the others!"). Then it lifts, carries the plush back over
  the chute at the front left, and drops it. The raccoon lies at the back,
  under others, so it is won last. Only a fresh press starts each hold, so
  the press that closed the conversation can't. No mashing, no timer, no
  random draw: where Fae lets go, twice, decides it.
- Prizes: a won plush leaves the heap for good and joins Fae's prizes
  (`state.prizes`). The journal's sticker page gains a PRIZES shelf under
  the album that works like the stickers: the plush with a die-cut rim and
  its name, or a dashed `?`. New story externals, `won(prize)` and
  `plushesLeft()`, let lines notice (an empty machine, the raccoon last, and
  "Someday I'm going to win that raccoon" answered).
- Engine: a nullable `state.arcade` game slot beside `battle`. While a game
  runs Fae is frozen, doors, cancel, and menu are ignored, and the party
  keeps settling. The result line uses the dialogue box with no speaker, a
  game's end autosaves, and the root carries `data-arcade="open"`. Dev logs
  and `renderInfo().arcade` (the claw, the plushes, and the chute, in CSS px)
  are there for tests. Numbers and lines live in `content/arcade.json`, the
  prize catalogue in `content/prizes.json`, and the plush art in one atlas
  (`public/assets/prizes/`). New sound cues: the claw starting, dropping,
  grabbing or missing, and a prize won.
- Saves go to version 6 (the arcade slot and the prizes). A version-5 save is
  upgraded (no game running, no prizes) instead of refused, so saves made
  since Milestone 28, the owner's phone among them, carry on. A save is never
  written mid-game.
- Evidence: unit tests for the rules (`tests/unit/claw.test.ts`:
  both holds, the reach edge for every plush, topmost and nearest, stuck,
  the whole heap won in the order it comes free through real steps, the
  result, the view, the cues, the Ink lines, the loader, the freeze, the
  autosave; the save tests), for the layout (`tests/unit/claw-layout.test.ts`),
  and the gallery's real game states, checked against the layout in both
  engines at a phone's and a desktop's size; the recorded run
  `arcade/claw.json` (`tools/sim/record-claw.ts`: Mr. Pip calmed, then stuck on
  the raccoon, the pup won, a miss in the bare back corner, and the cat won)
  with its replay test (`claw-replay.test.ts`, every result line, the 2 coins
  each game, and every cue), and its real-key e2e (`claw.spec.ts`: the
  close-up, the tug, and the prize card at both sizes, the end state hashing
  the same as Bun's; and the pup won with two holds of the touch confirm
  sticker, in both engines). Every screenshot was viewed.
- Notes and assumptions:
  - Started on the first Milestone 40 commit while its recordings were being
    regenerated, and rebased onto the final Milestone 40 (`536cf977`).
  - The owner's decisions, taken as defaults and open to review: 2 coins a
    play; plushes are collectibles with no gameplay effect; nine plushes, then
    the machine is empty for good; the games open once Mr. Pip is calm. The
    owner then asked (2026-10-17) for "more 3d with animals piled on top of
    each other, not a linear lineup", and chose the two holds, more critter
    plushes, and a painted inside.
  - Art, 12 Gemini calls in all: the nine plushes from two sheets
    (`art/recipes/prizes.json`), cut whole by connected component onto a
    shared baseline, an enclosed pocket of key colour in the squirrel's tail
    cleared; and the machine's front, first painted at three-quarters (which
    would have made the claw slide diagonally), then straight on, then
    repainted in watercolour keeping its geometry
    (`art/recipes/claw-machine.json`). Its floor and ceiling meet at one
    vanishing point within about a pixel.
  - The heap's floor positions and the plush size were chosen by compositing
    the plushes on the painting: the floor's front half is in front of the
    chute, so the claw's travel starts at (185, 140), over it.
  - Drawing order is plain depth (nearer covers farther). An order that drew
    a plush over the ones it rests on put a buried frog in front of the claw
    at some spots and behind it at others; plain depth never contradicts.
  - The heap's order: the pup, the cat, and the bluebird are free at the
    start; the raccoon only once the squirrel and the bluebird are won.

## Milestone 45: Skee-ball and the prize counter **Status:** ✅ Completed (2026-10-17)
- The owner said yes to skee-ball next (2026-10-17). A skee-ball lane joins
  the arcade on the open floor at the front left, below the door's path: its
  hood at the upper left, facing the room, and its foot toward the front
  corner. It's painted into the room by an edit confined to that floor (every
  other pixel kept), then cut out by the kit as a prop Fae walks round and
  behind, like the cabinets. Once Mr. Pip is calm it offers "Play for 2 coins"
  (`play: skee 2`) at its foot (`skee-ball`, prompt Play).
- The game is a close-up looking up the lane from its foot, painted like the
  claw machine: the lane, its side rails, the hump, and a plain target board
  under a blank marquee. The rings, their numbers, the arrow, the ghost of the
  meter, the ball, and the score are drawn in code, so what's drawn is exactly
  what scores. It shows the hood and the upper half of the lane, large enough
  for the target to read on a phone.
- Five balls a game. Each ball takes two presses. An arrow sweeps back and
  forth across the lane, and a press sets the aim. Then hold to wind up, and
  let go to roll: while it's held, a ghost ball climbs the board to where the
  ball would land, and held too long it flies off the top (red). The ball
  rolls up the lane, hops the hump, and drops into a ring: 50 in the middle,
  then 40, 30, and 20 round it, two 100 holes in the top corners, and 10 for
  everything else, so every ball scores. Its target lights and its points pop
  up. Aim decides left and right, the hold how far up. No timer, no random
  draw.
- Tickets: a game pays its score over 10 in tickets (`state.tickets`), shown
  in a pill on the journal's PRIZES heading. Mr. Pip runs the ticket counter:
  once he's calm it trades tickets for four prizes for the PRIZES shelf, a
  rainbow pinwheel (20 tickets), a star bouncy ball (30), a toy rocket (50),
  and a Star Racer keychain (80), each once. A line tagged `trade: <prize>
  <price>` pays the tickets and gives the prize as it's shown, like `buy:`;
  the loader holds every trade to the counter's own prices.
- Saves go to version 7 (the tickets). Version-5 and version-6 saves are
  upgraded.
- Evidence: unit tests for the rules (`tests/unit/skee.test.ts`: the sweep and
  its turns, a fresh press for the aim and for the hold, the meter and its
  end, every ring's and corner's edge, too hard, a five-ball game opened
  through the real conversation and played through real steps, the view at
  each phase, the cues of a whole game, the freeze, the loader, the trade
  tag), for the counter (`tests/unit/counter.test.ts`: before Mr. Pip is
  calm, no tickets, each prize offered at exactly its price, every prize
  bought with real key presses, the champ line), for the save (version 7,
  and version 5 and 6 upgraded), and for the layout
  (`tests/unit/skee-layout.test.ts`); the gallery's real game states checked
  against the layout in both engines at a phone's and a desktop's size; the
  recorded run `arcade/skee.json` (`tools/sim/record-skee.ts`: Mr. Pip calmed,
  then 50, a corner's 100, one too hard, 40, and 20, so 22 tickets, and the
  pinwheel traded for 20) with its replay test (`skee-replay.test.ts`: every
  ball, the result line, the 2 coins, the tickets paid once, and every cue);
  and its real-key e2e (`skee.spec.ts`: the close-up, the corner lit, and the
  result at both sizes, the end state hashing the same as Bun's; and a 50
  rolled with a tap and a hold of the touch confirm sticker, in both
  engines). Every screenshot was viewed.
- Notes and assumptions:
  - The owner's decisions, taken as defaults and open to review: 2 coins a
    game; tickets are the score over 10; the four prizes and their prices;
    Mr. Pip runs the counter; where the lane stands.
  - The rules live in `src/core/skee.ts`, the claw's in `src/core/claw.ts`;
    `src/core/arcade.ts` opens, steps, and views whichever game is open. The
    close-ups split the same way in `src/ui/`, and one tool
    (`tools/arcade-layout.ts`) gives the e2e tests either game's layout.
  - The close-up first showed the whole painting, and on a phone the board
    was too small for its numbers; it now shows the hood and the upper half of
    the lane (`skeeFrame`). The painting's dark score slot sat on a rail at an
    angle, so the score is a sticker in the paper beside the hood instead.
  - Art, 15 Gemini calls in all (the generation log), 4 of them kept: the
    close-up (1 call, `art/recipes/skee-lane.json`; its cut-out first leaked
    into the pale lane, and is now kept whole between the rails), the four
    counter prizes (1 call, `art/recipes/prizes.json`), and the room's lane
    (7 edit calls and 6 isolate calls over three passes,
    `art/recipes/skee-ball-room-edit.json`).
    The first two passes painted the lane half off the floor's front edge
    (the region they were given ran along it), out of register, with its
    hood clipped and floor in its cut; none of their pixels are kept. The
    kept lane was painted over a flat-colour block-out at a measured spot,
    registered by searching scale and offset over the floor around it (the
    model widens a crop to 3:2), and composited as the object plus only the
    darker pixels of its shadow, so no repainted floor came in. The kit
    rebuilds it from a clean checkout with no calls and no change. The five
    props on the untouched tile stay pixel-identical, and the five cabinets
    differ only by the patched tile's re-encode noise.
  - The lane isn't a canopy: nowhere Fae can stand does it hide her.

## Milestone 46: Boop-a-Mole **Status:** ✅ Completed (2026-10-17)
- Whack-a-mole, gently, on the arcade's first cabinet (`cabinet-left`, the
  mint one with the pink stripe, beside the door): once Mr. Pip is calm it
  offers "Play for 2 coins" (`play: mole 2`, interactable `boop-a-mole`,
  prompt Play). Nobody gets hurt: a booped mole squeezes its eyes shut,
  giggles, and ducks back down.
- The game is a close-up of the cabinet's deck from where Fae stands, painted
  like the claw machine and the skee-ball lane: five holes in a plus in
  one-point perspective under a blank marquee. The moles (three frames: up,
  booped, giggling) rise out of the holes, the near rim hiding their waists,
  and a squeaky toy hammer (drawn in code) boops them on the head.
- A round is 16 moles, one at a time. Each rises over 8 ticks, stays up for
  a window that shrinks from 64 ticks to 32 across the round, and ducks over
  8; 16 ticks pass between moles, after a 60-tick "Get ready!". Which hole
  each mole comes from is drawn from the game's random generator as the round
  opens (never the same hole twice in a row) and kept with the game, so a
  replay is exact. A fresh press of an arrow boops that hole, and Z the
  middle; on touch, tap the hole (each hole's key is lettered beside it for
  keyboards). Booping an empty hole only squeaks, and a missed mole just
  ducks: nothing is ever lost.
- Tickets: 2 a boop (32 for a perfect round), paid at the result, for the
  ticket counter.
- Evidence: unit tests for the rules (`tests/unit/mole.test.ts`: the draw and
  the generator, ready, each hole's input and the order when pressed
  together, an unbooped mole's whole life, the window from first to last,
  boops while rising and up, the window's edges, squeaks, the hammer's
  fading, the result paid once, a whole round opened through the real
  conversation and played through real steps, the view, the cues, the
  freeze, the loader, and the story), for the layout
  (`tests/unit/mole-layout.test.ts`), and the gallery's real round states
  checked against the layout in both engines at a phone's size (touch) and a
  desktop's (keys); the recorded run `arcade/mole.json`
  (`tools/sim/record-mole.ts`: Mr. Pip calmed, then fourteen moles booped,
  one while still rising, two let go, and two squeaks) with its replay test
  (`mole-replay.test.ts`: the result line, the 2 coins, the 28 tickets paid
  once, what each boop hit, and every cue); and its real-key e2e
  (`mole.spec.ts`: a mole up with the keys, a boop, and the result at both
  sizes, the end state hashing the same as Bun's; and two moles booped with
  quick taps on their holes on a phone, a finger landing on the hole, in both
  engines). Every screenshot was viewed.
- Notes and assumptions:
  - The owner's decisions, taken as defaults and open to review: the name
    Boop-a-Mole; the first cabinet; 2 coins a round; 16 moles; 2 tickets a
    boop; one mole at a time.
  - The generator's step (`nextRandom`) moved from `sim.ts` to its own
    `src/core/random.ts`, so `arcade.ts` can draw a round without importing
    the simulation that imports it.
  - The close-up first showed the whole painting with the score over the
    marquee; it now shows the deck down past the near hole (`moleFrame`),
    the score beside the marquee, and the key caps by the holes, since
    keyboard players can't tell which arrow is which hole otherwise. The
    hammer strikes the top of the head, so the wince shows.
  - A tap on an outer hole holds its arrow; a tap shorter than a frame used
    to vanish (arrows had no latch, unlike buttons). Touch input now keeps a
    tapped arrow for the next frame, as it does a tapped button.
  - Art, 5 Gemini calls (the generation log), all kept but two cabinet
    drafts: the cabinet's close-up (3 calls, `art/recipes/mole-cabinet.json`)
    and the three moles (2 calls, `art/recipes/moles.json`).

## Milestone 47: Flute friends **Status:** ✅ Completed (2026-10-17)
- The owner picked flute friends next (2026-10-17). NOTES.md: the flute
  "calls animal friends to your side like cute kitties and puppies"; Fae has
  to "build a bond with the animals by feeding them treats and petting them";
  "specific animals have specific abilities that help in puzzles". The
  journal has promised it since Milestone 38: "When I play it, animal friends
  come running."
- The bond: once Fae has the flute, a calm Pond Pup's talk (after his first,
  the purple-thread tale) offers Pet him and Share a snack (the bakery's, or
  the clubhouse garden's strawberries). Both, in either order, and the pups
  are her friends (`pup_friend`); without a snack, Fae says where to get one.
- The flute is a tool, like the lantern: F, the gamepad's right shoulder
  (RB/R1; Y already opens the journal), or a ♪ touch button beside the
  lantern's once she has it. It plays the `flute` knot, which calls the Pond
  Pup (`pup_with_me`) or sends him home. Before she has a friend, "Nobody
  comes... yet."
- A flute friend follows Fae like the party (party content `flute: true`,
  `command: null`) and goes through doors with her; it's the only member who
  leaves (its variable false). It sits battles out: it gives no command and
  isn't drawn in the battle scene. Called where a calm pup is, it's that pup
  who comes along: he steps out of the area into the party (`critter: "pup"`).
- The Pond Pup swims: in the park, something glints at the bottom of the
  pond, out of reach (look point `pond`, its south rim). With him along,
  "Fetch, boy!", and he dives for an old tin of twelve coins, once.
- Art: the Pond Pup as a follower (`public/assets/characters/pond-pup/`),
  the calm pup's design in Maddie's six animations at her scale.
- Engine:
  - `ActionFrame.flute`, optional like `lantern`: keyboard F, the gamepad's
    button 5, the touch ♪. The tool buttons step aside while a conversation
    or a battle is open.
  - The story's `snacks()` external; `feed: snack <n>` (Fae gives snacks
    away, never below none) and `gift: coins <n>` line tags.
  - `battleParty`: the members with a battle command.
  - `tools/art/extract-figures.ts` cuts a generated sheet into whole
    figures (the largest connected components, read row by row, each on the
    key colour alone), so a figure is never cropped and a faded copy the
    model drew above one stays out.
- Evidence: unit tests (`flute-friends.test.ts`: the bond in either order,
  no snack, the snack taken through the core, the flute on F and not before,
  a held F playing once, calling and sending home, the friend joining,
  following, and leaving by its variable, the calm pup stepping out (fails
  with it off), a chaos pup staying, sitting battles out, the pond and its
  coins through the core, the journal, the content rules, and the gamepad's
  button), the recorded run `pass-party/flute.json`
  (`tools/sim/record-flute.ts`, on from the field run: out of school with
  the nurse's hall pass, the park's pup calmed and befriended, the flute, a
  battle he sits out, the tin, and home) with its replay test, and
  the real-key e2e `flute.spec.ts` (the bond, following, the battle without
  him, the pond, at both sizes; the touch ♪ button and the tools stepping
  aside, in Chromium and WebKit; browser and Bun hashes match). Gates:
  `just check` (619 unit tests, the sim, purity, lint), `just build`, and
  `just e2e` (470 passed, 2 skipped; then the touch test on WebKit too).
- Notes and assumptions:
  - The Pond Pup is the first friend. The Cozy Cat comes later: it looks like
    Maddie (an orange cat in blue), so it waits for an ability of its own.
  - Flute friends in battles stay the battle ideas' "flute friends", for the
    battle session.
  - The run leaves school by the nurse's hall pass, the way chapter one does,
    since the flute comes at recess; the field run is unchanged.
  - Gemini calls: 25, all for the sprite (16 by the first worker, 9 in the
    revision; one failed). The kept sources are the model's own outputs.
  - The sprite, the flute's and the pond's lines, and the ♪ glyph (text, not
    art) are in the owner's review queue.

## Milestone 48: Lean **Status:** ✅ Completed (2026-10-17)
- The owner picked Lean next, then wind-ups, then first touch and old
  friends (2026-10-17, `docs/battle-ideas.md`). The three gust bursts become
  a lean: the bluebird's sandy swirl, the music-room bluebird's fluttering
  one, and the gull's feathers and sea spray. Puffs push Fae's balance back,
  and the player leans with left and right to keep a star in the green
  middle of a track over her head; too far either way in a puff and she
  tips over, losing it. A new check kind, `lean` (spec 8), with no button:
  the stick or arrows lean her, right being forward into the wind. Every
  puff held is great, half good, like a chain, and each held puff plays
  `battle-beat`.
- A normal burst blows two 56-tick puffs, each gentle (force 2) or strong
  (3); a big one blows three strong 36-tick puffs. A burst draws its big
  roll first, then one force per puff, like a catch's lanes. Only the owl's
  burst is still a ring (its Peekaboo needs a look-away frame).
- The track, the star, the puff dots, and the wind's swooshes are drawn in
  code in the sticker style; nothing is generated. On touch, two arrow
  stickers (◀ ▶) stand where the stick would while a lean is in play
  (`data-check="lean"`). `TouchInput` now holds an arrow's direction for
  the catch's arrows and the lean's alike, and lifting one never lets go of
  the other if a second finger holds it.
- The gust bursts' lines said Fae ducked or dodged; they say she leans now
  (the misses already fit).
- Evidence: core unit tests for the lean's rules (the push, steer, and
  settling; losing at either end; holding a whole puff; the grades, the
  view, the hint, the stick, and the draws), the burst's draw order and
  damage, the loader, and the sound (`checks.test.ts`,
  `battle-wiring.test.ts`, `check-loader.test.ts`, `sound.test.ts`); every
  recorded run meeting a gust critter re-recorded with the runs that start
  from them; real-key e2e (`lean.spec.ts`: the bay's bluebird lean on held
  arrow keys, and the arrow stickers on touch at 874x402 with a notch) and
  the gallery's lean state. Gates, rebased on Milestone 44: `just check`
  (684 unit tests, every sim, purity, lint), `just build`, and `just e2e`
  (559 passed, 2 skipped, on Chromium and WebKit). Every changed screenshot
  was viewed: 14 differ only in the harness readout's tick (checked pixel
  for pixel outside it), 15 by the later tick's roaming critters, feelings,
  and party spacing (two hamsters roam the pass by the lodge porch now, and
  the flute run's battle is a Pouncy Cat where it was a Zoomie Pup), and 8
  are new (the lean mid-puff and its GOOD on keys, on both engines; the hint
  and a puff on touch; the gallery's lean on both engines).
- Notes and assumptions:
  - Tuning, swept headless against the real core with simple player models:
    doing nothing loses every puff (MISS); leaning forward blindly through
    every puff tips her over forward (MISS on a normal burst, GOOD on a big
    one); a player reading the star an eighth of a second late holds them
    all (GREAT), and one twice as slow who waits until the star is well off
    centre holds half a normal burst (GOOD) and a whole big one. Every
    force is under her lean (the loader checks it), so a puff can always be
    held. The owner may want it gentler; the numbers are content.
  - Fae has no hat, so the idea's hat became her balance, shown as a star.
    The hint is "Hold left or right to balance!": 30 characters, inside the
    260 px hint stickers are kept to.
  - The balance runs from -100 to 100 in whole numbers. A lost puff stops
    blowing and stands her straight, so each puff is a fresh try; leaning
    outside a puff can't lose anything (the star just stops at the end).
  - Right is forward: battles are staged side-on with the critter on the
    right, and the swooshes blow in from it.
  - The grade hangs over Fae's head, under the track; over the track it
    would meet the HUD on a phone.
  - Every timed part fits in 180 ticks (spec 8): a normal lean ends on tick
    171, and a big one on 179, its puffs 14 ticks apart rather than 16.
  - The puff draws follow the big roll in the same PRNG, so every later roll
    in a run that meets a gust shifts. The bay and bus runs, the lookout,
    and the music, field, and flute chain were re-recorded; the recorder
    leans back toward straight whenever she's 5 or more off, on arrows only.
  - The e2e plays the bay run's first burst, a normal lean of two gentle
    puffs: on real keys it lets the first puff push her, tips her over with
    the wind on ArrowLeft, then leans through the second for GOOD; on touch
    it holds both with the stickers for GREAT.

## Milestone 49: Lasso spots **Status:** ✅ Completed (2026-10-17)
- The owner asked for more places to use the lasso (2026-10-17). Coach Ash
  says it "can pull down things that are up high"; NOTES.md: "Lasso for
  pulling levers or swinging across gaps". Three little errands in places Fae
  already knows, each with something stuck out of reach once she has the
  lasso:
  - Meadow Park: Rosie's kite, caught on top of the play tower and hanging
    down its wall. Lassoed down, it goes back to Rosie in the classroom, who
    gives Fae her six arcade coins.
  - Bubblegum Bay: a bottle bobbing past the end of Sue's dock. Reeled in,
    it holds an old treasure map; Fae digs between the two palms by the big
    log and finds twenty coins.
  - Pinecone Pass: the cocoa seller's scarf, caught on a ski-lift chair. She
    misses it at the stand; lassoed down and given back, it's cocoa on the
    house.
- Before the lasso the places look and read as they always did; each stuck
  thing appears with it and is gone once it's down. The journal tells each
  errand from when it's seen.
- Art: each one painted into an edit of its area's approved painting
  (`art/recipes/lasso-spots.json`), in register with the plate (a median of
  0 units off), and cut by the kit as an added prop.
- Engine:
  - A prop state can be hidden (`{ "hidden": true }` in the catalogue): no
    frame, no footprint, covers nobody, and the checks skip it.
  - The kit cuts `added` props: from another painting, painted (no hole),
    hidden by default, shown in their `added` state by the area's rules.
  - Two kit configs pin the samples their kept files are (the field's
    isolates, the plaza's bench completion): a clean rebuild asked for
    samples nobody kept. Every kit rebuilds with no calls, byte for byte.
- Evidence: unit tests (`lasso.test.ts`: each errand before and after the
  lasso, left and taken, the rewards through the core, the props' states,
  hidden props covering nobody (fails if the hidden state draws), the area
  checks, the catalogue's rules, and the journal), the recorded run
  `pass-party/lasso.json` (`tools/sim/record-lasso.ts`, on from the flute
  run: the kite; the bus up to the pass and the scarf; the trail down to the
  bay, the bottle and the treasure; the bay road home and the kite to Rosie)
  with its replay test, and the real-key e2e `lasso.spec.ts` (each errand's
  moment at both sizes, each prop drawn then hidden, browser and Bun hashes
  match; its watcher reads the props only at each errand's moments). The
  flute run's park screenshots were updated: the kite is on the tower once
  Fae has the lasso. Gates: `just check` (800 unit tests, the sim, core
  purity, lint), `just build`, and `just e2e` (711 passed, 2 skipped).
- Notes and assumptions:
  - The kite was first painted flying from the flagpole, then snagged at
    its tip; both read as floating over the tower in the game, so it hangs
    down the tower's front wall, at the tower's depth.
  - The `pass-party` chain skips chapter one, so in the run the bay road is
    shut on the way out and the bus only goes up the mountain: the run takes
    the trail down to the bay.
  - `art/recipes/pass.json` says the raw pass painting was padded at the
    bottom; the plate was padded at the top. The edit follows the plate (the
    recipe records it).
  - Gemini calls: 10 (6 painting edits, 4 kit isolates).
  - The three edits, the props, and the wording are in the owner's review
    queue.

## Milestone 50: Wind-ups **Status:** ✅ Completed (2026-10-17)
- The owner picked wind-ups after Lean (2026-10-17, `docs/battle-ideas.md`:
  "Wind-ups, for mini-bosses", after Sea of Stars' locks). The gull and Mr.
  Pip, the two mini-bosses, get a shape of their own: on turn 2, then every
  third turn, one puffs up for two turns, feeling two things at once. The
  feelings float as bubbles where the thought cloud would, and each command
  that answers one pops it, with the feeling bonus as ever. No burst comes
  between the two turns; then it lets go: everything popped, it fizzles with
  no burst at all; some, a small burst; none, a big one. No roll either way.
- The bubbles are feelings Fae already reads (Milestone 42's icons and
  badges), drawn like a turn's but all different, from those she can answer.
  The ordinary feelings wait meanwhile, so the turn after shows the one the
  trail promised. A mini-boss winds up beside Maddie alone too, when
  ordinary feelings are off.
- Rest timers become planning: Mr. Pip's run juggles on turn 1, so Jordan
  is still resting when the wind-up's bored bubble needs him, and the small
  burst comes.
- Fixed on the way: a check stayed in the battle after its own result, so
  the last burst's ring, catch, or lean, with its GREAT, hung over the next
  turn's menu (and a command's check over the burst's line). Any other
  message or a new turn now clears the check and its grade.
- Evidence: core unit tests for the wind-up's rules (`wind-up.test.ts`: the
  schedule, the draws and their PRNG order, popping and the bonus, the
  badges, puffing on with no burst, fizzling, letting go big or small with
  no roll, the view and the swell's `puff`, a soothed critter done winding
  up, the lantern dark in a wind-up, the last check and grade cleared, and
  the loader), every recorded run meeting a mini-boss re-recorded with the
  runs that start from them; real-key e2e (`windup.spec.ts`: the lookout's
  gull popped by Soothe then Snack until its gust fizzles, and the bubbles
  clear of everything on a notched phone and an iPhone SE) and the
  gallery's wind-up state. Gates: `just check` (710 unit tests, every sim,
  purity, lint), `just build`, and `just e2e` (573 passed, 2 skipped, on
  Chromium and WebKit). Every changed screenshot was viewed: 32 differ only
  in the harness readout's tick (31 checked pixel for pixel outside it; the
  claw's stuck shot also shimmers at most 6/255 in the blurred room behind
  the glass, with the claw game's state and Fae's spot identical), 18 by
  the later tick's roaming critters, feelings, and party spacing (the
  flute run's battle is a Zoomie Pup where it was a Pouncy Cat), and 8 are
  new (the wind-up's menu and a popped bubble on both engines, the phones
  at 874 and 667, and the gallery's wind-up on both engines).
- Notes and assumptions:
  - Two bubbles for both, so a wind-up lasts two turns, and `every` 3 leaves
    a plain turn between. The bubbles are feelings rather than the idea's
    ball, bobber, and pinecone: kids already read feelings and their badges,
    and Soothe and Snack can answer them too.
  - A bubble pops as its command is chosen, like answering a feeling, so
    the bonus lands with the check whatever its grade.
  - A critter soothed mid-wind-up is done winding up (the lookout's gull is
    calmed during its second), so it's its own size through its sigh and the
    reward. The lantern does nothing during a wind-up, since the cloud it
    peeks into is hidden.
  - The critter swells 6% a wind-up turn, breathing a little: a runtime scale
    of the approved art, like the aura's turn, not an edit to it.
  - Lines (in the review queue): the gull "puffs up bigger and bigger! It's
    feeling everything at once!", "puffs up even bigger!", and "Pfft! The
    gull's big gust fizzles into a tiny breeze."; Mr. Pip "huffs and puffs,
    bigger and bigger! He's feeling everything at once!", "huffs and puffs
    even bigger!", and "Pfft! Mr. Pip runs out of puff, and not one ticket
    flies."
  - The recorder's careful player pops a bubble when a ready command can,
    once its plan is spent: the lookout's gull fizzles its first wind-up
    (Soothe, then Snack). The lookout, the claw run, and the pass-party
    chain from the arcade on were re-recorded; the claw replay's end tick
    moved from 3199 to 3066.
  - Bubbles are 52 px at 720 px wide and under: at 64 px the row reached
    over Fae's head on an iPhone SE.

## Milestone 51: First touch and old friends **Status:** ✅ Completed (2026-10-17)
- The owner picked these after wind-ups (2026-10-17, `docs/battle-ideas.md`,
  "EarthBound style: sneak up on a critter for a head start, and species
  you've calmed three times calm on sight").
- Noticing: a recurring critter used to chase Fae the moment she was in its
  sight (180 units), more than twice its touch (70), so none could ever be
  reached unaware. Now one takes 45 ticks (3/4 of a second) to notice her: a
  "?" sticker over its head meanwhile, then a "!" that pops as it gives
  chase. Out of its sight, it forgets her.
- First touch: Fae reaching one before it notices her surprises it, and the
  battle opens a quarter calm ("The Zoomie Pup didn't see Fae coming! It's a
  little calmer already."). One that has noticed her and reaches her while
  she isn't walking at it catches her: it bursts first, on turn 0, before
  her first command ("The Zoomie Pup pounces before Fae is ready!"). Set
  pieces always open plainly.
- Old friends: every calm counts for its species (`state.calms`). Once Fae
  has calmed three of a species, a recurring one remembers her: touching it
  opens soothed ("The Zoomie Pup remembers Fae and calms right down!") and
  pays its coins.
- Saves are version 8 (Milestone 45 took 7 for its tickets). Saves from
  version 5 on upgrade: their calm counts start from then, and their
  roaming critters haven't noticed anyone.
- Evidence: core unit tests for the new rules (`encounter.test.ts`: the
  notice count and its marks, chasing only once noticed, who gets the jump,
  the head start, the caught opening's burst and its turn 1 with the
  feelings unmoved, a set piece's plain opening, old friends calming on
  touch and paying, and every calm counted; mutation-checked, each of six
  broken rules caught), the version 6 to 7 save upgrade (`save.test.ts`),
  and the recurring replay's fourth pup; every recorded run re-recorded,
  since critters wander differently once they don't chase on sight, and the
  recurring run extended to old friends; real-key e2e (`encounter.spec.ts`:
  a dash at the park's pup before it notices her, and standing in its sight
  through "?" and "!" until it pounces and bursts first; `recurring.spec.ts`
  the old friend, hashing the same as Bun). Gates, rebased on Milestone
  45: `just check` (757 unit tests, every sim, purity, lint), `just build`,
  and `just e2e` (647 passed, 2 skipped, on Chromium and WebKit).
  Every changed screenshot was viewed: 31 differ only in the harness
  readout's tick (checked pixel for pixel outside it), 66 by the
  re-recorded runs' later ticks, party spacing, rolls, and feelings (and the
  hamster opening a quarter calm, Fae reaching it first), and 7 are new (the
  "?", the "!", and the head start on Chromium, the "?" and the head start
  on WebKit, and the old-friend pup at 1280 and 874). Milestone 45 changed
  seven of the same baselines (the arcade's arrival, Mr. Pip's battle and
  reward, and the shop's journal); they were made again on top of it and
  viewed again (two differ only in the readout).
- Notes and assumptions:
  - 45 ticks, not 30: with 30, even a straight dash at the pond's pup from
    the edge of its sight got there just after it noticed (110 units at 4 a
    tick is 27.5 ticks, and it wanders); with 45 a dash wins, even after a
    15-tick pause, and standing about still gets caught.
  - "Not walking at it" is any step whose dot product with the way to it
    isn't positive: standing, walking away, or sideways. Chasers (2.5 a
    tick) can't catch Fae walking away (4), so being caught means she stood
    or dawdled.
  - The head start is a flat 25 calm (`firstTouch.surprise`, a quarter of
    an ordinary critter's 100) rather than a share of each kind's
    `calmMax`; it never fills the meter.
  - The marks are DOM stickers placed over each critter's head
    (`noticeMarks`), only while Fae walks free.
  - The recurring run gained two more trips to the plaza: a third pup
    calmed, and the fourth an old friend, so a recorded run and its
    real-key e2e cover old friends.
  - Saves were going to start fresh (the option the owner picked said so);
    saves since version 5 already upgrade, so version 8 upgrades them
    too.
  - The runs with no roaming critter about (the hall pass, the school
    raccoon, the lookout, the frog's win and rest, and the claw) re-recorded
    byte for byte; the other 19 changed.
  - Chapter one's plaza rolls a cat again (two raccoons since Milestone
    41): 32 coins and four stickers. The plaza cat e2e reads the first cat
    the bus-line run meets, in its chapter-one stretch.
  - Two e2e walks met their critters differently: the park's pup test now
    stands until the "!" and walks at it (a plain opening), and Jordan's
    steers at the hamster all the way (a head start).
  - The four longest pass-party replays get 20 s, like the canopy and
    clubhouse tests: under load from other sessions they ran past the
    default 5 s. So does the footsteps e2e walk (a long flow's budget),
    which also loses a helper it never called. No critter notices Fae on
    that walk, before or after this milestone.

## Milestone 52: The clubhouse kitchen **Status:** ✅ Completed (2026-10-17)
- The owner asked for it (2026-10-17), and chose (2026-10-17): cooking as a
  little game like skee-ball, and the chest as a keepsake chest. NOTES.md's
  clubhouse ideas: a "Microwave for making dino nuggets and mac n cheese" and
  a "Chest to store items".
- Once the club is claimed, Mom gives it her old microwave and her old toy
  chest, the first thing she says. They're in the clubhouse from then on: the
  microwave on top of the fridge, the chest on the floor under the drawings.
  Mom's freezer (the kitchen fridge) has dino nuggets and mac n cheese, a box
  at a time.
- Cooking: with a box, the clubhouse fridge offers to cook it (or to open the
  fridge as ever), and the microwave's close-up opens, free. A press starts
  it and holding keeps it going; let go when it's golden. The box says 1:00
  for the nuggets and 1:30 for the mac n cheese, and the timer runs fast (30
  seconds a real second). Within 10 seconds of the box's time is golden,
  three snacks; a bit under or over, two; burnt, one ("Extra crispy...").
  Let go while it's still frozen and it waits for the next hold; held to
  twice the box's time, the microwave stops itself. The food frosts, warms,
  steams, browns, and smokes by how long it's cooked, so what's drawn is
  what's judged.
- The keepsake chest shows what Fae has found, oldest first, read from what
  the story already knows (no earlier line changes): the purple thread from
  the pup's ball, the note from under the comics, the purple marker the
  hooded kid dropped, the Star Racer token, the pond's tin, the treasure map,
  and a bow from Rosie's kite.
- Art (`art/recipes/clubhouse-kitchen.json`, `microwave.json`,
  `cook-food.json`): the microwave and the chest painted into an edit of the
  clubhouse painting and cut as added props (Milestone 49); the close-up of the
  microwave on the fridge; and the two dishes, painted as cooked just right.
- Evidence: unit tests (`cook.test.ts`: every way out and its pay and line,
  the golden window's edges, the frozen pause and resume, the stop, the view,
  the content's and the calibration's errors; `cook-layout.test.ts`;
  `kitchen.test.ts`: Mom's gift, the freezer a box at a time, the chest's
  keepsakes, the props, the story opening the game through the core, and the
  journal), the recorded run `pass-party/kitchen.json`
  (`tools/sim/record-kitchen.ts`, on from the lasso run: home to Mom and the
  freezer, the bus up the mountain, the old trail, the clubhouse, the nuggets
  cooked golden, the chest) with its replay test, the gallery's five cooking
  states (phone and desktop baselines and layout checks, in both engines), and
  the real-key e2e `kitchen.spec.ts` (five moments at both sizes, the
  close-up as drawn while it cooks, and the browser's and Bun's hashes
  match). Gates: the first full run passed `just build` and `just e2e`
  (756 passed, 2 skipped), but `just check`'s core purity refused the
  calibration's field `window` (the browser's global): renamed `glass`. Then
  `just check` (825 unit tests, the sim, core purity, lint) and `just build`
  passed, and so did every spec the rename touches: the cooking gallery
  states in both engines (44 passed) and the kitchen, arcade, claw, skee, and
  mole specs (12 passed).
- Notes and assumptions:
  - The microwave sits on the fridge (a mini fridge's top is where it goes),
    so cooking shares the fridge's look point instead of crowding a second one
    beside it. The chest comes with it, from Mom, so the clubhouse's earlier
    screenshots don't change.
  - The hint (and then the box's time) is lettered on the fridge's front under
    the microwave; on a phone it's small but clear.
  - One box at a time keeps cooking from being a free snack machine: each
    cook is a trip home, and makes three snacks at most.
  - The pass-party chain skips breakfast, so after Mom's gift she says good
    morning there; in a real game she says it at breakfast first.
  - A delegated first try at the game deleted Boop-a-Mole (Milestone 46) from
    the framework while adding cooking; it was thrown away whole, and the game
    built on the framework as it is.
  - Gemini calls: 11 (one painting edit, two kit isolates, the close-up, and
    seven for the food: four of them before the angle and the floor came out
    right).
  - The edit, the props, the close-up, the dishes, the cooking numbers, and
    the wording are in the owner's review queue.

## Milestone 53: Into the mist **Status:** ✅ Completed (2026-10-17)
- The finale begins. The owner decided it (2026-10-17): the kid in the purple
  hood is Milo, unmasked only at the very end; Fae's three tools unseal the
  Enchanted Forest; the last calm-down is Trace, then Talk; and the dream
  ends in a wake-up morning. Milestones 53 to 56 build it, in that order.
- The way in: at recess Fae found the kid's stash on the playing field's far
  bank ("Was that a purple hood, way down the path? ...Gone again."). That
  dirt path, past the footbridge, runs off the field's east edge; once
  `stash_found` it leads on (a trigger along the floor's east edge, to the
  new area).
- The Misty Path (area `mist`, land `enchanted`, painted whole and split into
  a kit; there's no concept sheet, so it follows the world map's lavender
  mist round the sealed centre, in the woods' and the field's style): a
  woodland path running into a lavender mist as thick as cotton candy. Each
  of Fae's tools opens one stretch, in order:
  - The lantern: the mist swallows the path. With the lantern on, glowing
    bluebells show where it goes, and reading the last one (`found_mist_way`)
    lights stepping stones through the mist (a crossing; the stones are an
    added prop cut from a second painting, spec 6.2), and Fae hops across
    them to the `stones` spawn.
  - The lasso: a misty gully, its old rope bridge rolled up on the far side.
    The lasso loops the far post and pulls the bridge across (`rope_bridge`),
    a crossing that stays open both ways.
  - The flute: the seal, a wall of shimmering mist between two mossy standing
    stones hung with red, yellow-green, and blue flower bells, humming a
    tune with notes missing. Fae plays it back on the flute note by note,
    like the xylophone (prompt `Play`, each note its own flute sound). The
    class song, red, yellow, blue, red, rings every bell and the mist parts
    (`seal_open`; the open arch is an added prop from the second painting);
    a wrong tune ends with a hint toward the class song. The forest beyond
    opens in Milestone 54.
- The map shows the Enchanted Forest as "???" until Fae finds the Misty Path or
  enters that land. The journal tells each stretch as it opens.
- Evidence: core unit tests (each stretch shut, then open with real steps;
  the tune right and wrong; the journal; the map's name; the area checks
  with every crossing), a recorded run on from the latest chained run (to the
  field's far bank, down the path, and through the three stretches to the
  open seal) with its replay test and matching browser and Bun hashes, and a
  real-key e2e of each tool's moment at both sizes.
- Evidence details: `tests/unit/mist.test.ts` covers the door, crossings, glows,
  look points, flute tune, journal, map rule, and area checks. The replay test
  covers the 18,164-tick run, all three knots, prop states, and four flute
  sounds. `tests/e2e/mist.spec.ts` uses real keys, compares the browser hash
  with Bun, checks `renderInfo()` prop states, and captures both viewport sizes
  for arrival, lantern, stones, bridge, note choices, and the open seal.
- Gates: `just check` passed: 97 test files and 852 tests, all simulations,
  purity, and lint. `just build` passed production and harness hook checks.
  The final full `CLOVERHOLLOW_E2E_PORT=4193 just e2e` run passed 759 tests with
  2 skipped and no failures in 4.5 minutes.
- Notes and assumptions:
  - The lantern beat hops Fae across (`travel:` to `stones`), because the area
    checks need every look point reachable from a spawn with every crossing
    shut, following the field's `east-bank` pattern.
  - `forest` is the spawn Milestone 54's door will use.
  - The bells came out three, red, yellow-green, and blue, exactly the class
    song's colours, so green is the wrong note.
  - The open seal and stones are added props from a second painting with a
    colour cast. Only ink-outlined objects were taken from it. The mushroom
    patch is south of the floor's edge instead of a prop.
  - The floor is hand-traced in `tools/art/geometry/mist.ts`. Gemini calls were
    91 total, 8 for the paintings and glow flowers and 83 for the kit. Its
    first strategy lifted the scenery and its fills failed. The painted redo
    reused the cache with 0 new calls.
  - This review fixed the glow frames' transparency and added a build check for
    transparent corners, low mean alpha, and an unchanged old atlas region.
    The stepping-stone isolate now keeps every stone and excludes the posts,
    rope, planks, and path-edge ink.
  - The full-size seal crop showed no obvious seam or red fringe in play. It is
    at `art/review/mist-seal-open-crop.png` on the review machine.
- Wording for the owner:
  - "A little dirt path winds off between the misty trees. Something purple is tucked beside the old stump."
  - "The bluebells glow in a little line toward the lavender mist."
  - "They are showing stepping stones! I can hop across, one stone at a time."
  - "Fae hops across the mist, stone by stone."
  - "The bluebells still glow along the safe path through the mist."
  - "The stepping stones are glowing in the mist. I can follow them now!"
  - "The lavender mist is too thick to see through. Maybe something can show me the way."
  - "The gully is deep and misty, with two little posts on this side."
  - "The far posts have a rolled-up bridge. If only I had a rope!"
  - "Fae loops her lasso over the far post and pulls."
  - "The old rope bridge rolls across the gully with a soft creak. Now there is a way through!"
  - "The old rope bridge is pulled across the gully now."
  - "The forest glows warmly beyond the bell-flower arch."
  - "Three bell flowers hum softly: red, yellow-green, and blue. Some notes are missing... what song are they waiting for?"
  - "The bell flowers are waiting for a tune. The class song colours might help!"
  - "A red bell flower rings!" / "A red bell flower rings..."
  - "A yellow-green bell flower rings!" / "A yellow-green bell flower rings..."
  - "Fae plays a green note. No bell answers."
  - "A blue bell flower rings!" / "A blue bell flower rings..."
  - "That's it! Red, yellow, blue, red! The bell flowers ring together."
  - "The mist wall parts, and a warm forest glow shines through the arch."
  - "The bells give a gentle wobble. They only ring for a song I already know..."
  - "The bell-flower seal opened, and a warm forest glow shone beyond the stones."
  - "I pulled the old rope bridge across the misty gully with my lasso."
  - "Bluebells lit stepping stones through the mist, one hop at a time!"

## Milestone 54: The Enchanted Forest **Status:** ✅ Completed (2026-10-18)
- Past the parted seal (a door, `requires` `seal_open`): the Enchanted Forest
  (area `enchanted`, land `enchanted`, painted whole and split into a kit),
  the glowing Ancient Tree beside the Mystic Pond in a ring of lavender mist,
  from the world map's centre (NOTES.md: "Mystic Pond", "Ancient Tree",
  "Fairies and butterflies floating around").
- The chaos is strongest here: purple scribbles over the tree's bark and the
  stones, and the pond fizzing purple like the kid's soda. The approved
  painting is the forest made whole (the plate); the chaos is added props cut
  from a second painting of it under the spell, shown while `forest_fizzy`
  (true from a new game). Milestone 55's calm-down clears it, and the overlays
  vanish.
- Fairies and butterflies drift about: an area's ambient flyers, drawn from a
  small atlas on looping paths from the tick (render only, spec 3.1). One
  fairy talks: the Ancient Tree dreams the whole land, and the Mystic Pond
  grants wishes, until a kid in a purple hood made one, drank from it, and
  everything went fizzy. The pond itself (a Look point) fizzes purple, just
  like the soda.
- The kid in the purple hood waits under the Ancient Tree, seen from the
  front at last, the hood pulled low so their face stays in shadow (a new
  front view; nothing names them). Talking to them plays a taunt ("So you
  found my secret forest. Nobody can stop the BOSS!"); the calm-down is
  Milestone 55.
- Built: the `enchanted` area is 1650x1100, with its traced floor, forest-side
  spawn, two-way door, tree, pond, four fairies, hooded kid, and seven ambient
  flyers. The forest kit includes the lower-right stone and chaos overlays.
- Built: the lavender fairy alone records the wish. The pond and tree looks
  change after that lore. The kid records `saw_tree_kid` and has the repeat
  taunt. `forest_fizzy` starts true.
- Evidence: `tests/unit/enchanted.test.ts` covers the two-way door, floor,
  props, story variables, look points, journal, and area checks.
- Evidence: `tests/unit/forest-replay.test.ts` covers the chained run's knots,
  story variables, overlay states, end area, and pinned 18,648 tick count.
- Evidence: `tools/sim/record-forest.ts` records from `pass-party/mist.json`;
  `tests/sim/scripts/pass-party/forest.json` is replayed by `just sim`.
- Evidence: `tests/e2e/forest.spec.ts` uses real keys, compares the browser
  hash with Bun, checks `renderInfo()` area, overlays, ambient flyers, and
  people, and captures both viewport sizes at arrival, lore, and taunt.
- Gates: `just check` passed: 100 test files and 865 tests, all simulations,
  purity, and lint. `just build` passed production and harness hook checks.
  The final full `CLOVERHOLLOW_E2E_PORT=4194 just e2e` run passed 760 tests
  with 2 skipped and no failures in 4.7 minutes. The new Chromium e2e timing
  entry was recorded from that run; WebKit does not select this screenshot spec.
- Notes and assumptions:
  - Gemini calls: 41, six paintings, four characters, and 31 kit calls.
  - The chaos painting registered with one translation, (-3, -3) px, and its
    residual. The scribbled boulders were invented by the model, not cut.
  - The fairy sheet contains four fairies. It is not an animation.
  - The tree is a plate because nobody stands behind it. It had been a canopy
    with an empty footprint, which drew Fae behind the roots. A test pins this.
  - The key option is scoped and opt-in. It does not change other assets.
  - Milestone 55 clears `forest_fizzy` during the kid's calm-down.
  - Kept art: the raw approved painting, its tiles, and the registered chaos
    painting. The raw chaos edit and the unregistered resizes aren't kept (as
    the playing field keeps only its resized second painting), and the
    fairies' first four-frame atlas left with the split into four fairies.
- Wording for the owner:
  - "This is the Enchanted Forest. The Ancient Tree dreams the whole land."
  - "The Mystic Pond grants wishes. A kid in a purple hood made a wish and drank from it."
  - "Then everything went fizzy and purple, with scribbles everywhere. The Ancient Tree can't dream properly with all that fizz!"
  - "The Mystic Pond is fizzing purple, just like the clubhouse soda."
  - "This is where wishes come true. The fairies said someone drank from it after making a wish."
  - "Purple scribbles are all over the Ancient Tree's bark."
  - "It looks tired."
  - "If it's dreaming the whole land, it can't dream properly with all this fizz."
  - "So you found my secret forest, Fae!"
  - "Nobody can stop the BOSS. Not even you!"
  - "We'll see about that!"
  - "You again? The BOSS is busy, Fae!"
  - "The butterflies keep tickling my wings. I keep telling them, \"Again!\""
  - "The Ancient Tree is older than every tree, even the trees that think they are very old."
  - "Hee hee! The pond bubbles made my shoes go squeak."
  - Journal: "The kid in the purple hood is waiting under the Ancient Tree. They called it THEIR secret forest... and they knew my name!"
  - Journal: "The fairies told me the Ancient Tree dreams the whole land, and a wish made the Mystic Pond fizz purple."

## Milestone 55: The kid in the purple hood **Status:** ✅ Completed (2026-10-18)
- The last calm-down (owner, 2026-10-17: Trace, then Talk). The kid in the
  purple hood is the Enchanted Forest's set piece `hooded-kid`, under the
  Ancient Tree at (1130, 730), drawn from his battle atlas (`chaos_idle`: the
  hood low, a giant purple marker; calm, `calm_idle`: Milo). Walking into him
  opens the battle, and his taunt is its intro: "So you found my secret forest,
  Fae! Nobody can stop the BOSS!" He replaces Milestone 54's front-view person
  and its `forest_kid` taunt.
- The biggest mini-boss: calm 200, six energy leaves, 40 coins, touch radius
  95, Fae's height on the overworld (140; he's a classmate) and 280 in battle.
  Wind-ups like the gull's and Mr. Pip's (turn 2, then every 3, two bubbles),
  feelings curious, bored, and grumpy, and no Run (`canRun: false`).
- Part 1, Trace: his bursts are purple scribbles, and Fae paints them back
  (spec 8). A swirl, a star, a heart, or a zigzag; a big burst, an infinity
  loop or a long zigzag. Arrows or a stick steer the brush; on touch a finger
  draws, through the action frame's optional `pointer` (0 to 1000 in the
  trace's square, only while the finger is down). Each dot reached is a hit:
  all of them great, half good. Reach 105, brush speed 20, and 180 ticks
  before the paint dries.
- Part 2, Talk: from half calm (100) he stops scribbling ("The kid stops
  scribbling... and listens."): no bursts, wind-ups, or feelings, and Talk is
  the only command. Three questions (`kid_talk_1` to `kid_talk_3`), each with a
  right, a partly right, and a wrong answer, graded by its `# grade:` tag (35,
  25, and 20 calm). The meter can't fill before the last question, and the last
  one fills it whatever the answer, so the reveal always comes through talking
  and nobody gets stuck. The answers are the dialogue's choice stickers; the
  HUD steps aside while they're on screen.
- Calmed: "The purple hood slips back... It's Milo!" The reward is the Milo
  sticker (the album has 13 slots) and 40 coins. The calm hook (`on_calm`)
  clears `forest_fizzy`, so the scribbles and the fizzing pond vanish as the
  battle ends. Milo stays under the tree. His talk (`milo_calm`) tells how it
  happened, then "The Ancient Tree is glowing again." Milestone 56 adds the
  ending there.
- Evidence:
  - Core unit tests: `trace.test.ts` (the check's rules and the pointer's
    parsing), `check-loader.test.ts` (every rejection), `kid-trace-tuning.test.ts`
    (the player models below), `talk.test.ts` (Talk's rules through real steps,
    the listening line, every answer graded once, and the turn bug below),
    `battle-view.test.ts` (Talk's projection and the HUD rule),
    `enchanted.test.ts` (the set piece, the reveal, the forest restored),
    `touch.test.ts` (the finger's mapping), and `gamepad.test.ts` (the finger
    through the device merge).
  - The recorded run `pass-party/kid.json` (`tools/sim/record-kid.ts`, on from
    the forest run): both parts of the battle, the answers GREAT, GOOD, and
    GREAT, the reveal, the reward, and Milo's talk twice, 19,034 ticks; its
    replay test, `kid-replay.test.ts`.
  - The e2e `kid.spec.ts`: real keys through the whole battle on Chromium and
    WebKit (`@smoke`), ending on Bun's hash, with screenshots at 1280x720 and
    874x402 of the opening, a scribble mid-paint, Talk's answers, the reveal,
    and the forest restored; a finger painting his first scribble on a notched
    phone (every dot, GREAT, through the real pointer); and a tap picking an
    answer (GOOD). The gallery's trace and Talk states, with layout checks in
    both engines.
- Gates: `just check` (105 test files, 902 tests, every recorded run, purity,
  lint) and `just build` passed. The full `just e2e` passed 809 tests with 2
  skipped, and failed 5: two journal tests on both engines still counted 12
  album slots (Milo's sticker makes 13; they read the count from
  `content/stickers.json` now), and WebKit's `journal-sound` baseline, which
  changed only by the 13th slot (viewed, and diffed: every changed pixel is in
  that slot). Both spec files then passed in full on Chromium and WebKit (18
  tests).
- Notes and assumptions:
  - Gemini calls: 5. The hooded kid's first sheet and Milo's hoodie strip, 2;
    the kid's sheet again on green, 3, two of them rejected. The first sheet was
    keyed on magenta, his own hue: the thin purple scribbles lost their colour
    to the despill. A script-swapped green copy was made and never kept.
  - A set piece, not a `# battle:` tag: walking into him opens the battle, as
    with Mr. Pip, and his taunt is its intro, so no new dialogue-close action
    was needed.
  - The trace was tuned against the real core with player models on arrows (a
    careful player, an eighth and a quarter of a second late), a finger, and
    one who does nothing. Careful and finger players get GREAT on every
    scribble, an eighth late GREAT, a quarter late at least GOOD on the normal
    ones, and nothing MISS. The first tuning flattened the swirl into a diamond
    and the star into a pentagon; they were redrawn as a spiral, a pentagram,
    and an infinity loop.
  - Talk's lines were rewritten in review, kinder, and answering what the kid
    says.
  - Found in review, each with a test that fails without its fix: the first
    Talk asked the last question (it counted battle turns); the scribble's
    overlay never drew in the real game (only in the gallery), and the e2e had
    read only its geometry; a finger never reached the game (the device merge
    dropped `pointer`), and the touch test had passed on the arrow player's
    help; Talk's turns opened with the button's name ("Talk") as their line;
    the answers covered the HUD on a phone; and the Talk lines showed their
    quote marks.
  - The front view (Milestone 54) left the runtime; its recipe and raw source
    stay, like the talking raccoon's (Milestone 28).
  - The battle sheet's hoodie is a two-tone patchwork; Milo's morning hoodie
    (Milestone 56) is calmer. For the owner's review.
- Wording for the owner:
  - Battle (`content/critters/hooded-kid.json`): the intro "So you found my
    secret forest, Fae! Nobody can stop the BOSS!"; the menu "How can Fae calm
    the kid in the purple hood?", and in Talk "The kid stops scribbling... and
    listens."; Soothe "Fae hums a soft tune. The kid's scribbles slow to a
    gentle swirl!" / "Fae hums softly. The kid pauses to listen for a moment."
    / "The kid scribbles right over Fae's humming."; Play "Maddie bats a
    purple paper star through the air. The kid laughs!" / "Maddie pounces on a
    scribbled star. The kid smiles." / "Maddie chases a star and skids in a
    bright purple squiggle."; Cast "Sue's ribbon paints a rainbow around the
    scribble. The kid cheers!" / "Sue's ribbon twirls around the purple fizz.
    The kid leans closer." / "Sue's ribbon catches a scribble and tangles. The
    kid giggles."; Juggle "Jordan juggles three paper stars in a perfect loop.
    The kid claps!" / "Jordan tosses a paper star high. The kid watches it
    drift down." / "Jordan's paper star flutters into a purple swirl."; Snack
    "Fae shares a crunchy cracker. The kid munches between scribbles."; the
    burst "The kid scribbles a giant purple squiggle in the air!", then "Fae
    paints the scribble back into soft watercolour!" / "Fae paints most of the
    scribble back into watercolour." / "The purple scribble poofs into
    harmless fizzy dots."; the wind-up "The kid scribbles faster and faster!
    The purple fizz is swirling everywhere!", "The kid's purple scribble grows
    even bigger!", "The purple scribble fades. Not one splash got through.";
    rest "Fae takes a little rest while the purple fizz settles."; soothed
    "The purple hood slips back... It's Milo!"
  - Talk 1: "You don't even know who I am!" [You beat the Star Racer high
    score, then scribbled out your initials.] "...You figured THAT out?" /
    [You left a Star Racer token in your stash.] "Maybe. Lots of kids play
    Star Racer." / [You're the boss of the whole forest!] "Ha! I WISH.
    ...Wait. That's kind of what I wished for."
  - Talk 2: "Nobody ever notices me anyway..." [I notice you! The paper
    planes, the star doodles...] "You... you saw those?" / [Everybody noticed
    the scribbles.] "That's not the same thing." / [Maybe nobody likes
    purple?] "Hey! Purple is the BEST color."
  - Talk 3: "So go on, Fae. Who am I?" [Milo?] "...Yeah. It's me." / [Someone
    from my class.] "Warmer... but who?" / [Rosie?] "Nope! Rosie's way better
    at kites than me."
  - Milo (`milo_calm`): "Fae... it's me. I'm really sorry about all the
    scribbles." / "My paper plane flew into the mist, so I followed it. I found
    this forest and wished at the Mystic Pond to be the best at everything,
    even Star Racer." / "I drank from the pond, and the fizz got out of hand.
    Fizz-fast, I could zip from our classroom to the hall and back before
    anyone noticed. That's how I peeked in, then sat back down." / "I only
    wanted to be noticed." / Fae: "I always notice you, Milo. You're my
    friend." / Sue: "Sue gives Milo a small wave. "We noticed you too."" /
    Jordan: "Jordan smiles. "You don't have to be the best at everything."";
    again, Fae: "The Ancient Tree is glowing again. It's so pretty now."
  - Journal: "The kid in the purple hood is waiting under the Ancient Tree.
    Their wish made all this fizz!", then "The kid in the purple hood was
    MILO! He wished to be the best at everything, and the fizz got out of
    hand."

## Milestone 56: Wake up **Status:** ✅ Completed (2026-10-18)
- The end (spec 1.2 and 7.4; owner, 2026-10-17: a wake-up morning). Under the
  restored Ancient Tree, Milo's talk offers [Watch the tree glow] or [Not
  yet]. Watching, the tree glows brighter and brighter and everything goes
  soft and white (a line tag, `# ending`). The game saves the dream first, so
  the save is the forest, calm, with the ending ready to watch again.
- Fae wakes in her bed, Mom at the bedroom door: "Fae! Wake up, sleepyhead!
  You'll be late for school!" A short playable morning, the dream's echoes in
  real life: Maddie is just a cat; Sue and Jordan aren't there; downstairs,
  pancakes, Oliver, and the fridge drawings; the journal under her pillow,
  full of drawings from the dream. Nothing autosaves, the lantern and the
  flute stay quiet, and the front door waits for Milo.
- By the front door, Milo, in a purple hoodie: "Morning, Fae! Your mom let me
  in." He had the WEIRDEST dream. Fae: "With a purple hood?" Milo: "How did
  you know?!" Then THE END: the credits as stickers (the friends Fae made,
  everyone she met, and "Thank you for playing!"), and the title. Continue
  goes back into the dream: the forest calm, every sticker and prize still
  there to finish.
- Evidence:
  - Core unit tests, `finale.test.ts`: the save's upgrade and refusals; the
    ending's one snapshot and the morning it opens; no autosave in the
    morning; the credits' entries, a flute friend credited once befriended
    and not just for following, and the loader's `flute/befriended` rule; the
    credits' beat and their still world; the morning's people, stairs, and
    front door (real steps, against the dream's open one); and Mom's second
    talk.
  - The recorded run `pass-party/ending.json` (`tools/sim/record-ending.ts`,
    on from the kid run): Milo's talk, the ending and its one save, the
    wake-up, the morning down to Milo, and the credits, 19,337 ticks; its
    replay test, `ending-replay.test.ts`. The kid run now answers Milo's
    second talk [Not yet] (`kid.json`, 19,070 ticks).
  - The e2e `ending.spec.ts`: real keys from Milo's choice through the
    credits on Chromium and WebKit (`@smoke`), ending on Bun's hash, with
    screenshots at 1280x720 and 874x402 of the choice, the morning, the
    kitchen, the credits, and the title. A press as the credits open doesn't
    skip them, the save after them is the dream's, and Continue resumes the
    dream's exact hash, in the session and after a reload. The gallery's
    credits, the largest (every friend Fae can make and the whole catalogue)
    and the shortest, at three sizes in both engines.
- Gates: `just check` (109 test files, 934 tests, 55 recorded runs, purity,
  lint) and `just build` passed. The full `just e2e` ran 831 tests on
  Chromium and WebKit: 828 passed, 2 skipped, and 1 failed, `sound.spec.ts`'s
  first test on Chromium, which found the audio already running before a key.
  Nothing here touches sound; it passed in the full run before, and 6 times
  out of 6 alone.
- Notes and assumptions:
  - Gemini calls: none. Milo's hoodie atlas is Milestone 55's.
  - The ending's snapshot is the dream as it stands: the forest and its safe
    spot. It never uses the invalid `enchanted/tree` spawn.
  - A story with `# ending` must have the bedroom, its `bed` spawn,
    `morning_start`, and `mom` (load validation); the core throws rather than
    fall back.
  - Milo's choices under the tree are sticky, so after Continue the ending
    can be watched again. The kid run picks [Not yet]; the ending's run, which
    starts with it, picks [Watch the tree glow].
  - No one joins while `finale` isn't null. Without that, Jordan rejoined the
    morning's party (`jordan_joined` stays true), and the ending's replay
    fails.
  - The credits step the core every tick, and the core holds the world still,
    so the browser's ticks and hash stay Bun's through them. Closing the
    credits with no dream snapshot throws instead of starting over.
  - Every flute friend names `befriended`, and the loader refuses one without:
    the Pond Pup's `pup_friend`, and the Acorn Squirrel's `squirrel_friend`
    (Milestone 60 landed while this was built).
  - Mom wakes Fae once; talked to again, upstairs or down, she sends her to
    Milo. Before, both Moms replayed the whole wake-up.
  - The credits rebuild their lists only when the entries change (they were
    rebuilt every frame), and the shell builds the entries only while they
    show.
  - Sue isn't in the recorded run's credits: the `pass-party` fixture puts
    her in the party without `sue_joined`, and the credits follow the story.
  - Found in review: the snapshot's invalid safe spot, silent content
    fallbacks, the credits' touch controls, friends missing from the credits,
    whole sprite sheets drawn as credit stickers, and a ternary with two
    identical branches.
  - For the owner's review: Milo's two hoodies (the battle sheet's two-tone
    patchwork, the morning's calmer one).
- Wording for the owner:
  - `tree_ending`: "The Ancient Tree glows brighter and brighter." /
    "Everything goes soft and white."
  - Milo's new `again`: "The Ancient Tree is glowing again. It's so pretty
    now." / [Watch the tree glow] "It's like it's... waking up?" / [Not yet]
    "Not yet. We can stay here a little longer."
  - Wake-up: "Fae! Wake up, sleepyhead! You'll be late for school!" /
    "...Mom? But the forest... and Milo... it was all a dream?" / "Breakfast
    is on the table. Pancakes!" / "Oh, and your friend Milo is downstairs!" /
    "You two will have fun walking to school together!"
  - Mom, talked to again: "Milo's waiting by the front door, sweetie. Have
    fun at school!"
  - Bedroom journal: "My journal is full of drawings from the dream."
  - Oliver: "Oliver giggles and points at the fridge drawings. They look like
    the forest, the fairies, and a purple scribble."
  - Front-door notice: "Milo's right here. I should say hi first!"
  - `front_door_morning`: "Morning, Fae! Your mom let me in." / "Hi! Want to
    walk to school together? I had the WEIRDEST dream..." / "With a purple
    hood?" / "How did you know?!" / "Maybe some dreams are better when you
    share them."
  - Credits: "THE END" / "FRIENDS" / "MET ALONG THE WAY" / "Thank you for
    playing!"

## Milestone 57: The lodge keeper **Status:** ✅ Completed (2026-10-17)
- The owner picked more people under the chaos spell (2026-10-17; NOTES.md's
  last unscheduled idea, more mini-bosses), starting with Pinecone Pass's
  lodge, locked since the pass was built: "Back soon, gone looking for a
  runaway hamster."
- Once Fae has calmed a hamster at the pass (who warns her to watch out for
  snowballs), the note leads on: a snowball whizzes past, and the lodge
  keeper, Mrs. Flurry, is home and fizzy from one sip of the hooded kid's
  purple soda, like Mr. Pip, flinging snowballs from her porch. No earlier
  recorded run reads the note after a hamster's calmed, so the pass looks as
  it always did until then.
- She's a person under the spell, a set piece like Mr. Pip, with Mr. Pip's
  numbers and friend commands, her own feelings (zoomy, grumpy, hungry), a
  wind-up (a giant snowball), and snowballs to catch, cut from her throw.
  Calmed, she tells of her runaway hamster, Biscuit (home all by himself,
  calm: the hamster Fae calmed), and the kid in the purple hood, and opens
  her lodge; its door stands open on the firelit inside.
- The lodge, a new room painted whole and split into a kit like the
  clubhouse: the fire; a pot of cocoa (one mug to take along); the guestbook,
  where somebody signed in purple marker and scribbled it out, a paper plane
  doodled in the corner (a clue toward Milo, kept quiet); and Biscuit, asleep.
- Art (`art/recipes/lodge-keeper.json`, `lodge.json`, `pass-lodge-open.json`):
  her body sheet, drawn to Mr. Pip's; the lodge room; and the pass with the
  door open, cut as an added prop (Milestone 49). Mr. Pip's atlas builder is
  now `tools/art/build-person.ts <id>`, for every person under the spell (his
  atlas rebuilds byte for byte).
- Evidence: unit tests (`lodge-keeper.test.ts`: the note before and after a
  hamster, her porch and battle content, her calm talk opening the lodge, the
  door's trigger, the room's look points and their lines, the area checks,
  and the journal), the recorded run `pass-party/lodge.json`
  (`tools/sim/record-lodge.ts`, on from Jordan's run: the note, the battle,
  her talk, and in through the door to the fire, the cocoa, and Biscuit) with
  its replay test, and the real-key e2e `lodge.spec.ts` (four moments at both
  sizes, the battle at its first menu, and the browser's and Bun's hashes
  match). Mrs. Flurry's sticker adds a twelfth album slot: the journal
  spec's slot counts and four journal screenshots were updated (one more
  "?" each). Gates: `just check` (835 unit tests, the sim, core purity,
  lint), `just build`, and `just e2e` (750 passed, 2 skipped; the 7 that
  failed were those slot counts and screenshots, then passed: 19 of 19 in
  the three specs, both engines).
- Notes and assumptions:
  - Her name, Mrs. Flurry, and Biscuit's are placeholders for the owner,
    like Mr. Pip's.
  - Her friend-command lines are her own; her numbers are Mr. Pip's.
  - Gemini calls: 10 (her sheet, the lodge room, the door edit, and seven kit
    isolates).
  - The sheet, the room, the door, the snowballs, and the wording are in the
    owner's review queue.

## Milestone 60: A second flute friend **Status:** ✅ Completed (2026-10-18)
- The owner picked a second flute friend (2026-10-18). NOTES.md: the flute
  "calls animal friends to your side", a bond is built "by feeding them
  treats and petting them", and "specific animals have specific abilities
  that help in puzzles and battles". The Pond Pup swims; the second friend
  climbs.
- The Acorn Squirrel, the Cliffside Trail's recurring squirrel: once Fae has
  the flute, a calm one's later talks offer a chin scratch and a snack, and
  both make a friend (`squirrel_friend`), the way the pup's bond works. The
  flute then calls either friend, or both, and sends either home. With only
  the pup a friend, its choices are what they were, so no earlier recorded
  run changes.
- His ability: in the Whispering Woods, high up the big west oak, is a dark
  knothole (already in the painting) that rattles in the wind, too small for
  Fae's hand and no place for the lasso. With the squirrel along, he scampers
  up and in, and comes back with a golden acorn (a keepsake for the clubhouse
  chest) and a pile of hazelnuts (three snacks). Its look point is at the
  oak's foot; no painting changed.
- Art (`art/recipes/acorn-squirrel.json`): his follower atlas, hopping
  upright toward and away from the camera and bounding on all fours to the
  side, with his idles (sitting up, his back, his side), built by
  `tools/art/build-acorn-squirrel.ts` the Pond Pup's way. Every sprite
  validator check passes as it stands.
- Evidence: unit tests (`squirrel-friend.test.ts`: the bond before and after
  the flute, in either order, without a snack, and the old-friend greeting;
  the flute with one friend and with two, both along at once; his roster
  entry, a calm trail squirrel stepping into the party, and sitting battles
  out; the knothole without him, with him, and empty after; its look point
  and the area checks; the journal), the recorded run
  `pass-party/squirrel.json` (`tools/sim/record-squirrel.ts`, on from the
  kitchen run: to the trail, a squirrel calmed, his tale and the bond, the
  flute, and back to the woods' knothole) with its replay test, and the
  real-key e2e `squirrel.spec.ts` (four moments at both sizes, him hopping
  along among them; the browser's and Bun's hashes match). The roster now
  ends with him, so the Sue and Jordan roster tests list him. Gates, on the
  tree rebased onto Milestone 55 (54 and 55 landed while this was built):
  `just check` (916 unit tests, the sim, core purity, lint), `just build`,
  and `just e2e` (815 passed, 2 skipped).
- Notes and assumptions:
  - He's a he, like the pup. His bond's lines are his own; his tale is the
    trail squirrels' (the bottle cap and the acorns).
  - Both friends can come along at once: the whole roster fits behind Fae at
    every spawn (the area checks), and the flute offers each friend's call.
  - The look point is text only, like the pond's glint: the knothole is
    painted high on the oak and is off screen while Fae stands at its foot.
  - His hop toward the camera took 13 of the art's 25 calls; the strips
    turned three-quarter, changed his head's size, or changed his outline
    more than 1.20x. The owner agreed to waive the head-on symmetry check for
    the last of them (call 24), but its squirrels touched and couldn't be
    cut apart. Its spaced-out redraw (call 25) keeps every pose and passes
    every check, so nothing was waived.
  - Gemini calls: 25, all for the sprite, none failed.
  - The sprite, his size, the knothole, the reward, and the wording are in
    the owner's review queue.

## Milestone 62: Clover Hills **Status:** 🚧 In progress (2026-10-18)
- The owner asked for more open world between the towns, to explore and to
  meet bad guys on the way (2026-10-18). NOTES.md lists meadows and hills,
  and wants more casual enemies, mostly animals under the chaos spell, in
  light battles that aren't scary.
- Clover Hills (a working name): a new outdoor land, painted whole and split
  into a kit, between Meadow Park and the Whispering Woods. The park's
  meadow runs out east into the hills, and the hills' path climbs north to
  the woods' south clearing. That closes a ring (Cloverhollow, the bay, the
  trail, the pass, the woods, the hills, and home), and the woods and the
  clubhouse get a way home that doesn't go round by the bay.
- Its bad guys recur like the trail's: rolled fresh each time Fae arrives,
  calm until she leaves, coins for every calm, and each kind's sticker once.
  One or two new kinds join some old ones.
- A small secret at a lookout, for a flute friend's ability.
- Both new doors go where no recorded run walks; every town edge and the bus
  stay as they are. The hills get no bus stop, and their journal map label
  stays hidden until Fae has been there.
- Assumption: the owner said "keep going" twice after asking for this, so
  the route was picked without asking which one. A road from the plaza to
  the bay was set aside because the finale's recorded runs walk that edge.

## Milestone 63: The art teacher **Status:** 🚧 In progress (2026-10-18)
- The owner asked for more mini-bosses (2026-10-18; NOTES.md: more
  mini-bosses, people and animals under the chaos spell). The owner's school
  staff concept sheet (`docs/art/concepts/npcs/school_staff_npcs.png`) draws
  five teachers. Four are in the game; the fifth, the art teacher, never
  appears, and the east hall's art room door has only ever said it's locked.
  No recorded run reads that door.
- Once Fae has found the hooded kid's stash (purple markers, fizzy soda, and a
  Star Racer token), purple paint seeps under the art room door. Reading it
  then brings the art teacher out, fizzy from one sip of the purple soda and
  painting wild purple swirls: "NOBODY touches MY paints!" Until a player
  reads the door after the stash, the hall is as it was.
- She's a person under the spell, a set piece like Mr. Pip and Mrs. Flurry,
  drawn from the concept sheet: short brown hair, a rainbow bandana, a striped
  shirt under paint-spattered overalls, and a giant brush. Her bursts are
  paint swirls that Fae brushes back into shapes before the paint dries
  (Trace, Milestone 55), in shapes of her own, with feelings and a wind-up (a
  giant paint bucket).
- Calmed, she says the kid in the purple hood borrowed every purple marker
  and left her a fizzy soda, and she opens the art room: a new room, painted
  whole and split into a kit, with look points (the easels, the class art
  wall, the empty purple marker box). Her sticker joins the album.
- Evidence: unit tests for the door, the set piece, her battle content and
  trace shapes (against the player models), her talk, and the room; a
  recorded run on from the stash, with its replay test; and a real-key e2e at
  both sizes, in both engines.
- For the owner: her name (Ms. Rowan, a tree, like Ms. Maple, Ms. Willow,
  Coach Ash, and Nurse Holly), her lines, her sheet, and the room.

## Milestone 64: The lifeguard **Status:** 📋 Planned
- Bubblegum Bay, Sue's land, has no one under the spell, and someone left a
  picnic there: watermelon slices, a sun hat, and a sandy towel. No recorded
  run reads it.
- Once Sue has joined, reading the picnic brings out its owner, the bay's
  lifeguard, fizzy and blowing her whistle at everyone: "NOBODY splashes on
  MY beach!" A set piece like Mrs. Flurry: beach balls to catch (cut from the
  bay's painted ones), feelings, and a wind-up (a giant beach ball). Calmed,
  she shares her watermelon (snacks), and her sticker joins the album.
- For the owner: her name, her look (drawn to Mrs. Flurry's sheet; the
  concepts have no lifeguard), and her lines.

## Milestone 65: QA mode and the save library **Status:** ✅ Completed (2026-10-18)
- The owner asked for a way to playtest later stages without playing from
  the start (2026-10-18): a library of QA saves, a debug mode that jumps to
  one, no autosave while testing, and QA saves kept apart from the player's
  save. Spec section 11 changes with it: fixtures stop being the only
  shortcut. QA mode is in dev and harness builds only (the browser and the
  iOS simulator), like the hook (owner, 2026-10-18).
- Save packs: `content/qa/saves/<id>.json`, each a save in the current
  format, listed in `content/qa/saves.json` (an id, a label, a short note,
  the fixture and recorded run it came from, its tick, and whether it is
  interim). `tools/qa/build-saves.ts` replays the runs and cuts each pack
  where the game itself would autosave (`autosaveNeeded`), so every pack is
  a save a playthrough wrote. A unit test fails when a pack goes stale: each
  must load with `parseSave` and hash the same as its run replayed to its
  tick. The fix is rerunning the tool.
- Real packs come from the runs that start at a new game: chapter one (such
  as after breakfast, after the fountain frog, and the tree house) and the
  east road (arriving in Bubblegum Bay). Interim packs come from the ends of
  the `pass-party` runs (Jordan, the lantern, the woods, the school chapter,
  the lasso, the flute, the clubhouse, the kitchen, the arcade, the lodge,
  the mist, the forest, and the kid before the ending), labelled in the menu
  as starting from the shortcut that skips chapter one and Sue's joining
  (owner, 2026-10-18). Milestone 68 replaces them.
- QA mode: on the title, Q (or a long press on the logo) opens a QA menu of
  the packs, and `?qa=<id>` boots straight into one. The title looks as it
  does in production. While testing, a QA badge names the pack, nothing
  autosaves, and the player's save is never read or written. Reload or
  relaunch to leave.
- `just build` fails if QA mode or a pack reaches the production bundle, or
  if the harness bundle lacks it.
- Evidence: unit tests (pack freshness and the QA flow), a real-key e2e (Q
  on the title, a pack picked with the arrows and Z, a door walked through,
  the player's save unchanged byte for byte and no autosave written; `?qa=`
  boots the pack with its badge), the menu and the badge screenshotted and
  viewed, and the menu on the iOS simulator.
- Gates and notes (2026-10-18): Q was free in the input map, so it is the
  keyboard entry, alongside a logo long press and `?qa=<id>`. The library has
  four real packs from the new-game chapter-one/east-road runs and seventeen
  interim packs from the pass-party runs, each cut at a valid autosave. QA
  content is loaded only by the dev/harness dynamic module, keeping the player
  slot untouched and autosaves disabled.

## Milestone 66: Experience and levels **Status:** 📋 Planned (a proposal for the owner's review)
- The owner asked for experience and levels (2026-10-18), for the cheat
  console (Milestone 67) to edit. The game has neither, so this adds them as
  gameplay first. Nothing here is built until the owner approves it.
- XP: every calm pays XP the way it pays coins, from the critter's content:
  10 for an ordinary critter, 40 for a mini-boss (the gull, Mr. Pip, Mrs.
  Flurry, and those after them), and 60 for the hooded kid. Old friends,
  calmed on touch, pay theirs too. The reward line gains it ("+8 coins, +10
  XP!").
- Levels: Fae's level is read from her XP through a table in
  `content/levels.json`, from level 1 at 0 XP to level 10 at about what a
  full playthrough earns. Only XP is saved, so the two can't disagree.
- What a level does: each level past the first adds 1 calm to Soothe and the
  friends' commands, and levels 4 and 8 add an energy leaf, both from the
  table. Talk and Snack stay as they are, so the finale plays the same.
  Battles get a little shorter as Fae grows: the late game gets gentler for
  younger players, and the calm-downs stay short (pillar 3).
- Shown: a level-up line after the reward ("Fae reached level 3! Calming
  comes easier.") with its own sound, and a Level pill with an XP bar on the
  journal's notes page beside Coins and Snacks.
- Save version 10: older saves upgrade with 0 XP, counted from then on, as
  calm counts were in version 7.
- Cost: once Fae levels, every recorded battle plays differently, so the
  runs are re-recorded, their pins and the QA packs regenerated, and the
  battle screenshots redrawn and viewed.
- For the owner: the names (XP and Level, or something gentler), the
  numbers, and the level-up line.

## Milestone 67: The cheat console **Status:** 📋 Planned
- In QA mode only (Milestone 65): the backtick key, or a tap on the QA
  badge, opens a console. It sets XP and level (a level sets XP to its
  threshold), coins, snacks, tickets, prizes, stickers, and the tools Fae
  carries (the lantern, the lasso, the flute, and the map, which are story
  variables such as `has_lasso`); `help` lists the commands.
- `save <name>` keeps the current state in a QA-only slot, listed in the QA
  menu and never the player's; `export` shows it as a save file to attach
  to a bug report or add to the library.
- Still left out: teleporting, eval, and setting any other story variable.
- The commands are pure functions with unit tests, and the console is a
  thin shell over them. A real-key e2e types commands and checks the
  journal.

## Milestone 68: The golden path **Status:** 📋 Planned
- One recorded run from a new game to the credits, the recorders chained in
  story order (chapter one, the bay and Sue, the bus and Jordan, the
  lantern, the woods, the school chapter, and on to the kid and the ending),
  each picking up where the last stopped.
- The QA library's interim packs give way to packs cut from it at each
  story beat.
- The late-game runs and their tests leave the `pass-party` fixture. It put
  Sue in the party without `sue_joined` (she's missing from the credits) and
  skipped chapter one (the fountain frog still in chaos at the credits, the
  bay road shut) and breakfast. The credits' screenshots change: Sue joins
  them.

## Roadmap after Milestone 19
Chapter one ends with the purple hood's Cloverhollow School name tag.
- Who the kid in the hood is, and how Fae finds out: Milo, unmasked when the
  hood falls in the finale's calm-down (owner, 2026-10-17; Milestones 53 to
  56).
- Audio: sound effects landed in Milestone 37 (owner, 2026-10-08); music and
  ambience are still later. TestFlight and a paid developer account: later.

### The world and how it's played (decided 2026-10-07, open to the owner's review)
The owner asked for EarthBound-style decisions for travel between the lands,
more bad guys, and the blacklight lantern, made and built while away.
- One connected world, no separate map screen: each land is a set of painted
  areas, and the lands are joined by trails (areas too) that Fae walks, like
  EarthBound's roads between towns. Cloverhollow is the town; Bubblegum Bay
  lies east; Pinecone Pass north, up the mountain; the Whispering Woods (and
  the clubhouse) west; the Enchanted Forest in the middle, sealed until late.
  Trails run between neighbouring lands around the ring.
- Buses are fast travel between towns with a stop (Cloverhollow and Pinecone
  Pass first). The journal gets a map page later: the lands visited and the
  bus routes.
- Bad guys are visible, never random: chaos critters wander the trails and
  come after Fae when she's near; touching one starts a calm-down battle.
  Since Milestone 28 they're recurring species: an area rolls its critters
  fresh every time Fae arrives, and a calmed one stays calm until she leaves.
  People can be under the chaos spell too: they're the mini-bosses
  (NOTES.md).
- Owner, 2026-10-07: raccoons are a recurring bad guy, a chaos critter species
  met all over the world like the dogs and the other creatures, not a single
  character or a boss. The kid causing the chaos is unnamed, and who it is
  stays secret until the very end; the player may meet them earlier as an
  ordinary kid without knowing. Until then they're only "a kid in a purple
  hood". The kid knows their secret; the player doesn't. They're glimpsed
  running off, EarthBound style, and talked about through the story. The
  talking raccoon (Milestone 15) and the lines that blamed "the raccoon" were
  reworked in Milestone 28.
- Each friend brings one battle command: Maddie's Play, Sue's Cast, Jordan's
  Juggle (pinecones).
- Tools open the world: the blacklight lantern first (below); the lasso (from
  the PE teacher) and the flute (from the music teacher) later.
- The blacklight lantern: the owner's concept (`blacklight_lantern.png`) draws
  it as a magnifying glass with a purple blacklight lens, inactive and active,
  so it's built as drawn. Jordan uses it on night hikes and gives it to Fae.
  Switched on, it shows what the chaos left behind: glowing purple paw
  prints, invisible-ink notes (journal clues), and trail markers that open
  hidden paths.

## Milestone 58: The arcade, nearer its concept **Status:** ✅ Completed (2026-10-17)
- The owner chose arcade polish next (2026-10-17): bring the room closer to
  its concept (`docs/art/concepts/environments/arcade_interior.png`), which has
  neon words on its walls, lettered machines, more machines on the floor,
  and a middle row of cabinets.
- Neon "ARCADE" in pink on the left wall beside the door, and "PLAY" in teal
  on the right wall above the claw machine, beside the neon rocket, planet,
  and stars already there. The counter has a yellow "TICKETS" board and the
  claw machine "CLAW" on its top band.
- On the open floor, where no recorded walk goes: a purple cabinet like the
  concept's, its screen showing a little rocket and a neon rocket on its side,
  near the room's front corner (`rocket-cabinet`, a canopy that fades while
  Fae is behind it, look point at its front); and a red gumball machine
  beside the claw machine, next to the three on stands. The cabinet has a
  line before Mr. Pip is calm
  and one after. The back-row Star Racer cabinet stays as it is: its
  scribbled-out high score is a clue in the finale (Milestone 55).
- Not yet: the concept's middle row of four cabinets. It stands where every
  walk through the arcade goes, so it changes the arcade's recorded run and,
  through the pass-party chain (woods, arcade, school, gym, music, field,
  flute, lasso, kitchen), every run after it. The finale (Milestones 53 to
  56) is recording runs on from that chain now, so the row waits for the
  finale to land, and then the chain is re-recorded once.
- Evidence: every recorded run replays unchanged (`bun run sim`, 47 runs)
  and the area checks pass (nothing hides Fae; the cabinet is a canopy); the
  new run `arcade/rocket.json` (`tools/sim/record-rocket.ts`: the cabinet
  looked at fizzy, Mr. Pip calmed, looked at again) with its replay test and
  its real-key e2e (`rocket.spec.ts`, the room at both sizes, hashing the
  same as Bun's); the kit rebuilt from a clean checkout with no calls and no
  change; the older props re-cut with their sizes and alpha unchanged, the
  claw machine and counter by their lettering, the rest by re-encode noise
  (on cream at most 0.87/255); every word read at 3x; and the room's
  screenshots viewed.
- Notes and assumptions:
  - The owner's to review: the signs' words, the new cabinet's and gumball
    machine's places, and what the cabinet becomes (Milestone 59).
  - Planned as Milestone 53 and renumbered 58 at merge: the owner's finale
    took Milestones 53 to 56 while this was in progress.
  - The first art pass (the worker's) was redone: the model had redrawn the
    whole top of the room for the words, and one transform can't register a
    redrawing, so the walls came back nearly unreadable; its cabinet was a
    tall, flat block. Each word was then painted in its own small crop (the
    model keeps a small crop's composition), and the cabinet redrawn over a
    box block-out with its marquee, screen, and controls. The gumball machine
    (red, not the plan's yellow, to match the three by the wall) was painted
    in front of the claw machine first, where it stood between Mr. Pip and
    the claw machine in every arcade screenshot, so it was painted again
    beside the claw machine.
  - Three kit caches went stale after a painting edit, found because the
    lettering didn't reach the frames: the assembled painting, each subject's
    crop, and each subject's object and hole masks were only made when
    missing, so an edited painting was cut as the old one (new subjects'
    samples showed bare floor, and a local rebuild didn't match a clean
    checkout's). The painting and crops are now taken afresh each run, and a
    mask is made again when it's older than what it's made from
    (`tools/art/kit.ts`, `docs/art/kit.md`). A clean checkout now rebuilds
    the arcade byte for byte with no calls.
  - Art, 21 Gemini calls (the generation log): 6 edits (4 kept) and 15 kit
    isolates (2 kept); `art/recipes/arcade-concept-edits.json`.

## Milestone 59: A fourth arcade game **Status:** ✅ Completed (2026-10-18)
- Comet Cruise, on the teal cabinet beside Boop-a-Mole's (`cabinet-second`;
  the rocket cabinet it was first planned for went in Milestone 61): 2 coins
  a run, once Mr. Pip is calm. A little rocket at the foot of the cabinet's
  screen steers between three lanes, catching the stars and slipping past
  the space rocks that come down them; a star pays 2 tickets. A rock only
  bumps it: the rocket wobbles and can't steer for a moment. Nothing is ever
  lost, and a run never ends early.
- A run is 16 stars and 8 rocks, drawn as it opens from the game's random
  generator (a star first, never two rocks in a row, never the same lane
  twice running), one setting off every 48 ticks, each coming down faster
  than the one before (96 ticks to 60): about 20 seconds, like a round of
  Boop-a-Mole. A fresh left or right press moves the rocket a lane; it
  slides there, leaning into the turn.
- The close-up: a painting of the teal cabinet's front (its screen dark
  glass, a blank marquee, a stick and two buttons), with the run drawn in
  code on the screen in perspective and painted sprites: the rocket in four
  poses, a star and its sparkle, a rock and its puff. On a phone, left and
  right arrow stickers steer, where the stick would be, like Lean's.
- The back-row Star Racer cabinet stays as it is: its scribbled-out high
  score and the Star Racer token are clues in the finale (Milestone 55).
- Evidence: the rules' unit tests (`tests/unit/comet.test.ts`: the draw, the
  travel, the moves, the slide and lean, catches, bumps, passing, the end
  and its result, the cues, and the loader), the close-up's layout
  (`comet-layout.test.ts`, on the real calibration and a real run) and
  calibration (`comet-calibration.test.ts`). The recorded run
  `arcade/comet.json` (`tools/sim/record-comet.ts`, 2047 ticks) calms Mr.
  Pip and plays a run: 14 of 16 stars caught, 2 let go, 1 rock bumped, 28
  tickets paid once (`comet-replay.test.ts`). `comet.spec.ts` plays it with
  real keys, hashing the same as Bun's replay, and on a phone steers by
  quick taps on the arrow stickers to a star outside the middle lane, in
  both engines. The gallery's six states, each a real run's, are laid out
  within a pixel of the layout at 874x402 and 1280x720 in both engines.
  `just check` (112 test files, 978 tests; `bun run sim`, 53 runs) and
  `just build` passed, and so did the full `just e2e` (883 tests on both
  browsers, 2 browser-only skips; 201 WebKit tests that lost the test
  server late in the first run passed when run again). 22 new baselines (6
  of the real-key run, 16 of the gallery), each viewed before it was kept;
  no existing baseline changed.
- Notes and assumptions:
  - Approved by the owner (2026-10-18) as built: the game and its name, its
    numbers (2 coins; 16 stars and 8 rocks; 2 tickets a star, so 32 at
    best; the travel from 96 ticks to 60; a 24-tick wobble), its lines
    (`comet_cruise` in `content/story/main.ink`, and `comet` in
    `content/arcade.json`), and the art.
  - Art, 5 Gemini calls (the generation log), all kept as sources: the
    cabinet, 2 (one used), and the sprites, 2 sheets (one used) and an edit
    taking the used sheet's star glow away. It had been painted over the
    magenta and came out pink, which keying can't separate; a glow, if
    wanted, can be drawn in code. `art/recipes/comet-cabinet.json` and
    `comet-sprites.json`. Openverse had nothing for either.
  - Fae's look point is the cabinet's front, (366, 433); every recorded run
    replays unchanged.
  - On touch the close-up keeps clear of its arrows at the bottom left
    (`--touch-reserve-left`, like the right buttons' reserve), so the
    cabinet sits a little right of centre there.
  - The new tests' timings come with CI's next record
    (`tests/e2e/timings.json`); until then the sharder weighs each at its
    project's median, as for Milestone 60's.

## Milestone 61: The arcade, rearranged **Status:** ✅ Completed (2026-10-18)
- The owner rearranged the arcade (2026-10-18) from mockups built from the
  room's own sprites (the sixth approved): one gumball machine, not four; the
  skee-ball lane and the rocket cabinet no longer standing awkwardly on the
  front floor.
- The skee-ball lane stands in the room's right corner, its hood against the
  back wall in front of the claw machine's right side, where the three
  gumball machines on stands were, rolling out toward the middle of the room.
  Fae plays it from its left (look point `skee-ball` at (850, 593)). One red
  gumball machine, larger than the old ones, stands in the floor's front
  corner facing into the room (its plain back to the camera); it has no look
  point. The rocket cabinet goes: it was only ever looked at, and the painted
  cabinets look better without it. Its knot, recorded run, replay test, and
  e2e go with it. Mr. Pip stands at the back, left of the ticket counter, at
  (630, 392). The middle of the floor stays open.
- The claw machine's look point moves to (908, 477), the left of its front:
  the lane's back is too close to the old spot below it for Fae to stand.
- Art: the Milestone 58 painting takes the approved painting's pixels back
  wherever the old lane, the rocket cabinet, and the gumball machine beside
  the claw machine were (no calls). Then two edits, each a crop with a
  flat-colour block-out at its exact place and one call: the lane (its
  design the Milestone 45 lane, mirrored; the model also repainted the wall,
  floor, and the claw machine's side where the stands were) and the gumball
  machine (the Milestone 58 machine's silhouette 1.4 times, seen from
  behind). The kit cuts the new lane and gumball machine (one isolate each)
  and drops the five removed props. The lane's isolate kept three thin lines
  that aren't the lane (the claw machine's bottom ink line, an upright line
  on the wall, and the wall's base line); exclude polygons cut them. The
  first would have drawn across Fae between the claw machine and the lane.
- Every recorded run through the arcade is recorded again, since Mr. Pip
  moved: the arcade's own (claw, skee-ball, Boop-a-Mole, the kit walk) and
  the pass-party chain from the arcade on (arcade, school, gym, music, field,
  flute, lasso, kitchen, squirrel, mist, forest, kid, and Milestone 56's
  ending). Each reads the same beats; only the replay tests' tick pins
  changed. The chain's runs end sooner (the arcade by 52 ticks, school to
  squirrel by 111, mist by 94, forest to the ending by 101), and the arcade's
  own moved by 91 fewer to 37 more. The kit walk now goes behind the
  skee-ball lane: the counter's hiding spot is in Mr. Pip's touch circle, and
  there's no room to stand in front of the gumball machine.
- Evidence: `just check` passed (108 test files and 933 tests; `bun run
  sim`, 52 runs), and so did `just build` and the full `just e2e` (828 tests
  on both browsers, 2 browser-only skips). 143 baselines changed (123
  Chromium, 20 WebKit), and each was viewed before it was replaced: the
  arcade's against the approved mockup, the rest as old and new crops of what
  changed. Outside the arcade only later moments that now come sooner
  changed: the harness's tick label, idle frames, critters along their paths,
  and, at the Misty Path's seal, a camera 25 pixels lower. The arcade's area
  checks pass, and from a clean checkout its kit rebuilds with no calls and
  no changes. `rocket.spec.ts` and its two baselines are gone.
- Notes and assumptions:
  - The owner's to review: the room (`art/review/m61-room.png`) and its
    screenshots.
  - Numbered 61, not 59: Milestone 60 (a second flute friend) landed while
    this was in progress. Milestone 59 (a fourth game) now goes on the teal
    cabinet beside Boop-a-Mole.
  - Milestone 56 (Wake up) landed while this was in progress too: its kid
    recorder and its new ending run were run again on the new chain.
  - The changed baselines were viewed by a second model (the multimodal
    reviewer): late in this milestone the agent's own image reads came back
    empty (it couldn't read a probe image of a random number), and the
    reviewer read three such probes exactly. One label it read was 17 ticks
    off; the replay settled it.
  - Mr. Pip's right side is behind the counter's left end, as in the
    approved mockup. About (595, 396) would clear the counter, but he would
    cover the Star Racer cabinet (a finale clue) and his touch circle would
    reach its look point.
  - The gumball machine covers at most 57% of Fae standing behind it (the
    hiding check flags 75%), so it isn't a canopy.
  - The claw machine keeps its isolate: its crop didn't change, and nothing
    can stand behind it where the old stands and gumball machine notched it.
  - The Milestone 45 recipe is retired, and the Milestone 58 recipe marks its
    rocket cabinet and gumball machine edits removed. Their raw outputs,
    block-outs, and masks stay; the masks outline what was put back.
  - Art, 4 Gemini calls (the generation log), all kept: 2 edits and 2 kit
    isolates; `art/recipes/arcade-rearranged.json`.

## Milestone 36: Gamepad support **Status:** ✅ Completed (2026-10-08)
- Standard-mapping gamepads now share the keyboard and touch `ActionFrame`:
  radial 25% left-stick dead zone with rescaling, d-pad priority, and the
  standard confirm, cancel, menu, and lantern buttons. Multiple standard pads
  merge while preserving touch movement precedence over keyboard and gamepad.
- The imperative poller samples on every animation frame and latches button
  presses until the next game tick, including blur and reset clearing. Pure
  mapping, latching, and merging rules have unit coverage, and a unit test
  runs the new game with a pad's d-pad and buttons and with the same keys:
  the merged frames are identical and the states hash the same.
- Browser e2e uses only an `addInitScript` device-boundary replacement for
  `navigator.getGamepads()`, then drives the real game: stick and d-pad
  movement, Start and B for the journal, A for a dialogue, and X for the
  lantern, on Chromium and WebKit. No dependencies or content were added.
- iOS: WKWebView exposes the Gamepad API when the web view is first
  responder (WebKit bug 269292); from iOS 18 it also notices when the view
  becomes first responder after load (WebKit PR 26444). Capacitor makes the
  web view first responder on appear, so pads should work on iOS 18+;
  iOS 15 to 17 and real hardware are unverified. No native setting was added.
- Gates: `just build`, typecheck, lint, the gamepad unit tests, and the
  gamepad e2e (12 of 12, repeated on both browsers) passed. `just check` had
  one time-out in an area test this milestone doesn't touch, under a load
  average of about 130 from parallel milestones; alone it passed. The full
  `just e2e` suite was deferred by the owner (2026-10-08) for the same load
  and still needs a run.

## Milestone 37: Gameplay sound **Status:** ✅ Completed (2026-10-08)
- Sound effects only (owner, 2026-10-08): no music, ambience, or voice.
  VoiceStudio was considered at the owner's suggestion and set aside: it
  makes speech (TTS, cloning, dubbing), not sound effects, and voice acting
  is out of scope (spec 13).
- `soundCues(previous, next)` in `src/core/sound.ts` is a pure projection of
  state changes, like `autosaveNeeded`; `step()`, the state shape, and the
  save version are untouched. Cues: dialogue open, advance, close, and text
  blips; choice move and select; journal open and close; footsteps; door and
  arrival; coin, item, and sticker; lantern on and off; battle start,
  command, hit, win, run, and rest (a battle that ends without calming never
  plays the win chime).
- `src/platform/audio.ts` synthesizes every cue with Web Audio from a
  recipe table of short oscillator and filtered-noise segments; no files and
  no dependency. A recipe is plain data, so a cue can later point at a clip.
  The AudioContext unlocks on the first key, pointer, or touch.
- Mute: M, or the `♪ on/off` button in the journal's Notes header. Stored
  under its own Preferences key `cloverhollow-audio`, never in the save. A
  first draft put the button in the touch HUD; it changed every phone
  gameplay baseline (which Milestones 33 and 34 are re-baselining), so it
  moved to the journal and only the six journal baselines changed.
- Harness: `sound.log()` (recent `{ tick, cue, played }`) and `sound.muted()`.
- Gates: `just check` (415 tests, sims, purity, lint) and `just build`
  passed. The full `just e2e` suite, run in batches under a load average of
  60 to 80 from parallel milestones: 410 of 414 passed. Two failures were the
  shop journal baselines (`journal-supplies`, now showing the `♪` pill;
  updated after viewing). Two were `ui-gallery` sticker tests timing out
  under load; they passed 12 of 12 repeated alone.

### Sound follow-ups done (2026-10-08)
- Unlock: the AudioContext is made at boot and resumed right away, on every
  key, pointer, or touch, and whenever a cue plays while it isn't running.
  A gamepad press is not a user activation in any browser (the HTML spec's
  activation-triggering events are keys, mouse, pointer, and touchend), so on
  the web a pad-only player still needs one key or click. The iOS app is
  different: Capacitor sets `mediaTypesRequiringUserActionForPlayback` to
  none, and on the iPhone 17 simulator the harness logged `audio suspended`
  then `running` at boot with no touch, and `journal-open` played. Pads get
  sound on iOS from the start.
- Fixed on the way: WebKit reports `interrupted`, not `suspended`, before a
  gesture, and the old unlock only resumed `suspended`, so WebKit (and so
  likely iOS Safari) never started. M37's e2e only checked that cues were
  logged; `sound.spec.ts` now checks a cue really plays after a real key,
  on Chromium and WebKit.
- Silent switch: kept WebKit's default `ambient` session, so the switch mutes
  the game, as Apple suggests for non-essential game sound.
- The journal's `♪` pill is drawn like the coin and snack pills (26 px, the
  same border, fill, weight, and shadow) with an invisible larger hit area.
  With `♪ off` and 999 coins the row still fits on a phone, 34 px clear of
  the heading. Ten journal baselines were updated after viewing them.
- Harness: `sound.state()`, plus `[cloverhollow] audio` and
  `[cloverhollow] sound` log lines for native checks (spec 11).
- A fix (2026-10-18): the first `sound.spec.ts` test sometimes found the
  audio already running before any key, on Chromium in a loaded full run.
  Playwright runs each evaluate in Chromium as a user gesture, and the shell
  made the AudioContext only after the renderer's `app.init`, which waits on
  chunks from the preview server; when they came late, the harness's first
  evaluate came first, and a context made after it starts running. Sound now
  starts first in boot, before anything awaits, so its context exists before
  the page has loaded (spec 3.3). The test now slows every script by 200 ms,
  as a busy server would: with sound made after `app.init` it fails 6 runs in
  6, and it passes in both browsers.

### E2E suite speed (2026-10-08)
- Cause, measured: with the game paused by the harness, Pixi still redrew
  the canvas every animation frame, in software in headless Chromium, and
  every Playwright command queued behind that draw. On a paused area an
  `evaluate` took 64 ms and a key press 153 ms; with the canvas hidden,
  0.7 and 1.5 ms. Now the shell draws from its own frame callback and, while
  paused, only after a step, reset, area load, resize, or pointer press
  (spec 3.1): 5 ms and 24 ms. The two trail flows went from 32 s and 48 s to
  14 s each. Skipping the render inside `step` alone saved nothing (it was
  tried and dropped; Hook API v1 is unchanged), and a step's own draw outside
  an animation frame didn't reliably reach the screen in headless Chromium.
- Owner (2026-10-08): Chromium runs every spec; WebKit runs the layout, UI,
  and input-device specs plus five flows tagged `@smoke` (the frog battle,
  the bedroom walk, the dialogue window, save and resume, and the touch
  lantern). 77 WebKit baselines for flows WebKit no longer runs were deleted;
  a branch that re-baselines one of them should drop it.
- `harness.spec.ts` waits for real-time movement with `expect.poll` instead
  of a fixed 500 ms sleep.
- `harness.spec.ts` speed: measured 251 s Chromium and 54 s WebKit before;
  sharing a page (per worker, rebooted after a failure; not serial) within
  the reset-safe movement and deterministic-replay
  describes, with one boot and cached area textures, brought repeat runs to
  80 to 85 s Chromium and 20 to 23 s WebKit. Boot/title/save coverage remains
  on fresh pages.
- Full `just e2e`, the same 16 spec groups before and after, both under a
  load average of about 50 to 80 from parallel milestones: 21.0 minutes of
  Playwright time before, 10.1 after (388 tests, all passed; gamepad's group
  adds 15 s). The slowest spec is now `harness.spec.ts` (62 tests, 2.8
  minutes on both browsers), the next place to look.

### E2E suite speed (2026-10-16)
- CI's four-vCPU runner was still using Playwright's default two workers. A
  SwiftShader Chromium GPU process can consume up to three cores, so the two
  long real-key flows contended nondeterministically: the passing main run
  (38983110375) took 30.3 minutes total, while the failing run (37955770187)
  took 52.5 minutes and timed out gym at 420 seconds. In the failing run, the
  gym flow's harness replay completed at 16:26:57, but its real-key flow did
  not complete until 16:53:18; the competing music flow was 6.5 minutes and
  gym was 7.0 minutes in Playwright's slow-file report. The same run reported
  11.0 minutes for the harness file and 7.9 minutes for the bay file.
- CI uses one Playwright worker per shard and two GitHub Actions shards. This
  preserves every real key press, screenshot, and Bun hash comparison while
  removing GPU contention without serializing the whole suite; the local
  worker setting remains 30% of cores. A first one-worker, unsharded trial
  (38986390097) was cancelled after it exceeded the historical 30-minute fast
  run without producing results. The first green sharded CI run must record
  per-flow timings and total wall time here.
- The sharded green run (38989196393) completed both long real-key flows and
  all 387 tests: shard 2 took 7m34s (170 tests), shard 1 took 22m57s (217
  tests), so the wall-time critical path was 22m57s. Gym's browser/Bun replay
  hash completed at 01:08:41 on shard 2 and 01:16:16 on shard 1; both gym and
  music real-key tests passed on the sharded run, each below the 420-second
  limit. Compared with the passing two-worker run's 30.3m total and the
  failing two-worker run's 52.5m total, two isolated shards improve wall time
  while removing the contention that caused the timeout. The canceled
  unsharded trial reached 36m51s without completing, so it is not used as an
  after measurement.

### E2E suite speed (2026-10-17)
- Headless Chromium renders WebGL in software (SwiftShader) even on a Mac,
  and that was most of the local e2e time: a paused `step(1)` took 160 ms,
  against 1 ms on the GPU (same harness, same moment, load average 146).
  Each SwiftShader GPU process took about three cores, so worktrees running
  e2e at the same time starved each other (load averages of 100 to 260 while
  this was measured).
- Chromium now launches with `--use-angle=metal` on macOS. WebKit already
  drew on the GPU, and CI keeps SwiftShader. The same 16 gameplay tests on 3
  workers took 238 s and 880 CPU-seconds in software, and 43 s and 89
  CPU-seconds on Metal.
- 63 Chromium baselines differed, by 1 to 610 pixels, all at edges:
  anti-aliasing, and resampling (a scaled sticker's outline is crisper on the
  GPU). Each was viewed (old, new, and diff, at up to 4x) before it was
  replaced, and each passed at least twice more unchanged. Every other
  baseline passes as it was. A branch with Chromium baselines drawn in
  software redraws them after rebasing.
- Local runs use half the cores (5 workers here; it was 30%): the Chromium
  project took 193 s on 5 workers and 297 s on 3 under the same load.
- Full `just e2e` after: 758 tests (414 Chromium, 344 WebKit) in 4.6
  minutes on 5 workers, all passed; the slowest test is lasso's at 19 s. On
  2026-10-08, 388 tests took 10.1 minutes.
- `createStoryReader` (`src/core/ink.ts`) loads an Ink state only when it
  differs from the last one it read. Replaying every sim script made 185,187
  `LoadJson` calls (1.7 a tick, about 40% of `step`) before and 1,838 after.
  `bun run sim` went from 22.6 s to 8.2 s, the unit tests use 12% less CPU,
  and every hash is unchanged. The game's own tick saves the same work.
- `just e2e` and `just unit` pass arguments through
  (`just e2e bay.spec --project=chromium`, `just e2e --last-failed`), and
  AGENTS.md says to run the full gates once per milestone and only what the
  change touches while working.

### CI speed (2026-10-17)
- CI took 25 to 75 minutes a push. Playwright's `--shard` splits by test
  count in file order, so the first of two Linux shards got every Chromium
  gameplay flow (72 minutes against 7), and both shards repeated `check` and
  `build`. A full checkout (about 800 MB, mostly `art/` and the screenshot
  baselines) took 30 to 45 s, and pushes of only docs ran everything (10 of
  the last 39 commits on main).
- Probes on GitHub's free runners, one worker, the lasso and music flows:
  Linux x64 (SwiftShader's Subzero backend) 1.7 and 1.3 minutes; the same
  with MSAA off 1.5 and 1.1; Linux arm64 1.2 minutes and 57 s; macOS 15 in
  SwiftShader 20.5 and 11.4 s; macOS 15 on Metal ("Apple Paravirtual
  device") 16.5 and 10.5 s. On the three-core macOS runner a second or third
  worker made each test 1.5 to 2.7 times slower: the whole suite took 16.8
  minutes on two workers and 15.1 on three.
- Every Chromium baseline matched on the macOS runners' GPU, so CI compares
  Chromium's screenshots. Four WebKit baselines differed by 2 to 19 pixels
  (macOS 15 there, 27 here), so CI leaves WebKit's screenshots to local runs.
- CI now: one Linux job for `check` and `build`, Chromium on three macOS
  runners, WebKit on three Linux runners, one worker each, sparse checkouts
  (3 to 5 s on Linux; about 25 s on macOS, which needs Chromium's
  baselines), and no run for a push of only docs, art sources, or Markdown.
- `tools/ci/shard.ts` plans each project's shards from the seconds per spec
  file recorded in CI's own reports (`tests/e2e/timings.json`, written by
  `tools/ci/timings.ts`). A file's tests stay together and in order: split
  per test, the phone battle scene's WebKit check ran first in a fresh
  browser on Linux and measured a corner spread of 0.68 (a flat fill) both
  times, where after the desktop one it passes. Why is still open.
- First green run: 5 minutes 37 s from push to the last job (`check` 81 s,
  Chromium 231 to 329 s, WebKit 228 to 326 s, on timings from the macOS
  probe). With CI's own timings the plan evens out at about 220 s of tests
  per Chromium shard and 197 s per WebKit shard.
- Four shards a project (165 and 148 s of tests each), with each Chromium
  shard fetching only its own specs' baselines (a 6 s checkout plus 11 s,
  against 26 s for all of them): 3 minutes 39 s from push to the last job.
  Four of the five macOS jobs GitHub allows at once; a second run that
  overlaps waits for a free one.
- The area-connection unit check (about 1 s of geometry over 18 areas) hit
  Vitest's 5 s default under a load average of 120; like the other
  whole-world checks it now has a 30 s budget.
- Five shards a project took 4 minutes 0 s with no other run going: no
  faster than four, because shard times spread wider (WebKit 154 to 238 s)
  and fixed costs repeat per shard. Five is also every macOS job GitHub
  allows at once: a run that overlapped another queued its Chromium shards
  for 3 to 4.5 minutes. Back to four.
- Browser downloads are cached until a dependency changes: Chromium's install
  went from 13 s to 2 s (after a 3 to 7 s restore), WebKit's from about 40 s
  to 27 s (its system libraries still install).
- Timings are per test now. Cut by test count, `harness.spec.ts` put its
  heavy browser and Bun replays in one WebKit run (71 s against 42 planned)
  and its light checks in another (13 s against 38); cut by recorded time,
  runs come out even.
- With all of it, a run took 3 minutes 53 s (jobs 148 to 224 s). Each test
  ran within a few seconds of its record, but whole shards ran faster or
  slower with their runner: two WebKit shards finished their tests in 101
  and 103 s against 159 planned, two Chromium shards in 162 and 182 s
  against 147. The plan is down at the runners' own spread.
- Unit tests get a 30 s default budget (`vitest.config.ts`). Milestone 53's
  mist journal test passed here and timed out at Vitest's 5 s default on CI's
  four-core runner, turning main red; 17 test files had already added
  budgets by hand after the same failure.
- Next: `ui-gallery.spec.ts` is 172 s of Chromium's 660 and 248 s of WebKit's
  592 on CI, and each of its tests loads a fresh page. A context shared per
  worker cut a gallery load from 481 to 121 ms in WebKit and from 304 to
  219 ms in Chromium (locally).

### Test speed (2026-10-18)
- A tick of the core spent about 45% in collision and 27% building Ink
  stories (profile of a kitchen replay). `resolveCollision` ran 8 passes over
  the floor and every blocker for Fae and each follower; a pass depends only
  on where it starts, so one that moves nothing now ends it, and a blocker
  whose bounding box is out of reach is skipped (the full test would leave
  the point alone), and the closest-point scan no longer allocates per edge.
  `runInk` built a Story from the compiled JSON per command (2.2 ms); one is
  kept per story and reset to a new Story's state (0.1 ms with the load).
- Proof it changes nothing: every sim script's state hash every 250 ticks
  (50 scripts, 166,837 ticks) is identical before and after. Replaying them
  all took 9.9 to 11.1 s and now 1.6 to 1.7 s, interleaved runs at one load.
  `bun run sim` went from 12.0 to 13.5 s to 3.4 to 3.8 s; CI's `check` job ran
  its tests in 39 s against 88.
- The long e2e flows lost a quarter to two fifths of their time locally
  (lasso 18.7 to 11.3 s, kitchen 17.3 to 11.7, music 14.7 to 9.6): both the
  browser's replay and Bun's hash replay run the core.
- `ui-gallery.spec.ts` runs in parallel mode: in order on one worker, its 263
  tests per browser kept that worker busy 2.4 minutes after the other four
  had finished. With that and the faster core, a full local `just e2e` went
  from 261 s to 206 s, every worker ending within 2 s of the others.
- Tried and dropped: a browser context shared per worker for the gallery (a
  bare page load went from 481 to 121 ms in WebKit, but whole tests in A/B
  runs were within noise in both browsers); one page shared per worker (it
  saves WebKit about 0.2 s a test, each page being its own web process, but
  WebKit's shards aren't CI's slowest, and a page that already held Nunito
  lettered the mole marquee differently, a bug since fixed); Vitest's
  `isolate: false` (within noise).
- CI's runners differ in speed by half again: two Chromium shards ran the
  same tests at 1.4 and 1.5 times their recorded seconds. A run is bounded
  by its slowest runner, and the record is now each test's mean over
  several runs (three, for now).
- On CI, an A/B on one runner per job (each shard's tests with the old code
  and the new, alternating which went first): specs that run the core took
  20 to 58% less time in both browsers (Chromium bedroom 16.0 to 6.7 s, bus
  15.4 to 8.1, harness 31.7 to 24.0; WebKit harness 34.7 to 24.3). Whole
  shards stayed within noise: the first run pays a cold start in its first
  test, and a macOS runner's second run went up to a quarter slower.
  WebKit on GitHub's arm64 Linux runners took 1.9 times as long as on x64,
  so it stays on x64.
- `tools/ci/step-profile.ts` is a Playwright reporter that sums where e2e
  time goes (browser calls, expects, and fixtures by kind, and the test code
  between): `STEP_PROFILE=out.json bunx playwright test <specs>
  --project=chromium --workers=1 --reporter=dot,./tools/ci/step-profile.ts`.

### Test speed, the owner's go-ahead (2026-10-18)
- The hook's `step` loads only the area it ends in (spec 11, changed with
  the owner's go-ahead). A replay of chapter one's run before a flow loaded
  and dropped every room on the way. The view depends on its history in two
  places, the camera (a dead zone it follows) and a canopy's fading alpha,
  and loading an area rebuilds both; so a step that left its first area at
  any tick loads its last afresh, and every screenshot and hash is
  unchanged. The 31 specs that replay a recorded run, and two that walk
  through doors, took 21% less test time locally (222 and 257 s against 292
  and 312, interleaved).
- The UI gallery decodes only the arcade art its state shows (it decoded all
  seven paintings and atlases on every load, about 0.1 s in Chromium), and
  `gallery()` waits for its page with a check every frame (on the old page,
  an expect found it about 50 ms later). Chromium's gallery took 100 s
  against 124 at one worker; WebKit's was ready within about 40 ms of
  loading already and didn't change.
- CI: a newer push cancels the run it overtakes on the same branch (a
  second run had waited 2.5 minutes for macOS runners); Chromium has five
  shards and WebKit six (each WebKit job spends about 40 s installing system
  libraries); and a Chromium shard fetches its baselines in the background
  while its browser restores. `just timings` refreshes the shard record.
- Not done: switching gallery states inside one page instead of reloading
  it. The page would carry what one state leaves to the next, the kind of
  difference the mole marquee showed, for about the time the faster waits
  above already saved.
- WebKit's Trace and Talk run of the kid takes about 50 s on CI against 6 s
  on a Mac: it steps 10 ticks at a time with real keys, and each of its
  about 200 steps draws a frame in Linux WebKit's software renderer. Fewer
  steps would move the moments its screenshots are taken, so it stays.
- A fix (2026-10-18): Boop-a-Mole, skee-ball, Comet Cruise, and the cooking
  game size a hint to fit its plate (a marquee, the fridge's front) in a
  draw, and skip the draw while the size and view are unchanged. On a cold
  load Nunito isn't usable at the first draw (`font-display: swap`), so a
  hint kept the size that fit the fallback font: on the phone layout the
  mole's was 20 px where Nunito fits 19, and on the desktop its result line
  ran past the plate at 54 px where Nunito fits 49. In the game the title
  has usually loaded Nunito before a close-up opens, but not on a slow
  connection. Each now draws again when the page's fonts finish loading
  (spec 7.1). Nine mole and seven comet Chromium gallery baselines changed,
  only in the marquee, and were updated after viewing them (the mole's were
  drawn before Chromium used Metal, so they were drawn again whole, matching
  the old ones elsewhere within the screenshot tolerance). Skee-ball's, the
  cooking game's, and WebKit's didn't change.

### Next milestones
- Milestone 20, Pinecone Pass and the bus: done.
- Milestone 21, the Cliffside Trail: done. Built before Jordan because its
  painting, its critters, and the roaming engine were ready first; it's the
  first trail between lands, between the bay and the pass.
- Milestone 22, Jordan: done.
- Milestone 23, the blacklight lantern: done.
- Milestone 24, the bus line and the map: done.
- Milestone 25, the grumpy gull, the first mini-boss: done.
- Milestone 26, the Whispering Woods: done.
- Next (proposed 2026-10-07, EarthBound style, open to the owner):
  - Milestone 27, coins and shops: calmed critters and lantern finds give
    coins; the cocoa stand and the bakery sell snacks; Fae carries snacks into
    battles instead of each critter granting its own.
    Done (Milestone 27, above).
  - Milestone 28, recurring bad guys: done (above).
  - Milestone 29, the first person under the chaos spell: done (above).
  - Milestone 30, the school chapter begins (story time): done (above).
  - Milestone 31, the gym and the PE teacher's lasso: done (above).
  - Next (owner, 2026-10-08): the area kit refactor, before anything else.
    A test on the plaza split the approved painting into a clean ground plate
    and prop sprites: every object Fae can walk behind or bump into is a prop
    with its own ground footprint (its collision) and its own depth (it sorts
    by the front edge of that footprint, column by column), its art cut from
    the painting itself, and states such as smashed. Objects can move or
    change without repainting the scene. The owner: "the new version is way
    better. Refactor everything in this manner."
    - Milestone 32, the props engine and the plaza kit: done (above).
    - Milestone 33, the indoor kits: the bedroom, the kitchen, the school
      hall, the classroom, the gym, and the arcade. Done (above).
    - Milestone 34, the outdoor kits: the park, Bubblegum Bay, Pinecone Pass,
      the Cliffside Trail, and the Whispering Woods. Done (above).
    - Milestone 35, occluders retired: the old cutouts, baselines, slivers,
      and their tools go. Done (above).
    Until Milestone 34 lands, don't start a milestone that adds or reshapes
    an area; after it, every new area is painted whole and split into a kit.
  - Milestone 36, gamepad support (spec 3.2): done (above).
  - Milestone 37, gameplay sound: done. Gentle synthesized sound effects are
    projected from core state diffs and played by the Web Audio shell. Mute is
    a separate Capacitor preference, with M or the Sound button inside the
    Journal pause menu.
    The harness exposes recent cue and playback logs without changing saves.
  - Milestone 38, the music room and the flute: done (above).
  - A fix (2026-10-09), found by auditing the kits against their paintings:
    the Whispering Woods' north-east log is the whole log, solid where it lies
    (Fae could stand on it, and its footprint was a wall on the open grass
    south of it), and its stream is water but for the stepping-stone
    crossing. `propDrawingErrors` now excuses a bare footprint column only
    where a neighbour in front covers its front: a tree's crown far above had
    hidden the log's footprint. The woods run and the runs chained from it
    are re-recorded.
  - A second fix (2026-10-09): every footprint sits under its own picture
    (`propDrawingErrors` reports none). Pinecone Pass's forest-left ends at
    its trees, opening a snowy alcove beside the bus pines; the lodge's
    picture includes its east corner, where its footprint now ends; and its
    benches are three props (the left pair, the front pair, and the back
    bench Fae used to walk through), each footed at its legs. Meadow Park's
    east bush ends at its leaves. The lantern run, re-recorded, goes round
    the back bench, and its replay test checks it reads the lift-tower
    doodle.
  - A third fix (2026-10-09): the woods' floor is the painted clearing, not
    Milestone 26's rectangle. Fae stops where the painted ground meets the
    forest behind the clearing and the big trunks, and corridors behind the
    edge trunks keep both exits. The woods run and the runs chained from it
    (arcade, school, gym, music) are re-recorded and read the same beats.
  - A fourth fix (2026-10-09): the last box blockers over painted objects
    are props. Bubblegum Bay's two driftwood logs, three beach balls,
    bucket, two spades, and picnic basket stand on their own footprints (the
    picnic blanket is walkable cloth), its sign's posts and its palm's
    trunk are solid where they meet the sand, and the dock's end post is
    part of the near rail; Meadow Park's pond is a prop footed along its
    stone ring; the east hall's fountain blocker ends at its pedestal; the
    woods' pocket behind its west log no longer redraws the log. A new
    check, `propBlockerErrors`, refuses a blocker drawn over a prop's
    footprint. The bay runs, re-recorded, read the same beats.
  - A fifth fix (2026-10-09): the Cliffside Trail is the last area off
    Milestone 21's box blockers. Its rocks, boulders, bench and signpost
    stand on footprints traced along where they meet the ground, its pines
    on their trunks, and its two reed clumps are props that fade over Fae;
    tools/art/geometry/trail.ts writes only the floor, now round the dense
    snowy pines at the left edge, so the trail has no blockers. The grass
    and sand the boxes walled off round each thing are open. The lookout
    run, re-recorded, reads the same beats; `propBlockerErrors` reports none
    anywhere.
  - A sixth fix (owner, 2026-10-16): the school hall is open like every
    other room. It was the one painting with a front wall: a low wall with
    the glass front doors across the lower left of the screen, and Fae left
    by walking into its top. The approved painting was edited (8 Gemini
    calls, `art/recipes/school.json`): the wall is gone, the floor runs to a
    floor-slab edge like the classroom's, and the front doors stand at the
    left end of the back-left wall, about 1.2x the classroom door. The
    right half of the hall kept its layout to the pixel, so everything
    there stayed where it was. The kit was re-split with no calls (the
    wall's post went with the wall), the floor and the door band were
    traced on the new paint, and the `front-doors` spawn is (290, 625)
    facing down, by the doormat. Every run through the hall was
    re-recorded and reads the same beats; the hall-pass run, hand-written
    since Milestone 14, has a recorder now (`tools/sim/record-hall-pass.ts`).
    On the way: the field run's recorder, as committed with Milestone 39,
    failed before the stash on main (the spot below it sits 19.2 units from
    the floor's edge, under the collider's 20, so `approach` passes it
    over); it walks to that spot itself now, and on main's own chain it
    records a run of main's length again (9339 ticks). The hall's baselines
    and the chained runs' baselines were updated after viewing them; the
    new painting is in the review queue.
  - Milestone 39, recess on the playing field: done (above).
  - Milestone 40, battle checks: done (above).
  - Next (owner, 2026-10-17, from `docs/battle-ideas.md`): Milestone 41,
    Catch: done (above). Then Milestone 42, feelings: done (above). The
    rest of `docs/battle-ideas.md` stays unscheduled until the owner picks.
  - Milestone 43, the clubhouse fix-up: done (above).
  - Milestone 47, flute friends: done (above).
  - Milestone 44, the claw machine: done (above). Then Milestones 45 and 46,
    skee-ball and the prize counter, and Boop-a-Mole.
  - Milestone 48, Lean: done (above). Next (owner, 2026-10-17): Milestone
    50, wind-ups for the gull and Mr. Pip: done (above). Then Milestone 51,
    first touch and old friends: done (above).
  - Milestone 49, lasso spots: done (above). Then Milestone 52, the
    clubhouse kitchen (owner, 2026-10-17): done (above).
  - Milestone 57, the lodge keeper: done (above), the first of more people
    under the chaos spell (owner, 2026-10-17).
  - Milestone 60, a second flute friend: done (above; owner, 2026-10-18).
  - Milestone 61, the arcade rearranged: done (above; owner, 2026-10-18).
  - Milestone 59, a fourth arcade game (Comet Cruise): done (above).
  - Milestone 62, Clover Hills: in progress (above; owner, 2026-10-18).
  - A fix (2026-10-18): the journal's map page still wrote "???" for the
    Enchanted Forest whatever its view said, so the map rule Milestone 53
    added (named once the Misty Path is found or Fae is in the land) never
    showed. The page shows the view's name now, and the Misty Path e2e ends
    by opening the map and checking it names the forest (it fails without
    the fix). The gallery's view says "???", so no baseline changed.
  - The kid's identity is kept for the very end (owner, 2026-10-07); the
    owner chose Milo for the finale (2026-10-17, Milestones 53 to 56).

## Later (not scheduled)
More people under the chaos spell (NOTES.md: more mini-bosses), after the
lodge keeper (Milestone 57): the art teacher and the lifeguard are next
(Milestones 63 and 64). Flute friends (the Pond Pup and the Acorn
Squirrel), the lasso's places, and the clubhouse's chest and microwave are
done (Milestones 47, 60, 49, and 52).

Sound follow-ups from Milestone 37:
- Music and ambience: a title, town, and battle theme, and quiet beds per
  land (birds, waves, wind). Needs the owner's call on the source: code
  synthesis like the effects, a generator (paid generation needs the
  owner), or CC0 clips found through Openverse (`docs/media-sources.md`).
- Footsteps by surface: done (2026-10-16). Every loaded area uses the closed
  surface set (grass, sand, wood, snow, stone, tile, and carpet), with maps in
  `content/surfaces/<area>.json` registered by `src/content/load.ts`. A missing
  map is a load error naming that path and the registration file, rather than a
  silent grass default. Footstep cues are synthesized recipes for now; clips
  are pending the owner's pick from the candidates in `docs/review-queue.md`.
  The plaza is all stone because it is a paved square.
- A volume control beside mute: done in the volume follow-up (2026-10-16).
  Four chunky steps, 25% through 100%, use the existing master gain path and
  live beside the mute pill. One 44 CSS-pixel sticker control cycles the steps,
  so every level has a full-size, non-overlapping touch target. On narrow
  journal pages, the supplies wrap beneath NOTES; larger layouts keep them on
  the heading row. The preference remains
  outside the save; the old mute-only boolean loads at 100%. There is
  deliberately no zero step, keeping mute independent and making unmuting
  restore the chosen level.
- iOS on a real device: the simulator check below should hold, but a phone
  with a pad and the silent switch hasn't been tried.
