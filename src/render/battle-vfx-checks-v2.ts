import type { BattleCheckView, CheckState } from "../core";
import type { BattleVfxParticle } from "./battle-vfx";

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export const RAINBOW_LASSO_COLORS: readonly number[] = [
  0xff6e93,
  0xff9e52,
  0xffd23f,
  0x76d687,
  0x6ec3ff,
  0xa88aff,
  0xee8ce0,
];

export type WhichOneVfxColors = {
  readonly glow: number;
  readonly wonder: readonly number[];
  readonly ribbon: readonly number[];
  readonly pickRing: number;
  readonly pickSparkle: readonly number[];
};

export const WHICH_ONE_VFX_COLORS: WhichOneVfxColors = {
  glow: 0xffe28a,
  wonder: [0xffe49e, 0xffb3cf, 0x9de6d1],
  ribbon: [0xd4b6fa, 0xffcaa4, 0xf7b8d4],
  pickRing: 0x8be4c7,
  pickSparkle: [0xffe07d, 0x8be4c7, 0xfff2b2],
};

export type WhichOneMotion = {
  critterOffsetY: number;
  faeOffsetX: number;
};

export type WhackVfxColors = {
  readonly hitGlow: number;
  readonly hitStarburst: readonly number[];
  readonly missPuff: number;
  readonly ticketMotes: readonly number[];
};

export const WHACK_VFX_COLORS: WhackVfxColors = {
  hitGlow: 0xffb36b,
  hitStarburst: [0xff7d8a, 0xffd666, 0xff9f68, 0xfff099],
  missPuff: 0xd8c4f8,
  ticketMotes: [0xffd966, 0xff9ebb, 0x8ee0c4, 0x9ecaf2],
};

export type WhackMotion = {
  faeOffsetX: number;
  faeRotation: number;
};

export type SpinSnagColors = {
  readonly lasso: readonly number[];
  readonly spinRing: number;
  readonly snagRing: number;
  readonly snagGlow: number;
};

export const SPIN_SNAG_COLORS: SpinSnagColors = {
  lasso: RAINBOW_LASSO_COLORS,
  spinRing: 0xffd23f,
  snagRing: 0xffc830,
  snagGlow: 0xffe484,
};

export type SpinSnagMotion = {
  faeOffsetX: number;
  faeOffsetY: number;
  faeRotation: number;
};

/**
 * Cup Shuffle (`which-one`) stage VFX choreography:
 * - `show`: golden carnival glow & 3 pastel wonder sparkles over the critter + mischievous bounce.
 * - `shuffle`: 3 lilac-and-peach mistWisp sleight-of-hand ribbons & 4 carnival sparkles in the
 *   open corridor + subtle focused Fae lean.
 * - `pick`: mint-gold anticipation energyRing & 3 orbiting focus sparkles framing Fae.
 */
export function emitWhichOneVfx(
  vfx: BattleVfxParticle[],
  check: Extract<CheckState, { kind: "which-one" }>,
  view: Extract<BattleCheckView, { kind: "which-one" }> | null,
  tick: number,
  reducedMotion = false,
): WhichOneMotion {
  const neutral: WhichOneMotion = { critterOffsetY: 0, faeOffsetX: 0 };
  const shuffleEnd = check.spec.showTicks + check.spec.shuffles * check.spec.swapTicks;
  const phase: "show" | "shuffle" | "pick" =
    view !== null
      ? view.phase
      : check.tick <= check.spec.showTicks
        ? "show"
        : check.tick <= shuffleEnd
          ? "shuffle"
          : "pick";

  if (phase === "show") {
    const centerShiftX = check.side === "fae" ? -18 : 0;
    const pulse = reducedMotion ? 0.5 : 0.5 + 0.5 * Math.sin(tick * 0.24);
    vfx.push({
      texture: "softGlow",
      blend: "normal",
      anchor: "critter",
      offsetX: centerShiftX,
      offsetY: -108,
      scaleX: 1.52 + pulse * 0.2,
      scaleY: 1.2 + pulse * 0.16,
      rotation: 0,
      alpha: 0.44 + pulse * 0.1,
      tint: WHICH_ONE_VFX_COLORS.glow,
    });
    const sparkX: readonly number[] = [-56, 0, 56];
    const sparkY: readonly number[] = [-116, -138, -114];
    for (let i = 0; i < 3; i += 1) {
      const twinkle = reducedMotion ? 0.5 : 0.5 + 0.5 * Math.sin(tick * 0.34 + i * 1.4);
      const lift = reducedMotion ? 0 : Math.sin(tick * 0.22 + i * 1.1) * 5;
      const scale = 0.56 + (i === 1 ? 0.14 : 0) + twinkle * 0.14;
      vfx.push({
        texture: "sparkle",
        blend: "normal",
        anchor: "critter",
        offsetX: centerShiftX + (sparkX[i] ?? 0),
        offsetY: (sparkY[i] ?? -120) - lift,
        scaleX: scale,
        scaleY: scale,
        rotation: reducedMotion ? 0 : tick * 0.08 + i * 0.85,
        alpha: 0.86 + twinkle * 0.12,
        tint: WHICH_ONE_VFX_COLORS.wonder[i % WHICH_ONE_VFX_COLORS.wonder.length] ?? 0xffe49e,
      });
    }
    if (reducedMotion) return neutral;
    return {
      critterOffsetY: -(3 + 5 * Math.abs(Math.sin(tick * 0.26))),
      faeOffsetX: 0,
    };
  }

  if (phase === "shuffle") {
    const ribbonY: readonly number[] = [-128, -110, -134];
    const ribbonSpreadX: readonly number[] = [20, 96, 188];
    for (let i = 0; i < 3; i += 1) {
      const swirl = reducedMotion ? 0 : Math.sin(tick * 0.16 + i * 2.1);
      const t = reducedMotion ? 0.24 + i * 0.28 : 0.5 + swirl * 0.28;
      const bob = reducedMotion ? 0 : Math.cos(tick * 0.2 + i * 1.4) * 8;
      const pulse = reducedMotion ? 0.5 : 0.5 + 0.5 * Math.sin(tick * 0.22 + i * 1.2);
      vfx.push({
        texture: "mistWisp",
        blend: "normal",
        anchor: "between",
        t,
        offsetX: ribbonSpreadX[i] ?? 0,
        offsetY: (ribbonY[i] ?? -120) + bob,
        scaleX: 1.48 + (i % 2) * 0.18,
        scaleY: 0.48 + (i % 2) * 0.08,
        rotation: reducedMotion ? 0 : swirl * 0.12,
        alpha: 0.88 + pulse * 0.1,
        tint: WHICH_ONE_VFX_COLORS.ribbon[i % WHICH_ONE_VFX_COLORS.ribbon.length] ?? 0xd4b6fa,
      });
    }
    const sparkT: readonly number[] = [0.22, 0.48, 0.72, 0.9];
    const sparkSpreadX: readonly number[] = [24, 78, 148, 224];
    const sparkY: readonly number[] = [-122, -142, -124, -110];
    for (let i = 0; i < 4; i += 1) {
      const dart = reducedMotion ? 0 : Math.cos(tick * 0.19 + i * 1.55) * 0.07;
      const t = clamp01((sparkT[i] ?? 0.5) + dart);
      const wave = reducedMotion ? 0 : Math.sin(tick * 0.24 + i * 1.2) * 8;
      const twinkle = reducedMotion ? 0.5 : 0.5 + 0.5 * Math.sin(tick * 0.36 + i * 1.3);
      const scale = 0.72 + (i % 2) * 0.14 + twinkle * 0.12;
      vfx.push({
        texture: "sparkle",
        blend: "normal",
        anchor: "between",
        t,
        offsetX: sparkSpreadX[i] ?? 0,
        offsetY: (sparkY[i] ?? -124) + wave,
        scaleX: scale,
        scaleY: scale,
        rotation: reducedMotion ? 0 : tick * 0.11 + i * 0.8,
        alpha: 0.92 + twinkle * 0.06,
        tint: WHICH_ONE_VFX_COLORS.wonder[i % WHICH_ONE_VFX_COLORS.wonder.length] ?? 0xffe49e,
      });
    }
    return {
      critterOffsetY: 0,
      faeOffsetX: reducedMotion ? 0 : 6,
    };
  }

  const pulse = reducedMotion ? 0.5 : 0.5 + 0.5 * Math.sin(tick * 0.22);
  vfx.push({
    texture: "energyRing",
    blend: "normal",
    anchor: "fae",
    offsetX: 4,
    offsetY: -8,
    scaleX: 1.3 + pulse * 0.16,
    scaleY: 1.22 + pulse * 0.14,
    rotation: reducedMotion ? 0 : Math.sin(tick * 0.1) * 0.06,
    alpha: 0.76 + pulse * 0.14,
    tint: WHICH_ONE_VFX_COLORS.pickRing,
  });
  const orbitPhase = reducedMotion ? 0 : tick * 0.09;
  for (let i = 0; i < 3; i += 1) {
    const angle = (i / 3) * Math.PI * 2 + orbitPhase;
    const twinkle = reducedMotion ? 0.5 : 0.5 + 0.5 * Math.sin(tick * 0.32 + i * 1.5);
    const scale = 0.52 + twinkle * 0.14;
    vfx.push({
      texture: "sparkle",
      blend: "normal",
      anchor: "fae",
      offsetX: 4 + Math.cos(angle) * 58,
      offsetY: -12 + Math.sin(angle) * 44,
      scaleX: scale,
      scaleY: scale,
      rotation: reducedMotion ? 0 : tick * 0.1 + i * 0.9,
      alpha: 0.84 + twinkle * 0.12,
      tint:
        WHICH_ONE_VFX_COLORS.pickSparkle[i % WHICH_ONE_VFX_COLORS.pickSparkle.length] ?? 0xffe07d,
    });
  }
  return neutral;
}

/**
 * Arcade Ticket Whack (`whack`) stage VFX choreography:
 * - On `lastSwing.hit === true`: coral-gold carnival starburst (4 sparkles + warm softGlow pop
 *   on `between`) + joyful Fae swing lean.
 * - On `lastSwing.hit === false`: gentle soft lavender `puff` whiff on `between`.
 * - Always flanks the open corridor with 2..4 pastel arcade ticket sparkles scaling with hit count.
 */
export function emitWhackVfx(
  vfx: BattleVfxParticle[],
  check: Extract<CheckState, { kind: "whack" }>,
  view: Extract<BattleCheckView, { kind: "whack" }> | null,
  tick: number,
  reducedMotion = false,
): WhackMotion {
  const neutral: WhackMotion = { faeOffsetX: 0, faeRotation: 0 };
  const results = view !== null ? view.results : check.results;
  let hits = 0;
  for (const result of results) {
    if (result === "hit") hits += 1;
  }

  let motion: WhackMotion = neutral;
  const swing = check.lastSwing;
  if (swing !== null) {
    const rawU = clamp01((10 - swing.ticksLeft) / 10);
    const u = reducedMotion ? 0.35 : rawU;
    const fade = reducedMotion ? 0.9 : Math.max(0.18, 1 - u * 0.72);
    if (swing.hit) {
      vfx.push({
        texture: "softGlow",
        blend: "normal",
        anchor: "between",
        t: 0.24,
        offsetX: 0,
        offsetY: 36,
        scaleX: 1.52 + (1 - u) * 0.28,
        scaleY: 1.36 + (1 - u) * 0.24,
        rotation: 0,
        alpha: 0.48 * fade,
        tint: WHACK_VFX_COLORS.hitGlow,
      });
      for (let i = 0; i < 4; i += 1) {
        const angle = (i / 4) * Math.PI * 2 + 0.45;
        const dist = 24 + u * 54;
        const scale = (0.68 + (i % 2) * 0.14) * (1 - u * 0.22);
        vfx.push({
          texture: "sparkle",
          blend: "normal",
          anchor: "between",
          t: 0.24,
          offsetX: Math.cos(angle) * dist,
          offsetY: 36 + Math.sin(angle) * dist * 0.78,
          scaleX: scale,
          scaleY: scale,
          rotation: reducedMotion ? 0 : u * 2.2 + i * 0.7,
          alpha: 0.96 * fade,
          tint:
            WHACK_VFX_COLORS.hitStarburst[i % WHACK_VFX_COLORS.hitStarburst.length] ?? 0xffd666,
        });
      }
      if (!reducedMotion) {
        const swingArc = Math.sin((1 - u) * Math.PI * 0.85);
        motion = {
          faeOffsetX: 14 * swingArc,
          faeRotation: 0.1 * swingArc,
        };
      }
    } else {
      vfx.push({
        texture: "puff",
        blend: "normal",
        anchor: "between",
        t: 0.24,
        offsetX: reducedMotion ? 0 : -u * 14,
        offsetY: 34 - u * 16,
        scaleX: 0.66 + u * 0.34,
        scaleY: 0.6 + u * 0.28,
        rotation: reducedMotion ? 0 : -0.18 * u,
        alpha: 0.76 * fade,
        tint: WHACK_VFX_COLORS.missPuff,
      });
    }
  }

  const moteCount = Math.min(4, 2 + Math.min(2, hits));
  const moteT: readonly number[] = [0.12, 0.88, 0.22, 0.78];
  const moteY: readonly number[] = [-24, -18, 66, 62];
  for (let i = 0; i < moteCount; i += 1) {
    const twinkle = reducedMotion ? 0.5 : 0.5 + 0.5 * Math.sin(tick * 0.28 + i * 1.45);
    const driftY = reducedMotion ? 0 : Math.sin(tick * 0.18 + i * 1.2) * 6;
    const scale = 0.48 + (i % 2) * 0.12 + twinkle * 0.12;
    vfx.push({
      texture: "sparkle",
      blend: "normal",
      anchor: "between",
      t: moteT[i] ?? 0.22,
      offsetX: 0,
      offsetY: (moteY[i] ?? -64) + driftY,
      scaleX: scale,
      scaleY: scale,
      rotation: reducedMotion ? 0 : tick * 0.08 + i * 0.85,
      alpha: 0.76 + twinkle * 0.18,
      tint: WHACK_VFX_COLORS.ticketMotes[i % WHACK_VFX_COLORS.ticketMotes.length] ?? 0xffd966,
    });
  }

  return motion;
}

/**
 * Spin & Snag Lasso (`spin-snag`) stage VFX choreography:
 * - `spin`: orbiting 7-color pastel Rainbow Lasso loop (7 sparkles) + golden energyRing halo
 *   above Fae, scaling speed & glow with `turns / spinsNeeded`, plus playful Fae twirl sway.
 * - `snag`: luminous 7-color pastel rainbow rope Bézier arc across `between` + crisp golden
 *   snag energyRing & warm glow framing the target critter.
 */
export function emitSpinSnagVfx(
  vfx: BattleVfxParticle[],
  check: Extract<CheckState, { kind: "spin-snag" }>,
  view: Extract<BattleCheckView, { kind: "spin-snag" }> | null,
  tick: number,
  reducedMotion = false,
): SpinSnagMotion {
  const neutral: SpinSnagMotion = { faeOffsetX: 0, faeOffsetY: 0, faeRotation: 0 };
  const turns = view !== null ? view.turns : check.turns;
  const spinsNeeded = Math.max(1, view !== null ? view.spinsNeeded : check.spec.spinsNeeded);
  const phase: "spin" | "snag" =
    view !== null ? view.phase : turns >= spinsNeeded ? "snag" : "spin";
  const chargeRatio = clamp01(turns / spinsNeeded);

  if (phase === "spin") {
    const spinSpeed = 0.12 + chargeRatio * 0.18;
    const orbitPhase = reducedMotion ? 0 : tick * spinSpeed;
    const radiusX = 56 + chargeRatio * 14;
    const radiusY = 20 + chargeRatio * 6;
    vfx.push({
      texture: "energyRing",
      blend: "normal",
      anchor: "fae",
      offsetX: 0,
      offsetY: -72,
      scaleX: 1.24 + chargeRatio * 0.34,
      scaleY: 0.48 + chargeRatio * 0.14,
      rotation: reducedMotion ? 0 : Math.sin(tick * (0.14 + chargeRatio * 0.12)) * 0.1,
      alpha: 0.72 + chargeRatio * 0.22,
      tint: SPIN_SNAG_COLORS.spinRing,
    });
    for (let c = 0; c < SPIN_SNAG_COLORS.lasso.length; c += 1) {
      const angle = (c / SPIN_SNAG_COLORS.lasso.length) * Math.PI * 2 + orbitPhase;
      const scale = (0.48 + (c % 2) * 0.1) * (0.9 + chargeRatio * 0.22);
      vfx.push({
        texture: "sparkle",
        blend: "normal",
        anchor: "fae",
        offsetX: Math.cos(angle) * radiusX,
        offsetY: -72 + Math.sin(angle) * radiusY,
        scaleX: scale,
        scaleY: scale,
        rotation: reducedMotion ? 0 : tick * 0.1 + c * 0.65,
        alpha: 0.84 + chargeRatio * 0.14,
        tint: SPIN_SNAG_COLORS.lasso[c] ?? 0xffd23f,
      });
    }
    if (reducedMotion) return neutral;
    const swayPhase = tick * (0.2 + chargeRatio * 0.12);
    const amp = 0.6 + chargeRatio * 0.55;
    return {
      faeOffsetX: Math.cos(swayPhase) * 6 * amp,
      faeOffsetY: -Math.abs(Math.sin(swayPhase)) * 5 * amp,
      faeRotation: Math.sin(swayPhase) * 0.06 * amp,
    };
  }

  const snagU =
    view !== null
      ? clamp01(view.snagProgress)
      : clamp01(check.snagTick / Math.max(1, check.spec.snagTicks));
  const reach = reducedMotion ? 1 : clamp01(0.92 + snagU * 0.4);
  const arcSweep = 232;
  for (let c = 0; c < SPIN_SNAG_COLORS.lasso.length; c += 1) {
    const u = 0.06 + ((c + 0.5) / SPIN_SNAG_COLORS.lasso.length) * 0.84;
    if (u > reach) continue;
    const color = SPIN_SNAG_COLORS.lasso[c] ?? 0xffd23f;
    const whip = reducedMotion
      ? 0
      : Math.sin(u * Math.PI * 3 - tick * 0.32) * 4 * Math.sin(u * Math.PI);
    const tangent = Math.atan2(2 * (1 - 2 * u) * arcSweep, 330);
    const arcY = (1 - u) * -14 + 2 * u * (1 - u) * arcSweep + whip;
    const twinkle = reducedMotion ? 0.5 : 0.5 + 0.5 * Math.sin(tick * 0.38 + c * 1.1);
    vfx.push(
      {
        texture: "softGlow",
        blend: "normal",
        anchor: "between",
        t: u,
        offsetX: (1 - u) * 16,
        offsetY: arcY,
        scaleX: 0.84,
        scaleY: 0.44,
        rotation: reducedMotion ? 0 : tangent,
        alpha: 0.96,
        tint: color,
      },
      {
        texture: "sparkle",
        blend: "normal",
        anchor: "between",
        t: u,
        offsetX: (1 - u) * 16,
        offsetY: arcY,
        scaleX: 0.72 + twinkle * 0.16,
        scaleY: 0.72 + twinkle * 0.16,
        rotation: reducedMotion ? 0 : tick * 0.09 + c * 0.6,
        alpha: 0.98,
        tint: color,
      },
    );
  }

  const tighten = reducedMotion ? 1 : 1.24 - snagU * 0.34;
  vfx.push(
    {
      texture: "softGlow",
      blend: "normal",
      anchor: "critter",
      offsetX: 0,
      offsetY: 4,
      scaleX: 1.68,
      scaleY: 1.2,
      rotation: 0,
      alpha: 0.4,
      tint: SPIN_SNAG_COLORS.snagGlow,
    },
    {
      texture: "energyRing",
      blend: "normal",
      anchor: "critter",
      offsetX: 0,
      offsetY: 6,
      scaleX: 2.08 * tighten,
      scaleY: 1.02 * tighten,
      rotation: reducedMotion ? 0 : -0.1,
      alpha: 0.98,
      tint: SPIN_SNAG_COLORS.snagRing,
    },
    {
      texture: "energyRing",
      blend: "normal",
      anchor: "critter",
      offsetX: 0,
      offsetY: 6,
      scaleX: 1.82 * tighten,
      scaleY: 0.88 * tighten,
      rotation: reducedMotion ? 0 : -0.1,
      alpha: 0.88,
      tint: 0xffd23f,
    },
  );
  if (reducedMotion) return neutral;
  return {
    faeOffsetX: 10,
    faeOffsetY: -3,
    faeRotation: 0.05,
  };
}
