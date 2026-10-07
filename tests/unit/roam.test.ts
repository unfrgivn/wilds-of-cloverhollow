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

// Contract for roaming critters (Milestone 23), EarthBound-style: a critter
// with `roam` wanders near its home point and, in chaos, comes after Fae when
// she's within sight, a little slower than she walks. Touching starts a battle.
// After Fae runs away it leaves her alone for a while and wanders home. A calm
// critter stays put, a Talk target where it stands. Roamers hold still while
// Fae is busy (talking, battling, a door, the journal), and they start at home
// whenever Fae arrives in their area.

const content = loadContent();
const base = content.world;
const press = (frame: Partial<ActionFrame>): ActionFrame => ({ ...blankInput(), ...frame });
const distance = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);

const home = { x: 600, y: 900 };
const roamRadius = 150;

function harnessWithRoamer(): World {
  const harness = base.areas["harness"];
  if (harness === undefined) throw new Error("no harness");
  const critters: Area["critters"] = [{ id: "frog", point: home, roam: { radius: roamRadius } }];
  const area: Area = { ...harness, critters };
  return { ...base, areas: { ...base.areas, harness: area } };
}
const world = harnessWithRoamer();
const tune = world.tunables.roam;
const touch = world.critters["frog"]?.touchRadius ?? 0;
const walkPerTick = world.tunables.walkSpeed / 60;

function start(fae: Point, critter: "chaos" | "calm" = "chaos"): State {
  const state = createState(world, { area: "harness", spawn: "start", seed: 7 });
  return { ...state, player: fae, critters: { ...state.critters, frog: critter } };
}

function roamer(state: State): Point {
  const spot = state.roamers["frog"];
  if (spot === undefined) throw new Error("the frog isn't roaming");
  return { x: spot.x, y: spot.y };
}

function onFloor(point: Point): boolean {
  const area = world.areas["harness"];
  if (area === undefined) throw new Error("no harness");
  const clear = world.tunables.follow.radius - 0.01;
  if (!pointInPolygon(point, area.walkable) || distanceToPolygon(point, area.walkable) < clear)
    return false;
  return area.blockers.every(
    (blocker) => !pointInPolygon(point, blocker) && distanceToPolygon(point, blocker) >= clear,
  );
}

describe("a roaming critter", () => {
  it("has slower-than-Fae speeds", () => {
    expect(tune.chaseSpeed).toBeLessThan(walkPerTick);
    expect(tune.wanderSpeed).toBeLessThan(tune.chaseSpeed);
    expect(tune.sight).toBeGreaterThan(touch);
  });

  it("starts at home and wanders near it, on the floor, while Fae is far away", () => {
    let state = start({ x: 1800, y: 200 });
    expect(roamer(state)).toEqual(home);
    let moved = 0;
    let previous = roamer(state);
    for (let tick = 0; tick < 900; tick += 1) {
      state = step(world, state, blankInput()).state;
      const spot = roamer(state);
      expect(distance(spot, home), `tick ${tick}`).toBeLessThanOrEqual(roamRadius + 1e-6);
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
    let state = start({ x: home.x + 180, y: home.y });
    let previous = roamer(state);
    for (let tick = 0; tick < 200 && state.battle === null; tick += 1) {
      state = step(world, state, blankInput()).state;
      if (state.battle !== null) break;
      expect(distance(roamer(state), previous)).toBeLessThanOrEqual(tune.chaseSpeed + 1e-9);
      previous = roamer(state);
    }
    expect(state.battle?.critterId).toBe("frog");
  });

  it("can't catch Fae when she walks away", () => {
    let state = start({ x: home.x + 160, y: home.y });
    for (let tick = 0; tick < 240; tick += 1)
      state = step(world, state, press({ move: { x: 1, y: 0 } })).state;
    expect(state.battle).toBeNull();
  });

  it("leaves Fae alone for a while after she runs, and wanders home", () => {
    let state = start({ x: home.x + 120, y: home.y });
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
    const away = distance(roamer(state), home);
    for (let tick = 0; tick < tune.cooldownTicks - 10; tick += 1) {
      state = step(world, state, blankInput()).state;
      expect(state.battle, `tick ${tick}`).toBeNull();
    }
    expect(distance(roamer(state), home)).toBeLessThan(Math.max(away, 1));
  });

  it("holds still while the journal is open", () => {
    let state = start({ x: home.x + 180, y: home.y });
    state = { ...state, journalOpen: true };
    const before = roamer(state);
    for (let tick = 0; tick < 60; tick += 1) state = step(world, state, blankInput()).state;
    expect(roamer(state)).toEqual(before);
  });

  it("stays put once calm, a Talk target where it stands", () => {
    let state = start({ x: home.x, y: home.y + 45 }, "calm");
    state = { ...state, facing: "up" };
    for (let tick = 0; tick < 120; tick += 1) state = step(world, state, blankInput()).state;
    expect(roamer(state)).toEqual(home);
    expect(targetInteractable(world, state)?.id).toBe("critter:frog");
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

describe("critters without roam", () => {
  it("don't roam: every shipped area keeps its critters still", () => {
    const state = createState(base, { area: "plaza", spawn: "fountain", seed: 1 });
    expect(state.roamers).toEqual({});
  });
});
