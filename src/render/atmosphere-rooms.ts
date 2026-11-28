import {
  addBoundedSparkles,
  addFloatingMotes,
  areaSeed,
  ART_PALETTE_TINTS,
  clamp01,
  CLUBHOUSE_BLOOM_TINTS,
  COTTAGE_MOTE_TINTS,
  hash01,
  INDOOR_SUNLIT,
  MILO_MOTE_TINTS,
  MUSIC_HARMONY_TINTS,
  pickTint,
  ROSIE_MOTE_TINTS,
  SUNLIT_MOTE_TINTS,
  wrap,
  type AtmosphereOptions,
  type AtmosphereParticle,
} from "./atmosphere-shared";

type SunbeamSpec = {
  base: number;
  amp: number;
  freq: number;
  phase: number;
  tint: number;
};

function addSunbeams(
  out: AtmosphereParticle[],
  beams: readonly [number, number, number][],
  tick: number,
  spec: SunbeamSpec,
): void {
  beams.forEach(([bx, by, scale], i) => {
    const alpha = spec.base + spec.amp * Math.sin(tick * spec.freq + i * spec.phase);
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
      tint: spec.tint,
    });
  });
}

/**
 * Pure deterministic atmosphere particle evaluator for friend homes, cottages,
 * cabins, and sunlit school/clubhouse rooms. Returns `null` for other areas.
 */
export function evaluateRoomAtmosphere(
  areaId: string,
  width: number,
  height: number,
  rawTick: number,
  options?: AtmosphereOptions,
): AtmosphereParticle[] | null {
  const tick = options?.reducedMotion === true ? 0 : rawTick;
  const out: AtmosphereParticle[] = [];
  const seed = areaSeed(areaId);

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
    addSunbeams(out, [[420, 355, 1.9], [495, 435, 1.7]], tick, {
      base: 0.058, amp: 0.008, freq: 0.017, phase: 2.1, tint: 0xfff5d6,
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
    addSunbeams(out, [[395, 365, 1.85], [465, 435, 1.65]], tick, {
      base: 0.058, amp: 0.008, freq: 0.017, phase: 2.1, tint: 0xfff4d6,
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
    addSunbeams(out, [[400, 355, 1.85], [465, 425, 1.65]], tick, {
      base: 0.06, amp: 0.008, freq: 0.017, phase: 2.2, tint: 0xfff5dc,
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

  if (INDOOR_SUNLIT.has(areaId)) {
    // 2 subtle diagonal warm window sunbeams + 8 slow floating sunlit dust motes.
    const beams: readonly [number, number, number][] = [
      [width * 0.34, height * 0.38, 1.85],
      [width * 0.62, height * 0.42, 1.75],
    ];
    addSunbeams(out, beams, tick, {
      base: 0.054, amp: 0.007, freq: 0.016, phase: 2.4, tint: 0xfff4d4,
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
