import type { Point } from "../core";

type Size = { width: number; height: number };

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function axisCamera(
  previous: number | undefined,
  player: number,
  viewSize: number,
  areaSize: number,
  deadZone: number,
): number {
  if (areaSize <= viewSize) return (areaSize - viewSize) / 2;
  const centre = player - viewSize / 2;
  const minimum = centre - deadZone / 2;
  const maximum = centre + deadZone / 2;
  const camera =
    previous === undefined ? centre : clamp(previous, minimum, maximum);
  return clamp(camera, 0, areaSize - viewSize);
}

export function followCamera(
  previous: Point | undefined,
  player: Point,
  view: Size,
  area: Size,
  deadZone: Point,
): Point {
  return {
    x: axisCamera(previous?.x, player.x, view.width, area.width, deadZone.x),
    y: axisCamera(previous?.y, player.y, view.height, area.height, deadZone.y),
  };
}
