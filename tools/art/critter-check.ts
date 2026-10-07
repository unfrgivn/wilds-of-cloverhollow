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
// The body's colour fidelity is measured in the critter's own dominant hue
// range (its recipe's checker.bodyHue: the frog's green, the pup's brown),
// ignoring pixels near its body key colour.
type HueRange = { min: number; max: number; minFraction: number };
function hueStats(image: Image, range: HueRange, key: Pixel):
  { fraction: number; saturation: number } {
  const nearKey = (pixel: Pixel): boolean => Math.max(Math.abs(pixel.r - key.r),
    Math.abs(pixel.g - key.g), Math.abs(pixel.b - key.b)) < 100;
  const subject = image.pixels.filter((pixel) => pixel.a > 0 && !nearKey(pixel));
  const inRange = subject.filter((pixel) => {
    const colour = hue(pixel);
    return colour.hue >= range.min && colour.hue <= range.max && colour.saturation >= 0.25;
  });
  const fraction = inRange.length / Math.max(subject.length, 1);
  const saturation = inRange.reduce((sum, pixel) => sum + hue(pixel).saturation, 0)
    / Math.max(inRange.length, 1);
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
// Alpha islands, 8-connected like tools/art/drop-islands.ts (a diagonal touch
// is a visible connection), so a piece the cleanup keeps is never "debris".
function components(image: Image): number[] {
  const seen = new Uint8Array(image.pixels.length); const sizes: number[] = [];
  for (let start = 0; start < seen.length; start += 1) {
    if (seen[start] !== 0 || image.pixels[start]?.a === 0) continue;
    const queue = [start]; seen[start] = 1; let count = 0;
    while (queue.length > 0) {
      const index = queue.pop(); if (index === undefined) continue; count += 1;
      const x = index % image.width;
      const y = Math.floor(index / image.width);
      for (let dy = -1; dy <= 1; dy += 1)
        for (let dx = -1; dx <= 1; dx += 1) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= image.width || ny >= image.height) continue;
          const next = ny * image.width + nx;
          if (seen[next] !== 0 || image.pixels[next]?.a === 0) continue;
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
const bodyHueConfig = object(config.bodyHue);
const bodyHue: HueRange = {
  min: Number(bodyHueConfig?.min ?? 0.17),
  max: Number(bodyHueConfig?.max ?? 0.45),
  minFraction: Number(bodyHueConfig?.minFraction ?? 0.3),
};
// A hue range wider than this says nothing about what colour the critter is
// (0 to 1 accepts every pixel). Approved ranges: frog 0.28, pup 0.11,
// bluebird 0.24.
const maxHueWidth = 0.3;
const bodyKey: Pixel = matteMethods?.body === "green-key"
  ? { r: 0, g: 255, b: 0, a: 255 }
  : { r: 255, g: 0, b: 255, a: 255 };
// Frames are read by name from the atlas JSON beside the image.
const sheet = object(JSON.parse(await Bun.file(atlas.replace(/\.png$/, ".json")).text()));
const rects = object(sheet?.frames);
// Every frame in the atlas is checked, as a body or as an aura: a recipe that
// lists only some frames would let the rest ship unchecked (an owl's recipe
// once listed one body frame, so its size check compared that frame with
// itself while the other poses were drawn at a third of its size).
const unchecked = Object.keys(rects ?? {})
  .filter((name) => !bodyNames.includes(name) && !auraNames.includes(name));
function frameImage(name: string): Image {
  const rect = object(object(rects?.[name])?.frame);
  const x = Number(rect?.x); const y = Number(rect?.y);
  const width = Number(rect?.w); const height = Number(rect?.h);
  if (![x, y, width, height].every(Number.isFinite)) throw new Error(`No frame ${name}`);
  const pixels: Pixel[] = [];
  for (let row = 0; row < height; row += 1) {
    const start = (y + row) * image.width + x;
    pixels.push(...image.pixels.slice(start, start + width));
  }
  return { pixels, width, height };
}
const failures: string[] = [];
function check(pass: boolean, what: string): string {
  if (!pass) failures.push(what);
  return pass ? "PASS" : "FAIL";
}
// Body pixels against the body key (18% fuzz = 46): spill on the visible soft
// edge (alpha 16-240, key excess over 40, as validate-sprite.ts) and opaque
// pixels still in the key colour.
function keyExcess(pixel: Pixel): number {
  return bodyKey.g === 255 ? pixel.g - Math.max(pixel.r, pixel.b)
    : Math.min(pixel.r, pixel.b) - pixel.g;
}
// Steps (4-connected) from each pixel to the nearest fully transparent one.
function edgeDistance(frame: Image): Uint16Array {
  const distance = new Uint16Array(frame.pixels.length).fill(65535);
  const queue: number[] = [];
  frame.pixels.forEach((pixel, index) => {
    if (pixel.a === 0) {
      distance[index] = 0;
      queue.push(index);
    }
  });
  for (let head = 0; head < queue.length; head += 1) {
    const index = queue[head] ?? 0;
    const x = index % frame.width;
    for (const next of [index - 1, index + 1, index - frame.width, index + frame.width]) {
      if (next < 0 || next >= frame.pixels.length || Math.abs((next % frame.width) - x) > 1)
        continue;
      if ((distance[next] ?? 0) <= (distance[index] ?? 0) + 1) continue;
      distance[next] = (distance[index] ?? 0) + 1;
      queue.push(next);
    }
  }
  return distance;
}
// Opaque key colour in the 6 px band inside the alpha edge: background the
// generator blended into an outline (a lime band around the pup's tennis
// balls). Measured worst key excess there: approved frog 34, pup 28; the pup
// keyed at 18% fuzz instead of 45%, 176 (48 pixels over 60).
function bandKey(frame: Image): number {
  const distance = edgeDistance(frame);
  return frame.pixels.filter((pixel, index) => pixel.a > 128
    && (distance[index] ?? 0) <= 6 && keyExcess(pixel) > 60).length;
}
// Opaque pixels still in either chroma key, whichever one the body was keyed
// on: a frame keyed on green can't keep a magenta background, and the other
// way round (a build once keyed a magenta source on green and shipped a
// magenta square). Neither key is a watercolour critter colour.
function chromaLeft(frame: Image): number {
  const near = (pixel: Pixel, key: Pixel): boolean =>
    Math.max(Math.abs(pixel.r - key.r), Math.abs(pixel.g - key.g),
      Math.abs(pixel.b - key.b)) <= 46;
  const green: Pixel = { r: 0, g: 255, b: 0, a: 255 };
  const magenta: Pixel = { r: 255, g: 0, b: 255, a: 255 };
  return frame.pixels.filter((pixel) => pixel.a > 128
    && (near(pixel, green) || near(pixel, magenta))).length;
}
// Straight hard edges where a crop cut through the figure (a build once cut
// every hamster to the top-left of its face). A run of 16+ px that is opaque
// on one side and clear on the other is a cut unless its edge pixels are dark
// ink (mean luma at most 115): the pup's back is a vertical ink outline 25 px
// long, and every crop cut on record went through light fur or the key.
// Checked along rows and columns, over the whole figure.
function hardCuts(frame: Image): string[] {
  const { width, height, pixels } = frame;
  const alpha = (x: number, y: number): number =>
    x < 0 || y < 0 || x >= width || y >= height ? 0 : pixels[y * width + x]?.a ?? 0;
  const luma = (x: number, y: number): number => {
    const pixel = pixels[y * width + x];
    return pixel === undefined ? 0 : (pixel.r + pixel.g + pixel.b) / 3;
  };
  const cuts: string[] = [];
  const scan = (vertical: boolean): void => {
    const lines = vertical ? width : height;
    const length = vertical ? height : width;
    for (let line = 0; line < lines; line += 1)
      for (const side of [-1, 1]) {
        let start = -1;
        for (let step = 0; step <= length; step += 1) {
          const [x, y] = vertical ? [line, step] : [step, line];
          const [nx, ny] = vertical ? [line + side, step] : [step, line + side];
          const continues = step < length && alpha(x, y) >= 200 && alpha(nx, ny) <= 10;
          if (continues && start < 0) start = step;
          if (continues || start < 0) continue;
          if (step - start >= 16) {
            let edge = 0;
            for (let run = start; run < step; run += 1)
              edge += vertical ? luma(line, run) : luma(run, line);
            if (edge / (step - start) > 115)
              cuts.push(`${vertical ? "x" : "y"}=${line} ${start}-${step - 1}`);
          }
          start = -1;
        }
      }
  };
  scan(true);
  scan(false);
  return cuts;
}
const bodyStats = bodyNames.map((name) => {
  const frame = frameImage(name);
  const stats = hueStats(frame, bodyHue, bodyKey);
  return { name, frame, stats, bounds: bounds(frame), parts: components(frame) };
});
const reference = bodyStats[0]?.stats;
const referenceArea = bodyStats[0] === undefined ? 0 : bodyArea(bodyStats[0].frame);
console.log(`atlas=${atlas}`);
check(unchecked.length === 0, `frames no check covers: ${unchecked.join(", ")}`);
const hueWidth = bodyHue.max - bodyHue.min;
console.log(`bodyHue ${bodyHue.min}-${bodyHue.max} width=${hueWidth.toFixed(2)}`
  + ` pass=${check(hueWidth > 0 && hueWidth <= maxHueWidth,
    `bodyHue range ${hueWidth.toFixed(2)} wide (at most ${maxHueWidth})`)}`);
for (const item of bodyStats) {
  const rawValue = rawSources?.[item.name];
  const rawPath = typeof rawValue === "string" ? rawValue : "";
  const raw = rawPath.length > 0 ? await readImage(rawPath) : item.frame;
  const source = hueStats(raw, bodyHue, bodyKey);
  const saturationDelta = Math.abs(item.stats.saturation - source.saturation);
  const colour = check(item.stats.fraction >= bodyHue.minFraction && saturationDelta <= 0.08,
    `${item.name}: colour`);
  const area = bodyArea(item.frame);
  const size = check(referenceArea === 0 || Math.abs(area / referenceArea - 1) <= 0.15,
    `${item.name}: size`);
  const edge = item.bounds;
  const clear = check(edge.left >= 8 && edge.top >= 8 && edge.right >= 8 && edge.bottom >= 8,
    `${item.name}: clearance`);
  const spill = item.frame.pixels.filter((pixel) => pixel.a > 16 && pixel.a < 240
    && keyExcess(pixel) > 40).length;
  const left = item.frame.pixels.filter((pixel) => pixel.a > 128
    && Math.max(Math.abs(pixel.r - bodyKey.r), Math.abs(pixel.g - bodyKey.g),
      Math.abs(pixel.b - bodyKey.b)) <= 46).length;
  const debris = item.parts.filter((pixels) => pixels < 120).length;
  const band = bandKey(item.frame);
  const chroma = chromaLeft(item.frame);
  const keyed = check(spill === 0 && left === 0 && debris === 0 && band === 0 && chroma === 0,
    `${item.name}: keying`);
  const cuts = hardCuts(item.frame);
  const whole = check(cuts.length === 0,
    `${item.name}: cut by a crop (${cuts.slice(0, 3).join(", ")})`);
  console.log(`${item.name} colour=${colour} size=${size} clearance=${clear} keying=${keyed}`
    + ` whole=${whole}`
    + ` spill=${spill} keyLeft=${left} chromaLeft=${chroma} edgeKey=${band} debris=${debris}`
    + ` cuts=${cuts.length}`
    + ` hue=${item.stats.fraction.toFixed(3)}`
    + ` sourceSat=${source.saturation.toFixed(3)}`
    + ` spriteSat=${item.stats.saturation.toFixed(3)}`
    + ` delta=${saturationDelta.toFixed(3)} bodyArea=${area}`
    + ` clearance=${JSON.stringify(item.bounds)} components=${item.parts.length}`);
}
for (const name of auraNames) {
  const frame = frameImage(name);
  const pixels = frame.pixels;
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
  const pass = check(keyPass && dark === 0 && softness >= 0.35 && hueFraction >= 0.70
    && edge.left >= 8 && edge.top >= 8 && edge.right >= 8 && edge.bottom >= 8, `${name}: aura`)
    === "PASS";
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
  + ` atlasPSNR=${atlasPsnr.toFixed(2)} pass=${check(atlasPsnr >= threshold, "upscale")}`);
const calibration = config.calibration;
if (calibration !== undefined) console.log(`upscale-calibration=${JSON.stringify(calibration)}`);
if (reference === undefined) throw new Error("No body frame");
console.log(`body-reference-hue=${reference.fraction.toFixed(3)}`);
if (failures.length > 0) {
  console.error(`FAIL critter check: ${failures.join(", ")}`);
  process.exit(1);
}
console.log("PASS critter check");
