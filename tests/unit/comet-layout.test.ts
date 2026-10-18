import { describe, expect, it } from "vitest";
import {
  blankInput, cometView, createState, openArcade, step, type CometView,
} from "../../src/core";
import { loadContent, parseCometCalibration } from "../../src/content/load";
import { cometFrame, cometLook, layoutComet, type CometLayout } from "../../src/ui/comet-layout";
import calibrationData from "../../public/assets/arcade/comet-cabinet.json";

// The close-up's layout (spec 8.2), on the cabinet's real calibration.
const calibration = parseCometCalibration(calibrationData,
  "public/assets/arcade/comet-cabinet.json");
const scales = [0.25, 0.42];
const view = (patch: Partial<CometView> = {}): CometView => ({
  game: "comet", phase: "playing",
  rocket: { lane: 1, position: 1, lean: 0, wobble: 0 },
  objects: [], caught: 0, total: 16, left: 16, hint: null, message: "", revealed: 0,
  ...patch,
});
const centre = (rect: { x: number; y: number; width: number; height: number }):
  { x: number; y: number } => ({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 });
// The vanishing point and a lane's centre at the row, in field px.
const geometry = (layout: CometLayout): { vanish: { x: number; y: number };
  lane: (lane: number) => number; row: number; full: number } => ({
  vanish: { x: layout.field.width / 2, y: -layout.field.height * cometLook.vanish },
  lane: (lane) => layout.field.width * (1 / 6 + lane / 3),
  row: layout.field.height * cometLook.row,
  full: layout.field.width * cometLook.size,
});

describe("Comet Cruise's close-up layout", () => {
  it("puts each one on its lane's line to the vanishing point, growing as it comes", () => {
    for (const scale of scales)
      for (const lane of [0, 1, 2] as const)
        for (const progress of [0.05, 0.3, 0.6, 0.95]) {
          const layout = layoutComet(
            view({ objects: [{ kind: "star", lane, progress, flash: 0 }] }), calibration, scale);
          const at = layout.objects[0];
          if (at === undefined) throw new Error("no object laid out");
          const { vanish, lane: laneAt, row, full } = geometry(layout);
          const c = centre(at);
          expect(c.y).toBeCloseTo(progress * row, -0.5);
          const onLine = vanish.x + (laneAt(lane) - vanish.x) * (c.y - vanish.y) / (row - vanish.y);
          expect(Math.abs(c.x - onLine)).toBeLessThanOrEqual(1);
          expect(Math.abs(at.width - full * (0.4 + 0.6 * progress))).toBeLessThanOrEqual(1);
          expect(at.frame).toBe("star");
          expect(at.opacity).toBe(1);
        }
  });

  it("has the outer lanes spread already at the field's top, a share of their spread at the row",
    () => {
      const layout = layoutComet(view({ objects: [
        { kind: "rock", lane: 0, progress: 0.001, flash: 0 },
        { kind: "rock", lane: 2, progress: 0.001, flash: 0 },
      ] }), calibration, 0.42);
      const [left, right] = layout.objects.map(centre);
      if (left === undefined || right === undefined) throw new Error("no objects laid out");
      const { lane, vanish, row } = geometry(layout);
      const share = (0 - vanish.y) / (row - vanish.y);
      expect(right.x - left.x).toBeCloseTo((lane(2) - lane(0)) * share, -0.5);
      expect(right.x - left.x).toBeGreaterThan(layout.field.width / 5);
    });

  it("stands the rocket on its row at its position, its frame by its wobble, then its lean", () => {
    for (const scale of scales) {
      for (const position of [0, 0.5, 1, 1.5, 2]) {
        const layout = layoutComet(view({ rocket: { lane: 2, position, lean: 1, wobble: 0 } }),
          calibration, scale);
        const c = centre(layout.rocket);
        const { lane, row, full } = geometry(layout);
        expect(Math.abs(c.x - lane(position))).toBeLessThanOrEqual(1);
        expect(Math.abs(c.y - row)).toBeLessThanOrEqual(1);
        expect(Math.abs(layout.rocket.width - full)).toBeLessThanOrEqual(1);
      }
      const frameOf = (lean: -1 | 0 | 1, wobble: number): string =>
        layoutComet(view({ rocket: { lane: 1, position: 1, lean, wobble } }), calibration, scale)
          .rocket.frame;
      expect([frameOf(0, 0), frameOf(-1, 0), frameOf(1, 0), frameOf(1, 0.5), frameOf(0, 1)])
        .toEqual(["rocket", "rocket-left", "rocket-right", "rocket-wobble", "rocket-wobble"]);
    }
  });

  it("keeps the rocket clear of the field's foot and inside its sides in every lane", () => {
    for (const scale of scales)
      for (const position of [0, 2]) {
        const { rocket, field } = layoutComet(
          view({ rocket: { lane: 0, position, lean: 0, wobble: 0 } }), calibration, scale);
        expect(rocket.y + rocket.height).toBeLessThanOrEqual(field.height);
        expect(rocket.x).toBeGreaterThanOrEqual(0);
        expect(rocket.x + rocket.width).toBeLessThanOrEqual(field.width);
      }
  });

  it("shows a catch's sparkle and a bump's puff on the row in their lane, fading out", () => {
    const layout = layoutComet(view({ objects: [
      { kind: "star", lane: 0, progress: 1, flash: 0.75 },
      { kind: "rock", lane: 2, progress: 1, flash: 0.25 },
    ] }), calibration, 0.42);
    const { lane, row, full } = geometry(layout);
    const [sparkle, puff] = layout.objects;
    if (sparkle === undefined || puff === undefined) throw new Error("no flashes laid out");
    expect([sparkle.frame, sparkle.opacity, puff.frame, puff.opacity])
      .toEqual(["star-sparkle", 0.75, "rock-puff", 0.25]);
    expect(Math.abs(centre(sparkle).x - lane(0))).toBeLessThanOrEqual(1);
    expect(Math.abs(centre(puff).x - lane(2))).toBeLessThanOrEqual(1);
    expect(Math.abs(centre(sparkle).y - row)).toBeLessThanOrEqual(1);
    expect(Math.abs(sparkle.width - full)).toBeLessThanOrEqual(1);
  });

  it("fades one passing on from 1 at the row to 0 at the field's foot", () => {
    const at = (progress: number): number =>
      layoutComet(view({ objects: [{ kind: "rock", lane: 1, progress, flash: 0 }] }),
        calibration, 0.42).objects[0]?.opacity ?? -1;
    const foot = 1 / cometLook.row;
    expect(at(1)).toBe(1);
    expect(at(1 + (foot - 1) / 2)).toBeCloseTo(0.5, 2);
    expect(at(foot)).toBe(0);
    expect(at(foot + 0.1)).toBe(0);
  });

  it("draws the dotted lines between the lanes, from the field's top to its foot", () => {
    const layout = layoutComet(view(), calibration, 0.42);
    const { vanish, row } = geometry(layout);
    layout.lines.forEach((line, index) => {
      expect([line.y1, line.y2]).toEqual([0, layout.field.height]);
      const atRow = line.x1 + (line.x2 - line.x1) * row / layout.field.height;
      expect(Math.abs(atRow - layout.field.width * (index + 1) / 3)).toBeLessThanOrEqual(1);
      // Extended upward, it reaches the vanishing point.
      const atVanish = line.x1 + (line.x2 - line.x1) * vanish.y / layout.field.height;
      expect(Math.abs(atVanish - vanish.x)).toBeLessThanOrEqual(1.5);
    });
  });

  it("stands the keys on the cabinet's sides either side of the screen, level with the row", () => {
    for (const scale of scales) {
      const layout = layoutComet(view(), calibration, scale);
      const screenLeft = calibration.screen.x * scale;
      const screenRight = (calibration.screen.x + calibration.screen.w) * scale;
      const [left, right] = layout.keys;
      if (left === undefined || right === undefined) throw new Error("no keys laid out");
      expect([left.label, left.side, right.label, right.side])
        .toEqual(["←", "left", "→", "right"]);
      expect(left.x).toBeLessThan(screenLeft);
      expect(left.x).toBeGreaterThan(0);
      expect(right.x).toBeGreaterThan(screenRight);
      expect(right.x).toBeLessThan(layout.width);
      expect(Math.abs(left.y - (layout.field.y + layout.row))).toBeLessThanOrEqual(1);
      expect(right.y).toBe(left.y);
    }
  });

  it("shows the whole width from above the marquee to the deck's foot, the screen in view", () => {
    const frame = cometFrame(calibration);
    expect(frame).toMatchObject({ x: 0, w: calibration.size.w });
    expect(frame.y).toBeLessThan(calibration.marquee.y);
    expect(frame.y + frame.h).toBe(calibration.deck.y + calibration.deck.h);
    const layout = layoutComet(view(), calibration, 0.42);
    expect(layout.marquee.y).toBeGreaterThan(0);
    expect(layout.field.y).toBeGreaterThan(layout.marquee.y + layout.marquee.height);
    expect(layout.field.y + layout.field.height).toBeLessThan(layout.height);
    expect(layout.hud).toEqual({ x: layout.marquee.x - 10, y: layout.marquee.y });
    expect(layout.fade).toBe(0.06);
  });

  // Passing on below the row, one spreads past the field's sides as it fades;
  // the field clips it.
  it("keeps everything a real run shows coming down inside the field's sides", () => {
    const { world, fixtures } = loadContent();
    const fixture = fixtures.arcade;
    if (fixture === undefined) throw new Error("missing the arcade fixture");
    let state = openArcade(world, { ...createState(world, fixture), coins: 2 }, "comet", 2);
    for (let tick = 0; tick < 900; tick += 1) {
      state = step(world, state, blankInput()).state;
      if (state.arcade?.game !== "comet") throw new Error("the run closed early");
      if (tick % 15 !== 0) continue;
      const layout = layoutComet(cometView(world, state.arcade), calibration, 0.42);
      for (const item of layout.objects.filter((object) => object.opacity === 1)) {
        expect(item.x).toBeGreaterThanOrEqual(-1);
        expect(item.x + item.width).toBeLessThanOrEqual(layout.field.width + 1);
      }
    }
  });
});
