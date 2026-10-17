#!/usr/bin/env bun
// Records the clubhouse fix-up (Milestone 43), on from the woods run, where
// the club was just claimed: the lantern off, up the ladder, Sue fixes the old
// fridge and Jordan plants strawberries; down in the woods, Fae calms the
// critters out there (each calm grows the garden), going up and back down for
// fresh ones, until the strawberries are ripe; then up again to pick them into
// the fridge and pack the fridge's snacks.
//
//   bun tools/sim/record-clubhouse.ts > tests/sim/scripts/pass-party/clubhouse.json
import { readFileSync } from "node:fs";
import { createState } from "../../src/core";
import { loadContent } from "../../src/content/load";
import { parseScript } from "../../src/content/script";
import { createRecorder } from "./recorder";

const { world, fixtures } = loadContent();
const fixture = fixtures["pass-party"];
if (fixture === undefined) throw new Error("pass-party fixture missing");
const play = createRecorder(world, createState(world, fixture));
const path = "tests/sim/scripts/pass-party/woods.json";
for (const segment of parseScript(JSON.parse(readFileSync(path, "utf8")), path))
  for (let count = 0; count < segment.ticks; count += 1) play.tick(segment.frame);
const story = (name: string): unknown => world.storyVariable(play.state().ink, name);
if (story("clubhouse_claimed") !== true) throw new Error("the woods run didn't claim the club");

const spawnOf = (area: string, name: string): { x: number; y: number } => {
  const spawn = world.areas[area]?.spawns[name];
  if (spawn === undefined) throw new Error(`no ${area}.${name} spawn`);
  return spawn;
};
const upTheLadder = (): void => {
  play.navigate(spawnOf("woods", "clubhouse"), 6);
  play.through("clubhouse");
};
const downTheLadder = (): void => {
  play.navigate(spawnOf("clubhouse", "ladder"), 6);
  play.through("woods");
};

// The woods run read the clubhouse's invisible ink by the lantern's light:
// off with it, so the room is seen as painted.
if (play.state().lantern) play.lantern();
if (play.state().lantern) throw new Error("the lantern didn't switch off");

// The fix-up: the fridge, then the garden.
upTheLadder();
play.approach("club-fridge");
play.talk("club-fridge");
play.approach("club-garden");
play.talk("club-garden");
if (story("fridge_fixed") !== true || story("garden_planted") !== true)
  throw new Error("the fridge or the garden wasn't done");

// Calm the woods' critters until the strawberries are ripe: every arrival
// rolls fresh ones.
for (let visit = 0; visit < 6 && story("garden_ripe") !== true; visit += 1) {
  if (play.state().area === "clubhouse") downTheLadder();
  play.clear();
  if (story("garden_ripe") !== true) upTheLadder();
}
if (story("garden_ripe") !== true) throw new Error("the strawberries never ripened");

// Pick them into the fridge, and pack the snacks.
if (play.state().area !== "clubhouse") upTheLadder();
const before = play.state().snacks;
play.approach("club-garden");
play.talk("club-garden");
play.approach("club-fridge");
play.talk("club-fridge", [0]);
const end = play.state();
if (end.snacks !== before + 3) throw new Error(`snacks ${before} -> ${end.snacks}, not +3`);
console.error(`clubhouse: ${end.tick} ticks, ${play.script.length} segments, ` +
  `calms ${String(story("garden_calms"))}, snacks ${end.snacks}`);
console.log(JSON.stringify(play.script, null, 2));
