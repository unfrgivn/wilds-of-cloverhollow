#!/usr/bin/env bun
export {};

type JsonValue = string | number | boolean | null | JsonValue[] | JsonRecord;
type JsonRecord = { [key: string]: JsonValue };
type Pixel = { r: number; g: number; b: number; a: number };
type Component = { area: number; minX: number; minY: number; maxX: number; maxY: number };

function record(value: JsonValue | undefined): JsonRecord | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value
    : undefined;
}

function textArg(name: string, fallback: string): string {
  const index = Bun.argv.indexOf(`--${name}`);
  return index >= 0 ? Bun.argv[index + 1] ?? fallback : fallback;
}

async function pixels(path: string): Promise<Pixel[]> {
  const process = Bun.spawn(["magick", path, "-depth", "8", "txt:-"], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const output = await new Response(process.stdout).text();
  if (await process.exited !== 0) throw new Error(`Could not read ${path}`);
  const result: Pixel[] = [];
  for (const line of output.split("\n")) {
    const match = /:\s*\((\d+),(\d+),(\d+),(\d+)\)/.exec(line);
    if (match === null) continue;
    const r = Number(match[1]);
    const g = Number(match[2]);
    const b = Number(match[3]);
    const a = Number(match[4]);
    if ([r, g, b, a].some((value) => Number.isNaN(value))) continue;
    result.push({ r, g, b, a });
  }
  if (result.length !== 512 * 512) throw new Error(`Unexpected pixels in ${path}`);
  return result;
}

function components(data: Pixel[]): Component[] {
  const seen = new Uint8Array(data.length);
  const result: Component[] = [];
  for (let start = 0; start < data.length; start += 1) {
    if (seen[start] !== 0 || data[start]?.a === 0) continue;
    const queue = [start];
    seen[start] = 1;
    let area = 0;
    let minX = 512;
    let minY = 512;
    let maxX = 0;
    let maxY = 0;
    while (queue.length > 0) {
      const index = queue.pop();
      if (index === undefined) continue;
      const x = index % 512;
      const y = Math.floor(index / 512);
      area += 1;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      for (const next of [index - 1, index + 1, index - 512, index + 512]) {
        if (next < 0 || next >= data.length || seen[next] !== 0) continue;
        const nextX = next % 512;
        if (Math.abs(nextX - x) > 1 || data[next]?.a === 0) continue;
        seen[next] = 1;
        queue.push(next);
      }
    }
    result.push({ area, minX, minY, maxX, maxY });
  }
  return result.sort((left, right) => right.area - left.area);
}

function metrics(data: Pixel[]): string {
  const opaque = data.flatMap((pixel, index) => pixel.a > 0 ? [index] : []);
  const xs = opaque.map((index) => index % 512);
  const ys = opaque.map((index) => Math.floor(index / 512));
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  let spill = 0;
  let pairs = 0;
  let equal = 0;
  for (let index = 0; index < data.length; index += 1) {
    const pixel = data[index];
    if (pixel === undefined || pixel.a === 0) continue;
    if (pixel.g > Math.max(pixel.r, pixel.b) + 12) spill += 1;
    if (index % 512 === 511 || data[index + 1]?.a === 0) continue;
    const right = data[index + 1];
    if (right === undefined || right.a === 0) continue;
    pairs += 1;
    if (pixel.r === right.r && pixel.g === right.g && pixel.b === right.b) equal += 1;
  }
  const blockiness = pairs === 0 ? 0 : equal / pairs;
  const parts = components(data);
  const bodyArea = data.reduce((total, pixel, index) => {
    const x = index % 512;
    const y = Math.floor(index / 512);
    return total + (pixel.a > 0 && x >= 100 && x <= 412 && y >= 100 ? 1 : 0);
  }, 0);
  const islands = parts.filter((part) => part.area < 20).length;
  const bubbles = parts.slice(1).filter((part) => part.area >= 20);
  return JSON.stringify({
    clearance: { left: minX, top: minY, right: 511 - maxX, bottom: 511 - maxY },
    components: parts.length,
    islandsUnder20: islands,
    bubbles: bubbles.map((part) => part.area),
    bodyArea,
    greenSpillPixels: spill,
    blockiness: Number(blockiness.toFixed(5)),
  });
}

const jsonPath = textArg("json", "public/assets/critters/frog/frog.json");
const framesPath = textArg("frames-dir", "art/scratch/frog-frames");
const parsed: JsonValue = JSON.parse(await Bun.file(jsonPath).text());
const root = record(parsed);
if (root === undefined) throw new Error("Sprite JSON must be an object");
const animations = record(root.animations);
if (animations === undefined) throw new Error("Sprite JSON has no animations");
const frameNames = Object.values(animations).flatMap((value) => (
  Array.isArray(value) ? value.filter((name): name is string => typeof name === "string") : []
));
const unique = new Set(frameNames);
console.log(`animations=${JSON.stringify(animations)}`);
console.log(`frames=${frameNames.length} unique=${unique.size}`);
for (const name of unique) {
  const data = await pixels(`${framesPath}/${name}.png`);
  console.log(`${name} ${metrics(data)}`);
}
