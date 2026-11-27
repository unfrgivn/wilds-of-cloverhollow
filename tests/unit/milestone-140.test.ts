import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Battle, BattleView } from "../../src/core";
import { computeBattleChoreography } from "../../src/render/battle-choreography";

function makeBattle(overrides: Partial<Battle> = {}): Battle {
  return {
    critterId: "fountain-frog",
    den: null,
    entry: { x: 800, y: 600 },
    phase: "command",
    message: "",
    revealed: 0,
    selected: 0,
    command: null,
    energy: 5,
    calm: 12,
    rest: {},
    check: null,
    lastGrade: null,
    feelings: ["zoomy", "curious"],
    answered: false,
    lanternPeek: false,
    turn: 1,
    windUp: null,
    talkMode: false,
    talk: null,
    talkTurns: 0,
    rewardSticker: null,
    phaseTicks: 0,
    ...overrides,
  };
}

function makeBattleView(battle: Battle, overrides: Partial<BattleView> = {}): BattleView {
  return {
    critterId: battle.critterId,
    critterName: "Fizzy Frog",
    battleHeight: 190,
    auraCentre: { x: 256, y: 256 },
    bodyCentre: { x: 256, y: 256 },
    phase: battle.phase,
    message: battle.message,
    revealed: battle.revealed,
    commands: [],
    selected: battle.selected,
    energy: battle.energy,
    energyMax: 5,
    calm: battle.calm,
    calmMax: 100,
    check: null,
    hint: null,
    feelings: null,
    windUp: null,
    puff: 0,
    lastGrade: battle.lastGrade,
    rewardSticker: battle.rewardSticker,
    talk: null,
    sparkle: null,
    fluteAssist: null,
    burstSoften: 0,
    lassoAssist: null,
    lassoSteady: false,
    treatTray: null,
    ...overrides,
  };
}

const partyIds = ["maddie", "sue", "jordan"] as const;
const partyCommands: Readonly<Record<string, string | null>> = {
  maddie: "play",
  sue: "cast",
  jordan: "juggle",
};

describe("Milestone 140: Automated UI CSS Reduced-Motion Parity Gate", () => {
  it("ensures every src/ui/*.css with prefers-reduced-motion mirrors data-reduced-motion", () => {
    const cssFiles = readdirSync("src/ui")
      .filter((name) => name.endsWith(".css"))
      .sort();
    const withMediaQuery: string[] = [];
    const missingInGameMirror: string[] = [];

    for (const file of cssFiles) {
      const css = readFileSync(join("src/ui", file), "utf8");
      if (css.includes("@media (prefers-reduced-motion: reduce)")) {
        withMediaQuery.push(file);
        if (!css.includes(':root[data-reduced-motion="on"]')) {
          missingInGameMirror.push(file);
        }
      }
    }

    expect(withMediaQuery.length).toBeGreaterThanOrEqual(13);
    expect(missingInGameMirror).toEqual([]);
  });

  it("verifies explicit data-reduced-motion rules across all 11 UI stylesheets", () => {
    const requiredSnippets: readonly { file: string; snippets: readonly string[] }[] = [
      {
        file: "src/ui/claw.css",
        snippets: [
          ':root[data-reduced-motion="on"] .arcade-plush.is-tug .arcade-plush-image',
          ':root[data-reduced-motion="on"] .arcade-claw',
        ],
      },
      {
        file: "src/ui/skee.css",
        snippets: [
          ':root[data-reduced-motion="on"] .skee-ball',
          ':root[data-reduced-motion="on"] .skee-pop:not([hidden])',
        ],
      },
      {
        file: "src/ui/mole.css",
        snippets: [
          ':root[data-reduced-motion="on"] .mole-sprite',
          ':root[data-reduced-motion="on"] .mole-pop:not([hidden])',
        ],
      },
      {
        file: "src/ui/comet.css",
        snippets: [
          ':root[data-reduced-motion="on"]',
          ".comet-stars",
          '.comet-rocket[data-frame="rocket-wobble"]',
        ],
      },
      {
        file: "src/ui/cook.css",
        snippets: [
          ':root[data-reduced-motion="on"] .cook-machine[data-phase="ding"] .cook-food',
          ':root[data-reduced-motion="on"] .cook-machine[data-phase="ding"] .cook-frost',
        ],
      },
      {
        file: "src/ui/fish.css",
        snippets: [
          ':root[data-reduced-motion="on"] .fish-reel-zone',
          ':root[data-reduced-motion="on"] .fish-bite-badge',
          ':root[data-reduced-motion="on"] .fish-catch-card',
        ],
      },
      {
        file: "src/ui/area-banner.css",
        snippets: [':root[data-reduced-motion="on"] .area-banner'],
      },
      {
        file: "src/ui/title.css",
        snippets: [
          ':root[data-reduced-motion="on"] .title-option',
          ':root[data-reduced-motion="on"] .title-confirm-button[aria-selected="true"]',
        ],
      },
      {
        file: "src/ui/touch-controls.css",
        snippets: [
          ':root[data-reduced-motion="on"] .touch-button',
          ':root[data-reduced-motion="on"] .touch-button:active',
        ],
      },
      {
        file: "src/ui/battle.css",
        snippets: [
          ':root[data-reduced-motion="on"] .battle-together-btn::after',
          ':root[data-reduced-motion="on"] .battle-popup',
          ':root[data-reduced-motion="on"] .battle-peek-card',
        ],
      },
      {
        file: "src/ui/journal.css",
        snippets: [
          ':root[data-reduced-motion="on"] .journal-slot.is-inspectable',
          ':root[data-reduced-motion="on"] .journal-map-star',
          ':root[data-reduced-motion="on"] .journal-field-left',
          ':root[data-reduced-motion="on"] .journal-treasures-title',
        ],
      },
    ];

    for (const { file, snippets } of requiredSnippets) {
      const css = readFileSync(file, "utf8");
      for (const snippet of snippets) {
        expect(css, `${file} missing "${snippet}"`).toContain(snippet);
      }
    }
  });
});

describe("Milestone 140: Minigame Safari / iOS Press-and-Hold Tap-Selection Hygiene", () => {
  const minigameCssExpectations: readonly { file: string; selectors: readonly string[] }[] = [
    { file: "src/ui/claw.css", selectors: [".arcade-overlay", ".arcade-machine"] },
    { file: "src/ui/skee.css", selectors: [".skee-overlay", ".skee-frame", ".skee-machine"] },
    {
      file: "src/ui/mole.css",
      selectors: [".mole-overlay", ".mole-machine", ".mole-hole", ".mole-hit"],
    },
    { file: "src/ui/comet.css", selectors: [".comet-overlay", ".comet-machine", ".comet-key"] },
    { file: "src/ui/cook.css", selectors: [".cook-overlay", ".cook-machine"] },
    { file: "src/ui/fish.css", selectors: [".fish-overlay", ".fish-stage"] },
  ];

  it("declares user-select & -webkit-touch-callout none in all 6 minigame stylesheets", () => {
    for (const { file, selectors } of minigameCssExpectations) {
      const css = readFileSync(file, "utf8");
      expect(css, `${file} missing user-select: none`).toContain("user-select: none;");
      expect(css, `${file} missing -webkit-user-select: none`).toContain(
        "-webkit-user-select: none;",
      );
      expect(css, `${file} missing -webkit-touch-callout: none`).toContain(
        "-webkit-touch-callout: none;",
      );
      for (const selector of selectors) {
        expect(css, `${file} missing selector ${selector}`).toContain(selector);
      }
    }
  });
});

describe("Milestone 140: Battle Wind-Up, Burst, Together! & Soothed Reduced-Motion Guards", () => {
  it("suppresses wind-up micro-tremble and spinning fizz under reducedMotion", () => {
    const windUpBattle = makeBattle({
      phase: "command",
      windUp: { feelings: ["zoomy", "curious"], popped: [false, false], left: 1 },
    });

    const normalDefault = computeBattleChoreography(
      windUpBattle,
      null,
      7,
      partyIds,
      partyCommands,
    );
    const normalFalse = computeBattleChoreography(
      windUpBattle,
      null,
      7,
      partyIds,
      partyCommands,
      false,
    );
    expect(normalFalse).toEqual(normalDefault);
    expect(normalFalse.stageMood).toBe("windup");
    expect(normalFalse.critter.offsetX).not.toBe(0);
    expect(normalFalse.critter.rotation).not.toBe(0);

    const reducedA = computeBattleChoreography(
      windUpBattle,
      null,
      7,
      partyIds,
      partyCommands,
      true,
    );
    const reducedB = computeBattleChoreography(
      windUpBattle,
      null,
      31,
      partyIds,
      partyCommands,
      true,
    );
    expect(reducedA.stageMood).toBe("windup");
    expect(reducedA.critter.offsetX).toBe(0);
    expect(reducedA.critter.rotation).toBe(0);
    expect(reducedB.critter.offsetX).toBe(0);
    expect(reducedB.critter.rotation).toBe(0);
    expect(reducedA.vfx).toHaveLength(4);
    expect(reducedA.vfx).toEqual(reducedB.vfx);
    expect(reducedA.vfx.every((p) => p.rotation === 0)).toBe(true);
  });

  it("suppresses stageShake in burstResult and impact result under reducedMotion", () => {
    const burstMiss = makeBattle({
      phase: "burstResult",
      lastGrade: "miss",
      phaseTicks: 3,
    });
    const normalBurst = computeBattleChoreography(
      burstMiss,
      null,
      15,
      partyIds,
      partyCommands,
      false,
    );
    const reducedBurst = computeBattleChoreography(
      burstMiss,
      null,
      15,
      partyIds,
      partyCommands,
      true,
    );
    expect(normalBurst.stageShake.x).not.toBe(0);
    expect(normalBurst.fae.rotation).not.toBe(0);
    expect(reducedBurst.stageShake).toEqual({ x: 0, y: 0 });
    expect(reducedBurst.fae.rotation).toBe(0);

    const impactResult = makeBattle({
      phase: "result",
      command: "soothe",
      lastGrade: "great",
      phaseTicks: 1,
    });
    const normalImpact = computeBattleChoreography(
      impactResult,
      null,
      15,
      partyIds,
      partyCommands,
      false,
    );
    const reducedImpact = computeBattleChoreography(
      impactResult,
      null,
      15,
      partyIds,
      partyCommands,
      true,
    );
    expect(normalImpact.stageShake.x).not.toBe(0);
    expect(reducedImpact.stageShake).toEqual({ x: 0, y: 0 });
  });

  it("keeps Together! ready/active and soothed/reward petals calm under reducedMotion", () => {
    const readyBattle = makeBattle({ phase: "command", sparkle: 3 });
    const readyView = makeBattleView(readyBattle, {
      sparkle: { count: 3, max: 3, ready: true },
    });
    const readyReducedA = computeBattleChoreography(
      readyBattle,
      readyView,
      12,
      partyIds,
      partyCommands,
      true,
    );
    const readyReducedB = computeBattleChoreography(
      readyBattle,
      readyView,
      47,
      partyIds,
      partyCommands,
      true,
    );
    expect(readyReducedA.stageMood).toBe("together-ready");
    expect(readyReducedA.vfx).toEqual(readyReducedB.vfx);
    expect(readyReducedA.vfx.every((p) => p.rotation === 0)).toBe(true);

    const activeBattle = makeBattle({
      phase: "check",
      command: "together",
      phaseTicks: 8,
    });
    const activeReducedA = computeBattleChoreography(
      activeBattle,
      null,
      12,
      partyIds,
      partyCommands,
      true,
    );
    const activeReducedB = computeBattleChoreography(
      activeBattle,
      null,
      47,
      partyIds,
      partyCommands,
      true,
    );
    expect(activeReducedA.stageMood).toBe("together-active");
    expect(activeReducedA.vfx).toEqual(activeReducedB.vfx);
    expect(activeReducedA.vfx.every((p) => p.rotation === 0)).toBe(true);

    const soothedBattle = makeBattle({ phase: "soothed", phaseTicks: 10 });
    const soothedNormal = computeBattleChoreography(
      soothedBattle,
      null,
      18,
      partyIds,
      partyCommands,
      false,
    );
    const soothedReducedA = computeBattleChoreography(
      soothedBattle,
      null,
      18,
      partyIds,
      partyCommands,
      true,
    );
    const soothedReducedB = computeBattleChoreography(
      soothedBattle,
      null,
      54,
      partyIds,
      partyCommands,
      true,
    );
    expect(soothedNormal.vfx.some((p) => p.rotation !== 0)).toBe(true);
    expect(soothedReducedA.vfx).toEqual(soothedReducedB.vfx);
    expect(soothedReducedA.vfx.every((p) => p.rotation === 0)).toBe(true);
  });
});
