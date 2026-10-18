#!/usr/bin/env bun
// The Misty Path floor, outlined by hand on the painting tiles in
// art/source/areas/mist/painting/ (units; 2 px each). Trees, cliffs, stones,
// and the bell arch are outside this outline.
// The narrow detours are the only paths across the mist band and gully.
//
//   bun tools/art/geometry/mist.ts
import { readFileSync, writeFileSync } from "node:fs";
type Point = [number, number];
const floor: Point[] = [
  [0, 440], [36, 440], [150, 430], [160, 380], [250, 355], [360, 350],
  [390, 380], [390, 515], [505, 525], [505, 410], [790, 410], [800, 515],
  [940, 510], [940, 310], [1210, 305], [1215, 440], [1300, 485], [1310, 500],
  [1310, 640], [1315, 640], [1430, 645], [1440, 700], [1430, 800],
  [1400, 850], [1200, 870], [960, 870], [960, 650], [940, 640],
   [800, 645], [785, 710], [515, 710], [505, 645], [390, 625], [390, 700],
  [385, 830], [380, 830], [300, 880], [260, 860], [200, 820], [150, 780],
  [210, 720], [215, 600], [180, 540], [100, 530], [36, 525], [0, 525],
];
const value: unknown = JSON.parse(readFileSync("content/areas/mist.json", "utf8"));
if (typeof value !== "object" || value === null || Array.isArray(value))
  throw new Error("content/areas/mist.json isn't an object");
const output = `${JSON.stringify({ ...value, walkable: floor, blockers: [] }, null, 2)}\n`;
writeFileSync("content/areas/mist.json", output);
console.log(`mist: ${floor.length} floor points, no blockers`);
