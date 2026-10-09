#!/usr/bin/env bun
// Records the gym and the lasso (Milestone 31): the school run
// (tests/sim/scripts/pass-party/school.json, ending at the gym doors, locked
// during story time), then back into the classroom, where Ms. Maple says it's
// time for PE, and down the hall through the gym doors to Coach Ash. The kid
// in the purple hood knocked over his cart and ran out the back door; a fizzy
// pup has his stopwatch (calmed, it drops it), and his clipboard is hooked on
// the basketball hoop, too high to reach, so he lends Fae his lasso, which
// loops it down. He lets her keep the lasso. Last, the back door.
//
//   bun tools/sim/record-gym.ts > tests/sim/scripts/pass-party/gym.json
import { readFileSync } from "node:fs";
import { createState } from "../../src/core";
import { loadContent } from "../../src/content/load";
import { parseScript } from "../../src/content/script";
import { createRecorder } from "./recorder";

const { world, fixtures } = loadContent();
const fixture = fixtures["pass-party"];
if (fixture === undefined) throw new Error("pass-party fixture missing");
const play = createRecorder(world, createState(world, fixture));
const path = "tests/sim/scripts/pass-party/school.json";
for (const segment of parseScript(JSON.parse(readFileSync(path, "utf8")), path))
  for (let count = 0; count < segment.ticks; count += 1) play.tick(segment.frame);
const story = (name: string): unknown => world.storyVariable(play.state().ink, name);
if (story("saw_hood") !== true || play.state().area !== "east-hall")
  throw new Error("the school run didn't end in the east hall after the hood");

play.through("school");

// Back to the classroom: Ms. Maple ends story time. Time for PE!
const outside = world.areas.school?.spawns["classroom-door"];
if (outside === undefined) throw new Error("no classroom-door spawn");
play.navigate(outside, 6);
play.through("classroom");
play.approach("npc:teacher");
play.talk("npc:teacher");
if (story("pe_time") !== true) throw new Error("PE didn't start");
const inside = world.areas.classroom?.spawns["door"];
if (inside === undefined) throw new Error("no classroom door spawn");
play.navigate(inside, 6);
play.through("school");
play.through("east-hall");
// Down the hall, through the gym doors, now open.
const doors = world.areas["east-hall"]?.spawns["gym-doors"];
if (doors === undefined) throw new Error("no gym-doors spawn");
play.navigate(doors, 6);
play.through("gym");
// Coach Ash: what happened, and who it was (nobody saw).
play.approach("npc:coach");
play.talk("npc:coach", [1]);
if (story("gym_quest") !== true) throw new Error("no hunt for Coach Ash's things");
// The fizzy pup with the stopwatch: Maddie plays, then Soothe.
play.meet("gym-pup");
play.battle(["play"]);
if (play.state().critters["gym-pup"] !== "calm") throw new Error("the gym pup isn't calm");
play.approach("critter:gym-pup");
play.talk("critter:gym-pup");
// The clipboard, up on the hoop; Coach Ash lends the lasso; the lasso gets it.
play.approach("hoop");
play.talk("hoop");
play.approach("npc:coach");
play.talk("npc:coach");
if (story("has_lasso") !== true) throw new Error("no lasso");
play.approach("hoop");
play.talk("hoop");
if (story("found_clipboard") !== true) throw new Error("no clipboard");
play.approach("npc:coach");
play.talk("npc:coach");
// The back door the kid ran out of.
play.approach("back-door");
play.talk("back-door");
const end = play.state();
if (story("coach_thanked") !== true) throw new Error("Coach Ash never got his things");
console.error(`gym: ${end.tick} ticks, ${play.script.length} segments`);
console.log(JSON.stringify(play.script, null, 2));
