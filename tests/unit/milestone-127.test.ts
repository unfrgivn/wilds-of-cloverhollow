import { describe, expect, it } from "vitest";
import {
  bindPointerHold,
  isConfirmCheckKind,
  type PointerHoldEvent,
  type PointerHoldTarget,
} from "../../src/ui/pointer-hold";

type ListenerMap = Record<string, ((event: PointerHoldEvent) => void)[]>;

function createFakeTarget(): {
  target: PointerHoldTarget;
  captured: number[];
  emit: (type: string, event: PointerHoldEvent) => void;
} {
  const listeners: ListenerMap = {};
  const captured: number[] = [];
  const target: PointerHoldTarget = {
    addEventListener: (type, listener) => {
      const bucket = listeners[type] ?? [];
      bucket.push(listener);
      listeners[type] = bucket;
    },
    setPointerCapture: (pointerId) => {
      captured.push(pointerId);
    },
  };
  const emit = (type: string, event: PointerHoldEvent): void => {
    for (const listener of listeners[type] ?? []) listener(event);
  };
  return { target, captured, emit };
}

function makePointerEvent(
  overrides: Partial<PointerHoldEvent> = {},
): { event: PointerHoldEvent; prevented: () => boolean } {
  let didPrevent = false;
  const event: PointerHoldEvent = {
    pointerId: 1,
    pointerType: "mouse",
    button: 0,
    target: null,
    preventDefault: () => {
      didPrevent = true;
    },
    ...overrides,
  };
  return { event, prevented: () => didPrevent };
}

describe("Milestone 127: Direct Mouse & Touch Pointer Play Helper", () => {
  it("classifies confirm-driven battle checks vs directional, trace, and echo checks", () => {
    expect(isConfirmCheckKind("ring")).toBe(true);
    expect(isConfirmCheckKind("charge")).toBe(true);
    expect(isConfirmCheckKind("chain")).toBe(true);
    expect(isConfirmCheckKind("peekaboo")).toBe(true);

    expect(isConfirmCheckKind("catch")).toBe(false);
    expect(isConfirmCheckKind("lean")).toBe(false);
    expect(isConfirmCheckKind("trace")).toBe(false);
    expect(isConfirmCheckKind("echo")).toBe(false);
    expect(isConfirmCheckKind(null)).toBe(false);
    expect(isConfirmCheckKind(undefined)).toBe(false);
  });

  it("handles primary press-and-hold, guards buttons/secondary clicks, and releases", () => {
    const windowListeners: Record<string, ((event?: PointerHoldEvent) => void)[]> = {};
    const originalWindow = globalThis.window;
    const fakeWindow = {
      addEventListener: (type: string, listener: (event?: PointerHoldEvent) => void): void => {
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
      const { target, captured, emit } = createFakeTarget();
      const events: boolean[] = [];
      let enabled = true;
      const handle = bindPointerHold(target, (held) => events.push(held), () => enabled);

      // Secondary mouse button (right click) is ignored.
      const rightClick = makePointerEvent({ pointerId: 1, button: 2 });
      emit("pointerdown", rightClick.event);
      expect(events).toEqual([]);
      expect(rightClick.prevented()).toBe(false);

      // Click originating inside an interactive <button> is ignored.
      const nestedButton = Object.assign(new EventTarget(), {
        closest: (selector: string): object | null =>
          selector.includes("button") ? { tagName: "BUTTON" } : null,
      });
      const buttonClick = makePointerEvent({ pointerId: 2, target: nestedButton });
      emit("pointerdown", buttonClick.event);
      expect(events).toEqual([]);
      expect(buttonClick.prevented()).toBe(false);

      // Blocked when canStart() returns false.
      enabled = false;
      const blocked = makePointerEvent({ pointerId: 3 });
      emit("pointerdown", blocked.event);
      expect(events).toEqual([]);
      expect(blocked.prevented()).toBe(false);

      // Primary pointerdown starts hold, prevents default, and captures pointer.
      enabled = true;
      const start = makePointerEvent({ pointerId: 4 });
      emit("pointerdown", start.event);
      expect(events).toEqual([true]);
      expect(start.prevented()).toBe(true);
      expect(captured).toEqual([4]);

      // Pointerup from an unrelated pointerId does not prematurely release.
      emit("pointerup", makePointerEvent({ pointerId: 99 }).event);
      expect(events).toEqual([true]);

      // Matching pointerup releases cleanly; repeated release() calls are idempotent.
      emit("pointerup", makePointerEvent({ pointerId: 4 }).event);
      handle.release();
      handle.release();
      expect(events).toEqual([true, false]);

      // Programmatic release() drops an active hold cleanly, and window blur does too.
      emit("pointerdown", makePointerEvent({ pointerId: 5, pointerType: "touch" }).event);
      expect(events).toEqual([true, false, true]);
      handle.release();
      handle.release();
      expect(events).toEqual([true, false, true, false]);

      emit("pointerdown", makePointerEvent({ pointerId: 6 }).event);
      expect(events).toEqual([true, false, true, false, true]);
      for (const listener of windowListeners.blur ?? []) listener();
      expect(events).toEqual([true, false, true, false, true, false]);
    } finally {
      Object.defineProperty(globalThis, "window", {
        value: originalWindow,
        configurable: true,
      });
    }
  });
});
