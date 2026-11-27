import { describe, expect, it } from "vitest";
import {
  battleView,
  createState,
  type Battle,
  type BattleView,
  type State,
} from "../../src/core";
import { loadContent } from "../../src/content/load";
import { footstepPitchFactor } from "../../src/platform/voices";
import { computeBattleChoreography } from "../../src/render/battle-choreography";
import { evaluateBattlePortraits } from "../../src/ui/battle-portraits";
import type { AtlasImage } from "../../src/ui/atlas";

const { world, fixtures } = loadContent();

function makeBattle(overrides: Partial<Battle> = {}): Battle {
  return {
    critterId: "frog",
    den: null,
    entry: { x: 500, y: 500 },
    phase: "command",
    message: "How can Fae calm the frog?",
    revealed: 26,
    selected: 0,
    command: null,
    energy: 5,
    calm: 0,
    rest: {},
    check: null,
    lastGrade: null,
    feelings: ["zoomy", "curious"],
    answered: false,
    lanternPeek: false,
    turn: 1,
    windUp: null,
    rewardSticker: null,
    phaseTicks: 0,
    ...overrides,
  };
}

const partyCommands: Record<string, string | null> = Object.fromEntries(
  Object.entries(world.party).map(([id, member]) => [id, member.command?.id ?? null]),
);

const stubImage = (id: string): AtlasImage => ({
  src: `assets/${id}.webp`,
  frame: { x: 0, y: 0, w: 64, h: 64 },
  atlas: { w: 256, h: 256 },
});

function viewFor(battle: Battle, partyIds: readonly string[]): BattleView {
  const fixture = fixtures["plaza-party"];
  if (fixture === undefined) throw new Error("Missing plaza-party fixture");
  const base: State = createState(world, fixture, 1);
  const party: State["party"] = partyIds.map((id) => ({
    id,
    xp: 0,
    x: 500,
    y: 500,
    facing: "down",
    motion: { distance: 0, moving: false },
    stillTicks: 0,
    trail: [],
  }));
  const computed = battleView(world, { ...base, party, battle });
  if (computed === null) throw new Error("Expected BattleView");
  return computed;
}

describe("Milestone 93: footstepPitchFactor", () => {
  it("is deterministic, bounded in [0.93, 1.07], and varies across consecutive strides", () => {
    const strideTicks = [0, 14, 28, 42, 56, 70, 84, 98, 112, 126];
    const factors = strideTicks.map((tick) => footstepPitchFactor(tick));

    for (let i = 0; i < strideTicks.length; i += 1) {
      const tick = strideTicks[i] ?? 0;
      const value = factors[i] ?? 0;
      expect(footstepPitchFactor(tick)).toBe(value);
      expect(value).toBeGreaterThanOrEqual(0.93);
      expect(value).toBeLessThanOrEqual(1.07);
    }

    // Distinct pitch values across consecutive stride ticks and single ticks.
    expect(new Set(factors).size).toBeGreaterThanOrEqual(8);
    const consecutive = [1, 2, 3, 4, 5, 6].map((tick) => footstepPitchFactor(tick));
    expect(new Set(consecutive).size).toBeGreaterThanOrEqual(5);
    for (let i = 1; i < factors.length; i += 1) {
      expect(factors[i]).not.toBe(factors[i - 1]);
    }
  });
});

describe("Milestone 93: Together! active sunburst cascade", () => {
  const partyIds = ["maddie", "sue", "jordan"] as const;

  it("emits >= 6 normal-blended rainbow hearts and golden rings/sparkles on check & result", () => {
    for (const battle of [
      makeBattle({ phase: "check", command: "together", phaseTicks: 24 }),
      makeBattle({ phase: "result", command: "together", lastGrade: "great", phaseTicks: 10 }),
    ]) {
      const view = viewFor(battle, partyIds);
      const choreo = computeBattleChoreography(battle, view, 30, partyIds, partyCommands);
      expect(choreo.stageMood).toBe("together-active");

      const hearts = choreo.vfx.filter(
        (particle) =>
          particle.texture === "heart" &&
          particle.anchor === "between" &&
          particle.blend === "normal",
      );
      expect(hearts.length).toBeGreaterThanOrEqual(6);
      for (const heart of hearts) {
        expect(heart.scaleX).toBeGreaterThanOrEqual(0.56);
        expect(heart.scaleX).toBeLessThanOrEqual(0.72);
      }
      expect(new Set(hearts.map((heart) => heart.tint)).size).toBe(6);

      const rings = choreo.vfx.filter(
        (particle) => particle.texture === "energyRing" && particle.anchor === "between",
      );
      expect(rings.length).toBeGreaterThanOrEqual(3);

      const sparkles = choreo.vfx.filter(
        (particle) =>
          particle.texture === "sparkle" &&
          particle.anchor === "between" &&
          particle.blend === "normal" &&
          (particle.tint === 0xffe066 || particle.tint === 0xfff6c4),
      );
      expect(sparkles.length).toBeGreaterThanOrEqual(6);
    }
  });
});

describe("Milestone 93: Battle portraits active actor highlight during radiant mood", () => {
  const partyIds = ["maddie", "sue", "jordan"] as const;

  it("preserves active === true on the selected command actor while radiant", () => {
    const expectedActors: readonly [number, string][] = [
      [0, "fae"],
      [1, "maddie"],
      [2, "sue"],
      [3, "jordan"],
    ];
    for (const [selected, activeId] of expectedActors) {
      const battle = makeBattle({ phase: "command", sparkle: 3, selected });
      const view = viewFor(battle, partyIds);
      expect(view.sparkle?.ready).toBe(true);
      const items = evaluateBattlePortraits({
        battle,
        view,
        partyIds,
        partyCommands,
        energy: 5,
        resolveImage: stubImage,
      });
      expect(items.every((item) => item.mood === "radiant")).toBe(true);
      expect(items.filter((item) => item.active).map((item) => item.id)).toEqual([activeId]);
    }
  });
});
