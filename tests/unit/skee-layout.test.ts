import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  createState,
  newSkee,
  skeePoints,
  skeeView,
  type SkeeGame,
  type SkeeView,
} from "../../src/core";
import { loadContent, parseSkeeCalibration } from "../../src/content/load";
import { skeeGalleryStates, skeeGalleryView } from "../../src/dev/skee-gallery";
import {
  boardPoint,
  boardUnit,
  lanePoint,
  layoutSkee,
  skeeFrame,
  skeeLook,
  type Rect,
} from "../../src/ui/skee-layout";

// The skee-ball close-up's layout (spec 8.2): the lane in one-point
// perspective, the target board seen straight on, and the ball's way from
// the arrow over the hump into its hole. The gallery e2e checks the DOM is
// this layout; this checks the layout itself.
const { world, fixtures } = loadContent();
const skee = world.arcade.skee;
const file = "public/assets/arcade/skee-lane.json";
const raw = (): Record<string, unknown> => {
  const value: unknown = JSON.parse(readFileSync(file, "utf8"));
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new Error("the calibration isn't an object");
  return { ...value };
};
const calibration = parseSkeeCalibration(raw(), file);
const fixture = fixtures.arcade;
if (fixture === undefined) throw new Error("missing the arcade fixture");
// A phone's and a desktop's close-up, and one between.
const scales = [0.2, 0.35, 0.5];

const start = newSkee(skee);
const viewOf = (changes: Partial<SkeeGame>): SkeeView => skeeView(world, { ...start, ...changes });
// A ball rolled at `aim`, held `held` ticks, scored as the core scores it.
const rolled = (aim: number, held: number): SkeeGame["throws"][number] => {
  const y = held * skee.powerStep;
  return { x: aim, y, points: skeePoints(skee, aim, y) };
};
const toCentre = Math.round(skee.centre.y / skee.powerStep);
const inside = (inner: Rect, outer: Rect): boolean => inner.x >= outer.x - 1 &&
  inner.y >= outer.y - 1 && inner.x + inner.width <= outer.x + outer.width + 1 &&
  inner.y + inner.height <= outer.y + outer.height + 1;
const near = (actual: number, expected: number, label: string): void => {
  expect(Math.abs(actual - expected), `${label}: ${actual} vs ${expected}`)
    .toBeLessThanOrEqual(1);
};

describe("the skee-ball painting's calibration", () => {
  const broken: [string, (value: Record<string, unknown>) => void, string][] = [
    ["a lane wider at the hump than its foot", (value) => {
      value.lane = { near: { y: 1740, left: 941, right: 1459 },
        far: { y: 912, left: 438, right: 1962 } };
    }, "lane"],
    ["a board below the hump", (value) => {
      value.board = { x: 902, y: 900, w: 593, h: 460 };
    }, "board"],
    ["a plate over the board", (value) => {
      value.plate = { x: 902, y: 419, w: 300, h: 100 };
    }, "plate"],
  ];
  it("reads the real calibration", () => {
    expect(() => parseSkeeCalibration(raw(), file)).not.toThrow();
  });
  for (const [label, change, field] of broken)
    it(`refuses ${label}`, () => {
      const value = raw();
      change(value);
      expect(() => parseSkeeCalibration(value, file)).toThrow(`invalid ${field}`);
    });
});

describe("the lane and the board", () => {
  it("puts the lane's corners on the painted lane's", () => {
    const { near: foot, far } = calibration.lane;
    for (const scale of scales) {
      const at = (across: number, up: number) => lanePoint(calibration, scale, across, up);
      expect(at(-1, 0).x).toBeCloseTo(foot.left * scale, 6);
      expect(at(1, 0).x).toBeCloseTo(foot.right * scale, 6);
      expect(at(0, 0).y).toBeCloseTo(foot.y * scale, 6);
      expect(at(-1, 1).x).toBeCloseTo(far.left * scale, 6);
      expect(at(1, 1).x).toBeCloseTo(far.right * scale, 6);
      expect(at(0, 1).y).toBeCloseTo(far.y * scale, 6);
    }
  });

  it("shortens equal steps up the lane toward the hump", () => {
    const rises = [0, 1, 2, 3].map((index) =>
      lanePoint(calibration, 1, 0, index / 4).y - lanePoint(calibration, 1, 0, (index + 1) / 4).y);
    for (let index = 1; index < rises.length; index += 1)
      expect(rises[index]).toBeLessThan(rises[index - 1] ?? 0);
  });

  it("draws the target round, centred on the painted board, its foot on the board's", () => {
    const layout = layoutSkee(viewOf({}), calibration, 0.4);
    for (const ring of [...layout.rings, ...layout.corners]) near(ring.rx, ring.ry, "round");
    const foot = boardPoint(viewOf({}), calibration, 0.4, 0, 0);
    near(foot.x, (calibration.board.x + calibration.board.w / 2) * 0.4, "foot x");
    near(foot.y, (calibration.board.y + calibration.board.h) * 0.4, "foot y");
    // The board units fit on the painted face.
    const unit = boardUnit(viewOf({}), calibration);
    expect(skee.board.width * unit).toBeLessThanOrEqual(calibration.board.w + 0.001);
    expect(skee.board.height * unit).toBeLessThanOrEqual(calibration.board.h + 0.001);
    // Every hole and ring is on the board.
    for (const ring of [...layout.rings, ...layout.corners])
      expect(inside({ x: ring.cx - ring.rx, y: ring.cy - ring.ry, width: 2 * ring.rx,
        height: 2 * ring.ry }, layout.board), `${ring.points}`).toBe(true);
  });
});

describe("the ball's way", () => {
  // Each ball in the gallery's game, at every stage of its way.
  const centre = rolled(skee.centre.x, toCentre);
  const corner = rolled(skee.corners.x, Math.round(skee.corners.y / skee.powerStep));
  const over = rolled(-skee.corners.x, skee.powerTicks);

  it("sets off from the arrow, then goes on without a jump at each stage", () => {
    for (const ball of [centre, corner, over])
      for (const scale of scales) {
        const at = (phase: SkeeGame["phase"], share: number) => {
          const ticks = phase === "rolling" ? skee.rollTicks
            : phase === "hopping" ? skee.hopTicks : skee.scoreTicks;
          const layout = layoutSkee(viewOf({ phase, aim: ball.x, throws: [ball],
            phaseTicks: share * ticks }), calibration, scale);
          if (layout.ball === null) throw new Error(`no ball ${phase}`);
          return layout.ball;
        };
        const aiming = layoutSkee(viewOf({ aim: ball.x }), calibration, scale).arrow;
        if (aiming === null) throw new Error("no arrow");
        const set = at("rolling", 0);
        near(set.x, aiming.x, "the ball sets off from the arrow");
        const pairs: [ReturnType<typeof at>, ReturnType<typeof at>, string][] = [
          [at("rolling", 1), at("hopping", 0), "over the hump"],
          [at("hopping", 1), at("scored", 0), "into the hole"],
        ];
        for (const [before, after, label] of pairs) {
          near(after.x, before.x, `${label} x`);
          near(after.y, before.y, `${label} y`);
          near(after.radius, before.radius, `${label} radius`);
        }
      }
  });

  it("lands where the core scores it, and lights that target and no other", () => {
    for (const ball of [centre, corner, over]) {
      const layout = layoutSkee(viewOf({ phase: "scored", aim: ball.x, throws: [ball] }),
        calibration, 0.4);
      const lit = [...layout.rings, ...layout.corners].filter((item) => item.lit)
        .map((item) => item.points);
      if (ball.y > skee.board.height) {
        expect(layout.floor.lit).toBe(true);
        expect(lit).toEqual([]);
      } else {
        expect(lit).toEqual([ball.points]);
        const at = boardPoint(viewOf({}), calibration, 0.4, ball.x, ball.y);
        if (layout.ball === null) throw new Error("no ball");
        near(layout.ball.x, at.x, "lands x");
        near(layout.ball.y, at.y, "lands y");
      }
      if (layout.pop === null) throw new Error("no points popped up");
      expect(layout.pop.points).toBe(ball.points);
    }
  });

  it("shows, while winding up, where the ball would land now", () => {
    for (const held of [1, toCentre, skee.powerTicks - 1]) {
      const layout = layoutSkee(viewOf({ phase: "powering", aim: 0, held }), calibration, 0.4);
      if (layout.ghost === null) throw new Error("no ghost");
      const y = held * skee.powerStep;
      expect(layout.ghost.over).toBe(y > skee.board.height);
      const at = boardPoint(viewOf({}), calibration, 0.4, 0, Math.min(y, skee.board.height));
      near(layout.ghost.x, at.x, "ghost x");
      near(layout.ghost.y, at.y, "ghost y");
    }
    expect(layoutSkee(viewOf({ phase: "winding" }), calibration, 0.4).ghost).toBeNull();
  });

  it("points the arrow up the lane at the aim, set once the aim is", () => {
    for (const aim of [-skee.board.width / 2, 0, skee.board.width / 2]) {
      const across = aim / (skee.board.width / 2);
      const foot = lanePoint(calibration, 0.4, across, skeeLook.arrowAt);
      const aiming = layoutSkee(viewOf({ aim }), calibration, 0.4).arrow;
      if (aiming === null) throw new Error("no arrow");
      near(aiming.x, foot.x, "arrow x");
      near(aiming.y, foot.y, "arrow y");
      expect(aiming.set).toBe(false);
      // Toward the hump: a left aim leans right, a right aim leans left.
      expect(Math.sign(aiming.angle) + Math.sign(aim)).toBe(0);
      expect(layoutSkee(viewOf({ phase: "winding", aim }), calibration, 0.4).arrow?.set)
        .toBe(true);
    }
    expect(layoutSkee(viewOf({ phase: "rolling", throws: [centre] }), calibration, 0.4).arrow)
      .toBeNull();
  });
});

describe("the close-up's frame", () => {
  it("keeps every gallery state's board, plate, score, arrow, ghost, and ball in view", () => {
    for (const scale of scales)
      for (const state of skeeGalleryStates) {
        const view = skeeGalleryView(world, fixture, state);
        if (view === null) throw new Error(`no gallery view ${state}`);
        const layout = layoutSkee(view, calibration, scale);
        const frame = layout.frame;
        expect(inside(layout.board, frame), `${state} board`).toBe(true);
        expect(inside(layout.plate, frame), `${state} plate`).toBe(true);
        expect(layout.hud.x >= frame.x && layout.hud.y >= frame.y, `${state} score`).toBe(true);
        for (const point of [layout.arrow, layout.ghost, layout.ball])
          if (point !== null)
            expect(point.x >= frame.x && point.x <= frame.x + frame.width &&
              point.y >= frame.y && point.y <= frame.y + frame.height, `${state}`).toBe(true);
      }
  });

  it("shows the hood and the lane down to where the ball sets off", () => {
    const frame = skeeFrame(calibration);
    expect(frame.y).toBeLessThanOrEqual(calibration.plate.y);
    expect(frame.y + frame.h).toBeGreaterThanOrEqual(
      lanePoint(calibration, 1, 0, skeeLook.arrowAt).y);
    expect(frame.x).toBeLessThanOrEqual(calibration.board.x);
    expect(frame.x + frame.w).toBeGreaterThanOrEqual(calibration.board.x + calibration.board.w);
  });
});

it("the gallery's skee-ball states are real games: every throw scored by the core", () => {
  for (const state of skeeGalleryStates) {
    const view = skeeGalleryView(world, fixture, state);
    if (view === null) throw new Error(`no gallery view ${state}`);
    if (view.ball !== null)
      expect(view.ball.points).toBe(skeePoints(skee, view.ball.x, view.ball.y));
  }
  expect(createState(world, fixture).tickets).toBe(0);
});
