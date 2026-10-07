#!/usr/bin/env bun
// Records the bus to Pinecone Pass (Milestone 20): the bay run
// (tests/sim/scripts/bay/bay.json), then west along the road into town, the
// plaza's stop to the pass, a look at the pass's sign, the lodge's porch,
// and the bus home.
//
//   bun tools/sim/record-bus.ts > tests/sim/scripts/bay/bus.json
import { readFileSync } from "node:fs";
import { createState } from "../../src/core";
import { loadContent } from "../../src/content/load";
import { parseScript } from "../../src/content/script";
import { createRecorder } from "./recorder";

const { world, fixtures } = loadContent();
const fixture = fixtures.bay;
if (fixture === undefined) throw new Error("bay fixture missing");
const play = createRecorder(world, createState(world, fixture));
const path = "tests/sim/scripts/bay/bay.json";
for (const segment of parseScript(JSON.parse(readFileSync(path, "utf8")), path))
  for (let count = 0; count < segment.ticks; count += 1) play.tick(segment.frame);
play.navigate({ x: 85, y: 545 });
play.leave({ x: -1, y: 0 }, "plaza");
play.approach("npc:bus-stop");
play.talk("npc:bus-stop", [0]);
play.idle(60);
if (play.state().area !== "pass") throw new Error("the bus didn't go to the pass");
play.approach("pass-sign");
play.talk("pass-sign");
// Along to the lodge's porch, then down to the stop.
play.navigate({ x: 1180, y: 556 });
play.approach("pass-bus-stop");
play.talk("pass-bus-stop", [0]);
play.idle(60);
const end = play.state();
if (end.area !== "plaza" || end.player.x !== 878 || end.player.y !== 985)
  throw new Error(`the bus didn't bring Fae home: ${end.area} ${JSON.stringify(end.player)}`);
console.error(`bus: ${end.tick} ticks, ${play.script.length} segments`);
console.log(JSON.stringify(play.script, null, 2));
