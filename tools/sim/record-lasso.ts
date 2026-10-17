#!/usr/bin/env bun
// Records lasso spots (Milestone 49), on from the flute run, which ends in
// Meadow Park with Coach Ash's lasso and the nurse's hall pass: Rosie's kite
// lassoed off the play tower; the bus up to Pinecone Pass, where the cocoa
// seller's scarf is lassoed off a ski-lift chair and given back for free
// cocoa; down the Cliffside Trail to Bubblegum Bay, where a bottle bobbing past
// the end of Sue's dock holds a treasure map, and the treasure is dug up
// between the palms; the bay road home, and the kite back to Rosie in the
// classroom. (This chain skips chapter one, so the bay road is shut on the way
// out and the bus only goes up the mountain: the trail is the way to the bay.)
//
//   bun tools/sim/record-lasso.ts > tests/sim/scripts/pass-party/lasso.json
import { readFileSync } from "node:fs";
import { createState } from "../../src/core";
import { loadContent } from "../../src/content/load";
import { parseScript } from "../../src/content/script";
import { createRecorder } from "./recorder";

const { world, fixtures } = loadContent();
const fixture = fixtures["pass-party"];
if (fixture === undefined) throw new Error("pass-party fixture missing");
const play = createRecorder(world, createState(world, fixture));
const path = "tests/sim/scripts/pass-party/flute.json";
for (const segment of parseScript(JSON.parse(readFileSync(path, "utf8")), path))
  for (let count = 0; count < segment.ticks; count += 1) play.tick(segment.frame);
const story = (name: string): unknown => world.storyVariable(play.state().ink, name);
const must = (name: string, what: string): void => {
  if (story(name) !== true) throw new Error(what);
};
if (play.state().area !== "park") throw new Error("the flute run didn't end in the park");
must("has_lasso", "no lasso");

const spawnOf = (area: string, name: string): { x: number; y: number } => {
  const spawn = world.areas[area]?.spawns[name];
  if (spawn === undefined) throw new Error(`no ${area}.${name} spawn`);
  return spawn;
};
const door = (area: string, spawn: string, to: string): void => {
  play.navigate(spawnOf(area, spawn), 6);
  play.through(to);
};
// A bus stop's line travels as the conversation closes.
const ride = (stop: string, choice: number, to: string): void => {
  play.approach(stop);
  play.talk(stop, [choice]);
  play.idle(60);
  if (play.state().area !== to) throw new Error(`the bus didn't go to ${to}`);
};

// Rosie's kite, off the play tower's flagpole.
play.approach("tower");
play.talk("tower", [0]);
must("kite_down", "the kite didn't come down");

// Up to the pass: the cocoa seller's scarf, off the lift chair and given back.
door("park", "plaza-path", "plaza");
ride("npc:bus-stop", 0, "pass");
play.approach("ski-lift");
play.talk("ski-lift", [0]);
must("scarf_down", "the scarf didn't come down");
play.approach("cocoa-stand");
play.talk("cocoa-stand");
must("scarf_returned", "the scarf wasn't given back");

// Down the trail to the bay: the bottle past the end of Sue's dock, and the
// treasure between the palms.
door("pass", "trail", "trail");
door("trail", "bay", "bay");
play.approach("dock-end");
play.talk("dock-end", [0]);
must("has_map", "no map from the bottle");
play.approach("palms");
play.talk("palms", [0]);
must("treasure_found", "no treasure dug up");

// Home by the bay road, and the kite back to Rosie.
door("bay", "plaza-road", "plaza");
door("plaza", "school-path", "school");
door("school", "classroom-door", "classroom");
play.approach("npc:rosie");
play.talk("npc:rosie");
must("kite_returned", "the kite didn't go back to Rosie");
const end = play.state();
console.error(`lasso: ${end.tick} ticks, ${play.script.length} segments, ` +
  `coins ${end.coins}, snacks ${end.snacks}, in ${end.area}`);
console.log(JSON.stringify(play.script, null, 2));
