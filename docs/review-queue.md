# Owner review queue

The owner was away (2026-10-06, about 8 hours) and asked the agents to keep
building without waiting for approvals. Milestones 10 to 15 shipped in that
time. Everything below is in the game and still needs the owner's yes, no, or
changes. Review images are in `art/review/` (gitignored, on this machine).
Once an item is decided, record it in spec section 12 (art and style
approvals) and remove it from this list.

The quickest way to see it all in play: start a new game and follow the
journal. The whole chapter takes a few minutes (the route is in
`tools/sim/chapter-one.ts`).

## Decisions only the owner can make

These shaped what was built and what was left alone.

1. **Who is the kid in the purple hood?** NOTES.md says the boss is a kid at
   Fae's school. The chapter ends at the hood's Cloverhollow School name tag
   and goes no further, so the classmate is still open.
2. **Sue and Jordan.** NOTES.md has Fae meet Sue in Bubblegum Bay and Jordan
   in Pinecone Pass. Should they join as followers like Maddie, help in
   battles, or both? This decides the next areas' design.
3. **The teacher's name.** "Ms. Maple" is a placeholder (NOTES.md leaves the
   classroom teacher TBD). Nurse Holly's name comes from NOTES.md.
4. **The puzzle style.** The first "get out of school" puzzle rewards honesty:
   fibbing to the nurse gets a gentle no, offering to help gets the hall pass.
   Is that the tone for the other school puzzles?
5. **Audio.** The game is silent. Music and sound need a new dependency or
   paid generation, so they wait for the owner's yes.
6. **TestFlight.** Device builds need the owner's Apple account.

## Art

| Item | What to look at |
| --- | --- |
| Title screen (Milestone 11) | `title-review.png`: no save, with a save, and the New game question |
| Kitchen and living room (Milestone 12) | `kitchen-owner-review.png`: the room with Fae, Maddie, Mom, and Oliver at true scale, and its walkable overlay |
| Mom (Milestone 12) | `mom-owner-review.png`: smile, blink, left, right on cream and dark |
| Oliver (Milestone 12) | `oliver-owner-review.png`: rattle up and down; `family-lineup.png` puts the family side by side |
| Meadow Park (Milestone 13) | `park-owner-review.png`, `park-in-game.png`, `park-overlay.png` |
| The Zoomie Pup, a chaos-touched puppy (Milestone 13) | `pup-owner-review.png` (every frame beside the frog), `pup-battle-in-game.png`. His aura reads darker than the frog's on a dark background; in the game it sits on light backdrops |
| School hallway (Milestone 14) | `school-owner-review.png`, `school-in-game.png`, `school-overlay.png`. A small letter fragment remains on a sign by the front doors; the third painting attempt, the first at the right scale |
| Ms. Maple and Nurse Holly (Milestone 14) | `staff-owner-review.png`: smile, blink, left, right, with Fae |
| The raccoon in the purple hood (Milestone 15) | `raccoon-owner-review.png` (with Fae for scale), `raccoon-in-game.png` |

## Wording (chosen by the agents)

All in `content/story/main.ink` unless noted.

| Item | Where |
| --- | --- |
| The calm Fountain Frog, and the fountain's new line (Milestone 9) | knots `frog_calm`, `fountain` |
| The journal's notes (Milestones 10 to 15) | knot `journal` |
| Mom, Oliver, and the kitchen's Look lines (Milestone 12) | knots `mom`, `oliver`, `breakfast`, `fridge`, `island` |
| The pup's battle lines, and the park (Milestone 13) | `content/critters/pup.json` (`lines`); knots `pup_calm`, `tree_house`, `picnic`, `park_sign` |
| The hall-pass puzzle (Milestone 14) | knots `teacher`, `nurse`, `school_doors`, `school_board`, `trophies` |
| The raccoon, the password, and the club (Milestone 15) | knots `raccoon`, `tree_house` (stitches `password`, `again`) |
