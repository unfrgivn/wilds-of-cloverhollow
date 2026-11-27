import { Container, Sprite } from "pixi.js";
import type { VfxTextures } from "./vfx-textures";

export type AtmosphereLayer = "under" | "over" | "emissive";
export type AtmosphereTextureKey =
  | "softGlow"
  | "sparkle"
  | "petal"
  | "waterGlint"
  | "mistWisp"
  | "sunbeam"
  | "energyRing";
export type AtmosphereBlend = "normal" | "add";

export type AtmosphereParticle = {
  layer: AtmosphereLayer;
  texture: AtmosphereTextureKey;
  blend: AtmosphereBlend;
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  alpha: number;
  tint: number;
};

export type AtmosphereOptions = {
  clubhouseBloom?: boolean;
  cafeCinnamonSteam?: boolean;
  plazaStarGlow?: boolean;
  passHearthWisps?: boolean;
  reducedMotion?: boolean;
};

// Pure deterministic hash in [0, 1) from integer inputs (zero Math.random).
function hash01(seed: number): number {
  let x = (seed ^ 0x9e3779b9) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b) >>> 0;
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0;
  x = (x ^ (x >>> 16)) >>> 0;
  return x / 0x100000000;
}

function areaSeed(areaId: string): number {
  let hash = 2166136261;
  for (let i = 0; i < areaId.length; i += 1) {
    hash ^= areaId.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash;
}

function wrap(value: number, span: number): number {
  if (span <= 0) return 0;
  return ((value % span) + span) % span;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

const INDOOR_SUNLIT = new Set([
  "bedroom",
  "kitchen",
  "school",
  "east-hall",
  "classroom",
  "gym",
  "music",
  "art-room",
  "clubhouse",
]);

const MEADOW_AREAS = new Set(["park", "hills", "field"]);

const PLAZA_ARCHES: readonly [number, number][] = [
  [691, 490],
  [1075, 492],
  [632, 822],
  [1155, 825],
];

const ENCHANTED_FAIRIES: readonly { x: number; y: number; tint: number }[] = [
  { x: 850, y: 582, tint: 0xd8b8ff },
  { x: 450, y: 522, tint: 0xa8f0d8 },
  { x: 650, y: 462, tint: 0xa8dcff },
  { x: 1330, y: 642, tint: 0xffd0b8 },
];

const BLOSSOM_TINTS: readonly number[] = [0xf29eb6, 0xf5cf72, 0xf7b2c7, 0xf2b591];
const MEADOW_TINTS: readonly number[] = [0xfff8e6, 0xf9da8e, 0xf7eab5];
const BUTTERFLY_TINTS: readonly number[] = [0xf8c4d8, 0xbce3f5, 0xfae09e];
const WATER_TINTS: readonly number[] = [0x67d5c4, 0xaef2e8, 0xfffdf2];
const SNOW_TINTS: readonly number[] = [0xffffff, 0xe8f4ff];
const FOREST_MOTE_TINTS: readonly number[] = [0xf9da8e, 0xfff4cc];
const LILAC_TINTS: readonly number[] = [0xe2c8ff, 0xf6eaff];
const FIREFLY_TINTS: readonly number[] = [0xf9da8e, 0xa8f0d8];
const HEARTH_MOTE_TINTS: readonly number[] = [0xffe3a8, 0xffcfa0];
const CAFE_MOTE_TINTS: readonly number[] = [0xfff2cc, 0xffe0a6, 0xffd29d];
const SUNLIT_MOTE_TINTS: readonly number[] = [0xfff6dc, 0xf9e4ab];
const COTTAGE_MOTE_TINTS: readonly number[] = [0xfff8e2, 0xc7f7ee, 0xffe6ba];
const CLUBHOUSE_BLOOM_TINTS: readonly number[] = [0xfff2b2, 0xf9d28c, 0xf7b2c7];
const PLAZA_STAR_GLOW_TINTS: readonly number[] = [0xffe89a, 0xb8e8ff];
const ARCADE_MOTE_TINTS: readonly number[] = [0xffa6da, 0x9cf2eb, 0xf9e29c];
const CAVERN_CRYSTALS: readonly {
  x: number;
  y: number;
  tint: number;
  scale: number;
  baseAlpha: number;
}[] = [
  { x: 495, y: 520, tint: 0xd8b8ff, scale: 1.65, baseAlpha: 0.34 },
  { x: 705, y: 425, tint: 0x67d5c4, scale: 1.45, baseAlpha: 0.32 },
  { x: 760, y: 295, tint: 0xd8b8ff, scale: 1.15, baseAlpha: 0.26 },
  { x: 825, y: 760, tint: 0xf9da8e, scale: 1.55, baseAlpha: 0.33 },
  { x: 1040, y: 425, tint: 0xf9da8e, scale: 1.45, baseAlpha: 0.32 },
  { x: 1180, y: 675, tint: 0x67d5c4, scale: 1.45, baseAlpha: 0.32 },
  { x: 1280, y: 310, tint: 0xffe49c, scale: 1.7, baseAlpha: 0.37 },
  { x: 1410, y: 470, tint: 0xd8b8ff, scale: 1.15, baseAlpha: 0.26 },
];
const CAVERN_LANTERNS: readonly [number, number][] = [
  [298, 415],
  [1385, 690],
];
const CAVERN_STEP_RINGS: readonly [number, number][] = [
  [785, 540],
  [840, 542],
  [895, 546],
];
const CAVERN_EDGE_SHADOWS: readonly [number, number, number, number][] = [
  [110, 140, 5.2, 4.2],
  [1540, 140, 5.2, 4.2],
  [110, 970, 5.0, 3.8],
  [1540, 970, 5.0, 3.8],
  [825, 60, 8.0, 2.8],
];
const CAVERN_MOTE_TINTS: readonly number[] = [0xd8b8ff, 0x9cf2eb, 0xf9da8e];

function pickTint(palette: readonly number[], index: number): number {
  return palette[index % palette.length] ?? 0xffffff;
}

function addMistRibbons(
  out: AtmosphereParticle[],
  seed: number,
  width: number,
  height: number,
  tick: number,
  count: number,
  baseAlpha: number,
): void {
  const margin = 220;
  const span = width + margin * 2;
  for (let i = 0; i < count; i += 1) {
    const h0 = hash01(seed + i * 31 + 1);
    const h1 = hash01(seed + i * 31 + 2);
    const h2 = hash01(seed + i * 31 + 3);
    const h3 = hash01(seed + i * 31 + 4);
    const speed = 0.22 + h0 * 0.24;
    const x = wrap(h1 * span + tick * speed, span) - margin;
    const yBase = height * (0.14 + ((i + 0.5) / count) * 0.72);
    const y = yBase + Math.sin(tick * 0.012 + h2 * Math.PI * 2) * 14;
    const breathe = 0.85 + 0.15 * Math.sin(tick * 0.018 + h3 * Math.PI * 2);
    out.push({
      layer: "over",
      texture: "mistWisp",
      blend: "normal",
      x,
      y,
      scaleX: 2.2 + h2 * 1.4,
      scaleY: 1.0 + h3 * 0.55,
      rotation: 0,
      alpha: clamp01(baseAlpha * breathe),
      tint: 0xd9c8f2,
    });
  }
}

function addFloatingMotes(
  out: AtmosphereParticle[],
  seed: number,
  width: number,
  height: number,
  tick: number,
  count: number,
  tints: readonly number[],
  options: {
    marginX?: number;
    marginY?: number;
    driftX: number;
    driftY: number;
    minScale: number;
    maxScale: number;
    minAlpha: number;
    maxAlpha: number;
  },
): void {
  const marginX = options.marginX ?? width * 0.08;
  const marginY = options.marginY ?? height * 0.1;
  const spanX = Math.max(60, width - marginX * 2);
  const spanY = Math.max(60, height - marginY * 2);
  for (let i = 0; i < count; i += 1) {
    const h0 = hash01(seed + i * 47 + 11);
    const h1 = hash01(seed + i * 47 + 12);
    const h2 = hash01(seed + i * 47 + 13);
    const h3 = hash01(seed + i * 47 + 14);
    const speedScale = 0.65 + h2 * 0.7;
    const x = marginX + wrap(
      h0 * spanX + tick * options.driftX * speedScale + Math.sin(tick * 0.02 + h3 * 6.28) * 18,
      spanX,
    );
    const y = marginY + wrap(
      h1 * spanY + tick * options.driftY * speedScale + Math.cos(tick * 0.017 + h0 * 6.28) * 14,
      spanY,
    );
    const twinkle = 0.5 + 0.5 * Math.sin(tick * (0.04 + h3 * 0.04) + h1 * Math.PI * 2);
    const scale = options.minScale + h2 * (options.maxScale - options.minScale);
    const alpha = options.minAlpha + twinkle * (options.maxAlpha - options.minAlpha);
    out.push({
      layer: "over",
      texture: "sparkle",
      blend: "add",
      x,
      y,
      scaleX: scale,
      scaleY: scale,
      rotation: 0,
      alpha: clamp01(alpha),
      tint: pickTint(tints, i),
    });
  }
}

/**
 * Pure deterministic biome atmosphere particle evaluator for any area and tick.
 * Zero Math.random(), zero core state. Returns [] for `harness`.
 */
export function evaluateAtmosphere(
  areaId: string,
  width: number,
  height: number,
  tick: number,
  options?: AtmosphereOptions,
): AtmosphereParticle[] {
  if (areaId === "harness") return [];
  const out: AtmosphereParticle[] = [];
  const seed = areaSeed(areaId);

  if (areaId === "plaza") {
    // 10 sparkling aqua/white water glints dancing over the central fountain basin.
    for (let i = 0; i < 10; i += 1) {
      const h0 = hash01(seed + i * 19 + 1);
      const h1 = hash01(seed + i * 19 + 2);
      const h2 = hash01(seed + i * 19 + 3);
      const angle = h0 * Math.PI * 2 + tick * 0.004;
      const radius = 12 + h1 * 48;
      const x = 875 + Math.cos(angle) * radius + Math.sin(tick * 0.05 + i) * 4;
      const y = 518 + Math.sin(angle) * radius * 0.44;
      const pulse = Math.sin(tick * (0.065 + h2 * 0.045) + i * 1.4);
      const shimmer = pulse * pulse;
      const scale = 0.5 + h2 * 0.42;
      out.push({
        layer: "over",
        texture: i % 2 === 0 ? "sparkle" : "waterGlint",
        blend: "add",
        x,
        y,
        scaleX: scale,
        scaleY: scale,
        rotation: 0,
        alpha: clamp01(0.32 + shimmer * 0.58),
        tint: pickTint(WATER_TINTS, i),
      });
    }
    // 4 subtle warm lantern light pools around the 4 lamp arches (emissive over twilight).
    PLAZA_ARCHES.forEach(([ax, ay], i) => {
      const breathe = 0.2 + 0.025 * Math.sin(tick * 0.03 + i * 1.5);
      out.push({
        layer: "emissive",
        texture: "softGlow",
        blend: "add",
        x: ax,
        y: ay - 16,
        scaleX: 2.0,
        scaleY: 1.55,
        rotation: 0,
        alpha: clamp01(breathe),
        tint: 0xffd97d,
      });
    });
    // 12 slow drifting pastel blossom petals / pollen motes inside the painted interior.
    const insetX = width * 0.09;
    const insetY = height * 0.07;
    const spanX = Math.max(80, width - insetX * 2);
    const spanY = Math.max(80, height - insetY * 2);
    for (let i = 0; i < 12; i += 1) {
      const h0 = hash01(seed + i * 29 + 101);
      const h1 = hash01(seed + i * 29 + 102);
      const h2 = hash01(seed + i * 29 + 103);
      const h3 = hash01(seed + i * 29 + 104);
      const x = insetX + wrap(
        h0 * spanX + tick * (0.28 + h2 * 0.22) + Math.sin(tick * 0.024 + i) * 20,
        spanX,
      );
      const y = insetY + wrap(h1 * spanY + tick * (0.16 + h3 * 0.14), spanY);
      const scale = 0.44 + h2 * 0.3;
      out.push({
        layer: "over",
        texture: "petal",
        blend: "normal",
        x,
        y,
        scaleX: scale,
        scaleY: scale * (0.7 + 0.3 * Math.abs(Math.cos(tick * 0.04 + h3 * 6.28))),
        rotation: tick * (0.015 + h3 * 0.02) + h0 * Math.PI * 2,
        alpha: clamp01(0.55 + h1 * 0.28),
        tint: pickTint(BLOSSOM_TINTS, i),
      });
    }
    if (options?.plazaStarGlow === true) {
      // 8 soft pastel-gold fountain mist sparkles celebrating Cloverhollow's Star-Line Explorer.
      const t = options.reducedMotion === true ? 0 : tick;
      for (let i = 0; i < 8; i += 1) {
        const h0 = hash01(seed + i * 67 + 11);
        const h1 = hash01(seed + i * 67 + 12);
        const h2 = hash01(seed + i * 67 + 13);
        const h3 = hash01(seed + i * 67 + 14);
        const x = 825 + wrap(h0 * 120 + t * 0.08 + Math.sin(t * 0.022 + i * 1.1) * 8, 120);
        const y = 545 + wrap(h1 * 90 - t * (0.08 + h2 * 0.05), 90);
        const twinkle =
          options.reducedMotion === true
            ? 0.5
            : 0.5 + 0.5 * Math.sin(t * (0.045 + h3 * 0.035) + i * 1.3);
        const scale = 0.42 + h2 * 0.32;
        out.push({
          layer: "over",
          texture: "sparkle",
          blend: "add",
          x,
          y,
          scaleX: scale,
          scaleY: scale,
          rotation: 0,
          alpha: clamp01(0.24 + twinkle * 0.2),
          tint: pickTint(PLAZA_STAR_GLOW_TINTS, i),
        });
      }
    }
    return out;
  }

  if (areaId === "sanctuary") {
    // 3 warm diagonal alpine pine sunbeams across the sunlit meadow.
    const shafts: readonly [number, number, number][] = [
      [480, 310, 2.2],
      [960, 280, 2.5],
      [1340, 360, 2.1],
    ];
    shafts.forEach(([sx, sy, scale], i) => {
      const alpha = 0.058 + 0.01 * Math.sin(tick * 0.018 + i * 2.1);
      out.push({
        layer: "over",
        texture: "sunbeam",
        blend: "add",
        x: sx,
        y: sy,
        scaleX: scale,
        scaleY: scale,
        rotation: 0,
        alpha: clamp01(alpha),
        tint: 0xfff2c8,
      });
    });
    // 8 sparkling aqua water glints dancing over the northwest lily pond.
    for (let i = 0; i < 8; i += 1) {
      const h0 = hash01(seed + i * 23 + 11);
      const h1 = hash01(seed + i * 23 + 12);
      const h2 = hash01(seed + i * 23 + 13);
      const x = 195 + h0 * 290 + Math.sin(tick * 0.03 + i) * 5;
      const y = 275 + h1 * 105;
      const pulse = Math.sin(tick * (0.06 + h2 * 0.04) + i * 1.5);
      const scale = 0.44 + h2 * 0.36;
      out.push({
        layer: "under",
        texture: i % 2 === 0 ? "waterGlint" : "sparkle",
        blend: "add",
        x,
        y,
        scaleX: scale,
        scaleY: scale * 0.85,
        rotation: 0,
        alpha: clamp01(0.24 + pulse * pulse * 0.52),
        tint: pickTint(WATER_TINTS, i),
      });
    }
    // 14 golden wildflower pollen motes drifting softly over the sanctuary meadow.
    addFloatingMotes(out, seed + 240, width, height, tick, 14, MEADOW_TINTS, {
      driftX: 0.24,
      driftY: -0.04,
      minScale: 0.22,
      maxScale: 0.42,
      minAlpha: 0.22,
      maxAlpha: 0.54,
    });
    return out;
  }

  if (MEADOW_AREAS.has(areaId)) {
    // 16 soft drifting dandelion seeds & sunlit golden pollen motes inside the painted interior.
    const insetX = width * 0.08;
    const insetY = height * 0.07;
    const spanX = Math.max(80, width - insetX * 2);
    const spanY = Math.max(80, height - insetY * 2);
    for (let i = 0; i < 16; i += 1) {
      const h0 = hash01(seed + i * 37 + 1);
      const h1 = hash01(seed + i * 37 + 2);
      const h2 = hash01(seed + i * 37 + 3);
      const h3 = hash01(seed + i * 37 + 4);
      const isSeed = i % 2 === 0;
      const x = insetX + wrap(h0 * spanX + tick * (0.34 + h2 * 0.26), spanX);
      const y = insetY + wrap(h1 * spanY + tick * (0.06 + h3 * 0.08) +
        Math.sin(tick * 0.025 + h0 * 6.28) * 22, spanY);
      const pulse = 0.5 + 0.5 * Math.sin(tick * 0.04 + i * 1.1);
      const scale = isSeed ? 0.24 + h2 * 0.18 : 0.22 + h3 * 0.2;
      out.push({
        layer: "over",
        texture: isSeed ? "petal" : "sparkle",
        blend: isSeed ? "normal" : "add",
        x,
        y,
        scaleX: scale,
        scaleY: scale,
        rotation: isSeed ? tick * 0.012 + h3 * 6.28 : 0,
        alpha: clamp01(isSeed ? 0.34 + pulse * 0.22 : 0.24 + pulse * 0.3),
        tint: pickTint(MEADOW_TINTS, i),
      });
    }
    // 3 gentle pastel butterflies/petals.
    for (let i = 0; i < 3; i += 1) {
      const h0 = hash01(seed + i * 53 + 201);
      const h1 = hash01(seed + i * 53 + 202);
      const cx = width * (0.22 + i * 0.28);
      const cy = height * (0.28 + h0 * 0.42);
      const phase = tick * (0.014 + i * 0.003) + h1 * Math.PI * 2;
      const x = cx + Math.sin(phase) * 110;
      const y = cy + Math.sin(phase * 2) * 42;
      const flutter = 0.55 + 0.45 * Math.abs(Math.sin(tick * 0.18 + i * 2));
      out.push({
        layer: "over",
        texture: "petal",
        blend: "normal",
        x,
        y,
        scaleX: 0.42 * flutter,
        scaleY: 0.42,
        rotation: Math.cos(phase) * 0.35,
        alpha: 0.62,
        tint: pickTint(BUTTERFLY_TINTS, i),
      });
    }
    return out;
  }

  if (areaId === "bay" || areaId === "trail") {
    // 14 shimmering aqua/warm-white water glints dancing across the sea areas.
    for (let i = 0; i < 14; i += 1) {
      const h0 = hash01(seed + i * 23 + 1);
      const h1 = hash01(seed + i * 23 + 2);
      const h2 = hash01(seed + i * 23 + 3);
      let x: number;
      let y: number;
      if (areaId === "bay") {
        if (i < 6) {
          x = 800 + h0 * 880;
          y = 55 + h1 * 175;
        } else {
          x = 1160 + h0 * 550;
          y = 250 + h1 * 340;
        }
      } else if (i < 4) {
        x = 1240 + h0 * 470;
        y = 70 + h1 * 210;
      } else {
        x = 1480 + h0 * 240;
        y = 280 + h1 * 680;
      }
      const shimmer = Math.sin(tick * (0.055 + h2 * 0.04) + i * 1.7);
      const scale = 0.48 + h2 * 0.44;
      out.push({
        layer: "under",
        texture: "waterGlint",
        blend: "add",
        x: x + Math.sin(tick * 0.02 + i) * 6,
        y,
        scaleX: scale,
        scaleY: scale * 0.85,
        rotation: 0,
        alpha: clamp01(0.12 + shimmer * shimmer * 0.43),
        tint: pickTint(WATER_TINTS, i),
      });
    }
    // 10 gentle drifting coastal breeze sparkles.
    addFloatingMotes(out, seed + 500, width, height, tick, 10, WATER_TINTS, {
      driftX: -0.32,
      driftY: 0.08,
      minScale: 0.2,
      maxScale: 0.38,
      minAlpha: 0.18,
      maxAlpha: 0.44,
    });
    return out;
  }

  if (areaId === "pass") {
    // 26 soft two-layer parallax snowflakes drifting gently down-right with sine sway.
    const insetX = width * 0.08;
    const insetY = height * 0.05;
    const spanX = Math.max(80, width - insetX * 2);
    const spanY = Math.max(80, height - insetY * 2);
    for (let i = 0; i < 26; i += 1) {
      const near = i < 12;
      const h0 = hash01(seed + i * 41 + 1);
      const h1 = hash01(seed + i * 41 + 2);
      const h2 = hash01(seed + i * 41 + 3);
      const h3 = hash01(seed + i * 41 + 4);
      const fallSpeed = near ? 0.62 + h2 * 0.35 : 0.34 + h2 * 0.22;
      const windSpeed = near ? 0.34 + h3 * 0.2 : 0.18 + h3 * 0.14;
      const swayAmp = near ? 22 : 13;
      const x = insetX + wrap(
        h0 * spanX + tick * windSpeed + Math.sin(tick * 0.028 + h1 * 6.28) * swayAmp,
        spanX,
      );
      const y = insetY + wrap(h1 * spanY + tick * fallSpeed, spanY);
      const scale = near ? 0.3 + h2 * 0.16 : 0.18 + h2 * 0.11;
      out.push({
        layer: "over",
        texture: "petal",
        blend: "normal",
        x,
        y,
        scaleX: scale,
        scaleY: scale,
        rotation: tick * 0.01 + h3 * 6.28,
        alpha: clamp01(near ? 0.62 + h3 * 0.22 : 0.48 + h3 * 0.18),
        tint: pickTint(SNOW_TINTS, i),
      });
    }
    // 6 slow warm chimney smoke wisps rising from the Lodge roof (1270, 290).
    const cycle = 240;
    for (let i = 0; i < 6; i += 1) {
      const age = wrap(tick + i * (cycle / 6), cycle) / cycle;
      const fadeIn = Math.min(1, age / 0.18);
      const fadeOut = Math.min(1, (1 - age) / 0.45);
      const x = 1270 + age * 88 + Math.sin(age * Math.PI * 2 + i) * 12;
      const y = 290 - age * 155;
      const scale = 0.28 + age * 0.72;
      out.push({
        layer: "over",
        texture: "mistWisp",
        blend: "normal",
        x,
        y,
        scaleX: scale,
        scaleY: scale * 0.78,
        rotation: 0.08 * Math.sin(age * 4 + i),
        alpha: clamp01(0.24 * fadeIn * fadeOut),
        tint: 0xf5eee4,
      });
    }
    if (options?.passHearthWisps === true) {
      // 6 cozy cream-gold chimney curls rising above Mrs. Flurry's Ski Lodge roof.
      const t = options.reducedMotion === true ? 0 : tick;
      const hearthCycle = 260;
      for (let i = 0; i < 6; i += 1) {
        const h0 = hash01(seed + i * 71 + 11);
        const h1 = hash01(seed + i * 71 + 12);
        const age = wrap(t + i * (hearthCycle / 6) + h0 * 24, hearthCycle) / hearthCycle;
        const x = 1228 + age * 54 + Math.sin(age * Math.PI * 2 + i * 1.2) * 9 + (h1 - 0.5) * 8;
        const y = 306 - age * 112;
        const wave = options.reducedMotion === true ? 0.5 : Math.sin(age * Math.PI);
        const scale = 0.42 + age * 0.56;
        out.push({
          layer: "over",
          texture: "mistWisp",
          blend: "normal",
          x,
          y,
          scaleX: scale,
          scaleY: scale * 0.78,
          rotation: options.reducedMotion === true ? 0 : 0.08 * Math.sin(age * 4 + i),
          alpha: clamp01(0.18 + wave * 0.14),
          tint: 0xfff5df,
        });
      }
    }
    return out;
  }

  if (areaId === "woods") {
    // 3 subtle diagonal warm sunlight shafts.
    const shafts: readonly [number, number, number][] = [
      [460, 320, 2.3],
      [940, 290, 2.6],
      [1360, 350, 2.2],
    ];
    shafts.forEach(([sx, sy, scale], i) => {
      const alpha = 0.062 + 0.01 * Math.sin(tick * 0.018 + i * 2.1);
      out.push({
        layer: "over",
        texture: "sunbeam",
        blend: "add",
        x: sx,
        y: sy,
        scaleX: scale,
        scaleY: scale,
        rotation: 0,
        alpha: clamp01(alpha),
        tint: 0xfff2c8,
      });
    });
    // 14 golden sunlit forest motes.
    addFloatingMotes(out, seed + 200, width, height, tick, 14, FOREST_MOTE_TINTS, {
      driftX: 0.14,
      driftY: -0.06,
      minScale: 0.22,
      maxScale: 0.42,
      minAlpha: 0.2,
      maxAlpha: 0.52,
    });
    return out;
  }

  if (areaId === "mist") {
    addMistRibbons(out, seed, width, height, tick, 7, 0.18);
    addFloatingMotes(out, seed + 300, width, height, tick, 12, LILAC_TINTS, {
      driftX: 0.16,
      driftY: -0.08,
      minScale: 0.2,
      maxScale: 0.38,
      minAlpha: 0.18,
      maxAlpha: 0.46,
    });
    return out;
  }

  if (areaId === "enchanted") {
    // 4 luminous pastel fairy aura halos anchored on each fairy (emissive over twilight).
    ENCHANTED_FAIRIES.forEach((fairy, i) => {
      const pulse = Math.sin(tick * 0.045 + i * 1.6);
      const scale = 1.08 + 0.08 * pulse;
      out.push({
        layer: "emissive",
        texture: "softGlow",
        blend: "add",
        x: fairy.x,
        y: fairy.y,
        scaleX: scale,
        scaleY: scale,
        rotation: 0,
        alpha: clamp01(0.26 + 0.04 * pulse),
        tint: fairy.tint,
      });
    });
    addMistRibbons(out, seed, width, height, tick, 6, 0.16);
    // 14 soft golden/mint drifting firefly motes.
    addFloatingMotes(out, seed + 400, width, height, tick, 14, FIREFLY_TINTS, {
      driftX: 0.12,
      driftY: -0.1,
      minScale: 0.24,
      maxScale: 0.46,
      minAlpha: 0.22,
      maxAlpha: 0.58,
    });
    return out;
  }

  if (areaId === "cavern") {
    // Subtle cool subterranean indigo-slate edge framing along outer cavern walls.
    CAVERN_EDGE_SHADOWS.forEach(([ex, ey, sx, sy]) => {
      out.push({
        layer: "over",
        texture: "softGlow",
        blend: "normal",
        x: ex,
        y: ey,
        scaleX: sx,
        scaleY: sy,
        rotation: 0,
        alpha: 0.22,
        tint: 0x26204a,
      });
    });
    // Radiant pastel halos on the crystal clusters and hanging Star Chime (emissive over dusk).
    CAVERN_CRYSTALS.forEach((crystal, i) => {
      const pulse = Math.sin(tick * 0.038 + i * 1.4);
      const scale = crystal.scale * (1 + 0.07 * pulse);
      out.push({
        layer: "emissive",
        texture: "softGlow",
        blend: "add",
        x: crystal.x,
        y: crystal.y,
        scaleX: scale,
        scaleY: scale,
        rotation: 0,
        alpha: clamp01(crystal.baseAlpha + 0.045 * pulse),
        tint: crystal.tint,
      });
    });
    // Warm amber glows on the two cavern lantern posts (emissive over twilight).
    CAVERN_LANTERNS.forEach(([lx, ly], i) => {
      const pulse = Math.sin(tick * 0.042 + i * 2.1);
      out.push({
        layer: "emissive",
        texture: "softGlow",
        blend: "add",
        x: lx,
        y: ly,
        scaleX: 1.65 + 0.08 * pulse,
        scaleY: 1.5 + 0.06 * pulse,
        rotation: 0,
        alpha: clamp01(0.31 + 0.03 * pulse),
        tint: 0xffd27a,
      });
    });
    // Soft aqua stream glints shimmering gently across the crystal-steps crossing.
    CAVERN_STEP_RINGS.forEach(([rx, ry], i) => {
      const shimmer = Math.sin(tick * 0.05 + i * 2.1);
      const scale = 0.5 + 0.18 * shimmer;
      out.push({
        layer: "over",
        texture: "waterGlint",
        blend: "add",
        x: rx + Math.sin(tick * 0.025 + i) * 4,
        y: ry,
        scaleX: scale,
        scaleY: scale * 0.72,
        rotation: 0,
        alpha: clamp01(0.18 + shimmer * shimmer * 0.36),
        tint: 0xaef2e8,
      });
    });
    // 10 shimmering aqua water glints along the underground stream and glowing crystal pool.
    for (let i = 0; i < 10; i += 1) {
      const h0 = hash01(seed + i * 29 + 1);
      const h1 = hash01(seed + i * 29 + 2);
      const h2 = hash01(seed + i * 29 + 3);
      const inPool = i >= 4;
      const x = inPool ? 880 + h0 * 230 : 815 + h0 * 90;
      const y = inPool ? 660 + h1 * 270 : 275 + h1 * 210;
      const shimmer = Math.sin(tick * (0.055 + h2 * 0.04) + i * 1.6);
      const scale = 0.42 + h2 * 0.36;
      out.push({
        layer: "over",
        texture: "waterGlint",
        blend: "add",
        x: x + Math.sin(tick * 0.02 + i) * 4,
        y,
        scaleX: scale,
        scaleY: scale * 0.85,
        rotation: 0,
        alpha: clamp01(0.16 + shimmer * shimmer * 0.42),
        tint: pickTint(WATER_TINTS, i),
      });
    }
    // 14 gentle floating amethyst, aqua, and honey-gold crystal sparkle motes.
    addFloatingMotes(out, seed + 800, width, height, tick, 14, CAVERN_MOTE_TINTS, {
      marginX: 160,
      marginY: 160,
      driftX: 0.1,
      driftY: -0.09,
      minScale: 0.2,
      maxScale: 0.4,
      minAlpha: 0.2,
      maxAlpha: 0.52,
    });
    return out;
  }

  if (areaId === "cafe") {
    // Warm amber pastry-counter and cocoa-bar glow (emissive over twilight).
    const counterPulse = 0.16 + 0.022 * Math.sin(tick * 0.045);
    out.push({
      layer: "emissive",
      texture: "softGlow",
      blend: "add",
      x: 680,
      y: 415,
      scaleX: 2.35,
      scaleY: 1.75,
      rotation: 0.45,
      alpha: clamp01(counterPulse),
      tint: 0xffce7a,
    });
    out.push({
      layer: "emissive",
      texture: "softGlow",
      blend: "add",
      x: 780,
      y: 472,
      scaleX: 1.65,
      scaleY: 1.35,
      rotation: 0.45,
      alpha: clamp01(counterPulse * 0.92),
      tint: 0xffe4a8,
    });
    // 2 warm diagonal window sunbeams streaming from the NW arched window.
    const beams: readonly [number, number, number][] = [
      [445, 420, 1.85],
      [515, 485, 1.65],
    ];
    beams.forEach(([bx, by, scale], i) => {
      const alpha = 0.058 + 0.008 * Math.sin(tick * 0.018 + i * 2.2);
      out.push({
        layer: "over",
        texture: "sunbeam",
        blend: "add",
        x: bx,
        y: by,
        scaleX: scale,
        scaleY: scale,
        rotation: 0,
        alpha: clamp01(alpha),
        tint: 0xfff2cf,
      });
    });
    // 10 golden rising cocoa-steam and pastry-warmth motes.
    addFloatingMotes(out, seed + 650, width, height, tick, 10, CAFE_MOTE_TINTS, {
      marginX: 220,
      marginY: 220,
      driftX: 0.06,
      driftY: -0.14,
      minScale: 0.17,
      maxScale: 0.34,
      minAlpha: 0.17,
      maxAlpha: 0.42,
    });
    if (options?.cafeCinnamonSteam === true) {
      // 6 rising golden-warm cinnamon aroma wisps & sparkles above Chef Bea's kitchen counter.
      const t = options.reducedMotion === true ? 0 : tick;
      const steamCycle = 220;
      for (let i = 0; i < 6; i += 1) {
        const h0 = hash01(seed + i * 61 + 11);
        const h1 = hash01(seed + i * 61 + 12);
        const h2 = hash01(seed + i * 61 + 13);
        const age = wrap(t + i * (steamCycle / 6) + h0 * 35, steamCycle) / steamCycle;
        const baseX = 435 + (i / 5) * 200 + (h1 - 0.5) * 16;
        const sway = options.reducedMotion === true ? 0 : Math.sin(age * Math.PI * 2 + i) * 8;
        const x = baseX + sway;
        const y = 355 - age * 110;
        const isWisp = i % 2 === 0;
        const wave = options.reducedMotion === true ? 0.5 : Math.sin(age * Math.PI);
        const scale = isWisp ? 0.36 + age * 0.34 : 0.34 + h2 * 0.22;
        out.push({
          layer: "over",
          texture: isWisp ? "mistWisp" : "sparkle",
          blend: isWisp ? "normal" : "add",
          x,
          y,
          scaleX: scale,
          scaleY: isWisp ? scale * 0.72 : scale,
          rotation: isWisp && options.reducedMotion !== true ? 0.06 * Math.sin(age * 4 + i) : 0,
          alpha: clamp01(0.18 + wave * 0.16),
          tint: 0xffe2a8,
        });
      }
    }
    return out;
  }

  if (areaId === "sue-cottage") {
    // Soft aqua-mint glow halo over Sue's sea-glass jar lamp (756, 305), emissive over dusk.
    const lampPulse = 0.22 + 0.03 * Math.sin(tick * 0.045);
    out.push({
      layer: "emissive",
      texture: "softGlow",
      blend: "add",
      x: 756,
      y: 305,
      scaleX: 1.85,
      scaleY: 1.6,
      rotation: 0,
      alpha: clamp01(lampPulse),
      tint: 0x8ef2dc,
    });
    out.push({
      layer: "emissive",
      texture: "softGlow",
      blend: "add",
      x: 756,
      y: 305,
      scaleX: 0.95,
      scaleY: 0.9,
      rotation: 0,
      alpha: clamp01(lampPulse * 0.85),
      tint: 0xdffef6,
    });
    // 2 warm coastal window sunbeams streaming from the left cottage window & porthole.
    const beams: readonly [number, number, number][] = [
      [420, 355, 1.9],
      [495, 435, 1.7],
    ];
    beams.forEach(([bx, by, scale], i) => {
      const alpha = 0.058 + 0.008 * Math.sin(tick * 0.017 + i * 2.1);
      out.push({
        layer: "over",
        texture: "sunbeam",
        blend: "add",
        x: bx,
        y: by,
        scaleX: scale,
        scaleY: scale,
        rotation: 0,
        alpha: clamp01(alpha),
        tint: 0xfff5d6,
      });
    });
    // 10 gentle sunlit sea-dust motes drifting across the cottage.
    addFloatingMotes(out, seed + 660, width, height, tick, 10, COTTAGE_MOTE_TINTS, {
      marginX: 180,
      marginY: 200,
      driftX: 0.09,
      driftY: -0.05,
      minScale: 0.17,
      maxScale: 0.33,
      minAlpha: 0.16,
      maxAlpha: 0.4,
    });
    return out;
  }

  if (areaId === "jordan-cabin") {
    // Crisp snowy window sunbeam slanting across the cabin floorboards.
    const beamAlpha = 0.062 + 0.008 * Math.sin(tick * 0.016);
    out.push({
      layer: "over",
      texture: "sunbeam",
      blend: "add",
      x: 380,
      y: 415,
      scaleX: 1.95,
      scaleY: 1.9,
      rotation: 0,
      alpha: clamp01(beamAlpha),
      tint: 0xf4f8ff,
    });
    // Warm amber glow halos over the steaming cocoa kettle (890, 360) and camp lantern (1080, 380).
    const cocoaPulse = 0.17 + 0.022 * Math.sin(tick * 0.04);
    out.push({
      layer: "emissive",
      texture: "softGlow",
      blend: "add",
      x: 890,
      y: 360,
      scaleX: 1.55,
      scaleY: 1.35,
      rotation: 0,
      alpha: clamp01(cocoaPulse),
      tint: 0xffd08a,
    });
    const lanternPulse = 0.24 + 0.028 * Math.sin(tick * 0.055 + 1.2);
    out.push({
      layer: "emissive",
      texture: "softGlow",
      blend: "add",
      x: 1080,
      y: 380,
      scaleX: 1.75,
      scaleY: 1.6,
      rotation: 0,
      alpha: clamp01(lanternPulse),
      tint: 0xffd98a,
    });
    // 6 rising warm cocoa-steam wisps curling up from the copper cocoa kettle.
    const cycle = 160;
    for (let i = 0; i < 6; i += 1) {
      const age = wrap(tick + i * (cycle / 6), cycle) / cycle;
      const fadeIn = Math.min(1, age / 0.2);
      const fadeOut = Math.min(1, (1 - age) / 0.45);
      const x = 905 + Math.sin(age * Math.PI * 2 + i * 1.1) * 10;
      const y = 328 - age * 76;
      const scale = 0.14 + age * 0.28;
      out.push({
        layer: "over",
        texture: "mistWisp",
        blend: "normal",
        x,
        y,
        scaleX: scale,
        scaleY: scale * 0.72,
        rotation: 0.08 * Math.sin(age * 4 + i),
        alpha: clamp01(0.22 * fadeIn * fadeOut),
        tint: 0xfff5e8,
      });
    }
    return out;
  }

  if (areaId === "lodge") {
    // Warm flickering amber hearth glow over the stone fireplace (907, 455), emissive over dusk.
    const flicker = 0.18 +
      0.026 * Math.sin(tick * 0.11) +
      0.014 * Math.sin(tick * 0.23 + 1.1);
    out.push({
      layer: "emissive",
      texture: "softGlow",
      blend: "add",
      x: 907,
      y: 458,
      scaleX: 2.5,
      scaleY: 2.1,
      rotation: 0,
      alpha: clamp01(flicker),
      tint: 0xffbe6b,
    });
    out.push({
      layer: "emissive",
      texture: "softGlow",
      blend: "add",
      x: 907,
      y: 446,
      scaleX: 1.15,
      scaleY: 1.0,
      rotation: 0,
      alpha: clamp01(flicker * 0.9),
      tint: 0xffe09a,
    });
    // 8 floating warm dust motes.
    addFloatingMotes(out, seed + 600, width, height, tick, 8, HEARTH_MOTE_TINTS, {
      marginX: 180,
      marginY: 220,
      driftX: 0.08,
      driftY: -0.1,
      minScale: 0.18,
      maxScale: 0.34,
      minAlpha: 0.16,
      maxAlpha: 0.4,
    });
    return out;
  }

  if (areaId === "arcade") {
    // Subtle breathing pink ("ARCADE" left wall) & teal ("PLAY" right wall) neon glows.
    const pinkPulse = 0.13 + 0.03 * Math.sin(tick * 0.04);
    const tealPulse = 0.13 + 0.03 * Math.sin(tick * 0.04 + 2.2);
    out.push({
      layer: "over",
      texture: "softGlow",
      blend: "add",
      x: 235,
      y: 252,
      scaleX: 2.15,
      scaleY: 1.15,
      rotation: -0.28,
      alpha: clamp01(pinkPulse),
      tint: 0xff7ac6,
    });
    out.push({
      layer: "over",
      texture: "softGlow",
      blend: "add",
      x: 925,
      y: 225,
      scaleX: 1.9,
      scaleY: 1.05,
      rotation: 0.26,
      alpha: clamp01(tealPulse),
      tint: 0x6be8de,
    });
    addFloatingMotes(out, seed + 700, width, height, tick, 6, ARCADE_MOTE_TINTS, {
      marginX: 180,
      marginY: 220,
      driftX: 0.06,
      driftY: -0.06,
      minScale: 0.18,
      maxScale: 0.3,
      minAlpha: 0.14,
      maxAlpha: 0.32,
    });
    return out;
  }

  if (INDOOR_SUNLIT.has(areaId)) {
    // 2 subtle diagonal warm window sunbeams + 8 slow floating sunlit dust motes.
    const beams: readonly [number, number, number][] = [
      [width * 0.34, height * 0.38, 1.85],
      [width * 0.62, height * 0.42, 1.75],
    ];
    beams.forEach(([bx, by, scale], i) => {
      const alpha = 0.054 + 0.007 * Math.sin(tick * 0.016 + i * 2.4);
      out.push({
        layer: "over",
        texture: "sunbeam",
        blend: "add",
        x: bx,
        y: by,
        scaleX: scale,
        scaleY: scale,
        rotation: 0,
        alpha: clamp01(alpha),
        tint: 0xfff4d4,
      });
    });
    addFloatingMotes(out, seed + 800, width, height, tick, 8, SUNLIT_MOTE_TINTS, {
      marginX: width * 0.16,
      marginY: height * 0.22,
      driftX: 0.07,
      driftY: -0.05,
      minScale: 0.16,
      maxScale: 0.3,
      minAlpha: 0.15,
      maxAlpha: 0.36,
    });
    if (areaId === "clubhouse" && options?.clubhouseBloom === true) {
      // Subtle warm golden/blossom pollen sparkles over the blooming planter deck.
      const t = options.reducedMotion === true ? 0 : tick;
      for (let i = 0; i < 8; i += 1) {
        const h0 = hash01(seed + i * 59 + 11);
        const h1 = hash01(seed + i * 59 + 12);
        const h2 = hash01(seed + i * 59 + 13);
        const h3 = hash01(seed + i * 59 + 14);
        const x = 720 + wrap(h0 * 200 + t * 0.12 + Math.sin(t * 0.025 + i) * 10, 200);
        const y = 560 + wrap(h1 * 100 - t * (0.09 + h2 * 0.06), 100);
        const twinkle =
          options.reducedMotion === true
            ? 0.5
            : 0.5 + 0.5 * Math.sin(t * (0.05 + h3 * 0.04) + i * 1.4);
        const scale = 0.18 + h2 * 0.16;
        out.push({
          layer: "over",
          texture: "sparkle",
          blend: "add",
          x,
          y,
          scaleX: scale,
          scaleY: scale,
          rotation: 0,
          alpha: clamp01(0.18 + twinkle * 0.26),
          tint: pickTint(CLUBHOUSE_BLOOM_TINTS, i),
        });
      }
    }
    return out;
  }

  // Fallback for any future outdoor area: gentle sunlit motes.
  addFloatingMotes(out, seed + 900, width, height, tick, 8, SUNLIT_MOTE_TINTS, {
    driftX: 0.1,
    driftY: -0.04,
    minScale: 0.18,
    maxScale: 0.32,
    minAlpha: 0.16,
    maxAlpha: 0.38,
  });
  return out;
}

export class BiomeAtmosphere {
  readonly under = new Container();
  readonly over = new Container();
  readonly emissive = new Container();
  private readonly underPool: Sprite[] = [];
  private readonly overPool: Sprite[] = [];
  private readonly emissivePool: Sprite[] = [];
  private visibleCount = 0;

  constructor(private readonly textures: VfxTextures) {
    this.under.label = "atmosphere:under";
    this.over.label = "atmosphere:over";
    this.emissive.label = "atmosphere:emissive";
  }

  get activeCount(): number {
    return this.visibleCount;
  }

  update(
    areaId: string,
    width: number,
    height: number,
    tick: number,
    visible: boolean,
    duskBlend = 0,
    options?: AtmosphereOptions,
  ): void {
    const show = visible && areaId !== "harness";
    this.under.visible = show;
    this.over.visible = show;
    this.emissive.visible = show;
    if (!show) {
      this.visibleCount = 0;
      return;
    }

    const particles = evaluateAtmosphere(areaId, width, height, tick, options);
    this.visibleCount = particles.length;
    const duskBoost = 1 + clamp01(duskBlend) * 0.65;
    let underUsed = 0;
    let overUsed = 0;
    let emissiveUsed = 0;
    for (const particle of particles) {
      let pool: Sprite[];
      let container: Container;
      let index: number;
      if (particle.layer === "under") {
        pool = this.underPool;
        container = this.under;
        index = underUsed;
        underUsed += 1;
      } else if (particle.layer === "emissive") {
        pool = this.emissivePool;
        container = this.emissive;
        index = emissiveUsed;
        emissiveUsed += 1;
      } else {
        pool = this.overPool;
        container = this.over;
        index = overUsed;
        overUsed += 1;
      }

      let sprite = pool[index];
      if (sprite === undefined) {
        sprite = new Sprite();
        sprite.anchor.set(0.5);
        pool.push(sprite);
        container.addChild(sprite);
      }
      sprite.visible = true;
      sprite.texture = this.textures[particle.texture];
      sprite.blendMode = particle.blend;
      sprite.position.set(particle.x, particle.y);
      sprite.scale.set(particle.scaleX, particle.scaleY);
      sprite.rotation = particle.rotation;
      sprite.alpha =
        particle.layer === "emissive" ? clamp01(particle.alpha * duskBoost) : particle.alpha;
      sprite.tint = particle.tint;
    }
    for (let i = underUsed; i < this.underPool.length; i += 1) {
      const sprite = this.underPool[i];
      if (sprite !== undefined) sprite.visible = false;
    }
    for (let i = overUsed; i < this.overPool.length; i += 1) {
      const sprite = this.overPool[i];
      if (sprite !== undefined) sprite.visible = false;
    }
    for (let i = emissiveUsed; i < this.emissivePool.length; i += 1) {
      const sprite = this.emissivePool[i];
      if (sprite !== undefined) sprite.visible = false;
    }
  }

  destroy(): void {
    this.under.destroy({ children: true });
    this.over.destroy({ children: true });
    this.emissive.destroy({ children: true });
    this.underPool.length = 0;
    this.overPool.length = 0;
    this.emissivePool.length = 0;
  }
}
