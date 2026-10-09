#!/usr/bin/env bun
// Records the music room and flute: Coach Ash's thanks, the east hall, Ms.
// Willow, the music bird, the class song, and Fae's first flute.
//
//   bun tools/sim/record-music.ts > tests/sim/scripts/pass-party/music.json
import { readFileSync } from "node:fs";
import { createState } from "../../src/core";
import { loadContent } from "../../src/content/load";
import { parseScript } from "../../src/content/script";
import { createRecorder } from "./recorder";

const { world, fixtures } = loadContent();
const fixture = fixtures["pass-party"];
if (fixture === undefined) throw new Error("pass-party fixture missing");
const play = createRecorder(world, createState(world, fixture));
const path = "tests/sim/scripts/pass-party/gym.json";
for (const segment of parseScript(JSON.parse(readFileSync(path, "utf8")), path))
  for (let count = 0; count < segment.ticks; count += 1) play.tick(segment.frame);
const story = (name: string): unknown => world.storyVariable(play.state().ink, name);
if (story("coach_thanked") !== true || story("music_time") !== true)
  throw new Error("Coach Ash's thanks did not start music time");

const gymDoor = world.areas.gym?.spawns["door"];
if (gymDoor === undefined) throw new Error("no gym door spawn");
play.navigate(gymDoor, 6);
play.through("east-hall");
play.through("music");
play.approach("npc:music-teacher");
play.talk("npc:music-teacher", [0]);
play.meet("music-bird");
play.battle([]);
if (play.state().critters["music-bird"] !== "calm")
  throw new Error("the music bird isn't calm");
play.approach("critter:music-bird");
play.talk("critter:music-bird");
play.approach("xylophone");
play.talk("xylophone", [0, 1, 3, 0]);
const end = play.state();
if (story("has_flute") !== true) throw new Error("Fae never got the flute");
console.error(`music: ${end.tick} ticks, ${play.script.length} segments`);
console.log(JSON.stringify(play.script, null, 2));
