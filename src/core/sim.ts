import type {
  ActionFrame,
  Area,
  Event,
  Fixture,
  Point,
  Polygon,
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
  return {
    tick: 0,
    area: area.id,
    player: { x: spawn.x, y: spawn.y },
    facing: spawn.facing,
    rng: seed >>> 0,
    previousInput: blankInput(),
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

function resolve(point: Point, area: Area, radius: number): Point {
  let result = point;
  for (let pass = 0; pass < 8; pass += 1) {
    result = pushFromPolygon(result, area.walkable, radius, true);
    for (const blocker of area.blockers)
      result = pushFromPolygon(result, blocker, radius, false);
  }
  return result;
}

export function step(
  world: World,
  state: State,
  input: ActionFrame,
): { state: State; events: Event[] } {
  const area = world.areas[state.area];
  if (area === undefined) throw new Error(`Unknown state area: ${state.area}`);
  const length = Math.sqrt(
    input.move.x * input.move.x + input.move.y * input.move.y,
  );
  const scale = length > 1 ? 1 / length : 1;
  const speed = world.tunables.walkSpeed / 60;
  const player = resolve(
    {
      x: state.player.x + input.move.x * scale * speed,
      y: state.player.y + input.move.y * scale * speed,
    },
    area,
    world.tunables.playerRadius,
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
  return {
    state: {
      ...state,
      tick: state.tick + 1,
      player,
      facing,
      previousInput: { ...input },
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
