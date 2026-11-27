import { describe, expect, it } from "vitest";
import { loadContent } from "../../src/content/load";
import {
  createState,
  creditsSummary,
  journalProgress,
  openArcade,
  STAR_GEM_VARIABLES,
  startBattle,
  valleyCompletion,
  type State,
} from "../../src/core";
import { inkVariable, setInkVariables } from "../../src/core/ink";
import { runConsoleCommand, type ConsoleContext } from "../../src/dev/console";
import { evaluateStarGemGlints } from "../../src/render/overworld-render";

const { world, fixtures } = loadContent();

const consoleContext: ConsoleContext = {
  story: world.story,
  stickerIds: world.stickers.catalogue.map((sticker) => sticker.id),
  prizeIds: world.arcade.prizes.map((prize) => prize.id),
  treatIds: world.treats.map((treat) => treat.id),
  fishIds: world.arcade.fish.catches.map((item) => item.id),
  thresholds: world.levels.thresholds,
};

function stateIn(
  areaId: string,
  overrides: Partial<State> = {},
  variables: Record<string, boolean> = {},
): State {
  const fixture = fixtures[areaId] ?? fixtures["new-game"];
  if (fixture === undefined) throw new Error("Missing new-game fixture");
  const base = createState(world, fixture, 1);
  const ink = Object.keys(variables).length > 0
    ? setInkVariables(base.ink, variables)
    : base.ink;
  return { ...base, area: areaId, ink, ...overrides };
}

function fullCompletionState(): State {
  const allStickers = world.stickers.catalogue.map((entry) => entry.id);
  const allPrizes = world.arcade.prizes.map((entry) => entry.id);
  const allFish = Object.fromEntries(world.arcade.fish.catches.map((item) => [item.id, 1]));
  const allGems = Object.fromEntries(STAR_GEM_VARIABLES.map((key) => [key, true]));
  return stateIn(
    "plaza",
    {
      stickers: allStickers,
      prizes: allPrizes,
      caughtFish: allFish,
    },
    {
      ...allGems,
      cavern_chime_rung: true,
      spice_returned: true,
      gem_reward_all: true,
      sanctuary_reward_14: true,
      sue_compass: true,
      jordan_clover: true,
      buster_reward: true,
    },
  );
}

describe("Milestone 120: Prismatic Overworld Star Gem Glints", () => {
  it("emits glints for all 5 open-air Star Gems when uncollected and vanishes once found", () => {
    const openAir: readonly { area: string; id: string; variable: string }[] = [
      { area: "bay", id: "bay-gem", variable: "gem_bay" },
      { area: "trail", id: "trail-gem", variable: "gem_trail" },
      { area: "pass", id: "pass-gem", variable: "gem_pass" },
      { area: "woods", id: "woods-gem", variable: "gem_woods" },
      { area: "hills", id: "hills-gem", variable: "gem_hills" },
    ];

    for (const entry of openAir) {
      const area = world.areas[entry.area];
      const interactable = area?.interactables.find((item) => item.id === entry.id);
      if (interactable === undefined) throw new Error(`Missing ${entry.id} in ${entry.area}`);

      const uncollected = stateIn(entry.area, { tick: 30, lantern: false });
      const glints = evaluateStarGemGlints(world, uncollected, false);
      expect(glints, `${entry.area} uncollected`).toHaveLength(1);
      const glint = glints[0];
      if (glint === undefined) throw new Error("Expected glint");
      expect(glint.id).toBe(entry.id);
      expect(glint.x).toBe(interactable.point.x);
      expect(glint.y).toBeCloseTo(interactable.point.y - 12 + Math.sin(30 * 0.09) * 3, 6);
      expect(glint.haloSize).toBeGreaterThanOrEqual(38);
      expect(glint.haloSize).toBeLessThanOrEqual(46);
      expect(glint.starScale).toBeGreaterThanOrEqual(0.34);
      expect(glint.starScale).toBeLessThanOrEqual(0.46);
      expect(glint.starAlpha).toBe(0.88);
      expect(glint.starRotation).toBeCloseTo((30 * 0.035) % (Math.PI * 2), 6);

      const collected = stateIn(entry.area, { tick: 30 }, { [entry.variable]: true });
      expect(evaluateStarGemGlints(world, collected, false), `${entry.area} collected`).toEqual([]);
    }

    const early = evaluateStarGemGlints(world, stateIn("hills", { tick: 0 }), false)[0];
    const later = evaluateStarGemGlints(world, stateIn("hills", { tick: 40 }), false)[0];
    expect(early?.haloTint).not.toBe(later?.haloTint);
  });

  it("hides blacklight-secret park_gem and cavern_gem until lantern is on", () => {
    const secrets: readonly { area: string; id: string; variable: string }[] = [
      { area: "park", id: "park-gem-glow", variable: "gem_park" },
      { area: "cavern", id: "cavern-gem-glow", variable: "gem_cavern" },
    ];

    for (const entry of secrets) {
      expect(
        evaluateStarGemGlints(world, stateIn(entry.area, { tick: 20, lantern: false }), false),
        `${entry.area} dark`,
      ).toEqual([]);

      const lit = evaluateStarGemGlints(
        world,
        stateIn(entry.area, { tick: 20, lantern: true }),
        false,
      );
      expect(lit, `${entry.area} lit`).toHaveLength(1);
      expect(lit[0]?.id).toBe(entry.id);

      const collectedLit = evaluateStarGemGlints(
        world,
        stateIn(entry.area, { tick: 20, lantern: true }, { [entry.variable]: true }),
        false,
      );
      expect(collectedLit, `${entry.area} collected`).toEqual([]);
    }
  });

  it("holds steady under reducedMotion and hides during battle, arcade, or harness", () => {
    const hillsGem = world.areas.hills?.interactables.find((item) => item.id === "hills-gem");
    if (hillsGem === undefined) throw new Error("Missing hills-gem");

    const calmA = evaluateStarGemGlints(world, stateIn("hills", { tick: 0 }), true);
    const calmB = evaluateStarGemGlints(world, stateIn("hills", { tick: 185 }), true);
    expect(calmA).toHaveLength(1);
    expect(calmB).toEqual(calmA);
    expect(calmA[0]).toMatchObject({
      id: "hills-gem",
      x: hillsGem.point.x,
      y: hillsGem.point.y - 12,
      haloTint: 0xffe58f,
      haloAlpha: 0.42,
      starAlpha: 0.88,
      starRotation: 0,
    });

    expect(evaluateStarGemGlints(world, stateIn("harness", { tick: 10 }), false)).toEqual([]);
    expect(evaluateStarGemGlints(world, stateIn("plaza", { tick: 10 }), false)).toEqual([]);

    const frog = world.critters["fountain-frog"];
    if (frog === undefined) throw new Error("Missing fountain-frog critter");
    const hillsBase = stateIn("hills", { tick: 20 });
    expect(
      evaluateStarGemGlints(
        world,
        { ...hillsBase, battle: startBattle(world, hillsBase, frog) },
        false,
      ),
    ).toEqual([]);

    const bayFishing = openArcade(world, stateIn("bay", { tick: 20, coins: 10 }), "fish", 0);
    expect(evaluateStarGemGlints(world, bayFishing, false)).toEqual([]);
  });
});

describe("Milestone 120: 100% Valley Explorer Master Crest & QA Gems Command", () => {
  it("computes valleyCompletion totals and flips complete only at 59/59 (100%)", () => {
    const empty = valleyCompletion(journalProgress(world, stateIn("plaza")));
    expect(empty).toEqual({ owned: 0, total: 59, percent: 0, complete: false });

    expect(
      valleyCompletion({
        stickers: { owned: 0, total: 0 },
        prizes: { owned: 0, total: 0 },
        fish: { owned: 0, total: 0 },
        keepsakes: { owned: 0, total: 0 },
        gems: { owned: 0, total: 0 },
      }),
    ).toEqual({ owned: 0, total: 0, percent: 0, complete: false });

    const almost = fullCompletionState();
    const oneShort = { ...almost, ink: setInkVariables(almost.ink, { gem_hills: false }) };
    expect(valleyCompletion(journalProgress(world, oneShort))).toEqual({
      owned: 58,
      total: 59,
      percent: 98,
      complete: false,
    });

    expect(valleyCompletion(journalProgress(world, almost))).toEqual({
      owned: 59,
      total: 59,
      percent: 100,
      complete: true,
    });
  });

  it("prepends ★ 100% Valley Explorer! in creditsSummary only at 100% completion", () => {
    const empty = stateIn("plaza");
    expect(creditsSummary(world, empty)).toEqual([]);

    const full = fullCompletionState();
    const oneShort = { ...full, ink: setInkVariables(full.ink, { gem_hills: false }) };
    const almostSummary = creditsSummary(world, oneShort);
    expect(almostSummary[0]).not.toBe("★ 100% Valley Explorer!");
    expect(almostSummary).toContain("6/7 Star Gems");

    const masterSummary = creditsSummary(world, full);
    expect(masterSummary[0]).toBe("★ 100% Valley Explorer!");
    expect(masterSummary).toEqual([
      "★ 100% Valley Explorer!",
      "24/24 Stickers",
      "7/7 Star Gems",
      "6/6 Fish",
      "9/9 Keepsakes",
      "13/13 Prizes",
    ]);
  });

  it("toggles all 7 Star Gem story variables cleanly via QA console gems all|clear", () => {
    const start = stateIn("plaza");
    const help = runConsoleCommand(consoleContext, start, "help");
    if (help.kind !== "help") throw new Error("Expected help");
    expect(help.message).toContain("gems all|clear");

    const granted = runConsoleCommand(consoleContext, start, "gems all");
    if (granted.kind !== "applied") throw new Error("Expected gems all to apply");
    for (const variable of STAR_GEM_VARIABLES) {
      expect(inkVariable(world.story, granted.state.ink, variable), variable).toBe(true);
    }

    const cleared = runConsoleCommand(consoleContext, granted.state, "gems clear");
    if (cleared.kind !== "applied") throw new Error("Expected gems clear to apply");
    for (const variable of STAR_GEM_VARIABLES) {
      expect(inkVariable(world.story, cleared.state.ink, variable), variable).toBe(false);
    }

    expect(runConsoleCommand(consoleContext, start, "gems").kind).toBe("error");
    expect(runConsoleCommand(consoleContext, start, "gems invalid").kind).toBe("error");
  });
});
