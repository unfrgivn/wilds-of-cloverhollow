import { describe, expect, it } from "vitest";
import {
  createState,
  distanceToPolygon,
  nextRandom,
  pointInPolygon,
  stableHash,
  step,
  type ActionFrame,
} from "../../src/core";
import { loadContent, parseArea } from "../../src/content/load";

const content = loadContent();
const world = content.world;
const fixture = content.fixtures["new-game"];
if (fixture === undefined) throw new Error("fixture missing");
const area = world.areas.harness;
if (area === undefined) throw new Error("area missing");
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
    current.blockers.every(
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
});
