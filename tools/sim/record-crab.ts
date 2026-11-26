#!/usr/bin/env bun
// Records the crab run (Milestone 69): the golden bay link (Sue joins, the
// bluebird calms), then the picnic calls Ms. Coral out and Fae calms her
// (which opens the bay's crab den), and re-entering the bay by the plaza
// road rolls a Snappy Crab on the south beach, which Fae calms and talks to.
//
//   bun tools/sim/record-crab.ts > tests/sim/scripts/new-game/crab.json
import { readFileSync } from "node:fs";
import { createState } from "../../src/core";
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
if (play.state().area !== "bay" || !play.state().stickers.includes("bay-bluebird"))
  throw new Error("the golden bay run didn't end calm at the bay");
play.approach("picnic");
play.talk("picnic");
play.meet("lifeguard");
play.battle(["cast", "soothe"]);
play.approach("critter:lifeguard");
play.talk("critter:lifeguard");
if (play.state().critters.lifeguard !== "calm")
  throw new Error("Ms. Coral didn't calm down");
play.navigate({ x: 120, y: 550 });
play.leave({ x: -1, y: 0 }, "plaza");
play.navigate({ x: 1540, y: 555 });
play.leave({ x: 1, y: 0 }, "bay");
const crab = play.state().wild.find((critter) => critter.kind === "crab");
if (crab === undefined) throw new Error("no crab rolled at the bay");
play.meet("crab");
play.battle(["cast"]);
play.approach("critter:wild:2");
play.talk("critter:wild:2");
const end = play.state();
if (end.critters.lifeguard !== "calm" || !end.stickers.includes("sandy-crab"))
  throw new Error("the crab run did not finish");
if (end.wild.find((critter) => critter.kind === "crab")?.mood !== "calm")
  throw new Error("the crab is still fizzy");
console.error(`crab: ${end.tick} ticks, ${play.script.length} segments`);
console.log(JSON.stringify(play.script, null, 2));
