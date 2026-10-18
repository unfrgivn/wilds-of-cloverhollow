#!/usr/bin/env bun
// Records the hooded kid's battle, on from the Ancient Tree's look point.
//
//   bun tools/sim/record-kid.ts > tests/sim/scripts/pass-party/kid.json
import { readFileSync } from "node:fs";
import { createState } from "../../src/core";
import { loadContent } from "../../src/content/load";
import { parseScript } from "../../src/content/script";
import { createRecorder } from "./recorder";

const { world, fixtures } = loadContent();
const fixture = fixtures["pass-party"];
if (fixture === undefined) throw new Error("pass-party fixture missing");
const play = createRecorder(world, createState(world, fixture));
const path = "tests/sim/scripts/pass-party/forest.json";
for (const segment of parseScript(JSON.parse(readFileSync(path, "utf8")), path))
  for (let count = 0; count < segment.ticks; count += 1) play.tick(segment.frame);

play.meet("hooded-kid");
play.battle([
  "soothe", "play", "cast", "soothe", "talk", "talk", "talk",
], undefined, [0, 1, 0]);
play.approach("critter:hooded-kid");
play.talk("critter:hooded-kid");
play.talk("critter:hooded-kid");

const end = play.state();
if (end.area !== "enchanted" || end.dialogue !== null || end.battle !== null)
  throw new Error("kid run did not end in the forest with dialogue closed");
console.error(`kid: ${end.tick} ticks, ${play.script.length} segments, in ${end.area}`);
console.log(JSON.stringify(play.script, null, 2));
