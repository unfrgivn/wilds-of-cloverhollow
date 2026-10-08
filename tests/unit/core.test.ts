import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import {
  createState,
  distanceToPolygon,
  faeBox,
  frontEdge,
  partySlots,
  hiddenFraction,
  nextRandom,
  pointInPolygon,
  stableHash,
  step,
  type State,
  type ActionFrame,
  type Polygon,
  sceneryArea,
} from "../../src/core";
import {
  loadContent,
  parseArea,
  parseGroundManifest,
  parseOccluderManifest,
} from "../../src/content/load";
import { areaConnectionErrors } from "../../src/content/area-checks";
import { hiddenPositions } from "../../src/content/area-checks";

const content = loadContent();
const world = content.world;
const fixture = content.fixtures.harness;
if (fixture === undefined) throw new Error("fixture missing");
const newGame = content.fixtures["new-game"];
if (newGame === undefined) throw new Error("new-game fixture missing");
const area = world.areas.harness;
if (area === undefined) throw new Error("area missing");
const maddie = world.party.maddie;
if (maddie === undefined) throw new Error("Maddie missing from the roster");
const maddieBox = maddie.box;
const none: ActionFrame = {
  move: { x: 0, y: 0 },
  confirm: false,
  cancel: false,
  menu: false,
};

function valid(state: ReturnType<typeof createState>): boolean {
  const current = world.areas[state.area];
  if (current === undefined) return false;
  return (
    pointInPolygon(state.player, current.walkable) &&
    distanceToPolygon(state.player, current.walkable) >=
      world.tunables.playerRadius - 0.01 &&
    sceneryArea(world, state.ink, current).blockers.every(
      (blocker) =>
        !pointInPolygon(state.player, blocker) &&
        distanceToPolygon(state.player, blocker) >=
          world.tunables.playerRadius - 0.01,
    )
  );
}

function run(
  start: ReturnType<typeof createState>,
  input: ActionFrame,
  ticks: number,
): ReturnType<typeof createState> {
  let state = start;
  for (let index = 0; index < ticks; index += 1)
    state = step(world, state, input).state;
  return state;
}

describe("core", () => {
  it("derives four units per tick from tunable walk speed", () => {
    const result = step(world, createState(world, fixture), {
      ...none,
      move: { x: 1, y: 0 },
    });
    expect(result.state.player.x).toBe(304);
    expect(result.state.motion).toEqual({ distance: 4, moving: true });
  });

  it("counts only resolved displacement, including a wall slide", () => {
    const start = {
      ...createState(world, fixture),
      player: { x: 820, y: 400 },
    };
    const result = step(world, start, { ...none, move: { x: 1, y: 1 } });
    const dx = result.state.player.x - start.player.x;
    const dy = result.state.player.y - start.player.y;
    expect(result.state.motion.distance).toBeCloseTo(Math.sqrt(dx * dx + dy * dy));
    expect(result.state.motion.distance).toBeGreaterThan(0);
  });

  it("recovers centres placed inside every blocker", () => {
    for (const blocker of area.blockers) {
      const first = blocker[0];
      const opposite = blocker[2];
      if (first === undefined || opposite === undefined)
        throw new Error("bad blocker");
      const start = {
        ...createState(world, fixture),
        player: {
          x: (first[0] + opposite[0]) / 2,
          y: (first[1] + opposite[1]) / 2,
        },
      };
      expect(valid(step(world, start, none).state)).toBe(true);
    }
  });

  it("rejects approaches to the non-rectangular blocker from eight directions", () => {
    const blocker = area.blockers[1];
    if (blocker === undefined)
      throw new Error("non-rectangular blocker missing");
    const centre = { x: 1450, y: 735 };
    const directions = [
      { x: -1, y: -1 },
      { x: 0, y: -1 },
      { x: 1, y: -1 },
      { x: -1, y: 0 },
      { x: 1, y: 0 },
      { x: -1, y: 1 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
    ];
    for (const direction of directions) {
      const start = {
        ...createState(world, fixture),
        player: {
          x: centre.x - direction.x * 80,
          y: centre.y - direction.y * 80,
        },
      };
      expect(valid(run(start, { ...none, move: direction }, 30))).toBe(true);
    }
    expect(blocker.length).toBeGreaterThan(4);
  });

  it("slides along a wall and never enters it", () => {
    const start = {
      ...createState(world, fixture),
      player: { x: 820, y: 400 },
    };
    const result = run(start, { ...none, move: { x: 1, y: 1 } }, 30);
    expect(result.player.y).toBeGreaterThan(start.player.y);
    expect(valid(result)).toBe(true);
  });

  it("keeps sustained convex and concave corner input valid", () => {
    const convex = run(
      createState(world, fixture),
      { ...none, move: { x: -1, y: -1 } },
      300,
    );
    const notch = {
      ...createState(world, fixture),
      player: { x: 1000, y: 900 },
    };
    const concave = run(notch, { ...none, move: { x: 1, y: 1 } }, 300);
    expect(valid(convex)).toBe(true);
    expect(valid(concave)).toBe(true);
  });

  it("handles facing ties horizontally and emits button edges", () => {
    const first = step(world, createState(world, fixture), {
      ...none,
      move: { x: 1, y: 1 },
      confirm: true,
    });
    const second = step(world, first.state, { ...none, confirm: true });
    expect(first.state.facing).toBe("right");
    expect(first.events).toEqual([{ type: "button", button: "confirm" }]);
    expect(second.events).toEqual([]);
  });

  it("produces fixed random values and stable hashes", () => {
    const first = nextRandom(createState(world, fixture, 42));
    const second = nextRandom(first[1]);
    expect([first[0], second[0]]).toEqual([
      0.2523451747838408, 0.08812504541128874,
    ]);
    expect(stableHash({ a: 1, b: 2 })).toBe(stableHash({ b: 2, a: 1 }));
    expect(stableHash({ a: 1 })).not.toBe(stableHash({ a: 2 }));
    const firstRun = run(
      createState(world, fixture),
      { ...none, move: { x: 1, y: 1 } },
      100,
    );
    const secondRun = run(
      createState(world, fixture),
      { ...none, move: { x: 1, y: 1 } },
      100,
    );
    expect(stableHash(firstRun)).toBe(stableHash(secondRun));
  });

  it("loads fixtures and reports unknown fixtures", () => {
    expect(createState(world, fixture).area).toBe("harness");
    expect(() =>
      createState(world, { area: "missing", spawn: "start" }),
    ).toThrow(/missing/);
  });

  it("reports malformed content fields", () => {
    expect(() => loadContent()).not.toThrow();
    expect(() => parseArea({ id: "broken", width: 10 }, "broken.json")).toThrow(
      /broken.json: invalid height/,
    );
  });

  it("ships ground tiles and generated occluder cutouts for each painted area", () => {
    for (const area of Object.values(world.areas)) {
      if (area.ground === undefined) continue;
      expect(existsSync(`public/assets/areas/${area.ground}/ground.json`)).toBe(true);
      for (const occluder of area.occluders)
        expect(existsSync(`public/assets/areas/${area.ground}/${occluder.id}.webp`))
          .toBe(true);
    }
  });

  it("validates ground and occluder manifests", () => {
    expect(() => parseGroundManifest({ paper: "#fff", tiles: [] }, "ground.json"))
      .not.toThrow();
    expect(() => parseOccluderManifest({ cutouts: [] }, "occluders.json"))
      .not.toThrow();
    expect(() => parseGroundManifest({ paper: "#fff" }, "ground.json"))
      .toThrow(/ground.json/);
  });

  it("closes every Ink conversation and can reopen it", () => {
    for (const area of Object.values(world.areas)) {
      for (const interactable of area.interactables) {
        const fixtureForArea = area.id === "plaza" ? content.fixtures.plaza : newGame;
        if (fixtureForArea === undefined) throw new Error("fixture missing");
        let state: State = {
          ...createState(world, fixtureForArea),
          player: { ...interactable.point },
          facing: "down" as const,
        };
        state = step(world, state, { ...none, confirm: true }).state;
        let presses = 0;
        for (let tick = 0; tick < 500 && state.dialogue !== null; tick += 1) {
          const shown = state.dialogue.revealed >= state.dialogue.text.length;
          const input = shown ? { ...none, confirm: true } : none;
          if (shown) presses += 1;
          state = step(world, state, input).state;
        }
        expect(presses, interactable.id).toBeLessThanOrEqual(20);
        expect(state.dialogue, interactable.id).toBeNull();
      }
    }
  });

  it("fires a door only when entering its trigger", () => {
    const start = { ...createState(world, newGame), player: { x: 525, y: 340 } };
    const outside = step(world, start, none).state;
    expect(outside.transition).toBeNull();
    const moved = step(world, outside, { ...none, move: { x: 0, y: -1 } }).state;
    const entered = step(world, moved, { ...none, move: { x: 0, y: -1 } }).state;
    expect(entered.transition?.phase).toBe("out");
    const inside = { ...start, player: { x: 525, y: 300 } };
    expect(step(world, inside, none).state.transition).toBeNull();
  });

  it("switches areas after fade-out and finishes fade-in deterministically", () => {
    let state = { ...createState(world, newGame), player: { x: 525, y: 340 } };
    state = step(world, state, { ...none, move: { x: 0, y: -1 } }).state;
    state = step(world, state, { ...none, move: { x: 0, y: -1 } }).state;
    expect(state.transition).not.toBeNull();
    for (let index = 0; index < world.tunables.doorFadeTicks; index += 1)
      state = step(world, state, { ...none, move: { x: 1, y: 0 } }).state;
    expect(state.area, "the bedroom door leads downstairs").toBe("kitchen");
    const stairs = world.areas.kitchen?.spawns.stairs;
    if (stairs === undefined) throw new Error("no kitchen stairs spawn");
    expect(state.player).toEqual({ x: stairs.x, y: stairs.y });
    expect(state.facing).toBe(stairs.facing);
    expect(state.transition?.phase).toBe("in");
    for (let index = 0; index < world.tunables.doorFadeTicks; index += 1)
      state = step(world, state, { ...none, move: { x: 1, y: 0 } }).state;
    expect(state.transition).toBeNull();
    expect(state.player.x).toBe(stairs.x);
  });

  it("rejects invalid trigger targets and spawns inside triggers", () => {
    const plaza = world.areas.plaza;
    if (plaza === undefined) throw new Error("plaza missing");
    const trigger = plaza.triggers[0];
    if (trigger === undefined) throw new Error("plaza trigger missing");
    const badTarget = {
      ...plaza,
      triggers: [{ ...trigger, target: { area: "missing", spawn: "x" } }],
    };
    expect(areaConnectionErrors({ ...world.areas, plaza: badTarget }, world.tunables,
      world.critters, world.party))
      .toContain("plaza: trigger house-front-door has an invalid target");
    const badSpawn = {
      ...plaza,
      spawns: { ...plaza.spawns, bad: { x: 350, y: 530, facing: "down" as const } },
    };
    expect(areaConnectionErrors({ ...world.areas, plaza: badSpawn }, world.tunables,
      world.critters, world.party))
      .toContain("plaza: spawn bad is within 40 units of house-front-door");
  }, 30_000);

  it("never lets an occluder hide most of Fae anywhere she can stand", () => {
    for (const area of Object.values(world.areas)) {
      expect(hiddenPositions(area, world.tunables.playerRadius), area.id).toEqual([]);
    }
  }, 30_000);

  it("keeps Maddie valid during seeded random walks in every area", () => {
    for (const fixtureName of ["new-game", "plaza"] as const) {
      const fixtureValue = content.fixtures[fixtureName];
      if (fixtureValue === undefined) throw new Error("fixture missing");
      let state = createState(world, fixtureValue);
      for (let tick = 0; tick < 600; tick += 1) {
        const random = nextRandom(state);
        state = random[1];
        const frame = {
          ...none,
          move: {
            x: random[0] < 0.34 ? -1 : random[0] < 0.67 ? 1 : 0,
            y: random[0] < 0.5 ? -1 : random[0] < 0.8 ? 1 : 0,
          },
        };
        state = step(world, state, frame).state;
        const area = world.areas[state.area];
        if (area === undefined) throw new Error("area missing");
        const [maddie] = state.party;
        if (maddie === undefined) throw new Error("Maddie missing");
        expect(pointInPolygon(maddie, area.walkable)).toBe(true);
        expect(distanceToPolygon(maddie, area.walkable))
          .toBeGreaterThanOrEqual(world.tunables.follow.radius - 0.01);
        for (const blocker of sceneryArea(world, state.ink, area).blockers) {
          expect(pointInPolygon(maddie, blocker)).toBe(false);
          expect(distanceToPolygon(maddie, blocker))
            .toBeGreaterThanOrEqual(world.tunables.follow.radius - 0.01);
        }
      }
    }
  });

  it("spaces and caps Maddie's trail and selects a valid door slot", () => {
    // Walk a loop south of the plaza fountain, clear of its benches and lamp
    // arches, so both of them keep moving, and check the trail on every tick.
    const plazaFixture = content.fixtures.plaza;
    if (plazaFixture === undefined) throw new Error("plaza fixture missing");
    let state = createState(world, plazaFixture);
    const legs: [number, number, number][] = [
      [0, 1, 30], [-1, 0, 110], [0, -1, 15], [1, 0, 110], [0, -1, 20],
    ];
    let checked = 0;
    for (const [x, y, ticks] of legs) {
      for (let tick = 0; tick < ticks; tick += 1) {
        state = step(world, state, { ...none, move: { x, y } }).state;
        const trail = state.party[0]?.trail ?? [];
        expect(trail.length).toBeLessThanOrEqual(world.tunables.follow.trailMax);
        for (let index = 1; index < trail.length; index += 1) {
          const previous = trail[index - 1];
          const current = trail[index];
          if (previous === undefined || current === undefined) continue;
          const dx = current.x - previous.x;
          const dy = current.y - previous.y;
          expect(Math.sqrt(dx * dx + dy * dy))
            .toBeGreaterThanOrEqual(world.tunables.follow.trailSpacing);
          checked += 1;
        }
      }
    }
    expect(checked).toBeGreaterThan(1000);
    const bedroom = world.areas.bedroom;
    const spawn = bedroom?.spawns.door;
    if (bedroom === undefined || spawn === undefined) throw new Error("door missing");
    expect(partySlots(bedroom, spawn, world.tunables.follow, [maddie])[0]?.slot)
      .toBeDefined();
  });

  it("measures Maddie's visibility from feet-anchored body boxes", () => {
    const hidden = (maddie: { x: number; y: number }, fae: { x: number; y: number }) =>
      hiddenFraction(maddie, maddieBox, fae, faeBox);
    expect(hidden({ x: 552, y: 404 }, { x: 500, y: 410 })).toBe(0);
    expect(hidden({ x: 500, y: 350 }, { x: 500, y: 410 })).toBeCloseTo(1);
    expect(hidden({ x: 500, y: 420 }, { x: 500, y: 410 })).toBe(0);
  });

  it("validates all area connections with the tunable radius", () => {
    expect(areaConnectionErrors(world.areas, world.tunables, world.critters, world.party))
      .toEqual([]);
  });

  it("places every spawn slot beside Fae without hiding Maddie", () => {
    for (const area of Object.values(world.areas)) {
      for (const spawn of Object.values(area.spawns)) {
        const slot = partySlots(area, spawn, world.tunables.follow, [maddie])[0]?.slot;
        if (slot === undefined) throw new Error(`${area.id}: slot missing`);
        expect(hiddenFraction(slot, maddieBox, spawn, faeBox)).toBe(0);
      }
    }
  });

  it("flags the hiding corridor behind a bed whose footprint is only its front", () => {
    const bedroom = world.areas.bedroom;
    const bed = bedroom?.props.find((prop) => prop.id === "bed");
    const state = bed?.states.default;
    if (bedroom === undefined || bed === undefined || state === undefined)
      throw new Error("the bedroom's bed missing");
    // The first Milestone 5 bed blocker was a thin band along the bed's front,
    // leaving a corridor behind the bed where its picture covered Fae. The
    // same band as the bed prop's footprint must fail the hiding check.
    const points = state.footprint.flat();
    const xs = points.map(([x]) => x);
    const front = Math.max(...points.map(([, y]) => y));
    const band: Polygon[] = [[[Math.min(...xs), front - 30], [Math.max(...xs), front - 30],
      [Math.max(...xs), front], [Math.min(...xs), front]]];
    const { left, step: width, columns } = state.silhouette;
    const thin = { ...bed, states: { ...bed.states, default: { ...state, footprint: band,
      front: frontEdge(band, left, width, columns.length, bed.y) } } };
    const corridor = { ...bedroom,
      props: bedroom.props.map((prop) => prop.id === "bed" ? thin : prop) };
    const hidden = hiddenPositions(corridor, world.tunables.playerRadius);
    expect(hidden.filter((position) => position.by.includes("bed")).length).toBeGreaterThan(0);
  });
});
