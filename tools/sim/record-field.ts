#!/usr/bin/env bun
// Records recess on the playing field (Milestone 39), on from the music run:
// out through the east hall and the gym's back door, the oak squirrel's
// battle and its tale, the swing across the creek on the old oak's branch,
// the hooded kid's stash behind the stump, the lever that lays the old
// footbridge down, and the walk back over it.
//
//   bun tools/sim/record-field.ts > tests/sim/scripts/pass-party/field.json
import { readFileSync } from "node:fs";
import { createState } from "../../src/core";
import { loadContent } from "../../src/content/load";
import { parseScript } from "../../src/content/script";
import { createRecorder } from "./recorder";

const { world, fixtures } = loadContent();
const fixture = fixtures["pass-party"];
if (fixture === undefined) throw new Error("pass-party fixture missing");
const play = createRecorder(world, createState(world, fixture));
const path = "tests/sim/scripts/pass-party/music.json";
for (const segment of parseScript(JSON.parse(readFileSync(path, "utf8")), path))
  for (let count = 0; count < segment.ticks; count += 1) play.tick(segment.frame);
const story = (name: string): unknown => world.storyVariable(play.state().ink, name);
if (story("recess") !== true) throw new Error("the music run didn't end at recess");

// Each door from in front of it: the music room's, the east hall's gym doors,
// and the gym's back door, propped open at recess.
const spawnOf = (area: string, name: string): { x: number; y: number } => {
  const spawn = world.areas[area]?.spawns[name];
  if (spawn === undefined) throw new Error(`no ${area}.${name} spawn`);
  return spawn;
};
play.navigate(spawnOf("music", "door"), 6);
play.through("east-hall");
play.navigate(spawnOf("east-hall", "gym-doors"), 6);
play.through("gym");
play.navigate(spawnOf("gym", "back-door"), 6);
play.through("field");
// The fizzy squirrel on the old oak, calmed; it saw the kid swing across.
play.meet("oak-squirrel");
play.battle([]);
if (play.state().critters["oak-squirrel"] !== "calm") throw new Error("the squirrel isn't calm");
play.approach("critter:oak-squirrel");
play.talk("critter:oak-squirrel");
// The lasso over the oak's branch, and across the creek.
play.approach("oak-branch");
play.talk("oak-branch");
play.idle(60);
const landed = play.state();
if (landed.area !== "field" || landed.player.x < 1250)
  throw new Error(`the swing didn't cross the creek: ${JSON.stringify(landed.player)}`);
// The stash from below. approach() passes that spot over: it's 19.2 units from
// the floor's edge, under the collider's 20, so Fae stops against the edge,
// still within reach.
play.navigate({ x: 1455, y: 520 }, 6);
play.face("up");
play.talk("stash");
play.approach("lever");
play.talk("lever");
if (story("bridge_down") !== true) throw new Error("the footbridge never came down");
// Back over the footbridge to the stones on the near bank.
play.navigate({ x: 950, y: 790 });
const end = play.state();
console.error(`field: ${end.tick} ticks, ${play.script.length} segments, ends at ` +
  `(${Math.round(end.player.x)}, ${Math.round(end.player.y)})`);
console.log(JSON.stringify(play.script, null, 2));
