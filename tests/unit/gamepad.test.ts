import { describe, expect, it } from "vitest";
import {
  blankInput,
  createState,
  stableHash,
  step,
  type ActionFrame,
} from "../../src/core";
import { loadContent } from "../../src/content/load";
import {
  combineInputFrames,
  gamepadFrame,
  GamepadLatch,
  type StandardGamepad,
} from "../../src/platform/gamepad";

function pad(
  axes: readonly number[] = [0, 0],
  buttons: readonly number[] = [],
  mapping = "standard",
): StandardGamepad {
  return {
    mapping,
    axes,
    buttons: Array.from({ length: 16 }, (_, index) => ({
      pressed: buttons.includes(index),
      value: buttons.includes(index) ? 1 : 0,
    })),
  };
}

describe("standard gamepad input", () => {
  it("applies a radial dead zone and rescales the remaining stick", () => {
    expect(gamepadFrame([pad([0.2, 0])]).move).toEqual({ x: 0, y: 0 });
    expect(gamepadFrame([pad([0.625, 0])]).move.x).toBeCloseTo(0.5);
    expect(gamepadFrame([pad([1, 0])]).move).toEqual({ x: 1, y: 0 });
  });

  it("gives the d-pad priority over the stick and maps buttons", () => {
    const frame = gamepadFrame([pad([1, 0], [0, 1, 2, 3, 9, 12, 15])]);
    expect(frame.move).toEqual({ x: 1, y: -1 });
    expect(frame.confirm).toBe(true);
    expect(frame.cancel).toBe(true);
    expect(frame.menu).toBe(true);
    expect(frame.lantern).toBe(true);
  });

  it("ignores non-standard pads and merges standard pads", () => {
    const frame = gamepadFrame([pad([1, 0], [0], "xinput"), pad([0, 1], [1])]);
    expect(frame.move).toEqual({ x: 0, y: 1 });
    expect(frame.confirm).toBe(false);
    expect(frame.cancel).toBe(true);
  });
});

describe("gamepad taps and input merging", () => {
  it("latches a press until the next tick sample", () => {
    const latch = new GamepadLatch();
    latch.update({ ...blankInput(), confirm: true });
    latch.update(blankInput());
    expect(latch.frame().confirm).toBe(true);
    expect(latch.frame().confirm).toBe(false);
  });

  it("keeps touch movement precedence and preserves the frame shape", () => {
    const keyboard = { ...blankInput(), move: { x: -1, y: 0 }, lantern: true };
    const touch = { ...blankInput(), move: { x: 1, y: 0 }, choose: 2 };
    const gamepad = { ...blankInput(), move: { x: 0, y: 1 }, confirm: true };
    expect(combineInputFrames(keyboard, touch, gamepad)).toEqual({
      move: { x: 1, y: 0 },
      confirm: true,
      cancel: false,
      menu: false,
      lantern: true,
      choose: 2,
    });
  });

  it("drives the sim exactly like the same keys", () => {
    // Live frames always go through the merge, so compare what the sim sees:
    // a pad's d-pad and buttons against the keyboard's frame for those keys.
    const content = loadContent();
    const start = content.fixtures["new-game"];
    if (start === undefined) throw new Error("new-game fixture missing");
    const keys = (move: { x: number; y: number }, confirm = false): ActionFrame => ({
      ...blankInput(),
      move,
      confirm,
      lantern: false,
    });
    const script: { keys: ActionFrame; pad: StandardGamepad; ticks: number }[] = [
      { keys: keys({ x: 1, y: 0 }), pad: pad([0, 0], [15]), ticks: 20 },
      { keys: keys({ x: 0, y: -1 }), pad: pad([0, 0], [12]), ticks: 15 },
      { keys: keys({ x: 0, y: 0 }, true), pad: pad([0, 0], [0]), ticks: 1 },
      { keys: keys({ x: 0, y: 0 }), pad: pad(), ticks: 5 },
    ];
    let byKeys = createState(content.world, start);
    let byPad = byKeys;
    for (const segment of script) {
      const keyFrame = combineInputFrames(segment.keys, blankInput(), blankInput());
      const padFrame = combineInputFrames(
        { ...blankInput(), lantern: false },
        blankInput(),
        gamepadFrame([segment.pad]),
      );
      expect(padFrame).toStrictEqual(keyFrame);
      for (let tick = 0; tick < segment.ticks; tick += 1) {
        byKeys = step(content.world, byKeys, keyFrame).state;
        byPad = step(content.world, byPad, padFrame).state;
      }
    }
    expect(byPad.tick).toBe(41);
    expect(byPad.player).not.toEqual(createState(content.world, start).player);
    expect(stableHash(byPad)).toBe(stableHash(byKeys));
  });
});
