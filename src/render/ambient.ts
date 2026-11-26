import type { AmbientFlyer } from "../content/ambient";

export type FlyerPosition = { x: number; y: number; frame: number; flip: boolean };

function distance(a: [number, number], b: [number, number]): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  return Math.sqrt(dx * dx + dy * dy);
}

// Evaluates a uniform Catmull-Rom spline segment from p1 to p2 at t in [0, 1].
// Endpoints return exact p1 / p2 so vertex passes have zero roundoff drift.
function catmullRom(
  p0: number,
  p1: number,
  p2: number,
  p3: number,
  t: number,
): number {
  if (t <= 0) return p1;
  if (t >= 1) return p2;
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (
    2 * p1 +
    (-p0 + p2) * t +
    (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
    (-p0 + 3 * p1 - 3 * p2 + p3) * t3
  );
}

function catmullRomDerivative(
  p0: number,
  p1: number,
  p2: number,
  p3: number,
  t: number,
): number {
  const t2 = t * t;
  return 0.5 * (
    (-p0 + p2) +
    2 * (2 * p0 - 5 * p1 + 4 * p2 - p3) * t +
    3 * (-p0 + 3 * p1 - 3 * p2 + p3) * t2
  );
}

export function flyerAt(
  flyer: AmbientFlyer,
  tick: number,
  frameCount = 2,
): FlyerPosition {
  const points = flyer.path;
  const count = points.length;
  const pointAt = (index: number): [number, number] => {
    const wrapped = ((index % count) + count) % count;
    const point = points[wrapped];
    if (point === undefined) throw new Error("ambient flyer path is empty");
    return point;
  };
  const lengths = points.map((point, index) => distance(point, pointAt(index + 1)));
  const total = lengths.reduce((sum, length) => sum + length, 0);
  const loopTick = ((tick + flyer.phase) % flyer.loopTicks + flyer.loopTicks) % flyer.loopTicks;
  const progress = loopTick / flyer.loopTicks;
  let distanceAlong = progress * total;
  let segment = 0;
  while (segment < lengths.length - 1 && distanceAlong > (lengths[segment] ?? 0)) {
    distanceAlong -= lengths[segment] ?? 0;
    segment += 1;
  }
  const p0 = pointAt(segment - 1);
  const p1 = pointAt(segment);
  const p2 = pointAt(segment + 1);
  const p3 = pointAt(segment + 2);
  const segmentLength = lengths[segment] ?? 1;
  const ratio = segmentLength === 0 ? 0 : distanceAlong / segmentLength;
  const x = catmullRom(p0[0], p1[0], p2[0], p3[0], ratio);
  const y = catmullRom(p0[1], p1[1], p2[1], p3[1], ratio);
  const dx = catmullRomDerivative(p0[0], p1[0], p2[0], p3[0], ratio);
  const rawBob = Math.sin((tick + flyer.phase) * Math.PI * 2 / flyer.loopTicks) * 4;
  const bob = Math.abs(rawBob) < 1e-12 ? 0 : rawBob;
  const frames = Math.max(1, Math.floor(frameCount));
  const rawFrame = Math.floor((tick + flyer.phase) / flyer.frameTicks);
  const frame = ((rawFrame % frames) + frames) % frames;
  return {
    x,
    y: y + bob,
    frame,
    flip: Math.abs(dx) < 1e-9 ? p2[0] < p1[0] : dx < 0,
  };
}
