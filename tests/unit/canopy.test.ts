import { describe, expect, it } from "vitest";
import { pointInPolygon, type Area } from "../../src/core";
import { bodyCover, hiddenPositions } from "../../src/content/area-checks";
import { loadContent } from "../../src/content/load";

// Canopies (spec 6): the crown of a tree Fae can walk under fades while she
// stands behind it, instead of hiding her. Bubblegum Bay's three palms are
// canopies, each cut whole (crown and trunk) with its baseline at the trunk's
// foot, so Fae under a crown is drawn behind it and can still be seen.

const content = loadContent();
const world = content.world;
const radius = world.tunables.playerRadius;

function areaFor(id: string): Area {
  const area = world.areas[id];
  if (area === undefined) throw new Error(`area ${id} missing`);
  return area;
}

describe("a canopy", () => {
  it("never counts as hiding Fae", () => {
    const harness = areaFor("harness");
    const xs = harness.walkable.map(([x]) => x);
    const ys = harness.walkable.map(([, y]) => y);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const shade: Area["occluders"][number] = {
      id: "shade",
      polygon: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]],
      baseline: y1 + 200,
    };
    expect(hiddenPositions({ ...harness, occluders: [shade] }, radius).length)
      .toBeGreaterThan(0);
    expect(hiddenPositions({ ...harness, occluders: [{ ...shade, canopy: true }] }, radius))
      .toEqual([]);
  }, 60_000);
});

describe("Bubblegum Bay's palms", () => {
  const bay = areaFor("bay");
  // [occluder, its trunk's foot, points on its crown and trunk read off the painting]
  const palms: [string, number, [number, number][]][] = [
    ["palm-top-left", 426, [[140, 85], [38, 405]]],
    ["palm-bottom-left", 1100, [[130, 800], [250, 810], [31, 1075]]],
    ["palm-right", 1100, [[1640, 760], [1600, 1010], [1720, 1060]]],
  ];
  for (const [id, foot, painted] of palms)
    it(`draws the whole ${id}, crown and trunk, as a canopy`, () => {
      const palm = bay.occluders.find((item) => item.id === id);
      if (palm === undefined) throw new Error(`no ${id}`);
      expect({ canopy: palm.canopy, baseline: palm.baseline })
        .toEqual({ canopy: true, baseline: foot });
      for (const [x, y] of painted)
        expect(pointInPolygon({ x, y }, palm.polygon), `${id} at ${x},${y}`).toBe(true);
    });

  it("puts Fae behind the top-left palm's crown when she walks under it", () => {
    const palm = bay.occluders.find((item) => item.id === "palm-top-left");
    if (palm === undefined) throw new Error("no top-left palm");
    const feet = { x: 200, y: 250 };
    expect(feet.y).toBeLessThan(palm.baseline);
    expect(bodyCover(palm.polygon, feet)).toBeGreaterThan(0.25);
  });
});
