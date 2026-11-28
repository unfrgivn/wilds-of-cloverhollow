import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadContent } from "../../src/content/load";
import {
  COZY_WEATHER_MODES,
  WEATHER_CYCLE_TICKS,
  isCozyWeatherMode,
  weatherBiomeForArea,
  weatherEffects,
  weatherForArea,
  weatherLabel,
  weatherModeLabel,
  type CozyWeatherKind,
  type CozyWeatherMode,
  type WeatherBiome,
} from "../../src/core/weather";
import {
  WEATHER_PREF_KEY,
  createWeatherPrefsController,
  parseCozyWeatherMode,
  serializeCozyWeatherMode,
} from "../../src/platform/weather-prefs";
import { evaluateAtmosphere } from "../../src/render/atmosphere-recipes";
import {
  RAINBOW_ARC_TINTS,
  evaluateWeatherParticles,
} from "../../src/render/weather-particles";
import { weatherEmblemMarkup } from "../../src/ui/journal-weather";
import { importErrors, stripComments, stripStringLiterals } from "../../tools/purity";

describe("Milestone 183: Dynamic Cozy Weather Engine & Valley Sky Almanac (Track E17)", () => {
  const { world } = loadContent();

  it("maps all 35 playable areas plus harness accurately and keeps interiors sheltered", () => {
    const expectedBiomes: Record<string, WeatherBiome> = {
      plaza: "town",
      park: "town",
      field: "town",
      lane: "town",
      crossing: "town",
      hills: "town",
      sanctuary: "town",
      woods: "woods",
      bay: "coast",
      trail: "coast",
      boardwalk: "coast",
      island: "coast",
      pass: "alpine",
      summit: "alpine",
      mist: "enchanted",
      enchanted: "enchanted",
      bedroom: "indoor",
      kitchen: "indoor",
      school: "indoor",
      "east-hall": "indoor",
      classroom: "indoor",
      gym: "indoor",
      music: "indoor",
      "art-room": "indoor",
      arcade: "indoor",
      clubhouse: "indoor",
      lodge: "indoor",
      cafe: "indoor",
      market: "indoor",
      parlor: "indoor",
      "sue-cottage": "indoor",
      "jordan-cabin": "indoor",
      "milo-house": "indoor",
      "rosie-cottage": "indoor",
      cavern: "indoor",
    };

    const playableIds = Object.keys(world.areas).filter((id) => id !== "harness").sort();
    expect(playableIds).toEqual(Object.keys(expectedBiomes).sort());
    expect(playableIds).toHaveLength(35);

    for (const [areaId, biome] of Object.entries(expectedBiomes)) {
      expect(weatherBiomeForArea(areaId), areaId).toBe(biome);
      if (biome === "indoor") {
        for (const mode of COZY_WEATHER_MODES) {
          const info = weatherForArea(areaId, WEATHER_CYCLE_TICKS * 2, mode);
          expect(info.kind).toBe("clear");
          expect(info.label).toBe("Sheltered & Cozy");
          expect(info.biome).toBe("indoor");
          expect(info.hasRainbow).toBe(false);
        }
      }
    }

    expect(weatherBiomeForArea("harness")).toBe("indoor");
    expect(weatherBiomeForArea("unknown-future-room")).toBe("indoor");
  });

  it("resolves deterministic auto biome schedules, explicit modes, and passive effects", () => {
    expect(WEATHER_CYCLE_TICKS).toBe(3600);
    expect(COZY_WEATHER_MODES).toEqual([
      "clear",
      "auto",
      "sunshower",
      "breeze-petals",
      "snow-flurry",
      "twilight-fireflies",
    ]);

    const cycleAt = (areaId: string, stepIndex: number): CozyWeatherKind =>
      weatherForArea(areaId, stepIndex * WEATHER_CYCLE_TICKS + 12, "auto").kind;

    expect([0, 1, 2, 3, 4].map((i) => cycleAt("plaza", i))).toEqual([
      "clear",
      "breeze-petals",
      "sunshower",
      "twilight-fireflies",
      "clear",
    ]);
    expect([0, 1, 2, 3].map((i) => cycleAt("woods", i))).toEqual([
      "clear",
      "twilight-fireflies",
      "sunshower",
      "breeze-petals",
    ]);
    expect([0, 1, 2, 3].map((i) => cycleAt("bay", i))).toEqual([
      "clear",
      "sunshower",
      "breeze-petals",
      "twilight-fireflies",
    ]);
    expect([0, 1, 2, 3].map((i) => cycleAt("pass", i))).toEqual([
      "clear",
      "snow-flurry",
      "breeze-petals",
      "twilight-fireflies",
    ]);
    expect([0, 1, 2, 3].map((i) => cycleAt("enchanted", i))).toEqual([
      "clear",
      "twilight-fireflies",
      "breeze-petals",
      "clear",
    ]);

    // Explicit mode overrides any outdoor biome immediately.
    const sunshower = weatherForArea("plaza", 0, "sunshower");
    expect(sunshower.kind).toBe("sunshower");
    expect(sunshower.hasRainbow).toBe(true);
    expect(sunshower.effects.fishBiteBonus).toBe(0.15);
    expect(sunshower.effects.gardenDewBonus).toBe(1);
    expect(weatherLabel("sunshower")).toBe("Rainbow Sunshower");
    expect(weatherModeLabel("auto")).toBe("Auto Cycle");
    expect(weatherModeLabel("snow-flurry")).toBe("Snow Flurry");
    expect(weatherEffects("snow-flurry").fishBiteBonus).toBeGreaterThan(0);
    expect(weatherForArea("plaza", -500, "auto").kind).toBe("clear");
    expect(isCozyWeatherMode("sunshower")).toBe(true);
    expect(isCozyWeatherMode("hurricane")).toBe(false);
  });

  it("evaluates weather particles, 5-band rainbow arc, and strict reducedMotion parity", () => {
    const width = 1750;
    const height = 1100;

    expect(evaluateWeatherParticles("clear", width, height, 120)).toEqual([]);

    const sunshower = evaluateWeatherParticles("sunshower", width, height, 120, false);
    expect(sunshower).toHaveLength(42);
    const rain = sunshower.filter((p) => p.layer === "over" && p.texture === "mistWisp");
    const ripples = sunshower.filter((p) => p.layer === "under" && p.texture === "sparkle");
    const rainbow = sunshower.filter((p) => p.layer === "emissive" && p.texture === "softGlow");
    expect(rain).toHaveLength(16);
    expect(ripples).toHaveLength(6);
    expect(rainbow).toHaveLength(20);
    for (const streak of rain) {
      expect(streak.scaleX).toBe(0.48);
      expect(streak.scaleY).toBe(0.14);
      expect(streak.rotation).toBe(1.18);
      expect(streak.alpha).toBeGreaterThanOrEqual(0.36);
      expect(streak.alpha).toBeLessThanOrEqual(0.52);
    }
    for (const arc of rainbow) {
      expect(arc.x).toBeGreaterThanOrEqual(width * 0.24 - 0.01);
      expect(arc.x).toBeLessThanOrEqual(width * 0.76 + 0.01);
      expect(arc.y).toBeGreaterThanOrEqual(height * 0.14 - 0.01);
      expect(arc.y).toBeLessThanOrEqual(height * 0.34 + 0.01);
      expect(arc.alpha).toBeGreaterThanOrEqual(0.22);
      expect(arc.alpha).toBeLessThanOrEqual(0.34);
    }
    expect(new Set(rainbow.map((p) => p.tint))).toEqual(new Set(RAINBOW_ARC_TINTS));

    const snow = evaluateWeatherParticles("snow-flurry", width, height, 90, false);
    expect(snow).toHaveLength(20);
    expect(snow.filter((p) => p.texture === "puff")).toHaveLength(10);
    expect(snow.filter((p) => p.texture === "sparkle")).toHaveLength(10);

    const petals = evaluateWeatherParticles("breeze-petals", width, height, 90, false);
    expect(petals).toHaveLength(14);
    expect(petals.every((p) => p.texture === "petal")).toBe(true);

    const fireflies = evaluateWeatherParticles("twilight-fireflies", width, height, 90, false);
    expect(fireflies).toHaveLength(14);
    expect(fireflies.every((p) => p.layer === "emissive")).toBe(true);

    // Reduced Motion: zero rotation and tick-invariant output across all weather kinds.
    const activeKinds: readonly CozyWeatherKind[] = [
      "sunshower",
      "snow-flurry",
      "breeze-petals",
      "twilight-fireflies",
    ];
    for (const kind of activeKinds) {
      const a = evaluateWeatherParticles(kind, width, height, 0, true);
      const b = evaluateWeatherParticles(kind, width, height, 720, true);
      expect(a).toEqual(b);
      expect(a.every((p) => p.rotation === 0), kind).toBe(true);
    }

    // Atmosphere integration: clear adds 0 particles, sunshower adds exactly +42.
    const base = evaluateAtmosphere("plaza", width, height, 60);
    expect(evaluateAtmosphere("plaza", width, height, 60, { weather: "clear" })).toEqual(base);
    expect(
      evaluateAtmosphere("plaza", width, height, 60, { weather: "sunshower" }),
    ).toHaveLength(base.length + 42);
  });

  it("persists weather preferences resiliently and notifies live subscribers", async () => {
    expect(parseCozyWeatherMode(null)).toBe("clear");
    expect(parseCozyWeatherMode("")).toBe("clear");
    expect(parseCozyWeatherMode("{not-json")).toBe("clear");
    expect(parseCozyWeatherMode('{"mode":"tornado"}')).toBe("clear");
    expect(parseCozyWeatherMode("sunshower")).toBe("sunshower");
    expect(parseCozyWeatherMode(serializeCozyWeatherMode("twilight-fireflies"))).toBe(
      "twilight-fireflies",
    );

    const backing = new Map<string, string>();
    const adapter = {
      get: async (key: string): Promise<string | null> => backing.get(key) ?? null,
      set: async (key: string, value: string): Promise<void> => {
        backing.set(key, value);
      },
    };

    const first = createWeatherPrefsController(adapter, { syncDom: false });
    await first.ready;
    expect(first.get()).toBe("clear");

    const seen: CozyWeatherMode[] = [];
    const unsubscribe = first.subscribe((mode) => seen.push(mode));
    first.set("sunshower");
    first.set("auto");
    unsubscribe();
    first.set("snow-flurry");
    expect(seen).toEqual(["sunshower", "auto"]);
    expect(first.get()).toBe("snow-flurry");

    // Flush queued persistence write, then hydrate a fresh controller from storage.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(backing.get(WEATHER_PREF_KEY)).toBe(serializeCozyWeatherMode("snow-flurry"));

    const second = createWeatherPrefsController(adapter, { syncDom: false });
    await second.ready;
    expect(second.get()).toBe("snow-flurry");
  });

  it("preserves core purity, zero SVG <text>, and line budgets on all touched src/ files", () => {
    const coreSource = readFileSync("src/core/weather.ts", "utf8");
    const stripped = stripComments(coreSource);
    expect(importErrors("src/core/weather.ts", stripped)).toEqual([]);
    expect(stripStringLiterals(stripped)).not.toMatch(
      /\b(window|document|PIXI|Date|performance|Math\.random)\b/,
    );

    for (const mode of COZY_WEATHER_MODES) {
      const markup = weatherEmblemMarkup(mode);
      expect(markup.length).toBeGreaterThan(40);
      expect(markup).not.toContain("<text");
      expect(markup).toContain("#47321f");
    }

    const lineLimits: readonly [string, number][] = [
      ["src/core/weather.ts", 1000],
      ["src/render/weather-particles.ts", 1000],
      ["src/platform/weather-prefs.ts", 1000],
      ["src/render/atmosphere-shared.ts", 1000],
      ["src/render/atmosphere-recipes.ts", 1000],
      ["src/render/view.ts", 900],
      ["src/ui/journal-weather.ts", 260],
      ["src/ui/journal-weather.css", 1000],
      ["src/ui/journal-field-note.ts", 980],
    ];
    for (const [file, maxLines] of lineLimits) {
      const lines = readFileSync(file, "utf8").split("\n").length;
      expect(lines, `${file} must remain under ${maxLines} lines`).toBeLessThan(maxLines);
    }
  });
});
