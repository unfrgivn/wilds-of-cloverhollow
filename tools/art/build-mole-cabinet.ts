#!/usr/bin/env bun
export {};
const source = "art/source/arcade/mole-cabinet-front-raw.png";
const cutout = "art/scratch/mole-cabinet-cutout.png";
const output = "public/assets/arcade/mole-cabinet.webp";
async function run(command: string[]): Promise<void> {
  const child = Bun.spawn(command, { stdout: "inherit", stderr: "inherit" });
  if (await child.exited !== 0) throw new Error(`Command failed: ${command.join(" ")}`);
}
await run(["mkdir", "-p", "public/assets/arcade", "art/scratch"]);
await run(["magick", source, "-alpha", "on", "-fuzz", "8%", "-fill", "none",
  "-draw", "color 0,0 floodfill", "-trim", "+repage", cutout]);
await run(["magick", cutout, "-resize", "1600x", "-define", "webp:lossless=false",
  "-quality", "90", output]);
