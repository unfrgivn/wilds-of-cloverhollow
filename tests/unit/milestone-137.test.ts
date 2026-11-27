import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Battle, BattleTalk } from "../../src/core";
import {
  classifySnackTheater as classifySnackFromChoreo,
  isTalkTheater as isTalkFromChoreo,
} from "../../src/render/battle-choreography";
import { classifySnackTheater, isTalkTheater } from "../../src/render/battle-vfx";
import {
  battleCheckOverlay as battleCheckFromAssets,
  buildBattleHudView as buildBattleHudFromAssets,
  buildCreditsView as buildCreditsFromAssets,
  buildDialogueView as buildDialogueFromAssets,
  buildHudHintsView as buildHudHintsFromAssets,
  buildJournalView as buildJournalFromAssets,
  buildRewardStickerView as buildRewardFromAssets,
  cropCreditFrame as cropCreditFromAssets,
} from "../../src/shell/assets";
import {
  battleCheckOverlay,
  buildBattleHudView,
  buildCreditsView,
  buildDialogueView,
  buildHudHintsView,
  buildJournalView,
  buildRewardStickerView,
  cropCreditFrame,
} from "../../src/shell/view-models";
import { classifyClawPopup } from "../../src/ui/arcade-popups";

function makeTalk(overrides: Partial<BattleTalk> = {}): BattleTalk {
  return {
    knot: "kid_talk_1",
    turn: 0,
    speaker: "Hooded Kid",
    text: "You don't even know who I am!",
    revealed: 31,
    choices: ["A friend", "Star Racer fan", "My brother"],
    selected: 0,
    ended: false,
    grade: null,
    ...overrides,
  };
}

function makeBattle(overrides: Partial<Battle> = {}): Battle {
  return {
    critterId: "raccoon",
    den: null,
    entry: { x: 800, y: 600 },
    phase: "result",
    message: "Fae tosses Fish Crackers! Their favourite!",
    revealed: 42,
    selected: 0,
    command: null,
    energy: 5,
    calm: 60,
    rest: {},
    check: null,
    lastGrade: null,
    feelings: [],
    answered: false,
    lanternPeek: false,
    turn: 1,
    windUp: null,
    talkMode: false,
    talk: null,
    talkTurns: 0,
    rewardSticker: null,
    phaseTicks: 12,
    ...overrides,
  };
}

describe("Milestone 137: Claw Machine Die-Cut Popups (6/6 Minigames)", () => {
  it("stays silent on initial open, steady frames, and non-celebratory phases", () => {
    expect(classifyClawPopup(null, "ready", null)).toBeNull();
    expect(classifyClawPopup(null, "lifting", "grabbed")).toBeNull();
    expect(classifyClawPopup(null, "lifting", "stuck")).toBeNull();
    expect(classifyClawPopup(null, "result", "grabbed")).toBeNull();

    expect(classifyClawPopup("ready", "sliding", null)).toBeNull();
    expect(classifyClawPopup("sliding", "aiming", null)).toBeNull();
    expect(classifyClawPopup("dropping", "grabbing", null)).toBeNull();
    expect(classifyClawPopup("lifting", "lifting", "grabbed")).toBeNull();
    expect(classifyClawPopup("lifting", "lifting", "stuck")).toBeNull();
    expect(classifyClawPopup("lifting", "returning", "grabbed")).toBeNull();
    expect(classifyClawPopup("returning", "releasing", "grabbed")).toBeNull();
    expect(classifyClawPopup("result", "result", "grabbed")).toBeNull();
  });

  it("classifies grabbing -> lifting outcomes accurately", () => {
    expect(classifyClawPopup("grabbing", "lifting", "grabbed")).toEqual({
      kind: "star",
      text: "GOT IT! ★",
    });
    expect(classifyClawPopup("grabbing", "lifting", "stuck")).toEqual({
      kind: "normal",
      text: "TUG!",
    });
    expect(classifyClawPopup("grabbing", "lifting", "empty")).toBeNull();
    expect(classifyClawPopup("grabbing", "lifting", null)).toBeNull();
  });

  it("classifies releasing -> result outcomes accurately", () => {
    expect(classifyClawPopup("releasing", "result", "grabbed")).toEqual({
      kind: "rare",
      text: "★ PRIZE!",
    });
    expect(classifyClawPopup("releasing", "result", "stuck")).toBeNull();
    expect(classifyClawPopup("releasing", "result", "empty")).toBeNull();
    expect(classifyClawPopup("releasing", "result", null)).toBeNull();
  });
});

describe("Milestone 137: Modular battle-vfx.ts & view-models.ts Splits", () => {
  it("re-exports battle-vfx classifiers identically from battle-choreography.ts", () => {
    expect(classifySnackFromChoreo).toBe(classifySnackTheater);
    expect(isTalkFromChoreo).toBe(isTalkTheater);

    const snackCases: Battle[] = [
      makeBattle({ command: "snack", message: "Fae eats a warm berry biscuit! +3 Energy." }),
      makeBattle({ message: "Fae shares a crisp Apple! Calm rises." }),
      makeBattle({ message: "Fae tosses Fish Crackers! Their favourite!" }),
      makeBattle({ command: "soothe", lastGrade: "great", message: "Great!" }),
    ];
    for (const sample of snackCases) {
      expect(classifySnackFromChoreo(sample)).toBe(classifySnackTheater(sample));
    }

    const talkCases: Battle[] = [
      makeBattle({ phase: "talk", talk: makeTalk() }),
      makeBattle({ phase: "talk", talk: null }),
      makeBattle({ phase: "soothed", talk: makeTalk() }),
      makeBattle({ phase: "reward", talk: makeTalk() }),
    ];
    for (const sample of talkCases) {
      expect(isTalkFromChoreo(sample)).toBe(isTalkTheater(sample));
    }
  });

  it("re-exports pure view-models identically from src/shell/assets.ts", () => {
    expect(cropCreditFromAssets).toBe(cropCreditFrame);
    expect(battleCheckFromAssets).toBe(battleCheckOverlay);
    expect(buildRewardFromAssets).toBe(buildRewardStickerView);
    expect(buildJournalFromAssets).toBe(buildJournalView);
    expect(buildDialogueFromAssets).toBe(buildDialogueView);
    expect(buildHudHintsFromAssets).toBe(buildHudHintsView);
    expect(buildBattleHudFromAssets).toBe(buildBattleHudView);
    expect(buildCreditsFromAssets).toBe(buildCreditsView);
  });

  it("keeps battle-choreography.ts and assets.ts under 800 lines and new modules Pixi-free", () => {
    const choreoLines = readFileSync("src/render/battle-choreography.ts", "utf8")
      .trimEnd()
      .split("\n").length;
    const assetsLines = readFileSync("src/shell/assets.ts", "utf8")
      .trimEnd()
      .split("\n").length;
    expect(choreoLines).toBeLessThan(800);
    expect(assetsLines).toBeLessThan(800);

    for (const file of ["src/render/battle-vfx.ts", "src/shell/view-models.ts"]) {
      const source = readFileSync(file, "utf8");
      expect(source, `${file} must not import pixi.js`).not.toMatch(/from\s+["']pixi\.js["']/);
    }
  });
});
