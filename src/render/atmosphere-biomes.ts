import {
  addBoundedSparkles,
  addFloatingMotes,
  addMistRibbons,
  areaSeed,
  AURORA_TINTS,
  CAVERN_CHIME_TINTS,
  CAVERN_CRYSTALS,
  CAVERN_EDGE_SHADOWS,
  CAVERN_LANTERNS,
  CAVERN_MOTE_TINTS,
  CAVERN_STEP_RINGS,
  clamp01,
  ENCHANTED_FAIRIES,
  FIREFLY_TINTS,
  hash01,
  LILAC_TINTS,
  pickTint,
  SNOW_TINTS,
  WATER_TINTS,
  wrap,
  type AtmosphereOptions,
  type AtmosphereParticle,
} from "./atmosphere-shared";

export const WILDS_BIOME_AREAS: ReadonlySet<string> = new Set([
  "pass",
  "summit",
  "mist",
  "enchanted",
  "cavern",
]);

function addChimneyWisps(
  out: AtmosphereParticle[],
  tick: number,
  baseX: number,
  baseY: number,
  driftX: number,
  riseY: number,
  swayAmp: number,
  scaleSpan: number,
): void {
  const cycle = 240;
  for (let i = 0; i < 6; i += 1) {
    const age = wrap(tick + i * (cycle / 6), cycle) / cycle;
    const fadeIn = Math.min(1, age / 0.18);
    const fadeOut = Math.min(1, (1 - age) / 0.45);
    const x = baseX + age * driftX + Math.sin(age * Math.PI * 2 + i) * swayAmp;
    const y = baseY - age * riseY;
    const scale = 0.28 + age * scaleSpan;
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
}

/**
 * Pure deterministic atmosphere particle evaluator for alpine, twilight, and cavern
 * wilds biomes (`pass`, `summit`, `mist`, `enchanted`, `cavern`).
 * Returns `null` for other areas.
 */
export function evaluateWildsBiomeAtmosphere(
  areaId: string,
  width: number,
  height: number,
  rawTick: number,
  options?: AtmosphereOptions,
): AtmosphereParticle[] | null {
  const tick = options?.reducedMotion === true ? 0 : rawTick;
  const out: AtmosphereParticle[] = [];
  const seed = areaSeed(areaId);

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
    addChimneyWisps(out, tick, 1270, 290, 88, 155, 12, 0.72);
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

  if (areaId === "summit") {
    // 6 shimmering pastel lavender/mint/gold aurora glow ribbons along the north overlook sky.
    for (let i = 0; i < 6; i += 1) {
      const h0 = hash01(seed + i * 31 + 1);
      const h1 = hash01(seed + i * 31 + 2);
      const wave = Math.sin(tick * (0.016 + h0 * 0.008) + i * 1.15);
      const x = 240 + i * 235 + Math.sin(tick * 0.01 + i * 0.9) * 28;
      const y = 92 + h1 * 92 + wave * 16;
      out.push({
        layer: "emissive",
        texture: "softGlow",
        blend: "add",
        x,
        y,
        scaleX: 2.8 + h0 * 1.1 + 0.14 * wave,
        scaleY: 0.95 + h1 * 0.45,
        rotation: -0.08 + 0.04 * wave,
        alpha: clamp01(0.22 + 0.09 * (0.5 + 0.5 * wave)),
        tint: pickTint(AURORA_TINTS, i),
      });
    }
    // 3 gentle aurora sunbeam shimmer curtains across the northern mountain sky (y = 70..220).
    const curtains: readonly [number, number, number][] = [
      [420, 130, 1.9],
      [840, 115, 2.2],
      [1240, 145, 1.85],
    ];
    curtains.forEach(([cx, cy, scale], i) => {
      const pulse = 0.5 + 0.5 * Math.sin(tick * 0.02 + i * 1.9);
      out.push({
        layer: "emissive",
        texture: "sunbeam",
        blend: "add",
        x: cx + Math.sin(tick * 0.012 + i) * 18,
        y: cy,
        scaleX: scale,
        scaleY: scale * 0.65,
        rotation: 0,
        alpha: clamp01(0.095 + pulse * 0.065),
        tint: pickTint(AURORA_TINTS, i),
      });
    });
    // 22 crisp mountain snowflakes drifting gently across the summit clearing.
    const insetX = width * 0.06;
    const insetY = height * 0.05;
    const spanX = Math.max(80, width - insetX * 2);
    const spanY = Math.max(80, height - insetY * 2);
    for (let i = 0; i < 22; i += 1) {
      const near = i < 10;
      const h0 = hash01(seed + i * 43 + 11);
      const h1 = hash01(seed + i * 43 + 12);
      const h2 = hash01(seed + i * 43 + 13);
      const h3 = hash01(seed + i * 43 + 14);
      const fallSpeed = near ? 0.56 + h2 * 0.32 : 0.32 + h2 * 0.2;
      const windSpeed = near ? 0.38 + h3 * 0.22 : 0.2 + h3 * 0.14;
      const swayAmp = near ? 20 : 12;
      const x = insetX + wrap(
        h0 * spanX + tick * windSpeed + Math.sin(tick * 0.026 + h1 * 6.28) * swayAmp,
        spanX,
      );
      const y = insetY + wrap(h1 * spanY + tick * fallSpeed, spanY);
      const scale = near ? 0.28 + h2 * 0.15 : 0.17 + h2 * 0.1;
      out.push({
        layer: "over",
        texture: "petal",
        blend: "normal",
        x,
        y,
        scaleX: scale,
        scaleY: scale,
        rotation: tick * 0.01 + h3 * 6.28,
        alpha: clamp01(near ? 0.6 + h3 * 0.22 : 0.45 + h3 * 0.18),
        tint: pickTint(SNOW_TINTS, i),
      });
    }
    // 6 warm rising chimney smoke wisps from the warming hut stone flue (1458, 380).
    addChimneyWisps(out, tick, 1458, 380, 82, 150, 10, 0.68);
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
    if (options?.cavernChimeShimmer === true) {
      // 6 soft prismatic crystal starlight sparkles drifting over the crystal cavern waters.
      addBoundedSparkles(out, seed, tick, options.reducedMotion === true, {
        count: 6,
        tints: CAVERN_CHIME_TINTS,
        blend: "add",
        minX: 580,
        spanX: 600,
        minY: 360,
        spanY: 300,
        minAlpha: 0.24,
        alphaSpan: 0.2,
        minScale: 0.34,
        scaleSpan: 0.22,
        stride: 73,
      });
    }
    return out;
  }

  return null;
}
