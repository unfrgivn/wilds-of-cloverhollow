import type { MoleCalibration, MoleFace, MoleHole, MoleView } from "../core";

// How the Boop-a-Mole close-up is drawn (spec 8.2).
export const moleLook = {
  // A mole's frame (its 320 px atlas frame, its cut waist on the last row)
  // is this many times its hole's rx on a side.
  size: 2.1,
  // Where the hammer strikes, a share of the frame down from its top (the
  // top of the mole's head, so its face shows the wince), and the hammer's
  // length, a share of the frame.
  strike: 0.12,
  hammer: 0.75,
  // How far the hammer lifts and turns back as its swing fades.
  lift: 0.35,
  turn: -0.6,
} as const;

export type Rect = { x: number; y: number; width: number; height: number };
export type HoleLayout = {
  hole: MoleHole;
  // The hole's opening, in CSS px from the painting's top-left corner.
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  // Where a risen mole's frame stands, and the clip that hides what's under
  // the deck: everything above the hole's centre line, and the opening below
  // it (so the near rim covers the mole's waist). The path is in the box's
  // own px.
  box: Rect;
  clip: string;
  // The mole in the hole: how far below its risen place its frame is, and
  // its face; null for an empty hole.
  mole: { drop: number; face: MoleFace } | null;
  // The key that boops it (with a keyboard): its cap's right-middle point,
  // just left of the hole.
  key: { x: number; y: number; label: string };
};
export type MoleLayout = {
  // CSS px per painting px; the part of the painting shown (`moleFrame`), its
  // size; and the whole painting's size and offset as its background. Every
  // other position is in CSS px from the shown part's top-left corner.
  scale: number;
  width: number;
  height: number;
  painting: { width: number; height: number; y: number };
  // Where (a share of the height) the shown part starts fading out, just
  // below the near hole's front rim.
  fade: number;
  plate: Rect;
  // The score sticker's top-right corner: just left of the marquee.
  hud: { x: number; y: number };
  holes: HoleLayout[];
  // The hammer's swing: the head's centre, its turn (radians), its length,
  // and how solid it is; null when it isn't swinging.
  hammer: { x: number; y: number; angle: number; length: number; opacity: number } | null;
  // "Boop!" over a mole while it winces.
  pop: { x: number; y: number } | null;
};

// The part of the painting the close-up shows, in painting px: its whole
// width, from just above the marquee down past the near hole (the cabinet's
// front is cut), so the holes are as large as a phone allows.
export function moleFrame(calibration: MoleCalibration): { x: number; y: number; w: number;
  h: number } {
  const { plate, holes, size } = calibration;
  const y = Math.max(0, Math.round(plate.y - plate.h * 0.1));
  const bottom = Math.min(size.h, Math.round(holes.down.cy + holes.down.ry * 2.4));
  return { x: 0, y, w: size.w, h: bottom - y };
}

const keys: Record<MoleHole, string> = { up: "↑", left: "←", middle: "Z", right: "→", down: "↓" };

// The close-up in CSS px, from the shown part's top-left corner.
export function layoutMole(view: MoleView, calibration: MoleCalibration, scale: number):
  MoleLayout {
  const round = Math.round;
  const frame = moleFrame(calibration);
  const dy = frame.y * scale;
  const holes = view.holes.map((item): HoleLayout => {
    const hole = calibration.holes[item.hole];
    const cx = hole.cx * scale;
    const cy = hole.cy * scale - dy;
    const rx = hole.rx * scale;
    const ry = hole.ry * scale;
    const size = round(moleLook.size * rx);
    const box = { x: round(cx - size / 2), y: round(cy + ry - size), width: size, height: size };
    // The centre line and the opening's ends, in the box's px.
    const line = round(cy - box.y);
    const left = round(cx - rx - box.x);
    const right = round(cx + rx - box.x);
    const clip = `M0 0 H${size} V${line} H${right} ` +
      `A${round(rx)} ${round(ry)} 0 0 1 ${left} ${line} H0 Z`;
    return {
      hole: item.hole, cx: round(cx), cy: round(cy), rx: round(rx), ry: round(ry), box, clip,
      mole: item.mole === null ? null
        : { drop: round((1 - item.mole.rise) * size), face: item.mole.face },
      key: { x: round(cx - rx - 4), y: round(cy), label: keys[item.hole] },
    };
  });
  const byHole = (hole: MoleHole): HoleLayout => {
    const found = holes.find((item) => item.hole === hole);
    if (found === undefined) throw new Error(`no hole ${hole} in the view`);
    return found;
  };
  const swing = view.hammer;
  const hammer = swing === null ? null : hammerAt(byHole(swing.hole), swing.progress);
  const wincing = holes.find((item) => item.mole?.face === "booped");
  const plate = {
    x: round(calibration.plate.x * scale), y: round(calibration.plate.y * scale - dy),
    width: round(calibration.plate.w * scale), height: round(calibration.plate.h * scale),
  };
  return {
    scale,
    width: round(frame.w * scale),
    height: round(frame.h * scale),
    painting: {
      width: round(calibration.size.w * scale), height: round(calibration.size.h * scale),
      y: -round(dy),
    },
    fade: Math.min(1, (calibration.holes.down.cy + calibration.holes.down.ry * 1.15 - frame.y) /
      frame.h),
    plate,
    hud: { x: plate.x - 10, y: plate.y },
    holes,
    hammer,
    pop: wincing === undefined ? null : { x: wincing.cx, y: wincing.box.y },
  };
}

// The hammer comes down on the hole's mole's nose (or where it would be),
// then lifts, turns back, and fades as its swing ends.
function hammerAt(at: HoleLayout, progress: number): NonNullable<MoleLayout["hammer"]> {
  return {
    x: Math.round(at.cx),
    y: Math.round(at.box.y + moleLook.strike * at.box.height -
      moleLook.lift * at.box.height * progress),
    angle: moleLook.turn * progress,
    length: Math.round(moleLook.hammer * at.box.height),
    opacity: Math.max(0, 1 - progress * progress),
  };
}
