#!/usr/bin/env bun
// Records Ms. Rowan's art room, on from the field run: the paint under the
// door, her Trace battle, her open room, and all four things to look at.
//
//   bun tools/sim/record-art.ts > tests/sim/scripts/pass-party/art.json
import { readFileSync } from "node:fs";
import { createState } from "../../src/core";
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
if (story("stash_found") !== true || play.state().area !== "field")
  throw new Error("field run did not end with the stash found");

const spawnOf = (area: string, name: string): { x: number; y: number } => {
  const spawn = world.areas[area]?.spawns[name];
  if (spawn === undefined) throw new Error(`no ${area}.${name} spawn`);
  return spawn;
};
const door = (area: string, spawn: string, to: string): void => {
  play.navigate(spawnOf(area, spawn), 6);
  play.through(to);
};

door("field", "gym", "gym");
door("gym", "door", "east-hall");
play.approach("art-room");
play.talk("art-room");
if (story("art_teacher_out") !== true) throw new Error("Ms. Rowan didn't come out");
play.meet("art-teacher");
play.battle([]);
play.approach("critter:art-teacher");
play.talk("critter:art-teacher");
if (story("art_open") !== true || !play.state().stickers.includes("art-teacher"))
  throw new Error("the art room didn't open or Ms. Rowan has no sticker");

play.navigate({ x: 760, y: 380 }, 6);
play.through("art-room");
for (const id of ["easels", "art-wall", "sink", "marker-box"]) {
  play.approach(id);
  play.talk(id);
}
const end = play.state();
console.error(`art: ${end.tick} ticks, ${play.script.length} segments, ` +
  `coins ${end.coins}, in ${end.area}`);
console.log(JSON.stringify(play.script, null, 2));
