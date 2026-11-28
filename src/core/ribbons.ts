import {
  journalKeepsakes,
  journalProgress,
  valleyCompletion,
  type KeepsakeId,
} from "./journal";
import type { State, World } from "./types";

export const MERIT_RIBBON_IDS = [
  "first-friend",
  "party-reunited",
  "star-line-explorer",
  "gem-scholar",
  "master-angler",
  "arcade-champion",
  "taco-fiesta",
  "sanctuary-guardian",
  "neighborhood-hearts",
  "alpine-stargazer",
  "starlight-keeper",
  "valley-legend",
] as const;

export type MeritRibbonId = (typeof MERIT_RIBBON_IDS)[number];

export type MeritRibbonCategory = "story" | "explore" | "arcade" | "mastery";

export type MeritRibbonEntry = {
  id: MeritRibbonId;
  title: string;
  category: MeritRibbonCategory;
  color: string;
  description: string;
  progressText: string;
  earned: boolean;
};

export type MeritRibbonSummary = {
  earned: number;
  total: number;
  complete: boolean;
  ribbons: MeritRibbonEntry[];
};

export type MeritRibbonJournalInput = {
  stickersOwned?: number;
  stickersTotal?: number;
  stickers?: readonly { owned: boolean }[];
  prizesOwned?: number;
  prizesTotal?: number;
  prizes?: readonly { owned: boolean }[];
  fish?: readonly { owned: boolean }[];
  keepsakes?: readonly { id: string; owned: boolean }[];
  gems?: { found: number; total: number };
  starGems?: readonly { found: boolean }[];
  valleyComplete?: boolean;
  members?: readonly { id: string }[];
  arcadeRecords?: { taco?: number };
};

type MeritRibbonFacts = {
  stickersOwned: number;
  hasSue: boolean;
  hasJordan: boolean;
  gemsFound: number;
  gemsTotal: number;
  fishCaught: number;
  fishTotal: number;
  prizesOwned: number;
  prizesTotal: number;
  tacoScore: number;
  ownedKeepsakes: ReadonlySet<string>;
  valleyComplete: boolean;
  collectiblesOwned: number;
  collectiblesTotal: number;
};

type MeritRibbonSpec = {
  id: MeritRibbonId;
  title: string;
  category: MeritRibbonCategory;
  color: string;
  description: string;
  evaluate: (facts: MeritRibbonFacts) => { earned: boolean; progressText: string };
};

const EARNED_TEXT = "★ Earned";

function binaryProgress(earned: boolean): { earned: boolean; progressText: string } {
  return { earned, progressText: earned ? EARNED_TEXT : "0/1" };
}

function countProgress(
  owned: number,
  target: number,
  earnedOverride?: boolean,
): { earned: boolean; progressText: string } {
  const earned = earnedOverride ?? (target > 0 && owned >= target);
  if (earned) return { earned: true, progressText: EARNED_TEXT };
  const clamped = Math.max(0, Math.min(owned, target));
  return { earned: false, progressText: `${clamped}/${target}` };
}

function keepsakeProgress(
  facts: MeritRibbonFacts,
  id: KeepsakeId,
): { earned: boolean; progressText: string } {
  return binaryProgress(facts.ownedKeepsakes.has(id));
}

const MERIT_RIBBON_SPECS: readonly MeritRibbonSpec[] = [
  {
    id: "first-friend",
    title: "First Friend",
    category: "story",
    color: "#f09bb4",
    description: "Calm your first fizzy critter and earn a sticker.",
    evaluate: (facts) => binaryProgress(facts.stickersOwned >= 1),
  },
  {
    id: "party-reunited",
    title: "Best Friends Forever",
    category: "story",
    color: "#7ec8f2",
    description: "Reunite Fae, Maddie, Sue, and Jordan in one party.",
    evaluate: (facts) =>
      countProgress((facts.hasSue ? 1 : 0) + (facts.hasJordan ? 1 : 0), 2),
  },
  {
    id: "star-line-explorer",
    title: "Star-Line Explorer",
    category: "explore",
    color: "#f2c44d",
    description: "Fill Buster's Stamp Card and earn the Golden Whistle.",
    evaluate: (facts) => keepsakeProgress(facts, "star-whistle"),
  },
  {
    id: "gem-scholar",
    title: "Star Gem Scholar",
    category: "explore",
    color: "#b580e8",
    description: "Discover all 7 Valley Star Gems for Grandpa Barnaby.",
    evaluate: (facts) =>
      countProgress(facts.gemsFound, Math.max(7, facts.gemsTotal), facts.gemsFound >= 7),
  },
  {
    id: "master-angler",
    title: "Bay Master Angler",
    category: "arcade",
    color: "#5fc9d8",
    description: "Reel in all 6 species in Sue's Catch Book.",
    evaluate: (facts) =>
      countProgress(facts.fishCaught, Math.max(6, facts.fishTotal), facts.fishCaught >= 6),
  },
  {
    id: "arcade-champion",
    title: "Arcade Star Champion",
    category: "arcade",
    color: "#f2a25c",
    description: "Collect all 13 Cloverhollow Arcade prizes.",
    evaluate: (facts) => {
      const target = facts.prizesTotal > 0 ? facts.prizesTotal : 13;
      const earned = facts.prizesTotal > 0 && facts.prizesOwned >= facts.prizesTotal;
      return countProgress(facts.prizesOwned, target, earned);
    },
  },
  {
    id: "taco-fiesta",
    title: "Fiesta Taco Chef",
    category: "arcade",
    color: "#e87d6b",
    description: "Serve a lunch-rush shift at Chef Mateo's Taco Truck.",
    evaluate: (facts) => binaryProgress(facts.tacoScore > 0),
  },
  {
    id: "sanctuary-guardian",
    title: "Sanctuary Guardian",
    category: "explore",
    color: "#72c77d",
    description: "Earn Ranger Fern's woven Sanctuary Clover Wreath.",
    evaluate: (facts) => keepsakeProgress(facts, "clover-wreath"),
  },
  {
    id: "neighborhood-hearts",
    title: "Neighborhood Friends",
    category: "story",
    color: "#e997c9",
    description: "Visit both Milo's Sketch Loft and Rosie's Flower Cottage.",
    evaluate: (facts) => keepsakeProgress(facts, "loft-sketch"),
  },
  {
    id: "alpine-stargazer",
    title: "Alpine Stargazer",
    category: "explore",
    color: "#87b8f0",
    description: "Ride the Ski Lift and read Alpine Summit's aurora legend.",
    evaluate: (facts) => keepsakeProgress(facts, "aurora-rubbing"),
  },
  {
    id: "starlight-keeper",
    title: "Starlight Chime Keeper",
    category: "explore",
    color: "#6fd6c4",
    description: "Solve Starlight Island's four-note seashell chime puzzle.",
    evaluate: (facts) => keepsakeProgress(facts, "shell-shard"),
  },
  {
    id: "valley-legend",
    title: "100% Valley Legend",
    category: "mastery",
    color: "#eab949",
    description: "Complete every sticker, prize, fish, gem, and keepsake.",
    evaluate: (facts) => {
      if (facts.valleyComplete) return { earned: true, progressText: EARNED_TEXT };
      if (facts.collectiblesTotal > 0) {
        return countProgress(facts.collectiblesOwned, facts.collectiblesTotal, false);
      }
      return { earned: false, progressText: "0/63" };
    },
  },
];

function buildMeritRibbonSummary(facts: MeritRibbonFacts): MeritRibbonSummary {
  const ribbons: MeritRibbonEntry[] = MERIT_RIBBON_SPECS.map((spec) => {
    const result = spec.evaluate(facts);
    return {
      id: spec.id,
      title: spec.title,
      category: spec.category,
      color: spec.color,
      description: spec.description,
      progressText: result.progressText,
      earned: result.earned,
    };
  });
  const earned = ribbons.filter((item) => item.earned).length;
  const total = ribbons.length;
  return {
    earned,
    total,
    complete: earned === total,
    ribbons,
  };
}

/** Evaluates all 12 canonical Valley Merit Ribbons from core world, state, and arcade records. */
export function evaluateMeritRibbons(
  world: Pick<World, "stickers" | "arcade" | "storyVariable">,
  state: Pick<State, "stickers" | "prizes" | "caughtFish" | "ink" | "party">,
  records?: { taco?: number },
): MeritRibbonSummary {
  const progress = journalProgress(world, state);
  const completion = valleyCompletion(progress);
  const keepsakes = journalKeepsakes(world, state);
  const ownedKeepsakes = new Set<string>(
    keepsakes.filter((item) => item.owned).map((item) => item.id),
  );
  const partyIds = new Set(state.party.map((member) => member.id));
  return buildMeritRibbonSummary({
    stickersOwned: progress.stickers.owned,
    hasSue: partyIds.has("sue"),
    hasJordan: partyIds.has("jordan"),
    gemsFound: progress.gems.owned,
    gemsTotal: progress.gems.total,
    fishCaught: progress.fish.owned,
    fishTotal: progress.fish.total,
    prizesOwned: progress.prizes.owned,
    prizesTotal: progress.prizes.total,
    tacoScore: records?.taco ?? 0,
    ownedKeepsakes,
    valleyComplete: completion.complete,
    collectiblesOwned: completion.owned,
    collectiblesTotal: completion.total,
  });
}

/** Projects all 12 Valley Merit Ribbons directly from a rendered JournalView snapshot. */
export function evaluateMeritRibbonsFromJournal(
  input: MeritRibbonJournalInput,
): MeritRibbonSummary {
  const stickersOwned =
    input.stickers !== undefined && input.stickers.length > 0
      ? input.stickers.filter((item) => item.owned).length
      : (input.stickersOwned ?? 0);
  const stickersTotal =
    input.stickersTotal ?? (input.stickers !== undefined ? input.stickers.length : 0);
  const prizesOwned =
    input.prizes !== undefined && input.prizes.length > 0
      ? input.prizes.filter((item) => item.owned).length
      : (input.prizesOwned ?? 0);
  const prizesTotal =
    input.prizesTotal ?? (input.prizes !== undefined ? input.prizes.length : 0);
  const fishCaught = input.fish?.filter((item) => item.owned).length ?? 0;
  const fishTotal = input.fish !== undefined && input.fish.length > 0 ? input.fish.length : 6;
  const ownedKeepsakes = new Set<string>(
    (input.keepsakes ?? []).filter((item) => item.owned).map((item) => item.id),
  );
  const keepsakesTotal = input.keepsakes?.length ?? 0;
  const gemsFound =
    input.gems?.found ??
    (input.starGems !== undefined ? input.starGems.filter((item) => item.found).length : 0);
  const gemsTotal =
    input.gems?.total ??
    (input.starGems !== undefined && input.starGems.length > 0 ? input.starGems.length : 7);
  const memberIds = new Set((input.members ?? []).map((member) => member.id));
  const hasTotals = stickersTotal > 0 && prizesTotal > 0 && keepsakesTotal > 0;
  const collectiblesOwned =
    stickersOwned + prizesOwned + fishCaught + ownedKeepsakes.size + gemsFound;
  const collectiblesTotal = hasTotals
    ? stickersTotal + prizesTotal + fishTotal + keepsakesTotal + gemsTotal
    : 0;
  const valleyComplete =
    input.valleyComplete === true ||
    (input.valleyComplete === undefined &&
      collectiblesTotal > 0 &&
      collectiblesOwned >= collectiblesTotal);

  return buildMeritRibbonSummary({
    stickersOwned,
    hasSue: memberIds.has("sue"),
    hasJordan: memberIds.has("jordan"),
    gemsFound,
    gemsTotal,
    fishCaught,
    fishTotal,
    prizesOwned,
    prizesTotal,
    tacoScore: input.arcadeRecords?.taco ?? 0,
    ownedKeepsakes,
    valleyComplete,
    collectiblesOwned,
    collectiblesTotal,
  });
}
