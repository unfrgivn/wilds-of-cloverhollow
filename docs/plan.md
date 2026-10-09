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

## Roadmap after Milestone 19
Chapter one ends with the purple hood's Cloverhollow School name tag.
- Who the kid in the hood is, and how Fae finds out (a school chapter). Still
  open: the owner doesn't know yet (2026-10-06).
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
  - Then: a place where the lasso changes the
    world (a lever, a gap), and the clubhouse fix-up (a fridge for snacks,
    the garden). The kid's identity is kept for the very end (owner,
    2026-10-07).

## Later (not scheduled)
Calling animal friends with the flute, the lasso's levers and gaps, the
clubhouse fix-up, and more
mini-bosses (people under the chaos spell, NOTES.md).

Sound follow-ups from Milestone 37:
- Music and ambience: a title, town, and battle theme, and quiet beds per
  land (birds, waves, wind). Needs the owner's call on the source: code
  synthesis like the effects, or a generator (paid generation needs the
  owner).
- Footsteps by surface (grass, wood, sand) once the area kits carry ground
  data (after Milestone 34).
- A volume slider beside mute.
- iOS on a real device: the simulator check below should hold, but a phone
  with a pad and the silent switch hasn't been tried.
