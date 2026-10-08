import { describe, expect, it } from "vitest";
import {
  distanceToPolygon,
  everyPropFootprint,
  faeBox,
  hiddenFraction,
  partySlots,
  pointInPolygon,
  type Area,
  type Point,
} from "../../src/core";
import { loadContent } from "../../src/content/load";

const { world } = loadContent();

function distance(a: Point, b: Point): number {
  return Math.sqrt((a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y));
}

function clear(area: Area, point: Point, radius: number): boolean {
  return (
    pointInPolygon(point, area.walkable) &&
    distanceToPolygon(point, area.walkable) >= radius &&
    area.blockers.every(
      (blocker) =>
        !pointInPolygon(point, blocker) && distanceToPolygon(point, blocker) >= radius,
    )
  );
}

function lineClear(area: Area, start: Point, end: Point): boolean {
  const length = distance(start, end);
  const samples = Math.max(1, Math.ceil(length / 5));
  for (let index = 0; index <= samples; index += 1) {
    const ratio = index / samples;
    const point = {
      x: start.x + (end.x - start.x) * ratio,
      y: start.y + (end.y - start.y) * ratio,
    };
    if (
      !pointInPolygon(point, area.walkable) ||
      area.blockers.some((blocker) => pointInPolygon(point, blocker))
    )
      return false;
  }
  return true;
}

function oldMaddieSlot(area: Area, fae: Point): Point | undefined {
  const follow = world.tunables.follow;
  const maddie = world.party.maddie;
  if (maddie === undefined) throw new Error("Maddie missing");
  const candidates = [
    { x: fae.x - follow.heel, y: fae.y - 6 },
    { x: fae.x + follow.heel, y: fae.y - 6 },
    { x: fae.x + follow.heel, y: fae.y + 24 },
    { x: fae.x - follow.heel, y: fae.y + 24 },
    { x: fae.x, y: fae.y + follow.slot },
    { x: fae.x, y: fae.y - follow.slot },
    { x: fae.x + follow.slot, y: fae.y },
    { x: fae.x - follow.slot, y: fae.y },
  ];
  return candidates.find(
    (point) =>
      clear(area, point, follow.radius) &&
      lineClear(area, fae, point) &&
      distance(point, fae) >= follow.radius * 2 &&
      hiddenFraction(point, maddie.box, fae, faeBox) === 0,
  );
}

describe("member zero slot compatibility", () => {
  it("keeps the old zero-hidden candidate for every spawn and facing", () => {
    for (const room of Object.values(world.areas)) {
      // Props are solid for the party in every state, as in the area checks.
      const area = { ...room, blockers: [...room.blockers, ...everyPropFootprint(room)] };
      for (const spawn of Object.values(area.spawns))
        for (const _facing of ["up", "down", "left", "right"] as const) {
          const expected = oldMaddieSlot(area, spawn);
          const maddie = world.party.maddie;
          if (maddie === undefined) throw new Error("Maddie missing");
          const actual = partySlots(area, spawn, world.tunables.follow, [maddie])[0]?.slot;
          expect(actual, `${area.id}.${_facing}`).toEqual(expected);
        }
    }
  });
});
