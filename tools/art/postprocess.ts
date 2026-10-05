#!/usr/bin/env bun
export {};

function value(name: string, fallback: string): string {
  const index = Bun.argv.indexOf(`--${name}`);
  return index >= 0 ? Bun.argv[index + 1] ?? fallback : fallback;
}

const input = value("input", "");
const output = value("output", "art/scratch/processed.png");
if (input.length === 0) throw new Error("--input is required");

const canvasWidth = Number(value("width", "384"));
const canvasHeight = Number(value("height", "384"));
const figureHeight = Number(value("figure-height", "280"));
const scalePercent = value("scale-percent", "");
const bottomMargin = Number(value("bottom-margin", "8"));
const fuzz = value("fuzz", "18%");
const key = value("key", "#00FF00");
const despill = value("despill", "global-green");
const directory = output.slice(0, output.lastIndexOf("/"));
const mkdir = Bun.spawn(["mkdir", "-p", directory]);
if (await mkdir.exited !== 0) throw new Error(`Could not create ${directory}`);

const keyed = `${output}.keyed.png`;
const keyProcess = Bun.spawn([
  "bun", "tools/art/key-alpha.ts", "--input", input, "--output", keyed,
  "--key", key, "--fuzz", fuzz, "--despill", despill,
], { stdout: "inherit", stderr: "inherit" });
if (await keyProcess.exited !== 0) throw new Error("Keying failed");
const command = [
  "magick", keyed,
  "-channel", "A", "-morphology", "Erode", "Disk:1",
  "+channel",
  "-trim", "+repage",
  "-resize", scalePercent.length > 0 ? `${scalePercent}%` : `x${figureHeight}`,
  "-gravity", "south",
  "-background", "none",
  "-extent", `${canvasWidth}x${canvasHeight - bottomMargin}`,
  "-gravity", "north",
  "-extent", `${canvasWidth}x${canvasHeight}`,
  output,
];
const process = Bun.spawn(command, { stdout: "inherit", stderr: "inherit" });
if (await process.exited !== 0) throw new Error("ImageMagick postprocess failed");
await Bun.file(keyed).delete();
console.log(output);
