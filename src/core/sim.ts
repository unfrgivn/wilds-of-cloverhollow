import type {
  ActionFrame,
  Area,
  Event,
  Fixture,
  Point,
  Polygon,
  Spawn,
  State,
  World,
} from "./types";

export const blankInput = (): ActionFrame => ({
  move: { x: 0, y: 0 },
  confirm: false,
  cancel: false,
  menu: false,
});

export function createState(
  world: World,
  fixture: Fixture,
  seed = fixture.seed ?? 1,
): State {
  const area = world.areas[fixture.area];
  if (area === undefined)
    throw new Error(`Unknown fixture area: ${fixture.area}`);
  const spawn = area.spawns[fixture.spawn];
  if (spawn === undefined) throw new Error(`Unknown spawn: ${fixture.spawn}`);
  const slot = followerSlot(area, spawn,
    world.tunables.follow.slot, world.tunables.follow.radius,
    world.tunables.follow.heel);
  if (slot === undefined) throw new Error(`No Maddie slot for ${fixture.area}.${fixture.spawn}`);
  return {
    tick: 0,
    area: area.id,
    player: { x: spawn.x, y: spawn.y },
    facing: spawn.facing,
    rng: seed >>> 0,
    previousInput: blankInput(),
    motion: { distance: 0, moving: false },
    transition: null,
    maddie: {
      x: slot.x,
      y: slot.y,
      facing: spawn.facing,
      motion: { distance: 0, moving: false },
      stillTicks: 0,
    },
    trail: [slot, { x: spawn.x, y: spawn.y }],
  };
}

export function nextRandom(state: State): [number, State] {
  const next = (Math.imul(state.rng, 1664525) + 1013904223) >>> 0;
  return [next / 4294967296, { ...state, rng: next }];
}

function vertex(polygon: Polygon, index: number): [number, number] {
  const value = polygon[index];
  if (value === undefined) throw new Error("Polygon has no vertices");
  return value;
}

export function pointInPolygon(point: Point, polygon: Polygon): boolean {
  let inside = false;
  for (
    let index = 0, previous = polygon.length - 1;
    index < polygon.length;
    previous = index++
  ) {
    const current = vertex(polygon, index);
    const prior = vertex(polygon, previous);
    const crosses = current[1] > point.y !== prior[1] > point.y;
    if (
      crosses &&
      point.x <
        ((prior[0] - current[0]) * (point.y - current[1])) /
          (prior[1] - current[1]) +
          current[0]
    )
      inside = !inside;
  }
  return inside;
}

export function closestPointOnPolygon(
  point: Point,
  polygon: Polygon,
): { point: Point; distance: number } {
  let bestPoint = { x: vertex(polygon, 0)[0], y: vertex(polygon, 0)[1] };
  let best = Infinity;
  for (let index = 0; index < polygon.length; index += 1) {
    const start = vertex(polygon, index);
    const end = vertex(polygon, (index + 1) % polygon.length);
    const dx = end[0] - start[0];
    const dy = end[1] - start[1];
    const length = dx * dx + dy * dy;
    const projection =
      length === 0
        ? 0
        : ((point.x - start[0]) * dx + (point.y - start[1]) * dy) / length;
    const t = Math.max(0, Math.min(1, projection));
    const nearest = { x: start[0] + dx * t, y: start[1] + dy * t };
    const differenceX = point.x - nearest.x;
    const differenceY = point.y - nearest.y;
    const distance = Math.sqrt(
      differenceX * differenceX + differenceY * differenceY,
    );
    if (distance < best) {
      best = distance;
      bestPoint = nearest;
    }
  }
  return { point: bestPoint, distance: best };
}

export function distanceToPolygon(point: Point, polygon: Polygon): number {
  return closestPointOnPolygon(point, polygon).distance;
}

function pushFromPolygon(
  point: Point,
  polygon: Polygon,
  radius: number,
  keepInside: boolean,
): Point {
  const inside = pointInPolygon(point, polygon);
  const closest = closestPointOnPolygon(point, polygon);
  const dx = point.x - closest.point.x;
  const dy = point.y - closest.point.y;
  const distance = closest.distance;
  if (keepInside && inside && distance >= radius) return point;
  if (!keepInside && !inside && distance >= radius) return point;
  const safeDistance = Math.max(distance, 0.0001);
  const direction = keepInside ? (inside ? 1 : -1) : inside ? -1 : 1;
  const amount =
    !keepInside && inside
      ? radius + distance
      : keepInside && !inside
        ? radius + distance
        : radius - distance + 0.001;
  return {
    x: point.x + ((direction * dx) / safeDistance) * amount,
    y: point.y + ((direction * dy) / safeDistance) * amount,
  };
}

export function resolveCollision(point: Point, area: Area, radius: number): Point {
  let result = point;
  for (let pass = 0; pass < 8; pass += 1) {
    result = pushFromPolygon(result, area.walkable, radius, true);
    for (const blocker of area.blockers)
      result = pushFromPolygon(result, blocker, radius, false);
  }
  return result;
}

function distance(a: Point, b: Point): number {
  const x = b.x - a.x;
  const y = b.y - a.y;
  return Math.sqrt(x * x + y * y);
}

function segmentClear(area: Area, start: Point, end: Point): boolean {
  const length = distance(start, end);
  const samples = Math.max(1, Math.ceil(length / 5));
  for (let index = 0; index <= samples; index += 1) {
    const ratio = index / samples;
    const point = {
      x: start.x + (end.x - start.x) * ratio,
      y: start.y + (end.y - start.y) * ratio,
    };
    if (!pointInPolygon(point, area.walkable) ||
        area.blockers.some((blocker) => pointInPolygon(point, blocker))) return false;
  }
  return true;
}

function validFollowerPoint(area: Area, point: Point, radius: number): boolean {
  return pointInPolygon(point, area.walkable) &&
    distanceToPolygon(point, area.walkable) >= radius &&
    area.blockers.every((blocker) =>
      !pointInPolygon(point, blocker) && distanceToPolygon(point, blocker) >= radius);
}

export function followerSlot(
  area: Area,
  spawn: Spawn,
  slot: number,
  radius: number,
  heel = slot,
): Point | undefined {
  return visibleFollowerSlot(area, spawn, spawn, heel, slot, radius);
}

export function hiddenFraction(maddie: Point, fae: Point): number {
  if (maddie.y >= fae.y) return 0;
  const left = Math.max(maddie.x - 22, fae.x - 25);
  const right = Math.min(maddie.x + 22, fae.x + 25);
  const top = Math.max(maddie.y - 60, fae.y - 140);
  const bottom = Math.min(maddie.y, fae.y);
  const width = Math.max(0, right - left);
  const height = Math.max(0, bottom - top);
  return (width * height) / (44 * 60);
}

export function visibleFollowerSlot(
  area: Area,
  fae: Point,
  start: Point,
  heel: number,
  slot: number,
  radius: number,
): Point | undefined {
  const sign = start.x - fae.x > 0 ? 1 : -1;
  const heelCandidates = [
    { x: fae.x + sign * heel, y: fae.y - 6 },
    { x: fae.x - sign * heel, y: fae.y - 6 },
    { x: fae.x + sign * heel, y: fae.y + 24 },
    { x: fae.x - sign * heel, y: fae.y + 24 },
  ];
  const candidates = [...heelCandidates];
  const direction = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 },
    left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
  const facings: Spawn["facing"][] = ["up", "down", "left", "right"];
  for (const facing of facings) {
    const vector = direction[facing];
    candidates.push({ x: fae.x - vector.x * slot, y: fae.y - vector.y * slot });
  }
  return candidates.find((point) =>
    validFollowerPoint(area, point, radius) && segmentClear(area, start, point) &&
    hiddenFraction(point, fae) === 0,
  );
}

function pathDistance(start: Point, points: Point[]): number {
  let total = 0;
  let previous = start;
  for (const point of points) {
    total += distance(previous, point);
    previous = point;
  }
  return total;
}

function updateMaddie(
  world: World,
  area: Area,
  state: State,
  player: Point,
  playerMoved: boolean,
): { maddie: State["maddie"]; trail: Point[] } {
  const tune = world.tunables.follow;
  const trail = state.trail.slice();
  const last = trail[trail.length - 1];
  if (playerMoved && (last === undefined || distance(last, player) >= tune.trailSpacing))
    trail.push({ ...player });
  while (trail.length > tune.trailMax) trail.shift();
  const route = [...trail, player];
  const direct = distance(state.maddie, player);
  if (!playerMoved &&
      state.maddie.stillTicks >= tune.settleDelayTicks &&
      hiddenFraction(state.maddie, player) > 0.25) {
    const slot = visibleFollowerSlot(area, player, state.maddie, tune.heel,
      tune.slot, tune.radius);
    if (slot !== undefined && segmentClear(area, state.maddie, slot)) {
      const length = distance(state.maddie, slot);
      const amount = Math.min(world.tunables.walkSpeed / 60, length);
      const ratio = length === 0 ? 0 : amount / length;
      const position = resolveCollision({
        x: state.maddie.x + (slot.x - state.maddie.x) * ratio,
        y: state.maddie.y + (slot.y - state.maddie.y) * ratio,
      }, area, tune.radius);
      const dx = position.x - state.maddie.x;
      const dy = position.y - state.maddie.y;
      const facing = Math.abs(dx) >= Math.abs(dy)
        ? dx < 0 ? "left" : "right"
        : dy < 0 ? "up" : "down";
      const moved = distance(state.maddie, position);
      return {
        maddie: {
          x: position.x, y: position.y, facing,
          stillTicks: state.maddie.stillTicks + 1,
          motion: { distance: state.maddie.motion.distance + moved, moving: moved > 0.0001 },
        },
        trail,
      };
    }
  }
  if (direct <= tune.stop && segmentClear(area, state.maddie, player)) {
    return {
      maddie: { ...state.maddie, stillTicks: state.maddie.stillTicks + 1,
        motion: { ...state.maddie.motion, moving: false } },
      trail: trail.slice(-1),
    };
  }
  const routeLength = pathDistance(state.maddie, route);
  const moving = state.maddie.motion.moving
    ? routeLength > tune.stop
    : routeLength > tune.distance;
  if (!moving) {
    return {
      maddie: { ...state.maddie, stillTicks: state.maddie.stillTicks + 1,
        motion: { ...state.maddie.motion, moving: false } },
      trail,
    };
  }
  let position = { x: state.maddie.x, y: state.maddie.y };
  let remaining = (world.tunables.walkSpeed / 60) *
    (routeLength > tune.distance + 40 ? tune.catchUp : 1);
  const targets = route.slice();
  while (remaining > 0 && targets.length > 0) {
    const target = targets[0];
    if (target === undefined) break;
    const length = distance(position, target);
    if (length <= remaining) {
      position = target;
      remaining -= length;
      targets.shift();
      continue;
    }
    const ratio = remaining / length;
    position = {
      x: position.x + (target.x - position.x) * ratio,
      y: position.y + (target.y - position.y) * ratio,
    };
    remaining = 0;
  }
  const resolved = resolveCollision(position, area, tune.radius);
  const dx = resolved.x - state.maddie.x;
  const dy = resolved.y - state.maddie.y;
  let facing = state.maddie.facing;
  if (Math.abs(dx) >= Math.abs(dy) && dx !== 0) facing = dx < 0 ? "left" : "right";
  else if (dy !== 0) facing = dy < 0 ? "up" : "down";
  const moved = Math.sqrt(dx * dx + dy * dy);
  // `route` ends with Fae's live position, which is a walking target but not a
  // breadcrumb: keep only the unconsumed breadcrumbs so the spacing holds.
  const unvisited = targets[targets.length - 1] === player ? targets.slice(0, -1) : targets;
  return {
    maddie: {
      x: resolved.x,
      y: resolved.y,
      facing,
      stillTicks: playerMoved ? 0 : state.maddie.stillTicks + 1,
      motion: {
        distance: state.maddie.motion.distance + moved,
        moving: moved > 0.0001,
      },
    },
    trail: unvisited,
  };
}

export function step(
  world: World,
  state: State,
  input: ActionFrame,
): { state: State; events: Event[] } {
  const area = world.areas[state.area];
  if (area === undefined) throw new Error(`Unknown state area: ${state.area}`);
  if (state.transition !== null) {
    const transition = state.transition;
    const elapsed = transition.elapsed + 1;
    const limit = world.tunables.doorFadeTicks;
    if (transition.phase === "out" && elapsed >= limit) {
      const targetArea = world.areas[transition.target.area];
      if (targetArea === undefined) throw new Error("Unknown transition area");
      const spawn = targetArea.spawns[transition.target.spawn];
      if (spawn === undefined) throw new Error("Unknown transition spawn");
      const slot = followerSlot(targetArea, spawn, world.tunables.follow.slot,
        world.tunables.follow.radius, world.tunables.follow.heel);
      if (slot === undefined) throw new Error("No Maddie transition slot");
      return {
        state: {
          ...state,
          tick: state.tick + 1,
          area: targetArea.id,
          player: { x: spawn.x, y: spawn.y },
          facing: spawn.facing,
          previousInput: { ...input },
          motion: { ...state.motion, moving: false },
          transition: { target: transition.target, phase: "in", elapsed: 0 },
          maddie: {
            x: slot.x,
            y: slot.y,
            facing: spawn.facing,
            motion: { distance: 0, moving: false },
            stillTicks: 0,
          },
          trail: [slot, { x: spawn.x, y: spawn.y }],
        },
        events: [],
      };
    }
    return {
      state: {
        ...state,
        tick: state.tick + 1,
        previousInput: { ...input },
        motion: { ...state.motion, moving: false },
        transition: transition.phase === "in" && elapsed >= limit
          ? null
          : { ...transition, elapsed },
      },
      events: [],
    };
  }
  const length = Math.sqrt(
    input.move.x * input.move.x + input.move.y * input.move.y,
  );
  const scale = length > 1 ? 1 / length : 1;
  const speed = world.tunables.walkSpeed / 60;
  const player = resolveCollision(
    {
      x: state.player.x + input.move.x * scale * speed,
      y: state.player.y + input.move.y * scale * speed,
    },
    area,
    world.tunables.playerRadius,
  );
  const displacementX = player.x - state.player.x;
  const displacementY = player.y - state.player.y;
  const displacement = Math.sqrt(
    displacementX * displacementX + displacementY * displacementY,
  );
  let facing = state.facing;
  if (Math.abs(input.move.x) >= Math.abs(input.move.y) && input.move.x !== 0)
    facing = input.move.x < 0 ? "left" : "right";
  else if (input.move.y !== 0) facing = input.move.y < 0 ? "up" : "down";
  const events: Event[] = [];
  for (const button of ["confirm", "cancel", "menu"] as const) {
    if (input[button] && !state.previousInput[button])
      events.push({ type: "button", button });
  }
  const trigger = area.triggers.find((item) =>
    !pointInPolygon(state.player, item.polygon) &&
    pointInPolygon(player, item.polygon),
  );
  const follower = trigger === undefined
    ? updateMaddie(world, area, state, player, displacement > 0.0001)
    : {
      maddie: {
        ...state.maddie,
        motion: { ...state.maddie.motion, moving: false },
      },
      trail: state.trail,
    };
  return {
    state: {
      ...state,
      tick: state.tick + 1,
      player,
      facing,
      previousInput: { ...input },
      motion: {
        distance: state.motion.distance + displacement,
        moving: trigger === undefined && displacement > 0.0001,
      },
      transition: trigger === undefined
        ? null
        : { target: trigger.target, phase: "out", elapsed: 0 },
      maddie: follower.maddie,
      trail: follower.trail,
    },
    events,
  };
}

export function stableHash(value: unknown): string {
  const canonical = (item: unknown): string => {
    if (Array.isArray(item)) return `[${item.map(canonical).join(",")}]`;
    if (item !== null && typeof item === "object") {
      const entries = Object.entries(item).sort(([a], [b]) =>
        a < b ? -1 : a > b ? 1 : 0,
      );
      const body = entries
        .map(([key, child]) => `${JSON.stringify(key)}:${canonical(child)}`)
        .join(",");
      return `{${body}}`;
    }
    return JSON.stringify(item);
  };
  let hash = 2166136261;
  for (const character of canonical(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
