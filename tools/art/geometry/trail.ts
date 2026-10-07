#!/usr/bin/env bun
// The Cliffside Trail's floor, blockers, and occluders, outlined by hand on
// its painting (units; 2 px each) and written into content/areas/trail.json.
// It climbs from Bubblegum Bay (the beach at the bottom right) to Pinecone
// Pass (the snowy pines at the top left), past two meadows, a signpost, a
// footbridge over the stream, and a lookout bench above the sea.
//
//   - the floor is the hillside, the meadows, the path, the beach, and the
//     lookout, less the sea, the cliffs, the stream (crossed by the bridge),
//     and the thick woods at the left and bottom edges;
//   - a thing blocks its whole outline (a boulder, a stand of trees, the bench),
//     only its bottom 25 units (the signpost: Fae walks behind it), or nothing
//     (the bridge's rail, at the edge of the floor);
//   - every thing is drawn over Fae while her feet are north of its foot.
//
//   bun tools/art/geometry/trail.ts && bun tools/art/area-occluders.ts content/areas/trail.json
import { existsSync, readFileSync, writeFileSync } from "node:fs";

type Point = [number, number];
// How a thing blocks: its whole outline, its foot strip (Fae walks behind it), or
// not at all (a railing at the floor's edge, which the floor already keeps her inside).
type Blocks = "whole" | "foot" | "none";
type Thing = { id: string; foot: number; blocks: Blocks; outline: Point[] };

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
];

const things: Thing[] = [
  { id: "pines-top", foot: 160, blocks: "whole", outline: [[0, 0], [380, 0], [380, 90],
    [300, 130], [190, 140], [60, 120], [0, 100]] },
  { id: "rocks-top", foot: 130, blocks: "whole", outline: [[460, 90], [520, 70], [565, 85],
    [570, 110], [520, 125], [465, 120]] },
  { id: "pines-left", foot: 560, blocks: "whole", outline: [[0, 230], [60, 230], [100, 300],
    [100, 420], [70, 520], [40, 560], [0, 560]] },
  { id: "boulders-left", foot: 575, blocks: "whole", outline: [[230, 515], [310, 480],
    [395, 470], [440, 490], [445, 540], [400, 560], [300, 580], [230, 575]] },
  { id: "rock-meadow-top", foot: 375, blocks: "whole", outline: [[835, 345], [880, 315],
    [925, 320], [935, 350], [900, 370], [845, 375]] },
  { id: "rock-path", foot: 610, blocks: "whole", outline: [[665, 565], [725, 545],
    [785, 560], [805, 600], [760, 612], [685, 612]] },
  { id: "signpost", foot: 548, blocks: "foot", outline: [[890, 450], [975, 450],
    [975, 500], [950, 500], [950, 548], [925, 548], [925, 500], [890, 500]] },
  // The two pines on the hill; the nook between them and the cliff's brow is
  // part of them (their crowns would hide Fae there).
  { id: "pines-hill", foot: 470, blocks: "whole", outline: [[1060, 215], [1110, 200],
    [1185, 275], [1190, 360], [1165, 420], [1165, 470], [1035, 470], [1010, 420],
    [1040, 330]] },
  { id: "bench", foot: 465, blocks: "whole", outline: [[1480, 385], [1520, 380],
    [1580, 410], [1575, 450], [1545, 468], [1480, 435]] },
  { id: "rock-lookout", foot: 412, blocks: "whole", outline: [[1385, 395], [1415, 375],
    [1455, 378], [1465, 405], [1430, 414], [1390, 412]] },
  // The bridge's near (south) rail and posts, in slivers along the deck's south edge,
  // each with the baseline of its west (lower) end, like the bay's dock rail.
  { id: "bridge-rail-1", foot: 599, blocks: "none", outline: [[1238, 565], [1263, 553],
    [1263, 593], [1238, 605]] },
  { id: "bridge-rail-2", foot: 587, blocks: "none", outline: [[1263, 553], [1288, 541],
    [1288, 581], [1263, 593]] },
  { id: "bridge-rail-3", foot: 575, blocks: "none", outline: [[1288, 541], [1313, 528],
    [1313, 568], [1288, 581]] },
  { id: "bridge-rail-4", foot: 562, blocks: "none", outline: [[1313, 528], [1342, 514],
    [1342, 554], [1313, 568]] },
  { id: "rock-ferns", foot: 760, blocks: "whole", outline: [[1060, 690], [1130, 665],
    [1240, 680], [1260, 720], [1230, 755], [1150, 760], [1080, 750]] },
  { id: "grass-beach", foot: 900, blocks: "whole", outline: [[1560, 770], [1620, 760],
    [1700, 780], [1750, 800], [1750, 900], [1650, 910], [1580, 880]] },
  { id: "grass-bottom", foot: 1100, blocks: "whole", outline: [[965, 930], [1020, 920],
    [1100, 935], [1170, 1000], [1160, 1100], [985, 1100], [970, 1030]] },
  { id: "pines-bottom", foot: 1100, blocks: "whole", outline: [[0, 600], [100, 640],
    [190, 750], [250, 830], [330, 940], [450, 1000], [520, 1100], [0, 1100]] },
];

function area(): Record<string, unknown> {
  if (!existsSync("content/areas/trail.json")) return {};
  const value: unknown = JSON.parse(readFileSync("content/areas/trail.json", "utf8"));
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new Error("content/areas/trail.json isn't an object");
  return { ...value };
}

// Clips a polygon to the half-plane where `keep` is at least 0, a linear
// function of the point (Sutherland-Hodgman, one edge).
function clip(polygon: Point[], keep: (point: Point) => number): Point[] {
  const out: Point[] = [];
  polygon.forEach((current, index) => {
    const previous = polygon[(index + polygon.length - 1) % polygon.length] ?? current;
    const a = keep(previous);
    const b = keep(current);
    if ((a >= 0) !== (b >= 0)) {
      const t = a / (a - b);
      out.push([Math.round(previous[0] + t * (current[0] - previous[0])),
        Math.round(previous[1] + t * (current[1] - previous[1]))]);
    }
    if (b >= 0) out.push(current);
  });
  return out;
}

const footStrip = 25;
const blockers = things.flatMap((thing) => thing.blocks === "none" ? []
  : [thing.blocks === "whole"
    ? thing.outline
    : clip(thing.outline, (point) => point[1] - (thing.foot - footStrip))]);
const occluders = things.map((thing) => ({
  id: thing.id,
  polygon: thing.outline,
  baseline: thing.foot,
}));

const next = {
  id: "trail",
  name: "Cliffside Trail",
  width: 1750,
  height: 1100,
  ground: "trail",
  interactables: [],
  critters: [],
  npcs: [],
  triggers: [],
  spawns: {},
  ...area(),
  walkable: floor,
  blockers,
  occluders,
};
writeFileSync("content/areas/trail.json", `${JSON.stringify(next, null, 2)}\n`);
console.log(`trail: ${floor.length} floor points, ${blockers.length} blockers, ` +
  `${occluders.length} occluders`);
