import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  defaultMinigameRecords,
  formatArcadeRecordPills,
  readMinigameRecords,
  recordMinigameResult,
  writeMinigameRecords,
} from "../../src/platform/minigame-records";
import {
  evaluateAtmosphere as evaluateFromRenderer,
  type AtmosphereOptions,
} from "../../src/render/atmosphere";
import { evaluateAtmosphere as evaluateFromRecipes } from "../../src/render/atmosphere-recipes";
import { classifyCookPopup } from "../../src/ui/arcade-popups";

describe("Milestone 118: Clubhouse Microwave Golden Chef Popups & Records", () => {
  it("classifies golden microwave transitions and stays silent otherwise", () => {
    // Silent on initial open (including static gallery renders on result).
    expect(classifyCookPopup(null, "ready", null)).toBeNull();
    expect(classifyCookPopup(null, "result", "golden")).toBeNull();

    // Silent on non-result phases and repeated result ticks.
    expect(classifyCookPopup("ready", "cooking", null)).toBeNull();
    expect(classifyCookPopup("cooking", "ding", "golden")).toBeNull();
    expect(classifyCookPopup("result", "result", "golden")).toBeNull();

    // Silent on non-golden outcomes.
    expect(classifyCookPopup("ding", "result", "frozen")).toBeNull();
    expect(classifyCookPopup("ding", "result", "under")).toBeNull();
    expect(classifyCookPopup("ding", "result", "over")).toBeNull();
    expect(classifyCookPopup("ding", "result", "burnt")).toBeNull();
    expect(classifyCookPopup("ding", "result", null)).toBeNull();

    // Celebrates live transition into golden result.
    expect(classifyCookPopup("ding", "result", "golden")).toEqual({
      kind: "rare",
      text: "★ GOLDEN!",
    });
  });

  it("upgrades legacy 4-key records cleanly and tracks cumulative Golden Dishes", () => {
    const legacyJson = JSON.stringify({ skee: 220, mole: 14, comet: 18, fish: 5 });
    const upgraded = readMinigameRecords(legacyJson);
    expect(upgraded).toEqual({ skee: 220, mole: 14, comet: 18, fish: 5, cook: 0, taco: 0 });
    expect(formatArcadeRecordPills(upgraded).some((pill) => pill.id === "cook")).toBe(false);

    const first = recordMinigameResult(defaultMinigameRecords(), "cook", 1);
    expect(first).toEqual({
      records: { skee: 0, mole: 0, comet: 0, fish: 0, cook: 1, taco: 0 },
      best: 1,
      isNewBest: true,
    });

    const second = recordMinigameResult(first.records, "cook", first.records.cook + 1);
    expect(second).toEqual({
      records: { skee: 0, mole: 0, comet: 0, fish: 0, cook: 2, taco: 0 },
      best: 2,
      isNewBest: true,
    });

    expect(readMinigameRecords(writeMinigameRecords(second.records))).toEqual(second.records);
    expect(formatArcadeRecordPills(second.records)).toEqual([
      { id: "cook", label: "Golden Dishes", value: "2" },
    ]);
  });
});

describe("Milestone 118: Pure Biome Atmosphere Recipes Extraction", () => {
  it("keeps atmosphere-recipes.ts strictly free of Pixi imports", () => {
    const source = readFileSync("src/render/atmosphere-recipes.ts", "utf8");
    expect(source).not.toMatch(/from\s+["']pixi\.js["']/);
  });

  it("exports identical evaluateAtmosphere across biomes and story-reactive flags", () => {
    expect(evaluateFromRecipes).toBe(evaluateFromRenderer);

    const cases: readonly {
      area: string;
      width: number;
      height: number;
      tick: number;
      options?: AtmosphereOptions;
    }[] = [
      { area: "harness", width: 1200, height: 800, tick: 120 },
      { area: "plaza", width: 1700, height: 1100, tick: 120 },
      { area: "plaza", width: 1700, height: 1100, tick: 120, options: { plazaStarGlow: true } },
      {
        area: "plaza",
        width: 1700,
        height: 1100,
        tick: 120,
        options: { plazaStarGlow: true, reducedMotion: true },
      },
      { area: "sanctuary", width: 1700, height: 1100, tick: 90 },
      { area: "bay", width: 1700, height: 1100, tick: 180 },
      { area: "pass", width: 1700, height: 1100, tick: 140 },
      { area: "pass", width: 1700, height: 1100, tick: 140, options: { passHearthWisps: true } },
      {
        area: "pass",
        width: 1700,
        height: 1100,
        tick: 140,
        options: { passHearthWisps: true, reducedMotion: true },
      },
      { area: "woods", width: 1700, height: 1100, tick: 75 },
      { area: "enchanted", width: 1700, height: 1100, tick: 210 },
      { area: "cavern", width: 1650, height: 1050, tick: 160 },
      { area: "cafe", width: 1400, height: 950, tick: 120 },
      { area: "cafe", width: 1400, height: 950, tick: 120, options: { cafeCinnamonSteam: true } },
      {
        area: "cafe",
        width: 1400,
        height: 950,
        tick: 120,
        options: { cafeCinnamonSteam: true, reducedMotion: true },
      },
      { area: "sue-cottage", width: 1400, height: 950, tick: 110 },
      { area: "jordan-cabin", width: 1400, height: 950, tick: 110 },
      { area: "lodge", width: 1400, height: 950, tick: 110 },
      { area: "arcade", width: 1200, height: 850, tick: 110 },
      { area: "clubhouse", width: 1200, height: 800, tick: 120 },
      {
        area: "clubhouse",
        width: 1200,
        height: 800,
        tick: 120,
        options: { clubhouseBloom: true },
      },
      {
        area: "clubhouse",
        width: 1200,
        height: 800,
        tick: 120,
        options: { clubhouseBloom: true, reducedMotion: true },
      },
    ];

    for (const entry of cases) {
      const direct = evaluateFromRecipes(
        entry.area,
        entry.width,
        entry.height,
        entry.tick,
        entry.options,
      );
      const reexported = evaluateFromRenderer(
        entry.area,
        entry.width,
        entry.height,
        entry.tick,
        entry.options,
      );
      expect(direct).toEqual(reexported);
      if (entry.area === "harness") expect(direct).toEqual([]);
      else expect(direct.length).toBeGreaterThan(0);
    }

    // Confirm story-reactive flags add expected extra particles.
    expect(evaluateFromRecipes("cafe", 1400, 950, 120, { cafeCinnamonSteam: true }).length).toBe(
      evaluateFromRecipes("cafe", 1400, 950, 120).length + 6,
    );
    expect(evaluateFromRecipes("plaza", 1700, 1100, 120, { plazaStarGlow: true }).length).toBe(
      evaluateFromRecipes("plaza", 1700, 1100, 120).length + 8,
    );
    expect(evaluateFromRecipes("pass", 1700, 1100, 140, { passHearthWisps: true }).length).toBe(
      evaluateFromRecipes("pass", 1700, 1100, 140).length + 6,
    );
    expect(evaluateFromRecipes("clubhouse", 1200, 800, 120, { clubhouseBloom: true }).length).toBe(
      evaluateFromRecipes("clubhouse", 1200, 800, 120).length + 8,
    );
  });
});
