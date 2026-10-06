#!/usr/bin/env bun
export {};

type Pixel = { r: number; g: number; b: number; a: number };

function value(name: string, fallback: string): string {
  const index = Bun.argv.indexOf(`--${name}`);
  return index >= 0 ? Bun.argv[index + 1] ?? fallback : fallback;
}

function keyRgb(valueText: string): Pixel {
  const value = valueText.replace("#", "");
  if (value.length !== 6) throw new Error(`Invalid key ${valueText}`);
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16),
    a: 255,
  };
}

async function size(path: string): Promise<{ width: number; height: number }> {
  const process = Bun.spawn(["magick", "identify", "-format", "%w:%h", path], {
    stdout: "pipe",
    stderr: "inherit",
  });
  const text = await new Response(process.stdout).text();
  if (await process.exited !== 0) throw new Error(`Could not identify ${path}`);
  const [widthText, heightText] = text.trim().split(":");
  const width = Number(widthText);
  const height = Number(heightText);
  if (!Number.isFinite(width) || !Number.isFinite(height)) throw new Error("Invalid size");
  return { width, height };
}

function distance(left: Pixel, right: Pixel): number {
  return Math.max(
    Math.abs(left.r - right.r),
    Math.abs(left.g - right.g),
    Math.abs(left.b - right.b),
  );
}

function edgeDistance(pixels: Pixel[], width: number, height: number): Uint16Array {
  const distances = new Uint16Array(pixels.length);
  distances.fill(99);
  const queue: number[] = [];
  for (let index = 0; index < pixels.length; index += 1) {
    if (pixels[index]?.a === 0) {
      distances[index] = 0;
      queue.push(index);
    }
  }
  while (queue.length > 0) {
    const index = queue.shift();
    if (index === undefined) continue;
    const nextDistance = (distances[index] ?? 99) + 1;
    const x = index % width;
    const neighbors = [index - 1, index + 1, index - width, index + width];
    for (const next of neighbors) {
      if (next < 0 || next >= pixels.length || (distances[next] ?? 99) <= nextDistance) continue;
      const nextX = next % width;
      if (Math.abs(nextX - x) > 1) continue;
      distances[next] = nextDistance;
      queue.push(next);
    }
  }
  return distances;
}

const input = value("input", "");
const output = value("output", "");
const key = keyRgb(value("key", "#FF00FF"));
const fuzzText = value("fuzz", "18%").replace("%", "");
const fuzz = Number(fuzzText) * 2.55;
const despill = value("despill", "global-green");
// --holes also keys background enclosed by the figure (a ring's hole), which a
// flood from the border can't reach. Safe because the key is a colour the
// subject never uses (AGENTS.md); off by default so existing builds are unchanged.
const holes = Bun.argv.includes("--holes");
if (input.length === 0 || output.length === 0) throw new Error("--input and --output are required");
if (!["edge", "global-green", "none"].includes(despill)) throw new Error("Invalid --despill");
const dimensions = await size(input);
const read = Bun.spawn(["magick", input, "-alpha", "on", "-depth", "8", "rgba:-"], {
  stdout: "pipe",
  stderr: "inherit",
});
const bytes = new Uint8Array(await new Response(read.stdout).arrayBuffer());
if (await read.exited !== 0 || bytes.length < dimensions.width * dimensions.height * 4) {
  throw new Error(`Could not read ${input}`);
}
const pixels: Pixel[] = [];
for (let index = 0; index < dimensions.width * dimensions.height; index += 1) {
  const offset = index * 4;
  pixels.push({
    r: bytes[offset] ?? 0,
    g: bytes[offset + 1] ?? 0,
    b: bytes[offset + 2] ?? 0,
    a: bytes[offset + 3] ?? 0,
  });
}
const queue: number[] = [];
const seen = new Uint8Array(pixels.length);
for (let y = 0; y < dimensions.height; y += 1) {
  for (const x of [0, dimensions.width - 1]) queue.push(y * dimensions.width + x);
}
for (let x = 0; x < dimensions.width; x += 1) {
  queue.push(x, (dimensions.height - 1) * dimensions.width + x);
}
while (queue.length > 0) {
  const index = queue.shift();
  if (index === undefined || seen[index] === 1) continue;
  const pixel = pixels[index];
  if (pixel === undefined || distance(pixel, key) > fuzz) continue;
  seen[index] = 1;
  pixel.a = 0;
  const x = index % dimensions.width;
  const neighbors = [index - 1, index + 1, index - dimensions.width, index + dimensions.width];
  for (const next of neighbors) {
    if (next < 0 || next >= pixels.length) continue;
    if (Math.abs((next % dimensions.width) - x) <= 1) queue.push(next);
  }
}
if (holes) {
  for (const [index, pixel] of pixels.entries()) {
    if (seen[index] === 0 && distance(pixel, key) <= fuzz) pixel.a = 0;
  }
}
const edge = edgeDistance(pixels, dimensions.width, dimensions.height);
for (const [index, pixel] of pixels.entries()) {
  const shouldDespill = despill === "global-green"
    || (despill === "edge" && (edge[index] ?? 99) <= 3);
  if (!shouldDespill || pixel.a === 0) continue;
  if (despill === "global-green") pixel.g = Math.min(pixel.g, Math.max(pixel.r, pixel.b));
  else if (key.r > 200 && key.b > 200 && key.g < 80) {
    pixel.r = Math.min(pixel.r, pixel.g);
    pixel.b = Math.min(pixel.b, pixel.g);
  }
}
const outputBytes = new Uint8Array(pixels.length * 4);
for (const [index, pixel] of pixels.entries()) {
  const offset = index * 4;
  outputBytes[offset] = pixel.r;
  outputBytes[offset + 1] = pixel.g;
  outputBytes[offset + 2] = pixel.b;
  outputBytes[offset + 3] = pixel.a;
}
const write = Bun.spawn(["magick", "-size", `${dimensions.width}x${dimensions.height}`,
  "-depth", "8", "rgba:-", output], { stdin: "pipe", stderr: "inherit" });
if (write.stdin === null) throw new Error("Could not open ImageMagick input");
await write.stdin.write(outputBytes);
await write.stdin.end();
if (await write.exited !== 0) throw new Error(`Could not write ${output}`);
