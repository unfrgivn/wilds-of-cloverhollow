import { describe, expect, it } from "vitest";
import { loadContent } from "../../src/content/load";
import { burstDamage, calmExperience, calmRecipients, levelForXp, levelUpLine, statsForCommand,
  statsForLevel } from "../../src/core/levels";
import { blankInput, createState, levelUpEvents, step } from "../../src/core";
import { parseSave } from "../../src/core/save";

const content = loadContent();
const table = content.world.levels;

describe("experience and levels", () => {
  it("formats Fae and friend level-up lines", () => {
    expect(levelUpLine("Fae", 4, 5, { power: 2, magic: 1, life: 1, guard: 0 })).toBe(
      "Fae reached level 5! Power +2, Magic +1, Life +1, Guard +0.",
    );
    expect(levelUpLine("Maddie", 4, 5, { power: 2, magic: 1, life: 1, guard: 0 }, true)).toBe(
      "Maddie reached level 5! Power +2, Magic +1.",
    );
  });
  it("follows the accelerating curve and caps at 99", () => {
    expect(levelForXp(table, 0)).toBe(1);
    expect(levelForXp(table, 20)).toBe(2);
    expect(levelForXp(table, 340)).toBe(5);
    expect(levelForXp(table, 2_200)).toBe(10);
    expect(levelForXp(table, Number.MAX_SAFE_INTEGER)).toBe(99);
  });

  it("derives the four stats from level", () => {
    expect(statsForLevel(table, 1)).toEqual({ power: 20, magic: 1, life: 5, guard: 0 });
    expect(statsForLevel(table, 7)).toEqual({ power: 32, magic: 2, life: 7, guard: 1 });
    expect(statsForLevel(table, 99)).toEqual({ power: 216, magic: 25, life: 37, guard: 19 });
    expect(statsForCommand(table, "play", 1).power).toBe(25);
    expect(statsForCommand(table, "cast", 5).power).toBe(42);
  });

  it("pays Fae and only the friend whose command was used", () => {
    const result = calmRecipients(0, { maddie: 0, sue: 0 }, "maddie", 50);
    expect(result).toEqual({ faeXp: 50, friendXp: { maddie: 50, sue: 0 } });
  });

  it("starts a joining friend at Fae's current level threshold through the join path", () => {
    const fixture = content.fixtures["new-game"];
    if (fixture === undefined) throw new Error("fixture missing");
    const state = createState(content.world, { ...fixture, variables: { sue_joined: true } });
    const joined = step(content.world, { ...state, xp: table.thresholds[4] ?? 0 },
      blankInput()).state;
    expect(joined.party.find((member) => member.id === "sue")?.xp).toBe(table.thresholds[4]);
  });

  it("pays XP for an old friend calmed on touch", () => {
    const amount = calmExperience(table, "pup");
    expect(calmRecipients(20, { maddie: 20 }, null, amount)).toEqual({
      faeXp: 40, friendXp: { maddie: 20 },
    });
  });

  it("reports level-up deltas for one and many levels, capped at 99", () => {
    const fixture = content.fixtures["new-game"];
    if (fixture === undefined) throw new Error("fixture missing");
    const before = createState(content.world, fixture);
    const one = levelUpEvents(content.world, before,
      { ...before, xp: table.thresholds[4] ?? 0 });
    expect(one).toEqual([{ type: "level-up", member: "fae", from: 1, to: 5,
      deltas: { power: 8, magic: 1, life: 1, guard: 0 } }]);
    const many = levelUpEvents(content.world, before,
      { ...before, xp: Number.MAX_SAFE_INTEGER });
    expect(many[0]).toMatchObject({ member: "fae", from: 1, to: 99,
      deltas: { power: 196, magic: 24, life: 32, guard: 19 } });
    if (many[0]?.type !== "level-up") throw new Error("missing level-up event");
    expect(many[0].to).toBe(99);
  });

  it("uses critter level for burst, guard, and rewards", () => {
    expect(burstDamage(table, "fountain-frog", "great", false, 99)).toBe(0);
    expect(burstDamage(table, "hooded-kid", "good", true, 2)).toBe(2);
    expect(burstDamage(table, "hooded-kid", "miss", true, 99)).toBe(1);
    expect(calmExperience(table, "bluebird")).toBe(50);
    expect(calmExperience(table, "lodge-keeper", true)).toBe(240);
    expect(calmExperience(table, "hooded-kid", false, true)).toBe(320);
  });

  it("upgrades a v9 calm count to XP and starts friends at Fae's level", () => {
    const fixture = content.fixtures["new-game"];
    if (fixture === undefined) throw new Error("fixture missing");
    const fresh = createState(content.world, fixture);
    const old = { ...fresh, calms: { frog: 2 } };
    const restored = parseSave(JSON.stringify({ version: 9, state: old }), fresh,
      { frog: 40 }, table.thresholds);
    expect(restored?.xp).toBe(80);
    expect(restored?.party.every((member) => member.xp === table.thresholds[2])).toBe(true);
  });
});
