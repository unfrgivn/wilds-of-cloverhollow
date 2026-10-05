import { describe, expect, it } from "vitest";
import { followCamera } from "../../src/render/camera";

const view = { width: 960, height: 720 };
const area = { width: 2000, height: 1200 };
const deadZone = { x: 80, y: 60 };

describe("followCamera", () => {
  it("centres the player on the first frame", () => {
    expect(
      followCamera(undefined, { x: 1000, y: 600 }, view, area, deadZone),
    ).toEqual({ x: 520, y: 240 });
  });

  it("holds still while movement stays inside the dead zone", () => {
    const previous = { x: 520, y: 240 };
    expect(
      followCamera(previous, { x: 1010, y: 605 }, view, area, deadZone),
    ).toEqual(previous);
  });

  it("moves continuously by no more than the player movement", () => {
    const previous = { x: 520, y: 240 };
    const next = followCamera(
      previous,
      { x: 1001, y: 601 },
      view,
      area,
      deadZone,
    );
    expect(Math.abs(next.x - previous.x)).toBeLessThanOrEqual(1);
  });

  it("clamps against all four area edges", () => {
    expect(
      followCamera(undefined, { x: 0, y: 0 }, view, area, deadZone),
    ).toEqual({ x: 0, y: 0 });
    expect(
      followCamera(undefined, { x: 2000, y: 1200 }, view, area, deadZone),
    ).toEqual({ x: 1040, y: 480 });
  });

  it("centres an area smaller than the view", () => {
    expect(
      followCamera(
        undefined,
        { x: 100, y: 100 },
        view,
        { width: 400, height: 300 },
        deadZone,
      ),
    ).toEqual({ x: -280, y: -210 });
  });
});
