#!/usr/bin/env bun
// Records Chef Mateo's Taco Truck Kitchen run: chains from m81-festival.json
// (right in Clover Hills beside calmed Chef Mateo), talks to Chef Mateo,
// chooses "Help run the Taco Truck kitchen!", plays a spotless 3/3 shift with
// real directional keys, collects +20 coins and +2 snacks, and steps cleanly
// back to Clover Hills.
//
//   bun tools/sim/record-taco.ts > tests/sim/scripts/new-game/taco.json
import { readFileSync } from "node:fs";
import { blankInput, createState, type TacoTopping } from "../../src/core";
import { loadContent } from "../../src/content/load";
import { parseScript } from "../../src/content/script";
import { createRecorder } from "./recorder";

const TOPPING_MOVE: Readonly<Record<TacoTopping, { x: number; y: number }>> = {
  beans: { x: 0, y: -1 },
  cheese: { x: 1, y: 0 },
  salsa: { x: 0, y: 1 },
  avocado: { x: -1, y: 0 },
};

const { world, fixtures } = loadContent();
const fixture = fixtures["new-game"];
if (fixture === undefined) throw new Error("new-game fixture missing");
const play = createRecorder(world, createState(world, fixture));
const basePath = "tests/sim/scripts/new-game/m81-festival.json";
for (const segment of parseScript(JSON.parse(readFileSync(basePath, "utf8")), basePath))
  for (let count = 0; count < segment.ticks; count += 1) play.tick(segment.frame);

const coinsBefore = play.state().coins;
const snacksBefore = play.state().snacks;
if (play.state().area !== "hills") throw new Error("m81-festival didn't end in hills");

// Talk to calmed Chef Mateo and choose choice 1 ("Help run the Taco Truck kitchen!").
play.approach("critter:taco-chef", "left");
play.talk("critter:taco-chef", [1]);
if (play.state().arcade?.game !== "taco")
  throw new Error("Chef Mateo choice 1 did not open the Taco Truck minigame");

// Hold briefly on ready so e2e can capture the ready state, then confirm to start.
play.idle(6);
play.press();
play.idle(4);

// Play all 3 orders cleanly using real directional key presses.
for (let guard = 0; guard < 400; guard += 1) {
  const game = play.state().arcade;
  if (game?.game !== "taco" || game.phase === "result") break;
  if (game.phase === "serving") {
    const next = game.orders[game.orderIndex]?.recipe[game.stepIndex];
    if (next === undefined) throw new Error("missing taco recipe step");
    play.tick({ ...blankInput(), move: TOPPING_MOVE[next] });
    play.idle(6);
  } else {
    play.idle(1);
  }
}

const finished = play.state();
if (
  finished.arcade?.game !== "taco" ||
  finished.arcade.phase !== "result" ||
  finished.arcade.served !== 3 ||
  finished.arcade.mistakes !== 0
) {
  throw new Error("did not complete a spotless 3/3 taco shift");
}

// Reveal full result text, pause briefly for e2e capture, then dismiss back to Clover Hills.
play.idle(1);
play.press();
play.idle(6);
play.press();
if (play.state().arcade !== null) throw new Error("taco truck did not close cleanly");

// Step slightly west in Clover Hills to confirm normal overworld control returned.
play.hold({ x: -1, y: 0 }, 12);
play.idle(4);

const end = play.state();
if (end.area !== "hills" || end.coins !== coinsBefore + 20 || end.snacks !== snacksBefore + 2) {
  throw new Error(
    `taco run payout mismatch: coins=${end.coins - coinsBefore}, ` +
      `snacks=${end.snacks - snacksBefore}`,
  );
}
console.error(
  `taco: ${end.tick} ticks, ${play.script.length} segments, ` +
    `coins=${coinsBefore}->${end.coins}, snacks=${snacksBefore}->${end.snacks}`,
);
console.log(JSON.stringify(play.script, null, 2));
