#!/usr/bin/env bun
// Records the penguin run (Milestone 69): the golden lodge link (Mrs. Flurry
// calms and her lodge opens, which opens the pass's penguin den), then back
// out to the pass, where a Slippy Penguin has rolled on the snow by the ski
// lift; Fae calms it and talks to it.
//
//   bun tools/sim/record-penguin.ts > tests/sim/scripts/new-game/penguin.json
import { readFileSync } from "node:fs";
import { createState } from "../../src/core";
import { loadContent } from "../../src/content/load";
import { parseScript } from "../../src/content/script";
import { createRecorder } from "./recorder";

const { world, fixtures } = loadContent();
const fixture = fixtures["new-game"];
if (fixture === undefined) throw new Error("new-game fixture missing");
const play = createRecorder(world, createState(world, fixture));
const path = "tests/sim/scripts/new-game/golden-lodge.json";
for (const segment of parseScript(JSON.parse(readFileSync(path, "utf8")), path))
  for (let count = 0; count < segment.ticks; count += 1) play.tick(segment.frame);
if (play.state().area !== "lodge" || play.state().critters["lodge-keeper"] !== "calm")
  throw new Error("the golden lodge run didn't end calm inside the lodge");
play.navigate({ x: 270, y: 540 });
play.leave({ x: -1, y: 0 }, "pass");
const penguin = play.state().wild.find((critter) => critter.kind === "penguin");
if (penguin === undefined) throw new Error("no penguin rolled at the pass");
play.meet("penguin");
play.battle(["juggle"]);
play.approach("critter:wild:2");
play.talk("critter:wild:2");
const end = play.state();
if (!end.stickers.includes("waddle-penguin"))
  throw new Error("the penguin run did not finish");
if (end.wild.find((critter) => critter.kind === "penguin")?.mood !== "calm")
  throw new Error("the penguin is still fizzy");
console.error(`penguin: ${end.tick} ticks, ${play.script.length} segments`);
console.log(JSON.stringify(play.script, null, 2));
