#!/usr/bin/env bun
// Rebuilds the Pond Pup's follower atlas (Milestone 47) byte for byte from the
// selected raw sources in art/source/pond-pup. Each sheet is cut into whole
// figures (extract-figures.ts: a figure is never cropped, and a faded copy the
// model drew above one stays out), keyed on green (he is brown, cream, red, and
// pink), despilled along the alpha edge only, and scaled by ONE factor per
// sheet, so his trot's bob and his sit keep their real heights. The model sheet
// draws every view at one scale (about 750 px standing); 13.3% stands him about
// 100 px (50 units), Maddie's height. Each walk sheet's factor puts its tallest
// frame at the model sheet's height for that view (the head-on walk at the
// standing height, 99.6 px):
//
//   model-sheet.png  idle_down (he sits, facing us), idle_up  13.3%
//                    (his back), idle_left (his side)
//   front-sheet.png  walk_down: the sheet has two rows of the 16.30%  99.6 / 611
//                    trot; the bottom row's six (figures
//                    7-12), whose paws alternate evenly
//   back-grid.png    walk_up, the 3x2 grid read row by row    13.13%  751 / 761
//   left-strip.png   walk_left, its six left-facing frames    34.53%  740 / 285
//                    in sheet order (figures 3-8; figure 2
//                    faces right, and 1 opens the sheet)
export {};

const source = "art/source/pond-pup";
const scratch = "art/scratch/pond-pup-build";
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
await run(["mkdir", "-p", figures, frames]);
await cut("front-sheet.png", "front", 12);
await cut("back-grid.png", "back", 6);
await cut("left-strip.png", "left", 8);
await cut("model-sheet.png", "model", 5);

for (let index = 1; index <= 6; index += 1) {
  const n = String(index).padStart(2, "0");
  await frame("front", index + 6, "16.30", `down_walk_${n}`);
  await frame("back", index, "13.13", `up_walk_${n}`);
  await frame("left", index + 2, "34.53", `left_walk_${n}`);
}
await frame("model", 4, "13.3", "down_idle_01");
await frame("model", 2, "13.3", "up_idle_01");
await frame("model", 3, "13.3", "left_idle_01");

await run(["bun", "tools/art/pack-atlas.ts", "--input", frames,
  "--output", "public/assets/characters/pond-pup/pond-pup.png",
  "--json", "public/assets/characters/pond-pup/pond-pup.json",
  "--width", "256", "--height", "256", "--columns", "6", "--baseline", "247"]);
console.log("pond-pup atlas rebuilt");
