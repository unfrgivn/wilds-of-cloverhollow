#!/usr/bin/env bun
export {};

type JsonValue = string | number | boolean | null | JsonValue[] | JsonObject;
type JsonObject = { [key: string]: JsonValue };
type Rect = { x: number; y: number; w: number; h: number };
type SpriteFrame = { frame: Rect; sourceSize: { w: number; h: number } };
type FrameMetrics = {
  height: number;
  headWidth: number;
  headMean: [number, number, number];
};
type SpriteSheet = {
  frames: Record<string, SpriteFrame>;
  animations: Record<string, string[]>;
  meta: { size: { w: number; h: number }; baseline: number };
};

function isObject(value: JsonValue | unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function number(value: JsonValue | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function stringArray(value: JsonValue | undefined): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function rect(value: JsonValue | undefined): value is Rect {
  return isObject(value)
    && number(value.x) && number(value.y) && number(value.w) && number(value.h);
}

function parseSheet(value: unknown): SpriteSheet {
  if (!isObject(value) || !isObject(value.frames)
    || !isObject(value.animations) || !isObject(value.meta)) {
    throw new Error("spritesheet JSON has an invalid top-level shape");
  }
  const frames: Record<string, SpriteFrame> = {};
  for (const [name, raw] of Object.entries(value.frames)) {
    if (!isObject(raw) || !rect(raw.frame) || !isObject(raw.sourceSize)
      || !number(raw.sourceSize.w) || !number(raw.sourceSize.h)) {
      throw new Error(`invalid frame record: ${name}`);
    }
    frames[name] = {
      frame: raw.frame,
      sourceSize: { w: raw.sourceSize.w, h: raw.sourceSize.h },
    };
  }
  const animations: Record<string, string[]> = {};
  for (const [name, raw] of Object.entries(value.animations)) {
    if (!stringArray(raw)) throw new Error(`invalid animation record: ${name}`);
    animations[name] = raw;
  }
  const meta = value.meta;
  if (!isObject(meta) || !isObject(meta.size)
    || !number(meta.size.w) || !number(meta.size.h)
    || !number(meta.baseline)) {
    throw new Error("spritesheet meta needs size and baseline");
  }
  return {
    frames,
    animations,
    meta: { size: { w: meta.size.w, h: meta.size.h }, baseline: meta.baseline },
  };
}

function arg(name: string, fallback: string): string {
  const index = Bun.argv.indexOf(`--${name}`);
  return index >= 0 ? Bun.argv[index + 1] ?? fallback : fallback;
}

async function pixels(atlas: string, frame: Rect): Promise<Uint8Array> {
  const process = Bun.spawn(
    ["magick", atlas, "-crop", `${frame.w}x${frame.h}+${frame.x}+${frame.y}`,
      "+repage", "-alpha", "on", "-depth", "8", "rgba:-"],
    { stdout: "pipe", stderr: "inherit" },
  );
  const bytes = new Uint8Array(await new Response(process.stdout).arrayBuffer());
  if (await process.exited !== 0 || bytes.length < frame.w * frame.h * 4) {
    throw new Error(`could not read atlas frame at ${frame.x},${frame.y}`);
  }
  return bytes;
}

function checkFrame(
  name: string,
  frame: SpriteFrame,
  bytes: Uint8Array,
  baseline: number,
): { errors: string[]; metrics: FrameMetrics } {
  const width = frame.sourceSize.w;
  const height = frame.sourceSize.h;
  const alpha = new Uint8Array(width * height);
  const errors: string[] = [];
  const direction = name.split("_")[0] ?? name;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let index = 0; index < width * height; index += 1) {
    const offset = index * 4;
    const red = bytes[offset] ?? 0;
    const green = bytes[offset + 1] ?? 0;
    const blue = bytes[offset + 2] ?? 0;
    const opacity = bytes[offset + 3] ?? 0;
    if (opacity === 0) continue;
    const x = index % width;
    const y = Math.floor(index / width);
    alpha[index] = 1;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
    if (green > Math.max(red, blue) + 12) errors.push("green spill");
  }
  if (minX < 8 || maxX >= width - 8 || minY < 8) errors.push("opaque pixel within 8px edge");
  if (maxY < 0 || Math.abs(maxY - baseline) > 2) {
    errors.push(`baseline ${maxY}, expected ${baseline}`);
  }
  const seen = new Uint8Array(alpha.length);
  let components = 0;
  for (let index = 0; index < alpha.length; index += 1) {
    if (alpha[index] === 0 || seen[index] === 1) continue;
    components += 1;
    const queue = [index];
    seen[index] = 1;
    let area = 0;
    while (queue.length > 0) {
      const current = queue.pop();
      if (current === undefined) continue;
      area += 1;
      const x = current % width;
      const y = Math.floor(current / width);
      const neighbors = [
        [-1, -1], [-1, 0], [-1, 1], [0, -1],
        [0, 1], [1, -1], [1, 0], [1, 1],
      ] as const;
      for (const [dx, dy] of neighbors) {
        const nextX = x + dx;
        const nextY = y + dy;
        if (nextX < 0 || nextX >= width || nextY < 0 || nextY >= height) continue;
        const next = nextY * width + nextX;
        if (alpha[next] === 1 && seen[next] === 0) {
          seen[next] = 1;
          queue.push(next);
        }
      }
    }
    if (area < 20) components -= 1;
  }
  if (components > 1) errors.push(`${components} alpha components`);
  for (let x = minX; x <= maxX; x += 1) {
    let run = 0;
    for (let y = minY; y <= maxY; y += 1) {
      const current = bytes[(y * width + x) * 4 + 3] ?? 0;
      const left = x > 0 ? bytes[(y * width + x - 1) * 4 + 3] ?? 0 : 0;
      const right = x + 1 < width
        ? bytes[(y * width + x + 1) * 4 + 3] ?? 0
        : 0;
      if (current >= 200 && (left <= 10 || right <= 10)) {
        run += 1;
        const nearFigureEdge = x <= minX + 4 || x >= maxX - 4;
        if (direction === "up" && run >= 16 && nearFigureEdge) {
          errors.push(`${name}: hard straight alpha edge at x=${x}`);
          break;
        }
      } else {
        run = 0;
      }
    }
  }
  const headBottom = minY + (maxY - minY + 1) * 0.3;
  let headMinX = width;
  let headMaxX = -1;
  let redTotal = 0;
  let greenTotal = 0;
  let blueTotal = 0;
  let headPixels = 0;
  for (let index = 0; index < width * height; index += 1) {
    const x = index % width;
    const y = Math.floor(index / width);
    if (alpha[index] === 0 || y >= headBottom) continue;
    headMinX = Math.min(headMinX, x);
    headMaxX = Math.max(headMaxX, x);
    redTotal += bytes[index * 4] ?? 0;
    greenTotal += bytes[index * 4 + 1] ?? 0;
    blueTotal += bytes[index * 4 + 2] ?? 0;
    headPixels += 1;
  }
  const headWidth = headMaxX >= headMinX ? headMaxX - headMinX + 1 : 0;
  return {
    errors: [...new Set(errors)].map((error) => `${name}: ${error}`),
    metrics: {
      height: maxY >= minY ? maxY - minY + 1 : 0,
      headWidth,
      headMean: headPixels === 0
        ? [0, 0, 0]
        : [redTotal / headPixels, greenTotal / headPixels, blueTotal / headPixels],
    },
  };
}

function maskAt48(bytes: Uint8Array, width: number, height: number): Uint8Array {
  const size = 48;
  const mask = new Uint8Array(size * size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (y >= 34) continue;
      const sourceX = Math.min(width - 1, Math.floor((x * width) / size));
      const sourceY = Math.min(height - 1, Math.floor((y * height) / size));
      const source = (sourceY * width + sourceX) * 4 + 3;
      if ((bytes[source] ?? 0) > 0) mask[y * size + x] = 1;
    }
  }
  return mask;
}

function iou(left: Uint8Array, right: Uint8Array): number {
  let intersection = 0;
  let union = 0;
  for (let index = 0; index < left.length; index += 1) {
    const leftOpaque = left[index] === 1;
    const rightOpaque = right[index] === 1;
    if (leftOpaque && rightOpaque) intersection += 1;
    if (leftOpaque || rightOpaque) union += 1;
  }
  return union === 0 ? 1 : intersection / union;
}

function flipMask(mask: Uint8Array): Uint8Array {
  const size = 48;
  const flipped = new Uint8Array(mask.length);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      flipped[y * size + x] = mask[y * size + (size - x - 1)] ?? 0;
    }
  }
  return flipped;
}

function registerMask(mask: Uint8Array): Uint8Array {
  const size = 48;
  let count = 0;
  let totalX = 0;
  for (let y = 0; y < 18; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (mask[y * size + x] === 1) {
        count += 1;
        totalX += x;
      }
    }
  }
  if (count === 0) return mask;
  const center = totalX / count;
  const shift = Math.round(size / 2 - center);
  const registered = new Uint8Array(mask.length);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const sourceX = x - shift;
      if (sourceX >= 0 && sourceX < size) {
        registered[y * size + x] = mask[y * size + sourceX] ?? 0;
      }
    }
  }
  return registered;
}

const atlas = arg("atlas", "public/assets/characters/fae/fae.png");
const jsonPath = arg("json", "public/assets/characters/fae/fae.json");
const rawJson: unknown = JSON.parse(await Bun.file(jsonPath).text());
const sheet = parseSheet(rawJson);
const errors: string[] = [];
const heights: Record<string, number[]> = {};
const frameBytes = new Map<string, Uint8Array>();
const metrics = new Map<string, FrameMetrics>();
for (const [name, frame] of Object.entries(sheet.frames)) {
  const bytes = await pixels(atlas, frame.frame);
  frameBytes.set(name, bytes);
  const result = checkFrame(name, frame, bytes, sheet.meta.baseline);
  errors.push(...result.errors);
  metrics.set(name, result.metrics);
  const direction = name.split("_")[0] ?? name;
  heights[direction] ??= [];
  heights[direction].push(result.metrics.height);
}
for (const direction of ["down", "up", "left"]) {
  const idleMetrics = metrics.get(`${direction}_idle_01`);
  const walkNames = sheet.animations[`walk_${direction}`] ?? [];
  if (idleMetrics === undefined) continue;
  if (process.env.SPRITE_HEAD_DEBUG === "1") {
    console.error(
      `head ${direction}: idle=${idleMetrics.headWidth} `
      + `rgb=${idleMetrics.headMean.map((value) => value.toFixed(1)).join(",")}`,
    );
  }
  for (const walkName of walkNames) {
    const walkMetrics = metrics.get(walkName);
    if (walkMetrics === undefined) continue;
    if (process.env.SPRITE_HEAD_DEBUG === "1") {
      console.error(
        `head ${walkName}: width=${walkMetrics.headWidth} `
        + `rgb=${walkMetrics.headMean.map((value) => value.toFixed(1)).join(",")}`,
      );
    }
    if (Math.abs(walkMetrics.headWidth - idleMetrics.headWidth)
      / idleMetrics.headWidth > 0.08) {
      errors.push(
        `${walkName}: head width differs from ${direction}_idle_01 by more than 8%`,
      );
    }
    const [idleRed, idleGreen, idleBlue] = idleMetrics.headMean;
    const [walkRed, walkGreen, walkBlue] = walkMetrics.headMean;
    const colorDistance = Math.sqrt(
      (walkRed - idleRed) ** 2
      + (walkGreen - idleGreen) ** 2
      + (walkBlue - idleBlue) ** 2,
    );
    if (colorDistance > 20) {
      errors.push(
        `${walkName}: head mean RGB distance from ${direction}_idle_01 `
        + `is ${colorDistance.toFixed(1)}, over 20`,
      );
    }
  }
}
for (const direction of ["down", "up", "left"]) {
  const idleName = `${direction}_idle_01`;
  const walkName = `${direction}_walk_01`;
  const idle = frameBytes.get(idleName);
  const walk = frameBytes.get(walkName);
  if (idle !== undefined && walk !== undefined) {
    const idleMask = registerMask(maskAt48(idle, 384, 384));
    const walkMask = registerMask(maskAt48(walk, 384, 384));
    const normal = iou(idleMask, walkMask);
    const flipped = iou(flipMask(idleMask), walkMask);
    const idleSymmetry = iou(idleMask, flipMask(idleMask));
    if (process.env.SPRITE_ORIENTATION_DEBUG === "1") {
      console.error(
        `orientation ${direction}: normal=${normal.toFixed(3)} `
        + `flipped=${flipped.toFixed(3)} symmetry=${idleSymmetry.toFixed(3)}`,
      );
    }
    if (flipped > normal + 0.05 && idleSymmetry < 0.9) {
      errors.push(`idle_${direction} appears mirrored relative to walk_${direction}`);
    }
  }
}
const walkCounts = ["down", "up", "left"].map(
  (direction) => sheet.animations[`walk_${direction}`]?.length ?? 0,
);
if (new Set(walkCounts).size !== 1 || walkCounts[0] === undefined
  || walkCounts[0] % 2 !== 0 || walkCounts[0] !== 6) {
  errors.push(`walk animations must all have an even count of 6, got ${walkCounts.join(",")}`);
}
for (const [direction, values] of Object.entries(heights)) {
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  if (minimum > 0 && maximum / minimum > 1.08) {
    errors.push(
      `${direction}: figure heights vary by more than 8% (${minimum}-${maximum})`,
    );
  }
}
for (const direction of ["down", "up", "left"]) {
  for (const type of ["walk", "idle"]) {
    const name = `${type}_${direction}`;
    const animation = sheet.animations[name];
    const invalidWalk = type === "walk"
      && (animation === undefined || animation.length < 4 || animation.length > 6);
    const invalidIdle = type === "idle"
      && (animation === undefined || animation.length < 1 || animation.length > 2);
    if (invalidWalk || invalidIdle) {
      errors.push(`${name}: missing or invalid animation length`);
    }
  }
}
if (errors.length > 0) {
  for (const error of errors) console.error(`FAIL ${error}`);
  process.exit(1);
}
console.log(
  "PASS sprite validator: all frames, animations, edges, components, "
  + "spill, and baseline checks passed",
);
