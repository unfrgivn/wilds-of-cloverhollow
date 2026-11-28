import type { Direction, Point } from "../core";

type Size = { width: number; height: number };

const LOOK_AHEAD_X = 22;
const LOOK_AHEAD_Y = 14;
const CAMERA_DAMP = 0.14;
const CAMERA_SNAP_EPSILON = 0.15;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

export function interpolatePoint(
  previous: Point,
  current: Point,
  alpha: number,
): Point {
  const t = clamp(alpha, 0, 1);
  return {
    x: previous.x + (current.x - previous.x) * t,
    y: previous.y + (current.y - previous.y) * t,
  };
}

function lookAhead(player: Point, facing: Direction): Point {
  if (facing === "left") return { x: player.x - LOOK_AHEAD_X, y: player.y };
  if (facing === "right") return { x: player.x + LOOK_AHEAD_X, y: player.y };
  if (facing === "up") return { x: player.x, y: player.y - LOOK_AHEAD_Y };
  return { x: player.x, y: player.y + LOOK_AHEAD_Y };
}

function dampAxis(
  previous: number,
  target: number,
  viewSize: number,
  areaSize: number,
): number {
  if (areaSize <= viewSize) return (areaSize - viewSize) / 2;
  const gap = target - previous;
  const next = Math.abs(gap) <= CAMERA_SNAP_EPSILON
    ? target
    : previous + gap * CAMERA_DAMP;
  return clamp(next, 0, areaSize - viewSize);
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

export function smoothFollowCamera(
  previous: Point | undefined,
  player: Point,
  facing: Direction,
  view: Size,
  area: Size,
  deadZone: Point,
  snap: boolean,
): Point {
  if (snap || previous === undefined) {
    return followCamera(previous, player, view, area, deadZone);
  }
  const target = followCamera(
    previous,
    lookAhead(player, facing),
    view,
    area,
    deadZone,
  );
  return {
    x: dampAxis(previous.x, target.x, view.width, area.width),
    y: dampAxis(previous.y, target.y, view.height, area.height),
  };
}

export function worldToScreen(
  point: Point,
  camera: Point,
  viewWidth: number,
  viewHeight: number,
  width: number,
  height: number,
): Point {
  const scale = Math.min(width / viewWidth, height / viewHeight);
  return {
    x: (width - viewWidth * scale) / 2 + (point.x - camera.x) * scale,
    y: (height - viewHeight * scale) / 2 + (point.y - camera.y) * scale,
  };
}

export function screenToWorld(
  point: Point,
  camera: Point,
  viewWidth: number,
  viewHeight: number,
  width: number,
  height: number,
): Point {
  const scale = Math.min(width / viewWidth, height / viewHeight);
  if (!Number.isFinite(scale) || scale <= 0) return { x: camera.x, y: camera.y };
  return {
    x: camera.x + (point.x - (width - viewWidth * scale) / 2) / scale,
    y: camera.y + (point.y - (height - viewHeight * scale) / 2) / scale,
  };
}
