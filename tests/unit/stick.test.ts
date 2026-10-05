import { describe, expect, it } from "vitest";
import { stickVector } from "../../src/platform/stick";

describe("stickVector", () => {
  it("has a dead zone", () => {
    expect(stickVector({ x: 0, y: 0 }, { x: 5, y: 0 }, 56)).toEqual({ x: 0, y: 0 });
  });

  it("clamps to unit length", () => {
    expect(stickVector({ x: 0, y: 0 }, { x: 100, y: 0 }, 56)).toEqual({ x: 1, y: 0 });
  });

  it("preserves direction", () => {
    const value = stickVector({ x: 10, y: 10 }, { x: 38, y: 38 }, 56);
    expect(value.x).toBeCloseTo(value.y);
    expect(value.x).toBeGreaterThan(0);
  });
});
