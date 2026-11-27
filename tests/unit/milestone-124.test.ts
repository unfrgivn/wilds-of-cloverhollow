import { describe, expect, it } from "vitest";
import {
  gamepadHasActivity,
  gamepadNavDirection,
  gamepadRightStickY,
  GamepadInput,
  type StandardGamepad,
} from "../../src/platform/gamepad";
import { computeJournalScrollDelta, cycleIndex } from "../../src/ui/journal-nav";

function makePad(options: {
  mapping?: string;
  axes?: readonly number[];
  pressedIndices?: readonly number[];
} = {}): StandardGamepad {
  const pressedSet = new Set(options.pressedIndices ?? []);
  return {
    mapping: options.mapping ?? "standard",
    axes: options.axes ?? [0, 0, 0, 0],
    buttons: Array.from({ length: 16 }, (_, index) => ({
      pressed: pressedSet.has(index),
      value: pressedSet.has(index) ? 1 : 0,
    })),
  };
}

describe("Milestone 124: pure Journal navigation helpers", () => {
  it("wraps indices cleanly forward and backward across all bounds and empty lists", () => {
    expect(cycleIndex(0, 0, 1)).toBe(-1);
    expect(cycleIndex(0, -3, -1)).toBe(-1);
    expect(cycleIndex(-1, 4, 1)).toBe(0);
    expect(cycleIndex(-1, 4, -1)).toBe(3);
    expect(cycleIndex(9, 4, 1)).toBe(0);
    expect(cycleIndex(9, 4, -1)).toBe(3);
    expect(cycleIndex(0, 4, 1)).toBe(1);
    expect(cycleIndex(3, 4, 1)).toBe(0);
    expect(cycleIndex(0, 4, -1)).toBe(3);
    expect(cycleIndex(2, 4, -1)).toBe(1);
    expect(cycleIndex(0, 1, 1)).toBe(0);
    expect(cycleIndex(0, 1, -1)).toBe(0);
  });

  it("scales right-stick scroll deltas past dead zone and clamps to maxPixelsPerTick", () => {
    expect(computeJournalScrollDelta(0)).toBe(0);
    expect(computeJournalScrollDelta(0.25)).toBe(0);
    expect(computeJournalScrollDelta(-0.25)).toBe(0);
    expect(computeJournalScrollDelta(0.625)).toBeCloseTo(4.5, 5);
    expect(computeJournalScrollDelta(-0.625)).toBeCloseTo(-4.5, 5);
    expect(computeJournalScrollDelta(1)).toBe(9);
    expect(computeJournalScrollDelta(-1)).toBe(-9);
    expect(computeJournalScrollDelta(1.8)).toBe(9);
    expect(computeJournalScrollDelta(-1.8)).toBe(-9);
    expect(computeJournalScrollDelta(0.5, 0.2, 12)).toBeCloseTo(4.5, 5);
  });
});

describe("Milestone 124: gamepad Journal navigation signals", () => {
  it("reads right-stick Y and ignores dead-zone or non-standard pads", () => {
    expect(gamepadRightStickY([])).toBe(0);
    expect(gamepadRightStickY([makePad({ axes: [0, 0, 0, 0.25] })])).toBe(0);
    expect(gamepadRightStickY([makePad({ axes: [0, 0] })])).toBe(0);
    expect(
      gamepadRightStickY([makePad({ mapping: "nonstandard", axes: [0, 0, 0, 0.9] })]),
    ).toBe(0);
    expect(
      gamepadRightStickY([
        makePad({ mapping: "nonstandard", axes: [0, 0, 0, -0.9] }),
        makePad({ axes: [0, 0, 0, 0.1] }),
        makePad({ axes: [0, 0, 0, -0.75] }),
      ]),
    ).toBe(-0.75);
    expect(gamepadHasActivity([makePad({ axes: [0, 0, 0, 0.6] })])).toBe(true);
  });

  it("reads D-Pad and left-stick navigation directions cleanly on standard pads", () => {
    expect(gamepadNavDirection([])).toBeNull();
    expect(gamepadNavDirection([makePad()])).toBeNull();
    expect(gamepadNavDirection([makePad({ axes: [0.55, 0] })])).toBeNull();
    expect(
      gamepadNavDirection([makePad({ mapping: "xinput", pressedIndices: [12] })]),
    ).toBeNull();
    expect(gamepadNavDirection([makePad({ pressedIndices: [12] })])).toBe("up");
    expect(gamepadNavDirection([makePad({ pressedIndices: [13] })])).toBe("down");
    expect(gamepadNavDirection([makePad({ pressedIndices: [14] })])).toBe("left");
    expect(gamepadNavDirection([makePad({ pressedIndices: [15] })])).toBe("right");
    expect(gamepadNavDirection([makePad({ axes: [-0.8, 0.1] })])).toBe("left");
    expect(gamepadNavDirection([makePad({ axes: [0.8, -0.2] })])).toBe("right");
    expect(gamepadNavDirection([makePad({ axes: [0.1, -0.9] })])).toBe("up");
    expect(gamepadNavDirection([makePad({ axes: [0.2, 0.9] })])).toBe("down");
    // D-Pad overrides left stick cleanly.
    expect(
      gamepadNavDirection([makePad({ axes: [0.9, 0], pressedIndices: [12] })]),
    ).toBe("up");
  });

  it("emits edge-triggered nav steps, confirm edges, and live rightStickY", () => {
    let pads: readonly StandardGamepad[] = [];
    const originalWindow = globalThis.window;
    const fakeWindow = { addEventListener: (): void => undefined };
    Object.defineProperty(globalThis, "window", {
      value: fakeWindow,
      configurable: true,
    });
    try {
      const input = new GamepadInput(() => pads);
      input.poll();
      expect(input.consumeNavStep()).toBeNull();
      expect(input.consumeConfirmEdge()).toBe(false);
      expect(input.rightStickY()).toBe(0);

      // Rising edge on D-Pad down; held state does not re-emit.
      pads = [makePad({ pressedIndices: [13] })];
      input.poll();
      expect(input.consumeNavStep()).toBe("down");
      expect(input.consumeNavStep()).toBeNull();
      input.poll();
      expect(input.consumeNavStep()).toBeNull();

      // Switching directly to D-Pad right emits a fresh step edge.
      pads = [makePad({ pressedIndices: [15] })];
      input.poll();
      expect(input.consumeNavStep()).toBe("right");

      // Rising edge on A (button 0) and live right-stick Y reading.
      pads = [makePad({ pressedIndices: [0], axes: [0, 0, 0, 0.8] })];
      input.poll();
      expect(input.consumeConfirmEdge()).toBe(true);
      expect(input.consumeConfirmEdge()).toBe(false);
      expect(input.rightStickY()).toBe(0.8);

      // Held A does not re-emit; clearing taps zeroes pending state cleanly.
      input.poll();
      expect(input.consumeConfirmEdge()).toBe(false);
      pads = [makePad({ pressedIndices: [12] })];
      input.poll();
      input.clearTaps();
      expect(input.consumeNavStep()).toBeNull();
      expect(input.rightStickY()).toBe(0);
    } finally {
      Object.defineProperty(globalThis, "window", {
        value: originalWindow,
        configurable: true,
      });
    }
  });
});
