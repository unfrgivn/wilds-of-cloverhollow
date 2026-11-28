import { peekabooStatus, type Battle, type BattleView } from "../core";
import { composePose, idleBreathing, NEUTRAL_POSE, type MotionPose } from "./motion";
import {
  applyRecoverTheater,
  applyRestFaint,
  applySnackTheater,
  applySoothedAndReward,
  applyTalkTheater,
  applyTogetherActive,
  applyTogetherReady,
  applyWindUpAndFizzle,
  clamp01,
  classifySnackTheater,
  ECHO_CHIME_COLORS,
  echoNoteColor,
  emitEchoChimeVfx,
  emitLeanWindVfx,
  emitPeekabooVfx,
  emitRainbowLassoVfx,
  emitSoothedConfettiVfx,
  emitTraceBrushVfx,
  FIZZ_TINTS,
  isLassoActionActive,
  isRecoverTheater,
  isTalkTheater,
  LASSO_ARC_DURATION,
  LEAN_WIND_TINTS,
  PEEKABOO_DUST_TINT,
  PEEKABOO_WARNING_TINT,
  PEEKABOO_WATCH_TINTS,
  radialBurst,
  RAINBOW_HEARTS,
  RAINBOW_LASSO_COLORS,
  RECOVER_SPARKLE_TINTS,
  RELIEF_PETALS,
  SOOTHED_CONFETTI_COLORS,
  SPARKLE_TINTS,
  TRACE_BRUSH_COLORS,
  type BattleStageMood,
  type BattleVfxAnchor,
  type BattleVfxBlend,
  type BattleVfxParticle,
  type BattleVfxTexture,
  type BattleVfxTextureKey,
  type EchoChimeMotion,
  type EchoColor,
  type SnackTheaterKind,
  type TraceBrushMotion,
} from "./battle-vfx";

export {
  classifySnackTheater,
  ECHO_CHIME_COLORS,
  echoNoteColor,
  emitEchoChimeVfx,
  emitLeanWindVfx,
  emitPeekabooVfx,
  emitRainbowLassoVfx,
  emitSoothedConfettiVfx,
  emitTraceBrushVfx,
  FIZZ_TINTS,
  isLassoActionActive,
  isRecoverTheater,
  isTalkTheater,
  LASSO_ARC_DURATION,
  LEAN_WIND_TINTS,
  PEEKABOO_DUST_TINT,
  PEEKABOO_WARNING_TINT,
  PEEKABOO_WATCH_TINTS,
  radialBurst,
  RAINBOW_HEARTS,
  RAINBOW_LASSO_COLORS,
  RECOVER_SPARKLE_TINTS,
  RELIEF_PETALS,
  SOOTHED_CONFETTI_COLORS,
  SPARKLE_TINTS,
  TRACE_BRUSH_COLORS,
  type BattleStageMood,
  type BattleVfxAnchor,
  type BattleVfxBlend,
  type BattleVfxParticle,
  type BattleVfxTexture,
  type BattleVfxTextureKey,
  type EchoChimeMotion,
  type EchoColor,
  type SnackTheaterKind,
  type TraceBrushMotion,
};

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
    battle.command === "together" &&
    (battle.phase === "check" || (battle.phase === "result" && battle.lastGrade !== null))
  ) {
    return "together-active";
  }
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

  // 2. Soothe check & result.
  if (battle.phase === "check" && battle.command === "soothe" &&
      battle.check?.side === "critter") {
    const hop = Math.abs(Math.sin(battle.phaseTicks / 8));
    fae = composePose(fae, {
      offsetX: 16,
      offsetY: -6 * hop,
      scaleX: 1 - 0.03 * hop,
      scaleY: 1 + 0.04 * hop,
      rotation: 0,
    });
  }
  if (battle.phase === "result" && battle.command === "soothe" && snackKind === "none") {
    const u = clamp01(battle.phaseTicks / 22);
    const arc = Math.sin(u * Math.PI);
    fae = composePose(fae, {
      offsetX: 16 * arc,
      offsetY: -12 * arc,
      scaleX: 1 - 0.04 * arc,
      scaleY: 1 + 0.05 * arc,
      rotation: 0,
    });
    if (battle.lastGrade === "great" || battle.lastGrade === "good") {
      const ringCount = battle.lastGrade === "great" ? 3 : 2;
      for (let i = 0; i < ringCount; i += 1) {
        const ru = clamp01((battle.phaseTicks + 4 - i * 5) / 24);
        if (ru <= 0 || ru >= 1) continue;
        const scale = 0.45 + ru * 1.15;
        vfx.push({
          texture: "energyRing",
          blend: "add",
          anchor: "between",
          t: 0.18 + ru * 0.78,
          offsetX: 0,
          offsetY: -Math.sin(ru * Math.PI) * 18,
          scaleX: scale * 0.72,
          scaleY: scale,
          rotation: 0,
          alpha: (1 - ru) * 0.88,
          tint: i % 2 === 0 ? 0x67d5c4 : 0xd4fcf2,
        });
      }
      const sparkleCount = battle.lastGrade === "great" ? 6 : 4;
      for (let i = 0; i < sparkleCount; i += 1) {
        const su = clamp01((battle.phaseTicks + 3 - i * 2) / 26);
        if (su <= 0 || su >= 1) continue;
        const scale = (0.36 + (i % 3) * 0.12) * (1 - su * 0.35);
        vfx.push({
          texture: "sparkle",
          blend: "add",
          anchor: "between",
          t: 0.12 + su * 0.86,
          offsetX: Math.sin(su * 6 + i) * 10,
          offsetY: -Math.sin(su * Math.PI) * 32 + ((i % 3) - 1) * 14,
          scaleX: scale,
          scaleY: scale,
          rotation: su * 2 + i,
          alpha: (1 - su) * 0.92,
          tint: i % 2 === 0 ? 0xfff099 : 0xd4fcf2,
        });
      }
    }
  }

  // 3. Maddie play (crouch anticipation -> pounce arc).
  const playActor = actorForCommand(partyIds, partyCommands, "play");
  if (battle.command === "play" && battle.phase === "check" &&
      battle.check?.side === "critter") {
    applyParty(playActor, {
      offsetX: -4,
      offsetY: 0,
      scaleX: 1.08,
      scaleY: 0.9,
      rotation: -0.04,
    });
  }
  if (battle.command === "play" && battle.phase === "result" && snackKind === "none") {
    const u = clamp01(battle.phaseTicks / 24);
    const arc = Math.sin(u * Math.PI);
    applyParty(playActor, {
      offsetX: 34 * arc,
      offsetY: -20 * arc,
      scaleX: 1 - 0.04 * arc,
      scaleY: 1 + 0.06 * arc,
      rotation: 0.08 * Math.sin(u * Math.PI * 2),
    });
  }

  // 4. Sue cast (charge lean-back -> snappy forward cast + pastel sparkle arc).
  const castActor = actorForCommand(partyIds, partyCommands, "cast");
  if (battle.phase === "check" && battle.check?.kind === "charge" &&
      battle.check.side === "critter") {
    const fill = view?.check?.kind === "charge"
      ? view.check.fill
      : clamp01(battle.check.held / Math.max(1, battle.check.spec.maxTicks));
    applyParty(castActor, {
      offsetX: -10 * fill,
      offsetY: 0,
      scaleX: 1 + 0.03 * fill,
      scaleY: 1 - 0.02 * fill,
      rotation: -0.16 * fill,
    });
  }
  if (battle.command === "cast" && battle.phase === "result" && snackKind === "none") {
    const u = Math.max(0, 1 - battle.phaseTicks / 20);
    applyParty(castActor, {
      offsetX: 14 * u,
      offsetY: -4 * u,
      scaleX: 1 - 0.03 * u,
      scaleY: 1 + 0.04 * u,
      rotation: 0.1 * u,
    });
    const arcCount = battle.lastGrade === "great" ? 6 : 4;
    for (let i = 0; i < arcCount; i += 1) {
      const su = clamp01((battle.phaseTicks + 4 - i * 2) / 24);
      if (su <= 0 || su >= 1) continue;
      vfx.push({
        texture: "sparkle",
        blend: "add",
        anchor: "between",
        t: 0.1 + su * 0.88,
        offsetX: 0,
        offsetY: -Math.sin(su * Math.PI) * 56 + ((i % 2) * 10 - 5),
        scaleX: 0.48 * (1 - su * 0.3),
        scaleY: 0.48 * (1 - su * 0.3),
        rotation: su * 2.4 + i,
        alpha: (1 - su) * 0.9,
        tint: RAINBOW_HEARTS[(i + 2) % RAINBOW_HEARTS.length] ?? 0xa8e6cf,
      });
    }
  }

  // 5. Jordan juggle (rhythmic toss-bob synced to chain beats + cheerful hop on result).
  const juggleActor = actorForCommand(partyIds, partyCommands, "juggle");
  if (battle.command === "juggle" && battle.phase === "check" &&
      battle.check?.kind === "chain" && battle.check.side === "critter") {
    const check = battle.check;
    const hitPop = check.results.some((result, index) => {
      if (result !== "hit") return false;
      const arrival = check.spec.arrivals[index] ?? -100;
      const age = check.tick - arrival;
      return age >= -4 && age <= 10;
    });
    const wave = Math.abs(Math.sin(check.tick / 5));
    const lift = wave * 6 + (hitPop ? 6 : 0);
    applyParty(juggleActor, {
      offsetX: 0,
      offsetY: -lift,
      scaleX: 1 - (hitPop ? 0.04 : 0.02) * wave,
      scaleY: 1 + (hitPop ? 0.06 : 0.03) * wave,
      rotation: 0,
    });
  }
  if (battle.command === "juggle" && battle.phase === "result" && snackKind === "none") {
    const u = clamp01(battle.phaseTicks / 20);
    const arc = Math.sin(u * Math.PI);
    applyParty(juggleActor, {
      offsetX: 10 * arc,
      offsetY: -12 * arc,
      scaleX: 1 - 0.03 * arc,
      scaleY: 1 + 0.05 * arc,
      rotation: 0,
    });
  }

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

  // 7. Fae lean: tilt live with balance + wind-braced squash + sweeping wind-gust ribbons.
  if (battle.phase === "check" && battle.check?.kind === "lean") {
    const check = battle.check;
    const balance = view?.check?.kind === "lean" ? view.check.balance : check.balance / 100;
    const blowing = view?.check?.kind === "lean"
      ? view.check.puffs.some((item) => item.blowing)
      : check.spec.starts.some(
          (start, index) =>
            (check.results[index] ?? "pending") === "pending" &&
            check.tick >= start &&
            check.tick < start + check.spec.puffTicks,
        );
    fae = composePose(fae, {
      offsetX: balance * 14 + (blowing && !reducedMotion ? Math.sin(tick * 1.4) * 1.2 : 0),
      offsetY: 0,
      scaleX: blowing ? 1.05 : 1,
      scaleY: blowing ? 0.94 : 1,
      rotation: balance * 0.28,
    });
    emitLeanWindVfx(vfx, blowing, tick, reducedMotion);
  }

  // 8. Fae catch: pose live with catcher lane + brief sparkle burst on caught toys.
  if (battle.phase === "check" && battle.check?.kind === "catch") {
    const check = battle.check;
    const lanePose: MotionPose = check.catcher === 0
      ? { offsetX: 0, offsetY: -7, scaleX: 0.97, scaleY: 1.05, rotation: 0 }
      : check.catcher === 2
        ? { offsetX: 0, offsetY: 4, scaleX: 1.05, scaleY: 0.93, rotation: 0 }
        : NEUTRAL_POSE;
    fae = composePose(fae, lanePose);
    check.results.forEach((result, index) => {
      if (result !== "hit") return;
      const arrival = check.spec.arrivals[index] ?? -100;
      const age = check.tick - arrival;
      if (age < 0 || age >= 14) return;
      const u = age / 14;
      for (let i = 0; i < 4; i += 1) {
        const angle = (i / 4) * Math.PI * 2 + u * 0.6;
        const dist = 16 + u * 34;
        vfx.push({
          texture: "sparkle",
          blend: "add",
          anchor: "fae",
          offsetX: 24 + Math.cos(angle) * dist,
          offsetY: Math.sin(angle) * dist,
          scaleX: 0.45 * (1 - u * 0.4),
          scaleY: 0.45 * (1 - u * 0.4),
          rotation: u * 1.5 + i,
          alpha: (1 - u) * 0.95,
          tint: SPARKLE_TINTS[i % SPARKLE_TINTS.length] ?? 0xfff099,
        });
      }
    });
  }

  // 8b. Fae & critter peekaboo: Fae tiptoes forward while safe and freezes low
  // when watching; critter looks slightly away, twitches on warning, pops tall
  // wide-eyed while watching.
  if (battle.phase === "check" && battle.check?.kind === "peekaboo") {
    const check = battle.check;
    const ratio = clamp01(check.progress / Math.max(1, check.spec.goal));
    const status = peekabooStatus(check);
    if (status === "watching") {
      fae = composePose(fae, {
        offsetX: 34 * ratio,
        offsetY: 4,
        scaleX: 1.04,
        scaleY: 0.93,
        rotation: 0,
      });
      critter = composePose(critter, {
        offsetX: -14,
        offsetY: -8,
        scaleX: 0.94,
        scaleY: 1.1,
        rotation: -0.04,
      });
    } else {
      const bob = check.progress > 0 ? Math.abs(Math.sin(check.tick / 4.5)) : 0;
      fae = composePose(fae, {
        offsetX: 34 * ratio,
        offsetY: -5 * bob,
        scaleX: 1 - 0.02 * bob,
        scaleY: 1 + 0.03 * bob,
        rotation: 0.04 * bob,
      });
      if (status === "warning") {
        critter = composePose(critter, {
          offsetX: 4 + (reducedMotion ? 0 : Math.sin(check.tick * 1.8) * 3),
          offsetY: -3,
          scaleX: 1.02,
          scaleY: 1.03,
          rotation: reducedMotion ? 0 : Math.sin(check.tick * 2.1) * 0.06,
        });
      } else {
        critter = composePose(critter, {
          offsetX: 10,
          offsetY: 0,
          scaleX: 0.96,
          scaleY: 1,
          rotation: 0.09,
        });
      }
    }
    emitPeekabooVfx(vfx, status, check.progress, check.tick, reducedMotion, ratio);
  }

  // 8c. Echo Chimes synesthetic musical VFX & live bounce: critter sings with
  // color-matched rising notes on demo; Fae echoes them arching lightly back.
  if (battle.phase === "check" && battle.check?.kind === "echo") {
    const echoView = view?.check?.kind === "echo" ? view.check : null;
    const echoMotion = emitEchoChimeVfx(vfx, battle.check, echoView, reducedMotion);
    if (echoMotion.critterOffsetY !== 0) {
      critter = composePose(critter, {
        offsetX: 0,
        offsetY: echoMotion.critterOffsetY,
        scaleX: 0.97,
        scaleY: 1.05,
        rotation: echoMotion.critterRotation,
      });
    } else if (echoMotion.faeOffsetY !== 0) {
      fae = composePose(fae, {
        offsetX: 4,
        offsetY: echoMotion.faeOffsetY,
        scaleX: 0.98,
        scaleY: 1.04,
        rotation: echoMotion.faeRotation,
      });
    }
  }

  // 8d. Shape Trace watercolor brush choreography: pastel brush sparkles beside
  // Fae's right hand + gentle painting sway once tracing is actively underway.
  if (battle.phase === "check" && battle.check?.kind === "trace") {
    const traceView = view?.check?.kind === "trace" ? view.check : null;
    const traceMotion = emitTraceBrushVfx(vfx, battle.check, traceView, tick, reducedMotion);
    if (
      traceMotion.faeOffsetX !== 0 ||
      traceMotion.faeOffsetY !== 0 ||
      traceMotion.faeRotation !== 0
    ) {
      fae = composePose(fae, {
        offsetX: traceMotion.faeOffsetX,
        offsetY: traceMotion.faeOffsetY,
        scaleX: 1,
        scaleY: 1,
        rotation: traceMotion.faeRotation,
      });
    }
  }

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
        (battle.command === "together" && battle.lastGrade !== null));
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
  if (stageMood === "together-ready") {
    fae = applyTogetherReady(tick, partyIds, fae, applyParty, vfx, reducedMotion);
  }

  // 10c. Together! Activation theater: synchronized team wave-hop + golden cascade.
  if (stageMood === "together-active") {
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
