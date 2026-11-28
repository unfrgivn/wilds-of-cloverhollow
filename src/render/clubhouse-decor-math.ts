import {
  activeClubhouseSwatch,
  CLUBHOUSE_SWATCHES,
  hasPlushPedestals,
  resolvedBedroomShelfPrizes,
  type ClubhouseSwatchId,
  type State,
  type World,
} from "../core";
import type { ClubhouseEncoreTrophy, ClubhousePrizePlacement } from "./clubhouse-display";

export type RoomDisplayPlacement = ClubhousePrizePlacement & { pedestal: boolean };
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
  x: number; y: number; tint: number; scale: number; alpha: number;
};

export type ClubhouseDecorVisuals = {
  swatch: ClubhouseSwatchId;
  rug: ClubhouseRugSpec;
  pennants: ClubhousePennantSpec[];
  ropeSegments: { x0: number; y0: number; x1: number; y1: number }[];
  fairyBulbs: ClubhouseFairyBulbSpec[];
  pedestals: boolean;
} | null;

export type ClubhouseEncoreTrophySparkle = {
  x: number; y: number; scale: number; alpha: number; tint: number; rotation: number;
};

export type ClubhouseEncoreTrophyGlow = {
  haloScale: number;
  haloAlpha: number;
  haloTint: number;
  crownGlow: boolean;
  sparkles: ClubhouseEncoreTrophySparkle[];
};

export type ClubhouseSunberryMote = {
  x: number; y: number; zIndex: number; scale: number; alpha: number; tint: number;
};

/**
 * Dedicated non-walkable pedestal atop the flat cap of the Clubhouse's left timber
 * end-post: >= 172 px clear of all 13 prizes & 13 keepsakes, string lights, window,
 * mini-fridge/microwave, and pennant banners.
 */
export const ENCORE_TROPHY_PERCH = { x: 264, y: 158, zIndex: 320, scale: 0.44 } as const;

const SUNBERRY_SHIMMER_TINT = 0xffd966;
// Anchors spanning the three diagonal clubhouse garden planter boxes (prop home 795, 720).
const SUNBERRY_MOTE_ANCHORS: readonly (readonly [number, number])[] = [
  [650, 646], [706, 616], [774, 584], [828, 558], [902, 522], [952, 496],
];

const ENCORE_SPARKLE_TINTS: readonly number[] = [
  0xe8a81c, 0xf5c238, 0x9a75db, 0xdf9518, 0xf2bd2e, 0xa882e6,
];
const ENCORE_SPARKLE_LOW: readonly (readonly [number, number])[] = [[-28, -42], [28, -28]];
const ENCORE_SPARKLE_MID: readonly (readonly [number, number])[] = [
  [-28, -42], [28, -28], [-30, -18], [26, -48],
];
const ENCORE_SPARKLE_CROWN: readonly (readonly [number, number])[] = [
  [0, -64], [-21, -56], [21, -56], [-34, -34], [34, -34], [0, -14],
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
    const prize = id === undefined ? undefined : byId.get(id);
    if (anchor === undefined || prize === undefined) continue;
    placements.push({
      id: prize.id, frame: prize.frame, x: anchor.x, y: anchor.y,
      zIndex: anchor.zIndex, scale: anchor.scale, rotation: anchor.rotation, pedestal,
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
      const bOff = ((i / (count - 1)) * 2 - 1) * 20;
      const x0 = RUG_CENTER_X + side * 42 * ISO_UX + bOff * ISO_VX;
      const y0 = RUG_CENTER_Y + side * 42 * ISO_UY + bOff * ISO_VY;
      const x1 = x0 + side * 6 * ISO_UX;
      const y1 = y0 + side * 6 * ISO_UY;
      result.push([
        Math.round(x0 * 10) / 10, Math.round(y0 * 10) / 10,
        Math.round(x1 * 10) / 10, Math.round(y1 * 10) / 10,
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
  x0: number; y0: number; x1: number; y1: number;
  sag: number; pennantCount: number; drop: number;
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
  x0: number, y0: number, x1: number, y1: number, sag: number, t: number,
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
      const baseA = sampleArc(span.x0, span.y0, span.x1, span.y1, span.sag, tA);
      const baseB = sampleArc(span.x0, span.y0, span.x1, span.y1, span.sag, tB);
      const mid = sampleArc(span.x0, span.y0, span.x1, span.y1, span.sag, (tA + tB) * 0.5);
      pennants.push({
        baseA, baseB,
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
    for (let i = 0; i < 6; i += 1) {
      const [x, y] = sampleArc(arc.x0, arc.y0, arc.x1, arc.y1, arc.sag, (i + 0.5) / 6);
      const pulse = reducedMotion ? 0.5 : 0.5 + 0.5 * Math.sin(t * 0.065 + bulbIndex * 1.15);
      fairyBulbs.push({
        x, y,
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
      accentTint: bannerTint,
      tasselPoints: RUG_TASSEL_POINTS,
    },
    pennants,
    ropeSegments,
    fairyBulbs,
    pedestals: hasPlushPedestals(state),
  };
}
