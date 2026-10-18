import { describe, expect, it } from "vitest";
import { parseCometCalibration } from "../../src/content/load";

const valid = {
  image: "cabinet.webp",
  size: { w: 1600, h: 1988 },
  marquee: { x: 214, y: 76, w: 1173, h: 321 },
  screen: { x: 341, y: 688, w: 919, h: 649 },
  field: { x: 382, y: 715, w: 841, h: 594 },
  deck: { x: 429, y: 1379, w: 836, h: 231 },
};
const rejects = (change: (value: typeof valid) => void): void => {
  const value = structuredClone(valid);
  change(value);
  expect(() => parseCometCalibration(value, "test.json")).toThrow();
};

describe("parseCometCalibration", () => {
  it("accepts the calibrated cabinet", () =>
    expect(parseCometCalibration(valid, "test.json").image).toBe(valid.image));
  it("rejects a missing image", () =>
    rejects((value) => {
      Reflect.deleteProperty(value, "image");
    }));
  it("rejects a non-positive size", () =>
    rejects((value) => {
      value.size.w = 0;
    }));
  it("rejects a box outside the image", () =>
    rejects((value) => {
      value.screen.x = 900;
    }));
  it("rejects a field outside the screen", () =>
    rejects((value) => {
      value.field.x = 300;
    }));
  it("rejects a marquee below the screen", () =>
    rejects((value) => {
      value.marquee.y = 700;
    }));
  it("rejects a deck above the screen", () =>
    rejects((value) => {
      value.deck.y = 600;
    }));
});
