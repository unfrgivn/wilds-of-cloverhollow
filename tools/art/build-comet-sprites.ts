#!/usr/bin/env bun
// Builds Comet Cruise's sprite atlas (Milestone 59, art/recipes/comet-sprites.json)
// from its selected sheet: eight sprites in four columns and two rows on
// magenta. Each cell is keyed like the moles (the magenta made transparent),
// its spill taken off the alpha-edge band only (despill-edge.ts), and trimmed;
// all eight are scaled by one factor, so the rocket keeps its size in every
// pose, and centred in 256px frames of a 1024x512 atlas.
//
//   bun tools/art/build-comet-sprites.ts
export {};
const source = "art/source/arcade/comet-sprites-raw.png";
const scratch = "art/scratch/comet-frames";
const atlas = "public/assets/arcade/comet.png";
const names = [
  "rocket", "rocket-left", "rocket-right", "rocket-wobble",
  "star", "star-sparkle", "rock", "rock-puff",
];
const frame = 256;
const fit = 236;
async function run(command: string[]): Promise<void> {
  const child = Bun.spawn(command, { stdout: "inherit", stderr: "inherit" });
  if (await child.exited !== 0) throw new Error(`Command failed: ${command.join(" ")}`);
}
async function output(command: string[]): Promise<string> {
  const child = Bun.spawn(command, { stdout: "pipe", stderr: "inherit" });
  const text = await new Response(child.stdout).text();
  if (await child.exited !== 0) throw new Error(`Command failed: ${command.join(" ")}`);
  return text.trim();
}
await run(["rm", "-rf", scratch]);
await run(["mkdir", "-p", scratch, "public/assets/arcade"]);
const [width, height] = (await output(["magick", "identify", "-format", "%w %h", source]))
  .split(" ").map(Number);
if (width === undefined || height === undefined) throw new Error(`Could not size ${source}`);
const cellW = Math.floor(width / 4);
const cellH = Math.floor(height / 2);
const sizes: number[] = [];
for (const [index] of names.entries()) {
  const keyed = `${scratch}/${index}-keyed.png`;
  const x = (index % 4) * cellW;
  const y = Math.floor(index / 4) * cellH;
  await run(["magick", source, "-crop", `${cellW}x${cellH}+${x}+${y}`, "+repage",
    "-alpha", "on", "-fuzz", "22%", "-transparent", "#FF00FF", keyed]);
  await run(["bun", "tools/art/despill-edge.ts", "--input", keyed, "--output", keyed,
    "--key", "magenta", "--band", "3"]);
  await run(["magick", keyed, "-trim", "+repage", `${scratch}/${index}-trim.png`]);
  const [w, h] = (await output(["magick", "identify", "-format", "%w %h",
    `${scratch}/${index}-trim.png`])).split(" ").map(Number);
  sizes.push(Math.max(w ?? 0, h ?? 0));
}
const scale = Math.min(1, fit / Math.max(...sizes));
const frames: string[] = [];
for (const [index] of names.entries()) {
  const out = `${scratch}/${index}.png`;
  await run(["magick", `${scratch}/${index}-trim.png`, "-resize", `${(scale * 100).toFixed(4)}%`,
    "-gravity", "center", "-background", "none", "-extent", `${frame}x${frame}`, "-strip", out]);
  frames.push(out);
}
await run(["magick", "(", ...frames.slice(0, 4), "+append", ")",
  "(", ...frames.slice(4), "+append", ")", "-append", "-strip", atlas]);
await Bun.write("public/assets/arcade/comet.json", JSON.stringify({
  frames: Object.fromEntries(names.map((name, index) => [name, {
    frame: { x: (index % 4) * frame, y: Math.floor(index / 4) * frame, w: frame, h: frame },
    rotated: false, trimmed: false,
    spriteSourceSize: { x: 0, y: 0, w: frame, h: frame }, sourceSize: { w: frame, h: frame },
    anchor: { x: 0.5, y: 0.5 },
  }])),
  meta: { image: "comet.png", format: "RGBA8888", size: { w: frame * 4, h: frame * 2 } },
}, null, 2) + "\n");
