#!/usr/bin/env bun
// Deterministically builds the 6-item Chef Mateo's Taco Truck ingredients atlas
// (`public/assets/arcade/taco-ingredients.{webp,json}`) from
// `art/source/arcade/taco/ingredients-raw.png`.
export {};

const source = "art/source/arcade/taco/ingredients-raw.png";
const scratch = "art/scratch/taco-build";
const frames = `${scratch}/frames`;
const names = ["shell", "beans", "cheese", "salsa", "avocado", "lime"] as const;
const key = ["#FF00FF", "22%"] as const;

async function run(command: string[]): Promise<void> {
  const child = Bun.spawn(command, { stdout: "inherit", stderr: "inherit" });
  if (await child.exited !== 0) throw new Error(`Command failed: ${command.join(" ")}`);
}

await run(["rm", "-rf", scratch]);
await run(["mkdir", "-p", frames, "public/assets/arcade"]);

// 2528x1696 3x2 grid: the taco shell in col 0 extends slightly past 1/3 width,
// so split along the clean empty magenta gutters between columns.
const colX = [0, 896, 1685] as const;
const colW = [896, 789, 843] as const;
const cellH = Math.floor(1696 / 2);

for (let i = 0; i < names.length; i += 1) {
  const name = names[i]!;
  const col = i % 3;
  const row = Math.floor(i / 3);
  const crop = `${frames}/${name}-crop.png`;
  const keyed = `${frames}/${name}-keyed.png`;
  const out = `${frames}/${name}.png`;
  await run(["magick", source, "-crop", `${colW[col]}x${cellH}+${colX[col]}+${row * cellH}`,
    "+repage", crop]);
  await run(["bun", "tools/art/key-alpha.ts", "--input", crop, "--output", keyed,
    "--key", key[0], "--fuzz", key[1], "--holes"]);
  await run(["magick", keyed, "-trim", "+repage", "-filter", "Lanczos",
    "-resize", "220x220", "-background", "none", "-gravity", "center",
    "-extent", "256x256", out]);
  await run(["bun", "tools/art/drop-islands.ts", "--input", out, "--output", out, "--min", "20"]);
  const despilled = `${frames}/${name}-despill.png`;
  await run(["bun", "tools/art/despill-edge.ts", "--input", out, "--output", despilled,
    "--key", "magenta", "--band", "8"]);
  await run(["mv", despilled, out]);
}

const atlas = "public/assets/arcade/taco-ingredients.webp";
await run(["magick", "montage", ...names.map((n) => `${frames}/${n}.png`),
  "-tile", "3x2", "-geometry", "256x256+0+0", "-background", "none",
  "-quality", "92", "-define", "webp:alpha-quality=100", atlas]);

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
await Bun.write("public/assets/arcade/taco-ingredients.json", `${JSON.stringify({
  frames: frameRecords,
  meta: {
    image: "taco-ingredients.webp",
    size: { w: 768, h: 512 },
    scale: "1",
  },
}, null, 2)}\n`);
console.log("taco-ingredients atlas rebuilt");
