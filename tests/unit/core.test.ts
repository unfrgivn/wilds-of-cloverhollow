import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import {
  createState,
  distanceToPolygon,
  nextRandom,
  pointInPolygon,
  stableHash,
  step,
  type ActionFrame,
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
    expect(state.area).toBe("plaza");
    expect(state.player).toEqual({ x: 450, y: 500 });
    expect(state.facing).toBe("right");
    expect(state.transition?.phase).toBe("in");
    for (let index = 0; index < world.tunables.doorFadeTicks; index += 1)
      state = step(world, state, { ...none, move: { x: 1, y: 0 } }).state;
    expect(state.transition).toBeNull();
    expect(state.player.x).toBe(450);
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
    expect(areaConnectionErrors({ ...world.areas, plaza: badTarget }, 20))
      .toContain("plaza: trigger house-front-door has an invalid target");
    const badSpawn = {
      ...plaza,
      spawns: { ...plaza.spawns, bad: { x: 350, y: 530, facing: "down" as const } },
    };
    expect(areaConnectionErrors({ ...world.areas, plaza: badSpawn }, 20))
      .toContain("plaza: spawn bad is within 40 units of house-front-door");
  });

  it("never lets an occluder hide most of Fae anywhere she can stand", () => {
    for (const area of Object.values(world.areas)) {
      expect(hiddenPositions(area, world.tunables.playerRadius), area.id).toEqual([]);
    }
  });

  it("validates all area connections with the tunable radius", () => {
    expect(areaConnectionErrors(world.areas, world.tunables.playerRadius)).toEqual([]);
  });

  it("flags the hiding corridor in the first bedroom layout", () => {
    const bedroom = world.areas.bedroom;
    if (bedroom === undefined) throw new Error("bedroom missing");
    // The first Milestone 5 bed blocker was a thin band along the bed's front,
    // leaving a corridor behind the bed where its occluder covered Fae.
    const corridor = {
      ...bedroom,
      blockers: bedroom.blockers.map((blocker, index): [number, number][] =>
        index === 0 ? [[190, 310], [425, 350], [430, 385], [185, 350]] : blocker,
      ),
    };
    const hidden = hiddenPositions(corridor, world.tunables.playerRadius);
    expect(hidden.length).toBeGreaterThan(0);
    expect(hidden.every((position) => position.occluders.includes("bed"))).toBe(true);
  });
});
