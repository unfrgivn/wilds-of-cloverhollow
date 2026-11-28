import { journalKeepsakes, type KeepsakeId } from "./journal";
import type { State, World } from "./types";

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
