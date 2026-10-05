#!/usr/bin/env bun
export {};

type Pixel = { r: number; g: number; b: number; a: number };
function value(name: string, fallback: string): string {
  const index = Bun.argv.indexOf(`--${name}`);
  return index >= 0 ? Bun.argv[index + 1] ?? fallback : fallback;
}
async function dimensions(path: string): Promise<{ width: number; height: number }> {
  const process = Bun.spawn(
    ["magick", "identify", "-format", "%w:%h", path], { stdout: "pipe" },
  );
  const text = await new Response(process.stdout).text();
  if (await process.exited !== 0) throw new Error(`Could not identify ${path}`);
  const parts = text.trim().split(":");
  const width = Number(parts[0]);
  const height = Number(parts[1]);
  if (!Number.isFinite(width) || !Number.isFinite(height)) throw new Error("Invalid dimensions");
  return { width, height };
}
const input = value("input", "");
const output = value("output", "");
if (input.length === 0 || output.length === 0) throw new Error("--input and --output are required");
const size = await dimensions(input);
const read = Bun.spawn(
  ["magick", input, "-alpha", "off", "-depth", "8", "rgb:-"],
  { stdout: "pipe" },
);
const bytes = new Uint8Array(await new Response(read.stdout).arrayBuffer());
if (await read.exited !== 0 || bytes.length < size.width * size.height * 3) {
  throw new Error("Could not read RGB source");
}
const pixels: Pixel[] = [];
for (let index = 0; index < size.width * size.height; index += 1) {
  const offset = index * 3;
  const r = bytes[offset] ?? 255;
  const g = bytes[offset + 1] ?? 255;
  const b = bytes[offset + 2] ?? 255;
  const rawAlpha = Math.max(255 - r, 255 - g, 255 - b) / 255;
  const alpha = rawAlpha < 8 / 255 ? 0 : rawAlpha;
  const outputAlpha = Math.round(alpha * 255);
  const outputR = alpha === 0 ? 255 : Math.max(
    0, Math.min(255, Math.round(255 - (255 - r) / alpha)),
  );
  const outputG = alpha === 0 ? 255 : Math.max(
    0, Math.min(255, Math.round(255 - (255 - g) / alpha)),
  );
  const outputB = alpha === 0 ? 255 : Math.max(
    0, Math.min(255, Math.round(255 - (255 - b) / alpha)),
  );
  pixels.push({
    r: outputR,
    g: outputG,
    b: outputB,
    a: outputAlpha,
  });
}
const outputBytes = new Uint8Array(pixels.length * 4);
for (const [index, pixel] of pixels.entries()) {
  const offset = index * 4;
  outputBytes[offset] = pixel.r;
  outputBytes[offset + 1] = pixel.g;
  outputBytes[offset + 2] = pixel.b;
  outputBytes[offset + 3] = pixel.a;
}
const write = Bun.spawn(
  ["magick", "-size", `${size.width}x${size.height}`, "-depth", "8", "rgba:-", output],
  { stdin: "pipe" },
);
if (write.stdin === null) throw new Error("Could not open output");
await write.stdin.write(outputBytes);
await write.stdin.end();
if (await write.exited !== 0) throw new Error(`Could not write ${output}`);
