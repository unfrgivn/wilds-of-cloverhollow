#!/usr/bin/env bun
// Rebuilds Sue's atlas byte for byte from the selected raw sources in
// art/source/sue. Every figure is extracted whole (extract-strip.ts), keyed on
// magenta (her hoodie and a sock are teal), and despilled along the alpha edge.
// The side walk strip was generated facing right and is flopped to face left;
// the model sheet's side view already faces left and is used as drawn.
export {};

const scratch = "art/scratch/sue-build";
const extracted = `${scratch}/extracted`;
const frames = `${scratch}/frames`;
const source = "art/source/sue";
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
await extract("sue-model-sheet-v2.png", "model", 3);
await extract("sue-walk-down-strip-v2.png", "down", 6);
await extract("sue-walk-up-strip-v2a.png", "up-a", 3);
await extract("sue-walk-up-strip-v2b.png", "up-b", 3);
await extract("sue-walk-left-strip-v3.png", "left", 6);

await post(`${extracted}/model/raw-01.png`, `${frames}/down_idle_01.png`);
await post(`${extracted}/model/raw-02.png`, `${frames}/up_idle_01.png`);
await post(`${extracted}/model/raw-03.png`, `${frames}/left_idle_01.png`);
for (let index = 1; index <= 6; index += 1)
  await post(`${extracted}/down/raw-${two(index)}.png`, `${frames}/down_walk_${two(index)}.png`);
const upStrips: [string, number][] = [["up-a", 0], ["up-b", 3]];
for (const [strip, offset] of upStrips)
  for (let index = 1; index <= 3; index += 1)
    await post(`${extracted}/${strip}/raw-${two(index)}.png`,
      `${frames}/up_walk_${two(index + offset)}.png`);
for (let index = 1; index <= 6; index += 1) {
  const facingRight = `${scratch}/right_${two(index)}.png`;
  await post(`${extracted}/left/raw-${two(index)}.png`, facingRight);
  await run(["magick", facingRight, "-flop", `${frames}/left_walk_${two(index)}.png`]);
}
await run(["bun", "tools/art/pack-atlas.ts", "--input", frames,
  "--output", "public/assets/characters/sue/sue.png",
  "--json", "public/assets/characters/sue/sue.json",
  "--width", "384", "--height", "384", "--columns", "5", "--baseline", "375"]);
console.log("sue atlas rebuilt");
