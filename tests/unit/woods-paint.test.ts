import { describe, expect, it } from "vitest";
import {
  distanceToPolygon,
  pointInPolygon,
  type Area,
  type Point,
} from "../../src/core";
import { loadContent } from "../../src/content/load";
import paint from "./fixtures/woods-paint.json";

const loaded = loadContent().world.areas.woods;
if (loaded === undefined) throw new Error("woods missing");
const woods: Area = loaded;
const cell = paint.cellUnits;
const centre = (i: number, j: number): Point => ({
  x: (i + 0.5) * cell,
  y: (j + 0.5) * cell,
});
const standable = (point: Point): boolean =>
  pointInPolygon(point, woods.walkable) &&
  distanceToPolygon(point, woods.walkable) >= 20 &&
  woods.blockers.every((blocker) =>
    !pointInPolygon(point, blocker) && distanceToPolygon(point, blocker) >= 20,
  );

function reachable(): Point[] {
  const step = 10;
  const width = 175;
  const height = 110;
  const at = (i: number, j: number): Point => ({
    x: i * step + 5,
    y: j * step + 5,
  });
  const spawn = woods.spawns.east;
  if (spawn === undefined) throw new Error("east spawn missing");
  const start = Math.round((spawn.y - 5) / step) * width +
    Math.round((spawn.x - 5) / step);
  const seen = new Set([start]);
  const queue = [start];
  for (let index = queue.pop(); index !== undefined; index = queue.pop()) {
    const i = index % width;
    const j = Math.floor(index / width);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = i + (dx ?? 0);
      const y = j + (dy ?? 0);
      const next = y * width + x;
      if (x >= 0 && y >= 0 && x < width && y < height && !seen.has(next) &&
        standable(at(x, y))) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return [...seen].map((index) => at(index % width, Math.floor(index / width)));
}

describe("Whispering Woods follows its painting", () => {
  it("uses the 1750x1100 woods map", () => {
    expect(paint.area).toBe("woods");
    expect((paint.rows[0]?.length ?? 0) * cell).toBe(woods.width);
    expect(paint.rows.length * cell).toBe(woods.height);
  });
  it("keeps floor on painted forest and reaches its story points", () => {
    for (let j = 0; j < paint.rows.length; j += 1) {
      const row = paint.rows[j];
      if (row === undefined) continue;
      for (let i = 0; i < row.length; i += 1)
        if (row[i] === "p")
          expect(pointInPolygon(centre(i, j), woods.walkable)).toBe(false);
    }
    const spots = reachable();
    for (const point of [{ x: 875, y: 520 }, { x: 1120, y: 700 }])
      expect(spots.some((spot) => Math.hypot(spot.x - point.x, spot.y - point.y) < 80))
        .toBe(true);
  });
  it("draws standing woodland objects behind Fae only when she is north", () => {
    for (const occluder of woods.occluders) {
      expect(occluder.baseline).toBeGreaterThan(0);
      expect(occluder.polygon.length).toBeGreaterThanOrEqual(4);
    }
  });
});
