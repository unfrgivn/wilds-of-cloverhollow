#!/usr/bin/env bun
// Records the lifeguard from the bay fixture: Sue joins, the picnic calls
// Ms. Coral back, she is calmed, and she shares her watermelon.
import { createState } from "../../src/core";
import { loadContent } from "../../src/content/load";
import { createRecorder } from "./recorder";
const { world, fixtures } = loadContent();
const fixture = fixtures.bay;
if (fixture === undefined) throw new Error("bay fixture missing");
const play = createRecorder(world, createState(world, fixture));
play.approach("npc:sue");
play.talk("npc:sue", [0]);
play.approach("picnic");
play.talk("picnic");
play.meet("lifeguard");
play.battle(["cast", "soothe"]);
play.approach("critter:lifeguard");
play.talk("critter:lifeguard");
const end = play.state();
if (end.party.map((member) => member.id).join(",") !== "maddie,sue" ||
  end.critters.lifeguard !== "calm" || !end.stickers.includes("lifeguard"))
  throw new Error("the lifeguard run did not finish");
console.error(`lifeguard: ${end.tick} ticks, ${play.script.length} segments`);
console.log(JSON.stringify(play.script, null, 2));
