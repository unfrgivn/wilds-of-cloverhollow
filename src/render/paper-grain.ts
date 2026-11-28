import { CanvasSource, Texture, TilingSprite } from "pixi.js";
import type { Area, Point } from "../core";
import type { ViewportRect } from "./view-projections";

export const PAPER_GRAIN_SIZE = 256;
export const PAPER_GRAIN_LIVE_ALPHA = 0.05;
export const PAPER_GRAIN_PAUSED_ALPHA = 0.035;

const CSS_GRAIN_SIZE = 128;
const PAPER_GRAIN_STYLE_ID = "cloverhollow-paper-grain-style";

const PAPER_GRAIN_CSS_RULE = [
  ":root[data-paper-grain=\"live\"] .sticker-dialogue,",
  ":root[data-paper-grain=\"live\"] .sticker-choice,",
  ":root[data-paper-grain=\"live\"] .sticker-prompt,",
  ":root[data-paper-grain=\"live\"] .journal-book,",
  ":root[data-paper-grain=\"live\"] .area-banner,",
  ":root[data-paper-grain=\"live\"] .battle-hud,",
  ":root[data-paper-grain=\"live\"] .battle-command,",
  ":root[data-paper-grain=\"live\"] .save-toast {",
  "  background-image: var(--cloverhollow-paper-grain);",
  "  background-size: 128px 128px;",
  "  background-repeat: repeat;",
  "}",
].join("\n");

function nextLcg(seed: number): number {
  return (Math.imul(seed, 1664525) + 1013904223) >>> 0;
}

function samplePeriodicLattice(
  grid: Float32Array,
  gridSize: number,
  u: number,
  v: number,
  smoothstep: boolean,
): number {
  const gx = u * gridSize;
  const gy = v * gridSize;
  const x0 = Math.floor(gx) % gridSize;
  const y0 = Math.floor(gy) % gridSize;
  const x1 = (x0 + 1) % gridSize;
  const y1 = (y0 + 1) % gridSize;
  let fx = gx - Math.floor(gx);
  let fy = gy - Math.floor(gy);
  if (smoothstep) {
    fx = fx * fx * (3 - 2 * fx);
    fy = fy * fy * (3 - 2 * fy);
  }
  const top = (grid[y0 * gridSize + x0] ?? 0) * (1 - fx) + (grid[y0 * gridSize + x1] ?? 0) * fx;
  const bot = (grid[y1 * gridSize + x0] ?? 0) * (1 - fx) + (grid[y1 * gridSize + x1] ?? 0) * fx;
  return top * (1 - fy) + bot * fy;
}

/**
 * Pure deterministic multi-octave seamless toroidal cold-press cotton-rag paper
 * height field in [0, 1]: 16x16 smoothstep dimples + 32x32 cold-press tooth +
 * subtle directional fiber weave + 3x3 toroidal blur.
 */
function computeColdPressField(size: number): Float32Array {
  const total = size * size;
  let seed = 0x5f3759df;

  const coarseSize = 16;
  const coarse = new Float32Array(coarseSize * coarseSize);
  for (let i = 0; i < coarse.length; i += 1) {
    seed = nextLcg(seed);
    coarse[i] = seed / 0xffffffff;
  }

  const mediumSize = 32;
  const medium = new Float32Array(mediumSize * mediumSize);
  for (let i = 0; i < medium.length; i += 1) {
    seed = nextLcg(seed);
    medium[i] = seed / 0xffffffff;
  }

  const rowFibers = new Float32Array(size);
  const colFibers = new Float32Array(size);
  for (let i = 0; i < size; i += 1) {
    seed = nextLcg(seed);
    rowFibers[i] = seed / 0xffffffff;
    seed = nextLcg(seed);
    colFibers[i] = seed / 0xffffffff;
  }

  const raw = new Float32Array(total);
  for (let i = 0; i < total; i += 1) {
    seed = nextLcg(seed);
    raw[i] = seed / 0xffffffff;
  }

  const field = new Float32Array(total);
  for (let y = 0; y < size; y += 1) {
    const ym = (y + size - 1) % size;
    const yp = (y + 1) % size;
    const v = y / size;
    const rowFiber = rowFibers[y] ?? 0.5;
    for (let x = 0; x < size; x += 1) {
      const xm = (x + size - 1) % size;
      const xp = (x + 1) % size;
      const u = x / size;
      const sum =
        (raw[ym * size + xm] ?? 0) +
        (raw[ym * size + x] ?? 0) * 2 +
        (raw[ym * size + xp] ?? 0) +
        (raw[y * size + xm] ?? 0) * 2 +
        (raw[y * size + x] ?? 0) * 4 +
        (raw[y * size + xp] ?? 0) * 2 +
        (raw[yp * size + xm] ?? 0) +
        (raw[yp * size + x] ?? 0) * 2 +
        (raw[yp * size + xp] ?? 0);
      const fine = sum / 16;
      const dimple = samplePeriodicLattice(coarse, coarseSize, u, v, true);
      const tooth = samplePeriodicLattice(medium, mediumSize, u, v, false);
      const fiber = rowFiber * 0.55 + (colFibers[x] ?? 0.5) * 0.45;
      const combined = dimple * 0.35 + tooth * 0.3 + fine * 0.25 + fiber * 0.1;
      field[y * size + x] = Math.max(0, Math.min(1, combined));
    }
  }
  return field;
}

/**
 * Generates seamless warm ivory-cream cold-press paper RGBA pixels in luminance
 * range 222..255 (`G = R - 1`, `B = R - 3`, `A = 255`) for natural multiply blend.
 */
export function generateColdPressPaperGrainPixels(
  size = PAPER_GRAIN_SIZE,
): Uint8ClampedArray {
  const field = computeColdPressField(size);
  const pixels = new Uint8ClampedArray(size * size * 4);
  for (let i = 0; i < field.length; i += 1) {
    const value = field[i] ?? 0.5;
    const r = Math.min(255, Math.max(225, Math.round(225 + value * 30)));
    const offset = i * 4;
    pixels[offset] = r;
    pixels[offset + 1] = r - 1;
    pixels[offset + 2] = r - 3;
    pixels[offset + 3] = 255;
  }
  return pixels;
}

/**
 * Generates subtle warm-sepia (`#5a4228`) alpha-channel cold-press paper grain
 * pixels (alpha 0..15) suitable for CSS `background-image` over sticker UI cards.
 */
export function generateCssPaperGrainPixels(
  size = CSS_GRAIN_SIZE,
): Uint8ClampedArray {
  const field = computeColdPressField(size);
  const pixels = new Uint8ClampedArray(size * size * 4);
  for (let i = 0; i < field.length; i += 1) {
    const value = field[i] ?? 0.5;
    const alpha = Math.min(15, Math.max(0, Math.round((1 - value) * 15)));
    const offset = i * 4;
    pixels[offset] = 0x5a;
    pixels[offset + 1] = 0x42;
    pixels[offset + 2] = 0x28;
    pixels[offset + 3] = alpha;
  }
  return pixels;
}

let cachedColdPressTexture: Texture | null = null;
let cachedCssDataUrl: string | null = null;
let cssHookInitialized = false;
let lastPaperGrainMode: "live" | "paused" | "off" | "" = "";

/** Returns the shared cached 256x256 repeat-mode cold-press watercolor paper Texture. */
export function getColdPressPaperGrainTexture(): Texture {
  if (cachedColdPressTexture !== null) return cachedColdPressTexture;
  if (typeof document === "undefined") return Texture.WHITE;
  const canvas = document.createElement("canvas");
  canvas.width = PAPER_GRAIN_SIZE;
  canvas.height = PAPER_GRAIN_SIZE;
  const ctx = canvas.getContext("2d");
  if (ctx === null) return Texture.WHITE;
  const image = ctx.createImageData(PAPER_GRAIN_SIZE, PAPER_GRAIN_SIZE);
  image.data.set(generateColdPressPaperGrainPixels(PAPER_GRAIN_SIZE));
  ctx.putImageData(image, 0, 0);
  cachedColdPressTexture = new Texture({
    source: new CanvasSource({
      resource: canvas,
      addressMode: "repeat",
      scaleMode: "linear",
    }),
  });
  return cachedColdPressTexture;
}

/** Returns a cached 128x128 PNG data URL for CSS sticker paper-grain unity. */
export function getCssPaperGrainDataUrl(): string {
  if (cachedCssDataUrl !== null) return cachedCssDataUrl;
  if (typeof document === "undefined") return "";
  const canvas = document.createElement("canvas");
  canvas.width = CSS_GRAIN_SIZE;
  canvas.height = CSS_GRAIN_SIZE;
  const ctx = canvas.getContext("2d");
  if (ctx === null) return "";
  const image = ctx.createImageData(CSS_GRAIN_SIZE, CSS_GRAIN_SIZE);
  image.data.set(generateCssPaperGrainPixels(CSS_GRAIN_SIZE));
  ctx.putImageData(image, 0, 0);
  cachedCssDataUrl = canvas.toDataURL("image/png");
  return cachedCssDataUrl;
}

/** Syncs the `data-paper-grain` DOM hook and injects the idempotent CSS unity rule. */
export function syncPaperGrainCssHook(mode: "live" | "paused" | "off"): void {
  if (typeof document === "undefined") return;
  if (mode === lastPaperGrainMode && (mode !== "live" || cssHookInitialized)) return;
  lastPaperGrainMode = mode;
  document.documentElement.dataset.paperGrain = mode;
  if (mode === "live" && !cssHookInitialized) {
    cssHookInitialized = true;
    const dataUrl = getCssPaperGrainDataUrl();
    if (dataUrl.length > 0) {
      document.documentElement.style.setProperty(
        "--cloverhollow-paper-grain",
        `url("${dataUrl}")`,
      );
    }
    if (document.getElementById(PAPER_GRAIN_STYLE_ID) === null) {
      const style = document.createElement("style");
      style.id = PAPER_GRAIN_STYLE_ID;
      style.textContent = PAPER_GRAIN_CSS_RULE;
      document.head.appendChild(style);
    }
  }
}

const lastTelemetry = {
  cameraZoom: "",
  cameraFraming: "",
  cameraShake: "",
  grassTufts: "",
  footstepKind: "",
};

/** Dev/harness-only DOM dataset reflection for camera & living-ground telemetry. */
export function syncPresentationTelemetry(values: {
  zoom: number;
  framing: string;
  shake: number;
  grassTufts: number;
  footstepKind: string;
}): void {
  if (typeof document === "undefined") return;
  const ds = document.documentElement.dataset;
  const zoom = values.zoom.toFixed(3);
  const shake = values.shake.toFixed(2);
  const tufts = String(values.grassTufts);
  if (zoom !== lastTelemetry.cameraZoom) {
    lastTelemetry.cameraZoom = zoom;
    ds.cameraZoom = zoom;
  }
  if (values.framing !== lastTelemetry.cameraFraming) {
    lastTelemetry.cameraFraming = values.framing;
    ds.cameraFraming = values.framing;
  }
  if (shake !== lastTelemetry.cameraShake) {
    lastTelemetry.cameraShake = shake;
    ds.cameraShake = shake;
  }
  if (tufts !== lastTelemetry.grassTufts) {
    lastTelemetry.grassTufts = tufts;
    ds.grassTufts = tufts;
  }
  if (values.footstepKind !== lastTelemetry.footstepKind) {
    lastTelemetry.footstepKind = values.footstepKind;
    ds.footstepKind = values.footstepKind;
  }
}

/**
 * Manages unified cold-press watercolor paper grain across both the paused
 * scene baseline sprite (`alpha = 0.035`) and the live stage-wide overlay
 * (`alpha = 0.05`) + DOM CSS sticker paper unity.
 */
export class PaperGrainOverlay {
  readonly sceneSprite: TilingSprite;
  readonly stageSprite: TilingSprite;

  constructor(pausedBaselineTexture: Texture) {
    this.sceneSprite = new TilingSprite({
      texture: pausedBaselineTexture,
      width: 960,
      height: 720,
    });
    this.sceneSprite.label = "paper-grain";
    this.sceneSprite.blendMode = "multiply";
    this.sceneSprite.alpha = PAPER_GRAIN_PAUSED_ALPHA;
    this.sceneSprite.visible = false;

    this.stageSprite = new TilingSprite({
      texture: getColdPressPaperGrainTexture(),
      width: 960,
      height: 720,
    });
    this.stageSprite.label = "paper-grain:stage";
    this.stageSprite.blendMode = "multiply";
    this.stageSprite.alpha = PAPER_GRAIN_LIVE_ALPHA;
    this.stageSprite.visible = false;
  }

  mountArea(area: Pick<Area, "id" | "width" | "height">): void {
    this.sceneSprite.visible = area.id !== "harness";
    this.sceneSprite.width = area.width;
    this.sceneSprite.height = area.height;
    this.sceneSprite.position.set(0, 0);
  }

  update(params: {
    areaId: string;
    paused: boolean;
    overworldVisible: boolean;
    viewportRect: ViewportRect;
    width: number;
    height: number;
    camera: Point;
    baseScale: number;
  }): void {
    if (params.areaId === "harness") {
      this.sceneSprite.visible = false;
      this.stageSprite.visible = false;
      syncPaperGrainCssHook("off");
      return;
    }
    if (params.paused) {
      this.sceneSprite.visible = true;
      this.stageSprite.visible = false;
      syncPaperGrainCssHook("paused");
      return;
    }
    this.sceneSprite.visible = false;
    this.stageSprite.visible = true;
    if (params.overworldVisible) {
      const { x, y, width, height } = params.viewportRect;
      this.stageSprite.position.set(x, y);
      this.stageSprite.width = width;
      this.stageSprite.height = height;
      this.stageSprite.tilePosition.set(
        -Math.round(params.camera.x * params.baseScale),
        -Math.round(params.camera.y * params.baseScale),
      );
    } else {
      this.stageSprite.position.set(0, 0);
      this.stageSprite.width = params.width;
      this.stageSprite.height = params.height;
      this.stageSprite.tilePosition.set(0, 0);
    }
    syncPaperGrainCssHook("live");
  }
}
