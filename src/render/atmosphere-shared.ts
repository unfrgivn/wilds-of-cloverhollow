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

export const INDOOR_SUNLIT = new Set([
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

export const MEADOW_AREAS = new Set(["park", "hills", "field"]);

export const PLAZA_ARCHES: readonly [number, number][] = [
  [691, 490],
  [1075, 492],
  [632, 822],
  [1155, 825],
];

export const ENCHANTED_FAIRIES: readonly { x: number; y: number; tint: number }[] = [
  { x: 850, y: 582, tint: 0xd8b8ff },
  { x: 450, y: 522, tint: 0xa8f0d8 },
  { x: 650, y: 462, tint: 0xa8dcff },
  { x: 1330, y: 642, tint: 0xffd0b8 },
];

export const BLOSSOM_TINTS: readonly number[] = [0xf29eb6, 0xf5cf72, 0xf7b2c7, 0xf2b591];
export const MEADOW_TINTS: readonly number[] = [0xfff8e6, 0xf9da8e, 0xf7eab5];
export const BUTTERFLY_TINTS: readonly number[] = [0xf8c4d8, 0xbce3f5, 0xfae09e];
export const WATER_TINTS: readonly number[] = [0x67d5c4, 0xaef2e8, 0xfffdf2];
export const SNOW_TINTS: readonly number[] = [0xffffff, 0xe8f4ff];
export const FOREST_MOTE_TINTS: readonly number[] = [0xf9da8e, 0xfff4cc];
export const LILAC_TINTS: readonly number[] = [0xe2c8ff, 0xf6eaff];
export const FIREFLY_TINTS: readonly number[] = [0xf9da8e, 0xa8f0d8];
export const HEARTH_MOTE_TINTS: readonly number[] = [0xffe3a8, 0xffcfa0];
export const CAFE_MOTE_TINTS: readonly number[] = [0xfff2cc, 0xffe0a6, 0xffd29d];
export const MARKET_MOTE_TINTS: readonly number[] = [0xfff4cc, 0xf9db8e, 0xffd99e];
export const PARLOR_MOTE_TINTS: readonly number[] = [0xffc6df, 0xb8f3e4, 0xfff5d4];
export const SUNLIT_MOTE_TINTS: readonly number[] = [0xfff6dc, 0xf9e4ab];
export const COTTAGE_MOTE_TINTS: readonly number[] = [0xfff8e2, 0xc7f7ee, 0xffe6ba];
export const MILO_MOTE_TINTS: readonly number[] = [0xfff6d6, 0xffe49e, 0xd4dcff];
export const ROSIE_MOTE_TINTS: readonly number[] = [0xffd4e4, 0xfff6d8, 0xd4f2dc];
export const CLUBHOUSE_BLOOM_TINTS: readonly number[] = [0xfff2b2, 0xf9d28c, 0xf7b2c7];
export const PLAZA_STAR_GLOW_TINTS: readonly number[] = [0xffe89a, 0xb8e8ff];
export const ARCADE_MOTE_TINTS: readonly number[] = [0xffa6da, 0x9cf2eb, 0xf9e29c];

export const CAVERN_CRYSTALS: readonly {
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

export const CAVERN_LANTERNS: readonly [number, number][] = [
  [298, 415],
  [1385, 690],
];

export const CAVERN_STEP_RINGS: readonly [number, number][] = [
  [785, 540],
  [840, 542],
  [895, 546],
];

export const CAVERN_EDGE_SHADOWS: readonly [number, number, number, number][] = [
  [110, 140, 5.2, 4.2],
  [1540, 140, 5.2, 4.2],
  [110, 970, 5.0, 3.8],
  [1540, 970, 5.0, 3.8],
  [825, 60, 8.0, 2.8],
];

export const CAVERN_MOTE_TINTS: readonly number[] = [0xd8b8ff, 0x9cf2eb, 0xf9da8e];

// Pure deterministic hash in [0, 1) from integer inputs (zero Math.random).
export function hash01(seed: number): number {
  let x = (seed ^ 0x9e3779b9) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b) >>> 0;
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0;
  x = (x ^ (x >>> 16)) >>> 0;
  return x / 0x100000000;
}

export function areaSeed(areaId: string): number {
  let hash = 2166136261;
  for (let i = 0; i < areaId.length; i += 1) {
    hash ^= areaId.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash;
}

export function wrap(value: number, span: number): number {
  if (span <= 0) return 0;
  return ((value % span) + span) % span;
}

export function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function pickTint(palette: readonly number[], index: number): number {
  return palette[index % palette.length] ?? 0xffffff;
}

export function addMistRibbons(
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

export function addFloatingMotes(
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
