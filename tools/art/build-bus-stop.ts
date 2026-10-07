#!/usr/bin/env bun
// Rebuilds the town bus-stop atlas (art/recipes/bus-stop.json) byte for byte.
// The source is extracted as one connected component, keyed on magenta, and
// despilled only along the visible alpha edge. The whole stop is one down idle.
export {};

const source = "art/source/bus-stop/bus-stop-raw.png";
const extract = "art/scratch/bus-stop-build-extract";
const frame = "art/scratch/bus-stop-build-frame.png";
const atlasPath = "public/assets/characters/bus-stop/bus-stop.png";
const jsonPath = "public/assets/characters/bus-stop/bus-stop.json";

async function run(command: string[]): Promise<void> {
  const child = Bun.spawn(command, { stdout: "ignore", stderr: "inherit" });
  if (await child.exited !== 0) throw new Error(`Command failed: ${command.join(" ")}`);
}

await run(["rm", "-rf", extract, frame, `${frame}.keyed.png`]);
await run(["mkdir", "-p", extract, "public/assets/characters/bus-stop"]);
await run(["bun", "tools/art/extract-strip.ts", "--input", source, "--output", extract,
  "--key", "#FF00FF", "--fuzz", "18%", "--despill", "edge", "--expected", "1"]);
await run(["bun", "tools/art/postprocess.ts", "--input", `${extract}/raw-01.png`,
  "--output", frame, "--width", "448", "--height", "448", "--figure-height", "308",
  "--bottom-margin", "8", "--key", "#FF00FF", "--fuzz", "18%", "--despill", "edge",
  "--holes"]);
await run(["bun", "tools/art/despill-edge.ts", "--input", frame, "--output", frame,
  "--key", "magenta", "--band", "3"]);
await run(["magick", frame, "-strip", atlasPath]);

const atlas = {
  frames: {
    down_idle_01: {
      frame: { x: 0, y: 0, w: 448, h: 448 },
      rotated: false,
      trimmed: true,
      spriteSourceSize: { x: 0, y: 0, w: 448, h: 448 },
      sourceSize: { w: 448, h: 448 },
      anchor: { x: 0.5, y: 0.9799107142857143 },
    },
  },
  animations: { idle_down: ["down_idle_01"] },
  meta: { image: "bus-stop.png", size: { w: 448, h: 448 }, scale: "1", baseline: 439 },
};
await Bun.write(jsonPath, `${JSON.stringify(atlas, null, 2)}\n`);
