#!/usr/bin/env bun
// Records the golden path's bay link (Milestone 68): chapter one and the east
// road (tests/sim/scripts/new-game/east-road.json, ending at the bay's road
// in), then down the dock to Sue, who joins for real this time (sue_joined
// through the story, not a fixture), and the fizzy bluebird calmed with her
// Cast first.
//
//   bun tools/sim/record-golden-bay.ts > tests/sim/scripts/new-game/golden-bay.json
import { readFileSync } from "node:fs";
import { createState } from "../../src/core";
import { loadContent } from "../../src/content/load";
import { parseScript } from "../../src/content/script";
import { createRecorder } from "./recorder";

const { world, fixtures } = loadContent();
const fixture = fixtures["new-game"];
if (fixture === undefined) throw new Error("new-game fixture missing");
const play = createRecorder(world, createState(world, fixture));
const path = "tests/sim/scripts/new-game/east-road.json";
for (const segment of parseScript(JSON.parse(readFileSync(path, "utf8")), path))
  for (let count = 0; count < segment.ticks; count += 1) play.tick(segment.frame);
play.approach("npc:sue");
play.talk("npc:sue", [0]);
if (play.state().wild.some((c) => c.kind === "frog" && c.mood === "chaos" && c.x > 1100 &&
  c.y < 520)) {
  play.meet("frog");
  play.battle(["run"]);
}
play.meet("bluebird");
play.battle(["cast"]);
const end = play.state();
if (end.party.map((member) => member.id).join(",") !== "sue,maddie" ||
  world.storyVariable(end.ink, "sue_joined") !== true ||
  !end.stickers.includes("bay-bluebird"))
  throw new Error("the golden bay run didn't end with Sue joined and a calm bluebird");
console.error(`golden-bay: ${end.tick} ticks, ${play.script.length} segments`);
console.log(JSON.stringify(play.script, null, 2));
