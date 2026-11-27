import { peekabooStatus, type Battle, type BattleView } from "../core";
import { composePose, idleBreathing, NEUTRAL_POSE, type MotionPose } from "./motion";

export type BattleVfxTexture =
  | "sparkle"
  | "heart"
  | "energyRing"
  | "puff"
  | "petal"
  | "softGlow";
export type BattleVfxAnchor = "fae" | "critter" | "between" | "party";
export type BattleStageMood =
  | "calm-normal"
  | "windup"
  | "together-ready"
  | "together-active"
  | "soothed";

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
  hitStop: boolean;
  stageMood: BattleStageMood;
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
const RELIEF_PETALS: readonly number[] = [0xa8e6cf, 0xfff099, 0xffc8dc, 0xd8b8ff];
const SNACK_SPARKLE_TINTS: readonly number[] = [0x9be38a, 0xffe58a];
const FAVOURITE_HEART_TINTS: readonly number[] = [
  0xffd859,
  0xf27ea3,
  0xf5b82e,
  0xf69a5c,
  0x6bc7b4,
  0xb68cf0,
];

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

export function battleStageMood(battle: Battle, view: BattleView | null): BattleStageMood {
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
  if (snackKind === "snack") {
    const u = clamp01(battle.phaseTicks / 22);
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
      const su = clamp01((battle.phaseTicks + 10 - i * 2) / 36);
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
  } else if (snackKind === "treat" || snackKind === "favourite") {
    const isFav = snackKind === "favourite";
    const u = clamp01(battle.phaseTicks / 24);
    const arc = Math.sin(u * Math.PI);
    const munchArc = Math.sin(clamp01(battle.phaseTicks / 24) * Math.PI);
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
      const progress = clamp01((battle.phaseTicks + 12 - i * 2) / 36);
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
        radialBurst(vfx, "critter", battle.phaseTicks, 6, 6, 84, 34);
      }
    }
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

  // 8c. Echo Chimes live musical bounce: critter hops on demo chimes, Fae hops
  // on echoed chimes.
  if (battle.phase === "check" && battle.check?.kind === "echo") {
    const echoView = view?.check?.kind === "echo" ? view.check : null;
    if (echoView?.phase === "demo" && echoView.litNote !== null) {
      critter = composePose(critter, {
        offsetX: 0,
        offsetY: -5,
        scaleX: 0.97,
        scaleY: 1.05,
        rotation: 0,
      });
    } else if (echoView?.phase === "input" && echoView.litNote !== null) {
      fae = composePose(fae, {
        offsetX: 4,
        offsetY: -4,
        scaleX: 0.98,
        scaleY: 1.04,
        rotation: 0,
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

  // 10. Critter result reaction, 3-tick impact hit-stop, & rainbow bursts.
  if (battle.phase === "result") {
    const impactful =
      battle.lastGrade === "great" ||
      battle.answered ||
      (battle.command === "together" && battle.lastGrade !== null);
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
      const dir = battle.phaseTicks % 2 === 0 ? 1 : -1;
      stageShake = {
        x: dir * 3.5 * decay,
        y: -1.8 * decay * (battle.phaseTicks % 2 === 0 ? 1 : -0.6),
      };
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
    fae = composePose(fae, {
      offsetX: 0,
      offsetY: -Math.abs(Math.sin(tick / 10)) * 2.8,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
    });
    partyIds.forEach((id, idx) => {
      applyParty(id, {
        offsetX: 0,
        offsetY: -Math.abs(Math.sin(tick / 10 + (idx + 1) * 0.7)) * 2.8,
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
      });
    });
    const pulse = 0.5 + 0.5 * Math.sin(tick * 0.14);
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
      const twinkle = 0.5 + 0.5 * Math.sin(tick * 0.18 + i * 0.9);
      const scale = 0.36 + twinkle * 0.24;
      vfx.push({
        texture: "sparkle",
        blend: "normal",
        anchor: "fae",
        offsetX: leftSpan + (rightSpan - leftSpan) * frac,
        offsetY: 16 - Math.sin(frac * Math.PI) * 52 + Math.sin(tick * 0.15 + i) * 5,
        scaleX: scale,
        scaleY: scale,
        rotation: tick * 0.04 + i * 0.7,
        alpha: 0.78 + twinkle * 0.2,
        tint: i % 2 === 0 ? 0xf5b324 : 0xfff08a,
      });
    }
  }

  // 10c. Together! Activation theater: synchronized team wave-hop + golden cascade.
  if (stageMood === "together-active") {
    if (battle.phase === "check") {
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
    const sunPulse = 0.5 + 0.5 * Math.sin(tick * 0.22);
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
      const ru = battle.phase === "check"
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

  // 13. Soothed -> reward: expanding aura dissolve, celebratory burst, Relief Bloom petals.
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
  if (battle.phase === "soothed" || battle.phase === "reward") {
    for (let i = 0; i < 8; i += 1) {
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
