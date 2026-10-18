#!/usr/bin/env bun
// Records a second flute friend (Milestone 60), on from the kitchen run, which
// ends in the clubhouse with the flute and the Pond Pup a friend at home: down
// the ladder, through the woods and the pass to the Cliffside Trail; a trail
// squirrel calmed, his tale, then a chin scratch and a snack; the flute calls
// him; and back in the woods, he climbs the big oak to its knothole for a
// golden acorn and hazelnuts.
//
//   bun tools/sim/record-squirrel.ts > tests/sim/scripts/pass-party/squirrel.json
import { readFileSync } from "node:fs";
import { createState, presentCritters } from "../../src/core";
import { loadContent } from "../../src/content/load";
import { parseScript } from "../../src/content/script";
import { createRecorder } from "./recorder";

const { world, fixtures } = loadContent();
const fixture = fixtures["pass-party"];
if (fixture === undefined) throw new Error("pass-party fixture missing");
const play = createRecorder(world, createState(world, fixture));
const path = "tests/sim/scripts/pass-party/kitchen.json";
for (const segment of parseScript(JSON.parse(readFileSync(path, "utf8")), path))
  for (let count = 0; count < segment.ticks; count += 1) play.tick(segment.frame);
const story = (name: string): unknown => world.storyVariable(play.state().ink, name);
const must = (name: string, what: string): void => {
  if (story(name) !== true) throw new Error(what);
};
if (play.state().area !== "clubhouse") throw new Error("the kitchen run didn't end in the club");
must("has_flute", "no flute");
must("pup_friend", "the Pond Pup isn't a friend");

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
const fizzySquirrel = (): boolean => presentCritters(world, play.state())
  .some((critter) => critter.kind.id === "squirrel" && critter.mood === "chaos");

// Down to the woods, through the pass, and onto the trail.
door("clubhouse", "ladder", "woods");
door("woods", "pass", "pass");
door("pass", "trail", "trail");
// A squirrel out on the trail: if its dens drew bunnies this visit, out to the
// pass and back for a fresh draw.
for (let tries = 0; tries < 6 && !fizzySquirrel(); tries += 1) {
  door("trail", "pass", "pass");
  door("pass", "trail", "trail");
}
if (!fizzySquirrel()) throw new Error("no squirrel on the trail");

// Calmed, his tale; then a chin scratch and a snack make a friend.
play.meet("squirrel");
play.battle([]);
const calm = presentCritters(world, play.state())
  .findIndex((critter) => critter.kind.id === "squirrel" && critter.mood === "calm");
if (calm < 0) throw new Error("no calm squirrel");
const target = `critter:${presentCritters(world, play.state())[calm]?.key ?? ""}`;
// From his left, so a watcher sees them both.
play.approach(target, "left");
play.talk(target);
play.talk(target, [0, 0]);
must("squirrel_friend", "the squirrel isn't a friend");

// The flute calls him (the pup's call comes first in its list).
play.flute([1]);
if (!party().includes("acorn-squirrel")) throw new Error("the squirrel didn't come");

// Back to the woods, and up the big oak to its knothole.
door("trail", "pass", "pass");
door("pass", "woods", "woods");
if (!party().includes("acorn-squirrel")) throw new Error("the squirrel didn't follow");
const snacks = play.state().snacks;
play.approach("knothole");
play.talk("knothole", [0]);
must("acorn_found", "no golden acorn");
if (play.state().snacks !== snacks + 3) throw new Error("no hazelnuts");
const end = play.state();
console.error(`squirrel: ${end.tick} ticks, ${play.script.length} segments, ` +
  `coins ${end.coins}, snacks ${end.snacks}, party ${party().join(",")}, in ${end.area}`);
console.log(JSON.stringify(play.script, null, 2));
