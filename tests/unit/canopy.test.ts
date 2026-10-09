import { describe, expect, it } from "vitest";
import { faeBox, propCovers, type Area, type PropState } from "../../src/core";
import { hiddenPositions } from "../../src/content/area-checks";
import { loadContent } from "../../src/content/load";

// Canopies (spec 6): the crown of a tree Fae can walk under fades while she
// stands behind it, instead of hiding her. Bubblegum Bay's palms are canopy
// props, each cut whole (crown and trunk) with its front edge at the trunk's
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
  // [prop, its trunk's foot, points on its crown and trunk read off the painting]
  const palms: [string, number, [number, number][]][] = [
    ["palm-top-left", 426, [[140, 85], [38, 405]]],
    ["palm-bottom-left", 1100, [[130, 800], [250, 810], [31, 1075]]],
    ["palm-right", 1100, [[1640, 760], [1600, 1010], [1720, 1060]]],
  ];
  const drawn = (state: PropState, x: number, y: number): boolean => {
    const { left, step, columns } = state.silhouette;
    return (columns[Math.floor((x - left) / step)] ?? [])
      .some(([top, bottom]) => y >= top && y <= bottom);
  };
  for (const [id, foot, painted] of palms)
    it(`draws the whole ${id}, crown and trunk, as a canopy`, () => {
      const palm = bay.props.find((item) => item.id === id);
      const state = palm?.states.default;
      if (palm === undefined || state === undefined) throw new Error(`no ${id}`);
      expect(palm.canopy).toBe(true);
      // Its front edge is the trunk's foot.
      expect(Math.abs(Math.max(...state.front.ys) - foot), `${id} foot`).toBeLessThanOrEqual(6);
      for (const [x, y] of painted) expect(drawn(state, x, y), `${id} at ${x},${y}`).toBe(true);
    });

  it("puts Fae behind the top-left palm's crown when she walks under it", () => {
    const state = bay.props.find((item) => item.id === "palm-top-left")?.states.default;
    if (state === undefined) throw new Error("no top-left palm");
    const feet = { x: 200, y: 250 };
    expect(feet.y).toBeLessThan(Math.max(...state.front.ys));
    expect(propCovers(state, feet, faeBox)).toBeGreaterThan(0.25);
  });
});
