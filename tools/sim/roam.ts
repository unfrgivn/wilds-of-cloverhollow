import {
  blankInput,
  createState,
  distanceToPolygon,
  pointInPolygon,
  stableHash,
  step,
  type ActionFrame,
  type Area,
  type Point,
  type World,
} from "../../src/core";
import { loadContent } from "../../src/content/load";

const base = loadContent().world;
const harness = base.areas.harness;
if (harness === undefined) throw new Error("missing harness");
const home = { x: 600, y: 900 };
const world: World = {
  ...base,
  areas: {
    ...base.areas,
    harness: {
      ...harness,
      critters: [{ id: "frog", point: home, roam: { radius: 150 } }],
    },
  },
};
const press = (frame: Partial<ActionFrame>): ActionFrame => ({
  ...blankInput(),
  ...frame,
});
const valid = (point: Point, area: Area): boolean => {
  const radius = world.tunables.follow.radius - 0.01;
  return pointInPolygon(point, area.walkable) &&
    distanceToPolygon(point, area.walkable) >= radius &&
    area.blockers.every((blocker) =>
      !pointInPolygon(point, blocker) && distanceToPolygon(point, blocker) >= radius,
    );
};

const scripted = (): string => {
  let state = createState(world, { area: "harness", spawn: "start", seed: 7 });
  state = { ...state, player: { x: home.x + 120, y: home.y } };
  for (let tick = 0; tick < 200 && state.battle === null; tick += 1)
    state = step(world, state, blankInput()).state;
  if (state.battle === null) throw new Error("roamer did not start a battle");
  for (let tick = 0; tick < 400 && state.battle?.phase !== "command"; tick += 1)
    state = step(world, state, press({ confirm: tick % 2 === 0 })).state;
  const run = state.battle === null ? -1 : state.battle.selected + 3;
  state = step(world, state, blankInput()).state;
  state = step(world, state, press({ choose: run })).state;
  for (let tick = 0; tick < 400 && state.battle !== null; tick += 1)
    state = step(world, state, press({ confirm: tick % 2 === 0 })).state;
  if (state.battle !== null) throw new Error("roamer battle did not end");
  for (let tick = 0; tick < world.tunables.roam.cooldownTicks; tick += 1) {
    state = step(world, state, blankInput()).state;
    const area = world.areas[state.area];
    const roamer = state.roamers.frog;
    if (area === undefined || roamer === undefined || !valid(roamer, area))
      throw new Error(`roamer left floor at tick ${state.tick}`);
    if (state.battle !== null) throw new Error("roamer ignored cooldown");
  }
  return stableHash(state);
};

const first = scripted();
const second = scripted();
if (first !== second) throw new Error(`roam sim is not deterministic: ${first} != ${second}`);
console.log(`roam: ticked battle, run, cooldown, floor, deterministic (${first})`);
