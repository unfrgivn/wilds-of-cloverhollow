#!/usr/bin/env bun
// Records the arcade's new rocket cabinet (Milestone 58): from the arcade
// fixture, Fae looks at it while Mr. Pip's spell still fizzes on it, calms
// Mr. Pip, then looks again.
//
//   bun tools/sim/record-rocket.ts > tests/sim/scripts/arcade/rocket.json
import { createState } from "../../src/core";
import { loadContent } from "../../src/content/load";
import { createRecorder } from "./recorder";

const { world, fixtures } = loadContent();
const fixture = fixtures.arcade;
if (fixture === undefined) throw new Error("arcade fixture missing");
const play = createRecorder(world, createState(world, fixture));
// Ticks spent reading a line before pressing on.
const reading = 30;

// Looks at the cabinet: press, let the line type out, read it, and close it.
const look = (expected: string): void => {
  play.approach("rocket-cabinet", "left");
  play.idle(reading);
  play.press();
  const line = play.state().dialogue;
  if (line?.text !== expected) throw new Error(`"${line?.text}", not "${expected}"`);
  for (let count = 0; count < 300 && (play.state().dialogue?.revealed ?? 0) < expected.length;
    count += 1) play.idle(1);
  play.idle(reading);
  play.press();
  if (play.state().dialogue !== null) throw new Error("the cabinet's line didn't close");
};

look("A purple cabinet with a rocket on its side, all fizzy with purple scribbles.");
play.meet("arcade-keeper");
play.battle(["juggle", "cast"]);
if (play.state().critters["arcade-keeper"] !== "calm") throw new Error("Mr. Pip isn't calm");
look("A purple cabinet with a neon rocket on its side. Stars twinkle across its screen.");

const end = play.state();
if (end.arcade !== null || end.dialogue !== null) throw new Error("the run didn't end free");
console.error(`rocket: ${end.tick} ticks, ${play.script.length} segments`);
console.log(JSON.stringify(play.script, null, 2));
