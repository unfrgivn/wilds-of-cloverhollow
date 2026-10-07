import {
  distanceToPolygon,
  partySlots,
  pointInPolygon,
  type Area,
  type Point,
  type Tunables,
  type Critter,
  type PartyContent,
} from "../core";

/**
 * Authoring check: can Fae stand somewhere an occluder hides most of her?
 *
 * Fae's body is approximated by a box 50 units wide and 140 tall, standing on
 * her feet point. An occluder draws over her while her feet are above
 * (north of) its baseline. We flood-fill every position the core would allow
 * from each spawn, on a 5-unit grid, and report positions where occluders
 * cover at least `maxCoverage` of the sampled body box. Canopies don't count:
 * they fade while she's behind them (spec 6).
 *
 *        x-25   x+25
 *   y-140 +------+   <- sampled every 5 units
 *         | Fae  |
 *       y +--*---+   <- feet point (the collision circle centre)
 */
const GRID = 5;
const BODY_HALF_WIDTH = 25;
const BODY_HEIGHT = 140;
const distance = (a: Point, b: Point): number => {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
};

export type HiddenPosition = Point & { coverage: number; occluders: string[] };

// The share of Fae's body box, feet at `feet`, that lies inside `polygon`.
export function bodyCover(polygon: Area["occluders"][number]["polygon"], feet: Point): number {
  let covered = 0;
  let samples = 0;
  for (let y = feet.y - BODY_HEIGHT; y <= feet.y; y += GRID)
    for (let x = feet.x - BODY_HALF_WIDTH; x <= feet.x + BODY_HALF_WIDTH; x += GRID) {
      samples += 1;
      if (pointInPolygon({ x, y }, polygon)) covered += 1;
    }
  return covered / samples;
}

function walkable(area: Area, radius: number, point: Point): boolean {
  return (
    pointInPolygon(point, area.walkable) &&
    distanceToPolygon(point, area.walkable) >= radius &&
    [...area.blockers, ...area.npcs.map((npc) => npc.footprint)].every(
      (blocker) =>
        !pointInPolygon(point, blocker) &&
        distanceToPolygon(point, blocker) >= radius,
    )
  );
}

export function reachablePositions(area: Area, radius: number): Point[] {
  const seen = new Set<string>();
  const reachable: Point[] = [];
  for (const spawn of Object.values(area.spawns)) {
    const start = {
      x: Math.round(spawn.x / GRID) * GRID,
      y: Math.round(spawn.y / GRID) * GRID,
    };
    const key = `${start.x},${start.y}`;
    if (seen.has(key) || !walkable(area, radius, start)) continue;
    seen.add(key);
    const queue = [start];
    for (let index = 0; index < queue.length; index += 1) {
      const point = queue[index];
      if (point === undefined) continue;
      reachable.push(point);
      for (const dx of [-GRID, 0, GRID]) {
        for (const dy of [-GRID, 0, GRID]) {
          const next = { x: point.x + dx, y: point.y + dy };
          const nextKey = `${next.x},${next.y}`;
          if (seen.has(nextKey) || !walkable(area, radius, next)) continue;
          seen.add(nextKey);
          queue.push(next);
        }
      }
    }
  }
  return reachable;
}

function bodyCoverage(
  area: Area,
  feet: Point,
): { coverage: number; occluders: string[] } {
  // A canopy fades while Fae is behind it (spec 6), so it never hides her.
  const covering = area.occluders.filter(
    (occluder) => occluder.canopy !== true && feet.y < occluder.baseline,
  );
  const ids = new Set<string>();
  let covered = 0;
  let samples = 0;
  for (let y = feet.y - BODY_HEIGHT; y <= feet.y; y += GRID) {
    for (
      let x = feet.x - BODY_HALF_WIDTH;
      x <= feet.x + BODY_HALF_WIDTH;
      x += GRID
    ) {
      samples += 1;
      const occluder = covering.find((item) =>
        pointInPolygon({ x, y }, item.polygon),
      );
      if (occluder === undefined) continue;
      covered += 1;
      ids.add(occluder.id);
    }
  }
  return { coverage: covered / samples, occluders: [...ids] };
}

export function hiddenPositions(
  area: Area,
  radius: number,
  maxCoverage = 0.75,
): HiddenPosition[] {
  return reachablePositions(area, radius).flatMap((point) => {
    const { coverage, occluders } = bodyCoverage(area, point);
    return coverage >= maxCoverage ? [{ ...point, coverage, occluders }] : [];
  });
}

export function areaConnectionErrors(
  areas: Record<string, Area>,
  tunables: Tunables,
  critters: Record<string, Critter> = {},
  party: Record<string, PartyContent> = {},
): string[] {
  const radius = tunables.playerRadius;
  const roster = Object.values(party);
  const errors: string[] = [];
  for (const area of Object.values(areas)) {
    const reachable = reachablePositions(area, radius);
    for (const interactable of area.interactables) {
      const range = tunables.interact.range;
      const reachablePoint = reachable.some((point) => {
        const dx = point.x - interactable.point.x;
        const dy = point.y - interactable.point.y;
        return dx * dx + dy * dy <= range * range;
      });
      if (!reachablePoint)
        errors.push(
          `${area.id}: interactable ${interactable.id} is unreachable`,
        );
    }
    for (const critter of area.critters) {
      const config = critter.id;
      const touchRadius = critters[critter.id]?.touchRadius ?? 70;
      const reachableTouch = reachable.some((point) => {
        const dx = point.x - critter.point.x;
        const dy = point.y - critter.point.y;
        return dx * dx + dy * dy <= touchRadius * touchRadius;
      });
      if (!reachableTouch)
        errors.push(
          `${area.id}: critter ${config} touch circle is unreachable`,
        );
      if (
        area.triggers.some(
          (trigger) =>
            pointInPolygon(critter.point, trigger.polygon) ||
            distanceToPolygon(critter.point, trigger.polygon) <= touchRadius,
        )
      )
        errors.push(`${area.id}: critter ${config} overlaps a door trigger`);
      if (
        Object.values(area.spawns).some(
          (spawn) => distance(spawn, critter.point) <= touchRadius,
        )
      )
        errors.push(`${area.id}: critter ${config} overlaps a spawn`);
      if (!reachable.some((point) => distance(point, critter.point) <= tunables.interact.range))
        errors.push(`${area.id}: calm ${config} talk point is unreachable`);
    }
    // A den's critters start at its point (spec 6): it must be on the floor,
    // and far enough from every spawn and door that Fae arriving there isn't
    // in its sight, nor caught the moment she steps through.
    area.recurring?.dens.forEach((den, index) => {
      const touch = Math.max(...den.kinds.map((kind) => critters[kind]?.touchRadius ?? 70));
      const clear = tunables.roam.sight + touch;
      if (!walkable(area, tunables.follow.radius, den.point))
        errors.push(`${area.id}: den ${index} is off the floor`);
      for (const [name, spawn] of Object.entries(area.spawns))
        if (distance(spawn, den.point) <= clear)
          errors.push(`${area.id}: den ${index} is within ${clear} of spawn ${name}`);
      for (const trigger of area.triggers)
        if (pointInPolygon(den.point, trigger.polygon) ||
            distanceToPolygon(den.point, trigger.polygon) <= den.radius + touch)
          errors.push(`${area.id}: den ${index} reaches door ${trigger.id}`);
      // Its critters must be seen: a den mostly behind scenery hides them.
      // Samples on rings round the den, each a critter's middle (35 units
      // above its feet), drawn behind an occluder while north of its baseline.
      const spots = [0, den.radius / 2, den.radius].flatMap((ring) =>
        Array.from({ length: 16 }, (_, step) => {
          const turn = (step / 16) * 2 * Math.PI;
          return { x: den.point.x + Math.cos(turn) * ring, y: den.point.y + Math.sin(turn) * ring };
        }));
      const hidden = spots.filter((spot) => area.occluders.some((occluder) =>
        occluder.canopy !== true && spot.y < occluder.baseline &&
        pointInPolygon({ x: spot.x, y: spot.y - 35 }, occluder.polygon)));
      if (hidden.length > spots.length / 10)
        errors.push(`${area.id}: den ${index} is mostly behind scenery`);
    });
    for (const [name, spawn] of Object.entries(area.spawns)) {
      // The whole roster must fit behind Fae here, whoever is in the party.
      for (const { id, slot } of partySlots(area, spawn, tunables.follow, roster))
        if (slot === undefined)
          errors.push(`${area.id}: spawn ${name} has no slot for ${id}`);
      for (const trigger of area.triggers) {
        if (
          pointInPolygon(spawn, trigger.polygon) ||
          distanceToPolygon(spawn, trigger.polygon) < radius * 2
        )
          errors.push(
            `${area.id}: spawn ${name} is within ${radius * 2} units of ${trigger.id}`,
          );
      }
    }
    for (const trigger of area.triggers) {
      const target = areas[trigger.target.area];
      if (
        target === undefined ||
        target.spawns[trigger.target.spawn] === undefined
      )
        errors.push(`${area.id}: trigger ${trigger.id} has an invalid target`);
      if (!reachable.some((point) => pointInPolygon(point, trigger.polygon)))
        errors.push(`${area.id}: trigger ${trigger.id} is unreachable`);
    }
  }
  return errors;
}
