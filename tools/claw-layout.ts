#!/usr/bin/env bun
// Prints the claw machine's layout (spec 8.2) for a gallery state at a scale,
// as JSON, for the e2e tests: Node can't load the content's JSON modules, so
// they ask Bun, like the state hashes (tools/sim/run.ts).
//
//   bun tools/claw-layout.ts arcade-ready 0.26
import { readFileSync } from "node:fs";
import { loadContent, parseClawCalibration } from "../src/content/load";
import { clawGalleryView } from "../src/dev/claw-gallery";
import { layoutClaw } from "../src/ui/claw-layout";

const [state, scaleText] = process.argv.slice(2);
const scale = Number(scaleText);
if (state === undefined || !(scale > 0))
  throw new Error("usage: bun tools/claw-layout.ts <gallery state> <scale>");
const { world, fixtures } = loadContent();
const fixture = fixtures.arcade;
if (fixture === undefined) throw new Error("missing the arcade fixture");
const view = clawGalleryView(world, fixture, state);
if (view === null) throw new Error(`no claw machine gallery state ${state}`);
const file = "public/assets/arcade/claw-machine.json";
const calibration = parseClawCalibration(JSON.parse(readFileSync(file, "utf8")), file);
console.log(JSON.stringify(layoutClaw(view, calibration, scale)));
