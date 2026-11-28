import type { Battle } from "../core";
import type { MotionPose } from "./motion";
import type { BattleVfxParticle } from "./battle-vfx";
import { RAINBOW_LASSO_COLORS } from "./battle-vfx-checks-v2";
export {
  ECHO_CHIME_COLORS,
  echoNoteColor,
  emitEchoChimeVfx,
  emitLeanWindVfx,
  emitPeekabooVfx,
  emitTraceBrushVfx,
  LEAN_WIND_TINTS,
  PEEKABOO_DUST_TINT,
  PEEKABOO_WARNING_TINT,
  PEEKABOO_WATCH_TINTS,
  TRACE_BRUSH_COLORS,
  type EchoChimeMotion,
  type EchoColor,
  type TraceBrushMotion,
} from "./battle-vfx-checks";
export {
  emitSpinSnagVfx,
  emitWhackVfx,
  emitWhichOneVfx,
  RAINBOW_LASSO_COLORS,
  SPIN_SNAG_COLORS,
  WHACK_VFX_COLORS,
  WHICH_ONE_VFX_COLORS,
  type SpinSnagColors,
  type SpinSnagMotion,
  type WhackMotion,
  type WhackVfxColors,
  type WhichOneMotion,
  type WhichOneVfxColors,
} from "./battle-vfx-checks-v2";
export {
  applyDualComboTheater,
  DUAL_COMBO_PALETTES,
  isDualComboActive,
} from "./battle-vfx-combos";

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export const LASSO_ARC_DURATION = 32;

export const SOOTHED_CONFETTI_COLORS: readonly number[] = [
  0xff9ebb,
  0xffe07d,
  0x9de0ad,
  0x92d4ff,
  0xc9b3ff,
];

export function isLassoActionActive(battle: Battle): boolean {
  return (
    battle.phase === "command" &&
    battle.lassoUsed === true &&
    battle.phaseTicks >= 0 &&
    battle.phaseTicks < LASSO_ARC_DURATION &&
    battle.message.toLowerCase().includes("lasso")
  );
}

export function emitRainbowLassoVfx(
  vfx: BattleVfxParticle[],
  battle: Battle,
  reducedMotion = false,
): void {
  const p = battle.phaseTicks;
  const reach = clamp01((p + 2) / 14);
  const arcFade = p < 24 ? 1 : clamp01((LASSO_ARC_DURATION - p) / 8);
  if (arcFade <= 0.02) return;

  const arcLift = 96;
  const whipDecay = 1 - clamp01((p - 10) / 14);
  const ropeSteps = 14;
  for (let i = 0; i < ropeSteps; i += 1) {
    const u = 0.04 + (i / (ropeSteps - 1)) * 0.92;
    if (u > reach) continue;
    const color =
      RAINBOW_LASSO_COLORS[Math.floor((i / ropeSteps) * RAINBOW_LASSO_COLORS.length)] ??
      0xff6e93;
    const whip = reducedMotion
      ? 0
      : Math.sin(u * Math.PI * 3 - p * 0.45) * 5 * whipDecay * Math.sin(u * Math.PI);
    const tangent = Math.atan2(-42 - 2 * (1 - 2 * u) * arcLift, 330);
    const tipBoost = p < 14 && Math.abs(u - reach) < 0.1 ? 1.18 : 1;
    vfx.push({
      texture: "softGlow",
      blend: "normal",
      anchor: "between",
      t: u,
      offsetX: (1 - u) * 26,
      offsetY: (1 - u) * 8 - 2 * u * (1 - u) * arcLift + whip,
      scaleX: 0.48 * tipBoost,
      scaleY: 0.26 * tipBoost,
      rotation: reducedMotion ? 0 : tangent,
      alpha: Math.min(0.96, 0.95 * arcFade + 0.1),
      tint: color,
    });
  }

  for (let c = 0; c < RAINBOW_LASSO_COLORS.length; c += 1) {
    const u = 0.06 + ((c + 0.5) / RAINBOW_LASSO_COLORS.length) * 0.88;
    if (u > reach) continue;
    const color = RAINBOW_LASSO_COLORS[c] ?? 0xffd23f;
    const whip = reducedMotion
      ? 0
      : Math.sin(u * Math.PI * 3 - p * 0.45) * 5 * whipDecay * Math.sin(u * Math.PI);
    const twinkle = reducedMotion ? 0.5 : 0.5 + 0.5 * Math.sin(p * 0.45 + c * 1.1);
    const scale = 0.54 + twinkle * 0.16;
    vfx.push({
      texture: "sparkle",
      blend: "normal",
      anchor: "between",
      t: u,
      offsetX: (1 - u) * 26,
      offsetY: (1 - u) * 8 - 2 * u * (1 - u) * arcLift + whip,
      scaleX: scale,
      scaleY: scale,
      rotation: reducedMotion ? 0 : p * 0.08 + c * 0.6,
      alpha: Math.min(0.96, 0.98 * arcFade + 0.1),
      tint: color,
    });
  }

  // Shimmering rainbow loop settling cleanly around the critter (ticks 8..32).
  if (p >= 8) {
    const loopIn = clamp01((p - 7) / 5);
    const loopFade = p < 24 ? loopIn : clamp01((LASSO_ARC_DURATION - p) / 8);
    const settle = 1 - 0.12 * loopIn;
    vfx.push(
      {
        texture: "energyRing",
        blend: "normal",
        anchor: "critter",
        offsetX: 0,
        offsetY: 8,
        scaleX: 1.78 * settle,
        scaleY: 0.84 * settle,
        rotation: reducedMotion ? 0 : -0.14,
        alpha: 0.92 * loopFade,
        tint: 0xffd23f,
      },
      {
        texture: "energyRing",
        blend: "add",
        anchor: "critter",
        offsetX: 0,
        offsetY: 8,
        scaleX: 1.56 * settle,
        scaleY: 0.72 * settle,
        rotation: reducedMotion ? 0 : -0.14,
        alpha: 0.76 * loopFade,
        tint: 0xff6e93,
      },
    );
    const orbitPhase = reducedMotion ? 0 : (p - 8) * 0.16;
    const tilt = -0.14;
    const cosTilt = Math.cos(tilt);
    const sinTilt = Math.sin(tilt);
    for (let c = 0; c < RAINBOW_LASSO_COLORS.length; c += 1) {
      const angle = (c / RAINBOW_LASSO_COLORS.length) * Math.PI * 2 + orbitPhase;
      const lx = Math.cos(angle) * 76 * settle;
      const ly = Math.sin(angle) * 34 * settle;
      const scale = 0.46 + (c % 2) * 0.12;
      vfx.push({
        texture: "sparkle",
        blend: "normal",
        anchor: "critter",
        offsetX: lx * cosTilt - ly * sinTilt,
        offsetY: 8 + lx * sinTilt + ly * cosTilt,
        scaleX: scale,
        scaleY: scale,
        rotation: reducedMotion ? 0 : p * 0.1 + c * 0.7,
        alpha: 0.96 * loopFade,
        tint: RAINBOW_LASSO_COLORS[c] ?? 0x6ec3ff,
      });
    }

    // Steady Snag (+4 coins): 4 warm golden coin glints popping cleanly above the critter.
    if (battle.lassoSteady === true) {
      const coinU = clamp01((p - 8) / 22);
      const coinAlpha = (1 - coinU * coinU) * Math.min(1, (p - 7) / 3) * arcFade;
      if (coinAlpha > 0.02) {
        const spreads: readonly number[] = [-64, -22, 22, 64];
        for (let i = 0; i < spreads.length; i += 1) {
          const baseSpread = spreads[i] ?? 0;
          const arch = i === 1 || i === 2 ? 18 : 0;
          const lift = Math.sin(coinU * Math.PI * 0.85) * 56;
          const scale = (0.66 + (i % 2) * 0.14) * (1 - coinU * 0.22);
          vfx.push({
            texture: "sparkle",
            blend: "normal",
            anchor: "critter",
            offsetX: baseSpread * (0.9 + coinU * 0.38),
            offsetY: -84 - arch - lift,
            scaleX: scale,
            scaleY: scale,
            rotation: reducedMotion ? 0 : coinU * 2.2 + i * 0.8,
            alpha: 0.98 * coinAlpha,
            tint: 0xffdf6b,
          });
        }
      }
    }

    // Wind-up bubble pop: crisp sky-blue puffs + sparkles bursting outward.
    const msgLower = battle.message.toLowerCase();
    if (msgLower.includes("pop") || msgLower.includes("bubble")) {
      const popU = clamp01((p - 7) / 22);
      const popFade = (1 - popU * popU) * arcFade;
      if (popFade > 0.02) {
        for (let i = 0; i < 4; i += 1) {
          const angle = -Math.PI * 0.85 + (i / 3) * Math.PI * 0.75;
          const puffDist = 26 + popU * 56;
          const puffScale = 0.42 + popU * 0.36;
          vfx.push({
            texture: "puff",
            blend: "normal",
            anchor: "critter",
            offsetX: Math.cos(angle) * puffDist,
            offsetY: -24 + Math.sin(angle) * puffDist * 0.7,
            scaleX: puffScale,
            scaleY: puffScale,
            rotation: reducedMotion ? 0 : angle * 0.25,
            alpha: 0.84 * popFade,
            tint: 0x8fd3ff,
          });
          const sparkAngle = angle + 0.35;
          const sparkDist = 34 + popU * 72;
          const sparkScale = 0.54 * (1 - popU * 0.3);
          vfx.push({
            texture: "sparkle",
            blend: "add",
            anchor: "critter",
            offsetX: Math.cos(sparkAngle) * sparkDist,
            offsetY: -26 + Math.sin(sparkAngle) * sparkDist * 0.75,
            scaleX: sparkScale,
            scaleY: sparkScale,
            rotation: reducedMotion ? 0 : popU * 2.4 + i,
            alpha: 0.95 * popFade,
            tint: 0x8fd3ff,
          });
        }
      }
    }
  }
}

export function emitSoothedConfettiVfx(
  vfx: BattleVfxParticle[],
  phaseTicks: number,
  reducedMotion = false,
): void {
  const glowPulse = reducedMotion ? 0.5 : 0.5 + 0.5 * Math.sin(phaseTicks * 0.18);
  vfx.push({
    texture: "softGlow",
    blend: "normal",
    anchor: "critter",
    offsetX: 0,
    offsetY: -12,
    scaleX: 2.3 + glowPulse * 0.2,
    scaleY: 1.95 + glowPulse * 0.18,
    rotation: 0,
    alpha: 0.3 + glowPulse * 0.08,
    tint: 0xffe07d,
  });

  for (let i = 0; i < 10; i += 1) {
    const isSparkle = i >= 5;
    const lane = isSparkle ? i - 5 : i;
    const side = i % 2 === 0 ? -1 : 1;
    const cycle = reducedMotion ? 0.45 : ((phaseTicks + i * 4 + 4) % 44) / 44;
    const fade = Math.sin(cycle * Math.PI);
    const baseSpread = (isSparkle ? 96 : 90) + lane * 20;
    const outward = cycle * (28 + lane * 5);
    const sway = reducedMotion ? 0 : Math.sin(cycle * Math.PI * 2 + i * 1.3) * 8;
    const startY = isSparkle
      ? -142 + ((lane + 1) % 3) * 24
      : -134 + (lane % 3) * 26;
    const scale = isSparkle ? 0.62 + (lane % 2) * 0.16 : 0.84 + (lane % 3) * 0.1;
    const tint = SOOTHED_CONFETTI_COLORS[i % SOOTHED_CONFETTI_COLORS.length] ?? 0xff9ebb;
    vfx.push({
      texture: isSparkle ? "sparkle" : "petal",
      blend: "normal",
      anchor: "critter",
      offsetX: side * (baseSpread + outward) + sway,
      offsetY: startY + cycle * 164,
      scaleX: scale,
      scaleY: scale,
      rotation: reducedMotion
        ? 0
        : side * (0.35 + cycle * 1.4) +
          (isSparkle ? lane * 0.5 : Math.sin(cycle * Math.PI * 2 + i) * 0.55),
      alpha: 0.96 * fade,
      tint,
    });
  }
}

const REST_STAR_TINTS: readonly number[] = [0xfff099, 0xd8b8ff, 0xffe09e];

/**
 * Cozy fainting choreography for `battle.phase === "rest"`: gentle dizzy sway
 * (ticks 0..14) -> smoothstep sideways slump (14..32) -> slow resting breath
 * (32+), orbiting pastel overhead sparkle stars, and sympathetic party droop.
 */
export function applyRestFaint(
  phaseTicks: number,
  tick: number,
  partyIds: readonly string[],
  party: Record<string, MotionPose>,
  vfx: BattleVfxParticle[],
  reducedMotion: boolean,
): MotionPose {
  if (reducedMotion) {
    for (const id of partyIds) {
      party[id] = { offsetX: 0, offsetY: 3, scaleX: 1, scaleY: 0.96, rotation: -0.05 };
    }
    vfx.push(
      {
        texture: "sparkle",
        blend: "add",
        anchor: "fae",
        offsetX: -18,
        offsetY: -34,
        scaleX: 0.34,
        scaleY: 0.34,
        rotation: 0,
        alpha: 0.78,
        tint: 0xfff099,
      },
      {
        texture: "sparkle",
        blend: "add",
        anchor: "fae",
        offsetX: 6,
        offsetY: -40,
        scaleX: 0.32,
        scaleY: 0.32,
        rotation: 0,
        alpha: 0.78,
        tint: 0xd8b8ff,
      },
    );
    return { offsetX: -8, offsetY: 16, scaleX: 1.06, scaleY: 0.92, rotation: -0.78 };
  }

  const slumpT = clamp01((phaseTicks - 14) / 18);
  const s = slumpT * slumpT * (3 - 2 * slumpT);
  let fae: MotionPose;
  if (phaseTicks < 14) {
    const u = phaseTicks / 14;
    const wave = Math.sin(u * Math.PI * 3);
    fae = {
      offsetX: wave * 7 * (1 - u * 0.3),
      offsetY: 3 * u,
      scaleX: 1,
      scaleY: 1,
      rotation: wave * 0.14,
    };
  } else if (phaseTicks < 32) {
    fae = {
      offsetX: -10 * s,
      offsetY: 3 + 15 * s,
      scaleX: 1 + 0.08 * s,
      scaleY: 1 - 0.1 * s,
      rotation: -0.88 * s,
    };
  } else {
    const breath = 0.012 * Math.sin(tick / 20);
    fae = {
      offsetX: -10,
      offsetY: 18,
      scaleX: 1.08 + breath,
      scaleY: 0.9 - breath,
      rotation: -0.88,
    };
  }
  for (const id of partyIds) {
    party[id] = {
      offsetX: -3 * s,
      offsetY: 4 * s,
      scaleX: 1 + 0.02 * s,
      scaleY: 1 - 0.05 * s,
      rotation: -0.08 * s,
    };
  }
  for (let i = 0; i < 3; i += 1) {
    const angle = tick * 0.065 + (i * Math.PI * 2) / 3;
    const scale = 0.34 + 0.06 * Math.sin(angle);
    vfx.push({
      texture: "sparkle",
      blend: "add",
      anchor: "fae",
      offsetX: fae.offsetX - 6 * s + Math.cos(angle) * 22,
      offsetY: -40 + fae.offsetY * 0.55 + Math.sin(angle) * 7,
      scaleX: scale,
      scaleY: scale,
      rotation: angle * 0.5,
      alpha: 0.78,
      tint: REST_STAR_TINTS[i] ?? 0xfff099,
    });
  }
  return fae;
}
