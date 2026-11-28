import { addTreat } from "./battle-view";
import { journalKeepsakes } from "./journal";
import type {
  Area,
  ClubhouseSwatchId,
  DecorState,
  DisplayAnchor,
  EconomyTunables,
  Npc,
  Point,
  Polygon,
  State,
  SwatchPrice,
  TreatBasket,
  World,
} from "./types";

export type {
  ClubhouseSwatchId,
  DecorState,
  DisplayAnchor,
  EconomyTunables,
  SwatchPrice,
  TreatBasket,
};

export type ClubhouseSwatchPalette = {
  wallTint: string;
  rugColor: string;
  rugBorder: string;
  bannerColor: string;
  lampGlow: string;
};

export type ClubhouseSwatchSpec = {
  id: ClubhouseSwatchId;
  name: string;
  tagline: string;
  coinPrice: number;
  ticketPrice: number;
  previewColors: readonly [string, string, string];
  palette: ClubhouseSwatchPalette;
};

export const CLUBHOUSE_SWATCH_IDS: readonly ClubhouseSwatchId[] = [
  "classic",
  "sunlit-meadow",
  "starlight-cozy",
  "bubblegum-beach",
  "pinecone-cabin",
] as const;

const SWATCH_ID_SET: ReadonlySet<string> = new Set<string>(CLUBHOUSE_SWATCH_IDS);

export const CLUBHOUSE_SWATCHES: Readonly<Record<ClubhouseSwatchId, ClubhouseSwatchSpec>> = {
  classic: {
    id: "classic",
    name: "Classic Wood",
    tagline: "Warm cedar beams and Fae's original woodland rug.",
    coinPrice: 0,
    ticketPrice: 0,
    previewColors: ["#c89364", "#e7b96b", "#fff1cf"],
    palette: {
      wallTint: "#fff4e2",
      rugColor: "#d99e6c",
      rugBorder: "#9e663d",
      bannerColor: "#e8ba6c",
      lampGlow: "#ffe6a8",
    },
  },
  "sunlit-meadow": {
    id: "sunlit-meadow",
    name: "Sunlit Meadow",
    tagline: "Clover-green trim, daisy pennant bunting, and buttercup light.",
    coinPrice: 35,
    ticketPrice: 25,
    previewColors: ["#78c47d", "#f6d868", "#fff9d4"],
    palette: {
      wallTint: "#f6ffe8",
      rugColor: "#78c47d",
      rugBorder: "#4f8d58",
      bannerColor: "#f6d868",
      lampGlow: "#fff4b8",
    },
  },
  "starlight-cozy": {
    id: "starlight-cozy",
    name: "Starlight Cozy",
    tagline: "Lavender twilight walls with twinkling moon-gold bunting.",
    coinPrice: 55,
    ticketPrice: 40,
    previewColors: ["#9f8ee0", "#f4ce72", "#e8e0ff"],
    palette: {
      wallTint: "#f2ecff",
      rugColor: "#8f7fd4",
      rugBorder: "#5c4d9c",
      bannerColor: "#f4ce72",
      lampGlow: "#dcd0ff",
    },
  },
  "bubblegum-beach": {
    id: "bubblegum-beach",
    name: "Bubblegum Beach",
    tagline: "Pastel coral stripes, sea-glass turquoise rug, and sunny breeze.",
    coinPrice: 70,
    ticketPrice: 50,
    previewColors: ["#f39cb5", "#65cbd6", "#fff1e6"],
    palette: {
      wallTint: "#fff0f4",
      rugColor: "#65cbd6",
      rugBorder: "#3f96a6",
      bannerColor: "#f39cb5",
      lampGlow: "#ffd8e4",
    },
  },
  "pinecone-cabin": {
    id: "pinecone-cabin",
    name: "Pinecone Cabin",
    tagline: "Mountain pine plaid, warm hearth amber, and snowy lodge trim.",
    coinPrice: 85,
    ticketPrice: 65,
    previewColors: ["#c86852", "#568a6a", "#ffdfb5"],
    palette: {
      wallTint: "#ffefe0",
      rugColor: "#c86852",
      rugBorder: "#7a392d",
      bannerColor: "#568a6a",
      lampGlow: "#ffd59c",
    },
  },
};

export const PLUSH_PEDESTAL_DEFAULT_PRICE: Readonly<SwatchPrice> = {
  coins: 50,
  tickets: 35,
};

/** Narrows an unknown value to a valid Clubhouse swatch identifier. */
export function isClubhouseSwatchId(value: unknown): value is ClubhouseSwatchId {
  return typeof value === "string" && SWATCH_ID_SET.has(value);
}

/** Resolves coin & ticket pricing for a Clubhouse swatch, honoring tunables overrides. */
export function swatchPriceFor(
  world: Pick<World, "tunables">,
  swatch: ClubhouseSwatchId,
): SwatchPrice {
  if (swatch === "classic") return { coins: 0, tickets: 0 };
  const override = world.tunables.economy?.swatches[swatch];
  if (override !== undefined) return { coins: override.coins, tickets: override.tickets };
  const spec = CLUBHOUSE_SWATCHES[swatch];
  return { coins: spec.coinPrice, tickets: spec.ticketPrice };
}

/** Resolves coin & ticket pricing for the Velvet Plush Pedestals bedroom upgrade. */
export function plushPedestalPrice(world: Pick<World, "tunables">): SwatchPrice {
  const override = world.tunables.economy?.plushPedestals;
  if (override !== undefined) return { coins: override.coins, tickets: override.tickets };
  return { ...PLUSH_PEDESTAL_DEFAULT_PRICE };
}

/** Strips default/empty fields so fresh and uncustomized states omit `state.decor`. */
export function normalizeDecor(decor: DecorState | undefined): DecorState | undefined {
  if (decor === undefined) return undefined;
  const next: DecorState = {};
  if (decor.swatch !== undefined && decor.swatch !== "classic") {
    next.swatch = decor.swatch;
  }
  if (decor.unlockedSwatches !== undefined) {
    const owned = new Set(decor.unlockedSwatches);
    const ordered = CLUBHOUSE_SWATCH_IDS.filter(
      (id) => id !== "classic" && owned.has(id),
    );
    if (ordered.length > 0) next.unlockedSwatches = ordered;
  }
  if (decor.pedestals === true) {
    next.pedestals = true;
  }
  if (decor.bedroomSlots !== undefined) {
    const deduped: string[] = [];
    for (const id of decor.bedroomSlots) {
      if (!deduped.includes(id)) deduped.push(id);
    }
    next.bedroomSlots = deduped;
  }
  if (
    decor.visitorOffset !== undefined &&
    Number.isInteger(decor.visitorOffset) &&
    decor.visitorOffset > 0
  ) {
    next.visitorOffset = decor.visitorOffset;
  }
  if (
    decor.fishTraded !== undefined &&
    Number.isInteger(decor.fishTraded) &&
    decor.fishTraded > 0
  ) {
    next.fishTraded = decor.fishTraded;
  }
  return Object.keys(next).length === 0 ? undefined : next;
}

/** Returns a new state with normalized `decor`, omitting the key entirely when empty. */
export function withDecor(state: State, decor: DecorState | undefined): State {
  const normalized = normalizeDecor(decor);
  if (normalized === undefined) {
    const { decor: _removed, ...rest } = state;
    return rest;
  }
  return { ...state, decor: normalized };
}

/** Currently equipped Clubhouse decor swatch (`"classic"` when unset). */
export function activeClubhouseSwatch(state: Pick<State, "decor">): ClubhouseSwatchId {
  return state.decor?.swatch ?? "classic";
}

/** Whether a Clubhouse decor swatch is unlocked (`"classic"` is always unlocked). */
export function isSwatchUnlocked(
  state: Pick<State, "decor">,
  swatch: ClubhouseSwatchId,
): boolean {
  if (swatch === "classic") return true;
  return state.decor?.unlockedSwatches?.includes(swatch) === true;
}

/** Purchases and unlocks a Clubhouse swatch with coins or arcade tickets. */
export function unlockClubhouseSwatch(
  world: Pick<World, "tunables">,
  state: State,
  swatch: ClubhouseSwatchId,
  currency: "coins" | "tickets",
): State {
  if (isSwatchUnlocked(state, swatch)) return state;
  const price = swatchPriceFor(world, swatch);
  const cost = currency === "coins" ? price.coins : price.tickets;
  if (cost <= 0) return state;
  if (currency === "coins" && state.coins < cost) return state;
  if (currency === "tickets" && state.tickets < cost) return state;
  const unlockedSwatches: ClubhouseSwatchId[] = [
    ...(state.decor?.unlockedSwatches ?? []),
    swatch,
  ];
  const paid: State =
    currency === "coins"
      ? { ...state, coins: state.coins - cost }
      : { ...state, tickets: state.tickets - cost };
  return withDecor(paid, { ...state.decor, unlockedSwatches });
}

/** Equips an already-unlocked Clubhouse swatch. */
export function equipClubhouseSwatch(state: State, swatch: ClubhouseSwatchId): State {
  if (!isSwatchUnlocked(state, swatch)) return state;
  return withDecor(state, { ...state.decor, swatch });
}

/** Whether Fae has unlocked the Velvet Plush Pedestals (+1 bedroom shelf slot). */
export function hasPlushPedestals(state: Pick<State, "decor">): boolean {
  return state.decor?.pedestals === true;
}

/** Unlocks the Velvet Plush Pedestals bedroom shelf upgrade with coins or tickets. */
export function unlockPlushPedestals(
  world: Pick<World, "tunables">,
  state: State,
  currency: "coins" | "tickets",
): State {
  if (hasPlushPedestals(state)) return state;
  const price = plushPedestalPrice(world);
  const cost = currency === "coins" ? price.coins : price.tickets;
  if (cost <= 0) return state;
  if (currency === "coins" && state.coins < cost) return state;
  if (currency === "tickets" && state.tickets < cost) return state;
  const paid: State =
    currency === "coins"
      ? { ...state, coins: state.coins - cost }
      : { ...state, tickets: state.tickets - cost };
  return withDecor(paid, { ...state.decor, pedestals: true });
}

/** Maximum plushes displayed on Fae's bedroom bookshelf (4 base, 5 with pedestals). */
export function bedroomShelfCapacity(state: Pick<State, "decor">): number {
  return hasPlushPedestals(state) ? 5 : 4;
}

/** Resolves the owned prize IDs currently displayed on Fae's bedroom bookshelf. */
export function resolvedBedroomShelfPrizes(
  world: Pick<World, "arcade">,
  state: Pick<State, "prizes" | "decor">,
): string[] {
  const capacity = bedroomShelfCapacity(state);
  const owned = new Set(state.prizes);
  const custom = state.decor?.bedroomSlots;
  if (custom !== undefined) {
    return custom.filter((id) => owned.has(id)).slice(0, capacity);
  }
  return world.arcade.prizes
    .map((prize) => prize.id)
    .filter((id) => owned.has(id))
    .slice(0, capacity);
}

/** Toggles an owned plush on Fae's bedroom shelf; when full, replaces the oldest slot. */
export function toggleBedroomShelfPrize(
  world: Pick<World, "arcade">,
  state: State,
  prizeId: string,
): State {
  if (!state.prizes.includes(prizeId)) return state;
  const capacity = bedroomShelfCapacity(state);
  const current = resolvedBedroomShelfPrizes(world, state);
  const nextSlots = current.includes(prizeId)
    ? current.filter((id) => id !== prizeId)
    : current.length >= capacity
      ? [...current.slice(1), prizeId]
      : [...current, prizeId];
  return withDecor(state, { ...state.decor, bedroomSlots: nextSlots });
}

/** Resets bedroom shelf slots back to automatic filling from owned arcade prizes. */
export function resetBedroomShelfPrizes(state: State): State {
  if (state.decor?.bedroomSlots === undefined) return state;
  const { bedroomSlots: _removed, ...restDecor } = state.decor;
  return withDecor(state, restDecor);
}

export type ClubhouseVisitorId = "sue" | "jordan" | "milo" | "rosie" | "barnaby" | "fern";

export type ClubhouseVisitorSpec = {
  id: ClubhouseVisitorId;
  name: string;
  knot: string;
  blurb: string;
};

export const CLUBHOUSE_VISITOR_POINT: Readonly<Point> = { x: 360, y: 505 };
export const CLUBHOUSE_VISITOR_FOOTPRINT: readonly [number, number][] = [
  [342, 490],
  [378, 490],
  [378, 516],
  [342, 516],
];

export const CLUBHOUSE_VISITORS: readonly ClubhouseVisitorSpec[] = [
  {
    id: "sue",
    name: "Sue",
    knot: "club_visit_sue",
    blurb: "Brought fresh sea-glass stories from Bubblegum Bay.",
  },
  {
    id: "jordan",
    name: "Jordan",
    knot: "club_visit_jordan",
    blurb: "Checking on the deck strawberry sprouts with his sketchbook.",
  },
  {
    id: "milo",
    name: "Milo",
    knot: "club_visit_milo",
    blurb: "Reading superhero cat comics and doodling rocket ships.",
  },
  {
    id: "rosie",
    name: "Rosie",
    knot: "club_visit_rosie",
    blurb: "Pressing clover blossoms into a clubhouse scrapbook.",
  },
  {
    id: "barnaby",
    name: "Grandpa Barnaby",
    knot: "club_visit_barnaby",
    blurb: "Admiring Fae's valley keepsakes over warm chamomile tea.",
  },
  {
    id: "fern",
    name: "Ranger Fern",
    knot: "club_visit_fern",
    blurb: "Swapping Wildlife Sanctuary field notes by the clubhouse deck.",
  },
] as const;

/** Lists all valley friends currently eligible to drop by Fae's Clubhouse. */
export function eligibleClubhouseVisitors(
  world: Pick<World, "storyVariable">,
  state: Pick<State, "ink" | "party">,
): ClubhouseVisitorSpec[] {
  const isSet = (name: string): boolean => world.storyVariable(state.ink, name) === true;
  if (!isSet("clubhouse_claimed")) return [];
  const inParty = new Set(state.party.map((member) => member.id));
  return CLUBHOUSE_VISITORS.filter((visitor) => {
    switch (visitor.id) {
      case "sue":
        return isSet("sue_joined") && !inParty.has("sue");
      case "jordan":
        return isSet("jordan_joined") && !inParty.has("jordan");
      case "milo":
        return isSet("milo_revealed");
      case "rosie":
        return (
          isSet("rosie_cottage_visited") ||
          (isSet("kite_returned") && isSet("fridge_fixed"))
        );
      case "barnaby":
        return isSet("barnaby_gift");
      case "fern":
        return isSet("sanctuary_visited");
    }
  });
}

/** Deterministically selects the visiting friend currently hanging out in the Clubhouse. */
export function activeClubhouseVisitor(
  world: Pick<World, "storyVariable">,
  state: Pick<State, "calms" | "decor" | "ink" | "party" | "prizes" | "stickers">,
): ClubhouseVisitorSpec | null {
  const eligible = eligibleClubhouseVisitors(world, state);
  if (eligible.length === 0) return null;
  let totalCalms = 0;
  for (const count of Object.values(state.calms)) totalCalms += count;
  const unlockedKeepsakes = journalKeepsakes(world, state).filter((item) => item.owned).length;
  const rotation =
    totalCalms + state.prizes.length + unlockedKeepsakes + (state.decor?.visitorOffset ?? 0);
  const index = ((rotation % eligible.length) + eligible.length) % eligible.length;
  return eligible[index] ?? null;
}

/** Projects the active Clubhouse visitor as an area NPC when Fae is in the Clubhouse. */
export function clubhouseVisitorNpc(
  world: Pick<World, "storyVariable">,
  state: Pick<State, "area" | "calms" | "decor" | "ink" | "party" | "prizes" | "stickers">,
): Npc | null {
  if (state.area !== "clubhouse") return null;
  const visitor = activeClubhouseVisitor(world, state);
  if (visitor === null) return null;
  const footprint: Polygon = CLUBHOUSE_VISITOR_FOOTPRINT.map(([x, y]) => [x, y]);
  return {
    id: visitor.id,
    point: { x: CLUBHOUSE_VISITOR_POINT.x, y: CLUBHOUSE_VISITOR_POINT.y },
    facing: "right",
    footprint,
    knot: visitor.knot,
    prompt: "Talk",
  };
}

/** Returns an area's authored NPCs plus any active dynamic Clubhouse visitor. */
export function effectiveAreaNpcs(
  world: Pick<World, "storyVariable">,
  state: Pick<State, "area" | "calms" | "decor" | "ink" | "party" | "prizes" | "stickers">,
  area: Pick<Area, "id" | "npcs">,
): Npc[] {
  if (area.id !== "clubhouse") return area.npcs;
  const visitor = clubhouseVisitorNpc(world, state);
  return visitor === null ? area.npcs : [...area.npcs, visitor];
}

/** Rotates which eligible friend is visiting the Clubhouse next. */
export function cycleClubhouseVisitor(
  world: Pick<World, "storyVariable">,
  state: State,
): State {
  const eligible = eligibleClubhouseVisitors(world, state);
  if (eligible.length <= 1) return state;
  const nextOffset = ((state.decor?.visitorOffset ?? 0) + 1) % eligible.length;
  return withDecor(state, { ...state.decor, visitorOffset: nextOffset });
}

/** Total catches logged across all Bubblegum Bay fish species. */
export function totalCaughtFishCount(state: Pick<State, "caughtFish">): number {
  if (state.caughtFish === undefined) return 0;
  let total = 0;
  for (const count of Object.values(state.caughtFish)) {
    if (count > 0) total += count;
  }
  return total;
}

/** Remaining bay fish catches available to trade without erasing Catch Book history. */
export function availableFishToTrade(state: Pick<State, "caughtFish" | "decor">): number {
  return Math.max(0, totalCaughtFishCount(state) - (state.decor?.fishTraded ?? 0));
}

/** Trades one available bay catch for arcade tickets or coins, preserving `caughtFish`. */
export function tradeFishCatch(
  state: State,
  reward: "tickets" | "coins",
  amount: number,
): State {
  if (amount <= 0 || availableFishToTrade(state) <= 0) return state;
  const fishTraded = (state.decor?.fishTraded ?? 0) + 1;
  const rewarded: State =
    reward === "tickets"
      ? { ...state, tickets: state.tickets + amount }
      : { ...state, coins: state.coins + amount };
  return withDecor(rewarded, { ...state.decor, fishTraded });
}

/** Purchases a Specialty Treat Gift Basket, adding all bundled treats and snacks. */
export function purchaseTreatBasket(
  world: Pick<World, "treatBaskets">,
  state: State,
  basketId: string,
  price: number,
): State {
  if (price < 0 || state.coins < price) return state;
  const basket = world.treatBaskets.find((item) => item.id === basketId);
  if (basket === undefined || basket.price !== price) return state;
  let next: State = {
    ...state,
    coins: state.coins - price,
    snacks: state.snacks + basket.snacks,
  };
  for (const [treatId, count] of Object.entries(basket.treats)) {
    next = addTreat(next, treatId, count);
  }
  return next;
}

/** Exchanges coins for arcade tickets at Mr. Pip's counter. */
export function exchangeCoinsForTickets(
  state: State,
  coinCost: number,
  ticketGain: number,
): State {
  if (coinCost <= 0 || ticketGain <= 0 || state.coins < coinCost) return state;
  return {
    ...state,
    coins: state.coins - coinCost,
    tickets: state.tickets + ticketGain,
  };
}

/** Applies E9B economy item tags (`buy-basket:`, `trade-fish:`, `buy-tickets:`). */
export function applyEconomyItemTag(
  world: Pick<World, "treatBaskets">,
  state: State,
  tag: string,
): State {
  const basket = /^buy-basket:\s*([a-z][a-z0-9-]*)\s+(\d+)$/.exec(tag);
  if (basket?.[1] !== undefined && basket[2] !== undefined)
    return purchaseTreatBasket(world, state, basket[1], Number(basket[2]));
  const fishTrade = /^trade-fish:\s*(tickets|coins)\s+(\d+)$/.exec(tag);
  if (fishTrade?.[1] !== undefined && fishTrade[2] !== undefined) {
    const reward = fishTrade[1] === "tickets" ? "tickets" : "coins";
    return tradeFishCatch(state, reward, Number(fishTrade[2]));
  }
  const ticketBuy = /^buy-tickets:\s*(\d+)\s+(\d+)$/.exec(tag);
  if (ticketBuy?.[1] !== undefined && ticketBuy[2] !== undefined)
    return exchangeCoinsForTickets(state, Number(ticketBuy[1]), Number(ticketBuy[2]));
  return state;
}
