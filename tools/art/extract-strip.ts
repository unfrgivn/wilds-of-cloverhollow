#!/usr/bin/env bun
export {};

type Bounds = { start: number; end: number; top: number; bottom: number };

function value(name: string, fallback: string): string {
  const index = Bun.argv.indexOf(`--${name}`);
  return index >= 0 ? Bun.argv[index + 1] ?? fallback : fallback;
}

async function identify(input: string): Promise<{ width: number; height: number }> {
  const process = Bun.spawn(
    ["magick", "identify", "-format", "%w:%h", input],
    { stdout: "pipe", stderr: "inherit" },
  );
  const text = await new Response(process.stdout).text();
  if (await process.exited !== 0) throw new Error(`Could not identify ${input}`);
  const parts = text.trim().split(":").map(Number);
  const width = parts[0];
  const height = parts[1];
  if (
    width === undefined || height === undefined
    || !Number.isFinite(width) || !Number.isFinite(height)
  ) {
    throw new Error(`Invalid dimensions for ${input}`);
  }
  return { width, height };
}

async function alphaProjection(
  input: string,
  width: number,
  height: number,
  key: string,
  fuzz: string,
): Promise<Uint8Array> {
  const process = Bun.spawn(
    ["magick", input, "-alpha", "on", "-fuzz", fuzz, "-transparent", key,
      "-alpha", "extract", "-threshold", "1%", "-depth", "8", "gray:-"],
    { stdout: "pipe", stderr: "inherit" },
  );
  const bytes = new Uint8Array(await new Response(process.stdout).arrayBuffer());
  if (await process.exited !== 0 || bytes.length < width * height) {
    throw new Error(`Could not create alpha projection for ${input}`);
  }
  return bytes;
}

function findBounds(alpha: Uint8Array, width: number, height: number): Bounds[] {
  const seen = new Uint8Array(alpha.length);
  const components: Array<{ area: number; bounds: Bounds }> = [];
  for (let index = 0; index < alpha.length; index += 1) {
    if (alpha[index] === 0 || seen[index] === 1) continue;
    const queue = [index];
    seen[index] = 1;
    let area = 0;
    let minX = width;
    let maxX = 0;
    let minY = height;
    let maxY = 0;
    while (queue.length > 0) {
      const current = queue.pop();
      if (current === undefined) continue;
      area += 1;
      const x = current % width;
      const y = Math.floor(current / width);
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      const neighbors = [[-1, 0], [1, 0], [0, -1], [0, 1]] as const;
      for (const [dx, dy] of neighbors) {
        const nextX = x + dx;
        const nextY = y + dy;
        if (nextX < 0 || nextX >= width || nextY < 0 || nextY >= height) continue;
        const next = nextY * width + nextX;
        if (alpha[next] !== 0 && seen[next] === 0) {
          seen[next] = 1;
          queue.push(next);
        }
      }
    }
    components.push({
      area,
      bounds: { start: minX, end: maxX + 1, top: minY, bottom: maxY + 1 },
    });
  }
  const largest = Math.max(...components.map((component) => component.area));
  return components
    .filter((component) => component.area >= largest * 0.005)
    .map((component) => component.bounds)
    .sort((left, right) => left.start - right.start);
}

function columnCounts(
  alpha: Uint8Array,
  width: number,
  height: number,
  bounds: Bounds,
): number[] {
  const counts: number[] = [];
  for (let x = bounds.start; x < bounds.end; x += 1) {
    let count = 0;
    for (let y = 0; y < height; y += 1) {
      if ((alpha[y * width + x] ?? 0) > 0) count += 1;
    }
    counts.push(count);
  }
  return counts;
}

function splitWidest(
  alpha: Uint8Array,
  width: number,
  height: number,
  bounds: Bounds[],
): Bounds[] {
  const widest = bounds.reduce((current, candidate) => (
    candidate.end - candidate.start > current.end - current.start
      ? candidate
      : current
  ));
  const counts = columnCounts(alpha, width, height, widest);
  const margin = Math.max(20, Math.floor(counts.length * 0.12));
  let valley = margin;
  for (let index = margin; index < counts.length - margin; index += 1) {
    if ((counts[index] ?? 0) < (counts[valley] ?? 0)) valley = index;
  }
  if ((counts[valley] ?? 0) > 6) {
    throw new Error(
      "Merged frame has no thin contact valley (more than 6 opaque pixels); "
      + "regenerate the sheet with wider spacing",
    );
  }
  const split = widest.start + valley;
  if (split <= widest.start + 12 || split >= widest.end - 12) {
    throw new Error("Could not find a safe alpha valley to split a merged frame");
  }
  return bounds
    .filter((bound) => bound !== widest)
    .concat([
      { start: widest.start, end: split, top: widest.top, bottom: widest.bottom },
      { start: split, end: widest.end, top: widest.top, bottom: widest.bottom },
    ])
    .sort((left, right) => left.start - right.start);
}

const input = value("input", "");
const output = value("output", "art/scratch/strip-frames");
const key = value("key", "#00FF00");
const fuzz = value("fuzz", "18%");
const expected = Number(value("expected", "6"));
if (input.length === 0) throw new Error("--input is required");
const dimensions = await identify(input);
const alpha = await alphaProjection(input, dimensions.width, dimensions.height, key, fuzz);
let bounds = findBounds(alpha, dimensions.width, dimensions.height);
while (bounds.length < expected) {
  bounds = splitWidest(alpha, dimensions.width, dimensions.height, bounds);
}
if (bounds.length !== expected) {
  throw new Error(`Expected ${expected} strip figures, found ${bounds.length}`);
}
const mkdir = Bun.spawn(["mkdir", "-p", output]);
if (await mkdir.exited !== 0) throw new Error(`Could not create ${output}`);
for (const [index, bound] of bounds.entries()) {
  const padding = 12;
  const start = Math.max(0, bound.start - padding);
  const end = Math.min(dimensions.width, bound.end + padding);
  const top = Math.max(0, bound.top - padding);
  const bottom = Math.min(dimensions.height, bound.bottom + padding);
  const crop = Bun.spawn([
    "magick", input,
    "-crop", `${end - start}x${bottom - top}+${start}+${top}`,
    "+repage", `${output}/raw-${String(index + 1).padStart(2, "0")}.png`,
  ], { stdout: "inherit", stderr: "inherit" });
  if (await crop.exited !== 0) throw new Error(`Could not crop strip frame ${index + 1}`);
}
console.log(`extracted ${bounds.length} frames to ${output}`);
