#!/usr/bin/env bun
// Records the bus line from Cloverhollow (Milestone 24): chapter one's run
// (tests/sim/scripts/new-game/chapter-one.json, ending at the tree house),
// then out of Meadow Park and across the plaza (its critters calmed first) to
// its bus stop, ready to ride: Fae in front of the stop, facing it.
//
//   bun tools/sim/record-bus-line.ts > tests/sim/scripts/new-game/bus-line.json
import { readFileSync } from "node:fs";
import { createState, targetInteractable } from "../../src/core";
import { loadContent } from "../../src/content/load";
import { parseScript } from "../../src/content/script";
import { createRecorder } from "./recorder";

const { world, fixtures } = loadContent();
const fixture = fixtures["new-game"];
if (fixture === undefined) throw new Error("new-game fixture missing");
const play = createRecorder(world, createState(world, fixture));
const path = "tests/sim/scripts/new-game/chapter-one.json";
for (const segment of parseScript(JSON.parse(readFileSync(path, "utf8")), path))
  for (let count = 0; count < segment.ticks; count += 1) play.tick(segment.frame);
play.navigate({ x: 300, y: 925 });
play.leave({ x: 0, y: 1 }, "plaza");
play.clear();
play.approach("npc:bus-stop");
const end = play.state();
if (targetInteractable(world, end)?.id !== "npc:bus-stop") throw new Error("not at the stop");
console.error(`bus-line: ${end.tick} ticks, ${play.script.length} segments`);
console.log(JSON.stringify(play.script, null, 2));
