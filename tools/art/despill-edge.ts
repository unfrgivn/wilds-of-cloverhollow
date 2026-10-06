#!/usr/bin/env bun
// Removes a magenta key's spill from the alpha-edge band of an already keyed
// RGBA frame (pixels within --band px of a transparent pixel), never from the
// interior. Standard spill suppression: the magenta excess s = min(r, b) - g
// is taken off red and blue, so warm colours (where blue is below green, like
// brown ink) are left exactly as they are. key-alpha.ts's own magenta edge
// rule clamps red and blue to green, which turns brown outlines grey; it stays
// as is because the approved frog atlas is built with it.
//
//   bun tools/art/despill-edge.ts --input frame.png --output frame.png [--band 3]
export {};

function value(name: string, fallback: string): string {
  const index = Bun.argv.indexOf(`--${name}`);
  return index >= 0 ? (Bun.argv[index + 1] ?? fallback) : fallback;
}

async function run(command: string[]): Promise<Uint8Array> {
  const child = Bun.spawn(command, { stdout: "pipe", stderr: "inherit" });
  const bytes = new Uint8Array(await new Response(child.stdout).arrayBuffer());
  if (await child.exited !== 0) throw new Error(`Command failed: ${command.join(" ")}`);
  return bytes;
}

const input = value("input", "");
const output = value("output", "");
const band = Number(value("band", "3"));
if (input.length === 0 || output.length === 0) throw new Error("--input and --output are required");
const size = new TextDecoder().decode(await run(["magick", "identify", "-format", "%w %h", input]));
const [width = 0, height = 0] = size.split(" ").map(Number);
const pixels = await run(["magick", input, "-alpha", "on", "-depth", "8", "rgba:-"]);
if (pixels.length !== width * height * 4) throw new Error(`Could not read ${input}`);

// Distance (4-connected steps) from each pixel to the nearest transparent one.
const distance = new Uint16Array(width * height).fill(65535);
const queue: number[] = [];
for (let index = 0; index < width * height; index += 1) {
  if ((pixels[index * 4 + 3] ?? 0) === 0) {
    distance[index] = 0;
    queue.push(index);
  }
}
for (let head = 0; head < queue.length; head += 1) {
  const index = queue[head] ?? 0;
  const next = (distance[index] ?? 0) + 1;
  if (next > band) continue;
  const x = index % width;
  for (const neighbour of [index - 1, index + 1, index - width, index + width]) {
    if (neighbour < 0 || neighbour >= width * height) continue;
    if (Math.abs((neighbour % width) - x) > 1) continue;
    if ((distance[neighbour] ?? 0) <= next) continue;
    distance[neighbour] = next;
    queue.push(neighbour);
  }
}

let changed = 0;
for (let index = 0; index < width * height; index += 1) {
  const offset = index * 4;
  if ((pixels[offset + 3] ?? 0) === 0 || (distance[index] ?? 65535) > band) continue;
  const red = pixels[offset] ?? 0;
  const green = pixels[offset + 1] ?? 0;
  const blue = pixels[offset + 2] ?? 0;
  const spill = Math.min(red, blue) - green;
  if (spill <= 0) continue;
  pixels[offset] = red - spill;
  pixels[offset + 2] = blue - spill;
  changed += 1;
}
const write = Bun.spawn(["magick", "-size", `${width}x${height}`, "-depth", "8", "rgba:-",
  output], { stdin: "pipe", stderr: "inherit" });
write.stdin.write(pixels);
await write.stdin.end();
if (await write.exited !== 0) throw new Error(`Could not write ${output}`);
console.log(`despill-edge: ${changed} edge pixels adjusted (band ${band} px)`);
