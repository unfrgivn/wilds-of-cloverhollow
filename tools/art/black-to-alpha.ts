#!/usr/bin/env bun
// Lifts light painted on black into colour and alpha: the counterpart of
// white-to-alpha.ts, for glows (blacklight paint, sparkles). A pixel's alpha
// is its brightest channel; its colour is unpremultiplied by that alpha, so
// drawn over black (or added onto a scene) it looks exactly as painted.
// Near-black noise under 8/255 becomes fully transparent.
//
//   bun tools/art/black-to-alpha.ts --input glow-on-black.png --output glow.png
export {};

function value(name: string, fallback: string): string {
  const index = Bun.argv.indexOf(`--${name}`);
  return index >= 0 ? Bun.argv[index + 1] ?? fallback : fallback;
}

async function dimensions(path: string): Promise<{ width: number; height: number }> {
  const process = Bun.spawn(["magick", "identify", "-format", "%w:%h", path], { stdout: "pipe" });
  const text = await new Response(process.stdout).text();
  if (await process.exited !== 0) throw new Error(`Could not identify ${path}`);
  const [width, height] = text.trim().split(":").map(Number);
  if (width === undefined || height === undefined || !Number.isFinite(width) ||
    !Number.isFinite(height)) throw new Error("Invalid dimensions");
  return { width, height };
}

const input = value("input", "");
const output = value("output", "");
if (input.length === 0 || output.length === 0) throw new Error("--input and --output are required");
const size = await dimensions(input);
const read = Bun.spawn(["magick", input, "-alpha", "off", "-depth", "8", "rgb:-"], {
  stdout: "pipe",
});
const bytes = new Uint8Array(await new Response(read.stdout).arrayBuffer());
if (await read.exited !== 0 || bytes.length < size.width * size.height * 3)
  throw new Error("Could not read RGB source");

const pixels = new Uint8Array(size.width * size.height * 4);
for (let index = 0; index < size.width * size.height; index += 1) {
  const r = bytes[index * 3] ?? 0;
  const g = bytes[index * 3 + 1] ?? 0;
  const b = bytes[index * 3 + 2] ?? 0;
  const brightest = Math.max(r, g, b);
  const alpha = brightest < 8 ? 0 : brightest;
  const lift = (channel: number): number =>
    alpha === 0 ? 0 : Math.min(255, Math.round((channel * 255) / alpha));
  pixels[index * 4] = lift(r);
  pixels[index * 4 + 1] = lift(g);
  pixels[index * 4 + 2] = lift(b);
  pixels[index * 4 + 3] = alpha;
}

const write = Bun.spawn(
  ["magick", "-size", `${size.width}x${size.height}`, "-depth", "8", "rgba:-", output],
  { stdin: "pipe" },
);
if (write.stdin === null) throw new Error("Could not open output");
await write.stdin.write(pixels);
await write.stdin.end();
if (await write.exited !== 0) throw new Error(`Could not write ${output}`);
