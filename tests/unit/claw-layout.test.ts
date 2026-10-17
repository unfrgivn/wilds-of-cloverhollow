import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  clawView,
  createState,
  newClaw,
  type ClawGame,
  type ClawView,
  type State,
} from "../../src/core";
import { loadContent, parseClawCalibration } from "../../src/content/load";
import { clawGalleryStates, clawGalleryView } from "../../src/dev/claw-gallery";
import {
  clawLook,
  floorPoint,
  layoutClaw,
  type ClawLayout,
  type PlushLayout,
  type Rect,
} from "../../src/ui/claw-layout";

// The claw machine close-up's layout (spec 8.2): the painted floor seen in
// one-point perspective, the heap on it, the claw over it, and what draws in
// front of what. The e2e test (tests/e2e/ui-gallery.spec.ts) checks the DOM
// is this layout; this checks the layout itself.
const { world, fixtures } = loadContent();
const claw = world.arcade.claw;
const file = "public/assets/arcade/claw-machine.json";
const calibration = parseClawCalibration(JSON.parse(readFileSync(file, "utf8")), file);
const fixture = fixtures.arcade;
if (fixture === undefined) throw new Error("missing the arcade fixture");
// A phone's and a desktop's cabinet, and one between.
const scales = [0.24, 0.37, 0.5];

// One open game to vary: states are plain data, and building one (its Ink
// story included) for every view would cost seconds.
const game: ClawGame = newClaw(claw);
const open: State = { ...createState(world, fixture), arcade: game };
const viewOf = (changes: Partial<ClawGame>, state = open): ClawView => {
  const changed = { ...game, ...changes };
  return clawView(world, { ...state, arcade: changed }, changed);
};
const plushIn = (layout: ClawLayout, id: string): PlushLayout => {
  const found = layout.plushes.find((item) => item.id === id);
  if (found === undefined) throw new Error(`${id} isn't laid out`);
  return found;
};
// What of a plush's box is painted: the atlas frames keep their plushes
// inside these shares of the frame (prizes.png, base on row 300 of 320).
const painted = (item: PlushLayout): Rect => ({
  x: item.x + 0.08 * item.size, y: item.y + 0.12 * item.size,
  width: 0.84 * item.size, height: (clawLook.base - 0.12) * item.size - item.hidden,
});
const clawBox = (layout: ClawLayout): Rect => ({
  x: layout.claw.x - layout.claw.size / 2, y: layout.claw.tip - layout.claw.size,
  width: layout.claw.size, height: layout.claw.size,
});
// The cable, from the carriage down to the claw's head.
const cableBox = (layout: ClawLayout): Rect => ({
  x: layout.cable.x1 - 1, y: layout.cable.y1, width: 2, height: layout.cable.y2 - layout.cable.y1,
});
const overlaps = (a: Rect, b: Rect): boolean => a.width > 0 && a.height > 0 && b.width > 0 &&
  b.height > 0 && a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height &&
  a.y + a.height > b.y;
const inside = (box: Rect, outer: Rect): boolean => box.x >= outer.x - 1 &&
  box.y >= outer.y - 1 && box.x + box.width <= outer.x + outer.width + 1 &&
  box.y + box.height <= outer.y + outer.height + 1;

describe("the painting's calibration", () => {
  const raw = (): Record<string, unknown> => {
    const value: unknown = JSON.parse(readFileSync(file, "utf8"));
    if (typeof value !== "object" || value === null || Array.isArray(value))
      throw new Error("the calibration isn't an object");
    return { ...value };
  };
  const broken: [string, (value: Record<string, unknown>) => void, string][] = [
    ["a window outside the image", (value) => {
      value.glass = { x: 113, y: 313, w: 9999, h: 842, radius: 30 };
    }, "glass"],
    ["a window with no corner radius", (value) => {
      value.glass = { x: 113, y: 313, w: 1374, h: 842 };
    }, "glass"],
    ["a floor wider at the back than the front", (value) => {
      value.floor = { front: { y: 1150, left: 329, right: 1270 },
        back: { y: 949, left: 111, right: 1488 } };
    }, "floor"],
    ["a floor whose back is below its front", (value) => {
      value.floor = { front: { y: 949, left: 111, right: 1488 },
        back: { y: 1150, left: 329, right: 1270 } };
    }, "floor"],
    ["a ceiling meeting the back wall above the glass", (value) => {
      value.ceiling = { front: { y: 376 }, back: { y: 311 } };
    }, "ceiling"],
    ["a chute mouth of three points", (value) => {
      value.chute = { mouth: [[310, 1032], [548, 1032], [511, 1111]] };
    }, "chute.mouth"],
  ];
  it("reads the real calibration", () => {
    expect(() => parseClawCalibration(raw(), file)).not.toThrow();
  });
  for (const [label, change, field] of broken)
    it(`refuses ${label}`, () => {
      const value = raw();
      change(value);
      expect(() => parseClawCalibration(value, file)).toThrow(`invalid ${field}`);
    });
});

describe("the claw machine's floor in perspective", () => {
  it("puts the box's corners on the painted floor's corners", () => {
    const { front, back } = calibration.floor;
    for (const scale of scales) {
      const at = (x: number, z: number) => floorPoint(claw.box, calibration, scale, x, z);
      const near = (actual: number, expected: number): void =>
        expect(actual).toBeCloseTo(expected * scale, 6);
      near(at(0, 0).x, front.left);
      near(at(claw.box.width, 0).x, front.right);
      near(at(0, 0).y, front.y);
      near(at(0, claw.box.depth).x, back.left);
      near(at(claw.box.width, claw.box.depth).x, back.right);
      near(at(0, claw.box.depth).y, back.y);
    }
  });

  it("shortens equal steps of depth toward the back, and shrinks the plushes there", () => {
    const at = (z: number) => floorPoint(claw.box, calibration, 0.4, claw.box.width / 2, z);
    const step = claw.box.depth / 4;
    const rises = [0, 1, 2, 3].map((index) => at(index * step).y - at((index + 1) * step).y);
    for (let index = 1; index < rises.length; index += 1)
      expect(rises[index]).toBeLessThan(rises[index - 1] ?? 0);
    expect(at(claw.box.depth).box).toBeLessThan(at(0).box);
    // One-point perspective: a plush's box shrinks exactly as the floor narrows.
    const near = at(0);
    const far = at(claw.box.depth);
    expect(far.box / near.box).toBeCloseTo((far.right - far.left) / (near.right - near.left), 9);
  });

  it("brings the claw home over the chute's mouth", () => {
    const home = floorPoint(claw.box, calibration, 1, claw.railLeft, claw.depthFront);
    const mouth = calibration.chute.mouth;
    let crossings = 0;
    mouth.forEach(([x1, y1], index) => {
      const [x2, y2] = mouth[(index + 1) % mouth.length] ?? [x1, y1];
      if ((y1 > home.y) !== (y2 > home.y) &&
        home.x < x1 + ((home.y - y1) * (x2 - x1)) / (y2 - y1)) crossings += 1;
    });
    expect(crossings % 2, "the home point is inside the mouth").toBe(1);
  });
});

describe("the heap as laid out", () => {
  it("stands every plush on the floor, or a lift per level above it", () => {
    for (const scale of scales) {
      const view = viewOf({});
      const layout = layoutClaw(view, calibration, scale);
      for (const plush of view.plushes) {
        const point = floorPoint(view.box, calibration, scale, plush.x, plush.z);
        const item = plushIn(layout, plush.id);
        const base = item.y + clawLook.base * item.size;
        expect(Math.abs(item.x + item.size / 2 - point.x), plush.id).toBeLessThanOrEqual(1);
        expect(Math.abs(item.size - point.box), plush.id).toBeLessThanOrEqual(1);
        expect(Math.abs(base - (point.y - plush.level * clawLook.lift * point.box)), plush.id)
          .toBeLessThanOrEqual(1.5);
      }
    }
  });

  it("draws a nearer plush over a farther one wherever they overlap", () => {
    const view = viewOf({});
    const layout = layoutClaw(view, calibration, 0.4);
    let overlapping = 0;
    for (const near of view.plushes)
      for (const far of view.plushes) {
        if (near.z >= far.z) continue;
        if (!overlaps(painted(plushIn(layout, near.id)), painted(plushIn(layout, far.id))))
          continue;
        overlapping += 1;
        expect(plushIn(layout, near.id).layer, `${near.id} in front of ${far.id}`)
          .toBeGreaterThan(plushIn(layout, far.id).layer);
      }
    // It's a heap: plushes overlap one another.
    expect(overlapping).toBeGreaterThan(5);
  });
});

describe("the claw as laid out", () => {
  // The claw dropping, halfway and all the way, onto every plush in the heap,
  // and over bare floor at the back.
  const drops = (): { label: string; view: ClawView }[] => [
    ...claw.heap.flatMap((plush) => [0.5, 1].map((drop) => ({
      label: `${plush.prize} at drop ${drop}`,
      view: viewOf({ phase: drop === 1 ? "grabbing" : "dropping", x: plush.x, z: plush.z,
        phaseTicks: drop === 1 ? 0 : claw.dropTicks / 2 }),
    }))),
    { label: "bare floor", view: viewOf({ phase: "grabbing", x: claw.railRight,
      z: claw.depthBack }) },
  ];
  // The claw up, halfway down, and all the way down, everywhere it can go on
  // a grid across the box: between plushes as well as on them.
  const everywhere = (): { label: string; view: ClawView }[] => {
    const spots: { label: string; view: ClawView }[] = [];
    for (let x = claw.railLeft; x <= claw.railRight; x += 10 * claw.speed)
      for (let z = claw.depthFront; z <= claw.depthBack; z += 5 * claw.speed)
        for (const drop of [0, 0.5, 1])
          spots.push({ label: `(${x}, ${z}) at drop ${drop}`, view: viewOf({
            phase: drop === 0 ? "pushing" : drop === 1 ? "grabbing" : "dropping",
            x, z, phaseTicks: drop === 0.5 ? claw.dropTicks / 2 : 0 }) });
    return spots;
  };

  it("comes down on the floor, or into the top of the plush it lands on", () => {
    for (const { label, view } of drops()) {
      if (view.claw.drop !== 1) continue;
      const layout = layoutClaw(view, calibration, 0.4);
      const here = floorPoint(view.box, calibration, 0.4, view.claw.x, view.claw.z);
      const bottom = view.claw.stop === 0 ? here.y
        : here.y - (view.claw.stop - 1) * clawLook.lift * here.box -
          clawLook.base * here.box + clawLook.grab * here.box;
      expect(Math.abs(layout.claw.tip - bottom), label).toBeLessThanOrEqual(1);
    }
  });

  it("draws the claw and its cable over what's behind them and under what's in front", () => {
    for (const scale of scales)
      for (const { label, view } of [...drops(), ...everywhere()]) {
        const layout = layoutClaw(view, calibration, scale);
        for (const plush of view.plushes) {
          const item = plushIn(layout, plush.id);
          const box = painted(item);
          if (!overlaps(box, clawBox(layout)) && !overlaps(box, cableBox(layout))) continue;
          if (plush.z >= view.claw.z)
            expect(item.layer, `${label}: the claw over ${plush.id}`)
              .toBeLessThan(layout.claw.layer);
          else
            expect(item.layer, `${label}: ${plush.id} over the claw`)
              .toBeGreaterThan(layout.claw.layer);
        }
      }
  });

  it("carries a won plush between its prongs, then drops it into the chute", () => {
    const pup = claw.heap.find((plush) => plush.prize === "pup-plush");
    if (pup === undefined) throw new Error("missing the pup");
    const won = { target: pup.prize, outcome: "grabbed" as const };
    const lifting = layoutClaw(viewOf({ phase: "lifting", x: pup.x, z: pup.z,
      phaseTicks: claw.liftTicks / 2, ...won }), calibration, 0.4);
    const held = plushIn(lifting, pup.prize);
    expect(Math.abs(held.x + held.size / 2 - lifting.claw.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(held.y - (lifting.claw.tip - clawLook.grab * held.size)))
      .toBeLessThanOrEqual(1.5);
    expect(held.layer).toBeLessThan(lifting.claw.layer);
    const releasing = (share: number): PlushLayout => plushIn(layoutClaw(viewOf({
      phase: "releasing", phaseTicks: share * claw.releaseTicks, ...won }), calibration, 0.4),
    pup.prize);
    // It sinks below the chute mouth's front edge: by the end of the fall the
    // whole plush, its base row and up, is down the chute.
    const mouthFront = Math.max(...calibration.chute.mouth.map(([, y]) => y)) * 0.4;
    expect(releasing(0).hidden).toBe(0);
    expect(releasing(0.5).hidden).toBeGreaterThan(0);
    const end = releasing(1);
    expect(Math.abs(end.y + end.size * clawLook.base - end.hidden - mouthFront))
      .toBeLessThanOrEqual(1);
    expect(end.hidden).toBeGreaterThanOrEqual(Math.round(clawLook.base * end.size) - 1);
  });

  it("shows where the claw would land only while Fae aims it", () => {
    for (const phase of ["ready", "sliding", "aiming", "pushing", "dropping", "grabbing",
      "lifting", "returning", "releasing"] as const) {
      const layout = layoutClaw(viewOf({ phase }), calibration, 0.4);
      const aiming = phase === "sliding" || phase === "aiming" || phase === "pushing";
      expect(layout.marker !== null, phase).toBe(aiming);
      if (layout.marker !== null)
        expect(layout.marker.layer, phase).toBeLessThan(layout.claw.layer);
    }
  });

  it("keeps every gallery state's plushes, claw, and marker inside the glass", () => {
    for (const scale of scales)
      for (const state of clawGalleryStates) {
        const view = clawGalleryView(world, fixture, state);
        if (view === null) throw new Error(`no gallery view ${state}`);
        const layout = layoutClaw(view, calibration, scale);
        for (const item of layout.plushes)
          expect(inside(painted(item), layout.glass), `${state} ${item.id}`).toBe(true);
        expect(inside(clawBox(layout), layout.glass), `${state} claw`).toBe(true);
        if (layout.marker !== null)
          expect(inside(layout.marker, layout.glass), `${state} marker`).toBe(true);
      }
  });
});
