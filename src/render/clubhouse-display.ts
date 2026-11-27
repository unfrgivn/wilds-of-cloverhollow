import type { State, World } from "../core";

export type ClubhousePrizePlacement = {
  id: string;
  frame: string;
  x: number;
  y: number;
  zIndex: number;
  scale: number;
  rotation: number;
};

export type ClubhouseKeepsakeKey =
  | "keepsakeCrystal"
  | "keepsakePin"
  | "keepsakeGeode"
  | "keepsakeFeather"
  | "keepsakeTaco"
  | "keepsakeWreath"
  | "keepsakeCompass"
  | "keepsakeClover"
  | "keepsakeWhistle";

export type ClubhouseKeepsakePlacement = {
  id: string;
  texture: ClubhouseKeepsakeKey;
  x: number;
  y: number;
  zIndex: number;
  scale: number;
  sparkleTint: number;
};

export type ClubhouseDisplay = {
  prizes: ClubhousePrizePlacement[];
  keepsakes: ClubhouseKeepsakePlacement[];
};

type PrizePerch = {
  x: number;
  y: number;
  zIndex: number;
  scale: number;
  rotation: number;
};

// Non-blocking perches verified against the 1200x800 clubhouse layout:
// beanbag cushion (869, 456), right-wall shelves, crate top (742, 406), and wall nooks.
const PRIZE_PERCHES: Readonly<Record<string, PrizePerch>> = {
  // Beanbag chair (2x2 cozy cuddle arc across backrest & seat cushion)
  "frog-plush": { x: 836, y: 434, zIndex: 462, scale: 0.24, rotation: -0.06 },
  "pup-plush": { x: 912, y: 380, zIndex: 460, scale: 0.23, rotation: 0.06 },
  "cat-plush": { x: 914, y: 432, zIndex: 464, scale: 0.24, rotation: 0.08 },
  "bunny-plush": { x: 856, y: 378, zIndex: 459, scale: 0.22, rotation: -0.05 },
  // Right-wall upper & lower shelves
  pinwheel: { x: 864, y: 238, zIndex: 320, scale: 0.145, rotation: -0.05 },
  "bouncy-ball": { x: 906, y: 248, zIndex: 320, scale: 0.165, rotation: 0 },
  "toy-rocket": { x: 950, y: 260, zIndex: 320, scale: 0.185, rotation: 0.08 },
  "star-racer-keychain": { x: 934, y: 299, zIndex: 320, scale: 0.21, rotation: -0.05 },
  // Wooden crate top & left-wall nooks
  "bluebird-plush": { x: 724, y: 322, zIndex: 412, scale: 0.22, rotation: -0.05 },
  "hamster-plush": { x: 796, y: 320, zIndex: 412, scale: 0.22, rotation: 0.06 },
  "squirrel-plush": { x: 266, y: 444, zIndex: 456, scale: 0.24, rotation: 0.05 },
  "owl-plush": { x: 318, y: 442, zIndex: 456, scale: 0.25, rotation: -0.06 },
  "raccoon-plush": { x: 424, y: 396, zIndex: 455, scale: 0.28, rotation: 0.05 },
};

type KeepsakeRule = {
  placement: ClubhouseKeepsakePlacement;
  unlocked: (world: World, state: State) => boolean;
};

const KEEPSAKE_RULES: readonly KeepsakeRule[] = [
  {
    placement: {
      id: "star-crystal",
      texture: "keepsakeCrystal",
      x: 758,
      y: 344,
      zIndex: 414,
      scale: 0.68,
      sparkleTint: 0x67d5c4,
    },
    unlocked: (world, state) => world.storyVariable(state.ink, "cavern_chime_rung") === true,
  },
  {
    placement: {
      id: "star-pin",
      texture: "keepsakePin",
      x: 852,
      y: 268,
      zIndex: 320,
      scale: 0.68,
      sparkleTint: 0xffe074,
    },
    unlocked: (world, state) => world.storyVariable(state.ink, "spice_returned") === true,
  },
  {
    placement: {
      id: "star-geode",
      texture: "keepsakeGeode",
      x: 882,
      y: 294,
      zIndex: 320,
      scale: 0.72,
      sparkleTint: 0xd8b8ff,
    },
    unlocked: (world, state) => world.storyVariable(state.ink, "gem_reward_all") === true,
  },
  {
    placement: {
      id: "moon-feather",
      texture: "keepsakeFeather",
      x: 718,
      y: 348,
      zIndex: 414,
      scale: 0.66,
      sparkleTint: 0x89b4fa,
    },
    unlocked: (_world, state) => state.stickers.includes("starry-owl"),
  },
  {
    placement: {
      id: "taco-badge",
      texture: "keepsakeTaco",
      x: 376,
      y: 384,
      zIndex: 455,
      scale: 0.72,
      sparkleTint: 0xffd27a,
    },
    unlocked: (_world, state) => state.stickers.includes("taco-chef"),
  },
  {
    placement: {
      id: "clover-wreath",
      texture: "keepsakeWreath",
      x: 468,
      y: 314,
      zIndex: 320,
      scale: 0.78,
      sparkleTint: 0xa8e6cf,
    },
    unlocked: (world, state) => world.storyVariable(state.ink, "sanctuary_reward_14") === true,
  },
  {
    placement: {
      id: "sea-compass",
      texture: "keepsakeCompass",
      x: 796,
      y: 350,
      zIndex: 414,
      scale: 0.66,
      sparkleTint: 0x7ae2d8,
    },
    unlocked: (world, state) => world.storyVariable(state.ink, "sue_compass") === true,
  },
  {
    placement: {
      id: "alpine-clover",
      texture: "keepsakeClover",
      x: 516,
      y: 308,
      zIndex: 320,
      scale: 0.74,
      sparkleTint: 0xa2ce8f,
    },
    unlocked: (world, state) => world.storyVariable(state.ink, "jordan_clover") === true,
  },
  {
    placement: {
      id: "star-whistle",
      texture: "keepsakeWhistle",
      x: 805,
      y: 259,
      zIndex: 320,
      scale: 0.78,
      sparkleTint: 0xffd966,
    },
    unlocked: (world, state) => world.storyVariable(state.ink, "buster_reward") === true,
  },
];

/**
 * Pure evaluator mapping owned arcade prizes and unlocked quest keepsakes onto
 * non-blocking Clubhouse perches. Returns empty lists outside `clubhouse`.
 */
export function evaluateClubhouseDisplay(world: World, state: State): ClubhouseDisplay {
  if (state.area !== "clubhouse") return { prizes: [], keepsakes: [] };

  const ownedPrizes = new Set(state.prizes);
  const prizes: ClubhousePrizePlacement[] = [];
  for (const entry of world.arcade.prizes) {
    if (!ownedPrizes.has(entry.id)) continue;
    const perch = PRIZE_PERCHES[entry.id];
    if (perch === undefined) continue;
    prizes.push({
      id: entry.id,
      frame: entry.frame,
      x: perch.x,
      y: perch.y,
      zIndex: perch.zIndex,
      scale: perch.scale,
      rotation: perch.rotation,
    });
  }

  const keepsakes: ClubhouseKeepsakePlacement[] = [];
  for (const rule of KEEPSAKE_RULES) {
    if (rule.unlocked(world, state)) keepsakes.push(rule.placement);
  }

  return { prizes, keepsakes };
}
