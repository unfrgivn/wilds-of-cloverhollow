import { describe, expect, it } from "vitest";
import {
  blankInput,
  createState,
  distanceToPolygon,
  journalNotes,
  pointInPolygon,
  step,
  targetInteractable,
  type ActionFrame,
  type Area,
  type Point,
  type State,
} from "../../src/core";
import { loadContent } from "../../src/content/load";

// Contract for Milestone 25 (the first mini-boss). A grumpy gull under the
// raccoon's chaos spell guards the Cliffside Trail's lookout bench and
// snatches everyone's snacks. It's bigger and tougher than any critter so far
// and it doesn't wander: the way from the footbridge to the bench runs
// through its reach. Calmed, it's the Lookout Gull: a sticker, a talk, a
// journal note, and the bench is Fae's again.

const content = loadContent();
const world = content.world;
const radius = world.tunables.playerRadius;
const press = (frame: Partial<ActionFrame>): ActionFrame => ({ ...blankInput(), ...frame });

function areaFor(id: string): Area {
  const area = world.areas[id];
  if (area === undefined) throw new Error(`area ${id} missing`);
  return area;
}
const trail = areaFor("trail");

function standable(point: Point): boolean {
  if (!pointInPolygon(point, trail.walkable)) return false;
  if (distanceToPolygon(point, trail.walkable) < radius) return false;
  return trail.blockers.every(
    (polygon) => !pointInPolygon(point, polygon) && distanceToPolygon(point, polygon) >= radius,
  );
}

function gullContent(): NonNullable<(typeof world.critters)[string]> {
  const gull = world.critters["gull"];
  if (gull === undefined) throw new Error("no gull");
  return gull;
}

function placedGull(): Area["critters"][number] {
  const placed = trail.critters.find((item) => item.id === "gull");
  if (placed === undefined) throw new Error("the gull isn't on the trail");
  return placed;
}

function onTrail(feet: Point, facing: State["facing"], gull: "chaos" | "calm"): State {
  const start = createState(world, { area: "trail", spawn: "bay", seed: 1 });
  return { ...start, player: feet, facing, critters: { ...start.critters, gull } };
}

describe("the grumpy gull", () => {
  it("is a mini-boss: bigger, longer-reaching, and harder to calm than any critter", () => {
    const gull = gullContent();
    expect(gull.atlas).toBe("assets/critters/gull/gull.json");
    expect(gull.calmKnot).toBe("gull_calm");
    expect(Object.keys(gull.commands.friends)).toEqual(["play", "cast", "juggle"]);
    // The ordinary critters: every kind out in a den (the other mini-boss,
    // Mr. Pip, is a set piece like the gull).
    const ordinary = new Set(Object.values(world.areas)
      .flatMap((area) => area.recurring?.dens.flatMap((den) => den.kinds) ?? []));
    expect(ordinary.size).toBeGreaterThan(5);
    for (const other of Object.values(world.critters)) {
      if (!ordinary.has(other.id)) continue;
      expect(gull.overworldHeight, other.id).toBeGreaterThan(other.overworldHeight);
      expect(gull.battleHeight, other.id).toBeGreaterThan(other.battleHeight);
      expect(gull.touchRadius, other.id).toBeGreaterThan(other.touchRadius);
      expect(gull.calmMax, other.id).toBeGreaterThanOrEqual(other.calmMax * 1.5);
    }
    expect(world.stickers.catalogue.some((sticker) =>
      sticker.id === gull.sticker.id && sticker.critter === "gull")).toBe(true);
    const fixture = content.fixtures["new-game"];
    if (fixture === undefined) throw new Error("new-game fixture missing");
    expect(createState(world, fixture).critters["gull"]).toBe("chaos");
  });

  it("stands its ground at the lookout, by the bench", () => {
    const placed = placedGull();
    expect(placed.point.x).toBeGreaterThanOrEqual(1380);
    expect(placed.point.x).toBeLessThanOrEqual(1600);
    expect(placed.point.y).toBeGreaterThanOrEqual(420);
    expect(placed.point.y).toBeLessThanOrEqual(560);
    expect(standable(placed.point)).toBe(true);
  });

  it("can't be slipped past on the way from the footbridge to the bench", () => {
    let state = onTrail({ x: 1265, y: 560 }, "right", "chaos");
    for (let tick = 0; tick < 200 && state.battle === null; tick += 1)
      state = step(world, state, press({ move: { x: 1, y: 0 } })).state;
    expect(state.battle?.critterId).toBe("gull");
    expect(state.player.x).toBeLessThan(1500);
  });

  it("leaves the bench to Fae once it's calm, and talks", () => {
    let state = onTrail({ x: 1530, y: 565 }, "up", "calm");
    expect(standable(state.player)).toBe(true);
    expect(targetInteractable(world, state)?.id).toBe("lookout-bench");
    const placed = placedGull();
    const spots: [number, number, State["facing"]][] =
      [[0, 50, "up"], [50, 0, "left"], [-50, 0, "right"], [0, -50, "down"]];
    const spot = spots.find(([dx, dy]) =>
      standable({ x: placed.point.x + dx, y: placed.point.y + dy }));
    if (spot === undefined) throw new Error("nowhere to stand by the calm gull");
    const [dx, dy, facing] = spot;
    state = onTrail({ x: placed.point.x + dx, y: placed.point.y + dy }, facing, "calm");
    expect(targetInteractable(world, state)?.id).toBe("critter:gull");
    state = step(world, state, blankInput()).state;
    state = step(world, state, press({ confirm: true })).state;
    expect(state.dialogue?.knot).toBe("gull_calm");
  });

  it("writes a journal note once calm", () => {
    const state = onTrail({ x: 1530, y: 565 }, "up", "calm");
    expect(journalNotes(world, state)[0]).toMatch(/gull/i);
  });
});
