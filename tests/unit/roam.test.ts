import { describe, expect, it } from "vitest";
import {
  blankInput,
  createState,
  distanceToPolygon,
  pointInPolygon,
  stableHash,
  step,
  targetInteractable,
  battleCommands,
  type ActionFrame,
  type Area,
  type Point,
  type State,
  type World,
} from "../../src/core";
import { loadContent } from "../../src/content/load";

// Contract for roaming critters (Milestone 21; recurring since Milestone 28),
// EarthBound-style: a den's critter wanders near the den and, in chaos, comes
// after Fae when she's within sight, a little slower than she walks. Touching
// starts a battle. After Fae runs away it leaves her alone for a while and
// wanders home. A calm critter stays put, a Talk target where it stands.
// Roamers hold still while Fae is busy (talking, battling, a door, the
// journal), and they start at their den whenever Fae arrives in their area.

const content = loadContent();
const base = content.world;
const press = (frame: Partial<ActionFrame>): ActionFrame => ({ ...blankInput(), ...frame });
const distance = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);

const home = { x: 600, y: 900 };
const roamRadius = 150;

function harnessWithDen(): World {
  const harness = base.areas["harness"];
  if (harness === undefined) throw new Error("no harness");
  const area: Area = {
    ...harness,
    recurring: { dens: [{ point: home, radius: roamRadius, kinds: ["frog"], chance: 1 }] },
  };
  return { ...base, areas: { ...base.areas, harness: area } };
}
const world = harnessWithDen();
const tune = world.tunables.roam;
const touch = world.critters["frog"]?.touchRadius ?? 0;
const walkPerTick = world.tunables.walkSpeed / 60;

function start(fae: Point, mood: "chaos" | "calm" = "chaos"): State {
  const state = createState(world, { area: "harness", spawn: "start", seed: 7 });
  return { ...state, player: fae, wild: state.wild.map((critter) => ({ ...critter, mood })) };
}

function roamer(state: State): Point {
  const spot = state.wild[0];
  if (spot === undefined) throw new Error("the frog isn't out");
  return { x: spot.x, y: spot.y };
}

function visitHome(state: State): Point {
  const spot = state.wild[0];
  if (spot === undefined) throw new Error("the frog isn't out");
  return spot.home ?? home;
}

function onFloor(point: Point, radius = world.tunables.follow.radius): boolean {
  const area = world.areas["harness"];
  if (area === undefined) throw new Error("no harness");
  const clear = radius - 0.01;
  if (!pointInPolygon(point, area.walkable) || distanceToPolygon(point, area.walkable) < clear)
    return false;
  return area.blockers.every(
    (blocker) => !pointInPolygon(point, blocker) && distanceToPolygon(point, blocker) >= clear,
  );
}

function openOffset(
  origin: Point,
  gap: number,
  runway = gap,
): { point: Point; away: Point; toward: "up" | "down" | "left" | "right" } {
  const dirs: readonly { dx: number; dy: number; toward: "up" | "down" | "left" | "right" }[] = [
    { dx: 1, dy: 0, toward: "left" },
    { dx: -1, dy: 0, toward: "right" },
    { dx: 0, dy: 1, toward: "up" },
    { dx: 0, dy: -1, toward: "down" },
  ];
  const radius = world.tunables.playerRadius;
  for (const dir of dirs) {
    let ok = true;
    for (let stepDist = 20; stepDist <= runway; stepDist += 20) {
      const sample = { x: origin.x + dir.dx * stepDist, y: origin.y + dir.dy * stepDist };
      if (!onFloor(sample, radius)) {
        ok = false;
        break;
      }
    }
    if (ok) {
      return {
        point: { x: origin.x + dir.dx * gap, y: origin.y + dir.dy * gap },
        away: { x: dir.dx, y: dir.dy },
        toward: dir.toward,
      };
    }
  }
  throw new Error(`no open offset from (${origin.x}, ${origin.y})`);
}

function farCorner(origin: Point): Point {
  const corners: Point[] = [
    { x: 1800, y: 200 },
    { x: 200, y: 200 },
    { x: 1800, y: 900 },
    { x: 200, y: 900 },
  ];
  let best = corners[0]!;
  for (const corner of corners) {
    if (distance(origin, corner) > distance(origin, best)) best = corner;
  }
  return best;
}

describe("a roaming critter", () => {
  it("has slower-than-Fae speeds", () => {
    expect(tune.chaseSpeed).toBeLessThan(walkPerTick);
    expect(tune.wanderSpeed).toBeLessThan(tune.chaseSpeed);
    expect(tune.sight).toBeGreaterThan(touch);
  });

  it("starts at its visit home and wanders near it, on the floor, while Fae is far away", () => {
    const initial = createState(world, { area: "harness", spawn: "start", seed: 7 });
    const anchor = visitHome(initial);
    let state = start(farCorner(anchor));
    expect(roamer(state)).toEqual(anchor);
    expect(onFloor(anchor)).toBe(true);
    let moved = 0;
    let previous = roamer(state);
    for (let tick = 0; tick < 900; tick += 1) {
      state = step(world, state, blankInput()).state;
      const spot = roamer(state);
      expect(distance(spot, anchor), `tick ${tick}`).toBeLessThanOrEqual(roamRadius + 1e-6);
      expect(onFloor(spot), `tick ${tick}`).toBe(true);
      const stepped = distance(spot, previous);
      expect(stepped).toBeLessThanOrEqual(tune.wanderSpeed + 1e-9);
      moved += stepped;
      previous = spot;
    }
    expect(moved).toBeGreaterThan(100);
    expect(state.battle).toBeNull();
  });

  it("comes after Fae when she's within sight, and touching starts a battle", () => {
    const initial = createState(world, { area: "harness", spawn: "start", seed: 7 });
    const offset = openOffset(roamer(initial), 140);
    let state = start(offset.point);
    let previous = roamer(state);
    for (let tick = 0; tick < 200 && state.battle === null; tick += 1) {
      state = step(world, state, blankInput()).state;
      if (state.battle !== null) break;
      expect(distance(roamer(state), previous)).toBeLessThanOrEqual(tune.chaseSpeed + 1e-9);
      previous = roamer(state);
    }
    expect(state.battle).toMatchObject({ critterId: "frog", den: 0 });
  });

  it("can't catch Fae when she walks away", () => {
    const initial = createState(world, { area: "harness", spawn: "start", seed: 7 });
    const offset = openOffset(roamer(initial), 140, 500);
    let state = start(offset.point);
    for (let tick = 0; tick < 240; tick += 1)
      state = step(world, state, press({ move: offset.away })).state;
    expect(state.battle).toBeNull();
  });

  it("leaves Fae alone for a while after she runs, and wanders home", () => {
    const initial = createState(world, { area: "harness", spawn: "start", seed: 7 });
    const anchor = visitHome(initial);
    const offset = openOffset(anchor, 120);
    let state = start(offset.point);
    for (let tick = 0; tick < 200 && state.battle === null; tick += 1)
      state = step(world, state, blankInput()).state;
    if (state.battle === null) throw new Error("no battle");
    // Through the intro to the command menu, its question fully shown.
    for (let tick = 0; tick < 400; tick += 1) {
      const battle = state.battle;
      if (battle?.phase === "command" && battle.revealed >= battle.message.length) break;
      state = step(world, state, press({ confirm: tick % 2 === 0 })).state;
    }
    const run = battleCommands(world, state).findIndex((command) => command.id === "run");
    state = step(world, state, blankInput()).state;
    state = step(world, state, press({ choose: run })).state;
    expect(state.battle?.phase, "Run was chosen").toBe("run");
    for (let tick = 0; tick < 400 && state.battle !== null; tick += 1)
      state = step(world, state, press({ confirm: tick % 2 === 0 })).state;
    expect(state.battle).toBeNull();
    expect(state.transition, "she ran; she didn't faint").toBeNull();
    const away = distance(roamer(state), anchor);
    for (let tick = 0; tick < tune.cooldownTicks - 10; tick += 1) {
      state = step(world, state, blankInput()).state;
      expect(state.battle, `tick ${tick}`).toBeNull();
    }
    expect(distance(roamer(state), anchor)).toBeLessThan(Math.max(away, 1));
  });

  it("holds still while the journal is open", () => {
    const initial = createState(world, { area: "harness", spawn: "start", seed: 7 });
    const offset = openOffset(roamer(initial), 140);
    let state = start(offset.point);
    state = { ...state, journalOpen: true };
    const before = roamer(state);
    for (let tick = 0; tick < 60; tick += 1) state = step(world, state, blankInput()).state;
    expect(roamer(state)).toEqual(before);
  });

  it("stays put once calm, a Talk target where it stands", () => {
    const initial = createState(world, { area: "harness", spawn: "start", seed: 7 });
    const anchor = visitHome(initial);
    const offset = openOffset(anchor, 45);
    let state = start(offset.point, "calm");
    state = { ...state, facing: offset.toward };
    for (let tick = 0; tick < 120; tick += 1) state = step(world, state, blankInput()).state;
    expect(roamer(state)).toEqual(anchor);
    expect(targetInteractable(world, state)?.id).toBe("critter:wild:0");
  });

  it("is deterministic", () => {
    const run = (): string => {
      let state = start({ x: 1800, y: 200 });
      for (let tick = 0; tick < 600; tick += 1)
        state = step(world, state, press({ move: { x: tick % 200 < 100 ? -1 : 1, y: 0 } })).state;
      return stableHash(state);
    };
    expect(run()).toBe(run());
  });
});

describe("set pieces", () => {
  it("stand still: the plaza's fountain frog never roams", () => {
    let state = createState(base, { area: "plaza", spawn: "fountain", seed: 1 });
    expect(state.wild, "the plaza is quiet until the fountain frog is calm").toEqual([]);
    for (let tick = 0; tick < 120; tick += 1) state = step(base, state, blankInput()).state;
    expect(state.critters["fountain-frog"]).toBe("chaos");
    expect(state.wild).toEqual([]);
  });
});
