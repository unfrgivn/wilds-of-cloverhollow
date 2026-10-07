#!/usr/bin/env bun
// Records coins and shops (Milestone 27) as a replay script: from the plaza
// fountain, Fae calms the fountain frog (8 coins), buys a snack at the bakery
// (5 coins), takes the lower-right path to Meadow Park, and eats the snack in
// the pup's battle before soothing him (8 more coins).
//
//   bun tools/sim/record-bakery.ts > tests/sim/scripts/plaza/bakery.json
import { battleCommands, createState } from "../../src/core";
import { loadContent } from "../../src/content/load";
import { createRecorder } from "./recorder";

const { world, fixtures } = loadContent();
const fixture = fixtures.plaza;
if (fixture === undefined) throw new Error("plaza fixture missing");
const play = createRecorder(world, createState(world, fixture));
const left = { x: -1, y: 0 };
const right = { x: 1, y: 0 };
const down = { x: 0, y: 1 };

// Walks in a straight line until a battle starts.
function meet(move: { x: number; y: number }, critter: string): void {
  for (let count = 0; count < 120 && play.state().battle === null; count += 1)
    play.hold(move, 1);
  if (play.state().battle?.critterId !== critter) throw new Error(`the ${critter} never met Fae`);
}

// The frog sits at the fountain's south rim; Fae comes at him from the east.
play.navigate({ x: 1140, y: 850 });
meet(left, "frog");
play.battle([]);
// The bakery's window, from the cobbles below it.
play.navigate({ x: 1180, y: 470 });
play.face("up");
play.talk("bakery", [0]);
// Down the lower-right path to the park, letting go for the fade.
play.navigate({ x: 1470, y: 950 });
for (let count = 0; count < 120 && play.state().transition === null; count += 1)
  play.hold(down, 1);
play.idle(40);
if (play.state().area !== "park" || play.state().transition !== null)
  throw new Error("the lower-right path didn't lead to the park");
// The pup waits by the pond; Fae walks up from the west and offers the snack
// first, pausing on it so the e2e can see the Snack button.
play.navigate({ x: 790, y: 640 });
meet(right, "pup");
let shown = false;
play.battle(["snack"], (state) => {
  const selected = battleCommands(world, state)[state.battle?.selected ?? -1];
  if (shown || selected?.id !== "snack") return false;
  shown = true;
  return true;
});
const end = play.state();
if (end.coins !== 11 || end.snacks !== 2 || end.critters.pup !== "calm" ||
  !end.stickers.includes("pond-pup"))
  throw new Error(`ended with ${end.coins} coins and ${end.snacks} snacks`);
console.error(`bakery: ${end.tick} ticks, ${play.script.length} segments`);
console.log(JSON.stringify(play.script, null, 2));
