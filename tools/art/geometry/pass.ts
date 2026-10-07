#!/usr/bin/env bun
// Pinecone Pass's floor, blockers, and occluders, from the things standing up
// in its painting. Each thing was outlined on the painting by hand (units; 2 px
// each) with the row its foot stands on. This writes `walkable`, `blockers`,
// and `occluders` into content/areas/pass.json:
//
//   - the floor is the painting's interior (inside its paper margin) less the
//     slope north of the ski lift's line, which is scenery;
//   - a `solid` thing (a building, the benches, a stand of trees) blocks its
//     whole outline: Fae walks around it, never inside it;
//   - any other thing (a sign, a post, the snowman) blocks only its
//     floor-contact strip, its outline's bottom 30 units, so Fae can walk
//     behind it;
//   - every thing's outline is drawn over Fae while her feet are north of its
//     foot (an occluder with that baseline).
//
// tests/unit/pass-paint.test.ts checks the result against the painting itself.
//
//   bun tools/art/geometry/pass.ts && bun tools/art/area-occluders.ts content/areas/pass.json
import { readFileSync, writeFileSync } from "node:fs";

type Point = [number, number];
type Thing = { id: string; foot: number; solid: boolean; outline: Point[] };

const things: Thing[] = [
  { id: "forest-left", foot: 1050, solid: true, outline: [[178, 600], [200, 600], [250, 620],
    [345, 695], [470, 790], [520, 900], [500, 1000], [440, 1050], [178, 1050]] },
  { id: "pines-bus", foot: 1050, solid: true, outline: [[528, 913], [599, 892], [660, 1000],
    [660, 1050], [485, 1050], [485, 1000]] },
  { id: "pines-east", foot: 710, solid: true, outline: [[1430, 505], [1530, 395], [1575, 450],
    [1575, 710], [1365, 710], [1365, 620]] },
  { id: "pines-north", foot: 300, solid: true, outline: [[975, 140], [1320, 140], [1320, 180],
    [1060, 240], [1060, 300], [975, 300]] },
  // The lodge's walls stand on y 470; its porch, in front of them, is floor.
  // The cramped nook east of the porch, between the east wall and the pines,
  // is part of the solid lodge: the wall's one baseline would hide Fae there.
  { id: "lodge", foot: 470, solid: true, outline: [[1050, 240], [1390, 165], [1490, 330],
    [1470, 470], [1060, 470], [1060, 330]] },
  { id: "cocoa-stand", foot: 400, solid: true, outline: [[865, 215], [1060, 230], [1050, 400],
    [870, 400]] },
  { id: "benches", foot: 455, solid: true, outline: [[775, 305], [980, 385], [975, 455],
    [805, 455]] },
  // The shelter is an L: its back wall stands on y 1000, its open front's
  // post on y 950, so it is two things with their own feet.
  { id: "bus-shelter-back", foot: 1003, solid: true, outline: [[770, 860], [850, 800],
    [900, 790], [900, 1003], [780, 1003]] },
  { id: "bus-shelter-front", foot: 955, solid: true, outline: [[900, 790], [950, 775],
    [985, 815], [985, 955], [900, 955]] },
  { id: "trail-sign", foot: 455, solid: false, outline: [[575, 345], [650, 345], [650, 455],
    [575, 455]] },
  { id: "lift-tower-west", foot: 505, solid: false, outline: [[245, 300], [380, 300],
    [380, 390], [340, 390], [340, 505], [295, 505], [295, 390], [245, 390]] },
  { id: "lift-tower-north", foot: 265, solid: false, outline: [[728, 150], [765, 150],
    [765, 265], [728, 265]] },
  { id: "snowman", foot: 690, solid: false, outline: [[1110, 555], [1195, 555], [1195, 690],
    [1110, 690]] },
  { id: "signpost", foot: 800, solid: false, outline: [[1225, 680], [1295, 680], [1295, 800],
    [1225, 800]] },
  { id: "bus-sign", foot: 925, solid: false, outline: [[1000, 770], [1045, 770], [1045, 925],
    [1000, 925]] },
];

// The painting's interior: its outline traced from the paint map (the
// non-paper region, shrunk one cell), simplified to within 6 units. The ski
// lift's line: north-west of it is the slope the chairs ride over.
const interior: Point[] = [[185, 290], [185, 309], [170, 330], [170, 359], [185, 380],
  [175, 415], [185, 499], [175, 505], [180, 554], [170, 570], [165, 625], [175, 655],
  [170, 764], [180, 765], [180, 844], [200, 870], [200, 894], [225, 944], [269, 964],
  [295, 1004], [314, 1004], [325, 1019], [394, 1019], [400, 1029], [439, 1034], [450, 1049],
  [494, 1044], [515, 1059], [574, 1054], [580, 1044], [664, 1049], [705, 1064], [794, 1064],
  [830, 1049], [864, 1049], [905, 1059], [934, 1054], [950, 1069], [1079, 1069], [1105, 1054],
  [1189, 1049], [1220, 1034], [1339, 1029], [1484, 939], [1524, 889], [1514, 795], [1554, 779],
  [1574, 744], [1569, 675], [1579, 669], [1579, 625], [1569, 584], [1569, 490], [1579, 484],
  [1579, 415], [1564, 369], [1564, 315], [1549, 284], [1549, 235], [1534, 210], [1514, 199],
  [1509, 180], [1460, 165], [1454, 150], [1410, 155], [1339, 140], [1210, 150], [1199, 140],
  [1075, 140], [1050, 150], [1020, 140], [934, 155], [810, 155], [799, 145], [710, 150],
  [669, 135], [559, 155], [480, 155], [464, 145], [420, 145], [404, 155], [345, 150],
  [339, 160], [250, 200], [210, 245], [205, 269]];
const liftLine: [Point, Point] = [[178, 560], [880, 160]];
const footStrip = 30;

function area(): Record<string, unknown> {
  const value: unknown = JSON.parse(readFileSync("content/areas/pass.json", "utf8"));
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new Error("content/areas/pass.json isn't an object");
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

const [liftA, liftB] = liftLine;
// Positive north of the lift's line, negative south of it.
const northOfLift = (point: Point): number =>
  (point[0] - liftA[0]) * (liftB[1] - liftA[1]) - (point[1] - liftA[1]) * (liftB[0] - liftA[0]);
const walkable = clip(interior, (point) => -northOfLift(point));

const blockers = things.map((thing) => thing.solid
  ? thing.outline
  : clip(thing.outline, (point) => point[1] - (thing.foot - footStrip)));
const occluders = things.map((thing) => ({
  id: thing.id,
  polygon: thing.outline,
  baseline: thing.foot,
}));

const next = { ...area(), walkable, blockers, occluders };
writeFileSync("content/areas/pass.json", `${JSON.stringify(next, null, 2)}\n`);
console.log(`pass: ${walkable.length} floor points, ${blockers.length} blockers, ` +
  `${occluders.length} occluders`);
