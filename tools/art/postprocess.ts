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
const bottomMargin = Number(value("bottom-margin", "8"));
const fuzz = value("fuzz", "18%");
const key = value("key", "#00FF00");
const directory = output.slice(0, output.lastIndexOf("/"));
const mkdir = Bun.spawn(["mkdir", "-p", directory]);
if (await mkdir.exited !== 0) throw new Error(`Could not create ${directory}`);

const command = [
  "magick", input,
  "-alpha", "on",
  "-fuzz", fuzz,
  "-transparent", key,
  "-channel", "G", "-fx", "min(g,max(r,b))",
  "+channel",
  "-channel", "A", "-morphology", "Erode", "Disk:1",
  "+channel",
  "-trim", "+repage",
  "-resize", `x${figureHeight}`,
  "-gravity", "south",
  "-background", "none",
  "-extent", `${canvasWidth}x${canvasHeight - bottomMargin}`,
  "-gravity", "north",
  "-extent", `${canvasWidth}x${canvasHeight}`,
  output,
];
const process = Bun.spawn(command, { stdout: "inherit", stderr: "inherit" });
if (await process.exited !== 0) throw new Error("ImageMagick postprocess failed");
console.log(output);
