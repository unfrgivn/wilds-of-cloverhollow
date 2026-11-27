import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadContent } from "../../src/content/load";
import type { Point } from "../../src/core";
import { areaEntityAtlases as renderAreaEntityAtlases } from "../../src/render/overworld-render";
import { areaEntityAtlases as viewAreaEntityAtlases } from "../../src/render/view";
import {
  bindOverworldPointerSteer,
  isOverworldTap,
  type OverworldPointerEvent,
  type OverworldPointerTarget,
} from "../../src/shell/overworld-pointer";

type PointerListenerMap = Record<string, ((event: OverworldPointerEvent) => void)[]>;

function createFakeCanvas(): {
  canvas: OverworldPointerTarget;
  emit: (type: string, event: OverworldPointerEvent) => void;
} {
  const listeners: PointerListenerMap = {};
  const canvas: OverworldPointerTarget = {
    addEventListener: (type, listener) => {
      const bucket = listeners[type] ?? [];
      bucket.push(listener);
      listeners[type] = bucket;
    },
    setPointerCapture: () => undefined,
  };
  const emit = (type: string, event: OverworldPointerEvent): void => {
    for (const listener of listeners[type] ?? []) listener(event);
  };
  return { canvas, emit };
}

function makePointerEvent(
  overrides: Partial<OverworldPointerEvent> = {},
): OverworldPointerEvent {
  return {
    pointerId: 1,
    pointerType: "mouse",
    button: 0,
    clientX: 0,
    clientY: 0,
    preventDefault: () => undefined,
    ...overrides,
  };
}

describe("Milestone 131: Clickable Key Hints, Overworld Click-to-Pet/Rest & Entity Layer", () => {
  it("classifies near-player taps vs long holds, drags, far clicks, and null playerScreen", () => {
    const player: Point = { x: 640, y: 360 };

    // Quick near-player taps (exact, minor jitter, and boundary values).
    expect(isOverworldTap({ x: 640, y: 360 }, { x: 640, y: 360 }, 40, player)).toBe(true);
    expect(isOverworldTap({ x: 660, y: 380 }, { x: 668, y: 386 }, 120, player)).toBe(true);
    expect(isOverworldTap({ x: 736, y: 360 }, { x: 736, y: 360 }, 260, player)).toBe(true);
    expect(isOverworldTap({ x: 640, y: 360 }, { x: 652, y: 360 }, 0, player)).toBe(true);

    // Long holds (> 260 ms) and negative durations are rejected.
    expect(isOverworldTap({ x: 640, y: 360 }, { x: 640, y: 360 }, 261, player)).toBe(false);
    expect(isOverworldTap({ x: 640, y: 360 }, { x: 640, y: 360 }, -1, player)).toBe(false);

    // Dragged gestures (> 12 px) are rejected.
    expect(isOverworldTap({ x: 640, y: 360 }, { x: 653, y: 360 }, 50, player)).toBe(false);
    expect(isOverworldTap({ x: 640, y: 360 }, { x: 649, y: 369 }, 50, player)).toBe(false);

    // Far-from-player clicks (> 96 px) are rejected.
    expect(isOverworldTap({ x: 737, y: 360 }, { x: 737, y: 360 }, 50, player)).toBe(false);
    expect(isOverworldTap({ x: 640, y: 500 }, { x: 640, y: 500 }, 50, player)).toBe(false);

    // Null playerScreen is always rejected.
    expect(isOverworldTap({ x: 640, y: 360 }, { x: 640, y: 360 }, 20, null)).toBe(false);
  });

  it("fires onTapNearPlayer only on crisp near-player clicks, never on holds or far clicks", () => {
    const { canvas, emit } = createFakeCanvas();
    let clock = 1000;
    let allowSteer = true;
    const player: Point = { x: 640, y: 360 };
    const moves: Point[] = [];
    let taps = 0;

    const steer = bindOverworldPointerSteer({
      canvas,
      canSteer: () => allowSteer,
      playerScreen: () => player,
      onMove: (dir) => moves.push(dir),
      onTapNearPlayer: () => {
        taps += 1;
      },
      now: () => clock,
    });

    // Crisp near-player mouse click fires onTapNearPlayer once and releases cleanly.
    emit("pointerdown", makePointerEvent({ pointerId: 1, clientX: 660, clientY: 380 }));
    clock += 80;
    emit("pointerup", makePointerEvent({ pointerId: 1, clientX: 664, clientY: 382 }));
    expect(taps).toBe(1);
    expect(steer.isActive()).toBe(false);
    expect(moves.at(-1)).toEqual({ x: 0, y: 0 });

    // Held walk (> 260 ms) does NOT fire onTapNearPlayer.
    emit("pointerdown", makePointerEvent({ pointerId: 2, clientX: 670, clientY: 360 }));
    clock += 400;
    emit("pointerup", makePointerEvent({ pointerId: 2, clientX: 670, clientY: 360 }));
    expect(taps).toBe(1);

    // Dragged gesture (> 12 px) near player does NOT fire onTapNearPlayer.
    emit("pointerdown", makePointerEvent({ pointerId: 3, clientX: 640, clientY: 360 }));
    clock += 60;
    emit("pointermove", makePointerEvent({ pointerId: 3, clientX: 665, clientY: 360 }));
    emit("pointerup", makePointerEvent({ pointerId: 3, clientX: 665, clientY: 360 }));
    expect(taps).toBe(1);

    // Far click (> 96 px from Fae) does NOT fire onTapNearPlayer.
    emit("pointerdown", makePointerEvent({ pointerId: 4, clientX: 900, clientY: 360 }));
    clock += 40;
    emit("pointerup", makePointerEvent({ pointerId: 4, clientX: 900, clientY: 360 }));
    expect(taps).toBe(1);

    // Cancelled pointer does NOT fire onTapNearPlayer.
    emit("pointerdown", makePointerEvent({ pointerId: 5, clientX: 645, clientY: 365 }));
    clock += 30;
    emit("pointercancel", makePointerEvent({ pointerId: 5, clientX: 645, clientY: 365 }));
    expect(taps).toBe(1);

    // Closing steering gate before pointerup does NOT fire onTapNearPlayer.
    emit("pointerdown", makePointerEvent({ pointerId: 6, clientX: 645, clientY: 365 }));
    clock += 30;
    allowSteer = false;
    emit("pointerup", makePointerEvent({ pointerId: 6, clientX: 645, clientY: 365 }));
    expect(taps).toBe(1);
  });

  it("keeps src/render/view.ts under 1,000 lines and preserves areaEntityAtlases export", () => {
    const viewLines = readFileSync("src/render/view.ts", "utf8").split("\n").length;
    expect(viewLines).toBeLessThan(1000);
    expect(viewAreaEntityAtlases).toBe(renderAreaEntityAtlases);

    const { world } = loadContent();
    const plaza = world.areas.plaza;
    if (plaza === undefined) throw new Error("Missing plaza area");
    expect(viewAreaEntityAtlases(world, plaza)).toEqual(renderAreaEntityAtlases(world, plaza));
  });
});
