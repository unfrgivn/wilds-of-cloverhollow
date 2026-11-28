import { targetInteractable, type Direction, type Point, type State, type World } from "../core";

export const PETTABLE_IDS: ReadonlySet<string> = new Set([
  "maddie",
  "pond-pup",
  "acorn-squirrel",
  "ribbon-bunny",
]);

export type PettableCompanion = {
  id: string;
  x: number;
  y: number;
  height: number;
};

export type RestSpot = {
  id: string;
  area: string;
  x: number;
  y: number;
  radius: number;
  seatX: number;
  seatY: number;
  facing: Direction;
};

export const REST_SPOTS: readonly RestSpot[] = [
  {
    id: "plaza-sw-bench",
    area: "plaza",
    x: 690,
    y: 640,
    radius: 64,
    seatX: 690,
    seatY: 632,
    facing: "down",
  },
  {
    id: "plaza-ne-bench",
    area: "plaza",
    x: 1095,
    y: 640,
    radius: 64,
    seatX: 1095,
    seatY: 632,
    facing: "down",
  },
  {
    id: "park-bench",
    area: "park",
    x: 740,
    y: 480,
    radius: 60,
    seatX: 740,
    seatY: 476,
    facing: "down",
  },
  {
    id: "bay-bench",
    area: "bay",
    x: 520,
    y: 485,
    radius: 64,
    seatX: 520,
    seatY: 480,
    facing: "down",
  },
  {
    id: "cafe-chair",
    area: "cafe",
    x: 470,
    y: 540,
    radius: 58,
    seatX: 470,
    seatY: 536,
    facing: "right",
  },
  {
    id: "lodge-rug",
    area: "lodge",
    x: 900,
    y: 520,
    radius: 64,
    seatX: 900,
    seatY: 516,
    facing: "up",
  },
  {
    id: "clubhouse-beanbag",
    area: "clubhouse",
    x: 790,
    y: 470,
    radius: 62,
    seatX: 795,
    seatY: 468,
    facing: "left",
  },
  {
    id: "sue-cottage-rug",
    area: "sue-cottage",
    x: 582,
    y: 560,
    radius: 64,
    seatX: 582,
    seatY: 556,
    facing: "down",
  },
  {
    id: "jordan-cabin-rug",
    area: "jordan-cabin",
    x: 552,
    y: 584,
    radius: 64,
    seatX: 552,
    seatY: 580,
    facing: "down",
  },
  {
    id: "sanctuary-blanket",
    area: "sanctuary",
    x: 890,
    y: 915,
    radius: 64,
    seatX: 890,
    seatY: 911,
    facing: "up",
  },
  {
    id: "bedroom-rug",
    area: "bedroom",
    x: 560,
    y: 515,
    radius: 64,
    seatX: 560,
    seatY: 511,
    facing: "down",
  },
  {
    id: "pass-snow-bench",
    area: "pass",
    x: 790,
    y: 440,
    radius: 64,
    seatX: 790,
    seatY: 436,
    facing: "down",
  },
  {
    id: "woods-moss-glade",
    area: "woods",
    x: 610,
    y: 740,
    radius: 64,
    seatX: 610,
    seatY: 736,
    facing: "down",
  },
  {
    id: "hills-wildflower-overlook",
    area: "hills",
    x: 690,
    y: 630,
    radius: 64,
    seatX: 690,
    seatY: 626,
    facing: "down",
  },
  {
    id: "enchanted-pond-edge",
    area: "enchanted",
    x: 735,
    y: 620,
    radius: 64,
    seatX: 735,
    seatY: 616,
    facing: "down",
  },
  {
    id: "kitchen-sofa-rug",
    area: "kitchen",
    x: 860,
    y: 525,
    radius: 60,
    seatX: 860,
    seatY: 521,
    facing: "down",
  },
  {
    id: "trail-stream-overlook",
    area: "trail",
    x: 1420,
    y: 735,
    radius: 64,
    seatX: 1420,
    seatY: 731,
    facing: "up",
  },
  {
    id: "market-rug",
    area: "market",
    x: 895,
    y: 568,
    radius: 56,
    seatX: 895,
    seatY: 564,
    facing: "left",
  },
  {
    id: "parlor-sunbeam",
    area: "parlor",
    x: 345,
    y: 510,
    radius: 52,
    seatX: 345,
    seatY: 506,
    facing: "right",
  },
  {
    id: "milo-starry-rug",
    area: "milo-house",
    x: 540,
    y: 565,
    radius: 60,
    seatX: 540,
    seatY: 561,
    facing: "down",
  },
  {
    id: "rosie-floral-rug",
    area: "rosie-cottage",
    x: 595,
    y: 580,
    radius: 60,
    seatX: 595,
    seatY: 576,
    facing: "down",
  },
  {
    id: "summit-bench",
    area: "summit",
    x: 1335,
    y: 860,
    radius: 60,
    seatX: 1335,
    seatY: 856,
    facing: "down",
  },
  {
    id: "island-mat",
    area: "island",
    x: 1150,
    y: 796,
    radius: 56,
    seatX: 1150,
    seatY: 792,
    facing: "down",
  },
  {
    id: "cavern-crystal-bank",
    area: "cavern",
    x: 720,
    y: 760,
    radius: 64,
    seatX: 720,
    seatY: 756,
    facing: "up",
  },
  {
    id: "mist-bellflower-glade",
    area: "mist",
    x: 1040,
    y: 400,
    radius: 64,
    seatX: 1040,
    seatY: 396,
    facing: "down",
  },
  {
    id: "field-oak-shade",
    area: "field",
    x: 800,
    y: 500,
    radius: 64,
    seatX: 800,
    seatY: 496,
    facing: "down",
  },
  {
    id: "music-room-rug",
    area: "music",
    x: 480,
    y: 640,
    radius: 60,
    seatX: 480,
    seatY: 636,
    facing: "right",
  },
  {
    id: "art-room-skylight",
    area: "art-room",
    x: 390,
    y: 510,
    radius: 60,
    seatX: 390,
    seatY: 506,
    facing: "right",
  },
  {
    id: "arcade-lounge",
    area: "arcade",
    x: 560,
    y: 560,
    radius: 60,
    seatX: 560,
    seatY: 556,
    facing: "up",
  },
  {
    id: "school-hall-bench",
    area: "school",
    x: 600,
    y: 600,
    radius: 60,
    seatX: 600,
    seatY: 596,
    facing: "down",
  },
  {
    id: "east-hall-sunbeam",
    area: "east-hall",
    x: 880,
    y: 600,
    radius: 60,
    seatX: 880,
    seatY: 596,
    facing: "down",
  },
  {
    id: "classroom-reading-rug",
    area: "classroom",
    x: 710,
    y: 435,
    radius: 52,
    seatX: 710,
    seatY: 431,
    facing: "down",
  },
  {
    id: "gym-sideline-mat",
    area: "gym",
    x: 760,
    y: 510,
    radius: 60,
    seatX: 760,
    seatY: 506,
    facing: "down",
  },
];

const FACING_VECTORS: Readonly<Record<Direction, Point>> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const PET_FRONT_RANGE = 78;
const PET_CLOSE_RANGE = 56;
const PET_FRONT_DOT = 0.15;

function canUseOverworldAction(state: State): boolean {
  return (
    state.dialogue === null &&
    state.battle === null &&
    state.arcade === null &&
    !state.journalOpen &&
    state.finale === null &&
    state.transition === null
  );
}

type CompanionMatch = PettableCompanion & {
  distance: number;
  inFront: boolean;
};

function matchPettableCompanion(world: World, state: State): CompanionMatch | null {
  if (!canUseOverworldAction(state)) return null;
  if (targetInteractable(world, state) !== undefined) return null;

  const facing = FACING_VECTORS[state.facing];
  let bestFront: CompanionMatch | null = null;
  let bestClose: CompanionMatch | null = null;

  for (const member of state.party) {
    if (!PETTABLE_IDS.has(member.id)) continue;
    const dx = member.x - state.player.x;
    const dy = member.y - state.player.y;
    const distance = Math.hypot(dx, dy);
    if (distance > PET_FRONT_RANGE) continue;
    const dot = distance === 0 ? 1 : (dx * facing.x + dy * facing.y) / distance;
    const inFront = dot >= PET_FRONT_DOT;
    const height = world.party[member.id]?.box.height ?? 48;
    const candidate: CompanionMatch = {
      id: member.id,
      x: member.x,
      y: member.y,
      height,
      distance,
      inFront,
    };
    if (inFront) {
      if (bestFront === null || candidate.distance < bestFront.distance) {
        bestFront = candidate;
      }
    } else if (distance <= PET_CLOSE_RANGE) {
      if (bestClose === null || candidate.distance < bestClose.distance) {
        bestClose = candidate;
      }
    }
  }

  return bestFront ?? bestClose;
}

/**
 * Finds the best pettable animal companion near Fae (preferring one in front
 * within 78u, falling back to the closest within 56u). Always yields to real
 * interactables and active overlays.
 */
export function findPettableCompanion(world: World, state: State): PettableCompanion | null {
  const match = matchPettableCompanion(world, state);
  if (match === null) return null;
  return { id: match.id, x: match.x, y: match.y, height: match.height };
}

/**
 * Finds the nearest cozy bench, chair, or beanbag rest spot within range in
 * `state.area`. Yields to real interactables, active overlays, any pettable
 * companion Fae is facing, and any closer pettable companion.
 */
export function findRestSpot(world: World, state: State): RestSpot | null {
  if (!canUseOverworldAction(state)) return null;
  if (targetInteractable(world, state) !== undefined) return null;

  let bestSpot: RestSpot | null = null;
  let bestDist = Infinity;
  for (const spot of REST_SPOTS) {
    if (spot.area !== state.area) continue;
    const dist = Math.hypot(state.player.x - spot.x, state.player.y - spot.y);
    if (dist <= spot.radius && dist < bestDist) {
      bestSpot = spot;
      bestDist = dist;
    }
  }
  if (bestSpot === null) return null;

  const companion = matchPettableCompanion(world, state);
  if (companion !== null && (companion.inFront || companion.distance <= bestDist)) {
    return null;
  }

  return bestSpot;
}
