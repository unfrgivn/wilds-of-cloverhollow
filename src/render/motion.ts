import type { Direction } from "../core";

export type MotionPose = {
  offsetX: number;
  offsetY: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
};

export const NEUTRAL_POSE: MotionPose = {
  offsetX: 0,
  offsetY: 0,
  scaleX: 1,
  scaleY: 1,
  rotation: 0,
};

export function composePose(a: MotionPose, b: MotionPose): MotionPose {
  return {
    offsetX: a.offsetX + b.offsetX,
    offsetY: a.offsetY + b.offsetY,
    scaleX: a.scaleX * b.scaleX,
    scaleY: a.scaleY * b.scaleY,
    rotation: a.rotation + b.rotation,
  };
}

export function walkPose(
  distance: number,
  walkCycleUnits: number,
  moving: boolean,
  isSideBounder = false,
): MotionPose {
  if (!moving || walkCycleUnits <= 0) return { ...NEUTRAL_POSE };
  const phase = (((distance / walkCycleUnits) % 1) + 1) % 1;
  const cos4 = Math.cos(phase * Math.PI * 4);
  const scaleY = 1 + 0.022 * cos4;
  const scaleX = 1 - 0.016 * cos4;
  const offsetY = isSideBounder
    ? -Math.sin(((phase * 2) % 1) * Math.PI) * 7
    : -Math.abs(Math.sin(phase * Math.PI * 2)) * 2.5;
  return { offsetX: 0, offsetY, scaleX, scaleY, rotation: 0 };
}

export function idleBreathing(
  tick: number,
  phaseOffset: number,
  amplitude = 0.015,
): MotionPose {
  const wave = Math.sin(tick / 22 + phaseOffset);
  return {
    offsetX: 0,
    offsetY: 0,
    scaleX: 1 - amplitude * 0.7 * wave,
    scaleY: 1 + amplitude * wave,
    rotation: 0,
  };
}

export function fairyHover(tick: number, index: number): MotionPose {
  return {
    offsetX: 0,
    offsetY: -5 - 4.5 * Math.sin(tick / 16 + index * 1.7),
    scaleX: 1,
    scaleY: 1,
    rotation: 0.055 * Math.sin(tick / 24 + index * 2.1),
  };
}

// 8-tick feet-anchored squash-pop right as a sitter settles down.
const SIT_SQUASH_Y: readonly number[] = [0.9, 0.92, 0.97, 1.04, 1.03, 1.01, 0.995, 1.0];
const SIT_SQUASH_X: readonly number[] = [1.07, 1.05, 1.02, 0.97, 0.98, 0.99, 1.003, 1.0];

export function sitSquash(stillTicks: number, sitDelayTicks: number): MotionPose {
  const elapsed = stillTicks - sitDelayTicks;
  if (elapsed < 0 || elapsed >= SIT_SQUASH_Y.length) return { ...NEUTRAL_POSE };
  const index = Math.floor(elapsed);
  return {
    offsetX: 0,
    offsetY: 0,
    scaleX: SIT_SQUASH_X[index] ?? 1,
    scaleY: SIT_SQUASH_Y[index] ?? 1,
    rotation: 0,
  };
}

export function roamerHop(
  tick: number,
  moving: boolean,
  chasing: boolean,
  notice: number,
  noticeTicks: number,
  facing: Direction = "left",
): MotionPose {
  // Playful startle jump right as a roaming critter spots Fae and pops "!".
  if (notice >= noticeTicks && notice < noticeTicks + 12) {
    const progress = (notice - noticeTicks + 1) / 12;
    const arc = Math.sin(progress * Math.PI);
    return {
      offsetX: 0,
      offsetY: -12 * arc,
      scaleX: 1 - 0.06 * arc,
      scaleY: 1 + 0.08 * arc,
      rotation: 0,
    };
  }
  if (!moving) return idleBreathing(tick, 0, 0.015);
  const period = chasing ? 3.2 : 4.5;
  const wave = Math.abs(Math.sin(tick / period));
  const lift = wave * (chasing ? 6 : 4);
  const landing = wave < 0.25 ? 1 - wave / 0.25 : 0;
  const scaleY = 1 - 0.05 * landing + 0.03 * wave;
  const scaleX = 1 + 0.04 * landing - 0.02 * wave;
  const sign = facing === "right" ? 1 : facing === "left" ? -1 : 0;
  const rotation = sign * (chasing ? 0.08 : 0.03);
  return { offsetX: 0, offsetY: -lift, scaleX, scaleY, rotation };
}
