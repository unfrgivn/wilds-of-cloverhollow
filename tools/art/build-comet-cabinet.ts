#!/usr/bin/env bun
// Builds Comet Cruise's cabinet close-up (Milestone 59, art/recipes/comet-cabinet.json)
// like Boop-a-Mole's: the paper margin flood-filled away, trimmed, and encoded
// as a 1600px-wide WebP with alpha. The cabinet runs off the bottom and its
// side wings reach the top, so the margin comes in pieces, one of them trapped
// between the wings: each run of paper along the image's border seeds a fill.
// The fills stop at the cabinet's ink outline, so the paper showing through
// inside it (where a wash stops short of the line) stays.
//
//   bun tools/art/build-comet-cabinet.ts
export {};
const source = "art/source/arcade/comet-cabinet-front-raw.png";
const cutout = "art/scratch/comet-cabinet-cutout.png";
const output = "public/assets/arcade/comet-cabinet.webp";
async function run(command: string[]): Promise<void> {
  const child = Bun.spawn(command, { stdout: "inherit", stderr: "inherit" });
  if (await child.exited !== 0) throw new Error(`Command failed: ${command.join(" ")}`);
}
type Pixels = { width: number; height: number; rgb: Uint8Array };
async function readPixels(path: string): Promise<Pixels> {
  const size = Bun.spawn(["magick", "identify", "-format", "%w %h", path], { stdout: "pipe" });
  const [width, height] = (await new Response(size.stdout).text()).split(" ").map(Number);
  if (await size.exited !== 0 || width === undefined || height === undefined)
    throw new Error(`Could not size ${path}`);
  const read = Bun.spawn(["magick", path, "-depth", "8", "rgb:-"], { stdout: "pipe" });
  const rgb = new Uint8Array(await new Response(read.stdout).arrayBuffer());
  if (await read.exited !== 0) throw new Error(`Could not read ${path}`);
  return { width, height, rgb };
}
// The midpoint of every run of at least three paper pixels along the border,
// paper being within 24 of the top-left corner's colour in every channel.
function borderSeeds(width: number, height: number, rgb: Uint8Array): string[] {
  const at = (x: number, y: number, channel: number): number =>
    rgb[(y * width + x) * 3 + channel] ?? 0;
  const reference = [0, 1, 2].map((channel) => {
    let sum = 0;
    for (let y = 0; y < 12; y += 1) for (let x = 0; x < 12; x += 1) sum += at(x, y, channel);
    return sum / 144;
  });
  const paper = (x: number, y: number): boolean =>
    [0, 1, 2].every((channel) => Math.abs(at(x, y, channel) - (reference[channel] ?? 0)) < 24);
  const edges: [number, number][][] = [
    Array.from({ length: width }, (_, x): [number, number] => [x, 0]),
    Array.from({ length: width }, (_, x): [number, number] => [x, height - 1]),
    Array.from({ length: height }, (_, y): [number, number] => [0, y]),
    Array.from({ length: height }, (_, y): [number, number] => [width - 1, y]),
  ];
  const seeds: string[] = [];
  for (const edge of edges) {
    let runStart = -1;
    edge.forEach(([x, y], index) => {
      const isPaper = paper(x, y);
      if (isPaper && runStart < 0) runStart = index;
      const ends = runStart >= 0 && (!isPaper || index === edge.length - 1);
      if (!ends) return;
      const runEnd = isPaper ? index : index - 1;
      const middle = edge[Math.floor((runStart + runEnd) / 2)];
      if (runEnd - runStart + 1 >= 3 && middle !== undefined)
        seeds.push(`${middle[0]},${middle[1]}`);
      runStart = -1;
    });
  }
  return seeds;
}
await run(["mkdir", "-p", "public/assets/arcade", "art/scratch"]);
const { width, height, rgb } = await readPixels(source);
const fills = borderSeeds(width, height, rgb)
  .flatMap((seed) => ["-draw", `color ${seed} floodfill`]);
await run(["magick", source, "-alpha", "on", "-fuzz", "8%", "-fill", "none", ...fills,
  "-trim", "+repage", cutout]);
await run(["magick", cutout, "-resize", "1600x", "-define", "webp:lossless=false",
  "-quality", "90", output]);
