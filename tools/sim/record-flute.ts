#!/usr/bin/env bun
// Records flute friends (Milestone 47), on from the field run (recess): back
// through the gym and the east hall to the school hall, where Nurse Holly
// gives Fae a hall pass; out through the plaza to the park; the den's fizzy
// pup calmed, his purple-thread tale, then a pat and a snack, and he's a
// friend; the flute calls him to Fae's side; a battle he sits out; he swims
// out into the pond for the old tin; and the flute sends him home.
//
//   bun tools/sim/record-flute.ts > tests/sim/scripts/pass-party/flute.json
import { readFileSync } from "node:fs";
import { createState, presentCritters } from "../../src/core";
import { loadContent } from "../../src/content/load";
import { parseScript } from "../../src/content/script";
import { createRecorder } from "./recorder";

const { world, fixtures } = loadContent();
const fixture = fixtures["pass-party"];
if (fixture === undefined) throw new Error("pass-party fixture missing");
const play = createRecorder(world, createState(world, fixture));
const path = "tests/sim/scripts/pass-party/field.json";
for (const segment of parseScript(JSON.parse(readFileSync(path, "utf8")), path))
  for (let count = 0; count < segment.ticks; count += 1) play.tick(segment.frame);
const story = (name: string): unknown => world.storyVariable(play.state().ink, name);
if (story("recess") !== true || story("has_flute") !== true)
  throw new Error("the field run didn't end at recess with the flute");

const spawnOf = (area: string, name: string): { x: number; y: number } => {
  const spawn = world.areas[area]?.spawns[name];
  if (spawn === undefined) throw new Error(`no ${area}.${name} spawn`);
  return spawn;
};
const door = (area: string, spawn: string, to: string): void => {
  play.navigate(spawnOf(area, spawn), 6);
  play.through(to);
};
const party = (): string[] => play.state().party.map((member) => member.id);
const chaos = (): number =>
  presentCritters(world, play.state()).filter((critter) => critter.mood === "chaos").length;

// Back inside, and out of school with the nurse's hall pass.
door("field", "gym", "gym");
door("gym", "door", "east-hall");
door("east-hall", "west", "school");
play.approach("npc:nurse");
play.talk("npc:nurse", [1]);
if (story("hall_pass") !== true) throw new Error("no hall pass");
door("school", "front-doors", "plaza");
door("plaza", "park-path", "park");

// The park's pup: calmed, his tale, then a pat and a snack, from beside him so
// a watcher sees them both.
play.meet("pup");
play.battle([]);
play.approach("critter:wild:0", "left");
play.talk("critter:wild:0");
play.talk("critter:wild:0", [0, 0]);
if (story("pup_friend") !== true) throw new Error("the pup isn't a friend");

// The flute calls him, and he follows.
play.flute([0]);
if (!party().includes("pond-pup")) throw new Error("the Pond Pup didn't come");

// A battle he sits out: out to the plaza and back for fresh critters if the
// park has none left (the pup den always has one).
if (chaos() === 0) {
  door("park", "plaza-path", "plaza");
  door("plaza", "park-path", "park");
}
if (!party().includes("pond-pup")) throw new Error("the Pond Pup didn't follow");
play.clear();

// He swims out for the tin.
const coins = play.state().coins;
play.approach("pond");
play.talk("pond", [0]);
if (story("pond_tin") !== true || play.state().coins !== coins + 12)
  throw new Error("no tin from the pond");

// And home again.
play.flute([0]);
if (party().includes("pond-pup")) throw new Error("the Pond Pup didn't go home");
const end = play.state();
console.error(`flute: ${end.tick} ticks, ${play.script.length} segments, ` +
  `coins ${end.coins}, snacks ${end.snacks}, party ${party().join(",")}`);
console.log(JSON.stringify(play.script, null, 2));
