import { describe, expect, test } from "vitest";
import type { AmbienceBed } from "../../src/core";
import { ambiencePan } from "../../src/platform/ambience";
import { phraseDynamics, VOICE_PAN } from "../../src/platform/music";
import { scores, type InstrumentVoice } from "../../src/platform/scores";

const ALL_VOICES: readonly InstrumentVoice[] = [
  "piano",
  "celesta",
  "marimba",
  "harp",
  "flute",
  "bass",
  "pad",
  "chip",
  "shaker",
  "woodblock",
];

const ANCHOR_VOICES: readonly InstrumentVoice[] = ["bass", "woodblock", "shaker", "chip", "pad"];
const PLUCK_VOICES: readonly InstrumentVoice[] = ["harp", "piano", "marimba", "celesta", "flute"];

const ALL_BEDS: readonly AmbienceBed[] = [
  "none",
  "town-breeze",
  "ocean",
  "mountain-wind",
  "hearth",
  "forest",
  "enchanted-shimmer",
  "arcade-hum",
  "cavern-drips",
  "cafe-murmur",
];

const SPATIALIZED_BEDS: readonly Exclude<AmbienceBed, "none">[] = [
  "forest",
  "cavern-drips",
  "cafe-murmur",
  "hearth",
  "ocean",
  "town-breeze",
  "enchanted-shimmer",
  "mountain-wind",
  "arcade-hum",
];

describe("Milestone 109: Stereo Chamber Soundstage & Expressive Phrasing", () => {
  test("VOICE_PAN is exhaustive, finite, bounded in [-0.4, 0.4], and stereo-balanced", () => {
    expect(Object.keys(VOICE_PAN).sort()).toEqual([...ALL_VOICES].sort());
    expect(VOICE_PAN).toEqual({
      bass: 0,
      pad: 0,
      chip: 0,
      flute: -0.08,
      marimba: 0.18,
      piano: -0.22,
      woodblock: 0.26,
      shaker: -0.28,
      celesta: 0.32,
      harp: -0.34,
    });

    let leftCount = 0;
    let centerCount = 0;
    let rightCount = 0;
    for (const voice of ALL_VOICES) {
      const pan = VOICE_PAN[voice];
      expect(Number.isFinite(pan), `${voice} finite`).toBe(true);
      expect(pan, `${voice} >= -0.4`).toBeGreaterThanOrEqual(-0.4);
      expect(pan, `${voice} <= 0.4`).toBeLessThanOrEqual(0.4);
      if (pan < 0) leftCount += 1;
      else if (pan > 0) rightCount += 1;
      else centerCount += 1;
    }
    expect(leftCount).toBeGreaterThan(0);
    expect(centerCount).toBeGreaterThan(0);
    expect(rightCount).toBeGreaterThan(0);
  });

  test("phraseDynamics is deterministic with smooth 16-step phrase breath", () => {
    const first = phraseDynamics(4, 256, 1, "harp", 64);
    const second = phraseDynamics(4, 256, 1, "harp", 64);
    expect(first).toEqual(second);

    let minGain = Infinity;
    let maxGain = -Infinity;
    for (let step = 0; step < 64; step += 1) {
      const dyn = phraseDynamics(step, 256, 0, "flute", 72);
      expect(dyn.gainScale).toBeGreaterThanOrEqual(0.92);
      expect(dyn.gainScale).toBeLessThanOrEqual(1.07);
      minGain = Math.min(minGain, dyn.gainScale);
      maxGain = Math.max(maxGain, dyn.gainScale);
    }
    expect(minGain).toBeCloseTo(0.92, 4);
    expect(maxGain).toBeCloseTo(1.07, 4);
    // Repeats smoothly every 16 steps.
    expect(phraseDynamics(3, 256, 0, "piano", 60).gainScale).toBeCloseTo(
      phraseDynamics(19, 256, 0, "piano", 60).gainScale,
      8,
    );
  });

  test("phraseDynamics locks anchor micro-timing to 0 and rolls melodic plucks within 8 ms", () => {
    for (const voice of ANCHOR_VOICES) {
      for (const step of [0, 3, 7, 15, 32]) {
        for (const midi of [36, 48, 60, 72]) {
          expect(phraseDynamics(step, 256, 0, voice, midi).microDelaySec).toBe(0);
        }
      }
    }

    for (const voice of PLUCK_VOICES) {
      const chordDelays = new Set<number>();
      for (const midi of [60, 64, 67, 71]) {
        const delay = phraseDynamics(8, 256, 0, voice, midi).microDelaySec;
        expect(delay, `${voice} >= 0`).toBeGreaterThanOrEqual(0);
        expect(delay, `${voice} <= 0.008`).toBeLessThanOrEqual(0.008);
        chordDelays.add(delay);
      }
      expect(chordDelays.size, `${voice} rolls chord pitches`).toBeGreaterThan(1);
    }
  });

  test("phraseDynamics triggers loop-2+ octave shimmer only on harp/piano downbeats <= 76", () => {
    const totalSteps = 256;
    const halfStep = Math.floor(totalSteps / 2);

    // Loop 0 never shimmers.
    expect(phraseDynamics(0, totalSteps, 0, "harp", 60).sparkleMidi).toBeNull();
    expect(phraseDynamics(halfStep, totalSteps, 0, "piano", 64).sparkleMidi).toBeNull();

    // Loop 1+ shimmers on bar 1 and bar 9 downbeats for harp/piano <= 76.
    expect(phraseDynamics(0, totalSteps, 1, "harp", 60).sparkleMidi).toBe(72);
    expect(phraseDynamics(halfStep, totalSteps, 1, "piano", 76).sparkleMidi).toBe(88);
    expect(phraseDynamics(0, totalSteps, 3, "piano", 55).sparkleMidi).toBe(67);

    // Notes above 76 do not shimmer.
    expect(phraseDynamics(0, totalSteps, 1, "harp", 77).sparkleMidi).toBeNull();
    expect(phraseDynamics(halfStep, totalSteps, 2, "piano", 84).sparkleMidi).toBeNull();

    // Off-downbeat steps do not shimmer.
    expect(phraseDynamics(1, totalSteps, 1, "harp", 60).sparkleMidi).toBeNull();
    expect(phraseDynamics(16, totalSteps, 1, "piano", 60).sparkleMidi).toBeNull();
    expect(phraseDynamics(halfStep + 1, totalSteps, 1, "harp", 60).sparkleMidi).toBeNull();

    // Other voices do not shimmer.
    for (const voice of ALL_VOICES) {
      if (voice === "harp" || voice === "piano") continue;
      expect(phraseDynamics(0, totalSteps, 1, voice, 60).sparkleMidi).toBeNull();
      expect(phraseDynamics(halfStep, totalSteps, 1, voice, 60).sparkleMidi).toBeNull();
    }
  });

  test("phraseDynamics stays finite and bounded across every note of all 24 scores", () => {
    let loop2Sparkles = 0;
    for (const [id, score] of Object.entries(scores)) {
      const totalSteps = score.stepsPerBar * score.bars;
      for (const track of score.tracks) {
        for (const [step, midi] of track.notes) {
          const d0 = phraseDynamics(Math.floor(step), totalSteps, 0, track.voice, midi);
          const d1 = phraseDynamics(Math.floor(step), totalSteps, 1, track.voice, midi);
          expect(d0.gainScale, `${id} gain >= 0.9`).toBeGreaterThanOrEqual(0.9);
          expect(d0.gainScale, `${id} gain <= 1.1`).toBeLessThanOrEqual(1.1);
          expect(d0.microDelaySec, `${id} delay >= 0`).toBeGreaterThanOrEqual(0);
          expect(d0.microDelaySec, `${id} delay <= 0.009`).toBeLessThanOrEqual(0.009);
          expect(d0.sparkleMidi, `${id} loop 0 no sparkle`).toBeNull();
          if (d1.sparkleMidi !== null) {
            expect(d1.sparkleMidi).toBe(Math.trunc(midi) + 12);
            loop2Sparkles += 1;
          }
        }
      }
    }
    expect(loop2Sparkles).toBeGreaterThan(0);
  });

  test("ambiencePan is deterministic, bounded in [-0.55, 0.55], and spans stereo field", () => {
    for (const seed of [-3, 0, 1, 7, 42, Number.NaN]) {
      expect(ambiencePan("none", seed)).toBe(0);
    }

    for (const bed of ALL_BEDS) {
      for (let seed = 0; seed < 24; seed += 1) {
        const pan = ambiencePan(bed, seed);
        expect(pan).toBe(ambiencePan(bed, seed));
        expect(Number.isFinite(pan), `${bed}:${seed} finite`).toBe(true);
        expect(pan, `${bed}:${seed} >= -0.55`).toBeGreaterThanOrEqual(-0.55);
        expect(pan, `${bed}:${seed} <= 0.55`).toBeLessThanOrEqual(0.55);
      }
    }

    for (const bed of SPATIALIZED_BEDS) {
      const samples = Array.from({ length: 12 }, (_, seed) => ambiencePan(bed, seed));
      const hasLeft = samples.some((pan) => pan < 0);
      const hasRight = samples.some((pan) => pan > 0);
      expect(hasLeft, `${bed} has left placement`).toBe(true);
      expect(hasRight, `${bed} has right placement`).toBe(true);
      expect(new Set(samples).size, `${bed} varies across seeds`).toBeGreaterThanOrEqual(6);
    }
  });
});
