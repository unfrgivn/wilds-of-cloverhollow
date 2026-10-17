#!/usr/bin/env bun
// Cuts a generated sheet into its figures, whole and on their own.
//
// Every figure is a connected component of the keyed sheet (key-alpha.ts, with
// holes). The `--expected` largest components are the figures: smaller ones,
// like a faded copy the model drew above one, stay out, and so do lines (a
// grid's frame fills almost none of its own box). Figures are read left to
// right, row by row. Each is written on the key colour alone, so a neighbour
// whose box overlaps it never comes along, and nothing of a figure is ever cut:
// unlike extract-strip.ts, which crops boxes and splits merged frames.
//
//   bun tools/art/extract-figures.ts --input sheet.png --output dir --expected 6 \
//     [--key "#00FF00"] [--fuzz 18%]
export {};

function value(name: string, fallback: string): string {
  const index = Bun.argv.indexOf(`--${name}`);
  return index >= 0 ? Bun.argv[index + 1] ?? fallback : fallback;
}

async function read(command: string[]): Promise<Uint8Array> {
  const child = Bun.spawn(command, { stdout: "pipe", stderr: "inherit" });
  const bytes = new Uint8Array(await new Response(child.stdout).arrayBuffer());
  if (await child.exited !== 0) throw new Error(`Command failed: ${command.join(" ")}`);
  return bytes;
}

const input = value("input", "");
const output = value("output", "");
const expected = Number(value("expected", "0"));
const key = value("key", "#00FF00");
const fuzz = value("fuzz", "18%");
if (input.length === 0 || output.length === 0 || !(expected > 0))
  throw new Error("--input, --output, and --expected are required");
const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(key);
if (match === null) throw new Error(`--key must be #rrggbb, not ${key}`);
const keyRgb = [1, 2, 3].map((group) => parseInt(match[group] ?? "0", 16));

const size = new TextDecoder()
  .decode(await read(["magick", "identify", "-format", "%w %h", input]));
const [width = 0, height = 0] = size.trim().split(" ").map(Number);
const keyed = `${output}.keyed.png`;
await read(["mkdir", "-p", output]);
await read(["bun", "tools/art/key-alpha.ts", "--input", input, "--output", keyed,
  "--key", key, "--fuzz", fuzz, "--despill", "none", "--holes"]);
const alpha = await read(["magick", keyed, "-alpha", "extract", "-depth", "8", "gray:-"]);
await read(["rm", "-f", keyed]);
const rgb = await read(["magick", input, "-alpha", "off", "-depth", "8", "rgb:-"]);
if (alpha.length < width * height || rgb.length < width * height * 3)
  throw new Error(`Could not read ${input}`);

// The components, 4-connected over every pixel the key left.
type Figure = { pixels: number[]; x0: number; y0: number; x1: number; y1: number };
const seen = new Uint8Array(width * height);
const components: Figure[] = [];
for (let start = 0; start < width * height; start += 1) {
  if ((alpha[start] ?? 0) === 0 || seen[start] === 1) continue;
  const figure: Figure = { pixels: [], x0: width, y0: height, x1: 0, y1: 0 };
  const queue = [start];
  seen[start] = 1;
  while (queue.length > 0) {
    const index = queue.pop();
    if (index === undefined) continue;
    figure.pixels.push(index);
    const x = index % width;
    const y = Math.floor(index / width);
    figure.x0 = Math.min(figure.x0, x);
    figure.x1 = Math.max(figure.x1, x + 1);
    figure.y0 = Math.min(figure.y0, y);
    figure.y1 = Math.max(figure.y1, y + 1);
    for (const next of [index - 1, index + 1, index - width, index + width]) {
      if (next < 0 || next >= width * height || seen[next] === 1) continue;
      if (Math.abs((next % width) - x) > 1 || (alpha[next] ?? 0) === 0) continue;
      seen[next] = 1;
      queue.push(next);
    }
  }
  components.push(figure);
}
const box = (figure: Figure): number => (figure.x1 - figure.x0) * (figure.y1 - figure.y0);
const figures = components
  .filter((figure) => figure.pixels.length >= box(figure) * 0.15)
  .sort((a, b) => b.pixels.length - a.pixels.length)
  .slice(0, expected);
if (figures.length < expected)
  throw new Error(`Expected ${expected} figures in ${input}, found ${figures.length}`);

// Reading order: rows by centre height (a new row once a centre is more than
// half a figure lower than the row's first), then left to right.
const centre = (figure: Figure): number => (figure.y0 + figure.y1) / 2;
const tall = figures.map((figure) => figure.y1 - figure.y0).sort((a, b) => a - b);
const half = (tall[Math.floor(tall.length / 2)] ?? 0) / 2;
const rows: Figure[][] = [];
for (const figure of figures.slice().sort((a, b) => centre(a) - centre(b))) {
  const row = rows.at(-1);
  const first = row?.[0];
  if (row !== undefined && first !== undefined && centre(figure) - centre(first) <= half)
    row.push(figure);
  else rows.push([figure]);
}
const ordered = rows.flatMap((row) => row.sort((a, b) => a.x0 - b.x0));

for (const [order, figure] of ordered.entries()) {
  const pad = 16;
  const x0 = Math.max(0, figure.x0 - pad);
  const y0 = Math.max(0, figure.y0 - pad);
  const x1 = Math.min(width, figure.x1 + pad);
  const y1 = Math.min(height, figure.y1 + pad);
  const w = x1 - x0;
  const h = y1 - y0;
  const out = new Uint8Array(w * h * 3);
  for (let index = 0; index < w * h; index += 1) out.set(keyRgb, index * 3);
  for (const index of figure.pixels) {
    const x = (index % width) - x0;
    const y = Math.floor(index / width) - y0;
    out.set(rgb.subarray(index * 3, index * 3 + 3), (y * w + x) * 3);
  }
  const name = `${output}/raw-${String(order + 1).padStart(2, "0")}.png`;
  const write = Bun.spawn(["magick", "-size", `${w}x${h}`, "-depth", "8", "rgb:-", name],
    { stdin: "pipe", stdout: "inherit", stderr: "inherit" });
  write.stdin.write(out);
  await write.stdin.end();
  if (await write.exited !== 0) throw new Error(`Could not write ${name}`);
}
console.log(`extracted ${ordered.length} figures to ${output}`);
