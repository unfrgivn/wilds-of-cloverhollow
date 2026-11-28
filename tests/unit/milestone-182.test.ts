import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadContent } from "../../src/content/load";
import { createState, journalKeepsakes, setInkVariables, type State } from "../../src/core";
import {
  dreamBlessingBonuses,
  evaluateKeepsakeBlessings,
  evaluateKeepsakeBlessingsFromIds,
  isKeepsakeId,
  KEEPSAKE_BLESSING_IDS,
  KEEPSAKE_BLESSINGS,
  keepsakeBlessingFor,
} from "../../src/core/blessings";
import type { KeepsakeId } from "../../src/core/journal";
import { blessingStarMarkup } from "../../src/ui/journal-blessings";
import { importErrors, stripComments, stripStringLiterals } from "../../tools/purity";

describe("Milestone 179: Keepsake Dream Blessings (Track E9A)", () => {
  const { world, fixtures } = loadContent();
  const baseState = createState(world, fixtures["new-game"]!);

  const withVars = (state: State, vars: Record<string, boolean>): State => ({
    ...state,
    ink: setInkVariables(state.ink, vars),
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

  it("covers all 13 keepsakes exhaustively with unique titles and non-empty prose", () => {
    const journalIds = journalKeepsakes(world, baseState).map((item) => item.id);
    expect(KEEPSAKE_BLESSING_IDS).toEqual(journalIds);
    expect(Object.keys(KEEPSAKE_BLESSINGS)).toHaveLength(13);

    const titles = new Set<string>();
    for (const id of journalIds) {
      expect(isKeepsakeId(id)).toBe(true);
      const spec = keepsakeBlessingFor(id);
      expect(spec).toEqual(KEEPSAKE_BLESSINGS[id]);
      expect(spec.id).toBe(id);
      expect(spec.title.trim().length).toBeGreaterThan(0);
      expect(spec.summary.trim().length).toBeGreaterThan(0);
      expect(spec.effectNote.trim().length).toBeGreaterThan(0);
      expect(spec.accent).toMatch(/^#[0-9a-f]{6}$/i);
      titles.add(spec.title);
    }
    expect(titles.size).toBe(13);
    expect(isKeepsakeId("not-a-keepsake")).toBe(false);
    expect(KEEPSAKE_BLESSINGS["sea-compass"].effectNote).toBe("+15% fish bite window");
    expect(KEEPSAKE_BLESSINGS["festival-ribbon"].title).toBe("Sunny Jubilee");
    expect(KEEPSAKE_BLESSINGS["shell-shard"].title).toBe("Coastal Harmony");
  });

  it("maintains exact twin parity across 0/13, 5/13, and 13/13 owned keepsakes", () => {
    // 1. Empty: 0/13
    const emptyCore = evaluateKeepsakeBlessings(world, baseState);
    const emptyIds = evaluateKeepsakeBlessingsFromIds([]);
    expect(emptyCore).toEqual(emptyIds);
    expect(emptyCore.active).toBe(0);
    expect(emptyCore.total).toBe(13);
    expect(emptyCore.complete).toBe(false);
    expect(emptyCore.blessings.every((b) => !b.active)).toBe(true);

    // 2. Mid-journey: 5/13
    const fiveIds: KeepsakeId[] = [
      "star-pin",
      "moon-feather",
      "sea-compass",
      "star-whistle",
      "shell-shard",
    ];
    const fiveState: State = withVars(
      { ...baseState, stickers: ["starry-owl"] },
      {
        spice_returned: true,
        sue_compass: true,
        buster_reward: true,
        island_shells_solved: true,
      },
    );
    const fiveCore = evaluateKeepsakeBlessings(world, fiveState);
    const fiveDirect = evaluateKeepsakeBlessingsFromIds(fiveIds);
    expect(fiveCore).toEqual(fiveDirect);
    expect(fiveCore.active).toBe(5);
    expect(fiveCore.total).toBe(13);
    expect(fiveCore.complete).toBe(false);
    expect(fiveCore.blessings.filter((b) => b.active).map((b) => b.id)).toEqual(fiveIds);

    // Duplicate IDs do not inflate count or break parity.
    expect(evaluateKeepsakeBlessingsFromIds([...fiveIds, "star-pin", "shell-shard"])).toEqual(
      fiveDirect,
    );

    // 3. Complete: 13/13
    const fullState: State = withVars(
      { ...baseState, stickers: ["starry-owl", "taco-chef"] },
      allKeepsakeVars,
    );
    const fullCore = evaluateKeepsakeBlessings(world, fullState);
    const fullDirect = evaluateKeepsakeBlessingsFromIds(KEEPSAKE_BLESSING_IDS);
    expect(fullCore).toEqual(fullDirect);
    expect(fullCore.active).toBe(13);
    expect(fullCore.total).toBe(13);
    expect(fullCore.complete).toBe(true);
    expect(fullCore.blessings.every((b) => b.active)).toBe(true);
  });

  it("computes exact dreamBlessingBonuses for empty, individual, and complete sets", () => {
    expect(dreamBlessingBonuses([])).toEqual({
      calmSparkleBonus: 0,
      fishBiteGrace: 0,
      peekabooStealthGrace: 0,
      tacoTipCoins: 0,
      arcadeTicketBonus: 0,
      gardenGrowthBoost: 0,
    });

    expect(dreamBlessingBonuses(["star-pin"])).toMatchObject({ arcadeTicketBonus: 2 });
    expect(dreamBlessingBonuses(["star-geode"])).toMatchObject({ calmSparkleBonus: 0.05 });
    expect(dreamBlessingBonuses(["moon-feather"])).toMatchObject({ peekabooStealthGrace: 0.15 });
    expect(dreamBlessingBonuses(["taco-badge"])).toMatchObject({ tacoTipCoins: 1 });
    expect(dreamBlessingBonuses(["sea-compass"])).toMatchObject({ fishBiteGrace: 0.15 });
    expect(dreamBlessingBonuses(["festival-ribbon"])).toMatchObject({ gardenGrowthBoost: 1 });

    expect(
      dreamBlessingBonuses([
        "star-pin",
        "star-geode",
        "moon-feather",
        "taco-badge",
        "sea-compass",
        "festival-ribbon",
      ]),
    ).toEqual({
      calmSparkleBonus: 0.05,
      fishBiteGrace: 0.15,
      peekabooStealthGrace: 0.15,
      tacoTipCoins: 1,
      arcadeTicketBonus: 2,
      gardenGrowthBoost: 1,
    });
  });

  it("keeps core purity, zero SVG <text> nodes, and < 1,000 lines on touched src/ files", () => {
    const coreSource = readFileSync("src/core/blessings.ts", "utf8");
    const stripped = stripComments(coreSource);
    expect(importErrors("src/core/blessings.ts", stripped)).toEqual([]);
    expect(stripStringLiterals(stripped)).not.toMatch(
      /\b(window|document|PIXI|Date|performance)\b/,
    );
    // Ensure template interpolation code is still preserved by stripStringLiterals.
    expect(stripStringLiterals("const x = `${window.foo}`;")).toContain("window.foo");

    for (const id of KEEPSAKE_BLESSING_IDS) {
      const markup = blessingStarMarkup(KEEPSAKE_BLESSINGS[id].accent);
      expect(markup).not.toContain("<text");
      expect(markup).toContain(KEEPSAKE_BLESSINGS[id].accent);
    }

    for (const file of [
      "src/core/blessings.ts",
      "src/ui/journal-blessings.ts",
      "src/ui/journal-blessings.css",
      "src/ui/journal-field-note.ts",
    ]) {
      const lines = readFileSync(file, "utf8").split("\n").length;
      expect(lines, `${file} must remain under 1,000 lines`).toBeLessThan(1000);
    }
  });
});
