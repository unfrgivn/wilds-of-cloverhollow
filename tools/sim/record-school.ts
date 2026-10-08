#!/usr/bin/env bun
// Records story time, the school chapter's start (Milestone 30): the arcade
// run (tests/sim/scripts/pass-party/arcade.json, ending with Mr. Pip calm),
// then out of the arcade, across the plaza to school, Ms. Maple (story time:
// she goes into her classroom), through the classroom door, Rosie (a purple
// hood peeked in the door), Milo, the art wall, and Ms. Maple's story, then
// back out to the hall, where the kid in the purple hood is glimpsed running
// off toward the gym, and on into the gym doors, locked during story time.
//
//   bun tools/sim/record-school.ts > tests/sim/scripts/pass-party/school.json
import { readFileSync } from "node:fs";
import { createState } from "../../src/core";
import { loadContent } from "../../src/content/load";
import { parseScript } from "../../src/content/script";
import { createRecorder } from "./recorder";

const { world, fixtures } = loadContent();
const fixture = fixtures["pass-party"];
if (fixture === undefined) throw new Error("pass-party fixture missing");
const play = createRecorder(world, createState(world, fixture));
const path = "tests/sim/scripts/pass-party/arcade.json";
for (const segment of parseScript(JSON.parse(readFileSync(path, "utf8")), path))
  for (let count = 0; count < segment.ticks; count += 1) play.tick(segment.frame);
if (play.state().critters["arcade-keeper"] !== "calm") throw new Error("Mr. Pip isn't calm");

// Out of the arcade, back across the plaza to the school path.
play.navigate({ x: 230, y: 470 });
play.through("plaza");
play.navigate({ x: 290, y: 965 });
play.leave({ x: 0, y: 1 }, "school");
// Ms. Maple: story time. She goes in, and the classroom door opens.
play.approach("npc:teacher");
play.talk("npc:teacher");
if (world.storyVariable(play.state().ink, "story_time") !== true)
  throw new Error("story time didn't start");
const spawn = world.areas.school?.spawns["classroom-door"];
if (spawn === undefined) throw new Error("no classroom-door spawn");
play.navigate(spawn, 6);
play.through("classroom");
// The classroom: Rosie first (she saw the hood), then Milo, the art wall,
// and Ms. Maple's story.
play.approach("npc:rosie");
play.talk("npc:rosie");
play.approach("npc:milo");
play.talk("npc:milo");
play.approach("art-wall");
play.talk("art-wall");
play.approach("npc:teacher");
play.talk("npc:teacher");
// Back out to the hall, after the kid in the purple hood.
const inside = world.areas.classroom?.spawns["door"];
if (inside === undefined) throw new Error("no classroom door spawn");
play.navigate(inside, 6);
play.through("school");
// From the kid's left, so they're both in view (the kid runs off to the right).
play.approach("npc:hooded-kid", "left");
play.talk("npc:hooded-kid");
play.knock({ x: 1, y: 0 }, "gym_hall");
const end = play.state();
if (world.storyVariable(end.ink, "saw_hood") !== true) throw new Error("no glimpse of the hood");
console.error(`school: ${end.tick} ticks, ${play.script.length} segments`);
console.log(JSON.stringify(play.script, null, 2));
