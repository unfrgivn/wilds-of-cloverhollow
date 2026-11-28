import { evaluateWildsBiomeAtmosphere, WILDS_BIOME_AREAS } from "./atmosphere-biomes";
import {
  addFloatingMotes,
  areaSeed,
  BLOSSOM_TINTS,
  BUTTERFLY_TINTS,
  clamp01,
  FOREST_MOTE_TINTS,
  hash01,
  ISLAND_BEACON_TINTS,
  ISLAND_SHORE_GLINTS,
  MEADOW_AREAS,
  MEADOW_TINTS,
  pickTint,
  PLAZA_ARCHES,
  PLAZA_STAR_GLOW_TINTS,
  SANCTUARY_FESTIVAL_TINTS,
  WATER_TINTS,
  wrap,
  type AtmosphereOptions,
  type AtmosphereParticle,
} from "./atmosphere-shared";

export { evaluateWildsBiomeAtmosphere, WILDS_BIOME_AREAS };

/**
 * Pure deterministic atmosphere particle evaluator for outdoor, wilds, and cavern
 * areas. Returns `null` for non-outdoor areas so the dispatcher can route indoors.
 */
export function evaluateOutdoorAtmosphere(
  areaId: string,
  width: number,
  height: number,
  rawTick: number,
  options?: AtmosphereOptions,
): AtmosphereParticle[] | null {
  const tick = options?.reducedMotion === true ? 0 : rawTick;
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
    if (options?.sanctuaryFestival === true) {
      // 14 joyful sunlit festival clover-petal & golden-star sparkles drifting over the meadow.
      const t = options.reducedMotion === true ? 0 : tick;
      const insetX = width * 0.16;
      const insetY = height * 0.26;
      const spanX = Math.max(120, width - insetX * 1.8);
      const spanY = Math.max(100, height - insetY - 90);
      for (let i = 0; i < 14; i += 1) {
        const h0 = hash01(seed + i * 73 + 31);
        const h1 = hash01(seed + i * 73 + 32);
        const h2 = hash01(seed + i * 73 + 33);
        const h3 = hash01(seed + i * 73 + 34);
        const isPetal = i % 2 === 0;
        const x = insetX + wrap(
          h0 * spanX + t * (isPetal ? 0.24 : 0.14) * (0.7 + h2 * 0.6) +
            Math.sin(t * 0.024 + i * 1.1) * 16,
          spanX,
        );
        const y = insetY + wrap(
          h1 * spanY + t * (isPetal ? 0.1 : -0.09) * (0.7 + h3 * 0.6) +
            Math.cos(t * 0.02 + h0 * 6.28) * 10,
          spanY,
        );
        const twinkle =
          options.reducedMotion === true
            ? 0.5
            : 0.5 + 0.5 * Math.sin(t * (0.048 + h3 * 0.036) + i * 1.4);
        const scale = isPetal ? 0.54 + h2 * 0.28 : 0.56 + h2 * 0.34;
        out.push({
          layer: "over",
          texture: isPetal ? "petal" : "sparkle",
          blend: isPetal ? "normal" : "add",
          x,
          y,
          scaleX: scale,
          scaleY: isPetal
            ? scale * (0.72 + 0.28 * Math.abs(Math.cos(t * 0.035 + h3 * 6.28)))
            : scale,
          rotation: isPetal ? t * (0.014 + h3 * 0.016) + h0 * Math.PI * 2 : 0,
          alpha: clamp01(isPetal ? 0.6 + twinkle * 0.26 : 0.48 + twinkle * 0.38),
          tint: pickTint(SANCTUARY_FESTIVAL_TINTS, i),
        });
      }
    }
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

  if (areaId === "bay" || areaId === "trail" || areaId === "boardwalk") {
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
      } else if (areaId === "boardwalk") {
        if (i < 5) {
          x = 760 + h0 * 440;
          y = 140 + h1 * 230;
        } else if (i < 9) {
          x = 1320 + h0 * 640;
          y = 45 + h1 * 145;
        } else {
          x = 1980 + h0 * 480;
          y = 650 + h1 * 360;
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

  if (areaId === "island") {
    // Emissive golden Lighthouse Beacon Halo pulsing softly at the brass lantern (1260, 152).
    const pulse = Math.sin(tick * 0.032);
    const outerPulse = Math.sin(tick * 0.022 + 1.1);
    out.push({
      layer: "emissive",
      texture: "softGlow",
      blend: "add",
      x: 1260,
      y: 152,
      scaleX: 2.35 + 0.16 * outerPulse,
      scaleY: 2.15 + 0.14 * outerPulse,
      rotation: 0,
      alpha: clamp01(0.28 + 0.07 * (0.5 + 0.5 * outerPulse)),
      tint: pickTint(ISLAND_BEACON_TINTS, 1),
    });
    out.push({
      layer: "emissive",
      texture: "softGlow",
      blend: "add",
      x: 1260,
      y: 152,
      scaleX: 1.25 + 0.1 * pulse,
      scaleY: 1.15 + 0.08 * pulse,
      rotation: 0,
      alpha: clamp01(0.42 + 0.1 * (0.5 + 0.5 * pulse)),
      tint: pickTint(ISLAND_BEACON_TINTS, 0),
    });
    // 14 shimmering turquoise bay water glints around the island shoreline & NW tide pool.
    ISLAND_SHORE_GLINTS.forEach(([gx, gy], i) => {
      const h2 = hash01(seed + i * 29 + 3);
      const shimmer = Math.sin(tick * (0.055 + h2 * 0.04) + i * 1.5);
      const scale = i >= 10 ? 0.36 + h2 * 0.28 : 0.48 + h2 * 0.42;
      out.push({
        layer: "under",
        texture: "waterGlint",
        blend: "add",
        x: gx + Math.sin(tick * 0.022 + i) * (i >= 10 ? 3 : 6),
        y: gy,
        scaleX: scale,
        scaleY: scale * 0.85,
        rotation: 0,
        alpha: clamp01(0.14 + shimmer * shimmer * 0.44),
        tint: pickTint(WATER_TINTS, i),
      });
    });
    // 10 sunlit drifting coastal sparkle/sea-breeze motes.
    addFloatingMotes(out, seed + 540, width, height, tick, 10, WATER_TINTS, {
      driftX: -0.28,
      driftY: 0.06,
      minScale: 0.2,
      maxScale: 0.38,
      minAlpha: 0.18,
      maxAlpha: 0.44,
    });
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

  return evaluateWildsBiomeAtmosphere(areaId, width, height, rawTick, options);
}
