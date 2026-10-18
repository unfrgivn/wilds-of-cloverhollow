import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseArea, loadContent } from "../../src/content/load";
import { ambientFor } from "../../src/content/ambient";
import { flyerAt } from "../../src/render/ambient";
import type { AmbientFlyer } from "../../src/content/ambient";

const flyer: AmbientFlyer = {
  id: "test",
  animation: "butterfly_pink",
  path: [[0, 0], [100, 0], [100, 100], [0, 100]],
  loopTicks: 200,
  phase: 0,
  frameTicks: 10,
  size: 20,
};

function baseArea(): Record<string, unknown> {
  return {
    id: "test", name: "Test", width: 200, height: 200,
    walkable: [[0, 0], [200, 0], [200, 200]], blockers: [],
    triggers: [], interactables: [], critters: [], npcs: [], spawns: {},
    ambient: [{ ...flyer, path: flyer.path.map((point) => [...point]) }],
  };
}

function atlasAnimations(): Record<string, unknown> {
  const value: unknown = JSON.parse(readFileSync(
    new URL("../../public/assets/ambient/ambient.json", import.meta.url), "utf8",
  ));
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new Error("ambient atlas missing");
  const animations = Reflect.get(value, "animations");
  if (typeof animations !== "object" || animations === null || Array.isArray(animations))
    throw new Error("ambient animations missing");
  return Object.fromEntries(Object.entries(animations));
}

describe("ambient flyers", () => {
  it("moves by arc length, wraps, frames, and faces its travel", () => {
    const start = flyerAt(flyer, 0);
    const quarter = flyerAt(flyer, 50);
    const wrapped = flyerAt(flyer, 200);
    expect(start.x).toBe(0);
    expect(start.y).toBe(0);
    expect(quarter.x).toBe(100);
    expect(quarter.y).toBe(4);
    expect(quarter.flip).toBe(false);
    expect(flyerAt(flyer, 101).frame).toBe(0);
    expect(flyerAt(flyer, 100).frame).toBe(0);
    expect(flyerAt(flyer, 110).frame).toBe(1);
    expect(wrapped).toEqual(start);
    expect(flyerAt(flyer, 37)).toEqual(flyerAt(flyer, 37));
    expect(flyerAt(flyer, 150).flip).toBe(true);
  });

  it("rejects malformed flyer content", () => {
    const cases: Record<string, (area: Record<string, unknown>) => void> = {
      shape: (area) => { area.ambient = "nope"; },
      bounds: (area) => { area.ambient = [{ ...flyer, path: [[0, 0], [201, 0], [0, 1]] }]; },
      integer: (area) => { area.ambient = [{ ...flyer, loopTicks: 120.5 }]; },
      short: (area) => { area.ambient = [{ ...flyer, loopTicks: 119 }]; },
      duplicate: (area) => { area.ambient = [flyer, flyer]; },
    };
    for (const [name, mutate] of Object.entries(cases)) {
      const area = baseArea();
      mutate(area);
      expect(() => parseArea(area, `ambient-${name}.json`)).toThrow();
    }
  });

  it("uses only animations in the ambient atlas", () => {
    const animations = atlasAnimations();
    const areas = loadContent().world.areas;
    for (const area of Object.values(areas)) {
      for (const flyer of ambientFor(area))
        expect(
          animations,
          `${area.id} names missing ${flyer.animation}`,
        ).toHaveProperty(flyer.animation);
    }
  });
});
