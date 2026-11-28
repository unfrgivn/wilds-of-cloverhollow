import { gentleCheckSpec } from "./checks";
import { createInkState } from "./ink";
import type {
  Battle,
  CheckSpec,
  Critter,
  State,
  WindUp,
  World,
} from "./types";
import type { TextSpeed } from "./battle-view";

export const ENCORE_MODIFIER_IDS = [
  "brisk-breeze",
  "windup-surge",
  "pure-heart",
] as const;

export type EncoreModifierId = (typeof ENCORE_MODIFIER_IDS)[number];

export type EncoreModifierSpec = {
  id: EncoreModifierId;
  name: string;
  shortLabel: string;
  description: string;
};

export type EncoreBossSpec = {
  critterId: string;
  title: string;
  calmTitle: string;
  region: string;
  blurb: string;
  encoreIntro: string;
  trophyId: string;
  trophyName: string;
  isFinale: boolean;
};

export type EncoreContent = {
  baseCoins: number;
  coinsPerStar: number;
  pureHeartFeelingBonus: number;
  modifiers: EncoreModifierSpec[];
  bosses: EncoreBossSpec[];
};

export type EncoreBossProgress = {
  clears: number;
  bestStars: number;
  modifiersCleared: EncoreModifierId[];
};

export type EncoreRecord = {
  bosses: Record<string, EncoreBossProgress>;
  trophies: string[];
};

export type BattleEncore = {
  bossId: string;
  modifiers: EncoreModifierId[];
  trophyId: string;
  trophyName: string;
  bonusCoins: number;
  talkInk?: string;
  wonTrophy?: boolean;
};

export type EncoreBossView = {
  critterId: string;
  title: string;
  region: string;
  blurb: string;
  trophyId: string;
  trophyName: string;
  stickerFrame: string;
  isFinale: boolean;
  unlocked: boolean;
  clears: number;
  stars: number;
  bestStars: number;
  modifiersCleared: EncoreModifierId[];
  trophyEarned: boolean;
};

export type EncoreSummary = {
  unlocked: boolean;
  finaleUnlocked: boolean;
  unlockedBosses: number;
  totalBosses: number;
  starsEarned: number;
  starsTotal: number;
  trophiesEarned: number;
  trophiesTotal: number;
};

export type EncoreShrineView = EncoreSummary & {
  modifiers: EncoreModifierSpec[];
  bosses: EncoreBossView[];
  baseCoins: number;
  coinsPerStar: number;
};

export function isEncoreModifierId(value: unknown): value is EncoreModifierId {
  return value === "brisk-breeze" || value === "windup-surge" || value === "pure-heart";
}

/** Deduplicates and canonically orders Star Challenge modifiers for deterministic state hashes. */
export function normalizeEncoreModifiers(
  modifiers: readonly EncoreModifierId[],
): EncoreModifierId[] {
  const chosen = new Set<EncoreModifierId>(modifiers);
  return ENCORE_MODIFIER_IDS.filter((id) => chosen.has(id));
}

export function hasEncoreModifier(
  battle: Pick<Battle, "encore"> | null | undefined,
  modifier: EncoreModifierId,
): boolean {
  return battle?.encore?.modifiers.includes(modifier) === true;
}

export function encoreBossById(
  encore: EncoreContent | undefined,
  bossId: string,
): EncoreBossSpec | undefined {
  return encore?.bosses.find((boss) => boss.critterId === bossId);
}

function bossCalmed(
  world: Pick<World, "critters">,
  state: Pick<State, "critters" | "stickers">,
  critterId: string,
): boolean {
  if (state.critters[critterId] === "calm") return true;
  const target = world.critters[critterId];
  if (target === undefined) return false;
  return state.stickers.includes(target.sticker.id);
}

/** Whether the Ancient Tree finale has been calmed (unlocking the full Dream Memory roster). */
export function isEncoreFinaleUnlocked(
  world: Pick<World, "critters" | "storyVariable">,
  state: Pick<State, "critters" | "stickers" | "ink">,
): boolean {
  return (
    world.storyVariable(state.ink, "milo_revealed") === true ||
    bossCalmed(world, state, "hooded-kid")
  );
}

/** Whether a specific boss memory is unlocked for replay at the Dream Memory Shrine. */
export function isEncoreBossUnlocked(
  world: Pick<World, "critters" | "storyVariable">,
  state: Pick<State, "critters" | "stickers" | "ink">,
  boss: Pick<EncoreBossSpec, "critterId" | "isFinale">,
): boolean {
  if (isEncoreFinaleUnlocked(world, state)) return true;
  if (boss.isFinale) return false;
  return bossCalmed(world, state, boss.critterId);
}

/** Whether the Sanctuary Dream Memory Shrine is active (1+ boss calmed or post-finale). */
export function isEncoreShrineUnlocked(
  world: Pick<World, "critters" | "storyVariable" | "encore">,
  state: Pick<State, "critters" | "stickers" | "ink">,
): boolean {
  if (isEncoreFinaleUnlocked(world, state)) return true;
  const bosses = world.encore?.bosses ?? [];
  return bosses.some((boss) => isEncoreBossUnlocked(world, state, boss));
}

export function computeEncoreCoins(
  content: Pick<EncoreContent, "baseCoins" | "coinsPerStar">,
  modifiers: readonly EncoreModifierId[],
): number {
  const normalized = normalizeEncoreModifiers(modifiers);
  return content.baseCoins + content.coinsPerStar * normalized.length;
}

export function encoreFeelingBonus(
  world: Pick<World, "battle" | "encore">,
  battle: Pick<Battle, "encore"> | null | undefined,
): number {
  const extra = hasEncoreModifier(battle, "pure-heart")
    ? (world.encore?.pureHeartFeelingBonus ?? 10)
    : 0;
  return world.battle.feelingBonus + extra;
}

/**
 * Applies Wind-Up Surge to a boss's wind-up schedule: bubbles begin on turn 1
 * and recur more often with up to 3 simultaneous bubbles.
 */
export function encoreWindUpSpec(
  windUp: WindUp | null,
  modifiers: readonly EncoreModifierId[],
): WindUp | null {
  if (windUp === null) return null;
  if (!modifiers.includes("windup-surge")) return windUp;
  return {
    ...windUp,
    start: 1,
    every: Math.max(2, windUp.every - 1),
    bubbles: Math.min(3, windUp.bubbles + 1),
  };
}

function blendInt(base: number, target: number): number {
  return Math.round((base + target) / 2);
}

function briskCheckSpec(spec: CheckSpec): CheckSpec {
  if (spec.kind === "ring") {
    const greatWindow = Math.max(2, Math.round(spec.greatWindow * 0.72));
    const goodWindow = Math.max(greatWindow + 2, Math.round(spec.goodWindow * 0.78));
    return { ...spec, greatWindow, goodWindow };
  }
  if (spec.kind === "charge") {
    const greatWindow = Math.max(2, Math.round(spec.greatWindow * 0.72));
    const goodWindow = Math.max(greatWindow + 2, Math.round(spec.goodWindow * 0.78));
    return { ...spec, greatWindow, goodWindow };
  }
  if (spec.kind === "chain") {
    const hitWindow = Math.max(3, Math.round(spec.hitWindow * 0.75));
    return { ...spec, arrivals: [...spec.arrivals], hitWindow };
  }
  if (spec.kind === "catch") {
    const travelTicks = Math.max(28, Math.round(spec.travelTicks * 0.86));
    const arrivals: number[] = [];
    spec.arrivals.forEach((arrival, index) => {
      if (index === 0) {
        arrivals.push(Math.max(travelTicks, Math.round(arrival * 0.9)));
      } else {
        const previousOriginal = spec.arrivals[index - 1] ?? arrival;
        const previousBrisk = arrivals[index - 1] ?? travelTicks;
        const gap = Math.max(14, Math.round((arrival - previousOriginal) * 0.88));
        arrivals.push(previousBrisk + gap);
      }
    });
    return { ...spec, travelTicks, arrivals, toys: [...spec.toys] };
  }
  if (spec.kind === "lean") {
    return {
      ...spec,
      starts: [...spec.starts],
      puffTicks: Math.max(24, Math.round(spec.puffTicks * 0.88)),
      forces: spec.forces.map((force) => Math.min(5, force + 1)),
    };
  }
  if (spec.kind === "peekaboo") {
    const goal = Math.min(spec.ticks - 10, Math.round(spec.goal * 1.12));
    return {
      ...spec,
      warningTicks: Math.max(8, spec.warningTicks - 3),
      graceTicks: Math.max(2, spec.graceTicks - 1),
      goal: Math.max(spec.goal, goal),
      peeks: spec.peeks.map((peek) => ({ ...peek })),
    };
  }
  if (spec.kind === "echo") {
    return {
      ...spec,
      demoTicks: Math.max(10, spec.demoTicks - 2),
      inputTicks: Math.max(60, spec.inputTicks - 18),
    };
  }
  return {
    ...spec,
    reachRadius: Math.max(68, Math.round(spec.reachRadius * 0.84)),
    dryTicks: Math.max(100, Math.round(spec.dryTicks * 0.85)),
    paths: spec.paths.map((item) => ({ ...item, points: [...item.points] })),
  };
}

/**
 * Resolves the effective battle check spec for Gentle Timing and Brisk Breeze.
 * When Gentle Timing is ON alongside Brisk Breeze, windows stay at least as
 * generous as standard (blended halfway between gentle and base) so Gentle
 * Timing accessibility is always respected.
 */
export function applyEncoreCheckSpec(
  baseSpec: CheckSpec,
  modifiers: readonly EncoreModifierId[],
  gentleTiming: boolean,
): CheckSpec {
  const brisk = modifiers.includes("brisk-breeze");
  if (!brisk) return gentleTiming ? gentleCheckSpec(baseSpec) : baseSpec;
  if (!gentleTiming) return briskCheckSpec(baseSpec);
  const gentle = gentleCheckSpec(baseSpec);
  if (baseSpec.kind === "ring" && gentle.kind === "ring") {
    const greatWindow = Math.max(
      baseSpec.greatWindow,
      blendInt(baseSpec.greatWindow, gentle.greatWindow),
    );
    const goodWindow = Math.max(
      greatWindow,
      baseSpec.goodWindow,
      blendInt(baseSpec.goodWindow, gentle.goodWindow),
    );
    return { ...baseSpec, greatWindow, goodWindow };
  }
  if (baseSpec.kind === "charge" && gentle.kind === "charge") {
    const greatWindow = Math.max(
      baseSpec.greatWindow,
      blendInt(baseSpec.greatWindow, gentle.greatWindow),
    );
    const goodWindow = Math.max(
      greatWindow,
      baseSpec.goodWindow,
      blendInt(baseSpec.goodWindow, gentle.goodWindow),
    );
    return { ...baseSpec, greatWindow, goodWindow };
  }
  if (baseSpec.kind === "chain" && gentle.kind === "chain") {
    return {
      ...baseSpec,
      arrivals: [...baseSpec.arrivals],
      hitWindow: Math.max(baseSpec.hitWindow, blendInt(baseSpec.hitWindow, gentle.hitWindow)),
    };
  }
  if (baseSpec.kind === "catch" && gentle.kind === "catch") {
    const travelTicks = Math.max(
      baseSpec.travelTicks,
      blendInt(baseSpec.travelTicks, gentle.travelTicks),
    );
    const arrivals = baseSpec.arrivals.map((arrival, index) =>
      Math.max(travelTicks, blendInt(arrival, gentle.arrivals[index] ?? arrival)),
    );
    return { ...baseSpec, travelTicks, arrivals, toys: [...baseSpec.toys] };
  }
  if (baseSpec.kind === "lean" && gentle.kind === "lean") {
    return {
      ...baseSpec,
      starts: [...baseSpec.starts],
      forces: [...baseSpec.forces],
      steer: Math.max(baseSpec.steer, blendInt(baseSpec.steer, gentle.steer)),
      spring: baseSpec.spring,
    };
  }
  if (baseSpec.kind === "peekaboo" && gentle.kind === "peekaboo") {
    return {
      ...baseSpec,
      warningTicks: Math.max(
        baseSpec.warningTicks,
        blendInt(baseSpec.warningTicks, gentle.warningTicks),
      ),
      graceTicks: Math.max(
        baseSpec.graceTicks,
        blendInt(baseSpec.graceTicks, gentle.graceTicks),
      ),
      goal: Math.min(baseSpec.goal, blendInt(baseSpec.goal, gentle.goal)),
      peeks: baseSpec.peeks.map((peek) => ({ ...peek })),
    };
  }
  if (baseSpec.kind === "echo" && gentle.kind === "echo") {
    return {
      ...baseSpec,
      demoTicks: Math.max(baseSpec.demoTicks, blendInt(baseSpec.demoTicks, gentle.demoTicks)),
      inputTicks: Math.max(baseSpec.inputTicks, blendInt(baseSpec.inputTicks, gentle.inputTicks)),
    };
  }
  if (baseSpec.kind === "trace" && gentle.kind === "trace") {
    return {
      ...baseSpec,
      reachRadius: Math.max(
        baseSpec.reachRadius,
        blendInt(baseSpec.reachRadius, gentle.reachRadius),
      ),
      brushSpeed: Math.max(
        baseSpec.brushSpeed,
        blendInt(baseSpec.brushSpeed, gentle.brushSpeed),
      ),
      dryTicks: Math.max(baseSpec.dryTicks, blendInt(baseSpec.dryTicks, gentle.dryTicks)),
      paths: baseSpec.paths.map((item) => ({ ...item, points: [...item.points] })),
    };
  }
  return baseSpec;
}

/**
 * Records a completed Encore rematch into the optional `state.encore` ledger,
 * awarding the boss's exclusive Clubhouse Encore Trophy when >= 1 Star Challenge
 * modifier is active.
 */
export function recordEncoreVictory(
  current: EncoreRecord | undefined,
  boss: Pick<EncoreBossSpec, "critterId" | "trophyId">,
  modifiers: readonly EncoreModifierId[],
): EncoreRecord {
  const normalized = normalizeEncoreModifiers(modifiers);
  const existing = current?.bosses[boss.critterId];
  const mergedModifiers = normalizeEncoreModifiers([
    ...(existing?.modifiersCleared ?? []),
    ...normalized,
  ]);
  const updatedBoss: EncoreBossProgress = {
    clears: Math.min(999, (existing?.clears ?? 0) + 1),
    bestStars: Math.max(existing?.bestStars ?? 0, normalized.length),
    modifiersCleared: mergedModifiers,
  };
  const trophySet = new Set<string>(current?.trophies ?? []);
  if (normalized.length > 0) trophySet.add(boss.trophyId);
  const trophies = [...trophySet].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
  return {
    bosses: {
      ...(current?.bosses ?? {}),
      [boss.critterId]: updatedBoss,
    },
    trophies,
  };
}

/** Builds celebratory Encore victory text without duplicating story stickers. */
export function formatEncoreRewardLine(
  encore: BattleEncore,
  trophyNew: boolean,
): string {
  const stars = encore.modifiers.length;
  if (trophyNew) {
    return `Encore Victory! Won ${encore.trophyName} & +${encore.bonusCoins} coins!`;
  }
  if (stars > 0) {
    return `${stars}-Star Encore Clear! +${encore.bonusCoins} coins!`;
  }
  return `Cozy Encore Clear! +${encore.bonusCoins} coins! Toggle a Star Challenge for a trophy!`;
}

/** Updates a battle's sandboxed Encore Talk Ink state without touching `state.ink`. */
export function withEncoreTalkInk(
  battle: Battle,
  ink: string,
): { battle: Battle; preserveStoryInk: boolean } {
  if (battle.encore === undefined) return { battle, preserveStoryInk: false };
  return {
    battle: { ...battle, encore: { ...battle.encore, talkInk: ink } },
    preserveStoryInk: true,
  };
}

/** Builds the Encore reward phase battle state when an Encore boss is soothed. */
export function encoreSoothedBattle(state: State, battle: Battle): Battle | null {
  const encore = battle.encore;
  if (encore === undefined) return null;
  const trophyNew =
    encore.modifiers.length > 0 && !(state.encore?.trophies.includes(encore.trophyId) ?? false);
  const line = formatEncoreRewardLine(encore, trophyNew);
  return {
    ...battle,
    phase: "reward",
    message: line,
    revealed: 0,
    phaseTicks: 0,
    rewardSticker: null,
    encore: { ...encore, wonTrophy: trophyNew },
  };
}

/** Completes an Encore victory non-destructively: bonus coins + Trophy/Star record only. */
export function encoreVictoryState(nextBase: State, state: State, battle: Battle): State | null {
  const encore = battle.encore;
  if (encore === undefined) return null;
  return {
    ...nextBase,
    player: { ...battle.entry },
    coins: Math.min(999, state.coins + encore.bonusCoins),
    encore: recordEncoreVictory(
      state.encore,
      { critterId: encore.bossId, trophyId: encore.trophyId },
      encore.modifiers,
    ),
    battle: null,
  };
}

/** Smooth non-destructive return to Sanctuary Shrine on Encore run or faint. */
export function encoreExitState(nextBase: State, battle: Battle): State | null {
  if (battle.encore === undefined) return null;
  return { ...nextBase, player: { ...battle.entry }, battle: null };
}

/** Projects the full Dream Memory Shrine roster, star counts, and trophy progress. */
export function buildEncoreShrineView(
  world: Pick<World, "critters" | "storyVariable" | "encore">,
  state: Pick<State, "critters" | "stickers" | "ink" | "encore">,
): EncoreShrineView {
  const content = world.encore;
  const finaleUnlocked = isEncoreFinaleUnlocked(world, state);
  const record = state.encore;
  const trophySet = new Set<string>(record?.trophies ?? []);
  const bosses: EncoreBossView[] = (content?.bosses ?? []).map((boss) => {
    const unlocked = isEncoreBossUnlocked(world, state, boss);
    const progress = record?.bosses[boss.critterId];
    const critter: Critter | undefined = world.critters[boss.critterId];
    const modifiersCleared = progress === undefined
      ? []
      : normalizeEncoreModifiers(progress.modifiersCleared);
    return {
      critterId: boss.critterId,
      title: unlocked ? boss.title : boss.isFinale ? "Ancient Tree Finale" : "Locked Memory",
      region: boss.region,
      blurb: unlocked
        ? boss.blurb
        : boss.isFinale
          ? "Calm the mystery beneath the Enchanted Forest's Ancient Tree to unlock."
          : `Calm this fizzy troublemaker in ${boss.region} to unlock their dream memory.`,
      trophyId: boss.trophyId,
      trophyName: boss.trophyName,
      stickerFrame: critter?.sticker.frame ?? "calm_idle_01",
      isFinale: boss.isFinale,
      unlocked,
      clears: progress?.clears ?? 0,
      stars: modifiersCleared.length,
      bestStars: progress?.bestStars ?? 0,
      modifiersCleared,
      trophyEarned: trophySet.has(boss.trophyId),
    };
  });
  const unlockedBosses = bosses.filter((item) => item.unlocked).length;
  const starsEarned = bosses.reduce((sum, item) => sum + item.stars, 0);
  const trophiesEarned = bosses.filter((item) => item.trophyEarned).length;
  return {
    unlocked: finaleUnlocked || unlockedBosses > 0,
    finaleUnlocked,
    unlockedBosses,
    totalBosses: bosses.length,
    starsEarned,
    starsTotal: bosses.length * ENCORE_MODIFIER_IDS.length,
    trophiesEarned,
    trophiesTotal: bosses.length,
    modifiers: content?.modifiers ?? [],
    bosses,
    baseCoins: content?.baseCoins ?? 15,
    coinsPerStar: content?.coinsPerStar ?? 10,
  };
}

/** Compact summary for badges, Shrine header, and optional Journal integration. */
export function encoreSummary(
  world: Pick<World, "critters" | "storyVariable" | "encore">,
  state: Pick<State, "critters" | "stickers" | "ink" | "encore">,
): EncoreSummary {
  const full = buildEncoreShrineView(world, state);
  return {
    unlocked: full.unlocked,
    finaleUnlocked: full.finaleUnlocked,
    unlockedBosses: full.unlockedBosses,
    totalBosses: full.totalBosses,
    starsEarned: full.starsEarned,
    starsTotal: full.starsTotal,
    trophiesEarned: full.trophiesEarned,
    trophiesTotal: full.trophiesTotal,
  };
}

/**
 * Launches a non-destructive Dream Memory Shrine boss rematch from any calm
 * overworld state. Never mutates story flags, set pieces, wild critters, or calms.
 */
export function startEncoreBattle(
  world: World,
  state: State,
  bossId: string,
  modifiers: readonly EncoreModifierId[] = [],
  textSpeed?: TextSpeed,
): State {
  if (
    state.battle !== null ||
    state.arcade !== null ||
    state.dialogue !== null ||
    state.transition !== null ||
    state.finale !== null ||
    state.cutscene !== undefined
  ) {
    return state;
  }
  const encoreContent = world.encore;
  if (encoreContent === undefined) return state;
  const boss = encoreBossById(encoreContent, bossId);
  if (boss === undefined || !isEncoreBossUnlocked(world, state, boss)) return state;
  const critter = world.critters[boss.critterId];
  if (critter === undefined) return state;
  const normalized = normalizeEncoreModifiers(modifiers);
  const bonusCoins = computeEncoreCoins(encoreContent, normalized);
  const message = boss.encoreIntro;
  const talkInk = critter.talk !== null
    ? createInkState(world.story, state.rng === 0 ? 1 : state.rng)
    : undefined;
  const encore: BattleEncore = {
    bossId: boss.critterId,
    modifiers: normalized,
    trophyId: boss.trophyId,
    trophyName: boss.trophyName,
    bonusCoins,
    ...(talkInk === undefined ? {} : { talkInk }),
  };
  const battle: Battle = {
    critterId: critter.id,
    den: null,
    entry: { ...state.player },
    phase: "intro",
    message,
    revealed: textSpeed === "instant" ? message.length : 0,
    selected: 0,
    command: null,
    energy: critter.energyMax,
    calm: 0,
    rest: {},
    check: null,
    lastGrade: null,
    feelings: [],
    answered: false,
    lanternPeek: false,
    turn: 1,
    actorIndex: 0,
    windUp: null,
    talkMode: false,
    talk: null,
    talkTurns: 0,
    rewardSticker: null,
    phaseTicks: 0,
    encore,
  };
  return {
    ...state,
    journalOpen: false,
    motion: { ...state.motion, moving: false },
    battle,
  };
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Validates optional `state.encore` in `parseSave` without bumping save version 10. */
export function validEncoreRecord(value: unknown): boolean {
  if (value === undefined) return true;
  if (!isPlainRecord(value)) return false;
  const { bosses, trophies } = value;
  if (!isPlainRecord(bosses) || !Array.isArray(trophies)) {
    return false;
  }
  const trophiesValid = trophies.every(
    (id) => typeof id === "string" && /^[a-z][a-z0-9-]*$/.test(id),
  );
  if (!trophiesValid) return false;
  return Object.entries(bosses).every(([bossId, entry]) => {
    if (!/^[a-z][a-z0-9-]*$/.test(bossId)) return false;
    if (!isPlainRecord(entry)) return false;
    const { clears, bestStars, modifiersCleared } = entry;
    return (
      typeof clears === "number" &&
      Number.isInteger(clears) &&
      clears >= 0 &&
      clears <= 999 &&
      typeof bestStars === "number" &&
      Number.isInteger(bestStars) &&
      bestStars >= 0 &&
      bestStars <= ENCORE_MODIFIER_IDS.length &&
      Array.isArray(modifiersCleared) &&
      modifiersCleared.every((mod) => isEncoreModifierId(mod))
    );
  });
}
