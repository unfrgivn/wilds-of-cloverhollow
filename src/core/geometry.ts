import type { Area, Point, Polygon } from "./types";

function vertex(polygon: Polygon, index: number): [number, number] {
  const value = polygon[index];
  if (value === undefined) throw new Error("Polygon has no vertices");
  return value;
}

export function distance(a: Point, b: Point): number {
  const x = b.x - a.x;
  const y = b.y - a.y;
  return Math.sqrt(x * x + y * y);
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
  let bestX = vertex(polygon, 0)[0];
  let bestY = vertex(polygon, 0)[1];
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
    const nearestX = start[0] + dx * t;
    const nearestY = start[1] + dy * t;
    const differenceX = point.x - nearestX;
    const differenceY = point.y - nearestY;
    const dist = Math.sqrt(
      differenceX * differenceX + differenceY * differenceY,
    );
    if (dist < best) {
      best = dist;
      bestX = nearestX;
      bestY = nearestY;
    }
  }
  return { point: { x: bestX, y: bestY }, distance: best };
}

export function distanceToPolygon(point: Point, polygon: Polygon): number {
  return closestPointOnPolygon(point, polygon).distance;
}

// Each polygon's bounding box. Polygons are content and never change, so a
// box is worked out once per polygon.
const boxes = new WeakMap<Polygon, { left: number; top: number; right: number; bottom: number }>();

// Whether `point` lies more than `reach` outside the polygon's bounding box:
// then it's outside the polygon and further than `reach` from every edge, and
// the full tests below would leave it alone.
function beyond(point: Point, polygon: Polygon, reach: number): boolean {
  let box = boxes.get(polygon);
  if (box === undefined) {
    box = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
    for (const [x, y] of polygon) {
      box.left = Math.min(box.left, x);
      box.top = Math.min(box.top, y);
      box.right = Math.max(box.right, x);
      box.bottom = Math.max(box.bottom, y);
    }
    boxes.set(polygon, box);
  }
  return point.x < box.left - reach || point.x > box.right + reach ||
    point.y < box.top - reach || point.y > box.bottom + reach;
}

function pushFromPolygon(
  point: Point,
  polygon: Polygon,
  radius: number,
  keepInside: boolean,
): Point {
  if (!keepInside && beyond(point, polygon, radius)) return point;
  const inside = pointInPolygon(point, polygon);
  const closest = closestPointOnPolygon(point, polygon);
  const dx = point.x - closest.point.x;
  const dy = point.y - closest.point.y;
  const dist = closest.distance;
  if (keepInside && inside && dist >= radius) return point;
  if (!keepInside && !inside && dist >= radius) return point;
  const safeDistance = Math.max(dist, 0.0001);
  const direction = keepInside ? (inside ? 1 : -1) : inside ? -1 : 1;
  const amount =
    !keepInside && inside
      ? radius + dist
      : keepInside && !inside
        ? radius + dist
        : radius - dist + 0.001;
  return {
    x: point.x + ((direction * dx) / safeDistance) * amount,
    y: point.y + ((direction * dy) / safeDistance) * amount,
  };
}

export function resolveCollision(
  point: Point,
  area: Area,
  radius: number,
): Point {
  let result = point;
  for (let pass = 0; pass < 8; pass += 1) {
    const before = result;
    result = pushFromPolygon(result, area.walkable, radius, true);
    for (const blocker of area.blockers)
      result = pushFromPolygon(result, blocker, radius, false);
    // A pass depends only on where it starts: one that moves nothing leaves
    // every later pass nothing to move.
    if (Object.is(result.x, before.x) && Object.is(result.y, before.y)) break;
  }
  return result;
}

function validResolved(point: Point, area: Area, radius: number): boolean {
  return pointInPolygon(point, area.walkable) &&
    distanceToPolygon(point, area.walkable) >= radius - 0.01 &&
    area.blockers.every((blocker) => beyond(point, blocker, radius) ||
      (!pointInPolygon(point, blocker) && distanceToPolygon(point, blocker) >= radius - 0.01));
}

/*
 * One step from `previous` toward `candidate` (spec 6). The solver pushes out of
 * each shape in turn; in a gap narrower than the collider those pushes fight,
 * and it can stop inside one. Then the step slides along one axis, or stays.
 * Where the solver succeeds (every area before props) nothing changes.
 */
export function resolveMove(previous: Point, candidate: Point, area: Area, radius: number): Point {
  const resolved = resolveCollision(candidate, area, radius);
  if (validResolved(resolved, area, radius)) return resolved;
  const alongX = resolveCollision({ x: candidate.x, y: previous.y }, area, radius);
  if (validResolved(alongX, area, radius)) return alongX;
  const alongY = resolveCollision({ x: previous.x, y: candidate.y }, area, radius);
  return validResolved(alongY, area, radius) ? alongY : previous;
}
