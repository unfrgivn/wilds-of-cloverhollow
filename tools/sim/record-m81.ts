#!/usr/bin/env bun
// Records Milestone 81 (Peekaboo check, Starry Owl & Chef Mateo Taco Truck Talk
// mini-boss): chains from golden-clubhouse.json (in clubhouse with full party
// and clubhouse_claimed = true): exits to Whispering Woods, examines moon-perch
// to summon Starey Owl, battles & calms Starry Owl playing Peekaboo bursts with
// real keys, talks to Starry Owl, walks south to Clover Hills, reads taco-flyer
// to summon Fizzy Chef Mateo, battles Chef Mateo through Part 1 + all 3 graded
// Talk knots, talks to Chef Mateo to receive 2 crispy taco snacks & buy a
// 4-coin taco snack, and verifies both stickers!
//
//   bun tools/sim/record-m81.ts > tests/sim/scripts/new-game/m81-festival.json
import { readFileSync } from "node:fs";
import { createState } from "../../src/core";
import { loadContent } from "../../src/content/load";
import { parseScript } from "../../src/content/script";
import { createRecorder } from "./recorder";

const { world, fixtures } = loadContent();
const fixture = fixtures["new-game"];
if (fixture === undefined) throw new Error("new-game fixture missing");
const play = createRecorder(world, createState(world, fixture));
const basePath = "tests/sim/scripts/new-game/golden-clubhouse.json";
for (const segment of parseScript(JSON.parse(readFileSync(basePath, "utf8")), basePath))
  for (let count = 0; count < segment.ticks; count += 1) play.tick(segment.frame);

const story = (name: string): unknown => world.storyVariable(play.state().ink, name);
const must = (name: string, what: string): void => {
  if (story(name) !== true) throw new Error(what);
};
if (play.state().area !== "clubhouse") throw new Error("golden-clubhouse didn't end in clubhouse");
must("clubhouse_claimed", "clubhouse wasn't claimed");

const spawnOf = (area: string, name: string): { x: number; y: number } => {
  const spawn = world.areas[area]?.spawns[name];
  if (spawn === undefined) throw new Error(`no ${area}.${name} spawn`);
  return spawn;
};
const door = (area: string, spawn: string, to: string): void => {
  play.navigate(spawnOf(area, spawn), 6);
  play.through(to);
};

// Exit clubhouse into Whispering Woods.
door("clubhouse", "ladder", "woods");

// Examine moon-perch in the southeast clearing to summon Starey Owl.
play.approach("moon-perch", "down");
play.talk("moon-perch");
must("moon_owl_out", "Starey Owl wasn't summoned");

// Meet Starey Owl and battle with Peekaboo bursts!
play.meet("moon-owl");
play.battle(["soothe", "play", "cast", "juggle"]);
if (!play.state().stickers.includes("starry-owl"))
  throw new Error("Starry Owl sticker wasn't awarded");

// Talk to calm Starry Owl.
play.approach("critter:moon-owl", "down");
play.talk("critter:moon-owl");

// Walk south from Whispering Woods into Clover Hills.
door("woods", "hills", "hills");

// Read the Taco Truck flyer in the quiet southeast meadow to summon Chef Mateo.
play.approach("taco-flyer", "left");
play.talk("taco-flyer");
must("taco_chef_out", "Chef Mateo wasn't summoned");

// Battle Fizzy Chef Mateo through Part 1 + all 3 graded Talk knots!
play.meet("taco-chef");
play.battle(["soothe", "play", "cast"], undefined, [0, 0, 0]);
if (!play.state().stickers.includes("taco-chef"))
  throw new Error("Chef Mateo sticker wasn't awarded");

// Talk to calm Chef Mateo: receive 2 free crispy taco snacks and buy 1 for 4 coins!
const snacksBefore = play.state().snacks;
const coinsBefore = play.state().coins;
play.approach("critter:taco-chef", "left");
play.talk("critter:taco-chef", [0]);
must("mateo_snacks_given", "Chef Mateo didn't give free taco snacks");
if (play.state().snacks !== snacksBefore + 3) {
  throw new Error(
    `expected +3 snacks (2 gift + 1 bought), got ${play.state().snacks - snacksBefore}`,
  );
}
if (play.state().coins !== coinsBefore - 4)
  throw new Error(`expected -4 coins for crispy taco, got ${play.state().coins - coinsBefore}`);

const end = play.state();
console.error(
  `m81-festival: ${end.tick} ticks, ${play.script.length} segments, ` +
    `coins ${end.coins}, snacks ${end.snacks}, stickers ${end.stickers.length}, in ${end.area}`,
);
console.log(JSON.stringify(play.script, null, 2));
