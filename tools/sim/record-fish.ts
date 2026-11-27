#!/usr/bin/env bun
// Records the Bubblegum Bay fishing run: chains from golden-bay.json (Sue has
// joined, no lasso yet), walks to the end of Sue's dock, chooses "Go fishing
// with Sue!", casts out, waits through nibbles until the bite, hooks and reels
// in a lake catch with real frame inputs, confirms the catch card, and steps
// back onto the dock.
//
//   bun tools/sim/record-fish.ts > tests/sim/scripts/new-game/fish.json
import { readFileSync } from "node:fs";
import { blankInput, createState } from "../../src/core";
import { loadContent } from "../../src/content/load";
import { parseScript } from "../../src/content/script";
import { createRecorder } from "./recorder";

const { world, fixtures } = loadContent();
const fixture = fixtures["new-game"];
if (fixture === undefined) throw new Error("new-game fixture missing");
const play = createRecorder(world, createState(world, fixture));
const basePath = "tests/sim/scripts/new-game/golden-bay.json";
for (const segment of parseScript(JSON.parse(readFileSync(basePath, "utf8")), basePath))
  for (let count = 0; count < segment.ticks; count += 1) play.tick(segment.frame);

const coinsBefore = play.state().coins;
play.approach("dock-end");
play.talk("dock-end", [0]);
if (play.state().arcade?.game !== "fish")
  throw new Error("dock-end did not open the fishing minigame");

// Aim up into the mid-high power range so uncommon/rare catches can bite.
play.idle(34);
// Cast out.
play.press();
for (let i = 0; i < 400; i += 1) {
  const open = play.state().arcade;
  if (open?.game !== "fish" || open.phase === "bite") break;
  play.idle(1);
}
const atBite = play.state().arcade;
if (atBite?.game !== "fish" || atBite.phase !== "bite")
  throw new Error("never reached the bite phase");

// Hook the fish!
play.press();
const free = blankInput();
const holdConfirm = { ...blankInput(), confirm: true };
for (let i = 0; i < 480; i += 1) {
  const g = play.state().arcade;
  if (g?.game !== "fish" || g.phase !== "reeling") break;
  const wantUp = g.hookPos + g.hookVel * 3 < g.fishPos;
  play.tick(wantUp ? holdConfirm : free);
}

const caughtState = play.state();
if (caughtState.arcade?.game !== "fish" || caughtState.arcade.phase !== "result" ||
  caughtState.arcade.caught === null) {
  throw new Error("did not land a catch during fishing");
}
// Release confirm from reeling, reveal full catch line, hold briefly, then close.
play.idle(1);
play.press();
play.idle(6);
play.press();
if (play.state().arcade !== null) throw new Error("fishing did not close cleanly");
// Step slightly down-left on the dock to confirm normal overworld control returned.
play.hold({ x: -1, y: 1 }, 12);
play.idle(4);

const end = play.state();
if (end.area !== "bay" || end.coins <= coinsBefore || end.caughtFish === undefined)
  throw new Error("fishing run did not award coins and caughtFish");
console.error(
  `fish: ${end.tick} ticks, ${play.script.length} segments, ` +
    `caught=${JSON.stringify(end.caughtFish)}, coins=${coinsBefore}->${end.coins}`,
);
console.log(JSON.stringify(play.script, null, 2));
