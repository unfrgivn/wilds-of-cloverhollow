#!/usr/bin/env bun
// Records the blacklight lantern at Pinecone Pass (Milestone 23): Jordan's
// run (tests/sim/scripts/pass-party/jordan.json), then the lantern on, the
// doodle on the north ski-lift tower, along the glowing paw prints to the
// arrow on the west pines (the old trail), and the lantern off.
//
//   bun tools/sim/record-lantern.ts > tests/sim/scripts/pass-party/lantern.json
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
play.approach("glow:lift-note");
play.talk("glow:lift-note");
for (const print of [{ x: 660, y: 760 }, { x: 580, y: 785 }, { x: 535, y: 805 }])
  play.navigate(print, 12);
play.approach("glow:old-trail-marker");
play.talk("glow:old-trail-marker");
play.lantern();
const end = play.state();
if (end.lantern || world.storyVariable(end.ink, "found_old_trail") !== true)
  throw new Error("the lantern run didn't find the old trail");
console.error(`lantern: ${end.tick} ticks, ${play.script.length} segments`);
console.log(JSON.stringify(play.script, null, 2));
