import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadContent } from "../../src/content/load";
import {
  array,
  boolean,
  box,
  boxesApart,
  direction,
  edge,
  gradeMap,
  insideBox,
  integer,
  integerIn,
  nonEmptyString,
  nonNegative,
  number,
  optionalString,
  point,
  polygon,
  positive,
  record,
  string,
  strings,
} from "../../src/content/parsers";
import {
  ADULT_NPCS,
  areaEntityAtlases as overworldAreaEntityAtlases,
  computeCritterShadow,
  INDOOR_AREAS,
  resolveNpcTextureFrame,
} from "../../src/render/overworld-render";
import { areaEntityAtlases as viewAreaEntityAtlases } from "../../src/render/view";

describe("Milestone 97: PWA manifest, content parsers, and overworld render modularization", () => {
  it("ships a valid standalone manifest and matching metadata/favicon in index.html", () => {
    const rawManifest = readFileSync("public/manifest.webmanifest", "utf8");
    const parsed: unknown = JSON.parse(rawManifest);
    expect(record(parsed)).toBe(true);
    if (!record(parsed)) return;
    expect(parsed.name).toBe("Wilds of Cloverhollow");
    expect(parsed.short_name).toBe("Cloverhollow");
    expect(parsed.display).toBe("standalone");
    expect(parsed.orientation).toBe("landscape");
    expect(parsed.background_color).toBe("#f8edcf");
    expect(parsed.theme_color).toBe("#f8edcf");
    expect(array(parsed.icons) && parsed.icons.length > 0).toBe(true);

    const html = readFileSync("index.html", "utf8");
    expect(html).toContain('rel="manifest" href="./manifest.webmanifest"');
    expect(html).toContain('name="theme-color" content="#f8edcf"');
    expect(html).toContain('name="apple-mobile-web-app-capable" content="yes"');
    expect(html).toContain('name="apple-mobile-web-app-status-bar-style" content="default"');
    expect(html).toContain('name="apple-mobile-web-app-title" content="Cloverhollow"');
    expect(html).toContain('name="description"');
    expect(html).toContain('rel="icon"');
    expect(html).toContain('type="image/svg+xml"');
    expect(html).toContain("data:image/svg+xml,");
  });

  it("validates primitive and geometry shapes cleanly in src/content/parsers.ts", () => {
    const file = "test.json";
    expect(record({ a: 1 })).toBe(true);
    expect(record(null)).toBe(false);
    expect(array([1, 2])).toBe(true);
    expect(strings(["a", "b"])).toBe(true);
    expect(strings(["a", 2])).toBe(false);

    const sample: Record<string, unknown> = {
      name: "Clover",
      blank: "   ",
      count: 4,
      ratio: 0.5,
      zero: 0,
      neg: -2,
      flag: true,
    };
    expect(string(sample, "name", file)).toBe("Clover");
    expect(optionalString(sample, "missing", file)).toBeUndefined();
    expect(nonEmptyString(sample, "name", file)).toBe("Clover");
    expect(() => nonEmptyString(sample, "blank", file)).toThrow(/invalid blank/);
    expect(number(sample, "ratio", file)).toBe(0.5);
    expect(integer(sample, "count", file)).toBe(4);
    expect(() => integer(sample, "ratio", file)).toThrow(/invalid ratio/);
    expect(integerIn(sample, "count", 2, file)).toBe(4);
    expect(() => integerIn(sample, "count", 5, file)).toThrow(/invalid count/);
    expect(positive(sample, "ratio", file)).toBe(0.5);
    expect(() => positive(sample, "zero", file)).toThrow(/invalid zero/);
    expect(nonNegative(sample, "zero", file)).toBe(0);
    expect(() => nonNegative(sample, "neg", file)).toThrow(/invalid neg/);
    expect(boolean(sample, "flag", file)).toBe(true);
    expect(() => boolean(sample, "name", file)).toThrow(/invalid name/);

    expect(point({ x: 10, y: 20 })).toBe(true);
    expect(point({ x: 10, y: Number.NaN })).toBe(false);
    expect(polygon([[0, 0], [10, 0], [5, 10]])).toBe(true);
    expect(polygon([[0, 0], [10, 0]])).toBe(false);
    expect(box({ x: 2, y: 3, w: 10, h: 12 })).toBe(true);
    expect(box({ x: 2, y: 3, w: 0, h: 12 })).toBe(false);
    expect(edge({ y: 10, left: 4, right: 20 })).toBe(true);
    expect(edge({ y: 10, left: 20, right: 4 })).toBe(false);
    expect(insideBox({ x: 2, y: 2, w: 6, h: 6 }, { x: 0, y: 0, w: 10, h: 10 })).toBe(true);
    expect(insideBox({ x: 6, y: 2, w: 6, h: 6 }, { x: 0, y: 0, w: 10, h: 10 })).toBe(false);
    expect(boxesApart({ x: 0, y: 0, w: 5, h: 5 }, { x: 5, y: 0, w: 5, h: 5 })).toBe(true);
    expect(boxesApart({ x: 0, y: 0, w: 6, h: 5 }, { x: 5, y: 0, w: 5, h: 5 })).toBe(false);
    expect(direction("left")).toBe(true);
    expect(direction("diagonal")).toBe(false);
    expect(gradeMap({ great: "A", good: "B", miss: "C" }, file, "lines")).toEqual({
      great: "A", good: "B", miss: "C",
    });
    expect(() => gradeMap({ great: "A", good: 2, miss: "C" }, file, "lines")).toThrow(
      /invalid lines\.good/,
    );
  });

  it("exports identical areaEntityAtlases from overworld-render and view plus pure helpers", () => {
    expect(viewAreaEntityAtlases).toBe(overworldAreaEntityAtlases);
    const { world } = loadContent();
    for (const area of Object.values(world.areas)) {
      expect(viewAreaEntityAtlases(world, area)).toEqual(overworldAreaEntityAtlases(world, area));
    }
    expect(INDOOR_AREAS.has("bedroom")).toBe(true);
    expect(INDOOR_AREAS.has("plaza")).toBe(false);
    expect(ADULT_NPCS.has("mom")).toBe(true);
    expect(ADULT_NPCS.has("fern")).toBe(true);

    const anims = {
      idle_down: ["down_01", "down_02"],
      idle_left: ["left_01"],
    };
    expect(resolveNpcTextureFrame(anims, "right", [30, 10], 0)).toEqual({
      animation: "idle_left",
      mirror: true,
      frameName: "left_01",
    });
    expect(resolveNpcTextureFrame(anims, "down", [30, 10], 35)).toEqual({
      animation: "idle_down",
      mirror: false,
      frameName: "down_02",
    });

    const shadow = computeCritterShadow({ x: 100, y: 200 }, 80, -10, 0.3);
    expect(shadow.x).toBe(100);
    expect(shadow.y).toBe(200);
    expect(shadow.width).toBeCloseTo(44.8 * 0.8, 5);
    expect(shadow.alpha).toBeCloseTo(0.3 * 0.8, 5);
  });
});
