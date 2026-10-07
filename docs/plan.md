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

## Roadmap after Milestone 19
Chapter one ends with the purple hood's Cloverhollow School name tag.
- Who the kid in the hood is, and how Fae finds out (a school chapter). Still
  open: the owner doesn't know yet (2026-10-06).
- Audio: later (owner, 2026-10-06). TestFlight and a paid developer account:
  later.

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
  come after Fae when she's near; touching one starts a calm-down battle, and
  a calmed critter stays calm and friendly. People can be under the chaos
  spell too: they're the mini-bosses (NOTES.md). The raccoon in the purple
  hood is the trickster who keeps getting away, until the kid behind it all
  is known.
- Each friend brings one battle command: Maddie's Play, Sue's Cast, Jordan's
  Juggle (pinecones).
- Tools open the world: the blacklight lantern first (below); the lasso (from
  the PE teacher) and the flute (from the music teacher) later.
- The blacklight lantern: the owner's concept (`blacklight_lantern.png`) draws
  it as a magnifying glass with a purple blacklight lens, inactive and active,
  so it's built as drawn. Jordan uses it on night hikes and gives it to Fae.
  Switched on, it shows what the raccoon's fizz left behind: glowing purple
  paw prints, invisible-ink notes (journal clues), and trail markers that
  open hidden paths.

### Next milestones
- Milestone 20, Pinecone Pass and the bus: a bus stop in the plaza; story
  lines can send Fae somewhere (`# travel:`); the pass as a walkable area.
- Milestone 21, Jordan: he joins at the pass with Juggle; the hamster hiker;
  he gives Fae the lantern.
- Milestone 22, the blacklight lantern: on and off, glowing secrets, a hidden
  path out of the pass.
- Milestone 23, the Old Pine Trail: the first trail between lands, from the
  pass's hidden path down toward the Whispering Woods, with roaming critters:
  the bunny from the owner's critter sheet and a new squirrel.

## Later (not scheduled)
Gamepad polish, the lasso and the flute, the Whispering Woods and the
clubhouse, mini-bosses, the journal's map page.
