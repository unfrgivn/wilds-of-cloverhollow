import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  createState, soundCues, stableHash, step, surfaceAt, type ActionFrame, type Point,
} from "../../src/core";
import { parseSurfaceMap } from "../../src/content/surfaces";
import { completeSurfaceMaps, loadContent } from "../../src/content/load";
import { parseScript } from "../../src/content/script";

const content = loadContent();
const none: ActionFrame = { move: { x: 0, y: 0 }, confirm: false, cancel: false, menu: false };

describe("area surface maps", () => {
  it("uses every area's default at its spawns unless a region contains the spawn", () => {
    for (const area of Object.values(content.world.areas)) {
      const map = content.world.surfaces[area.id];
      expect(map, `${area.id} surface map`).toBeDefined();
      for (const spawn of Object.values(area.spawns)) {
        const actual = surfaceAt(map!, spawn);
        const containing = map!.regions.find((region) => actual === region.surface);
        expect(actual, `${area.id} spawn ${spawn.x},${spawn.y}`).toBe(
          containing === undefined ? map!.default : containing.surface,
        );
      }
    }
  });

  it("keeps every carpet rug carpet and leaves the surrounding floor at its default", () => {
    for (const area of Object.values(content.world.areas)) {
      const map = content.world.surfaces[area.id];
      for (const region of map!.regions.filter(({ surface }) => surface === "carpet")) {
        const center = region.polygon.reduce(
          (point, [x, y]) => ({ x: point.x + x, y: point.y + y }), { x: 0, y: 0 },
        );
        const rug = { x: center.x / region.polygon.length, y: center.y / region.polygon.length };
        expect(surfaceAt(map!, rug)).toBe("carpet");
        const floorSpawn = Object.values(area.spawns).find((spawn) =>
          surfaceAt(map!, spawn) === map!.default);
        expect(floorSpawn, `${area.id} has floor around its rug`).toBeDefined();
      }
    }
  });

  it("uses wood inside the field crossing polygon", () => {
    const field = content.world.areas.field;
    if (field === undefined) throw new Error("field area missing");
    const crossings = field.crossings;
    if (crossings === undefined) throw new Error("field crossings missing");
    const crossing = crossings[0];
    if (crossing === undefined) throw new Error("field crossing missing");
    const center = crossing.polygon.reduce(
      (point, [x, y]) => ({ x: point.x + x, y: point.y + y }), { x: 0, y: 0 },
    );
    const point: Point = {
      x: center.x / crossing.polygon.length,
      y: center.y / crossing.polygon.length,
    };
    expect(surfaceAt(content.world.surfaces.field!, point)).toBe("wood");
  });

  it("agrees with the bay and pass paint maps", () => {
    const cases = [
      { id: "bay", expected: "sand", exception: new Set(["wood", "carpet"]) },
      { id: "pass", expected: "snow", exception: new Set(["stone", "wood"]) },
    ] as const;
    for (const { id, expected, exception } of cases) {
      const paint = JSON.parse(readFileSync(`tests/unit/fixtures/${id}-paint.json`, "utf8")) as {
        rows: string[]; cellUnits: number;
      };
      const map = content.world.surfaces[id]!;
      let painted = 0;
      let matching = 0;
      for (let y = 0; y < paint.rows.length; y += 1) {
        for (let x = 0; x < (paint.rows[y]?.length ?? 0); x += 1) {
          if (paint.rows[y]?.[x] !== "s") continue;
          painted += 1;
          const point = { x: (x + 0.5) * paint.cellUnits, y: (y + 0.5) * paint.cellUnits };
          const actual = surfaceAt(map, point);
          if (actual === expected || exception.has(actual)) matching += 1;
          expect(
            actual === expected || exception.has(actual), `${id} paint cell ${x},${y}`,
          ).toBe(true);
        }
      }
      const percentage = 100 * matching / painted;
      console.log(`${id} paint agreement: ${percentage.toFixed(2)}% (${matching}/${painted})`);
      expect(percentage).toBeGreaterThanOrEqual(97);
    }
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
  it("requires every area map and names the registration path", () => {
    expect(() => completeSurfaceMaps({ bay: content.world.areas.bay! }, {})).toThrow(
      "content/surfaces/bay.json is missing; it must be registered in src/content/load.ts",
    );
  });
  it("replays the bay recording from sand onto the dock without changing state", () => {
    const fixture = content.fixtures.bay!;
    let state = createState(content.world, fixture);
    const beforeHash = stableHash(state);
    const cues: { tick: number; cue: string; position: Point }[] = [];
    let tick = 0;
    const raw: unknown = JSON.parse(readFileSync("tests/sim/scripts/bay/bay.json", "utf8"));
    for (const segment of parseScript(raw, "tests/sim/scripts/bay/bay.json")) {
      for (let index = 0; index < segment.ticks; index += 1) {
        const next = step(content.world, state, segment.frame).state;
        for (const cue of soundCues(state, next, content.world))
          if (cue.startsWith("footstep-"))
            cues.push({ tick: tick + 1, cue, position: next.player });
        state = next;
        tick += 1;
      }
    }
    const footsteps = cues.map(({ cue }) => cue);
    const firstWood = cues.find(({ cue }) => cue === "footstep-wood");
    expect(footsteps).toContain("footstep-sand");
    expect(footsteps).toContain("footstep-wood");
    expect(firstWood).toBeDefined();
    expect(surfaceAt(content.world.surfaces.bay!, firstWood!.position)).toBe("wood");
    expect(stableHash(state)).toBe("9212d994");
    console.log(
      `bay first wood footstep: tick ${firstWood!.tick} at ` +
      `(${firstWood!.position.x}, ${firstWood!.position.y})`,
    );
    expect(beforeHash).toBe(stableHash(createState(content.world, fixture)));
  });
});
