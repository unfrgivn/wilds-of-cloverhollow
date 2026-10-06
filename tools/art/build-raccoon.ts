#!/usr/bin/env bun
// Rebuilds the raccoon's atlas (art/recipes/raccoon.json) byte for byte.
//
// The generated strip's poses have tails that reach past even thirds of the
// strip, so each pose is extracted as a whole figure by the gaps between
// figures (extract-strip.ts), never by fixed panel crops (which cut one tail
// flat and left a piece of it beside the next pose). Each figure is keyed on
// #00FF00 by border flood plus enclosed holes (the gaps under a raised arm and
// behind the tail), scaled so the figure is 252 px tall on a 448 px canvas
// (baseline 439), then cleaned at sprite size: detached key debris dropped,
// and the 2 px alpha-edge band despilled.
//
// idle_down: the front pose, and its blink (one edit of the front pose).
// idle_right: the third pose (three-quarter right, waving); idle_left: its mirror.
export {};

const fuzz = "18%";
const frames = "art/scratch/raccoon-build-frames";
const strip = "art/source/raccoon/model-strip-raw.png";
const blink = "art/source/raccoon/blink-edit-raw.png";

async function run(command: string[]): Promise<void> {
  const child = Bun.spawn(command, { stdout: "ignore", stderr: "inherit" });
  if (await child.exited !== 0) throw new Error(`Command failed: ${command.join(" ")}`);
}

async function extract(input: string, output: string, expected: number): Promise<void> {
  await run(["bun", "tools/art/extract-strip.ts", "--input", input, "--output", output,
    "--key", "#00FF00", "--fuzz", fuzz, "--despill", "edge", "--expected", String(expected)]);
}

async function build(figure: string, name: string): Promise<void> {
  const keyed = `${frames}/${name}-keyed.png`;
  const frame = `${frames}/${name}.png`;
  await run(["bun", "tools/art/key-alpha.ts", "--input", figure, "--output", keyed,
    "--key", "#00FF00", "--fuzz", fuzz, "--despill", "edge", "--holes"]);
  await run(["bun", "tools/art/postprocess.ts", "--input", keyed, "--output", frame,
    "--width", "448", "--height", "448", "--figure-height", "252", "--bottom-margin", "8",
    "--key", "#00FF00", "--fuzz", fuzz, "--despill", "edge"]);
  await run(["bun", "tools/art/drop-islands.ts", "--input", frame, "--output", frame,
    "--min", "120"]);
  await run(["bun", "tools/art/despill-edge.ts", "--input", frame, "--output", frame,
    "--key", "green", "--band", "2"]);
}

await run(["rm", "-rf", frames]);
await run(["mkdir", "-p", frames]);
await extract(strip, `${frames}/strip`, 3);
await extract(blink, `${frames}/blink`, 1);
await build(`${frames}/strip/raw-01.png`, "down_idle_01");
await build(`${frames}/blink/raw-01.png`, "down_idle_02");
await build(`${frames}/strip/raw-03.png`, "right_idle_01");
await run(["magick", `${frames}/right_idle_01.png`, "-flop", `${frames}/left_idle_01.png`]);

const names = ["down_idle_01", "down_idle_02", "left_idle_01", "right_idle_01"];
await run(["magick", "montage", ...names.map((name) => `${frames}/${name}.png`),
  "-tile", "4x1", "-geometry", "448x448+0+0", "-background", "none",
  "public/assets/characters/raccoon/raccoon.png"]);
const records: Record<string, unknown> = {};
for (const [index, name] of names.entries()) {
  records[name] = {
    frame: { x: index * 448, y: 0, w: 448, h: 448 },
    rotated: false, trimmed: true,
    spriteSourceSize: { x: 0, y: 0, w: 448, h: 448 },
    sourceSize: { w: 448, h: 448 }, anchor: { x: 0.5, y: 439 / 448 },
  };
}
const atlas = {
  frames: records,
  animations: {
    idle_down: ["down_idle_01", "down_idle_02"],
    idle_left: ["left_idle_01"],
    idle_right: ["right_idle_01"],
  },
  meta: { image: "raccoon.png", size: { w: 1792, h: 448 }, scale: "1", baseline: 439 },
};
await Bun.write("public/assets/characters/raccoon/raccoon.json",
  `${JSON.stringify(atlas, null, 2)}\n`);
