import { peekabooStatus, type Battle, type BattleView } from "../core";
import { composePose, idleBreathing, NEUTRAL_POSE, type MotionPose } from "./motion";

export type BattleVfxTexture = "sparkle" | "heart" | "energyRing" | "puff";
export type BattleVfxAnchor = "fae" | "critter" | "between" | "party";

export type BattleVfxParticle = {
  texture: BattleVfxTexture;
  blend: "normal" | "add";
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

export type BattleChoreography = {
  fae: MotionPose & { tintFlash: number };
  party: Record<string, MotionPose>;
  critter: MotionPose;
  stageShake: { x: number; y: number };
  auraScaleBoost: number;
  vfx: BattleVfxParticle[];
};

const RAINBOW_HEARTS: readonly number[] = [
  0xff9bb8,
  0xffc491,
  0xfff099,
  0xa8e6cf,
  0xa8dcff,
  0xd8b8ff,
];

const SPARKLE_TINTS: readonly number[] = [0xfff099, 0xffe074, 0xd4fcf2, 0xffd2e6];
const FIZZ_TINTS: readonly number[] = [0xe6b8ff, 0xffb8d8, 0xd8c4ff];

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

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

function radialBurst(
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

function puffLevel(battle: Battle, view: BattleView | null): number {
  if (view !== null) return view.puff;
  if (battle.windUp === null) return 0;
  return Math.max(1, battle.windUp.feelings.length - battle.windUp.left + 1);
}

export function computeBattleChoreography(
  battle: Battle,
  view: BattleView | null,
  tick: number,
  partyIds: readonly string[],
  partyCommands: Readonly<Record<string, string | null>>,
): BattleChoreography {
  let fae: MotionPose = idleBreathing(tick, 0, 0.014);
  let tintFlash = 0;
  const party: Record<string, MotionPose> = {};
  partyIds.forEach((id, index) => {
    party[id] = idleBreathing(tick, (index + 1) * 1.4, 0.014);
  });

  const calmMood = battle.phase === "soothed" || battle.phase === "reward";
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
  const vfx: BattleVfxParticle[] = [];

  const applyParty = (actorId: string | null, delta: MotionPose): void => {
    if (actorId === null) return;
    const base = party[actorId];
    if (base !== undefined) party[actorId] = composePose(base, delta);
  };

  // 1. Command menu: selected actor steps eagerly forward.
  if (battle.phase === "command") {
    const selectedId = view?.commands[battle.selected]?.id ?? null;
    if (selectedId === "soothe" || selectedId === "snack" || selectedId === "talk") {
      fae = composePose(fae, { offsetX: 10, offsetY: 0, scaleX: 1, scaleY: 1.02, rotation: 0 });
    } else if (selectedId !== null && selectedId !== "run") {
      const actor = actorForCommand(partyIds, partyCommands, selectedId);
      applyParty(actor, { offsetX: 10, offsetY: 0, scaleX: 1, scaleY: 1.02, rotation: 0 });
    }
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
  if (battle.phase === "result" && battle.command === "soothe") {
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
  if (battle.command === "play" && battle.phase === "result") {
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
  if (battle.command === "cast" && battle.phase === "result") {
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
  if (battle.command === "juggle" && battle.phase === "result") {
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

  // 6. Fae snack: cozy hop + floating pastel hearts over critter.
  if (battle.command === "snack" && battle.phase === "result") {
    const u = clamp01(battle.phaseTicks / 18);
    const arc = Math.sin(u * Math.PI);
    fae = composePose(fae, {
      offsetX: 8 * arc,
      offsetY: -10 * arc,
      scaleX: 1 - 0.03 * arc,
      scaleY: 1 + 0.04 * arc,
      rotation: 0,
    });
    const heartCount = battle.answered ? 7 : 4;
    radialBurst(vfx, "critter", battle.phaseTicks, heartCount, battle.answered ? 4 : 2, 74, 34);
  }

  // 7. Fae lean: tilt live with balance + wind-braced squash when blowing.
  if (battle.phase === "check" && battle.check?.kind === "lean") {
    const check = battle.check;
    const balance = view?.check?.kind === "lean" ? view.check.balance : check.balance / 100;
    const blowing = view?.check?.kind === "lean"
      ? view.check.puffs.some((item) => item.blowing)
      : check.spec.starts.some(
          (start) => check.tick >= start && check.tick < start + check.spec.puffTicks,
        );
    fae = composePose(fae, {
      offsetX: balance * 14 + (blowing ? Math.sin(tick * 1.4) * 1.2 : 0),
      offsetY: 0,
      scaleX: blowing ? 1.05 : 1,
      scaleY: blowing ? 0.94 : 1,
      rotation: balance * 0.28,
    });
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
          offsetX: 4 + Math.sin(check.tick * 1.8) * 3,
          offsetY: -3,
          scaleX: 1.02,
          scaleY: 1.03,
          rotation: Math.sin(check.tick * 2.1) * 0.06,
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

  // 10. Critter result reaction + rainbow heart & sparkle bursts.
  if (battle.phase === "result") {
    const u = clamp01(battle.phaseTicks / 24);
    const arc = Math.sin(u * Math.PI);
    if (battle.lastGrade === "great") {
      critter = composePose(critter, {
        offsetX: 0,
        offsetY: -14 * arc,
        scaleX: 1 - 0.05 * arc + 0.02 * (1 - arc),
        scaleY: 1 + 0.07 * arc - 0.03 * (1 - arc),
        rotation: 0,
      });
      const hearts = battle.answered ? 8 : 5;
      const sparkles = battle.answered ? 8 : 5;
      radialBurst(vfx, "critter", battle.phaseTicks, hearts, sparkles, 86, 32);
    } else if (battle.lastGrade === "good") {
      critter = composePose(critter, {
        offsetX: 0,
        offsetY: -5 * arc,
        scaleX: 1 + 0.04 * arc,
        scaleY: 1 - 0.04 * arc,
        rotation: 0,
      });
      const hearts = battle.answered ? 4 : 0;
      radialBurst(vfx, "critter", battle.phaseTicks, hearts, 4, 72, 28);
    } else if (battle.lastGrade === "miss") {
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

  // 11. Fae burstResult reaction + subtle stage shake on spent energy.
  if (battle.phase === "burstResult") {
    if (battle.lastGrade !== "great") {
      const decay = Math.max(0, 1 - battle.phaseTicks / 20);
      fae = composePose(fae, {
        offsetX: -14 * decay,
        offsetY: 0,
        scaleX: 1 + 0.03 * decay,
        scaleY: 1 - 0.03 * decay,
        rotation: Math.sin(battle.phaseTicks * 0.75) * 0.09 * decay,
      });
      tintFlash = Math.max(0, 1 - battle.phaseTicks / 12) * 0.65;
      if (battle.phaseTicks < 14) {
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
  const puff = puffLevel(battle, view);
  if (puff >= 2 && battle.phase !== "fizzle" && !calmMood) {
    critter = composePose(critter, {
      offsetX: Math.sin(tick * 1.9) * 2.2,
      offsetY: 0,
      scaleX: 1,
      scaleY: 1,
      rotation: Math.cos(tick * 2.3) * 0.025,
    });
    for (let i = 0; i < 4; i += 1) {
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
    critter = composePose(critter, {
      offsetX: 0,
      offsetY: 0,
      scaleX: 1 + 0.18 * u,
      scaleY: 1 - 0.2 * u,
      rotation: 0,
    });
    const puffU = clamp01((battle.phaseTicks + 2) / 28);
    const puffAlpha = (1 - puffU) * 0.78;
    if (puffAlpha > 0.02) {
      for (let i = 0; i < 5; i += 1) {
        const angle = -Math.PI + (i / 4) * Math.PI;
        const dist = 28 + puffU * 66;
        const scale = 0.45 + puffU * 0.55;
        vfx.push({
          texture: "puff",
          blend: "normal",
          anchor: "critter",
          offsetX: Math.cos(angle) * dist,
          offsetY: Math.sin(angle) * dist * 0.55 - puffU * 24,
          scaleX: scale,
          scaleY: scale,
          rotation: angle * 0.25,
          alpha: puffAlpha,
          tint: i % 2 === 0 ? 0xf2d8ee : 0xfaf3df,
        });
      }
    }
  }

  // 13. Soothed -> reward: expanding aura dissolve, celebratory burst, relieved bounce.
  if (battle.phase === "soothed") {
    const p = clamp01(battle.phaseTicks / 30);
    auraScaleBoost = 1 + p * 0.45;
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

  return {
    fae: { ...fae, tintFlash },
    party,
    critter,
    stageShake,
    auraScaleBoost,
    vfx,
  };
}
