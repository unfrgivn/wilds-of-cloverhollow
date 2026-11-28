import { dualComboById, isDualComboCommand, type Battle, type DualComboId } from "../core";
import { composePose, type MotionPose } from "./motion";
import type { BattleVfxParticle } from "./battle-vfx";

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export const DUAL_COMBO_PALETTES: Readonly<Record<DualComboId, readonly number[]>> = {
  "combo:yarn-ball-lullaby": [0xffcfa0, 0xd4b6fa, 0xffe4b8, 0xf7b8d4],
  "combo:bubblegum-lasso-spin": [0xff8ec4, 0xffcf56, 0x7ec8f2, 0x8de0a8, 0xc9a8ff],
  "combo:rainbow-splash-juggle": [0x6ee0d8, 0xffe066, 0xff8b94, 0x9ecaf2, 0xb8e89c],
  "combo:cloverhollow-harmony": [0x8ee0b0, 0xffe27a, 0xffa6c4, 0x8fd3ff, 0xd6b8ff],
};

export function isDualComboActive(battle: Battle): boolean {
  return (
    isDualComboCommand(battle.command) &&
    (battle.phase === "check" || (battle.phase === "result" && battle.lastGrade !== null))
  );
}

function emitYarnLullabyVfx(
  battle: Battle,
  tick: number,
  vfx: BattleVfxParticle[],
  reducedMotion: boolean,
): void {
  const palette = DUAL_COMBO_PALETTES["combo:yarn-ball-lullaby"];
  const pulse = reducedMotion ? 0.5 : 0.5 + 0.5 * Math.sin(tick * 0.16);
  vfx.push(
    {
      texture: "softGlow",
      blend: "normal",
      anchor: "fae",
      offsetX: 6,
      offsetY: -10,
      scaleX: 1.55 + pulse * 0.18,
      scaleY: 1.2 + pulse * 0.14,
      rotation: 0,
      alpha: 0.28 + pulse * 0.08,
      tint: palette[0] ?? 0xffcfa0,
    },
    {
      texture: "softGlow",
      blend: "normal",
      anchor: "critter",
      offsetX: 0,
      offsetY: -8,
      scaleX: 1.7 + pulse * 0.18,
      scaleY: 1.3 + pulse * 0.14,
      rotation: 0,
      alpha: 0.26 + pulse * 0.08,
      tint: palette[1] ?? 0xd4b6fa,
    },
  );
  for (let i = 0; i < 6; i += 1) {
    const u = reducedMotion
      ? 0.12 + (i / 5) * 0.76
      : battle.phase === "check"
        ? (((tick + i * 6) % 36) + 0.5) / 36
        : clamp01((battle.phaseTicks + 8 - i * 2) / 28);
    if (u <= 0 || u >= 1) continue;
    const isHeart = i % 2 === 0;
    const arch = Math.sin(u * Math.PI) * 58;
    const scale = (isHeart ? 0.56 : 0.48) * (0.85 + 0.25 * Math.sin(u * Math.PI));
    vfx.push({
      texture: isHeart ? "heart" : "sparkle",
      blend: "normal",
      anchor: "between",
      t: 0.08 + u * 0.84,
      offsetX: reducedMotion ? 0 : Math.sin(u * 5 + i) * 12,
      offsetY: -arch + ((i % 3) - 1) * 14,
      scaleX: scale,
      scaleY: scale,
      rotation: reducedMotion ? 0 : Math.sin(u * 4 + i) * 0.22,
      alpha: 0.92 * (0.45 + 0.55 * Math.sin(u * Math.PI)),
      tint: palette[i % palette.length] ?? 0xffcfa0,
    });
  }
}

function emitBubblegumLassoVfx(
  battle: Battle,
  tick: number,
  vfx: BattleVfxParticle[],
  reducedMotion: boolean,
): void {
  const palette = DUAL_COMBO_PALETTES["combo:bubblegum-lasso-spin"];
  const spin = reducedMotion ? 0 : tick * 0.16;
  for (let i = 0; i < 3; i += 1) {
    const u = reducedMotion
      ? 0.28 + i * 0.22
      : battle.phase === "check"
        ? (((tick + i * 10) % 30) + 0.5) / 30
        : clamp01((battle.phaseTicks + 6 - i * 4) / 26);
    if (u <= 0 || u >= 1) continue;
    const scale = 0.75 + u * 1.15;
    vfx.push({
      texture: "energyRing",
      blend: "normal",
      anchor: "between",
      t: 0.22 + u * 0.72,
      offsetX: 0,
      offsetY: -12 - Math.sin(u * Math.PI) * 20,
      scaleX: scale * 1.1,
      scaleY: scale * 0.52,
      rotation: reducedMotion ? 0 : -0.16 + Math.sin(spin + i) * 0.08,
      alpha: (1 - u * 0.55) * 0.9,
      tint: palette[i % palette.length] ?? 0xff8ec4,
    });
  }
  for (let i = 0; i < 6; i += 1) {
    const angle = (i / 6) * Math.PI * 2 + spin;
    const isPuff = i % 2 === 1;
    const radiusX = 64 + (i % 2) * 22;
    const radiusY = 28 + (i % 3) * 10;
    const scale = isPuff ? 0.44 : 0.54;
    vfx.push({
      texture: isPuff ? "puff" : "sparkle",
      blend: "normal",
      anchor: "critter",
      offsetX: Math.cos(angle) * radiusX,
      offsetY: -8 + Math.sin(angle) * radiusY,
      scaleX: scale,
      scaleY: scale,
      rotation: reducedMotion ? 0 : spin * 0.6 + i * 0.5,
      alpha: 0.88,
      tint: palette[i % palette.length] ?? 0xff8ec4,
    });
  }
}

function emitRainbowJuggleVfx(
  battle: Battle,
  tick: number,
  vfx: BattleVfxParticle[],
  reducedMotion: boolean,
): void {
  const palette = DUAL_COMBO_PALETTES["combo:rainbow-splash-juggle"];
  for (let i = 0; i < 6; i += 1) {
    const u = reducedMotion
      ? 0.14 + (i / 5) * 0.72
      : battle.phase === "check"
        ? (((tick + i * 5 + 2) % 30) + 0.5) / 30
        : clamp01((battle.phaseTicks + 10 - i * 2) / 28);
    if (u <= 0 || u >= 1) continue;
    const cross = i % 2 === 0 ? 1 : -1;
    const arcY = -Math.sin(u * Math.PI) * (54 + (i % 3) * 12);
    const scale = 0.52 + (i % 3) * 0.1;
    vfx.push({
      texture: i % 3 === 0 ? "heart" : "sparkle",
      blend: "normal",
      anchor: "between",
      t: 0.1 + u * 0.84,
      offsetX: cross * Math.sin(u * Math.PI * 2) * 16,
      offsetY: arcY + cross * 10,
      scaleX: scale,
      scaleY: scale,
      rotation: reducedMotion ? 0 : u * 2.2 + i,
      alpha: 0.94 * (0.45 + 0.55 * Math.sin(u * Math.PI)),
      tint: palette[i % palette.length] ?? 0x6ee0d8,
    });
  }
  for (let i = 0; i < 2; i += 1) {
    const u = reducedMotion
      ? 0.35 + i * 0.3
      : (((tick + i * 14) % 28) + 0.5) / 28;
    const scale = 0.7 + u * 1.1;
    vfx.push({
      texture: "energyRing",
      blend: "add",
      anchor: "critter",
      offsetX: (i === 0 ? -1 : 1) * 18,
      offsetY: -10,
      scaleX: scale,
      scaleY: scale * 0.75,
      rotation: 0,
      alpha: (1 - u * 0.65) * 0.86,
      tint: palette[i] ?? 0x6ee0d8,
    });
  }
}

function emitCloverhollowHarmonyVfx(
  battle: Battle,
  tick: number,
  vfx: BattleVfxParticle[],
  reducedMotion: boolean,
): void {
  const palette = DUAL_COMBO_PALETTES["combo:cloverhollow-harmony"];
  const pulse = reducedMotion ? 0.5 : 0.5 + 0.5 * Math.sin(tick * 0.2);
  vfx.push({
    texture: "softGlow",
    blend: "normal",
    anchor: "fae",
    offsetX: -12,
    offsetY: -8,
    scaleX: 1.65 + pulse * 0.2,
    scaleY: 1.3 + pulse * 0.16,
    rotation: 0,
    alpha: 0.26 + pulse * 0.08,
    tint: palette[1] ?? 0xffe27a,
  });
  for (let i = 0; i < 3; i += 1) {
    const ru = reducedMotion
      ? 0.25 + i * 0.25
      : battle.phase === "check"
        ? (((tick + i * 10 + 3) % 30) + 0.5) / 30
        : clamp01((battle.phaseTicks + 6 - i * 4) / 26);
    if (ru <= 0 || ru >= 1) continue;
    const scale = 0.7 + ru * 1.45;
    vfx.push({
      texture: "energyRing",
      blend: "normal",
      anchor: "between",
      t: 0.14 + ru * 0.82,
      offsetX: 0,
      offsetY: -Math.sin(ru * Math.PI) * 28,
      scaleX: scale * 0.82,
      scaleY: scale,
      rotation: 0,
      alpha: (1 - ru * 0.55) * 0.92,
      tint: i % 2 === 0 ? (palette[0] ?? 0x8ee0b0) : (palette[1] ?? 0xffe27a),
    });
  }
  for (let i = 0; i < 8; i += 1) {
    const isPetal = i < 4;
    const u = reducedMotion
      ? 0.15 + ((i % 4) / 3) * 0.7
      : battle.phase === "check"
        ? (((tick + i * 4 + 2) % 32) + 0.5) / 32
        : clamp01((battle.phaseTicks + 12 - i * 2) / 30);
    if (u <= 0 || u >= 1) continue;
    const scale = isPetal ? 0.7 : 0.56;
    vfx.push({
      texture: isPetal ? "petal" : "sparkle",
      blend: "normal",
      anchor: "between",
      t: 0.1 + u * 0.84,
      offsetX: reducedMotion ? 0 : Math.sin(u * 5 + i) * 18,
      offsetY: -Math.sin(u * Math.PI) * 62 + ((i % 3) - 1) * 18,
      scaleX: scale,
      scaleY: scale,
      rotation: reducedMotion ? 0 : u * 2 + i * 0.7,
      alpha: 0.94 * (0.45 + 0.55 * Math.sin(u * Math.PI)),
      tint: palette[i % palette.length] ?? 0x8ee0b0,
    });
  }
}

/**
 * Choreographs partner leaps/leans and signature VFX for all 4 Track E7
 * Dual-Friend Synergy Combos. Pure and Pixi-free.
 */
export function applyDualComboTheater(
  battle: Battle,
  tick: number,
  partyIds: readonly string[],
  faeIn: MotionPose,
  applyParty: (actorId: string | null, delta: MotionPose) => void,
  vfx: BattleVfxParticle[],
  reducedMotion = false,
): MotionPose {
  if (!isDualComboCommand(battle.command)) return faeIn;
  const combo = dualComboById(battle.command);
  if (combo === null) return faeIn;
  const partners = new Set(combo.partners);
  const isHarmony = combo.id === "combo:cloverhollow-harmony";
  let fae = faeIn;

  const partnerPose = (index: number): MotionPose => {
    if (reducedMotion) {
      return { offsetX: 10, offsetY: 0, scaleX: 1, scaleY: 1, rotation: 0 };
    }
    if (battle.phase === "check") {
      const wave = 0.35 + 0.65 * Math.abs(Math.sin(tick / 6 + index * 0.6));
      const amp = isHarmony ? 18 : 14;
      return {
        offsetX: amp * wave,
        offsetY: -amp * wave,
        scaleX: 1 - 0.04 * wave,
        scaleY: 1 + 0.06 * wave,
        rotation: 0.06 * wave,
      };
    }
    const u = clamp01((battle.phaseTicks + index * 2) / 24);
    const arc = Math.sin(u * Math.PI);
    const amp = isHarmony ? 20 : 16;
    return {
      offsetX: amp * arc,
      offsetY: -amp * arc,
      scaleX: 1 - 0.05 * arc,
      scaleY: 1 + 0.07 * arc,
      rotation: 0.07 * arc,
    };
  };

  if (partners.has("fae")) fae = composePose(fae, partnerPose(0));
  partyIds.forEach((id, idx) => {
    if (partners.has(id)) applyParty(id, partnerPose(idx + 1));
  });

  if (combo.id === "combo:yarn-ball-lullaby") {
    emitYarnLullabyVfx(battle, tick, vfx, reducedMotion);
  } else if (combo.id === "combo:bubblegum-lasso-spin") {
    emitBubblegumLassoVfx(battle, tick, vfx, reducedMotion);
  } else if (combo.id === "combo:rainbow-splash-juggle") {
    emitRainbowJuggleVfx(battle, tick, vfx, reducedMotion);
  } else {
    emitCloverhollowHarmonyVfx(battle, tick, vfx, reducedMotion);
  }
  return fae;
}
