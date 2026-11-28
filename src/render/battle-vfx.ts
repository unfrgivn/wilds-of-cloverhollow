import type { Battle } from "../core";
import { composePose, type MotionPose } from "./motion";
import { clamp01, RAINBOW_HEARTS } from "./battle-theater";
export {
  applyRecoverTheater,
  applySnackTheater,
  applySoothedAndReward,
  applyTalkTheater,
  clamp01,
  classifySnackTheater,
  isRecoverTheater,
  isTalkTheater,
  radialBurst,
  RAINBOW_HEARTS,
  RECOVER_SPARKLE_TINTS,
  RELIEF_PETALS,
  SPARKLE_TINTS,
  type SnackTheaterKind,
} from "./battle-theater";
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

export const FIZZ_TINTS: readonly number[] = [0xe6b8ff, 0xffb8d8, 0xd8c4ff];

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
