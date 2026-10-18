import type { CometCalibration, CometView } from "../core";

// How the Comet Cruise close-up is drawn (spec 8.2).
export const cometLook = {
  // The rocket's row, a share of the field's height down from its top.
  row: 0.78,
  // The vanishing point the lanes run to: this share of the field's height
  // above its top centre.
  vanish: 0.5,
  // A frame at full size, a share of the field's width.
  size: 0.26,
  // The share of its full size one has at the field's top.
  far: 0.4,
  // The shown part's top and bottom, faded out (the wing tips are cut flat).
  fade: 0.06,
  // How far a key's cap stands off the screen's glass, in painting px.
  capGap: 24,
} as const;

export type Rect = { x: number; y: number; width: number; height: number };
export type CometSprite = Rect & { frame: string; opacity: number };
export type CometLayout = {
  // CSS px per painting px; the part of the painting shown (`cometFrame`), its
  // size; and the whole painting's size and offset as its background. The
  // field, the marquee, the score sticker, and the keys are in CSS px from the
  // shown part's top-left corner.
  scale: number;
  width: number;
  height: number;
  painting: { width: number; height: number; y: number };
  // The share of the height faded out at the top and at the bottom.
  fade: number;
  marquee: Rect;
  // The score sticker's top-right corner: just left of the marquee.
  hud: { x: number; y: number };
  // Where the run is drawn, clipped. The row, the lines, the rocket, and the
  // objects are in CSS px from the field's top-left corner.
  field: Rect;
  row: number;
  // The two dotted lines between the lanes, from the field's top to its foot.
  lines: { x1: number; y1: number; x2: number; y2: number }[];
  rocket: CometSprite;
  objects: (CometSprite & { kind: "star" | "rock" })[];
  // With a keyboard, the caps either side of the screen, level with the row:
  // ← by its right-middle point, → by its left-middle point.
  keys: { x: number; y: number; label: string; side: "left" | "right" }[];
};

// The part of the painting the close-up shows, in painting px: its whole
// width, from a sixth of the marquee's height above it to the deck's foot.
export function cometFrame(calibration: CometCalibration): { x: number; y: number; w: number;
  h: number } {
  const { marquee, deck, size } = calibration;
  const y = Math.max(0, Math.round(marquee.y - marquee.h / 6));
  const bottom = Math.min(size.h, deck.y + deck.h);
  return { x: 0, y, w: size.w, h: bottom - y };
}

// A lane's centre at the rocket's row, in field px.
const laneX = (width: number, lane: number): number => width * (1 / 6 + lane / 3);

// The close-up in CSS px.
export function layoutComet(view: CometView, calibration: CometCalibration, scale: number):
  CometLayout {
  const round = Math.round;
  const frame = cometFrame(calibration);
  const dy = frame.y * scale;
  const box = (rect: { x: number; y: number; w: number; h: number }): Rect => ({
    x: round(rect.x * scale), y: round(rect.y * scale - dy),
    width: round(rect.w * scale), height: round(rect.h * scale),
  });
  const field = box(calibration.field);
  const { width, height } = field;
  const row = height * cometLook.row;
  const vanish = { x: width / 2, y: -height * cometLook.vanish };
  // Where the line from the vanishing point through a point on the row at x
  // is at a height y.
  const onLine = (atRow: number, y: number): number =>
    vanish.x + (atRow - vanish.x) * (y - vanish.y) / (row - vanish.y);
  const full = width * cometLook.size;
  const sprite = (x: number, y: number, size: number, frame: string, opacity: number):
    CometSprite => ({
    x: round(x - size / 2), y: round(y - size / 2), width: round(size), height: round(size),
    frame, opacity: round(opacity * 1000) / 1000,
  });
  const objects = view.objects.map((item) => {
    const atRow = laneX(width, item.lane);
    if (item.flash > 0) {
      return { kind: item.kind,
        ...sprite(atRow, row, full, item.kind === "star" ? "star-sparkle" : "rock-puff",
          item.flash) };
    }
    const y = item.progress * row;
    const size = full * (cometLook.far + (1 - cometLook.far) * item.progress);
    const opacity = item.progress <= 1 ? 1 : Math.max(0, 1 - (y - row) / (height - row));
    return { kind: item.kind, ...sprite(onLine(atRow, y), y, size, item.kind, opacity) };
  });
  const rocketFrame = view.rocket.wobble > 0 ? "rocket-wobble"
    : view.rocket.lean < 0 ? "rocket-left" : view.rocket.lean > 0 ? "rocket-right" : "rocket";
  const marquee = box(calibration.marquee);
  const screen = calibration.screen;
  const capY = round(field.y + row);
  return {
    scale,
    width: round(frame.w * scale),
    height: round(frame.h * scale),
    painting: {
      width: round(calibration.size.w * scale), height: round(calibration.size.h * scale),
      y: -round(dy),
    },
    fade: cometLook.fade,
    marquee,
    hud: { x: marquee.x - 10, y: marquee.y },
    field,
    row: round(row),
    lines: [1, 2].map((between) => {
      const atRow = width * between / 3;
      return { x1: round(onLine(atRow, 0)), y1: 0, x2: round(onLine(atRow, height)), y2: height };
    }),
    rocket: sprite(laneX(width, view.rocket.position), row, full, rocketFrame, 1),
    objects,
    keys: [
      { x: round((screen.x - cometLook.capGap) * scale), y: capY, label: "←", side: "left" },
      { x: round((screen.x + screen.w + cometLook.capGap) * scale), y: capY, label: "→",
        side: "right" },
    ],
  };
}
