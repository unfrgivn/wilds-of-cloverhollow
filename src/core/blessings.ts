import { journalKeepsakes, type KeepsakeId } from "./journal";
import type { CheckSpec, State, Tunables, World } from "./types";

export type KeepsakeBlessingCategory = "battle" | "explore" | "arcade" | "craft";

export type KeepsakeBlessingSpec = {
  id: KeepsakeId;
  title: string;
  category: KeepsakeBlessingCategory;
  accent: string;
  summary: string;
  effectNote: string;
};

export type KeepsakeBlessingEntry = KeepsakeBlessingSpec & {
  active: boolean;
};

export type DreamBlessingBonuses = {
  calmSparkleBonus: number;
  fishBiteGrace: number;
  peekabooStealthGrace: number;
  tacoTipCoins: number;
  arcadeTicketBonus: number;
  gardenGrowthBoost: number;
};

export type ActiveBlessingEffects = {
  echoDemoBonusTicks: number;
  echoInputBonusTicks: number;
  arcadeTicketBonus: number;
  calmSparkleBonus: number;
  peekabooStealthGrace: number;
  tacoTipCoins: number;
  snackHealBonus: number;
  fishBiteGrace: number;
  leanStabilityBonus: number;
  overworldSpeedBonus: number;
  traceReachBonus: number;
  glowVisibilityBonus: number;
  roamNoticeGrace: number;
  harmonyTimingBonus: number;
  fluteAssistCalmBonus: number;
  gardenGrowthBoost: number;
  jubileeCoinBonus: number;
};

export type KeepsakeBlessingSummary = {
  active: number;
  total: number;
  complete: boolean;
  blessings: KeepsakeBlessingEntry[];
  bonuses: DreamBlessingBonuses;
};

/** All thirteen Keepsake IDs in canonical Journal display order. */
export const KEEPSAKE_BLESSING_IDS: readonly KeepsakeId[] = [
  "star-crystal",
  "star-pin",
  "star-geode",
  "moon-feather",
  "taco-badge",
  "clover-wreath",
  "sea-compass",
  "alpine-clover",
  "star-whistle",
  "loft-sketch",
  "aurora-rubbing",
  "shell-shard",
  "festival-ribbon",
] as const;

const KEEPSAKE_ID_SET: ReadonlySet<string> = new Set<string>(KEEPSAKE_BLESSING_IDS);

/** Type guard narrowing a raw string identifier to a canonical KeepsakeId. */
export function isKeepsakeId(id: string): id is KeepsakeId {
  return KEEPSAKE_ID_SET.has(id);
}

/** Exhaustive catalog of Dream Blessings for all thirteen Clubhouse Keepsakes. */
export const KEEPSAKE_BLESSINGS: Readonly<Record<KeepsakeId, KeepsakeBlessingSpec>> = {
  "star-crystal": {
    id: "star-crystal",
    title: "Chime Resonance",
    category: "battle",
    accent: "#94c8f2",
    summary: "Crystal chimes echo clearer during musical battles.",
    effectNote: "Echo notes ring brighter",
  },
  "star-pin": {
    id: "star-pin",
    title: "Lucky Star Arcade",
    category: "arcade",
    accent: "#f2a25c",
    summary: "Arcade counters sparkle with extra lucky cheer.",
    effectNote: "+2 bonus arcade tickets",
  },
  "star-geode": {
    id: "star-geode",
    title: "Prismatic Calm",
    category: "battle",
    accent: "#c894ee",
    summary: "Star Gem light deepens Fae's calming warmth.",
    effectNote: "+5% battle calm sparkle",
  },
  "moon-feather": {
    id: "moon-feather",
    title: "Quiet Footsteps",
    category: "battle",
    accent: "#9ea8e8",
    summary: "Owl-feather hush steadies sneaky Peekaboo steps.",
    effectNote: "+15% Peekaboo grace",
  },
  "taco-badge": {
    id: "taco-badge",
    title: "Fiesta Whisk",
    category: "arcade",
    accent: "#e88472",
    summary: "Kitchen shifts feel brisk, sunny, and fragrant.",
    effectNote: "+1 coin per Taco order",
  },
  "clover-wreath": {
    id: "clover-wreath",
    title: "Meadow Vitality",
    category: "explore",
    accent: "#72c77d",
    summary: "Calmed valley friends lend extra resting warmth.",
    effectNote: "Cozy meadow vitality",
  },
  "sea-compass": {
    id: "sea-compass",
    title: "Tide Reader",
    category: "arcade",
    accent: "#5fc9d8",
    summary: "Bubblegum Bay's currents glint when rare fish swim near.",
    effectNote: "+15% fish bite window",
  },
  "alpine-clover": {
    id: "alpine-clover",
    title: "Pinecone Footing",
    category: "battle",
    accent: "#74bf96",
    summary: "Four-leaf mountain luck steadies windy ridge walks.",
    effectNote: "Steadier mountain balance",
  },
  "star-whistle": {
    id: "star-whistle",
    title: "Golden Pass",
    category: "explore",
    accent: "#eab949",
    summary: "Buster's brass whistle charms every Star-Line stop.",
    effectNote: "Free Star-Line Bus charm",
  },
  "loft-sketch": {
    id: "loft-sketch",
    title: "Steady Watercolor",
    category: "craft",
    accent: "#f09bb4",
    summary: "Milo's lines and Rosie's palette steady every stroke.",
    effectNote: "Smoother brush trace",
  },
  "aurora-rubbing": {
    id: "aurora-rubbing",
    title: "Summit Starlight",
    category: "explore",
    accent: "#87b8f0",
    summary: "Northern lights shimmer softly over snowy vistas.",
    effectNote: "Starry alpine shimmer",
  },
  "shell-shard": {
    id: "shell-shard",
    title: "Coastal Harmony",
    category: "craft",
    accent: "#6fd6c4",
    summary: "Tide-pool shells hum in tune with the sea breeze.",
    effectNote: "Clearer harmonic echoes",
  },
  "festival-ribbon": {
    id: "festival-ribbon",
    title: "Sunny Jubilee",
    category: "craft",
    accent: "#f2c44d",
    summary: "Cloverhollow's celebration glows wherever Fae travels.",
    effectNote: "+1 clubhouse garden bloom",
  },
};

/** Returns the canonical Dream Blessing specification for a Clubhouse Keepsake. */
export function keepsakeBlessingFor(id: KeepsakeId): KeepsakeBlessingSpec {
  return KEEPSAKE_BLESSINGS[id];
}

/** Projects deterministic numeric Dream Blessing modifiers from owned keepsake IDs. */
export function dreamBlessingBonuses(ownedIds: readonly KeepsakeId[]): DreamBlessingBonuses {
  const owned = new Set<KeepsakeId>(ownedIds);
  return {
    calmSparkleBonus: owned.has("star-geode") ? 0.05 : 0,
    fishBiteGrace: owned.has("sea-compass") ? 0.15 : 0,
    peekabooStealthGrace: owned.has("moon-feather") ? 0.15 : 0,
    tacoTipCoins: owned.has("taco-badge") ? 1 : 0,
    arcadeTicketBonus: owned.has("star-pin") ? 2 : 0,
    gardenGrowthBoost: owned.has("festival-ribbon") ? 1 : 0,
  };
}

/** Evaluates all thirteen Dream Blessings and projected bonuses from owned keepsake IDs. */
export function evaluateKeepsakeBlessingsFromIds(
  ownedIds: readonly KeepsakeId[],
): KeepsakeBlessingSummary {
  const owned = new Set<KeepsakeId>(ownedIds);
  const blessings: KeepsakeBlessingEntry[] = KEEPSAKE_BLESSING_IDS.map((id) => ({
    ...KEEPSAKE_BLESSINGS[id],
    active: owned.has(id),
  }));
  const active = blessings.filter((entry) => entry.active).length;
  const total = blessings.length;
  return {
    active,
    total,
    complete: active === total,
    blessings,
    bonuses: dreamBlessingBonuses(ownedIds),
  };
}

/** Evaluates all thirteen Dream Blessings and projected bonuses from core world & state. */
export function evaluateKeepsakeBlessings(
  world: Pick<World, "storyVariable">,
  state: Pick<State, "ink" | "stickers">,
): KeepsakeBlessingSummary {
  const ownedIds = journalKeepsakes(world, state)
    .filter((item) => item.owned)
    .map((item) => item.id);
  return evaluateKeepsakeBlessingsFromIds(ownedIds);
}

/** Projects all thirteen active gameplay blessing effects from owned keepsake IDs. */
export function blessingEffectsFromIds(
  ownedIds: readonly KeepsakeId[],
): ActiveBlessingEffects {
  const owned = new Set<KeepsakeId>(ownedIds);
  const glowVisibilityBonus =
    (owned.has("aurora-rubbing") ? 0.25 : 0) + (owned.has("sea-compass") ? 0.15 : 0);
  return {
    echoDemoBonusTicks: owned.has("star-crystal") ? 4 : 0,
    echoInputBonusTicks: owned.has("star-crystal") ? 24 : 0,
    arcadeTicketBonus: owned.has("star-pin") ? 2 : 0,
    calmSparkleBonus: owned.has("star-geode") ? 0.05 : 0,
    peekabooStealthGrace: owned.has("moon-feather") ? 0.15 : 0,
    tacoTipCoins: owned.has("taco-badge") ? 1 : 0,
    snackHealBonus: owned.has("clover-wreath") ? 1 : 0,
    fishBiteGrace: owned.has("sea-compass") ? 0.15 : 0,
    leanStabilityBonus: owned.has("alpine-clover") ? 1 : 0,
    overworldSpeedBonus: owned.has("star-whistle") ? 0.08 : 0,
    traceReachBonus: owned.has("loft-sketch") ? 0.15 : 0,
    glowVisibilityBonus,
    roamNoticeGrace: owned.has("aurora-rubbing") ? 0.15 : 0,
    harmonyTimingBonus: owned.has("shell-shard") ? 1 : 0,
    fluteAssistCalmBonus: owned.has("shell-shard") ? 4 : 0,
    gardenGrowthBoost: owned.has("festival-ribbon") ? 1 : 0,
    jubileeCoinBonus: owned.has("festival-ribbon") ? 1 : 0,
  };
}

/** Evaluates all thirteen active gameplay blessing effects from core world & state. */
export function activeBlessingEffects(
  world: Pick<World, "storyVariable">,
  state: Pick<State, "ink" | "stickers">,
): ActiveBlessingEffects {
  const ownedIds = journalKeepsakes(world, state)
    .filter((item) => item.owned)
    .map((item) => item.id);
  return blessingEffectsFromIds(ownedIds);
}

/** Applies active keepsake blessings to a battle check spec, returning it unchanged when 0. */
export function applyBlessingCheckSpec(
  spec: CheckSpec,
  effects: ActiveBlessingEffects,
): CheckSpec {
  if (spec.kind === "echo") {
    if (effects.echoDemoBonusTicks <= 0 && effects.echoInputBonusTicks <= 0) return spec;
    return {
      ...spec,
      demoTicks: spec.demoTicks + effects.echoDemoBonusTicks,
      inputTicks: spec.inputTicks + effects.echoInputBonusTicks,
    };
  }
  if (spec.kind === "peekaboo") {
    if (effects.peekabooStealthGrace <= 0) return spec;
    const warnDelta = Math.max(2, Math.round(spec.warningTicks * effects.peekabooStealthGrace));
    const graceDelta = Math.max(1, Math.round(spec.graceTicks * effects.peekabooStealthGrace));
    return {
      ...spec,
      warningTicks: Math.min(28, spec.warningTicks + warnDelta),
      graceTicks: Math.min(10, spec.graceTicks + graceDelta),
      peeks: spec.peeks.map((peek) => ({ ...peek })),
    };
  }
  if (spec.kind === "lean") {
    if (effects.leanStabilityBonus <= 0) return spec;
    return {
      ...spec,
      starts: [...spec.starts],
      forces: [...spec.forces],
      steer: spec.steer + effects.leanStabilityBonus,
      spring: spec.spring + effects.leanStabilityBonus,
    };
  }
  if (spec.kind === "trace") {
    if (effects.traceReachBonus <= 0) return spec;
    return {
      ...spec,
      reachRadius: Math.round(spec.reachRadius * (1 + effects.traceReachBonus)),
      dryTicks: Math.round(spec.dryTicks * (1 + effects.traceReachBonus * 0.67)),
      paths: spec.paths.map((item) => ({ ...item, points: [...item.points] })),
    };
  }
  if (spec.kind === "ring") {
    if (effects.harmonyTimingBonus <= 0) return spec;
    const maxWin = Math.max(
      1,
      Math.min(spec.targetTick - 1, spec.ticks - 1 - spec.targetTick),
    );
    const greatWindow = Math.min(maxWin, spec.greatWindow + effects.harmonyTimingBonus);
    const goodWindow = Math.min(
      maxWin,
      Math.max(greatWindow, spec.goodWindow + effects.harmonyTimingBonus),
    );
    return { ...spec, greatWindow, goodWindow };
  }
  if (spec.kind === "charge") {
    if (effects.harmonyTimingBonus <= 0) return spec;
    const maxWin = Math.max(
      1,
      Math.min(spec.targetTick - 1, spec.maxTicks - 1 - spec.targetTick),
    );
    const greatWindow = Math.min(maxWin, spec.greatWindow + effects.harmonyTimingBonus);
    const goodWindow = Math.min(
      maxWin,
      Math.max(greatWindow, spec.goodWindow + effects.harmonyTimingBonus),
    );
    return { ...spec, greatWindow, goodWindow };
  }
  if (spec.kind === "chain") {
    if (effects.harmonyTimingBonus <= 0) return spec;
    let minGap = Infinity;
    for (let index = 1; index < spec.arrivals.length; index += 1) {
      const previous = spec.arrivals[index - 1];
      const current = spec.arrivals[index];
      if (previous !== undefined && current !== undefined) {
        minGap = Math.min(minGap, current - previous);
      }
    }
    const maxHit =
      minGap === Infinity
        ? spec.hitWindow * 2
        : Math.max(spec.hitWindow, Math.floor((minGap - 2) / 2));
    const hitWindow = Math.min(maxHit, spec.hitWindow + effects.harmonyTimingBonus);
    return { ...spec, arrivals: [...spec.arrivals], hitWindow };
  }
  return spec;
}

/** Applies Prismatic Calm (+5% calm sparkle, minimum +1) to a landed calm gain. */
export function applyCalmSparkleBonus(baseCalm: number, bonus: number): number {
  if (bonus <= 0 || baseCalm <= 0) return baseCalm;
  return baseCalm + Math.max(1, Math.round(baseCalm * bonus));
}

/** Computes the Bubblegum Bay fish bite window with Gentle Timing and Sea-Glass Compass grace. */
export function fishBiteTicksWithBlessing(
  baseTicks: number,
  gentleBonus: number,
  gentleTiming: boolean,
  fishBiteGrace: number,
): number {
  const base = gentleTiming ? baseTicks + gentleBonus : baseTicks;
  if (fishBiteGrace <= 0) return base;
  return base + Math.max(1, Math.round(baseTicks * fishBiteGrace));
}

/** Computes effective overworld walk speed with Buster's Golden Pass speed charm. */
export function effectiveWalkSpeed(baseWalkSpeed: number, overworldSpeedBonus: number): number {
  if (overworldSpeedBonus <= 0) return baseWalkSpeed;
  return baseWalkSpeed * (1 + overworldSpeedBonus);
}

/** Returns roam tunables adjusted by Summit Starlight's wild notice grace when owned. */
export function effectiveRoamTunables(
  world: Pick<World, "tunables" | "storyVariable">,
  state: Pick<State, "ink" | "stickers">,
): Tunables["roam"] {
  const roam = world.tunables.roam;
  const grace = activeBlessingEffects(world, state).roamNoticeGrace;
  if (grace <= 0) return roam;
  return {
    ...roam,
    noticeTicks: Math.round(roam.noticeTicks * (1 + grace)),
  };
}
