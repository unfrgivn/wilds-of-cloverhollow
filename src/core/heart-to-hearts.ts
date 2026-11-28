import type { Point, State, World } from "./types";

export type HeartToHeartId =
  | "fae-maddie"
  | "fae-sue"
  | "fae-jordan"
  | "sue-jordan"
  | "clubhouse-trio"
  | "sanctuary-encore";

export type HeartToHeartSpec = {
  id: HeartToHeartId;
  title: string;
  area: string;
  point: Point;
  knot: string;
  doneVariable: string;
  participants: readonly string[];
  /** Optional secondary scenic hangout spot offered while the scene is still unseen. */
  altSpot?: { area: string; point: Point };
  unlocked: (
    world: Pick<World, "storyVariable">,
    state: Pick<State, "ink" | "stickers" | "party" | "finale">,
  ) => boolean;
};

export type ActiveHeartSpot = {
  id: string;
  h2hId: HeartToHeartId;
  knot: string;
  point: Point;
  prompt: "Heart";
  completed: boolean;
};

export type HeartToHeartEntry = {
  id: HeartToHeartId;
  title: string;
  area: string;
  knot: string;
  unlocked: boolean;
  completed: boolean;
};

export type HeartToHeartSummary = {
  completed: number;
  total: number;
  entries: readonly HeartToHeartEntry[];
};

export type HeartToHeartMeta = {
  participantsLabel: string;
  locationLabel: string;
  accent: string;
  unlockHint: string;
  memoryNote: string;
  pinLabel: string;
};

export type LullabyFluteSpot = {
  id: string;
  area: string;
  point: Point;
  knot: string;
  doneVariable: string;
};

const LULLABY_FLUTE_RANGE = 115;

function flag(
  world: Pick<World, "storyVariable">,
  ink: string,
  name: string,
): boolean {
  return world.storyVariable(ink, name) === true;
}

/**
 * Six optional Party Heart-to-Heart hangout spots (Track E11).
 * Unlocks respect party joins, story milestones, and spec §1.2 Milo secrecy.
 */
export const HEART_TO_HEARTS: readonly HeartToHeartSpec[] = [
  {
    id: "fae-maddie",
    title: "The Journal Under the Pillow",
    area: "bedroom",
    point: { x: 645, y: 485 },
    knot: "h2h_fae_maddie",
    doneVariable: "h2h_fae_maddie_done",
    participants: ["fae", "maddie"],
    altSpot: { area: "park", point: { x: 620, y: 620 } },
    unlocked: (world, state) =>
      state.finale === null &&
      (flag(world, state.ink, "ate_breakfast") ||
        flag(world, state.ink, "clubhouse_claimed") ||
        state.stickers.includes("fountain-frog")),
  },
  {
    id: "fae-sue",
    title: "Sea-Glass Courage",
    area: "bay",
    point: { x: 1230, y: 375 },
    knot: "h2h_fae_sue",
    doneVariable: "h2h_fae_sue_done",
    participants: ["fae", "sue"],
    unlocked: (world, state) =>
      state.finale === null &&
      flag(world, state.ink, "sue_joined") &&
      (state.stickers.includes("bay-bluebird") ||
        state.stickers.includes("lifeguard") ||
        flag(world, state.ink, "bluebird_calmed")),
  },
  {
    id: "fae-jordan",
    title: "Catching Your Breath",
    area: "pass",
    point: { x: 870, y: 680 },
    knot: "h2h_fae_jordan",
    doneVariable: "h2h_fae_jordan_done",
    participants: ["fae", "jordan"],
    unlocked: (world, state) =>
      state.finale === null &&
      flag(world, state.ink, "jordan_joined") &&
      (flag(world, state.ink, "has_lantern") || state.stickers.includes("hiker-hamster")),
  },
  {
    id: "sue-jordan",
    title: "Hot Cocoa vs. Sea-Salt Taffy",
    area: "cafe",
    point: { x: 575, y: 575 },
    knot: "h2h_sue_jordan",
    doneVariable: "h2h_sue_jordan_done",
    participants: ["fae", "sue", "jordan", "maddie"],
    unlocked: (world, state) =>
      state.finale === null &&
      flag(world, state.ink, "sue_joined") &&
      flag(world, state.ink, "jordan_joined"),
  },
  {
    id: "clubhouse-trio",
    title: "Clubhouse Snack Night",
    area: "clubhouse",
    point: { x: 345, y: 530 },
    knot: "h2h_clubhouse_trio",
    doneVariable: "h2h_clubhouse_trio_done",
    participants: ["fae", "sue", "jordan", "maddie"],
    unlocked: (world, state) =>
      state.finale === null &&
      flag(world, state.ink, "clubhouse_claimed") &&
      flag(world, state.ink, "sue_joined") &&
      flag(world, state.ink, "jordan_joined"),
  },
  {
    id: "sanctuary-encore",
    title: "Wildest Moments of the Dream",
    area: "sanctuary",
    point: { x: 1360, y: 640 },
    knot: "h2h_sanctuary_encore",
    doneVariable: "h2h_sanctuary_encore_done",
    participants: ["fae", "maddie", "sue", "jordan", "milo"],
    unlocked: (world, state) =>
      state.finale === null && flag(world, state.ink, "milo_revealed"),
  },
];

/** Active Heart-to-Heart hangout spots currently targetable in `areaId`. */
export function heartToHeartSpotsInArea(
  world: Pick<World, "storyVariable">,
  state: Pick<State, "ink" | "stickers" | "party" | "finale">,
  areaId: string,
): ActiveHeartSpot[] {
  if (state.finale !== null) return [];
  const spots: ActiveHeartSpot[] = [];
  for (const spec of HEART_TO_HEARTS) {
    if (!spec.unlocked(world, state)) continue;
    const completed = flag(world, state.ink, spec.doneVariable);
    if (spec.area === areaId) {
      spots.push({
        id: `heart:${spec.id}`,
        h2hId: spec.id,
        knot: spec.knot,
        point: spec.point,
        prompt: "Heart",
        completed,
      });
    } else if (!completed && spec.altSpot !== undefined && spec.altSpot.area === areaId) {
      spots.push({
        id: `heart:${spec.id}`,
        h2hId: spec.id,
        knot: spec.knot,
        point: spec.altSpot.point,
        prompt: "Heart",
        completed,
      });
    }
  }
  return spots;
}

/** Pure summary of all 6 Party Heart-to-Hearts for tests and UI views. */
export function heartToHeartSummary(
  world: Pick<World, "storyVariable">,
  state: Pick<State, "ink" | "stickers" | "party" | "finale">,
): HeartToHeartSummary {
  const entries: HeartToHeartEntry[] = HEART_TO_HEARTS.map((spec) => ({
    id: spec.id,
    title: spec.title,
    area: spec.area,
    knot: spec.knot,
    unlocked: spec.unlocked(world, state),
    completed: flag(world, state.ink, spec.doneVariable),
  }));
  return {
    completed: entries.filter((entry) => entry.completed).length,
    total: entries.length,
    entries,
  };
}

const HEART_TO_HEART_META: Readonly<Record<HeartToHeartId, HeartToHeartMeta>> = {
  "fae-maddie": {
    participantsLabel: "Fae & Maddie",
    locationLabel: "Fae's Bedroom",
    accent: "#e58963",
    unlockHint: "Eat breakfast, claim the Clubhouse, or calm the Fountain Frog.",
    memoryNote:
      "Remembered Mom & Dad's rainy-night journal gift and kitten Maddie's pawprint on page one.",
    pinLabel: "Pawprint Co-Captain Pin",
  },
  "fae-sue": {
    participantsLabel: "Fae & Sue",
    locationLabel: "Bubblegum Bay",
    accent: "#58b5cc",
    unlockHint: "Team up with Sue and calm a critter at Bubblegum Bay.",
    memoryNote:
      "Swapped tide-jitter stories on the pier and admired Sue's storm-smoothed sea-glass compass.",
    pinLabel: "Sea-Glass Compass Pin",
  },
  "fae-jordan": {
    participantsLabel: "Fae & Jordan",
    locationLabel: "Pinecone Pass",
    accent: "#6aa876",
    unlockHint: "Team up with Jordan and earn the Lantern or calm the Hiker Hamster.",
    memoryNote:
      "Paused in the pine snow so Jordan could set down his heavy guide pack and take a breather.",
    pinLabel: "Snowy Overlook Pin",
  },
  "sue-jordan": {
    participantsLabel: "Fae, Sue, Jordan & Maddie",
    locationLabel: "Bon Appetit Café",
    accent: "#df9a4c",
    unlockHint: "Recruit both Sue and Jordan into Fae's adventure crew.",
    memoryNote:
      "Settled the hot cocoa vs. sea-salt taffy debate with the Coast-Meets-Mountain Snack Treaty.",
    pinLabel: "Snack Treaty Pin",
  },
  "clubhouse-trio": {
    participantsLabel: "Fae, Sue, Jordan & Maddie",
    locationLabel: "Clubhouse",
    accent: "#b57bd6",
    unlockHint: "Claim the Whispering Woods Clubhouse with Sue and Jordan on the team.",
    memoryNote:
      "Shared lantern-lit snacks on the clubhouse rug as Cloverhollow's found family.",
    pinLabel: "Found-Family Rug Pin",
  },
  "sanctuary-encore": {
    participantsLabel: "Whole Crew",
    locationLabel: "Wildlife Sanctuary",
    accent: "#e27b9e",
    unlockHint: "Calm the Enchanted Forest to gather everyone at the Wildlife Sanctuary.",
    memoryNote:
      "Laughed together in the sunlit clover over every wild dream-adventure memory.",
    pinLabel: "Sunlit Clover Encore Pin",
  },
};

const SANCTUARY_ENCORE_REVEALED: HeartToHeartMeta = {
  ...HEART_TO_HEART_META["sanctuary-encore"],
  participantsLabel: "Fae, Maddie, Sue, Jordan & Milo",
  memoryNote:
    "Laughed with Maddie, Sue, Jordan, and Milo in the sunlit clover over the whole wild dream.",
};

/**
 * Pure storybook scrapbook metadata for each Party Heart-to-Heart.
 * Strictly obeys spec §1.2 secrecy: `sanctuary-encore` never names Milo unless
 * `revealed` is explicitly true (only after unlock/completion).
 */
export function heartToHeartMeta(id: HeartToHeartId, revealed = false): HeartToHeartMeta {
  if (id === "sanctuary-encore" && revealed) return SANCTUARY_ENCORE_REVEALED;
  return HEART_TO_HEART_META[id];
}

/**
 * Three musical landmarks for Toby's Sleepy Lullaby quest (Track E11).
 * Pressing the Harmony Flute near an unrecorded landmark while Toby's quest is
 * active opens that landmark's flute echo knot directly.
 */
export const LULLABY_FLUTE_SPOTS: readonly LullabyFluteSpot[] = [
  {
    id: "lullaby-plaza",
    area: "plaza",
    point: { x: 1090, y: 735 },
    knot: "lullaby_plaza",
    doneVariable: "lullaby_note_plaza",
  },
  {
    id: "lullaby-park",
    area: "park",
    point: { x: 640, y: 775 },
    knot: "lullaby_park",
    doneVariable: "lullaby_note_park",
  },
  {
    id: "lullaby-woods",
    area: "woods",
    point: { x: 710, y: 650 },
    knot: "lullaby_woods",
    doneVariable: "lullaby_note_woods",
  },
];

/**
 * Returns the nearest unrecorded Sleepy Lullaby musical landmark within range
 * when Toby's lullaby quest is active, or `undefined` to fall back to the
 * normal companion-calling flute knot.
 */
export function findLullabyFluteSpot(
  world: Pick<World, "storyVariable">,
  state: Pick<State, "area" | "player" | "ink">,
): LullabyFluteSpot | undefined {
  if (!flag(world, state.ink, "lullaby_quest")) return undefined;
  const maxDistSq = LULLABY_FLUTE_RANGE * LULLABY_FLUTE_RANGE;
  let best: LullabyFluteSpot | undefined;
  let bestDistSq = maxDistSq + 1;
  for (const spot of LULLABY_FLUTE_SPOTS) {
    if (spot.area !== state.area) continue;
    if (flag(world, state.ink, spot.doneVariable)) continue;
    const dx = spot.point.x - state.player.x;
    const dy = spot.point.y - state.player.y;
    const distSq = dx * dx + dy * dy;
    if (distSq <= maxDistSq && distSq < bestDistSq) {
      bestDistSq = distSq;
      best = spot;
    }
  }
  return best;
}
