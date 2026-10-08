#!/usr/bin/env bun
// Records the arcade (Milestone 29): the woods run
// (tests/sim/scripts/pass-party/woods.json: Jordan, the lantern, the old trail,
// the owl, and the clubhouse, whose note says the arcade is next), then back
// along the old trail to Pinecone Pass, the bus home, the plaza's arcade door
// (open now the clubhouse is claimed), and Mr. Pip, the arcade keeper, under
// the chaos spell: calmed with Soothe and the friends' commands, then a talk.
//
//   bun tools/sim/record-arcade.ts > tests/sim/scripts/pass-party/arcade.json
import { readFileSync } from "node:fs";
import { createState } from "../../src/core";
import { loadContent } from "../../src/content/load";
import { parseScript } from "../../src/content/script";
import { createRecorder } from "./recorder";

const { world, fixtures } = loadContent();
const fixture = fixtures["pass-party"];
if (fixture === undefined) throw new Error("pass-party fixture missing");
const play = createRecorder(world, createState(world, fixture));
const path = "tests/sim/scripts/pass-party/woods.json";
for (const segment of parseScript(JSON.parse(readFileSync(path, "utf8")), path))
  for (let count = 0; count < segment.ticks; count += 1) play.tick(segment.frame);
if (world.storyVariable(play.state().ink, "clubhouse_claimed") !== true)
  throw new Error("the woods run didn't claim the clubhouse");
// The lantern off, back west along the old trail to the pass.
play.lantern();
play.navigate({ x: 170, y: 560 });
play.leave({ x: -1, y: 0 }, "pass");
// The bus home.
play.approach("pass-bus-stop");
play.talk("pass-bus-stop", [0]);
play.idle(60);
if (play.state().area !== "plaza") throw new Error("the bus didn't go home");
// Up to the arcade's door, and in.
play.navigate({ x: 1412, y: 515 });
play.leave({ x: 0, y: -1 }, "arcade");
// Mr. Pip, under the spell: Juggle and Cast first, then Soothe.
play.meet("arcade-keeper");
play.battle(["juggle", "cast"]);
play.approach("critter:arcade-keeper");
play.talk("critter:arcade-keeper");
const end = play.state();
if (end.critters["arcade-keeper"] !== "calm" || !end.stickers.includes("arcade-keeper"))
  throw new Error("Mr. Pip isn't calm");
console.error(`arcade: ${end.tick} ticks, ${play.script.length} segments`);
console.log(JSON.stringify(play.script, null, 2));
