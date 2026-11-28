import { evaluateRoomAtmosphere } from "./atmosphere-rooms";
import {
  addBoundedSparkles,
  addFloatingMotes,
  ARCADE_MOTE_TINTS,
  areaSeed,
  CAFE_MOTE_TINTS,
  clamp01,
  hash01,
  HEARTH_MOTE_TINTS,
  MARKET_MOTE_TINTS,
  MARKET_ORCHARD_TINTS,
  PARLOR_MOTE_TINTS,
  PARLOR_SUNDAE_TINTS,
  pickTint,
  wrap,
  type AtmosphereOptions,
  type AtmosphereParticle,
} from "./atmosphere-shared";

export { evaluateRoomAtmosphere };

/**
 * Pure deterministic atmosphere particle evaluator for indoor and cozy areas.
 * Returns `null` for non-indoor areas so the dispatcher can handle fallbacks.
 */
export function evaluateIndoorAtmosphere(
  areaId: string,
  width: number,
  height: number,
  rawTick: number,
  options?: AtmosphereOptions,
): AtmosphereParticle[] | null {
  const tick = options?.reducedMotion === true ? 0 : rawTick;
  const out: AtmosphereParticle[] = [];
  const seed = areaSeed(areaId);

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

  if (areaId === "market") {
    // 2 warm golden window sunbeams streaming from the NW arched grocery window.
    const beams: readonly [number, number, number][] = [
      [425, 395, 1.9],
      [505, 465, 1.7],
    ];
    beams.forEach(([bx, by, scale], i) => {
      const alpha = 0.06 + 0.008 * Math.sin(tick * 0.017 + i * 2.1);
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
        tint: 0xfff3cb,
      });
    });
    // 10 soft golden produce-stand warmth motes drifting across the market floor.
    addFloatingMotes(out, seed + 655, width, height, tick, 10, MARKET_MOTE_TINTS, {
      marginX: 200,
      marginY: 210,
      driftX: 0.07,
      driftY: -0.08,
      minScale: 0.17,
      maxScale: 0.34,
      minAlpha: 0.17,
      maxAlpha: 0.42,
    });
    if (options?.marketOrchardGlow === true) {
      // 5 soft golden-honey orchard sparkles drifting lazily over Grocer Pippin's produce bins.
      addBoundedSparkles(out, seed, tick, options.reducedMotion === true, {
        count: 5,
        tints: MARKET_ORCHARD_TINTS,
        blend: "normal",
        minX: 420,
        spanX: 260,
        minY: 260,
        spanY: 130,
        minAlpha: 0.24,
        alphaSpan: 0.2,
        minScale: 0.34,
        scaleSpan: 0.18,
        stride: 67,
      });
    }
    return out;
  }

  if (areaId === "parlor") {
    // 2 pastel sunlit window sunbeams streaming from the blue-striped parlor window.
    const beams: readonly [number, number, number][] = [
      [395, 405, 1.85],
      [475, 470, 1.65],
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
        tint: 0xfff8e2,
      });
    });
    // 10 gentle mint-pink parlor shimmer sparkles dancing above the curved gelato case.
    for (let i = 0; i < 10; i += 1) {
      const h0 = hash01(seed + i * 43 + 11);
      const h1 = hash01(seed + i * 43 + 12);
      const h2 = hash01(seed + i * 43 + 13);
      const h3 = hash01(seed + i * 43 + 14);
      const x = 670 + wrap(
        h0 * 410 + tick * (0.06 + h2 * 0.05) + Math.sin(tick * 0.02 + h3 * 6.28) * 10,
        410,
      );
      const y = 360 + wrap(
        h1 * 185 - tick * (0.05 + h3 * 0.04) + Math.cos(tick * 0.018 + h0 * 6.28) * 8,
        185,
      );
      const twinkle = 0.5 + 0.5 * Math.sin(tick * (0.045 + h3 * 0.04) + h1 * Math.PI * 2);
      const scale = 0.18 + h2 * 0.18;
      out.push({
        layer: "over",
        texture: "sparkle",
        blend: "add",
        x,
        y,
        scaleX: scale,
        scaleY: scale,
        rotation: 0,
        alpha: clamp01(0.18 + twinkle * 0.28),
        tint: pickTint(PARLOR_MOTE_TINTS, i),
      });
    }
    if (options?.parlorSundaeSparkle === true) {
      // 5 pastel-berry & mint shimmer sparkles floating above Scooper Penny's gelato display.
      addBoundedSparkles(out, seed, tick, options.reducedMotion === true, {
        count: 5,
        tints: PARLOR_SUNDAE_TINTS,
        blend: "normal",
        minX: 460,
        spanX: 300,
        minY: 250,
        spanY: 130,
        minAlpha: 0.24,
        alphaSpan: 0.2,
        minScale: 0.34,
        scaleSpan: 0.18,
        stride: 71,
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

  return evaluateRoomAtmosphere(areaId, width, height, rawTick, options);
}
