import { describe, expect, it } from "vitest";
import type { Point } from "../../src/core";
import { TouchInput } from "../../src/platform/touch";
import {
  bindPointerMoveHold,
  isDirectionalCheckKind,
  resolveCatchDirection,
  resolveCometLaneStep,
  resolveLeanDirection,
  type PointerMoveHoldEvent,
  type PointerMoveHoldTarget,
} from "../../src/ui/pointer-hold";

type ListenerMap = Record<string, ((event: PointerMoveHoldEvent) => void)[]>;

function createFakeMoveTarget(): {
  target: PointerMoveHoldTarget;
  captured: number[];
  emit: (type: string, event: PointerMoveHoldEvent) => void;
} {
  const listeners: ListenerMap = {};
  const captured: number[] = [];
  const target: PointerMoveHoldTarget = {
    addEventListener: (type, listener) => {
      const bucket = listeners[type] ?? [];
      bucket.push(listener);
      listeners[type] = bucket;
    },
    setPointerCapture: (pointerId) => {
      captured.push(pointerId);
    },
  };
  const emit = (type: string, event: PointerMoveHoldEvent): void => {
    for (const listener of listeners[type] ?? []) listener(event);
  };
  return { target, captured, emit };
}

function makeMoveEvent(
  overrides: Partial<PointerMoveHoldEvent> = {},
): { event: PointerMoveHoldEvent; prevented: () => boolean } {
  let didPrevent = false;
  const event: PointerMoveHoldEvent = {
    pointerId: 1,
    pointerType: "mouse",
    button: 0,
    clientX: 0,
    clientY: 0,
    target: null,
    preventDefault: () => {
      didPrevent = true;
    },
    ...overrides,
  };
  return { event, prevented: () => didPrevent };
}

describe("Milestone 128: Complete Mouse & Touch Pointer Play Helpers", () => {
  it("classifies directional battle checks separately from confirm, trace, and echo", () => {
    expect(isDirectionalCheckKind("catch")).toBe(true);
    expect(isDirectionalCheckKind("lean")).toBe(true);

    expect(isDirectionalCheckKind("ring")).toBe(false);
    expect(isDirectionalCheckKind("charge")).toBe(false);
    expect(isDirectionalCheckKind("chain")).toBe(false);
    expect(isDirectionalCheckKind("peekaboo")).toBe(false);
    expect(isDirectionalCheckKind("trace")).toBe(false);
    expect(isDirectionalCheckKind("echo")).toBe(false);
    expect(isDirectionalCheckKind(null)).toBe(false);
    expect(isDirectionalCheckKind(undefined)).toBe(false);
  });

  it("resolves catch lane holds across top, middle, bottom, and clamped edges", () => {
    expect(resolveCatchDirection(120, 200, 500, 3)).toEqual({ x: 0, y: -1 });
    expect(resolveCatchDirection(200, 200, 500, 3)).toEqual({ x: 0, y: -1 });
    expect(resolveCatchDirection(299, 200, 500, 3)).toEqual({ x: 0, y: -1 });
    expect(resolveCatchDirection(300, 200, 500, 3)).toEqual({ x: 0, y: 0 });
    expect(resolveCatchDirection(350, 200, 500, 3)).toEqual({ x: 0, y: 0 });
    expect(resolveCatchDirection(399, 200, 500, 3)).toEqual({ x: 0, y: 0 });
    expect(resolveCatchDirection(400, 200, 500, 3)).toEqual({ x: 0, y: 1 });
    expect(resolveCatchDirection(500, 200, 500, 3)).toEqual({ x: 0, y: 1 });
    expect(resolveCatchDirection(620, 200, 500, 3)).toEqual({ x: 0, y: 1 });
    expect(resolveCatchDirection(300, 400, 400, 3)).toEqual({ x: 0, y: 0 });
    expect(resolveCatchDirection(300, 200, 500, 1)).toEqual({ x: 0, y: 0 });
  });

  it("resolves lean direction left and right around the balance track centre", () => {
    expect(resolveLeanDirection(100, 400)).toEqual({ x: -1, y: 0 });
    expect(resolveLeanDirection(399.5, 400)).toEqual({ x: -1, y: 0 });
    expect(resolveLeanDirection(400, 400)).toEqual({ x: 1, y: 0 });
    expect(resolveLeanDirection(720, 400)).toEqual({ x: 1, y: 0 });
  });

  it("resolves Comet Cruise lane steps across all 3 lanes and edge clamps", () => {
    // Field x: [100, 400], lanes: [100..200), [200..300), [300..400].
    expect(resolveCometLaneStep(50, 100, 300, 1)).toBe(-1);
    expect(resolveCometLaneStep(150, 100, 300, 1)).toBe(-1);
    expect(resolveCometLaneStep(250, 100, 300, 1)).toBe(0);
    expect(resolveCometLaneStep(350, 100, 300, 1)).toBe(1);
    expect(resolveCometLaneStep(450, 100, 300, 1)).toBe(1);

    expect(resolveCometLaneStep(150, 100, 300, 0)).toBe(0);
    expect(resolveCometLaneStep(250, 100, 300, 0)).toBe(1);
    expect(resolveCometLaneStep(350, 100, 300, 0)).toBe(1);

    expect(resolveCometLaneStep(350, 100, 300, 2)).toBe(0);
    expect(resolveCometLaneStep(250, 100, 300, 2)).toBe(-1);
    expect(resolveCometLaneStep(150, 100, 300, 2)).toBe(-1);

    expect(resolveCometLaneStep(250, 100, 0, 1)).toBe(0);
  });

  it("tracks moves, refreshes while held, guards buttons, and releases cleanly", () => {
    const windowListeners: Record<string, ((event?: PointerMoveHoldEvent) => void)[]> = {};
    const originalWindow = globalThis.window;
    const fakeWindow = {
      addEventListener: (
        type: string,
        listener: (event?: PointerMoveHoldEvent) => void,
      ): void => {
        const bucket = windowListeners[type] ?? [];
        bucket.push(listener);
        windowListeners[type] = bucket;
      },
    };
    Object.defineProperty(globalThis, "window", {
      value: fakeWindow,
      configurable: true,
    });
    try {
      const { target, captured, emit } = createFakeMoveTarget();
      const emitted: Point[] = [];
      let enabled = true;
      let centerX = 300;
      const handle = bindPointerMoveHold(
        target,
        (dir) => emitted.push(dir),
        (clientX) => resolveLeanDirection(clientX, centerX),
        () => enabled,
      );

      // Secondary mouse button is ignored.
      const rightClick = makeMoveEvent({ pointerId: 1, button: 2, clientX: 500 });
      emit("pointerdown", rightClick.event);
      expect(emitted).toEqual([]);
      expect(rightClick.prevented()).toBe(false);

      // Interactive nested button is ignored.
      const nestedButton = Object.assign(new EventTarget(), {
        closest: (selector: string): object | null =>
          selector.includes("button") ? { tagName: "BUTTON" } : null,
      });
      const buttonClick = makeMoveEvent({ pointerId: 2, target: nestedButton, clientX: 500 });
      emit("pointerdown", buttonClick.event);
      expect(emitted).toEqual([]);
      expect(buttonClick.prevented()).toBe(false);

      // Blocked when canStart() is false.
      enabled = false;
      emit("pointerdown", makeMoveEvent({ pointerId: 3, clientX: 500 }).event);
      expect(emitted).toEqual([]);

      // Primary down emits resolved direction, moves update it, and refresh re-evaluates.
      enabled = true;
      const start = makeMoveEvent({ pointerId: 4, clientX: 450, clientY: 200 });
      emit("pointerdown", start.event);
      expect(start.prevented()).toBe(true);
      expect(captured).toEqual([4]);
      expect(emitted).toEqual([{ x: 1, y: 0 }]);

      // Duplicate bubbled pointermove on window is deduplicated.
      const moveLeft = makeMoveEvent({ pointerId: 4, clientX: 200, clientY: 200 }).event;
      emit("pointermove", moveLeft);
      for (const listener of windowListeners.pointermove ?? []) listener(moveLeft);
      expect(emitted).toEqual([{ x: 1, y: 0 }, { x: -1, y: 0 }]);

      // Unrelated pointermove is ignored.
      emit("pointermove", makeMoveEvent({ pointerId: 99, clientX: 600 }).event);
      expect(emitted).toEqual([{ x: 1, y: 0 }, { x: -1, y: 0 }]);

      // Refresh re-evaluates last pointer position against updated geometry.
      centerX = 150;
      handle.refresh();
      expect(emitted).toEqual([{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 1, y: 0 }]);

      // Matching pointerup releases cleanly; repeated release() calls are idempotent.
      emit("pointerup", makeMoveEvent({ pointerId: 4 }).event);
      handle.release();
      handle.release();
      handle.refresh();
      expect(emitted).toEqual([
        { x: 1, y: 0 },
        { x: -1, y: 0 },
        { x: 1, y: 0 },
        { x: 0, y: 0 },
      ]);

      // Window blur releases an active hold cleanly.
      emit("pointerdown", makeMoveEvent({ pointerId: 5, pointerType: "touch", clientX: 50 }).event);
      for (const listener of windowListeners.blur ?? []) listener();
      expect(emitted.at(-2)).toEqual({ x: -1, y: 0 });
      expect(emitted.at(-1)).toEqual({ x: 0, y: 0 });
    } finally {
      Object.defineProperty(globalThis, "window", {
        value: originalWindow,
        configurable: true,
      });
    }
  });

  it("keeps TouchInput.setPointerArrow isolated from held touch arrow stickers", () => {
    const input = new TouchInput();
    input.setPointerArrow({ x: 1, y: 0 });
    expect(input.frame().move).toEqual({ x: 1, y: 0 });

    // Touch arrow sticker takes precedence and is not clobbered when pointer arrow clears.
    input.holdArrow({ x: -1, y: 0 });
    expect(input.frame().move).toEqual({ x: -1, y: 0 });
    input.setPointerArrow(null);
    expect(input.frame().move).toEqual({ x: -1, y: 0 });

    // Releasing all arrows clears both touch and pointer arrows.
    input.setPointerArrow({ x: 0, y: -1 });
    input.releaseArrows();
    expect(input.frame().move).toEqual({ x: 0, y: 0 });
  });
});
