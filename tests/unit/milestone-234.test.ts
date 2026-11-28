import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadContent } from "../../src/content/load";
import { createState, startBattle, type State } from "../../src/core";
import {
  createInputShortcuts,
  type OverlayGateContext,
  type ShortcutGamepadSource,
  type ShortcutKeyEvent,
} from "../../src/shell/input-shortcuts";
import { battlePeekData, stepMultiFoeTargetIndex } from "../../src/ui/battle-peek";
import * as encoreShrine from "../../src/ui/encore-shrine";
import * as encoreShrineSession from "../../src/ui/encore-shrine-session";
import type { JournalNavDirection } from "../../src/ui/journal-nav";

const content = loadContent();
const world = content.world;
const rawBayDuo = content.fixtures["bay-duo"];
if (rawBayDuo === undefined) throw new Error("Missing bay-duo fixture");
const bayDuoFixture = rawBayDuo;
const rawPlaza = content.fixtures["plaza"];
if (rawPlaza === undefined) throw new Error("Missing plaza fixture");
const plazaFixture = rawPlaza;

function lineCount(filePath: string): number {
  return readFileSync(filePath, "utf8").trimEnd().split("\n").length;
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

function makeBattlePeekContext(): OverlayGateContext {
  const duo = createState(world, bayDuoFixture);
  if (duo.battle === null) throw new Error("Expected active battle in bay-duo");
  return {
    state: {
      dialogue: null,
      battle: { ...duo.battle, phase: "command", talk: null },
      arcade: null,
      journalOpen: false,
      transition: null,
      finale: null,
      cutscene: undefined,
      area: "bay",
    },
    titleMode: null,
    qaMenuOpen: false,
    qaConsoleOpen: false,
    qaBlocked: false,
    photoMode: false,
  };
}

function makeKeyEvent(code: string, repeat = false): {
  event: ShortcutKeyEvent;
  prevented: () => boolean;
  stopped: () => boolean;
} {
  let isPrevented = false;
  let isStopped = false;
  return {
    event: {
      code,
      repeat,
      target: null,
      preventDefault: () => { isPrevented = true; },
      stopPropagation: () => { isStopped = true; },
    },
    prevented: () => isPrevented,
    stopped: () => isStopped,
  };
}

function makeGamepadHarness(): {
  gamepad: ShortcutGamepadSource;
  setBumper: (step: -1 | 0 | 1) => void;
  setNav: (dir: JournalNavDirection | null) => void;
  clearCount: () => number;
} {
  let bumper: -1 | 0 | 1 = 0;
  let nav: JournalNavDirection | null = null;
  let clears = 0;
  return {
    gamepad: {
      poll: () => [],
      consumeActivity: () => false,
      consumePhotoAction: () => null,
      consumeBumperStep: () => {
        const next = bumper;
        bumper = 0;
        return next;
      },
      consumeNavStep: () => {
        const next = nav;
        nav = null;
        return next;
      },
      consumeConfirmEdge: () => false,
      rightStickY: () => 0,
      clearTaps: () => { clears += 1; },
    },
    setBumper: (step) => { bumper = step; },
    setNav: (dir) => { nav = dir; },
    clearCount: () => clears,
  };
}

describe("Milestone 234: In-Peek Multi-Foe Flipper & encore-shrine-session.ts Split", () => {
  it("steps multi-foe target indices with wrap, skipping soothed foes and hiding < 2", () => {
    expect(stepMultiFoeTargetIndex(undefined, 0, 1)).toBeNull();
    expect(stepMultiFoeTargetIndex([], 0, 1)).toBeNull();
    expect(stepMultiFoeTargetIndex([{ soothed: false }], 0, 1)).toBeNull();
    expect(stepMultiFoeTargetIndex([{ soothed: false }, { soothed: true }], 0, 1)).toBeNull();
    expect(stepMultiFoeTargetIndex([{ soothed: true }, { soothed: false }], 0, -1)).toBeNull();

    // 2-foe wrap forward and backward
    const duo = [{ soothed: false }, { soothed: false }];
    expect(stepMultiFoeTargetIndex(duo, 0, 1)).toBe(1);
    expect(stepMultiFoeTargetIndex(duo, 1, 1)).toBe(0);
    expect(stepMultiFoeTargetIndex(duo, 0, -1)).toBe(1);
    expect(stepMultiFoeTargetIndex(duo, 1, -1)).toBe(0);

    // 3-foe wrap forward and backward, including skipping a soothed middle critter
    const trioAll = [{ soothed: false }, { soothed: false }, { soothed: false }];
    expect(stepMultiFoeTargetIndex(trioAll, 0, 1)).toBe(1);
    expect(stepMultiFoeTargetIndex(trioAll, 1, 1)).toBe(2);
    expect(stepMultiFoeTargetIndex(trioAll, 2, 1)).toBe(0);
    expect(stepMultiFoeTargetIndex(trioAll, 0, -1)).toBe(2);
    expect(stepMultiFoeTargetIndex(trioAll, 2, -1)).toBe(1);

    const trioMidSoothed = [{ soothed: false }, { soothed: true }, { soothed: false }];
    expect(stepMultiFoeTargetIndex(trioMidSoothed, 0, 1)).toBe(2);
    expect(stepMultiFoeTargetIndex(trioMidSoothed, 2, 1)).toBe(0);
    expect(stepMultiFoeTargetIndex(trioMidSoothed, 2, -1)).toBe(0);
    expect(stepMultiFoeTargetIndex(trioMidSoothed, 0, -1)).toBe(2);
  });

  it("populates BattlePeekData.formationPager only when >= 2 un-soothed foes remain", () => {
    const basePlaza = createState(world, plazaFixture);
    const frog = world.critters["fountain-frog"];
    if (frog === undefined) throw new Error("Missing fountain-frog");
    const singleState: State = {
      ...basePlaza,
      battle: { ...startBattle(world, basePlaza, frog), phase: "command" },
    };
    expect(battlePeekData(world, singleState)?.formationPager).toBeNull();

    const duoState = createState(world, bayDuoFixture);
    if (duoState.battle === null || duoState.battle.foes === undefined) {
      throw new Error("Expected multi-foe battle in bay-duo");
    }
    expect(battlePeekData(world, duoState)?.formationPager).toEqual({ index: 1, total: 2 });

    const duoTarget1: State = {
      ...duoState,
      battle: { ...duoState.battle, targetIndex: 1 },
    };
    expect(battlePeekData(world, duoTarget1)?.formationPager).toEqual({ index: 2, total: 2 });

    const oneRemaining: State = {
      ...duoState,
      battle: {
        ...duoState.battle,
        targetIndex: 1,
        foes: duoState.battle.foes.map((foe, idx) =>
          idx === 0 ? { ...foe, soothed: true } : foe,
        ),
      },
    };
    expect(battlePeekData(world, oneRemaining)?.formationPager).toBeNull();
  });

  it("routes ArrowLeft/ArrowRight and gamepad LB/RB/D-Pad while battlePeekOpen is true", () => {
    const ctx = makeBattlePeekContext();
    let peekOpen = true;
    const steps: (-1 | 1)[] = [];
    let keyboardClears = 0;
    let invalidations = 0;
    const pad = makeGamepadHarness();

    const shortcuts = createInputShortcuts({
      getContext: () => ctx,
      getBattlePeekOpen: () => peekOpen,
      setBattlePeek: (open) => { peekOpen = open; },
      stepBattleTarget: (delta) => {
        steps.push(delta);
        return true;
      },
      setPhotoMode: () => undefined,
      snapPostcard: () => undefined,
      journal: {
        hasOpenOverlay: () => false,
        dismissOverlay: () => false,
        stepOverlay: () => false,
        stepPage: () => undefined,
        scrollActivePage: () => false,
        navigateFocus: () => false,
        activateFocused: () => false,
      },
      gamepad: pad.gamepad,
      clearKeyboardTaps: () => { keyboardClears += 1; },
      swallow: () => undefined,
      playChoiceMove: () => undefined,
      invalidate: () => { invalidations += 1; },
    });

    const rightKey = makeKeyEvent("ArrowRight");
    shortcuts.handleKeydown(rightKey.event);
    expect(steps).toEqual([1]);
    expect(rightKey.prevented()).toBe(true);
    expect(rightKey.stopped()).toBe(true);
    expect(keyboardClears).toBe(1);
    expect(invalidations).toBe(1);

    const leftKey = makeKeyEvent("ArrowLeft");
    shortcuts.handleKeydown(leftKey.event);
    expect(steps).toEqual([1, -1]);
    expect(leftKey.prevented()).toBe(true);
    expect(leftKey.stopped()).toBe(true);
    expect(keyboardClears).toBe(2);

    // Repeat events are ignored.
    const repeatRight = makeKeyEvent("ArrowRight", true);
    shortcuts.handleKeydown(repeatRight.event);
    expect(steps).toEqual([1, -1]);

    // Gamepad LB (-1), RB (+1), D-Pad Left (-1), D-Pad Right (+1).
    pad.setBumper(-1);
    shortcuts.pollGamepad();
    pad.setBumper(1);
    shortcuts.pollGamepad();
    pad.setNav("left");
    shortcuts.pollGamepad();
    pad.setNav("right");
    shortcuts.pollGamepad();
    expect(steps).toEqual([1, -1, -1, 1, -1, 1]);
    expect(pad.clearCount()).toBe(4);

    // When Peek is closed, ArrowRight and LB/RB do not invoke stepBattleTarget.
    peekOpen = false;
    const closedKey = makeKeyEvent("ArrowRight");
    shortcuts.handleKeydown(closedKey.event);
    pad.setBumper(1);
    shortcuts.pollGamepad();
    expect(steps).toEqual([1, -1, -1, 1, -1, 1]);
  });

  it("re-exports encore-shrine-session identically and meets strict line budgets", () => {
    expect(encoreShrine.encoreFooterHint).toBe(encoreShrineSession.encoreFooterHint);
    expect(encoreShrine.mountEncoreShrineSession).toBe(
      encoreShrineSession.mountEncoreShrineSession,
    );

    const peekCode = stripComments(readFileSync("src/ui/battle-peek.ts", "utf8"));
    expect(peekCode).not.toMatch(
      /pixi\.js|\bdocument\b|\bwindow\b|\bHTMLElement\b|["']\.\/dom["']/,
    );

    expect(lineCount("src/ui/encore-shrine.ts")).toBeLessThan(520);
    expect(lineCount("src/ui/encore-shrine-session.ts")).toBeLessThan(260);
    expect(lineCount("src/ui/battle.ts")).toBeLessThan(650);
    expect(lineCount("src/main.ts")).toBeLessThan(890);
  });
});
