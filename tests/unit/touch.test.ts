import { describe, expect, it } from "vitest";
import { TouchInput, tracePointer } from "../../src/platform/touch";

describe("touch choice latch", () => {
  it("returns a choice for exactly one sample", () => {
    const input = new TouchInput();
    input.tapChoice(1);
    expect(input.sample().choose).toBe(1);
    expect(input.sample().choose).toBeUndefined();
  });
});

describe("trace pointer mapping", () => {
  const rect = { x: 40, y: 20, width: 200, height: 100 };
  it("maps offset corners and rounds", () => {
    expect(tracePointer({ x: 40, y: 20 }, rect)).toEqual({ x: 0, y: 0 });
    expect(tracePointer({ x: 240, y: 120 }, rect)).toEqual({ x: 1000, y: 1000 });
    expect(tracePointer({ x: 140.1, y: 69.9 }, rect)).toEqual({ x: 500, y: 499 });
  });
  it("clamps outside the square", () => {
    expect(tracePointer({ x: -10, y: 300 }, rect)).toEqual({ x: 0, y: 1000 });
  });
});
