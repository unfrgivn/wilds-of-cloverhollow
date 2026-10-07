#!/usr/bin/env bun
// Records the school raccoon (Milestone 15; a battle since Milestone 28): the
// hall-pass run (tests/sim/scripts/school/hall-pass.json: the shut front
// doors, Nurse Holly's pass, out to the plaza), then the fizzy raccoon waiting
// by the school path, calmed with Soothe, and its talk: the password it
// overheard. Then it scampers off.
//
//   bun tools/sim/record-raccoon.ts > tests/sim/scripts/school/raccoon.json
import { readFileSync } from "node:fs";
import { createState } from "../../src/core";
import { loadContent } from "../../src/content/load";
import { parseScript } from "../../src/content/script";
import { createRecorder } from "./recorder";

const { world, fixtures } = loadContent();
const fixture = fixtures.school;
if (fixture === undefined) throw new Error("school fixture missing");
const play = createRecorder(world, createState(world, fixture));
const path = "tests/sim/scripts/school/hall-pass.json";
for (const segment of parseScript(JSON.parse(readFileSync(path, "utf8")), path))
  for (let count = 0; count < segment.ticks; count += 1) play.tick(segment.frame);
if (play.state().area !== "plaza") throw new Error("the hall-pass run didn't reach the plaza");
play.meet("school-raccoon");
play.battle([]);
play.approach("critter:school-raccoon");
play.talk("critter:school-raccoon");
const end = play.state();
if (world.storyVariable(end.ink, "knows_password") !== true ||
  world.storyVariable(end.ink, "raccoon_waiting") !== false)
  throw new Error("the raccoon didn't tell the password");
console.error(`raccoon: ${end.tick} ticks, ${play.script.length} segments`);
console.log(JSON.stringify(play.script, null, 2));
