#!/usr/bin/env bun
// Records the Cliffside Trail from the top (Milestone 21): from Pinecone Pass's
// bus stop along the east path onto the trail, where Fae calms the critter
// out in the upper meadow and runs from the one in the lower meadow (which
// then leaves her alone), down to the beach, and into Bubblegum Bay, where
// the cliff path back up stays closed (no bus ride yet).
//
//   bun tools/sim/record-trail.ts > tests/sim/scripts/pass/trail.json
import { createState } from "../../src/core";
import { loadContent } from "../../src/content/load";
import { createRecorder } from "./recorder";

const { world, fixtures } = loadContent();
const fixture = fixtures.pass;
if (fixture === undefined) throw new Error("pass fixture missing");
const play = createRecorder(world, createState(world, fixture));
const down = { x: 0, y: 1 };
const kindAt = (den: number): string => {
  const kind = play.state().wild.find((critter) => critter.den === den)?.kind;
  if (kind === undefined) throw new Error(`nothing out at den ${den}`);
  return kind;
};
play.navigate({ x: 1440, y: 840 });
play.leave({ x: 1, y: 0 }, "trail");
const upper = kindAt(0);
const lower = kindAt(1);
play.meet(upper);
play.battle([]);
play.meet(lower);
play.battle(["run"]);
// It leaves her alone while it cools down; she heads down to the beach.
play.navigate({ x: 1300, y: 1040 });
play.leave(down, "bay");
// Let go (the way back opens again), then walk down into the cliff path.
play.idle(1);
for (let count = 0; count < 80 && play.state().dialogue === null; count += 1) play.hold(down, 1);
const end = play.state();
if (end.dialogue?.knot !== "bay_cliff_path") throw new Error("the cliff path didn't speak");
console.error(`trail: ${end.tick} ticks, ${play.script.length} segments; calmed a ${upper}, ` +
  `ran from a ${lower}`);
console.log(JSON.stringify(play.script, null, 2));
