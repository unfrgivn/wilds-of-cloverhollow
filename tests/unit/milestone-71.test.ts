import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadContent } from "../../src/content/load";
import { areaEntityAtlases } from "../../src/render/view";
import { atlasImagePath, parseAtlasJson } from "../../src/ui/atlas";
import { decodeRgbaImage, type RgbaImage } from "./decode-image";

describe("Milestone 71: critter keying, proportions, and per-area entity atlases", () => {
  const { world } = loadContent();
  const decodedCache = new Map<string, RgbaImage>();
  const readAtlas = (atlasRel: string): {
    image: RgbaImage;
    json: ReturnType<typeof parseAtlasJson>;
  } => {
    const jsonPath = `public/${atlasRel}`;
    const json = parseAtlasJson(JSON.parse(readFileSync(jsonPath, "utf8")), jsonPath);
    const imagePath = atlasImagePath(jsonPath, json);
    let image = decodedCache.get(imagePath);
    if (image === undefined) {
      image = decodeRgbaImage(imagePath);
      decodedCache.set(imagePath, image);
    }
    return { image, json };
  };

  it("has zero magenta or green soft-edge spill on calm_idle_01 across all critters", () => {
    const critters = Object.values(world.critters);
    expect(critters.length).toBeGreaterThanOrEqual(25);
    for (const critter of critters) {
      const { image, json } = readAtlas(critter.atlas);
      const rect = json.frames.calm_idle_01?.frame;
      expect(rect, `${critter.id} missing calm_idle_01 frame`).toBeDefined();
      if (rect === undefined) continue;
      let greenSpill = 0;
      let magentaSpill = 0;
      for (let y = 0; y < rect.h; y += 1) {
        for (let x = 0; x < rect.w; x += 1) {
          const idx = ((rect.y + y) * image.width + (rect.x + x)) * 4;
          const r = image.rgba[idx] ?? 0;
          const g = image.rgba[idx + 1] ?? 0;
          const b = image.rgba[idx + 2] ?? 0;
          const a = image.rgba[idx + 3] ?? 0;
          if (a <= 16 || a >= 240) continue;
          if (g - Math.max(r, b) > 40) greenSpill += 1;
          if (Math.min(r, b) - g > 40) magentaSpill += 1;
        }
      }
      expect(
        { id: critter.id, greenSpill, magentaSpill },
        `${critter.id} calm_idle_01 soft-edge spill`,
      ).toEqual({ id: critter.id, greenSpill: 0, magentaSpill: 0 });
    }
  });

  it("declares figureHeight within 15% of drawn chaos_idle_01 height for every critter", () => {
    for (const critter of Object.values(world.critters)) {
      const { image, json } = readAtlas(critter.atlas);
      const rect = json.frames.chaos_idle_01?.frame;
      expect(rect, `${critter.id} missing chaos_idle_01 frame`).toBeDefined();
      if (rect === undefined) continue;
      let minY = rect.h;
      let maxY = -1;
      for (let y = 0; y < rect.h; y += 1) {
        for (let x = 0; x < rect.w; x += 1) {
          const a = image.rgba[((rect.y + y) * image.width + (rect.x + x)) * 4 + 3] ?? 0;
          if (a > 16) {
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }
      const drawnHeight = maxY >= minY ? maxY - minY + 1 : 0;
      const drift = Math.abs(critter.figureHeight - drawnHeight) / drawnHeight;
      expect(
        drift,
        `${critter.id}: figureHeight=${critter.figureHeight} vs drawn=${drawnHeight}`,
      ).toBeLessThanOrEqual(0.15);
    }
  });

  it("scopes areaEntityAtlases to non-party NPCs and critters without duplicates", () => {
    const bedroom = world.areas.bedroom;
    expect(bedroom).toBeDefined();
    if (bedroom !== undefined) {
      expect(areaEntityAtlases(world, bedroom)).toEqual([
        { alias: "mom-sheet", src: "assets/characters/mom/mom.json" },
      ]);
    }
    const partyAliases = new Set(Object.keys(world.party).map((id) => `${id}-sheet`));
    for (const area of Object.values(world.areas)) {
      const atlases = areaEntityAtlases(world, area);
      const aliases = atlases.map((entry) => entry.alias);
      expect(new Set(aliases).size, `${area.id} duplicate entity atlases`).toBe(aliases.length);
      for (const alias of aliases) {
        expect(partyAliases.has(alias), `${area.id} should not reload party ${alias}`).toBe(false);
      }
    }
    const hills = world.areas.hills;
    expect(hills).toBeDefined();
    if (hills !== undefined) {
      const hillsAliases = areaEntityAtlases(world, hills).map((entry) => entry.alias);
      expect(hillsAliases).toContain("assets/critters/lamb/lamb.json");
      expect(hillsAliases).toContain("assets/critters/hedgehog/hedgehog.json");
      expect(hillsAliases).not.toContain("assets/critters/frog/frog.json");
      expect(hillsAliases).not.toContain("mom-sheet");
    }
  });
});
