#!/usr/bin/env bun
export {};
type Frame = { name: string; path: string; width: number; height: number };
type JsonValue = string | number | boolean | JsonValue[] | JsonRecord;
type JsonRecord = { [key: string]: JsonValue };
type PackedFrame = { name: string; data: JsonRecord };

function value(name: string, fallback: string): string {
  const index = Bun.argv.indexOf(`--${name}`);
  return index >= 0 ? Bun.argv[index + 1] ?? fallback : fallback;
}

const input = value("input", "art/scratch/fae-frames");
const output = value("output", "public/assets/characters/fae/fae.png");
const jsonOutput = value("json", output.replace(/\.png$/, ".json"));
const width = Number(value("width", "384"));
const height = Number(value("height", "384"));
const columns = Number(value("columns", "5"));
const baseline = Number(value("baseline", "375"));
const walkEntries = await Array.fromAsync(
  new Bun.Glob("*_walk_*.png").scan({ cwd: input }),
);
const idleEntries = await Array.fromAsync(
  new Bun.Glob("*_idle_*.png").scan({ cwd: input }),
);
const entries = [...new Set([...walkEntries, ...idleEntries])].sort();

if (entries.length === 0) throw new Error(`No PNG frames in ${input}`);

const frames: Frame[] = entries.map((name) => ({
  name: name.replace(/\.png$/, ""),
  path: `${input}/${name}`,
  width,
  height,
}));
const directory = output.slice(0, output.lastIndexOf("/"));
const mkdir = Bun.spawn(["mkdir", "-p", directory]);
if (await mkdir.exited !== 0) throw new Error(`Could not create ${directory}`);

const montage = Bun.spawn(
  [
    "magick", "montage", ...frames.map((frame) => frame.path),
    "-tile", `${columns}x`, "-geometry", `${width}x${height}+0+0`,
    "-background", "none", "-alpha", "on", output,
  ],
  { stdout: "inherit", stderr: "inherit" },
);
if (await montage.exited !== 0) throw new Error("ImageMagick atlas packing failed");

const packedFrames: PackedFrame[] = [];
for (const [index, frame] of frames.entries()) {
  packedFrames.push({
    name: frame.name,
    data: {
      frame: {
        x: (index % columns) * width,
        y: Math.floor(index / columns) * height,
        w: width,
        h: height,
      },
      rotated: false,
      trimmed: true,
      spriteSourceSize: { x: 0, y: 0, w: width, h: height },
      sourceSize: { w: width, h: height },
      anchor: { x: 0.5, y: baseline / height },
    },
  });
}

const animations: Record<string, string[]> = {};
for (const direction of ["down", "up", "left"]) {
  animations[`walk_${direction}`] = frames
    .filter((frame) => frame.name.startsWith(`${direction}_walk_`))
    .map((frame) => frame.name);
  animations[`idle_${direction}`] = frames
    .filter((frame) => frame.name.startsWith(`${direction}_idle_`))
    .map((frame) => frame.name);
}

const sheet = {
  frames: Object.fromEntries(
    packedFrames.map((frame) => [frame.name, frame.data]),
  ),
  animations,
  meta: {
    image: output.split("/").pop() ?? "fae.png",
    size: { w: columns * width, h: Math.ceil(frames.length / columns) * height },
    scale: "1",
    baseline,
  },
};
await Bun.write(jsonOutput, JSON.stringify(sheet, null, 2));
console.log(`${output}\n${jsonOutput}`);
