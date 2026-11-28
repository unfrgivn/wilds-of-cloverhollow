import { distance, distanceToPolygon, pointInPolygon } from "./geometry";
import type { Area, Point, Polygon } from "./types";

export const NAV_CELL_SIZE = 10;

const SQRT2 = 1.41421356;
const OCTILE_DIAG = SQRT2 - 2;

const DIRS: readonly (readonly [number, number, number])[] = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, SQRT2],
  [-1, 1, SQRT2],
  [1, -1, SQRT2],
  [-1, -1, SQRT2],
];

export type NavField = {
  width: number;
  height: number;
  cellSize: number;
  cols: number;
  rows: number;
  radius: number;
  clearance: Float32Array;
  reachable: Uint8Array;
};

export type NavCluster = {
  count: number;
  cx: number;
  cy: number;
};

export type NavAuditReport = {
  areaId: string;
  freeCells: number;
  reachableCells: number;
  unreachableCells: number;
  tightCells: number;
  falseGapCells: number;
  minSpawnClearance: number;
  unreachableClusters: NavCluster[];
};

type BoundedPolygon = {
  polygon: Polygon;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

function boundPolygon(polygon: Polygon): BoundedPolygon {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of polygon) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { polygon, minX, minY, maxX, maxY };
}

function signedClearance(
  pt: Point,
  walkable: Polygon,
  blockers: readonly BoundedPolygon[],
): number {
  if (!pointInPolygon(pt, walkable)) return -distanceToPolygon(pt, walkable);
  let minD = distanceToPolygon(pt, walkable);
  let insideBlocker = false;
  let worstNeg = 0;
  for (const blocker of blockers) {
    if (insideBlocker) {
      if (
        pt.x < blocker.minX ||
        pt.x > blocker.maxX ||
        pt.y < blocker.minY ||
        pt.y > blocker.maxY
      )
        continue;
      if (pointInPolygon(pt, blocker.polygon)) {
        const neg = -distanceToPolygon(pt, blocker.polygon);
        if (neg < worstNeg) worstNeg = neg;
      }
      continue;
    }
    const bx =
      pt.x < blocker.minX
        ? blocker.minX - pt.x
        : pt.x > blocker.maxX
          ? pt.x - blocker.maxX
          : 0;
    const by =
      pt.y < blocker.minY
        ? blocker.minY - pt.y
        : pt.y > blocker.maxY
          ? pt.y - blocker.maxY
          : 0;
    if (bx > 0 || by > 0) {
      if (bx * bx + by * by >= minD * minD) continue;
      const d = distanceToPolygon(pt, blocker.polygon);
      if (d < minD) minD = d;
      continue;
    }
    if (pointInPolygon(pt, blocker.polygon)) {
      insideBlocker = true;
      worstNeg = -distanceToPolygon(pt, blocker.polygon);
    } else {
      const d = distanceToPolygon(pt, blocker.polygon);
      if (d < minD) minD = d;
    }
  }
  return insideBlocker ? worstNeg : minD;
}

function findSpawnSeed(
  spawn: Point,
  clearance: Float32Array,
  cols: number,
  rows: number,
  cellSize: number,
  radius: number,
): number {
  const sx = clamp(Math.round(spawn.x / cellSize), 0, cols - 1);
  const sy = clamp(Math.round(spawn.y / cellSize), 0, rows - 1);
  const exact = sy * cols + sx;
  if ((clearance[exact] ?? -Infinity) >= radius) return exact;
  let bestIdx = -1;
  let bestDistSq = Infinity;
  for (let dy = -1; dy <= 1; dy += 1) {
    const ny = sy + dy;
    if (ny < 0 || ny >= rows) continue;
    for (let dx = -1; dx <= 1; dx += 1) {
      const nx = sx + dx;
      if (nx < 0 || nx >= cols) continue;
      const idx = ny * cols + nx;
      if ((clearance[idx] ?? -Infinity) < radius) continue;
      const wx = nx * cellSize - spawn.x;
      const wy = ny * cellSize - spawn.y;
      const dSq = wx * wx + wy * wy;
      if (dSq < bestDistSq) {
        bestDistSq = dSq;
        bestIdx = idx;
      }
    }
  }
  return bestIdx;
}

export function buildNavField(
  area: Area,
  radius: number,
  cellSize = NAV_CELL_SIZE,
): NavField {
  const cols = Math.ceil(area.width / cellSize) + 1;
  const rows = Math.ceil(area.height / cellSize) + 1;
  const total = cols * rows;
  const clearance = new Float32Array(total);
  const reachable = new Uint8Array(total);
  const blockers: BoundedPolygon[] = [];
  for (const poly of area.blockers)
    if (poly.length > 0) blockers.push(boundPolygon(poly));

  for (let gy = 0; gy < rows; gy += 1) {
    const y = gy * cellSize;
    const rowOffset = gy * cols;
    for (let gx = 0; gx < cols; gx += 1) {
      clearance[rowOffset + gx] = signedClearance(
        { x: gx * cellSize, y },
        area.walkable,
        blockers,
      );
    }
  }

  const queue = new Int32Array(total);
  let head = 0;
  let tail = 0;
  for (const spawn of Object.values(area.spawns)) {
    const seed = findSpawnSeed(spawn, clearance, cols, rows, cellSize, radius);
    if (seed >= 0 && reachable[seed] === 0) {
      reachable[seed] = 1;
      queue[tail] = seed;
      tail += 1;
    }
  }

  while (head < tail) {
    const current = queue[head] ?? 0;
    head += 1;
    const gx = current % cols;
    const gy = (current - gx) / cols;
    for (const [dx, dy] of DIRS) {
      const nx = gx + dx;
      const ny = gy + dy;
      if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;
      const nIdx = ny * cols + nx;
      if (reachable[nIdx] === 1) continue;
      if ((clearance[nIdx] ?? -Infinity) < radius) continue;
      if (dx !== 0 && dy !== 0) {
        if ((clearance[gy * cols + nx] ?? -Infinity) < radius) continue;
        if ((clearance[ny * cols + gx] ?? -Infinity) < radius) continue;
      }
      reachable[nIdx] = 1;
      queue[tail] = nIdx;
      tail += 1;
    }
  }

  return {
    width: area.width,
    height: area.height,
    cellSize,
    cols,
    rows,
    radius,
    clearance,
    reachable,
  };
}

export function clearanceAt(field: NavField, point: Point): number {
  const fx = clamp(point.x / field.cellSize, 0, field.cols - 1);
  const fy = clamp(point.y / field.cellSize, 0, field.rows - 1);
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const x1 = Math.min(x0 + 1, field.cols - 1);
  const y1 = Math.min(y0 + 1, field.rows - 1);
  const tx = fx - x0;
  const ty = fy - y0;
  const row0 = y0 * field.cols;
  const row1 = y1 * field.cols;
  const c00 = field.clearance[row0 + x0] ?? 0;
  const c10 = field.clearance[row0 + x1] ?? 0;
  const c01 = field.clearance[row1 + x0] ?? 0;
  const c11 = field.clearance[row1 + x1] ?? 0;
  const top = c00 + (c10 - c00) * tx;
  const bottom = c01 + (c11 - c01) * tx;
  return top + (bottom - top) * ty;
}

export function gradientAt(field: NavField, point: Point): Point {
  const h = field.cellSize * 0.5;
  const gx =
    (clearanceAt(field, { x: point.x + h, y: point.y }) -
      clearanceAt(field, { x: point.x - h, y: point.y })) /
    (2 * h);
  const gy =
    (clearanceAt(field, { x: point.x, y: point.y + h }) -
      clearanceAt(field, { x: point.x, y: point.y - h })) /
    (2 * h);
  const mag = Math.sqrt(gx * gx + gy * gy);
  if (mag < 0.0001) return { x: 0, y: 0 };
  return { x: gx / mag, y: gy / mag };
}

export function nearestWalkablePoint(
  field: NavField,
  point: Point,
  maxSearchCells = 12,
): Point | null {
  const cx = clamp(Math.round(point.x / field.cellSize), 0, field.cols - 1);
  const cy = clamp(Math.round(point.y / field.cellSize), 0, field.rows - 1);
  if (
    point.x >= 0 &&
    point.x <= field.width &&
    point.y >= 0 &&
    point.y <= field.height &&
    clearanceAt(field, point) >= field.radius &&
    field.reachable[cy * field.cols + cx] === 1
  ) {
    return { x: point.x, y: point.y };
  }

  let bestX = -1;
  let bestY = -1;
  let bestDistSq = Infinity;

  const checkCell = (gx: number, gy: number): void => {
    if (gx < 0 || gx >= field.cols || gy < 0 || gy >= field.rows) return;
    const idx = gy * field.cols + gx;
    if (field.reachable[idx] !== 1) return;
    if ((field.clearance[idx] ?? -Infinity) < field.radius) return;
    const dx = gx * field.cellSize - point.x;
    const dy = gy * field.cellSize - point.y;
    const dSq = dx * dx + dy * dy;
    if (dSq < bestDistSq) {
      bestDistSq = dSq;
      bestX = gx;
      bestY = gy;
    }
  };

  checkCell(cx, cy);
  for (let ring = 1; ring <= maxSearchCells; ring += 1) {
    const minPossible = (ring - 0.5) * field.cellSize;
    if (bestX >= 0 && minPossible * minPossible >= bestDistSq) break;
    const minX = cx - ring;
    const maxX = cx + ring;
    const minY = cy - ring;
    const maxY = cy + ring;
    for (let gx = minX; gx <= maxX; gx += 1) {
      checkCell(gx, minY);
      checkCell(gx, maxY);
    }
    for (let gy = minY + 1; gy < maxY; gy += 1) {
      checkCell(minX, gy);
      checkCell(maxX, gy);
    }
  }

  if (bestX < 0) return null;
  return { x: bestX * field.cellSize, y: bestY * field.cellSize };
}

export function segmentWalkable(
  field: NavField,
  a: Point,
  b: Point,
  minClearance?: number,
): boolean {
  const threshold = minClearance ?? field.radius + 0.5;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  const stepSize = Math.max(0.5, field.cellSize * 0.5);
  const steps = Math.max(1, Math.ceil(length / stepSize));
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const sample = { x: a.x + dx * t, y: a.y + dy * t };
    if (clearanceAt(field, sample) < threshold) return false;
  }
  return true;
}

function heapPush(
  nodes: number[],
  scores: number[],
  node: number,
  score: number,
): void {
  let index = nodes.length;
  nodes.push(node);
  scores.push(score);
  while (index > 0) {
    const parent = (index - 1) >> 1;
    const parentScore = scores[parent] ?? Infinity;
    if (score >= parentScore) break;
    nodes[index] = nodes[parent] ?? 0;
    scores[index] = parentScore;
    nodes[parent] = node;
    scores[parent] = score;
    index = parent;
  }
}

function heapPop(nodes: number[], scores: number[]): number {
  const top = nodes[0] ?? -1;
  const lastNode = nodes.pop();
  const lastScore = scores.pop();
  if (nodes.length === 0 || lastNode === undefined || lastScore === undefined)
    return top;
  nodes[0] = lastNode;
  scores[0] = lastScore;
  let index = 0;
  const size = nodes.length;
  while (true) {
    const left = index * 2 + 1;
    const right = left + 1;
    let smallest = index;
    let smallestScore = scores[index] ?? Infinity;
    if (left < size) {
      const leftScore = scores[left] ?? Infinity;
      if (leftScore < smallestScore) {
        smallest = left;
        smallestScore = leftScore;
      }
    }
    if (right < size) {
      const rightScore = scores[right] ?? Infinity;
      if (rightScore < smallestScore) {
        smallest = right;
        smallestScore = rightScore;
      }
    }
    if (smallest === index) break;
    const curNode = nodes[index] ?? 0;
    const curScore = scores[index] ?? Infinity;
    nodes[index] = nodes[smallest] ?? 0;
    scores[index] = smallestScore;
    nodes[smallest] = curNode;
    scores[smallest] = curScore;
    index = smallest;
  }
  return top;
}

function stringPull(field: NavField, raw: readonly Point[]): Point[] {
  const smooth: Point[] = [];
  let index = 0;
  while (index < raw.length - 1) {
    const current = raw[index];
    if (current === undefined) break;
    let next = index + 1;
    for (let j = raw.length - 1; j > index + 1; j -= 1) {
      const target = raw[j];
      if (target !== undefined && segmentWalkable(field, current, target)) {
        next = j;
        break;
      }
    }
    const chosen = raw[next];
    if (chosen !== undefined) smooth.push(chosen);
    index = next;
  }
  return smooth;
}

export function findPath(
  field: NavField,
  start: Point,
  goal: Point,
  maxNodes = 4000,
): Point[] {
  const snappedStart = nearestWalkablePoint(field, start);
  const snappedGoal = nearestWalkablePoint(field, goal);
  if (snappedStart === null || snappedGoal === null) return [];

  if (
    distance(snappedStart, snappedGoal) <= field.cellSize &&
    segmentWalkable(field, snappedStart, snappedGoal, field.radius)
  ) {
    return [snappedGoal];
  }

  const { cols, rows, cellSize, radius, clearance, reachable } = field;
  const startGx = clamp(Math.round(snappedStart.x / cellSize), 0, cols - 1);
  const startGy = clamp(Math.round(snappedStart.y / cellSize), 0, rows - 1);
  const goalGx = clamp(Math.round(snappedGoal.x / cellSize), 0, cols - 1);
  const goalGy = clamp(Math.round(snappedGoal.y / cellSize), 0, rows - 1);
  const startIdx = startGy * cols + startGx;
  const goalIdx = goalGy * cols + goalGx;

  if (startIdx === goalIdx) return [snappedGoal];

  const total = cols * rows;
  const gScore = new Float32Array(total);
  gScore.fill(Infinity);
  const cameFrom = new Int32Array(total);
  cameFrom.fill(-1);
  const closed = new Uint8Array(total);

  const heuristic = (gx: number, gy: number): number => {
    const adx = Math.abs(gx - goalGx);
    const ady = Math.abs(gy - goalGy);
    return adx + ady + OCTILE_DIAG * Math.min(adx, ady);
  };

  const openNodes: number[] = [];
  const openScores: number[] = [];
  gScore[startIdx] = 0;
  heapPush(openNodes, openScores, startIdx, heuristic(startGx, startGy));

  let found = false;
  let expanded = 0;
  while (openNodes.length > 0) {
    const current = heapPop(openNodes, openScores);
    if (current < 0) break;
    if (closed[current] === 1) continue;
    closed[current] = 1;
    if (current === goalIdx) {
      found = true;
      break;
    }
    expanded += 1;
    if (expanded >= maxNodes) break;

    const gx = current % cols;
    const gy = (current - gx) / cols;
    const baseG = gScore[current] ?? Infinity;

    for (const [dx, dy, stepDist] of DIRS) {
      const nx = gx + dx;
      const ny = gy + dy;
      if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;
      const nIdx = ny * cols + nx;
      if (closed[nIdx] === 1) continue;
      if (reachable[nIdx] !== 1) continue;
      const nClear = clearance[nIdx] ?? -Infinity;
      if (nClear < radius) continue;
      if (dx !== 0 && dy !== 0) {
        const adj1 = gy * cols + nx;
        const adj2 = ny * cols + gx;
        if (
          reachable[adj1] !== 1 ||
          reachable[adj2] !== 1 ||
          (clearance[adj1] ?? -Infinity) < radius ||
          (clearance[adj2] ?? -Infinity) < radius
        )
          continue;
      }
      const penalty = 1 + 6 / Math.max(1, nClear - radius + 1);
      const tentative = baseG + stepDist * penalty;
      if (tentative < (gScore[nIdx] ?? Infinity)) {
        cameFrom[nIdx] = current;
        gScore[nIdx] = tentative;
        heapPush(openNodes, openScores, nIdx, tentative + heuristic(nx, ny));
      }
    }
  }

  if (!found) return [];

  const cells: number[] = [];
  let cursor = goalIdx;
  while (cursor >= 0) {
    cells.push(cursor);
    if (cursor === startIdx) break;
    cursor = cameFrom[cursor] ?? -1;
  }
  cells.reverse();

  const raw: Point[] = [snappedStart];
  for (const idx of cells) {
    const gx = idx % cols;
    const gy = (idx - gx) / cols;
    const pt = { x: gx * cellSize, y: gy * cellSize };
    const prev = raw[raw.length - 1];
    if (prev === undefined || distance(prev, pt) > 0.01) raw.push(pt);
  }
  const last = raw[raw.length - 1];
  if (last === undefined || distance(last, snappedGoal) > 0.01) {
    raw.push(snappedGoal);
  } else {
    raw[raw.length - 1] = snappedGoal;
  }

  if (raw.length <= 1) return [snappedGoal];
  return stringPull(field, raw);
}

export function auditAreaNavigation(area: Area, radius: number): NavAuditReport {
  const field = buildNavField(area, radius);
  const { cols, rows, cellSize, clearance, reachable } = field;
  const total = cols * rows;

  let freeCells = 0;
  let reachableCells = 0;
  let tightCells = 0;
  let falseGapCells = 0;

  for (let i = 0; i < total; i += 1) {
    const c = clearance[i] ?? -Infinity;
    if (c >= radius) {
      freeCells += 1;
      if (reachable[i] === 1) reachableCells += 1;
      if (c < radius + 12) tightCells += 1;
    } else if (c > 8) {
      falseGapCells += 1;
    }
  }

  const spawns = Object.values(area.spawns);
  let minSpawnClearance = spawns.length === 0 ? 0 : Infinity;
  for (const spawn of spawns) {
    const c = clearanceAt(field, spawn);
    if (c < minSpawnClearance) minSpawnClearance = c;
  }

  const visited = new Uint8Array(total);
  const queue = new Int32Array(total);
  const unreachableClusters: NavCluster[] = [];

  for (let i = 0; i < total; i += 1) {
    if (visited[i] === 1) continue;
    if ((clearance[i] ?? -Infinity) < radius || reachable[i] === 1) continue;
    let head = 0;
    let tail = 0;
    visited[i] = 1;
    queue[tail] = i;
    tail += 1;
    let count = 0;
    let sumX = 0;
    let sumY = 0;
    while (head < tail) {
      const cur = queue[head] ?? 0;
      head += 1;
      const gx = cur % cols;
      const gy = (cur - gx) / cols;
      count += 1;
      sumX += gx * cellSize;
      sumY += gy * cellSize;
      for (const [dx, dy] of DIRS) {
        const nx = gx + dx;
        const ny = gy + dy;
        if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;
        const nIdx = ny * cols + nx;
        if (visited[nIdx] === 1) continue;
        if ((clearance[nIdx] ?? -Infinity) < radius || reachable[nIdx] === 1)
          continue;
        visited[nIdx] = 1;
        queue[tail] = nIdx;
        tail += 1;
      }
    }
    if (count >= 4) {
      unreachableClusters.push({
        count,
        cx: sumX / count,
        cy: sumY / count,
      });
    }
  }

  unreachableClusters.sort((a, b) => b.count - a.count);

  return {
    areaId: area.id,
    freeCells,
    reachableCells,
    unreachableCells: freeCells - reachableCells,
    tightCells,
    falseGapCells,
    minSpawnClearance,
    unreachableClusters,
  };
}
