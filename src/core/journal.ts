import { runInk } from "./ink";
import { inkFacts } from "./sim";
import type { FeelingId, State, World } from "./types";

export type LandProgress = { owned: number; total: number };
export type BusRoute = { from: string; to: string; open: boolean };
export type CritterFieldNote = {
  stickerId: string;
  name: string;
  chaosName: string;
  level: number;
  lands: string[];
  calms: number;
  oldFriend: boolean;
  feelings: { id: FeelingId; label: string }[];
  favouriteTreats: string[];
};
export type CarriedTreat = { id: string; name: string; count: number };
export type KeepsakeId =
  | "star-crystal"
  | "star-pin"
  | "star-geode"
  | "moon-feather"
  | "taco-badge"
  | "clover-wreath"
  | "sea-compass"
  | "alpine-clover"
  | "star-whistle";
export type JournalKeepsake = {
  id: KeepsakeId;
  name: string;
  source: string;
  owned: boolean;
};
export type JournalFish = {
  id: string;
  name: string;
  frame: string;
  owned: boolean;
  rare: boolean;
};
export type JournalProgress = {
  stickers: LandProgress;
  prizes: LandProgress;
  fish: LandProgress;
  keepsakes: LandProgress;
  gems: LandProgress;
};

export const STAR_GEM_VARIABLES = [
  "gem_park",
  "gem_bay",
  "gem_trail",
  "gem_pass",
  "gem_cavern",
  "gem_woods",
  "gem_hills",
] as const;

/** Counts how many of Cloverhollow's seven Star Gems Fae has found. */
export function starGemsFound(
  world: Pick<World, "storyVariable">,
  state: Pick<State, "ink">,
): { found: number; total: number } {
  let found = 0;
  for (const variable of STAR_GEM_VARIABLES) {
    if (world.storyVariable(state.ink, variable) === true) found += 1;
  }
  return { found, total: STAR_GEM_VARIABLES.length };
}

export function mapLandName(
  land: { id: string; name: string; revealVariable?: string },
  currentLand: string | null,
  isSet: (variable: string) => boolean,
): string {
  return (land.revealVariable !== undefined && currentLand !== land.id &&
    !isSet(land.revealVariable))
    ? "???"
    : land.name;
}

/**
 * Counts owned vs total discoverable stickers per land from the world's areas,
 * critter set pieces, recurring dens, and sticker catalogue.
 */
export function landStickerProgress(
  world: Pick<World, "areas" | "critters" | "lands" | "stickers">,
  state: Pick<State, "stickers">,
): Record<string, LandProgress> {
  const validIds = new Set(world.stickers.catalogue.map((entry) => entry.id));
  const speciesToSticker = new Map<string, string>();
  for (const entry of world.stickers.catalogue) {
    const critter = world.critters[entry.critter];
    if (critter !== undefined) speciesToSticker.set(critter.species, entry.id);
  }
  const perLand = new Map<string, Set<string>>();
  for (const land of world.lands) perLand.set(land.id, new Set());
  for (const area of Object.values(world.areas)) {
    if (area.land === undefined) continue;
    const bucket = perLand.get(area.land);
    if (bucket === undefined) continue;
    const kinds = [
      ...area.critters.map((piece) => piece.id),
      ...(area.recurring?.dens.flatMap((den) => den.kinds) ?? []),
    ];
    for (const kind of kinds) {
      const critter = world.critters[kind];
      if (critter === undefined) continue;
      const stickerId = speciesToSticker.get(critter.species) ?? critter.sticker.id;
      if (validIds.has(stickerId)) bucket.add(stickerId);
    }
  }
  const ownedSet = new Set(state.stickers);
  const result: Record<string, LandProgress> = {};
  for (const land of world.lands) {
    const ids = perLand.get(land.id) ?? new Set<string>();
    let owned = 0;
    for (const id of ids) if (ownedSet.has(id)) owned += 1;
    result[land.id] = { owned, total: ids.size };
  }
  return result;
}

/**
 * The bus network connecting the world's bus-stop lands, with each route's
 * open status driven by the story's bus stop unlock rules.
 */
export function mapBusRoutes(
  lands: readonly { id: string; busStop: boolean }[],
  isSet: (variable: string) => boolean,
  hasSticker: (id: string) => boolean,
): BusRoute[] {
  const stops = new Set(lands.filter((land) => land.busStop).map((land) => land.id));
  const bayOpen = isSet("club_open");
  const passOpen = hasSticker("bay-bluebird");
  const routes: BusRoute[] = [];
  if (stops.has("cloverhollow") && stops.has("bay"))
    routes.push({ from: "cloverhollow", to: "bay", open: bayOpen });
  if (stops.has("cloverhollow") && stops.has("pass"))
    routes.push({ from: "cloverhollow", to: "pass", open: passOpen });
  if (stops.has("bay") && stops.has("pass"))
    routes.push({ from: "bay", to: "pass", open: bayOpen && passOpen });
  return routes;
}

// Fae's notes, newest first: the `journal` knot's lines for the current story
// state. Runs on a copy of the Ink state and keeps no result, so reading the
// journal never changes the game.
export function journalNotes(world: World, state: State): string[] {
  const facts = inkFacts(world, state);
  const notes: string[] = [];
  let result = runInk(world.story, state.ink, { type: "start", knot: "journal" }, facts);
  for (let count = 0; count < 20; count += 1) {
    if (result.line !== null)
      notes.push(result.line.text);
    if (result.ended) break;
    result = runInk(world.story, result.ink, { type: "next" }, facts);
  }
  return notes;
}

/**
 * Field guide entry for an owned critter sticker (spec 9.1): returns null for
 * unowned or unknown stickers, otherwise data-driven lands, calms, Old Friend
 * status, feelings, and favourite treats.
 */
export function critterFieldNote(
  world: Pick<
    World,
    "areas" | "battle" | "critters" | "lands" | "stickers" | "storyVariable" | "treats"
  >,
  state: Pick<State, "area" | "calms" | "ink" | "stickers">,
  stickerId: string,
): CritterFieldNote | null {
  if (!state.stickers.includes(stickerId)) return null;
  const entry = world.stickers.catalogue.find((item) => item.id === stickerId);
  if (entry === undefined) return null;
  const critter = world.critters[entry.critter];
  if (critter === undefined) return null;
  const species = critter.species;
  const kindIds = new Set(
    Object.values(world.critters)
      .filter((candidate) => candidate.species === species)
      .map((candidate) => candidate.id),
  );
  const foundLandIds = new Set<string>();
  let recurring = false;
  for (const area of Object.values(world.areas)) {
    const hasSetPiece = area.critters.some((piece) => kindIds.has(piece.id));
    const hasRecurring = area.recurring?.dens.some(
      (den) => den.kinds.some((kind) => kindIds.has(kind)),
    ) === true;
    if (hasRecurring) recurring = true;
    if ((hasSetPiece || hasRecurring) && area.land !== undefined)
      foundLandIds.add(area.land);
  }
  const currentLand = world.areas[state.area]?.land ?? null;
  const isSet = (variable: string): boolean => world.storyVariable(state.ink, variable) === true;
  const revealed = world.lands
    .filter((land) => foundLandIds.has(land.id))
    .map((land) => mapLandName(land, currentLand, isSet))
    .filter((name) => name !== "???");
  const lands = revealed.length > 0 ? revealed : foundLandIds.size > 0 ? ["???"] : [];
  const calms = state.calms[species] ?? 0;
  const oldFriend = recurring && calms >= world.battle.oldFriends.calms;
  const feelings = critter.feelings.map((id) => ({
    id,
    label: world.battle.feelings[id].label,
  }));
  const favouriteTreats = world.treats
    .filter((treat) => treat.favourites.includes(species))
    .map((treat) => treat.name);
  return {
    stickerId: entry.id,
    name: entry.name,
    chaosName: critter.name,
    level: critter.level,
    lands,
    calms,
    oldFriend,
    feelings,
    favouriteTreats,
  };
}

/** Specialty treats currently in Fae's backpack, in catalogue order. */
export function carriedTreats(
  world: Pick<World, "treats">,
  state: Pick<State, "treats">,
): CarriedTreat[] {
  if (state.treats === undefined) return [];
  return world.treats.flatMap((treat) => {
    const count = state.treats?.[treat.id] ?? 0;
    return count > 0 ? [{ id: treat.id, name: treat.name, count }] : [];
  });
}

/** All nine quest keepsakes in canonical display order with ownership state. */
export function journalKeepsakes(
  world: Pick<World, "storyVariable">,
  state: Pick<State, "ink" | "stickers">,
): JournalKeepsake[] {
  const flag = (variable: string): boolean => world.storyVariable(state.ink, variable) === true;
  return [
    {
      id: "star-crystal",
      name: "Star Crystal",
      source: "Crystal Cavern",
      owned: flag("cavern_chime_rung"),
    },
    {
      id: "star-pin",
      name: "Bon Appetit Star Pin",
      source: "Bon Appetit Café",
      owned: flag("spice_returned"),
    },
    {
      id: "star-geode",
      name: "Rainbow Star Geode",
      source: "7 Star Gems",
      owned: flag("gem_reward_all"),
    },
    {
      id: "moon-feather",
      name: "Moon Feather",
      source: "Starry Owl",
      owned: state.stickers.includes("starry-owl"),
    },
    {
      id: "taco-badge",
      name: "Golden Taco Badge",
      source: "Chef Mateo",
      owned: state.stickers.includes("taco-chef"),
    },
    {
      id: "clover-wreath",
      name: "Sanctuary Clover Wreath",
      source: "Wildlife Sanctuary",
      owned: flag("sanctuary_reward_14"),
    },
    {
      id: "sea-compass",
      name: "Sea-Glass Compass",
      source: "Sue's Beach Cottage",
      owned: flag("sue_compass"),
    },
    {
      id: "alpine-clover",
      name: "Pressed Alpine Clover",
      source: "Jordan's Mountain Cabin",
      owned: flag("jordan_clover"),
    },
    {
      id: "star-whistle",
      name: "Golden Star-Line Whistle",
      source: "Buster · Star-Line",
      owned: flag("buster_reward"),
    },
  ];
}

/** Bubblegum Bay fishing catches mapped against Fae's caught species log. */
export function journalFish(
  world: Pick<World, "arcade">,
  state: Pick<State, "caughtFish">,
): JournalFish[] {
  const caught = state.caughtFish ?? {};
  return world.arcade.fish.catches.map((item) => ({
    id: item.id,
    name: item.name,
    frame: item.frame,
    owned: (caught[item.id] ?? 0) > 0,
    rare: item.rarity === "rare",
  }));
}

/** Unified collection completion counters across stickers, prizes, fish, keepsakes, and gems. */
export function journalProgress(
  world: Pick<World, "arcade" | "stickers" | "storyVariable">,
  state: Pick<State, "caughtFish" | "ink" | "prizes" | "stickers">,
): JournalProgress {
  const validStickers = new Set(world.stickers.catalogue.map((entry) => entry.id));
  const ownedStickers = new Set(state.stickers.filter((id) => validStickers.has(id)));
  const validPrizes = new Set(world.arcade.prizes.map((entry) => entry.id));
  const ownedPrizes = new Set(state.prizes.filter((id) => validPrizes.has(id)));
  const fish = journalFish(world, state);
  const keepsakes = journalKeepsakes(world, state);
  const gems = starGemsFound(world, state);
  return {
    stickers: { owned: ownedStickers.size, total: world.stickers.catalogue.length },
    prizes: { owned: ownedPrizes.size, total: world.arcade.prizes.length },
    fish: { owned: fish.filter((item) => item.owned).length, total: fish.length },
    keepsakes: { owned: keepsakes.filter((item) => item.owned).length, total: keepsakes.length },
    gems: { owned: gems.found, total: gems.total },
  };
}

export function autosaveNeeded(previous: State, next: State): boolean {
  if (previous.finale !== null || next.finale !== null) return false;
  return (
    (previous.area !== next.area && next.transition === null) ||
    (previous.transition?.phase === "in" && next.transition === null) ||
    (previous.battle !== null && next.battle === null) ||
    (previous.arcade !== null && next.arcade === null) ||
    (previous.dialogue !== null && next.dialogue === null) ||
    (previous.journalOpen && !next.journalOpen)
  );
}
