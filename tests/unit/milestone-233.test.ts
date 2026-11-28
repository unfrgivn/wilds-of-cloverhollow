import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadContent } from "../../src/content/load";
import {
  createState,
  setInkVariables,
  STAR_GEM_VARIABLES,
  type PartyMember,
  type State,
} from "../../src/core";
import { evaluateMeritRibbons } from "../../src/core/ribbons";
import { effectRecipe, effectRecipes } from "../../src/platform/audio-effects";
import {
  defaultMinigameRecords,
  type MinigameRecords,
} from "../../src/platform/minigame-records";
import {
  classifyTravelVignette,
  travelEffectForMode,
  type TravelDepartureEffect,
  type TravelMode,
} from "../../src/render/travel-vignette";
import { continueDetail } from "../../src/shell/title-flow";

describe("Milestone 232: Travel Departure Foley, Weather Vignettes & 16/16 Valley Legend", () => {
  const { world, fixtures } = loadContent();
  const baseState = createState(world, fixtures["new-game"]!);

  const makeMember = (id: string): PartyMember => ({
    id,
    xp: 0,
    x: 0,
    y: 0,
    facing: "down",
    motion: { distance: 0, moving: false },
    stillTicks: 0,
    trail: [],
  });

  const allKeepsakeVars: Record<string, boolean> = {
    cavern_chime_rung: true,
    spice_returned: true,
    gem_reward_all: true,
    sanctuary_reward_14: true,
    sue_compass: true,
    jordan_clover: true,
    buster_reward: true,
    milo_loft_visited: true,
    rosie_cottage_visited: true,
    summit_aurora_read: true,
    island_shells_solved: true,
    festival_toast_done: true,
  };

  const allHeartVars: Record<string, boolean> = {
    h2h_fae_maddie_done: true,
    h2h_fae_sue_done: true,
    h2h_fae_jordan_done: true,
    h2h_sue_jordan_done: true,
    h2h_clubhouse_trio_done: true,
    h2h_sanctuary_encore_done: true,
  };

  const allFish = Object.fromEntries(world.arcade.fish.catches.map((item) => [item.id, 1]));
  const allGems = Object.fromEntries(STAR_GEM_VARIABLES.map((id) => [id, true]));

  function buildValleyCompleteState(): State {
    return {
      ...baseState,
      area: "clubhouse",
      stickers: world.stickers.catalogue.map((s) => s.id),
      prizes: world.arcade.prizes.map((p) => p.id),
      caughtFish: allFish,
      party: [makeMember("maddie"), makeMember("sue"), makeMember("jordan")],
      ink: setInkVariables(baseState.ink, { ...allKeepsakeVars, ...allGems }),
    };
  }

  function buildFullLegendState(): State {
    const base = buildValleyCompleteState();
    return {
      ...base,
      ink: setInkVariables(base.ink, allHeartVars),
      encore: { bosses: {}, trophies: ["trophy-gull"] },
      decor: { swatch: "starlight-cozy", unlockedSwatches: ["starlight-cozy"] },
      puzzles: { "cavern-prism": true },
    };
  }

  it("maps every TravelMode to its bespoke departure foley with warm gentle recipe bounds", () => {
    const expected: readonly [TravelMode, TravelDepartureEffect][] = [
      ["bus", "travel-bus"],
      ["boat", "travel-boat"],
      ["lift", "travel-lift"],
    ];

    for (const [mode, effect] of expected) {
      expect(travelEffectForMode(mode)).toBe(effect);
      const recipe = effectRecipe(effect);
      expect(recipe).toBe(effectRecipes[effect]);
      expect(recipe.length, `${effect} has segments`).toBeGreaterThanOrEqual(2);
      const totalDuration = Math.max(...recipe.map((seg) => seg.offset + seg.duration));
      expect(totalDuration, `${effect} duration <= 0.40s`).toBeLessThanOrEqual(0.4);
      expect(totalDuration, `${effect} duration <= 0.38s`).toBeLessThanOrEqual(0.38);
      for (const seg of recipe) {
        expect(seg.wave, `${effect} avoids square wave`).not.toBe("square");
        expect(seg.gain, `${effect} gain > 0`).toBeGreaterThan(0);
        expect(seg.gain, `${effect} gain <= 0.085`).toBeLessThanOrEqual(0.085);
        expect(seg.gain, `${effect} gain <= 0.08`).toBeLessThanOrEqual(0.08);
        expect(seg.attack ?? 0, `${effect} smooth attack`).toBeGreaterThanOrEqual(0.003);
      }
    }

    expect(effectRecipe("travel-boat").some((seg) => seg.wave === "noise" && seg.lowpass === 1100))
      .toBe(true);
    expect(classifyTravelVignette("plaza", "bay")?.chime).toBe("travel-bus");
    expect(classifyTravelVignette("bay", "island")?.chime).toBe("travel-boat");
    expect(classifyTravelVignette("pass", "summit")?.chime).toBe("travel-lift");
  });

  it("crowns Title Screen continueDetail as 16/16 Valley Legend only when all 16 ribbons earn",
    () => {
      const explorerOnly = buildValleyCompleteState();
      const tacoRecords: MinigameRecords = { ...defaultMinigameRecords(), taco: 540 };
      const emptyRecords = defaultMinigameRecords();

      // Backwards-compatible 2-arg call and partial-ribbon saves keep 100% Valley Explorer.
      expect(continueDetail(world, explorerOnly)).toBe("Clubhouse · ★ 100% Valley Explorer");
      expect(continueDetail(world, explorerOnly, tacoRecords)).toBe(
        "Clubhouse · ★ 100% Valley Explorer",
      );

      // Full 16/16 state without Taco Truck record (15/16) stays 100% Valley Explorer.
      const legendState = buildFullLegendState();
      expect(evaluateMeritRibbons(world, legendState, emptyRecords).earned).toBe(15);
      expect(continueDetail(world, legendState)).toBe("Clubhouse · ★ 100% Valley Explorer");
      expect(continueDetail(world, legendState, emptyRecords)).toBe(
        "Clubhouse · ★ 100% Valley Explorer",
      );

      // Removing any single elevation ribbon keeps 100% Valley Explorer even with taco > 0.
      const missingEncore: State = { ...legendState, encore: undefined };
      const missingDecor: State = { ...legendState, decor: undefined };
      const missingPuzzle: State = { ...legendState, puzzles: undefined };
      const missingHeart: State = {
        ...legendState,
        ink: setInkVariables(legendState.ink, { h2h_sanctuary_encore_done: false }),
      };
      for (const partial of [missingEncore, missingDecor, missingPuzzle, missingHeart]) {
        expect(evaluateMeritRibbons(world, partial, tacoRecords).complete).toBe(false);
        expect(continueDetail(world, partial, tacoRecords)).toBe(
          "Clubhouse · ★ 100% Valley Explorer",
        );
      }

      // All 16/16 Valley Merit Ribbons stitched -> ★ 16/16 Valley Legend!
      expect(evaluateMeritRibbons(world, legendState, tacoRecords).complete).toBe(true);
      expect(continueDetail(world, legendState, tacoRecords)).toBe(
        "Clubhouse · ★ 16/16 Valley Legend",
      );
      expect(continueDetail(world, { ...legendState, area: "plaza" }, tacoRecords)).toBe(
        "Town plaza · ★ 16/16 Valley Legend",
      );
    },
  );

  it("keeps all touched implementation files lean and under line caps", () => {
    const lineCount = (path: string): number =>
      readFileSync(path, "utf8").trimEnd().split("\n").length;

    expect(lineCount("src/main.ts")).toBeLessThan(885);
    expect(lineCount("src/ui/travel-overlay.ts")).toBeLessThan(350);
    for (const file of [
      "src/platform/audio-effects.ts",
      "src/render/travel-vignette.ts",
      "src/ui/travel-overlay.ts",
      "src/ui/travel-overlay.css",
      "src/shell/title-flow.ts",
      "src/main.ts",
    ]) {
      expect(lineCount(file), `${file} < 900 lines`).toBeLessThan(900);
    }
  });
});
