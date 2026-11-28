import {
  addBoundedSparkles,
  addFloatingMotes,
  ARCADE_MOTE_TINTS,
  areaSeed,
  ART_PALETTE_TINTS,
  CAFE_MOTE_TINTS,
  clamp01,
  CLUBHOUSE_BLOOM_TINTS,
  COTTAGE_MOTE_TINTS,
  hash01,
  HEARTH_MOTE_TINTS,
  INDOOR_SUNLIT,
  MARKET_MOTE_TINTS,
  MARKET_ORCHARD_TINTS,
  MILO_MOTE_TINTS,
  MUSIC_HARMONY_TINTS,
  PARLOR_MOTE_TINTS,
  PARLOR_SUNDAE_TINTS,
  pickTint,
  ROSIE_MOTE_TINTS,
  SUNLIT_MOTE_TINTS,
  wrap,
  type AtmosphereOptions,
  type AtmosphereParticle,
} from "./atmosphere-shared";

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

  if (areaId === "milo-house") {
    // 2 soft sunlit arched-window beams slanting across Milo's floorboards.
    const beams: readonly [number, number, number][] = [
      [395, 365, 1.85],
      [465, 435, 1.65],
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
        tint: 0xfff4d6,
      });
    });
    // 10 gentle floating stardust and sunlit sketch-loft motes.
    addFloatingMotes(out, seed + 665, width, height, tick, 10, MILO_MOTE_TINTS, {
      marginX: 190,
      marginY: 200,
      driftX: 0.07,
      driftY: -0.06,
      minScale: 0.16,
      maxScale: 0.32,
      minAlpha: 0.16,
      maxAlpha: 0.4,
    });
    return out;
  }

  if (areaId === "rosie-cottage") {
    // 2 warm floral-window sunbeams streaming across Rosie's flower cottage.
    const beams: readonly [number, number, number][] = [
      [400, 355, 1.85],
      [465, 425, 1.65],
    ];
    beams.forEach(([bx, by, scale], i) => {
      const alpha = 0.06 + 0.008 * Math.sin(tick * 0.017 + i * 2.2);
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
        tint: 0xfff5dc,
      });
    });
    // 10 soft pastel petal and sunbeam motes drifting through the flower cottage.
    addFloatingMotes(out, seed + 670, width, height, tick, 10, ROSIE_MOTE_TINTS, {
      marginX: 190,
      marginY: 200,
      driftX: 0.06,
      driftY: -0.07,
      minScale: 0.17,
      maxScale: 0.33,
      minAlpha: 0.17,
      maxAlpha: 0.41,
    });
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
    if (areaId === "music" && options?.musicRoomHarmony === true) {
      // 5 warm golden-lavender acoustic sparkles drifting above the piano & chimes.
      addBoundedSparkles(out, seed, tick, options.reducedMotion === true, {
        count: 5,
        tints: MUSIC_HARMONY_TINTS,
        blend: "normal",
        minX: 420,
        spanX: 440,
        minY: 240,
        spanY: 180,
        minAlpha: 0.24,
        alphaSpan: 0.18,
        minScale: 0.42,
        scaleSpan: 0.22,
        stride: 79,
      });
    }
    if (areaId === "art-room" && options?.artRoomPaletteGlow === true) {
      // 5 pastel watercolor-palette sparkles floating softly inside the skylight studio.
      addBoundedSparkles(out, seed, tick, options.reducedMotion === true, {
        count: 5,
        tints: ART_PALETTE_TINTS,
        blend: "normal",
        minX: 360,
        spanX: 500,
        minY: 230,
        spanY: 210,
        minAlpha: 0.24,
        alphaSpan: 0.18,
        minScale: 0.42,
        scaleSpan: 0.22,
        stride: 83,
      });
    }
    return out;
  }

  return null;
}
