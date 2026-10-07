#!/usr/bin/env bun
// Records Bubblegum Bay (Milestone 19): from the road in, down the dock to
// Sue (she joins), then back onto the sand, where Fae walks into a fizzy
// bluebird and calms it with Sue's Cast first, then Soothe.
//
//   bun tools/sim/record-bay.ts > tests/sim/scripts/bay/bay.json
import { createState } from "../../src/core";
import { loadContent } from "../../src/content/load";
import { createRecorder } from "./recorder";

const { world, fixtures } = loadContent();
const fixture = fixtures.bay;
if (fixture === undefined) throw new Error("bay fixture missing");
const play = createRecorder(world, createState(world, fixture));
play.approach("npc:sue");
play.talk("npc:sue", [0]);
play.meet("bluebird");
play.battle(["cast"]);
const end = play.state();
if (end.party.map((member) => member.id).join(",") !== "maddie,sue" ||
  !end.stickers.includes("bay-bluebird"))
  throw new Error("the bay run didn't end with Sue and a calm bluebird");
console.error(`bay: ${end.tick} ticks, ${play.script.length} segments`);
console.log(JSON.stringify(play.script, null, 2));
