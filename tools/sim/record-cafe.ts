#!/usr/bin/env bun
// Records the Bon Appetit Cafe & Town Life run: chains from golden-bay.json
// (with Maddie, Sue, and Bay Bluebird calmed), takes the bus back to Town Plaza,
// enters Bon Appetit Cafe through its teal door, talks to Dad, Toby, Bree,
// Grandpa Barnaby (earning his 15-coin peaceful-valley gift), and Chef Bea
// (starting the Lost Star Cinnamon errand), walks to Meadow Park to find Chef
// Bea's Star Cinnamon tin by the picnic blanket, returns to Bon Appetit Cafe
// to finish the errand (earning snacks, coins, and the Bon Appetit Star Pin)
// and buy a warm cinnamon bun, and steps back out to the plaza.
//
//   bun tools/sim/record-cafe.ts > tests/sim/scripts/new-game/cafe.json
import { readFileSync } from "node:fs";
import { createState } from "../../src/core";
import { loadContent } from "../../src/content/load";
import { parseScript } from "../../src/content/script";
import { createRecorder } from "./recorder";

const { world, fixtures } = loadContent();
const fixture = fixtures["new-game"];
if (fixture === undefined) throw new Error("new-game fixture missing");
const play = createRecorder(world, createState(world, fixture));
const path = "tests/sim/scripts/new-game/golden-bay.json";
for (const segment of parseScript(JSON.parse(readFileSync(path, "utf8")), path))
  for (let count = 0; count < segment.ticks; count += 1) play.tick(segment.frame);

const story = (name: string): unknown => world.storyVariable(play.state().ink, name);
const must = (name: string, what: string): void => {
  if (story(name) !== true) throw new Error(what);
};
if (play.state().area !== "bay") throw new Error("golden-bay didn't end in bay");

const spawnOf = (area: string, name: string): { x: number; y: number } => {
  const spawn = world.areas[area]?.spawns[name];
  if (spawn === undefined) throw new Error(`no ${area}.${name} spawn`);
  return spawn;
};

// Bubblegum Bay -> Star Bus back to Cloverhollow Plaza.
play.approach("npc:bus-stop");
play.talk("npc:bus-stop", [0]);
play.idle(60);
if (play.state().area !== "plaza") throw new Error("bus didn't return to plaza");

// Walk up to Bon Appetit Cafe's muted-teal door and step inside.
play.navigate({ x: 1068, y: 428 }, 8);
play.leave({ x: 0, y: -1 }, "cafe");
if (play.state().area !== "cafe") throw new Error("didn't enter Bon Appetit Cafe");

// Chat with Dad, Toby, Chef Bea (start Star Cinnamon errand), Bree, and Grandpa Barnaby.
play.approach("npc:dad", "left");
play.talk("npc:dad");
must("met_dad", "didn't meet Dad");

play.approach("npc:toby");
play.talk("npc:toby");

play.approach("npc:chef");
play.talk("npc:chef", [1]);
must("spice_quest", "Chef Bea didn't start the Star Cinnamon errand");

play.approach("npc:bree");
play.talk("npc:bree");

play.approach("npc:barnaby", "up");
play.talk("npc:barnaby");
must("barnaby_gift", "Grandpa Barnaby didn't give his peaceful-valley gift");

// Exit Bon Appetit Cafe back to the plaza.
play.navigate({ x: 315, y: 500 }, 8);
play.leave({ x: -1, y: -1 }, "plaza");
if (play.state().area !== "plaza") throw new Error("didn't exit cafe to plaza");

// Walk to Meadow Park and pick up Chef Bea's Star Cinnamon tin by the picnic blanket.
play.navigate(spawnOf("plaza", "park-path"), 8);
play.leave({ x: 0, y: 1 }, "park");
if (play.state().area !== "park") throw new Error("didn't enter Meadow Park");

play.approach("spice-tin");
play.talk("spice-tin");
must("spice_found", "didn't pick up the Star Cinnamon tin in Meadow Park");

// Return to Cloverhollow Plaza and back inside Bon Appetit Cafe.
play.navigate(spawnOf("park", "plaza-path"), 8);
play.through("plaza");
play.navigate({ x: 1068, y: 428 }, 8);
play.leave({ x: 0, y: -1 }, "cafe");
if (play.state().area !== "cafe") throw new Error("didn't re-enter Bon Appetit Cafe");

// Return the Star Cinnamon tin to Chef Bea and buy a warm cinnamon bun!
play.approach("npc:chef");
play.talk("npc:chef", [0]);
must("spice_returned", "Chef Bea didn't complete the Star Cinnamon errand");

// Step back out to Cloverhollow Plaza.
play.navigate({ x: 315, y: 500 }, 8);
play.leave({ x: -1, y: -1 }, "plaza");

const end = play.state();
if (end.area !== "plaza") throw new Error("didn't step back out to plaza");
console.error(
  `cafe: ${end.tick} ticks, ${play.script.length} segments, ` +
    `coins ${end.coins}, snacks ${end.snacks}, in ${end.area}`,
);
console.log(JSON.stringify(play.script, null, 2));
