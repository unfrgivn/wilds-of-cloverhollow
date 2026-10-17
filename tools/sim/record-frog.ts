#!/usr/bin/env bun
// Records the fountain frog's two battle outcomes from the plaza fixture
// (Milestone 9, re-recorded for Milestone 40's checks). Fae walks into the
// frog, then either calms him, every check GREAT (`win`), or reads every
// line and picks Soothe but never presses in a check, so every check misses,
// until she's tuckered out and rests (`rest`).
//
//   bun tools/sim/record-frog.ts win > tests/sim/scripts/plaza/frog-win.json
//   bun tools/sim/record-frog.ts rest > tests/sim/scripts/plaza/frog-rest.json
import { createState } from "../../src/core";
import { loadContent } from "../../src/content/load";
import { createRecorder } from "./recorder";

const outcome = Bun.argv[2];
if (outcome !== "win" && outcome !== "rest") throw new Error("usage: record-frog.ts win|rest");
const { world, fixtures } = loadContent();
const fixture = fixtures.plaza;
if (fixture === undefined) throw new Error("plaza fixture missing");
const play = createRecorder(world, createState(world, fixture));
play.meet("fountain-frog");
if (outcome === "win") play.battle([]);
else {
  for (let count = 0; count < 4000 && play.state().battle !== null; count += 1) {
    if (play.state().battle?.phase === "check") play.idle(1);
    else play.press();
  }
  while (play.state().transition !== null) play.idle(1);
}
const end = play.state();
const frog = end.critters["fountain-frog"];
if (end.battle !== null || end.area !== "plaza")
  throw new Error("the battle didn't end in the plaza");
if (outcome === "win" && frog !== "calm") throw new Error("the frog isn't calm");
if (outcome === "rest" && (frog !== "chaos" || end.stickers.length > 0))
  throw new Error("Fae didn't rest with the frog still fizzy");
console.error(`frog-${outcome}: ${end.tick} ticks, ${play.script.length} segments`);
console.log(JSON.stringify(play.script, null, 2));
