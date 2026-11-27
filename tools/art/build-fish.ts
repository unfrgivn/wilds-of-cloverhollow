#!/usr/bin/env bun
// Deterministically builds the 6-item Bubblegum Bay fishing catches atlas
// (`public/assets/arcade/fish-catches.{png,json}`) from
// `art/source/arcade/fishing/catches-raw.png`.
export {};

const source = "art/source/arcade/fishing/catches-raw.png";
const scratch = "art/scratch/fishing-build";
const extracted = `${scratch}/extracted`;
const frames = `${scratch}/frames`;
const names = ["minnow", "perch", "shell", "koi", "jelly", "starfish"] as const;
const key = ["#07CA18", "22%"] as const;

async function run(command: string[]): Promise<void> {
  const child = Bun.spawn(command, { stdout: "inherit", stderr: "inherit" });
  if (await child.exited !== 0) throw new Error(`Command failed: ${command.join(" ")}`);
}

await run(["rm", "-rf", scratch]);
await run(["mkdir", "-p", extracted, frames, "public/assets/arcade"]);
await run(["bun", "tools/art/extract-figures.ts", "--input", source, "--output", extracted,
  "--expected", "6", "--key", key[0], "--fuzz", key[1]]);

for (let i = 0; i < names.length; i += 1) {
  const name = names[i]!;
  const raw = `${extracted}/raw-${String(i + 1).padStart(2, "0")}.png`;
  const keyed = `${frames}/${name}-keyed.png`;
  const out = `${frames}/${name}.png`;
  await run(["bun", "tools/art/key-alpha.ts", "--input", raw, "--output", keyed,
    "--key", key[0], "--fuzz", key[1], "--holes"]);
  await run(["magick", keyed, "-trim", "+repage", "-filter", "Lanczos",
    "-resize", "224x224", "-background", "none", "-gravity", "center",
    "-extent", "256x256", out]);
  await run(["bun", "tools/art/drop-islands.ts", "--input", out, "--output", out, "--min", "50"]);
  const despilled = `${frames}/${name}-despill.png`;
  await run(["bun", "tools/art/despill-edge.ts", "--input", out, "--output", despilled,
    "--key", "green", "--band", "6"]);
  await run(["mv", despilled, out]);
}

const atlas = "public/assets/arcade/fish-catches.png";
await run(["magick", "montage", ...names.map((n) => `${frames}/${n}.png`),
  "-tile", "3x2", "-geometry", "256x256+0+0", "-background", "none", atlas]);

const frameRecords: Record<string, unknown> = {};
for (let i = 0; i < names.length; i += 1) {
  const col = i % 3;
  const row = Math.floor(i / 3);
  frameRecords[names[i]!] = {
    frame: { x: col * 256, y: row * 256, w: 256, h: 256 },
    rotated: false,
    trimmed: true,
    spriteSourceSize: { x: 0, y: 0, w: 256, h: 256 },
    sourceSize: { w: 256, h: 256 },
    anchor: { x: 0.5, y: 0.5 },
  };
}
await Bun.write("public/assets/arcade/fish-catches.json", `${JSON.stringify({
  frames: frameRecords,
  meta: {
    image: "fish-catches.png",
    size: { w: 768, h: 512 },
    scale: "1",
  },
}, null, 2)}\n`);
console.log("fish-catches atlas rebuilt");
