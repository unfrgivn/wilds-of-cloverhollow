import { describe, expect, it } from "vitest";
import { createState, soundCues, step, surfaceAt, type ActionFrame } from "../../src/core";
import { parseSurfaceMap } from "../../src/content/surfaces";
import { loadContent } from "../../src/content/load";

const content = loadContent();
const none: ActionFrame = { move: { x: 0, y: 0 }, confirm: false, cancel: false, menu: false };

describe("area surface maps", () => {
  it("looks up painted ground and distinct bridges and docks", () => {
    const { bay, park } = content.world.areas;
    expect(bay).toBeDefined();
    expect(park).toBeDefined();
    if (bay === undefined || park === undefined) return;
    expect(surfaceAt(bay.surfaces, { x: 300, y: 700 })).toBe("sand");
    expect(surfaceAt(bay.surfaces, { x: 700, y: 170 })).toBe("wood");
    expect(surfaceAt(park.surfaces, { x: 800, y: 600 })).toBe("wood");
    expect(surfaceAt(park.surfaces, { x: 300, y: 600 })).toBe("grass");
  });

  it("rejects unknown surfaces, malformed polygons, and out-of-bounds polygons", () => {
    expect(() => parseSurfaceMap(
      { default: "mud", precedence: "first", regions: [] }, "test.json", 10, 10,
    ))
      .toThrow("unknown default surface");
    expect(() => parseSurfaceMap(
      { default: "grass", precedence: "first", regions: [
        { surface: "sand", polygon: [[0, 0], [1, 1]] },
      ] }, "test.json", 10, 10,
    ))
      .toThrow("invalid regions.0");
    expect(() => parseSurfaceMap(
      { default: "grass", precedence: "first", regions: [
        { surface: "sand", polygon: [[0, 0], [1, 0], [11, 1]] },
      ] }, "test.json", 10, 10,
    ))
      .toThrow("outside area");
  });

  it("replays footstep surface changes without changing state", () => {
    const bay = content.world.areas.bay;
    if (bay === undefined) return;
    const fixture = content.fixtures.bay ?? content.fixtures.harness;
    if (fixture === undefined) return;
    let state = createState(content.world, fixture);
    const cues: string[] = [];
    const surface = (area: string, point: { x: number; y: number }) =>
      surfaceAt(content.world.areas[area]?.surfaces ?? bay.surfaces, point);
    for (const point of [{ x: 300, y: 700 }, { x: 700, y: 170 }]) {
      const previous = { ...state, tick: 7, player: point };
      const next = step(content.world, previous, { ...none, move: { x: 1, y: 0 } }).state;
      cues.push(...soundCues(previous, next, surface));
      state = next;
    }
    expect(cues.filter((cue) => cue.startsWith("footstep-"))).toEqual([
      "footstep-sand", "footstep-wood",
    ]);
  });
});
