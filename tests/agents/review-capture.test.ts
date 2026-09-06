import { describe, expect, test } from "bun:test";
import { parseArgs, validatePngHeader, validateReviewPaths } from "../../tools/agents/review-capture.ts";

const validPngHeader = Uint8Array.from([
  137, 80, 78, 71, 13, 10, 26, 10,
  0, 0, 0, 13, 73, 72, 68, 82,
  0, 0, 2, 0, 0, 0, 1, 0, 8, 6, 0, 0, 0,
  0, 0, 0, 0,
]);

describe("review-capture argument and PNG guards", () => {
  test("parses explicit output and model, with environment default", () => {
    expect(parseArgs(["input.png", "read dialogue", "--output", "review.txt"], { GODOT_VISION_MODEL: "provider/model" })).toEqual({
      input: "input.png", goal: "read dialogue", model: "provider/model", output: "review.txt",
    });
  });

  test("requires explicit non-implicit output", () => {
    expect(() => parseArgs(["input.png"])).toThrow("--output is required");
  });

  test("accepts PNG IHDR and rejects non-PNG input", () => {
    expect(() => validatePngHeader(validPngHeader)).not.toThrow();
    expect(() => validatePngHeader(new Uint8Array([1, 2, 3]))).toThrow("regular PNG");
  });

  test("rejects input/output aliasing and existing output", () => {
    expect(() => validateReviewPaths("captures/input.png", "captures/input.png", false)).toThrow("separate");
    expect(() => validateReviewPaths("captures/input.png", "captures/review.txt", true)).toThrow("output exists");
    expect(() => validateReviewPaths("captures/input.png", "captures/review.txt", false)).not.toThrow();
  });
});
