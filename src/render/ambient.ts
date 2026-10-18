import type { AmbientFlyer } from "../content/ambient";

export type FlyerPosition = { x: number; y: number; frame: number; flip: boolean };

function distance(a: [number, number], b: [number, number]): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  return Math.sqrt(dx * dx + dy * dy);
}

export function flyerAt(flyer: AmbientFlyer, tick: number): FlyerPosition {
  const points = flyer.path;
  const pointAt = (index: number): [number, number] => {
    const point = points[index];
    if (point === undefined) throw new Error("ambient flyer path is empty");
    return point;
  };
  const lengths = points.map((point, index) =>
    distance(point, pointAt((index + 1) % points.length)));
  const total = lengths.reduce((sum, length) => sum + length, 0);
  const progress = ((tick + flyer.phase) % flyer.loopTicks + flyer.loopTicks) % flyer.loopTicks /
    flyer.loopTicks;
  let distanceAlong = progress * total;
  let segment = 0;
  while (segment < lengths.length - 1 && distanceAlong > (lengths[segment] ?? 0)) {
    distanceAlong -= lengths[segment] ?? 0;
    segment += 1;
  }
  const from = pointAt(segment);
  const to = pointAt((segment + 1) % points.length);
  const segmentLength = lengths[segment] ?? 1;
  const ratio = segmentLength === 0 ? 0 : distanceAlong / segmentLength;
  const x = from[0] + (to[0] - from[0]) * ratio;
  const y = from[1] + (to[1] - from[1]) * ratio;
  const rawBob = Math.sin((tick + flyer.phase) * Math.PI * 2 / flyer.loopTicks) * 4;
  const bob = Math.abs(rawBob) < 1e-12 ? 0 : rawBob;
  return {
    x,
    y: y + bob,
    frame: Math.floor((tick + flyer.phase) / flyer.frameTicks) % 2,
    flip: to[0] < from[0],
  };
}
