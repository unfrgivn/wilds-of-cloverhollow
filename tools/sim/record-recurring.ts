#!/usr/bin/env bun
// Records recurring critters (Milestone 28): in Meadow Park, Fae calms the
// fizzy pup by the pond (its sticker and 8 coins) and talks with it; it stays
// calm while she's there. She steps out to the plaza and back, and the park
// rolls its critters fresh: a fizzy pup is out by the pond again. Calming it
// pays 8 more coins, but the pups' sticker came the first time.
//
//   bun tools/sim/record-recurring.ts > tests/sim/scripts/park/recurring.json
import { createState } from "../../src/core";
import { loadContent } from "../../src/content/load";
import { createRecorder } from "./recorder";

const { world, fixtures } = loadContent();
const fixture = fixtures.park;
if (fixture === undefined) throw new Error("park fixture missing");
const play = createRecorder(world, createState(world, fixture));
const pup = (): string => {
  const out = play.state().wild.find((critter) => critter.kind === "pup");
  if (out === undefined) throw new Error("no pup out");
  return `critter:wild:${out.den}`;
};

play.meet("pup");
play.battle([]);
play.approach(pup());
play.talk(pup());
// Out to the plaza and straight back (letting go first: while she holds the
// way she came, the back-link rule keeps that door shut).
play.navigate({ x: 300, y: 925 });
play.leave({ x: 0, y: 1 }, "plaza");
play.idle(1);
play.leave({ x: 0, y: 1 }, "park");
if (play.state().wild.find((critter) => critter.kind === "pup")?.mood !== "chaos")
  throw new Error("the park didn't roll a fresh fizzy pup");
play.meet("pup");
play.battle([]);
play.approach(pup());
play.talk(pup());
const end = play.state();
if (end.coins !== 16 || end.stickers.join(",") !== "pond-pup")
  throw new Error(`ended with ${end.coins} coins and stickers ${end.stickers.join(",")}`);
console.error(`recurring: ${end.tick} ticks, ${play.script.length} segments`);
console.log(JSON.stringify(play.script, null, 2));
