#!/usr/bin/env bun
// Records the hall pass (Milestone 14): from the school fixture, the shut
// front doors on the hall's back-left wall, Nurse Holly's pass for an offer
// of help, then out through the doors to the plaza, and a last look round.
//
//   bun tools/sim/record-hall-pass.ts > tests/sim/scripts/school/hall-pass.json
import { createState } from "../../src/core";
import { loadContent } from "../../src/content/load";
import { createRecorder } from "./recorder";

const { world, fixtures } = loadContent();
const fixture = fixtures.school;
if (fixture === undefined) throw new Error("school fixture missing");
const play = createRecorder(world, createState(world, fixture));

// The front doors stay shut during class.
play.knock({ x: -1, y: 0 }, "school_doors");
// Nurse Holly's hall pass, for an offer of help.
play.approach("npc:nurse");
play.talk("npc:nurse", [1]);
// Out through the front doors.
const doors = world.areas.school?.spawns["front-doors"];
if (doors === undefined) throw new Error("no school front-doors spawn");
play.navigate(doors, 6);
play.through("plaza");
play.idle(40);
const end = play.state();
if (end.area !== "plaza" || world.storyVariable(end.ink, "hall_pass") !== true)
  throw new Error("the hall-pass run didn't take the pass out to the plaza");
console.error(`hall-pass: ${end.tick} ticks, ${play.script.length} segments`);
console.log(JSON.stringify(play.script, null, 2));
