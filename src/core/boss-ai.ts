import type {
  Battle,
  BattleFoe,
  BattlePhase,
  BossPhase2View,
  CheckSpec,
  Critter,
  EnemyIntentView,
  LeanSpec,
  World,
} from "./types";
import { windUpStarts } from "./feelings";

export type BossPhase2Profile = {
  id: string;
  bossName: string;
  phaseTitle: string;
  signatureLine: string;
  moodTint: number;
  waveATint: number;
  waveBTint: number;
  spotlightTint: number;
  accentHex: string;
  rhythmLabel: string;
  signatureCheck?: CheckSpec;
};

const GYM_PUP_PROFILE: BossPhase2Profile = {
  id: "gym-pup",
  bossName: "Coach Ash's Gym Pup",
  phaseTitle: "Championship Rally!",
  signatureLine: "Whistle blows! Gym Pup picks up the stadium tempo!",
  moodTint: 0x3b8a6b,
  waveATint: 0x5ab88d,
  waveBTint: 0xf4c95d,
  spotlightTint: 0xffe49c,
  accentHex: "#3b8a6b",
  rhythmLabel: "Fastball Flurry",
};

export const BOSS_PHASE2_PROFILES: Readonly<Record<string, BossPhase2Profile>> = {
  gull: {
    id: "gull",
    bossName: "Grumpy Gull",
    phaseTitle: "Gale-Force Encore!",
    signatureLine: "The sea breeze kicks up! Grumpy Gull spreads its wings wide!",
    moodTint: 0x4b749f,
    waveATint: 0x73a3cc,
    waveBTint: 0xf2c864,
    spotlightTint: 0xfff0be,
    accentHex: "#4b749f",
    rhythmLabel: "Wind-Gust Surge",
  },
  "arcade-keeper": {
    id: "arcade-keeper",
    bossName: "Mr. Pip",
    phaseTitle: "Jackpot Fever!",
    signatureLine: "Bonus round! Mr. Pip's ticket slots light up in neon gold!",
    moodTint: 0x9b3b8c,
    waveATint: 0xd95fb8,
    waveBTint: 0xffcf56,
    spotlightTint: 0xffe394,
    accentHex: "#b8459e",
    rhythmLabel: "Whack-a-Ticket Rush",
    signatureCheck: { kind: "whack", pops: 5, stayTicks: 26, gapTicks: 8 },
  },
  "gym-pup": GYM_PUP_PROFILE,
  coach: GYM_PUP_PROFILE,
  "art-teacher": {
    id: "art-teacher",
    bossName: "Ms. Rowan",
    phaseTitle: "Masterpiece Swirl!",
    signatureLine: "Ms. Rowan dips her brush in bright marigold! Paint dries fast!",
    moodTint: 0x6d4ea3,
    waveATint: 0x9c79d4,
    waveBTint: 0xf6b74c,
    spotlightTint: 0xffe5b4,
    accentHex: "#6d4ea3",
    rhythmLabel: "Quick-Dry Brushstroke",
  },
  "lodge-keeper": {
    id: "lodge-keeper",
    bossName: "Mrs. Flurry",
    phaseTitle: "Blizzard Cocoa Rush!",
    signatureLine: "Mrs. Flurry swirls a snowy flurry straight from the pass!",
    moodTint: 0x3b7c99,
    waveATint: 0x74b5d1,
    waveBTint: 0xe6a76c,
    spotlightTint: 0xe3f4ff,
    accentHex: "#3b7c99",
    rhythmLabel: "Snowball Blitz",
  },
  lifeguard: {
    id: "lifeguard",
    bossName: "Ms. Coral",
    phaseTitle: "High-Tide Whistle!",
    signatureLine: "Ms. Coral blows her seashell whistle! Beach balls volley fast!",
    moodTint: 0xc95a6d,
    waveATint: 0xef8394,
    waveBTint: 0x56b9c2,
    spotlightTint: 0xffd7cf,
    accentHex: "#c95a6d",
    rhythmLabel: "Surf Volley",
  },
  principal: {
    id: "principal",
    bossName: "Mr. Bell",
    phaseTitle: "Pop-Quiz Overtime!",
    signatureLine: "The hall bell chimes! Mr. Bell grades at double speed!",
    moodTint: 0x3f5485,
    waveATint: 0x6882b8,
    waveBTint: 0xe8b954,
    spotlightTint: 0xfff1c4,
    accentHex: "#3f5485",
    rhythmLabel: "Gold-Star Sprint",
  },
  "taco-chef": {
    id: "taco-chef",
    bossName: "Chef Mateo",
    phaseTitle: "Sizzling Fiesta!",
    signatureLine: "Order up! Chef Mateo shakes the spice shakers in double time!",
    moodTint: 0xc84b3e,
    waveATint: 0xeb785d,
    waveBTint: 0x97c74a,
    spotlightTint: 0xffe0a8,
    accentHex: "#c84b3e",
    rhythmLabel: "Spice-Beat Tempo",
  },
  "hooded-kid": {
    id: "hooded-kid",
    bossName: "The Hooded Kid",
    phaseTitle: "Swirling Sketchstorm!",
    signatureLine: "Purple scribbles spiral skyward in a dazzling sketchbook storm!",
    moodTint: 0x5c3c8c,
    waveATint: 0x9663cc,
    waveBTint: 0xe267a5,
    spotlightTint: 0xe8c7ff,
    accentHex: "#6f44a8",
    rhythmLabel: "Chaos Sketch Rush",
  },
  "moon-owl": {
    id: "moon-owl",
    bossName: "Starey Owl",
    phaseTitle: "Midnight Spotlight!",
    signatureLine: "Starlight flickers through the pines! Starey Owl blinks quicker!",
    moodTint: 0x354378,
    waveATint: 0x5a6ca8,
    waveBTint: 0xf4d47c,
    spotlightTint: 0xdce6ff,
    accentHex: "#465896",
    rhythmLabel: "Quick-Blink Gaze",
  },
};

export function bossPhase2Profile(critterId: string): BossPhase2Profile | null {
  return BOSS_PHASE2_PROFILES[critterId] ?? null;
}

export function isMiniBossId(critterId: string): boolean {
  return BOSS_PHASE2_PROFILES[critterId] !== undefined;
}

export function isBossPhase2(
  critter: Critter,
  calm: number,
  phase: BattlePhase,
  talkMode: boolean,
): boolean {
  return (
    isMiniBossId(critter.id) &&
    !talkMode &&
    calm >= Math.ceil(critter.calmMax * 0.5) &&
    calm < critter.calmMax &&
    phase !== "soothed" &&
    phase !== "reward" &&
    phase !== "rest" &&
    phase !== "run"
  );
}

export function bossPhase2View(
  battle: Battle,
  critter: Critter,
  talkMode: boolean,
): BossPhase2View | null {
  if (!isBossPhase2(critter, battle.calm, battle.phase, talkMode)) return null;
  const profile = bossPhase2Profile(critter.id);
  if (profile === null) return null;
  return {
    bossId: profile.id,
    bossName: profile.bossName,
    phaseTitle: profile.phaseTitle,
    signatureLine: profile.signatureLine,
    moodTint: profile.moodTint,
    waveATint: profile.waveATint,
    waveBTint: profile.waveBTint,
    spotlightTint: profile.spotlightTint,
    accentHex: profile.accentHex,
    rhythmLabel: profile.rhythmLabel,
  };
}

/** Optional stronger lean variant for dedicated Phase-2 custom encounters. */
export function upgradeLeanPhase2(spec: LeanSpec): LeanSpec {
  return {
    ...spec,
    starts: [...spec.starts],
    forces: spec.forces.map((force) => Math.min(spec.steer - 1, force + 1)),
  };
}

/**
 * Tightens check rhythm for Phase-2 mini-boss bursts without altering PRNG
 * draw counts or breaking legacy single-foe recorded replays.
 */
export function upgradeBossPhase2Check(spec: CheckSpec, _bossId: string): CheckSpec {
  if (spec.kind === "catch") {
    return {
      ...spec,
      travelTicks: Math.max(28, Math.round(spec.travelTicks * 0.74)),
      arrivals: [...spec.arrivals],
      toys: [...spec.toys],
    };
  }
  if (spec.kind === "chain") {
    return {
      ...spec,
      travelTicks: Math.max(24, Math.round(spec.travelTicks * 0.76)),
      hitWindow: Math.max(5, spec.hitWindow - 2),
      arrivals: [...spec.arrivals],
    };
  }
  if (spec.kind === "trace") {
    return {
      ...spec,
      dryTicks: Math.max(96, Math.round(spec.dryTicks * 0.82)),
      paths: spec.paths.map((item) => ({ ...item, points: [...item.points] })),
    };
  }
  if (spec.kind === "peekaboo") {
    return {
      ...spec,
      warningTicks: Math.max(6, spec.warningTicks - 3),
      graceTicks: Math.max(1, spec.graceTicks - 1),
      peeks: spec.peeks.map((peek) => ({ ...peek })),
    };
  }
  if (spec.kind === "ring") {
    return {
      ...spec,
      greatWindow: Math.max(3, spec.greatWindow - 1),
      goodWindow: Math.max(6, spec.goodWindow - 2),
    };
  }
  if (spec.kind === "echo") {
    return {
      ...spec,
      demoTicks: Math.max(12, spec.demoTicks - 3),
      inputTicks: Math.max(spec.notes * 14, spec.inputTicks - 12),
    };
  }
  if (spec.kind === "whack") {
    return {
      ...spec,
      stayTicks: Math.max(16, Math.round(spec.stayTicks * 0.82)),
    };
  }
  if (spec.kind === "which-one") {
    return {
      ...spec,
      swapTicks: Math.max(12, Math.round(spec.swapTicks * 0.82)),
    };
  }
  if (spec.kind === "lean") {
    return {
      ...spec,
      starts: [...spec.starts],
      forces: [...spec.forces],
    };
  }
  return { ...spec };
}

/** Telegraphed die-cut intent sticker shown over an active foe. */
export function resolveEnemyIntent(
  _world: World,
  battle: Battle,
  critter: Critter,
  foe: BattleFoe,
  foeIndex: number,
  foeCount: number,
): EnemyIntentView | null {
  if (foe.soothed || battle.talkMode === true) return null;
  if (battle.phase !== "command" && battle.phase !== "result" && battle.phase !== "burst") {
    return null;
  }
  const puffingNow = foe.windUp !== null;
  const puffingSoon = critter.windUp !== null && windUpStarts(critter.windUp, battle.turn + 1);
  if (puffingNow || puffingSoon) {
    return {
      kind: "puffing-up",
      label: "Puffing Up",
      frame: "intent-puffing",
      detail: "Pop its bubbles before it lets go!",
    };
  }
  if (foeCount >= 2 && foeIndex > 0 && (battle.turn === 1 || battle.turn % 2 === 0)) {
    return {
      kind: "calling-cheer",
      label: "Calling Cheer",
      frame: "intent-cheer",
      detail: "Cheering on its teammate!",
    };
  }
  const burstKind = battle.signatureBurst?.kind ?? critter.burst.check.kind;
  if (
    burstKind === "trace" ||
    burstKind === "which-one" ||
    burstKind === "whack" ||
    isBossPhase2(critter, foe.calm, battle.phase, false)
  ) {
    return {
      kind: "swirling-scribbles",
      label: "Swirling Scribbles",
      frame: "intent-scribbles",
      detail: "Winding up a wild burst!",
    };
  }
  return {
    kind: "sharing-fizz",
    label: "Sharing Fizz",
    frame: "intent-fizz",
    detail: "Ready to toss a fizzy flurry!",
  };
}
