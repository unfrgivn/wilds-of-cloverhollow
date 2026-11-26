import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { loadContent } from "../../src/content/load";
import { areaEntityAtlases } from "../../src/render/view";
import { parseAtlasJson } from "../../src/ui/atlas";

type RgbaImage = { width: number; height: number; data: Uint8Array };

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

// Decodes an 8-bit non-interlaced RGBA PNG in pure Node (no external binary).
function decodeRgbaPng(path: string): RgbaImage {
  const raw = readFileSync(path);
  let width = 0;
  let height = 0;
  const idat: Buffer[] = [];
  let offset = 8;
  while (offset + 8 <= raw.length) {
    const length = raw.readUInt32BE(offset);
    const type = raw.subarray(offset + 4, offset + 8).toString("ascii");
    const chunk = raw.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = chunk.readUInt32BE(0);
      height = chunk.readUInt32BE(4);
      const bitDepth = chunk[8];
      const colorType = chunk[9];
      if (bitDepth !== 8 || colorType !== 6) {
        throw new Error(
          `${path}: expected 8-bit RGBA PNG, got depth=${bitDepth} type=${colorType}`,
        );
      }
    } else if (type === "IDAT") {
      idat.push(chunk);
    } else if (type === "IEND") {
      break;
    }
    offset += 12 + length;
  }
  const inflated = inflateSync(Buffer.concat(idat));
  const stride = width * 4;
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    const filter = inflated[y * (stride + 1)] ?? 0;
    const srcStart = y * (stride + 1) + 1;
    const dstStart = y * stride;
    for (let i = 0; i < stride; i += 1) {
      const value = inflated[srcStart + i] ?? 0;
      const a = i >= 4 ? (data[dstStart + i - 4] ?? 0) : 0;
      const b = y > 0 ? (data[dstStart - stride + i] ?? 0) : 0;
      const c = y > 0 && i >= 4 ? (data[dstStart - stride + i - 4] ?? 0) : 0;
      let recon = value;
      if (filter === 1) recon = (value + a) & 0xff;
      else if (filter === 2) recon = (value + b) & 0xff;
      else if (filter === 3) recon = (value + ((a + b) >> 1)) & 0xff;
      else if (filter === 4) recon = (value + paeth(a, b, c)) & 0xff;
      data[dstStart + i] = recon;
    }
  }
  return { width, height, data };
}

describe("Milestone 71: critter keying, proportions, and per-area entity atlases", () => {
  const { world } = loadContent();
  const decodedCache = new Map<string, RgbaImage>();
  const readAtlas = (atlasRel: string): {
    png: RgbaImage;
    json: ReturnType<typeof parseAtlasJson>;
  } => {
    const jsonPath = `public/${atlasRel}`;
    const pngPath = jsonPath.replace(/\.json$/, ".png");
    let png = decodedCache.get(pngPath);
    if (png === undefined) {
      png = decodeRgbaPng(pngPath);
      decodedCache.set(pngPath, png);
    }
    const json = parseAtlasJson(JSON.parse(readFileSync(jsonPath, "utf8")), jsonPath);
    return { png, json };
  };

  it("has zero magenta or green soft-edge spill on calm_idle_01 across all critters", () => {
    const critters = Object.values(world.critters);
    expect(critters.length).toBeGreaterThanOrEqual(25);
    for (const critter of critters) {
      const { png, json } = readAtlas(critter.atlas);
      const rect = json.frames.calm_idle_01?.frame;
      expect(rect, `${critter.id} missing calm_idle_01 frame`).toBeDefined();
      if (rect === undefined) continue;
      let greenSpill = 0;
      let magentaSpill = 0;
      for (let y = 0; y < rect.h; y += 1) {
        for (let x = 0; x < rect.w; x += 1) {
          const idx = ((rect.y + y) * png.width + (rect.x + x)) * 4;
          const r = png.data[idx] ?? 0;
          const g = png.data[idx + 1] ?? 0;
          const b = png.data[idx + 2] ?? 0;
          const a = png.data[idx + 3] ?? 0;
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
      const { png, json } = readAtlas(critter.atlas);
      const rect = json.frames.chaos_idle_01?.frame;
      expect(rect, `${critter.id} missing chaos_idle_01 frame`).toBeDefined();
      if (rect === undefined) continue;
      let minY = rect.h;
      let maxY = -1;
      for (let y = 0; y < rect.h; y += 1) {
        for (let x = 0; x < rect.w; x += 1) {
          const a = png.data[((rect.y + y) * png.width + (rect.x + x)) * 4 + 3] ?? 0;
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
