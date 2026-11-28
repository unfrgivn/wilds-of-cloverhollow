import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { CozyWeatherKind, CozyWeatherMode } from "../../src/core/weather";
import {
  evaluateBattleWeather,
  type BattleWeatherTexture,
} from "../../src/render/battle-weather";
import { RAINBOW_ARC_TINTS } from "../../src/render/weather-particles";

const OUTDOOR_AREAS = ["plaza", "bay", "pass", "woods"] as const;
const INDOOR_AREAS = ["gym", "arcade", "school", "cavern", "lodge", "art-room"] as const;
const ACTIVE_MODES: readonly Exclude<CozyWeatherKind, "clear">[] = [
  "sunshower",
  "snow-flurry",
  "breeze-petals",
  "twilight-fireflies",
];
const EXPECTED_COUNTS: Readonly<Record<Exclude<CozyWeatherKind, "clear">, number>> = {
  sunshower: 28,
  "snow-flurry": 18,
  "breeze-petals": 14,
  "twilight-fireflies": 14,
};
const VALID_TEXTURES: ReadonlySet<BattleWeatherTexture> = new Set([
  "mistWisp",
  "sparkle",
  "softGlow",
  "puff",
  "petal",
]);

describe("Milestone 215: Live Dynamic Cozy Weather on the Battle Stage", () => {
  it("keeps clear mode and all sheltered indoor battle areas at 0 particles", () => {
    for (const area of OUTDOOR_AREAS) {
      expect(evaluateBattleWeather(area, 1280, 720, 120, "clear", false)).toEqual({
        kind: "clear",
        particles: [],
      });
    }

    const modes: readonly CozyWeatherMode[] = [
      "clear",
      "auto",
      "sunshower",
      "snow-flurry",
      "breeze-petals",
      "twilight-fireflies",
    ];
    for (const indoor of INDOOR_AREAS) {
      for (const mode of modes) {
        const frame = evaluateBattleWeather(indoor, 1280, 720, 4200, mode, false);
        expect(frame, `${indoor} under ${mode}`).toEqual({ kind: "clear", particles: [] });
      }
    }

    expect(evaluateBattleWeather("plaza", 0, 720, 60, "sunshower", false).particles).toEqual([]);
    expect(evaluateBattleWeather("plaza", 1280, 0, 60, "sunshower", false).particles).toEqual([]);
  });

  it("emits bounded, tasteful particles for all 4 active weather kinds on outdoor stages", () => {
    const width = 1280;
    const height = 720;

    for (const area of OUTDOOR_AREAS) {
      for (const mode of ACTIVE_MODES) {
        const frame = evaluateBattleWeather(area, width, height, 180, mode, false);
        expect(frame.kind).toBe(mode);
        expect(frame.particles).toHaveLength(EXPECTED_COUNTS[mode]);

        for (const p of frame.particles) {
          expect(VALID_TEXTURES.has(p.texture)).toBe(true);
          expect(["normal", "add"]).toContain(p.blend);
          expect(Number.isFinite(p.x) && p.x >= 0 && p.x <= width).toBe(true);
          expect(Number.isFinite(p.y) && p.y >= 0 && p.y <= height).toBe(true);
          expect(Number.isFinite(p.scaleX) && p.scaleX > 0).toBe(true);
          expect(Number.isFinite(p.scaleY) && p.scaleY > 0).toBe(true);
          expect(Number.isFinite(p.rotation)).toBe(true);
          expect(Number.isFinite(p.alpha) && p.alpha > 0 && p.alpha <= 1).toBe(true);
          expect(Number.isInteger(p.tint) && p.tint >= 0 && p.tint <= 0xffffff).toBe(true);
        }
      }
    }

    // Verify Sunshower splits cleanly into 14 rainbow lobes + 14 diagonal rain streaks.
    const sun = evaluateBattleWeather("plaza", width, height, 120, "sunshower", false);
    const rainbow = sun.particles.filter((p) => p.texture === "softGlow");
    const rain = sun.particles.filter((p) => p.texture === "mistWisp");
    expect(rainbow).toHaveLength(14);
    expect(rain).toHaveLength(14);
    const seenRainbowTints = new Set(rainbow.map((p) => p.tint));
    for (const tint of RAINBOW_ARC_TINTS) {
      expect(seenRainbowTints.has(tint)).toBe(true);
    }
    for (const lobe of rainbow) {
      expect(lobe.blend).toBe("normal");
      expect(lobe.x).toBeGreaterThanOrEqual(width * 0.2 - 0.01);
      expect(lobe.x).toBeLessThanOrEqual(width * 0.8 + 0.01);
      expect(lobe.y).toBeGreaterThanOrEqual(height * 0.14 - 0.01);
      expect(lobe.y).toBeLessThanOrEqual(height * 0.28 + 0.01);
      expect(lobe.alpha).toBeGreaterThanOrEqual(0.24);
      expect(lobe.alpha).toBeLessThanOrEqual(0.34);
    }
    for (const drop of rain) {
      expect(drop.blend).toBe("normal");
      expect([0x9ad8f5, 0xc4ecff]).toContain(drop.tint);
      expect(drop.rotation).toBeCloseTo(1.18, 5);
      expect(drop.alpha).toBeGreaterThanOrEqual(0.3);
      expect(drop.alpha).toBeLessThanOrEqual(0.46);
    }

    // Verify Snow Flurry frost crystals.
    const snow = evaluateBattleWeather("pass", width, height, 120, "snow-flurry", false);
    expect(snow.particles.every((p) => p.texture === "puff" || p.texture === "sparkle")).toBe(true);
    expect(snow.particles.every((p) => [0xffffff, 0xd8f0ff, 0xe8f6ff].includes(p.tint))).toBe(true);
    expect(snow.particles.every((p) => p.alpha >= 0.48 && p.alpha <= 0.76)).toBe(true);

    // Verify Blossom Breeze petals.
    const petals = evaluateBattleWeather("bay", width, height, 120, "breeze-petals", false);
    expect(petals.particles.every((p) => p.texture === "petal" && p.blend === "normal")).toBe(true);
    expect(
      petals.particles.every((p) => [0xffb8d0, 0xfff0b8, 0xb8f0cc, 0xd8c4ff].includes(p.tint)),
    ).toBe(true);
    expect(petals.particles.every((p) => p.alpha >= 0.52 && p.alpha <= 0.76)).toBe(true);

    // Verify Twilight Fireflies warm lanterns in y = 0.22..0.72 * height.
    const fireflies = evaluateBattleWeather(
      "woods", width, height, 120, "twilight-fireflies", false,
    );
    expect(
      fireflies.particles.every(
        (p) => (p.texture === "softGlow" || p.texture === "sparkle") && p.blend === "normal",
      ),
    ).toBe(true);
    expect(
      fireflies.particles.every((p) => [0xf5d64a, 0xa8e862, 0xffe066].includes(p.tint)),
    ).toBe(true);
    for (const lantern of fireflies.particles) {
      expect(lantern.y).toBeGreaterThanOrEqual(height * 0.22 - 0.01);
      expect(lantern.y).toBeLessThanOrEqual(height * 0.72 + 0.01);
    }
  });

  it("enforces reducedMotion parity (rotation 0 and tick-invariant positions/alphas)", () => {
    for (const mode of ACTIVE_MODES) {
      const a = evaluateBattleWeather("plaza", 1280, 720, 0, mode, true);
      const b = evaluateBattleWeather("plaza", 1280, 720, 419, mode, true);
      expect(a).toEqual(b);
      expect(a.particles).toHaveLength(EXPECTED_COUNTS[mode]);
      for (const p of a.particles) {
        expect(p.rotation, `${mode} particle rotation`).toBe(0);
      }
    }
  });

  it("keeps battle-weather.ts pure zero-Pixi/zero-DOM and files under line caps", () => {
    const weatherSrc = readFileSync("src/render/battle-weather.ts", "utf8");
    expect(weatherSrc).not.toMatch(/pixi\.js/);
    expect(weatherSrc).not.toMatch(/\b(document|window)\b/);
    expect(weatherSrc).not.toMatch(/\bMath\.random\b/);
    expect(weatherSrc).not.toMatch(/\bDate\b/);

    const caps: readonly [string, number][] = [
      ["src/render/battle-weather.ts", 260],
      ["src/render/battle-stage-render.ts", 500],
      ["src/render/battle-view.ts", 700],
      ["src/dev/hook.ts", 500],
    ];
    for (const [file, cap] of caps) {
      const lines = readFileSync(file, "utf8").split("\n").length;
      expect(lines, `${file} (${lines} lines) must stay < ${cap}`).toBeLessThan(cap);
    }
  });
});
