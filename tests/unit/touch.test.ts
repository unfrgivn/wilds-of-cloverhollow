import { describe, expect, it } from "vitest";
import { TouchInput } from "../../src/platform/touch";

describe("touch choice latch", () => {
  it("returns a choice for exactly one sample", () => {
    const input = new TouchInput();
    input.tapChoice(1);
    expect(input.sample().choose).toBe(1);
    expect(input.sample().choose).toBeUndefined();
  });
});
