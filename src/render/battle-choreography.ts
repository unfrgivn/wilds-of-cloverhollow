import { isDualComboCommand, type Battle, type BattleView } from "../core";
import { composePose, idleBreathing, type MotionPose } from "./motion";
import {
  applyInteractiveCheckChoreography,
  applyPartySkillChoreography,
} from "./battle-check-choreography";
import {
  applyDualComboTheater, applyRecoverTheater, applyRestFaint, applySnackTheater,
  applySoothedAndReward, applyTalkTheater, applyTogetherActive, applyTogetherReady,
  applyWindUpAndFizzle, clamp01, classifySnackTheater, emitRainbowLassoVfx,
  emitSoothedConfettiVfx, isDualComboActive, isLassoActionActive, isRecoverTheater,
  isTalkTheater, LASSO_ARC_DURATION, radialBurst,
  type BattleStageMood, type BattleVfxParticle,
} from "./battle-vfx";

export {
  applyDualComboTheater, classifySnackTheater, DUAL_COMBO_PALETTES, ECHO_CHIME_COLORS,
  echoNoteColor, emitEchoChimeVfx, emitLeanWindVfx, emitPeekabooVfx, emitRainbowLassoVfx,
  emitSoothedConfettiVfx, emitSpinSnagVfx, emitTraceBrushVfx, emitWhackVfx, emitWhichOneVfx,
  FIZZ_TINTS, isDualComboActive, isLassoActionActive, isRecoverTheater, isTalkTheater,
  LASSO_ARC_DURATION, LEAN_WIND_TINTS, PEEKABOO_DUST_TINT, PEEKABOO_WARNING_TINT,
  PEEKABOO_WATCH_TINTS, radialBurst, RAINBOW_HEARTS, RAINBOW_LASSO_COLORS,
  RECOVER_SPARKLE_TINTS, RELIEF_PETALS, SOOTHED_CONFETTI_COLORS, SPARKLE_TINTS,
  SPIN_SNAG_COLORS, TRACE_BRUSH_COLORS, WHACK_VFX_COLORS, WHICH_ONE_VFX_COLORS,
  type BattleStageMood, type BattleVfxAnchor, type BattleVfxBlend, type BattleVfxParticle,
  type BattleVfxTexture, type BattleVfxTextureKey, type EchoChimeMotion, type EchoColor,
  type SnackTheaterKind, type SpinSnagColors, type SpinSnagMotion, type TraceBrushMotion,
  type WhackMotion, type WhackVfxColors, type WhichOneMotion, type WhichOneVfxColors,
} from "./battle-vfx";

export type BattleChoreography = {
  fae: MotionPose & { tintFlash: number };
  party: Record<string, MotionPose>;
  critter: MotionPose;
  stageShake: { x: number; y: number };
  auraScaleBoost: number;
  hitStop: boolean;
  stageMood: BattleStageMood;
  vfx: BattleVfxParticle[];
};

function actorForCommand(
  partyIds: readonly string[],
  partyCommands: Readonly<Record<string, string | null>>,
  commandId: string | null,
): string | null {
  if (commandId === null) return null;
  for (const id of partyIds) {
    if (partyCommands[id] === commandId) return id;
  }
  return null;
}

function puffLevel(battle: Battle, view: BattleView | null): number {
  if (view !== null) return view.puff;
  if (battle.windUp === null) return 0;
  return Math.max(1, battle.windUp.feelings.length - battle.windUp.left + 1);
}

export function battleStageMood(battle: Battle, view: BattleView | null): BattleStageMood {
  if (battle.phase === "rest") return "rest";
  if (battle.phase === "soothed" || battle.phase === "reward") return "soothed";
  if (
    (battle.command === "together" || battle.command === "combo:cloverhollow-harmony") &&
    (battle.phase === "check" || (battle.phase === "result" && battle.lastGrade !== null))
  ) {
    return "together-active";
  }
  if (isDualComboActive(battle)) return "together-ready";
  if (view?.sparkle?.ready === true) return "together-ready";
  if (puffLevel(battle, view) >= 2) return "windup";
  return "calm-normal";
}

export function computeBattleChoreography(
  battle: Battle,
  view: BattleView | null,
  tick: number,
  partyIds: readonly string[],
  partyCommands: Readonly<Record<string, string | null>>,
  reducedMotion = false,
): BattleChoreography {
  const stageMood = battleStageMood(battle, view);
  let fae: MotionPose = idleBreathing(tick, 0, 0.014);
  let tintFlash = 0;
  const party: Record<string, MotionPose> = {};
  partyIds.forEach((id, index) => {
    party[id] = idleBreathing(tick, (index + 1) * 1.4, 0.014);
  });

  const calmMood = battle.phase === "soothed" || battle.phase === "reward";
  const talkTheater = isTalkTheater(battle);
  let critter: MotionPose = calmMood
    ? idleBreathing(tick, 0.5, 0.012)
    : {
        offsetX: 0,
        offsetY: -Math.abs(Math.sin(tick / 11)) * 2.5,
        scaleX: 1 - 0.016 * Math.sin(tick / 11),
        scaleY: 1 + 0.022 * Math.sin(tick / 11),
        rotation: 0,
      };

  let stageShake = { x: 0, y: 0 };
  let auraScaleBoost = 1;
  let hitStop = false;
  const vfx: BattleVfxParticle[] = [];
  const snackKind = classifySnackTheater(battle);

  // 0. Heart-to-Heart Talk climax theater: empathetic lean, warm glow, floating bridge.
  if (talkTheater) {
    const talked = applyTalkTheater(battle, tick, reducedMotion, vfx);
    fae = talked.fae;
    critter = talked.critter;
  }

  const applyParty = (actorId: string | null, delta: MotionPose): void => {
    if (actorId === null) return;
    const base = party[actorId];
    if (base !== undefined) party[actorId] = composePose(base, delta);
  };

  // 1. Command menu: active actor steps eagerly forward toward the critter.
  if (battle.phase === "command") {
    const activeId = view?.activeActor?.id ?? null;
    if (activeId === "fae") {
      fae = composePose(fae, { offsetX: 16, offsetY: 0, scaleX: 1, scaleY: 1.02, rotation: 0 });
    } else if (activeId !== null) {
      applyParty(activeId, { offsetX: 16, offsetY: 0, scaleX: 1, scaleY: 1.02, rotation: 0 });
    } else {
      const selectedId = view?.commands[battle.selected]?.id ?? null;
      if (selectedId === "soothe" || selectedId === "snack" || selectedId === "talk" ||
          selectedId === "recover") {
        fae = composePose(fae, { offsetX: 16, offsetY: 0, scaleX: 1, scaleY: 1.02, rotation: 0 });
      } else if (selectedId !== null && selectedId !== "run") {
        const actor = actorForCommand(partyIds, partyCommands, selectedId);
        applyParty(actor, { offsetX: 16, offsetY: 0, scaleX: 1, scaleY: 1.02, rotation: 0 });
      }
    }
  }

  // 1b. Rainbow Lasso throw choreography: forward lean + pastel rainbow arc & loop.
  if (isLassoActionActive(battle)) {
    const p = battle.phaseTicks;
    const throwCurve =
      p <= 10
        ? Math.sin(((p + 1) / 11) * Math.PI * 0.5)
        : 0.5 * (1 + Math.cos(((p - 10) / (LASSO_ARC_DURATION - 10)) * Math.PI));
    const stretch = Math.sin(clamp01(p / 16) * Math.PI);
    fae = composePose(
      fae,
      reducedMotion
        ? { offsetX: 8 * throwCurve, offsetY: 0, scaleX: 1, scaleY: 1, rotation: 0 }
        : {
            offsetX: 18 * throwCurve,
            offsetY: -7 * stretch,
            scaleX: 1 + 0.05 * stretch,
            scaleY: 1 - 0.04 * stretch,
            rotation: 0.08 * throwCurve,
          },
    );
    if (p >= 7) {
      const catchU = clamp01((p - 7) / 22);
      const hopEnv = Math.sin(catchU * Math.PI);
      const wiggle = Math.sin((p - 7) * 0.9) * hopEnv;
      critter = composePose(
        critter,
        reducedMotion
          ? {
              offsetX: 0,
              offsetY: 0,
              scaleX: 1 + 0.02 * hopEnv,
              scaleY: 1 - 0.02 * hopEnv,
              rotation: 0,
            }
          : {
              offsetX: wiggle * 4,
              offsetY: -10 * Math.abs(Math.sin(catchU * Math.PI * 1.5)) * hopEnv,
              scaleX: 1 - 0.05 * hopEnv,
              scaleY: 1 + 0.06 * hopEnv,
              rotation: wiggle * 0.09,
            },
      );
    }
    emitRainbowLassoVfx(vfx, battle, reducedMotion);
  }

  // 2–5. Soothe, Maddie Play, Sue Cast, and Jordan Juggle check/result choreography.
  fae = applyPartySkillChoreography({
    battle, view, partyIds, partyCommands, snackKind, fae, applyParty, vfx,
  });

  // 6. Fae snack & specialty treat sharing theater.
  if (snackKind !== "none") {
    const shared = applySnackTheater(
      snackKind,
      battle.phaseTicks,
      reducedMotion,
      fae,
      critter,
      vfx,
    );
    fae = shared.fae;
    critter = shared.critter;
  }

  // 6b. Per-member Recover theater: cozy inhale-exhale bob + clover-meadow glow & sparkles.
  if (isRecoverTheater(battle)) {
    fae = applyRecoverTheater(
      battle, view, tick, partyIds, fae, applyParty, vfx, reducedMotion,
    );
  }

  // 7–8g. Interactive battle check choreography & VFX (lean, catch, peekaboo, echo,
  // trace, which-one, whack, spin-snag).
  const checked = applyInteractiveCheckChoreography({
    battle, view, tick, reducedMotion, fae, critter, vfx,
  });
  fae = checked.fae;
  critter = checked.critter;

  // 9. Critter burst anticipation crouch -> snappy forward lunge.
  if (battle.phase === "burst") {
    if (battle.phaseTicks < 10) {
      const u = Math.sin((battle.phaseTicks / 10) * Math.PI * 0.5);
      critter = composePose(critter, {
        offsetX: 12 * u,
        offsetY: 0,
        scaleX: 1 + 0.07 * u,
        scaleY: 1 - 0.07 * u,
        rotation: 0,
      });
    } else {
      const u = clamp01((battle.phaseTicks - 10) / 8);
      critter = composePose(critter, {
        offsetX: -20 * u,
        offsetY: 0,
        scaleX: 1 - 0.05 * u,
        scaleY: 1 + 0.05 * u,
        rotation: 0,
      });
    }
  } else if (
    battle.phase === "check" &&
    battle.check?.side === "fae" &&
    battle.check.kind !== "peekaboo"
  ) {
    critter = composePose(critter, {
      offsetX: -20,
      offsetY: 0,
      scaleX: 0.95,
      scaleY: 1.05,
      rotation: 0,
    });
  }

  // 10. Critter result reaction, 3-tick impact hit-stop, & rainbow bursts
  // (skipped for Recover so stale prior-turn grades never shake or recoil the critter).
  if (battle.phase === "result" && !isRecoverTheater(battle)) {
    const impactful =
      battle.lastGrade !== "miss" &&
      (battle.lastGrade === "great" ||
        battle.answered ||
        ((battle.command === "together" || isDualComboCommand(battle.command)) &&
          battle.lastGrade !== null));
    if (impactful && battle.phaseTicks < 4) {
      hitStop = true;
      critter = {
        offsetX: 0,
        offsetY: 0,
        scaleX: 1.12,
        scaleY: 0.88,
        rotation: 0,
      };
      const decay = 1 - battle.phaseTicks / 4;
      if (!reducedMotion) {
        const dir = battle.phaseTicks % 2 === 0 ? 1 : -1;
        stageShake = {
          x: dir * 3.5 * decay,
          y: -1.8 * decay * (battle.phaseTicks % 2 === 0 ? 1 : -0.6),
        };
      }
      vfx.push(
        {
          texture: "softGlow",
          blend: "add",
          anchor: "critter",
          offsetX: 0,
          offsetY: -8,
          scaleX: 1.45,
          scaleY: 1.45,
          rotation: 0,
          alpha: 0.52 * decay,
          tint: 0xffe484,
        },
        {
          texture: "sparkle",
          blend: "add",
          anchor: "critter",
          offsetX: 0,
          offsetY: -8,
          scaleX: 1.35,
          scaleY: 1.35,
          rotation: battle.phaseTicks * 0.25,
          alpha: 0.98,
          tint: 0xfff3a8,
        },
      );
    }
    const u = clamp01(battle.phaseTicks / 24);
    const arc = Math.sin(u * Math.PI);
    if (battle.lastGrade === "great") {
      if (!hitStop) {
        critter = composePose(critter, {
          offsetX: 0,
          offsetY: -14 * arc,
          scaleX: 1 - 0.05 * arc + 0.02 * (1 - arc),
          scaleY: 1 + 0.07 * arc - 0.03 * (1 - arc),
          rotation: 0,
        });
      }
      const hearts = battle.answered ? 8 : 5;
      const sparkles = battle.answered ? 8 : 5;
      radialBurst(vfx, "critter", battle.phaseTicks, hearts, sparkles, 86, 32);
    } else if (battle.lastGrade === "good") {
      if (!hitStop) {
        critter = composePose(critter, {
          offsetX: 0,
          offsetY: -5 * arc,
          scaleX: 1 + 0.04 * arc,
          scaleY: 1 - 0.04 * arc,
          rotation: 0,
        });
      }
      const hearts = battle.answered ? 4 : 0;
      radialBurst(vfx, "critter", battle.phaseTicks, hearts, 4, 72, 28);
    } else if (battle.lastGrade === "miss") {
      if (!hitStop) {
        const decay = Math.max(0, 1 - u);
        critter = composePose(critter, {
          offsetX: 0,
          offsetY: 0,
          scaleX: 1,
          scaleY: 1,
          rotation: Math.sin(battle.phaseTicks / 3.5) * 0.1 * decay,
        });
      }
    }
  }

  // 10b. Together! Ready on-field telegraph: eager bounce + golden sparkle tether.
  const dualComboActive = isDualComboActive(battle);
  if (stageMood === "together-ready" && !dualComboActive) {
    fae = applyTogetherReady(tick, partyIds, fae, applyParty, vfx, reducedMotion);
  }

  // 10c. Together! / Dual-Friend Synergy Combo activation theater.
  if (dualComboActive) {
    fae = applyDualComboTheater(battle, tick, partyIds, fae, applyParty, vfx, reducedMotion);
  } else if (stageMood === "together-active") {
    fae = applyTogetherActive(battle, tick, partyIds, fae, applyParty, vfx, reducedMotion);
  }

  // 11. Fae burstResult reaction + subtle stage shake on spent energy.
  if (battle.phase === "burstResult") {
    if (battle.lastGrade !== "great") {
      const decay = Math.max(0, 1 - battle.phaseTicks / 20);
      fae = composePose(fae, {
        offsetX: -14 * decay,
        offsetY: 0,
        scaleX: 1 + 0.03 * decay,
        scaleY: 1 - 0.03 * decay,
        rotation: reducedMotion ? 0 : Math.sin(battle.phaseTicks * 0.75) * 0.09 * decay,
      });
      tintFlash = Math.max(0, 1 - battle.phaseTicks / 12) * 0.65;
      if (!reducedMotion && battle.phaseTicks < 14) {
        const amp = (1 - battle.phaseTicks / 14) * 3;
        stageShake = {
          x: Math.sin(battle.phaseTicks * 2.1) * amp,
          y: Math.cos(battle.phaseTicks * 2.7) * amp * 0.65,
        };
      }
    } else {
      const u = clamp01(battle.phaseTicks / 16);
      const arc = Math.sin(u * Math.PI);
      fae = composePose(fae, {
        offsetX: 0,
        offsetY: -6 * arc,
        scaleX: 1 - 0.03 * arc,
        scaleY: 1 + 0.04 * arc,
        rotation: 0,
      });
      radialBurst(vfx, "fae", battle.phaseTicks, 0, 4, 48, 22);
    }
  }

  // 12. Wind-up micro-tremble + rising fizz bubbles; fizzle wide squash-deflate + puffs.
  critter = applyWindUpAndFizzle(
    battle,
    puffLevel(battle, view),
    calmMood,
    tick,
    critter,
    vfx,
    reducedMotion,
  );

  // 13. Soothed -> reward: expanding aura dissolve, celebratory burst, Relief Bloom petals,
  // and pastel victory confetti shower strictly during "soothed" (keeping "reward" untouched).
  const settled = applySoothedAndReward(battle, tick, critter, vfx, reducedMotion);
  critter = settled.critter;
  auraScaleBoost = settled.auraScaleBoost;
  if (battle.phase === "soothed") {
    emitSoothedConfettiVfx(vfx, battle.phaseTicks, reducedMotion);
  }

  // 14. Rest (cozy faint): gentle dizzy sway -> sideways slump -> slow resting breath,
  // sleepy pastel stars overhead, and sympathetic companion droop.
  if (battle.phase === "rest") {
    fae = applyRestFaint(battle.phaseTicks, tick, partyIds, party, vfx, reducedMotion);
  }

  return {
    fae: { ...fae, tintFlash },
    party,
    critter,
    stageShake,
    auraScaleBoost,
    hitStop,
    stageMood,
    vfx,
  };
}
