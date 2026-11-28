import type { CozyWeatherKind } from "../core/weather";
import {
  clamp01,
  hash01,
  pickTint,
  wrap,
  type AtmosphereParticle,
} from "./atmosphere-shared";

/** Five-band pastel watercolor rainbow palette (blush, peach, butter, mint, sky). */
export const RAINBOW_ARC_TINTS: readonly number[] = [
  0xff9ebb,
  0xffd580,
  0xfff099,
  0x9be8be,
  0x9fd8ff,
];

const RAIN_STREAK_TINTS: readonly number[] = [0x9ad8f5, 0xc4ecff];
const SNOW_CRYSTAL_TINTS: readonly number[] = [0xffffff, 0xd8f0ff, 0xe8f6ff];
const BREEZE_PETAL_TINTS: readonly number[] = [0xffb8d0, 0xfff0b8, 0xb8f0cc, 0xd8c4ff];
const FIREFLY_LANTERN_TINTS: readonly number[] = [0xffe97a, 0xc4f78a, 0xfff5b8];

function addSunshowerParticles(
  out: AtmosphereParticle[],
  width: number,
  height: number,
  tick: number,
  reducedMotion: boolean,
): void {
  const insetX = width * 0.06;
  const insetY = height * 0.05;
  const spanX = Math.max(80, width - insetX * 2);
  const spanY = Math.max(80, height - insetY * 2);

  // 16 soft diagonal watercolor rain streaks stratified across the map, drifting down-left.
  const cols = 4;
  const rows = 4;
  const cellW = spanX / cols;
  const cellH = spanY / rows;
  for (let i = 0; i < 16; i += 1) {
    const h0 = hash01(18301 + i * 37 + 1);
    const h1 = hash01(18301 + i * 37 + 2);
    const h2 = hash01(18301 + i * 37 + 3);
    const h3 = hash01(18301 + i * 37 + 4);
    const col = i % cols;
    const row = Math.floor(i / cols);
    const speedX = 0.85 + h2 * 0.45;
    const speedY = 2.1 + h3 * 0.9;
    const x = insetX + wrap((col + 0.15 + h0 * 0.7) * cellW - tick * speedX, spanX);
    const y = insetY + wrap((row + 0.15 + h1 * 0.7) * cellH + tick * speedY, spanY);
    out.push({
      layer: "over",
      texture: "mistWisp",
      blend: "normal",
      x,
      y,
      scaleX: 0.48,
      scaleY: 0.14,
      rotation: reducedMotion ? 0 : 1.18,
      alpha: clamp01(0.46 + h2 * 0.06),
      tint: pickTint(RAIN_STREAK_TINTS, i),
    });
  }

  // 6 soft raindrop splash ripples along open ground.
  const groundMinX = width * 0.12;
  const groundSpanX = Math.max(80, width * 0.76);
  const groundMinY = height * 0.36;
  const groundSpanY = Math.max(80, height * 0.48);
  for (let i = 0; i < 6; i += 1) {
    const h0 = hash01(18351 + i * 53 + 1);
    const h1 = hash01(18351 + i * 53 + 2);
    const h2 = hash01(18351 + i * 53 + 3);
    const phase = reducedMotion
      ? 0.5
      : 0.5 + 0.5 * Math.sin(tick * (0.085 + h2 * 0.04) + i * 1.9);
    const scale = 0.44 + h2 * 0.2 + (reducedMotion ? 0 : phase * 0.12);
    out.push({
      layer: "under",
      texture: "sparkle",
      blend: "add",
      x: groundMinX + h0 * groundSpanX,
      y: groundMinY + h1 * groundSpanY,
      scaleX: scale,
      scaleY: scale * 0.55,
      rotation: 0,
      alpha: clamp01(0.26 + phase * 0.18),
      tint: 0xd8f4ff,
    });
  }

  // 20 pastel 5-band watercolor rainbow arc particles across the upper sky.
  const segmentsPerBand = 4;
  for (let band = 0; band < RAINBOW_ARC_TINTS.length; band += 1) {
    const tint = pickTint(RAINBOW_ARC_TINTS, band);
    for (let seg = 0; seg < segmentsPerBand; seg += 1) {
      const u = seg / (segmentsPerBand - 1);
      const arch = 4 * u * (1 - u);
      const x = width * (0.28 + u * 0.44);
      const y = height * (0.24 + band * 0.024 - arch * 0.095);
      const shimmer = reducedMotion
        ? 0
        : 0.015 * Math.sin(tick * 0.02 + band * 0.9 + seg * 1.1);
      out.push({
        layer: "emissive",
        texture: "softGlow",
        blend: "normal",
        x,
        y,
        scaleX: 4.4,
        scaleY: 0.42,
        rotation: reducedMotion ? 0 : (u - 0.5) * 0.44,
        alpha: clamp01(0.31 + arch * 0.015 + shimmer),
        tint,
      });
    }
  }
}

function addSnowFlurryParticles(
  out: AtmosphereParticle[],
  width: number,
  height: number,
  tick: number,
  reducedMotion: boolean,
): void {
  const insetX = width * 0.05;
  const insetY = height * 0.05;
  const spanX = Math.max(80, width - insetX * 2);
  const spanY = Math.max(80, height - insetY * 2);

  for (let i = 0; i < 20; i += 1) {
    const h0 = hash01(18401 + i * 41 + 1);
    const h1 = hash01(18401 + i * 41 + 2);
    const h2 = hash01(18401 + i * 41 + 3);
    const h3 = hash01(18401 + i * 41 + 4);
    const sway = reducedMotion ? 0 : Math.sin(tick * (0.022 + h3 * 0.015) + i * 1.3) * 18;
    const x = insetX + wrap(h0 * spanX - tick * (0.34 + h2 * 0.28) + sway, spanX);
    const y = insetY + wrap(h1 * spanY + tick * (0.48 + h3 * 0.36), spanY);
    const isPuff = i % 2 === 0;
    const scale = isPuff ? 0.22 + h2 * 0.14 : 0.3 + h2 * 0.2;
    out.push({
      layer: "over",
      texture: isPuff ? "puff" : "sparkle",
      blend: isPuff ? "normal" : "add",
      x,
      y,
      scaleX: scale,
      scaleY: scale,
      rotation: reducedMotion ? 0 : tick * (0.014 + h3 * 0.016) + h0 * Math.PI * 2,
      alpha: clamp01(0.55 + h1 * 0.27),
      tint: pickTint(SNOW_CRYSTAL_TINTS, i),
    });
  }
}

function addBreezePetalParticles(
  out: AtmosphereParticle[],
  width: number,
  height: number,
  tick: number,
  reducedMotion: boolean,
): void {
  const insetX = width * 0.06;
  const insetY = height * 0.06;
  const spanX = Math.max(80, width - insetX * 2);
  const spanY = Math.max(80, height - insetY * 2);

  for (let i = 0; i < 14; i += 1) {
    const h0 = hash01(18501 + i * 43 + 1);
    const h1 = hash01(18501 + i * 43 + 2);
    const h2 = hash01(18501 + i * 43 + 3);
    const h3 = hash01(18501 + i * 43 + 4);
    const flutterX = reducedMotion ? 0 : Math.sin(tick * 0.028 + i * 1.5) * 20;
    const flutterY = reducedMotion ? 0 : Math.cos(tick * 0.024 + i * 1.2) * 14;
    const x = insetX + wrap(h0 * spanX + tick * (0.46 + h2 * 0.32) + flutterX, spanX);
    const y = insetY + wrap(h1 * spanY + tick * (0.18 + h3 * 0.16) + flutterY, spanY);
    const scale = 0.46 + h2 * 0.28;
    const squash = reducedMotion ? 0.84 : 0.68 + 0.32 * Math.abs(Math.cos(tick * 0.042 + i));
    out.push({
      layer: "over",
      texture: "petal",
      blend: "normal",
      x,
      y,
      scaleX: scale,
      scaleY: scale * squash,
      rotation: reducedMotion ? 0 : tick * (0.018 + h3 * 0.022) + h0 * Math.PI * 2,
      alpha: clamp01(0.58 + h1 * 0.24),
      tint: pickTint(BREEZE_PETAL_TINTS, i),
    });
  }
}

function addTwilightFireflyParticles(
  out: AtmosphereParticle[],
  width: number,
  height: number,
  tick: number,
  reducedMotion: boolean,
): void {
  const insetX = width * 0.08;
  const insetY = height * 0.14;
  const spanX = Math.max(80, width - insetX * 2);
  const spanY = Math.max(80, height - insetY * 2);

  for (let i = 0; i < 14; i += 1) {
    const h0 = hash01(18601 + i * 47 + 1);
    const h1 = hash01(18601 + i * 47 + 2);
    const h2 = hash01(18601 + i * 47 + 3);
    const h3 = hash01(18601 + i * 47 + 4);
    const bobX = reducedMotion ? 0 : Math.sin(tick * (0.018 + h2 * 0.012) + i * 1.7) * 24;
    const bobY = reducedMotion ? 0 : Math.cos(tick * (0.021 + h3 * 0.014) + i * 1.3) * 18;
    const x = insetX + wrap(h0 * spanX + tick * (0.08 + h2 * 0.06) + bobX, spanX);
    const y = insetY + wrap(h1 * spanY - tick * (0.05 + h3 * 0.05) + bobY, spanY);
    const pulse = reducedMotion
      ? 0.65
      : 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(tick * (0.045 + h2 * 0.035) + i * 1.9));
    const isGlow = i % 2 === 0;
    const scale = isGlow ? 0.38 + h3 * 0.24 : 0.44 + h3 * 0.26;
    out.push({
      layer: "emissive",
      texture: isGlow ? "softGlow" : "sparkle",
      blend: "add",
      x,
      y,
      scaleX: scale,
      scaleY: scale,
      rotation: 0,
      alpha: clamp01(0.28 + pulse * 0.54),
      tint: pickTint(FIREFLY_LANTERN_TINTS, i),
    });
  }
}

/**
 * Pure zero-Pixi deterministic weather particle & 5-band pastel rainbow evaluator.
 * Returns `[]` for `"clear"` to preserve pixel-identical baseline rendering.
 */
export function evaluateWeatherParticles(
  weather: CozyWeatherKind,
  width: number,
  height: number,
  rawTick: number,
  reducedMotion = false,
): AtmosphereParticle[] {
  if (weather === "clear" || width <= 0 || height <= 0) return [];
  const tick = reducedMotion ? 0 : rawTick;
  const out: AtmosphereParticle[] = [];
  if (weather === "sunshower") {
    addSunshowerParticles(out, width, height, tick, reducedMotion);
  } else if (weather === "snow-flurry") {
    addSnowFlurryParticles(out, width, height, tick, reducedMotion);
  } else if (weather === "breeze-petals") {
    addBreezePetalParticles(out, width, height, tick, reducedMotion);
  } else if (weather === "twilight-fireflies") {
    addTwilightFireflyParticles(out, width, height, tick, reducedMotion);
  }
  return out;
}
