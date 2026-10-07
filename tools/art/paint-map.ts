#!/usr/bin/env bun
// Maps what an area's painting shows, so tests can check the area's floor,
// blockers, and occluders against the paint itself. The painting is cut into
// 5x5-unit cells (10x10 source px, at 2 px per unit). Each cell takes the class
// that at least 90% of its pixels share, else `m` (mixed: an edge):
//
//   w  water, including the pale shallows (green and blue above red)
//   s  sand or a sandy path (warm, light, smooth)
//   o  anything else: plants, rocks, wood, props, ink lines
//
// Thresholds were calibrated on Bubblegum Bay's sand, path, shallows, sea,
// dock, and props (art/recipes/bay.json).
//
//   bun tools/art/paint-map.ts bay > tests/unit/fixtures/bay-paint.json
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

type Tile = { file: string; x: number; y: number; width: number; height: number };
type Class = "w" | "s" | "o";

const pxPerUnit = 2;
const cellUnits = 5;
const cellPx = cellUnits * pxPerUnit;
const majority = 0.9;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function tiles(id: string): Tile[] {
  const manifest: unknown = JSON.parse(
    readFileSync(`public/assets/areas/${id}/ground.json`, "utf8"),
  );
  if (!isRecord(manifest) || !Array.isArray(manifest.tiles))
    throw new Error(`${id}: invalid ground manifest`);
  return manifest.tiles.map((tile: unknown) => {
    if (
      !isRecord(tile) || typeof tile.file !== "string" || typeof tile.x !== "number" ||
      typeof tile.y !== "number" || typeof tile.width !== "number" ||
      typeof tile.height !== "number"
    )
      throw new Error(`${id}: invalid tile`);
    return { file: tile.file, x: tile.x, y: tile.y, width: tile.width, height: tile.height };
  });
}

function classify(r: number, g: number, b: number): Class {
  if (g - r > 6 && b - r > -8) return "w";
  if (
    r >= 238 && g >= 218 && b >= 175 &&
    g - r <= 0 && g - r >= -28 && b - r <= -12 && b - r >= -75
  )
    return "s";
  return "o";
}

const id = process.argv[2];
if (id === undefined) throw new Error("usage: bun tools/art/paint-map.ts <area>");
const parts = tiles(id);
const width = Math.max(...parts.map((tile) => tile.x + tile.width));
const height = Math.max(...parts.map((tile) => tile.y + tile.height));
const pixels = new Uint8Array(width * height * 3);
for (const tile of parts) {
  const result = spawnSync("magick", [`public/assets/areas/${id}/${tile.file}`,
    "-depth", "8", "rgb:-"], { maxBuffer: 256 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`magick failed on ${tile.file}`);
  const raw = new Uint8Array(result.stdout);
  if (raw.length !== tile.width * tile.height * 3)
    throw new Error(`${tile.file}: expected ${tile.width}x${tile.height} RGB`);
  for (let row = 0; row < tile.height; row += 1)
    pixels.set(raw.subarray(row * tile.width * 3, (row + 1) * tile.width * 3),
      ((tile.y + row) * width + tile.x) * 3);
}

const columns = Math.floor(width / cellPx);
const rowsCount = Math.floor(height / cellPx);
const rows: string[] = [];
for (let cellY = 0; cellY < rowsCount; cellY += 1) {
  let line = "";
  for (let cellX = 0; cellX < columns; cellX += 1) {
    const counts = { w: 0, s: 0, o: 0 };
    for (let y = cellY * cellPx; y < (cellY + 1) * cellPx; y += 1)
      for (let x = cellX * cellPx; x < (cellX + 1) * cellPx; x += 1) {
        const at = (y * width + x) * 3;
        counts[classify(pixels[at] ?? 0, pixels[at + 1] ?? 0, pixels[at + 2] ?? 0)] += 1;
      }
    const total = cellPx * cellPx;
    line += counts.w >= total * majority ? "w"
      : counts.s >= total * majority ? "s"
      : counts.o >= total * majority ? "o"
      : "m";
  }
  rows.push(line);
}
console.log(JSON.stringify({ area: id, cellUnits, rows }, null, 0)
  .replace('"rows":[', '"rows":[\n').replaceAll('","', '",\n"'));
