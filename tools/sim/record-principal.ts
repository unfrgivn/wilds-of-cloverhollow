#!/usr/bin/env bun
// Records the principal run (Milestone 69): the golden school link ends in
// the east hall; back in the main hall, a stray megaphone by the south
// lockers brings Mr. Bell out, fizzy and announcing everything at once. Fae
// calms him, talks to him, and the journal notes it.
//
//   bun tools/sim/record-principal.ts > tests/sim/scripts/new-game/principal.json
import { readFileSync } from "node:fs";
import { journalNotes, createState } from "../../src/core";
import { loadContent } from "../../src/content/load";
import { parseScript } from "../../src/content/script";
import { createRecorder } from "./recorder";

const { world, fixtures } = loadContent();
const fixture = fixtures["new-game"];
if (fixture === undefined) throw new Error("new-game fixture missing");
const play = createRecorder(world, createState(world, fixture));
const path = "tests/sim/scripts/new-game/golden-school.json";
for (const segment of parseScript(JSON.parse(readFileSync(path, "utf8")), path))
  for (let count = 0; count < segment.ticks; count += 1) play.tick(segment.frame);
if (play.state().area !== "east-hall")
  throw new Error("the golden school run didn't end in the east hall");
play.navigate({ x: 150, y: 620 });
play.leave({ x: -1, y: 0 }, "school");
play.approach("megaphone");
play.talk("megaphone");
if (world.storyVariable(play.state().ink, "principal_out") !== true)
  throw new Error("the megaphone didn't bring Mr. Bell out");
play.meet("principal");
play.battle(["juggle"]);
play.approach("critter:principal");
play.talk("critter:principal");
const end = play.state();
if (end.critters.principal !== "calm" || !end.stickers.includes("principal"))
  throw new Error("the principal run did not finish");
if (!journalNotes(world, end).includes(
  "I calmed Mr. Bell, the principal! Morning announcements sound like morning again."))
  throw new Error("the journal didn't note Mr. Bell");
console.error(`principal: ${end.tick} ticks, ${play.script.length} segments`);
console.log(JSON.stringify(play.script, null, 2));
