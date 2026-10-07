#!/usr/bin/env bun
// Records coins and shops (Milestone 27) as a replay script: from the plaza
// fountain, Fae calms the fountain frog (8 coins), buys a snack at the bakery
// (5 coins), takes the lower-right path to Meadow Park, and eats the snack in
// a fizzy pup's battle before soothing it (8 more coins).
//
//   bun tools/sim/record-bakery.ts > tests/sim/scripts/plaza/bakery.json
import { battleCommands, createState } from "../../src/core";
import { loadContent } from "../../src/content/load";
import { createRecorder } from "./recorder";

const { world, fixtures } = loadContent();
const fixture = fixtures.plaza;
if (fixture === undefined) throw new Error("plaza fixture missing");
const play = createRecorder(world, createState(world, fixture));

play.meet("fountain-frog");
play.battle([]);
play.approach("bakery");
play.talk("bakery", [0]);
// Down the lower-right path to the park.
play.navigate({ x: 1470, y: 965 });
play.leave({ x: 0, y: 1 }, "park");
// A pup is out by the pond; Fae walks into it and offers the snack first,
// pausing on it so the e2e can see the Snack button.
play.meet("pup");
let shown = false;
play.battle(["snack"], (state) => {
  const selected = battleCommands(world, state)[state.battle?.selected ?? -1];
  if (shown || selected?.id !== "snack") return false;
  shown = true;
  return true;
});
const end = play.state();
if (end.coins !== 11 || end.snacks !== 2 || !end.stickers.includes("pond-pup"))
  throw new Error(`ended with ${end.coins} coins and ${end.snacks} snacks`);
console.error(`bakery: ${end.tick} ticks, ${play.script.length} segments`);
console.log(JSON.stringify(play.script, null, 2));
