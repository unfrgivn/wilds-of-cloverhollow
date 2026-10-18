#!/usr/bin/env bun
// Records the ending (Milestone 56), on from the kid run, which ends in the
// Enchanted Forest with Milo calm and his story told: Milo's last talk and
// "Watch the tree glow" (the ending: the dream is saved, and Fae wakes in her
// bed), Mom's wake-up, down the stairs to the kitchen, and Milo by the door,
// whose last line opens the credits. The title after the credits is the
// shell's (spec 7.4), so the run ends on the credits.
//
//   bun tools/sim/record-ending.ts > tests/sim/scripts/pass-party/ending.json
import { readFileSync } from "node:fs";
import { createState } from "../../src/core";
import { loadContent } from "../../src/content/load";
import { parseScript } from "../../src/content/script";
import { createRecorder } from "./recorder";

const { world, fixtures } = loadContent();
const fixture = fixtures["pass-party"];
if (fixture === undefined) throw new Error("pass-party fixture missing");
const play = createRecorder(world, createState(world, fixture));
const path = "tests/sim/scripts/pass-party/kid.json";
for (const segment of parseScript(JSON.parse(readFileSync(path, "utf8")), path))
  for (let count = 0; count < segment.ticks; count += 1) play.tick(segment.frame);

play.approach("critter:hooded-kid");
// The talk reads on through the ending into Mom's wake-up, which opens as Fae
// wakes, until no conversation is left open.
play.talk("critter:hooded-kid", [0]);
const woke = play.state();
if (woke.area !== "bedroom" || woke.finale !== "morning" || woke.dialogue !== null)
  throw new Error("the ending didn't wake Fae in her bed");
play.through("kitchen");
play.approach("npc:milo-hoodie");
play.talk("npc:milo-hoodie");
const end = play.state();
if (end.finale !== "credits") throw new Error("Milo's talk didn't open the credits");
console.error(`ending: ${end.tick} ticks, ${play.script.length} segments, in ${end.area}`);
console.log(JSON.stringify(play.script, null, 2));
