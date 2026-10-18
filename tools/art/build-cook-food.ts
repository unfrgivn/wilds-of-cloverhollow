#!/usr/bin/env bun
// Rebuilds the cooking game's food atlas (Milestone 52) byte for byte from the
// raw sheets in art/source/cook: a plate of dino nuggets and a bowl of mac n
// cheese, each painted alone on magenta, which neither has in it. Each is cut
// whole (extract-figures.ts), keyed (holes too: the gaps between the nuggets and
// the T. rex's open mouth), despilled along the alpha edge only
// (despill-edge.ts keeps warm browns like the ink as they are), and scaled to sit
// on the microwave close-up's turntable (public/assets/arcade/microwave.json,
// 568 px across): the plate about 470 px wide, the bowl about 400.
//
// The nuggets' sheet is cut at a 50% key: the model painted a pale floor under
// the plate, joined to it by a glow tinted with the key. At 50% the glow keys
// out and the floor is a figure of its own, so the plate, the largest, is cut
// alone (the review sheet shows it whole, its greys kept).
//
//   bun tools/art/build-cook-food.ts
export {};
const source = "art/source/cook";
const scratch = "art/scratch/cook-food";
const figures = `${scratch}/figures`;
const frames = `${scratch}/frames`;
const key = ["--key", "#FF00FF"];

async function run(command: string[]): Promise<void> {
  const child = Bun.spawn(command, { stdout: "inherit", stderr: "inherit" });
  if (await child.exited !== 0) throw new Error(`Command failed: ${command.join(" ")}`);
}

async function dish(name: string, fuzz: string, scale: string): Promise<void> {
  await run(["bun", "tools/art/extract-figures.ts", "--input", `${source}/${name}-raw.png`,
    "--output", `${figures}/${name}`, "--expected", "1", ...key, "--fuzz", fuzz]);
  const out = `${frames}/${name}.png`;
  await run(["bun", "tools/art/postprocess.ts", "--input", `${figures}/${name}/raw-01.png`,
    "--output", out, "--width", "512", "--height", "320", "--scale-percent", scale,
    "--bottom-margin", "8", ...key, "--fuzz", "18%", "--despill", "none", "--holes"]);
  await run(["bun", "tools/art/despill-edge.ts", "--input", out, "--output", out,
    "--key", "magenta", "--band", "2"]);
}

await run(["rm", "-rf", scratch]);
await run(["mkdir", "-p", figures, frames]);
await dish("nuggets", "50%", "24.3");
await dish("mac", "18%", "17.0");
// One row of 512x320 cells, each anchored at its dish's foot (8 px up).
const dishes = ["nuggets", "mac"];
await run(["magick", ...dishes.map((name) => `${frames}/${name}.png`), "+append", "-strip",
  "-define", "png:exclude-chunk=date,time", "PNG32:public/assets/arcade/cook-food.png"]);
const cell = { w: 512, h: 320 };
const atlas = {
  frames: Object.fromEntries(dishes.map((name, index) => [name, {
    frame: { x: index * cell.w, y: 0, ...cell }, rotated: false, trimmed: false,
    spriteSourceSize: { x: 0, y: 0, ...cell }, sourceSize: cell,
    anchor: { x: 0.5, y: 312 / cell.h },
  }])),
  meta: { image: "cook-food.png", format: "RGBA8888",
    size: { w: cell.w * dishes.length, h: cell.h } },
};
await Bun.write("public/assets/arcade/cook-food.json", `${JSON.stringify(atlas, null, 2)}\n`);
console.log("cook food atlas rebuilt");
