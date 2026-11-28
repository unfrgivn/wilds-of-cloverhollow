import { describe, expect, it } from "vitest";
import {
  gamepadHasActivity,
  GamepadInput,
  gamepadPhotoButtons,
  type StandardGamepad,
} from "../../src/platform/gamepad";
import { hudHintKeys } from "../../src/ui/hud-hints";
import { computeFlyerVisual } from "../../src/render/overworld-render";

function makePad(options: {
  mapping?: string;
  axes?: readonly number[];
  pressedIndices?: readonly number[];
  buttonCount?: number;
} = {}): StandardGamepad {
  const count = options.buttonCount ?? 16;
  const pressedSet = new Set(options.pressedIndices ?? []);
  return {
    mapping: options.mapping ?? "standard",
    axes: options.axes ?? [0, 0],
    buttons: Array.from({ length: count }, (_, index) => ({
      pressed: pressedSet.has(index),
      value: pressedSet.has(index) ? 1 : 0,
    })),
  };
}

describe("Milestone 117: Gamepad photo buttons & activity detection", () => {
  it("reads toggle (8), snap (0), and exit (1) across standard pads only", () => {
    expect(gamepadPhotoButtons([])).toEqual({ toggle: false, snap: false, exit: false });
    expect(gamepadPhotoButtons([makePad()])).toEqual({
      toggle: false,
      snap: false,
      exit: false,
    });
    expect(
      gamepadPhotoButtons([makePad({ mapping: "xinput", pressedIndices: [0, 1, 8] })]),
    ).toEqual({ toggle: false, snap: false, exit: false });
    expect(gamepadPhotoButtons([makePad({ pressedIndices: [8] })])).toEqual({
      toggle: true,
      snap: false,
      exit: false,
    });
    expect(
      gamepadPhotoButtons([
        makePad({ pressedIndices: [0] }),
        makePad({ pressedIndices: [1] }),
      ]),
    ).toEqual({ toggle: false, snap: true, exit: true });
  });

  it("detects standard pad activity from stick, d-pad, or buttons 0..15", () => {
    expect(gamepadHasActivity([])).toBe(false);
    expect(gamepadHasActivity([makePad()])).toBe(false);
    // Inside 0.25 radial dead zone counts as idle.
    expect(gamepadHasActivity([makePad({ axes: [0.2, 0.1] })])).toBe(false);
    // Non-standard pads are ignored even with stick and buttons active.
    expect(
      gamepadHasActivity([makePad({ mapping: "nonstandard", axes: [1, 0], pressedIndices: [0] })]),
    ).toBe(false);
    // Stick past 0.25 triggers activity.
    expect(gamepadHasActivity([makePad({ axes: [0.3, 0] })])).toBe(true);
    // D-pad (12..15) and face/shoulder/select buttons (0..11) trigger activity.
    expect(gamepadHasActivity([makePad({ pressedIndices: [12] })])).toBe(true);
    expect(gamepadHasActivity([makePad({ pressedIndices: [8] })])).toBe(true);
    expect(gamepadHasActivity([makePad({ pressedIndices: [5] })])).toBe(true);
  });

  it("emits edge-triggered photo actions and activity pulses from GamepadInput", () => {
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
      expect(input.consumePhotoAction()).toBeNull();
      expect(input.consumeActivity()).toBe(false);

      // Rising edge on Select (8) -> "toggle", held press does not repeat.
      pads = [makePad({ pressedIndices: [8] })];
      input.poll();
      expect(input.consumePhotoAction()).toBe("toggle");
      expect(input.consumeActivity()).toBe(true);
      expect(input.consumeActivity()).toBe(false);
      input.poll();
      expect(input.consumePhotoAction()).toBeNull();

      // Release, then rising edge on A (0) -> "snap".
      pads = [makePad()];
      input.poll();
      pads = [makePad({ pressedIndices: [0] })];
      input.poll();
      expect(input.consumePhotoAction()).toBe("snap");

      // Release, then rising edge on B (1) -> "exit".
      pads = [makePad()];
      input.poll();
      pads = [makePad({ pressedIndices: [1] })];
      input.poll();
      expect(input.consumePhotoAction()).toBe("exit");
    } finally {
      Object.defineProperty(globalThis, "window", {
        value: originalWindow,
        configurable: true,
      });
    }
  });
});

describe("Milestone 117: Adaptive Controller HUD Key Hints", () => {
  it("maps exact glyphs for keyboard and gamepad modes", () => {
    expect(hudHintKeys("keyboard")).toEqual({
      interact: "Z",
      journal: "J",
      lantern: "L",
      flute: "F",
      lasso: "R",
      mute: "M",
      photo: "P",
      guide: "I",
    });
    expect(hudHintKeys("gamepad")).toEqual({
      interact: "A",
      journal: "Y",
      lantern: "X",
      flute: "RB",
      lasso: "LB",
      mute: "M",
      photo: "View",
      guide: "View",
    });
  });
});

describe("Milestone 117: Firefly Halos & Grounded Butterfly Shadows", () => {
  it("projects grounded contact shadows for butterfly_pink and butterfly_blue", () => {
    for (const animation of ["butterfly_pink", "butterfly_blue"]) {
      const visual = computeFlyerVisual(
        { id: `park-${animation}`, animation, size: 20 },
        { x: 410, y: 520 },
        30,
        false,
      );
      expect(visual.glow).toBeNull();
      expect(visual.shadow).not.toBeNull();
      expect(visual.shadow?.x).toBe(410);
      expect(visual.shadow?.y).toBe(538);
      expect(visual.shadow?.width).toBeCloseTo(14.4, 5);
      expect(visual.shadow?.height).toBeCloseTo(5.6, 5);
      expect(visual.shadow?.alpha).toBeCloseTo(0.16, 5);
    }
  });

  it("casts pulsing golden halos for fairy_light and steady halos on Reduced Motion", () => {
    const flyer = { id: "woods-firefly-cabin", animation: "fairy_light", size: 18 };
    const pos = { x: 600, y: 480 };
    const alphas = new Set<number>();
    for (let tick = 0; tick < 80; tick += 8) {
      const visual = computeFlyerVisual(flyer, pos, tick, false);
      expect(visual.shadow).toBeNull();
      expect(visual.glow).not.toBeNull();
      expect(visual.glow?.x).toBe(600);
      expect(visual.glow?.y).toBe(480);
      expect(visual.glow?.width).toBeCloseTo(46.8, 5);
      expect(visual.glow?.height).toBeCloseTo(46.8, 5);
      expect(visual.glow?.tint).toBe(0xffe484);
      expect(visual.glow?.alpha).toBeGreaterThanOrEqual(0.34);
      expect(visual.glow?.alpha).toBeLessThanOrEqual(0.58);
      alphas.add(Number((visual.glow?.alpha ?? 0).toFixed(4)));
    }
    expect(alphas.size).toBeGreaterThan(3);

    // Deterministic phase differs across distinct firefly IDs.
    const other = computeFlyerVisual(
      { id: "woods-firefly-stream", animation: "fairy_light", size: 18 },
      pos,
      0,
      false,
    );
    const first = computeFlyerVisual(flyer, pos, 0, false);
    expect(other.glow?.alpha).not.toBeCloseTo(first.glow?.alpha ?? 0, 5);

    // Under Reduced Motion, halo alpha stays steady at 0.44 across all ticks.
    for (const tick of [0, 15, 42, 99]) {
      const steady = computeFlyerVisual(flyer, pos, tick, true);
      expect(steady.shadow).toBeNull();
      expect(steady.glow?.alpha).toBeCloseTo(0.44, 5);
      expect(steady.glow?.tint).toBe(0xffe484);
    }
  });

  it("returns nulls for unknown flyer animation types", () => {
    expect(
      computeFlyerVisual(
        { id: "misc-1", animation: "leaf_drift", size: 16 },
        { x: 100, y: 100 },
        10,
        false,
      ),
    ).toEqual({ shadow: null, glow: null });
  });
});
