#!/usr/bin/env bun
// Rebuilds the squirrel atlas using the same connected-component 2x2-sheet
// method and uniform body scale as the approved bluebird build.
export {};

const source = "art/source/critters/squirrel";
const frames = "art/scratch/squirrel-build-frames";
const names = ["chaos_idle_01", "chaos_burst_01", "soothed_01", "calm_idle_01"];
const grid = [
  [names[0], names[1]],
  [names[2], names[3]],
];
const size = 2048;
const padding = 12;
const targetHeight = 380;
const neighbours: [number, number][] = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];
type Bounds = { left: number; top: number; right: number; bottom: number };
type Component = { area: number; bounds: Bounds; x: number; y: number };
async function run(command: string[]): Promise<void> {
  const child = Bun.spawn(command, { stdout: "inherit", stderr: "inherit" });
  if ((await child.exited) !== 0) throw new Error(`Command failed: ${command.join(" ")}`);
}
async function output(command: string[]): Promise<Uint8Array> {
  const child = Bun.spawn(command, { stdout: "pipe", stderr: "inherit" });
  const bytes = new Uint8Array(await new Response(child.stdout).arrayBuffer());
  if ((await child.exited) !== 0) throw new Error(`Command failed: ${command.join(" ")}`);
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
    if (area >= 100) result.push({ area, bounds, x: sumX / area, y: sumY / area });
  }
  return result;
}
function cellName(x: number, y: number): string {
  const name = grid[y < size / 2 ? 0 : 1]?.[x < size / 2 ? 0 : 1];
  if (name === undefined) throw new Error("No grid cell");
  return name;
}
await run(["rm", "-rf", frames]);
await run(["mkdir", "-p", frames]);
const prepared = `${frames}/prepared.png`;
await run([
  "magick",
  `${source}/body-sheet-raw.png`,
  "-fuzz",
  "10%",
  "-fill",
  "#00FF00",
  "-draw",
  "color 0,0 floodfill",
  "-fuzz",
  "20%",
  "-transparent",
  "#FF00FF",
  prepared,
]);
const keyed = `${frames}/sheet-keyed.png`;
await run([
  "bun",
  "tools/art/key-alpha.ts",
  "--input",
  prepared,
  "--output",
  keyed,
  "--key",
  "#00FF00",
  "--fuzz",
  "65%",
  "--despill",
  "edge",
]);
const alpha = await output([
  "magick",
  keyed,
  "-alpha",
  "extract",
  "-threshold",
  "1%",
  "-depth",
  "8",
  "gray:-",
]);
await Bun.file(keyed).delete();
const bodies = new Map<string, { component: Component; bounds: Bounds }>();
for (const component of components(alpha)
  .sort((a, b) => b.area - a.area)
  .slice(0, 4)) {
  const name = cellName(component.x, component.y);
  if (bodies.has(name)) throw new Error(`Two bodies in ${name}`);
  bodies.set(name, { component, bounds: { ...component.bounds } });
}
for (const mark of components(alpha)
  .sort((a, b) => b.area - a.area)
  .slice(4)) {
  const body = bodies.get(cellName(mark.x, mark.y));
  if (body === undefined) throw new Error("Effect has no body");
  body.bounds.left = Math.min(body.bounds.left, mark.bounds.left);
  body.bounds.top = Math.min(body.bounds.top, mark.bounds.top);
  body.bounds.right = Math.max(body.bounds.right, mark.bounds.right);
  body.bounds.bottom = Math.max(body.bounds.bottom, mark.bounds.bottom);
}
const idleName = names[0];
if (idleName === undefined) throw new Error("No idle name");
const idle = bodies.get(idleName);
if (idle === undefined) throw new Error("No idle body");
const scale = (
  (targetHeight / (idle.component.bounds.bottom - idle.component.bounds.top)) *
  100
).toFixed(4);
for (const name of names) {
  const body = bodies.get(name);
  if (body === undefined) throw new Error(`No ${name}`);
  const left = Math.max(0, body.bounds.left - padding);
  const top = Math.max(0, body.bounds.top - padding);
  const right = Math.min(size, body.bounds.right + padding);
  const bottom = Math.min(size, body.bounds.bottom + padding);
  const raw = `${frames}/source-${name}.png`;
  const frame = `${frames}/${name}.png`;
  await run([
    "magick",
    prepared,
    "-crop",
    `${right - left}x${bottom - top}+${left}+${top}`,
    "+repage",
    raw,
  ]);
  await run([
    "bun",
    "tools/art/postprocess.ts",
    "--input",
    raw,
    "--output",
    frame,
    "--width",
    "512",
    "--height",
    "512",
    "--scale-percent",
    scale,
    "--bottom-margin",
    "8",
    "--key",
    "#00FF00",
    "--fuzz",
    "65%",
    "--despill",
    "edge",
  ]);
  await run([
    "bun",
    "tools/art/drop-islands.ts",
    "--input",
    frame,
    "--output",
    frame,
    "--min",
    "120",
  ]);
  await run([
    "bun",
    "tools/art/despill-edge.ts",
    "--input",
    frame,
    "--output",
    frame,
    "--key",
    "green",
    "--band",
    "2",
  ]);
}
const aura = `${frames}/chaos_aura_01.png`;
const auraAlpha = `${frames}/aura-alpha.png`;
const auraScaled = `${frames}/aura-scaled.png`;
await run([
  "bun",
  "tools/art/white-to-alpha.ts",
  "--input",
  `${source}/aura-white-raw.png`,
  "--output",
  auraAlpha,
]);
await run(["magick", auraAlpha, "-trim", "+repage", "-resize", "20%", auraScaled]);
await run([
  "magick",
  "-size",
  "512x512",
  "xc:none",
  auraScaled,
  "-gravity",
  "center",
  "-geometry",
  "+0+0",
  "-composite",
  aura,
]);
const atlasNames = [...names, "chaos_aura_01"];
await run([
  "magick",
  "montage",
  ...atlasNames.map((name) => `${frames}/${name}.png`),
  "-tile",
  "3x2",
  "-geometry",
  "512x512+0+0",
  "-background",
  "none",
  "public/assets/critters/squirrel/squirrel.png",
]);
const frameData: Record<string, unknown> = {};
for (const [index, name] of atlasNames.entries())
  frameData[name] = {
    frame: { x: (index % 3) * 512, y: Math.floor(index / 3) * 512, w: 512, h: 512 },
    rotated: false,
    trimmed: true,
    spriteSourceSize: { x: 0, y: 0, w: 512, h: 512 },
    sourceSize: { w: 512, h: 512 },
    anchor: { x: 0.5, y: 0.984375 },
  };
const atlas = {
  frames: frameData,
  animations: Object.fromEntries(atlasNames.map((name) => [name.replace(/_01$/, ""), [name]])),
  meta: { image: "squirrel.png", size: { w: 1536, h: 1024 }, scale: "1", baseline: 504 },
};
await Bun.write(
  "public/assets/critters/squirrel/squirrel.json",
  `${JSON.stringify(atlas, null, 2)}\n`,
);
