#!/usr/bin/env bun
// Records the golden path's Jordan link (Milestone 68): the bay link
// (tests/sim/scripts/new-game/golden-bay.json, Sue joined for real and the
// bluebird calm), then back along the bay road, across the plaza (its critters
// calmed first), the bus up to Pinecone Pass (the first ride, rode_bus),
// Jordan by the snowman (he joins), the fizzy hamster calmed with his Juggle
// first, and the calm hamster's talk that hands Fae the blacklight lantern.
//
//   bun tools/sim/record-golden-jordan.ts > tests/sim/scripts/new-game/golden-jordan.json
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
// Up Cliffside Trail from Bubblegum Bay into Pinecone Pass (bluebird_calmed
// opens the cliff path and arriving at the pass unlocks the Star Bus).
play.navigate({ x: 850, y: 1000 });
play.leave({ x: 0, y: 1 }, "trail");
play.navigate({ x: 150, y: 200 });
play.leave({ x: -1, y: 0 }, "pass");
if (play.state().area !== "pass") throw new Error("didn't reach the pass");
play.approach("npc:jordan");
play.talk("npc:jordan", [0]);
play.meet("hamster");
const den = play.state().battle?.den;
play.battle(["juggle"]);
play.approach(`critter:wild:${den ?? -1}`);
play.talk(`critter:wild:${den ?? -1}`);
const end = play.state();
if (end.party.map((member) => member.id).join(",") !== "sue,jordan,maddie" ||
  !end.stickers.includes("hiker-hamster") ||
  world.storyVariable(end.ink, "has_lantern") !== true)
  throw new Error("the golden Jordan run didn't end with Jordan, a calm hamster, and the lantern");
console.error(`golden-jordan: ${end.tick} ticks, ${play.script.length} segments`);
console.log(JSON.stringify(play.script, null, 2));
