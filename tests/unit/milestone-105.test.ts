import { describe, expect, it } from "vitest";
import { createState, creditsSummary, journalProgress, type State } from "../../src/core";
import { setInkVariables } from "../../src/core/ink";
import { loadContent } from "../../src/content/load";
import { gamepadBumpers, type StandardGamepad } from "../../src/platform/gamepad";
import { createHaptics } from "../../src/platform/haptics";
import { isReducedMotionActive } from "../../src/platform/reduced-motion";
import * as battleModule from "../../src/ui/battle";
import * as battleChecksModule from "../../src/ui/battle-checks";
import { stepJournalPage } from "../../src/ui/journal";

const { world, fixtures } = loadContent();

function stateIn(
  fixtureName: string,
  overrides: Partial<State> = {},
  variables: Record<string, boolean> = {},
): State {
  const fixture = fixtures[fixtureName];
  if (fixture === undefined) throw new Error(`Missing fixture ${fixtureName}`);
  const base = createState(world, fixture, 1);
  const ink = Object.keys(variables).length > 0
    ? setInkVariables(base.ink, variables)
    : base.ink;
  return { ...base, ink, ...overrides };
}

function makePad(pressedIndices: number[]): StandardGamepad {
  const buttons = Array.from({ length: 16 }, (_, index) => ({
    pressed: pressedIndices.includes(index),
    value: pressedIndices.includes(index) ? 1 : 0,
  }));
  return { mapping: "standard", buttons, axes: [0, 0, 0, 0] };
}

describe("Reduced Motion Parity, Credits Summary, Journal Flip & Modularization", () => {
  it("creditsSummary omits zero categories and formats every non-zero category accurately", () => {
    const empty = stateIn("new-game");
    expect(creditsSummary(world, empty)).toEqual([]);

    const partial = stateIn(
      "plaza",
      {
        stickers: ["fountain-frog", "cozy-cat"],
        caughtFish: { minnow: 1, starfish: 1 },
      },
      { gem_park: true },
    );
    const partialProgress = journalProgress(world, partial);
    expect(creditsSummary(world, partial)).toEqual([
      `2/${partialProgress.stickers.total} Stickers`,
      `1/${partialProgress.gems.total} Star Gems`,
      `2/${partialProgress.fish.total} Fish`,
    ]);

    const full = stateIn(
      "clubhouse",
      {
        stickers: ["fountain-frog", "starry-owl"],
        prizes: ["frog-plush", "cat-plush"],
        caughtFish: { koi: 1 },
      },
      {
        gem_park: true,
        gem_bay: true,
        cavern_chime_rung: true,
        sue_compass: true,
      },
    );
    const fullProgress = journalProgress(world, full);
    expect(fullProgress.stickers.owned).toBe(2);
    expect(fullProgress.gems.owned).toBe(2);
    expect(fullProgress.fish.owned).toBe(1);
    expect(fullProgress.keepsakes.owned).toBe(3);
    expect(fullProgress.prizes.owned).toBe(2);
    expect(creditsSummary(world, full)).toEqual([
      `2/${fullProgress.stickers.total} Stickers`,
      `2/${fullProgress.gems.total} Star Gems`,
      `1/${fullProgress.fish.total} Fish`,
      `3/${fullProgress.keepsakes.total} Keepsakes`,
      `2/${fullProgress.prizes.total} Prizes`,
    ]);
  });

  it("stepJournalPage wraps cleanly in both directions across notes, map, and options", () => {
    expect(stepJournalPage("notes", 1)).toBe("map");
    expect(stepJournalPage("map", 1)).toBe("options");
    expect(stepJournalPage("options", 1)).toBe("notes");
    expect(stepJournalPage("notes", -1)).toBe("options");
    expect(stepJournalPage("options", -1)).toBe("map");
    expect(stepJournalPage("map", -1)).toBe("notes");

    expect(gamepadBumpers([makePad([])])).toEqual({ left: false, right: false });
    expect(gamepadBumpers([makePad([4])])).toEqual({ left: true, right: false });
    expect(gamepadBumpers([makePad([5])])).toEqual({ left: false, right: true });
    expect(gamepadBumpers([makePad([4, 5])])).toEqual({ left: true, right: true });
  });

  it("re-exports battle-checks cleanly from src/ui/battle.ts with identical references", () => {
    expect(typeof battleChecksModule.createBattleCheck).toBe("function");
    expect(battleModule.createBattleCheck).toBe(battleChecksModule.createBattleCheck);
  });

  it("respects in-game reducedMotion in isReducedMotionActive and createHaptics in Node", () => {
    expect(isReducedMotionActive()).toBe(false);
    expect(isReducedMotionActive({ datasetValue: "off", mediaMatches: false })).toBe(false);
    expect(isReducedMotionActive({ datasetValue: "on", mediaMatches: false })).toBe(true);
    expect(isReducedMotionActive({ datasetValue: "off", mediaMatches: true })).toBe(true);
    expect(isReducedMotionActive({ datasetValue: "on", mediaMatches: true })).toBe(true);

    const haptics = createHaptics();
    expect(typeof haptics.supported()).toBe("boolean");
    expect(() => haptics.trigger("light")).not.toThrow();
    expect(() => haptics.trigger("medium")).not.toThrow();
    expect(() => haptics.trigger("celebrate")).not.toThrow();
  });
});
