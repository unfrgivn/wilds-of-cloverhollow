#!/usr/bin/env bun
// Deterministically builds Ranger Fern's blinking 4x1 character atlas
// (`public/assets/characters/fern/fern.{png,json}`) from
// `art/source/sanctuary/fern/sheet-raw.png`.
export {};

const source = "art/source/sanctuary/fern/sheet-raw.png";
const frames = "art/scratch/fern-build-frames";
const frameNames = ["down_idle_01", "down_idle_02", "left_idle_01", "right_idle_01"] as const;
const cells = [[0, 0], [1, 0], [0, 1], [1, 1]] as const;

async function run(command: string[]): Promise<void> {
  const proc = Bun.spawn(command, { stdout: "inherit", stderr: "inherit" });
  if (await proc.exited !== 0) throw new Error(`Command failed: ${command.join(" ")}`);
}

await run(["rm", "-rf", frames]);
await run(["mkdir", "-p", frames, "public/assets/characters/fern"]);

for (let i = 0; i < frameNames.length; i += 1) {
  const name = frameNames[i]!;
  const [col, row] = cells[i]!;
  const cropPath = `${frames}/crop-${name}.png`;
  const framePath = `${frames}/${name}.png`;
  await run([
    "magick", source, "-crop", `1024x1024+${col * 1024}+${row * 1024}`, "+repage", cropPath,
  ]);
  await run(["bun", "tools/art/postprocess.ts", "--input", cropPath, "--output", framePath,
    "--width", "448", "--height", "448", "--figure-height", "336", "--bottom-margin", "8",
    "--key", "#FF00FF", "--fuzz", "25%", "--despill", "edge", "--holes"]);
  await run(["bun", "tools/art/drop-islands.ts", "--input", framePath, "--output", framePath,
    "--min", "80"]);
  const despilled = `${frames}/${name}-despill.png`;
  await run(["bun", "tools/art/despill-edge.ts", "--input", framePath, "--output", despilled,
    "--key", "magenta", "--band", "12"]);
  await run(["mv", despilled, framePath]);
}

const atlas = "public/assets/characters/fern/fern.webp";
await run(["magick", "montage", ...frameNames.map((n) => `${frames}/${n}.png`),
  "-tile", "4x1", "-geometry", "448x448+0+0", "-background", "none",
  "-quality", "92", "-define", "webp:alpha-quality=100", atlas]);

const records: Record<string, unknown> = {};
for (let i = 0; i < frameNames.length; i += 1) {
  records[frameNames[i]!] = {
    frame: { x: i * 448, y: 0, w: 448, h: 448 },
    rotated: false,
    trimmed: true,
    spriteSourceSize: { x: 0, y: 0, w: 448, h: 448 },
    sourceSize: { w: 448, h: 448 },
    anchor: { x: 0.5, y: 439 / 448 },
  };
}
await Bun.write("public/assets/characters/fern/fern.json", `${JSON.stringify({
  frames: records,
  animations: {
    idle_down: ["down_idle_01", "down_idle_02"],
    idle_left: ["left_idle_01"],
    idle_right: ["right_idle_01"],
  },
  meta: {
    image: "fern.webp",
    size: { w: 1792, h: 448 },
    scale: "1",
    baseline: 439,
  },
}, null, 2)}\n`);
console.log("fern atlas rebuilt");
