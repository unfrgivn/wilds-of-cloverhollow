import { describe, expect, it } from "vitest";
import { selectFaeAnimation } from "../../src/render/animation";

describe("distance-based Fae animation", () => {
  it("is idle, mirrors right, and advances by walked distance", () => {
    expect(selectFaeAnimation("right", { distance: 40, moving: false }, 6, 120))
      .toEqual({ animation: "idle_left", frame: 0, mirror: true });
    expect(selectFaeAnimation("down", { distance: 20, moving: true }, 6, 120))
      .toEqual({ animation: "walk_down", frame: 1, mirror: false });
    expect(selectFaeAnimation("down", { distance: 120, moving: true }, 6, 120))
      .toEqual({ animation: "walk_down", frame: 0, mirror: false });
  });
});
