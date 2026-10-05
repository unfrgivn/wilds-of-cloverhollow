#!/usr/bin/env bun
export {};

function value(name: string, fallback: string): string {
  const index = Bun.argv.indexOf(`--${name}`);
  return index >= 0 ? Bun.argv[index + 1] ?? fallback : fallback;
}

const input = value("input", "art/scratch/fae-frames");
const output = value("output", "art/review/fae-contact-sheet.png");
const frameWidth = value("frame-width", "384");
const frameHeight = value("frame-height", "384");
const files = (
  await Array.fromAsync(new Bun.Glob("*_walk_*.png").scan({ cwd: input }))
).sort();
if (files.length === 0) throw new Error(`No frames in ${input}`);

const directory = output.slice(0, output.lastIndexOf("/"));
const mkdir = Bun.spawn(["mkdir", "-p", directory]);
if (await mkdir.exited !== 0) throw new Error(`Could not create ${directory}`);
const paths = files.map((file) => `${input}/${file}`);
const full = `${output}.full.png`;
const dark = `${output}.dark.png`;
const phone = `${output}.phone.png`;

const fullProcess = Bun.spawn(
  [
    "magick", "montage", ...paths, "-label", "%f", "-tile", "6x",
    "-geometry", `${frameWidth}x${frameHeight}+12+28`,
    "-background", "#F5F1E0", "-fill", "#5B3530", "-pointsize", "18",
    "-gravity", "south", full,
  ],
  { stdout: "inherit", stderr: "inherit" },
);
if (await fullProcess.exited !== 0) throw new Error("Full contact sheet failed");

const darkProcess = Bun.spawn(
  [
    "magick", "montage", ...paths, "-label", "%f", "-tile", "6x",
    "-geometry", `${frameWidth}x${frameHeight}+12+28`,
    "-background", "#29283B", "-fill", "#F5F1E0", "-pointsize", "18",
    "-gravity", "south", dark,
  ],
  { stdout: "inherit", stderr: "inherit" },
);
if (await darkProcess.exited !== 0) throw new Error("Dark contact sheet failed");

const phoneProcess = Bun.spawn(
  [
    "magick", "montage", ...paths, "-resize", "56%", "-tile", "6x",
    "-geometry", "+12+12", "-background", "#F5F1E0", phone,
  ],
  { stdout: "inherit", stderr: "inherit" },
);
if (await phoneProcess.exited !== 0) throw new Error("Phone contact sheet failed");

const append = Bun.spawn(
  ["magick", full, dark, phone, "-background", "#F5F1E0", "-append", output],
  { stdout: "inherit", stderr: "inherit" },
);
if (await append.exited !== 0) throw new Error("Contact sheet append failed");
console.log(output);
