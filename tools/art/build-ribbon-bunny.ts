#!/usr/bin/env bun
// Rebuilds the Ribbon Bunny follower atlas (Milestone 80) byte for byte from
// the selected raw sources in art/source/ribbon-bunny: each sheet is cut into
// whole figures via extract-figures.ts, keyed on green (#00FF00), despilled
// along the alpha edge only, and scaled by ONE uniform factor per sheet.
//
//   model-sheet.png  idle_down (sitting front), idle_up (back), idle_left  13.5%
//   front-strip.png  walk_down: six compact hops toward camera             16.0%
//   back-strip.png   walk_up: top-row six compact hops away (12 figures)   16.0%
//   left-grid.png    walk_left: 3x2 bounding hop grid (flopped to left)    15.0%
export {};

const source = "art/source/ribbon-bunny";
const scratch = "art/scratch/ribbon-bunny-build";
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

async function frame(
  name: string,
  figure: number,
  scale: string,
  output: string,
  flop = false,
): Promise<void> {
  let input = `${figures}/${name}/raw-${String(figure).padStart(2, "0")}.png`;
  if (flop) {
    const flopped = `${figures}/${name}/flop-${String(figure).padStart(2, "0")}.png`;
    await run(["magick", input, "-flop", flopped]);
    input = flopped;
  }
  const out = `${frames}/${output}.png`;
  await run(["bun", "tools/art/postprocess.ts", "--input", input, "--output", out,
    "--width", "256", "--height", "256", "--scale-percent", scale, "--bottom-margin", "8",
    ...key, "--despill", "edge", "--holes"]);
  await run(["bun", "tools/art/despill-edge.ts", "--input", out, "--output", out,
    "--key", "green", "--band", "2"]);
}

await run(["rm", "-rf", scratch]);
await run(["mkdir", "-p", figures, frames, "public/assets/characters/ribbon-bunny"]);
await cut("model-sheet.png", "model", 4);
await cut("front-strip.png", "front", 6);
await cut("back-strip.png", "back", 12);
await cut("left-grid.png", "left", 6);

const downOrder = [1, 2, 4, 5, 6];
for (let index = 0; index < downOrder.length; index += 1) {
  const n = String(index + 1).padStart(2, "0");
  await frame("front", downOrder[index]!, "16.0", `down_walk_${n}`);
}
await frame("model", 1, "13.5", "down_walk_06");
for (let index = 1; index <= 6; index += 1) {
  const n = String(index).padStart(2, "0");
  await frame("back", index, "16.0", `up_walk_${n}`);
  await frame("left", index, "15.0", `left_walk_${n}`, true);
}
await frame("model", 1, "13.5", "down_idle_01");
await frame("model", 2, "13.5", "up_idle_01");
await frame("left", 6, "15.0", "left_idle_01", true);

await run(["bun", "tools/art/pack-atlas.ts", "--input", frames,
  "--output", "public/assets/characters/ribbon-bunny/ribbon-bunny.png",
  "--json", "public/assets/characters/ribbon-bunny/ribbon-bunny.json",
  "--width", "256", "--height", "256", "--columns", "6", "--baseline", "247"]);
console.log("ribbon-bunny atlas rebuilt");
