import {
  activeClubhouseSwatch,
  CLUBHOUSE_SWATCHES,
  hasPlushPedestals,
  resolvedBedroomShelfPrizes,
  type ClubhouseSwatchId,
  type State,
  type World,
} from "../core";

export type ClubhousePrizePlacement = {
  id: string;
  frame: string;
  x: number;
  y: number;
  zIndex: number;
  scale: number;
  rotation: number;
};

export type RoomDisplayPlacement = ClubhousePrizePlacement & {
  pedestal: boolean;
};

export type ClubhouseRugMotif = "meadow" | "starlight" | "beach" | "cabin";

export type ClubhouseRugSpec = {
  center: readonly [number, number];
  outerPoly: readonly [number, number][];
  innerPoly: readonly [number, number][];
  motifStyle: ClubhouseRugMotif;
  fillTint: number;
  borderTint: number;
  accentTint: number;
  tasselPoints: readonly [number, number, number, number][];
};

export type ClubhousePennantSpec = {
  baseA: readonly [number, number];
  baseB: readonly [number, number];
  tip: readonly [number, number];
  tint: number;
};

export type ClubhouseFairyBulbSpec = {
  x: number;
  y: number;
  tint: number;
  scale: number;
  alpha: number;
};

export type ClubhouseDecorVisuals = {
  swatch: ClubhouseSwatchId;
  rug: ClubhouseRugSpec;
  pennants: ClubhousePennantSpec[];
  ropeSegments: { x0: number; y0: number; x1: number; y1: number }[];
  fairyBulbs: ClubhouseFairyBulbSpec[];
  pedestals: boolean;
} | null;

export type ClubhouseKeepsakeKey =
  | "keepsakeCrystal"
  | "keepsakePin"
  | "keepsakeGeode"
  | "keepsakeFeather"
  | "keepsakeTaco"
  | "keepsakeWreath"
  | "keepsakeCompass"
  | "keepsakeClover"
  | "keepsakeWhistle"
  | "keepsakeSketch"
  | "keepsakeAurora"
  | "keepsakeShell"
  | "keepsakeRibbon";

export type ClubhouseKeepsakePlacement = {
  id: string;
  texture: ClubhouseKeepsakeKey;
  x: number;
  y: number;
  zIndex: number;
  scale: number;
  sparkleTint: number;
};

export type ClubhouseEncoreTrophy = {
  x: number;
  y: number;
  zIndex: number;
  scale: number;
  earned: number;
  total: number;
  complete: boolean;
};

export type ClubhouseEncoreTrophySparkle = {
  x: number;
  y: number;
  scale: number;
  alpha: number;
  tint: number;
  rotation: number;
};

export type ClubhouseEncoreTrophyGlow = {
  haloScale: number;
  haloAlpha: number;
  haloTint: number;
  crownGlow: boolean;
  sparkles: ClubhouseEncoreTrophySparkle[];
};

export type ClubhouseDisplay = {
  prizes: ClubhousePrizePlacement[];
  keepsakes: ClubhouseKeepsakePlacement[];
  encoreTrophy: ClubhouseEncoreTrophy | null;
};

export type ClubhouseDisplayPlan = ClubhouseDisplay;

/**
 * Dedicated non-walkable pedestal atop the flat cap of the Clubhouse's left timber
 * end-post: >= 172 px clear of all 13 prizes & 13 keepsakes, string lights, window,
 * mini-fridge/microwave, and pennant banners.
 */
export const ENCORE_TROPHY_PERCH = {
  x: 264,
  y: 158,
  zIndex: 320,
  scale: 0.44,
} as const;

export type ClubhouseSunberryMote = {
  x: number;
  y: number;
  zIndex: number;
  scale: number;
  alpha: number;
  tint: number;
};

const SUNBERRY_SHIMMER_TINT = 0xffd966;

// Anchors spanning the three diagonal clubhouse garden planter boxes (prop home 795, 720).
const SUNBERRY_MOTE_ANCHORS: readonly (readonly [number, number])[] = [
  [650, 646],
  [706, 616],
  [774, 584],
  [828, 558],
  [902, 522],
  [952, 496],
];

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
  {
    placement: {
      id: "loft-sketch",
      texture: "keepsakeSketch",
      x: 326,
      y: 376,
      zIndex: 320,
      scale: 0.74,
      sparkleTint: 0xd8b8ff,
    },
    unlocked: (world, state) =>
      world.storyVariable(state.ink, "milo_loft_visited") === true &&
      world.storyVariable(state.ink, "rosie_cottage_visited") === true,
  },
  {
    placement: {
      id: "aurora-rubbing",
      texture: "keepsakeAurora",
      x: 492,
      y: 184,
      zIndex: 320,
      scale: 0.76,
      sparkleTint: 0xb8a8ff,
    },
    unlocked: (world, state) => world.storyVariable(state.ink, "summit_aurora_read") === true,
  },
  {
    placement: {
      id: "shell-shard",
      texture: "keepsakeShell",
      x: 280,
      y: 330,
      zIndex: 320,
      scale: 0.76,
      sparkleTint: 0x9cf2eb,
    },
    unlocked: (world, state) => world.storyVariable(state.ink, "island_shells_solved") === true,
  },
  {
    placement: {
      id: "festival-ribbon",
      texture: "keepsakeRibbon",
      x: 976,
      y: 344,
      zIndex: 320,
      scale: 0.78,
      sparkleTint: 0xffd966,
    },
    unlocked: (world, state) => world.storyVariable(state.ink, "festival_toast_done") === true,
  },
];

/**
 * Pure evaluator mapping owned arcade prizes, unlocked quest keepsakes, and Fae's
 * Dream Encore Star Trophy onto non-blocking Clubhouse perches.
 * Returns empty lists and `encoreTrophy: null` outside `clubhouse`.
 */
export function evaluateClubhouseDisplay(world: World, state: State): ClubhouseDisplay {
  if (state.area !== "clubhouse") {
    return { prizes: [], keepsakes: [], encoreTrophy: null };
  }

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

  const total = world.encore?.bosses.length ?? 9;
  const rawEarned = state.encore?.trophies.length ?? 0;
  const earned = Math.min(total, rawEarned);
  const encoreTrophy: ClubhouseEncoreTrophy | null =
    earned <= 0
      ? null
      : {
          x: ENCORE_TROPHY_PERCH.x,
          y: ENCORE_TROPHY_PERCH.y,
          zIndex: ENCORE_TROPHY_PERCH.zIndex,
          scale: ENCORE_TROPHY_PERCH.scale,
          earned,
          total,
          complete: total > 0 && earned >= total,
        };

  return { prizes, keepsakes, encoreTrophy };
}

const ENCORE_SPARKLE_TINTS: readonly number[] = [
  0xe8a81c,
  0xf5c238,
  0x9a75db,
  0xdf9518,
  0xf2bd2e,
  0xa882e6,
];

const ENCORE_SPARKLE_LOW: readonly (readonly [number, number])[] = [
  [-28, -42],
  [28, -28],
];

const ENCORE_SPARKLE_MID: readonly (readonly [number, number])[] = [
  [-28, -42],
  [28, -28],
  [-30, -18],
  [26, -48],
];

const ENCORE_SPARKLE_CROWN: readonly (readonly [number, number])[] = [
  [0, -64],
  [-21, -56],
  [21, -56],
  [-34, -34],
  [34, -34],
  [0, -14],
];

/**
 * Pure evaluator for the Clubhouse Dream Encore Star Trophy's golden aura and
 * twinkling star sparkles: 2 sparkles at 1..4 trophies, 4 at 5..8, and a grand
 * 6-sparkle radiant crown glow at 9/9 complete. Calm steady zero-rotation glow
 * under `reducedMotion === true`.
 */
export function evaluateEncoreTrophySparkles(
  trophy: ClubhouseEncoreTrophy,
  tick: number,
  reducedMotion = false,
): ClubhouseEncoreTrophyGlow {
  const crownGlow = trophy.complete || (trophy.total > 0 && trophy.earned >= trophy.total);
  const offsets: readonly (readonly [number, number])[] =
    trophy.earned <= 0
      ? []
      : crownGlow
        ? ENCORE_SPARKLE_CROWN
        : trophy.earned >= 5
          ? ENCORE_SPARKLE_MID
          : ENCORE_SPARKLE_LOW;
  const t = reducedMotion ? 0 : tick;
  const haloPulse = reducedMotion ? 0.5 : 0.5 + 0.5 * Math.sin(t * 0.048);
  const tierBoost = crownGlow ? 1 : trophy.earned >= 5 ? 0.55 : 0.2;
  const sparkles: ClubhouseEncoreTrophySparkle[] = offsets.map(([ox, oy], index) => {
    const phase = t * 0.065 + index * 1.05;
    const pulse = reducedMotion ? 0.6 : 0.5 + 0.5 * Math.sin(phase);
    const driftX = reducedMotion ? 0 : Math.sin(t * 0.035 + index * 1.4) * 2.2;
    const driftY = reducedMotion ? 0 : Math.cos(t * 0.04 + index * 1.2) * 2.4;
    const baseScale = crownGlow ? 0.52 : 0.44;
    return {
      x: ox + driftX,
      y: oy + driftY,
      scale: baseScale + 0.16 * pulse,
      alpha: (crownGlow ? 0.78 : 0.68) + 0.22 * pulse,
      tint: ENCORE_SPARKLE_TINTS[index % ENCORE_SPARKLE_TINTS.length] ?? 0xe8a81c,
      rotation: reducedMotion ? 0 : Math.sin(t * 0.05 + index * 0.9) * 0.32,
    };
  });
  return {
    haloScale: 0.44 + tierBoost * 0.16 + haloPulse * 0.05,
    haloAlpha: 0.18 + tierBoost * 0.12 + haloPulse * 0.05,
    haloTint: crownGlow ? 0xf5c542 : 0xf0be48,
    crownGlow,
    sparkles,
  };
}

function storyCount(world: World, state: State, name: string): number {
  const raw = world.storyVariable(state.ink, name);
  if (typeof raw === "number") return raw;
  if (typeof raw === "string") {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

/** True when the Clubhouse garden is ripe and ready to bloom a Golden Sunberry. */
export function hasSunberryBloom(world: World, state: State): boolean {
  if (state.area !== "clubhouse") return false;
  if (world.storyVariable(state.ink, "garden_ripe") !== true) return false;
  return (
    storyCount(world, state, "fridge_baskets") > 0 ||
    storyCount(world, state, "sunberry_harvests") > 0
  );
}

/**
 * Pure evaluator placing warm golden sunberry shimmer motes (0xffd966) floating gently
 * above the Clubhouse garden planter when a Golden Sunberry bloom is ready to harvest.
 */
export function evaluateSunberryMotes(
  world: World,
  state: State,
  reducedMotion = false,
): ClubhouseSunberryMote[] {
  if (!hasSunberryBloom(world, state)) return [];
  const t = reducedMotion ? 0 : state.tick;
  return SUNBERRY_MOTE_ANCHORS.map(([baseX, baseY], index) => {
    const phase = t * 0.05 + index * 1.15;
    const pulse = 0.5 + 0.5 * Math.sin(phase);
    const driftX = reducedMotion ? 0 : Math.sin(t * 0.03 + index * 1.7) * 5;
    const lift = reducedMotion ? 10 : ((t * 0.28 + index * 7) % 28);
    return {
      x: baseX + driftX,
      y: baseY - lift,
      zIndex: 730,
      scale: 0.34 + 0.18 * pulse,
      alpha: 0.52 + 0.42 * pulse,
      tint: SUNBERRY_SHIMMER_TINT,
    };
  });
}

function parseHexTint(hex: string): number {
  const cleaned = hex.startsWith("#") ? hex.slice(1) : hex;
  const parsed = Number.parseInt(cleaned, 16);
  return Number.isFinite(parsed) ? parsed & 0xffffff : 0xffffff;
}

/**
 * Pure evaluator mapping Fae's selected Bedroom shelf plushes onto `bedroom.shelfAnchors`.
 * Returns an empty list outside `bedroom` or when no prizes are owned.
 */
export function evaluateBedroomDisplay(world: World, state: State): RoomDisplayPlacement[] {
  if (state.area !== "bedroom") return [];
  const anchors = world.areas.bedroom?.shelfAnchors;
  if (anchors === undefined || anchors.length === 0) return [];
  const prizeIds = resolvedBedroomShelfPrizes(world, state);
  if (prizeIds.length === 0) return [];

  const byId = new Map(world.arcade.prizes.map((entry) => [entry.id, entry]));
  const pedestal = hasPlushPedestals(state);
  const placements: RoomDisplayPlacement[] = [];
  for (let index = 0; index < prizeIds.length; index += 1) {
    const id = prizeIds[index];
    const anchor = anchors[index];
    if (id === undefined || anchor === undefined) continue;
    const prize = byId.get(id);
    if (prize === undefined) continue;
    placements.push({
      id: prize.id,
      frame: prize.frame,
      x: anchor.x,
      y: anchor.y,
      zIndex: anchor.zIndex,
      scale: anchor.scale,
      rotation: anchor.rotation,
      pedestal,
    });
  }
  return placements;
}

const RUG_CENTER_X = 504;
const RUG_CENTER_Y = 420;
const ISO_UX = 0.894;
const ISO_UY = -0.447;
const ISO_VX = 0.894;
const ISO_VY = 0.447;

function buildIsoRect(halfA: number, halfB: number): readonly [number, number][] {
  const pt = (sa: number, sb: number): [number, number] => [
    Math.round((RUG_CENTER_X + sa * halfA * ISO_UX + sb * halfB * ISO_VX) * 10) / 10,
    Math.round((RUG_CENTER_Y + sa * halfA * ISO_UY + sb * halfB * ISO_VY) * 10) / 10,
  ];
  return [pt(-1, -1), pt(1, -1), pt(1, 1), pt(-1, 1)];
}

const RUG_OUTER_POLY: readonly [number, number][] = buildIsoRect(42, 26);
const RUG_INNER_POLY: readonly [number, number][] = buildIsoRect(32, 19);

const RUG_TASSEL_POINTS: readonly [number, number, number, number][] = (() => {
  const result: [number, number, number, number][] = [];
  const count = 5;
  for (const side of [-1, 1] as const) {
    for (let i = 0; i < count; i += 1) {
      const frac = (i / (count - 1)) * 2 - 1;
      const bOff = frac * 20;
      const x0 = RUG_CENTER_X + side * 42 * ISO_UX + bOff * ISO_VX;
      const y0 = RUG_CENTER_Y + side * 42 * ISO_UY + bOff * ISO_VY;
      const x1 = x0 + side * 6 * ISO_UX;
      const y1 = y0 + side * 6 * ISO_UY;
      result.push([
        Math.round(x0 * 10) / 10,
        Math.round(y0 * 10) / 10,
        Math.round(x1 * 10) / 10,
        Math.round(y1 * 10) / 10,
      ]);
    }
  }
  return result;
})();

const SWATCH_MOTIFS: Readonly<Record<Exclude<ClubhouseSwatchId, "classic">, ClubhouseRugMotif>> = {
  "sunlit-meadow": "meadow",
  "starlight-cozy": "starlight",
  "bubblegum-beach": "beach",
  "pinecone-cabin": "cabin",
};

type GarlandSpan = {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  sag: number;
  pennantCount: number;
  drop: number;
};

// Back-left wall slopes UP-RIGHT along the high roofline above the drawings; back-right
// span clears the round window frame and hugs the upper wall above the right-wall shelves.
const BANNER_SPANS: readonly GarlandSpan[] = [
  { x0: 292, y0: 206, x1: 534, y1: 92, sag: 8, pennantCount: 7, drop: 12 },
  { x0: 848, y0: 148, x1: 958, y1: 192, sag: 4, pennantCount: 4, drop: 9 },
];

const FAIRY_ARCS: readonly { x0: number; y0: number; x1: number; y1: number; sag: number }[] = [
  { x0: 286, y0: 210, x1: 544, y1: 96, sag: 11 },
  { x0: 622, y0: 98, x1: 946, y1: 242, sag: 12 },
];

function sampleArc(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  sag: number,
  t: number,
): [number, number] {
  const x = x0 + (x1 - x0) * t;
  const y = y0 + (y1 - y0) * t + 4 * sag * t * (1 - t);
  return [Math.round(x * 10) / 10, Math.round(y * 10) / 10];
}

/**
 * Pure evaluator for equipped Clubhouse decor overlays (cozy isometric floor rug,
 * back-wall pennant banner garland, and twinkling tinted fairy lights).
 * Returns `null` outside `clubhouse` or on the default `"classic"` swatch so
 * uncustomized Clubhouse baselines remain pixel-identical.
 */
export function evaluateClubhouseDecor(
  state: State,
  reducedMotion = false,
): ClubhouseDecorVisuals {
  if (state.area !== "clubhouse") return null;
  const swatch = activeClubhouseSwatch(state);
  if (swatch === "classic") return null;

  const spec = CLUBHOUSE_SWATCHES[swatch];
  const fillTint = parseHexTint(spec.palette.rugColor);
  const borderTint = parseHexTint(spec.palette.rugBorder);
  const bannerTint = parseHexTint(spec.palette.bannerColor);
  const lampTint = parseHexTint(spec.palette.lampGlow);
  const accentTint = bannerTint;
  const pennantCycle: readonly [number, number, number] = [bannerTint, fillTint, lampTint];

  const pennants: ClubhousePennantSpec[] = [];
  const ropeSegments: { x0: number; y0: number; x1: number; y1: number }[] = [];
  let pennantIndex = 0;

  for (const span of BANNER_SPANS) {
    const steps = span.pennantCount * 2;
    let prev = sampleArc(span.x0, span.y0, span.x1, span.y1, span.sag, 0);
    for (let s = 1; s <= steps; s += 1) {
      const curr = sampleArc(span.x0, span.y0, span.x1, span.y1, span.sag, s / steps);
      ropeSegments.push({ x0: prev[0], y0: prev[1], x1: curr[0], y1: curr[1] });
      prev = curr;
    }
    for (let i = 0; i < span.pennantCount; i += 1) {
      const tA = (i + 0.14) / span.pennantCount;
      const tB = (i + 0.86) / span.pennantCount;
      const tMid = (tA + tB) * 0.5;
      const baseA = sampleArc(span.x0, span.y0, span.x1, span.y1, span.sag, tA);
      const baseB = sampleArc(span.x0, span.y0, span.x1, span.y1, span.sag, tB);
      const mid = sampleArc(span.x0, span.y0, span.x1, span.y1, span.sag, tMid);
      pennants.push({
        baseA,
        baseB,
        tip: [mid[0], Math.round((mid[1] + span.drop) * 10) / 10],
        tint: pennantCycle[pennantIndex % pennantCycle.length] ?? bannerTint,
      });
      pennantIndex += 1;
    }
  }

  const bulbTints: readonly [number, number, number] = [lampTint, bannerTint, lampTint];
  const fairyBulbs: ClubhouseFairyBulbSpec[] = [];
  const t = reducedMotion ? 0 : state.tick;
  let bulbIndex = 0;
  for (const arc of FAIRY_ARCS) {
    const perArc = 6;
    for (let i = 0; i < perArc; i += 1) {
      const frac = (i + 0.5) / perArc;
      const [x, y] = sampleArc(arc.x0, arc.y0, arc.x1, arc.y1, arc.sag, frac);
      const pulse = reducedMotion ? 0.5 : 0.5 + 0.5 * Math.sin(t * 0.065 + bulbIndex * 1.15);
      fairyBulbs.push({
        x,
        y,
        tint: bulbTints[bulbIndex % bulbTints.length] ?? lampTint,
        scale: 0.24 + 0.08 * pulse,
        alpha: 0.44 + 0.28 * pulse,
      });
      bulbIndex += 1;
    }
  }

  return {
    swatch,
    rug: {
      center: [RUG_CENTER_X, RUG_CENTER_Y],
      outerPoly: RUG_OUTER_POLY,
      innerPoly: RUG_INNER_POLY,
      motifStyle: SWATCH_MOTIFS[swatch],
      fillTint,
      borderTint,
      accentTint,
      tasselPoints: RUG_TASSEL_POINTS,
    },
    pennants,
    ropeSegments,
    fairyBulbs,
    pedestals: hasPlushPedestals(state),
  };
}
