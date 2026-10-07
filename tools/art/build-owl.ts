#!/usr/bin/env bun
// Rebuilds the owl atlas byte for byte from the selected raw sources.
//
// The body sheet is a 2x2 grid:   chaos idle | chaos burst
//                                 soothed    | calm idle
// Each figure is found whole by connected components: the four largest are
// the bodies, and every smaller mark (the burst's swirls and bubbles, the
// sparkles) belongs to the body in its grid cell. A body is named by its grid
// cell, never by sorting centroids (the burst's raised wings lift its centroid
// above the idle bird's, which once swapped the two). One scale, the one that
// makes the chaos idle body 380 px tall, is applied to every figure, so the
// bird keeps its size from pose to pose.
export {};

type Point = { x: number; y: number };
type Bounds = { left: number; top: number; right: number; bottom: number };
type Component = { area: number; bounds: Bounds; centre: Point };
type Body = { name: string; component: Component; bounds: Bounds };

const frames = "art/scratch/owl-build-frames";
const sheet = "art/source/critters/owl/body-sheet-raw.png";
const keyed = `${frames}/sheet-keyed.png`;
const size = 2048;
const grid = [
  ["chaos_idle_01", "chaos_burst_01"],
  ["soothed_01", "calm_idle_01"],
];
const names = grid.flat();
const idleBodyHeight = 380;
const padding = 12;
const neighbours: [number, number][] = [[-1, 0], [1, 0], [0, -1], [0, 1]];

async function run(command: string[]): Promise<void> {
  const child = Bun.spawn(command, { stdout: "inherit", stderr: "inherit" });
  if (await child.exited !== 0) throw new Error(`Command failed: ${command.join(" ")}`);
}

async function output(command: string[]): Promise<Uint8Array> {
  const child = Bun.spawn(command, { stdout: "pipe", stderr: "inherit" });
  const bytes = new Uint8Array(await new Response(child.stdout).arrayBuffer());
  if (await child.exited !== 0) throw new Error(`Command failed: ${command.join(" ")}`);
  return bytes;
}

function components(alpha: Uint8Array): Component[] {
  const seen = new Uint8Array(alpha.length);
  const result: Component[] = [];
  for (let start = 0; start < alpha.length; start += 1) {
    if ((alpha[start] ?? 0) === 0 || seen[start] !== 0) continue;
    const queue = [start];
    seen[start] = 1;
    let area = 0;
    let sumX = 0;
    let sumY = 0;
    const bounds: Bounds = { left: size, top: size, right: 0, bottom: 0 };
    for (let index = queue.pop(); index !== undefined; index = queue.pop()) {
      const x = index % size;
      const y = Math.floor(index / size);
      area += 1;
      sumX += x;
      sumY += y;
      bounds.left = Math.min(bounds.left, x);
      bounds.right = Math.max(bounds.right, x + 1);
      bounds.top = Math.min(bounds.top, y);
      bounds.bottom = Math.max(bounds.bottom, y + 1);
      for (const [dx, dy] of neighbours) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || nx >= size || ny < 0 || ny >= size) continue;
        const next = ny * size + nx;
        if ((alpha[next] ?? 0) !== 0 && seen[next] === 0) {
          seen[next] = 1;
          queue.push(next);
        }
      }
    }
    if (area >= 100) result.push({ area, bounds, centre: { x: sumX / area, y: sumY / area } });
  }
  return result;
}

function cellName(point: Point): string {
  const name = grid[point.y < size / 2 ? 0 : 1]?.[point.x < size / 2 ? 0 : 1];
  if (name === undefined) throw new Error(`No grid cell at ${point.x}, ${point.y}`);
  return name;
}

await run(["rm", "-rf", frames]);
await run(["mkdir", "-p", frames]);
await run(["bun", "tools/art/key-alpha.ts", "--input", sheet, "--output", keyed,
  "--key", "#00FF00", "--fuzz", "35%", "--despill", "edge", "--holes"]);
const alpha = await output(["magick", keyed, "-alpha", "extract", "-threshold", "1%",
  "-depth", "8", "gray:-"]);
await Bun.file(keyed).delete();

const found = components(alpha).sort((left, right) => right.area - left.area);
const bodies = new Map<string, Body>();
for (const component of found.slice(0, 4)) {
  const name = cellName(component.centre);
  if (bodies.has(name)) throw new Error(`Two bodies in the ${name} cell`);
  bodies.set(name, { name, component, bounds: { ...component.bounds } });
}
for (const mark of found.slice(4)) {
  const body = bodies.get(cellName(mark.centre));
  if (body === undefined) throw new Error(`A mark with no body at ${mark.centre.x}`);
  body.bounds.left = Math.min(body.bounds.left, mark.bounds.left);
  body.bounds.top = Math.min(body.bounds.top, mark.bounds.top);
  body.bounds.right = Math.max(body.bounds.right, mark.bounds.right);
  body.bounds.bottom = Math.max(body.bounds.bottom, mark.bounds.bottom);
}

const idle = bodies.get("chaos_idle_01");
if (idle === undefined) throw new Error("No chaos idle body");
const idleHeight = idle.component.bounds.bottom - idle.component.bounds.top;
const scalePercent = ((idleBodyHeight / idleHeight) * 100).toFixed(4);
for (const name of names) {
  const body = bodies.get(name);
  if (body === undefined) throw new Error(`No ${name} body`);
  const left = Math.max(0, body.bounds.left - padding);
  const top = Math.max(0, body.bounds.top - padding);
  const right = Math.min(size, body.bounds.right + padding);
  const bottom = Math.min(size, body.bounds.bottom + padding);
  const source = `${frames}/source-${name}.png`;
  await run(["magick", sheet, "-crop", `${right - left}x${bottom - top}+${left}+${top}`,
    "+repage", source]);
  const frame = `${frames}/${name}.png`;
  await run(["bun", "tools/art/postprocess.ts", "--input", source, "--output", frame,
    "--width", "512", "--height", "512", "--scale-percent", scalePercent,
    "--bottom-margin", "8", "--key", "#00FF00", "--fuzz", "35%", "--despill", "edge",
    "--holes"]);
  await run(["bun", "tools/art/drop-islands.ts", "--input", frame, "--output", frame,
    "--min", "120"]);
  await run(["bun", "tools/art/despill-edge.ts", "--input", frame, "--output", frame,
    "--key", "green", "--band", "6"]);
}

const auraAlpha = `${frames}/aura-alpha.png`;
const auraScaled = `${frames}/aura-scaled.png`;
// The chaos aura is the generic purple swirl every critter shares; the owl
// uses the hamster's raw, lifted and placed the way build-hamster.ts does.
await run(["bun", "tools/art/white-to-alpha.ts", "--input",
  "art/source/critters/hamster/aura-white-raw.png", "--output", auraAlpha]);
await run(["magick", auraAlpha, "-trim", "+repage", "-resize", "20%", auraScaled]);
await run(["magick", "-size", "512x512", "xc:none", auraScaled, "-gravity", "center",
  "-geometry", "+0+0", "-composite", `${frames}/chaos_aura_01.png`]);

const atlasNames = [...names, "chaos_aura_01"];
await run(["magick", "montage", ...atlasNames.map((name) => `${frames}/${name}.png`),
  "-tile", "3x2", "-geometry", "512x512+0+0", "-background", "none",
  "public/assets/critters/owl/owl.png"]);
const frameData = Object.fromEntries(atlasNames.map((name, index) => [name, {
  frame: { x: (index % 3) * 512, y: Math.floor(index / 3) * 512, w: 512, h: 512 },
  rotated: false,
  trimmed: true,
  spriteSourceSize: { x: 0, y: 0, w: 512, h: 512 },
  sourceSize: { w: 512, h: 512 },
  anchor: { x: 0.5, y: 0.984375 },
}]));
const atlas = {
  frames: frameData,
  animations: Object.fromEntries(atlasNames.map((name) => [name.replace(/_01$/, ""), [name]])),
  meta: { image: "owl.png", size: { w: 1536, h: 1024 }, scale: "1", baseline: 504 },
};
await Bun.write("public/assets/critters/owl/owl.json",
  `${JSON.stringify(atlas, null, 2)}\n`);
