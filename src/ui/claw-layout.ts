import type { ArcadeView, ClawCalibration } from "../core";

// How the claw machine close-up is drawn (spec 8.2). Sizes are shares of a
// plush's box: the square frame each plush is painted in (320 px in the atlas).
export const clawLook = {
  // A plush's box at the front glass, as a share of the floor's front edge.
  plush: 0.28,
  // Each level of the heap stands this many boxes above the one below it.
  lift: 0.45,
  // The plush's base row in its frame (row 300 of 320).
  base: 300 / 320,
  // The claw, its head and prongs, as a share of a box.
  claw: 0.5,
  // How far below a plush's box top the closed prongs reach, round its head.
  grab: 0.3,
  // The cable showing between the carriage and the claw at rest, as a share of
  // the claw.
  slack: 0.6,
} as const;

export type Rect = { x: number; y: number; width: number; height: number };
export type Line = { x1: number; y1: number; x2: number; y2: number };
export type PlushLayout = {
  id: string;
  name: string;
  frame: string;
  // The box's top-left corner and side.
  x: number;
  y: number;
  size: number;
  // Back to front: 0 is drawn first.
  layer: number;
  // On the floor itself (it casts a shadow), not on other plushes or held.
  floor: boolean;
  held: boolean;
  tug: boolean;
  // How much of the box, from its bottom, has dropped into the chute.
  hidden: number;
};
export type ClawLayout = {
  // CSS px per painting px.
  scale: number;
  // The cabinet.
  width: number;
  height: number;
  glass: Rect & { radius: number };
  plate: Rect;
  // The chute's mouth, its bounding box.
  chute: Rect;
  // The gantry: two rails along the ceiling's sides, the crossbar at the claw's
  // depth, and the carriage on it.
  rails: [Line, Line];
  crossbar: Line;
  bar: number;
  carriage: Rect;
  cable: Line;
  // The claw's box: centred on `x`, its prong tips on `tip`.
  claw: { x: number; tip: number; size: number; open: boolean; layer: number };
  // While Fae aims, where the claw would come down: an ellipse as wide as its
  // reach, on the floor or on the plush it would land on.
  marker: (Rect & { layer: number }) | null;
  plushes: PlushLayout[];
};

const lerp = (from: number, to: number, share: number): number => from + (to - from) * share;

export type FloorPoint = {
  // Where (x, z) lies on the painted floor, and at that depth: the floor's
  // left and right edges, the ceiling above it, and a plush's box.
  x: number;
  y: number;
  left: number;
  right: number;
  ceiling: number;
  box: number;
};

// The floor is a plane seen in one-point perspective. A depth share u of the
// box lies a share t of the way up the painted floor, and farther steps look
// shorter: t = u / (s + (1 - s) u), where s is the back edge's width over the
// front's (spec 8.2).
//
//        back.left ________ back.right        t = 1   (z = box.depth)
//                 /        \
//                /  (x, z)  \                 t       (z = u * box.depth)
//               /____________\
//      front.left            front.right      t = 0   (z = 0, the glass)
export function floorPoint(
  box: { width: number; depth: number },
  calibration: ClawCalibration,
  scale: number,
  x: number,
  z: number,
): FloorPoint {
  const { floor, ceiling } = calibration;
  const shrink = (floor.back.right - floor.back.left) / (floor.front.right - floor.front.left);
  const u = Math.min(1, Math.max(0, z / box.depth));
  const t = u / (shrink + (1 - shrink) * u);
  const left = lerp(floor.front.left, floor.back.left, t);
  const right = lerp(floor.front.right, floor.back.right, t);
  return {
    x: (left + ((right - left) * x) / box.width) * scale,
    y: lerp(floor.front.y, floor.back.y, t) * scale,
    left: left * scale,
    right: right * scale,
    ceiling: lerp(ceiling.front.y, ceiling.back.y, t) * scale,
    box: clawLook.plush * (right - left) * scale,
  };
}

// A resting plush's box top at a floor point, `level` plushes up the heap.
function restTop(point: FloorPoint, level: number): number {
  return point.y - level * clawLook.lift * point.box - clawLook.base * point.box;
}

// The catch zone round where the claw comes down: `reach` across on the floor
// at that depth, squashed to lie flat.
function markerAt(
  here: FloorPoint,
  bottom: number,
  reach: number,
  width: number,
  layer: number,
): Rect & { layer: number } {
  const across = (2 * reach * (here.right - here.left)) / width;
  const tall = across * 0.32;
  return {
    x: Math.round(here.x - across / 2), y: Math.round(bottom - tall / 2),
    width: Math.round(across), height: Math.round(tall), layer,
  };
}

// The close-up in CSS px, relative to the cabinet's top-left corner, from the
// core's view and the painting's calibration at `scale`.
export function layoutClaw(
  view: ArcadeView,
  calibration: ClawCalibration,
  scale: number,
): ClawLayout {
  const at = (x: number, z: number): FloorPoint =>
    floorPoint(view.box, calibration, scale, x, z);
  const round = Math.round;
  const { glass, plate } = calibration;
  const mouthXs = calibration.chute.mouth.map(([x]) => x);
  const mouthYs = calibration.chute.mouth.map(([, y]) => y);
  const mouthFront = Math.max(...mouthYs) * scale;

  // The claw: at rest it hangs below the carriage; dropping, its tips go
  // down to the bare floor, or into the top of the plush it comes down on.
  const here = at(view.claw.x, view.claw.z);
  const size = clawLook.claw * here.box;
  const rest = here.ceiling + clawLook.slack * size + size;
  const bottom = view.claw.stop === 0 ? here.y
    : restTop(here, view.claw.stop - 1) + clawLook.grab * here.box;
  const tip = lerp(rest, bottom, view.claw.drop);
  // A held plush hangs by its head between the closed prongs: its box top a
  // grab's depth above the tips, its middle under the claw's.
  const hangTop = tip - clawLook.grab * here.box;
  // Back to front by depth (spec 8.2): everything is drawn at its own z, so
  // whatever is nearer covers whatever is farther, with no cycles. A plush
  // resting behind another peeks over its head; one at the same depth sits on
  // it (the higher level comes first in front). The claw and its cable are
  // just in front of their own depth, then its landing marker and a held
  // plush, between the claw and what's behind it.
  const keyOf = (z: number, level: number): number => z - 0.01 * level;
  const clawKey = view.claw.z - 0.5;
  const placed = view.plushes.map((plush, index) => {
    if (plush.held) {
      const hang = view.phase === "releasing"
        ? lerp(rest - clawLook.grab * here.box, mouthFront, plush.fall)
        : hangTop;
      return {
        plush, index, key: clawKey + 0.3, x: here.x, top: hang, box: here.box,
        // Below the mouth's front edge it's down the chute, out of sight. The
        // plush's base is 300/320 of its box, so measure from there.
        hidden: Math.min(here.box,
          Math.max(0, hang + clawLook.base * here.box - mouthFront)),
      };
    }
    const point = at(plush.x, plush.z);
    return {
      plush, index, key: keyOf(plush.z, plush.level), x: point.x,
      top: restTop(point, plush.level), box: point.box, hidden: 0,
    };
  });
  const aiming = view.phase === "sliding" || view.phase === "aiming" || view.phase === "pushing";
  // Indices -1 and -2 stand for the claw and its marker in the stacking order.
  const order = [...placed.map((item) => ({ key: item.key, index: item.index })),
    { key: clawKey, index: -1 }, ...(aiming ? [{ key: clawKey + 0.1, index: -2 }] : [])]
    .sort((a, b) => b.key - a.key || a.index - b.index);
  const layer = (index: number): number => order.findIndex((item) => item.index === index);

  const front = at(0, 0);
  const back = at(0, view.box.depth);
  const bar = Math.max(3, round(0.06 * here.box));
  const carriage = { width: round(0.6 * size), height: round(0.34 * size) };
  return {
    scale,
    width: round(calibration.size.w * scale),
    height: round(calibration.size.h * scale),
    glass: {
      x: round(glass.x * scale), y: round(glass.y * scale),
      width: round(glass.w * scale), height: round(glass.h * scale),
      radius: round(glass.radius * scale),
    },
    plate: {
      x: round(plate.x * scale), y: round(plate.y * scale),
      width: round(plate.w * scale), height: round(plate.h * scale),
    },
    chute: {
      x: round(Math.min(...mouthXs) * scale), y: round(Math.min(...mouthYs) * scale),
      width: round((Math.max(...mouthXs) - Math.min(...mouthXs)) * scale),
      height: round((Math.max(...mouthYs) - Math.min(...mouthYs)) * scale),
    },
    rails: [
      { x1: round(front.left), y1: round(front.ceiling),
        x2: round(back.left), y2: round(back.ceiling) },
      { x1: round(front.right), y1: round(front.ceiling),
        x2: round(back.right), y2: round(back.ceiling) },
    ],
    crossbar: {
      x1: round(here.left), y1: round(here.ceiling),
      x2: round(here.right), y2: round(here.ceiling),
    },
    bar,
    carriage: {
      x: round(here.x - carriage.width / 2), y: round(here.ceiling - carriage.height / 2),
      ...carriage,
    },
    cable: {
      x1: round(here.x), y1: round(here.ceiling),
      x2: round(here.x), y2: round(tip - 0.94 * size),
    },
    claw: { x: round(here.x), tip: round(tip), size: round(size), open: view.claw.open,
      layer: layer(-1) },
    marker: aiming ? markerAt(here, bottom, view.reach, view.box.width, layer(-2)) : null,
    plushes: placed.map((item) => ({
      id: item.plush.id,
      name: item.plush.name,
      frame: item.plush.frame,
      x: round(item.x - item.box / 2),
      y: round(item.top),
      size: round(item.box),
      layer: layer(item.index),
      floor: !item.plush.held && item.plush.level === 0,
      held: item.plush.held,
      tug: item.plush.tug,
      hidden: round(item.hidden),
    })),
  };
}
