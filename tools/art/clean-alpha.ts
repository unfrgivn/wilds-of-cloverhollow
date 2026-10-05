#!/usr/bin/env bun
export {};

type Point = { x: number; y: number };

function value(name: string, fallback: string): string {
  const index = Bun.argv.indexOf(`--${name}`);
  return index >= 0 ? Bun.argv[index + 1] ?? fallback : fallback;
}

async function dimensions(input: string): Promise<{ width: number; height: number }> {
  const process = Bun.spawn(
    ["magick", "identify", "-format", "%w:%h", input],
    { stdout: "pipe", stderr: "inherit" },
  );
  const text = await new Response(process.stdout).text();
  if (await process.exited !== 0) throw new Error(`Could not identify ${input}`);
  const parts = text.trim().split(":").map(Number);
  const width = parts[0];
  const height = parts[1];
  if (width === undefined || height === undefined) throw new Error("Invalid dimensions");
  return { width, height };
}

const input = value("input", "");
const output = value("output", input);
const key = value("key", "#00FF00");
const despill = value("despill", "global-green");
const keepAll = value("keep-all", "false") === "true";
if (input.length === 0) throw new Error("--input is required");
const keyed = `${output}.keyed.png`;
const keyProcess = Bun.spawn([
  "bun", "tools/art/key-alpha.ts", "--input", input, "--output", keyed,
  "--key", key, "--despill", despill,
], { stdout: "inherit", stderr: "inherit" });
if (await keyProcess.exited !== 0) throw new Error("Keying failed");
const { width, height } = await dimensions(keyed);
const read = Bun.spawn(
  ["magick", keyed, "-alpha", "on", "-depth", "8", "rgba:-"],
  { stdout: "pipe", stderr: "inherit" },
);
const pixels = new Uint8Array(await new Response(read.stdout).arrayBuffer());
if (await read.exited !== 0 || pixels.length < width * height * 4) {
  throw new Error(`Could not read ${input}`);
}

const opaque = new Uint8Array(width * height);
for (let index = 0; index < opaque.length; index += 1) {
  opaque[index] = (pixels[index * 4 + 3] ?? 0) > 0 ? 1 : 0;
}
const seen = new Uint8Array(opaque.length);
const components: Array<{ area: number; points: Point[] }> = [];
for (let index = 0; index < opaque.length; index += 1) {
  if (opaque[index] === 0 || seen[index] === 1) continue;
  const queue = [index];
  const points: Point[] = [];
  seen[index] = 1;
  while (queue.length > 0) {
    const current = queue.pop();
    if (current === undefined) continue;
    const x = current % width;
    const y = Math.floor(current / width);
    points.push({ x, y });
    const neighbors = [
      [-1, -1], [-1, 0], [-1, 1], [0, -1],
      [0, 1], [1, -1], [1, 0], [1, 1],
    ] as const;
    for (const [dx, dy] of neighbors) {
      const nextX = x + dx;
      const nextY = y + dy;
      if (nextX < 0 || nextX >= width || nextY < 0 || nextY >= height) continue;
      const next = nextY * width + nextX;
      if (opaque[next] === 1 && seen[next] === 0) {
        seen[next] = 1;
        queue.push(next);
      }
    }
  }
  components.push({ area: points.length, points });
}
const largest = Math.max(...components.map((component) => component.area), 0);
const largestComponent = components.find((component) => component.area === largest);
for (const component of components) {
  if (keepAll || component === largestComponent) continue;
  for (const point of component.points) pixels[(point.y * width + point.x) * 4 + 3] = 0;
}
if (despill === "global-green") {
  for (let index = 0; index < width * height; index += 1) {
    const offset = index * 4;
    const opacity = pixels[offset + 3] ?? 0;
    if (opacity === 0) continue;
    const red = pixels[offset] ?? 0;
    const blue = pixels[offset + 2] ?? 0;
    pixels[offset + 1] = Math.min(pixels[offset + 1] ?? 0, Math.max(red, blue));
  }
}
const eroded = new Uint8Array(pixels);
for (let y = 0; y < height; y += 1) {
  for (let x = 0; x < width; x += 1) {
    const index = y * width + x;
    if ((pixels[index * 4 + 3] ?? 0) === 0) continue;
    const neighbors = [
      [-1, -1], [-1, 0], [-1, 1], [0, -1],
      [0, 1], [1, -1], [1, 0], [1, 1],
    ] as const;
    for (const [dx, dy] of neighbors) {
      const neighborX = x + dx;
      const neighborY = y + dy;
      if (neighborX < 0 || neighborX >= width || neighborY < 0 || neighborY >= height) {
        eroded[index * 4 + 3] = 0;
        break;
      }
      const neighbor = neighborY * width + neighborX;
      if ((pixels[neighbor * 4 + 3] ?? 0) === 0) {
        eroded[index * 4 + 3] = 0;
        break;
      }
    }
  }
}
pixels.set(eroded);
const write = Bun.spawn(
  ["magick", "-size", `${width}x${height}`, "-depth", "8", "rgba:-", output],
  { stdin: "pipe", stdout: "inherit", stderr: "inherit" },
);
if (write.stdin === null) throw new Error("Could not open ImageMagick input");
await write.stdin.write(pixels);
await write.stdin.end();
if (await write.exited !== 0) throw new Error(`Could not write ${output}`);
await Bun.file(keyed).delete();
