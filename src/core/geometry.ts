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

export function validResolved(point: Point, area: Area, radius: number): boolean {
  return pointInPolygon(point, area.walkable) &&
    distanceToPolygon(point, area.walkable) >= radius - 0.01 &&
    area.blockers.every((blocker) => beyond(point, blocker, radius) ||
      (!pointInPolygon(point, blocker) && distanceToPolygon(point, blocker) >= radius - 0.01));
}

const NUDGE_OFFSETS = [10, 18, 26] as const;

function tryNudgeSide(
  previous: Point,
  ux: number,
  uy: number,
  px: number,
  py: number,
  desiredLen: number,
  sign: -1 | 1,
  area: Area,
  radius: number,
): { offset: number; point: Point } | null {
  const lateralTarget = {
    x: previous.x + px * sign * (desiredLen * 0.85) + ux * (desiredLen * 0.25),
    y: previous.y + py * sign * (desiredLen * 0.85) + uy * (desiredLen * 0.25),
  };
  const lateral = resolveCollision(lateralTarget, area, radius);
  if (!validResolved(lateral, area, radius)) return null;
  const sideMove =
    (lateral.x - previous.x) * (px * sign) + (lateral.y - previous.y) * (py * sign);
  if (sideMove <= 0.05) return null;
  for (const offset of NUDGE_OFFSETS) {
    const lookahead = {
      x: previous.x + ux * (desiredLen * 2.5) + px * sign * offset,
      y: previous.y + uy * (desiredLen * 2.5) + py * sign * offset,
    };
    if (validResolved(lookahead, area, radius)) return { offset, point: lateral };
  }
  return null;
}

function cornerNudge(
  previous: Point,
  ux: number,
  uy: number,
  desiredLen: number,
  area: Area,
  radius: number,
): Point | null {
  const px = -uy;
  const py = ux;
  const neg = tryNudgeSide(previous, ux, uy, px, py, desiredLen, -1, area, radius);
  const pos = tryNudgeSide(previous, ux, uy, px, py, desiredLen, 1, area, radius);
  if (neg === null && pos === null) return null;
  if (neg !== null && pos === null) return neg.point;
  if (pos !== null && neg === null) return pos.point;
  if (neg !== null && pos !== null) {
    if (neg.offset <= pos.offset - 8) return neg.point;
    if (pos.offset <= neg.offset - 8) return pos.point;
  }
  return null;
}

function pushNormal(normals: Point[], nx: number, ny: number): void {
  const len = Math.sqrt(nx * nx + ny * ny);
  if (len < 0.0001) return;
  const ux = nx / len;
  const uy = ny / len;
  for (const existing of normals) {
    if (existing.x * ux + existing.y * uy > 0.995) return;
  }
  normals.push({ x: ux, y: uy });
}

function addPolygonNormals(
  normals: Point[],
  previous: Point,
  candidate: Point,
  polygon: Polygon,
  reach: number,
  keepInside: boolean,
): void {
  if (!keepInside && beyond(candidate, polygon, reach)) return;
  const inside = pointInPolygon(candidate, polygon);
  const closest = closestPointOnPolygon(candidate, polygon);
  const active = keepInside
    ? !inside || closest.distance <= reach
    : inside || closest.distance <= reach;
  if (!active) return;

  if (closest.distance >= 0.0001) {
    const dir = keepInside ? (inside ? 1 : -1) : inside ? -1 : 1;
    pushNormal(
      normals,
      dir * (candidate.x - closest.point.x),
      dir * (candidate.y - closest.point.y),
    );
  } else {
    const fromPrev = closestPointOnPolygon(previous, polygon);
    if (fromPrev.distance >= 0.0001) {
      pushNormal(normals, previous.x - fromPrev.point.x, previous.y - fromPrev.point.y);
    }
  }

  for (let index = 0; index < polygon.length; index += 1) {
    const start = vertex(polygon, index);
    const end = vertex(polygon, (index + 1) % polygon.length);
    const edx = end[0] - start[0];
    const edy = end[1] - start[1];
    const lenSq = edx * edx + edy * edy;
    if (lenSq < 0.0001) continue;
    const proj = ((candidate.x - start[0]) * edx + (candidate.y - start[1]) * edy) / lenSq;
    const t = Math.max(0, Math.min(1, proj));
    const nearX = start[0] + edx * t;
    const nearY = start[1] + edy * t;
    const distX = candidate.x - nearX;
    const distY = candidate.y - nearY;
    if (distX * distX + distY * distY > reach * reach) continue;
    const eLen = Math.sqrt(lenSq);
    let nx = -edy / eLen;
    let ny = edx / eLen;
    const prevSide = (previous.x - nearX) * nx + (previous.y - nearY) * ny;
    if (Math.abs(prevSide) > 0.001) {
      if (prevSide < 0) {
        nx = -nx;
        ny = -ny;
      }
    } else {
      const midX = (start[0] + end[0]) * 0.5;
      const midY = (start[1] + end[1]) * 0.5;
      const probe = { x: midX + nx * 0.5, y: midY + ny * 0.5 };
      if (pointInPolygon(probe, polygon) !== keepInside) {
        nx = -nx;
        ny = -ny;
      }
    }
    pushNormal(normals, nx, ny);
  }
}

/*
 * One step from `previous` toward `candidate` (spec 6). The solver pushes out of
 * each shape in turn; when progress stalls against a corner it checks for an
 * asymmetric opening to funnel around, and when pushes fight in a tight gap or
 * acute corner it tests tangent slides and open bisectors before falling back.
 */
export function resolveMove(previous: Point, candidate: Point, area: Area, radius: number): Point {
  const resolved = resolveCollision(candidate, area, radius);
  const dx = candidate.x - previous.x;
  const dy = candidate.y - previous.y;
  const desiredLen = Math.sqrt(dx * dx + dy * dy);
  if (desiredLen < 0.0001) return validResolved(resolved, area, radius) ? resolved : previous;
  const ux = dx / desiredLen;
  const uy = dy / desiredLen;

  if (validResolved(resolved, area, radius)) {
    const moved = distance(previous, resolved);
    if (moved >= desiredLen * 0.15) return resolved;
    const nudged = cornerNudge(previous, ux, uy, desiredLen, area, radius);
    return nudged ?? resolved;
  }

  const reach = radius + desiredLen + 2;
  const normals: Point[] = [];
  addPolygonNormals(normals, previous, candidate, area.walkable, reach, true);
  for (const blocker of area.blockers) {
    addPolygonNormals(normals, previous, candidate, blocker, reach, false);
  }

  const trials: Point[] = [
    { x: candidate.x, y: previous.y },
    { x: previous.x, y: candidate.y },
  ];
  for (const normal of normals) {
    let tx = -normal.y;
    let ty = normal.x;
    let dot = ux * tx + uy * ty;
    if (dot < 0) {
      tx = -tx;
      ty = -ty;
      dot = -dot;
    }
    if (dot > 0.01) {
      trials.push({
        x: previous.x + tx * (dot * desiredLen),
        y: previous.y + ty * (dot * desiredLen),
      });
    }
  }
  for (let i = 0; i < normals.length; i += 1) {
    const first = normals[i];
    if (first === undefined) continue;
    for (let j = i + 1; j < normals.length; j += 1) {
      const second = normals[j];
      if (second === undefined) continue;
      const bx = first.x + second.x;
      const by = first.y + second.y;
      const bLen = Math.sqrt(bx * bx + by * by);
      if (bLen <= 0.01) continue;
      const bux = bx / bLen;
      const buy = by / bLen;
      const dot = ux * bux + uy * buy;
      if (dot > 0.01) {
        trials.push({
          x: previous.x + bux * (dot * desiredLen),
          y: previous.y + buy * (dot * desiredLen),
        });
      }
    }
  }

  let best: Point | null = null;
  let bestProgress = 0.05;
  for (const trial of trials) {
    const p = resolveCollision(trial, area, radius);
    if (!validResolved(p, area, radius)) continue;
    const progress = (p.x - previous.x) * ux + (p.y - previous.y) * uy;
    if (progress >= bestProgress) {
      bestProgress = progress;
      best = p;
    }
  }
  if (best !== null) return best;
  const nudged = cornerNudge(previous, ux, uy, desiredLen, area, radius);
  return nudged ?? previous;
}
