import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  createState, moleHoles, moleView, newMole, type MoleGame, type MoleView,
} from "../../src/core";
import { loadContent, parseMoleCalibration } from "../../src/content/load";
import { moleGalleryStates, moleGalleryView } from "../../src/dev/mole-gallery";
import { layoutMole, moleFrame, moleLook, type HoleLayout } from "../../src/ui/mole-layout";

// The Boop-a-Mole close-up's layout (spec 8.2): the shown part of the
// painting, each mole standing in its hole with the near rim hiding its waist,
// the hammer on the mole's head, and the keys beside the holes. The gallery
// e2e checks the DOM is this layout; this checks the layout itself.
const { world, fixtures } = loadContent();
const mole = world.arcade.mole;
const file = "public/assets/arcade/mole-cabinet.json";
const raw = (): Record<string, unknown> => {
  const value: unknown = JSON.parse(readFileSync(file, "utf8"));
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new Error("the calibration isn't an object");
  return { ...value };
};
const calibration = parseMoleCalibration(raw(), file);
const fixture = fixtures.arcade;
if (fixture === undefined) throw new Error("missing the arcade fixture");
// A phone's and a desktop's close-up, and one between.
const scales = [0.22, 0.35, 0.5];
const [round] = newMole(mole, createState(world, fixture));
const viewOf = (changes: Partial<MoleGame>): MoleView =>
  moleView(world, { ...round, phase: "playing", ...changes });
const holeIn = (holes: HoleLayout[], hole: string): HoleLayout => {
  const found = holes.find((item) => item.hole === hole);
  if (found === undefined) throw new Error(`no hole ${hole}`);
  return found;
};
const near = (actual: number, expected: number, label: string): void => {
  expect(Math.abs(actual - expected), `${label}: ${actual} vs ${expected}`)
    .toBeLessThanOrEqual(1);
};

describe("the Boop-a-Mole painting's calibration", () => {
  const holes = (value: Record<string, unknown>): Record<string, unknown> => {
    const item = value.holes;
    if (typeof item !== "object" || item === null) throw new Error("no holes");
    return { ...item };
  };
  it("reads the real calibration", () => {
    expect(() => parseMoleCalibration(raw(), file)).not.toThrow();
  });
  const broken: [string, (value: Record<string, unknown>) => void, string][] = [
    ["the far hole below the middle", (value) => {
      value.holes = { ...holes(value), up: { cx: 800, cy: 900, rx: 67, ry: 24 } };
    }, "holes"],
    ["two holes touching", (value) => {
      value.holes = { ...holes(value), left: { cx: 650, cy: 724, rx: 104, ry: 37 } };
    }, "holes"],
    ["a hole on the plate", (value) => {
      value.holes = { ...holes(value), up: { cx: 800, cy: 250, rx: 67, ry: 24 } };
    }, "holes"],
    ["a plate off the image", (value) => {
      value.plate = { x: 394, y: -20, w: 812, h: 255 };
    }, "plate"],
  ];
  for (const [label, change, field] of broken)
    it(`refuses ${label}`, () => {
      const value = raw();
      change(value);
      expect(() => parseMoleCalibration(value, file)).toThrow(`invalid ${field}`);
    });
});

describe("the holes and the moles", () => {
  it("stands each mole's frame in its hole, its cut waist on the near rim", () => {
    for (const scale of scales) {
      const layout = layoutMole(viewOf({ stage: "up" }), calibration, scale);
      for (const hole of moleHoles) {
        const at = holeIn(layout.holes, hole);
        const painted = calibration.holes[hole];
        near(at.box.width, moleLook.size * painted.rx * scale, `${hole} size`);
        near(at.box.x + at.box.width / 2, at.cx, `${hole} centred`);
        near(at.box.y + at.box.height, at.cy + painted.ry * scale, `${hole} waist on the rim`);
        // The clip: everything above the centre line, then the opening's
        // lower half, so the near rim hides the waist.
        const line = Math.round(at.cy - at.box.y);
        expect(at.clip).toContain(`V${line} `);
        expect(at.clip).toContain(` 0 0 1 `);
      }
    }
  });

  it("raises the mole as it rises and drops it as it ducks, hidden at the bottom", () => {
    const hole = round.order[0];
    if (hole === undefined) throw new Error("an empty round");
    const at = (stage: MoleGame["stage"], stageTicks: number): HoleLayout =>
      holeIn(layoutMole(viewOf({ stage, stageTicks }), calibration, 0.35).holes, hole);
    const risen = at("up", 0);
    expect(risen.mole?.drop).toBe(0);
    expect(at("rising", 0).mole?.drop).toBe(risen.box.height);
    const halfway = at("rising", mole.riseTicks / 2).mole?.drop ?? -1;
    near(halfway, risen.box.height / 2, "half risen");
    expect(at("ducking", mole.duckTicks / 2).mole?.drop).toBe(halfway);
    // At the bottom, the frame's top is at the opening's lowest point: nothing
    // of it shows above the near rim.
    expect(risen.box.y + risen.box.height).toBeGreaterThanOrEqual(risen.cy);
    expect(at("waiting", 0).mole).toBeNull();
    // Only the mole's own hole has one.
    const layout = layoutMole(viewOf({ stage: "up" }), calibration, 0.35);
    expect(layout.holes.filter((item) => item.mole !== null).map((item) => item.hole))
      .toEqual([hole]);
  });

  it("swings the hammer onto the mole's head, then lifts and fades it", () => {
    const hole = round.order[0];
    if (hole === undefined) throw new Error("an empty round");
    const swing = (ticks: number): NonNullable<ReturnType<typeof layoutMole>["hammer"]> => {
      const layout = layoutMole(viewOf({ stage: "booped", hammer: { hole, ticks, hit: true } }),
        calibration, 0.35);
      if (layout.hammer === null) throw new Error("no hammer");
      return layout.hammer;
    };
    const at = holeIn(layoutMole(viewOf({}), calibration, 0.35).holes, hole);
    const struck = swing(0);
    near(struck.x, at.cx, "on the hole");
    near(struck.y, at.box.y + moleLook.strike * at.box.height, "on the head");
    expect(struck.opacity).toBe(1);
    const later = swing(mole.hammerTicks - 1);
    expect(later.y).toBeLessThan(struck.y);
    expect(later.opacity).toBeLessThan(struck.opacity);
    expect(layoutMole(viewOf({ hammer: null }), calibration, 0.35).hammer).toBeNull();
  });

  it("pops Boop! over a wincing mole only", () => {
    const hole = round.order[0];
    if (hole === undefined) throw new Error("an empty round");
    const booped = layoutMole(viewOf({ stage: "booped", stageTicks: 0 }), calibration, 0.35);
    const at = holeIn(booped.holes, hole);
    expect(booped.pop).toEqual({ x: at.cx, y: at.box.y });
    expect(layoutMole(viewOf({ stage: "giggling" }), calibration, 0.35).pop).toBeNull();
    expect(layoutMole(viewOf({ stage: "up" }), calibration, 0.35).pop).toBeNull();
  });

  it("letters each hole's key just left of it", () => {
    const labels: Record<string, string> = { up: "↑", left: "←", middle: "Z", right: "→",
      down: "↓" };
    for (const at of layoutMole(viewOf({}), calibration, 0.35).holes) {
      expect(at.key.label).toBe(labels[at.hole]);
      expect(at.key.x).toBeLessThan(at.cx - at.box.width * 0.4);
      near(at.key.y, at.cy, `${at.hole} key`);
    }
  });
});

describe("the close-up's frame", () => {
  it("shows the plate and every hole with its mole at full rise", () => {
    const frame = moleFrame(calibration);
    expect(frame.y).toBeLessThanOrEqual(calibration.plate.y);
    for (const scale of scales) {
      const layout = layoutMole(viewOf({ stage: "up" }), calibration, scale);
      expect(layout.plate.y).toBeGreaterThanOrEqual(0);
      for (const at of layout.holes) {
        expect(at.box.y, `${at.hole} top`).toBeGreaterThanOrEqual(0);
        expect(at.box.x, `${at.hole} left`).toBeGreaterThanOrEqual(0);
        expect(at.box.x + at.box.width).toBeLessThanOrEqual(layout.width);
        expect(at.box.y + at.box.height, `${at.hole} bottom`).toBeLessThanOrEqual(layout.height);
        // A risen mole stays below the plate.
        expect(at.box.y).toBeGreaterThanOrEqual(layout.plate.y + layout.plate.height - 1);
      }
      // The fade starts below the near hole's rim.
      const down = holeIn(layout.holes, "down");
      expect(layout.fade * layout.height).toBeGreaterThan(down.box.y + down.box.height);
    }
  });
});

it("the gallery's Boop-a-Mole states are real rounds: their faces follow the core", () => {
  const faces: Record<string, string | null> = {};
  for (const state of moleGalleryStates) {
    const view = moleGalleryView(world, fixture, state);
    if (view === null) throw new Error(`no gallery view ${state}`);
    faces[state] = view.holes.find((item) => item.mole !== null)?.mole?.face ?? null;
  }
  expect(faces).toEqual({ "mole-ready": null, "mole-rising": "up", "mole-up": "up",
    "mole-booped": "booped", "mole-giggle": "giggle", "mole-whiff": "up", "mole-result": null });
});
