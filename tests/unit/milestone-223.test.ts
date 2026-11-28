import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Battle, BattleFoe } from "../../src/core";
import * as clubhouseDecorMath from "../../src/render/clubhouse-decor-math";
import * as clubhouseDisplay from "../../src/render/clubhouse-display";
import * as cutsceneMath from "../../src/render/cutscene-math";
import * as cutsceneRender from "../../src/render/cutscene-render";
import { didSwitchBattleTarget, hapticForTick } from "../../src/shell/feedback";
import * as postcard from "../../src/ui/postcard";
import * as postcardCanvas from "../../src/ui/postcard-canvas";

function lineCount(filePath: string): number {
  return readFileSync(filePath, "utf8").trimEnd().split("\n").length;
}

function makeFoe(overrides: Partial<BattleFoe> = {}): BattleFoe {
  return {
    critterId: "pup",
    calm: 0,
    calmMax: 30,
    soothed: false,
    feelings: [],
    windUp: null,
    ...overrides,
  };
}

function makeBattle(overrides: Partial<Battle> = {}): Battle {
  return {
    critterId: "pup",
    den: null,
    entry: { x: 0, y: 0 },
    phase: "command",
    message: "Choose a way to help!",
    revealed: 21,
    selected: 0,
    command: "soothe",
    energy: 12,
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
    ...overrides,
  };
}

describe("Milestone 223: Battle Target-Switch Foley/Haptic & Modular Splits (Track E19N)", () => {
  it("detects genuine multi-foe command-phase target switches in didSwitchBattleTarget", () => {
    const pup = makeFoe({ critterId: "pup" });
    const crab = makeFoe({ critterId: "crab" });
    const duo0 = makeBattle({ targetIndex: 0, foes: [pup, crab] });
    const duo1 = makeBattle({ critterId: "crab", targetIndex: 1, foes: [pup, crab] });

    // Genuine target switches in multi-foe command phase return true and trigger light haptic.
    expect(didSwitchBattleTarget({ battle: duo0 }, { battle: duo1 })).toBe(true);
    expect(didSwitchBattleTarget({ battle: duo1 }, { battle: duo0 })).toBe(true);
    expect(hapticForTick({ battle: duo0 }, { battle: duo1 }, [])).toBe("light");
    expect(hapticForTick({ battle: duo1 }, { battle: duo0 }, [])).toBe("light");

    // Null battle or unchanged targetIndex stays silent.
    expect(didSwitchBattleTarget({ battle: null }, { battle: duo0 })).toBe(false);
    expect(didSwitchBattleTarget({ battle: duo0 }, { battle: null })).toBe(false);
    expect(didSwitchBattleTarget({ battle: duo0 }, { battle: duo0 })).toBe(false);
    expect(hapticForTick({ battle: duo0 }, { battle: duo0 }, [])).toBeNull();

    // Single-foe battles (omitted or 1-entry foes) never fire target-switch feedback.
    const single0 = makeBattle({ targetIndex: 0 });
    const single1 = makeBattle({ targetIndex: 1 });
    expect(didSwitchBattleTarget({ battle: single0 }, { battle: single1 })).toBe(false);
    const solo0 = makeBattle({ targetIndex: 0, foes: [pup] });
    const solo1 = makeBattle({ targetIndex: 1, foes: [pup] });
    expect(didSwitchBattleTarget({ battle: solo0 }, { battle: solo1 })).toBe(false);

    // Non-command phases (or phase transitions into command) stay silent.
    const duoResult = makeBattle({ phase: "result", targetIndex: 0, foes: [pup, crab] });
    const duoCheck = makeBattle({ phase: "check", targetIndex: 1, foes: [pup, crab] });
    expect(didSwitchBattleTarget({ battle: duoResult }, { battle: duo1 })).toBe(false);
    expect(didSwitchBattleTarget({ battle: duo0 }, { battle: duoCheck })).toBe(false);
    expect(didSwitchBattleTarget({ battle: duoResult }, { battle: duoCheck })).toBe(false);

    // Auto-advancing targetIndex when the previous foe just became soothed must NOT fire.
    const duo0Soothed = makeBattle({
      critterId: "crab",
      targetIndex: 1,
      foes: [{ ...pup, calm: 30, soothed: true }, crab],
    });
    expect(didSwitchBattleTarget({ battle: duo0 }, { battle: duo0Soothed })).toBe(false);
    expect(hapticForTick({ battle: duo0 }, { battle: duo0Soothed }, [])).toBeNull();
  });

  it("preserves reference-identical re-exports across all three extracted modules", () => {
    // cutscene-math.ts -> cutscene-render.ts
    expect(cutsceneRender.CUTSCENE_LETTERBOX_MAX_PX).toBe(cutsceneMath.CUTSCENE_LETTERBOX_MAX_PX);
    expect(cutsceneRender.computeLetterboxHeight).toBe(cutsceneMath.computeLetterboxHeight);
    expect(cutsceneRender.computeCutscenePoseTransform).toBe(
      cutsceneMath.computeCutscenePoseTransform,
    );
    expect(cutsceneRender.cutsceneEmoteTextureKey).toBe(cutsceneMath.cutsceneEmoteTextureKey);
    expect(cutsceneRender.computeCutsceneBurstParticles).toBe(
      cutsceneMath.computeCutsceneBurstParticles,
    );
    expect(cutsceneRender.resolveCutsceneEmoteAnchor).toBe(
      cutsceneMath.resolveCutsceneEmoteAnchor,
    );
    expect(cutsceneRender.cutsceneAreaAtlases).toBe(cutsceneMath.cutsceneAreaAtlases);

    // postcard-canvas.ts -> postcard.ts
    expect(postcard.composePostcardFrame).toBe(postcardCanvas.composePostcardFrame);
    expect(postcard.composePostcard).toBe(postcardCanvas.composePostcard);

    // clubhouse-decor-math.ts -> clubhouse-display.ts
    expect(clubhouseDisplay.ENCORE_TROPHY_PERCH).toBe(clubhouseDecorMath.ENCORE_TROPHY_PERCH);
    expect(clubhouseDisplay.evaluateEncoreTrophySparkles).toBe(
      clubhouseDecorMath.evaluateEncoreTrophySparkles,
    );
    expect(clubhouseDisplay.hasSunberryBloom).toBe(clubhouseDecorMath.hasSunberryBloom);
    expect(clubhouseDisplay.evaluateSunberryMotes).toBe(clubhouseDecorMath.evaluateSunberryMotes);
    expect(clubhouseDisplay.evaluateBedroomDisplay).toBe(
      clubhouseDecorMath.evaluateBedroomDisplay,
    );
    expect(clubhouseDisplay.evaluateClubhouseDecor).toBe(
      clubhouseDecorMath.evaluateClubhouseDecor,
    );
  });

  it("enforces Pixi/DOM purity and strict line budgets for Milestone 223 splits", () => {
    for (const filePath of [
      "src/render/cutscene-math.ts",
      "src/render/clubhouse-decor-math.ts",
    ] as const) {
      const src = readFileSync(filePath, "utf8");
      const code = src.replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
      expect(code, `${filePath} must be Pixi-free`).not.toMatch(/from\s+["']pixi\.js["']/);
      expect(code, `${filePath} must be DOM-free`).not.toMatch(
        /\b(document|window|HTMLElement)\b/,
      );
    }

    expect(lineCount("src/render/cutscene-render.ts")).toBeLessThan(420);
    expect(lineCount("src/render/cutscene-math.ts")).toBeLessThan(400);
    expect(lineCount("src/ui/postcard.ts")).toBeLessThan(420);
    expect(lineCount("src/ui/postcard-canvas.ts")).toBeLessThan(390);
    expect(lineCount("src/render/clubhouse-display.ts")).toBeLessThan(420);
    expect(lineCount("src/render/clubhouse-decor-math.ts")).toBeLessThan(380);
  });
});
