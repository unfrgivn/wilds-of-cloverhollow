import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadContent } from "../../src/content/load";
import {
  viewCheckV2,
  type Battle,
  type BattleCheckView,
  type BattleView,
  type CheckState,
  type SpinSnagState,
  type WhackState,
  type WhichOneState,
} from "../../src/core";
import * as BattleChoreo from "../../src/render/battle-choreography";
import {
  computeBattleChoreography,
  emitSpinSnagVfx,
  emitWhackVfx,
  emitWhichOneVfx,
  RAINBOW_LASSO_COLORS,
  SPIN_SNAG_COLORS,
  WHACK_VFX_COLORS,
  WHICH_ONE_VFX_COLORS,
  type BattleVfxParticle,
} from "../../src/render/battle-choreography";
import * as BattleVfx from "../../src/render/battle-vfx";
import * as BattleVfxChecksV2 from "../../src/render/battle-vfx-checks-v2";
import * as BattleVfxStage from "../../src/render/battle-vfx-stage";
import { hapticForTick } from "../../src/shell/feedback";

const partyIds: readonly string[] = ["maddie", "sue", "jordan"];
const partyCommands: Readonly<Record<string, string | null>> = {
  maddie: "play",
  sue: "cast",
  jordan: "juggle",
};

function makeBattle(overrides: Partial<Battle> = {}): Battle {
  return {
    critterId: "raccoon",
    den: null,
    entry: { x: 500, y: 500 },
    phase: "check",
    message: "Watch the cups!",
    revealed: 15,
    selected: 0,
    command: "soothe",
    energy: 5,
    calm: 0,
    rest: {},
    check: null,
    lastGrade: null,
    feelings: ["curious"],
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

function makeBattleView(battle: Battle, check: BattleCheckView | null = null): BattleView {
  return {
    critterId: battle.critterId,
    critterName: "Sneaky Raccoon",
    battleHeight: 145,
    auraCentre: { x: 256, y: 256 },
    bodyCentre: { x: 256, y: 256 },
    phase: battle.phase,
    activeActor: { id: "fae", name: "Fae" },
    message: battle.message,
    revealed: battle.revealed,
    commands: [],
    selected: battle.selected,
    energy: battle.energy,
    energyMax: 5,
    calm: battle.calm,
    calmMax: 100,
    check,
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
  };
}

function makeWhichOneCheck(overrides: Partial<WhichOneState> = {}): WhichOneState {
  return {
    kind: "which-one",
    side: "fae",
    tick: 12,
    spec: { kind: "which-one", showTicks: 24, shuffles: 3, swapTicks: 18, pickTicks: 120 },
    hidingCup: 1,
    swaps: [
      [0, 1],
      [1, 2],
      [0, 2],
    ],
    cursor: 1,
    picked: null,
    big: false,
    ...overrides,
  };
}

function makeWhackCheck(overrides: Partial<WhackState> = {}): WhackState {
  return {
    kind: "whack",
    side: "fae",
    tick: 18,
    spec: { kind: "whack", pops: 5, stayTicks: 28, gapTicks: 10 },
    slots: ["up", "right", "middle", "left", "down"],
    results: ["pending", "pending", "pending", "pending", "pending"],
    lastSwing: null,
    big: false,
    ...overrides,
  };
}

function makeSpinSnagCheck(overrides: Partial<SpinSnagState> = {}): SpinSnagState {
  return {
    kind: "spin-snag",
    side: "critter",
    tick: 14,
    spec: {
      kind: "spin-snag",
      spinsNeeded: 6,
      spinTicks: 150,
      snagTicks: 60,
      targetTick: 32,
      greatWindow: 5,
      goodWindow: 10,
    },
    lastSector: 1,
    turns: 3,
    snagTick: 0,
    big: false,
    ...overrides,
  };
}

const { world } = loadContent();

describe("Milestone 198: Complete 11-of-11 Battle Stage VFX Re-exports & Budgets", () => {
  it("re-exports all 3 v2 check emitters & palettes identically across render entrypoints", () => {
    expect(BattleVfxStage.emitWhichOneVfx).toBe(BattleVfxChecksV2.emitWhichOneVfx);
    expect(BattleVfxStage.emitWhackVfx).toBe(BattleVfxChecksV2.emitWhackVfx);
    expect(BattleVfxStage.emitSpinSnagVfx).toBe(BattleVfxChecksV2.emitSpinSnagVfx);
    expect(BattleVfxStage.WHICH_ONE_VFX_COLORS).toBe(BattleVfxChecksV2.WHICH_ONE_VFX_COLORS);
    expect(BattleVfxStage.WHACK_VFX_COLORS).toBe(BattleVfxChecksV2.WHACK_VFX_COLORS);
    expect(BattleVfxStage.SPIN_SNAG_COLORS).toBe(BattleVfxChecksV2.SPIN_SNAG_COLORS);
    expect(BattleVfxStage.RAINBOW_LASSO_COLORS).toBe(BattleVfxChecksV2.RAINBOW_LASSO_COLORS);

    expect(BattleVfx.emitWhichOneVfx).toBe(BattleVfxChecksV2.emitWhichOneVfx);
    expect(BattleVfx.emitWhackVfx).toBe(BattleVfxChecksV2.emitWhackVfx);
    expect(BattleVfx.emitSpinSnagVfx).toBe(BattleVfxChecksV2.emitSpinSnagVfx);
    expect(BattleVfx.WHICH_ONE_VFX_COLORS).toBe(BattleVfxChecksV2.WHICH_ONE_VFX_COLORS);
    expect(BattleVfx.WHACK_VFX_COLORS).toBe(BattleVfxChecksV2.WHACK_VFX_COLORS);
    expect(BattleVfx.SPIN_SNAG_COLORS).toBe(BattleVfxChecksV2.SPIN_SNAG_COLORS);

    expect(BattleChoreo.emitWhichOneVfx).toBe(BattleVfxChecksV2.emitWhichOneVfx);
    expect(BattleChoreo.emitWhackVfx).toBe(BattleVfxChecksV2.emitWhackVfx);
    expect(BattleChoreo.emitSpinSnagVfx).toBe(BattleVfxChecksV2.emitSpinSnagVfx);
    expect(BattleChoreo.WHICH_ONE_VFX_COLORS).toBe(BattleVfxChecksV2.WHICH_ONE_VFX_COLORS);
    expect(BattleChoreo.WHACK_VFX_COLORS).toBe(BattleVfxChecksV2.WHACK_VFX_COLORS);
    expect(BattleChoreo.SPIN_SNAG_COLORS).toBe(BattleVfxChecksV2.SPIN_SNAG_COLORS);
    expect(SPIN_SNAG_COLORS.lasso).toBe(RAINBOW_LASSO_COLORS);
    expect(RAINBOW_LASSO_COLORS).toHaveLength(7);
  });

  it("keeps every touched src/ module strictly under 1,000 lines", () => {
    const files = [
      "src/render/battle-vfx-checks-v2.ts",
      "src/render/battle-vfx-stage.ts",
      "src/render/battle-vfx.ts",
      "src/render/battle-choreography.ts",
      "src/shell/feedback.ts",
      "src/main.ts",
    ];
    for (const file of files) {
      const lines = readFileSync(file, "utf8").split("\n").length;
      expect(lines, `${file} must stay < 1000 lines`).toBeLessThan(1000);
    }
  });
});

describe("Milestone 198: which-one Cup Shuffle Stage VFX & Reduced Motion", () => {
  it("choreographs show, shuffle, and pick phases via computeBattleChoreography", () => {
    const showCheck = makeWhichOneCheck({ tick: 10 });
    const showBattle = makeBattle({ check: showCheck });
    const showChoreo = computeBattleChoreography(
      showBattle,
      makeBattleView(showBattle, viewCheckV2(showCheck)),
      10,
      partyIds,
      partyCommands,
      false,
    );
    const showGlows = showChoreo.vfx.filter(
      (p) => p.texture === "softGlow" && p.anchor === "critter",
    );
    const showSparkles = showChoreo.vfx.filter(
      (p) => p.texture === "sparkle" && p.anchor === "critter",
    );
    expect(showGlows).toHaveLength(1);
    expect(showGlows[0]?.tint).toBe(WHICH_ONE_VFX_COLORS.glow);
    expect(showSparkles).toHaveLength(3);
    expect(showChoreo.critter.offsetY).toBeLessThan(-3);

    const shuffleCheck = makeWhichOneCheck({ tick: 36 });
    const shuffleBattle = makeBattle({ check: shuffleCheck });
    const shuffleChoreo = computeBattleChoreography(
      shuffleBattle,
      makeBattleView(shuffleBattle, viewCheckV2(shuffleCheck)),
      36,
      partyIds,
      partyCommands,
      false,
    );
    const ribbons = shuffleChoreo.vfx.filter(
      (p) => p.texture === "mistWisp" && p.anchor === "between",
    );
    const shuffleSparkles = shuffleChoreo.vfx.filter(
      (p) => p.texture === "sparkle" && p.anchor === "between",
    );
    expect(ribbons).toHaveLength(3);
    expect(shuffleSparkles).toHaveLength(4);
    expect(shuffleChoreo.fae.offsetX).toBe(6);

    const pickCheck = makeWhichOneCheck({ tick: 90 });
    const pickBattle = makeBattle({ check: pickCheck });
    const pickChoreo = computeBattleChoreography(
      pickBattle,
      makeBattleView(pickBattle, viewCheckV2(pickCheck)),
      90,
      partyIds,
      partyCommands,
      false,
    );
    const pickRings = pickChoreo.vfx.filter(
      (p) => p.texture === "energyRing" && p.anchor === "fae",
    );
    const pickSparkles = pickChoreo.vfx.filter(
      (p) => p.texture === "sparkle" && p.anchor === "fae",
    );
    expect(pickRings).toHaveLength(1);
    expect(pickRings[0]?.tint).toBe(WHICH_ONE_VFX_COLORS.pickRing);
    expect(pickSparkles).toHaveLength(3);
  });

  it("enforces rotation === 0, zero motion, and steady placement under reducedMotion", () => {
    for (const tickVal of [10, 36, 90]) {
      const check = makeWhichOneCheck({ tick: tickVal });
      const view = viewCheckV2(check);
      if (view.kind !== "which-one") throw new Error("expected which-one view");
      const vfxA: BattleVfxParticle[] = [];
      const vfxB: BattleVfxParticle[] = [];
      const motionA = emitWhichOneVfx(vfxA, check, view, 12, true);
      const motionB = emitWhichOneVfx(vfxB, check, view, 87, true);
      expect(motionA).toEqual({ critterOffsetY: 0, faeOffsetX: 0 });
      expect(motionB).toEqual({ critterOffsetY: 0, faeOffsetX: 0 });
      expect(vfxA.length).toBeGreaterThan(0);
      expect(vfxA).toEqual(vfxB);
      for (const particle of vfxA) {
        expect(particle.rotation).toBe(0);
      }
    }
  });
});

describe("Milestone 198: whack Arcade Ticket Slots Stage VFX & Reduced Motion", () => {
  it("emits coral-gold starburst on hit, lavender puff on miss, and 2..4 ticket motes", () => {
    const idleCheck = makeWhackCheck();
    const idleVfx: BattleVfxParticle[] = [];
    const idleMotion = emitWhackVfx(idleVfx, idleCheck, null, 18, false);
    expect(idleMotion).toEqual({ faeOffsetX: 0, faeRotation: 0 });
    expect(idleVfx.filter((p) => p.texture === "sparkle")).toHaveLength(2);

    const hitCheck = makeWhackCheck({
      results: ["hit", "hit", "pending", "pending", "pending"],
      lastSwing: { slot: "right", hit: true, ticksLeft: 8 },
    });
    const hitBattle = makeBattle({ check: hitCheck });
    const hitChoreo = computeBattleChoreography(
      hitBattle,
      makeBattleView(hitBattle, viewCheckV2(hitCheck)),
      24,
      partyIds,
      partyCommands,
      false,
    );
    const glows = hitChoreo.vfx.filter((p) => p.texture === "softGlow" && p.anchor === "between");
    const sparkles = hitChoreo.vfx.filter((p) => p.texture === "sparkle" && p.anchor === "between");
    expect(glows).toHaveLength(1);
    expect(glows[0]?.tint).toBe(WHACK_VFX_COLORS.hitGlow);
    // 4 starburst hit sparkles + 4 corridor motes (2 + 2 hits).
    expect(sparkles).toHaveLength(8);
    expect(hitChoreo.fae.offsetX).toBeGreaterThan(0);
    expect(hitChoreo.fae.rotation).toBeGreaterThan(0);

    const missCheck = makeWhackCheck({
      results: ["hit", "miss", "pending", "pending", "pending"],
      lastSwing: { slot: "left", hit: false, ticksLeft: 7 },
    });
    const missVfx: BattleVfxParticle[] = [];
    const missMotion = emitWhackVfx(missVfx, missCheck, null, 30, false);
    expect(missMotion).toEqual({ faeOffsetX: 0, faeRotation: 0 });
    const puffs = missVfx.filter((p) => p.texture === "puff" && p.anchor === "between");
    expect(puffs).toHaveLength(1);
    expect(puffs[0]?.tint).toBe(WHACK_VFX_COLORS.missPuff);
    // 1 hit -> 3 corridor ticket motes.
    expect(missVfx.filter((p) => p.texture === "sparkle")).toHaveLength(3);
  });

  it("enforces rotation === 0, zero bounce, and steady placement under reducedMotion", () => {
    const checks: readonly WhackState[] = [
      makeWhackCheck({
        results: ["hit", "pending", "pending", "pending", "pending"],
        lastSwing: { slot: "up", hit: true, ticksLeft: 9 },
      }),
      makeWhackCheck({
        results: ["miss", "pending", "pending", "pending", "pending"],
        lastSwing: { slot: "down", hit: false, ticksLeft: 6 },
      }),
    ];
    for (const check of checks) {
      const view = viewCheckV2(check);
      if (view.kind !== "whack") throw new Error("expected whack view");
      const vfxA: BattleVfxParticle[] = [];
      const vfxB: BattleVfxParticle[] = [];
      const motionA = emitWhackVfx(vfxA, check, view, 15, true);
      const motionB = emitWhackVfx(vfxB, check, view, 65, true);
      expect(motionA).toEqual({ faeOffsetX: 0, faeRotation: 0 });
      expect(motionB).toEqual({ faeOffsetX: 0, faeRotation: 0 });
      expect(vfxA).toEqual(vfxB);
      for (const particle of vfxA) {
        expect(particle.rotation).toBe(0);
      }
    }
  });
});

describe("Milestone 198: spin-snag Rainbow Lasso Stage VFX & Reduced Motion", () => {
  it("choreographs orbiting 7-color spin halo and rainbow Bézier snag arc + critter ring", () => {
    const lowSpinCheck = makeSpinSnagCheck({ turns: 1 });
    const highSpinCheck = makeSpinSnagCheck({ turns: 5 });
    const lowVfx: BattleVfxParticle[] = [];
    const highVfx: BattleVfxParticle[] = [];
    const lowMotion = emitSpinSnagVfx(lowVfx, lowSpinCheck, null, 20, false);
    const highMotion = emitSpinSnagVfx(highVfx, highSpinCheck, null, 20, false);

    const lowRing = lowVfx.find((p) => p.texture === "energyRing" && p.anchor === "fae");
    const highRing = highVfx.find((p) => p.texture === "energyRing" && p.anchor === "fae");
    expect(lowRing).toBeDefined();
    expect(highRing).toBeDefined();
    expect((highRing?.alpha ?? 0)).toBeGreaterThan(lowRing?.alpha ?? 0);
    expect((highRing?.scaleX ?? 0)).toBeGreaterThan(lowRing?.scaleX ?? 0);
    const spinBeads = highVfx.filter((p) => p.texture === "sparkle" && p.anchor === "fae");
    expect(spinBeads).toHaveLength(7);
    expect(spinBeads.map((b) => b.tint)).toEqual([...RAINBOW_LASSO_COLORS]);
    expect(
      Math.abs(lowMotion.faeOffsetX) +
        Math.abs(lowMotion.faeOffsetY) +
        Math.abs(lowMotion.faeRotation),
    ).toBeGreaterThan(0);
    expect(
      Math.abs(highMotion.faeOffsetX) +
        Math.abs(highMotion.faeOffsetY) +
        Math.abs(highMotion.faeRotation),
    ).toBeGreaterThan(0);

    const snagCheck = makeSpinSnagCheck({ turns: 6, snagTick: 28 });
    const snagBattle = makeBattle({
      command: "combo:bubblegum-lasso-spin",
      check: snagCheck,
    });
    const snagChoreo = computeBattleChoreography(
      snagBattle,
      makeBattleView(snagBattle, viewCheckV2(snagCheck)),
      42,
      partyIds,
      partyCommands,
      false,
    );
    const rainbowArcGlows = snagChoreo.vfx.filter(
      (p) => p.texture === "softGlow" && p.anchor === "between",
    );
    const snagCritterRing = snagChoreo.vfx.find(
      (p) => p.texture === "energyRing" && p.anchor === "critter",
    );
    expect(rainbowArcGlows).toHaveLength(7);
    expect(rainbowArcGlows.map((g) => g.tint)).toEqual([...RAINBOW_LASSO_COLORS]);
    expect(snagCritterRing?.tint).toBe(SPIN_SNAG_COLORS.snagRing);
    expect(snagChoreo.vfx.length).toBeLessThanOrEqual(80);
  });

  it("enforces rotation === 0, zero sway, and tick-invariant placement under reducedMotion", () => {
    const checks: readonly SpinSnagState[] = [
      makeSpinSnagCheck({ turns: 3, snagTick: 0 }),
      makeSpinSnagCheck({ turns: 6, snagTick: 24 }),
    ];
    for (const check of checks) {
      const view = viewCheckV2(check);
      if (view.kind !== "spin-snag") throw new Error("expected spin-snag view");
      const vfxA: BattleVfxParticle[] = [];
      const vfxB: BattleVfxParticle[] = [];
      const motionA = emitSpinSnagVfx(vfxA, check, view, 10, true);
      const motionB = emitSpinSnagVfx(vfxB, check, view, 95, true);
      expect(motionA).toEqual({ faeOffsetX: 0, faeOffsetY: 0, faeRotation: 0 });
      expect(motionB).toEqual({ faeOffsetX: 0, faeOffsetY: 0, faeRotation: 0 });
      expect(vfxA).toEqual(vfxB);
      for (const particle of vfxA) {
        expect(particle.rotation).toBe(0);
      }
    }
  });
});

describe("Milestone 198: E7 Dual-Combo, Boss Phase-2, Whack & Spin-Snag Haptics", () => {
  it("fires celebrate on Dual-Friend Synergy Combo start without double-firing", () => {
    const commandBattle = makeBattle({ phase: "command", command: null, check: null });
    const comboCheck = makeBattle({
      phase: "check",
      command: "combo:bubblegum-lasso-spin",
      check: makeSpinSnagCheck({ turns: 0 }),
    });
    const comboCheckNext = makeBattle({
      phase: "check",
      command: "combo:bubblegum-lasso-spin",
      check: makeSpinSnagCheck({ turns: 0, tick: 2 }),
    });
    const repeatCommand = makeBattle({
      phase: "command",
      command: "combo:bubblegum-lasso-spin",
      check: null,
    });

    expect(hapticForTick({ battle: commandBattle }, { battle: comboCheck }, [])).toBe("celebrate");
    expect(hapticForTick({ battle: comboCheck }, { battle: comboCheckNext }, [])).toBeNull();
    // Re-triggering the same Dual Combo on a later turn also celebrates cleanly.
    expect(hapticForTick({ battle: repeatCommand }, { battle: comboCheck }, [])).toBe("celebrate");
  });

  it("fires celebrate once on Boss Phase-2 transition for single-foe and multi-foe bosses", () => {
    const gull = world.critters.gull;
    if (gull === undefined) throw new Error("Missing gull critter");
    const gullHalf = Math.ceil(gull.calmMax * 0.5);

    // Single-foe mini-boss crossing 50% calm.
    const gullPhase1 = makeBattle({ critterId: "gull", phase: "check", calm: gullHalf - 10 });
    const gullPhase2 = makeBattle({ critterId: "gull", phase: "result", calm: gullHalf + 5 });
    const gullPhase2Later = makeBattle({ critterId: "gull", phase: "command", calm: gullHalf + 5 });
    expect(
      hapticForTick({ battle: gullPhase1 }, { battle: gullPhase2 }, [], { world }),
    ).toBe("celebrate");
    expect(
      hapticForTick({ battle: gullPhase2 }, { battle: gullPhase2Later }, [], { world }),
    ).toBeNull();

    // Multi-foe arcade-encore Mr. Pip crossing 50% calm (80 / 160) even without world option.
    const pipFoeBefore = {
      critterId: "arcade-keeper",
      calm: 64,
      calmMax: 160,
      soothed: false,
      feelings: [],
      windUp: null,
    };
    const pupFoe = {
      critterId: "pup",
      calm: 10,
      calmMax: 70,
      soothed: false,
      feelings: [],
      windUp: null,
    };
    const encoreP1 = makeBattle({
      critterId: "arcade-keeper",
      phase: "check",
      calm: 64,
      targetIndex: 0,
      foes: [pipFoeBefore, pupFoe],
    });
    const encoreP2 = makeBattle({
      critterId: "arcade-keeper",
      phase: "result",
      calm: 92,
      targetIndex: 0,
      foes: [{ ...pipFoeBefore, calm: 92 }, pupFoe],
    });
    const encoreSwitchedTarget = makeBattle({
      critterId: "pup",
      phase: "command",
      calm: 10,
      targetIndex: 1,
      foes: [{ ...pipFoeBefore, calm: 92 }, pupFoe],
    });
    const encoreSwitchedBack = makeBattle({
      critterId: "arcade-keeper",
      phase: "command",
      calm: 92,
      targetIndex: 0,
      foes: [{ ...pipFoeBefore, calm: 92 }, pupFoe],
    });
    expect(hapticForTick({ battle: encoreP1 }, { battle: encoreP2 }, [])).toBe("celebrate");
    // Switching targetIndex to/from a boss already in Phase 2 must NOT re-trigger celebrate.
    expect(hapticForTick({ battle: encoreP2 }, { battle: encoreSwitchedTarget }, [])).toBeNull();
    expect(
      hapticForTick({ battle: encoreSwitchedTarget }, { battle: encoreSwitchedBack }, []),
    ).toBeNull();
  });

  it("fires light on whack hits and spin-snag lasso turns without firing on misses", () => {
    const whack0 = makeBattle({
      phase: "check",
      check: makeWhackCheck({ results: ["pending", "pending", "pending", "pending", "pending"] }),
    });
    const whack1Hit = makeBattle({
      phase: "check",
      check: makeWhackCheck({
        results: ["hit", "pending", "pending", "pending", "pending"],
        lastSwing: { slot: "up", hit: true, ticksLeft: 10 },
      }),
    });
    const whack1Miss = makeBattle({
      phase: "check",
      check: makeWhackCheck({
        results: ["hit", "miss", "pending", "pending", "pending"],
        lastSwing: { slot: "down", hit: false, ticksLeft: 10 },
      }),
    });
    expect(hapticForTick({ battle: whack0 }, { battle: whack1Hit }, [])).toBe("light");
    expect(hapticForTick({ battle: whack1Hit }, { battle: whack1Hit }, [])).toBeNull();
    expect(hapticForTick({ battle: whack1Hit }, { battle: whack1Miss }, [])).toBeNull();

    const spin0 = makeBattle({
      phase: "check",
      command: "combo:bubblegum-lasso-spin",
      check: makeSpinSnagCheck({ turns: 0 }),
    });
    const spin1 = makeBattle({
      phase: "check",
      command: "combo:bubblegum-lasso-spin",
      check: makeSpinSnagCheck({ turns: 1 }),
    });
    const spin1Hold = makeBattle({
      phase: "check",
      command: "combo:bubblegum-lasso-spin",
      check: makeSpinSnagCheck({ turns: 1, tick: 20 }),
    });
    const snagPhase: CheckState = makeSpinSnagCheck({ turns: 6, snagTick: 12 });
    const spin6 = makeBattle({
      phase: "check",
      command: "combo:bubblegum-lasso-spin",
      check: makeSpinSnagCheck({ turns: 6, snagTick: 0 }),
    });
    const snagging = makeBattle({
      phase: "check",
      command: "combo:bubblegum-lasso-spin",
      check: snagPhase,
    });
    expect(hapticForTick({ battle: spin0 }, { battle: spin1 }, [])).toBe("light");
    expect(hapticForTick({ battle: spin1 }, { battle: spin1Hold }, [])).toBeNull();
    expect(hapticForTick({ battle: spin6 }, { battle: snagging }, [])).toBeNull();
  });
});
