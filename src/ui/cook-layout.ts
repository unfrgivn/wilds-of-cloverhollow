import type { Box } from "./claw";
import type { CookCalibration, CookView } from "../core";

// The food's cells (public/assets/arcade/cook-food.json): 512 x 320 image px,
// each dish's foot 8 px up from the bottom, painted at the close-up's scale.
export const foodCell = { w: 512, h: 320, footX: 256, footY: 312 };

// A puff of steam (or smoke, once it's burnt) behind the glass, in px.
export type Wisp = { x: number; y: number; size: number; opacity: number };

// The microwave's close-up laid out at `scale` (CSS px per image px), every
// part in whole pixels from the painting's calibration:
//
//   ┌──────────────── painting ─────────────────┐
//   │ ┌──────── glass ─────────┐ ┌─ display ─┐  │
//   │ │   wisps                │ │   0:42    │  │
//   │ │      ┌── food ──┐      │ │  ( dial ) │  │
//   │ │      │  dish    │      │ │ (button)  │  │
//   │ │ ═════╧═foot═════╧════  │ │           │  │
//   │ └─── turntable ──────────┘ └───────────┘  │
//   │ ─────────── fridge front: the hint ─────── │
//   └────────────────────────────────────────────┘
export type CookLayout = {
  scale: number;
  width: number;
  height: number;
  glass: Box & { radius: number };
  // The dish's whole cell, its foot on the turntable, laid out inside the glass.
  food: Box;
  display: Box;
  button: { x: number; y: number; radius: number };
  front: Box;
  wisps: Wisp[];
};

const box = (x: number, y: number, width: number, height: number): Box =>
  ({ x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) });

export function layoutCook(view: CookView, calibration: CookCalibration,
  scale: number): CookLayout {
  const { glass, plate, display, button, front } = calibration;
  const glassBox = box(glass.x * scale, glass.y * scale, glass.w * scale, glass.h * scale);
  // The dish stands a little back from the turntable's front rim, centred.
  const foot = { x: plate.cx, y: plate.cy + plate.ry * 0.4 };
  const food = box((foot.x - foodCell.footX - glass.x) * scale,
    (foot.y - foodCell.footY - glass.y) * scale, foodCell.w * scale, foodCell.h * scale);
  // Four puffs rising from the dish, each a step along its own climb, by the
  // ticks cooked: drawn as the core cooked it, never by a clock.
  const wisps = view.steam || view.smoke ? [0, 1, 2, 3].map((index): Wisp => {
    const along = ((view.cooked * 3 + index * 25) % 100) / 100;
    const x = foot.x + (index - 1.5) * 70 + Math.sin(along * Math.PI * 2) * 12;
    const y = foot.y - 150 - along * 170;
    const size = (50 + along * 50) * scale;
    return { x: Math.round((x - glass.x) * scale - size / 2),
      y: Math.round((y - glass.y) * scale - size / 2), size: Math.round(size),
      opacity: Math.round(Math.sin(along * Math.PI) * (view.smoke ? 80 : 55)) / 100 };
  }) : [];
  return {
    scale,
    width: Math.round(calibration.size.w * scale),
    height: Math.round(calibration.size.h * scale),
    glass: { ...glassBox, radius: Math.round(glass.r * scale) },
    food,
    display: box(display.x * scale, display.y * scale, display.w * scale, display.h * scale),
    button: { x: Math.round(button.cx * scale), y: Math.round(button.cy * scale),
      radius: Math.round(button.r * scale) },
    front: box(front.x * scale, front.y * scale, front.w * scale, front.h * scale),
    wisps,
  };
}

// What the fridge's front says: the hint before cooking and while it's still
// frozen; otherwise the box, and its time.
export function cookFront(view: CookView): string {
  return view.hint ?? `${view.label} · Heat ${view.boxTime}`;
}
