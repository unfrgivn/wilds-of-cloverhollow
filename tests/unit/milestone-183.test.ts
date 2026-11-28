import { describe, expect, it } from "vitest";
import { loadContent } from "../../src/content/load";
import { createState, type Point, type State } from "../../src/core";
import { findPettableCompanion, findRestSpot } from "../../src/render/companions";
import {
  bindOverworldPointerSteer,
  DEFAULT_OVERWORLD_TAP_PLAYER_TRAVEL,
  isOverworldGroundTap,
  type OverworldPointerEvent,
  type OverworldPointerTarget,
} from "../../src/shell/overworld-pointer";

const { world, fixtures } = loadContent();

function stateFromFixture(name: string, overrides: Partial<State> = {}): State {
  const fixture = fixtures[name];
  if (fixture === undefined) throw new Error(`Missing fixture ${name}`);
  return { ...createState(world, fixture, 1), ...overrides };
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

describe("Milestone 183: isOverworldGroundTap hold-steer release guard", () => {
  it("accepts quick open-ground taps with zero or small player travel", () => {
    const downPlayer: Point = { x: 640, y: 360 };
    const upPlayerSame: Point = { x: 640, y: 360 };
    const upPlayerSmall: Point = { x: 656, y: 360 };
    const downPoint: Point = { x: 920, y: 420 };
    const upPoint: Point = { x: 924, y: 422 };

    expect(isOverworldGroundTap(downPoint, upPoint, 80, downPlayer, upPlayerSame)).toBe(true);
    expect(isOverworldGroundTap(downPoint, upPoint, 110, downPlayer, upPlayerSmall)).toBe(true);
    expect(DEFAULT_OVERWORLD_TAP_PLAYER_TRAVEL).toBe(20);
  });

  it("rejects releases when hold-steering already moved Fae past maxPlayerTravel", () => {
    const downPlayer: Point = { x: 640, y: 360 };
    const upPlayerMoved: Point = { x: 665, y: 360 };
    const point: Point = { x: 960, y: 360 };

    expect(isOverworldGroundTap(point, point, 180, downPlayer, upPlayerMoved)).toBe(false);
    expect(
      isOverworldGroundTap(point, point, 180, downPlayer, { x: 650, y: 360 }, {
        maxPlayerTravel: 8,
      }),
    ).toBe(false);
  });

  it("rejects near-player taps, drags, long holds, invalid timings, and null player points", () => {
    const player: Point = { x: 640, y: 360 };
    const farDown: Point = { x: 920, y: 420 };
    const nearPoint: Point = { x: 670, y: 375 };

    // Near-player tap belongs to pet/rest, never ground pathing.
    expect(isOverworldGroundTap(nearPoint, nearPoint, 70, player, player)).toBe(false);
    // Dragged past 12 px.
    expect(isOverworldGroundTap(farDown, { x: 940, y: 420 }, 60, player, player)).toBe(false);
    // Held past 260 ms.
    expect(isOverworldGroundTap(farDown, farDown, 280, player, player)).toBe(false);
    // Invalid elapsed times.
    expect(isOverworldGroundTap(farDown, farDown, -1, player, player)).toBe(false);
    expect(isOverworldGroundTap(farDown, farDown, Number.NaN, player, player)).toBe(false);
    // Null player anchors.
    expect(isOverworldGroundTap(farDown, farDown, 60, null, player)).toBe(false);
    expect(isOverworldGroundTap(farDown, farDown, 60, player, null)).toBe(false);
  });

  it("suppresses onTapGround in bindOverworldPointerSteer after screen or world hold-steer", () => {
    const { canvas, emit } = createFakeCanvas();
    let clock = 1000;
    let screenPlayer: Point = { x: 640, y: 360 };
    let worldPlayer: Point = { x: 500, y: 410 };
    const groundTaps: Point[] = [];

    bindOverworldPointerSteer({
      canvas,
      canSteer: () => true,
      playerScreen: () => screenPlayer,
      playerWorld: () => worldPlayer,
      onMove: () => undefined,
      onTapGround: (pt) => {
        groundTaps.push(pt);
      },
      now: () => clock,
    });

    // Hold-steer in a small room (screen anchor moves > 20 px within 200 ms): no ground tap!
    emit("pointerdown", makePointerEvent({ pointerId: 1, clientX: 1000, clientY: 360 }));
    clock += 190;
    screenPlayer = { x: 720, y: 360 };
    worldPlayer = { x: 580, y: 410 };
    emit("pointerup", makePointerEvent({ pointerId: 1, clientX: 1000, clientY: 360 }));
    expect(groundTaps).toEqual([]);

    // Hold-steer in a scrolling area (camera tracks Fae so screen stays fixed, world moves > 20 u):
    screenPlayer = { x: 640, y: 360 };
    worldPlayer = { x: 900, y: 550 };
    emit("pointerdown", makePointerEvent({ pointerId: 2, clientX: 1000, clientY: 360 }));
    clock += 180;
    worldPlayer = { x: 964, y: 550 };
    emit("pointerup", makePointerEvent({ pointerId: 2, clientX: 1000, clientY: 360 }));
    expect(groundTaps).toEqual([]);

    // Crisp ground tap with <= 20 px/u travel still fires onTapGround cleanly.
    emit("pointerdown", makePointerEvent({ pointerId: 3, clientX: 960, clientY: 420 }));
    clock += 60;
    worldPlayer = { x: 972, y: 550 };
    emit("pointerup", makePointerEvent({ pointerId: 3, clientX: 962, clientY: 421 }));
    expect(groundTaps).toEqual([{ x: 962, y: 421 }]);
  });
});

describe("Milestone 183: full-party pettable companion reach & rest spot priority", () => {
  it("keeps 0-human pet reach strictly unchanged at 78u front and 56u close", () => {
    const base = stateFromFixture("plaza");
    const maddie = base.party.find((member) => member.id === "maddie");
    if (maddie === undefined) throw new Error("Missing maddie in plaza fixture");
    const player: Point = { x: 1000, y: 550 };

    const frontIn: State = {
      ...base,
      player,
      facing: "left",
      party: [{ ...maddie, x: 922, y: 550 }],
    };
    const frontOut: State = {
      ...base,
      player,
      facing: "left",
      party: [{ ...maddie, x: 921, y: 550 }],
    };
    const closeIn: State = {
      ...base,
      player,
      facing: "right",
      party: [{ ...maddie, x: 944, y: 550 }],
    };
    const closeOut: State = {
      ...base,
      player,
      facing: "right",
      party: [{ ...maddie, x: 943, y: 550 }],
    };

    expect(findPettableCompanion(world, frontIn)?.id).toBe("maddie");
    expect(findPettableCompanion(world, frontOut)).toBeNull();
    expect(findPettableCompanion(world, closeIn)?.id).toBe("maddie");
    expect(findPettableCompanion(world, closeOut)).toBeNull();
  });

  it("lets Fae pet Maddie behind 1 human companion in plaza-party", () => {
    const state = stateFromFixture("plaza-party");
    expect(state.party.map((member) => member.id)).toEqual(["sue", "maddie"]);
    const maddie = state.party.find((member) => member.id === "maddie");
    if (maddie === undefined) throw new Error("Missing maddie in plaza-party");
    const gap = Math.hypot(maddie.x - state.player.x, maddie.y - state.player.y);
    expect(gap).toBeGreaterThan(78);
    expect(gap).toBeLessThanOrEqual(108);
    expect(findPettableCompanion(world, state)?.id).toBe("maddie");
  });

  it("lets Fae pet Maddie behind 2 humans in clubhouse while beanbag resting still wins", () => {
    const club = stateFromFixture("clubhouse");
    expect(club.party.map((member) => member.id)).toEqual(["sue", "jordan", "maddie"]);
    const maddie = club.party.find((member) => member.id === "maddie");
    if (maddie === undefined) throw new Error("Missing maddie in clubhouse");

    // Facing left toward Maddie trailing behind Sue & Jordan (~142..158u away).
    const facingMaddie: State = { ...club, facing: "left" };
    expect(findPettableCompanion(world, facingMaddie)?.id).toBe("maddie");

    // Standing on the Clubhouse beanbag (790, 470) facing right away from Maddie:
    // resting on the beanbag still wins over petting a farther Maddie behind Fae.
    const sue = club.party[0];
    const jordan = club.party[1];
    if (sue === undefined || jordan === undefined) throw new Error("Missing human companions");
    const onBeanbag: State = {
      ...club,
      player: { x: 790, y: 470 },
      facing: "right",
      party: [
        { ...sue, x: 740, y: 470 },
        { ...jordan, x: 690, y: 470 },
        { ...maddie, x: 642, y: 470 },
      ],
    };
    expect(findPettableCompanion(world, onBeanbag)?.id).toBe("maddie");
    expect(findRestSpot(world, onBeanbag)?.id).toBe("clubhouse-beanbag");

    // Turning left toward Maddie prioritizes petting her over resting!
    const turningToMaddie: State = { ...onBeanbag, facing: "left" };
    expect(findRestSpot(world, turningToMaddie)).toBeNull();
    expect(findPettableCompanion(world, turningToMaddie)?.id).toBe("maddie");
  });
});
