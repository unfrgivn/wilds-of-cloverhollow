import type { Direction, State } from "../core";

export type AnimationSelection = {
  animation: string;
  frame: number;
  mirror: boolean;
};

export function selectFaeAnimation(
  facing: Direction,
  motion: State["motion"],
  frameCount: number,
  walkCycleUnits: number,
): AnimationSelection {
  const side = facing === "right" ? "left" : facing;
  const mirror = facing === "right";
  if (!motion.moving) {
    return { animation: `idle_${side}`, frame: 0, mirror };
  }
  const progress = motion.distance / walkCycleUnits;
  const frame = Math.floor(progress * frameCount) % frameCount;
  return { animation: `walk_${side}`, frame, mirror };
}
