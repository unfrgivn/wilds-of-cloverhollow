import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type {
  Battle,
  BattleCheckView,
  BattleTalk,
  BattleView,
  CheckState,
  EchoNote,
} from "../../src/core";
import * as BattleChoreo from "../../src/render/battle-choreography";
import {
  classifySnackTheater,
  computeBattleChoreography,
  ECHO_CHIME_COLORS,
  echoNoteColor,
  emitEchoChimeVfx,
  emitLeanWindVfx,
  emitPeekabooVfx,
  emitRainbowLassoVfx,
  emitSoothedConfettiVfx,
  emitTraceBrushVfx,
  isLassoActionActive,
  isTalkTheater,
  LASSO_ARC_DURATION,
  LEAN_WIND_TINTS,
  PEEKABOO_DUST_TINT,
  PEEKABOO_WARNING_TINT,
  PEEKABOO_WATCH_TINTS,
  RAINBOW_LASSO_COLORS,
  SOOTHED_CONFETTI_COLORS,
  TRACE_BRUSH_COLORS,
  type BattleVfxParticle,
  type EchoColor,
} from "../../src/render/battle-choreography";
import * as BattleVfx from "../../src/render/battle-vfx";
import * as BattleVfxStage from "../../src/render/battle-vfx-stage";

const partyIds = ["maddie", "sue", "jordan"] as const;
const partyCommands: Readonly<Record<string, string | null>> = {
  maddie: "play",
  sue: "cast",
  jordan: "juggle",
};

const sampleTracePoints = [
  { x: 120, y: 160 },
  { x: 330, y: 180 },
  { x: 520, y: 370 },
  { x: 730, y: 250 },
  { x: 870, y: 700 },
] as const;

function makeBattle(overrides: Partial<Battle> = {}): Battle {
  return {
    critterId: "frog",
    den: null,
    entry: { x: 500, y: 500 },
    phase: "command",
    message: "What will Fae do?",
    revealed: 17,
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

function makeEchoCheck(
  overrides: Partial<Extract<CheckState, { kind: "echo" }>> = {},
): Extract<CheckState, { kind: "echo" }> {
  return {
    kind: "echo",
    side: "fae",
    tick: 12,
    spec: {
      kind: "echo",
      notes: 3,
      demoTicks: 20,
      gapTicks: 8,
      inputTicks: 180,
    },
    sequence: [0, 2, 3],
    results: ["pending", "pending", "pending"],
    entered: 0,
    activeNote: 0,
    activeTicks: 8,
    big: false,
    ...overrides,
  };
}

function makeLeanCheck(
  overrides: Partial<Extract<CheckState, { kind: "lean" }>> = {},
): Extract<CheckState, { kind: "lean" }> {
  return {
    kind: "lean",
    side: "fae",
    tick: 60,
    spec: {
      kind: "lean",
      starts: [45, 130],
      puffTicks: 56,
      forces: [2, 2],
      steer: 3,
      spring: 1,
    },
    strengths: [2, 2],
    balance: 0,
    results: ["pending", "pending"],
    big: false,
    ...overrides,
  };
}

function makePeekabooCheck(
  overrides: Partial<Extract<CheckState, { kind: "peekaboo" }>> = {},
): Extract<CheckState, { kind: "peekaboo" }> {
  return {
    kind: "peekaboo",
    side: "fae",
    tick: 30,
    spec: {
      kind: "peekaboo",
      peeks: [{ start: 60, end: 102 }],
      warningTicks: 24,
      goal: 80,
      ticks: 210,
      graceTicks: 8,
    },
    progress: 24,
    spotted: [],
    peeksCleared: 0,
    result: null,
    big: false,
    ...overrides,
  };
}

function makeTraceCheck(
  overrides: Partial<Extract<CheckState, { kind: "trace" }>> = {},
): Extract<CheckState, { kind: "trace" }> {
  return {
    kind: "trace",
    side: "fae",
    tick: 0,
    spec: {
      kind: "trace",
      dryTicks: 180,
      reachRadius: 95,
      brushSpeed: 24,
      paths: [{ id: "star", points: [...sampleTracePoints] }],
    },
    path: { id: "star", points: [...sampleTracePoints] },
    checkpoint: 0,
    brush: { x: 120, y: 160 },
    results: ["pending", "pending", "pending", "pending", "pending"],
    big: false,
    ...overrides,
  };
}

describe("Milestone 155: Battle VFX Stage Module Structure & Re-Export Parity", () => {
  it("re-exports all 6 emitters, constants, and helpers identically across all layers", () => {
    expect(BattleVfx.LASSO_ARC_DURATION).toBe(BattleVfxStage.LASSO_ARC_DURATION);
    expect(BattleChoreo.LASSO_ARC_DURATION).toBe(BattleVfxStage.LASSO_ARC_DURATION);
    expect(BattleVfx.RAINBOW_LASSO_COLORS).toBe(BattleVfxStage.RAINBOW_LASSO_COLORS);
    expect(BattleChoreo.RAINBOW_LASSO_COLORS).toBe(BattleVfxStage.RAINBOW_LASSO_COLORS);
    expect(BattleVfx.isLassoActionActive).toBe(BattleVfxStage.isLassoActionActive);
    expect(BattleChoreo.isLassoActionActive).toBe(BattleVfxStage.isLassoActionActive);
    expect(BattleVfx.emitRainbowLassoVfx).toBe(BattleVfxStage.emitRainbowLassoVfx);
    expect(BattleChoreo.emitRainbowLassoVfx).toBe(BattleVfxStage.emitRainbowLassoVfx);

    expect(BattleVfx.ECHO_CHIME_COLORS).toBe(BattleVfxStage.ECHO_CHIME_COLORS);
    expect(BattleChoreo.ECHO_CHIME_COLORS).toBe(BattleVfxStage.ECHO_CHIME_COLORS);
    expect(BattleVfx.echoNoteColor).toBe(BattleVfxStage.echoNoteColor);
    expect(BattleChoreo.echoNoteColor).toBe(BattleVfxStage.echoNoteColor);
    expect(BattleVfx.emitEchoChimeVfx).toBe(BattleVfxStage.emitEchoChimeVfx);
    expect(BattleChoreo.emitEchoChimeVfx).toBe(BattleVfxStage.emitEchoChimeVfx);

    expect(BattleVfx.SOOTHED_CONFETTI_COLORS).toBe(BattleVfxStage.SOOTHED_CONFETTI_COLORS);
    expect(BattleChoreo.SOOTHED_CONFETTI_COLORS).toBe(BattleVfxStage.SOOTHED_CONFETTI_COLORS);
    expect(BattleVfx.emitSoothedConfettiVfx).toBe(BattleVfxStage.emitSoothedConfettiVfx);
    expect(BattleChoreo.emitSoothedConfettiVfx).toBe(BattleVfxStage.emitSoothedConfettiVfx);

    expect(BattleVfx.LEAN_WIND_TINTS).toBe(BattleVfxStage.LEAN_WIND_TINTS);
    expect(BattleChoreo.LEAN_WIND_TINTS).toBe(BattleVfxStage.LEAN_WIND_TINTS);
    expect(BattleVfx.emitLeanWindVfx).toBe(BattleVfxStage.emitLeanWindVfx);
    expect(BattleChoreo.emitLeanWindVfx).toBe(BattleVfxStage.emitLeanWindVfx);

    expect(BattleVfx.PEEKABOO_WARNING_TINT).toBe(BattleVfxStage.PEEKABOO_WARNING_TINT);
    expect(BattleChoreo.PEEKABOO_WARNING_TINT).toBe(BattleVfxStage.PEEKABOO_WARNING_TINT);
    expect(BattleVfx.PEEKABOO_WATCH_TINTS).toBe(BattleVfxStage.PEEKABOO_WATCH_TINTS);
    expect(BattleChoreo.PEEKABOO_WATCH_TINTS).toBe(BattleVfxStage.PEEKABOO_WATCH_TINTS);
    expect(BattleVfx.PEEKABOO_DUST_TINT).toBe(BattleVfxStage.PEEKABOO_DUST_TINT);
    expect(BattleChoreo.PEEKABOO_DUST_TINT).toBe(BattleVfxStage.PEEKABOO_DUST_TINT);
    expect(BattleVfx.emitPeekabooVfx).toBe(BattleVfxStage.emitPeekabooVfx);
    expect(BattleChoreo.emitPeekabooVfx).toBe(BattleVfxStage.emitPeekabooVfx);

    expect(BattleVfx.TRACE_BRUSH_COLORS).toBe(BattleVfxStage.TRACE_BRUSH_COLORS);
    expect(BattleChoreo.TRACE_BRUSH_COLORS).toBe(BattleVfxStage.TRACE_BRUSH_COLORS);
    expect(BattleVfx.emitTraceBrushVfx).toBe(BattleVfxStage.emitTraceBrushVfx);
    expect(BattleChoreo.emitTraceBrushVfx).toBe(BattleVfxStage.emitTraceBrushVfx);
  });

  it("keeps battle-vfx-stage.ts Pixi-free, respects budgets, and sets pool size to 80", () => {
    const stageSource = readFileSync("src/render/battle-vfx-stage.ts", "utf8");
    expect(stageSource).not.toMatch(/from\s+["']pixi\.js["']/);

    const stageRenderSource = readFileSync("src/render/battle-stage-render.ts", "utf8");
    expect(stageRenderSource).toContain("const BATTLE_VFX_POOL_SIZE = 80;");

    const lineCount = (path: string): number =>
      readFileSync(path, "utf8").trimEnd().split("\n").length;
    expect(lineCount("src/render/battle-choreography.ts")).toBeLessThan(800);
    expect(lineCount("src/render/battle-vfx-stage.ts")).toBeLessThan(1000);
    expect(lineCount("src/render/battle-vfx.ts")).toBeLessThan(1000);
    expect(lineCount("src/render/battle-view.ts")).toBeLessThan(1000);
  });
});

describe("Milestone 155: 1. Rainbow Lasso Arc Choreography", () => {
  it("activates strictly for live Rainbow Lasso command lines under LASSO_ARC_DURATION", () => {
    expect(LASSO_ARC_DURATION).toBe(32);
    expect(RAINBOW_LASSO_COLORS).toHaveLength(7);

    const active = makeBattle({
      phase: "command",
      lassoUsed: true,
      phaseTicks: 12,
      message: "Fae flicks her Rainbow Lasso! Steady snag!",
    });
    expect(isLassoActionActive(active)).toBe(true);
    expect(isLassoActionActive(makeBattle({ ...active, phaseTicks: 32 }))).toBe(false);
    expect(isLassoActionActive(makeBattle({ ...active, lassoUsed: false }))).toBe(false);
    expect(isLassoActionActive(makeBattle({ ...active, phase: "result" }))).toBe(false);
    expect(isLassoActionActive(makeBattle({ ...active, message: "What will Fae do?" }))).toBe(
      false,
    );
  });

  it("emits 7-color arc, critter loop, Steady Snag glints, and bubble pop puffs", () => {
    const steadyBattle = makeBattle({
      phase: "command",
      lassoUsed: true,
      lassoSteady: true,
      phaseTicks: 14,
      message: "Fae flicks her Rainbow Lasso! Steady snag! +4 coins!",
    });
    const steadyChoreo = computeBattleChoreography(
      steadyBattle,
      null,
      40,
      partyIds,
      partyCommands,
    );
    expect(steadyChoreo.fae.offsetX).toBeGreaterThan(10);
    expect(steadyChoreo.vfx.filter((p) => p.anchor === "between")).toHaveLength(21);
    const loopRings = steadyChoreo.vfx.filter(
      (p) => p.texture === "energyRing" && p.anchor === "critter",
    );
    expect(loopRings).toHaveLength(2);
    const goldenGlints = steadyChoreo.vfx.filter(
      (p) => p.texture === "sparkle" && p.anchor === "critter" && p.tint === 0xffdf6b,
    );
    expect(goldenGlints).toHaveLength(4);
    expect(steadyChoreo.vfx.every((p) => p.alpha <= 0.98)).toBe(true);

    const popBattle = makeBattle({
      phase: "command",
      lassoUsed: true,
      phaseTicks: 14,
      message: "Fae whips her Rainbow Lasso and pops a wind-up bubble!",
    });
    const popVfx: BattleVfxParticle[] = [];
    emitRainbowLassoVfx(popVfx, popBattle, false);
    expect(popVfx.filter((p) => p.texture === "puff" && p.tint === 0x8fd3ff)).toHaveLength(4);
    expect(
      popVfx.filter((p) => p.texture === "sparkle" && p.blend === "add" && p.tint === 0x8fd3ff),
    ).toHaveLength(4);

    // Reduced-motion enforces rotation === 0 on every particle and combatant pose.
    const reducedChoreo = computeBattleChoreography(
      steadyBattle,
      null,
      40,
      partyIds,
      partyCommands,
      true,
    );
    expect(reducedChoreo.fae.rotation).toBe(0);
    expect(reducedChoreo.critter.rotation).toBe(0);
    expect(reducedChoreo.vfx.length).toBeGreaterThan(20);
    expect(reducedChoreo.vfx.every((p) => p.rotation === 0)).toBe(true);

    const reducedPopVfx: BattleVfxParticle[] = [];
    emitRainbowLassoVfx(reducedPopVfx, popBattle, true);
    expect(reducedPopVfx.every((p) => p.rotation === 0)).toBe(true);
  });
});

describe("Milestone 155: 2. Synesthetic Musical Echo Chimes Choreography", () => {
  it("maps all 4 notes to synesthetic pastel tints and emits demo & input choreography", () => {
    const expected: readonly [EchoNote, EchoColor][] = [
      [0, "red"],
      [1, "yellow"],
      [2, "green"],
      [3, "blue"],
    ];
    for (const [note, color] of expected) {
      expect(echoNoteColor(note)).toBe(color);
      expect(ECHO_CHIME_COLORS[color]).toBeGreaterThan(0);
    }

    const demoCheck = makeEchoCheck({ tick: 10, activeNote: 2, activeTicks: 10 });
    const demoVfx: BattleVfxParticle[] = [];
    const demoMotion = emitEchoChimeVfx(demoVfx, demoCheck, null, false);
    expect(demoVfx).toHaveLength(6);
    expect(demoVfx.every((p) => p.anchor === "critter")).toBe(true);
    expect(demoVfx.every((p) => p.tint === ECHO_CHIME_COLORS.green)).toBe(true);
    expect(demoMotion.critterOffsetY).toBeLessThan(0);
    expect(demoMotion.faeOffsetY).toBe(0);

    const inputCheck = makeEchoCheck({ tick: 100, activeNote: 3, activeTicks: 10 });
    const inputView: Extract<BattleCheckView, { kind: "echo" }> = {
      kind: "echo",
      side: "fae",
      phase: "input",
      sequence: [0, 2, 3],
      results: ["hit", "hit", "pending"],
      litNote: 3,
      demoIndex: 3,
      entered: 2,
      time: 0.7,
    };
    const inputVfx: BattleVfxParticle[] = [];
    const inputMotion = emitEchoChimeVfx(inputVfx, inputCheck, inputView, false);
    expect(inputVfx).toHaveLength(6);
    expect(inputVfx.filter((p) => p.anchor === "fae")).toHaveLength(2);
    expect(inputVfx.filter((p) => p.anchor === "between")).toHaveLength(4);
    expect(inputVfx.every((p) => p.tint === ECHO_CHIME_COLORS.blue)).toBe(true);
    expect(inputMotion.faeOffsetY).toBeLessThan(0);
    expect(inputMotion.critterOffsetY).toBe(0);

    // Silent when no note is lit.
    const quietVfx: BattleVfxParticle[] = [];
    const quietMotion = emitEchoChimeVfx(
      quietVfx,
      makeEchoCheck({ activeNote: null }),
      null,
      false,
    );
    expect(quietVfx).toHaveLength(0);
    expect(quietMotion).toEqual({
      critterOffsetY: 0,
      critterRotation: 0,
      faeOffsetY: 0,
      faeRotation: 0,
    });
  });

  it("holds neutral sway, steady positions, and rotation === 0 under reducedMotion", () => {
    const demoA: BattleVfxParticle[] = [];
    const demoB: BattleVfxParticle[] = [];
    const motionA = emitEchoChimeVfx(
      demoA,
      makeEchoCheck({ activeNote: 1, activeTicks: 4 }),
      null,
      true,
    );
    const motionB = emitEchoChimeVfx(
      demoB,
      makeEchoCheck({ activeNote: 1, activeTicks: 16 }),
      null,
      true,
    );
    expect(motionA).toEqual({
      critterOffsetY: 0,
      critterRotation: 0,
      faeOffsetY: 0,
      faeRotation: 0,
    });
    expect(demoA).toEqual(demoB);
    expect(demoA.every((p) => p.rotation === 0)).toBe(true);

    const inputA: BattleVfxParticle[] = [];
    const inputB: BattleVfxParticle[] = [];
    emitEchoChimeVfx(
      inputA,
      makeEchoCheck({ tick: 100, activeNote: 0, activeTicks: 3 }),
      null,
      true,
    );
    emitEchoChimeVfx(
      inputB,
      makeEchoCheck({ tick: 112, activeNote: 0, activeTicks: 11 }),
      null,
      true,
    );
    expect(inputA).toEqual(inputB);
    expect(inputA.every((p) => p.rotation === 0)).toBe(true);
  });
});

describe("Milestone 155: 3. Soothed Victory Confetti Shower", () => {
  it("emits 10 framing confetti particles + halo on soothed while keeping reward untouched", () => {
    expect(SOOTHED_CONFETTI_COLORS).toHaveLength(5);

    const directVfx: BattleVfxParticle[] = [];
    emitSoothedConfettiVfx(directVfx, 12, false);
    expect(directVfx).toHaveLength(11);
    const confetti = directVfx.slice(1);
    expect(confetti.filter((p) => p.texture === "petal")).toHaveLength(5);
    expect(confetti.filter((p) => p.texture === "sparkle")).toHaveLength(5);
    expect(confetti.every((p) => Math.abs(p.offsetX) >= 82)).toBe(true);

    const soothed = computeBattleChoreography(
      makeBattle({ phase: "soothed", phaseTicks: 12 }),
      null,
      30,
      partyIds,
      partyCommands,
    );
    expect(soothed.vfx.filter((p) => p.texture === "petal")).toHaveLength(13);

    const reward = computeBattleChoreography(
      makeBattle({ phase: "reward", phaseTicks: 12 }),
      null,
      30,
      partyIds,
      partyCommands,
    );
    expect(reward.vfx.filter((p) => p.texture === "petal")).toHaveLength(8);

    const reducedA: BattleVfxParticle[] = [];
    const reducedB: BattleVfxParticle[] = [];
    emitSoothedConfettiVfx(reducedA, 6, true);
    emitSoothedConfettiVfx(reducedB, 28, true);
    expect(reducedA).toEqual(reducedB);
    expect(reducedA.every((p) => p.rotation === 0)).toBe(true);
  });
});

describe("Milestone 155: 4. Tactile Wind-Gust Lean Choreography", () => {
  it("streams mistWisp ribbons & sparkles right-to-left while blowing, clear of sprites", () => {
    expect(LEAN_WIND_TINTS).toEqual([0x7ac7ea, 0x82d8be]);

    const calmVfx: BattleVfxParticle[] = [];
    emitLeanWindVfx(calmVfx, false, 60, false);
    expect(calmVfx).toHaveLength(0);

    const blowingVfx: BattleVfxParticle[] = [];
    emitLeanWindVfx(blowingVfx, true, 60, false);
    expect(blowingVfx).toHaveLength(9);
    expect(blowingVfx.filter((p) => p.texture === "mistWisp")).toHaveLength(6);
    expect(blowingVfx.filter((p) => p.texture === "sparkle")).toHaveLength(3);
    expect(blowingVfx.every((p) => p.anchor === "between")).toBe(true);
    for (const particle of blowingVfx) {
      expect(particle.t ?? -1).toBeGreaterThanOrEqual(0.15);
      expect(particle.t ?? 2).toBeLessThanOrEqual(0.67);
    }

    // Resolved puffs do not emit gusts when view is null.
    const resolvedLean = makeBattle({
      phase: "check",
      check: makeLeanCheck({ tick: 60, results: ["hit", "pending"] }),
    });
    const resolvedChoreo = computeBattleChoreography(
      resolvedLean,
      null,
      60,
      partyIds,
      partyCommands,
    );
    expect(resolvedChoreo.vfx.filter((p) => p.texture === "mistWisp")).toHaveLength(0);

    // Active blowing puff emits via computeBattleChoreography.
    const activeLean = makeBattle({
      phase: "check",
      check: makeLeanCheck({ tick: 60, results: ["pending", "pending"] }),
    });
    const activeChoreo = computeBattleChoreography(activeLean, null, 60, partyIds, partyCommands);
    expect(activeChoreo.vfx.filter((p) => p.texture === "mistWisp")).toHaveLength(6);

    const reducedA: BattleVfxParticle[] = [];
    const reducedB: BattleVfxParticle[] = [];
    emitLeanWindVfx(reducedA, true, 20, true);
    emitLeanWindVfx(reducedB, true, 90, true);
    expect(reducedA).toEqual(reducedB);
    expect(reducedA.every((p) => p.rotation === 0)).toBe(true);
  });
});

describe("Milestone 155: 5. Starry Owl Peekaboo Freeze Choreography", () => {
  it("emits warning halo, watching moonbeam ring + stars, and safe tiptoe dust puffs", () => {
    const warnVfx: BattleVfxParticle[] = [];
    emitPeekabooVfx(warnVfx, "warning", 20, 44, false, 0.25);
    expect(warnVfx).toHaveLength(4);
    expect(warnVfx.every((p) => p.tint === PEEKABOO_WARNING_TINT)).toBe(true);

    const watchVfx: BattleVfxParticle[] = [];
    emitPeekabooVfx(watchVfx, "watching", 20, 72, false, 0.25);
    expect(watchVfx).toHaveLength(6);
    expect(watchVfx.some((p) => p.texture === "energyRing")).toBe(true);
    expect(watchVfx.every((p) => PEEKABOO_WATCH_TINTS.includes(p.tint))).toBe(true);

    const idleSafe: BattleVfxParticle[] = [];
    emitPeekabooVfx(idleSafe, "safe", 0, 10, false, 0);
    expect(idleSafe).toHaveLength(0);

    const tiptoeSafe: BattleVfxParticle[] = [];
    emitPeekabooVfx(tiptoeSafe, "safe", 24, 20, false, 0.3);
    expect(tiptoeSafe).toHaveLength(2);
    expect(tiptoeSafe.every((p) => p.texture === "puff" && p.tint === PEEKABOO_DUST_TINT)).toBe(
      true,
    );

    // Wired through computeBattleChoreography in watching state.
    const watchingBattle = makeBattle({
      phase: "check",
      check: makePeekabooCheck({ tick: 70, progress: 24 }),
    });
    const watchingChoreo = computeBattleChoreography(
      watchingBattle,
      null,
      70,
      partyIds,
      partyCommands,
    );
    expect(watchingChoreo.vfx.some((p) => p.texture === "energyRing")).toBe(true);

    // Reduced-motion holds steady and rotation === 0 across all three statuses.
    for (const status of ["warning", "watching", "safe"] as const) {
      const a: BattleVfxParticle[] = [];
      const b: BattleVfxParticle[] = [];
      emitPeekabooVfx(a, status, 24, 15, true, 0.3);
      emitPeekabooVfx(b, status, 24, 85, true, 0.3);
      expect(a).toEqual(b);
      expect(a.every((p) => p.rotation === 0)).toBe(true);
    }
  });
});

describe("Milestone 155: 6. Shape Trace Watercolor Brush Choreography", () => {
  it("stays silent before tracing starts, then blooms pastel sparkles & sway beside Fae", () => {
    expect(TRACE_BRUSH_COLORS).toHaveLength(5);

    const idleVfx: BattleVfxParticle[] = [];
    const idleMotion = emitTraceBrushVfx(idleVfx, makeTraceCheck(), null, 10, false);
    expect(idleVfx).toHaveLength(0);
    expect(idleMotion).toEqual({ faeOffsetX: 0, faeOffsetY: 0, faeRotation: 0 });

    const midCheck = makeTraceCheck({
      tick: 36,
      checkpoint: 3,
      brush: { x: 520, y: 370 },
      results: ["hit", "hit", "hit", "pending", "pending"],
    });
    const midVfx: BattleVfxParticle[] = [];
    const midMotion = emitTraceBrushVfx(midVfx, midCheck, null, 36, false);
    expect(midVfx[0]?.texture).toBe("softGlow");
    const midSparkles = midVfx.filter((p) => p.texture === "sparkle");
    expect(midSparkles.length).toBeGreaterThanOrEqual(3);
    expect(midSparkles.length).toBeLessThanOrEqual(6);
    for (const sparkle of midSparkles) {
      expect(sparkle.anchor).toBe("fae");
      expect(sparkle.offsetX).toBeGreaterThanOrEqual(24);
      expect(sparkle.offsetX).toBeLessThanOrEqual(64);
      expect(sparkle.offsetY).toBeGreaterThanOrEqual(-56);
      expect(sparkle.offsetY).toBeLessThanOrEqual(-10);
    }
    expect(midMotion.faeOffsetX).not.toBe(0);

    const lateCheck = makeTraceCheck({
      tick: 55,
      checkpoint: 4,
      brush: { x: 820, y: 600 },
      results: ["hit", "hit", "hit", "hit", "hit"],
    });
    const lateVfx: BattleVfxParticle[] = [];
    emitTraceBrushVfx(lateVfx, lateCheck, null, 55, false);
    expect(lateVfx.filter((p) => p.texture === "sparkle")).toHaveLength(6);

    // Reduced-motion holds neutral sway, steady positions, and rotation === 0.
    const reducedA: BattleVfxParticle[] = [];
    const reducedB: BattleVfxParticle[] = [];
    const reducedMotionA = emitTraceBrushVfx(reducedA, midCheck, null, 18, true);
    const reducedMotionB = emitTraceBrushVfx(reducedB, midCheck, null, 74, true);
    expect(reducedMotionA).toEqual({ faeOffsetX: 0, faeOffsetY: 0, faeRotation: 0 });
    expect(reducedMotionB).toEqual({ faeOffsetX: 0, faeOffsetY: 0, faeRotation: 0 });
    expect(reducedA).toEqual(reducedB);
    expect(reducedA.every((p) => p.rotation === 0)).toBe(true);
  });
});

describe("Milestone 155: Preservation of Snack Theater (M135) & Talk Theater (M136)", () => {
  it("preserves M135 Snack/Treat/Favourite Theater and M136 Talk Theater identically", () => {
    const favBattle = makeBattle({
      phase: "result",
      command: null,
      lastGrade: null,
      phaseTicks: 10,
      message: "Fae shares a Golden Sunberry! Their favourite!",
    });
    expect(classifySnackTheater(favBattle)).toBe("favourite");
    const favReduced = computeBattleChoreography(
      favBattle,
      makeBattleView(favBattle),
      20,
      partyIds,
      partyCommands,
      true,
    );
    expect(favReduced.vfx.length).toBeGreaterThan(10);
    expect(favReduced.vfx.every((p) => p.rotation === 0)).toBe(true);

    const talk: BattleTalk = {
      knot: "kid_talk_1",
      turn: 0,
      speaker: "Hooded Kid",
      text: "You don't even know who I am!",
      revealed: 30,
      choices: ["A friend", "Star Racer fan"],
      selected: 0,
      ended: false,
      grade: "great",
    };
    const talkBattle = makeBattle({ phase: "talk", talk });
    expect(isTalkTheater(talkBattle)).toBe(true);
    const talkReduced = computeBattleChoreography(
      talkBattle,
      makeBattleView(talkBattle),
      25,
      partyIds,
      partyCommands,
      true,
    );
    expect(talkReduced.vfx.length).toBe(11);
    expect(talkReduced.vfx.every((p) => p.rotation === 0)).toBe(true);
  });
});
