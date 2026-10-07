#!/usr/bin/env bun
// Rebuilds Jordan's atlas from selected raw sources using whole connected
// components, then removes magenta spill only along the alpha edge.
export {};

const scratch = "art/scratch/jordan-build";
const extracted = `${scratch}/extracted`;
const frames = `${scratch}/frames`;
const source = "art/source/jordan";
const key = ["--key", "#FF00FF", "--despill", "edge", "--fuzz", "18%"];

async function run(command: string[]): Promise<void> {
  const child = Bun.spawn(command, { stdout: "inherit", stderr: "inherit" });
  if (await child.exited !== 0) throw new Error(`Command failed: ${command.join(" ")}`);
}

async function extract(strip: string, output: string, expected: number): Promise<void> {
  await run(["bun", "tools/art/extract-strip.ts", "--input", `${source}/${strip}`,
    "--output", `${extracted}/${output}`, ...key, "--expected", String(expected)]);
}

async function post(input: string, output: string): Promise<void> {
  await run(["bun", "tools/art/postprocess.ts", "--input", input, "--output", output,
    "--width", "384", "--height", "384", "--figure-height", "280", "--bottom-margin", "8",
    ...key, "--holes"]);
  await run(["bun", "tools/art/despill-edge.ts", "--input", output, "--output", output,
    "--key", "magenta", "--band", "12"]);
}

function two(index: number): string {
  return String(index).padStart(2, "0");
}

await run(["rm", "-rf", scratch]);
await run(["mkdir", "-p", extracted, frames]);
await extract("jordan-model-sheet-v1.png", "model", 3);
await extract("jordan-walk-down-strip-v1.png", "down", 7);
await extract("jordan-walk-up-strip-v4a.png", "up-a", 3);
await extract("jordan-walk-up-strip-v6b.png", "up-b", 3);
await extract("jordan-walk-left-strip-v1.png", "left", 7);

await post(`${extracted}/model/raw-01.png`, `${frames}/down_idle_01.png`);
await post(`${extracted}/model/raw-02.png`, `${frames}/up_idle_01.png`);
await post(`${extracted}/model/raw-03.png`, `${frames}/left_idle_01.png`);
for (let index = 2; index <= 7; index += 1) {
  const input = `${extracted}/down/raw-${two(index)}.png`;
  const output = `${frames}/down_walk_${two(index - 1)}.png`;
  await post(input, output);
}
const upStrips: [string, number, number][] = [["up-a", 0, 1], ["up-b", 3, 1]];
for (const [strip, offset, first] of upStrips)
  for (let index = first; index <= first + 2; index += 1)
    await post(`${extracted}/${strip}/raw-${two(index)}.png`,
      `${frames}/up_walk_${two(index - first + 1 + offset)}.png`);
for (let index = 2; index <= 7; index += 1) {
  const facingRight = `${scratch}/right_${two(index)}.png`;
  await post(`${extracted}/left/raw-${two(index)}.png`, facingRight);
  await run(["magick", facingRight, "-flop", `${frames}/left_walk_${two(index - 1)}.png`]);
}
await run(["bun", "tools/art/pack-atlas.ts", "--input", frames,
  "--output", "public/assets/characters/jordan/jordan.png",
  "--json", "public/assets/characters/jordan/jordan.json",
  "--width", "384", "--height", "384", "--columns", "5", "--baseline", "375"]);
console.log("jordan atlas rebuilt");
