import type { Battle } from "../core";
import { composePose, idleBreathing, type MotionPose } from "./motion";
export {
  applyRestFaint,
  ECHO_CHIME_COLORS,
  echoNoteColor,
  emitEchoChimeVfx,
  emitLeanWindVfx,
  emitPeekabooVfx,
  emitRainbowLassoVfx,
  emitSoothedConfettiVfx,
  emitTraceBrushVfx,
  isLassoActionActive,
  LASSO_ARC_DURATION,
  LEAN_WIND_TINTS,
  PEEKABOO_DUST_TINT,
  PEEKABOO_WARNING_TINT,
  PEEKABOO_WATCH_TINTS,
  RAINBOW_LASSO_COLORS,
  SOOTHED_CONFETTI_COLORS,
  TRACE_BRUSH_COLORS,
  type EchoChimeMotion,
  type EchoColor,
  type TraceBrushMotion,
} from "./battle-vfx-stage";

export type BattleVfxTexture =
  | "sparkle"
  | "heart"
  | "energyRing"
  | "puff"
  | "petal"
  | "softGlow"
  | "mistWisp";
export type BattleVfxTextureKey = BattleVfxTexture;
export type BattleVfxBlend = "normal" | "add";
export type BattleVfxAnchor = "fae" | "critter" | "between" | "party";
export type BattleStageMood =
  | "calm-normal"
  | "windup"
  | "together-ready"
  | "together-active"
  | "soothed"
  | "rest";

export type BattleVfxParticle = {
  texture: BattleVfxTexture;
  blend: BattleVfxBlend;
  anchor: BattleVfxAnchor;
  actorId?: string;
  t?: number;
  offsetX: number;
  offsetY: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  alpha: number;
  tint: number;
};

export const RAINBOW_HEARTS: readonly number[] = [
  0xff9bb8,
  0xffc491,
  0xfff099,
  0xa8e6cf,
  0xa8dcff,
  0xd8b8ff,
];

export const SPARKLE_TINTS: readonly number[] = [0xfff099, 0xffe074, 0xd4fcf2, 0xffd2e6];
export const FIZZ_TINTS: readonly number[] = [0xe6b8ff, 0xffb8d8, 0xd8c4ff];
export const RELIEF_PETALS: readonly number[] = [0xa8e6cf, 0xfff099, 0xffc8dc, 0xd8b8ff];
const SNACK_SPARKLE_TINTS: readonly number[] = [0x9be38a, 0xffe58a];
const TALK_HEART_TINTS: readonly number[] = [0xffb7cf, 0xffe599, 0xc5e8d5, 0xd8c4ff];
const FAVOURITE_HEART_TINTS: readonly number[] = [
  0xffd859,
  0xf27ea3,
  0xf5b82e,
  0xf69a5c,
  0x6bc7b4,
  0xb68cf0,
];

export function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function isTalkTheater(battle: Pick<Battle, "phase" | "talk">): boolean {
  return (
    battle.talk !== null &&
    battle.talk !== undefined &&
    battle.phase !== "soothed" &&
    battle.phase !== "reward"
  );
}

export type SnackTheaterKind = "none" | "snack" | "treat" | "favourite";

const FAVOURITE_TREAT_RE = /favou?rite|Golden Sunberry/i;
const SPECIALTY_TREAT_RE =
  /\b(?:treat|apple|fish crackers?|cone|sundae|taffy|brittle|sunberry)\b/i;

export function classifySnackTheater(
  battle: Pick<Battle, "phase" | "command" | "message"> & { lastGrade?: Battle["lastGrade"] },
): SnackTheaterKind {
  if (battle.phase !== "result") return "none";
  // Core snack and specialty treat results never run a check, so `lastGrade` is
  // always `null` while `command` stays null (turn 1) or holds the prior turn's
  // command; every check-based result carries a non-null grade.
  const isSnackResult =
    battle.command === "snack" ||
    (battle.lastGrade === null && (battle.command === null || battle.message.length > 0));
  if (!isSnackResult) return "none";
  if (FAVOURITE_TREAT_RE.test(battle.message)) return "favourite";
  if (SPECIALTY_TREAT_RE.test(battle.message)) return "treat";
  return "snack";
}

export function radialBurst(
  vfx: BattleVfxParticle[],
  anchor: BattleVfxAnchor,
  phaseTicks: number,
  heartCount: number,
  sparkleCount: number,
  radius: number,
  duration: number,
): void {
  const u = clamp01((phaseTicks + 3) / duration);
  const fade = Math.max(0, 1 - u * u);
  if (fade <= 0.02) return;
  for (let i = 0; i < heartCount; i += 1) {
    const angle = -Math.PI * 0.9 + (i / Math.max(1, heartCount - 1)) * Math.PI * 0.8 +
      (i % 2 === 0 ? -0.1 : 0.1);
    const dist = radius * (0.28 + u * 0.72) * (0.85 + (i % 3) * 0.12);
    const scale = (0.48 + (i % 3) * 0.12) * (0.75 + Math.sin(u * Math.PI) * 0.35);
    vfx.push({
      texture: "heart",
      blend: "normal",
      anchor,
      offsetX: Math.cos(angle) * dist,
      offsetY: Math.sin(angle) * dist - u * 24,
      scaleX: scale,
      scaleY: scale,
      rotation: Math.sin(u * 4 + i) * 0.22,
      alpha: 0.92 * fade,
      tint: RAINBOW_HEARTS[i % RAINBOW_HEARTS.length] ?? 0xff9bb8,
    });
  }
  for (let i = 0; i < sparkleCount; i += 1) {
    const angle = (i / Math.max(1, sparkleCount)) * Math.PI * 2 + u * 0.4;
    const dist = radius * (0.35 + u * 0.8) * (0.8 + (i % 2) * 0.25);
    const scale = (0.42 + (i % 3) * 0.14) * (1 - u * 0.3);
    vfx.push({
      texture: "sparkle",
      blend: "add",
      anchor,
      offsetX: Math.cos(angle) * dist,
      offsetY: Math.sin(angle) * dist * 0.8 - u * 14,
      scaleX: scale,
      scaleY: scale,
      rotation: u * 1.2 + i * 0.7,
      alpha: 0.95 * fade,
      tint: SPARKLE_TINTS[i % SPARKLE_TINTS.length] ?? 0xfff099,
    });
  }
}

export function applyTalkTheater(
  battle: Battle,
  tick: number,
  reducedMotion: boolean,
  vfx: BattleVfxParticle[],
): { fae: MotionPose; critter: MotionPose } {
  const fae = reducedMotion
    ? { offsetX: 6, offsetY: 0, scaleX: 1, scaleY: 1, rotation: 0 }
    : composePose(idleBreathing(tick, 0, 0.012), {
        offsetX: 6,
        offsetY: 0,
        scaleX: 1,
        scaleY: 1.01,
        rotation: 0.02,
      });
  const critter = reducedMotion
    ? { offsetX: 0, offsetY: 2, scaleX: 1.01, scaleY: 0.985, rotation: 0 }
    : composePose(idleBreathing(tick, 0.5, 0.012), {
        offsetX: 0,
        offsetY: 2,
        scaleX: 1.01,
        scaleY: 0.985,
        rotation: 0,
      });
  const glowPulse = 0.5 + 0.5 * Math.sin(tick * 0.05);
  vfx.push({
    texture: "softGlow",
    blend: "normal",
    anchor: "critter",
    offsetX: 0,
    offsetY: -8,
    scaleX: 1.9,
    scaleY: 1.6,
    rotation: 0,
    alpha: reducedMotion ? 0.29 : 0.24 + glowPulse * 0.1,
    tint: 0xffebb8,
  });
  for (let i = 0; i < 4; i += 1) {
    const tint = TALK_HEART_TINTS[i % TALK_HEART_TINTS.length] ?? 0xffb7cf;
    if (reducedMotion) {
      vfx.push({
        texture: "heart",
        blend: "normal",
        anchor: "between",
        t: 0.22 + (i / 3) * 0.6,
        offsetX: 0,
        offsetY: -18 - Math.sin(((i + 0.5) / 4) * Math.PI) * 26,
        scaleX: 0.44,
        scaleY: 0.44,
        rotation: 0,
        alpha: 0.72,
        tint,
      });
      continue;
    }
    const cycle = (((tick + i * 24 + 12) % 96) + 0.5) / 96;
    const scale = 0.4 + (i % 2) * 0.08;
    vfx.push({
      texture: "heart",
      blend: "normal",
      anchor: "between",
      t: 0.22 + cycle * 0.6,
      offsetX: Math.sin(cycle * Math.PI * 2 + i) * 6,
      offsetY: -14 - Math.sin(cycle * Math.PI) * 32 + (i % 2 === 0 ? -7 : 7),
      scaleX: scale,
      scaleY: scale,
      rotation: Math.sin(cycle * Math.PI * 2 + i) * 0.16,
      alpha: 0.22 + 0.6 * Math.sin(cycle * Math.PI),
      tint,
    });
  }
  for (let i = 0; i < 3; i += 1) {
    if (reducedMotion) {
      vfx.push({
        texture: "sparkle",
        blend: "normal",
        anchor: "between",
        t: 0.3 + i * 0.22,
        offsetX: 0,
        offsetY: -12 - (i % 2) * 18,
        scaleX: 0.34,
        scaleY: 0.34,
        rotation: 0,
        alpha: 0.76,
        tint: 0xfff0b2,
      });
      continue;
    }
    const cycle = (((tick + i * 28 + 16) % 84) + 0.5) / 84;
    const scale = 0.3 + (i % 2) * 0.08;
    vfx.push({
      texture: "sparkle",
      blend: "normal",
      anchor: "between",
      t: 0.22 + cycle * 0.6,
      offsetX: Math.cos(cycle * Math.PI * 2 + i) * 8,
      offsetY: -10 - Math.sin(cycle * Math.PI) * 26 + ((i % 3) - 1) * 10,
      scaleX: scale,
      scaleY: scale,
      rotation: cycle * 1.4 + i * 0.7,
      alpha: 0.25 + 0.62 * Math.sin(cycle * Math.PI),
      tint: 0xfff0b2,
    });
  }
  const talk = battle.talk;
  if (talk !== null && talk !== undefined && talk.grade !== null) {
    for (let i = 0; i < 3; i += 1) {
      if (reducedMotion) {
        vfx.push({
          texture: "sparkle",
          blend: "normal",
          anchor: "critter",
          offsetX: (i - 1) * 32,
          offsetY: -26 - (i % 2) * 16,
          scaleX: 0.42,
          scaleY: 0.42,
          rotation: 0,
          alpha: 0.8,
          tint: 0xfff0b2,
        });
        continue;
      }
      const cycle = (((tick + i * 20 + 8) % 60) + 0.5) / 60;
      const scale = 0.36 + (i % 2) * 0.1;
      vfx.push({
        texture: "sparkle",
        blend: "normal",
        anchor: "critter",
        offsetX: (i - 1) * 34 + Math.sin(cycle * Math.PI * 2 + i) * 8,
        offsetY: 16 - cycle * 88 - (i % 2) * 8,
        scaleX: scale,
        scaleY: scale,
        rotation: cycle * 1.6 + i * 0.8,
        alpha: 0.24 + 0.68 * Math.sin(cycle * Math.PI),
        tint: 0xfff0b2,
      });
    }
  }
  return { fae, critter };
}

export function applySnackTheater(
  snackKind: Exclude<SnackTheaterKind, "none">,
  phaseTicks: number,
  reducedMotion: boolean,
  faeIn: MotionPose,
  critterIn: MotionPose,
  vfx: BattleVfxParticle[],
): { fae: MotionPose; critter: MotionPose } {
  let fae = faeIn;
  let critter = critterIn;
  if (snackKind === "snack") {
    const u = clamp01(phaseTicks / 22);
    const arc = Math.sin(u * Math.PI);
    if (!reducedMotion) {
      fae = composePose(fae, {
        offsetX: 0,
        offsetY: -8 * arc,
        scaleX: 1 - 0.03 * arc,
        scaleY: 1 + 0.04 * arc,
        rotation: 0,
      });
    }
    vfx.push({
      texture: "softGlow",
      blend: "normal",
      anchor: "fae",
      offsetX: 0,
      offsetY: -6,
      scaleX: reducedMotion ? 1.35 : 1.25 + arc * 0.3,
      scaleY: reducedMotion ? 1.35 : 1.25 + arc * 0.3,
      rotation: 0,
      alpha: reducedMotion ? 0.34 : 0.42 * (0.4 + 0.6 * arc),
      tint: 0xffe58a,
    });
    for (let i = 0; i < 5; i += 1) {
      const tint = SNACK_SPARKLE_TINTS[i % SNACK_SPARKLE_TINTS.length] ?? 0x9be38a;
      if (reducedMotion) {
        vfx.push({
          texture: "sparkle",
          blend: "normal",
          anchor: "fae",
          offsetX: (i - 2) * 20,
          offsetY: -24 - (i % 2) * 14,
          scaleX: 0.52,
          scaleY: 0.52,
          rotation: 0,
          alpha: 0.78,
          tint,
        });
        continue;
      }
      const su = clamp01((phaseTicks + 10 - i * 2) / 36);
      if (su <= 0 || su >= 1) continue;
      const scale = (0.44 + (i % 3) * 0.1) * (0.7 + Math.sin(su * Math.PI) * 0.4);
      vfx.push({
        texture: "sparkle",
        blend: "normal",
        anchor: "fae",
        offsetX: (i - 2) * 22 + Math.sin(su * Math.PI * 2 + i) * 7,
        offsetY: 18 - su * 82 - (i % 2) * 10,
        scaleX: scale,
        scaleY: scale,
        rotation: su * 1.6 + i * 0.5,
        alpha: 0.94 * Math.sin(su * Math.PI),
        tint,
      });
    }
    return { fae, critter };
  }

  const isFav = snackKind === "favourite";
  const u = clamp01(phaseTicks / 24);
  const arc = Math.sin(u * Math.PI);
  const munchArc = Math.sin(clamp01(phaseTicks / 24) * Math.PI);
  if (!reducedMotion) {
    fae = composePose(fae, {
      offsetX: 10 * arc,
      offsetY: -6 * arc,
      scaleX: 1 - 0.03 * arc,
      scaleY: 1 + 0.04 * arc,
      rotation: 0.06 * arc,
    });
    critter = composePose(critter, {
      offsetX: 0,
      offsetY: -(isFav ? 12 : 7) * munchArc,
      scaleX: 1 - (isFav ? 0.05 : 0.03) * munchArc,
      scaleY: 1 + (isFav ? 0.06 : 0.04) * munchArc,
      rotation: 0,
    });
  }
  const arcCount = isFav ? 7 : 4;
  for (let i = 0; i < arcCount; i += 1) {
    const isHeart = i % 2 === 0;
    const tint = isFav
      ? (isHeart
          ? (FAVOURITE_HEART_TINTS[i % FAVOURITE_HEART_TINTS.length] ?? 0xffd859)
          : (i % 4 === 1 ? 0xffe474 : 0xfff4b8))
      : (isHeart
          ? (RAINBOW_HEARTS[i % RAINBOW_HEARTS.length] ?? 0xff9bb8)
          : (SPARKLE_TINTS[i % SPARKLE_TINTS.length] ?? 0xfff099));
    if (reducedMotion) {
      const frac = arcCount <= 1 ? 0.5 : i / (arcCount - 1);
      const scale = isFav ? 0.62 : 0.52;
      vfx.push({
        texture: isHeart ? "heart" : "sparkle",
        blend: "normal",
        anchor: "between",
        t: 0.18 + frac * 0.64,
        offsetX: 0,
        offsetY: -Math.sin(((i + 0.5) / arcCount) * Math.PI) * (isFav ? 54 : 40),
        scaleX: scale,
        scaleY: scale,
        rotation: 0,
        alpha: 0.85,
        tint,
      });
      continue;
    }
    const progress = clamp01((phaseTicks + 12 - i * 2) / 36);
    if (progress <= 0 || progress >= 1) continue;
    const baseScale = isHeart ? (isFav ? 0.66 : 0.54) : (isFav ? 0.58 : 0.48);
    const scale = baseScale * (0.72 + Math.sin(progress * Math.PI) * 0.35);
    vfx.push({
      texture: isHeart ? "heart" : "sparkle",
      blend: "normal",
      anchor: "between",
      t: 0.1 + progress * 0.82,
      offsetX: Math.sin(progress * 5 + i) * 8,
      offsetY: -Math.sin(progress * Math.PI) * (isFav ? 62 : 44) + ((i % 3) - 1) * 12,
      scaleX: scale,
      scaleY: scale,
      rotation: isHeart ? Math.sin(progress * 4 + i) * 0.22 : progress * 2.2 + i,
      alpha: 0.96 * Math.sin(progress * Math.PI),
      tint,
    });
  }
  if (isFav) {
    vfx.push({
      texture: "softGlow",
      blend: "normal",
      anchor: "critter",
      offsetX: 0,
      offsetY: -10,
      scaleX: reducedMotion ? 1.5 : 1.4 + munchArc * 0.25,
      scaleY: reducedMotion ? 1.5 : 1.4 + munchArc * 0.25,
      rotation: 0,
      alpha: reducedMotion ? 0.34 : 0.38 * (0.35 + 0.65 * munchArc),
      tint: 0xffe484,
    });
    if (reducedMotion) {
      for (let i = 0; i < 6; i += 1) {
        const angle = -Math.PI * 0.88 + (i / 5) * Math.PI * 0.76;
        vfx.push({
          texture: "heart",
          blend: "normal",
          anchor: "critter",
          offsetX: Math.cos(angle) * 62,
          offsetY: Math.sin(angle) * 52 - 14,
          scaleX: 0.56,
          scaleY: 0.56,
          rotation: 0,
          alpha: 0.82,
          tint: FAVOURITE_HEART_TINTS[i % FAVOURITE_HEART_TINTS.length] ?? 0xffd859,
        });
      }
    } else {
      radialBurst(vfx, "critter", phaseTicks, 6, 6, 84, 34);
    }
  }
  return { fae, critter };
}

export function applyTogetherReady(
  tick: number,
  partyIds: readonly string[],
  fae: MotionPose,
  applyParty: (actorId: string | null, delta: MotionPose) => void,
  vfx: BattleVfxParticle[],
  reducedMotion = false,
): MotionPose {
  const nextFae = reducedMotion
    ? fae
    : composePose(fae, {
        offsetX: 0,
        offsetY: -Math.abs(Math.sin(tick / 10)) * 2.8,
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
      });
  if (!reducedMotion) {
    partyIds.forEach((id, idx) => {
      applyParty(id, {
        offsetX: 0,
        offsetY: -Math.abs(Math.sin(tick / 10 + (idx + 1) * 0.7)) * 2.8,
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
      });
    });
  }
  const pulse = reducedMotion ? 0.5 : 0.5 + 0.5 * Math.sin(tick * 0.14);
  vfx.push({
    texture: "softGlow",
    blend: "normal",
    anchor: "fae",
    offsetX: -10,
    offsetY: 22,
    scaleX: 2.35 + pulse * 0.2,
    scaleY: 0.9 + pulse * 0.12,
    rotation: 0,
    alpha: 0.32 + pulse * 0.1,
    tint: 0xf5ba32,
  });
  const leftSpan = partyIds.length >= 3 ? -128 : -78;
  const rightSpan = 74;
  for (let i = 0; i < 10; i += 1) {
    const frac = i / 9;
    const twinkle = reducedMotion ? 0.5 : 0.5 + 0.5 * Math.sin(tick * 0.18 + i * 0.9);
    const scale = 0.36 + twinkle * 0.24;
    vfx.push({
      texture: "sparkle",
      blend: "normal",
      anchor: "fae",
      offsetX: leftSpan + (rightSpan - leftSpan) * frac,
      offsetY: 16 - Math.sin(frac * Math.PI) * 52 +
        (reducedMotion ? 0 : Math.sin(tick * 0.15 + i) * 5),
      scaleX: scale,
      scaleY: scale,
      rotation: reducedMotion ? 0 : tick * 0.04 + i * 0.7,
      alpha: 0.78 + twinkle * 0.2,
      tint: i % 2 === 0 ? 0xf5b324 : 0xfff08a,
    });
  }
  return nextFae;
}

export function applyTogetherActive(
  battle: Battle,
  tick: number,
  partyIds: readonly string[],
  faeIn: MotionPose,
  applyParty: (actorId: string | null, delta: MotionPose) => void,
  vfx: BattleVfxParticle[],
  reducedMotion = false,
): MotionPose {
  let fae = faeIn;
  if (reducedMotion) {
    const leanIn: MotionPose = { offsetX: 10, offsetY: 0, scaleX: 1, scaleY: 1, rotation: 0 };
    fae = composePose(fae, leanIn);
    for (const id of partyIds) {
      applyParty(id, leanIn);
    }
  } else if (battle.phase === "check") {
    const faeWave = 0.35 + 0.65 * Math.abs(Math.sin(tick / 6));
    fae = composePose(fae, {
      offsetX: 16 * faeWave,
      offsetY: -18 * faeWave,
      scaleX: 1 - 0.05 * faeWave,
      scaleY: 1 + 0.07 * faeWave,
      rotation: 0.07 * faeWave,
    });
    partyIds.forEach((id, idx) => {
      const wave = 0.35 + 0.65 * Math.abs(Math.sin(tick / 6 + (idx + 1) * 0.6));
      applyParty(id, {
        offsetX: 16 * wave,
        offsetY: -18 * wave,
        scaleX: 1 - 0.05 * wave,
        scaleY: 1 + 0.07 * wave,
        rotation: 0.07 * wave,
      });
    });
  } else {
    const u = clamp01(battle.phaseTicks / 24);
    const arc = Math.sin(u * Math.PI);
    fae = composePose(fae, {
      offsetX: 20 * arc,
      offsetY: -22 * arc,
      scaleX: 1 - 0.05 * arc,
      scaleY: 1 + 0.08 * arc,
      rotation: 0.08 * arc,
    });
    partyIds.forEach((id, idx) => {
      const memberU = clamp01((battle.phaseTicks + idx * 2) / 24);
      const memberArc = Math.sin(memberU * Math.PI);
      applyParty(id, {
        offsetX: 20 * memberArc,
        offsetY: -22 * memberArc,
        scaleX: 1 - 0.05 * memberArc,
        scaleY: 1 + 0.08 * memberArc,
        rotation: 0.08 * memberArc,
      });
    });
  }
  const sunPulse = reducedMotion ? 0.5 : 0.5 + 0.5 * Math.sin(tick * 0.22);
  vfx.push({
    texture: "softGlow",
    blend: "normal",
    anchor: "fae",
    offsetX: -12,
    offsetY: -8,
    scaleX: 1.45 + sunPulse * 0.2,
    scaleY: 1.15 + sunPulse * 0.16,
    rotation: 0,
    alpha: 0.2 + sunPulse * 0.08,
    tint: 0xf7c33e,
  });
  for (let i = 0; i < 3; i += 1) {
    const ru = reducedMotion
      ? 0.25 + i * 0.25
      : battle.phase === "check"
        ? (((tick + i * 10 + 3) % 30) + 0.5) / 30
        : clamp01((battle.phaseTicks + 6 - i * 4) / 26);
    if (ru <= 0 || ru >= 1) continue;
    const scale = 0.65 + ru * 1.35;
    vfx.push({
      texture: "energyRing",
      blend: "normal",
      anchor: "between",
      t: 0.14 + ru * 0.82,
      offsetX: 0,
      offsetY: -Math.sin(ru * Math.PI) * 26,
      scaleX: scale * 0.78,
      scaleY: scale,
      rotation: 0,
      alpha: (1 - ru * 0.55) * 0.92,
      tint: i % 2 === 0 ? 0xf5b324 : 0xffe474,
    });
  }
  for (let i = 0; i < 6; i += 1) {
    if (reducedMotion) {
      const frac = (i + 0.5) / 6;
      vfx.push({
        texture: "sparkle",
        blend: "normal",
        anchor: "between",
        t: 0.14 + frac * 0.72,
        offsetX: 0,
        offsetY: -Math.sin(frac * Math.PI) * 44 + ((i % 3) - 1) * 14,
        scaleX: 0.56,
        scaleY: 0.56,
        rotation: 0,
        alpha: 0.82,
        tint: i % 2 === 0 ? 0xffe066 : 0xfff6c4,
      });
      continue;
    }
    const su = battle.phase === "check"
      ? (((tick + i * 5 + 2) % 30) + 0.5) / 30
      : clamp01((battle.phaseTicks + 12 - i * 2) / 30);
    if (su <= 0 || su >= 1) continue;
    const scale = (0.56 + (i % 3) * 0.14) * (1 - su * 0.2);
    vfx.push({
      texture: "sparkle",
      blend: "normal",
      anchor: "between",
      t: 0.1 + su * 0.86,
      offsetX: Math.sin(su * 6 + i) * 18,
      offsetY: -Math.sin(su * Math.PI) * 54 + ((i % 3) - 1) * 22,
      scaleX: scale,
      scaleY: scale,
      rotation: su * 2.4 + i,
      alpha: 0.96 * (0.45 + 0.55 * Math.sin(su * Math.PI)),
      tint: i % 2 === 0 ? 0xffe066 : 0xfff6c4,
    });
  }
  const heartScales: readonly number[] = [0.56, 0.64, 0.72];
  for (let i = 0; i < 6; i += 1) {
    if (reducedMotion) {
      const frac = (i + 0.5) / 6;
      const scale = heartScales[i % heartScales.length] ?? 0.64;
      vfx.push({
        texture: "heart",
        blend: "normal",
        anchor: "between",
        t: 0.16 + frac * 0.68,
        offsetX: 0,
        offsetY: -Math.sin(frac * Math.PI) * 48 + ((i % 3) - 1) * 12,
        scaleX: scale,
        scaleY: scale,
        rotation: 0,
        alpha: 0.84,
        tint: RAINBOW_HEARTS[i % RAINBOW_HEARTS.length] ?? 0xff9bb8,
      });
      continue;
    }
    const hu = battle.phase === "check"
      ? (((tick + i * 5 + 3) % 30) + 0.5) / 30
      : clamp01((battle.phaseTicks + 12 - i * 2) / 32);
    if (hu <= 0 || hu >= 1) continue;
    const scale = heartScales[i % heartScales.length] ?? 0.64;
    vfx.push({
      texture: "heart",
      blend: "normal",
      anchor: "between",
      t: 0.12 + hu * 0.82,
      offsetX: Math.cos(hu * 5 + i) * 16,
      offsetY: -Math.sin(hu * Math.PI) * 60 + ((i % 3) - 1) * 18,
      scaleX: scale,
      scaleY: scale,
      rotation: Math.sin(hu * 4 + i) * 0.24,
      alpha: 0.96 * (0.5 + 0.5 * Math.sin(hu * Math.PI)),
      tint: RAINBOW_HEARTS[i % RAINBOW_HEARTS.length] ?? 0xff9bb8,
    });
  }
  return fae;
}

export function applyWindUpAndFizzle(
  battle: Battle,
  puff: number,
  calmMood: boolean,
  tick: number,
  critterIn: MotionPose,
  vfx: BattleVfxParticle[],
  reducedMotion = false,
): MotionPose {
  let critter = critterIn;
  if (puff >= 2 && battle.phase !== "fizzle" && !calmMood) {
    if (!reducedMotion) {
      critter = composePose(critter, {
        offsetX: Math.sin(tick * 1.9) * 2.2,
        offsetY: 0,
        scaleX: 1,
        scaleY: 1,
        rotation: Math.cos(tick * 2.3) * 0.025,
      });
    }
    for (let i = 0; i < 4; i += 1) {
      if (reducedMotion) {
        vfx.push({
          texture: i % 2 === 0 ? "sparkle" : "puff",
          blend: i % 2 === 0 ? "add" : "normal",
          anchor: "critter",
          offsetX: (i - 1.5) * 26,
          offsetY: -22 - (i % 2) * 18,
          scaleX: 0.36,
          scaleY: 0.36,
          rotation: 0,
          alpha: 0.62,
          tint: FIZZ_TINTS[i % FIZZ_TINTS.length] ?? 0xe6b8ff,
        });
        continue;
      }
      const cycle = ((tick + i * 9) % 36) / 36;
      vfx.push({
        texture: i % 2 === 0 ? "sparkle" : "puff",
        blend: i % 2 === 0 ? "add" : "normal",
        anchor: "critter",
        offsetX: Math.sin(cycle * Math.PI * 2 + i * 1.7) * 44,
        offsetY: 20 - cycle * 96,
        scaleX: 0.28 + (1 - cycle) * 0.16,
        scaleY: 0.28 + (1 - cycle) * 0.16,
        rotation: cycle * 1.2 + i,
        alpha: Math.sin(cycle * Math.PI) * 0.72,
        tint: FIZZ_TINTS[i % FIZZ_TINTS.length] ?? 0xe6b8ff,
      });
    }
  }
  if (battle.phase === "fizzle") {
    const u = Math.max(0, 1 - battle.phaseTicks / 28);
    if (!reducedMotion) {
      critter = composePose(critter, {
        offsetX: 0,
        offsetY: 0,
        scaleX: 1 + 0.18 * u,
        scaleY: 1 - 0.2 * u,
        rotation: 0,
      });
    }
    const puffU = clamp01((battle.phaseTicks + 2) / 28);
    const puffAlpha = (1 - puffU) * 0.78;
    if (puffAlpha > 0.02) {
      for (let i = 0; i < 5; i += 1) {
        const angle = -Math.PI + (i / 4) * Math.PI;
        const dist = reducedMotion ? 56 : 28 + puffU * 66;
        const scale = reducedMotion ? 0.68 : 0.45 + puffU * 0.55;
        vfx.push({
          texture: "puff",
          blend: "normal",
          anchor: "critter",
          offsetX: Math.cos(angle) * dist,
          offsetY: Math.sin(angle) * dist * 0.55 - (reducedMotion ? 12 : puffU * 24),
          scaleX: scale,
          scaleY: scale,
          rotation: reducedMotion ? 0 : angle * 0.25,
          alpha: puffAlpha,
          tint: i % 2 === 0 ? 0xf2d8ee : 0xfaf3df,
        });
      }
    }
  }
  return critter;
}

export function applySoothedAndReward(
  battle: Battle,
  tick: number,
  critterIn: MotionPose,
  vfx: BattleVfxParticle[],
  reducedMotion = false,
): { critter: MotionPose; auraScaleBoost: number } {
  let critter = critterIn;
  let auraScaleBoost = 1;
  if (battle.phase === "soothed") {
    const p = clamp01(battle.phaseTicks / 30);
    auraScaleBoost = 1 + p * 0.45;
    if (reducedMotion) {
      for (let i = 0; i < 6; i += 1) {
        const angle = -Math.PI * 0.88 + (i / 5) * Math.PI * 0.76;
        vfx.push({
          texture: "heart",
          blend: "normal",
          anchor: "critter",
          offsetX: Math.cos(angle) * 68,
          offsetY: Math.sin(angle) * 56 - 16,
          scaleX: 0.56,
          scaleY: 0.56,
          rotation: 0,
          alpha: 0.82,
          tint: RAINBOW_HEARTS[i % RAINBOW_HEARTS.length] ?? 0xff9bb8,
        });
      }
    } else {
      const bounce = Math.abs(Math.sin(battle.phaseTicks / 7)) *
        Math.max(0, 1 - battle.phaseTicks / 36);
      critter = composePose(critter, {
        offsetX: 0,
        offsetY: -bounce * 10,
        scaleX: 1 - bounce * 0.03,
        scaleY: 1 + bounce * 0.04,
        rotation: 0,
      });
      radialBurst(vfx, "critter", battle.phaseTicks, 7, 9, 108, 36);
    }
  }
  if (battle.phase === "soothed" || battle.phase === "reward") {
    for (let i = 0; i < 8; i += 1) {
      if (reducedMotion) {
        const spreadX = ((i % 4) - 1.5) * 44;
        const riseY = -12 - Math.floor(i / 4) * 42 - (i % 2) * 14;
        const scale = 0.44 + (i % 3) * 0.14;
        vfx.push({
          texture: "petal",
          blend: "normal",
          anchor: "critter",
          offsetX: spreadX,
          offsetY: riseY,
          scaleX: scale,
          scaleY: scale,
          rotation: 0,
          alpha: 0.72,
          tint: RELIEF_PETALS[i % RELIEF_PETALS.length] ?? 0xa8e6cf,
        });
        continue;
      }
      const cycle = ((tick + i * 8 + 4) % 64) / 64;
      const spreadX = ((i % 4) - 1.5) * 44 + Math.sin(cycle * Math.PI * 2 + i * 1.4) * 18;
      const riseY = 38 - cycle * 155;
      const fade = Math.sin(cycle * Math.PI);
      const scale = 0.44 + (i % 3) * 0.14;
      vfx.push({
        texture: "petal",
        blend: "normal",
        anchor: "critter",
        offsetX: spreadX,
        offsetY: riseY,
        scaleX: scale,
        scaleY: scale,
        rotation: Math.sin(cycle * Math.PI * 2 + i) * 0.65,
        alpha: 0.78 * fade,
        tint: RELIEF_PETALS[i % RELIEF_PETALS.length] ?? 0xa8e6cf,
      });
    }
  }
  return { critter, auraScaleBoost };
}
