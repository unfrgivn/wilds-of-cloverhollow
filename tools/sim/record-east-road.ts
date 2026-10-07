#!/usr/bin/env bun
// Records the way to Bubblegum Bay after chapter one (Milestone 19): chapter
// one's run (tests/sim/scripts/new-game/chapter-one.json, ending at the tree
// house), then out of Meadow Park, across the plaza (its critters calmed
// first), and down the east road, open now the club is, into the bay.
//
//   bun tools/sim/record-east-road.ts > tests/sim/scripts/new-game/east-road.json
import { readFileSync } from "node:fs";
import { createState } from "../../src/core";
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
play.navigate({ x: 1585, y: 555 });
play.leave({ x: 1, y: 0 }, "bay");
const end = play.state();
if (end.player.x !== 180 || end.player.y !== 545) throw new Error("not at the bay's road in");
console.error(`east-road: ${end.tick} ticks, ${play.script.length} segments`);
console.log(JSON.stringify(play.script, null, 2));
