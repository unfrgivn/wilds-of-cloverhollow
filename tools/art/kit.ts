#!/usr/bin/env bun
/*
 * The area kit (spec 6, docs/art/kit.md): splits an approved area painting
 * into a clean ground plate and prop sprites.
 *
 *   painting crop ─isolate (Gemini)──────────▶ object mask ─┐
 *                 ─isolate with its shadow──▶ shadow mask   ├▶ prop frame and shadow
 *                 ─complete what's in front─▶ whole object ─┘   (approved pixels)
 *   plate crop + magenta hole ─inpaint─▶ best fill ─▶ patched plate
 *
 *   shadow decal = painting ÷ plate under the cast shadow, drawn with multiply
 *
 * Generated pixels only fill plate holes, finish parts hidden behind other
 * props, or become masks: every visible default prop pixel is the approved
 * painting's. Gemini outputs are cached in art/scratch/kit/<area>/, and pack
 * keeps the chosen ones in art/source/areas/<area>/kit/, so a rebuild from a
 * clean checkout makes no calls. Each subject's samples record the crop they
 * were drawn from (`crop.json`): when a crop changes, its subject starts over.
 * masks and pack refuse a crop that misses its seed or its footprint, and
 * masks warns of a mask that runs into its crop's edge (`problems`).
 *
 *   bun tools/art/kit.ts <area> gen     isolate samples for every subject
 *   bun tools/art/kit.ts <area> masks   masks, holes, art/review/kit/<area>/masks-*.png
 *   bun tools/art/kit.ts <area> fill    completions, plate fills, frames, shadows, proofs
 *   bun tools/art/kit.ts <area> pack    atlas, catalogue, plate tiles, recipe, review
 *   bun tools/art/kit.ts <area> place   placements for unplaced props, into the area JSON
 *   bun tools/art/kit.ts <area> grid <x0> <y0> <x1> <y1> [px per unit]
 *                                        the painting with a unit grid, for measuring
 *   bun tools/art/kit.ts <area> overlay [<x0> <y0> <x1> <y1> [px per unit]]
 *                                        every footprint and home, the floor, and blockers;
 *                                        with a region, zoomed in over the unit grid
 */
import { spawnSync } from "node:child_process";
import {
  copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync,
  statSync, writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { reachablePositions } from "../../src/content/area-checks";
import { loadContent } from "../../src/content/load";

type Point = [number, number];
type Polygon = Point[];
type Rect = [number, number, number, number];
type Samples = { object?: number; fill?: number; complete?: number };
// A generated extra state; `note` is its recipe (model, prompt, references).
type ExtraState = {
  source: string;
  width: number;
  footprint: Polygon[];
  shadow: boolean;
  note: string;
};
type Subject = {
  id: string;
  crop: Rect;
  object: string;
  ground: string;
  seed: Point;
  painted: boolean;
  canopy: boolean;
  complete: boolean;
  front: string[];
  exclude: Polygon[];
  core: number;
  solid: boolean;
  shadowReach: number;
  footprint: Polygon[];
  home: Point;
  samples: Samples;
  states: Record<string, ExtraState>;
  // Why this footprint may disagree with its drawing (pack's footprint check).
  footprintNote: string | undefined;
};
type Tile = { file: string; x: number; y: number; width: number; height: number };
type Mask = Uint8Array;
type Box = { x: number; y: number; w: number; h: number; ratio: string; size: string };
type Frame = { name: string; path: string; w: number; h: number; ax: number; ay: number };
type Columns = { left: number; step: number; columns: string[] };

const MODEL = "gemini-3-pro-image";
const SLOTS = 8;
const RATIOS: [number, number][] = [
  [1, 1], [2, 3], [3, 2], [3, 4], [4, 3], [4, 5], [5, 4], [9, 16], [16, 9], [21, 9],
];

// --- config ---------------------------------------------------------------

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const list = (value: unknown): unknown[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const items: unknown[] = value;
  return items;
};
const isNumber = (value: unknown): value is number => typeof value === "number";
const isPoint = (value: unknown): value is Point => {
  const items = list(value);
  return items !== undefined && items.length === 2 && items.every(isNumber);
};

function text(value: unknown, name: string): string {
  if (typeof value !== "string") throw new Error(`${name} must be a string`);
  return value;
}

function point(value: unknown, name: string): Point {
  if (!isPoint(value)) throw new Error(`${name} must be [x, y]`);
  return value;
}

function polygons(value: unknown, name: string): Polygon[] {
  if (value === undefined) return [];
  const items = list(value);
  if (items === undefined) throw new Error(`${name} must be a list of polygons`);
  return items.map((polygon, index) => {
    const points = list(polygon);
    if (points === undefined || points.length < 3 || !points.every(isPoint))
      throw new Error(`${name}[${index}] must be a polygon of [x, y] points`);
    return points.filter(isPoint);
  });
}

// The default home: the footprint's southmost point, x at its centre.
function homeOf(footprint: Polygon[], name: string): Point {
  const points = footprint.flat();
  if (points.length === 0) throw new Error(`${name} needs a home or a footprint`);
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  return [Math.round((Math.min(...xs) + Math.max(...xs)) / 2), Math.round(Math.max(...ys))];
}

function subject(value: unknown): Subject {
  if (!isRecord(value)) throw new Error("a subject must be an object");
  const id = text(value.id, "subject id");
  const crop = (list(value.crop) ?? []).filter(isNumber);
  if (crop.length !== 4) throw new Error(`${id}.crop must be [x, y, width, height]`);
  const [x = 0, y = 0, w = 0, h = 0] = crop;
  const footprint = polygons(value.footprint, `${id}.footprint`);
  const samples = isRecord(value.samples) ? value.samples : {};
  const states: Record<string, ExtraState> = {};
  if (isRecord(value.states))
    for (const [name, raw] of Object.entries(value.states)) {
      if (!isRecord(raw) || typeof raw.width !== "number")
        throw new Error(`${id}.states.${name} needs a source and a width`);
      states[name] = {
        source: text(raw.source, `${id}.states.${name}.source`),
        width: raw.width,
        footprint: polygons(raw.footprint, `${id}.states.${name}.footprint`),
        shadow: raw.shadow === true,
        note: text(raw.note, `${id}.states.${name}.note`),
      };
    }
  const strings = (items: unknown): string[] =>
    (list(items) ?? []).filter((item): item is string => typeof item === "string");
  const count = (key: string): number | undefined => {
    const n = samples[key];
    return typeof n === "number" ? n : undefined;
  };
  const chosen: Samples = {};
  const object = count("object");
  const fill = count("fill");
  const complete = count("complete");
  if (object !== undefined) chosen.object = object;
  if (fill !== undefined) chosen.fill = fill;
  if (complete !== undefined) chosen.complete = complete;
  return {
    id,
    crop: [x, y, w, h],
    object: text(value.object, `${id}.object`),
    ground: typeof value.ground === "string" ? value.ground : "the ground",
    seed: point(value.seed, `${id}.seed`),
    painted: value.painted === true,
    canopy: value.canopy === true,
    complete: value.complete === true,
    front: strings(value.front),
    exclude: polygons(value.exclude, `${id}.exclude`),
    core: typeof value.core === "number" ? value.core : 0,
    solid: value.solid === true,
    shadowReach: typeof value.shadowReach === "number" ? value.shadowReach : 50,
    footprint,
    home: value.home === undefined ? homeOf(footprint, id) : point(value.home, `${id}.home`),
    footprintNote: typeof value.footprintNote === "string" ? value.footprintNote : undefined,
    samples: chosen,
    states,
  };
}

// --- paths and the painting -----------------------------------------------

const area = Bun.argv[2] ?? "";
const step = Bun.argv[3] ?? "";
if (!/^[a-z-]+$/.test(area) || step === "")
  throw new Error("usage: bun tools/art/kit.ts <area> gen|masks|fill|pack|place|grid|overlay");
const configPath = `art/kit/${area}.json`;
const paintingDir = `art/source/areas/${area}/painting`;
const sourceDir = `art/source/areas/${area}/kit`;
const scratch = `art/scratch/kit/${area}`;
const review = `art/review/kit/${area}`;
const publicDir = `public/assets/areas/${area}`;
const rawConfig: unknown = JSON.parse(readFileSync(configPath, "utf8"));
const rawSubjects = isRecord(rawConfig) ? list(rawConfig.subjects) : undefined;
if (rawSubjects === undefined) throw new Error(`${configPath} needs subjects`);
const subjects = rawSubjects.map(subject);
const byId = new Map(subjects.map((item) => [item.id, item]));
for (const item of subjects)
  for (const id of item.front)
    if (!byId.has(id)) throw new Error(`${item.id}: unknown front subject ${id}`);

function readTiles(path: string): { tiles: Tile[]; width: number; height: number } {
  const json: unknown = JSON.parse(readFileSync(path, "utf8"));
  const rawTiles = isRecord(json) ? list(json.tiles) : undefined;
  if (!isRecord(json) || rawTiles === undefined || typeof json.width !== "number" ||
      typeof json.height !== "number") throw new Error(`bad ground manifest ${path}`);
  const tiles = rawTiles.flatMap((tile): Tile[] =>
    isRecord(tile) && typeof tile.file === "string" && typeof tile.x === "number" &&
    typeof tile.y === "number" && typeof tile.width === "number" &&
    typeof tile.height === "number"
      ? [{ file: tile.file, x: tile.x, y: tile.y, width: tile.width, height: tile.height }]
      : []);
  return { tiles, width: json.width, height: json.height };
}

// The approved painting moves out of the runtime folder before the plate
// replaces it there; its manifest and tiles are kept as they were.
if (!existsSync(`${paintingDir}/ground.json`)) {
  mkdirSync(paintingDir, { recursive: true });
  const manifest = readTiles(`${publicDir}/ground.json`);
  for (const tile of manifest.tiles)
    copyFileSync(`${publicDir}/${tile.file}`, `${paintingDir}/${tile.file}`);
  copyFileSync(`${publicDir}/ground.json`, `${paintingDir}/ground.json`);
}
const painting = readTiles(`${paintingDir}/ground.json`);
mkdirSync(scratch, { recursive: true });
mkdirSync(review, { recursive: true });

function im(...args: string[]): string {
  const result = Bun.spawnSync(["magick", ...args], { stdout: "pipe", stderr: "pipe" });
  if (result.exitCode !== 0)
    throw new Error(`magick ${args.join(" ")}\n${result.stderr.toString()}`);
  return result.stdout.toString().trim();
}
const mean = (...args: string[]): number =>
  Number(im(...args, "-format", "%[fx:mean]", "info:"));

const original = `${scratch}/original.png`;
if (!existsSync(original)) {
  const args = ["-size", `${painting.width}x${painting.height}`, "xc:#fcfbf6"];
  for (const tile of painting.tiles)
    args.push(`${paintingDir}/${tile.file}`, "-geometry", `+${tile.x}+${tile.y}`, "-composite");
  im(...args, "-depth", "8", original);
}

// A subject's crop in painting pixels, grown to the nearest aspect ratio
// Gemini takes and kept inside the painting.
function box(item: Subject): Box {
  const [ux, uy, uw, uh] = item.crop;
  const w0 = Math.round(uw * 2);
  const h0 = Math.round(uh * 2);
  let ratio: [number, number] = [1, 1];
  let gap = Infinity;
  for (const candidate of RATIOS) {
    const g = Math.abs(Math.log(w0 / h0 / (candidate[0] / candidate[1])));
    if (g < gap) {
      gap = g;
      ratio = candidate;
    }
  }
  let w = w0;
  let h = h0;
  if (w / h < ratio[0] / ratio[1]) w = Math.round((h * ratio[0]) / ratio[1]);
  else h = Math.round((w * ratio[1]) / ratio[0]);
  w = Math.min(w, painting.width);
  h = Math.min(h, painting.height);
  const cx = Math.round(ux * 2) + w0 / 2;
  const cy = Math.round(uy * 2) + h0 / 2;
  const x = Math.max(0, Math.min(painting.width - w, Math.round(cx - w / 2)));
  const y = Math.max(0, Math.min(painting.height - h, Math.round(cy - h / 2)));
  const long = Math.max(w, h);
  const size = long <= 1100 ? "1K" : long <= 2200 ? "2K" : "4K";
  return { x, y, w, h, ratio: `${ratio[0]}:${ratio[1]}`, size };
}

const dir = (item: Subject): string => `${scratch}/${item.id}`;

/*
 * The crop a subject's samples were drawn from, written beside them in the
 * scratch cache and in art/source (`crop.json`). Samples drawn from another
 * crop are stale. The scratch cache and the kept samples are judged apart,
 * each by its own stamp: a stale cache is cleared (and refilled from the kept
 * samples when theirs matches), and stale kept samples are passed over, so the
 * subject is drawn again from its new crop. A cache from before stamps is
 * checked by its crop image; kept samples from before stamps (the plaza's) are
 * trusted unless the cache shows the crop changed since.
 */
const cropStamp = (item: Subject): string => `${JSON.stringify(box(item))}\n`;
const staleKept = new Set<string>();
for (const item of subjects) {
  const stamp = cropStamp(item);
  const kept = `${sourceDir}/${item.id}/crop.json`;
  const keptStamped = existsSync(kept);
  if (keptStamped && readFileSync(kept, "utf8") !== stamp) staleKept.add(item.id);
  const drawn = `${dir(item)}/crop.json`;
  const image = `${dir(item)}/crop.png`;
  const changed = existsSync(drawn)
    ? readFileSync(drawn, "utf8") !== stamp
    : existsSync(image) && !sameCrop(item, image);
  if (changed) {
    rmSync(dir(item), { recursive: true, force: true });
    if (!keptStamped) staleKept.add(item.id);
  }
  if (staleKept.has(item.id)) console.log(`${item.id}: its crop changed, so it is drawn again`);
}

// Whether `image` is the painting under the subject's crop now.
function sameCrop(item: Subject, image: string): boolean {
  const { x, y, w, h } = box(item);
  const size = im(image, "-format", "%w %h", "info:");
  return size === `${w} ${h}` && mean(original, "-crop", `${w}x${h}+${x}+${y}`, "+repage",
    image, "-compose", "difference", "-composite") === 0;
}

// A kept file (art/source) restored into the scratch cache; true if it exists.
function restore(item: Subject, name: string): boolean {
  const out = `${dir(item)}/${name}`;
  if (existsSync(out)) return true;
  const kept = `${sourceDir}/${item.id}/${name}`;
  if (!existsSync(kept) || staleKept.has(item.id)) return false;
  mkdirSync(dir(item), { recursive: true });
  copyFileSync(kept, out);
  return true;
}
const toCrop = (item: Subject, [wx, wy]: Point): Point => {
  const { x, y } = box(item);
  return [wx * 2 - x, wy * 2 - y];
};

// --- Gemini -----------------------------------------------------------------

function mainCheckout(): string {
  const git = spawnSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"],
    { encoding: "utf8" });
  const common = git.status === 0 ? git.stdout.trim() : "";
  return common.endsWith("/.git") ? dirname(common) : process.cwd();
}

// At most SLOTS calls at once across every kit run on this machine.
async function slot(): Promise<() => void> {
  const slots = join(mainCheckout(), "art/scratch/gemini-slots");
  mkdirSync(slots, { recursive: true });
  for (;;) {
    for (let index = 0; index < SLOTS; index += 1) {
      const path = join(slots, `slot-${index}`);
      try {
        mkdirSync(path);
        return () => rmSync(path, { recursive: true, force: true });
      } catch {
        try {
          if (Date.now() - statSync(path).mtimeMs > 300_000) rmSync(path, { recursive: true });
        } catch {
          // Another run freed it first.
        }
      }
    }
    await Bun.sleep(1000 + Math.random() * 1000);
  }
}

let calls = 0;

// One cached sample: the chosen sample kept in art/source is reused, then the
// scratch cache, and only then is Gemini called.
async function gemini(prompt: string, ref: string, out: string, crop: Box): Promise<void> {
  if (existsSync(out)) return;
  const kept = out.replace(scratch, sourceDir);
  const id = out.slice(scratch.length + 1).split("/")[0] ?? "";
  mkdirSync(dirname(out), { recursive: true });
  if (existsSync(kept) && !staleKept.has(id)) {
    copyFileSync(kept, out);
    return;
  }
  const waits = [5, 20, 60];
  for (let attempt = 0; attempt <= waits.length; attempt += 1) {
    const release = await slot();
    const child = Bun.spawn([
      "bun", "tools/art/gemini-image.ts", "--model", MODEL, "--aspect-ratio", crop.ratio,
      "--image-size", crop.size, "--prompt", prompt, "--ref", ref,
    ], { stdout: "pipe", stderr: "pipe" });
    const output = await new Response(child.stdout).text();
    const code = await child.exited;
    release();
    calls += 1;
    const path = output.trim().split("\n").at(-1);
    if (code === 0 && path !== undefined && existsSync(path)) {
      renameSync(path, out);
      return;
    }
    const wait = waits[attempt];
    if (wait === undefined) break;
    console.log(`  retry in ${wait}s: ${out}`);
    await Bun.sleep(wait * 1000);
  }
  throw new Error(`Gemini failed for ${out}`);
}

async function pool(jobs: (() => Promise<void>)[], size: number): Promise<void> {
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < jobs.length) {
      const job = jobs[next];
      next += 1;
      if (job !== undefined) await job();
    }
  };
  await Promise.all(Array.from({ length: size }, worker));
}

const isolatePrompt = (object: string, shadow: boolean): string =>
  "This is a crop of a hand-painted watercolor-and-ink game map. Recolor EVERYTHING except " +
  `${object}${shadow ? ", together with its soft cast shadow on the ground," : ""} to flat ` +
  `solid magenta #FF00FF. That includes the ground${shadow ? "" : ", its cast shadow"}, and ` +
  `every other object. Keep ${shadow ? "it and its shadow" : "it"} exactly as it is: the same ` +
  "pixels, position, size, outline, and colours, with its brown ink outline fully kept. Gaps " +
  "between its parts that show ground must also become magenta. Output the whole image at the " +
  "same framing.";

const fillPrompt = (ground: string): string =>
  "This is a crop of a hand-painted watercolor-and-ink storybook game map seen from a 3/4 " +
  "top-down view. Fill ONLY the flat magenta (#FF00FF) area so it seamlessly continues " +
  `${ground} around it: the same soft watercolor washes, colours, line work, and paper ` +
  "texture. The filled area must be empty ground: no objects, no shadows, no new things. " +
  "Keep every pixel outside the magenta area exactly as it is, in the same position and " +
  "scale. Output the whole image at the same framing.";

const completePrompt = (object: string, ground: string): string =>
  "This is a crop of a hand-painted watercolor-and-ink storybook game map seen from a 3/4 " +
  `top-down view. Flat magenta (#FF00FF) covers part of ${object}. Redraw ONLY the magenta ` +
  "area: where it covers the object, continue the object so it is whole, with the same " +
  "outline, shapes, materials, and colours as its visible part; where it covers anything " +
  `else, continue ${ground}. Keep every pixel outside the magenta area exactly as it is, in ` +
  "the same position and scale. Output the whole image at the same framing.";

// --- masks ------------------------------------------------------------------

function rgb(path: string, w: number, h: number): Uint8Array {
  const result = Bun.spawnSync(["magick", path, "-resize", `${w}x${h}!`, "-depth", "8",
    "rgb:-"], { stdout: "pipe", stderr: "pipe" });
  if (result.exitCode !== 0) throw new Error(`could not read ${path}`);
  return new Uint8Array(result.stdout);
}

function readMask(path: string, w: number, h: number): Mask {
  const bytes = rgb(path, w, h);
  return Uint8Array.from({ length: w * h }, (_, index) => (bytes[index * 3] ?? 0) > 127 ? 1 : 0);
}

function writeMask(mask: Mask, w: number, h: number, out: string): void {
  const bytes = Uint8Array.from(mask, (value) => value * 255);
  const result = Bun.spawnSync(["magick", "-size", `${w}x${h}`, "-depth", "8", "gray:-", out],
    { stdin: bytes, stderr: "pipe" });
  if (result.exitCode !== 0) throw new Error(`could not write ${out}`);
}

// Background is the model's magenta, including the darker magenta it leaves
// on neighbours' outlines: hue 274..324 degrees with HSL saturation >= 0.45.
// The approved paintings have no saturated magenta; pinks sit near 345.
// With `shade`, the darkened key the model leaves for a kept shadow counts too.
function keyMask(bytes: Uint8Array, shade = false): Mask {
  const mask = new Uint8Array(bytes.length / 3);
  for (let index = 0; index < mask.length; index += 1) {
    const r = (bytes[index * 3] ?? 0) / 255;
    const g = (bytes[index * 3 + 1] ?? 0) / 255;
    const b = (bytes[index * 3 + 2] ?? 0) / 255;
    const high = Math.max(r, g, b);
    const low = Math.min(r, g, b);
    const light = (high + low) / 2;
    const chroma = high - low;
    const saturation = chroma === 0 ? 0 : chroma / (1 - Math.abs(2 * light - 1));
    let hue = 0;
    if (chroma > 0) {
      if (high === r) hue = ((g - b) / chroma + 6) % 6;
      else if (high === g) hue = (b - r) / chroma + 2;
      else hue = (r - g) / chroma + 4;
    }
    const magenta = hue * 60 >= 274 && hue * 60 <= 324 && saturation >= 0.45;
    const key = saturation >= 0.9 && light >= 0.44;
    const shadow = shade && magenta && !key && light >= 0.33;
    mask[index] = magenta && !shadow ? 0 : 1;
  }
  return mask;
}

// Dark ink in the approved painting (CIE L* below 52).
function inkMask(bytes: Uint8Array): Mask {
  const linear = (value: number): number => {
    const c = value / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const mask = new Uint8Array(bytes.length / 3);
  for (let index = 0; index < mask.length; index += 1) {
    const y = 0.2126 * linear(bytes[index * 3] ?? 0) +
      0.7152 * linear(bytes[index * 3 + 1] ?? 0) + 0.0722 * linear(bytes[index * 3 + 2] ?? 0);
    const lightness = y > 0.008856 ? 116 * Math.cbrt(y) - 16 : 903.3 * y;
    mask[index] = lightness < 52 ? 1 : 0;
  }
  return mask;
}

// Square dilation (grow) or erosion, as two separable passes.
function morph(mask: Mask, w: number, h: number, radius: number, grow: boolean): Mask {
  if (radius <= 0) return mask;
  const pass = (source: Mask, horizontal: boolean): Mask => {
    const out = new Uint8Array(source.length);
    const lines = horizontal ? h : w;
    const length = horizontal ? w : h;
    for (let line = 0; line < lines; line += 1) {
      const at = (i: number): number => horizontal ? line * w + i : i * w + line;
      // A running count of set pixels in the window keeps this O(pixels).
      let set = 0;
      for (let i = 0; i < Math.min(radius, length); i += 1) set += source[at(i)] ?? 0;
      for (let i = 0; i < length; i += 1) {
        const enter = i + radius;
        if (enter < length) set += source[at(enter)] ?? 0;
        const leave = i - radius - 1;
        if (leave >= 0) set -= source[at(leave)] ?? 0;
        const window = Math.min(length - 1, i + radius) - Math.max(0, i - radius) + 1;
        out[at(i)] = grow ? (set > 0 ? 1 : 0) : (set === window ? 1 : 0);
      }
    }
    return out;
  };
  return pass(pass(mask, true), false);
}

const union = (...masks: Mask[]): Mask =>
  Uint8Array.from(masks[0] ?? [], (_, index) => masks.some((mask) => mask[index] === 1) ? 1 : 0);
const minus = (mask: Mask, cut: Mask): Mask =>
  Uint8Array.from(mask, (value, index) => value & (1 - (cut[index] ?? 0)));
const both = (a: Mask, b: Mask): Mask =>
  Uint8Array.from(a, (value, index) => value & (b[index] ?? 0));
const area2 = (mask: Mask): number => mask.reduce((sum, value) => sum + value, 0);

// The object's component under the seed, plus every solid component within
// `reach` px of it (hanging baskets on thin keyed-out chains).
function nearSeed(mask: Mask, w: number, h: number, seed: Point, reach: number): Mask {
  const labels = new Int32Array(mask.length).fill(-1);
  let count = 0;
  for (let start = 0; start < mask.length; start += 1) {
    if (mask[start] !== 1 || labels[start] !== -1) continue;
    const queue = [start];
    labels[start] = count;
    for (let head = 0; head < queue.length; head += 1) {
      const at = queue[head] ?? 0;
      const x = at % w;
      const y = (at - x) / w;
      for (let dy = -1; dy <= 1; dy += 1)
        for (let dx = -1; dx <= 1; dx += 1) {
          const nx = x + dx;
          const ny = y + dy;
          const next = ny * w + nx;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h || mask[next] !== 1 ||
              labels[next] !== -1) continue;
          labels[next] = count;
          queue.push(next);
        }
    }
    count += 1;
  }
  let seedLabel = -1;
  let best = Infinity;
  for (let index = 0; index < mask.length; index += 1) {
    const label = labels[index] ?? -1;
    if (label < 0) continue;
    const x = index % w;
    const d = (x - seed[0]) ** 2 + ((index - x) / w - seed[1]) ** 2;
    if (d < best) {
      best = d;
      seedLabel = label;
    }
  }
  const core = Uint8Array.from(labels, (label) => label === seedLabel ? 1 : 0);
  const near = morph(core, w, h, reach, true);
  // Thin lines (other objects' outlines the model left) vanish when opened.
  const opened = morph(morph(mask, w, h, 2, false), w, h, 2, true);
  const solid = new Map<number, number>();
  opened.forEach((value, index) => {
    const label = labels[index] ?? -1;
    if (value === 1 && label >= 0) solid.set(label, (solid.get(label) ?? 0) + 1);
  });
  const keep = new Set<number>([seedLabel]);
  near.forEach((value, index) => {
    const label = labels[index] ?? -1;
    if (value === 1 && label >= 0 && (solid.get(label) ?? 0) >= 250) keep.add(label);
  });
  return Uint8Array.from(labels, (label) => keep.has(label) ? 1 : 0);
}

function inside(polygon: Polygon, x: number, y: number): boolean {
  let hit = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const [xi = 0, yi = 0] = polygon[i] ?? [];
    const [xj = 0, yj = 0] = polygon[j] ?? [];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

// Removes the exclude polygons (world units); `solid` fills enclosed
// background; `core` keeps only parts thicker than 2 * core + 1 px (and the
// rim within core + 2 px of them), so neighbours' thin outlines go.
function clean(item: Subject, input: Mask): Mask {
  const { x, y, w, h } = box(item);
  let mask = Uint8Array.from(input);
  if (item.exclude.length > 0)
    for (let row = 0; row < h; row += 1)
      for (let col = 0; col < w; col += 1)
        if (item.exclude.some((polygon) => inside(polygon, (col + x) / 2, (row + y) / 2)))
          mask[row * w + col] = 0;
  if (item.solid) {
    const outside = new Uint8Array(w * h);
    const queue: number[] = [];
    const visit = (at: number): void => {
      if (mask[at] === 0 && outside[at] === 0) {
        outside[at] = 1;
        queue.push(at);
      }
    };
    for (let col = 0; col < w; col += 1) {
      visit(col);
      visit((h - 1) * w + col);
    }
    for (let row = 0; row < h; row += 1) {
      visit(row * w);
      visit(row * w + w - 1);
    }
    for (let head = 0; head < queue.length; head += 1) {
      const at = queue[head] ?? 0;
      const col = at % w;
      if (at >= w) visit(at - w);
      if (at < (h - 1) * w) visit(at + w);
      if (col > 0) visit(at - 1);
      if (col < w - 1) visit(at + 1);
    }
    mask = Uint8Array.from(outside, (value) => value === 1 ? 0 : 1);
  }
  if (item.core === 0) return mask;
  const solid = morph(morph(mask, w, h, item.core, false), w, h, item.core, true);
  return both(mask, morph(solid, w, h, item.core + 2, true));
}

const objectSamples = (item: Subject): number[] =>
  item.samples.object === undefined ? [1, 2] : [item.samples.object];

// The model softens ink lines; the painting's own dark ink within 3 px comes back.
function objectMask(item: Subject, n: number): Mask {
  const { w, h } = box(item);
  const out = `${dir(item)}/obj-${n}.png`;
  if (existsSync(out)) return readMask(out, w, h);
  const seed = toCrop(item, item.seed);
  let mask = nearSeed(keyMask(rgb(`${dir(item)}/iso-${n}.jpg`, w, h)), w, h, seed, 12);
  const ink = inkMask(rgb(`${dir(item)}/crop.png`, w, h));
  mask = union(mask, both(ink, morph(mask, w, h, 3, true)));
  mask = morph(morph(mask, w, h, 1, true), w, h, 1, false);
  mask = nearSeed(mask, w, h, seed, 12);
  writeMask(mask, w, h, out);
  return mask;
}

// Another subject's mask, moved into this subject's crop.
function mapInto(item: Subject, other: Subject, mask: Mask): Mask {
  const at = box(item);
  const from = box(other);
  const out = new Uint8Array(at.w * at.h);
  for (let row = 0; row < at.h; row += 1)
    for (let col = 0; col < at.w; col += 1) {
      const ox = col + at.x - from.x;
      const oy = row + at.y - from.y;
      if (ox >= 0 && oy >= 0 && ox < from.w && oy < from.h && mask[oy * from.w + ox] === 1)
        out[row * at.w + col] = 1;
    }
  return out;
}

const finals = new Map<string, Mask>();

// The chosen sample, minus every subject drawn in front of this one.
function finalMask(item: Subject): Mask {
  const known = finals.get(item.id);
  if (known !== undefined) return known;
  const { w, h } = box(item);
  let mask = objectMask(item, item.samples.object ?? 1);
  for (const id of item.front) {
    const other = byId.get(id);
    if (other === undefined) continue;
    mask = minus(mask, morph(mapInto(item, other, finalMask(other)), w, h, 1, true));
  }
  mask = nearSeed(clean(item, mask), w, h, toCrop(item, item.seed), 12);
  finals.set(item.id, mask);
  writeMask(mask, w, h, `${dir(item)}/final.png`);
  return mask;
}

// Every other subject's final mask, in this subject's crop.
function others(item: Subject, painted = false): Mask {
  const { w, h } = box(item);
  let result: Mask = new Uint8Array(w * h);
  for (const other of subjects)
    if (other.id !== item.id && (!painted || other.painted))
      result = union(result, mapInto(item, other, finalMask(other)));
  return result;
}

function shades(item: Subject): Mask {
  const { w, h } = box(item);
  const out = `${dir(item)}/shade.png`;
  if (restore(item, "shade.png")) return readMask(out, w, h);
  const object = objectMask(item, item.samples.object ?? 1);
  const reach = morph(object, w, h, item.shadowReach, true);
  const seed = toCrop(item, item.seed);
  let shade: Mask = new Uint8Array(w * h);
  for (const n of [1, 2]) {
    // Opening by 3 px drops neighbours' tinted outlines; shadows are blobs.
    const keyed = keyMask(rgb(`${dir(item)}/shadow-${n}.jpg`, w, h), true);
    const opened = morph(morph(keyed, w, h, 3, false), w, h, 3, true);
    shade = union(shade, both(nearSeed(union(opened, object), w, h, seed, 12), reach));
  }
  writeMask(shade, w, h, out);
  return shade;
}

// A lifted subject's plate hole: it and its shadow, grown 6 px, never into a
// painted subject (those stay on the plate).
function holeMask(item: Subject): Mask {
  const { w, h } = box(item);
  const out = `${dir(item)}/hole.png`;
  if (existsSync(out)) return readMask(out, w, h);
  const object = objectMask(item, item.samples.object ?? 1);
  const mask = minus(morph(union(object, shades(item)), w, h, 6, true), others(item, true));
  writeMask(mask, w, h, out);
  return mask;
}

/*
 * What's wrong with a subject's crop and mask. Errors (pack refuses them): a
 * crop that misses the subject's seed, or where it meets the ground (its
 * footprint), so its picture can't reach its own foot. Warnings: a final mask
 * that runs into an edge of its crop where the painting goes on. The object is
 * cut off there, or its mask has leaked into a neighbour; that's harmless only
 * where nobody is ever drawn behind the cut (a treetop above everyone's head),
 * so say why in the review. Each is fixed in the config (a bigger crop, a seed
 * on the object, an `exclude`, a neighbour in `front`), then gen and masks again.
 */
function problems(item: Subject): { errors: string[]; warnings: string[] } {
  const { x, y, w, h } = box(item);
  const inside = ([px, py]: Point): boolean =>
    px * 2 >= x && px * 2 <= x + w && py * 2 >= y && py * 2 <= y + h;
  const errors: string[] = [];
  if (!inside(item.seed)) errors.push("its seed is outside its crop");
  const missed = item.footprint.flat().filter((at) => !inside(at)).length;
  if (missed > 0) errors.push(`${missed} of its footprint's points are outside its crop`);
  const mask = finalMask(item);
  const count = (at: (index: number) => number, length: number): number => {
    let set = 0;
    for (let index = 0; index < length; index += 1) set += mask[at(index)] ?? 0;
    return set;
  };
  const edges: [string, boolean, number][] = [
    ["top", y > 0, count((index) => index, w)],
    ["bottom", y + h < painting.height, count((index) => (h - 1) * w + index, w)],
    ["left", x > 0, count((index) => index * w, h)],
    ["right", x + w < painting.width, count((index) => index * w + w - 1, h)],
  ];
  const warnings = edges.filter(([, open, pixels]) => open && pixels > 3)
    .map(([side, , pixels]) => `its mask runs into its crop's ${side} edge (${pixels} px)`);
  return { errors, warnings };
}

function report(kind: "errors" | "warnings"): string[] {
  return subjects.flatMap((item) => problems(item)[kind].map((text) => `${item.id}: ${text}`));
}

// --- steps --------------------------------------------------------------------

async function gen(): Promise<void> {
  const jobs: (() => Promise<void>)[] = [];
  for (const item of subjects) {
    const crop = box(item);
    mkdirSync(dir(item), { recursive: true });
    const path = `${dir(item)}/crop.png`;
    if (!existsSync(path))
      im(original, "-crop", `${crop.w}x${crop.h}+${crop.x}+${crop.y}`, "+repage", path);
    writeFileSync(`${dir(item)}/crop.json`, cropStamp(item));
    for (const n of objectSamples(item))
      jobs.push(() => gemini(isolatePrompt(item.object, false), path,
        `${dir(item)}/iso-${n}.jpg`, crop));
    // The kept shadow mask stands in for the two shadow isolates it came from.
    if (!item.painted && !restore(item, "shade.png"))
      for (const n of [1, 2])
        jobs.push(() => gemini(isolatePrompt(item.object, true), path,
          `${dir(item)}/shadow-${n}.jpg`, crop));
  }
  await pool(jobs, SLOTS);
  console.log(`gen: ${jobs.length} isolate samples ready, ${calls} new calls`);
}

function masks(): void {
  for (const item of subjects) {
    const { w, h } = box(item);
    const samples = objectSamples(item);
    for (const n of samples) objectMask(item, n);
    finalMask(item);
    if (!item.painted) holeMask(item);
    const show = (path: string): string[] => ["(", `${dir(item)}/crop.png`, "(", path,
      "-negate", "-fill", "#ff00ff", "-opaque", "white", ")", "-compose", "lighten",
      "-composite", ")"];
    const last = item.painted ? `${dir(item)}/final.png` : `${dir(item)}/hole.png`;
    const scale = Math.min(1, 360 / Math.max(w, h));
    im(...samples.flatMap((n) => show(`${dir(item)}/obj-${n}.png`)),
      ...show(`${dir(item)}/final.png`), ...show(last), "-resize", `${Math.round(scale * 100)}%`,
      "+append", `${review}/masks-${item.id}.png`);
  }
  console.log(`masks: ${subjects.length} subjects; review ${review}/masks-*.png`);
  for (const line of report("warnings")) console.log(`  warning, ${line}`);
  const errors = report("errors");
  for (const line of errors) console.log(`  error, ${line}`);
  if (errors.length > 0) {
    console.log(`masks: ${errors.length} errors; fix the config, then gen and masks again`);
    process.exitCode = 1;
  }
}

const plate = `${scratch}/plate.png`;

// Pastes `sample` into `base` inside `region` (feathered) and checks the
// sample left everything outside it alone (mean difference at most 4/255).
function paste(base: string, sample: string, region: Mask, w: number, h: number,
  folder: string, tag: string): { path: string; align: number } {
  const regionPath = `${folder}/${tag}-region.png`;
  writeMask(region, w, h, regionPath);
  const outside = `${folder}/${tag}-outside.png`;
  writeMask(minus(new Uint8Array(w * h).fill(1), morph(region, w, h, 12, true)), w, h, outside);
  const resized = `${folder}/${tag}.png`;
  im(sample, "-resize", `${w}x${h}!`, resized);
  const share = Math.max(mean(outside), 1e-6);
  const align = mean(resized, base, "-compose", "difference", "-composite", "-colorspace",
    "gray", outside, "-compose", "multiply", "-composite") / share;
  const path = `${folder}/${tag}-pasted.png`;
  im(base, resized, "(", regionPath, "-morphology", "Dilate", "Disk:3", "-blur", "0x3", ")",
    "-composite", path);
  return { path, align };
}

/*
 * A lifted subject partly hidden behind another (bench-north behind the
 * fountain) gets its hidden part painted, so it stays whole when the front
 * one moves. The model sees the patched plate with the subject's own pixels
 * back on it and magenta where the front subject covered it, so there is
 * nothing in front left to continue; a second isolate keeps what it drew.
 */
async function completion(item: Subject): Promise<void> {
  const folder = dir(item);
  const crop = box(item);
  const { x, y, w, h } = crop;
  const final = finalMask(item);
  let covered: Mask = new Uint8Array(w * h);
  for (const id of item.front) {
    const other = byId.get(id);
    if (other !== undefined) covered = union(covered, mapInto(item, other, finalMask(other)));
  }
  const region = both(morph(covered, w, h, 3, true), morph(final, w, h, 60, true));
  if (area2(region) === 0) return;
  const base = `${folder}/complete-base.png`;
  im(plate, "-crop", `${w}x${h}+${x}+${y}`, "+repage", `${folder}/crop.png`,
    `${folder}/final.png`, "-composite", base);
  writeMask(region, w, h, `${folder}/complete-region.png`);
  const input = `${folder}/complete-input.png`;
  im(base, "(", "-size", `${w}x${h}`, "xc:#FF00FF", ")", `${folder}/complete-region.png`,
    "-composite", input);
  const samples = item.samples.complete === undefined ? [1, 2] : [item.samples.complete];
  await Promise.all(samples.map((n) => gemini(completePrompt(item.object, item.ground), input,
    `${folder}/complete-${n}.jpg`, crop)));
  const seed = toCrop(item, item.seed);
  const shown: string[] = [];
  for (const n of samples) {
    const pasted = paste(base, `${folder}/complete-${n}.jpg`, region, w, h, folder,
      `complete-${n}`);
    await gemini(isolatePrompt(item.object, false), pasted.path,
      `${folder}/completeiso-${n}.jpg`, crop);
    const drawn = nearSeed(keyMask(rgb(`${folder}/completeiso-${n}.jpg`, w, h)), w, h, seed,
      12);
    writeMask(union(final, both(drawn, region)), w, h, `${folder}/whole-${n}.png`);
    im(pasted.path, "(", `${folder}/whole-${n}.png`, "-blur", "0x0.6", ")", "-alpha", "off",
      "-compose", "CopyOpacity", "-composite", `${folder}/whole-frame-${n}.png`);
    shown.push(`${n}: ${area2(both(drawn, region))} px, align ${(pasted.align * 255).toFixed(1)}`);
  }
  const chosen = item.samples.complete ?? 1;
  copyFileSync(`${folder}/complete-${chosen}-pasted.png`, `${folder}/whole-crop.png`);
  copyFileSync(`${folder}/whole-${chosen}.png`, `${folder}/whole.png`);
  im(input, ...samples.flatMap((n) => ["(", "-size", `${w}x${h}`, "xc:#2a9d8f",
    `${folder}/whole-frame-${n}.png`, "-composite", ")"]), "+append",
  `${review}/complete-${item.id}.png`);
  console.log(`${item.id}: completion ${shown.join("; ")} (using ${chosen})`);
}

async function fillHole(item: Subject): Promise<void> {
  const folder = dir(item);
  const crop = box(item);
  const { x, y, w, h } = crop;
  const hole = holeMask(item);
  const base = `${folder}/plate-in.png`;
  im(plate, "-crop", `${w}x${h}+${x}+${y}`, "+repage", base);
  const input = `${folder}/fill-input.png`;
  im(base, "(", "-size", `${w}x${h}`, "xc:#FF00FF", ")", `${folder}/hole.png`, "-composite",
    input);
  const samples = item.samples.fill === undefined ? [1, 2, 3] : [item.samples.fill];
  await Promise.all(samples.map((n) =>
    gemini(fillPrompt(item.ground), input, `${folder}/fill-${n}.jpg`, crop)));
  const band = minus(morph(hole, w, h, 24, true), morph(hole, w, h, 4, true));
  const holeShare = Math.max(area2(hole) / (w * h), 1e-6);
  const bandShare = Math.max(area2(band) / (w * h), 1e-6);
  writeMask(band, w, h, `${folder}/band.png`);
  const scores: { n: number; align: number; score: number }[] = [];
  for (const n of samples) {
    const pasted = paste(base, `${folder}/fill-${n}.jpg`, hole, w, h, folder, `fill-${n}`);
    const lum = `${folder}/lum-${n}.png`;
    im(pasted.path, "-colorspace", "Lab", "-channel", "R", "-separate", "+channel", lum);
    const ink = `${folder}/ink-${n}.png`;
    im(lum, "-threshold", "52%", "-negate", ink);
    const within = (image: string, region: string, share: number): number =>
      mean(image, region, "-compose", "multiply", "-composite") / share;
    // A fill should carry as much ink and tone as the ground just around it.
    const score = 4 * Math.abs(within(ink, `${folder}/hole.png`, holeShare) -
      within(ink, `${folder}/band.png`, bandShare)) +
      Math.abs(within(lum, `${folder}/hole.png`, holeShare) -
        within(lum, `${folder}/band.png`, bandShare));
    scores.push({ n, align: pasted.align, score: pasted.align > 4 / 255 ? 99 : score });
  }
  scores.sort((a, b) => a.score - b.score);
  const best = item.samples.fill ?? scores[0]?.n ?? 1;
  writeFileSync(`${folder}/fill-scores.json`, JSON.stringify({ best, scores }, null, 2));
  im(plate, `${folder}/fill-${best}-pasted.png`, "-geometry", `+${x}+${y}`, "-composite", plate);
  const shown = scores.map((s) => `${s.n}:${s.score.toFixed(3)}/${(s.align * 255).toFixed(1)}`);
  console.log(`${item.id}: fill ${best} (score/align ${shown.join(" ")})`);
}

// The prop frame (approved pixels, plus any completed part), its multiply
// shadow decal, and a proof strip: painting | plate | rebuilt | moved | cutout.
function cut(item: Subject): void {
  const folder = dir(item);
  const { x, y, w, h } = box(item);
  const wholePath = `${folder}/whole.png`;
  const mask = existsSync(wholePath) ? wholePath : `${folder}/final.png`;
  const pixels = existsSync(wholePath) ? `${folder}/whole-crop.png` : `${folder}/crop.png`;
  im(pixels, "(", mask, "-blur", "0x0.6", ")", "-alpha", "off", "-compose", "CopyOpacity",
    "-composite", `${folder}/frame.png`);
  const teal = `${folder}/teal.png`;
  im("-size", `${w}x${h}`, "xc:#2a9d8f", `${folder}/frame.png`, "-composite", teal);
  const scale = `${Math.round(Math.min(1, 300 / Math.max(w, h)) * 100)}%`;
  if (item.painted) {
    rmSync(`${folder}/shadow.png`, { force: true });
    im(`${folder}/crop.png`, teal, "-resize", scale, "+append", `${review}/proof-${item.id}.png`);
    return;
  }
  const after = `${folder}/plate-out.png`;
  im(plate, "-crop", `${w}x${h}+${x}+${y}`, "+repage", after);
  const region = minus(minus(shades(item), morph(readMask(mask, w, h), w, h, 2, true)),
    morph(others(item), w, h, 3, true));
  writeMask(region, w, h, `${folder}/shade-region.png`);
  if (area2(region) < 50) rmSync(`${folder}/shadow.png`, { force: true });
  else
    im(`${folder}/crop.png`, after, "-compose", "DivideSrc", "-composite", "-blur", "0x2",
      "(", `${folder}/shade-region.png`, "-blur", "0x3", ")", "-alpha", "off", "-compose",
      "CopyOpacity", "-composite", `${folder}/shadow.png`);
  const flat = `${folder}/shadow-flat.png`;
  if (existsSync(`${folder}/shadow.png`))
    im(`${folder}/shadow.png`, "-background", "white", "-alpha", "remove", flat);
  else im("-size", `${w}x${h}`, "xc:white", flat);
  const rebuilt = `${folder}/rebuilt.png`;
  im(after, flat, "-compose", "multiply", "-composite", `${folder}/frame.png`,
    "-compose", "over", "-composite", rebuilt);
  // The ground the fill shows through in the default layout: the hole, minus
  // this prop and every other prop drawn over it.
  const ring = minus(minus(holeMask(item), morph(readMask(mask, w, h), w, h, 2, true)),
    morph(others(item), w, h, 3, true));
  writeMask(ring, w, h, `${folder}/ring.png`);
  const share = area2(ring) / (w * h);
  const off = share === 0 ? 0 : mean(rebuilt, `${folder}/crop.png`, "-compose",
    "difference", "-composite", "-colorspace", "gray", "-threshold", "12%",
    `${folder}/ring.png`, "-compose", "multiply", "-composite") / share;
  writeFileSync(`${folder}/rebuild.json`, `${JSON.stringify({ ring: area2(ring), off })}\n`);
  // painting | the default layout with its wrong ground pixels in red
  const wrong = `${folder}/ring-wrong.png`;
  im(rebuilt, `${folder}/crop.png`, "-compose", "difference", "-composite", "-colorspace",
    "gray", "-threshold", "12%", `${folder}/ring.png`, "-compose", "multiply", "-composite",
    wrong);
  im(`${folder}/crop.png`, "(", rebuilt, "(", "-size", `${w}x${h}`, "xc:red", wrong, "-alpha",
    "off", "-compose", "CopyOpacity", "-composite", ")", "-compose", "over", "-composite",
    ")", "-resize", scale, "+append", `${review}/ring-${item.id}.png`);
  console.log(`${item.id}: ${(off * 100).toFixed(1)}% of the ground round it rebuilds wrong`);
  const moved = `${folder}/moved.png`;
  im(after, "(", flat, "-roll", "-60+40", ")", "-compose", "multiply", "-composite",
    "(", `${folder}/frame.png`, "-roll", "-60+40", ")", "-compose", "over", "-composite", moved);
  im(`${folder}/crop.png`, after, rebuilt, moved, teal, "-resize", scale, "+append",
    `${review}/proof-${item.id}.png`);
}

async function fill(): Promise<void> {
  for (const item of subjects) finalMask(item);
  im(original, plate);
  for (const item of subjects) if (!item.painted) await fillHole(item);
  for (const item of subjects) if (item.complete) await completion(item);
  for (const item of subjects) cut(item);
  console.log(`fill: done, ${calls} new calls; review ${review}/proof-*.png`);
}

// --- pack -------------------------------------------------------------------

// The frame trimmed to its alpha (+2 px), as wide as a whole number of 10 px
// (5-unit) columns, and anchored at the subject's home.
function trimmed(name: string, image: string, item: Subject, home: Point): Frame | undefined {
  const { x, y } = box(item);
  const geometry = im(image, "-alpha", "extract", "-threshold", "1%", "-format", "%@", "info:");
  const match = /^(\d+)x(\d+)\+(\d+)\+(\d+)$/.exec(geometry);
  if (match === null) return undefined;
  const [fw = 0, fh = 0, fx = 0, fy = 0] = match.slice(1).map(Number);
  if (fw < 2 || fh < 2) return undefined;
  const left = Math.max(0, fx - 2);
  const top = Math.max(0, fy - 2);
  const width = Math.ceil((fw + 4) / 10) * 10;
  const path = `${scratch}/frames/${name}.png`;
  mkdirSync(dirname(path), { recursive: true });
  im(image, "-crop", `${fw + 4}x${fh + 4}+${left}+${top}`, "+repage", "-background", "none",
    "-gravity", "NorthWest", "-extent", `${width}x${fh + 4}`, `PNG32:${path}`);
  const [w = 1, h = 1] = im(path, "-format", "%w %h", "info:").split(" ").map(Number);
  return { name, path, w, h, ax: (home[0] * 2 - x - left) / w, ay: (home[1] * 2 - y - top) / h };
}

// A frame's opaque runs per 5-unit column, relative to the home point.
function silhouette(frame: Frame): Columns {
  const bytes = Bun.spawnSync(["magick", frame.path, "-alpha", "extract", "-depth", "8",
    "gray:-"], { stdout: "pipe" }).stdout;
  const alpha = new Uint8Array(bytes);
  const left = Math.round((-frame.ax * frame.w / 2) * 1000) / 1000;
  const top = -frame.ay * frame.h / 2;
  const columns: string[] = [];
  for (let c0 = 0; c0 < frame.w; c0 += 10) {
    const runs: [number, number][] = [];
    let start = -1;
    for (let row = 0; row <= frame.h; row += 1) {
      let opaque = false;
      if (row < frame.h)
        for (let col = c0; col < Math.min(frame.w, c0 + 10) && !opaque; col += 1)
          opaque = (alpha[row * frame.w + col] ?? 0) >= 128;
      if (opaque && start < 0) start = row;
      if (!opaque && start >= 0) {
        const last = runs.at(-1);
        // Runs closer than 6 px (3 units) merge.
        if (last !== undefined && start - last[1] <= 6) last[1] = row;
        else runs.push([start, row]);
        start = -1;
      }
    }
    columns.push(runs.map(([a, b]) =>
      `${Math.floor(top + a / 2)} ${Math.ceil(top + b / 2)}`).join(" "));
  }
  return { left, step: 5, columns };
}

function relative(polygonsIn: Polygon[], home: Point): Polygon[] {
  return polygonsIn.map((polygon) => polygon.map(([px, py]): Point =>
    [Math.round((px - home[0]) * 10) / 10, Math.round((py - home[1]) * 10) / 10]));
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  const temp = `${path}.tmp`;
  writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`);
  renameSync(temp, path);
}

/*
 * A footprint must sit on its own drawing: the object meets the ground at the
 * bottom of its picture. In the footprint's columns the drawing's lowest
 * opaque point is the object's base; the footprint's south edge belongs within
 * 30 units of it, and the footprint inside the drawing's height. A footprint
 * that fails is on the wrong object, in front of it, or the mask lost the
 * object's base: collision there would be an invisible wall.
 */
function footprintProblems(id: string, footprint: Polygon[], home: Point,
  columns: Columns): { errors: string[]; warnings: string[] } {
  const points = footprint.flat();
  if (points.length === 0) return { errors: [], warnings: [] };
  const fx0 = Math.min(...points.map(([x]) => x));
  const fx1 = Math.max(...points.map(([x]) => x));
  const fy0 = Math.min(...points.map(([, y]) => y));
  const fy1 = Math.max(...points.map(([, y]) => y));
  const drawn = columns.columns.flatMap((column, index) => {
    const numbers = column.trim() === "" ? [] : column.trim().split(/\s+/).map(Number);
    if (numbers.length === 0) return [];
    const x = home[0] + columns.left + (index + 0.5) * columns.step;
    const top = home[1] + Math.min(...numbers.filter((_, at) => at % 2 === 0));
    const bottom = home[1] + Math.max(...numbers.filter((_, at) => at % 2 === 1));
    return [{ x, top, bottom }];
  });
  const under = drawn.filter((column) => column.x >= fx0 && column.x <= fx1);
  const at = `${id}: footprint x ${Math.round(fx0)}-${Math.round(fx1)} ` +
    `y ${Math.round(fy0)}-${Math.round(fy1)}`;
  if (under.length === 0)
    return { errors: [`${at} has nothing drawn above it`], warnings: [] };
  const base = Math.max(...under.map((column) => column.bottom));
  const top = Math.min(...drawn.map((column) => column.top));
  const errors: string[] = [];
  const warnings: string[] = [];
  if (fy1 > base + 30)
    errors.push(`${at}: its south edge is ${Math.round(fy1 - base)} units in front of ` +
      `the drawing's base (y ${Math.round(base)})`);
  if (fy0 < top)
    errors.push(`${at}: it reaches above the drawing (top y ${Math.round(top)})`);
  if (fy1 < base - 40)
    warnings.push(`${at}: the drawing hangs ${Math.round(base - fy1)} units below it ` +
      "(roots, a stray line, or the footprint is behind the base?)");
  return { errors, warnings };
}

type CatalogueState = {
  frame: string;
  shadow: string | null;
  footprint: Polygon[];
  silhouette: Columns;
};

function pack(): void {
  const errors = report("errors");
  if (errors.length > 0)
    throw new Error(`pack: the kit has errors (see masks):\n${errors.join("\n")}`);
  const frames: Frame[] = [];
  const props: Record<string, {
    canopy: boolean;
    painted: boolean;
    home: Point;
    states: Record<string, CatalogueState>;
  }> = {};
  for (const item of subjects) {
    const body = trimmed(item.id, `${dir(item)}/frame.png`, item, item.home);
    if (body === undefined) throw new Error(`${item.id}: empty frame`);
    frames.push(body);
    const shadow = item.painted || !existsSync(`${dir(item)}/shadow.png`)
      ? undefined
      : trimmed(`${item.id}-shadow`, `${dir(item)}/shadow.png`, item, item.home);
    if (shadow !== undefined) frames.push(shadow);
    const states: Record<string, CatalogueState> = {
      default: {
        frame: item.id,
        shadow: shadow === undefined ? null : shadow.name,
        footprint: relative(item.footprint, item.home),
        silhouette: silhouette(body),
      },
    };
    for (const [name, extra] of Object.entries(item.states)) {
      const frameName = `${item.id}-${name}`;
      const path = `${scratch}/frames/${frameName}.png`;
      mkdirSync(dirname(path), { recursive: true });
      im(extra.source, "-fuzz", "14%", "-fill", "none", "-draw", "color 0,0 floodfill",
        "-transparent", "#FF00FF", "-trim", "+repage", "-resize", `${extra.width * 2}x`,
        "-background", "none", "-gravity", "center", "-extent",
        `${Math.ceil(extra.width / 5) * 10}x`, `PNG32:${path}`);
      Bun.spawnSync(["bun", "tools/art/despill-edge.ts", "--input", path, "--output", path,
        "--key", "magenta", "--band", "3"]);
      const [w = 1, h = 1] = im(path, "-format", "%w %h", "info:").split(" ").map(Number);
      const frame: Frame = { name: frameName, path, w, h, ax: 0.5, ay: (h - 6) / h };
      frames.push(frame);
      let shadowName: string | null = null;
      if (extra.shadow) {
        shadowName = `${frameName}-shadow`;
        const shadowPath = `${scratch}/frames/${shadowName}.png`;
        const sh = Math.round(h * 0.45) + 40;
        im(path, "-alpha", "extract", "-resize", "100%x45%", "-background", "black",
          "-gravity", "center", "-extent", `${w + 60}x${sh}`, "-blur", "0x8",
          "-evaluate", "multiply", "0.55", "(", "+clone", "-fill", "rgb(196,170,206)",
          "-colorize", "100%", ")", "+swap", "-alpha", "off", "-compose", "CopyOpacity",
          "-composite", `PNG32:${shadowPath}`);
        frames.push({ name: shadowName, path: shadowPath, w: w + 60, h: sh, ax: 0.5, ay: 0.4 });
      }
      states[name] = {
        frame: frameName,
        shadow: shadowName,
        footprint: relative(extra.footprint, item.home),
        silhouette: silhouette(frame),
      };
    }
    props[item.id] = { canopy: item.canopy, painted: item.painted, home: item.home, states };
  }
  const failures: string[] = [];
  for (const item of subjects)
    for (const [name, state] of Object.entries(props[item.id]?.states ?? {})) {
      const world = state.footprint.map((polygon) => polygon.map(([x, y]): Point =>
        [x + item.home[0], y + item.home[1]]));
      const found = footprintProblems(`${item.id}.${name}`, world, item.home, state.silhouette);
      for (const warning of found.warnings) console.log(`  warning: ${warning}`);
      if (item.footprintNote !== undefined)
        for (const error of found.errors)
          console.log(`  allowed (${item.footprintNote}): ${error}`);
      else failures.push(...found.errors);
    }
  for (const item of subjects) {
    if (item.painted) continue;
    const measured: unknown = JSON.parse(readFileSync(`${dir(item)}/rebuild.json`, "utf8"));
    const off = isRecord(measured) && typeof measured.off === "number" ? measured.off : 1;
    if (off > 0.08)
      failures.push(`${item.id}: ${(off * 100).toFixed(1)}% of the ground round it rebuilds ` +
        "wrong: its fill doesn't continue the ground (choose another samples.fill, " +
        "describe the ground better, or leave it painted)");
  }
  if (failures.length > 0)
    throw new Error("pack refused (fix a footprint or its mask, or explain it in " +
      `footprintNote; fix a fill):\n  ${failures.join("\n  ")}`);
  // Shelf-pack every frame into 2048-wide pages.
  frames.sort((a, b) => b.h - a.h || a.name.localeCompare(b.name));
  type Placed = Frame & { x: number; y: number; page: number };
  const placed: Placed[] = [];
  let page = 0;
  let cx = 0;
  let cy = 0;
  let row = 0;
  for (const frame of frames) {
    if (frame.w > 2048 || frame.h > 2048) throw new Error(`${frame.name} is over 2048 px`);
    if (cx + frame.w > 2048) {
      cx = 0;
      cy += row + 2;
      row = 0;
    }
    if (cy + frame.h > 2048) {
      page += 1;
      cx = 0;
      cy = 0;
      row = 0;
    }
    placed.push({ ...frame, x: cx, y: cy, page });
    cx += frame.w + 2;
    row = Math.max(row, frame.h);
  }
  for (const file of readdirSync(publicDir))
    if (/^props-\d+\.(png|json)$/.test(file)) rmSync(join(publicDir, file));
  const atlases: string[] = [];
  let bytes = 0;
  for (let index = 0; index <= page; index += 1) {
    const items = placed.filter((item) => item.page === index);
    const height = Math.max(...items.map((item) => item.y + item.h));
    const image = `props-${index}.png`;
    const args = ["-size", `2048x${height}`, "xc:none"];
    for (const item of items)
      args.push(item.path, "-geometry", `+${item.x}+${item.y}`, "-composite");
    im(...args, "-define", "png:exclude-chunk=date,time", `PNG32:${publicDir}/${image}`);
    bytes += 2048 * height * 4;
    writeJson(`${publicDir}/props-${index}.json`, {
      frames: Object.fromEntries(items.map((item) => [item.name, {
        frame: { x: item.x, y: item.y, w: item.w, h: item.h },
        rotated: false,
        trimmed: false,
        spriteSourceSize: { x: 0, y: 0, w: item.w, h: item.h },
        sourceSize: { w: item.w, h: item.h },
        anchor: { x: Number(item.ax.toFixed(5)), y: Number(item.ay.toFixed(5)) },
      }])),
      meta: { image, size: { w: 2048, h: height }, scale: "1" },
    });
    atlases.push(`assets/areas/${area}/props-${index}.json`);
  }
  writeJson(`content/props/${area}.json`, { atlases, props });
  // The plate, in the painting's own tiles; untouched tiles are copied as they are.
  for (const tile of painting.tiles) {
    const region = `${tile.width}x${tile.height}+${tile.x}+${tile.y}`;
    const changed = mean(plate, "-crop", region, "+repage", "(", original, "-crop", region,
      "+repage", ")", "-compose", "difference", "-composite", "-threshold", "0") > 0;
    const out = `${publicDir}/${tile.file}`;
    if (changed) im(plate, "-crop", region, "+repage", "-quality", "92", out);
    else copyFileSync(`${paintingDir}/${tile.file}`, out);
  }
  copyFileSync(`${paintingDir}/ground.json`, `${publicDir}/ground.json`);
  // The chosen samples, kept so a rebuild needs no calls.
  const kept: Record<string, string[]> = {};
  for (const item of subjects) {
    const names = [`iso-${item.samples.object ?? 1}.jpg`];
    if (!item.painted) {
      names.push("shade.png");
      const scores: unknown = existsSync(`${dir(item)}/fill-scores.json`)
        ? JSON.parse(readFileSync(`${dir(item)}/fill-scores.json`, "utf8"))
        : undefined;
      const best = isRecord(scores) && typeof scores.best === "number" ? scores.best : 1;
      names.push(`fill-${item.samples.fill ?? best}.jpg`);
    }
    if (existsSync(`${dir(item)}/whole.png`)) {
      const n = item.samples.complete ?? 1;
      names.push(`complete-${n}.jpg`, `completeiso-${n}.jpg`);
    }
    const keep = `${sourceDir}/${item.id}`;
    rmSync(keep, { recursive: true, force: true });
    mkdirSync(keep, { recursive: true });
    for (const name of names) copyFileSync(`${dir(item)}/${name}`, `${keep}/${name}`);
    writeFileSync(`${keep}/crop.json`, cropStamp(item));
    kept[item.id] = [...names, "crop.json"];
  }
  // The default layout rebuilt from the kit, against the painting.
  const rebuilt = `${review}/rebuilt.png`;
  const order = [...subjects].sort((a, b) => a.home[1] - b.home[1]);
  const args = [plate];
  for (const item of order)
    if (existsSync(`${dir(item)}/shadow.png`) && !item.painted) {
      const { x, y } = box(item);
      args.push("(", "-size", `${painting.width}x${painting.height}`, "xc:white",
        `${dir(item)}/shadow-flat.png`, "-geometry", `+${x}+${y}`, "-composite", ")",
        "-compose", "multiply", "-composite");
    }
  for (const item of order) {
    const { x, y } = box(item);
    args.push(`${dir(item)}/frame.png`, "-geometry", `+${x}+${y}`, "-compose", "over",
      "-composite");
  }
  im(...args, rebuilt);
  const off = mean(rebuilt, original, "-compose", "difference", "-composite", "-colorspace",
    "gray", "-threshold", "12%");
  im(original, rebuilt, "-resize", "50%", "+append", `${review}/rebuilt-vs-painting.png`);
  im(plate, "-resize", "50%", `${review}/plate.png`);
  writeJson(`art/recipes/${area}-kit.json`, {
    asset: `${area}-kit`,
    date: new Date().toISOString().slice(0, 10),
    summary: `The approved ${area} painting split into a ground plate and ${subjects.length} ` +
      "props. Every visible default prop pixel is the painting's; generated pixels only fill " +
      "plate holes, finish parts hidden behind other props, or become masks.",
    model: MODEL,
    config: configPath,
    painting: `${paintingDir}/ground.json`,
    commands: ["gen", "masks", "fill", "pack", "place"]
      .map((name) => `bun tools/art/kit.ts ${area} ${name}`),
    prompts: {
      isolate: isolatePrompt("<object>", false),
      isolateWithShadow: isolatePrompt("<object>", true),
      fill: fillPrompt("<ground>"),
      complete: completePrompt("<object>", "<ground>"),
    },
    kept: { folder: sourceDir, samples: kept },
    plate: "Lifted props' holes inpainted locally; untouched tiles copied byte for byte, " +
      "patched tiles re-encoded at WebP quality 92.",
    atlas: { pages: atlases, decodedMegabytes: Math.round((bytes / 1048576) * 10) / 10 },
    measurements: {
      rebuiltVsPainting: `${(off * 100).toFixed(2)}% of the painting's pixels differ by ` +
        "more than 12% when the default layout is rebuilt from the kit",
    },
    states: Object.fromEntries(subjects.flatMap((item) => Object.entries(item.states)
      .map(([name, extra]) => [`${item.id}.${name}`, {
        source: extra.source,
        recipe: extra.note,
        processing: "magenta corner flood and -transparent #FF00FF, trim, uniform resize to " +
          `${extra.width} units wide, despill-edge.ts --key magenta --band 3`,
        shadow: extra.shadow ? "a soft lavender ellipse from the frame's alpha" : "none",
      }]))),
    footprintNotes: Object.fromEntries(subjects.flatMap((item) =>
      item.footprintNote === undefined ? [] : [[item.id, item.footprintNote]])),
    painted: subjects.filter((item) => item.painted).map((item) => item.id),
    lifted: subjects.filter((item) => !item.painted).map((item) => item.id),
  });
  console.log(`pack: ${frames.length} frames on ${page + 1} page(s), ` +
    `${(bytes / 1048576).toFixed(1)} MB decoded; rebuilt vs painting ${(off * 100).toFixed(2)}%`);
}

// Adds a placement at home for every catalogue prop the area doesn't place
// yet; placements the catalogue doesn't know are an error.
function place(): void {
  const path = `content/areas/${area}.json`;
  const json: unknown = JSON.parse(readFileSync(path, "utf8"));
  const catalogue: unknown = JSON.parse(readFileSync(`content/props/${area}.json`, "utf8"));
  if (!isRecord(json) || !isRecord(catalogue) || !isRecord(catalogue.props))
    throw new Error(`${path} or its catalogue is malformed`);
  const placed = (list(json.props) ?? []).filter(isRecord);
  const known = new Set(Object.keys(catalogue.props));
  const unknown = placed.filter((item) => typeof item.prop !== "string" || !known.has(item.prop));
  if (unknown.length > 0)
    throw new Error(`${path} places props its catalogue lacks: ${unknown.map((item) =>
      String(item.id)).join(", ")}`);
  const have = new Set(placed.map((item) => item.prop));
  const added: Record<string, unknown>[] = [];
  for (const [id, entry] of Object.entries(catalogue.props)) {
    if (have.has(id) || !isRecord(entry) || !isPoint(entry.home)) continue;
    added.push({ id, prop: id, x: entry.home[0], y: entry.home[1] });
  }
  writeJson(path, { ...json, props: [...placed, ...added] });
  console.log(`place: ${added.length} props placed at home in ${path}`);
}

// An SVG over the painting (2 px per unit), rendered at `scale` px per unit.
function render(name: string, x0: number, y0: number, x1: number, y1: number, scale: number,
  body: string): string {
  const out = `${review}/${name}.png`;
  const svg = `${scratch}/${name}.svg`;
  writeFileSync(svg, `<svg xmlns="http://www.w3.org/2000/svg" ` +
    `xmlns:xlink="http://www.w3.org/1999/xlink" width="${Math.round((x1 - x0) * scale)}" ` +
    `height="${Math.round((y1 - y0) * scale)}" viewBox="${x0} ${y0} ${x1 - x0} ${y1 - y0}">` +
    `<image xlink:href="${join(process.cwd(), original)}" x="0" y="0" ` +
    `width="${painting.width / 2}" height="${painting.height / 2}"/>${body}</svg>`);
  im("-density", "96", svg, "-depth", "8", out);
  return out;
}

// Thin grid lines every 10 units over a region, labelled every 50.
function gridLines(x0: number, y0: number, x1: number, y1: number, scale: number): string {
  const k = 1 / scale;
  let body = "";
  for (let x = Math.ceil(x0 / 10) * 10; x <= x1; x += 10) {
    const major = x % 50 === 0;
    body += `<line x1="${x}" y1="${y0}" x2="${x}" y2="${y1}" stroke="#0050ff" ` +
      `stroke-opacity="${major ? 0.6 : 0.16}" stroke-width="${(major ? 1.4 : 0.8) * k}"/>`;
    if (major) body += `<text x="${x + 2 * k}" y="${y0 + 12 * k}" font-size="${12 * k}" ` +
      `font-family="Helvetica" fill="#002a90" stroke="#fff" stroke-width="${2.5 * k}" ` +
      `paint-order="stroke">${x}</text>`;
  }
  for (let y = Math.ceil(y0 / 10) * 10; y <= y1; y += 10) {
    const major = y % 50 === 0;
    body += `<line x1="${x0}" y1="${y}" x2="${x1}" y2="${y}" stroke="#ff2a00" ` +
      `stroke-opacity="${major ? 0.6 : 0.16}" stroke-width="${(major ? 1.4 : 0.8) * k}"/>`;
    if (major) body += `<text x="${x0 + 2 * k}" y="${y - 3 * k}" font-size="${12 * k}" ` +
      `font-family="Helvetica" fill="#901a00" stroke="#fff" stroke-width="${2.5 * k}" ` +
      `paint-order="stroke">${y}</text>`;
  }
  return body;
}

function region(name: string): [number, number, number, number, number] {
  const [x0 = 0, y0 = 0, x1 = 0, y1 = 0, scale = 2] = Bun.argv.slice(4, 9).map(Number);
  if (!(x1 > x0 && y1 > y0 && scale > 0))
    throw new Error(`usage: bun tools/art/kit.ts <area> ${name} <x0> <y0> <x1> <y1> [px/unit]`);
  return [x0, y0, x1, y1, scale];
}

// A unit grid over part of the painting, for measuring crops, seeds, and footprints.
function grid(): void {
  const [x0, y0, x1, y1, scale] = region("grid");
  console.log(render(`grid-${x0}-${y0}`, x0, y0, x1, y1, scale,
    gridLines(x0, y0, x1, y1, scale)));
}

// Where Fae's feet can stand (the area checks' 5-unit reachable cells, every
// prop state solid), as light green runs.
function standableCells(): string {
  const { world } = loadContent();
  const loaded = world.areas[area];
  if (loaded === undefined) throw new Error(`no area ${area}`);
  const rows = new Map<number, number[]>();
  for (const { x, y } of reachablePositions(loaded, world.tunables.playerRadius))
    rows.set(y, [...(rows.get(y) ?? []), x]);
  let body = "";
  for (const [y, xs] of rows) {
    xs.sort((a, b) => a - b);
    let start = xs[0] ?? 0;
    let last = start;
    for (const x of [...xs.slice(1), Infinity]) {
      if (x === last + 5) {
        last = x;
        continue;
      }
      body += `<rect x="${start - 2.5}" y="${y - 2.5}" width="${last - start + 5}" ` +
        "height=\"5\" fill=\"#7cff6b\" fill-opacity=\"0.32\"/>";
      start = x;
      last = x;
    }
  }
  return body;
}

// The whole area: the floor (green), blockers (red), every subject's
// footprint (blue; painted ones dashed) and home (yellow), with its id.
function overlay(): void {
  const json: unknown = JSON.parse(readFileSync(`content/areas/${area}.json`, "utf8"));
  if (!isRecord(json)) throw new Error(`content/areas/${area}.json is malformed`);
  const points = (polygon: Polygon): string => polygon.map(([x, y]) => `${x},${y}`).join(" ");
  const floor = polygons([json.walkable], "walkable");
  let standable = "";
  try {
    standable = standableCells();
  } catch (error) {
    console.log(`overlay: no standable tint (the area doesn't load: ${String(error)})`);
  }
  const blockers = polygons(json.blockers, "blockers");
  let body = standable + floor.map((polygon) => `<polygon points="${points(polygon)}" ` +
    `fill="none" ` +
    `stroke="#198754" stroke-width="3"/>`).join("");
  body += blockers.map((polygon) => `<polygon points="${points(polygon)}" ` +
    `fill="#d9484840" stroke="#b00000" stroke-width="2"/>`).join("");
  for (const item of subjects) {
    body += item.footprint.map((polygon) => `<polygon points="${points(polygon)}" ` +
      `fill="#1769aa40" stroke="#0a3d91" stroke-width="2"` +
      `${item.painted ? ' stroke-dasharray="6 4"' : ""}/>`).join("");
    const [hx, hy] = item.home;
    body += `<circle cx="${hx}" cy="${hy}" r="4" fill="#ffd400" stroke="#000" ` +
      `stroke-width="1"/><text x="${hx + 6}" y="${hy - 4}" font-size="13" ` +
      `font-family="Helvetica" fill="#002a80" stroke="#fff" stroke-width="2.5" ` +
      `paint-order="stroke">${item.id}</text>`;
  }
  if (Bun.argv.length <= 4) {
    console.log(render("footprints", 0, 0, painting.width / 2, painting.height / 2, 1, body));
    return;
  }
  const [x0, y0, x1, y1, scale] = region("overlay");
  console.log(render(`footprints-${x0}-${y0}`, x0, y0, x1, y1, scale,
    gridLines(x0, y0, x1, y1, scale) + body));
}

if (step === "gen") await gen();
else if (step === "masks") masks();
else if (step === "fill") await fill();
else if (step === "pack") pack();
else if (step === "place") place();
else if (step === "grid") grid();
else if (step === "overlay") overlay();
else throw new Error(`unknown step ${step}`);
