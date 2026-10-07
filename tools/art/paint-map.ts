#!/usr/bin/env bun
// Maps what an area's painting shows, so tests can check the area's floor,
// blockers, and occluders against the paint itself. The painting is cut into
// 5x5-unit cells (10x10 source px, at 2 px per unit), classified by a palette
// made for the area's ground:
//
// beach (Bubblegum Bay): each cell takes the class at least 90% of its pixels
// share, else `m` (mixed: an edge).
//   w  water, including the pale shallows (green and blue above red)
//   s  sand or a sandy path (warm, light, smooth)
//   o  anything else: plants, rocks, wood, props, ink lines
//
// snow (Pinecone Pass): snow is white like the paper margin around the
// painting, so cells are classified by their mean colour and texture instead.
//   p  the paper margin: 90% paper-white pixels, and joined to the image's
//      edge through other paper cells (white snow inside the painting isn't)
//   s  snow or a packed-snow path, lit or in lavender shade (light, smooth)
//   o  anything else: trees, wood, stone, props, ink lines
//
// Thresholds were calibrated on each painting's ground, shade, paths, and
// props (art/recipes/bay.json, art/recipes/pass.json).
//
//   bun tools/art/paint-map.ts bay > tests/unit/fixtures/bay-paint.json
//   bun tools/art/paint-map.ts pass --palette snow > tests/unit/fixtures/pass-paint.json
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

type Tile = { file: string; x: number; y: number; width: number; height: number };
type Class = "w" | "s" | "o" | "p";

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

function beachPixel(r: number, g: number, b: number): Class {
  if (g - r > 6 && b - r > -8) return "w";
  if (
    r >= 238 && g >= 218 && b >= 175 &&
    g - r <= 0 && g - r >= -28 && b - r <= -12 && b - r >= -75
  )
    return "s";
  return "o";
}

const id = process.argv[2];
const paletteIndex = process.argv.indexOf("--palette");
const palette = paletteIndex < 0 ? "beach" : process.argv[paletteIndex + 1];
if (id === undefined || (palette !== "beach" && palette !== "snow" && palette !== "woods"))
  throw new Error("usage: bun tools/art/paint-map.ts <area> [--palette beach|snow|woods]");
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

function beachCell(cellX: number, cellY: number): string {
  const counts = { w: 0, s: 0, o: 0, p: 0 };
  for (let y = cellY * cellPx; y < (cellY + 1) * cellPx; y += 1)
    for (let x = cellX * cellPx; x < (cellX + 1) * cellPx; x += 1) {
      const at = (y * width + x) * 3;
      counts[beachPixel(pixels[at] ?? 0, pixels[at + 1] ?? 0, pixels[at + 2] ?? 0)] += 1;
    }
  const total = cellPx * cellPx;
  return counts.w >= total * majority ? "w"
    : counts.s >= total * majority ? "s"
    : counts.o >= total * majority ? "o"
    : "m";
}

// Paper is near-white and flat: the generation's own border is 254-255 grey,
// and the padding the raw was extended with is the margin colour #fcfbf6.
// Snow is cream (blue below red, 239-241 at its lightest) or lavender shade,
// never that flat white over a whole cell.
function paperPixel(r: number, g: number, b: number): boolean {
  const low = Math.min(r, g, b);
  if (low >= 250 && Math.max(r, g, b) - low <= 6) return true;
  return Math.abs(r - 252) <= 3 && Math.abs(g - 251) <= 3 && Math.abs(b - 246) <= 3;
}

function snowCell(cellX: number, cellY: number): string {
  let paper = 0;
  let red = 0;
  let blue = 0;
  let luma = 0;
  let lumaSquares = 0;
  for (let y = cellY * cellPx; y < (cellY + 1) * cellPx; y += 1)
    for (let x = cellX * cellPx; x < (cellX + 1) * cellPx; x += 1) {
      const at = (y * width + x) * 3;
      const r = pixels[at] ?? 0;
      const g = pixels[at + 1] ?? 0;
      const b = pixels[at + 2] ?? 0;
      if (paperPixel(r, g, b)) paper += 1;
      const value = (r + g + b) / 3;
      red += r;
      blue += b;
      luma += value;
      lumaSquares += value * value;
    }
  const total = cellPx * cellPx;
  if (paper >= total * majority) return "p";
  const mean = luma / total;
  const spread = Math.sqrt(Math.max(0, lumaSquares / total - mean * mean));
  return mean >= 215 && spread <= 9 && (blue - red) / total <= 18 ? "s" : "o";
}

function woodsPixel(r: number, g: number, b: number): Class {
  if (r >= 245 && g >= 240 && b >= 230 && Math.max(r, g, b) - Math.min(r, g, b) < 35)
    return "p";
  return g > r * 0.92 && g > b * 1.05 && g > 105 && r > 55 ? "s" : "o";
}

function woodsCell(cellX: number, cellY: number): string {
  let floor = 0;
  let paper = 0;
  let total = 0;
  for (let y = cellY * cellPx; y < (cellY + 1) * cellPx; y += 1)
    for (let x = cellX * cellPx; x < (cellX + 1) * cellPx; x += 1) {
      const at = (y * width + x) * 3;
      const kind = woodsPixel(pixels[at] ?? 0, pixels[at + 1] ?? 0, pixels[at + 2] ?? 0);
      if (kind === "s") floor += 1;
      if (kind === "p") paper += 1;
      total += 1;
    }
  return paper >= total * majority ? "p" : floor >= total * majority ? "s" : "o";
}

const columns = Math.floor(width / cellPx);
const rowsCount = Math.floor(height / cellPx);
const cells: string[][] = [];
for (let cellY = 0; cellY < rowsCount; cellY += 1) {
  const line: string[] = [];
  for (let cellX = 0; cellX < columns; cellX += 1) {
    const cell = palette === "beach" ? beachCell(cellX, cellY)
      : palette === "snow" ? snowCell(cellX, cellY) : woodsCell(cellX, cellY);
    line.push(cell);
  }
  cells.push(line);
}

// Snow only: white cells not joined to the image's edge are bright snow
// inside the painting, not its paper margin.
if (palette === "snow" || palette === "woods") {
  const margin = new Set<number>();
  const queue: number[] = [];
  for (let cellY = 0; cellY < rowsCount; cellY += 1)
    for (let cellX = 0; cellX < columns; cellX += 1)
      if ((cellX === 0 || cellY === 0 || cellX === columns - 1 || cellY === rowsCount - 1) &&
        cells[cellY]?.[cellX] === "p") {
        margin.add(cellY * columns + cellX);
        queue.push(cellY * columns + cellX);
      }
  for (let index = queue.pop(); index !== undefined; index = queue.pop()) {
    const cellX = index % columns;
    const cellY = (index - cellX) / columns;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nextX = cellX + (dx ?? 0);
      const nextY = cellY + (dy ?? 0);
      const next = nextY * columns + nextX;
      if (nextX < 0 || nextY < 0 || nextX >= columns || nextY >= rowsCount) continue;
      if (cells[nextY]?.[nextX] !== "p" || margin.has(next)) continue;
      margin.add(next);
      queue.push(next);
    }
  }
  cells.forEach((line, cellY) => line.forEach((value, cellX) => {
    if (value === "p" && !margin.has(cellY * columns + cellX))
      line[cellX] = palette === "woods" ? "o" : "s";
  }));
}

const rows = cells.map((line) => line.join(""));
console.log(JSON.stringify({ area: id, cellUnits, rows }, null, 0)
  .replace('"rows":[', '"rows":[\n').replaceAll('","', '",\n"'));
