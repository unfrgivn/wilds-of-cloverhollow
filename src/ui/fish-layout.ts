import type { Box } from "./dom";
import type { FishCalibration, FishView } from "../core";

// Each sprite cell in `public/assets/arcade/fish-catches.json`: 256 x 256 px.
export const fishCell = { w: 256, h: 256 };

export type FishRipple = {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  opacity: number;
};

export type FishLayout = {
  scale: number;
  width: number;
  height: number;
  radius: number;
  water: Box;
  front: Box;
  book: Box;
  escape: Box;
  powerGauge: Box;
  reelMeter: Box;
  catchCard: Box;
  biteBadge: Box;
  // Image-space coordinates (1600 x 1048) for the SVG fishing rig layer.
  rodBase: { x: number; y: number };
  rodTip: { x: number; y: number };
  bobber: { x: number; y: number; visible: boolean; submerged: boolean };
  lineControl: { x: number; y: number };
  shadow: { x: number; y: number; angle: number; opacity: number; visible: boolean };
  ripples: FishRipple[];
};

const box = (x: number, y: number, width: number, height: number): Box => ({
  x: Math.round(x),
  y: Math.round(y),
  width: Math.round(width),
  height: Math.round(height),
});

export function layoutFish(
  view: FishView,
  calibration: FishCalibration,
  scale: number,
): FishLayout {
  const { size, water, front } = calibration;
  const landX = water.x + view.castX * water.w;
  const landY = water.y + view.castY * water.h;
  // Anchor the wooden rod on the open dock planks above the bottom hint strip,
  // angling gracefully out over the water so the hint bar never cuts the shaft.
  const rodBase = { x: 1096, y: 906 };
  const tipBase = { x: 856, y: 778 };

  let tipX = tipBase.x;
  let tipY = tipBase.y;
  let bobberX = tipBase.x;
  let bobberY = tipBase.y + 58;
  let bobberVisible = view.phase !== "result";
  let submerged = false;

  if (view.phase === "aim") {
    tipX = tipBase.x + (view.power - 0.5) * 20;
    tipY = tipBase.y - view.power * 22;
    bobberX = tipX - 6;
    bobberY = tipY + 62 + Math.sin(view.phaseTicks * 0.12) * 3;
  } else if (view.phase === "casting") {
    const t = view.castProgress;
    const whip = Math.sin(t * Math.PI);
    tipX = tipBase.x + (landX - tipBase.x) * 0.05 * whip;
    tipY = tipBase.y - 52 * whip;
    const startX = tipBase.x;
    const startY = tipBase.y + 24;
    bobberX = startX + (landX - startX) * t;
    bobberY = startY + (landY - startY) * t - 210 * 4 * t * (1 - t);
  } else if (view.phase === "waiting") {
    const pulse = view.nibblePulse > 0 ? Math.sin((view.nibblePulse / 28) * Math.PI) : 0;
    const idleBob = Math.sin(view.phaseTicks * 0.14) * 4.5;
    bobberX = landX;
    bobberY = landY + idleBob + pulse * 13;
    tipX = tipBase.x + (landX - tipBase.x) * 0.03;
    tipY = tipBase.y + pulse * 9;
  } else if (view.phase === "bite") {
    const jitter = Math.sin(view.phaseTicks * 0.9) * 6;
    bobberX = landX + jitter;
    bobberY = landY + 18 + Math.cos(view.phaseTicks * 0.75) * 4;
    tipX = tipBase.x + (bobberX - tipBase.x) * 0.14;
    tipY = tipBase.y + 38;
    submerged = true;
  } else if (view.phase === "reeling") {
    const pullFactor = 0.28 * view.reelProgress;
    const anchorX = landX + (tipBase.x - landX) * pullFactor;
    const anchorY = landY + (water.y + water.h - 45 - landY) * pullFactor;
    const sway = Math.sin(view.phaseTicks * 0.19) * 58;
    bobberX = Math.max(water.x + 56, Math.min(water.x + water.w - 56, anchorX + sway));
    bobberY = Math.max(
      water.y + 38,
      Math.min(water.y + water.h - 36, anchorY + (0.5 - view.fishPos) * 48),
    );
    tipX = tipBase.x + (bobberX - tipBase.x) * 0.18;
    tipY = tipBase.y + (view.holding ? 14 : 36);
    submerged = !view.inZone;
  } else {
    bobberVisible = false;
  }

  // Quadratic control point for the fishing line.
  const midX = (tipX + bobberX) / 2;
  const midY = (tipY + bobberY) / 2;
  const sag = view.phase === "casting"
    ? -95 * Math.sin(view.castProgress * Math.PI)
    : view.phase === "waiting"
      ? 54
      : view.phase === "aim"
        ? 6
        : 10;
  const lineControl = { x: midX, y: midY + sag };

  // Subtle dark-teal watercolor fish silhouette beneath the surface.
  const shadowVisible = view.phase === "waiting" || view.phase === "bite" ||
    view.phase === "reeling";
  const shadowOrbit = view.phase === "waiting"
    ? 64 + Math.sin(view.phaseTicks * 0.06) * 26
    : view.phase === "bite"
      ? 14
      : 28;
  const shadowAngle = view.phase === "reeling"
    ? (Math.cos(view.phaseTicks * 0.19) >= 0 ? 12 : 168)
    : (view.phaseTicks * 1.4) % 360;
  const shadowRad = (shadowAngle * Math.PI) / 180;
  const shadow = {
    x: bobberX + Math.cos(shadowRad) * shadowOrbit,
    y: bobberY + 18 + Math.sin(shadowRad) * shadowOrbit * 0.35,
    angle: shadowAngle,
    opacity: view.phase === "waiting" ? 0.34 : 0.46,
    visible: shadowVisible,
  };

  // Concentric cream-white water ripple ellipses around the bobber.
  const ripples: FishRipple[] = [];
  if (view.phase === "waiting") {
    const idle = (view.phaseTicks % 48) / 48;
    ripples.push({
      cx: bobberX,
      cy: bobberY + 8,
      rx: 20 + idle * 52,
      ry: 7 + idle * 18,
      opacity: Math.round((1 - idle) * 48) / 100,
    });
    if (view.nibblePulse > 0) {
      const p = view.nibblePulse / 28;
      ripples.push({
        cx: bobberX,
        cy: bobberY + 8,
        rx: 24 + p * 98,
        ry: 9 + p * 34,
        opacity: Math.round((1 - p) * 86) / 100,
      });
      ripples.push({
        cx: bobberX,
        cy: bobberY + 8,
        rx: 12 + p * 56,
        ry: 5 + p * 20,
        opacity: Math.round((1 - p) * 70) / 100,
      });
    }
  } else if (view.phase === "bite" || view.phase === "reeling") {
    for (const offset of [0, 0.5]) {
      const p = ((view.phaseTicks % 24) / 24 + offset) % 1;
      ripples.push({
        cx: bobberX,
        cy: bobberY + 8,
        rx: 24 + p * 108,
        ry: 9 + p * 36,
        opacity: Math.round((1 - p) * 90) / 100,
      });
    }
  }

  const badgeW = 248;
  const badgeH = 82;
  const badgeX = Math.max(220, Math.min(size.w - 220 - badgeW, bobberX - badgeW / 2));
  const badgeY = Math.max(134, Math.min(size.h - 320, bobberY - badgeH - 46));

  return {
    scale,
    width: Math.round(size.w * scale),
    height: Math.round(size.h * scale),
    radius: Math.round(24 * scale),
    water: box(water.x * scale, water.y * scale, water.w * scale, water.h * scale),
    front: box(front.x * scale, front.y * scale, front.w * scale, front.h * scale),
    book: box(28 * scale, 20 * scale, 780 * scale, 102 * scale),
    escape: box(1256 * scale, 20 * scale, 316 * scale, 76 * scale),
    powerGauge: box(186 * scale, 214 * scale, 132 * scale, 472 * scale),
    reelMeter: box(1276 * scale, 168 * scale, 196 * scale, 496 * scale),
    catchCard: box(350 * scale, 142 * scale, 900 * scale, 356 * scale),
    biteBadge: box(badgeX * scale, badgeY * scale, badgeW * scale, badgeH * scale),
    rodBase,
    rodTip: { x: tipX, y: tipY },
    bobber: { x: bobberX, y: bobberY, visible: bobberVisible, submerged },
    lineControl,
    shadow,
    ripples,
  };
}
