import { describe, expect, it } from "vitest";
import {
  distanceToPolygon,
  propCoversPoint,
  pointInPolygon,
  type Area,
  type Point,
} from "../../src/core";
import { loadContent } from "../../src/content/load";
import paint from "./fixtures/pass-paint.json";

// Contract for Milestone 20: Pinecone Pass's geometry follows its painting.
// `fixtures/pass-paint.json` is the painting read by tools/art/paint-map.ts
// (snow palette) in 5x5-unit cells: p the paper margin, s snow or a packed-
// snow path (lit or in shade), o anything painted (trees, wood, stone, ink).
// Rerun the tool if the painting changes.
//
// Depth: props now carry the painted object and its front edge. Behind a thing
// (her feet north of its foot), it must be drawn over her; in front of it,
// never. Feet below are read off the painting.

const world = loadContent().world;
const radius = world.tunables.playerRadius;
const range = world.tunables.interact.range;
const cell = paint.cellUnits;
const rows = paint.rows;
const columns = rows[0]?.length ?? 0;

function passArea(): Area {
  const area = world.areas["pass"];
  if (area === undefined) throw new Error("area pass missing");
  return area;
}
const pass = passArea();
const at = (i: number, j: number): string => rows[j]?.[i] ?? "p";
const centre = (i: number, j: number): Point => ({ x: (i + 0.5) * cell, y: (j + 0.5) * cell });

function standable(point: Point): boolean {
  if (!pointInPolygon(point, pass.walkable)) return false;
  if (distanceToPolygon(point, pass.walkable) < radius) return false;
  const solid = [...pass.blockers, ...pass.npcs.map((npc) => npc.footprint)];
  return solid.every(
    (polygon) => !pointInPolygon(point, polygon) && distanceToPolygon(point, polygon) >= radius,
  );
}

// The share of Fae's body box (50 x 140 units above her feet, on a 5-unit
// grid) that occluders draw over, as area-checks.ts measures it.
function coverage(feet: Point): number {
  const covering = pass.props.filter((prop) => !prop.canopy &&
    Object.values(prop.states).some((state) => feet.y < Math.max(...state.front.ys)));
  let covered = 0;
  let samples = 0;
  for (let y = feet.y - 140; y <= feet.y; y += 5)
    for (let x = feet.x - 25; x <= feet.x + 25; x += 5) {
      samples += 1;
      if (covering.some((prop) => Object.values(prop.states).some((state) =>
        propCoversPoint(state, feet, { x, y })))) covered += 1;
    }
  return covered / samples;
}

// Points Fae can reach from her arrival, on a 10-unit grid.
function reachable(): Point[] {
  const spawn = pass.spawns["bus"];
  if (spawn === undefined) throw new Error("no bus spawn");
  const step = 10;
  const width = Math.floor(pass.width / step);
  const height = Math.floor(pass.height / step);
  const grid = (i: number, j: number): Point => ({ x: i * step + 5, y: j * step + 5 });
  const start = Math.round((spawn.y - 5) / step) * width + Math.round((spawn.x - 5) / step);
  const free = (index: number): boolean =>
    standable(grid(index % width, Math.floor(index / width)));
  if (!free(start)) throw new Error("the spawn isn't standable");
  const seen = new Set([start]);
  const queue = [start];
  for (let index = queue.pop(); index !== undefined; index = queue.pop()) {
    const i = index % width;
    const j = Math.floor(index / width);
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ni = i + (di ?? 0);
      const nj = j + (dj ?? 0);
      const neighbour = nj * width + ni;
      if (ni < 0 || nj < 0 || ni >= width || nj >= height || seen.has(neighbour)) continue;
      if (!free(neighbour)) continue;
      seen.add(neighbour);
      queue.push(neighbour);
    }
  }
  return [...seen].map((index) => grid(index % width, Math.floor(index / width)));
}
const spots = reachable();
const near = (point: Point, within: number): boolean =>
  spots.some((spot) => Math.hypot(spot.x - point.x, spot.y - point.y) <= within);

describe("Pinecone Pass follows its painting", () => {
  it("reads the paint map of this painting", () => {
    expect(paint.area).toBe("pass");
    expect(columns * cell).toBe(pass.width);
    expect(rows.length * cell).toBe(pass.height);
    expect({ id: pass.id, name: pass.name, ground: pass.ground })
      .toEqual({ id: "pass", name: "Pinecone Pass", ground: "pass" });
  });

  it("never puts the floor on the paper margin", () => {
    const paper: Point[] = [];
    for (let j = 0; j < rows.length; j += 1)
      for (let i = 0; i < columns; i += 1)
        if (at(i, j) === "p" && pointInPolygon(centre(i, j), pass.walkable))
          paper.push(centre(i, j));
    expect(paper.length, `paper inside the floor near ${JSON.stringify(paper[0])}`).toBe(0);
  });

  it("lets Fae cross the whole clearing", () => {
    let open = 0;
    let missed = 0;
    for (let y = 560; y <= 760; y += 10)
      for (let x = 450; x <= 900; x += 10) {
        open += 1;
        if (!near({ x, y }, 8)) missed += 1;
      }
    expect(missed / open).toBeLessThanOrEqual(0.02);
  });

  const places: [string, Point][] = [
    ["the bus stop's sign", { x: 1017, y: 930 }],
    ["the lodge's door", { x: 1205, y: 560 }],
    ["the hot chocolate stand", { x: 930, y: 455 }],
    ["the snowman", { x: 1150, y: 690 }],
    ["the trail sign", { x: 615, y: 455 }],
  ];
  for (const [what, point] of places)
    it(`lets Fae walk up to ${what}`, () => {
      expect(near(point, range - 5)).toBe(true);
    });

  it("puts every blocker on something painted", () => {
    for (const [index, blocker] of pass.blockers.entries()) {
      let cells = 0;
      let things = 0;
      for (let j = 0; j < rows.length; j += 1)
        for (let i = 0; i < columns; i += 1) {
          if (!pointInPolygon(centre(i, j), blocker)) continue;
          cells += 1;
          if (at(i, j) === "o") things += 1;
        }
      expect(cells, `blocker ${index} is smaller than a cell`).toBeGreaterThan(0);
      expect(things / cells, `blocker ${index} stands on bare snow`).toBeGreaterThanOrEqual(0.25);
    }
  });

  it("cuts every occluder from something painted", () => {
    for (const occluder of pass.occluders) {
      let cells = 0;
      let things = 0;
      for (let j = 0; j < rows.length; j += 1)
        for (let i = 0; i < columns; i += 1) {
          if (!pointInPolygon(centre(i, j), occluder.polygon)) continue;
          cells += 1;
          if (at(i, j) === "o") things += 1;
        }
      expect(things / Math.max(cells, 1), `${occluder.id} is mostly bare snow`)
        .toBeGreaterThanOrEqual(0.4);
    }
  });

  // Things Fae can walk behind: [name, a spot just behind it, its foot row].
  const behind: [string, Point][] = [
    ["the trail sign", { x: 612, y: 400 }],
    ["the snowman", { x: 1152, y: 638 }],
    ["the signpost", { x: 1258, y: 745 }],
    ["the bus stop's sign", { x: 1022, y: 868 }],
  ];
  for (const [what, spot] of behind)
    it(`draws ${what} over Fae behind it`, () => {
      expect(standable(spot), `${what}: (${spot.x}, ${spot.y}) is standable`).toBe(true);
      expect(coverage(spot), what).toBeGreaterThanOrEqual(0.08);
    });

  // Spots in front of everything: nothing is drawn over her there.
  const front: [string, Point][] = [
    ["off the bus, on the stop's cobbles", { x: 930, y: 1015 }],
    ["on the lodge's porch, at its door", { x: 1205, y: 540 }],
    ["in front of the snowman", { x: 1152, y: 720 }],
    ["in front of the trail sign", { x: 612, y: 485 }],
    ["in the middle of the clearing", { x: 700, y: 650 }],
  ];
  for (const [where, spot] of front)
    it(`never draws anything over Fae ${where}`, () => {
      expect(standable(spot), `(${spot.x}, ${spot.y}) is standable`).toBe(true);
      expect(coverage(spot), where).toBe(0);
    });
});
