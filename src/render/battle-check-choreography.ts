import { peekabooStatus, type Battle, type BattleView } from "../core";
import { composePose, NEUTRAL_POSE, type MotionPose } from "./motion";
import {
  clamp01,
  emitEchoChimeVfx,
  emitLeanWindVfx,
  emitPeekabooVfx,
  emitSpinSnagVfx,
  emitTraceBrushVfx,
  emitWhackVfx,
  emitWhichOneVfx,
  RAINBOW_HEARTS,
  SPARKLE_TINTS,
  type BattleVfxParticle,
  type SnackTheaterKind,
} from "./battle-vfx";

export type PartySkillChoreographyInput = {
  battle: Battle;
  view: BattleView | null;
  partyIds: readonly string[];
  partyCommands: Readonly<Record<string, string | null>>;
  snackKind: SnackTheaterKind;
  fae: MotionPose;
  applyParty: (actorId: string | null, delta: MotionPose) => void;
  vfx: BattleVfxParticle[];
};

export type InteractiveCheckChoreographyInput = {
  battle: Battle;
  view: BattleView | null;
  tick: number;
  reducedMotion: boolean;
  fae: MotionPose;
  critter: MotionPose;
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

function shiftPose(
  base: MotionPose,
  offsetX: number,
  offsetY: number,
  rotation = 0,
): MotionPose {
  return composePose(base, { offsetX, offsetY, scaleX: 1, scaleY: 1, rotation });
}

/**
 * Applies Soothe, Maddie Play, Sue Cast, and Jordan Juggle check/result actor
 * choreography and stage VFX particles.
 */
export function applyPartySkillChoreography(input: PartySkillChoreographyInput): MotionPose {
  const { battle, view, partyIds, partyCommands, snackKind, applyParty, vfx } = input;
  let { fae } = input;

  // Soothe check & result.
  if (battle.phase === "check" && battle.command === "soothe" && battle.check?.side === "critter") {
    const hop = Math.abs(Math.sin(battle.phaseTicks / 8));
    fae = composePose(fae, {
      offsetX: 16, offsetY: -6 * hop, scaleX: 1 - 0.03 * hop, scaleY: 1 + 0.04 * hop, rotation: 0,
    });
  }
  if (battle.phase === "result" && battle.command === "soothe" && snackKind === "none") {
    const u = clamp01(battle.phaseTicks / 22);
    const arc = Math.sin(u * Math.PI);
    fae = composePose(fae, {
      offsetX: 16 * arc, offsetY: -12 * arc,
      scaleX: 1 - 0.04 * arc, scaleY: 1 + 0.05 * arc, rotation: 0,
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

  // Maddie play (crouch anticipation -> pounce arc).
  const playActor = actorForCommand(partyIds, partyCommands, "play");
  if (battle.command === "play" && battle.phase === "check" && battle.check?.side === "critter") {
    applyParty(playActor, { offsetX: -4, offsetY: 0, scaleX: 1.08, scaleY: 0.9, rotation: -0.04 });
  }
  if (battle.command === "play" && battle.phase === "result" && snackKind === "none") {
    const u = clamp01(battle.phaseTicks / 24);
    const arc = Math.sin(u * Math.PI);
    applyParty(playActor, {
      offsetX: 34 * arc, offsetY: -20 * arc, scaleX: 1 - 0.04 * arc,
      scaleY: 1 + 0.06 * arc, rotation: 0.08 * Math.sin(u * Math.PI * 2),
    });
  }

  // Sue cast (charge lean-back -> snappy forward cast + pastel sparkle arc).
  const castActor = actorForCommand(partyIds, partyCommands, "cast");
  if (battle.phase === "check" && battle.check?.kind === "charge" &&
      battle.check.side === "critter") {
    const fill = view?.check?.kind === "charge"
      ? view.check.fill
      : clamp01(battle.check.held / Math.max(1, battle.check.spec.maxTicks));
    applyParty(castActor, {
      offsetX: -10 * fill, offsetY: 0,
      scaleX: 1 + 0.03 * fill, scaleY: 1 - 0.02 * fill, rotation: -0.16 * fill,
    });
  }
  if (battle.command === "cast" && battle.phase === "result" && snackKind === "none") {
    const u = Math.max(0, 1 - battle.phaseTicks / 20);
    applyParty(castActor, {
      offsetX: 14 * u, offsetY: -4 * u,
      scaleX: 1 - 0.03 * u, scaleY: 1 + 0.04 * u, rotation: 0.1 * u,
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

  // Jordan juggle (rhythmic toss-bob synced to chain beats + cheerful hop on result).
  const juggleActor = actorForCommand(partyIds, partyCommands, "juggle");
  if (
    battle.command === "juggle" &&
    battle.phase === "check" &&
    battle.check?.kind === "chain" &&
    battle.check.side === "critter"
  ) {
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

  return fae;
}

/**
 * Applies interactive battle check actor poses and VFX particles for `lean`,
 * `catch`, `peekaboo`, `echo`, `trace`, `which-one`, `whack`, and `spin-snag`.
 */
export function applyInteractiveCheckChoreography(
  input: InteractiveCheckChoreographyInput,
): { fae: MotionPose; critter: MotionPose } {
  const { battle, view, tick, reducedMotion, vfx } = input;
  let { fae, critter } = input;
  if (battle.phase !== "check" || battle.check === null) return { fae, critter };
  const check = battle.check;

  if (check.kind === "lean") {
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
  } else if (check.kind === "catch") {
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
  } else if (check.kind === "peekaboo") {
    const ratio = clamp01(check.progress / Math.max(1, check.spec.goal));
    const status = peekabooStatus(check);
    if (status === "watching") {
      fae = composePose(fae, {
        offsetX: 34 * ratio, offsetY: 4, scaleX: 1.04, scaleY: 0.93, rotation: 0,
      });
      critter = composePose(critter, {
        offsetX: -14, offsetY: -8, scaleX: 0.94, scaleY: 1.1, rotation: -0.04,
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
      critter = composePose(
        critter,
        status === "warning"
          ? {
              offsetX: 4 + (reducedMotion ? 0 : Math.sin(check.tick * 1.8) * 3),
              offsetY: -3,
              scaleX: 1.02,
              scaleY: 1.03,
              rotation: reducedMotion ? 0 : Math.sin(check.tick * 2.1) * 0.06,
            }
          : { offsetX: 10, offsetY: 0, scaleX: 0.96, scaleY: 1, rotation: 0.09 },
      );
    }
    emitPeekabooVfx(vfx, status, check.progress, check.tick, reducedMotion, ratio);
  } else if (check.kind === "echo") {
    const echoView = view?.check?.kind === "echo" ? view.check : null;
    const echoMotion = emitEchoChimeVfx(vfx, check, echoView, reducedMotion);
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
  } else if (check.kind === "trace") {
    const traceView = view?.check?.kind === "trace" ? view.check : null;
    const motion = emitTraceBrushVfx(vfx, check, traceView, tick, reducedMotion);
    if (motion.faeOffsetX !== 0 || motion.faeOffsetY !== 0 || motion.faeRotation !== 0) {
      fae = shiftPose(fae, motion.faeOffsetX, motion.faeOffsetY, motion.faeRotation);
    }
  } else if (check.kind === "which-one") {
    const whichView = view?.check?.kind === "which-one" ? view.check : null;
    const motion = emitWhichOneVfx(vfx, check, whichView, tick, reducedMotion);
    if (motion.critterOffsetY !== 0) {
      critter = composePose(critter, {
        offsetX: 0, offsetY: motion.critterOffsetY, scaleX: 0.98, scaleY: 1.04, rotation: 0,
      });
    }
    if (motion.faeOffsetX !== 0) fae = shiftPose(fae, motion.faeOffsetX, 0);
  } else if (check.kind === "whack") {
    const whackView = view?.check?.kind === "whack" ? view.check : null;
    const motion = emitWhackVfx(vfx, check, whackView, tick, reducedMotion);
    if (motion.faeOffsetX !== 0 || motion.faeRotation !== 0) {
      fae = shiftPose(fae, motion.faeOffsetX, 0, motion.faeRotation);
    }
  } else if (check.kind === "spin-snag") {
    const spinView = view?.check?.kind === "spin-snag" ? view.check : null;
    const motion = emitSpinSnagVfx(vfx, check, spinView, tick, reducedMotion);
    if (motion.faeOffsetX !== 0 || motion.faeOffsetY !== 0 || motion.faeRotation !== 0) {
      fae = shiftPose(fae, motion.faeOffsetX, motion.faeOffsetY, motion.faeRotation);
    }
  }

  return { fae, critter };
}
