import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadContent } from "../../src/content/load";
import { createState, pointInPolygon, type State } from "../../src/core";
import {
  encoreJournalSummary,
  recordEncoreVictory,
  type EncoreRecord,
} from "../../src/core/encore";
import { setInkVariables } from "../../src/core/ink";
import {
  ENCORE_TROPHY_PERCH,
  evaluateClubhouseDisplay,
  evaluateEncoreTrophySparkles,
} from "../../src/render/clubhouse-display";
import { ENCORE_TROPHY_ASSET_PATH } from "../../src/render/clubhouse-display-render";
import { HEADER_TROPHY_MARKUP, trophyEmblemMarkup } from "../../src/ui/journal-encore";

const { world, fixtures } = loadContent();

function stateWith(
  area: string,
  overrides: Partial<State> = {},
  inkVars: Record<string, boolean> = {},
): State {
  const fixture = fixtures[area] ?? fixtures.clubhouse;
  if (fixture === undefined) throw new Error("Missing clubhouse fixture");
  const base = createState(world, fixture, 1);
  const ink = Object.keys(inkVars).length > 0 ? setInkVariables(base.ink, inkVars) : base.ink;
  return {
    ...base,
    area,
    ink,
    ...overrides,
  };
}

function fullEncoreRecord(): EncoreRecord {
  const bosses = world.encore?.bosses ?? [];
  let record: EncoreRecord | undefined;
  for (const boss of bosses) {
    record = recordEncoreVictory(record, boss, ["brisk-breeze", "windup-surge", "pure-heart"]);
  }
  return record ?? { bosses: {}, trophies: [] };
}

describe("Milestone 211: Clubhouse Dream Encore Star Trophy & Journal Trophy Case", () => {
  it("returns encoreTrophy: null at 0 trophies and outside clubhouse (zero baseline drift)", () => {
    const emptyClub = stateWith("clubhouse");
    expect(evaluateClubhouseDisplay(world, emptyClub).encoreTrophy).toBeNull();

    const outsideWithAll = stateWith("plaza", { encore: fullEncoreRecord() });
    expect(evaluateClubhouseDisplay(world, outsideWithAll).encoreTrophy).toBeNull();

    const bedroomWithAll = stateWith("bedroom", { encore: fullEncoreRecord() });
    expect(evaluateClubhouseDisplay(world, bedroomWithAll).encoreTrophy).toBeNull();
  });

  it("places ENCORE_TROPHY_PERCH outside walkable and >= 50 px clear of all 26 items", () => {
    const clubhouse = world.areas.clubhouse;
    if (clubhouse === undefined) throw new Error("Missing clubhouse area");

    expect(
      pointInPolygon({ x: ENCORE_TROPHY_PERCH.x, y: ENCORE_TROPHY_PERCH.y }, clubhouse.walkable),
    ).toBe(false);

    const allPrizes = world.arcade.prizes.map((entry) => entry.id);
    const fullClub = stateWith(
      "clubhouse",
      {
        prizes: allPrizes,
        stickers: ["starry-owl", "taco-chef"],
        encore: fullEncoreRecord(),
      },
      {
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
      },
    );

    const display = evaluateClubhouseDisplay(world, fullClub);
    expect(display.prizes).toHaveLength(13);
    expect(display.keepsakes).toHaveLength(13);
    expect(display.encoreTrophy).toEqual({
      x: ENCORE_TROPHY_PERCH.x,
      y: ENCORE_TROPHY_PERCH.y,
      zIndex: ENCORE_TROPHY_PERCH.zIndex,
      scale: ENCORE_TROPHY_PERCH.scale,
      earned: 9,
      total: 9,
      complete: true,
    });

    for (const prize of display.prizes) {
      const dist = Math.hypot(
        ENCORE_TROPHY_PERCH.x - prize.x,
        ENCORE_TROPHY_PERCH.y - prize.y,
      );
      expect(dist, `clearance to prize ${prize.id}`).toBeGreaterThanOrEqual(50);
    }
    for (const keepsake of display.keepsakes) {
      const dist = Math.hypot(
        ENCORE_TROPHY_PERCH.x - keepsake.x,
        ENCORE_TROPHY_PERCH.y - keepsake.y,
      );
      expect(dist, `clearance to keepsake ${keepsake.id}`).toBeGreaterThanOrEqual(50);
    }
    expect(ENCORE_TROPHY_ASSET_PATH).toBe("assets/props/encore-shrine/star-trophy.webp");
  });

  it("scales evaluateEncoreTrophySparkles cleanly (2 -> 4 -> 6) and honors reducedMotion", () => {
    const low = { ...ENCORE_TROPHY_PERCH, earned: 1, total: 9, complete: false };
    const mid = { ...ENCORE_TROPHY_PERCH, earned: 5, total: 9, complete: false };
    const grand = { ...ENCORE_TROPHY_PERCH, earned: 9, total: 9, complete: true };

    const lowGlow = evaluateEncoreTrophySparkles(low, 24, false);
    const midGlow = evaluateEncoreTrophySparkles(mid, 24, false);
    const grandGlow = evaluateEncoreTrophySparkles(grand, 24, false);

    expect(lowGlow.sparkles).toHaveLength(2);
    expect(lowGlow.crownGlow).toBe(false);
    expect(midGlow.sparkles).toHaveLength(4);
    expect(midGlow.crownGlow).toBe(false);
    expect(grandGlow.sparkles).toHaveLength(6);
    expect(grandGlow.crownGlow).toBe(true);
    expect(grandGlow.haloScale).toBeGreaterThan(lowGlow.haloScale);

    const calmA = evaluateEncoreTrophySparkles(grand, 0, true);
    const calmB = evaluateEncoreTrophySparkles(grand, 240, true);
    expect(calmA).toEqual(calmB);
    expect(calmA.sparkles.every((spark) => spark.rotation === 0)).toBe(true);
  });

  it("keeps encoreJournalSummary spoiler-free pre-reveal and projects 9 bosses & stars", () => {
    const preReveal = stateWith("clubhouse");
    const locked = encoreJournalSummary(world, preReveal);
    expect(locked.unlocked).toBe(false);
    expect(locked.earned).toBe(0);
    expect(locked.total).toBe(9);
    expect(locked.entries).toHaveLength(9);

    const postRevealEmpty = stateWith("clubhouse", {}, { milo_revealed: true });
    const unlockedEmpty = encoreJournalSummary(world, postRevealEmpty);
    expect(unlockedEmpty.unlocked).toBe(true);
    expect(unlockedEmpty.earned).toBe(0);
    expect(unlockedEmpty.entries.every((entry) => !entry.won && entry.stars === 0)).toBe(true);

    const bosses = world.encore?.bosses ?? [];
    let partialRecord: EncoreRecord | undefined;
    if (bosses[0] !== undefined) {
      partialRecord = recordEncoreVictory(partialRecord, bosses[0], ["brisk-breeze", "pure-heart"]);
    }
    if (bosses[1] !== undefined) {
      partialRecord = recordEncoreVictory(partialRecord, bosses[1], [
        "brisk-breeze",
        "windup-surge",
        "pure-heart",
      ]);
    }
    const partial = encoreJournalSummary(world, stateWith("clubhouse", { encore: partialRecord }));
    expect(partial.unlocked).toBe(true);
    expect(partial.earned).toBe(2);
    expect(partial.entries[0]?.won).toBe(true);
    expect(partial.entries[0]?.stars).toBe(2);
    expect(partial.entries[0]?.maxStars).toBe(3);
    expect(partial.entries[1]?.won).toBe(true);
    expect(partial.entries[1]?.stars).toBe(3);
    expect(partial.entries[2]?.won).toBe(false);

    const full = encoreJournalSummary(
      world,
      stateWith("clubhouse", { encore: fullEncoreRecord() }),
    );
    expect(full.unlocked).toBe(true);
    expect(full.earned).toBe(9);
    expect(full.total).toBe(9);
    expect(full.entries.every((entry) => entry.won && entry.stars === 3)).toBe(true);
  });

  it("enforces zero SVG text nodes in journal-encore.ts and < 1,000 line caps", () => {
    expect(HEADER_TROPHY_MARKUP).not.toMatch(/<text\b/i);
    expect(trophyEmblemMarkup(true, "#5fa8c4")).not.toMatch(/<text\b/i);
    expect(trophyEmblemMarkup(false, "#5fa8c4")).not.toMatch(/<text\b/i);

    const encoreTs = readFileSync("src/ui/journal-encore.ts", "utf8");
    expect(encoreTs).not.toMatch(/<text\b/i);

    const touchedSrc = [
      "src/core/encore.ts",
      "src/render/clubhouse-display.ts",
      "src/render/clubhouse-display-render.ts",
      "src/render/clubhouse-encore-render.ts",
      "src/ui/journal-encore.ts",
      "src/ui/journal-encore.css",
      "src/ui/journal-field-note.ts",
      "src/ui/journal-field-note-data.ts",
      "src/shell/view-models.ts",
    ];
    for (const file of touchedSrc) {
      const lines = readFileSync(file, "utf8").split("\n").length;
      expect(lines, `${file} line cap`).toBeLessThan(1000);
    }
    expect(readFileSync("src/ui/journal-encore.ts", "utf8").split("\n").length).toBeLessThan(265);
    expect(readFileSync("src/ui/journal-encore.css", "utf8").split("\n").length).toBeLessThan(420);
    expect(readFileSync("src/ui/journal-field-note.ts", "utf8").split("\n").length).toBeLessThan(
      720,
    );
  });
});
