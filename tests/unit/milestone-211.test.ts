import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadContent } from "../../src/content/load";
import { createState, type Battle, type State } from "../../src/core";
import { weatherBiomeForArea, type CozyWeatherKind } from "../../src/core/weather";
import {
  WEATHER_AMBIENCE_SPECS,
  resolveSoundtrackWeather,
  weatherAmbiencePan,
  weatherAmbienceSpec,
} from "../../src/platform/weather-ambience";
import { postcardMetadata, postcardWeatherLabel } from "../../src/ui/postcard";

const content = loadContent();
const newGame = content.fixtures["new-game"];
if (newGame === undefined) throw new Error("Missing new-game fixture");
const baseState = createState(content.world, newGame);

function lineCount(path: string): number {
  return readFileSync(path, "utf8").trimEnd().split("\n").length;
}

function makeStubBattle(): Battle {
  return {
    critterId: "fountain-frog",
    den: null,
    entry: { x: 100, y: 100 },
    phase: "command",
    message: "",
    revealed: 0,
    selected: 0,
    command: null,
    energy: 5,
    calm: 0,
    rest: {},
    check: null,
    lastGrade: null,
    feelings: [],
    answered: false,
    lanternPeek: false,
    turn: 1,
    windUp: null,
    rewardSticker: null,
    phaseTicks: 0,
  };
}

describe("Milestone 211: Dynamic Cozy Weather Acoustic Soundscapes", () => {
  const activeWeathers: readonly Exclude<CozyWeatherKind, "clear">[] = [
    "sunshower",
    "breeze-petals",
    "snow-flurry",
    "twilight-fireflies",
  ];

  it("defines gentle, non-square specs for all 4 active weathers and null for clear", () => {
    expect(weatherAmbienceSpec("clear")).toBeNull();
    expect(Object.keys(WEATHER_AMBIENCE_SPECS).sort()).toEqual([...activeWeathers].sort());

    for (const kind of activeWeathers) {
      const spec = weatherAmbienceSpec(kind);
      expect(spec, `${kind} spec`).toBe(WEATHER_AMBIENCE_SPECS[kind]);
      if (spec === null) continue;
      expect(spec.bedFilterHz, `${kind} filter Hz`).toBeGreaterThanOrEqual(500);
      expect(spec.bedFilterHz, `${kind} filter Hz`).toBeLessThanOrEqual(2400);
      expect(spec.bedQ, `${kind} filter Q`).toBeGreaterThan(0);
      expect(spec.bedGain, `${kind} gentle bed gain <= 0.05`).toBeGreaterThan(0);
      expect(spec.bedGain, `${kind} gentle bed gain <= 0.05`).toBeLessThanOrEqual(0.05);
      expect(spec.accentCadenceMs, `${kind} cadence`).toBeGreaterThanOrEqual(900);
      expect(spec.accentGain, `${kind} gentle accent gain <= 0.025`).toBeGreaterThan(0);
      expect(spec.accentGain, `${kind} gentle accent gain <= 0.025`).toBeLessThanOrEqual(0.025);
      expect(spec.panWidth, `${kind} panWidth`).toBeGreaterThan(0);
      expect(spec.panWidth, `${kind} panWidth`).toBeLessThanOrEqual(0.55);
      expect(spec.notesHz.length, `${kind} pentatonic palette`).toBeGreaterThanOrEqual(3);
      for (const hz of spec.notesHz) {
        expect(hz, `${kind} note ${hz} Hz`).toBeGreaterThanOrEqual(500);
        expect(hz, `${kind} note ${hz} Hz`).toBeLessThanOrEqual(2400);
      }
      expect(["sine", "triangle"]).toContain(spec.waveform);
    }
  });

  it("produces deterministic bounded stereo pan values and 0 for clear", () => {
    expect(weatherAmbiencePan("clear", 0)).toBe(0);
    expect(weatherAmbiencePan("clear", 9)).toBe(0);
    expect(weatherAmbiencePan("clear", Number.NaN)).toBe(0);

    for (const kind of activeWeathers) {
      const width = WEATHER_AMBIENCE_SPECS[kind].panWidth;
      expect(weatherAmbiencePan(kind, Number.NaN)).toBe(weatherAmbiencePan(kind, 0));
      const samples = Array.from({ length: 12 }, (_, seed) => {
        const pan = weatherAmbiencePan(kind, seed);
        expect(pan, `${kind}:${seed} deterministic`).toBe(weatherAmbiencePan(kind, seed));
        expect(pan, `${kind}:${seed} >= -width`).toBeGreaterThanOrEqual(-width);
        expect(pan, `${kind}:${seed} <= width`).toBeLessThanOrEqual(width);
        return pan;
      });
      expect(samples.some((p) => p < 0), `${kind} reaches left`).toBe(true);
      expect(samples.some((p) => p > 0), `${kind} reaches right`).toBe(true);
      expect(new Set(samples).size, `${kind} varies across seeds`).toBeGreaterThanOrEqual(8);
    }
  });

  it("hushes weather on title, battle, finale & all 19 indoor areas, and resolves outdoors", () => {
    const plazaState: State = { ...baseState, area: "plaza", tick: 0 };

    // Suppressed on title, battle, and finale even when sunshower is active.
    expect(resolveSoundtrackWeather(plazaState, "sunshower", true)).toBe("clear");
    expect(
      resolveSoundtrackWeather({ ...plazaState, battle: makeStubBattle() }, "sunshower", false),
    ).toBe("clear");
    expect(
      resolveSoundtrackWeather({ ...plazaState, finale: "morning" }, "sunshower", false),
    ).toBe("clear");
    expect(
      resolveSoundtrackWeather({ ...plazaState, finale: "credits" }, "sunshower", false),
    ).toBe("clear");

    // All 19 sheltered indoor playable areas stay clear under any weather mode.
    const indoorAreas = Object.keys(content.world.areas).filter(
      (id) => id !== "harness" && weatherBiomeForArea(id) === "indoor",
    );
    expect(indoorAreas.length).toBeGreaterThanOrEqual(19);
    for (const areaId of indoorAreas) {
      expect(
        resolveSoundtrackWeather({ ...plazaState, area: areaId }, "sunshower", false),
        `indoor ${areaId} hushes sunshower`,
      ).toBe("clear");
    }

    // Outdoor areas resolve each explicit cozy weather cleanly.
    for (const kind of activeWeathers) {
      expect(resolveSoundtrackWeather(plazaState, kind, false)).toBe(kind);
    }
    expect(resolveSoundtrackWeather(plazaState, "clear", false)).toBe("clear");
    expect(resolveSoundtrackWeather({ ...plazaState, area: "woods" }, "twilight-fireflies", false))
      .toBe("twilight-fireflies");
    expect(resolveSoundtrackWeather({ ...plazaState, area: "summit" }, "snow-flurry", false))
      .toBe("snow-flurry");
  });
});

describe("Milestone 211: Weather-Stamped Photo Mode Postcards", () => {
  it("maps weather labels accurately and leaves clear/undefined postcards unchanged", () => {
    expect(postcardWeatherLabel()).toBe("");
    expect(postcardWeatherLabel("clear")).toBe("");
    expect(postcardWeatherLabel("sunshower")).toBe("Rainbow Sunshower");
    expect(postcardWeatherLabel("breeze-petals")).toBe("Petal Breeze");
    expect(postcardWeatherLabel("snow-flurry")).toBe("Snow Flurry");
    expect(postcardWeatherLabel("twilight-fireflies")).toBe("Twilight Fireflies");

    const base = postcardMetadata("plaza", "Cloverhollow Plaza", "Cloverhollow", ["Maddie"]);
    expect(postcardMetadata("plaza", "Cloverhollow Plaza", "Cloverhollow", ["Maddie"], "clear"))
      .toEqual(base);
    expect(base.subcaption).toBe("Cloverhollow · with Maddie");
  });

  it("appends active weather stamps cleanly with and without land/companions", () => {
    expect(
      postcardMetadata("plaza", "Cloverhollow Plaza", "Cloverhollow", ["Maddie"], "sunshower")
        .subcaption,
    ).toBe("Cloverhollow · with Maddie · Rainbow Sunshower");

    expect(
      postcardMetadata("bay", "Bubblegum Bay", "Bubblegum Bay", [], "breeze-petals").subcaption,
    ).toBe("Bubblegum Bay · Petal Breeze");

    expect(
      postcardMetadata("summit", "Alpine Summit", "", ["Jordan"], "snow-flurry").subcaption,
    ).toBe("with Jordan · Snow Flurry");

    expect(
      postcardMetadata("woods", "Whispering Woods", "", [], "twilight-fireflies").subcaption,
    ).toBe("Twilight Fireflies");
  });
});

describe("Milestone 211: Modular Line-Budget Gates", () => {
  it("keeps ui-gallery split and all touched platform/shell modules cleanly under budget", () => {
    expect(lineCount("src/dev/ui-gallery.ts")).toBeLessThan(560);
    expect(lineCount("src/dev/ui-gallery-fixtures.ts")).toBeLessThan(460);
    expect(lineCount("src/platform/weather-ambience.ts")).toBeLessThan(280);
    expect(lineCount("src/platform/ambience.ts")).toBeLessThan(650);
    expect(lineCount("src/main.ts")).toBeLessThan(890);
  });
});
