import {
  surfaceAt,
  type Area, type Direction, type Point, type State, type Surface, type SurfaceMap,
} from "../core";

export const FOOTSTEP_POOL_SIZE = 32;
export const GRASS_TUFT_POOL_SIZE = 28;
export const GRASS_RADIUS_DEFAULT = 165;
export const GRASS_MOVER_SLOTS = 6;

const GRASS_CELL_W = 68;
const GRASS_CELL_H = 54;
const GRASS_FADE_INNER = 110;
const GRASS_BEND_RADIUS = 46;
const GRASS_MAX_BEND = 0.58;

const SNOW_SPARKLE_TINTS: readonly number[] = [0x58aef0, 0x8c96f8, 0x64cce6];
const FLOWER_TINTS: readonly number[] = [0xfff8e6, 0xffeef4, 0xf2faff, 0xfff5d6, 0xf6f0ff];

export type FootstepVfxKind =
  | "dust" | "snow-sparkle" | "sand-fleck" | "water-ripple" | "grass-fleck";

export type FootstepTextureKey =
  | "puff" | "sparkle" | "snowCrystal" | "petal" | "energyRing" | "waterGlint";

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

export type FootstepSlot = {
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

export function createEmptyFootstepSlot(): FootstepSlot {
  return {
    active: false, x: 0, y: 0, vx: 0, vy: 0, gravity: 0, bornTick: 0, delay: 0, life: 1,
    tint: 0xffffff, baseAlpha: 0, startScale: 0.2, endScale: 0.3, scaleYRatio: 1,
    rotation: 0, spin: 0, texture: "puff", blend: "normal",
  };
}

export function surfaceMapHasGrass(map: SurfaceMap): boolean {
  if (map.default === "grass") return true;
  for (let i = 0; i < map.regions.length; i += 1) {
    if (map.regions[i]?.surface === "grass") return true;
  }
  return false;
}

/**
 * Pure check for whether a world point lies along a wet shoreline, stream
 * crossing, pond bank, fountain rim, or cavern shallow pool.
 */
export function isNearWaterShore(areaId: string, point: Point, surface: Surface): boolean {
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
  if (areaId === "woods") return x >= 910 && x <= 1210 && y >= 390 && y <= 585;
  if (areaId === "park") return Math.hypot(x - 985, y - 845) <= 135;
  if (areaId === "sanctuary") return x >= 160 && x <= 540 && y >= 240 && y <= 440;
  if (areaId === "plaza") {
    const dx = (x - 875) / 135;
    const dy = (y - 518) / 85;
    return dx * dx + dy * dy <= 1;
  }
  if (areaId === "cavern") return x >= 720 && x <= 970 && y >= 280 && y <= 630;
  return false;
}

/** Classifies a footstep into its surface- and shore-aware VFX personality. */
export function classifyFootstepEffect(
  surface: Surface, areaId: string, point: Point,
): FootstepVfxKind {
  if (isNearWaterShore(areaId, point, surface)) return "water-ripple";
  if (surface === "snow") return "snow-sparkle";
  if (surface === "sand") return "sand-fleck";
  if (surface === "grass") return "grass-fleck";
  return "dust";
}

export function writeGrassTuftSway(
  tuftX: number, tuftY: number, movers: readonly GrassMover[], moverCount: number,
  tick: number, seed: number, reducedMotion: boolean, out: GrassSwayResult,
): GrassSwayResult {
  if (reducedMotion) {
    out.rotation = 0; out.scaleX = 1; out.scaleY = 1; out.bend = 0;
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
      const dir = Math.abs(dx) >= 1.5 ? (dx > 0 ? 1 : -1) : ((seed & 1) === 0 ? 1 : -1);
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
  tuft: Point, movers: readonly GrassMover[], tick: number, seed: number, reducedMotion: boolean,
): GrassSwayResult {
  const result: GrassSwayResult = { rotation: 0, scaleX: 1, scaleY: 1, bend: 0 };
  return writeGrassTuftSway(
    tuft.x, tuft.y, movers, movers.length, tick, seed, reducedMotion, result,
  );
}

/** Populates Fae and party mover positions into a pre-allocated scratch array. */
export function collectGrassMovers(
  state: Pick<State, "motion" | "party">,
  playerPos: Point,
  out: GrassMover[],
): number {
  let count = 0;
  const firstMover = out[0];
  if (firstMover !== undefined) {
    firstMover.x = playerPos.x;
    firstMover.y = playerPos.y;
    firstMover.moving = state.motion.moving;
    count = 1;
  }
  for (let i = 0; i < state.party.length && count < GRASS_MOVER_SLOTS; i += 1) {
    const member = state.party[i];
    const slot = out[count];
    if (member === undefined || slot === undefined) continue;
    slot.x = member.x;
    slot.y = member.y;
    slot.moving = member.motion.moving;
    count += 1;
  }
  return count;
}

export type GrassCellVisitor = (
  index: number,
  x: number,
  y: number,
  h1: number,
  h2: number,
  hasFlower: boolean,
  flowerTint: number,
  edgeAlpha: number,
) => boolean;

/** Zero-allocation grid iterator over grass tufts within `radius` of `anchor`. */
export function forEachNearbyGrassCell(
  map: SurfaceMap,
  area: Pick<Area, "id" | "width" | "height">,
  anchor: Point,
  radius: number,
  probe: Point,
  visit: GrassCellVisitor,
): number {
  if (radius <= 0) return 0;
  const seed = areaSeedHash(area.id);
  const minGx = Math.floor((anchor.x - radius) / GRASS_CELL_W) - 1;
  const maxGx = Math.ceil((anchor.x + radius) / GRASS_CELL_W) + 1;
  const minGy = Math.floor((anchor.y - radius) / GRASS_CELL_H) - 1;
  const maxGy = Math.ceil((anchor.y + radius) / GRASS_CELL_H) + 1;
  const fadeInner = Math.min(GRASS_FADE_INNER, radius * 0.67);
  const fadeSpan = Math.max(1, radius - fadeInner);
  let used = 0;

  for (let gy = minGy; gy <= maxGy && used < GRASS_TUFT_POOL_SIZE; gy += 1) {
    for (let gx = minGx; gx <= maxGx && used < GRASS_TUFT_POOL_SIZE; gx += 1) {
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
      const edgeAlpha = dist <= fadeInner ? 1 : clamp(1 - (dist - fadeInner) / fadeSpan, 0, 1);
      if (!visit(used, x, y, h1, h2, hasFlower, flowerTint, edgeAlpha)) return used;
      used += 1;
    }
  }
  return used;
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
  const probe: Point = { x: 0, y: 0 };
  forEachNearbyGrassCell(
    map,
    area,
    anchor,
    radius,
    probe,
    (_index, x, y, h1, h2, hasFlower, flowerTint, edgeAlpha) => {
      const scale = 0.88 + (((h2 >>> 8) & 0xff) / 255) * 0.32;
      results.push({ x, y, seed: h1, hasFlower, flowerTint, scale, edgeAlpha });
      return true;
    },
  );
  return results;
}

function writeSlot(
  slots: FootstepSlot[], cursor: number,
  x: number, y: number, vx: number, vy: number, gravity: number,
  bornTick: number, life: number, tint: number, baseAlpha: number,
  startScale: number, endScale: number, scaleYRatio: number,
  rotation: number, spin: number, texture: FootstepTextureKey,
): number {
  const slot = slots[cursor];
  const next = (cursor + 1) % FOOTSTEP_POOL_SIZE;
  if (slot === undefined) return next;
  slot.active = true; slot.x = x; slot.y = y; slot.vx = vx; slot.vy = vy;
  slot.gravity = gravity; slot.bornTick = bornTick; slot.delay = 0; slot.life = life;
  slot.tint = tint; slot.baseAlpha = baseAlpha; slot.startScale = startScale;
  slot.endScale = endScale; slot.scaleYRatio = scaleYRatio; slot.rotation = rotation;
  slot.spin = spin; slot.texture = texture; slot.blend = "normal";
  return next;
}

/** Emits surface- and shore-aware footstep particle slots into the circular pool. */
export function emitFootstepParticles(
  slots: FootstepSlot[],
  cursor: number,
  x: number,
  y: number,
  facing: Direction,
  surface: Surface,
  kind: FootstepVfxKind,
  stride: number,
  tick: number,
  isNpc: boolean,
  dashing = false,
): number {
  let next = cursor;
  const emit = (
    px: number, py: number, vx: number, vy: number, gravity: number, life: number,
    tint: number, alpha: number, s0: number, s1: number, sy: number,
    rot: number, spin: number, tex: FootstepTextureKey,
  ): void => {
    next = writeSlot(slots, next, px, py, vx, vy, gravity, tick, life, tint, alpha,
      s0, s1, sy, rot, spin, tex);
  };
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
    emit(x + backX * 22 + perpX * side * 4, y + backY * 7 + perpY * side * 3,
      backX * 0.78, backY * 0.34 - 0.36, 0, 18, heelTint, 0.56, 0.24, 0.48, 0.9,
      rotB, 0.04 * side, "puff");
  }

  if (kind === "water-ripple") {
    const rx = x + backX * 16 + perpX * side * 5;
    const ry = y + 2 + backY * 6;
    emit(rx, ry, 0, 0, 0, 28, 0x2a94a8, 0.9 * k, 0.38 * k, 1.12 * k, 0.48, 0, 0, "energyRing");
    if (!isNpc) {
      emit(rx, ry, 0, 0, 0, 26, 0x52c4d8, 0.85, 0.16, 0.68, 0.48, 0, 0, "energyRing");
      emit(rx + backX * 8 + perpX * side * 14, ry - 4, backX * 0.35 + perpX * side * 0.4, -0.65,
        0.045, 22, 0x3eb8ce, 0.92, 0.52, 0.72, 0.8, 0, 0, "waterGlint");
    }
    return next;
  }

  if (kind === "snow-sparkle") {
    emit(x + backX * 20 + perpX * side * 8, y + backY * 7 + perpY * side * 4,
      backX * 0.48 + perpX * side * 0.24, backY * 0.24 - 0.32, 0, 26, 0x8abde8, 0.78 * k,
      0.36 * k, 0.6 * k, 1, rotA, 0.02, "puff");
    if (!isNpc) {
      const sparkTint = SNOW_SPARKLE_TINTS[stride % SNOW_SPARKLE_TINTS.length] ?? 0x58aef0;
      emit(x + backX * 26 - perpX * side * 8, y - 4 + backY * 8 + perpY * side * 6,
        backX * 0.45 - perpX * side * 0.32, -0.65, 0.025, 28, sparkTint, 0.96,
        0.62, 0.88, 1, rotB, 0.05, "snowCrystal");
      emit(x + backX * 34 + perpX * side * 10, y - 2 + backY * 10 - perpY * side * 6,
        backX * 0.55 + perpX * side * 0.26, -0.48, 0.02, 24, 0xd8d0ff, 0.92,
        0.48, 0.72, 1, rotA, -0.05, "snowCrystal");
    }
    return next;
  }

  if (kind === "sand-fleck") {
    emit(x + backX * 18 + perpX * side * 7, y + backY * 6 + perpY * side * 4,
      backX * 0.46 + perpX * side * 0.24, backY * 0.22 - 0.32, 0, 24, 0xd8b27c, 0.72 * k,
      0.34 * k, 0.56 * k, 1, rotA, 0.02, "puff");
    if (!isNpc) {
      emit(x + backX * 24 + perpX * side * 8, y - 2 + backY * 6 + perpY * side * 6,
        backX * 0.72 + perpX * side * 0.48, -1.25, 0.11, 22, 0xc48b48, 0.94,
        0.44, 0.28, 1, rotA, 0.09 * side, "petal");
      emit(x + backX * 30 - perpX * side * 9, y + backY * 8 - perpY * side * 5,
        backX * 0.62 - perpX * side * 0.42, -1.08, 0.11, 20, 0xdfb272, 0.9,
        0.38, 0.24, 1, rotB, -0.1 * side, "petal");
    }
    return next;
  }

  if (kind === "grass-fleck") {
    emit(x + backX * 18 + perpX * side * 7, y + backY * 6 + perpY * side * 4,
      backX * 0.45 + perpX * side * 0.22, backY * 0.2 - 0.32, 0, 24, 0xc3e08c, 0.72 * k,
      0.34 * k, 0.56 * k, 1, rotA, 0.02, "puff");
    if (!isNpc) {
      emit(x + backX * 24 + perpX * side * 8, y - 3 + backY * 6 + perpY * side * 6,
        backX * 0.6 + perpX * side * 0.46, -1.28, 0.095, 26, 0x3f7d32, 0.96,
        0.5, 0.34, 0.78, rotA, 0.12 * side, "petal");
      emit(x + backX * 32 - perpX * side * 8, y - 1 + backY * 8 - perpY * side * 6,
        backX * 0.55 - perpX * side * 0.38, -1.1, 0.095, 24, 0x62a848, 0.92,
        0.44, 0.3, 0.78, rotB, -0.11 * side, "petal");
    }
    return next;
  }

  const indoorSurface = surface === "wood" || surface === "tile" || surface === "carpet";
  const dustTint = indoorSurface ? 0xe8d6ba : 0xdcc09a;
  const dustAlpha = (indoorSurface ? 0.28 : 0.58) * k;
  emit(x + backX * 9 + perpX * side * 6, y - 2 + backY * 5 + perpY * side * 3,
    backX * 0.45 + perpX * side * 0.25, backY * 0.25 - 0.35, 0, 22, dustTint, dustAlpha,
    0.26 * k, 0.5 * k, 1, rotA, 0.02, "puff");
  if (!isNpc) {
    emit(x + backX * 15 - perpX * side * 5, y - 1 + backY * 7 - perpY * side * 3,
      backX * 0.6 - perpX * side * 0.18, backY * 0.2 - 0.45, 0, 22, dustTint, dustAlpha * 0.85,
      0.2, 0.38, 1, rotB, 0.02, "puff");
  }
  return next;
}
