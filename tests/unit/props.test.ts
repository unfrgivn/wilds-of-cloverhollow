import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadContent, parseArea } from "../../src/content/load";
import {
  parsePropCatalogue, parsePropPlacements, placeProps, propRuleErrors, type PropCatalogue,
} from "../../src/content/props";
import {
  areaConnectionErrors, hiddenPositions, propDrawingErrors, reachablePositions,
} from "../../src/content/area-checks";
import {
  createState, distanceToPolygon, faeBox, frontEdge, pointInPolygon, propCovers,
  propCoversPoint, propState, propStateName, resolveCollision, resolveMove, sceneryArea, step,
  type ActionFrame, type Area, type Polygon,
} from "../../src/core";

// Milestone 32 contract (spec 6): an area's scenery is props. Each prop has a
// ground footprint (solid) and sorts against characters column by column by
// the front edge of that footprint; a prop's state comes from Ink rules.

const { world, fixtures } = loadContent();
const plaza = world.areas.plaza;
const harness = world.areas.harness;
const plazaFixture = fixtures.plaza;
if (plaza === undefined || harness === undefined || plazaFixture === undefined)
  throw new Error("prop test content missing");
const fresh = createState(world, plazaFixture);
const none: ActionFrame = { move: { x: 0, y: 0 }, confirm: false, cancel: false, menu: false };
const square = (x: number, y: number, half: number): Polygon =>
  [[x - half, y - half], [x + half, y - half], [x + half, y + half], [x - half, y + half]];
const silhouette = { left: -30, step: 5, columns: Array.from({ length: 8 }, () => "-60 0") };
// A small catalogue: one prop with a smashed state and a two-legged arch.
const catalogue: PropCatalogue = parsePropCatalogue({
  atlases: ["assets/areas/test/props-0.json"],
  props: {
    crate: {
      canopy: false, painted: false, home: [100, 100],
      states: {
        default: { frame: "crate", shadow: null, footprint: [square(0, -10, 10)], silhouette },
        smashed: { frame: "crate-smashed", shadow: null, footprint: [], silhouette },
      },
    },
    arch: {
      canopy: false, painted: true, home: [300, 300],
      states: {
        default: {
          frame: "arch", shadow: null, silhouette: {
            left: -50, step: 5, columns: Array.from({ length: 20 }, () => "-120 0") },
          footprint: [square(-40, -5, 5), square(40, -45, 5)],
        },
      },
    },
  },
}, "test.json");
const place = (props: unknown): Area["props"] =>
  placeProps(parsePropPlacements(props, "test.json"), catalogue, "test.json");

describe("props", () => {
  it("place each state in the world, mirrored when flipped", () => {
    const [crate] = place([{ id: "a", prop: "crate", x: 500, y: 400 }]);
    const [flipped] = place([{ id: "b", prop: "crate", x: 500, y: 400, flip: true }]);
    expect(crate?.states.default?.footprint).toEqual([square(500, 390, 10)]);
    expect(crate?.states.default?.silhouette.left).toBe(470);
    // Mirrored about x 500: the silhouette spans 490..530 instead of 470..510.
    expect(flipped?.states.default?.silhouette.left).toBe(490);
    expect(flipped?.states.default?.footprint[0]?.map(([x]) => x).sort((a, b) => a - b))
      .toEqual([490, 490, 510, 510]);
  });

  it("take their state from the first true Ink rule, else their own", () => {
    const [ruled] = place([{ id: "a", prop: "crate", x: 0, y: 0, rules: [
      { state: "smashed", while: "club_open" },
      { state: "smashed", while: "maple_in_hall" },
    ] }]);
    const [quiet] = place([{ id: "b", prop: "crate", x: 0, y: 0, rules: [
      { state: "smashed", while: "club_open" },
    ] }]);
    if (ruled === undefined || quiet === undefined) throw new Error("props missing");
    // maple_in_hall starts true; club_open starts false.
    expect(propStateName(world, fresh.ink, ruled)).toBe("smashed");
    expect(propState(world, fresh.ink, ruled).footprint).toEqual([]);
    expect(propStateName(world, fresh.ink, quiet)).toBe("default");
  });

  it("are solid in their current state only", () => {
    const area = { ...harness, props: place([{ id: "a", prop: "crate", x: 400, y: 400 }]) };
    const smashed = { ...harness, props: place([
      { id: "a", prop: "crate", x: 400, y: 400, state: "smashed" },
    ]) };
    const inside = { x: 400, y: 390 };
    const pushed = resolveCollision(inside, sceneryArea(world, fresh.ink, area), 20);
    expect(distanceToPolygon(pushed, square(400, 390, 10))).toBeGreaterThanOrEqual(19.99);
    expect(sceneryArea(world, fresh.ink, smashed))
      .toEqual({ ...smashed, blockers: harness.blockers });
    // An area without props is left exactly as it is.
    expect(sceneryArea(world, fresh.ink, harness)).toBe(harness);
  });

  it("sort by a front edge that runs straight across gaps and flat past the ends", () => {
    const legs = [square(10, 10, 5), square(40, 30, 5)];
    const front = frontEdge(legs, 0, 10, 7, 99);
    // Columns centred on x 5, 15, ..., 65: the legs' south sides are 15
    // (x 5..15) and 35 (x 35..45); between them it runs straight.
    expect(front.ys).toEqual([15, 15, 25, 35, 35, 35, 35]);
    expect(frontEdge([], 0, 10, 2, 99).ys).toEqual([99, 99]);
  });

  it("cover someone column by column, only while their feet are north of the front", () => {
    const [arch] = place([{ id: "a", prop: "arch", x: 300, y: 300 }]);
    const state = arch?.states.default;
    if (state === undefined) throw new Error("arch missing");
    // The front runs from y 300 under the left leg to 260 under the right one.
    expect(propCoversPoint(state, { x: 260, y: 290 }, { x: 260, y: 250 })).toBe(true);
    expect(propCoversPoint(state, { x: 260, y: 305 }, { x: 260, y: 250 })).toBe(false);
    expect(propCoversPoint(state, { x: 340, y: 270 }, { x: 340, y: 250 })).toBe(false);
    expect(propCoversPoint(state, { x: 340, y: 250 }, { x: 340, y: 200 })).toBe(true);
    // Above the silhouette nothing is covered.
    expect(propCoversPoint(state, { x: 300, y: 250 }, { x: 300, y: 150 })).toBe(false);
    expect(propCovers(state, { x: 300, y: 250 }, faeBox)).toBeGreaterThan(0.25);
    expect(propCovers(state, { x: 300, y: 320 }, faeBox)).toBe(0);
  });

  it("slide or stop in a gap narrower than the collider, never ending inside", () => {
    const area: Area = {
      ...harness,
      walkable: square(150, 150, 150),
      blockers: [[[100, 100], [120, 100], [120, 200], [100, 200]],
        [[140, 100], [160, 100], [160, 200], [140, 200]]],
    };
    const previous = { x: 130, y: 70 };
    const resolved = resolveMove(previous, { x: 130, y: 74 }, area, 20);
    for (const blocker of area.blockers) {
      expect(pointInPolygon(resolved, blocker)).toBe(false);
      expect(distanceToPolygon(resolved, blocker)).toBeGreaterThanOrEqual(19.99);
    }
    // Where the solver succeeds, the move is exactly the solver's.
    const open = { x: 260, y: 260 };
    expect(resolveMove({ x: 256, y: 256 }, open, area, 20))
      .toEqual(resolveCollision(open, area, 20));
  });

  it("are walked around by Fae in the plaza", () => {
    // Walking north from below the south bench stops her at its footprint.
    const bench = plaza.props.find((prop) => prop.id === "bench-south");
    if (bench === undefined) throw new Error("bench-south missing");
    let state = { ...fresh, player: { x: 877, y: 830 } };
    for (let tick = 0; tick < 60; tick += 1)
      state = step(world, state, { ...none, move: { x: 0, y: -1 } }).state;
    const footprint = bench.states.default?.footprint[0];
    if (footprint === undefined) throw new Error("bench-south footprint missing");
    expect(distanceToPolygon(state.player, footprint)).toBeGreaterThanOrEqual(19.99);
    expect(state.player.y).toBeGreaterThan(761);
  });

  it("reject what doesn't fit the catalogue", () => {
    expect(() => place([{ id: "a", prop: "barrel", x: 0, y: 0 }])).toThrow("unknown prop");
    expect(() => place([{ id: "a", prop: "crate", x: 0, y: 0, state: "burnt" }]))
      .toThrow("no state burnt");
    expect(() => place([{ id: "a", prop: "crate", x: 0, y: 0 },
      { id: "a", prop: "crate", x: 9, y: 9 }])).toThrow("duplicate prop id");
    // A painted prop is still on the plate: it can't move or change.
    expect(() => place([{ id: "a", prop: "arch", x: 301, y: 300 }])).toThrow("must stay");
    expect(() => parsePropCatalogue({ atlases: [], props: { arch: {
      canopy: false, painted: true, home: [0, 0], states: {
        default: { frame: "a", shadow: null, footprint: [], silhouette },
        broken: { frame: "b", shadow: null, footprint: [], silhouette },
      } } } }, "x.json")).toThrow("can't change state");
    const ruled = { ...harness, props: place([{ id: "a", prop: "crate", x: 0, y: 0,
      rules: [{ state: "smashed", while: "no_such_flag" }] }]) };
    expect(propRuleErrors({ harness: ruled }, (name) => world.storyVariable(fresh.ink, name)))
      .toEqual(["harness: prop a reads undeclared Ink variable no_such_flag"]);
  });

  it("pass the area checks in every area, the plaza's props included", () => {
    expect(areaConnectionErrors(world.areas, world.tunables, world.critters, world.party))
      .toEqual([]);
    expect(hiddenPositions(plaza, world.tunables.playerRadius)).toEqual([]);
  }, 30_000);

  it("count as solid in the area checks", () => {
    // A room round the harness spawn with a row of crates: the checks keep
    // everyone a collider's radius off every footprint any state can have.
    const spawn = harness.spawns.start;
    if (spawn === undefined) throw new Error("harness spawn missing");
    const room = square(spawn.x, spawn.y, 200);
    const crates = Array.from({ length: 6 }, (_, index) =>
      ({ id: `c${index}`, prop: "crate", x: spawn.x - 150 + index * 60, y: spawn.y + 120 }));
    const parsed = parseArea({ ...JSON.parse(readFileSync("content/areas/harness.json", "utf8")),
      walkable: room, props: crates }, "harness.json", catalogue);
    expect(parsed.props).toEqual(place(crates));
    const reachable = reachablePositions(parsed, 20);
    expect(reachable.length).toBeGreaterThan(0);
    const footprints = parsed.props.flatMap((prop) => prop.states.default?.footprint ?? []);
    expect(reachable.every((point) => footprints.every((polygon) =>
      !pointInPolygon(point, polygon) && distanceToPolygon(point, polygon) >= 20))).toBe(true);
    // Crates packed round the spawn leave the party nowhere to stand.
    const packed: { id: string; prop: string; x: number; y: number }[] = [];
    for (let x = spawn.x - 180; x <= spawn.x + 180; x += 30)
      for (let y = spawn.y - 180; y <= spawn.y + 180; y += 30) {
        const gap = Math.hypot(x - spawn.x, y - 10 - spawn.y);
        if (gap >= 45 && gap <= 170) packed.push({ id: `p${packed.length}`, prop: "crate", x, y });
      }
    expect(areaConnectionErrors({ harness: { ...harness, walkable: room, props: place(packed) } },
      world.tunables, world.critters, world.party))
      .toContain("harness: spawn start has no slot for maddie");
  });

  it("can't split a room in two: every spawn must reach every other", () => {
    // A room round the harness spawn, a second spawn 250 units east, and a
    // wall of crates between them, gap by gap: one floor until the last gap.
    const spawn = harness.spawns.start;
    if (spawn === undefined) throw new Error("harness spawn missing");
    const room = square(spawn.x + 125, spawn.y, 200);
    const east = { x: spawn.x + 250, y: spawn.y, facing: "left" as const };
    const spawns = { ...harness.spawns, east };
    const wall = (gaps: number): Area["props"] =>
      place(Array.from({ length: 13 - gaps }, (_, index) =>
        ({ id: `w${index}`, prop: "crate", x: spawn.x + 125, y: spawn.y - 170 + index * 30 })));
    const split = (gaps: number): string[] =>
      areaConnectionErrors({ harness: { ...harness, walkable: room, spawns, props: wall(gaps) } },
        world.tunables, world.critters, world.party).filter((error) => error.includes("split"));
    expect(split(3)).toEqual([]);
    expect(split(0))
      .toEqual(["harness: its floor is split; spawns start | east can't reach each other"]);
  });

  it("match their atlases: every frame there, anchored, and a whole number of columns", () => {
    for (const file of readdirSync("content/props")) {
      const content: unknown = JSON.parse(readFileSync(`content/props/${file}`, "utf8"));
      const parsed = parsePropCatalogue(content, file);
      const frames = new Map<string, { w: number; anchor: unknown }>();
      for (const atlas of parsed.atlases) {
        const page: unknown = JSON.parse(readFileSync(`public/${atlas}`, "utf8"));
        if (typeof page !== "object" || page === null || !("frames" in page) ||
            typeof page.frames !== "object" || page.frames === null)
          throw new Error(`${atlas} has no frames`);
        for (const [name, frame] of Object.entries(page.frames)) {
          const w = typeof frame === "object" && frame !== null && "frame" in frame &&
            typeof frame.frame === "object" && frame.frame !== null && "w" in frame.frame &&
            typeof frame.frame.w === "number" ? frame.frame.w : -1;
          const anchor = typeof frame === "object" && frame !== null && "anchor" in frame
            ? frame.anchor : undefined;
          frames.set(name, { w, anchor });
        }
      }
      for (const [id, prop] of Object.entries(parsed.props))
        for (const [name, state] of Object.entries(prop.states)) {
          const frame = frames.get(state.frame);
          expect(frame, `${file} ${id}.${name}`).toBeDefined();
          expect(frame?.anchor, `${file} ${id}.${name} anchor`).toBeDefined();
          expect(frame?.w, `${file} ${id}.${name} columns`)
            .toBe(state.silhouette.columns.length * state.silhouette.step * 2);
          if (state.shadow !== null) expect(frames.has(state.shadow), state.shadow).toBe(true);
        }
    }
  });

  it("are drawn whole: every prop's picture stands on its footprint", () => {
    // A picture floating above its footprint, or a footprint reaching past its
    // picture, in any area (spec 6.2). These four reach past their pictures and
    // are known invisible walls: Milestone 34 kept the pass's old tested
    // blockers as footprints so its replays walk as before, and the park's east
    // bush overhangs by three columns. docs/plan.md lists the follow-up; fixing
    // one means deleting it here.
    expect(Object.values(world.areas).flatMap(propDrawingErrors)).toEqual([
      "park: prop bush-right (default) has 15 footprint units with nothing drawn",
      "pass: prop forest-left (default) has 35 footprint units with nothing drawn",
      "pass: prop lodge (default) has 35 footprint units with nothing drawn",
      "pass: prop benches (default) has 80 footprint units with nothing drawn",
    ]);
  });

  it("fail the drawing check with a footprint under a neighbour's crown", () => {
    // The footprint the woods' north-east log shipped with: a strip on the open
    // grass 35 units south of the log, under tree-east's crown. Tree-east is in
    // front there, but its picture covers the strip's front only by its trunk,
    // so the strip's other columns are bare.
    const woods = world.areas.woods;
    if (woods === undefined) throw new Error("woods missing");
    const log = woods.props.find((prop) => prop.id === "log-north");
    const state = log?.states.default;
    if (log === undefined || state === undefined) throw new Error("no north-east log");
    const strip: Polygon[] = [[[1145, 490], [1190, 490], [1270, 490], [1350, 495],
      [1380, 500], [1340, 501], [1260, 501], [1180, 497]]];
    const { left, step, columns } = state.silhouette;
    const shipped = { ...woods, props: woods.props.map((prop) => prop !== log ? prop : {
      ...log, states: { default: { ...state, footprint: strip,
        front: frontEdge(strip, left, step, columns.length, log.y) } } }) };
    expect(propDrawingErrors(shipped)).toContainEqual(
      expect.stringMatching(/^woods: prop log-north \(default\) has \d+ footprint units/));
  });

  it("fail the drawing check with a footprint off their picture", () => {
    // The plaza's south bench, its footprint pushed 30 units forward and
    // widened 40 units past its picture's west end.
    const bench = plaza.props.find((prop) => prop.id === "bench-south");
    const state = bench?.states.default;
    if (bench === undefined || state === undefined) throw new Error("no south bench");
    expect(propDrawingErrors({ ...plaza, props: [bench] })).toEqual([]);
    const shifted = (state.footprint[0] ?? []).map(([x, y]): [number, number] => [x, y + 30]);
    const wide: Polygon[] = [[...shifted,
      [state.silhouette.left - 40, bench.y + 30], [state.silhouette.left - 40, bench.y]]];
    const { left, step: width, columns } = state.silhouette;
    const moved = { ...plaza, props: [{ ...bench, states: { default: { ...state,
      footprint: wide, front: frontEdge(wide, left, width, columns.length, bench.y) } } }] };
    expect(propDrawingErrors(moved)).toEqual([
      expect.stringMatching(/^plaza: prop bench-south \(default\) has \d+ footprint units/),
      expect.stringMatching(/^plaza: prop bench-south \(default\): its picture's foot is 3\d /),
    ]);
  });
});
