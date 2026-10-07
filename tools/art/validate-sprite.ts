#!/usr/bin/env bun
export {};

type JsonValue = string | number | boolean | null | JsonValue[] | JsonObject;
type JsonObject = { [key: string]: JsonValue };
type Rect = { x: number; y: number; w: number; h: number };
type SpriteFrame = { frame: Rect; sourceSize: { w: number; h: number } };
type FrameMetrics = {
  height: number;
  opaqueArea: number;
  blockiness: number;
  headWidth: number;
  headMean: [number, number, number];
};
type SpriteSheet = {
  frames: Record<string, SpriteFrame>;
  animations: Record<string, string[]>;
  meta: { size: { w: number; h: number }; baseline: number };
};
// `key` is the chroma key the sprite was cut from (its recipe's validator.key):
// the spill check looks for that colour's fringe at the soft alpha edge.
type ValidatorOptions = {
  biped: boolean;
  idleOnly: boolean;
  directions: string[];
  key: "green" | "magenta";
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

function recipePath(atlas: string): string {
  const explicit = arg("recipe", "");
  if (explicit.length > 0) return explicit;
  const file = atlas.split("/").at(-1) ?? "fae.png";
  const asset = file.endsWith(".png") ? file.slice(0, -4) : file;
  return `art/recipes/${asset}.json`;
}

async function isBiped(atlas: string): Promise<boolean> {
  const path = recipePath(atlas);
  const file = Bun.file(path);
  if (!(await file.exists())) return false;
  const raw: unknown = JSON.parse(await file.text());
  if (!isObject(raw) || !isObject(raw.validator)) return false;
  return raw.validator.biped === true;
}
async function validatorOptions(atlas: string): Promise<ValidatorOptions> {
  const defaults: ValidatorOptions = {
    biped: false, idleOnly: false, directions: ["down", "left", "right"], key: "green",
  };
  const file = Bun.file(recipePath(atlas));
  if (!(await file.exists())) return defaults;
  const raw: unknown = JSON.parse(await file.text());
  if (!isObject(raw) || !isObject(raw.validator)) return defaults;
  const validator = raw.validator;
  return {
    biped: validator.biped === true,
    idleOnly: validator.idleOnly === true,
    directions: Array.isArray(validator.directions)
      ? validator.directions.filter((value): value is string => typeof value === "string")
      : defaults.directions,
    key: validator.key === "magenta" ? "magenta" : "green",
  };
}

function checkFrame(
  name: string,
  frame: SpriteFrame,
  bytes: Uint8Array,
  baseline: number,
  includeHeadMetrics: boolean,
  key: ValidatorOptions["key"],
): { errors: string[]; metrics: FrameMetrics } {
  const width = frame.sourceSize.w;
  const height = frame.sourceSize.h;
  const alpha = new Uint8Array(width * height);
  const errors: string[] = [];
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  let opaqueArea = 0;
  let adjacentPairs = 0;
  let equalAdjacentPairs = 0;
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
    if (opacity > 128) opaqueArea += 1;
    // Spill is measured on the visible soft edge (alpha 16-240), where a key
    // fringe shows; nearly opaque pixels carry the figure's own colour. Key
    // excess over 40, calibrated on frames keyed with and without despill:
    // magenta (Oliver) despilled peaks at min(r, b) - g = 33, undespilled
    // reaches 255 (344 of 419 edge pixels over 40); green (the pup) despilled
    // peaks at g - max(r, b) = 29, undespilled reaches 244 (1,520 of 2,173 over
    // 40). The pup's olive-brown ink and his tennis balls are near-opaque.
    const excess = key === "green" ? green - Math.max(red, blue) : Math.min(red, blue) - green;
    const spill = opacity > 16 && opacity < 240 && excess > 40;
    if (spill) errors.push(`${key} spill`);
    // Opaque pixels still in the key colour: an unkeyed background or an
    // enclosed hole the border flood couldn't reach (18% fuzz, as keyed).
    const keyColour = key === "green" ? [0, 255, 0] : [255, 0, 255];
    if (opacity > 128 && Math.max(Math.abs(red - (keyColour[0] ?? 0)),
      Math.abs(green - (keyColour[1] ?? 0)), Math.abs(blue - (keyColour[2] ?? 0))) <= 46) {
      errors.push(`${key} key colour left in the sprite`);
    }
  }
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width - 1; x += 1) {
      const left = (y * width + x) * 4;
      const right = left + 4;
      if ((bytes[left + 3] ?? 0) <= 128 || (bytes[right + 3] ?? 0) <= 128) continue;
      adjacentPairs += 1;
      if (bytes[left] === bytes[right] && bytes[left + 1] === bytes[right + 1]
        && bytes[left + 2] === bytes[right + 2]) equalAdjacentPairs += 1;
    }
  }
  if (adjacentPairs > 0 && equalAdjacentPairs / adjacentPairs > 0.08) {
    errors.push(`blockiness ${(equalAdjacentPairs / adjacentPairs).toFixed(3)} exceeds 0.08`);
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
    for (const side of [-1, 1] as const) {
      let runStart = -1;
      const edgeCheckBottom = Math.min(maxY, minY + Math.floor((maxY - minY + 1) * 0.7));
      for (let y = minY; y <= edgeCheckBottom + 1; y += 1) {
        const current = y <= maxY
          ? bytes[(y * width + x) * 4 + 3] ?? 0
          : 0;
        const neighborX = x + side;
        const neighbor = y <= maxY && neighborX >= 0 && neighborX < width
          ? bytes[(y * width + neighborX) * 4 + 3] ?? 0
          : 0;
        const continues = current >= 200 && neighbor <= 10;
        if (continues && runStart < 0) runStart = y;
        if (!continues && runStart >= 0) {
          const runLength = y - runStart;
          const edgeRows = Math.max(0, y - runStart);
          if (runLength >= 16) {
            let edgeLuma = 0;
            let insideLuma = 0;
            for (let row = runStart; row < y; row += 1) {
              const edgeOffset = (row * width + x) * 4;
              const insideX = x - side * 4;
              const insideOffset = (row * width + insideX) * 4;
              edgeLuma += ((bytes[edgeOffset] ?? 0)
                + (bytes[edgeOffset + 1] ?? 0)
                + (bytes[edgeOffset + 2] ?? 0)) / 3;
              insideLuma += ((bytes[insideOffset] ?? 0)
                + (bytes[insideOffset + 1] ?? 0)
                + (bytes[insideOffset + 2] ?? 0)) / 3;
            }
            edgeLuma /= edgeRows;
            insideLuma /= edgeRows;
            if (edgeLuma > 115 || Math.abs(edgeLuma - insideLuma) < 25) {
              errors.push(
                `${name}: hard edge x=${x} rows=${runStart}-${y - 1} `
                + `edge=${edgeLuma.toFixed(1)} inside=${insideLuma.toFixed(1)}`,
              );
            }
          }
          runStart = -1;
        }
      }
    }
  }
  if (!includeHeadMetrics) {
    return {
      errors: [...new Set(errors)].map((error) => `${name}: ${error}`),
      metrics: {
        height: maxY >= minY ? maxY - minY + 1 : 0,
        opaqueArea,
        blockiness: adjacentPairs === 0 ? 0 : equalAdjacentPairs / adjacentPairs,
        headWidth: 0,
        headMean: [0, 0, 0],
      },
    };
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
      opaqueArea,
      blockiness: adjacentPairs === 0 ? 0 : equalAdjacentPairs / adjacentPairs,
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

function croppedMirrorIou(bytes: Uint8Array, width: number, height: number): number {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if ((bytes[(y * width + x) * 4 + 3] ?? 0) <= 128) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  if (maxX < minX || maxY < minY) return 1;
  const boxWidth = maxX - minX + 1;
  const boxHeight = maxY - minY + 1;
  const mask = new Uint8Array(boxWidth * boxHeight);
  for (let y = 0; y < boxHeight; y += 1) {
    for (let x = 0; x < boxWidth; x += 1) {
      const source = ((minY + y) * width + minX + x) * 4 + 3;
      if ((bytes[source] ?? 0) > 128) mask[y * boxWidth + x] = 1;
    }
  }
  const flipped = new Uint8Array(mask.length);
  for (let y = 0; y < boxHeight; y += 1) {
    for (let x = 0; x < boxWidth; x += 1) {
      flipped[y * boxWidth + x] = mask[y * boxWidth + boxWidth - x - 1] ?? 0;
    }
  }
  return iou(mask, flipped);
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

function fullMaskAt48(bytes: Uint8Array, width: number, height: number): Uint8Array {
  const size = 48;
  const mask = new Uint8Array(size * size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const sourceX = Math.min(width - 1, Math.floor((x * width) / size));
      const sourceY = Math.min(height - 1, Math.floor((y * height) / size));
      const source = (sourceY * width + sourceX) * 4 + 3;
      if ((bytes[source] ?? 0) > 0) mask[y * size + x] = 1;
    }
  }
  return mask;
}

function binaryMaskAt48(mask: Uint8Array, width: number, height: number): Uint8Array {
  const result = new Uint8Array(48 * 48);
  for (let y = 0; y < 48; y += 1) {
    for (let x = 0; x < 48; x += 1) {
      const sourceX = Math.min(width - 1, Math.floor((x * width) / 48));
      const sourceY = Math.min(height - 1, Math.floor((y * height) / 48));
      result[y * 48 + x] = mask[sourceY * width + sourceX] ?? 0;
    }
  }
  return result;
}

function openedMask(bytes: Uint8Array, width: number, height: number): Uint8Array {
  const source = new Uint8Array(width * height);
  for (let index = 0; index < source.length; index += 1) {
    source[index] = (bytes[index * 4 + 3] ?? 0) > 0 ? 1 : 0;
  }
  const radius = 6;
  const eroded = new Uint8Array(source.length);
  for (let y = radius; y < height - radius; y += 1) {
    for (let x = radius; x < width - radius; x += 1) {
      let solid = 1;
      for (let dy = -radius; dy <= radius && solid === 1; dy += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          if (dx * dx + dy * dy > radius * radius) continue;
          if (source[(y + dy) * width + x + dx] === 0) solid = 0;
        }
      }
      eroded[y * width + x] = solid;
    }
  }
  const opened = new Uint8Array(source.length);
  for (let y = radius; y < height - radius; y += 1) {
    for (let x = radius; x < width - radius; x += 1) {
      let solid = 0;
      for (let dy = -radius; dy <= radius && solid === 0; dy += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          if (dx * dx + dy * dy <= radius * radius
            && eroded[(y + dy) * width + x + dx] === 1) solid = 1;
        }
      }
      opened[y * width + x] = solid;
    }
  }
  return opened;
}

function openedHeadWidth(mask: Uint8Array, width: number, height: number): number {
  let minX = width;
  let maxX = -1;
  let minY = height;
  let maxY = -1;
  for (let index = 0; index < mask.length; index += 1) {
    if (mask[index] === 0) continue;
    const x = index % width;
    const y = Math.floor(index / width);
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  const cutoff = minY + (maxY - minY + 1) * 0.6;
  const rowWidths: number[] = [];
  for (let y = minY; y < cutoff; y += 1) {
    let rowMin = width;
    let rowMax = -1;
    for (let x = 0; x < width; x += 1) {
      if (mask[y * width + x] === 1) {
        rowMin = Math.min(rowMin, x);
        rowMax = Math.max(rowMax, x);
      }
    }
    if (rowMax >= rowMin) rowWidths.push(rowMax - rowMin + 1);
  }
  rowWidths.sort((left, right) => left - right);
  return rowWidths[Math.floor(rowWidths.length / 2)] ?? 0;
}

function topPointX(mask: Uint8Array, width: number, height: number): number {
  let minY = height;
  let maxY = -1;
  for (let index = 0; index < mask.length; index += 1) {
    if (mask[index] === 0) continue;
    const y = Math.floor(index / width);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  const cutoff = minY + (maxY - minY + 1) * 0.3;
  let total = 0;
  let count = 0;
  for (let index = 0; index < mask.length; index += 1) {
    if (mask[index] === 0) continue;
    const y = Math.floor(index / width);
    if (y >= cutoff) continue;
    total += index % width;
    count += 1;
  }
  return count === 0 ? width / 2 : total / count;
}

const atlas = arg("atlas", "public/assets/characters/fae/fae.png");
const jsonPath = arg("json", "public/assets/characters/fae/fae.json");
const expectedWalk = 6;
const headOnThreshold = 0.70;
const rawJson: unknown = JSON.parse(await Bun.file(jsonPath).text());
const sheet = parseSheet(rawJson);
const options = await validatorOptions(atlas);
const biped = options.biped;
const errors: string[] = [];
const frameBytes = new Map<string, Uint8Array>();
const metrics = new Map<string, FrameMetrics>();
for (const [name, frame] of Object.entries(sheet.frames)) {
  const bytes = await pixels(atlas, frame.frame);
  frameBytes.set(name, bytes);
  const result = checkFrame(
    name, frame, bytes, sheet.meta.baseline, biped, options.key,
  );
  errors.push(...result.errors);
  metrics.set(name, result.metrics);
}
for (const direction of options.idleOnly ? [] : ["down", "up"]) {
  const names = sheet.animations[`walk_${direction}`] ?? [];
  const values: number[] = [];
  for (const name of names) {
    const frame = sheet.frames[name];
    const bytes = frameBytes.get(name);
    if (frame === undefined || bytes === undefined) continue;
    const value = croppedMirrorIou(bytes, frame.sourceSize.w, frame.sourceSize.h);
    values.push(value);
    if (process.env.SPRITE_METRICS === "1") {
      console.error(`mirror ${name}=${value.toFixed(3)}`);
    }
  }
  const mean = values.length === 0
    ? 0
    : values.reduce((total, value) => total + value, 0) / values.length;
  if (process.env.SPRITE_METRICS === "1") {
    console.error(`mirror ${direction}_mean=${mean.toFixed(3)}`);
  }
  if (mean < headOnThreshold) {
    errors.push(
      `${direction}: mean walk mirror IoU ${mean.toFixed(3)} `
      + `is below ${headOnThreshold.toFixed(2)}`,
    );
  }
}
if (biped && !options.idleOnly) for (const direction of ["down", "up", "left"]) {
  const idle = metrics.get(`${direction}_idle_01`);
  if (idle === undefined || idle.headWidth === 0) continue;
  for (const name of sheet.animations[`walk_${direction}`] ?? []) {
    const walk = metrics.get(name);
    if (walk === undefined) continue;
    if (Math.abs(walk.headWidth - idle.headWidth) / idle.headWidth > 0.08) {
      errors.push(
        `${name}: head width differs from ${direction}_idle_01 by more than 8%`,
      );
    }
    const colorDistance = Math.sqrt(
      (walk.headMean[0] - idle.headMean[0]) ** 2
      + (walk.headMean[1] - idle.headMean[1]) ** 2
      + (walk.headMean[2] - idle.headMean[2]) ** 2,
    );
    if (colorDistance > 20) {
      errors.push(
        `${name}: head mean RGB distance from ${direction}_idle_01 `
        + `is ${colorDistance.toFixed(1)}, over 20`,
      );
    }
  }
}
const requiredAnimations = options.idleOnly
  ? options.directions.map((direction) => `idle_${direction}`)
  : ["walk_down", "walk_up", "walk_left", "idle_down", "idle_up", "idle_left"];
if (Object.keys(sheet.animations).sort().join(",")
  !== requiredAnimations.slice().sort().join(",")) {
  errors.push(`animations must be exactly ${requiredAnimations.join(", ")}`);
}
const referencedFrames = new Set(Object.values(sheet.animations).flat());
const unusedFrames = Object.keys(sheet.frames).filter((name) => !referencedFrames.has(name));
if (unusedFrames.length > 0) errors.push(`unused frames: ${unusedFrames.join(", ")}`);
for (const [animation, names] of Object.entries(sheet.animations)) {
  for (let left = 0; left < names.length; left += 1) {
    const leftBytes = frameBytes.get(names[left] ?? "");
    if (leftBytes === undefined) continue;
    for (let right = left + 1; right < names.length; right += 1) {
      const rightBytes = frameBytes.get(names[right] ?? "");
      if (rightBytes === undefined || leftBytes.length !== rightBytes.length) continue;
      let identical = true;
      for (let index = 0; index < leftBytes.length; index += 1) {
        if (leftBytes[index] !== rightBytes[index]) {
          identical = false;
          break;
        }
      }
      if (identical) {
        errors.push(`${animation}: pixel-identical frames ${names[left]} and ${names[right]}`);
      }
    }
  }
}
const walkCounts = ["down", "up", "left"].map(
  (direction) => sheet.animations[`walk_${direction}`]?.length ?? 0,
);
if (!options.idleOnly && (new Set(walkCounts).size !== 1 || walkCounts[0] === undefined
  || walkCounts[0] % 2 !== 0 || walkCounts[0] !== expectedWalk)) {
  errors.push(
    `walk animations must all have an even count of ${expectedWalk}, `
    + `got ${walkCounts.join(",")}`,
  );
}
for (const direction of options.idleOnly ? [] : ["down", "up", "left"]) {
  const walk = (sheet.animations[`walk_${direction}`] ?? [])
    .map((name) => metrics.get(name)?.opaqueArea ?? 0);
  const idle = metrics.get(`${direction}_idle_01`)?.opaqueArea ?? 0;
  const minimum = Math.min(...walk);
  const maximum = Math.max(...walk);
  const sorted = walk.slice().sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0
    ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
    : (sorted[middle] ?? 0);
  if (minimum > 0 && maximum / minimum > 1.20) {
    errors.push(`${direction}: walk opaque areas vary by more than 1.20`);
  }
  if (median > 0 && (idle / median < 0.70 || idle / median > 1.40)) {
    errors.push(`${direction}: idle/walk opaque area ratio is outside 0.70-1.40`);
  }
}
// The side idle must face the way the side walk does. Mirrored, it has to look
// clearly less like the walk frames than as drawn. This compares colour, not
// silhouette: a bob and a backpack make a side silhouette nearly symmetric,
// but a face and the back of a head never match. Only the upper 60% of each
// figure counts (head and torso), since the legs change from frame to frame.
function upperOpaque(bytes: Uint8Array, width: number, height: number): Uint8Array {
  const mask = new Uint8Array(width * height);
  let top = height;
  let bottom = -1;
  for (let y = 0; y < height; y += 1)
    for (let x = 0; x < width; x += 1)
      if ((bytes[(y * width + x) * 4 + 3] ?? 0) > 128) {
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
  const cut = top + Math.floor((bottom - top) * 0.6);
  for (let y = top; y < cut; y += 1)
    for (let x = 0; x < width; x += 1)
      if ((bytes[(y * width + x) * 4 + 3] ?? 0) > 128) mask[y * width + x] = 1;
  return mask;
}

function colourDifference(
  idle: Uint8Array, walk: Uint8Array, width: number, height: number, mirror: boolean,
): number {
  const idleMask = upperOpaque(idle, width, height);
  const walkMask = upperOpaque(walk, width, height);
  let total = 0;
  let count = 0;
  for (let y = 0; y < height; y += 1)
    for (let x = 0; x < width; x += 1) {
      const from = y * width + (mirror ? width - 1 - x : x);
      const at = y * width + x;
      if (idleMask[from] !== 1 || walkMask[at] !== 1) continue;
      for (let channel = 0; channel < 3; channel += 1)
        total += Math.abs((idle[from * 4 + channel] ?? 0) - (walk[at * 4 + channel] ?? 0));
      count += 3;
    }
  return count === 0 ? 0 : total / count;
}

const sideFacingMargin = 1.1;
if (!options.idleOnly) {
  const idleName = sheet.animations.idle_left?.[0];
  const idle = idleName === undefined ? undefined : frameBytes.get(idleName);
  const idleFrame = idleName === undefined ? undefined : sheet.frames[idleName];
  if (idle !== undefined && idleFrame !== undefined) {
    const { w, h } = idleFrame.frame;
    const walks = (sheet.animations.walk_left ?? []).flatMap((name) => {
      const bytes = frameBytes.get(name);
      return bytes === undefined ? [] : [bytes];
    });
    const mean = (mirror: boolean): number => walks.length === 0 ? 0
      : walks.reduce((sum, walk) => sum + colourDifference(idle, walk, w, h, mirror), 0)
        / walks.length;
    const asDrawn = mean(false);
    const mirrored = mean(true);
    if (process.env.SPRITE_METRICS === "1")
      console.error(`side facing: as drawn ${asDrawn.toFixed(1)}, mirrored ${mirrored.toFixed(1)}`);
    if (mirrored < asDrawn * sideFacingMargin)
      errors.push(`idle_left: faces the other way from walk_left (colour difference as drawn `
        + `${asDrawn.toFixed(1)}, mirrored ${mirrored.toFixed(1)})`);
  }
}
if (options.idleOnly) {
  for (const direction of options.directions) {
    const names = sheet.animations[`idle_${direction}`] ?? [];
    if (names.length < 1 || names.length > 4) {
      errors.push(`idle_${direction}: missing or invalid animation length`);
    }
  }
}
for (const direction of options.idleOnly ? [] : ["down", "up", "left"]) {
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
