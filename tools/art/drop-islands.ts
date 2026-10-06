#!/usr/bin/env bun
// Removes keying debris from a keyed RGBA frame: detached alpha islands
// smaller than --min px (8-connected). These are fragments of background the
// chroma key left behind, not part of the subject; legitimate separate parts
// (a critter's bubbles or tennis balls) are far larger. Measured on the
// critters: the frog's smallest bubble is 246 px, the pup's debris 54 px.
//
//   bun tools/art/drop-islands.ts --input frame.png --output frame.png [--min 120]
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
const minimum = Number(value("min", "120"));
if (input.length === 0 || output.length === 0) throw new Error("--input and --output are required");
const size = new TextDecoder().decode(await run(["magick", "identify", "-format", "%w %h", input]));
const [width = 0, height = 0] = size.split(" ").map(Number);
const pixels = await run(["magick", input, "-alpha", "on", "-depth", "8", "rgba:-"]);
if (pixels.length !== width * height * 4) throw new Error(`Could not read ${input}`);

const seen = new Uint8Array(width * height);
let removed = 0;
let islands = 0;
for (let start = 0; start < width * height; start += 1) {
  if (seen[start] === 1 || (pixels[start * 4 + 3] ?? 0) === 0) continue;
  const island: number[] = [];
  const stack = [start];
  seen[start] = 1;
  while (stack.length > 0) {
    const index = stack.pop();
    if (index === undefined) continue;
    island.push(index);
    const x = index % width;
    const y = Math.floor(index / width);
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const next = ny * width + nx;
        if (seen[next] === 1 || (pixels[next * 4 + 3] ?? 0) === 0) continue;
        seen[next] = 1;
        stack.push(next);
      }
    }
  }
  if (island.length >= minimum) continue;
  islands += 1;
  removed += island.length;
  for (const index of island) pixels[index * 4 + 3] = 0;
}
const write = Bun.spawn(["magick", "-size", `${width}x${height}`, "-depth", "8", "rgba:-",
  output], { stdin: "pipe", stderr: "inherit" });
write.stdin.write(pixels);
await write.stdin.end();
if (await write.exited !== 0) throw new Error(`Could not write ${output}`);
console.log(`drop-islands: removed ${islands} island(s), ${removed} px (under ${minimum} px)`);
