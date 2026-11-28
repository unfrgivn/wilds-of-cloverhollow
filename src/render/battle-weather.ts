import {
  weatherForArea,
  type CozyWeatherKind,
  type CozyWeatherMode,
} from "../core/weather";
import { clamp01, hash01, pickTint, wrap } from "./atmosphere-shared";
import { RAINBOW_ARC_TINTS } from "./weather-particles";

export type BattleWeatherTexture = "mistWisp" | "sparkle" | "softGlow" | "puff" | "petal";

export type BattleWeatherParticle = {
  texture: BattleWeatherTexture;
  blend: "normal" | "add";
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  alpha: number;
  tint: number;
};

export type BattleWeatherFrame = {
  kind: CozyWeatherKind;
  particles: BattleWeatherParticle[];
};

const RAIN_STREAK_TINTS: readonly number[] = [0x9ad8f5, 0xc4ecff];
const SNOW_CRYSTAL_TINTS: readonly number[] = [0xffffff, 0xd8f0ff, 0xe8f6ff];
const BREEZE_PETAL_TINTS: readonly number[] = [0xffb8d0, 0xfff0b8, 0xb8f0cc, 0xd8c4ff];
const FIREFLY_LANTERN_TINTS: readonly number[] = [0xf5d64a, 0xa8e862, 0xffe066];

const RAINBOW_BAND_LOBE_COUNTS: readonly number[] = [3, 3, 3, 3, 2];

function addBattleSunshower(
  out: BattleWeatherParticle[],
  width: number,
  height: number,
  tick: number,
  reducedMotion: boolean,
): void {
  // 14 upper-sky 5-band pastel watercolor rainbow wash lobes (x: 0.20..0.80, y: 0.14..0.28).
  for (let band = 0; band < RAINBOW_ARC_TINTS.length; band += 1) {
    const tint = pickTint(RAINBOW_ARC_TINTS, band);
    const count = RAINBOW_BAND_LOBE_COUNTS[band] ?? 3;
    for (let seg = 0; seg < count; seg += 1) {
      const u = count === 2 ? (seg === 0 ? 0.24 : 0.76) : seg / (count - 1);
      const arch = 4 * u * (1 - u);
      const x = width * (0.2 + u * 0.6);
      const y = height * (0.205 + band * 0.017 - arch * 0.062);
      const shimmer = reducedMotion
        ? 0
        : 0.015 * Math.sin(tick * 0.02 + band * 0.9 + seg * 1.1);
      out.push({
        texture: "softGlow",
        blend: "normal",
        x,
        y,
        scaleX: count === 2 ? 3.8 : 3.5,
        scaleY: 0.46,
        rotation: reducedMotion ? 0 : (u - 0.5) * 0.34,
        alpha: clamp01(0.285 + arch * 0.04 + shimmer),
        tint,
      });
    }
  }

  // 14 delicate diagonal watercolor rain streaks stratified cleanly across the battle stage.
  const insetX = width * 0.06;
  const insetY = height * 0.08;
  const spanX = Math.max(1, width - insetX * 2);
  const spanY = Math.max(1, height - insetY * 2);
  const cols = 7;
  const rows = 2;
  const cellW = spanX / cols;
  const cellH = spanY / rows;
  for (let i = 0; i < 14; i += 1) {
    const h0 = hash01(21501 + i * 37 + 1);
    const h1 = hash01(21501 + i * 37 + 2);
    const h2 = hash01(21501 + i * 37 + 3);
    const h3 = hash01(21501 + i * 37 + 4);
    const col = i % cols;
    const row = Math.floor(i / cols);
    const speedX = 0.85 + h2 * 0.45;
    const speedY = 2.05 + h3 * 0.85;
    const x = insetX + wrap((col + 0.18 + h0 * 0.64) * cellW - tick * speedX, spanX);
    const y = insetY + wrap((row + 0.18 + h1 * 0.64) * cellH + tick * speedY, spanY);
    out.push({
      texture: "mistWisp",
      blend: "normal",
      x,
      y,
      scaleX: 0.44 + h2 * 0.1,
      scaleY: 0.11 + h3 * 0.03,
      rotation: reducedMotion ? 0 : 1.18,
      alpha: clamp01(0.3 + h2 * 0.16),
      tint: pickTint(RAIN_STREAK_TINTS, i),
    });
  }
}

function addBattleSnowFlurry(
  out: BattleWeatherParticle[],
  width: number,
  height: number,
  tick: number,
  reducedMotion: boolean,
): void {
  const insetX = width * 0.06;
  const insetY = height * 0.08;
  const spanX = Math.max(1, width - insetX * 2);
  const spanY = Math.max(1, height - insetY * 2);

  for (let i = 0; i < 18; i += 1) {
    const h0 = hash01(21541 + i * 41 + 1);
    const h1 = hash01(21541 + i * 41 + 2);
    const h2 = hash01(21541 + i * 41 + 3);
    const h3 = hash01(21541 + i * 41 + 4);
    const sway = reducedMotion ? 0 : Math.sin(tick * (0.022 + h3 * 0.014) + i * 1.3) * 16;
    const x = insetX + wrap(h0 * spanX - tick * (0.34 + h2 * 0.26) + sway, spanX);
    const y = insetY + wrap(h1 * spanY + tick * (0.46 + h3 * 0.34), spanY);
    const isPuff = i % 2 === 0;
    const scale = isPuff ? 0.21 + h2 * 0.14 : 0.28 + h2 * 0.18;
    out.push({
      texture: isPuff ? "puff" : "sparkle",
      blend: isPuff ? "normal" : "add",
      x,
      y,
      scaleX: scale,
      scaleY: scale,
      rotation: reducedMotion ? 0 : tick * (0.014 + h3 * 0.016) + h0 * Math.PI * 2,
      alpha: clamp01(0.48 + h1 * 0.28),
      tint: pickTint(SNOW_CRYSTAL_TINTS, i),
    });
  }
}

function addBattleBreezePetals(
  out: BattleWeatherParticle[],
  width: number,
  height: number,
  tick: number,
  reducedMotion: boolean,
): void {
  const insetX = width * 0.06;
  const insetY = height * 0.1;
  const spanX = Math.max(1, width - insetX * 2);
  const spanY = Math.max(1, height - insetY * 2);

  for (let i = 0; i < 14; i += 1) {
    const h0 = hash01(21581 + i * 43 + 1);
    const h1 = hash01(21581 + i * 43 + 2);
    const h2 = hash01(21581 + i * 43 + 3);
    const h3 = hash01(21581 + i * 43 + 4);
    const flutterX = reducedMotion ? 0 : Math.sin(tick * 0.028 + i * 1.5) * 18;
    const flutterY = reducedMotion ? 0 : Math.cos(tick * 0.024 + i * 1.2) * 12;
    const x = insetX + wrap(h0 * spanX + tick * (0.44 + h2 * 0.3) + flutterX, spanX);
    const y = insetY + wrap(h1 * spanY + tick * (0.16 + h3 * 0.16) + flutterY, spanY);
    const scale = 0.44 + h2 * 0.24;
    const squash = reducedMotion ? 0.84 : 0.68 + 0.32 * Math.abs(Math.cos(tick * 0.042 + i));
    out.push({
      texture: "petal",
      blend: "normal",
      x,
      y,
      scaleX: scale,
      scaleY: scale * squash,
      rotation: reducedMotion ? 0 : tick * (0.018 + h3 * 0.022) + h0 * Math.PI * 2,
      alpha: clamp01(0.52 + h1 * 0.24),
      tint: pickTint(BREEZE_PETAL_TINTS, i),
    });
  }
}

function addBattleTwilightFireflies(
  out: BattleWeatherParticle[],
  width: number,
  height: number,
  tick: number,
  reducedMotion: boolean,
): void {
  const insetX = width * 0.08;
  const minY = height * 0.22;
  const spanX = Math.max(1, width - insetX * 2);
  const spanY = Math.max(1, height * 0.5);

  for (let i = 0; i < 14; i += 1) {
    const h0 = hash01(21621 + i * 47 + 1);
    const h1 = hash01(21621 + i * 47 + 2);
    const h2 = hash01(21621 + i * 47 + 3);
    const h3 = hash01(21621 + i * 47 + 4);
    const bobX = reducedMotion ? 0 : Math.sin(tick * (0.018 + h2 * 0.012) + i * 1.7) * 20;
    const bobY = reducedMotion ? 0 : Math.cos(tick * (0.021 + h3 * 0.014) + i * 1.3) * 14;
    const x = insetX + wrap(h0 * spanX + tick * (0.08 + h2 * 0.06) + bobX, spanX);
    const y = minY + wrap(h1 * spanY - tick * (0.05 + h3 * 0.05) + bobY, spanY);
    const pulse = reducedMotion
      ? 0.65
      : 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(tick * (0.045 + h2 * 0.035) + i * 1.9));
    const isGlow = i % 2 === 0;
    const scale = isGlow ? 0.44 + h3 * 0.26 : 0.48 + h3 * 0.26;
    out.push({
      texture: isGlow ? "softGlow" : "sparkle",
      blend: "normal",
      x,
      y,
      scaleX: scale,
      scaleY: scale,
      rotation: 0,
      alpha: clamp01(0.48 + pulse * 0.44),
      tint: pickTint(FIREFLY_LANTERN_TINTS, i),
    });
  }
}

/**
 * Pure zero-Pixi, zero-DOM deterministic evaluator for live Dynamic Cozy Weather
 * on the Battle Stage. Always returns `{ kind: "clear", particles: [] }` for
 * sheltered indoor areas and `"clear"` mode so existing battle baselines keep
 * 0-pixel diffs.
 */
export function evaluateBattleWeather(
  areaId: string,
  width: number,
  height: number,
  tick: number,
  mode: CozyWeatherMode,
  reducedMotion = false,
): BattleWeatherFrame {
  const info = weatherForArea(areaId, tick, mode);
  if (info.kind === "clear" || width <= 0 || height <= 0) {
    return { kind: info.kind, particles: [] };
  }
  const safeTick = reducedMotion ? 0 : Number.isFinite(tick) ? Math.max(0, tick) : 0;
  const particles: BattleWeatherParticle[] = [];
  if (info.kind === "sunshower") {
    addBattleSunshower(particles, width, height, safeTick, reducedMotion);
  } else if (info.kind === "snow-flurry") {
    addBattleSnowFlurry(particles, width, height, safeTick, reducedMotion);
  } else if (info.kind === "breeze-petals") {
    addBattleBreezePetals(particles, width, height, safeTick, reducedMotion);
  } else if (info.kind === "twilight-fireflies") {
    addBattleTwilightFireflies(particles, width, height, safeTick, reducedMotion);
  }
  return { kind: info.kind, particles };
}
