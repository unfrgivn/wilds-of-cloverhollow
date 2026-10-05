#!/usr/bin/env bun
export {};

type Value = string | number | boolean | null | Value[] | JsonObject;
interface JsonObject { [key: string]: Value }
type Pixel = { r: number; g: number; b: number; a: number };
type Image = { pixels: Pixel[]; width: number; height: number };

function object(value: Value | undefined): JsonObject | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value : undefined;
}
function arg(name: string, fallback: string): string {
  const index = Bun.argv.indexOf(`--${name}`);
  return index >= 0 ? Bun.argv[index + 1] ?? fallback : fallback;
}
async function readImage(path: string): Promise<Image> {
  const size = Bun.spawn(
    ["magick", "identify", "-format", "%w:%h", path], { stdout: "pipe" },
  );
  const text = await new Response(size.stdout).text();
  if (await size.exited !== 0) throw new Error(`identify failed: ${path}`);
  const [widthText, heightText] = text.trim().split(":");
  const width = Number(widthText); const height = Number(heightText);
  const read = Bun.spawn(
    ["magick", path, "-alpha", "on", "-depth", "8", "rgba:-"], { stdout: "pipe" },
  );
  const bytes = new Uint8Array(await new Response(read.stdout).arrayBuffer());
  if (await read.exited !== 0 || bytes.length < width * height * 4) {
    throw new Error(`read failed: ${path}`);
  }
  const pixels: Pixel[] = [];
  for (let index = 0; index < width * height; index += 1) {
    const offset = index * 4;
    pixels.push({ r: bytes[offset] ?? 0, g: bytes[offset + 1] ?? 0,
      b: bytes[offset + 2] ?? 0, a: bytes[offset + 3] ?? 0 });
  }
  return { pixels, width, height };
}
function hue(pixel: Pixel): { hue: number; saturation: number } {
  const red = pixel.r / 255; const green = pixel.g / 255; const blue = pixel.b / 255;
  const high = Math.max(red, green, blue); const low = Math.min(red, green, blue);
  const delta = high - low;
  if (delta === 0) return { hue: 0, saturation: 0 };
  let value = 0;
  if (high === red) value = ((green - blue) / delta) % 6;
  else if (high === green) value = (blue - red) / delta + 2;
  else value = (red - green) / delta + 4;
  if (value < 0) value += 6;
  return { hue: value / 6, saturation: delta / high };
}
function greenStats(image: Image): { fraction: number; saturation: number } {
  const subject = image.pixels.filter((pixel) => pixel.a > 0
    && !(pixel.r > 220 && pixel.b > 220 && pixel.g < 80));
  const green = subject.filter((pixel) => {
    const colour = hue(pixel);
    return pixel.a > 0 && colour.hue >= 0.17 && colour.hue <= 0.45
      && colour.saturation >= 0.25;
  });
  const fraction = green.length / Math.max(subject.length, 1);
  const saturation = green.reduce((sum, pixel) => sum + hue(pixel).saturation, 0)
    / Math.max(green.length, 1);
  return { fraction, saturation };
}
function bounds(image: Image): { left: number; top: number; right: number; bottom: number } {
  const points = image.pixels.flatMap((pixel, index) => pixel.a > 0 ? [index] : []);
  const xs = points.map((index) => index % image.width);
  const ys = points.map((index) => Math.floor(index / image.width));
  return {
    left: Math.min(...xs), top: Math.min(...ys),
    right: image.width - 1 - Math.max(...xs),
    bottom: image.height - 1 - Math.max(...ys),
  };
}
function components(image: Image): number[] {
  const seen = new Uint8Array(image.pixels.length); const sizes: number[] = [];
  for (let start = 0; start < seen.length; start += 1) {
    if (seen[start] !== 0 || image.pixels[start]?.a === 0) continue;
    const queue = [start]; seen[start] = 1; let count = 0;
    while (queue.length > 0) {
      const index = queue.pop(); if (index === undefined) continue; count += 1;
      const x = index % image.width;
      for (const next of [index - 1, index + 1, index - image.width, index + image.width]) {
        if (next < 0 || next >= seen.length || seen[next] !== 0
          || image.pixels[next]?.a === 0) continue;
        if (Math.abs((next % image.width) - x) > 1) continue;
        seen[next] = 1; queue.push(next);
      }
    }
    sizes.push(count);
  }
  return sizes.sort((left, right) => right - left);
}
function bodyArea(image: Image): number {
  return image.pixels.reduce((total, pixel, index) => {
    const x = index % image.width; const y = Math.floor(index / image.width);
    return total + (pixel.a > 0 && x >= 100 && x <= 412 && y >= 100 ? 1 : 0);
  }, 0);
}
async function psnr(path: string): Promise<number> {
  const down = `${path}.down.png`; const round = `${path}.round.png`;
  const first = Bun.spawn(["magick", path, "-resize", "50%", down]); await first.exited;
  const second = Bun.spawn(["magick", down, "-resize", "200%", round]); await second.exited;
  const compare = Bun.spawn(
    ["magick", "compare", "-metric", "PSNR", path, round, "null:"],
    { stderr: "pipe" },
  );
  const text = await new Response(compare.stderr).text(); await compare.exited;
  await Bun.file(down).delete(); await Bun.file(round).delete();
  const value = Number.parseFloat(text.trim().split(" ")[0] ?? "0");
  return Number.isFinite(value) ? value : 0;
}
const recipe = object(JSON.parse(await Bun.file(arg("recipe", "art/recipes/frog.json")).text()));
if (recipe === undefined) throw new Error("Invalid recipe");
const config = object(recipe.checker);
if (config === undefined) throw new Error("Recipe has no checker config");
const atlas = arg("atlas", "public/assets/critters/frog/frog.png");
const image = await readImage(atlas);
const rawSources = object(config.rawSources); const bodyNames = Array.isArray(config.bodyFrames)
  ? config.bodyFrames.filter((value): value is string => typeof value === "string") : [];
const auraNames = Array.isArray(config.auraFrames)
  ? config.auraFrames.filter((value): value is string => typeof value === "string") : [];
const matteMethods = object(config.matteMethods);
const frames = bodyNames.map((name) => name);
const frameWidth = 512; const frameHeight = 512;
const bodyStats = frames.map((name, index) => {
  const x = (index % 3) * frameWidth; const y = Math.floor(index / 3) * frameHeight;
  const pixels: Pixel[] = [];
  for (let row = 0; row < frameHeight; row += 1) {
    const start = (y + row) * image.width + x;
    pixels.push(...image.pixels.slice(start, start + frameWidth));
  }
  const frame: Image = { pixels, width: frameWidth, height: frameHeight };
  const stats = greenStats(frame);
  return { name, frame, stats, bounds: bounds(frame), parts: components(frame) };
});
const reference = bodyStats[0]?.stats;
const referenceArea = bodyStats[0] === undefined ? 0 : bodyArea(bodyStats[0].frame);
console.log(`atlas=${atlas}`);
for (const item of bodyStats) {
  const rawValue = rawSources?.[item.name];
  const rawPath = typeof rawValue === "string" ? rawValue : "";
  const raw = rawPath.length > 0 ? await readImage(rawPath) : item.frame;
  const source = greenStats(raw);
  const saturationDelta = Math.abs(item.stats.saturation - source.saturation);
  const pass = item.stats.fraction >= 0.3 && saturationDelta <= 0.08;
  const area = bodyArea(item.frame);
  const sizePass = referenceArea === 0 || Math.abs(area / referenceArea - 1) <= 0.15;
  console.log(`${item.name} colour=${pass ? "PASS" : "FAIL"} size=${sizePass ? "PASS" : "FAIL"}`
    + ` green=${item.stats.fraction.toFixed(3)}`
    + ` sourceSat=${source.saturation.toFixed(3)}`
    + ` spriteSat=${item.stats.saturation.toFixed(3)}`
    + ` delta=${saturationDelta.toFixed(3)} bodyArea=${area}`
    + ` clearance=${JSON.stringify(item.bounds)} components=${item.parts.length}`);
}
for (const [auraIndex, name] of auraNames.entries()) {
  const atlasIndex = bodyNames.length + auraIndex;
  const x = (atlasIndex % 3) * frameWidth;
  const y = Math.floor(atlasIndex / 3) * frameHeight;
  const pixels: Pixel[] = [];
  for (let row = 0; row < frameHeight; row += 1) {
    const start = (y + row) * image.width + x;
    pixels.push(...image.pixels.slice(start, start + frameWidth));
  }
  const frame: Image = { pixels, width: frameWidth, height: frameHeight };
  const hot = pixels.filter((pixel) => pixel.a > 0
    && pixel.r > 200 && pixel.b > 200 && pixel.g < 100).length;
  const visible = pixels.filter((pixel) => pixel.a > 0);
  const alphaValues = visible.map((pixel) => pixel.a).sort((left, right) => left - right);
  const alphaMedian = alphaValues[Math.floor(alphaValues.length / 2)] ?? 0;
  const soft = visible.filter((pixel) => pixel.a >= 10 && pixel.a <= 200).length;
  const dark = visible.filter((pixel) => pixel.a > 128
    && (pixel.r + pixel.g + pixel.b) / 3 < 60
    && hue(pixel).saturation < 0.25).length;
  const coloured = visible.filter((pixel) => pixel.a > 64);
  const allowedHue = coloured.filter((pixel) => {
    const colour = hue(pixel);
    return (colour.hue >= 0.68 && colour.hue <= 0.90)
      || (colour.hue >= 0.40 && colour.hue <= 0.55);
  }).length;
  const softness = soft / Math.max(visible.length, 1);
  const darkFraction = dark / Math.max(visible.length, 1);
  const hueFraction = allowedHue / Math.max(coloured.length, 1);
  const edge = bounds(frame);
  const keyPass = matteMethods?.aura === "white-lift" || hot === 0;
  const pass = keyPass && dark === 0 && softness >= 0.35 && hueFraction >= 0.70
    && edge.left >= 8 && edge.top >= 8 && edge.right >= 8 && edge.bottom >= 8;
  const keyStatus = matteMethods?.aura === "white-lift" ? "SKIP" : String(hot);
  console.log(`${name} aura=${pass ? "PASS" : "FAIL"} hotKey=${keyStatus}`
    + ` dark=${dark} darkFraction=${darkFraction.toFixed(3)}`
    + ` softness=${softness.toFixed(3)} hue=${hueFraction.toFixed(3)}`
    + ` alphaMedian=${alphaMedian}`
    + ` clearance=${JSON.stringify(edge)} components=${components(frame).length}`);
}
const threshold = Number(config.psnrThreshold ?? 0);
const atlasPsnr = await psnr(atlas);
console.log(`upscale-detector threshold=${threshold}`
  + ` atlasPSNR=${atlasPsnr.toFixed(2)} pass=${atlasPsnr >= threshold}`);
const calibration = config.calibration;
if (calibration !== undefined) console.log(`upscale-calibration=${JSON.stringify(calibration)}`);
if (reference === undefined) throw new Error("No body frame");
console.log(`body-reference-green=${reference.fraction.toFixed(3)}`);
