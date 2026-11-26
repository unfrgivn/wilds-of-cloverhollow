#!/usr/bin/env bun
// Records Milestone 80 (Ribbon Bunny 3rd flute friend & Star Gems): chains from
// golden-squirrel.json (which ends in woods with Maddie, Sue, Jordan, Acorn
// Squirrel, the flute, Pond Pup & Acorn Squirrel befriended, and plenty of
// snacks): walks to Cliffside Trail, calms & befriends Ribbon Bunny (smoothing
// her ribbon + sharing a snack), calls her with the flute so she hops along,
// sends her into the rocky trail-gem burrow for the Citrine Star Gem, then
// steps into a second trail battle and calls Flute Assist (Pond Pup + Acorn
// Squirrel + Ribbon Bunny) for +40 calm, +1 leaf, +1 soften, and +1 Together
// sparkle star before finishing the calm-down.
//
//   bun tools/sim/record-bunny-gems.ts > tests/sim/scripts/new-game/bunny-gems.json
import { readFileSync } from "node:fs";
import { blankInput, createState, presentCritters, starGemsFound } from "../../src/core";
import { loadContent } from "../../src/content/load";
import { parseScript } from "../../src/content/script";
import { createRecorder } from "./recorder";

const { world, fixtures } = loadContent();
const fixture = fixtures["new-game"];
if (fixture === undefined) throw new Error("new-game fixture missing");
const play = createRecorder(world, createState(world, fixture));
const basePath = "tests/sim/scripts/new-game/golden-squirrel.json";
for (const segment of parseScript(JSON.parse(readFileSync(basePath, "utf8")), basePath))
  for (let count = 0; count < segment.ticks; count += 1) play.tick(segment.frame);

const story = (name: string): unknown => world.storyVariable(play.state().ink, name);
const must = (name: string, what: string): void => {
  if (story(name) !== true) throw new Error(what);
};
if (play.state().area !== "woods") throw new Error("golden-squirrel didn't end in woods");
must("has_flute", "no flute");
must("pup_friend", "Pond Pup not befriended");
must("squirrel_friend", "Acorn Squirrel not befriended");

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
const fizzyKind = (kind: string): boolean => presentCritters(world, play.state())
  .some((critter) => critter.kind.id === kind && critter.mood === "chaos");

// Walk from Whispering Woods -> Pinecone Pass -> Cliffside Trail.
door("woods", "pass", "pass");
door("pass", "trail", "trail");

// Ensure a fizzy bunny is out on Cliffside Trail.
for (let tries = 0; tries < 8 && !fizzyKind("bunny"); tries += 1) {
  door("trail", "pass", "pass");
  door("pass", "trail", "trail");
}
if (!fizzyKind("bunny")) throw new Error("no fizzy bunny on the trail");

// Calm the bunny, hear her tale, then smooth her ribbon and share a snack!
play.meet("bunny");
play.battle([]);
const calmBunny = presentCritters(world, play.state())
  .find((critter) => critter.kind.id === "bunny" && critter.mood === "calm");
if (calmBunny === undefined) throw new Error("no calm bunny");
const bunnyTarget = `critter:${calmBunny.key}`;
play.approach(bunnyTarget, "left");
play.talk(bunnyTarget);
play.talk(bunnyTarget, [0, 0]);
must("bunny_friend", "Ribbon Bunny wasn't befriended");

// Call Ribbon Bunny with the flute: choice 0 = Call Pond Pup, 1 = Send Squirrel home,
// 2 = Call Ribbon Bunny!
play.flute([2]);
if (!party().includes("ribbon-bunny")) throw new Error("Ribbon Bunny didn't join the party");

// Hop Ribbon Bunny into the cliffside rocky burrow for the Citrine Star Gem!
const coinsBeforeGem = play.state().coins;
play.approach("trail-gem");
play.talk("trail-gem", [0]);
must("gem_trail", "Citrine Star Gem wasn't collected");
if (play.state().coins !== coinsBeforeGem + 5) throw new Error("expected +5 coins from Star Gem");
if (starGemsFound(world, play.state()).found !== 1) throw new Error("expected 1 Star Gem found");

// Step into a second trail battle and call Flute Assist (all 3 flute friends)
// for +40 calm and +1 Together! sparkle star.
let foe = presentCritters(world, play.state())
  .find((critter) => critter.wild !== null && critter.mood === "chaos");
for (let tries = 0; tries < 6 && foe === undefined; tries += 1) {
  door("trail", "pass", "pass");
  door("pass", "trail", "trail");
  foe = presentCritters(world, play.state())
    .find((critter) => critter.wild !== null && critter.mood === "chaos");
}
if (foe === undefined) throw new Error("no second fizzy critter on the trail");
play.meet(foe.kind.id);

// Advance past intro to command phase and let the command prompt finish revealing.
for (let count = 0; count < 200 && play.state().battle?.phase !== "command"; count += 1) {
  play.press();
}
if (play.state().battle?.phase !== "command") throw new Error("battle didn't reach command phase");
for (
  let count = 0;
  count < 120 &&
    play.state().battle !== null &&
    play.state().battle!.revealed < play.state().battle!.message.length;
  count += 1
) {
  play.idle(1);
}
// Pause briefly so E2E can verify the Flute Friends pill before calling.
play.idle(15);
// Press flute in battle for Flute Assist!
play.tick({ ...blankInput(), flute: true });
play.tick(blankInput());
if (play.state().battle?.fluteUsed !== true) throw new Error("flute assist didn't fire");
if ((play.state().battle?.sparkle ?? 0) < 1)
  throw new Error("Ribbon Bunny didn't add sparkle star");
// Wait for the Flute Assist message to fully reveal, then hold briefly for E2E capture.
for (
  let count = 0;
  count < 180 &&
    play.state().battle !== null &&
    play.state().battle!.revealed < play.state().battle!.message.length;
  count += 1
) {
  play.idle(1);
}
play.idle(25);
// Finish the battle cleanly.
play.battle([]);

const end = play.state();
console.error(
  `bunny-gems: ${end.tick} ticks, ${play.script.length} segments, ` +
    `coins ${end.coins}, snacks ${end.snacks}, gems ${starGemsFound(world, end).found}/7, ` +
    `party ${party().join(",")}, in ${end.area}`,
);
console.log(JSON.stringify(play.script, null, 2));
