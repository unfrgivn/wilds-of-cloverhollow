import {
  distanceToPolygon,
  everyPropFootprint,
  propCoversPoint,
  type PropState,
  partySlots,
  pointInPolygon,
  type Area,
  type Point,
  type Tunables,
  type Critter,
  type PartyContent,
} from "../core";

/**
 * Authoring check: can Fae stand somewhere scenery hides most of her?
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

export type HiddenPosition = Point & { coverage: number; by: string[] };

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

// Solid wherever someone or something may be: every person, and every
// footprint any prop state can have.
function solidOf(area: Area): Area["blockers"] {
  return [...area.blockers, ...everyPropFootprint(area), ...area.npcs.map((npc) => npc.footprint)];
}

function walkable(area: Area, solid: Area["blockers"], radius: number, point: Point): boolean {
  return (
    pointInPolygon(point, area.walkable) &&
    distanceToPolygon(point, area.walkable) >= radius &&
    solid.every(
      (blocker) =>
        !pointInPolygon(point, blocker) &&
        distanceToPolygon(point, blocker) >= radius,
    )
  );
}

/*
 * What can draw over someone in an area: occluders north of whose baseline
 * they stand, and props in any of their states. Canopies fade instead
 * (spec 6), so they never hide anyone. Each prop state keeps its drawn bounds
 * and its southmost front, so a body box far from it skips it at once.
 */
type Hiders = {
  occluders: Area["occluders"];
  props: { id: string; state: PropState; x0: number; x1: number; y0: number; y1: number;
    front: number }[];
};

function hidersOf(area: Area): Hiders {
  return {
    occluders: area.occluders.filter((item) => item.canopy !== true),
    props: area.props.filter((prop) => !prop.canopy).flatMap((prop) =>
      Object.values(prop.states).map((state) => {
        const tops = state.silhouette.columns.flat().map(([top]) => top);
        const bottoms = state.silhouette.columns.flat().map(([, bottom]) => bottom);
        return {
          id: prop.id,
          state,
          x0: state.silhouette.left,
          x1: state.silhouette.left + state.silhouette.columns.length * state.silhouette.step,
          y0: Math.min(...tops),
          y1: Math.max(...bottoms),
          front: Math.max(...state.front.ys),
        };
      })),
  };
}

// The hiders that could cover a box (x0..x1, y0..y1) over feet at `feet`.
function near(hiders: Hiders, feet: Point, x0: number, x1: number, y0: number): Hiders {
  return {
    occluders: hiders.occluders.filter((item) => feet.y < item.baseline),
    props: hiders.props.filter((item) => feet.y < item.front && item.x0 <= x1 &&
      item.x1 >= x0 && item.y0 <= feet.y && item.y1 >= y0),
  };
}

export function reachablePositions(area: Area, radius: number): Point[] {
  const solid = solidOf(area);
  const seen = new Set<string>();
  const reachable: Point[] = [];
  for (const spawn of Object.values(area.spawns)) {
    const start = {
      x: Math.round(spawn.x / GRID) * GRID,
      y: Math.round(spawn.y / GRID) * GRID,
    };
    const key = `${start.x},${start.y}`;
    if (seen.has(key) || !walkable(area, solid, radius, start)) continue;
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
          if (seen.has(nextKey) || !walkable(area, solid, radius, next)) continue;
          seen.add(nextKey);
          queue.push(next);
        }
      }
    }
  }
  return reachable;
}

function bodyCoverage(
  all: Hiders,
  feet: Point,
  box: { half: number; height: number },
): { coverage: number; by: string[] } {
  const hiders = near(all, feet, feet.x - box.half, feet.x + box.half, feet.y - box.height);
  const ids = new Set<string>();
  let covered = 0;
  let samples = 0;
  for (let y = feet.y - box.height; y <= feet.y; y += GRID)
    for (let x = feet.x - box.half; x <= feet.x + box.half; x += GRID) {
      samples += 1;
      let id: string | undefined;
      for (const item of hiders.occluders)
        if (pointInPolygon({ x, y }, item.polygon)) {
          id = item.id;
          break;
        }
      if (id === undefined)
        for (const item of hiders.props)
          if (propCoversPoint(item.state, feet, { x, y })) {
            id = item.id;
            break;
          }
      if (id === undefined) continue;
      covered += 1;
      ids.add(id);
    }
  return { coverage: covered / samples, by: [...ids] };
}

export function hiddenPositions(
  area: Area,
  radius: number,
  maxCoverage = 0.75,
): HiddenPosition[] {
  const hiders = hidersOf(area);
  const box = { half: BODY_HALF_WIDTH, height: BODY_HEIGHT };
  return reachablePositions(area, radius).flatMap((point) => {
    const { coverage, by } = bodyCoverage(hiders, point, box);
    return coverage >= maxCoverage ? [{ ...point, coverage, by }] : [];
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
    const hiders = hidersOf(area);
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
      if (!walkable(area, solidOf(area), tunables.follow.radius, den.point))
        errors.push(`${area.id}: den ${index} is off the floor`);
      for (const [name, spawn] of Object.entries(area.spawns))
        if (distance(spawn, den.point) <= clear)
          errors.push(`${area.id}: den ${index} is within ${clear} of spawn ${name}`);
      for (const trigger of area.triggers)
        if (pointInPolygon(den.point, trigger.polygon) ||
            distanceToPolygon(den.point, trigger.polygon) <= den.radius + touch)
          errors.push(`${area.id}: den ${index} reaches door ${trigger.id}`);
      // Its critters must be seen: a den mostly behind scenery hides them.
      // At sample spots on rings round the den, no more than a tenth may have
      // over half a critter's body (50 by 70 units) drawn behind scenery.
      const spots = [0, den.radius / 2, den.radius].flatMap((ring) =>
        Array.from({ length: 16 }, (_, step) => {
          const turn = (step / 16) * 2 * Math.PI;
          return { x: den.point.x + Math.cos(turn) * ring, y: den.point.y + Math.sin(turn) * ring };
        }));
      const hidden = spots.filter((spot) =>
        bodyCoverage(hiders, spot, { half: 25, height: 70 }).coverage > 0.5);
      if (hidden.length > spots.length / 10)
        errors.push(`${area.id}: den ${index} is mostly behind scenery`);
    });
    // Party slots avoid props as they do in play, here in every state at once.
    const scenery = { ...area, blockers: [...area.blockers, ...everyPropFootprint(area)] };
    for (const [name, spawn] of Object.entries(area.spawns)) {
      // The whole roster must fit behind Fae here, whoever is in the party.
      for (const { id, slot } of partySlots(scenery, spawn, tunables.follow, roster))
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
