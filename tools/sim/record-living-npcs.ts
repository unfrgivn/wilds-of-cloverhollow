#!/usr/bin/env bun
// Records the Living NPCs & Organic World Intelligence tour: chains from
// golden-bay.json (ends in Bubblegum Bay with Maddie & Sue and Bay Bluebird
// calmed), chats with Captain Sal, Kai, and Nora in Bubblegum Bay, takes the
// Star Bus back to Cloverhollow Plaza to visit Flora, Mailman Gus, and Sammy,
// then walks down to Meadow Park to solve Pippa's riddle and visit Grandma
// Hazel.
//
//   bun tools/sim/record-living-npcs.ts > tests/sim/scripts/new-game/living-npcs.json
import { readFileSync } from "node:fs";
import { createState, stableHash } from "../../src/core";
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

if (play.state().area !== "bay") throw new Error("golden-bay didn't end in bay");

const spawnOf = (area: string, name: string): { x: number; y: number } => {
  const spawn = world.areas[area]?.spawns[name];
  if (spawn === undefined) throw new Error(`no ${area}.${name} spawn`);
  return spawn;
};

const beforeCoins = play.state().coins;
const beforeSnacks = play.state().snacks;

const shooNear = (npcId: string): void => {
  const area = world.areas[play.state().area];
  const npc = area?.npcs.find((item) => item.id === npcId);
  if (npc === undefined) return;
  const near = play.state().wild.find(
    (critter) =>
      critter.mood === "chaos" &&
      critter.cooldownTicks === 0 &&
      Math.hypot(critter.x - npc.point.x, critter.y - npc.point.y) < 350,
  );
  if (near !== undefined) {
    play.meet(near.kind);
    play.battle(["run"]);
  }
};

// Bubblegum Bay: Captain Sal (Sue interjection + 2 harbor snacks), Kai, Nora.
play.approach("npc:sal");
play.talk("npc:sal");

play.approach("npc:kai");
play.talk("npc:kai", [0]);

play.approach("npc:nora");
play.talk("npc:nora", [0]);

// Star Bus back to Cloverhollow Plaza.
shooNear("bus-stop");
play.approach("npc:bus-stop");
play.talk("npc:bus-stop", [0]);
play.idle(60);
if (play.state().area !== "plaza") throw new Error("bus didn't return to plaza");

// Cloverhollow Plaza: Flora (Sue tulip interjection), Mailman Gus, Sammy.
shooNear("flora");
play.approach("npc:flora");
play.talk("npc:flora", [0]);

shooNear("gus");
play.approach("npc:gus");
play.talk("npc:gus", [0]);

shooNear("sammy");
play.approach("npc:sammy");
play.talk("npc:sammy", [0]);

// Walk down park-path into Meadow Park.
play.navigate(spawnOf("plaza", "park-path"), 8);
play.leave({ x: 0, y: 1 }, "park");
if (play.state().area !== "park") throw new Error("didn't enter Meadow Park");

// Meadow Park: Pippa (solve park critter riddle for 5 coins + 1 snack) and Grandma Hazel.
shooNear("pippa");
play.approach("npc:pippa");
play.talk("npc:pippa", [0, 0]);

shooNear("hazel");
play.approach("npc:hazel");
play.talk("npc:hazel");

const end = play.state();
if (end.area !== "park") throw new Error("didn't end in Meadow Park");
console.error(
  `living-npcs: ${end.tick} ticks, ${play.script.length} segments, ` +
    `coins ${beforeCoins}->${end.coins} (+${end.coins - beforeCoins}), ` +
    `snacks ${beforeSnacks}->${end.snacks} (+${end.snacks - beforeSnacks}), ` +
    `in ${end.area}, hash ${stableHash(end)}`,
);
console.log(JSON.stringify(play.script, null, 2));
