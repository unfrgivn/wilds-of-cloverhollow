#!/usr/bin/env bun
// Records the Enchanted Forest opening, on from the opened seal.
//
//   bun tools/sim/record-forest.ts > tests/sim/scripts/pass-party/forest.json
import { readFileSync } from "node:fs";
import { createState } from "../../src/core";
import { loadContent } from "../../src/content/load";
import { parseScript } from "../../src/content/script";
import { createRecorder } from "./recorder";

const { world, fixtures } = loadContent();
const fixture = fixtures["pass-party"];
if (fixture === undefined) throw new Error("pass-party fixture missing");
const play = createRecorder(world, createState(world, fixture));
const path = "tests/sim/scripts/pass-party/mist.json";
for (const segment of parseScript(JSON.parse(readFileSync(path, "utf8")), path))
  for (let count = 0; count < segment.ticks; count += 1) play.tick(segment.frame);
if (play.state().area !== "mist" || world.storyVariable(play.state().ink, "seal_open") !== true)
  throw new Error("mist run did not leave the seal open");

play.through("enchanted");
play.approach("npc:fairy-lavender");
play.talk("npc:fairy-lavender");
play.approach("mystic-pond");
play.talk("mystic-pond");
play.approach("ancient-tree");
play.talk("ancient-tree");

const end = play.state();
if (end.area !== "enchanted" || end.dialogue !== null)
  throw new Error("forest run did not end in the forest with dialogue closed");
if (world.storyVariable(end.ink, "heard_wish") !== true)
  throw new Error("forest story did not advance");
console.error(`forest: ${end.tick} ticks, ${play.script.length} segments, in ${end.area}`);
console.log(JSON.stringify(play.script, null, 2));
