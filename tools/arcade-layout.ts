#!/usr/bin/env bun
// Prints an arcade game's close-up layout (spec 8.2) for a gallery state at a
// scale, as JSON, for the e2e tests: Node can't load the content's JSON
// modules, so they ask Bun, like the state hashes (tools/sim/run.ts).
//
//   bun tools/arcade-layout.ts claw arcade-ready 0.26
//   bun tools/arcade-layout.ts skee skee-fifty 0.3
//   bun tools/arcade-layout.ts mole mole-up 0.3
import { readFileSync } from "node:fs";
import {
  loadContent, parseClawCalibration, parseMoleCalibration, parseSkeeCalibration,
} from "../src/content/load";
import { clawGalleryView } from "../src/dev/claw-gallery";
import { moleGalleryView } from "../src/dev/mole-gallery";
import { skeeGalleryView } from "../src/dev/skee-gallery";
import { layoutClaw } from "../src/ui/claw-layout";
import { layoutMole } from "../src/ui/mole-layout";
import { layoutSkee } from "../src/ui/skee-layout";

const [game, state, scaleText] = process.argv.slice(2);
const scale = Number(scaleText);
if ((game !== "claw" && game !== "skee" && game !== "mole") || state === undefined ||
  !(scale > 0))
  throw new Error("usage: bun tools/arcade-layout.ts <claw|skee|mole> <gallery state> <scale>");
const { world, fixtures } = loadContent();
const fixture = fixtures.arcade;
if (fixture === undefined) throw new Error("missing the arcade fixture");
const json = (file: string): unknown => JSON.parse(readFileSync(file, "utf8"));
if (game === "claw") {
  const view = clawGalleryView(world, fixture, state);
  if (view === null) throw new Error(`no claw machine gallery state ${state}`);
  const file = "public/assets/arcade/claw-machine.json";
  console.log(JSON.stringify(layoutClaw(view, parseClawCalibration(json(file), file), scale)));
} else if (game === "skee") {
  const view = skeeGalleryView(world, fixture, state);
  if (view === null) throw new Error(`no skee-ball gallery state ${state}`);
  const file = "public/assets/arcade/skee-lane.json";
  console.log(JSON.stringify(layoutSkee(view, parseSkeeCalibration(json(file), file), scale)));
} else {
  const view = moleGalleryView(world, fixture, state);
  if (view === null) throw new Error(`no Boop-a-Mole gallery state ${state}`);
  const file = "public/assets/arcade/mole-cabinet.json";
  console.log(JSON.stringify(layoutMole(view, parseMoleCalibration(json(file), file), scale)));
}
