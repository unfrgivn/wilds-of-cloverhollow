import { describe, expect, test } from "vitest";
import { clampPromptPosition } from "../../src/ui/sticker";

describe("sticker prompt geometry", () => {
  test("clamps the bubble inside the viewport", () => {
    const insets = { top: 8, right: 12, bottom: 10, left: 20 };
    expect(clampPromptPosition(0, 0, 100, 40, 874, 402, insets)).toEqual({ x: 70, y: 48 });
    expect(clampPromptPosition(900, 900, 100, 40, 874, 402, insets)).toEqual({ x: 812, y: 384 });
  });
});
