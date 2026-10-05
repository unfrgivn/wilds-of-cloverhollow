import { describe, expect, it } from "vitest";
import { drainTicks } from "../../src/core";

describe("fixed-tick draining", () => {
  const stepMs = 1000 / 60;

  it("handles 60, 30, 120 Hz and a capped hitch", () => {
    expect(drainTicks(stepMs, stepMs, 5)).toEqual({ ticks: 1, remainingMs: 0 });
    expect(drainTicks(1000 / 30, stepMs, 5)).toEqual({ ticks: 2, remainingMs: 0 });
    const fast = drainTicks(1000 / 120, stepMs, 5);
    expect(fast.ticks).toBe(0);
    expect(fast.remainingMs).toBeCloseTo(1000 / 120);
    expect(drainTicks(250, stepMs, 5)).toEqual({ ticks: 5, remainingMs: 0 });
  });

  it("keeps the sub-tick remainder when exactly at the cap", () => {
    const result = drainTicks(5 * stepMs + 2, stepMs, 5);
    expect(result.ticks).toBe(5);
    expect(result.remainingMs).toBeCloseTo(2);
  });
});
