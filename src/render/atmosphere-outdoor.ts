import {
  addFloatingMotes,
  addMistRibbons,
  areaSeed,
  BLOSSOM_TINTS,
  BUTTERFLY_TINTS,
  CAVERN_CRYSTALS,
  CAVERN_EDGE_SHADOWS,
  CAVERN_LANTERNS,
  CAVERN_MOTE_TINTS,
  CAVERN_STEP_RINGS,
  clamp01,
  ENCHANTED_FAIRIES,
  FIREFLY_TINTS,
  FOREST_MOTE_TINTS,
  hash01,
  LILAC_TINTS,
  MEADOW_AREAS,
  MEADOW_TINTS,
  pickTint,
  PLAZA_ARCHES,
  PLAZA_STAR_GLOW_TINTS,
  SNOW_TINTS,
  WATER_TINTS,
  wrap,
  type AtmosphereOptions,
  type AtmosphereParticle,
} from "./atmosphere-shared";

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

  return null;
}
