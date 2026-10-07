#!/usr/bin/env bun
// Records the way to the Whispering Woods (Milestone 26): Jordan's run
// (tests/sim/scripts/pass-party/jordan.json), the lantern on, the arrow on the
// west pines (the old trail), along the old trail into the woods, into the
// fizzy owl (calmed with Soothe), and the clubhouse with the lantern still on
// (its wall's invisible ink), which Fae and friends claim.
//
//   bun tools/sim/record-woods.ts > tests/sim/scripts/pass-party/woods.json
import { readFileSync } from "node:fs";
import { createState } from "../../src/core";
import { loadContent } from "../../src/content/load";
import { parseScript } from "../../src/content/script";
import { createRecorder } from "./recorder";

const { world, fixtures } = loadContent();
const fixture = fixtures["pass-party"];
if (fixture === undefined) throw new Error("pass-party fixture missing");
const play = createRecorder(world, createState(world, fixture));
const path = "tests/sim/scripts/pass-party/jordan.json";
for (const segment of parseScript(JSON.parse(readFileSync(path, "utf8")), path))
  for (let count = 0; count < segment.ticks; count += 1) play.tick(segment.frame);
play.lantern();
play.approach("glow:old-trail-marker");
play.talk("glow:old-trail-marker");
play.navigate({ x: 465, y: 600 });
play.leave({ x: 0, y: 1 }, "woods");
play.meet("owl");
play.battle([]);
play.approach("clubhouse");
play.talk("clubhouse");
const end = play.state();
if (end.area !== "woods" || !end.lantern ||
  world.storyVariable(end.ink, "clubhouse_claimed") !== true)
  throw new Error("the woods run didn't claim the clubhouse");
console.error(`woods: ${end.tick} ticks, ${play.script.length} segments`);
console.log(JSON.stringify(play.script, null, 2));
