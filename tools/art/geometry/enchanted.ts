#!/usr/bin/env bun
// The Enchanted Forest floor, traced by hand on its approved painting
// (art/source/areas/enchanted/painting/).
// Units are half the source pixels. The outline follows the path, then the
// open glade, notching around the pond, stones, flowers, and ancient roots.
import { readFileSync, writeFileSync } from "node:fs";
type Point = [number, number];

const floor: Point[] = [
  // Path from the mist and the upper glade, below the bluebells and mushrooms.
  [210, 330], [300, 330], [430, 350], [480, 450], [760, 450], [820, 560],
  // The front edge of the roots, with a notch around the hollow and centre root.
  [900, 620], [1000, 620], [1030, 700], [1080, 720], [1130, 700], [1160, 620],
  [1160, 700], [1200, 730], [1250, 700], [1280, 680], [1420, 700],
  [1400, 700], [1400, 760], [1450, 780],
  // Right clearing and the open battle space in front of the tree.
  [1450, 950], [1400, 950], [1400, 800], [1300, 800], [1300, 850],
  [1250, 850], [1250, 950], [1180, 950], [1180, 850], [900, 850], [850, 950],
  [850, 700], [820, 680],
  // The pond's top and left rim, then the lower-left plants and left stone.
  [400, 680], [400, 950], [330, 900], [220, 850], [200, 760], [240, 700],
  [250, 680], [340, 700], [400, 680], [420, 650], [400, 620], [400, 540], [350, 520], [330, 520],
  [250, 500], [230, 460]
];

const value: unknown = JSON.parse(readFileSync("content/areas/enchanted.json", "utf8"));
if (typeof value !== "object" || value === null || Array.isArray(value))
  throw new Error("content/areas/enchanted.json isn't an object");
writeFileSync("content/areas/enchanted.json", `${JSON.stringify({
  ...value, walkable: floor, blockers: [],
}, null, 2)}\n`);
console.log(`enchanted: ${floor.length} floor points, no blockers`);
