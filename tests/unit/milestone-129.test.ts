import { describe, expect, it } from "vitest";
import type { Point } from "../../src/core";
import { TouchInput } from "../../src/platform/touch";
import {
  bindOverworldPointerSteer,
  computeOverworldSteer,
  type OverworldPointerEvent,
  type OverworldPointerTarget,
} from "../../src/shell/overworld-pointer";
import {
  canBattlePeek,
  canOverworldSteer,
  canPhotoMode,
  createInputShortcuts,
  isBannerEligible,
  isJournalShortcutActive,
  isOverworldFree,
  type OverlayGateContext,
  type ShortcutGamepadSource,
  type ShortcutKeyEvent,
} from "../../src/shell/input-shortcuts";

type PointerListenerMap = Record<string, ((event: OverworldPointerEvent) => void)[]>;

function createFakeCanvas(): {
  canvas: OverworldPointerTarget;
  captured: number[];
  emit: (type: string, event: OverworldPointerEvent) => void;
} {
  const listeners: PointerListenerMap = {};
  const captured: number[] = [];
  const canvas: OverworldPointerTarget = {
    addEventListener: (type, listener) => {
      const bucket = listeners[type] ?? [];
      bucket.push(listener);
      listeners[type] = bucket;
    },
    setPointerCapture: (pointerId) => {
      captured.push(pointerId);
    },
  };
  const emit = (type: string, event: OverworldPointerEvent): void => {
    for (const listener of listeners[type] ?? []) listener(event);
  };
  return { canvas, captured, emit };
}

function makePointerEvent(
  overrides: Partial<OverworldPointerEvent> = {},
): { event: OverworldPointerEvent; prevented: () => boolean } {
  let didPrevent = false;
  const event: OverworldPointerEvent = {
    pointerId: 1,
    pointerType: "mouse",
    button: 0,
    clientX: 0,
    clientY: 0,
    preventDefault: () => {
      didPrevent = true;
    },
    ...overrides,
  };
  return { event, prevented: () => didPrevent };
}

function makeKeyEvent(
  code: string,
  overrides: Partial<ShortcutKeyEvent> = {},
): { event: ShortcutKeyEvent; prevented: () => boolean; stopped: () => boolean } {
  let didPrevent = false;
  let didStop = false;
  const event: ShortcutKeyEvent = {
    code,
    repeat: false,
    target: null,
    preventDefault: () => {
      didPrevent = true;
    },
    stopPropagation: () => {
      didStop = true;
    },
    ...overrides,
  };
  return { event, prevented: () => didPrevent, stopped: () => didStop };
}

function makeOverlayContext(
  overrides: Partial<OverlayGateContext> = {},
): OverlayGateContext {
  return {
    state: {
      dialogue: null,
      battle: null,
      arcade: null,
      journalOpen: false,
      transition: null,
      finale: null,
    },
    titleMode: null,
    qaMenuOpen: false,
    qaConsoleOpen: false,
    qaBlocked: false,
    photoMode: false,
    ...overrides,
  };
}

describe("Milestone 129: Overworld Pointer Steering & Input Shortcuts", () => {
  it("computes dead-zone, linear ramp, and unit cardinal/diagonal steering vectors", () => {
    const player = { x: 400, y: 300 };

    // Inside and right on the dead radius (18 px): zero movement.
    expect(computeOverworldSteer({ x: 400, y: 300 }, player)).toEqual({ x: 0, y: 0 });
    expect(computeOverworldSteer({ x: 410, y: 310 }, player)).toEqual({ x: 0, y: 0 });
    expect(computeOverworldSteer({ x: 418, y: 300 }, player)).toEqual({ x: 0, y: 0 });

    // Halfway between deadRadius (18) and rampRadius (64): distance 41 => mag 0.5.
    const halfRight = computeOverworldSteer({ x: 441, y: 300 }, player);
    expect(halfRight.x).toBeCloseTo(0.5, 6);
    expect(halfRight.y).toBeCloseTo(0, 6);

    // At and beyond rampRadius (64): full unit magnitude in each cardinal direction.
    expect(computeOverworldSteer({ x: 464, y: 300 }, player)).toEqual({ x: 1, y: 0 });
    expect(computeOverworldSteer({ x: 600, y: 300 }, player)).toEqual({ x: 1, y: 0 });
    expect(computeOverworldSteer({ x: 250, y: 300 }, player)).toEqual({ x: -1, y: 0 });
    expect(computeOverworldSteer({ x: 400, y: 180 }, player)).toEqual({ x: 0, y: -1 });
    expect(computeOverworldSteer({ x: 400, y: 500 }, player)).toEqual({ x: 0, y: 1 });

    // Diagonal signs and unit length beyond ramp radius.
    const upLeft = computeOverworldSteer({ x: 300, y: 200 }, player);
    expect(upLeft.x).toBeCloseTo(-Math.SQRT1_2, 6);
    expect(upLeft.y).toBeCloseTo(-Math.SQRT1_2, 6);
    expect(Math.hypot(upLeft.x, upLeft.y)).toBeCloseTo(1, 6);

    const downRight = computeOverworldSteer({ x: 500, y: 400 }, player);
    expect(downRight.x).toBeCloseTo(Math.SQRT1_2, 6);
    expect(downRight.y).toBeCloseTo(Math.SQRT1_2, 6);
  });

  it("ignores touch and right-click, syncs smoothly to a stop, and releases cleanly", () => {
    const windowListeners: Record<string, ((event?: OverworldPointerEvent) => void)[]> = {};
    const docListeners: Record<string, (() => void)[]> = {};
    const originalWindow = globalThis.window;
    const originalDocument = globalThis.document;
    let docHidden = false;
    Object.defineProperty(globalThis, "window", {
      value: {
        addEventListener: (
          type: string,
          listener: (event?: OverworldPointerEvent) => void,
        ): void => {
          const bucket = windowListeners[type] ?? [];
          bucket.push(listener);
          windowListeners[type] = bucket;
        },
      },
      configurable: true,
    });
    Object.defineProperty(globalThis, "document", {
      value: {
        get hidden(): boolean {
          return docHidden;
        },
        addEventListener: (type: string, listener: () => void): void => {
          const bucket = docListeners[type] ?? [];
          bucket.push(listener);
          docListeners[type] = bucket;
        },
      },
      configurable: true,
    });

    try {
      const { canvas, captured, emit } = createFakeCanvas();
      const emitted: Point[] = [];
      let allowSteer = true;
      let player: Point | null = { x: 400, y: 300 };

      const steer = bindOverworldPointerSteer({
        canvas,
        canSteer: () => allowSteer,
        playerScreen: () => player,
        onMove: (dir) => emitted.push(dir),
      });

      // Touch pointer is ignored (reserved for virtual joystick).
      const touchDown = makePointerEvent({
        pointerId: 1,
        pointerType: "touch",
        button: 0,
        clientX: 520,
        clientY: 300,
      });
      emit("pointerdown", touchDown.event);
      expect(touchDown.prevented()).toBe(false);
      expect(steer.isActive()).toBe(false);
      expect(emitted).toEqual([]);

      // Secondary mouse button is ignored.
      const rightDown = makePointerEvent({
        pointerId: 2,
        pointerType: "mouse",
        button: 2,
        clientX: 520,
        clientY: 300,
      });
      emit("pointerdown", rightDown.event);
      expect(rightDown.prevented()).toBe(false);
      expect(steer.isActive()).toBe(false);
      expect(emitted).toEqual([]);

      // Primary mouse down activates steering, captures pointer, and emits initial steer.
      const primaryDown = makePointerEvent({
        pointerId: 3,
        pointerType: "mouse",
        button: 0,
        clientX: 520,
        clientY: 300,
      });
      emit("pointerdown", primaryDown.event);
      expect(primaryDown.prevented()).toBe(true);
      expect(captured).toEqual([3]);
      expect(steer.isActive()).toBe(true);
      expect(emitted.at(-1)).toEqual({ x: 1, y: 0 });

      // As Fae walks closer to the held cursor, sync() decelerates and then stops in dead zone.
      player = { x: 479, y: 300 };
      steer.sync();
      expect(emitted.at(-1)?.x).toBeCloseTo(0.5, 6);
      expect(emitted.at(-1)?.y).toBeCloseTo(0, 6);

      player = { x: 510, y: 300 };
      steer.sync();
      expect(emitted.at(-1)).toEqual({ x: 0, y: 0 });

      // Pointer move updates direction; duplicate window bubble is ignored.
      const moveUp = makePointerEvent({
        pointerId: 3,
        pointerType: "mouse",
        button: 0,
        clientX: 510,
        clientY: 180,
      }).event;
      emit("pointermove", moveUp);
      const countAfterCanvasMove = emitted.length;
      for (const listener of windowListeners.pointermove ?? []) listener(moveUp);
      expect(emitted.length).toBe(countAfterCanvasMove);
      expect(emitted.at(-1)).toEqual({ x: 0, y: -1 });

      // Pointer up releases cleanly and idempotently.
      emit("pointerup", makePointerEvent({ pointerId: 3 }).event);
      expect(steer.isActive()).toBe(false);
      expect(emitted.at(-1)).toEqual({ x: 0, y: 0 });
      const countAfterUp = emitted.length;
      steer.release();
      steer.sync();
      expect(emitted.length).toBe(countAfterUp);

      // Pen input also works and releases immediately when canSteer() flips false during sync().
      player = { x: 400, y: 300 };
      emit(
        "pointerdown",
        makePointerEvent({
          pointerId: 4,
          pointerType: "pen",
          button: 0,
          clientX: 300,
          clientY: 300,
        }).event,
      );
      expect(steer.isActive()).toBe(true);
      expect(emitted.at(-1)).toEqual({ x: -1, y: 0 });
      allowSteer = false;
      steer.sync();
      expect(steer.isActive()).toBe(false);
      expect(emitted.at(-1)).toEqual({ x: 0, y: 0 });

      // Visibility change to hidden releases an active hold.
      allowSteer = true;
      emit(
        "pointerdown",
        makePointerEvent({
          pointerId: 5,
          pointerType: "mouse",
          button: 0,
          clientX: 400,
          clientY: 420,
        }).event,
      );
      expect(steer.isActive()).toBe(true);
      docHidden = true;
      for (const listener of docListeners.visibilitychange ?? []) listener();
      expect(steer.isActive()).toBe(false);
      expect(emitted.at(-1)).toEqual({ x: 0, y: 0 });
    } finally {
      Object.defineProperty(globalThis, "window", {
        value: originalWindow,
        configurable: true,
      });
      Object.defineProperty(globalThis, "document", {
        value: originalDocument,
        configurable: true,
      });
    }
  });

  it("preserves clamped analog steering vectors in TouchInput.setPointerArrow", () => {
    const input = new TouchInput();
    input.setPointerArrow({ x: 0.45, y: -0.25 });
    expect(input.frame().move).toEqual({ x: 0.45, y: -0.25 });

    input.setPointerArrow({ x: 2.5, y: -3 });
    expect(input.frame().move).toEqual({ x: 1, y: -1 });

    input.setPointerArrow(null);
    expect(input.frame().move).toEqual({ x: 0, y: 0 });
  });

  it("gates overworld steering, photo mode, battle peek, and journal/QA shortcuts", () => {
    const free = makeOverlayContext();
    expect(canOverworldSteer(free)).toBe(true);
    expect(canPhotoMode(free)).toBe(true);
    expect(canBattlePeek(free)).toBe(false);
    expect(isOverworldFree(free, false)).toBe(true);
    expect(isBannerEligible(free, false)).toBe(true);

    expect(canOverworldSteer({ ...free, photoMode: true })).toBe(false);
    expect(canOverworldSteer({ ...free, titleMode: "continue" })).toBe(false);
    expect(canOverworldSteer({ ...free, state: { ...free.state, journalOpen: true } })).toBe(
      false,
    );
    expect(
      isJournalShortcutActive({ ...free, state: { ...free.state, journalOpen: true } }),
    ).toBe(true);

    let ctx = makeOverlayContext();
    let battlePeekOpen = false;
    let qaConsoleOpen = false;
    let hasJournalOverlay = false;
    let choiceMoves = 0;
    let snaps = 0;
    let qaMenus = 0;
    let invalidations = 0;
    const swallowed: string[] = [];
    const pageSteps: number[] = [];
    const navSteps: string[] = [];

    let padActivity = false;
    let padPhotoAction: "toggle" | "snap" | "exit" | null = null;
    let padBumperStep: -1 | 0 | 1 = 0;
    let padNavStep: "up" | "down" | "left" | "right" | null = null;
    let padConfirmEdge = false;
    let padRightStickY = 0;
    let padTapsCleared = 0;

    const gamepad: ShortcutGamepadSource = {
      poll: () => [],
      consumeActivity: () => {
        const value = padActivity;
        padActivity = false;
        return value;
      },
      consumePhotoAction: () => {
        const value = padPhotoAction;
        padPhotoAction = null;
        return value;
      },
      consumeBumperStep: () => {
        const value = padBumperStep;
        padBumperStep = 0;
        return value;
      },
      consumeNavStep: () => {
        const value = padNavStep;
        padNavStep = null;
        return value;
      },
      consumeConfirmEdge: () => {
        const value = padConfirmEdge;
        padConfirmEdge = false;
        return value;
      },
      rightStickY: () => padRightStickY,
      clearTaps: () => {
        padTapsCleared += 1;
      },
    };

    const shortcuts = createInputShortcuts({
      getContext: () => ctx,
      getBattlePeekOpen: () => battlePeekOpen,
      setBattlePeek: (open) => {
        battlePeekOpen = open;
      },
      setPhotoMode: (open) => {
        ctx = { ...ctx, photoMode: open };
      },
      snapPostcard: () => {
        snaps += 1;
      },
      journal: {
        hasOpenOverlay: () => hasJournalOverlay,
        dismissOverlay: () => {
          hasJournalOverlay = false;
          return true;
        },
        stepOverlay: () => false,
        stepPage: (delta) => pageSteps.push(delta),
        scrollActivePage: () => true,
        navigateFocus: (dir) => {
          navSteps.push(dir);
          return true;
        },
        activateFocused: () => true,
      },
      gamepad,
      clearKeyboardTaps: () => undefined,
      swallow: (button) => swallowed.push(button),
      playChoiceMove: () => {
        choiceMoves += 1;
      },
      invalidate: () => {
        invalidations += 1;
      },
      qa: {
        openMenu: () => {
          qaMenus += 1;
        },
        isConsoleOpen: () => qaConsoleOpen,
        setConsoleOpen: (open) => {
          qaConsoleOpen = open;
        },
        openConsole: () => {
          qaConsoleOpen = true;
        },
      },
    });

    // KeyP enters photo mode, Enter snaps postcard and swallows confirm, Escape exits.
    const keyP = makeKeyEvent("KeyP");
    shortcuts.handleKeydown(keyP.event);
    expect(keyP.prevented()).toBe(true);
    expect(ctx.photoMode).toBe(true);

    const keyEnter = makeKeyEvent("Enter");
    shortcuts.handleKeydown(keyEnter.event);
    expect(snaps).toBe(1);
    expect(swallowed).toEqual(["confirm"]);

    shortcuts.handleKeydown(makeKeyEvent("Escape").event);
    expect(ctx.photoMode).toBe(false);

    // Journal keyboard tab flip & layered cancel-edge dismissal use bespoke foley callbacks.
    ctx = makeOverlayContext({ state: { ...ctx.state, journalOpen: true } });
    shortcuts.handleKeydown(makeKeyEvent("BracketRight").event);
    expect(pageSteps).toEqual([1]);
    expect(choiceMoves).toBe(0);

    hasJournalOverlay = true;
    expect(shortcuts.handleCancelEdge(false)).toBe("swallow");
    expect(hasJournalOverlay).toBe(false);
    expect(swallowed.at(-1)).toBe("cancel");
    expect(choiceMoves).toBe(0);

    // Gamepad activity switches HUD mode and drives journal bumper + focus nav.
    padActivity = true;
    padBumperStep = -1;
    padNavStep = "down";
    padConfirmEdge = true;
    padRightStickY = 0.8;
    shortcuts.pollGamepad();
    expect(shortcuts.inputMode()).toBe("gamepad");
    expect(pageSteps).toEqual([1, -1]);
    expect(navSteps).toEqual(["down"]);

    // Gamepad photo exit swallows cancel and clears taps.
    ctx = makeOverlayContext({ photoMode: true });
    padPhotoAction = "exit";
    shortcuts.pollGamepad();
    expect(ctx.photoMode).toBe(false);
    expect(padTapsCleared).toBe(1);

    // QA Backquote toggles console even when target is an input element; KeyQ skips input.
    const inputTarget = {
      closest: (selector: string): object | null =>
        selector.includes("input") ? { tagName: "INPUT" } : null,
    };
    shortcuts.handleQaKeydown(makeKeyEvent("KeyQ", { target: inputTarget }).event);
    expect(qaMenus).toBe(0);
    shortcuts.handleQaKeydown(makeKeyEvent("KeyQ").event);
    expect(qaMenus).toBe(1);
    shortcuts.handleQaKeydown(makeKeyEvent("Backquote", { target: inputTarget }).event);
    expect(qaConsoleOpen).toBe(true);
    shortcuts.handleQaKeydown(makeKeyEvent("Escape", { target: inputTarget }).event);
    expect(qaConsoleOpen).toBe(false);
    expect(invalidations).toBeGreaterThan(0);
  });
});
