#!/usr/bin/env bun
// Records the golden path's mist link (Milestone 68), on from the lasso
// golden run: the field's far bank, down the dirt path, and through the
// lantern's bluebells, the lasso's rope bridge, and the flute's bell-flower
// seal to the warm forest glow.
//
//   bun tools/sim/record-golden-mist.ts > tests/sim/scripts/new-game/golden-mist.json
import { readFileSync } from "node:fs";
import { createState } from "../../src/core";
import { loadContent } from "../../src/content/load";
import { parseScript } from "../../src/content/script";
import { createRecorder } from "./recorder";

const { world, fixtures } = loadContent();
const fixture = fixtures["new-game"];
if (fixture === undefined) throw new Error("new-game fixture missing");
const play = createRecorder(world, createState(world, fixture));
const path = "tests/sim/scripts/new-game/golden-lasso.json";
for (const segment of parseScript(JSON.parse(readFileSync(path, "utf8")), path))
  for (let count = 0; count < segment.ticks; count += 1) play.tick(segment.frame);
const story = (name: string): unknown => world.storyVariable(play.state().ink, name);
const must = (name: string, what: string): void => {
  if (story(name) !== true) throw new Error(what);
};
must("stash_found", "the stash was not found");
must("bridge_down", "the field bridge is not down");
must("has_lantern", "no lantern");
must("has_lasso", "no lasso");
must("has_flute", "no flute");

play.through("school");
play.through("east-hall");
play.through("gym");
play.navigate({ x: 960, y: 490 });
if (play.state().area !== "field") play.through("field");
play.hold({ x: 1, y: 0 }, 240);
play.hold({ x: 0, y: 1 }, 240);
play.hold({ x: 1, y: 0 }, 180);
play.through("mist");
play.lantern();
play.approach("glow:mist-flower-4");
play.talk("glow:mist-flower-4");
play.idle(60);
play.lantern();
play.approach("gully-posts");
play.talk("gully-posts");
play.navigate({ x: 900, y: 580 });
play.approach("seal");
 play.approach("seal");
play.talk("seal", [0, 2, 0, 0]);
play.approach("seal");
play.talk("seal", [0, 1, 3, 0]);
const end = play.state();
if (end.area !== "mist" || story("seal_open") !== true)
  throw new Error("mist run did not open the seal");
console.error(`golden-mist: ${end.tick} ticks, ${play.script.length} segments, in ${end.area}`);
console.log(JSON.stringify(play.script, null, 2));
