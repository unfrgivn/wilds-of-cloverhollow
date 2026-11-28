import type {
  Battle,
  BattleCheckView,
  CheckState,
  EchoNote,
  PeekabooStatus,
} from "../core";
import type { MotionPose } from "./motion";
import type { BattleVfxParticle } from "./battle-vfx";
import { RAINBOW_LASSO_COLORS } from "./battle-vfx-checks-v2";
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

export type EchoColor = "red" | "yellow" | "green" | "blue";

export const ECHO_CHIME_COLORS: Readonly<Record<EchoColor, number>> = {
  red: 0xff7d9a,
  yellow: 0xffd966,
  green: 0x8cd99a,
  blue: 0x7ec8f2,
};

const ECHO_NOTE_TO_COLOR: readonly [EchoColor, EchoColor, EchoColor, EchoColor] = [
  "red",
  "yellow",
  "green",
  "blue",
];

export function echoNoteColor(note: EchoNote): EchoColor {
  return ECHO_NOTE_TO_COLOR[note];
}

export type EchoChimeMotion = {
  critterOffsetY: number;
  critterRotation: number;
  faeOffsetY: number;
  faeRotation: number;
};

export const SOOTHED_CONFETTI_COLORS: readonly number[] = [
  0xff9ebb,
  0xffe07d,
  0x9de0ad,
  0x92d4ff,
  0xc9b3ff,
];

export const LEAN_WIND_TINTS: readonly number[] = [0x7ac7ea, 0x82d8be];
export const PEEKABOO_WARNING_TINT = 0xffd966;
export const PEEKABOO_WATCH_TINTS: readonly number[] = [0x9bc8ff, 0xd4b6fa];
export const PEEKABOO_DUST_TINT = 0xfff3d8;
export const TRACE_BRUSH_COLORS: readonly number[] = [
  0xff85a8,
  0xffd666,
  0x8de0a8,
  0x7ec8f2,
  0xc9a8ff,
];

export type TraceBrushMotion = {
  faeOffsetX: number;
  faeOffsetY: number;
  faeRotation: number;
};

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

export function emitEchoChimeVfx(
  vfx: BattleVfxParticle[],
  check: Extract<CheckState, { kind: "echo" }>,
  echoView: Extract<BattleCheckView, { kind: "echo" }> | null,
  reducedMotion = false,
): EchoChimeMotion {
  const neutral: EchoChimeMotion = {
    critterOffsetY: 0,
    critterRotation: 0,
    faeOffsetY: 0,
    faeRotation: 0,
  };
  const stride = check.spec.demoTicks + check.spec.gapTicks;
  const demoEnd = check.spec.notes * stride;
  const phase: "demo" | "input" =
    echoView !== null ? echoView.phase : check.tick <= demoEnd ? "demo" : "input";
  const litNote: EchoNote | null = echoView !== null ? echoView.litNote : check.activeNote;
  if (litNote === null) return neutral;

  const tint = ECHO_CHIME_COLORS[echoNoteColor(litNote)];
  const rawU =
    phase === "demo"
      ? check.activeTicks > 0
        ? clamp01((check.activeTicks - 1) / Math.max(1, check.spec.demoTicks))
        : 0.35
      : check.activeTicks > 0
        ? clamp01((14 - check.activeTicks) / 14)
        : 0.35;
  const u = reducedMotion ? 0.38 : rawU;
  const pulse = Math.sin((0.18 + u * 0.78) * Math.PI);
  const pitchShift = (litNote - 1.5) * 6;

  if (phase === "demo") {
    // Critter shifts left (-20) during foe-side checks; center the note halo cleanly over it.
    vfx.push(
      {
        texture: "softGlow",
        blend: "normal",
        anchor: "critter",
        offsetX: -22,
        offsetY: -114 - u * 18,
        scaleX: 1.42 + pulse * 0.24,
        scaleY: 1.15 + pulse * 0.2,
        rotation: 0,
        alpha: 0.52 * pulse,
        tint,
      },
      {
        texture: "energyRing",
        blend: "normal",
        anchor: "critter",
        offsetX: -22,
        offsetY: -116 - u * 20,
        scaleX: 0.56 + u * 0.56,
        scaleY: 0.44 + u * 0.42,
        rotation: reducedMotion ? 0 : -0.06,
        alpha: 0.94 * (1 - u * 0.58),
        tint,
      },
    );
    const noteOffsetsX: readonly number[] = [-72, -38, -4, 30];
    const noteOffsetsY: readonly number[] = [-108, -138, -118, -148];
    for (let i = 0; i < 4; i += 1) {
      const sway = reducedMotion ? 0 : Math.sin(u * Math.PI * 2 + i * 1.1) * 5;
      const scale = (0.56 + (i % 2) * 0.16) * (0.8 + pulse * 0.28);
      vfx.push({
        texture: "sparkle",
        blend: "normal",
        anchor: "critter",
        offsetX: (noteOffsetsX[i] ?? -22) + sway,
        offsetY: (noteOffsetsY[i] ?? -120) - u * 26 - pitchShift,
        scaleX: scale,
        scaleY: scale,
        rotation: reducedMotion ? 0 : u * 1.6 + i * 0.65,
        alpha: 0.96 * pulse,
        tint,
      });
    }
    if (reducedMotion) return neutral;
    return {
      critterOffsetY: -(2.5 + 5.5 * Math.sin(u * Math.PI)),
      critterRotation: Math.sin((litNote + 1) * 1.3 + u * Math.PI * 2) * 0.045,
      faeOffsetY: 0,
      faeRotation: 0,
    };
  }

  vfx.push(
    {
      texture: "softGlow",
      blend: "normal",
      anchor: "fae",
      offsetX: 14,
      offsetY: -56 - u * 18,
      scaleX: 1.24 + pulse * 0.22,
      scaleY: 1.02 + pulse * 0.18,
      rotation: 0,
      alpha: 0.54 * pulse,
      tint,
    },
    {
      texture: "energyRing",
      blend: "normal",
      anchor: "fae",
      offsetX: 20 + u * 24,
      offsetY: -58 - u * 22,
      scaleX: 0.48 + u * 0.52,
      scaleY: 0.38 + u * 0.42,
      rotation: reducedMotion ? 0 : 0.12,
      alpha: 0.88 * (1 - u * 0.6),
      tint,
    },
  );
  for (let i = 0; i < 4; i += 1) {
    const arcT = 0.08 + u * 0.34 + i * 0.055;
    const archLift = Math.sin(arcT * Math.PI) * 58;
    const sway = reducedMotion ? 0 : Math.sin(u * Math.PI * 2 + i) * 5;
    const scale = (0.5 + (i % 2) * 0.16) * (0.8 + pulse * 0.28);
    vfx.push({
      texture: "sparkle",
      blend: "normal",
      anchor: "between",
      t: arcT,
      offsetX: (i - 1.5) * 10,
      offsetY: -44 - archLift - (i % 2) * 10 + sway - pitchShift,
      scaleX: scale,
      scaleY: scale,
      rotation: reducedMotion ? 0 : u * 1.8 + i * 0.7,
      alpha: 0.96 * pulse,
      tint,
    });
  }
  if (reducedMotion) return neutral;
  return {
    critterOffsetY: 0,
    critterRotation: 0,
    faeOffsetY: -(2 + 4.5 * Math.sin(u * Math.PI)),
    faeRotation: Math.sin((litNote + 1) * 1.1 + u * Math.PI * 2) * 0.04,
  };
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

export function emitLeanWindVfx(
  vfx: BattleVfxParticle[],
  blowing: boolean,
  tick: number,
  reducedMotion = false,
): void {
  if (!blowing) return;
  const wispLanes: readonly number[] = [-46, -24, -4, 16, -34, 30];
  for (let i = 0; i < 6; i += 1) {
    const phase = ((tick * 0.042 + i / 6) % 1 + 1) % 1;
    const t = reducedMotion ? 0.22 + (i / 5) * 0.44 : 0.66 - phase * 0.5;
    const fade = reducedMotion ? 0.94 : Math.pow(Math.sin(phase * Math.PI), 0.55);
    const wave = reducedMotion ? 0 : Math.sin(phase * Math.PI * 2 + i * 1.1) * 5;
    vfx.push({
      texture: "mistWisp",
      blend: "normal",
      anchor: "between",
      t,
      offsetX: 0,
      offsetY: (wispLanes[i] ?? 0) + wave,
      scaleX: 1.0 + (i % 3) * 0.14,
      scaleY: 0.34 + (i % 2) * 0.06,
      rotation: reducedMotion ? 0 : -0.04 + ((i % 3) - 1) * 0.025,
      alpha: Math.min(0.96, 0.98 * fade),
      tint: LEAN_WIND_TINTS[i % LEAN_WIND_TINTS.length] ?? 0x7ac7ea,
    });
  }

  const fleckLanes: readonly number[] = [-30, 4, 24];
  for (let i = 0; i < 3; i += 1) {
    const phase = ((tick * 0.055 + i / 3 + 0.16) % 1 + 1) % 1;
    const t = reducedMotion ? 0.26 + i * 0.18 : 0.64 - phase * 0.48;
    const fade = reducedMotion ? 0.94 : Math.pow(Math.sin(phase * Math.PI), 0.55);
    const wave = reducedMotion ? 0 : Math.cos(phase * Math.PI * 2 + i) * 6;
    vfx.push({
      texture: "sparkle",
      blend: "normal",
      anchor: "between",
      t,
      offsetX: 0,
      offsetY: (fleckLanes[i] ?? 0) + wave,
      scaleX: 0.94 + (i % 2) * 0.14,
      scaleY: 0.5 + (i % 2) * 0.08,
      rotation: reducedMotion ? 0 : -0.08 + Math.sin(phase * Math.PI * 2 + i) * 0.06,
      alpha: Math.min(0.98, 0.98 * fade),
      tint: LEAN_WIND_TINTS[(i + 1) % LEAN_WIND_TINTS.length] ?? 0x82d8be,
    });
  }
}

export function emitPeekabooVfx(
  vfx: BattleVfxParticle[],
  status: PeekabooStatus,
  progress: number,
  tick: number,
  reducedMotion = false,
  progressRatio = 0,
): void {
  if (status === "warning") {
    const pulse = reducedMotion ? 0.5 : 0.5 + 0.5 * Math.sin(tick * 0.35);
    vfx.push({
      texture: "softGlow",
      blend: "normal",
      anchor: "critter",
      offsetX: 4,
      offsetY: -128,
      scaleX: 1.55 + pulse * 0.2,
      scaleY: 1.12 + pulse * 0.14,
      rotation: 0,
      alpha: 0.44 + pulse * 0.12,
      tint: PEEKABOO_WARNING_TINT,
    });
    const sparkX: readonly number[] = [-42, 4, 48];
    const sparkY: readonly number[] = [-132, -150, -128];
    for (let i = 0; i < 3; i += 1) {
      const twinkle = reducedMotion ? 0.5 : 0.5 + 0.5 * Math.sin(tick * 0.42 + i * 1.4);
      const scale = 0.52 + twinkle * 0.18;
      vfx.push({
        texture: "sparkle",
        blend: "normal",
        anchor: "critter",
        offsetX: sparkX[i] ?? 0,
        offsetY: (sparkY[i] ?? -136) - (reducedMotion ? 0 : twinkle * 4),
        scaleX: scale,
        scaleY: scale,
        rotation: reducedMotion ? 0 : tick * 0.08 + i * 0.7,
        alpha: 0.82 + twinkle * 0.16,
        tint: PEEKABOO_WARNING_TINT,
      });
    }
    return;
  }

  if (status === "watching") {
    const pulse = reducedMotion ? 0.5 : 0.5 + 0.5 * Math.sin(tick * 0.24);
    vfx.push(
      {
        texture: "softGlow",
        blend: "normal",
        anchor: "critter",
        offsetX: -112,
        offsetY: -22,
        scaleX: 1.85 + pulse * 0.16,
        scaleY: 1.45 + pulse * 0.12,
        rotation: 0,
        alpha: 0.34 + pulse * 0.08,
        tint: PEEKABOO_WATCH_TINTS[1] ?? 0xd4b6fa,
      },
      {
        texture: "energyRing",
        blend: "normal",
        anchor: "critter",
        offsetX: -16,
        offsetY: -12,
        scaleX: 2.48 + pulse * 0.14,
        scaleY: 2.28 + pulse * 0.12,
        rotation: reducedMotion ? 0 : -0.05 + Math.sin(tick * 0.12) * 0.04,
        alpha: 0.8 + pulse * 0.1,
        tint: PEEKABOO_WATCH_TINTS[0] ?? 0x9bc8ff,
      },
    );
    const starX: readonly number[] = [-142, -112, -132, 114];
    const starY: readonly number[] = [-82, -18, 38, -94];
    for (let i = 0; i < 4; i += 1) {
      const twinkle = reducedMotion ? 0.5 : 0.5 + 0.5 * Math.sin(tick * 0.3 + i * 1.25);
      const scale = 0.66 + (i % 2) * 0.14 + twinkle * 0.12;
      vfx.push({
        texture: "sparkle",
        blend: "normal",
        anchor: "critter",
        offsetX: starX[i] ?? -100,
        offsetY: (starY[i] ?? -20) + (reducedMotion ? 0 : Math.sin(tick * 0.2 + i) * 4),
        scaleX: scale,
        scaleY: scale,
        rotation: reducedMotion ? 0 : tick * 0.06 + i * 0.75,
        alpha: 0.88 + twinkle * 0.1,
        tint: PEEKABOO_WATCH_TINTS[i % PEEKABOO_WATCH_TINTS.length] ?? 0x9bc8ff,
      });
    }
    return;
  }

  if (progress <= 0) return;
  const tiptoeShift = 34 * clamp01(progressRatio);
  for (let i = 0; i < 2; i += 1) {
    const cycle = reducedMotion ? 0.35 + i * 0.25 : ((tick + i * 11) % 22) / 22;
    const fade = reducedMotion ? 0.92 : Math.sin(cycle * Math.PI);
    const scale = 0.26 + cycle * 0.1;
    vfx.push({
      texture: "puff",
      blend: "normal",
      anchor: "fae",
      offsetX: tiptoeShift - 24 - i * 14 - cycle * 12,
      offsetY: 64 - i * 4 - cycle * 9,
      scaleX: scale,
      scaleY: scale * 0.82,
      rotation: reducedMotion ? 0 : -0.18 - i * 0.14,
      alpha: 0.45 * fade,
      tint: PEEKABOO_DUST_TINT,
    });
  }
}

export function emitTraceBrushVfx(
  vfx: BattleVfxParticle[],
  check: Extract<CheckState, { kind: "trace" }>,
  view: Extract<BattleCheckView, { kind: "trace" }> | null,
  tick: number,
  reducedMotion = false,
): TraceBrushMotion {
  const neutral: TraceBrushMotion = {
    faeOffsetX: 0,
    faeOffsetY: 0,
    faeRotation: 0,
  };
  const points = view !== null ? view.path.points : check.path.points;
  const results = view !== null ? view.results : check.results;
  const brush = view !== null ? view.brush : check.brush;
  const checkpoint = view !== null ? view.checkpoint : check.checkpoint;

  const first = points[0];
  const brushMoved =
    first !== undefined && Math.hypot(brush.x - first.x, brush.y - first.y) > 1;
  const hits = results.filter((result) => result === "hit").length;
  // Point 0 auto-resolves on tick 1 as the starting dot; segments completed beyond point 0
  // track active tracing progress cleanly from 0..1 without perturbing tick-0/idle frames.
  const totalSegments = Math.max(1, points.length - 1);
  const progress = clamp01(Math.max(0, hits - 1) / totalSegments);
  const drawing = brushMoved || checkpoint >= 2 || hits >= 2;
  if (progress <= 0 && !drawing) return neutral;

  const glowIndex = Math.min(
    TRACE_BRUSH_COLORS.length - 1,
    Math.floor(progress * TRACE_BRUSH_COLORS.length),
  );
  const glowTint = TRACE_BRUSH_COLORS[glowIndex] ?? 0xff85a8;
  const glowPulse = reducedMotion ? 0.5 : 0.5 + 0.5 * Math.sin(tick * 0.24);
  vfx.push({
    texture: "softGlow",
    blend: "normal",
    anchor: "fae",
    offsetX: 44,
    offsetY: -34,
    scaleX: 1.05 + progress * 0.35 + glowPulse * 0.14,
    scaleY: 0.92 + progress * 0.3 + glowPulse * 0.12,
    rotation: 0,
    alpha: 0.26 + progress * 0.16 + glowPulse * 0.08,
    tint: glowTint,
  });

  const sparkleCount = Math.min(6, Math.max(2, 2 + Math.round(progress * 4)));
  const offsetsX: readonly number[] = [30, 48, 36, 58, 26, 62];
  const offsetsY: readonly number[] = [-18, -36, -50, -24, -40, -54];
  for (let i = 0; i < sparkleCount; i += 1) {
    const baseX = offsetsX[i] ?? 42;
    const baseY = offsetsY[i] ?? -34;
    const driftX = reducedMotion ? 0 : Math.sin(tick * 0.22 + i * 1.3) * 3;
    const driftY = reducedMotion ? 0 : Math.cos(tick * 0.26 + i * 1.1) * 3;
    const twinkle = reducedMotion ? 0.5 : 0.5 + 0.5 * Math.sin(tick * 0.32 + i * 1.4);
    const scale = (0.56 + (i % 2) * 0.16) * (0.85 + progress * 0.2 + twinkle * 0.15);
    vfx.push({
      texture: "sparkle",
      blend: "normal",
      anchor: "fae",
      offsetX: Math.max(24, Math.min(64, baseX + driftX)),
      offsetY: Math.max(-56, Math.min(-10, baseY + driftY)),
      scaleX: scale,
      scaleY: scale,
      rotation: reducedMotion ? 0 : tick * 0.09 + i * 0.75,
      alpha: Math.min(0.96, 0.82 + progress * 0.1 + twinkle * 0.08),
      tint: TRACE_BRUSH_COLORS[i % TRACE_BRUSH_COLORS.length] ?? 0xff85a8,
    });
  }

  if (reducedMotion) return neutral;
  return {
    faeOffsetX: 6 * Math.sin(tick * 0.22),
    faeOffsetY: -3 * Math.abs(Math.sin(tick * 0.22)),
    faeRotation: 0.05 * Math.sin(tick * 0.22),
  };
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
