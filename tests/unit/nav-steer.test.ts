import { describe, expect, it } from "vitest";
import { loadContent } from "../../src/content/load";
import {
  blankInput,
  createState,
  distance,
  pointInPolygon,
  step,
  validResolved,
  type Area,
  type Point,
  type Polygon,
  type State,
  type World,
} from "../../src/core";
import { screenToWorld, worldToScreen } from "../../src/render/camera";
import { createNavPathFollower, mergeNavSteerInput } from "../../src/shell/nav-steer";
import {
  bindOverworldPointerSteer,
  type OverworldPointerEvent,
  type OverworldPointerTarget,
} from "../../src/shell/overworld-pointer";

function rect(x0: number, y0: number, x1: number, y1: number): Polygon {
  return [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
  ];
}

function makeTestArea(overrides: Partial<Area> = {}): Area {
  return {
    id: "nav-arena",
    name: "Nav Arena",
    width: 500,
    height: 300,
    walkable: rect(0, 0, 500, 300),
    blockers: [],
    glows: [],
    triggers: [],
    interactables: [],
    critters: [],
    npcs: [],
    props: [],
    atlases: [],
    spawns: { start: { x: 70, y: 150, facing: "right" } },
    ...overrides,
  };
}

function makeTestWorld(
  area: Area,
  storyVars: Record<string, boolean> = {},
): { world: World; state: State } {
  const { world: baseWorld } = loadContent();
  const world: World = {
    ...baseWorld,
    areas: { ...baseWorld.areas, [area.id]: area },
    storyVariable: (_ink, name) => storyVars[name] ?? false,
  };
  const state = createState(world, { area: area.id, spawn: "start" }, 1);
  return { world, state };
}

function createFakeCanvas(): {
  canvas: OverworldPointerTarget;
  emit: (type: string, event: OverworldPointerEvent) => void;
} {
  const listeners: Record<string, ((event: OverworldPointerEvent) => void)[]> = {};
  const canvas: OverworldPointerTarget = {
    addEventListener: (type, listener) => {
      const bucket = listeners[type] ?? [];
      bucket.push(listener);
      listeners[type] = bucket;
    },
    setPointerCapture: () => undefined,
  };
  const emit = (type: string, event: OverworldPointerEvent): void => {
    for (const listener of listeners[type] ?? []) listener(event);
  };
  return { canvas, emit };
}

function makePointerEvent(
  overrides: Partial<OverworldPointerEvent> = {},
): OverworldPointerEvent {
  return {
    pointerId: 1,
    pointerType: "mouse",
    button: 0,
    clientX: 0,
    clientY: 0,
    preventDefault: () => undefined,
    ...overrides,
  };
}

describe("createNavPathFollower", () => {
  it("navigates around a central blocker, reaches the goal, and clears automatically", () => {
    const obstacle = rect(210, 100, 290, 200);
    const area = makeTestArea({ blockers: [obstacle] });
    const { world, state: initial } = makeTestWorld(area);
    const follower = createNavPathFollower(world);
    const goal: Point = { x: 430, y: 150 };

    expect(follower.setTarget(initial, goal)).toBe(true);
    const snap = follower.snapshot();
    expect(snap).not.toBeNull();
    expect(snap?.area).toBe(area.id);
    expect(snap?.goal).toEqual(goal);
    expect((snap?.waypoints.length ?? 0)).toBeGreaterThan(1);

    let state = initial;
    let ticks = 0;
    const radius = world.tunables.playerRadius;

    while (follower.snapshot() !== null && ticks < 300) {
      const move = follower.stepMove(state);
      if (move.x === 0 && move.y === 0) break;
      state = step(world, state, { ...blankInput(), move }).state;
      expect(validResolved(state.player, area, radius)).toBe(true);
      expect(pointInPolygon(state.player, obstacle)).toBe(false);
      ticks += 1;
    }

    expect(follower.snapshot()).toBeNull();
    expect(distance(state.player, goal)).toBeLessThanOrEqual(8.5);
    expect(ticks).toBeLessThan(300);
  });

  it("ramps speed smoothly inside the final 18 units of the final waypoint", () => {
    const area = makeTestArea();
    const { world, state: initial } = makeTestWorld(area);
    const follower = createNavPathFollower(world);
    const goal: Point = { x: 200, y: 150 };

    expect(follower.setTarget(initial, goal)).toBe(true);
    // Far from goal (> 18 units): full magnitude 1.
    const farMove = follower.stepMove(initial);
    expect(Math.hypot(farMove.x, farMove.y)).toBeCloseTo(1, 5);

    // 13 units from goal (inside final 18 units): smoothly scaled in [0.45..1.0].
    const nearState: State = { ...initial, player: { x: 187, y: 150 } };
    const nearMove = follower.stepMove(nearState);
    const nearMag = Math.hypot(nearMove.x, nearMove.y);
    expect(nearMag).toBeGreaterThanOrEqual(0.45);
    expect(nearMag).toBeLessThan(1);

    // Inside stop radius (<= 8 units): clears path and stops.
    const arrivedState: State = { ...initial, player: { x: 193, y: 150 } };
    expect(follower.stepMove(arrivedState)).toEqual({ x: 0, y: 0 });
    expect(follower.snapshot()).toBeNull();
  });

  it("reuses cached NavField and rebuilds when a crossing opens", () => {
    const vars: Record<string, boolean> = { bridge_open: false };
    const area = makeTestArea({
      crossings: [{ id: "bridge", polygon: rect(230, 0, 270, 300), opens: "bridge_open" }],
    });
    const { world, state } = makeTestWorld(area, vars);
    const follower = createNavPathFollower(world);

    const field1 = follower.getField(state);
    const field2 = follower.getField(state);
    expect(field1).not.toBeNull();
    expect(field2).toBe(field1);
    expect(follower.setTarget(state, { x: 420, y: 150 })).toBe(false);

    vars.bridge_open = true;
    const field3 = follower.getField(state);
    expect(field3).not.toBeNull();
    expect(field3).not.toBe(field1);
    expect(follower.setTarget(state, { x: 420, y: 150 })).toBe(true);
  });

  it("cancels active path on area, dialogue, battle, or transition changes", () => {
    const area = makeTestArea();
    const { world, state } = makeTestWorld(area);
    const follower = createNavPathFollower(world);

    const checkCancels = (mutated: State): void => {
      expect(follower.setTarget(state, { x: 380, y: 150 })).toBe(true);
      expect(follower.stepMove(mutated)).toEqual({ x: 0, y: 0 });
      expect(follower.snapshot()).toBeNull();
    };

    checkCancels({ ...state, area: "plaza" });
    checkCancels({
      ...state,
      dialogue: {
        knot: "intro",
        speaker: "Mom",
        text: "Hi!",
        revealed: 3,
        choices: [],
        selected: 0,
        ended: false,
      },
    });
    checkCancels({
      ...state,
      transition: { target: { area: "plaza", spawn: "start" }, phase: "out", elapsed: 1 },
    });
    checkCancels({ ...state, finale: "credits" });
    checkCancels({
      ...state,
      battle: {
        critterId: "frog",
        den: null,
        entry: { x: 70, y: 150 },
        phase: "intro",
        message: "",
        revealed: 0,
        selected: 0,
        command: null,
        energy: 10,
        calm: 0,
        rest: {},
        check: null,
        lastGrade: null,
        feelings: [],
        answered: false,
        lanternPeek: false,
        turn: 1,
        windUp: null,
        rewardSticker: null,
        phaseTicks: 0,
      },
    });
  });

  it("clears active path after 24 stalled ticks without progress", () => {
    const area = makeTestArea();
    const { world, state } = makeTestWorld(area);
    const follower = createNavPathFollower(world);

    expect(follower.setTarget(state, { x: 400, y: 150 })).toBe(true);
    for (let tick = 0; tick < 23; tick += 1) {
      const move = follower.stepMove(state);
      expect(move.x).toBeGreaterThan(0);
      expect(follower.snapshot()).not.toBeNull();
    }
    // 24th consecutive stalled tick cancels path cleanly.
    expect(follower.stepMove(state)).toEqual({ x: 0, y: 0 });
    expect(follower.snapshot()).toBeNull();
  });

  it("mergeNavSteerInput yields to manual input, buttons, pointer hold, or blocked steer", () => {
    const area = makeTestArea();
    const { world, state } = makeTestWorld(area);
    const follower = createNavPathFollower(world);

    expect(follower.setTarget(state, { x: 400, y: 150 })).toBe(true);
    const steered = mergeNavSteerInput(blankInput(), false, true, follower, state);
    expect(steered.move.x).toBeGreaterThan(0.9);

    // Manual directional input clears path.
    const manual = { ...blankInput(), move: { x: -1, y: 0 } };
    expect(mergeNavSteerInput(manual, false, true, follower, state).move).toEqual({ x: -1, y: 0 });
    expect(follower.snapshot()).toBeNull();

    // Button press clears path.
    expect(follower.setTarget(state, { x: 400, y: 150 })).toBe(true);
    mergeNavSteerInput({ ...blankInput(), confirm: true }, false, true, follower, state);
    expect(follower.snapshot()).toBeNull();

    // Active pointer hold clears path.
    expect(follower.setTarget(state, { x: 400, y: 150 })).toBe(true);
    mergeNavSteerInput(blankInput(), true, true, follower, state);
    expect(follower.snapshot()).toBeNull();

    // Disallowed steering clears path.
    expect(follower.setTarget(state, { x: 400, y: 150 })).toBe(true);
    mergeNavSteerInput(blankInput(), false, false, follower, state);
    expect(follower.snapshot()).toBeNull();
  });
});

describe("overworld-pointer onTapGround and camera screenToWorld", () => {
  it("fires onTapGround for crisp far clicks and onTapNearPlayer for near clicks", () => {
    const { canvas, emit } = createFakeCanvas();
    let clock = 1000;
    let allowSteer = true;
    let player: Point | null = { x: 640, y: 360 };
    let nearTaps = 0;
    const groundTaps: Point[] = [];

    bindOverworldPointerSteer({
      canvas,
      canSteer: () => allowSteer,
      playerScreen: () => player,
      onMove: () => undefined,
      onTapNearPlayer: () => {
        nearTaps += 1;
      },
      onTapGround: (pt) => {
        groundTaps.push(pt);
      },
      now: () => clock,
    });

    // Click inside nearPlayerRadius (<= 96px): fires onTapNearPlayer, NOT onTapGround.
    emit("pointerdown", makePointerEvent({ pointerId: 1, clientX: 660, clientY: 380 }));
    clock += 60;
    emit("pointerup", makePointerEvent({ pointerId: 1, clientX: 664, clientY: 382 }));
    expect(nearTaps).toBe(1);
    expect(groundTaps).toEqual([]);

    // Crisp click outside nearPlayerRadius (> 96px): fires onTapGround, NOT onTapNearPlayer.
    emit("pointerdown", makePointerEvent({ pointerId: 2, clientX: 900, clientY: 420 }));
    clock += 70;
    emit("pointerup", makePointerEvent({ pointerId: 2, clientX: 904, clientY: 423 }));
    expect(nearTaps).toBe(1);
    expect(groundTaps).toEqual([{ x: 904, y: 423 }]);

    // Long hold (> 260ms) far from player does NOT fire onTapGround.
    emit("pointerdown", makePointerEvent({ pointerId: 3, clientX: 900, clientY: 420 }));
    clock += 350;
    emit("pointerup", makePointerEvent({ pointerId: 3, clientX: 900, clientY: 420 }));
    expect(groundTaps).toHaveLength(1);

    // Dragged gesture (> 12px) far from player does NOT fire onTapGround.
    emit("pointerdown", makePointerEvent({ pointerId: 4, clientX: 900, clientY: 420 }));
    clock += 50;
    emit("pointermove", makePointerEvent({ pointerId: 4, clientX: 925, clientY: 420 }));
    emit("pointerup", makePointerEvent({ pointerId: 4, clientX: 925, clientY: 420 }));
    expect(groundTaps).toHaveLength(1);

    // Null playerScreen does NOT fire onTapGround.
    player = null;
    emit("pointerdown", makePointerEvent({ pointerId: 5, clientX: 900, clientY: 420 }));
    clock += 40;
    emit("pointerup", makePointerEvent({ pointerId: 5, clientX: 900, clientY: 420 }));
    expect(groundTaps).toHaveLength(1);

    // Disallowed steering before pointerup does NOT fire onTapGround.
    player = { x: 640, y: 360 };
    emit("pointerdown", makePointerEvent({ pointerId: 6, clientX: 900, clientY: 420 }));
    clock += 40;
    allowSteer = false;
    emit("pointerup", makePointerEvent({ pointerId: 6, clientX: 900, clientY: 420 }));
    expect(groundTaps).toHaveLength(1);
  });

  it("screenToWorld is the exact inverse of worldToScreen", () => {
    const camera: Point = { x: 145, y: 82 };
    const worldPt: Point = { x: 512.5, y: 344.25 };
    const screenPt = worldToScreen(worldPt, camera, 1280, 720, 1440, 900);
    const roundTrip = screenToWorld(screenPt, camera, 1280, 720, 1440, 900);
    expect(roundTrip.x).toBeCloseTo(worldPt.x, 6);
    expect(roundTrip.y).toBeCloseTo(worldPt.y, 6);
  });
});
