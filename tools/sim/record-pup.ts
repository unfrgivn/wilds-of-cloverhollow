#!/usr/bin/env bun
// Records a win over a fizzy pup in Meadow Park (Milestone 13; the park's pups
// recur since Milestone 28): from the park's path, Fae walks into the pup by
// the pond and soothes it, a press on every aim's target tick.
//
//   bun tools/sim/record-pup.ts > tests/sim/scripts/park/pup-win.json
import { createState } from "../../src/core";
import { loadContent } from "../../src/content/load";
import { createRecorder } from "./recorder";

const { world, fixtures } = loadContent();
const fixture = fixtures.park;
if (fixture === undefined) throw new Error("park fixture missing");
const play = createRecorder(world, createState(world, fixture));
play.meet("pup");
play.battle([]);
const end = play.state();
if (!end.stickers.includes("pond-pup") || end.coins !== 8)
  throw new Error("the pup battle didn't end in a calm pup");
console.error(`pup-win: ${end.tick} ticks, ${play.script.length} segments`);
console.log(JSON.stringify(play.script, null, 2));
