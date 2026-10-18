#!/usr/bin/env bun
// Records the lodge keeper (Milestone 57), on from Jordan's run, which ends at
// Pinecone Pass with the hamster calm: the lodge's note leads on (a snowball,
// and the keeper home and fizzy), Mrs. Flurry calmed in battle on her porch,
// her lodge opened, and in through its door: the fire, the cocoa, and Biscuit.
//
//   bun tools/sim/record-lodge.ts > tests/sim/scripts/pass-party/lodge.json
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
const story = (name: string): unknown => world.storyVariable(play.state().ink, name);
const must = (name: string, what: string): void => {
  if (story(name) !== true) throw new Error(what);
};
if (play.state().area !== "pass") throw new Error("Jordan's run didn't end at the pass");
if (!play.state().stickers.includes("hiker-hamster")) throw new Error("no hamster calmed");

// The note leads on: the keeper's home, and fizzy.
play.approach("lodge-door");
play.talk("lodge-door");
must("keeper_back", "the keeper didn't come home");

// Calm her on her porch, then talk.
play.meet("lodge-keeper");
play.battle(["juggle", "cast"]);
if (play.state().critters["lodge-keeper"] !== "calm") throw new Error("she isn't calm");
play.approach("critter:lodge-keeper");
play.talk("critter:lodge-keeper");
must("lodge_open", "the lodge didn't open");

// In through the open door.
play.navigate({ x: 1195, y: 520 }, 6);
play.through("lodge");
play.approach("fire");
play.talk("fire");
play.approach("cocoa");
play.talk("cocoa");
play.approach("hamster-house");
play.talk("hamster-house");
const end = play.state();
console.error(`lodge: ${end.tick} ticks, ${play.script.length} segments, ` +
  `coins ${end.coins}, snacks ${end.snacks}, in ${end.area}`);
console.log(JSON.stringify(play.script, null, 2));
