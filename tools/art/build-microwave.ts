#!/usr/bin/env bun
// The clubhouse microwave's close-up (spec 8.2, the cooking game): the paper
// margin round it, flood-filled from the top-left corner, made transparent;
// the fridge top it stands on runs off the bottom edge and stays.
export {};
const source = "art/source/arcade/microwave-front-raw.png";
const cutout = "art/scratch/microwave-cutout.png";
const output = "public/assets/arcade/microwave.webp";
async function run(command: string[]): Promise<void> {
  const child = Bun.spawn(command, { stdout: "inherit", stderr: "inherit" });
  if (await child.exited !== 0) throw new Error(`Command failed: ${command.join(" ")}`);
}
await run(["mkdir", "-p", "public/assets/arcade", "art/scratch"]);
await run(["magick", source, "-alpha", "on", "-fuzz", "8%", "-fill", "none",
  "-draw", "color 0,0 floodfill", "-trim", "+repage", cutout]);
await run(["magick", cutout, "-resize", "1600x", "-define", "webp:lossless=false",
  "-quality", "90", output]);
