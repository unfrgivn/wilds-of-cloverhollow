#!/usr/bin/env bun
// Records Jordan's meeting at Pinecone Pass (Milestone 22): from the bus stop
// with Maddie and Sue, to Jordan by the snowman (he joins), into the fizzy
// hamster in the clearing (Juggle first, then Soothe until it's calm), and a
// talk with the calm hamster, who gets Jordan to hand Fae his blacklight
// lantern.
//
//   bun tools/sim/record-jordan.ts > tests/sim/scripts/pass-party/jordan.json
import { createState } from "../../src/core";
import { loadContent } from "../../src/content/load";
import { createRecorder } from "./recorder";

const { world, fixtures } = loadContent();
const fixture = fixtures["pass-party"];
if (fixture === undefined) throw new Error("pass-party fixture missing");
const play = createRecorder(world, createState(world, fixture));
play.approach("npc:jordan");
play.talk("npc:jordan", [0]);
play.meet("hamster");
const den = play.state().battle?.den;
play.battle(["juggle"]);
play.approach(`critter:wild:${den ?? -1}`);
play.talk(`critter:wild:${den ?? -1}`);
const end = play.state();
if (end.party.map((member) => member.id).join(",") !== "maddie,sue,jordan" ||
  !end.stickers.includes("hiker-hamster") ||
  world.storyVariable(end.ink, "has_lantern") !== true)
  throw new Error("the Jordan run didn't end with Jordan, a calm hamster, and the lantern");
console.error(`jordan: ${end.tick} ticks, ${play.script.length} segments`);
console.log(JSON.stringify(play.script, null, 2));
