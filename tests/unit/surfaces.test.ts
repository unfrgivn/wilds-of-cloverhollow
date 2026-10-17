import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  createState, pointInPolygon, soundCues, step, surfaceAt, type Point, type Polygon,
  type Surface, type SurfaceMap,
} from "../../src/core";
import { parseSurfaceMap } from "../../src/content/surfaces";
import { completeSurfaceMaps, loadContent } from "../../src/content/load";
import { parseScript } from "../../src/content/script";

const content = loadContent();
const { areas, surfaces } = content.world;

function areaOf(id: string): NonNullable<(typeof areas)[string]> {
  const area = areas[id];
  if (area === undefined) throw new Error(`no area ${id}`);
  return area;
}
function mapOf(id: string): SurfaceMap {
  const map = surfaces[id];
  if (map === undefined) throw new Error(`no surface map for ${id}`);
  return map;
}
function spawn(area: string, name: string): Point {
  const point = areaOf(area).spawns[name];
  if (point === undefined) throw new Error(`no spawn ${area}.${name}`);
  return point;
}
function person(area: string, id: string): Point {
  const found = areaOf(area).npcs.find((npc) => npc.id === id);
  if (found === undefined) throw new Error(`no person ${area}.${id}`);
  return found.point;
}
function polygonArea(polygon: Polygon): number {
  let twice = 0;
  polygon.forEach(([x, y], index) => {
    const [nextX, nextY] = polygon[(index + 1) % polygon.length] ?? [x, y];
    twice += x * nextY - nextX * y;
  });
  return Math.abs(twice) / 2;
}

describe("area surface maps", () => {
  // Where the game puts people, against what the paintings show under them
  // (and, where a milestone placed them, what it says).
  const truths: { area: string; what: string; point: Point; surface: Surface }[] = [
    { area: "bay", what: "the plaza road's arrival", point: spawn("bay", "plaza-road"),
      surface: "sand" },
    { area: "bay", what: "the trail's arrival", point: spawn("bay", "trail"), surface: "sand" },
    { area: "bay", what: "Sue at the dock's far end (M19)", point: person("bay", "sue"),
      surface: "wood" },
    { area: "kitchen", what: "baby Oliver on the rug (M12)", point: person("kitchen", "oliver"),
      surface: "carpet" },
    { area: "kitchen", what: "the front door's arrival, on the doormat",
      point: spawn("kitchen", "front-door"), surface: "carpet" },
    { area: "kitchen", what: "Mom by the island", point: person("kitchen", "mom"),
      surface: "wood" },
    { area: "pass", what: "the bus arrival, on the shelter's stone pad",
      point: spawn("pass", "bus"), surface: "stone" },
    { area: "pass", what: "Jordan by the snowman (M22)", point: person("pass", "jordan"),
      surface: "snow" },
    { area: "trail", what: "the snowy path in from the pass (M21)", point: spawn("trail", "pass"),
      surface: "snow" },
    { area: "trail", what: "the beach in from the bay (M21)", point: spawn("trail", "bay"),
      surface: "sand" },
    { area: "park", what: "the path in from the plaza", point: spawn("park", "plaza-path"),
      surface: "sand" },
    { area: "gym", what: "Coach Ash on the court", point: person("gym", "coach"),
      surface: "wood" },
    { area: "plaza", what: "the paved square by the fountain", point: spawn("plaza", "fountain"),
      surface: "stone" },
  ];
  it.each(truths)("$area: $what is $surface", ({ area, point, surface }) => {
    expect(surfaceAt(mapOf(area), point)).toBe(surface);
  });

  it("draws rugs as rugs: each carpet region is a small patch of its room's floor", () => {
    const rugs = Object.values(areas).flatMap((area) => mapOf(area.id).regions
      .filter((region) => region.surface === "carpet")
      .map((region) => ({ area, region })));
    expect(rugs.length).toBeGreaterThan(0);
    for (const { area, region } of rugs) {
      const share = polygonArea(region.polygon) / polygonArea(area.walkable);
      expect(share, `${area.id} rug covers ${(share * 100).toFixed(1)}% of the floor`)
        .toBeLessThan(0.25);
      expect(mapOf(area.id).default, `${area.id}'s floor isn't carpet`).not.toBe("carpet");
    }
  });

  it("lays wood wherever a crossing opens a bridge", () => {
    const crossings = Object.values(areas).flatMap((area) =>
      (area.crossings ?? []).map((crossing) => ({ area, crossing })));
    expect(crossings.length).toBeGreaterThan(0);
    for (const { area, crossing } of crossings) {
      const point = crossing.polygon.reduce(
        (sum, [x, y]) => ({
          x: sum.x + x / crossing.polygon.length,
          y: sum.y + y / crossing.polygon.length,
        }),
        { x: 0, y: 0 },
      );
      expect(pointInPolygon(point, crossing.polygon), `${area.id} test point`).toBe(true);
      expect(surfaceAt(mapOf(area.id), point), `${area.id} ${crossing.id}`).toBe("wood");
    }
  });

  // The paint maps class each 5-unit cell from the painting itself. Both ways
  // must hold: the painted ground is the default, and no region sits on it. A
  // region drawn over the bay's sand path instead of the dock (an early
  // version) had 62.8% painted sand under it.
  it.each([
    { id: "bay", ground: "sand" },
    { id: "pass", ground: "snow" },
  ])("$id: regions sit off the painted $ground, and the default covers it", ({ id, ground }) => {
    const area = areaOf(id);
    const map = mapOf(id);
    expect(map.default).toBe(ground);
    const paint: unknown = JSON.parse(readFileSync(`tests/unit/fixtures/${id}-paint.json`, "utf8"));
    if (typeof paint !== "object" || paint === null || !("rows" in paint) ||
        !("cellUnits" in paint) || !Array.isArray(paint.rows) ||
        typeof paint.cellUnits !== "number")
      throw new Error(`${id} paint map has the wrong shape`);
    const units = paint.cellUnits;
    let painted = 0;
    let onDefault = 0;
    const regions = map.regions.map(() => ({ cells: 0, painted: 0 }));
    paint.rows.forEach((row: unknown, y) => {
      if (typeof row !== "string") throw new Error(`${id} paint row ${y}`);
      [...row].forEach((cell, x) => {
        const point = { x: (x + 0.5) * units, y: (y + 0.5) * units };
        if (!pointInPolygon(point, area.walkable)) return;
        if (cell === "s") {
          painted += 1;
          if (surfaceAt(map, point) === map.default) onDefault += 1;
        }
        const index = map.regions.findIndex((region) => pointInPolygon(point, region.polygon));
        const tally = regions[index];
        if (tally === undefined) return;
        tally.cells += 1;
        if (cell === "s") tally.painted += 1;
      });
    });
    expect(painted).toBeGreaterThan(1000);
    expect(onDefault / painted).toBeGreaterThanOrEqual(0.99);
    map.regions.forEach((region, index) => {
      const tally = regions[index];
      if (tally === undefined) throw new Error(`${id} region ${index}`);
      expect(tally.cells, `${id} region ${index} (${region.surface}) is on the floor`)
        .toBeGreaterThan(0);
      expect(tally.painted / tally.cells, `${id} region ${index} (${region.surface})`)
        .toBeLessThanOrEqual(0.15);
    });
  });

  it("rejects unknown surfaces, malformed polygons, and out-of-bounds polygons", () => {
    expect(() => parseSurfaceMap(
      { default: "mud", precedence: "first", regions: [] }, "test.json", 10, 10,
    )).toThrow("unknown default surface");
    expect(() => parseSurfaceMap(
      { default: "grass", precedence: "first", regions: [
        { surface: "sand", polygon: [[0, 0], [1, 1]] },
      ] }, "test.json", 10, 10,
    )).toThrow("invalid regions.0");
    expect(() => parseSurfaceMap(
      { default: "grass", precedence: "first", regions: [
        { surface: "sand", polygon: [[0, 0], [1, 0], [11, 1]] },
      ] }, "test.json", 10, 10,
    )).toThrow("outside area");
  });

  it("requires every area's map and says where to register it", () => {
    expect(() => completeSurfaceMaps({ bay: areaOf("bay") }, {})).toThrow(
      "content/surfaces/bay.json is missing; it must be registered in src/content/load.ts",
    );
  });

  // The recorded bay run (M19) crosses the beach, walks the dock to Sue, and
  // comes back down to the bluebird on the sand.
  it("steps sand, then wood along the dock, then sand again on the bay run", () => {
    const fixture = content.fixtures.bay;
    if (fixture === undefined) throw new Error("no bay fixture");
    const path = "tests/sim/scripts/bay/bay.json";
    let state = createState(content.world, fixture);
    const walked: { surface: string; steps: number }[] = [];
    for (const segment of parseScript(JSON.parse(readFileSync(path, "utf8")), path)) {
      for (let tick = 0; tick < segment.ticks; tick += 1) {
        const next = step(content.world, state, segment.frame).state;
        for (const cue of soundCues(state, next, content.world)) {
          if (!cue.startsWith("footstep-")) continue;
          const surface = cue.slice("footstep-".length);
          const last = walked.at(-1);
          if (last?.surface === surface) last.steps += 1;
          else walked.push({ surface, steps: 1 });
        }
        state = next;
      }
    }
    expect(walked.map(({ surface }) => surface)).toEqual(["sand", "wood", "sand"]);
    expect(walked[1]?.steps ?? 0, "steps along the dock").toBeGreaterThanOrEqual(20);
  });
});
