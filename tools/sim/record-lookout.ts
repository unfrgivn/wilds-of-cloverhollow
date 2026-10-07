#!/usr/bin/env bun
// Records the Cliffside Trail's lower end (Milestone 21; the gull, Milestone
// 25): from the beach (the `trail` fixture), up onto the footbridge, across
// into the grumpy gull guarding the lookout (calmed with Soothe), to its
// bench, back down the beach, and through the bottom edge into Bubblegum Bay,
// holding down all the way. The back-link rule keeps the bay's cliff path
// from sending her straight back while she holds; after letting go she steps
// up and walks into it, where it's closed (no bus ride yet).
//
//   bun tools/sim/record-lookout.ts > tests/sim/scripts/trail/lookout.json
import { createState } from "../../src/core";
import { loadContent } from "../../src/content/load";
import { createRecorder } from "./recorder";

const { world, fixtures } = loadContent();
const fixture = fixtures.trail;
if (fixture === undefined) throw new Error("trail fixture missing");
const play = createRecorder(world, createState(world, fixture));
const down = { x: 0, y: 1 };
play.navigate({ x: 1265, y: 560 });
play.idle(30);
for (let count = 0; count < 100 && play.state().battle === null; count += 1)
  play.hold({ x: 1, y: 0 }, 1);
if (play.state().battle?.critterId !== "gull") throw new Error("the gull didn't meet Fae");
play.battle([]);
play.approach("lookout-bench");
play.talk("lookout-bench");
play.navigate({ x: 1330, y: 1000 });
// Down off the beach and into the bay, holding down through the fade and on.
play.leave(down, "bay");
play.hold(down, 60);
const held = play.state();
if (held.area !== "bay" || held.transition !== null || held.dialogue !== null)
  throw new Error("holding down in the bay sent Fae somewhere");
// Let go, step back up out of the doorway, and walk into the closed cliff path.
play.idle(1);
play.hold({ x: 0, y: -1 }, 20);
for (let count = 0; count < 80 && play.state().dialogue === null; count += 1) play.hold(down, 1);
const end = play.state();
if (end.dialogue?.knot !== "bay_cliff_path") throw new Error("the cliff path didn't speak");
console.error(`lookout: ${end.tick} ticks, ${play.script.length} segments`);
console.log(JSON.stringify(play.script, null, 2));
