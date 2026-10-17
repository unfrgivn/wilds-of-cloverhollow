import type { SkeeCalibration, SkeeView } from "../core";

type Point = { x: number; y: number };
type Ball = { x: number; y: number; radius: number };

// How the skee-ball close-up is drawn (spec 8.2).
export const skeeLook = {
  // The close-up shows this share of the painting's width, centred, from a
  // quarter of the plate's height above it down to this far up the lane (a
  // share of its length from its foot): the hood and the upper lane, large
  // enough for the target to read on a phone.
  shownWidth: 0.75,
  shownFrom: 0.5,
  // The ball's radius on the lane, as a share of the lane's width there.
  ball: 0.045,
  // The arrow stands this far up the lane, where the ball sets off from, as
  // long as this share of the lane's width there.
  arrowAt: 0.58,
  arrow: 0.18,
  // The hop over the hump into the board arcs this share of the board's height
  // above the straight line.
  hop: 0.3,
  // A ball in the hole sinks to this share of its size.
  sunk: 0.4,
} as const;

export type Rect = { x: number; y: number; width: number; height: number };
export type Ellipse = { cx: number; cy: number; rx: number; ry: number };
export type Target = Ellipse & { points: number; lit: boolean };
export type SkeeLayout = {
  // CSS px per painting px; the whole painting's size; and the part of it the
  // close-up shows (`skeeFrame`), all in the painting's own CSS px.
  scale: number;
  width: number;
  height: number;
  frame: Rect;
  board: Rect;
  plate: Rect;
  // The score sticker's top-left corner, in the empty paper left of the hood.
  hud: { x: number; y: number };
  // The target drawn on the board: the rings from the outside in, the two
  // corner holes, and where the floor's points are lettered; each lit while a
  // ball sits in it.
  rings: Target[];
  corners: Target[];
  floor: { x: number; y: number; points: number; lit: boolean };
  // The arrow at the foot of the lane: where it stands, which way it points
  // (radians, 0 up the screen), how long it is, and whether the aim is set.
  arrow: { x: number; y: number; angle: number; length: number; set: boolean } | null;
  // While Fae winds up: where on the board the ball would land now, and
  // whether it would fly off the top.
  ghost: { x: number; y: number; radius: number; over: boolean } | null;
  ball: Ball | null;
  // The points a ball scores, popping up over its hole once it's in.
  pop: { x: number; y: number; points: number } | null;
};

const lerp = (from: number, to: number, share: number): number => from + (to - from) * share;

// A point on the lane: `across` from -1 (its left edge) to 1 (its right),
// `up` from 0 (its foot) to 1 (the hump). Like the claw machine's floor, the
// lane is a plane in one-point perspective, so a share u of its length lies a
// share t = u / (s + (1 - s) u) of the way up the painting, s being the far
// edge's width over the near edge's.
//
//          far.left ______ far.right        the hump
//                  /      \\
//                 /    •   \\                up = u, across = a
//                /__________\\
//       near.left              near.right   the foot
export function lanePoint(
  calibration: SkeeCalibration,
  scale: number,
  across: number,
  up: number,
): { x: number; y: number; width: number } {
  const { near, far } = calibration.lane;
  const shrink = (far.right - far.left) / (near.right - near.left);
  const u = Math.min(1, Math.max(0, up));
  const t = u / (shrink + (1 - shrink) * u);
  const left = lerp(near.left, far.left, t);
  const right = lerp(near.right, far.right, t);
  return {
    x: ((left + right) / 2 + (across * (right - left)) / 2) * scale,
    y: lerp(near.y, far.y, t) * scale,
    width: (right - left) * scale,
  };
}

// Painting px per board unit: the board's face is seen straight on, so one
// scale both ways keeps its rings round. The board units fill the painted face
// across or up, whichever runs out first.
export function boardUnit(view: Pick<SkeeView, "board">, calibration: SkeeCalibration): number {
  return Math.min(calibration.board.w / view.board.width,
    calibration.board.h / view.board.height);
}

// A point on the target board, in board units (x across from its middle, y up
// from its foot), on the painted board's face: centred across it, its foot on
// the face's bottom edge, where the balls come in over the hump.
export function boardPoint(
  view: Pick<SkeeView, "board">,
  calibration: SkeeCalibration,
  scale: number,
  x: number,
  y: number,
): Point {
  const { board } = calibration;
  const unit = boardUnit(view, calibration);
  return {
    x: (board.x + board.w / 2 + x * unit) * scale,
    y: (board.y + board.h - y * unit) * scale,
  };
}

// The part of the painting the close-up shows, in painting px (`skeeLook`).
export function skeeFrame(
  calibration: SkeeCalibration,
): { x: number; y: number; w: number; h: number } {
  const w = Math.round(calibration.size.w * skeeLook.shownWidth);
  const x = Math.round((calibration.size.w - w) / 2);
  const y = Math.max(0, Math.round(calibration.plate.y - calibration.plate.h / 4));
  const bottom = Math.ceil(lanePoint(calibration, 1, 0, skeeLook.shownFrom).y);
  return { x, y, w, h: bottom - y };
}

// The close-up in CSS px, from the cabinet's top-left corner.
export function layoutSkee(
  view: SkeeView,
  calibration: SkeeCalibration,
  scale: number,
): SkeeLayout {
  const round = Math.round;
  const box = (rect: { x: number; y: number; w: number; h: number }): Rect => ({
    x: round(rect.x * scale), y: round(rect.y * scale),
    width: round(rect.w * scale), height: round(rect.h * scale),
  });
  const onBoard = (x: number, y: number): Point => boardPoint(view, calibration, scale, x, y);
  // Board units to px: the same both ways.
  const across = boardUnit(view, calibration) * scale;
  const tall = across;
  const lateral = (x: number): number => x / (view.board.width / 2);

  // The target the ball in the hole lights.
  const zone = view.ball?.stage === "landed" ? view.ball.zone : null;
  const centre = onBoard(view.centre.x, view.centre.y);
  const rings = view.rings.map((item, index) => ({
    cx: round(centre.x), cy: round(centre.y), rx: round(item.radius * across),
    ry: round(item.radius * tall), points: item.points,
    lit: zone?.kind === "ring" && zone.index === index,
  })).reverse();
  const corners = ([-1, 1] as const).map((side) => {
    const point = onBoard(side * view.corners.x, view.corners.y);
    return {
      cx: round(point.x), cy: round(point.y), rx: round(view.corners.radius * across),
      ry: round(view.corners.radius * tall), points: view.corners.points,
      lit: zone?.kind === "corner" && zone.side === side,
    };
  });
  const floorAt = onBoard(0, 0);

  // The arrow while Fae aims and winds up: at the foot, pointing up the lane.
  const aiming = view.phase === "aiming" || view.phase === "winding" ||
    view.phase === "powering";
  const arrowFoot = lanePoint(calibration, scale, lateral(view.aim), skeeLook.arrowAt);
  const arrowAhead = lanePoint(calibration, scale, lateral(view.aim), skeeLook.arrowAt + 0.2);
  const arrow = aiming ? {
    x: round(arrowFoot.x), y: round(arrowFoot.y),
    angle: Math.atan2(arrowAhead.x - arrowFoot.x, arrowFoot.y - arrowAhead.y),
    length: round(skeeLook.arrow * arrowFoot.width), set: view.phase !== "aiming",
  } : null;

  // The ghost: the meter shown as where the ball would land on the board now.
  const onBoardRadius = skeeLook.ball * lanePoint(calibration, scale, 0, 1).width;
  const ghostY = view.power === null ? 0 : (view.power.fill / view.power.top) * view.board.height;
  const ghostAt = onBoard(view.aim, Math.min(ghostY, view.board.height));
  const ghost = view.power === null || view.phase !== "powering" ? null : {
    x: round(ghostAt.x), y: round(ghostAt.y), radius: round(onBoardRadius),
    over: ghostY > view.board.height,
  };

  const frame = skeeFrame(calibration);
  const landedAt = view.ball?.stage === "landed" && view.ball.y <= view.board.height
    ? onBoard(view.ball.x, view.ball.y) : null;
  return {
    scale,
    width: round(calibration.size.w * scale),
    height: round(calibration.size.h * scale),
    frame: box(frame),
    board: box(calibration.board),
    plate: box(calibration.plate),
    hud: {
      x: round((frame.x + frame.w * 0.04) * scale),
      y: round((calibration.plate.y + calibration.plate.h * 0.1) * scale),
    },
    rings,
    corners,
    floor: {
      x: round(floorAt.x), y: round(floorAt.y), points: view.floor,
      lit: zone?.kind === "floor",
    },
    arrow,
    ghost,
    ball: view.ball === null ? null
      : placeBall(view, view.ball, calibration, scale, onBoardRadius),
    pop: view.ball?.stage !== "landed" ? null : {
      x: round(landedAt?.x ?? floorAt.x),
      y: round((landedAt?.y ?? floorAt.y) - onBoardRadius * 2.2),
      points: view.ball.points,
    },
  };
}

// The ball: up the lane, over the hump in an arc, then into its hole (or,
// rolled too hard, off the top and back down to the floor's pocket).
function placeBall(
  view: SkeeView,
  ball: NonNullable<SkeeView["ball"]>,
  calibration: SkeeCalibration,
  scale: number,
  onBoardRadius: number,
): Ball {
  const round = Math.round;
  const across = ball.x / (view.board.width / 2);
  const onBoard = (x: number, y: number): Point => boardPoint(view, calibration, scale, x, y);
  if (ball.stage === "rolling") {
    const at = lanePoint(calibration, scale, across,
      lerp(skeeLook.arrowAt, 1, ball.progress));
    const radius = skeeLook.ball * at.width;
    return { x: round(at.x), y: round(at.y - radius), radius: round(radius) };
  }
  const hump = lanePoint(calibration, scale, across, 1);
  const humpRadius = skeeLook.ball * hump.width;
  const end = onBoard(ball.x, Math.min(ball.y, view.board.height));
  if (ball.stage === "hopping") {
    const arc = skeeLook.hop * calibration.board.h * scale * 4 *
      ball.progress * (1 - ball.progress);
    return {
      x: round(lerp(hump.x, end.x, ball.progress)),
      y: round(lerp(hump.y - humpRadius, end.y, ball.progress) - arc),
      radius: round(lerp(humpRadius, onBoardRadius, ball.progress)),
    };
  }
  if (ball.y > view.board.height) {
    const pocket = onBoard(ball.x, 0);
    return {
      x: round(end.x), y: round(lerp(end.y, pocket.y, ball.progress)),
      radius: round(onBoardRadius),
    };
  }
  return {
    x: round(end.x), y: round(end.y),
    radius: round(onBoardRadius * lerp(1, skeeLook.sunk, ball.progress)),
  };
}
