import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as feedback from "../../src/shell/feedback";
import * as overworldFeedback from "../../src/shell/overworld-feedback";
import {
  createInputShortcuts,
  type OverlayGateContext,
  type ShortcutGamepadSource,
  type ShortcutJournalControl,
  type ShortcutKeyEvent,
} from "../../src/shell/input-shortcuts";
import type { JournalNavDirection } from "../../src/ui/journal-nav";

function makeJournalContext(journalOpen: boolean): OverlayGateContext {
  return {
    state: {
      dialogue: null,
      battle: null,
      arcade: null,
      journalOpen,
      transition: null,
      finale: null,
      cutscene: undefined,
      area: "plaza",
    },
    titleMode: null,
    qaMenuOpen: false,
    qaConsoleOpen: false,
    qaBlocked: false,
    photoMode: false,
  };
}

function makeKeyEvent(code: string): {
  event: ShortcutKeyEvent;
  prevented: () => boolean;
} {
  let isPrevented = false;
  return {
    event: {
      code,
      repeat: false,
      target: null,
      preventDefault: () => { isPrevented = true; },
      stopPropagation: () => undefined,
    },
    prevented: () => isPrevented,
  };
}

function makeGamepadHarness(): {
  gamepad: ShortcutGamepadSource;
  setBumper: (step: -1 | 0 | 1) => void;
  setNav: (dir: JournalNavDirection | null) => void;
  setConfirm: (edge: boolean) => void;
  setRightStickY: (y: number) => void;
  clearCount: () => number;
} {
  let bumper: -1 | 0 | 1 = 0;
  let nav: JournalNavDirection | null = null;
  let confirm = false;
  let stickY = 0;
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
      consumeConfirmEdge: () => {
        const next = confirm;
        confirm = false;
        return next;
      },
      rightStickY: () => stickY,
      clearTaps: () => { clears += 1; },
    },
    setBumper: (step) => { bumper = step; },
    setNav: (dir) => { nav = dir; },
    setConfirm: (edge) => { confirm = edge; },
    setRightStickY: (y) => { stickY = y; },
    clearCount: () => clears,
  };
}

describe("Milestone 215: Journal Overlay Gamepad Nav, Isolation & Overworld Feedback Split", () => {
  it("isolates keyboard [/]/PageUp/PageDown and gamepad LB/RB while an overlay is open", () => {
    const ctx = makeJournalContext(true);
    let overlayOpen = true;
    const pageSteps: (-1 | 1)[] = [];
    let invalidations = 0;
    const pad = makeGamepadHarness();

    const shortcuts = createInputShortcuts({
      getContext: () => ctx,
      getBattlePeekOpen: () => false,
      setBattlePeek: () => undefined,
      setPhotoMode: () => undefined,
      snapPostcard: () => undefined,
      journal: {
        hasOpenOverlay: () => overlayOpen,
        dismissOverlay: () => false,
        stepOverlay: () => false,
        stepPage: (delta) => { pageSteps.push(delta); },
        scrollActivePage: () => false,
        navigateFocus: () => false,
        activateFocused: () => false,
      },
      gamepad: pad.gamepad,
      clearKeyboardTaps: () => undefined,
      swallow: () => undefined,
      playChoiceMove: () => undefined,
      invalidate: () => { invalidations += 1; },
    });

    // Open overlay blocks keyboard tab flips and gamepad bumper tab flips.
    for (const code of ["BracketLeft", "BracketRight", "PageUp", "PageDown"]) {
      const key = makeKeyEvent(code);
      shortcuts.handleKeydown(key.event);
      expect(key.prevented()).toBe(false);
    }
    pad.setBumper(-1);
    shortcuts.pollGamepad();
    pad.setBumper(1);
    shortcuts.pollGamepad();
    expect(pageSteps).toEqual([]);
    expect(invalidations).toBe(0);

    // Once the overlay closes, keyboard and gamepad tab flips resume normally.
    overlayOpen = false;
    const bracketLeft = makeKeyEvent("BracketLeft");
    shortcuts.handleKeydown(bracketLeft.event);
    expect(bracketLeft.prevented()).toBe(true);
    const bracketRight = makeKeyEvent("BracketRight");
    shortcuts.handleKeydown(bracketRight.event);
    expect(bracketRight.prevented()).toBe(true);
    pad.setBumper(-1);
    shortcuts.pollGamepad();
    pad.setBumper(1);
    shortcuts.pollGamepad();
    expect(pageSteps).toEqual([-1, 1, -1, 1]);
    expect(invalidations).toBe(4);
  });

  it("dispatches gamepad D-Pad, Right Stick scroll, and A confirm into Journal overlays", () => {
    const ctx = makeJournalContext(true);
    const navCalls: JournalNavDirection[] = [];
    const scrollCalls: number[] = [];
    let activateCalls = 0;
    let choiceMoves = 0;
    let invalidations = 0;
    const swallowed: ("confirm" | "cancel" | "menu")[] = [];
    const pad = makeGamepadHarness();

    const shortcuts = createInputShortcuts({
      getContext: () => ctx,
      getBattlePeekOpen: () => false,
      setBattlePeek: () => undefined,
      setPhotoMode: () => undefined,
      snapPostcard: () => undefined,
      journal: {
        hasOpenOverlay: () => true,
        dismissOverlay: () => false,
        stepOverlay: () => false,
        navigateOverlay: (dir) => {
          navCalls.push(dir);
          return true;
        },
        activateOverlay: () => {
          activateCalls += 1;
          return true;
        },
        scrollOverlay: (deltaY) => {
          scrollCalls.push(deltaY);
          return true;
        },
        stepPage: () => undefined,
        scrollActivePage: () => false,
        navigateFocus: () => false,
        activateFocused: () => false,
      },
      gamepad: pad.gamepad,
      clearKeyboardTaps: () => undefined,
      swallow: (button) => { swallowed.push(button); },
      playChoiceMove: () => { choiceMoves += 1; },
      invalidate: () => { invalidations += 1; },
    });

    // D-Pad directions dispatch through navigateOverlay with choice-move audio + invalidation.
    for (const dir of ["right", "down", "left", "up"] as const) {
      pad.setNav(dir);
      shortcuts.pollGamepad();
    }
    expect(navCalls).toEqual(["right", "down", "left", "up"]);
    expect(choiceMoves).toBe(4);
    expect(invalidations).toBe(4);

    // Right stick vertical input scrolls the active overlay container.
    pad.setRightStickY(0.85);
    shortcuts.pollGamepad();
    pad.setRightStickY(-0.85);
    shortcuts.pollGamepad();
    pad.setRightStickY(0);
    expect(scrollCalls).toHaveLength(2);
    expect(scrollCalls[0]).toBeGreaterThan(0);
    expect(scrollCalls[1]).toBeLessThan(0);

    // Gamepad A activates the focused overlay control, swallows confirm, and clears pad taps.
    pad.setConfirm(true);
    shortcuts.pollGamepad();
    expect(activateCalls).toBe(1);
    expect(swallowed).toEqual(["confirm"]);
    expect(pad.clearCount()).toBe(1);

    // Backwards-compatible minimal ShortcutJournalControl falls back to stepOverlay on left/right.
    const legacySteps: (-1 | 1)[] = [];
    const legacyJournal: ShortcutJournalControl = {
      hasOpenOverlay: () => true,
      dismissOverlay: () => false,
      stepOverlay: (delta) => {
        legacySteps.push(delta);
        return true;
      },
      stepPage: () => undefined,
      scrollActivePage: () => false,
      navigateFocus: () => false,
      activateFocused: () => false,
    };
    const legacyShortcuts = createInputShortcuts({
      getContext: () => ctx,
      getBattlePeekOpen: () => false,
      setBattlePeek: () => undefined,
      setPhotoMode: () => undefined,
      snapPostcard: () => undefined,
      journal: legacyJournal,
      gamepad: pad.gamepad,
      clearKeyboardTaps: () => undefined,
      swallow: () => undefined,
      playChoiceMove: () => undefined,
      invalidate: () => undefined,
    });
    pad.setNav("left");
    legacyShortcuts.pollGamepad();
    pad.setNav("right");
    legacyShortcuts.pollGamepad();
    pad.setNav("down");
    legacyShortcuts.pollGamepad();
    expect(legacySteps).toEqual([-1, 1]);
  });

  it("re-exports overworld-feedback helpers identically and enforces modular line budgets", () => {
    expect(feedback.captureAreaPostcard).toBe(overworldFeedback.captureAreaPostcard);
    expect(feedback.createAreaBannerTracker).toBe(overworldFeedback.createAreaBannerTracker);
    expect(feedback.createNpcChatterSync).toBe(overworldFeedback.createNpcChatterSync);
    expect(feedback.createRibbonCelebrationSync).toBe(
      overworldFeedback.createRibbonCelebrationSync,
    );
    expect(feedback.createToolEventChimeSync).toBe(overworldFeedback.createToolEventChimeSync);
    expect(feedback.deliverAreaPostcard).toBe(overworldFeedback.deliverAreaPostcard);
    expect(feedback.isOverworldConfirm).toBe(overworldFeedback.isOverworldConfirm);
    expect(feedback.performOverworldConfirm).toBe(overworldFeedback.performOverworldConfirm);
    expect(feedback.petEffectForCompanion).toBe(overworldFeedback.petEffectForCompanion);
    expect(feedback.shouldPlayToolEventChime).toBe(overworldFeedback.shouldPlayToolEventChime);

    const lineCount = (path: string): number =>
      readFileSync(path, "utf8").trimEnd().split("\n").length;

    expect(lineCount("src/shell/feedback.ts")).toBeLessThan(520);
    expect(lineCount("src/shell/overworld-feedback.ts")).toBeLessThan(420);
    expect(lineCount("src/ui/journal-field-note.ts")).toBeLessThan(650);
    expect(lineCount("src/ui/journal-overlay-nav.ts")).toBeLessThan(170);
    expect(lineCount("src/main.ts")).toBeLessThan(890);
  });
});
