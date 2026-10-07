#!/usr/bin/env bun
// Records "chapter one", the whole story so far played from a new game, as a
// sim script: the window and Fae's plan, breakfast with Mom, the fountain
// frog, Meadow Park and a fizzy pup, the hall pass at school, the school
// raccoon and the password it overheard, and the tree house. It plays through
// the core like a careful player (tools/sim/recorder.ts: routes round the
// recurring critters, a press on every aim's target tick) and prints the
// frames it used, so the script replays the run exactly. It fails loudly,
// naming the step, when the story or a map no longer fits the route. Rerun it
// after such changes:
//
//   bun tools/sim/chapter-one.ts > tests/sim/scripts/new-game/chapter-one.json
import { createState } from "../../src/core";
import { loadContent } from "../../src/content/load";
import { createRecorder } from "./recorder";

const { world, fixtures } = loadContent();
const fixture = fixtures["new-game"];
if (fixture === undefined) throw new Error("new-game fixture missing");
const play = createRecorder(world, createState(world, fixture));
const left = { x: -1, y: 0 };
const right = { x: 1, y: 0 };
const down = { x: 0, y: 1 };

// The bedroom: the window, and "adventure first"; then the hall door.
play.approach("window");
play.talk("window", [0]);
play.navigate({ x: 603, y: 323 }, 4);
play.leave(left, "kitchen");
// Breakfast: a pancake. Then out the front door.
play.approach("npc:mom");
play.talk("npc:mom", [0]);
play.navigate({ x: 990, y: 560 });
play.leave(right, "plaza");
// The fountain frog. The town's other critters only come out once he's calm.
play.meet("fountain-frog");
play.battle([]);
// Meadow Park and a fizzy pup by the pond.
play.navigate({ x: 1470, y: 965 });
play.leave(down, "park");
play.meet("pup");
play.battle([]);
// Back through the plaza to school.
play.navigate({ x: 300, y: 925 });
play.leave(down, "plaza");
play.navigate({ x: 290, y: 965 });
play.leave(down, "school");
// Nurse Holly's hall pass, for an offer of help.
play.approach("npc:nurse");
play.talk("npc:nurse", [1]);
play.navigate({ x: 600, y: 560 });
play.leave(left, "plaza");
// The school raccoon, calmed, tells the password it overheard. The town's
// critters are out now; calm them before crossing the plaza.
play.meet("school-raccoon");
play.battle([]);
play.approach("critter:school-raccoon");
play.talk("critter:school-raccoon");
play.clear();
// The tree house.
play.navigate({ x: 1470, y: 965 });
play.leave(down, "park");
play.approach("tree-house");
play.talk("tree-house");

const end = play.state();
console.error(`chapter one: ${end.tick} ticks, ${play.script.length} segments, ends in ` +
  `${end.area} at (${end.player.x}, ${end.player.y})`);
console.log(JSON.stringify(play.script, null, 2));
