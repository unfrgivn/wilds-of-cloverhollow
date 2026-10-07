import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  distanceToPolygon,
  pointInPolygon,
  type Area,
  type Point,
  type Polygon,
} from "../../src/core";
import { loadContent } from "../../src/content/load";
import paint from "./fixtures/bay-paint.json";

// Contract for Milestone 19: Bubblegum Bay's geometry must follow what its
// painting shows. `fixtures/bay-paint.json` is the painting read by
// tools/art/paint-map.ts in 5x5-unit cells: w water (the sea and its pale
// shallows), s sand, o anything painted (plants, rocks, wood, props, ink), and
// m mixed (an edge). Rerun the tool if the painting changes.

const world = loadContent().world;
const radius = world.tunables.playerRadius;
const range = world.tunables.interact.range;
const cell = paint.cellUnits;
const rows = paint.rows;
const columns = rows[0]?.length ?? 0;

function bayArea(): Area {
  const area = world.areas["bay"];
  if (area === undefined) throw new Error("area bay missing");
  return area;
}
const bay = bayArea();

function classAt(i: number, j: number): string {
  return rows[j]?.[i] ?? "?";
}
function centre(i: number, j: number): Point {
  return { x: (i + 0.5) * cell, y: (j + 0.5) * cell };
}
// A cell whose whole 3x3 neighbourhood shows `kind`: clearly that, not an edge.
function open(i: number, j: number, kind: string): boolean {
  for (let dy = -1; dy <= 1; dy += 1)
    for (let dx = -1; dx <= 1; dx += 1) if (classAt(i + dx, j + dy) !== kind) return false;
  return true;
}
function painted(i: number, j: number): boolean {
  const kind = classAt(i, j);
  return kind === "o" || kind === "m";
}
function cellsIn(polygon: Polygon): [number, number][] {
  const found: [number, number][] = [];
  for (let j = 0; j < rows.length; j += 1)
    for (let i = 0; i < columns; i += 1)
      if (pointInPolygon(centre(i, j), polygon)) found.push([i, j]);
  return found;
}
function bounds(points: Point[]): string {
  if (points.length === 0) return "none";
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return `x ${Math.min(...xs)}-${Math.max(...xs)}, y ${Math.min(...ys)}-${Math.max(...ys)}`;
}

// The sea: the largest 4-connected region of water cells (beach balls have
// small blue panels that aren't water).
function seaCells(): Set<number> {
  const label = new Int32Array(columns * rows.length).fill(-1);
  let best = -1;
  let bestSize = 0;
  let next = 0;
  for (let j = 0; j < rows.length; j += 1)
    for (let i = 0; i < columns; i += 1) {
      if (classAt(i, j) !== "w" || (label[j * columns + i] ?? -1) !== -1) continue;
      const queue = [j * columns + i];
      label[j * columns + i] = next;
      let size = 0;
      for (let index = queue.pop(); index !== undefined; index = queue.pop()) {
        size += 1;
        const x = index % columns;
        const y = (index - x) / columns;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + (dx ?? 0);
          const ny = y + (dy ?? 0);
          if (nx < 0 || ny < 0 || nx >= columns || ny >= rows.length) continue;
          if (classAt(nx, ny) !== "w" || (label[ny * columns + nx] ?? -1) !== -1) continue;
          label[ny * columns + nx] = next;
          queue.push(ny * columns + nx);
        }
      }
      if (size > bestSize) {
        bestSize = size;
        best = next;
      }
      next += 1;
    }
  const sea = new Set<number>();
  label.forEach((value, index) => {
    if (value === best) sea.add(index);
  });
  return sea;
}

// Where Fae's feet can stand on the floor itself, clear of its edge and of
// blockers by her radius; `people` adds the area's people (Sue on the dock).
function standable(point: Point, people = true): boolean {
  if (!pointInPolygon(point, bay.walkable)) return false;
  if (distanceToPolygon(point, bay.walkable) < radius) return false;
  const solid = [...bay.blockers, ...(people ? bay.npcs.map((npc) => npc.footprint) : [])];
  return solid.every(
    (polygon) => !pointInPolygon(point, polygon) && distanceToPolygon(point, polygon) >= radius,
  );
}

// The dock's planks, read off the painting: the north and south plank edges
// run from the sand foot (s = 0) to the far end (s = 1); u goes across the
// planks from the north edge (0) to the south edge (1).
function dock(s: number, u: number): Point {
  const north = { x: 815 + s * 580, y: 520 - s * 375 };
  const south = { x: 1000 + s * 585, y: 640 - s * 375 };
  return {
    x: Math.round(north.x + u * (south.x - north.x)),
    y: Math.round(north.y + u * (south.y - north.y)),
  };
}

describe("Bubblegum Bay follows its painting", () => {
  it("reads the paint map of this painting", () => {
    expect(paint.area).toBe("bay");
    expect(columns * cell).toBe(bay.width);
    expect(rows.length * cell).toBe(bay.height);
  });

  it("never lets Fae onto the sea", () => {
    const sea = seaCells();
    const wet: Point[] = [];
    for (let j = 0; j < rows.length; j += 1)
      for (let i = 0; i < columns; i += 1)
        if (open(i, j, "w") && sea.has(j * columns + i)) {
          if (pointInPolygon(centre(i, j), bay.walkable)) wet.push(centre(i, j));
        }
    expect(wet.length, `open water inside the floor: ${bounds(wet)}`).toBe(0);
  });

  it("lets Fae onto the open sand, and keeps blockers off it", () => {
    let total = 0;
    const offFloor: Point[] = [];
    const underBlockers: Point[] = [];
    for (let j = 0; j < rows.length; j += 1)
      for (let i = 0; i < columns; i += 1) {
        if (!open(i, j, "s")) continue;
        total += 1;
        const point = centre(i, j);
        if (!pointInPolygon(point, bay.walkable)) offFloor.push(point);
        else if (bay.blockers.some((blocker) => pointInPolygon(point, blocker)))
          underBlockers.push(point);
      }
    expect(total).toBeGreaterThan(20000);
    expect(offFloor.length / total, `open sand off the floor: ${bounds(offFloor)}`)
      .toBeLessThanOrEqual(0.02);
    expect(underBlockers.length / total, `open sand under blockers: ${bounds(underBlockers)}`)
      .toBeLessThanOrEqual(0.025);
  });

  it("puts every blocker on something painted", () => {
    for (const [index, blocker] of bay.blockers.entries()) {
      const inside = cellsIn(blocker);
      const things = inside.filter(([i, j]) => painted(i, j)).length;
      expect(inside.length, `blocker ${index} is smaller than a cell`).toBeGreaterThan(0);
      expect(things / inside.length, `blocker ${index} stands on bare sand`)
        .toBeGreaterThanOrEqual(0.25);
    }
  });

  it("cuts every occluder from something painted, with its baseline at its foot", () => {
    for (const occluder of bay.occluders) {
      const inside = cellsIn(occluder.polygon);
      const things = inside.filter(([i, j]) => painted(i, j)).length;
      expect(things / Math.max(inside.length, 1), `${occluder.id} covers no painted thing`)
        .toBeGreaterThanOrEqual(0.5);
      const ys = occluder.polygon.map(([, y]) => y);
      expect(occluder.baseline, `${occluder.id} baseline`).toBeGreaterThanOrEqual(Math.min(...ys));
      expect(occluder.baseline, `${occluder.id} baseline`)
        .toBeLessThanOrEqual(Math.max(...ys) + 15);
    }
  });

  it("walks the whole dock, rail to rail, to its far end", () => {
    for (let s = 0.06; s <= 0.95; s += 0.08)
      expect(standable(dock(s, 0.5), false), `dock centre at s ${s.toFixed(2)}`).toBe(true);
    for (let s = 0.1; s <= 0.91; s += 0.1)
      for (const u of [0.25, 0.75])
        expect(pointInPolygon(dock(s, u), bay.walkable), `dock s ${s.toFixed(1)} u ${u}`)
          .toBe(true);
    // Nearer the foot, beach lies beside the dock (sand at s 0.3 north of it).
    for (let s = 0.4; s <= 0.91; s += 0.1)
      for (const u of [-0.15, 1.15])
        expect(pointInPolygon(dock(s, u), bay.walkable), `water beside the dock s ${s.toFixed(1)}`)
          .toBe(false);
  });

  it("has two ways in: from the plaza and from the Cliffside Trail", () => {
    expect(Object.keys(bay.spawns)).toEqual(["plaza-road", "trail"]);
  });

  it("lets Fae reach the whole beach, the dock's end, Sue, the bluebird, and every sign", () => {
    const spawn = bay.spawns["plaza-road"];
    if (spawn === undefined) throw new Error("no plaza-road spawn");
    const step = 10;
    const width = Math.floor(bay.width / step);
    const height = Math.floor(bay.height / step);
    const grid = (i: number, j: number): Point => ({ x: i * step + 7.5, y: j * step + 7.5 });
    const free = Array.from({ length: width * height }, (_, index) =>
      standable(grid(index % width, Math.floor(index / width))));
    const start = Math.round((spawn.y - 7.5) / step) * width + Math.round((spawn.x - 7.5) / step);
    expect(free[start], "the spawn is standable").toBe(true);
    const reached = new Set([start]);
    const queue = [start];
    for (let index = queue.pop(); index !== undefined; index = queue.pop()) {
      const i = index % width;
      const j = Math.floor(index / width);
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ni = i + (di ?? 0);
        const nj = j + (dj ?? 0);
        const next = nj * width + ni;
        if (ni < 0 || nj < 0 || ni >= width || nj >= height) continue;
        if (!free[next] || reached.has(next)) continue;
        reached.add(next);
        queue.push(next);
      }
    }
    const reachable = (point: Point, within: number): boolean =>
      [...reached].some((index) => {
        const at = grid(index % width, Math.floor(index / width));
        return Math.hypot(at.x - point.x, at.y - point.y) <= within;
      });

    let sand = 0;
    const stranded: Point[] = [];
    for (let j = 0; j < height; j += 1)
      for (let i = 0; i < width; i += 1) {
        const point = grid(i, j);
        const sandy = open(Math.floor(point.x / cell), Math.floor(point.y / cell), "s");
        if (!free[j * width + i] || !sandy) continue;
        sand += 1;
        if (!reached.has(j * width + i)) stranded.push(point);
      }
    expect(stranded.length / sand, `sand Fae can't get to: ${bounds(stranded)}`)
      .toBeLessThanOrEqual(0.03);
    expect(reachable(dock(0.94, 0.5), step), "the dock's far end").toBe(true);
    for (const npc of bay.npcs)
      expect(reachable(npc.point, range - 5), `close enough to talk to ${npc.id}`).toBe(true);
    for (const item of bay.interactables)
      expect(reachable(item.point, range - 5), `close enough to look at ${item.id}`).toBe(true);
    for (const critter of bay.critters)
      expect(reachable(critter.point, 15), `the ${critter.id}'s spot`).toBe(true);
  });
});

describe("area people", () => {
  it("time exactly the idle frames their atlas has", () => {
    for (const [id, character] of Object.entries(world.characters)) {
      const atlas: unknown = JSON.parse(readFileSync(`public/${character.atlas}`, "utf8"));
      const frames = typeof atlas === "object" && atlas !== null && "animations" in atlas &&
        typeof atlas.animations === "object" && atlas.animations !== null &&
        "idle_down" in atlas.animations && Array.isArray(atlas.animations.idle_down)
        ? atlas.animations.idle_down.length
        : 0;
      expect(character.idleTicks.length, `${id}: idleTicks per idle_down frame`).toBe(frames);
    }
  });
});
