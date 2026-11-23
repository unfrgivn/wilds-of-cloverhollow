#!/usr/bin/env bun
// Records the golden path's flute link (Milestone 68): the field golden run
// (tests/sim/scripts/new-game/golden-field.json, recess), then back through
// the gym and the east hall to the school hall, where Nurse Holly gives Fae
// a hall pass; out through the plaza to the park; the den's fizzy pup calmed,
// his purple-thread tale, then a pat and a snack, and he's a friend; the
// flute calls him to Fae's side; a battle he sits out; he swims out into the
// pond for the old tin; and the flute sends him home.
//
//   bun tools/sim/record-golden-flute.ts > tests/sim/scripts/new-game/golden-flute.json
import { readFileSync } from "node:fs";
import { createState, presentCritters } from "../../src/core";
import { loadContent } from "../../src/content/load";
import { parseScript } from "../../src/content/script";
import { createRecorder } from "./recorder";

const { world, fixtures } = loadContent();
const fixture = fixtures["new-game"];
if (fixture === undefined) throw new Error("new-game fixture missing");
const play = createRecorder(world, createState(world, fixture));
const path = "tests/sim/scripts/new-game/golden-field.json";
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

// Back inside. The golden chain earned the hall pass in chapter one, so the
// front doors open for her; no need to ask Nurse Holly again.
door("field", "gym", "gym");
door("gym", "door", "east-hall");
door("east-hall", "west", "school");
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
console.error(`golden-flute: ${end.tick} ticks, ${play.script.length} segments, ` +
  `coins ${end.coins}, snacks ${end.snacks}, party ${party().join(",")}`);
console.log(JSON.stringify(play.script, null, 2));
