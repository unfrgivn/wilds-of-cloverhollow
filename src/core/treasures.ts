import type { State, World } from "./types";

export type StampCardSummary = {
  started: boolean;
  bay: boolean;
  pass: boolean;
  complete: boolean;
};

export type KeepsakeEntry = {
  id: string;
  name: string;
  source: string;
  note: string;
  unlocked: boolean;
};

export type FishCatchEntry = {
  id: string;
  name: string;
  rare: boolean;
  caught: boolean;
};

export type TreasuresSummary = {
  stamps: StampCardSummary;
  keepsakes: readonly KeepsakeEntry[];
  unlockedKeepsakes: number;
  totalKeepsakes: number;
  catches: readonly FishCatchEntry[];
  caughtFish: number;
  totalFish: number;
  hasAny: boolean;
};

type KeepsakeSpec = {
  id: string;
  name: string;
  source: string;
  note: string;
  unlocked: (
    world: Pick<World, "storyVariable">,
    state: Pick<State, "ink" | "stickers">,
  ) => boolean;
};

const KEEPSAKE_SPECS: readonly KeepsakeSpec[] = [
  {
    id: "star-crystal",
    name: "Shimmering Star Crystal",
    source: "Crystal Cavern",
    note: "Star chime",
    unlocked: (world, state) => world.storyVariable(state.ink, "cavern_chime_rung") === true,
  },
  {
    id: "star-pin",
    name: "Bon Appetit Star Pin",
    source: "Bon Appetit Café",
    note: "Chef Bea",
    unlocked: (world, state) => world.storyVariable(state.ink, "spice_returned") === true,
  },
  {
    id: "star-geode",
    name: "Rainbow Star Geode",
    source: "Grandpa Barnaby",
    note: "7 Star Gems",
    unlocked: (world, state) => world.storyVariable(state.ink, "gem_reward_all") === true,
  },
  {
    id: "moon-feather",
    name: "Starry Moon Feather",
    source: "Clover Hills",
    note: "Starry Owl",
    unlocked: (_world, state) => state.stickers.includes("starry-owl"),
  },
  {
    id: "taco-badge",
    name: "Golden Taco Badge",
    source: "Cloverhollow",
    note: "Chef Mateo",
    unlocked: (_world, state) => state.stickers.includes("taco-chef"),
  },
  {
    id: "clover-wreath",
    name: "Sanctuary Clover Wreath",
    source: "Sanctuary",
    note: "Ranger Fern",
    unlocked: (world, state) => world.storyVariable(state.ink, "sanctuary_reward_14") === true,
  },
  {
    id: "sea-compass",
    name: "Sea-Glass Compass",
    source: "Bubblegum Bay",
    note: "Sue's cottage",
    unlocked: (world, state) => world.storyVariable(state.ink, "sue_compass") === true,
  },
  {
    id: "alpine-clover",
    name: "Pressed Alpine Clover",
    source: "Pinecone Pass",
    note: "Jordan's cabin",
    unlocked: (world, state) => world.storyVariable(state.ink, "jordan_clover") === true,
  },
  {
    id: "star-whistle",
    name: "Golden Star-Line Whistle",
    source: "Plaza Bus",
    note: "Buster's reward",
    unlocked: (world, state) => world.storyVariable(state.ink, "buster_reward") === true,
  },
];

/**
 * Pure summary of Fae's Star-Line Stamp Card, Clubhouse Keepsakes, and
 * Bubblegum Bay Catch Book for the Journal Field Treasures Card.
 */
export function treasuresSummary(
  world: Pick<World, "storyVariable" | "arcade">,
  state: Pick<State, "ink" | "stickers" | "caughtFish">,
): TreasuresSummary {
  const reward = world.storyVariable(state.ink, "buster_reward") === true;
  const bay = reward || world.storyVariable(state.ink, "stamp_bay") === true;
  const pass = reward || world.storyVariable(state.ink, "stamp_pass") === true;
  const started = reward || bay || pass || world.storyVariable(state.ink, "buster_quest") === true;
  const complete = reward || (bay && pass);
  const stamps: StampCardSummary = { started, bay, pass, complete };

  const keepsakes: KeepsakeEntry[] = KEEPSAKE_SPECS.map((spec) => ({
    id: spec.id,
    name: spec.name,
    source: spec.source,
    note: spec.note,
    unlocked: spec.unlocked(world, state),
  }));
  const unlockedKeepsakes = keepsakes.filter((item) => item.unlocked).length;

  const catches: FishCatchEntry[] = world.arcade.fish.catches.map((entry) => ({
    id: entry.id,
    name: entry.name,
    rare: entry.rarity === "rare",
    caught: (state.caughtFish?.[entry.id] ?? 0) > 0,
  }));
  const caughtFish = catches.filter((item) => item.caught).length;

  const hasAny = stamps.started || unlockedKeepsakes > 0 || caughtFish > 0;
  return {
    stamps,
    keepsakes,
    unlockedKeepsakes,
    totalKeepsakes: keepsakes.length,
    catches,
    caughtFish,
    totalFish: catches.length,
    hasAny,
  };
}
