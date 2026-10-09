#!/usr/bin/env bun
// The Cliffside Trail's floor, outlined by hand on its painting (units; 2 px
// each) and written into content/areas/trail.json. It climbs from Bubblegum
// Bay (the beach at the bottom right) to Pinecone Pass (the snowy pines at the
// top left), past two meadows, a signpost, a footbridge over the stream, and a
// lookout bench above the sea.
//
// The floor is the hillside, the meadows, the path, the beach, and the
// lookout, less the sea, the cliffs, the stream (crossed by the bridge), and
// the thick woods at the left and bottom edges. Every standing thing (the
// rocks, the pines, the bench, the signpost, the reeds) is a prop in the
// trail's kit (art/kit/trail.json), solid on its own footprint, so the area
// has no blockers.
//
//   bun tools/art/geometry/trail.ts
import { readFileSync, writeFileSync } from "node:fs";

type Point = [number, number];

// The walkable hillside, clockwise from the snowy path's mouth at the left edge.
const floor: Point[] = [
  // Snowy path out to Pinecone Pass, at the left edge.
  [0, 170], [60, 150], [200, 160], [300, 170], [400, 150], [455, 120],
  // Along the foot of the snowy pines at the top, to the cliff's brow.
  [600, 105], [760, 85], [870, 55], [920, 70], [975, 105],
  // Down the hillside above the sea to the stream's near bank.
  [1040, 140], [1100, 190], [1150, 250], [1185, 320], [1205, 370], [1200, 420],
  [1180, 455], [1176, 500],
  // Onto the bridge's west end and east along its deck's north edge (a few
  // units past the painted planks, under the far rail's rope), north up the
  // upper stream's east bank to the lookout, round the lookout above its
  // cliff, down to the deck's east end, west along the deck's south edge, off
  // its west end, and along the lower stream's south bank to the beach.
  [1182, 540], [1290, 512], [1300, 480], [1320, 445], [1345, 418], [1390, 398],
  [1470, 395], [1560, 400], [1610, 430], [1625, 470], [1600, 525], [1575, 565],
  [1540, 590], [1470, 600], [1400, 585], [1345, 560], [1342, 552], [1248, 603],
  [1215, 606], [1225, 620], [1300, 645], [1400, 668], [1500, 672], [1570, 662],
  // The beach, down to the water's edge, and along it to the bottom edge.
  [1650, 700], [1750, 705], [1750, 935], [1680, 965], [1600, 1000], [1530, 1050],
  [1480, 1100],
  // The bottom edge, west to the ferns and the pines at the bottom left.
  [1000, 1100], [800, 1100], [600, 1065], [450, 1010], [330, 960], [270, 890],
  [230, 800], [160, 715], [100, 640], [40, 600], [0, 590],
  // Up the left edge to the foot of the dense snowy pines, round their front,
  // and back to the edge below the snowy path's mouth.
  [0, 560], [40, 560], [70, 520], [100, 420], [100, 300], [60, 230], [0, 230],
];


const value: unknown = JSON.parse(readFileSync("content/areas/trail.json", "utf8"));
if (typeof value !== "object" || value === null || Array.isArray(value))
  throw new Error("content/areas/trail.json isn't an object");
writeFileSync("content/areas/trail.json",
  `${JSON.stringify({ ...value, walkable: floor, blockers: [] }, null, 2)}\n`);
console.log(`trail: ${floor.length} floor points, no blockers`);
