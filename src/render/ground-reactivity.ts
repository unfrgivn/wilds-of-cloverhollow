import { CanvasSource, Container, Sprite, Texture } from "pixi.js";
import {
  npcLivePoint,
  npcVisible,
  surfaceAt,
  type Area,
  type Direction,
  type Point,
  type State,
  type Surface,
  type SurfaceMap,
  type World,
} from "../core";
import type { VfxTextures } from "./vfx-textures";

export const FOOTSTEP_POOL_SIZE = 32;
export const GRASS_TUFT_POOL_SIZE = 28;
const GRASS_CELL_W = 68;
const GRASS_CELL_H = 54;
const GRASS_RADIUS_DEFAULT = 165;
const GRASS_FADE_INNER = 110;
const GRASS_BEND_RADIUS = 46;
const GRASS_MAX_BEND = 0.58;
const GRASS_MOVER_SLOTS = 6;

const SNOW_SPARKLE_TINTS: readonly number[] = [0x58aef0, 0x8c96f8, 0x64cce6];
const FLOWER_TINTS: readonly number[] = [0xfff8e6, 0xffeef4, 0xf2faff, 0xfff5d6, 0xf6f0ff];

export type FootstepVfxKind =
  | "dust"
  | "snow-sparkle"
  | "sand-fleck"
  | "water-ripple"
  | "grass-fleck";

type FootstepTextureKey =
  | "puff"
  | "sparkle"
  | "snowCrystal"
  | "petal"
  | "energyRing"
  | "waterGlint";

export type FootstepVfxStyle = {
  kind: FootstepVfxKind;
  count: number;
  tints: readonly number[];
  textures: readonly FootstepTextureKey[];
  baseAlpha: number;
};

export const FOOTSTEP_VFX_STYLES: Readonly<Record<FootstepVfxKind, FootstepVfxStyle>> = {
  dust: {
    kind: "dust", count: 2, tints: [0xebd7b8, 0xefe2cc], textures: ["puff"], baseAlpha: 0.45,
  },
  "snow-sparkle": {
    kind: "snow-sparkle", count: 2, tints: [0xf8fcff, 0xdcf4ff, 0xe8e4ff, 0xffffff],
    textures: ["puff", "sparkle"], baseAlpha: 0.56,
  },
  "sand-fleck": {
    kind: "sand-fleck", count: 3, tints: [0xebd7b8, 0xf2d9a8, 0xe2be88],
    textures: ["puff", "petal"], baseAlpha: 0.48,
  },
  "water-ripple": {
    kind: "water-ripple", count: 3, tints: [0xb8f0f6, 0xd8fbff, 0xaef2e8],
    textures: ["energyRing", "waterGlint"], baseAlpha: 0.54,
  },
  "grass-fleck": {
    kind: "grass-fleck", count: 3, tints: [0xd3e8a8, 0x8ec470, 0xa8d882],
    textures: ["puff", "petal"], baseAlpha: 0.46,
  },
};

export type GrassMover = { x: number; y: number; moving: boolean };
export type GrassTuftPlacement = {
  x: number; y: number; seed: number; hasFlower: boolean;
  flowerTint: number; scale: number; edgeAlpha: number;
};
export type GrassSwayResult = { rotation: number; scaleX: number; scaleY: number; bend: number };

type FootstepSlot = {
  active: boolean; x: number; y: number; vx: number; vy: number; gravity: number;
  bornTick: number; delay: number; life: number; tint: number; baseAlpha: number;
  startScale: number; endScale: number; scaleYRatio: number; rotation: number; spin: number;
  texture: FootstepTextureKey; blend: "normal" | "add";
};

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function areaSeedHash(areaId: string): number {
  let hash = 2166136261;
  for (let i = 0; i < areaId.length; i += 1) {
    hash ^= areaId.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash;
}

function grassCellHash(gx: number, gy: number, seed: number): number {
  let h = Math.imul(gx, 374761393) ^ Math.imul(gy, 668265263) ^ Math.imul(seed, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

/**
 * Pure check for whether a world point lies along a wet shoreline, stream
 * crossing, pond bank, fountain rim, or cavern shallow pool.
 */
export function isNearWaterShore(
  areaId: string,
  point: Point,
  surface: Surface,
): boolean {
  const { x, y } = point;
  if (areaId === "bay") {
    return surface === "sand" && x >= 580 && y <= 665 && x >= 490 + y * 0.65;
  }
  if (areaId === "boardwalk") {
    return surface === "sand" && ((y <= 410 && x >= 620) || (x >= 1880 && y >= 610));
  }
  if (areaId === "trail") {
    return (surface === "sand" || surface === "stone") && x >= 1200 && y <= 960;
  }
  if (areaId === "island") {
    if (surface !== "sand") return false;
    const outerShore = x <= 420 || x >= 1340 || y <= 290 || y >= 820;
    const tidePool = x >= 430 && x <= 680 && y >= 330 && y <= 450;
    return outerShore || tidePool;
  }
  if (areaId === "woods") {
    return x >= 910 && x <= 1210 && y >= 390 && y <= 585;
  }
  if (areaId === "park") {
    return Math.hypot(x - 985, y - 845) <= 135;
  }
  if (areaId === "sanctuary") {
    return x >= 160 && x <= 540 && y >= 240 && y <= 440;
  }
  if (areaId === "plaza") {
    const dx = (x - 875) / 135;
    const dy = (y - 518) / 85;
    return dx * dx + dy * dy <= 1;
  }
  if (areaId === "cavern") {
    return x >= 720 && x <= 970 && y >= 280 && y <= 630;
  }
  return false;
}

/** Classifies a footstep into its surface- and shore-aware VFX personality. */
export function classifyFootstepEffect(
  surface: Surface,
  areaId: string,
  point: Point,
): FootstepVfxKind {
  if (isNearWaterShore(areaId, point, surface)) return "water-ripple";
  if (surface === "snow") return "snow-sparkle";
  if (surface === "sand") return "sand-fleck";
  if (surface === "grass") return "grass-fleck";
  return "dust";
}

function writeGrassTuftSway(
  tuftX: number,
  tuftY: number,
  movers: readonly GrassMover[],
  moverCount: number,
  tick: number,
  seed: number,
  reducedMotion: boolean,
  out: GrassSwayResult,
): GrassSwayResult {
  if (reducedMotion) {
    out.rotation = 0;
    out.scaleX = 1;
    out.scaleY = 1;
    out.bend = 0;
    return out;
  }
  const breeze =
    Math.sin(tick * 0.045 + seed * 0.017) * 0.065 +
    Math.cos(tick * 0.023 + seed * 0.031) * 0.03;
  let push = 0;
  for (let i = 0; i < moverCount; i += 1) {
    const mover = movers[i];
    if (mover === undefined) continue;
    const dx = tuftX - mover.x;
    const dy = tuftY - mover.y;
    const dist = Math.hypot(dx, dy);
    if (dist < GRASS_BEND_RADIUS) {
      const proximity = 1 - dist / GRASS_BEND_RADIUS;
      const strength = proximity * proximity * (mover.moving ? 0.62 : 0.32);
      const dir =
        Math.abs(dx) >= 1.5
          ? dx > 0
            ? 1
            : -1
          : (seed & 1) === 0
            ? 1
            : -1;
      push += dir * strength;
    }
  }
  const bend = clamp(push, -GRASS_MAX_BEND, GRASS_MAX_BEND);
  const absBend = Math.abs(bend);
  out.rotation = clamp(breeze + bend, -GRASS_MAX_BEND, GRASS_MAX_BEND);
  out.scaleY = 1 - absBend * 0.22;
  out.scaleX = 1 + absBend * 0.14;
  out.bend = bend;
  return out;
}

/** Pure deterministic grass-tuft breeze and proximity-bend evaluator. */
export function computeGrassTuftSway(
  tuft: Point,
  movers: readonly GrassMover[],
  tick: number,
  seed: number,
  reducedMotion: boolean,
): GrassSwayResult {
  const result: GrassSwayResult = { rotation: 0, scaleX: 1, scaleY: 1, bend: 0 };
  return writeGrassTuftSway(
    tuft.x,
    tuft.y,
    movers,
    movers.length,
    tick,
    seed,
    reducedMotion,
    result,
  );
}

/**
 * Pure deterministic world-grid sampler returning up to `GRASS_TUFT_POOL_SIZE`
 * grass tufts on `grass` surfaces within `radius` of `anchor`.
 */
export function sampleNearbyGrassTufts(
  map: SurfaceMap,
  area: Pick<Area, "id" | "width" | "height">,
  anchor: Point,
  radius = GRASS_RADIUS_DEFAULT,
): GrassTuftPlacement[] {
  const results: GrassTuftPlacement[] = [];
  if (radius <= 0) return results;
  const seed = areaSeedHash(area.id);
  const minGx = Math.floor((anchor.x - radius) / GRASS_CELL_W) - 1;
  const maxGx = Math.ceil((anchor.x + radius) / GRASS_CELL_W) + 1;
  const minGy = Math.floor((anchor.y - radius) / GRASS_CELL_H) - 1;
  const maxGy = Math.ceil((anchor.y + radius) / GRASS_CELL_H) + 1;
  const fadeInner = Math.min(GRASS_FADE_INNER, radius * 0.67);
  const fadeSpan = Math.max(1, radius - fadeInner);
  const probe: Point = { x: 0, y: 0 };

  for (let gy = minGy; gy <= maxGy; gy += 1) {
    for (let gx = minGx; gx <= maxGx; gx += 1) {
      if (results.length >= GRASS_TUFT_POOL_SIZE) return results;
      const h1 = grassCellHash(gx, gy, seed);
      const jx = ((h1 & 0xffff) / 0xffff - 0.5) * 56;
      const jy = (((h1 >>> 16) & 0xffff) / 0xffff - 0.5) * 44;
      const x = gx * GRASS_CELL_W + GRASS_CELL_W * 0.5 + jx;
      const y = gy * GRASS_CELL_H + GRASS_CELL_H * 0.5 + jy;
      if (x < 16 || x > area.width - 16 || y < 16 || y > area.height - 16) continue;
      const dist = Math.hypot(x - anchor.x, y - anchor.y);
      if (dist > radius) continue;
      probe.x = x;
      probe.y = y;
      if (surfaceAt(map, probe) !== "grass") continue;
      if (isNearWaterShore(area.id, probe, "grass")) continue;
      const h2 = grassCellHash(gx + 17, gy - 31, seed ^ 0x9e3779b9);
      if ((h2 & 7) === 0 || (h2 & 7) === 5) continue;
      const hasFlower = h2 % 3 === 0;
      const flowerTint = FLOWER_TINTS[(h2 >>> 4) % FLOWER_TINTS.length] ?? 0xfff8e6;
      const scale = 0.88 + (((h2 >>> 8) & 0xff) / 255) * 0.32;
      const edgeAlpha = dist <= fadeInner ? 1 : clamp(1 - (dist - fadeInner) / fadeSpan, 0, 1);
      results.push({ x, y, seed: h1, hasFlower, flowerTint, scale, edgeAlpha });
    }
  }
  return results;
}

type GroundTextureSet = { tuft: Texture; flower: Texture; snowCrystal: Texture };
let cachedGroundTextures: GroundTextureSet | null = null;

function drawGrassBlades(ctx: CanvasRenderingContext2D, baseY: number): void {
  const cx = 24;
  const blades: readonly [number, number, number, number, string][] = [
    [-12, -16, -5.5, -8, "#477d3b"],
    [-4.5, -24, -1.5, -12, "#5c9949"],
    [4.5, -22, 2.0, -11, "#79b85c"],
    [12.5, -15, 6.2, -7.5, "#4e8740"],
  ];
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.fillStyle = "rgba(63, 94, 52, 0.36)";
  ctx.beginPath();
  ctx.ellipse(cx, baseY, 11, 3.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(71, 50, 31, 0.68)";
  ctx.lineWidth = 1.3;
  for (const [tipX, tipY, ctrlX, ctrlY, fill] of blades) {
    ctx.beginPath();
    ctx.moveTo(cx + ctrlX * 0.4 - 2.4, baseY);
    ctx.quadraticCurveTo(cx + ctrlX - 0.8, baseY + ctrlY, cx + tipX, baseY + tipY);
    ctx.quadraticCurveTo(cx + ctrlX + 2.4, baseY + ctrlY + 1.5, cx + ctrlX * 0.4 + 2.4, baseY);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

function canvasTexture(canvas: HTMLCanvasElement): Texture {
  return new Texture({
    source: new CanvasSource({
      resource: canvas,
      addressMode: "clamp-to-edge",
      scaleMode: "linear",
    }),
  });
}

function buildGrassTuftTexture(): Texture {
  if (typeof document === "undefined") return Texture.EMPTY;
  const canvas = document.createElement("canvas");
  canvas.width = 48;
  canvas.height = 36;
  const ctx = canvas.getContext("2d");
  if (ctx === null) return Texture.EMPTY;
  drawGrassBlades(ctx, 32);
  return canvasTexture(canvas);
}

function buildMeadowFlowerTexture(): Texture {
  if (typeof document === "undefined") return Texture.EMPTY;
  const canvas = document.createElement("canvas");
  canvas.width = 48;
  canvas.height = 40;
  const ctx = canvas.getContext("2d");
  if (ctx === null) return Texture.EMPTY;
  drawGrassBlades(ctx, 36);
  ctx.save();
  ctx.translate(24.5, 13.5);
  ctx.fillStyle = "#fffdf4";
  ctx.strokeStyle = "rgba(71, 50, 31, 0.72)";
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 5; i += 1) {
    const angle = (i * Math.PI * 2) / 5 - Math.PI / 2;
    ctx.beginPath();
    ctx.arc(Math.cos(angle) * 4.8, Math.sin(angle) * 4.4, 3.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.fillStyle = "#f4be3a";
  ctx.beginPath();
  ctx.arc(0, 0, 2.9, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  return canvasTexture(canvas);
}

function buildSnowCrystalTexture(): Texture {
  if (typeof document === "undefined") return Texture.EMPTY;
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext("2d");
  if (ctx === null) return Texture.EMPTY;
  ctx.save();
  ctx.translate(16, 16);
  ctx.beginPath();
  for (let i = 0; i < 8; i += 1) {
    const angle = (i * Math.PI) / 4 - Math.PI / 2;
    const r = i % 2 === 0 ? 11.5 : 3.4;
    const px = Math.cos(angle) * r;
    const py = Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  const fill = ctx.createRadialGradient(0, 0, 1, 0, 0, 11.5);
  fill.addColorStop(0, "#ffffff");
  fill.addColorStop(0.55, "#c6ecff");
  fill.addColorStop(1, "#8cc8f5");
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 1.4;
  ctx.lineJoin = "round";
  ctx.strokeStyle = "rgba(74, 114, 164, 0.82)";
  ctx.stroke();
  ctx.restore();
  return canvasTexture(canvas);
}

function getGroundTextures(): GroundTextureSet {
  if (cachedGroundTextures !== null) return cachedGroundTextures;
  cachedGroundTextures = {
    tuft: buildGrassTuftTexture(),
    flower: buildMeadowFlowerTexture(),
    snowCrystal: buildSnowCrystalTexture(),
  };
  return cachedGroundTextures;
}

function createEmptyFootstepSlot(): FootstepSlot {
  return {
    active: false, x: 0, y: 0, vx: 0, vy: 0, gravity: 0, bornTick: 0, delay: 0, life: 1,
    tint: 0xffffff, baseAlpha: 0, startScale: 0.2, endScale: 0.3, scaleYRatio: 1,
    rotation: 0, spin: 0, texture: "puff", blend: "normal",
  };
}

function surfaceMapHasGrass(map: SurfaceMap): boolean {
  if (map.default === "grass") return true;
  for (let i = 0; i < map.regions.length; i += 1) {
    if (map.regions[i]?.surface === "grass") return true;
  }
  return false;
}

/**
 * Owns zero-allocation pooled living ground reactivity: surface- and shore-aware
 * footstep particles (32-slot circular pool) plus swaying grass tufts and meadow
 * wildflowers (28-slot pool) that bend smoothly away from Fae and party feet.
 */
export class GroundReactivityController {
  readonly grassLayer = new Container();
  readonly footstepLayer = new Container();

  private readonly textures: GroundTextureSet;
  private readonly grassTuftSprites: Sprite[] = [];
  private readonly grassMovers: GrassMover[] = [];
  private readonly grassPointScratch: Point = { x: 0, y: 0 };
  private readonly grassSwayScratch: GrassSwayResult = {
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    bend: 0,
  };
  private activeGrassTufts = 0;

  private readonly footstepSlots: FootstepSlot[] = [];
  private readonly footstepSprites: Sprite[] = [];
  private footstepCursor = 0;
  private activeFootstepCount = 0;
  private _lastFootstepKind: FootstepVfxKind | null = null;
  private lastFootstepArea = "";
  private lastFootstepTick: number | undefined;
  private lastFootstepDistance: number | undefined;
  private playerFootstepCount = 0;
  private readonly lastNpcFootstepStride = new Map<string, number>();

  constructor(
    private readonly world: World,
    private readonly vfx: VfxTextures,
  ) {
    this.textures = getGroundTextures();
    this.grassLayer.label = "grass-tufts";
    this.grassLayer.visible = false;
    for (let i = 0; i < GRASS_TUFT_POOL_SIZE; i += 1) {
      const tuft = new Sprite(this.textures.tuft);
      tuft.label = `grass:tuft:${i}`;
      tuft.anchor.set(0.5, 0.92);
      tuft.visible = false;
      this.grassTuftSprites.push(tuft);
      this.grassLayer.addChild(tuft);
    }
    for (let i = 0; i < GRASS_MOVER_SLOTS; i += 1) {
      this.grassMovers.push({ x: 0, y: 0, moving: false });
    }

    this.footstepLayer.label = "footsteps";
    for (let i = 0; i < FOOTSTEP_POOL_SIZE; i += 1) {
      this.footstepSlots.push(createEmptyFootstepSlot());
      const puff = new Sprite(this.vfx.puff);
      puff.label = `footstep:${i}`;
      puff.anchor.set(0.5);
      puff.visible = false;
      this.footstepSprites.push(puff);
      this.footstepLayer.addChild(puff);
    }
  }

  get footstepPuffCount(): number {
    return this.activeFootstepCount;
  }

  get lastFootstepKind(): FootstepVfxKind | null {
    return this._lastFootstepKind;
  }

  get grassTuftCount(): number {
    return this.activeGrassTufts;
  }

  clearFootsteps(): void {
    this.footstepCursor = 0;
    this.activeFootstepCount = 0;
    this._lastFootstepKind = null;
    this.lastFootstepTick = undefined;
    this.lastFootstepDistance = undefined;
    this.playerFootstepCount = 0;
    this.lastNpcFootstepStride.clear();
    for (let i = 0; i < FOOTSTEP_POOL_SIZE; i += 1) {
      const slot = this.footstepSlots[i];
      if (slot !== undefined) slot.active = false;
      const sprite = this.footstepSprites[i];
      if (sprite !== undefined) sprite.visible = false;
    }
  }

  clearGrassTufts(): void {
    this.activeGrassTufts = 0;
    this.grassLayer.visible = false;
    for (let i = 0; i < this.grassTuftSprites.length; i += 1) {
      const sprite = this.grassTuftSprites[i];
      if (sprite !== undefined) sprite.visible = false;
    }
  }

  private writeFootstepSlot(
    x: number, y: number, vx: number, vy: number, gravity: number,
    bornTick: number, delay: number, life: number, tint: number, baseAlpha: number,
    startScale: number, endScale: number, scaleYRatio: number, rotation: number, spin: number,
    texture: FootstepTextureKey, blend: "normal" | "add",
  ): void {
    const slot = this.footstepSlots[this.footstepCursor];
    this.footstepCursor = (this.footstepCursor + 1) % FOOTSTEP_POOL_SIZE;
    if (slot === undefined) return;
    slot.active = true; slot.x = x; slot.y = y; slot.vx = vx; slot.vy = vy;
    slot.gravity = gravity; slot.bornTick = bornTick; slot.delay = delay; slot.life = life;
    slot.tint = tint; slot.baseAlpha = baseAlpha; slot.startScale = startScale;
    slot.endScale = endScale; slot.scaleYRatio = scaleYRatio; slot.rotation = rotation;
    slot.spin = spin; slot.texture = texture; slot.blend = blend;
  }

  private emitFootstepVfx(
    x: number,
    y: number,
    facing: Direction,
    surface: Surface,
    kind: FootstepVfxKind,
    stride: number,
    tick: number,
    isNpc: boolean,
    dashing = false,
  ): void {
    const backX = facing === "left" ? 1 : facing === "right" ? -1 : 0;
    const backY = facing === "up" ? 1 : facing === "down" ? -1 : 0;
    const perpX = -backY;
    const perpY = backX;
    const side = stride % 2 === 0 ? 1 : -1;
    const k = isNpc ? 0.78 : 1;
    const rotA = (stride * 0.7) % (Math.PI * 2);
    const rotB = (stride * 1.3 + 1.1) % (Math.PI * 2);

    if (dashing && !isNpc) {
      const heelTint =
        kind === "snow-sparkle" ? 0xdcf4ff : kind === "grass-fleck" ? 0xc8e898 :
        kind === "water-ripple" ? 0xb8f0f6 : 0xf0dcba;
      this.writeFootstepSlot(
        x + backX * 22 + perpX * side * 4, y + backY * 7 + perpY * side * 3,
        backX * 0.78, backY * 0.34 - 0.36, 0,
        tick, 0, 18, heelTint, 0.56, 0.24, 0.48, 0.9, rotB, 0.04 * side, "puff", "normal",
      );
    }

    if (kind === "water-ripple") {
      const rx = x + backX * 16 + perpX * side * 5;
      const ry = y + 2 + backY * 6;
      this.writeFootstepSlot(
        rx, ry, 0, 0, 0, tick, 0, 28, 0x2a94a8, 0.9 * k,
        0.38 * k, 1.12 * k, 0.48, 0, 0, "energyRing", "normal",
      );
      if (!isNpc) {
        this.writeFootstepSlot(
          rx, ry, 0, 0, 0, tick, 0, 26, 0x52c4d8, 0.85,
          0.16, 0.68, 0.48, 0, 0, "energyRing", "normal",
        );
        this.writeFootstepSlot(
          rx + backX * 8 + perpX * side * 14, ry - 4, backX * 0.35 + perpX * side * 0.4, -0.65,
          0.045, tick, 0, 22, 0x3eb8ce, 0.92, 0.52, 0.72, 0.8, 0, 0, "waterGlint", "normal",
        );
      }
      return;
    }

    if (kind === "snow-sparkle") {
      this.writeFootstepSlot(
        x + backX * 20 + perpX * side * 8, y + backY * 7 + perpY * side * 4,
        backX * 0.48 + perpX * side * 0.24, backY * 0.24 - 0.32, 0,
        tick, 0, 26, 0x8abde8, 0.78 * k, 0.36 * k, 0.6 * k, 1, rotA, 0.02, "puff", "normal",
      );
      if (!isNpc) {
        const sparkTint = SNOW_SPARKLE_TINTS[stride % SNOW_SPARKLE_TINTS.length] ?? 0x58aef0;
        this.writeFootstepSlot(
          x + backX * 26 - perpX * side * 8, y - 4 + backY * 8 + perpY * side * 6,
          backX * 0.45 - perpX * side * 0.32, -0.65, 0.025,
          tick, 0, 28, sparkTint, 0.96, 0.62, 0.88, 1, rotB, 0.05, "snowCrystal", "normal",
        );
        this.writeFootstepSlot(
          x + backX * 34 + perpX * side * 10, y - 2 + backY * 10 - perpY * side * 6,
          backX * 0.55 + perpX * side * 0.26, -0.48, 0.02,
          tick, 0, 24, 0xd8d0ff, 0.92, 0.48, 0.72, 1, rotA, -0.05, "snowCrystal", "normal",
        );
      }
      return;
    }

    if (kind === "sand-fleck") {
      this.writeFootstepSlot(
        x + backX * 18 + perpX * side * 7, y + backY * 6 + perpY * side * 4,
        backX * 0.46 + perpX * side * 0.24, backY * 0.22 - 0.32, 0,
        tick, 0, 24, 0xd8b27c, 0.72 * k, 0.34 * k, 0.56 * k, 1, rotA, 0.02, "puff", "normal",
      );
      if (!isNpc) {
        this.writeFootstepSlot(
          x + backX * 24 + perpX * side * 8, y - 2 + backY * 6 + perpY * side * 6,
          backX * 0.72 + perpX * side * 0.48, -1.25, 0.11,
          tick, 0, 22, 0xc48b48, 0.94, 0.44, 0.28, 1, rotA, 0.09 * side, "petal", "normal",
        );
        this.writeFootstepSlot(
          x + backX * 30 - perpX * side * 9, y + backY * 8 - perpY * side * 5,
          backX * 0.62 - perpX * side * 0.42, -1.08, 0.11,
          tick, 0, 20, 0xdfb272, 0.9, 0.38, 0.24, 1, rotB, -0.1 * side, "petal", "normal",
        );
      }
      return;
    }

    if (kind === "grass-fleck") {
      this.writeFootstepSlot(
        x + backX * 18 + perpX * side * 7, y + backY * 6 + perpY * side * 4,
        backX * 0.45 + perpX * side * 0.22, backY * 0.2 - 0.32, 0,
        tick, 0, 24, 0xc3e08c, 0.72 * k, 0.34 * k, 0.56 * k, 1, rotA, 0.02, "puff", "normal",
      );
      if (!isNpc) {
        this.writeFootstepSlot(
          x + backX * 24 + perpX * side * 8, y - 3 + backY * 6 + perpY * side * 6,
          backX * 0.6 + perpX * side * 0.46, -1.28, 0.095,
          tick, 0, 26, 0x3f7d32, 0.96, 0.5, 0.34, 0.78, rotA, 0.12 * side, "petal", "normal",
        );
        this.writeFootstepSlot(
          x + backX * 32 - perpX * side * 8, y - 1 + backY * 8 - perpY * side * 6,
          backX * 0.55 - perpX * side * 0.38, -1.1, 0.095,
          tick, 0, 24, 0x62a848, 0.92, 0.44, 0.3, 0.78, rotB, -0.11 * side, "petal", "normal",
        );
      }
      return;
    }

    const indoorSurface = surface === "wood" || surface === "tile" || surface === "carpet";
    const dustTint = indoorSurface ? 0xe8d6ba : 0xdcc09a;
    const dustAlpha = (indoorSurface ? 0.28 : 0.58) * k;
    this.writeFootstepSlot(
      x + backX * 9 + perpX * side * 6, y - 2 + backY * 5 + perpY * side * 3,
      backX * 0.45 + perpX * side * 0.25, backY * 0.25 - 0.35, 0,
      tick, 0, 22, dustTint, dustAlpha, 0.26 * k, 0.5 * k, 1, rotA, 0.02, "puff", "normal",
    );
    if (!isNpc) {
      this.writeFootstepSlot(
        x + backX * 15 - perpX * side * 5, y - 1 + backY * 7 - perpY * side * 3,
        backX * 0.6 - perpX * side * 0.18, backY * 0.2 - 0.45, 0,
        tick, 0, 22, dustTint, dustAlpha * 0.85, 0.2, 0.38, 1, rotB, 0.02, "puff", "normal",
      );
    }
  }

  updateFootsteps(
    state: State,
    areaId: string,
    playerPos: Point,
    reducedMotion: boolean,
  ): void {
    if (reducedMotion) {
      this.clearFootsteps();
      return;
    }
    const active =
      areaId !== "harness" &&
      state.battle === null &&
      state.arcade === null &&
      state.transition === null;
    if (!active) {
      if (
        areaId !== this.lastFootstepArea ||
        (this.lastFootstepTick !== undefined && state.tick < this.lastFootstepTick)
      ) {
        this.clearFootsteps();
      }
      for (let i = 0; i < this.footstepSprites.length; i += 1) {
        const sprite = this.footstepSprites[i];
        if (sprite !== undefined) sprite.visible = false;
      }
      this.lastFootstepArea = areaId;
      this.lastFootstepTick = state.tick;
      return;
    }
    if (
      areaId !== this.lastFootstepArea ||
      (this.lastFootstepTick !== undefined && state.tick < this.lastFootstepTick)
    ) {
      this.clearFootsteps();
    }
    const dashing = state.previousInput.dash === true && state.motion.moving;
    const stepUnits = dashing
      ? this.world.tunables.walkCycleUnits / 3.5
      : this.world.tunables.walkCycleUnits / 2;
    const map = this.world.surfaces[areaId];
    if (
      this.lastFootstepDistance === undefined ||
      state.motion.distance < this.lastFootstepDistance
    ) {
      this.lastFootstepDistance = state.motion.distance;
    }
    if (
      state.motion.moving &&
      this.lastFootstepArea === areaId &&
      this.lastFootstepTick !== undefined
    ) {
      const delta = state.tick - this.lastFootstepTick;
      const moved = state.motion.distance - this.lastFootstepDistance;
      if (delta >= 1 && delta <= 5 && moved >= stepUnits) {
        this.lastFootstepDistance = state.motion.distance;
        this.playerFootstepCount += 1;
        const surface = map === undefined ? "grass" : surfaceAt(map, state.player);
        const kind = classifyFootstepEffect(surface, areaId, state.player);
        this._lastFootstepKind = kind;
        this.emitFootstepVfx(
          playerPos.x, playerPos.y, state.facing, surface, kind,
          this.playerFootstepCount, state.tick, false, dashing,
        );
      }
    }
    const area = this.world.areas[areaId];
    if (area !== undefined) {
      const canEmit =
        this.lastFootstepArea === areaId &&
        this.lastFootstepTick !== undefined &&
        state.tick - this.lastFootstepTick >= 1 &&
        state.tick - this.lastFootstepTick <= 5;
      for (let i = 0; i < area.npcs.length; i += 1) {
        const npc = area.npcs[i];
        if (npc === undefined || npc.stroll === undefined || !npcVisible(this.world, state, npc)) {
          continue;
        }
        const live = npcLivePoint(state, npc);
        const npcStride = Math.floor(live.distance / 36);
        const prevNpcStride = this.lastNpcFootstepStride.get(npc.id);
        if (
          canEmit &&
          live.moving &&
          prevNpcStride !== undefined &&
          npcStride !== prevNpcStride
        ) {
          const surface = map === undefined ? "grass" : surfaceAt(map, live);
          const kind = classifyFootstepEffect(surface, areaId, live);
          this.emitFootstepVfx(
            live.x, live.y, live.facing, surface, kind, npcStride, state.tick, true,
          );
        }
        this.lastNpcFootstepStride.set(npc.id, npcStride);
      }
    }
    this.lastFootstepArea = areaId;
    this.lastFootstepTick = state.tick;

    let activeCount = 0;
    for (let i = 0; i < FOOTSTEP_POOL_SIZE; i += 1) {
      const slot = this.footstepSlots[i];
      const sprite = this.footstepSprites[i];
      if (slot === undefined || sprite === undefined || !slot.active) {
        if (sprite !== undefined) sprite.visible = false;
        continue;
      }
      const rawAge = state.tick - slot.bornTick - slot.delay;
      if (rawAge < -slot.delay || rawAge >= slot.life) {
        slot.active = false;
        sprite.visible = false;
        continue;
      }
      activeCount += 1;
      if (rawAge < 0) {
        sprite.visible = false;
        continue;
      }
      const u = rawAge / slot.life;
      const scale = slot.startScale + (slot.endScale - slot.startScale) * u;
      const texture =
        slot.texture === "snowCrystal" ? this.textures.snowCrystal : this.vfx[slot.texture];
      if (sprite.texture !== texture) sprite.texture = texture;
      if (sprite.blendMode !== slot.blend) sprite.blendMode = slot.blend;
      sprite.visible = true;
      sprite.position.set(
        slot.x + slot.vx * rawAge,
        slot.y + slot.vy * rawAge + 0.5 * slot.gravity * rawAge * rawAge,
      );
      sprite.scale.set(scale, scale * slot.scaleYRatio);
      sprite.rotation = slot.rotation + u * slot.spin * slot.life;
      sprite.tint = slot.tint;
      sprite.alpha = slot.baseAlpha * (1 - u * u);
    }
    this.activeFootstepCount = activeCount;
  }

  updateGrassTufts(
    state: State,
    area: Area,
    playerPos: Point,
    reducedMotion: boolean,
    paused: boolean,
  ): void {
    if (
      paused ||
      reducedMotion ||
      area.id === "harness" ||
      state.battle !== null ||
      state.arcade !== null ||
      state.transition !== null
    ) {
      this.clearGrassTufts();
      return;
    }
    const map = this.world.surfaces[area.id];
    if (map === undefined || !surfaceMapHasGrass(map)) {
      this.clearGrassTufts();
      return;
    }

    let moverCount = 0;
    const firstMover = this.grassMovers[0];
    if (firstMover !== undefined) {
      firstMover.x = playerPos.x;
      firstMover.y = playerPos.y;
      firstMover.moving = state.motion.moving;
      moverCount = 1;
    }
    for (let i = 0; i < state.party.length && moverCount < GRASS_MOVER_SLOTS; i += 1) {
      const member = state.party[i];
      const slot = this.grassMovers[moverCount];
      if (member === undefined || slot === undefined) continue;
      slot.x = member.x;
      slot.y = member.y;
      slot.moving = member.motion.moving;
      moverCount += 1;
    }

    const seed = areaSeedHash(area.id);
    const radius = GRASS_RADIUS_DEFAULT;
    const minGx = Math.floor((playerPos.x - radius) / GRASS_CELL_W) - 1;
    const maxGx = Math.ceil((playerPos.x + radius) / GRASS_CELL_W) + 1;
    const minGy = Math.floor((playerPos.y - radius) / GRASS_CELL_H) - 1;
    const maxGy = Math.ceil((playerPos.y + radius) / GRASS_CELL_H) + 1;
    const fadeSpan = Math.max(1, radius - GRASS_FADE_INNER);
    let used = 0;

    for (let gy = minGy; gy <= maxGy && used < GRASS_TUFT_POOL_SIZE; gy += 1) {
      for (let gx = minGx; gx <= maxGx && used < GRASS_TUFT_POOL_SIZE; gx += 1) {
        const h1 = grassCellHash(gx, gy, seed);
        const jx = ((h1 & 0xffff) / 0xffff - 0.5) * 56;
        const jy = (((h1 >>> 16) & 0xffff) / 0xffff - 0.5) * 44;
        const x = gx * GRASS_CELL_W + GRASS_CELL_W * 0.5 + jx;
        const y = gy * GRASS_CELL_H + GRASS_CELL_H * 0.5 + jy;
        if (x < 16 || x > area.width - 16 || y < 16 || y > area.height - 16) continue;
        const dist = Math.hypot(x - playerPos.x, y - playerPos.y);
        if (dist > radius) continue;
        this.grassPointScratch.x = x;
        this.grassPointScratch.y = y;
        if (surfaceAt(map, this.grassPointScratch) !== "grass") continue;
        if (isNearWaterShore(area.id, this.grassPointScratch, "grass")) continue;

        const sprite = this.grassTuftSprites[used];
        if (sprite === undefined) break;
        const h2 = grassCellHash(gx + 17, gy - 31, seed ^ 0x9e3779b9);
        if ((h2 & 7) === 0 || (h2 & 7) === 5) continue;
        const hasFlower = h2 % 3 === 0;
        const texture = hasFlower ? this.textures.flower : this.textures.tuft;
        if (sprite.texture !== texture) sprite.texture = texture;
        const baseScale = 0.82 + (((h2 >>> 8) & 0xff) / 255) * 0.4;
        const flipX = (h2 & 16) === 0 ? 1 : -1;
        const edgeAlpha =
          dist <= GRASS_FADE_INNER ? 1 : clamp(1 - (dist - GRASS_FADE_INNER) / fadeSpan, 0, 1);
        const sway = writeGrassTuftSway(
          x,
          y,
          this.grassMovers,
          moverCount,
          state.tick,
          h1,
          false,
          this.grassSwayScratch,
        );
        sprite.visible = true;
        sprite.position.set(x, y);
        sprite.scale.set(flipX * baseScale * sway.scaleX, baseScale * sway.scaleY);
        sprite.rotation = sway.rotation;
        sprite.tint = hasFlower
          ? FLOWER_TINTS[(h2 >>> 4) % FLOWER_TINTS.length] ?? 0xfff8e6
          : 0xffffff;
        sprite.alpha = 0.92 * edgeAlpha;
        used += 1;
      }
    }

    for (let i = used; i < this.grassTuftSprites.length; i += 1) {
      const sprite = this.grassTuftSprites[i];
      if (sprite !== undefined) sprite.visible = false;
    }
    this.activeGrassTufts = used;
    this.grassLayer.visible = used > 0;
  }
}
