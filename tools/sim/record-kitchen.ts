#!/usr/bin/env bun
// Records the clubhouse kitchen (Milestone 52), on from the lasso run, which
// ends in the classroom with the club claimed and Mom's freezer untouched: home
// through the plaza, where Mom gives the club her old microwave and her toy
// chest, and Fae takes a box of dino nuggets from the freezer; the bus up to
// Pinecone Pass, the old trail into the woods, and up the clubhouse ladder;
// the nuggets cooked golden in the microwave on the fridge (three snacks); and
// the toy chest opened, every keepsake the run has found in it.
//
//   bun tools/sim/record-kitchen.ts > tests/sim/scripts/pass-party/kitchen.json
import { readFileSync } from "node:fs";
import { blankInput, createState, type ActionFrame, type CookGame } from "../../src/core";
import { loadContent } from "../../src/content/load";
import { parseScript } from "../../src/content/script";
import { createRecorder } from "./recorder";

const { world, fixtures } = loadContent();
const fixture = fixtures["pass-party"];
if (fixture === undefined) throw new Error("pass-party fixture missing");
const play = createRecorder(world, createState(world, fixture));
// The lasso run's script holds the whole chain before it, from the fixture.
const path = "tests/sim/scripts/pass-party/lasso.json";
for (const segment of parseScript(JSON.parse(readFileSync(path, "utf8")), path))
  for (let count = 0; count < segment.ticks; count += 1) play.tick(segment.frame);
const story = (name: string): unknown => world.storyVariable(play.state().ink, name);
const must = (name: string, what: string): void => {
  if (story(name) !== true) throw new Error(what);
};
if (play.state().area !== "classroom") throw new Error("the lasso run didn't end in class");
must("clubhouse_claimed", "the club isn't claimed");

const spawnOf = (area: string, name: string): { x: number; y: number } => {
  const spawn = world.areas[area]?.spawns[name];
  if (spawn === undefined) throw new Error(`no ${area}.${name} spawn`);
  return spawn;
};
const door = (area: string, spawn: string, to: string): void => {
  play.navigate(spawnOf(area, spawn), 6);
  play.through(to);
};

// Home: Mom's gift, and a box from the freezer.
door("classroom", "door", "school");
door("school", "front-doors", "plaza");
// The house door's trigger is left of its spawn: line up level with it first.
play.navigate({ x: 395, y: 545 }, 6);
play.through("kitchen");
play.approach("npc:mom");
play.talk("npc:mom");
must("has_microwave", "Mom didn't give the microwave");
must("has_chest", "Mom didn't give the chest");
play.approach("fridge");
play.talk("fridge", [0]);
must("has_nuggets", "no box of dino nuggets");

// Up the mountain and into the woods, to the clubhouse.
door("kitchen", "front-door", "plaza");
play.approach("npc:bus-stop");
play.talk("npc:bus-stop", [0]);
play.idle(60);
if (play.state().area !== "pass") throw new Error("the bus didn't go to the pass");
door("pass", "woods", "woods");
door("woods", "clubhouse", "clubhouse");

// The nuggets in the microwave: a press, held to the box's minute, and let go.
const snacks = play.state().snacks;
play.approach("club-fridge");
play.talk("club-fridge", [0]);
const game = (): CookGame => {
  const open = play.state().arcade;
  if (open?.game !== "cook") throw new Error("the microwave isn't open");
  return open;
};
if (game().dish !== "nuggets") throw new Error("the wrong box went in");
const held: ActionFrame = { ...blankInput(), confirm: true };
const free = blankInput();
play.idle(20);
const minute = world.arcade.cook.dishes.nuggets.time * world.arcade.cook.ticksPerSecond;
for (let count = 0; count < minute; count += 1) play.tick(held);
play.tick(free);
for (let count = 0; count < 120 && game().phase === "ding"; count += 1) play.tick(free);
if (game().phase !== "result") throw new Error("the microwave didn't ding");
// Read the line, then close it.
for (let count = 0; count < 200 && game().revealed < game().message.length; count += 1)
  play.tick(free);
play.idle(30);
play.tick(held);
play.tick(free);
if (play.state().arcade !== null) throw new Error("the microwave didn't close");
if (play.state().snacks !== snacks + 3) throw new Error("the nuggets weren't golden");

// The keepsake chest.
play.approach("chest");
play.talk("chest");
const end = play.state();
console.error(`kitchen: ${end.tick} ticks, ${play.script.length} segments, ` +
  `coins ${end.coins}, snacks ${end.snacks}, in ${end.area}`);
console.log(JSON.stringify(play.script, null, 2));
