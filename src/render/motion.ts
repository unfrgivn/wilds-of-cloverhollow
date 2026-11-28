import type { Direction, NpcAttention, NpcPersonality } from "../core";

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

export function companionIdlePose(
  id: string,
  stillTicks: number,
  tick: number,
  index: number,
): MotionPose {
  const base = idleBreathing(tick, (index + 1) * 1.3);
  if (stillTicks < 180) return base;

  if (id === "maddie") {
    const wave = Math.sin(tick / 34);
    return {
      offsetX: 0,
      offsetY: 0,
      scaleX: 1.035,
      scaleY: 0.96 + 0.02 * wave,
      rotation: 0,
    };
  }

  if (id === "pond-pup") {
    const local = ((tick + index * 13) % 110 + 110) % 110;
    if (local < 16) {
      const phase = local / 16;
      const arc = Math.sin(phase * Math.PI);
      return {
        offsetX: 0,
        offsetY: -7 * arc,
        scaleX: 1 - 0.03 * arc,
        scaleY: 1 + 0.04 * arc,
        rotation: 0.06 * Math.sin(phase * 3 * Math.PI),
      };
    }
    return {
      ...base,
      rotation: 0.018 * Math.sin(tick / 14 + index),
    };
  }

  if (id === "acorn-squirrel") {
    const local = ((tick + index * 19) % 95 + 95) % 95;
    if (local < 14) {
      const phase = local / 14;
      const hop = Math.abs(Math.sin(phase * Math.PI * 2));
      return {
        offsetX: 0,
        offsetY: -5.5 * hop,
        scaleX: 1 - 0.03 * hop,
        scaleY: 1 + 0.05 * hop,
        rotation: 0.045 * Math.sin(phase * Math.PI * 2),
      };
    }
    return {
      ...idleBreathing(tick, (index + 1) * 1.1, 0.018),
      rotation: 0.015 * Math.sin(tick / 19 + index),
    };
  }

  if (id === "ribbon-bunny") {
    const local = ((tick + index * 23) % 100 + 100) % 100;
    if (local < 16) {
      const phase = local / 16;
      const arc = Math.sin(phase * Math.PI);
      return {
        offsetX: 0,
        offsetY: -6 * arc,
        scaleX: 1 - 0.025 * arc,
        scaleY: 1 + 0.055 * arc,
        rotation: 0.03 * Math.sin(phase * Math.PI * 2),
      };
    }
    return {
      ...idleBreathing(tick, (index + 1) * 1.1, 0.017),
      offsetY: -0.8 * Math.max(0, Math.sin(tick / 20 + index)),
    };
  }

  const sway = Math.sin(tick / 38 + index);
  return {
    offsetX: 1.5 * sway,
    offsetY: base.offsetY,
    scaleX: base.scaleX,
    scaleY: base.scaleY,
    rotation: 0.024 * sway,
  };
}

// 6-tick Paper-Mario turn-squash pulse layered when an NPC pivots facing direction.
const TURN_SQUASH_X: readonly number[] = [0.94, 0.96, 1.02, 1.015, 1.005, 1.0];
const TURN_SQUASH_Y: readonly number[] = [1.03, 1.02, 0.99, 0.994, 0.998, 1.0];

function applyTurnSquash(pose: MotionPose, turnAge: number): MotionPose {
  if (turnAge < 0 || turnAge >= TURN_SQUASH_X.length) return pose;
  const idx = Math.floor(turnAge);
  return {
    ...pose,
    scaleX: pose.scaleX * (TURN_SQUASH_X[idx] ?? 1),
    scaleY: pose.scaleY * (TURN_SQUASH_Y[idx] ?? 1),
  };
}

function npcBaseLivingPose(
  personality: NpcPersonality,
  attention: NpcAttention,
  tick: number,
  index: number,
  attentionAge: number,
): MotionPose {
  const phase = (index + 1) * 0.9;
  const base = idleBreathing(tick, phase);
  const age = Math.max(0, attentionAge);

  if (attention === "lantern-awe") {
    if (age < 22) {
      const u = age / 22;
      const doublePerk = Math.abs(Math.sin(u * Math.PI * 2)) * (1 - u * 0.35);
      return {
        offsetX: 0,
        offsetY: -doublePerk * 6.5,
        scaleX: 1 - doublePerk * 0.03,
        scaleY: 1 + doublePerk * 0.045,
        rotation: Math.sin(u * Math.PI * 2) * 0.04,
      };
    }
    const wonder = Math.sin(tick / 18 + phase);
    return {
      offsetX: wonder * 0.9,
      offsetY: -1.2 - Math.abs(wonder) * 1.4,
      scaleX: base.scaleX,
      scaleY: base.scaleY * 1.012,
      rotation: wonder * 0.032,
    };
  }

  if (attention === "celebrate") {
    if (age < 26) {
      const u = age / 26;
      const hop = Math.abs(Math.sin(u * Math.PI * 2));
      return {
        offsetX: Math.sin(u * Math.PI * 2) * 1.4,
        offsetY: -hop * 7.5,
        scaleX: 1 - hop * 0.032,
        scaleY: 1 + hop * 0.048,
        rotation: Math.sin(u * Math.PI * 4) * 0.045,
      };
    }
    const cheer = Math.sin(tick / 12 + phase);
    const lift = Math.abs(cheer);
    return {
      offsetX: cheer * 1.0,
      offsetY: -1.4 - lift * 2.4,
      scaleX: base.scaleX * (1 - lift * 0.014),
      scaleY: base.scaleY * (1 + lift * 0.022),
      rotation: cheer * 0.032,
    };
  }

  if (attention === "music-delight") {
    const beat = Math.sin(tick / 9 + index);
    const hop = Math.abs(beat);
    const perk = age < 14 ? Math.sin((age / 14) * Math.PI) * 1.8 : 0;
    return {
      offsetX: beat * 1.1,
      offsetY: -hop * 4.5 - perk,
      scaleX: 1 - hop * 0.026,
      scaleY: 1 + hop * 0.038,
      rotation: 0.042 * beat,
    };
  }

  if (attention === "chaos-worry") {
    const lean = Math.sin(tick / 16 + phase) * 0.022;
    if (age < 10) {
      const flinch = Math.sin((age / 10) * Math.PI);
      return {
        offsetX: 0,
        offsetY: -flinch * 3.2,
        scaleX: 1.015 + flinch * 0.015,
        scaleY: 0.985 - flinch * 0.015,
        rotation: lean,
      };
    }
    return {
      offsetX: 0,
      offsetY: 0,
      scaleX: 1.015,
      scaleY: 0.985,
      rotation: lean,
    };
  }

  if (attention === "player-greet" || attention === "companion-greet") {
    if (age < 16) {
      const u = age / 16;
      const arc = Math.sin(u * Math.PI);
      return {
        offsetX: 0,
        offsetY: -arc * 5.5,
        scaleX: 1 - arc * 0.028,
        scaleY: 1 + arc * 0.042,
        rotation: Math.sin(u * Math.PI * 2) * 0.03,
      };
    }
    const sway = Math.sin(tick / 26 + phase);
    return {
      offsetX: sway * 0.7,
      offsetY: -0.6 * Math.max(0, sway),
      scaleX: base.scaleX,
      scaleY: base.scaleY,
      rotation: sway * 0.018,
    };
  }

  if (attention === "social-chat") {
    const talk = Math.sin(tick / 11 + phase);
    const bob = Math.abs(Math.sin(tick / 14 + phase)) * 1.8;
    return {
      offsetX: Math.sin(tick / 28 + phase) * 1.1,
      offsetY: -bob,
      scaleX: base.scaleX * (1 - bob * 0.006),
      scaleY: base.scaleY * (1 + bob * 0.008),
      rotation: talk * 0.024,
    };
  }

  if (attention === "dialogue") {
    const bob = Math.abs(Math.sin(tick / 16 + phase)) * 1.2;
    return {
      offsetX: 0,
      offsetY: -bob,
      scaleX: base.scaleX,
      scaleY: base.scaleY,
      rotation: Math.sin(tick / 24 + phase) * 0.012,
    };
  }

  if (personality === "gardener") {
    const sway = Math.sin(tick / 36 + phase);
    return {
      ...base,
      offsetX: sway * 1.1,
      rotation: sway * 0.02,
    };
  }

  if (personality === "sailor") {
    const roll = Math.sin(tick / 30 + phase);
    return {
      ...base,
      offsetX: roll * 1.3,
      rotation: roll * 0.024,
    };
  }

  if (personality === "kid-bouncy") {
    const local = (((tick + index * 29) % 130) + 130) % 130;
    if (local < 14) {
      const u = local / 14;
      const arc = Math.sin(u * Math.PI);
      return {
        offsetX: 0,
        offsetY: -arc * 4.5,
        scaleX: 1 - arc * 0.025,
        scaleY: 1 + arc * 0.038,
        rotation: Math.sin(u * Math.PI * 2) * 0.025,
      };
    }
    return base;
  }

  if (personality === "artist" || personality === "scholar") {
    return {
      ...base,
      rotation: Math.sin(tick / 44 + phase) * 0.018,
    };
  }

  if (personality === "naturalist" || personality === "ranger") {
    const sway = Math.sin(tick / 40 + phase);
    return {
      ...base,
      offsetX: sway * 0.8,
      rotation: sway * 0.014,
    };
  }

  if (personality === "mystic") {
    const floatWave = Math.sin(tick / 28 + phase);
    const sway = Math.sin(tick / 42 + phase * 1.3);
    return {
      offsetX: sway * 1.2,
      offsetY: -2.2 - 1.6 * floatWave,
      scaleX: base.scaleX,
      scaleY: base.scaleY,
      rotation: sway * 0.022,
    };
  }

  if (personality === "fairy") return fairyHover(tick, index);

  return base;
}

export function npcLivingPose(
  personality: NpcPersonality,
  attention: NpcAttention,
  tick: number,
  index: number,
  attentionAge: number,
  turnAge = 99,
): MotionPose {
  const pose = npcBaseLivingPose(personality, attention, tick, index, attentionAge);
  return applyTurnSquash(pose, turnAge);
}
