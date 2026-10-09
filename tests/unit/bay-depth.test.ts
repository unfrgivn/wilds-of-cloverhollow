import { describe, expect, it } from "vitest";
import {
  distanceToPolygon, everyPropFootprint, pointInPolygon, propCoversPoint, type Area, type Point,
  type PropState,
} from "../../src/core";
import { loadContent } from "../../src/content/load";
import paint from "./fixtures/bay-paint.json";

// Contract for Milestone 19 (props since Milestone 34): what Bubblegum Bay
// draws in front of Fae. A prop is drawn over her where its picture overlaps
// her body box (50 x 140 units above her feet) in a column where her feet are
// north of its front edge (spec 6.2). Points are read off the painting (units).

const world = loadContent().world;
const radius = world.tunables.playerRadius;

function bayArea(): Area {
  const area = world.areas["bay"];
  if (area === undefined) throw new Error("area bay missing");
  return area;
}
const bay = bayArea();

function standable(point: Point): boolean {
  if (!pointInPolygon(point, bay.walkable)) return false;
  if (distanceToPolygon(point, bay.walkable) < radius) return false;
  const solid = [...bay.blockers, ...everyPropFootprint(bay),
    ...bay.npcs.map((npc) => npc.footprint)];
  return solid.every(
    (polygon) => !pointInPolygon(point, polygon) && distanceToPolygon(point, polygon) >= radius,
  );
}

// The share of Fae's body rows from `top` to `bottom` units above her feet
// (on a 5-unit grid) that props draw over (only the prop `only`, if given).
const states: { id: string; state: PropState }[] = bay.props.flatMap((prop) => {
  const state = prop.states.default;
  return state === undefined ? [] : [{ id: prop.id, state }];
});
function coverage(feet: Point, top = 140, bottom = 0, only?: string): number {
  const drawn = only === undefined ? states : states.filter(({ id }) => id === only);
  let covered = 0;
  let samples = 0;
  for (let y = feet.y - top; y <= feet.y - bottom; y += 5)
    for (let x = feet.x - 25; x <= feet.x + 25; x += 5) {
      samples += 1;
      if (drawn.some(({ state }) => propCoversPoint(state, feet, { x, y }))) covered += 1;
    }
  return covered / samples;
}

// The best-covered standable point in a box (5-unit steps), if any.
function bestIn(x0: number, x1: number, y0: number, y1: number): number {
  let best = -1;
  for (let y = y0; y <= y1; y += 5)
    for (let x = x0; x <= x1; x += 5)
      if (standable({ x, y })) best = Math.max(best, coverage({ x, y }));
  return best;
}

// The dock's planks: north and south plank edges from the sand (s = 0) to
// the far end (s = 1); u runs across from the north edge (0) to the south (1).
function dock(s: number, u: number): Point {
  const north = { x: 815 + s * 580, y: 520 - s * 375 };
  const south = { x: 1000 + s * 585, y: 640 - s * 375 };
  return {
    x: Math.round(north.x + u * (south.x - north.x)),
    y: Math.round(north.y + u * (south.y - north.y)),
  };
}

describe("what Bubblegum Bay draws in front of Fae", () => {
  it("never draws the dock's far (north) rail over her", () => {
    // Up to s 0.8: Sue stands near the far end.
    for (let s = 0.2; s <= 0.81; s += 0.1) {
      const feet = dock(s, 0.2);
      expect(standable(feet), `dock s ${s.toFixed(1)} near the north rail`).toBe(true);
      expect(coverage(feet), `north rail over Fae at s ${s.toFixed(1)}`).toBe(0);
    }
  });

  // From the dock's foot to the water, the south rail stands between the
  // planks and the beach: Fae can't walk through it, and on the beach in
  // front of it she's never drawn behind it.
  it("keeps Fae from walking through the south rail", () => {
    for (let s = 0.05; s <= 0.33; s += 0.02)
      expect(standable(dock(s, 1)), `the rail at s ${s.toFixed(2)}`).toBe(false);
  });

  it("never draws the south rail over Fae on the beach in front of it", () => {
    let checked = 0;
    for (let x = 1015; x <= 1200; x += 5)
      for (let below = 15; below <= 70; below += 5) {
        const feet = { x, y: Math.round(640 - (375 * (x - 1000)) / 585 + below) };
        if (!standable(feet)) continue;
        checked += 1;
        // Beside the bucket, the bucket rightly draws over her; this is the rail.
        expect(coverage(feet, 140, 0, "dock-rail-south"), `the beach at (${feet.x}, ${feet.y})`)
          .toBe(0);
      }
    expect(checked, "beach spots in front of the rail").toBeGreaterThanOrEqual(20);
  });

  // The near (south) rail's posts and rope stand along the dock's south edge:
  // on the dock, as close to a post as she can get, Fae is partly behind it.
  for (const x of [1015, 1113, 1208, 1295, 1383, 1475])
    it(`draws the near rail's post at x ${x} over Fae beside it`, () => {
      const edge = 640 - (375 * (x - 1000)) / 585;
      let best = -1;
      for (let y = Math.round(edge - 80); y <= edge; y += 1)
        for (let dx = -10; dx <= 10; dx += 5)
          if (standable({ x: x + dx, y })) best = Math.max(best, coverage({ x: x + dx, y }));
      expect(best, `post at x ${x}`).toBeGreaterThan(0);
    });

  it("never draws either rail over Fae in the middle of the dock", () => {
    for (let s = 0.1; s <= 0.91; s += 0.1)
      expect(coverage(dock(s, 0.5)), `mid-dock at s ${s.toFixed(1)}`).toBe(0);
  });

  it("draws the umbrella over Fae behind it", () => {
    expect(bestIn(420, 560, 150, 380)).toBeGreaterThanOrEqual(0.3);
  });

  it("draws the sign over Fae behind it", () => {
    expect(bestIn(150, 250, 300, 465)).toBeGreaterThanOrEqual(0.3);
  });

  const palms: [string, [number, number, number, number]][] = [
    ["top-left palm's trunk", [40, 150, 280, 425]],
    ["bottom-left palm's trunk", [20, 120, 900, 1060]],
    ["right palm's trunk", [1580, 1700, 900, 1060]],
  ];
  for (const [name, [x0, x1, y0, y1]] of palms)
    it(`draws the ${name} over Fae behind it`, () => {
      expect(bestIn(x0, x1, y0, y1), name).toBeGreaterThanOrEqual(0.1);
    });

  // A prop must sit on its object, not on open beach or sea: at most a
  // quarter of the cells its picture covers may be open sand or water (a 3x3
  // neighbourhood all sand or all water). Counting painted cells instead
  // fails on white canopy stripes, which read as sand.
  it("cuts every prop tight around something painted", () => {
    const rows = paint.rows;
    const at = (i: number, j: number): string => rows[j]?.[i] ?? "?";
    const open = (i: number, j: number): boolean =>
      ["s", "w"].some((kind) => {
        for (let dy = -1; dy <= 1; dy += 1)
          for (let dx = -1; dx <= 1; dx += 1) if (at(i + dx, j + dy) !== kind) return false;
        return true;
      });
    for (const { id, state } of states) {
      const { left, step, columns } = state.silhouette;
      let cells = 0;
      let bare = 0;
      rows.forEach((row, j) => {
        for (let i = 0; i < row.length; i += 1) {
          const x = (i + 0.5) * paint.cellUnits;
          const y = (j + 0.5) * paint.cellUnits;
          const column = columns[Math.floor((x - left) / step)] ?? [];
          if (!column.some(([from, to]) => y >= from && y <= to)) continue;
          cells += 1;
          if (open(i, j)) bare += 1;
        }
      });
      expect(cells, `${id} is smaller than a cell`).toBeGreaterThan(0);
      expect(bare / cells, `${id} covers open beach or sea`).toBeLessThanOrEqual(0.25);
    }
  });


});
