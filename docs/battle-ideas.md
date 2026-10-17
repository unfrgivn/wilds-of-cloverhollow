# Battle mechanic ideas

Status: proposals, 2026-10-16. Owner, 2026-10-17: the suggested order is
approved, and Milestones 40 (battle checks), 41 (Catch), and 42 (feelings)
built it; `spec.md` section 8 says what they do. Next the owner picked Lean
(built in Milestone 48), then wind-ups for the two mini-bosses (Milestone 49),
then first touch and old friends (Milestone 50). The rest of this page stays
unscheduled.

Before Milestone 40, every action in a calm-down battle was the same skill
check: press confirm when the shrinking ring meets the dashed circle. Soothe,
Play, Cast, Juggle, and the burst all played that way. All sixteen critter
kinds shared the same aim timing (target tick 39 of 60, windows of 5 and 11
ticks) and the same command numbers (Soothe 20, Play 30, Cast 35, Juggle 30),
so the best pick in every battle was the biggest command that wasn't resting.
The two mini-bosses differ only in a bigger meter, one more energy leaf, and a
likelier big burst.

The proposal in one line: **friends decide how Fae calms, critters decide how
they burst, and the critter's feelings decide what to pick.** Maddie keeps the
ring as her pounce, Sue and Jordan get checks of their own, each burst becomes
what its line already says (a flurry of tennis balls to catch, a gust to lean
into), and a feeling over the critter's head makes the menu a choice.

## Ground rules for any new check

- It ends in a grade: great, good, or miss. The calm and energy math, the
  per-grade lines, and the GREAT!/GOOD!/MISS sticker keep working as they are.
- It plays with arrows and Z alone, because the recorders and e2e runs use only
  those (spec 11), and with a gamepad and touch. In battle, touch keeps confirm
  and cancel but hides the stick, so a check that needs directions brings its
  own on-screen targets. X (cancel) is ignored in battle today, so it's free
  as a second button.
- A timed check lasts at most about 3 seconds (180 ticks). Longer is fine only
  when nothing is timed.
- It's deterministic: the seeded PRNG in state picks orders and lanes, paths
  are lanes or point lists in content, and the core uses no trig (spec 3.1).
  The render can still bob things on a sine.
- Nobody gets hurt. Fae catches, hops, and holds on to her hat; she doesn't
  take hits. Spent energy is still "tuckered out."
- Every surprise has a visible tell first (the gull puffs up, the owl's head
  starts to turn).
- No button mashing, and no cue that is colour alone: pair colour with
  position, shape, and sound.

## 1. New checks

| Check | How it plays | Input (keys; touch) | Fits |
| --- | --- | --- | --- |
| Ring (today) | Press as the rings meet | Z; confirm | Maddie's Play (her pounce) |
| Charge | Hold Z, let go while the meter is in the green | hold Z; hold confirm | Sue's Cast: wind up, throw the bobber |
| Beat chain | Three to five things arrive one after another; press as each lands | Z per beat; confirm | Jordan's Juggle, frog bubbles, bunny thumps |
| Catch | Toys fly at Fae in three lanes (high, middle, low); hold her catch in each toy's lane as it lands (built in Milestone 41) | up/down; two arrow stickers | the nine "flurry" bursts |
| Lean | A gust shoves a wobbling needle; hold the other way to keep Fae's hat on (built in Milestone 48: a star on a balance track over her head, since Fae has no hat; too far either way tips her over) | hold left/right; two arrow stickers | the gust bursts |
| Pet | Three or four arrows show on the critter; press them in order before the timer runs out (no precision timing) | arrows; four arrow stickers | Soothe, as a no-reflex default |
| Echo | The critter hums three to five notes on the music room's four chimes; play them back (up red, right yellow, down green, left blue) | arrows; four chime stickers | the flute, songbirds |
| Peekaboo | Tiptoe (hold Z) while the critter looks away, freeze when it turns back | hold Z; hold confirm | the owl's stare |
| Which one? | The critter ducks under one of three cups, they shuffle, pick its cup | left/right, Z; tap a cup | raccoons and squirrels (they stash things) |
| Whack | Tickets pop from five slots in a plus shape; press that way (Z for the middle) | arrows, Z; five targets | Mr. Pip, later |
| Talk | Pick what Fae says from two or three Ink choices; the right words grade great | up/down, Z; tap a choice | people under the spell |
| Spin and snag | Circle the arrows twice to spin the lasso, then Z to throw it at what the critter clutches (the fizzy soda, the stopwatch) | arrows, Z; the stick | the lasso, once it joins battles |
| Trace | Brush along a dotted heart, star, or zigzag over the scribbles, checkpoint by checkpoint, before the paint dries | arrows or stick; a finger | one big moment (an art-teacher mini-boss, the finale) |

Borrowed from: Paper Mario (the hammer's hold and release, Power Bounce
chains), Undertale (the bullet box, played here as catching; ACT for Talk and
Pet), Simon, Red Light Green Light, the shell game, whack-a-mole (NOTES.md's
arcade), Nintendogs (petting), Okami and Yo-kai Watch (drawing to act).

Notes on the strongest ones:

- **Charge and Beat chain** are the smallest step from the ring. They are
  still about timing but feel different in the hands (a hold, a rhythm), need
  no new touch controls, and match what Sue's and Jordan's lines already say.
- **Catch** is the biggest change for its cost. Nine of sixteen kinds already
  "fling a flurry" at Fae, and catching turns the burst into play instead of a
  hit. It also makes the big burst readable: today `bigChance` is a hidden
  roll between one and two leaves; in Catch a big burst throws more toys, so
  the player sees it coming. Every toy caught grades great, at least half
  good, fewer a miss, so the energy math stays. Cost: the toys (the approved
  burst frames already draw them as separate islands, so they can be cut out
  rather than generated) and two touch arrow stickers.
- **Pet, Echo, Which one?, and Talk** need no reflexes. Pet as Soothe would
  give younger players a way to do well without precise timing.
- **Peekaboo, Which one?, and Whack** each suit one critter or person, so they
  work best as that critter's burst or a mini-boss's signature, not as general
  commands.
- **Trace** is the most on-theme (calming restores the paint, spec 1.3, and
  here Fae paints it back herself) and the most expensive. It's only good on
  touch with finger drawing, which needs a new optional `pointer` field in
  `ActionFrame` (spec 3.2) and stroke rendering. Worth saving for one big
  moment.

### Bursts by critter

| The burst line says | Kinds | Check |
| --- | --- | --- |
| a flurry of tennis balls, bouncy balls, yarn balls, acorns, snowballs, or prize tickets; a shower of bottle caps | pup, gym pup, cat, squirrel, oak squirrel, hamster, raccoon, school raccoon, Mr. Pip | Catch |
| a fizzy gust; a huge gust of feathers and sea spray | bluebird, music-room bird, gull | Lean |
| a stream of pink bubbles | fountain frog, bay frog | Beat chain (pop each bubble as it reaches Fae) |
| thumps so hard that twigs and dust go flying | bunny | Beat chain (hop each thump) |
| screeches and dives through the ferns | owl | Peekaboo |

The fountain frog is the game's first battle, so its Beat chain (Z only)
teaches the idea before the park pup's Catch adds moving.

## 2. Make the choice matter

1. **Feelings.** Each turn the critter shows a feeling in a thought bubble.
   Each command answers one:

   | Feeling | Answered by |
   | --- | --- |
   | Zoomy | Play (Maddie) |
   | Curious | Cast (Sue) |
   | Bored | Juggle (Jordan) |
   | Grumpy | Soothe |
   | Hungry | Snack |

   A match adds half again the command's base calm (tunable); a mismatch is
   ordinary, never a penalty. The next feeling peeks in at the bubble's edge,
   so a player can save Sue for the curious turn. Each kind lists its feelings
   in content, and a feeling whose command isn't available never shows: a
   Maddie-only battle can't ask for Cast, and Fae with no snacks never meets a
   hungry critter. Feelings could start once Sue joins, so the first battles
   stay simple. This is the cheapest way to make the menu a decision.
   ("Mood" already means chaos or calm in the code, hence "feelings".)
   Built in Milestone 42, with a flat 15 calm for a match instead of half
   again the base, and the next feelings riding in the cloud's thought dots.
2. **Wind-ups, for mini-bosses.** The gull spends a turn puffing up, and two or
   three bubbles over it show icons: a ball, a bobber, a pinecone. Each
   matching command pops one. Pop them all before it lets go and the gust
   fizzles; pop some and it's smaller. Friend rest timers become planning, and
   the gull and Mr. Pip get a shape of their own instead of bigger numbers.
   Borrowed from Sea of Stars' locks.
3. **Talk, for people.** People under the spell (Mr. Pip now, more later) get a
   Talk command: two or three Ink choices, graded by which one Fae picks. It
   reuses the dialogue choices and Ink, matches NOTES.md's "saying the right
   dialogue" puzzles, and its clues can come from what the town said about
   that person earlier.
4. **Lantern peek.** Once Fae has the lantern, L (or the lantern button) in the
   command phase shows the next two feelings or the wind-up's icons. Once per
   battle, free. A battle use for a tool that already has a button.
5. **Together.** GREAT grades fill a party sparkle meter; when it's full, a
   Together command has every friend act at once (their checks back to back)
   for a big calm. Later.
6. **Favourite treats.** Each species has one (pups: tennis balls, cats: yarn,
   squirrels: acorns), sold in shops or grown in the clubhouse garden
   (NOTES.md). Giving one is a big calm, and coins get a second use. Later; it
   needs an inventory.

The menu already has six commands with the whole party (three rows on a
phone). Tools that join battles (the flute, the lasso) should sit under one
Tools command instead of growing the grid.

## 3. Around the battle

1. **First touch** (EarthBound's swirls). If Fae walks into a critter that
   isn't chasing her, the battle opens with it surprised: a calm head start. If
   a chaser reaches her while she's walking away, it bursts first. The core
   already knows Fae's facing, the critter's position, and whether it's in
   chase range.
2. **Old friends** (EarthBound's instant win). Once Fae has calmed three of a
   species, a new chaos one of that species calms on touch with one line and
   pays its coins. Recurring critters stop being a chore late in the game.
   Needs a per-species count in state.
3. **Flute friends** (NOTES.md: the flute calls animal friends, who help in
   battles). A calmed species can be called once per battle: the Pond Pup
   fetches (calm), the Cozy Cat yawns (the next burst is smaller). It ties the
   sticker album to battles. After the flute joins battles.

## Suggested order

1. **Battle checks** (Milestone 40). Replace `battle.aim` with a `battle.check`
   union keyed by kind, each a pure step that ends in a grade. The ring plays
   exactly as it does now. Party content names each command's check and
   critter content names its burst's check, with its numbers. Ship Charge
   (Cast) and Beat chain (Juggle, the frogs' bubbles, the bunny's thumps). No
   new art or touch controls.
2. **Catch** (Milestone 41) for the nine flurry bursts: the toys and the touch
   arrow stickers.
3. **Feelings** (Milestone 42), with the next-feeling peek and the lantern
   peek.
4. Then, roughly by value for cost: Lean for the gusts, wind-ups for the two
   mini-bosses, first touch and old friends, Talk, Peekaboo for the owl, and
   Echo once the flute joins battles. Spin and snag, and Trace, last.

Introduce each check in one set-piece battle with a one-line hint ("Hold Z, and
let go in the green!") before recurring critters use it.

What this touches:

- `spec.md` sections 8 and 8.1 (the flow and the UI), section 11
  (`renderInfo().battle` reports the check), and the critter and party
  schemas.
- Every recorded run that includes a battle needs re-recording, and
  `tools/sim/recorder.ts` needs a careful-player strategy per check (for Catch:
  move under the next toy, read from state).
- Pinned state hashes move with the state shape.

## Left out on purpose

- Button mashing: hard on small hands and on glass.
- Sue reeling against line tension: too close to the fishing minigames that
  spec 13 puts out of scope. Charge is a throw.
- Damage, knockouts, or random encounters.
- A deck or card layer (Ooblets-style dance-offs): fun, but a second system on
  top of a battle meant to be short and readable.
- Any timed check longer than about 3 seconds.

## Open questions for the owner

1. Is "friends decide how Fae calms, critters decide how they burst" the right
   split, or should each critter define everything?
2. Should Soothe stay the ring, or become Pet so there's always a no-timing
   option?
3. A "gentle timing" setting (wider windows, slower toys), stored like mute,
   outside the save?
4. On iPhone, directional checks need on-screen arrows in battle: two arrow
   stickers beside confirm, or the stick shown only during the check?
5. Is finger tracing worth a new optional `pointer` field in `ActionFrame`?
   Only Trace needs it.
