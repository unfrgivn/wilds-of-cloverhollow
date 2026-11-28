import {
  distanceToPolygon,
  frontEdge,
  propCoversPoint,
  type Prop,
  type PropState,
  pointInPolygon,
  type Area,
  type Point,
  type Polygon,
} from "../core";
export { areaConnectionErrors, navigationQualityErrors } from "./area-connection-checks";

/**
 * Authoring check: can Fae stand somewhere scenery hides most of her?
 *
 * Fae's body is approximated by a box 50 units wide and 140 tall, standing on
 * her feet point. A prop draws over her where its picture overlaps her body
 * box and her feet are north of its front edge. We flood-fill every position
 * the core would allow from each spawn, on a 5-unit grid, and report positions
 * where props cover at least `maxCoverage` of the sampled body box. Canopies
 * don't count: they fade while she's behind them (spec 6).
 *
 *        x-25   x+25
 *   y-140 +------+   <- sampled every 5 units
 *         | Fae  |
 *       y +--*---+   <- feet point (the collision circle centre)
 */
const GRID = 5;
const BODY_HALF_WIDTH = 25;
const BODY_HEIGHT = 140;

export type HiddenPosition = Point & { coverage: number; by: string[] };

/*
 * The states of the world the checks walk (spec 6.2). A crossing's flag both
 * opens its way over the water and switches the props whose rules read it (the
 * bridge that lays the way down), so a spot only reachable with the way open
 * is checked against the props as they are then, never against the raised
 * bridge it replaces. Each assignment of an area's crossing flags is a
 * scenario; any other rule may or may not hold in each.
 */
export type Scenario = { flags: ReadonlySet<string>; open: ReadonlySet<string> };

function scenarios(area: Area): Scenario[] {
  const flags = new Set((area.crossings ?? []).map((crossing) => crossing.opens));
  const names = [...flags];
  if (names.length > 6) throw new Error(`${area.id}: too many crossing flags to check`);
  return Array.from({ length: 2 ** names.length }, (_, bits) => ({
    flags,
    open: new Set(names.filter((_, index) => (bits >> index) % 2 === 1)),
  }));
}

// The states a prop may be in under `scenario`: the first rule that holds
// wins (propStateName), so a rule on an open crossing flag settles it, one on
// a shut flag is skipped, and any other rule may or may not hold. A prop no
// crossing flag touches may be in any of its states.
export function possibleStates(prop: Prop, scenario: Scenario): PropState[] {
  if (!prop.rules.some((rule) => scenario.flags.has(rule.while)))
    return Object.values(prop.states);
  const names = new Set<string>();
  let settled = false;
  for (const rule of prop.rules) {
    if (prop.states[rule.state] === undefined) continue;
    if (scenario.flags.has(rule.while)) {
      if (!scenario.open.has(rule.while)) continue;
      names.add(rule.state);
      settled = true;
      break;
    }
    names.add(rule.state);
  }
  if (!settled) names.add(prop.state);
  return [...names].flatMap((name) => prop.states[name] ?? []);
}

// Solid wherever someone or something may be under `scenario`: every person,
// the shut crossings, and every footprint its props' states can have.
export function solidOf(area: Area, scenario: Scenario): Area["blockers"] {
  return [
    ...area.blockers,
    ...(area.crossings ?? []).filter((crossing) => !scenario.open.has(crossing.opens))
      .map((crossing) => crossing.polygon),
    ...area.props.flatMap((prop) =>
      possibleStates(prop, scenario).flatMap((state) => state.footprint)),
    ...area.npcs.map((npc) => npc.footprint),
  ];
}

// A point more than `radius` outside a polygon's bounding box is neither inside
// it nor within `radius` of it, so the exact tests only run near the polygon.
// Flood fills ask this of every solid polygon at every grid point.
type Box = { minX: number; minY: number; maxX: number; maxY: number };
const boxes = new WeakMap<Polygon, Box>();

function boxOf(polygon: Polygon): Box {
  const known = boxes.get(polygon);
  if (known !== undefined) return known;
  const box = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const [x, y] of polygon) {
    box.minX = Math.min(box.minX, x);
    box.minY = Math.min(box.minY, y);
    box.maxX = Math.max(box.maxX, x);
    box.maxY = Math.max(box.maxY, y);
  }
  boxes.set(polygon, box);
  return box;
}

function clearOf(polygon: Polygon, radius: number, point: Point): boolean {
  const box = boxOf(polygon);
  if (point.x < box.minX - radius || point.x > box.maxX + radius ||
      point.y < box.minY - radius || point.y > box.maxY + radius)
    return true;
  return !pointInPolygon(point, polygon) && distanceToPolygon(point, polygon) >= radius;
}

export function walkable(
  area: Area,
  solid: Area["blockers"],
  radius: number,
  point: Point,
): boolean {
  return (
    pointInPolygon(point, area.walkable) &&
    distanceToPolygon(point, area.walkable) >= radius &&
    solid.every((blocker) => clearOf(blocker, radius, point))
  );
}

/*
 * What can draw over someone in an area: props in any of their states whose
 * front edge is south of them. Canopies fade instead (spec 6), so they never
 * hide anyone. Each prop state keeps its drawn bounds and its southmost front,
 * so a body box far from it skips it at once.
 */
export type Hiders = {
  props: { id: string; state: PropState; x0: number; x1: number; y0: number; y1: number;
    front: number }[];
};

export function hidersOf(area: Area, scenario?: Scenario): Hiders {
  const states = (prop: Prop): PropState[] =>
    scenario === undefined ? Object.values(prop.states) : possibleStates(prop, scenario);
  return {
    props: area.props.filter((prop) => !prop.canopy).flatMap((prop) =>
      states(prop).filter((state) => !state.flat && !state.hidden).map((state) => {
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
    props: hiders.props.filter((item) => feet.y < item.front && item.x0 <= x1 &&
      item.x1 >= x0 && item.y0 <= feet.y && item.y1 >= y0),
  };
}

/*
 * Every grid point Fae's feet can reach from a spawn, flooded on the 5-unit
 * grid, grouped into the floor's connected parts: each part lists the spawns
 * it holds. A room is one part; a room split in two (by furniture walling off
 * a door) has a spawn whose part holds no other door.
 */
export function reachableParts(
  area: Area,
  radius: number,
  scenario: Scenario,
): { spawns: string[]; points: Point[] }[] {
  const solid = solidOf(area, scenario);
  const seen = new Map<string, number>();
  const parts: { spawns: string[]; points: Point[] }[] = [];
  for (const [name, spawn] of Object.entries(area.spawns)) {
    const start = {
      x: Math.round(spawn.x / GRID) * GRID,
      y: Math.round(spawn.y / GRID) * GRID,
    };
    const key = `${start.x},${start.y}`;
    const known = seen.get(key);
    if (known !== undefined) {
      parts[known]?.spawns.push(name);
      continue;
    }
    if (!walkable(area, solid, radius, start)) continue;
    const points: Point[] = [];
    const part = { spawns: [name], points };
    const index = parts.push(part) - 1;
    seen.set(key, index);
    const queue = [start];
    for (let head = 0; head < queue.length; head += 1) {
      const point = queue[head];
      if (point === undefined) continue;
      part.points.push(point);
      for (const dx of [-GRID, 0, GRID]) {
        for (const dy of [-GRID, 0, GRID]) {
          const next = { x: point.x + dx, y: point.y + dy };
          const nextKey = `${next.x},${next.y}`;
          if (seen.has(nextKey) || !walkable(area, solid, radius, next)) continue;
          seen.set(nextKey, index);
          queue.push(next);
        }
      }
    }
  }
  return parts;
}

// Every spot Fae's feet can reach in some scenario.
export function reachablePositions(area: Area, radius: number): Point[] {
  const seen = new Set<string>();
  return scenarios(area).flatMap((scenario) => reachableParts(area, radius, scenario))
    .flatMap((part) => part.points).filter((point) => {
      const key = `${point.x},${point.y}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function bodyCoverage(
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
  const box = { half: BODY_HALF_WIDTH, height: BODY_HEIGHT };
  const found = new Map<string, HiddenPosition>();
  for (const scenario of scenarios(area)) {
    const hiders = hidersOf(area, scenario);
    for (const point of reachableParts(area, radius, scenario).flatMap((part) => part.points)) {
      const key = `${point.x},${point.y}`;
      if (found.has(key)) continue;
      const { coverage, by } = bodyCoverage(hiders, point, box);
      if (coverage >= maxCoverage) found.set(key, { ...point, coverage, by });
    }
  }
  return [...found.values()];
}

/*
 * Authoring check: is every prop drawn whole, standing on its footprint? Its
 * picture must cover each 5-unit column its footprint covers (one may go
 * spare at an end), except where another prop in front of it there covers its
 * foot with its own picture (a cabinet's side behind its neighbour's; a tree's
 * crown high above covers nothing), and in those columns reach to within 15
 * units of the footprint's front. A crop that missed the object's foot, a mask
 * that kept only part of it, or a footprint reaching past the object (an
 * invisible wall, and a front edge that sorts people beside the object behind
 * it) fails here.
 */
export function propDrawingErrors(area: Area): string[] {
  const drawn = (state: PropState, x: number): [number, number][] =>
    state.silhouette.columns[Math.floor((x - state.silhouette.left) / state.silhouette.step)]
      ?? [];
  const frontAt = (state: PropState, x: number): number | undefined =>
    state.front.ys[Math.floor((x - state.silhouette.left) / state.silhouette.step)];
  const footOf = (state: PropState): number =>
    Math.max(...state.silhouette.columns.flat().map(([, bottom]) => bottom));
  return area.props.flatMap((prop) => Object.entries(prop.states).flatMap(([name, state]) => {
    const points = state.footprint.flat();
    if (points.length === 0) return [];
    const xs = points.map(([x]) => x);
    // A neighbour hides this prop at x when it is in front there (its front
    // south of this footprint's) and its picture covers this footprint's
    // front, where this object meets the ground.
    const hidden = (x: number): boolean => {
      const mine = frontEdge(state.footprint, x - state.silhouette.step / 2,
        state.silhouette.step, 1, prop.y).ys[0];
      if (mine === undefined) return false;
      return area.props.some((other) => {
        const theirs = other.states[other.state];
        if (other.id === prop.id || theirs === undefined) return false;
        const before = frontAt(theirs, x);
        return before !== undefined && before > mine &&
          drawn(theirs, x).some(([top, bottom]) => top <= mine && mine <= bottom);
      });
    };
    let bare = 0;
    let front = -Infinity;
    for (let x = Math.min(...xs) + state.silhouette.step / 2; x < Math.max(...xs);
      x += state.silhouette.step) {
      const own = drawn(state, x);
      const mine = frontEdge(state.footprint, x - state.silhouette.step / 2,
        state.silhouette.step, 1, prop.y).ys[0];
      if (own.length === 0) {
        if (!hidden(x)) bare += 1;
        continue;
      }
      if (mine !== undefined && footOf(state) < mine - 25) bare += 1;
      front = Math.max(front, frontAt(state, x) ?? -Infinity);
    }
    const foot = Math.max(...state.silhouette.columns.flat().map(([, bottom]) => bottom));
    const at = `${area.id}: prop ${prop.id} (${name})`;
    return [
      ...(bare > 1
        ? [`${at} has ${bare * state.silhouette.step} footprint units with nothing drawn`] : []),
      ...(front - foot > 15
        ? [`${at}: its picture's foot is ${Math.round(front - foot)} units above its front`]
        : []),
    ];
  }));
}

/*
 * Authoring check: a plain blocker must not draw a prop's collision again as
 * a box. A blocker over half or more of a prop footprint's 5-unit cells is
 * that prop's ground contact drawn again, bigger, and its corners are
 * invisible walls (spec 6.2). A pocket or a gap beside a footprint only meets
 * it along an edge.
 */
export function propBlockerErrors(area: Area): string[] {
  return area.blockers.flatMap((blocker, index) => area.props.flatMap((prop) => {
    const cells = (prop.states[prop.state]?.footprint ?? []).flatMap((polygon) => {
      const xs = polygon.map(([x]) => x);
      const ys = polygon.map(([, y]) => y);
      const inside: Point[] = [];
      for (let y = Math.floor(Math.min(...ys) / GRID) * GRID + GRID / 2; y < Math.max(...ys);
        y += GRID)
        for (let x = Math.floor(Math.min(...xs) / GRID) * GRID + GRID / 2; x < Math.max(...xs);
          x += GRID)
          if (pointInPolygon({ x, y }, polygon)) inside.push({ x, y });
      return inside;
    });
    const covered = cells.filter((cell) => pointInPolygon(cell, blocker)).length;
    return cells.length > 0 && covered * 2 >= cells.length
      ? [`${area.id}: blocker ${index} covers prop ${prop.id}'s footprint`]
      : [];
  }));
}
