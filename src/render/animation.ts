import {
  npcLivePoint,
  npcVisible,
  presentCritters,
  type Direction,
  type Point,
  type State,
  type World,
} from "../core";

export type AnimationSelection = {
  animation: string;
  frame: number;
  mirror: boolean;
};

export function facingToward(from: Point, to: Point): Direction {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up");
}

export function dialoguePartner(world: World, state: State): Point | null {
  if (state.dialogue === null) return null;
  const knot = state.dialogue.knot;
  const area = world.areas[state.area];
  const npc = area?.npcs.find((item) => npcVisible(world, state, item) && item.knot === knot);
  if (npc !== undefined) {
    const live = npcLivePoint(state, npc);
    return { x: live.x, y: live.y };
  }
  const calm = presentCritters(world, state)
    .filter((item) => item.mood === "calm" && item.kind.calmKnot === knot)
    .sort((a, b) =>
      (a.point.x - state.player.x) ** 2 + (a.point.y - state.player.y) ** 2 -
      ((b.point.x - state.player.x) ** 2 + (b.point.y - state.player.y) ** 2))[0];
  return calm?.point ?? null;
}

export function dialogueFacing(world: World, state: State): Direction | null {
  const partner = dialoguePartner(world, state);
  return partner === null ? null : facingToward(state.player, partner);
}

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
