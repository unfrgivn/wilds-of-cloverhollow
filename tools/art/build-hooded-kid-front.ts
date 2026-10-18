#!/usr/bin/env bun
// Rebuilds the front-facing hooded kid atlas without changing the school back view.
export {};
const run = async (command: string[]): Promise<void> => {
  const process = Bun.spawn(command, { stdout: "inherit", stderr: "inherit" });
  if (await process.exited !== 0)
    throw new Error(`Command failed: ${command.join(" ")}`);
};
await run(["rm", "-rf", "art/scratch/hooded-kid-front-frames",
  "public/assets/characters/hooded-kid-front"]);
await run(["mkdir", "-p", "art/scratch/hooded-kid-front-frames",
  "public/assets/characters/hooded-kid-front"]);
await run(["bun", "tools/art/postprocess.ts", "--input",
  "art/source/classmates/hooded-kid-front/front-raw.png", "--output",
  "art/scratch/hooded-kid-front-frames/idle_down_01.png", "--width", "448",
  "--height", "448", "--figure-height", "280", "--bottom-margin", "8",
  "--key", "#00FF00", "--fuzz", "18%", "--despill", "edge"]);
await run(["magick", "montage", "art/scratch/hooded-kid-front-frames/idle_down_*.png",
  "-tile", "1x1", "-geometry", "448x448+0+0", "-background", "none",
  "-alpha", "on", "-define", "png:exclude-chunk=all", "-strip",
  "public/assets/characters/hooded-kid-front/hooded-kid-front.png"]);
const names = ["idle_down_01"];
const frames = Object.fromEntries(names.map((name, index) => [name, {
  frame: { x: index * 448, y: 0, w: 448, h: 448 }, rotated: false, trimmed: true,
  spriteSourceSize: { x: 0, y: 0, w: 448, h: 448 }, sourceSize: { w: 448, h: 448 },
  anchor: { x: 0.5, y: 439 / 448 },
}]));
await Bun.write("public/assets/characters/hooded-kid-front/hooded-kid-front.json",
  JSON.stringify({ frames, animations: { idle_down: names }, meta: {
    image: "hooded-kid-front.png", size: { w: 448, h: 448 }, scale: "1", baseline: 439,
  } }, null, 2) + "\n");
