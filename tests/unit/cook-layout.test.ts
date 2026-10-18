import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { cookView, newCook, type CookGame } from "../../src/core";
import { loadContent, parseCookCalibration } from "../../src/content/load";
import { cookFront, foodCell, layoutCook } from "../../src/ui/cook-layout";

// The microwave's close-up laid out from its calibration (spec 8.2): the dish
// stands on the turntable inside the door, the timer and the hint where the
// painting has their places, and the steam drifts by the ticks cooked alone.

const world = loadContent().world;
const file = "public/assets/arcade/microwave.json";
const calibration = parseCookCalibration(JSON.parse(readFileSync(file, "utf8")), file);
const atlas: unknown = JSON.parse(readFileSync("public/assets/arcade/cook-food.json", "utf8"));
const view = (changes: Partial<CookGame> = {}): ReturnType<typeof cookView> =>
  cookView(world, { ...newCook("nuggets"), ...changes });

describe("the microwave's layout", () => {
  it("matches the food atlas's cells", () => {
    const frames = typeof atlas === "object" && atlas !== null && "frames" in atlas &&
      typeof atlas.frames === "object" && atlas.frames !== null ? atlas.frames : {};
    for (const dish of ["nuggets", "mac"]) {
      const entry: unknown = Object.entries(frames).find(([name]) => name === dish)?.[1];
      expect(entry, dish).toMatchObject({
        frame: { w: foodCell.w, h: foodCell.h },
        anchor: { x: foodCell.footX / foodCell.w, y: foodCell.footY / foodCell.h },
      });
    }
  });

  it("puts each part in its place in the painting, at any scale", () => {
    for (const scale of [0.31, 0.5, 0.62]) {
      const layout = layoutCook(view(), calibration, scale);
      const near = (actual: number, expected: number): void =>
        expect(Math.abs(actual - expected)).toBeLessThanOrEqual(1);
      near(layout.width, calibration.size.w * scale);
      near(layout.glass.x, calibration.glass.x * scale);
      near(layout.display.width, calibration.display.w * scale);
      near(layout.front.y, calibration.front.y * scale);
      // The dish's foot on the turntable, behind its front rim (food is laid
      // out behind the glass).
      const footX = layout.glass.x + layout.food.x + foodCell.footX * scale;
      const footY = layout.glass.y + layout.food.y + foodCell.footY * scale;
      near(footX, calibration.plate.cx * scale);
      expect(footY).toBeGreaterThan(calibration.plate.cy * scale);
      expect(footY).toBeLessThan((calibration.plate.cy + calibration.plate.ry) * scale);
      // Inside the glass's box: the cell's sides may run past it (they're
      // clipped), but the dish's foot never.
      expect(footY).toBeLessThan(layout.glass.y + layout.glass.height);
    }
  });

  it("puffs steam once it's warm, smoke once it's burnt, by the ticks cooked", () => {
    expect(layoutCook(view({ cooked: 10 }), calibration, 0.5).wisps).toEqual([]);
    const warm = layoutCook(view({ cooked: 70 }), calibration, 0.5).wisps;
    expect(warm).toHaveLength(4);
    expect(layoutCook(view({ cooked: 70 }), calibration, 0.5).wisps).toEqual(warm);
    expect(layoutCook(view({ cooked: 71 }), calibration, 0.5).wisps).not.toEqual(warm);
    for (const puff of warm) expect(puff.opacity).toBeLessThanOrEqual(0.55);
    const smoke = layoutCook(view({ cooked: 200, phase: "ding" }), calibration, 0.5).wisps;
    expect(Math.max(...smoke.map((puff) => puff.opacity))).toBeGreaterThan(0.55);
  });

  it("letters the hint on the fridge until it's going, then the box", () => {
    expect(cookFront(view())).toBe("The box says 1:00. Hold to cook, and let go when it's golden!");
    expect(cookFront(view({ phase: "cooking", cooked: 20 }))).toBe("Dino nuggets · Heat 1:00");
    expect(cookFront(view({ phase: "paused", cooked: 20 })))
      .toBe("Still frozen in the middle! Hold to cook it some more.");
  });
});
