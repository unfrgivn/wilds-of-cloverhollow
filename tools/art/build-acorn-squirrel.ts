#!/usr/bin/env bun
// Rebuilds the Acorn Squirrel's follower atlas (Milestone 60) byte for byte
// from the selected raw sources in art/source/acorn-squirrel, the way the Pond
// Pup's is built (build-pond-pup.ts): each sheet cut into whole figures, keyed on
// green (he is red-brown, cream, pink, and acorn brown), despilled along the
// alpha edge only, and scaled by ONE factor per sheet.
//
// The factors keep his head one size from every side: each sheet's acorn cap,
// measured across its outline, is brought to the model sheet's cap for that
// view (front 123 px, back 132, side 92), and the model sheet is drawn at
// 10.5%, which sits him about 91 px tall (45 units), a little under Maddie.
//
//   model-sheet.png  idle_down (sitting up, facing us),     10.5%
//                    idle_up (his back), idle_left (side)
//   front-strip.png  walk_down: six upright hops toward us,  12.18%  cap 106
//                    in a row
//   back-strip.png   walk_up: six hops away, in a row         9.00%   cap 155
//   left-grid.png    walk_left: a 3x2 grid of one bounding   16.84%  cap 58
//                    hop to the left, read row by row
//
//   bun tools/art/build-acorn-squirrel.ts
export {};

const source = "art/source/acorn-squirrel";
const scratch = "art/scratch/acorn-squirrel-build";
const figures = `${scratch}/figures`;
const frames = `${scratch}/frames`;
const key = ["--key", "#00FF00", "--fuzz", "18%"];

async function run(command: string[]): Promise<void> {
  const child = Bun.spawn(command, { stdout: "inherit", stderr: "inherit" });
  if (await child.exited !== 0) throw new Error(`Command failed: ${command.join(" ")}`);
}

async function cut(sheet: string, name: string, expected: number): Promise<void> {
  await run(["bun", "tools/art/extract-figures.ts", "--input", `${source}/${sheet}`,
    "--output", `${figures}/${name}`, "--expected", String(expected), ...key]);
}

async function frame(name: string, figure: number, scale: string, output: string): Promise<void> {
  const input = `${figures}/${name}/raw-${String(figure).padStart(2, "0")}.png`;
  const out = `${frames}/${output}.png`;
  await run(["bun", "tools/art/postprocess.ts", "--input", input, "--output", out,
    "--width", "256", "--height", "256", "--scale-percent", scale, "--bottom-margin", "8",
    ...key, "--despill", "edge", "--holes"]);
  await run(["bun", "tools/art/despill-edge.ts", "--input", out, "--output", out,
    "--key", "green", "--band", "2"]);
}

await run(["rm", "-rf", scratch]);
await run(["mkdir", "-p", figures, frames, "public/assets/characters/acorn-squirrel"]);
await cut("model-sheet.png", "model", 4);
await cut("front-strip.png", "front", 6);
await cut("back-strip.png", "back", 6);
await cut("left-grid.png", "left", 6);

for (let index = 1; index <= 6; index += 1) {
  const n = String(index).padStart(2, "0");
  await frame("front", index, "12.18", `down_walk_${n}`);
  await frame("back", index, "9.00", `up_walk_${n}`);
  await frame("left", index, "16.84", `left_walk_${n}`);
}
await frame("model", 1, "10.5", "down_idle_01");
await frame("model", 2, "10.5", "up_idle_01");
await frame("model", 3, "10.5", "left_idle_01");

await run(["bun", "tools/art/pack-atlas.ts", "--input", frames,
  "--output", "public/assets/characters/acorn-squirrel/acorn-squirrel.png",
  "--json", "public/assets/characters/acorn-squirrel/acorn-squirrel.json",
  "--width", "256", "--height", "256", "--columns", "6", "--baseline", "247"]);
console.log("acorn-squirrel atlas rebuilt");
