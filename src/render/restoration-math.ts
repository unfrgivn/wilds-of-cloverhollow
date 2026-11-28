import {
  calmedFact,
  isSpeciesCalmed,
  type Point,
  type State,
  type World,
} from "../core";

export const RESTORATION_PULSE_TICKS = 90;
export const RESTORATION_PETAL_COUNT = 32;

export const RESTORATION_ZONE_IDS = [
  "plaza",
  "park",
  "bay",
  "pass",
  "woods",
  "school",
  "hills",
  "cavern",
  "enchanted",
] as const;

export type RestorationZoneId = (typeof RESTORATION_ZONE_IDS)[number];

export type ChaosDecalFrame =
  | "chaos_scribble_loop"
  | "chaos_scribble_zigzag"
  | "chaos_crumple_patch"
  | "chaos_fizzy_doodle";

export type BloomDecalFrame =
  | "bloom_wildflowers"
  | "bloom_clover_tuft"
  | "bloom_meadow_sprig"
  | "bloom_sunbeam_dew";

export type RestorationDecalSpec = {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly chaosFrame: ChaosDecalFrame;
  readonly bloomFrame: BloomDecalFrame;
  readonly scale: number;
  readonly chaosAlpha: number;
  readonly bloomAlpha: number;
  readonly chaosRotation: number;
  readonly bloomRotation: number;
  readonly chaosBlend: "normal" | "multiply";
  readonly chaosTint: number;
  readonly bloomBlend: "normal" | "add";
  readonly bloomTint: number;
};

export type RestorationZoneSpec = {
  readonly id: RestorationZoneId;
  readonly anchor: Point;
  readonly ringColor: number;
  readonly ringAccent: number;
  readonly decals: readonly RestorationDecalSpec[];
};

export type RestorationStatus = {
  readonly zone: RestorationZoneId;
  readonly anchor: Point;
  readonly restored: boolean;
  readonly ringColor: number;
  readonly ringAccent: number;
  readonly decals: readonly RestorationDecalSpec[];
};

export type RestorationPulseState = {
  readonly areaId: string;
  readonly wasRestored: boolean;
  readonly pulseStartTick: number | null;
  readonly lastTick: number;
};

export type RestorationPulseStep = {
  readonly next: RestorationPulseState;
  readonly calmPulse: number;
  readonly wiping: boolean;
};

export type DecalVisual = {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly chaosFrame: ChaosDecalFrame;
  readonly chaosAlpha: number;
  readonly chaosScale: number;
  readonly chaosRotation: number;
  readonly chaosBlend: "normal" | "multiply";
  readonly chaosTint: number;
  readonly bloomFrame: BloomDecalFrame;
  readonly bloomAlpha: number;
  readonly bloomScale: number;
  readonly bloomRotation: number;
  readonly bloomBlend: "normal" | "add";
  readonly bloomTint: number;
};

export type RestorationRingVisual = {
  readonly visible: boolean;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly thickness: number;
  readonly alpha: number;
  readonly outerColor: number;
  readonly innerColor: number;
  readonly glowRadius: number;
  readonly glowAlpha: number;
};

export type RestorationPetalVisual = {
  readonly texture: "petal" | "sparkle";
  readonly x: number;
  readonly y: number;
  readonly scale: number;
  readonly alpha: number;
  readonly rotation: number;
  readonly tint: number;
  readonly blend: "normal" | "add";
};

export type RestorationFrame = {
  readonly zone: RestorationZoneId;
  readonly restored: boolean;
  readonly calmPulse: number;
  readonly wiping: boolean;
  readonly decals: readonly DecalVisual[];
  readonly ring: RestorationRingVisual;
  readonly petals: readonly RestorationPetalVisual[];
};

const PETAL_TINTS: readonly number[] = [
  0xe86b99,
  0xf2a83c,
  0x54b885,
  0x5aa6e8,
  0xa474e0,
];

function decal(
  id: string,
  x: number,
  y: number,
  chaosFrame: ChaosDecalFrame,
  bloomFrame: BloomDecalFrame,
  options?: {
    scale?: number;
    chaosAlpha?: number;
    bloomAlpha?: number;
    chaosRotation?: number;
    bloomRotation?: number;
    chaosTint?: number;
    bloomTint?: number;
  },
): RestorationDecalSpec {
  const isDew = bloomFrame === "bloom_sunbeam_dew";
  return {
    id,
    x,
    y,
    chaosFrame,
    bloomFrame,
    scale: options?.scale ?? 0.5,
    chaosAlpha: options?.chaosAlpha ?? 0.92,
    bloomAlpha: options?.bloomAlpha ?? (isDew ? 0.68 : 0.88),
    chaosRotation: options?.chaosRotation ?? 0,
    bloomRotation: options?.bloomRotation ?? 0,
    chaosBlend: "multiply",
    chaosTint: options?.chaosTint ?? 0xe8d0ff,
    bloomBlend: isDew ? "add" : "normal",
    bloomTint: options?.bloomTint ?? 0xffffff,
  };
}

/**
 * Curated ground decal placements across Cloverhollow's 9 signature regions.
 * Every point is verified inside its area's walkable polygon with strict
 * clearance from painted prop silhouettes, footprints, blockers, triggers,
 * spawns, NPC body boxes, and set-piece critters.
 */
export const RESTORATION_ZONES: Readonly<Record<RestorationZoneId, RestorationZoneSpec>> = {
  plaza: {
    id: "plaza",
    anchor: { x: 960, y: 740 },
    ringColor: 0xdc8ee6,
    ringAccent: 0x6ed4b2,
    decals: [
      decal("plaza-fountain-sw", 780, 810, "chaos_fizzy_doodle", "bloom_sunbeam_dew", {
        scale: 0.56, chaosAlpha: 0.96, chaosRotation: -0.1, bloomTint: 0xfff0b8,
      }),
      decal("plaza-fountain-east", 1190, 770, "chaos_scribble_loop", "bloom_sunbeam_dew", {
        scale: 0.54, chaosAlpha: 0.96, chaosRotation: 0.14, bloomTint: 0xffeeb5,
      }),
      decal("plaza-flowerbed-edge", 1340, 830, "chaos_crumple_patch", "bloom_wildflowers", {
        scale: 0.54, chaosAlpha: 0.94, chaosRotation: -0.08, bloomRotation: 0.04,
      }),
      decal("plaza-south-border", 500, 860, "chaos_scribble_zigzag", "bloom_clover_tuft", {
        scale: 0.52, chaosAlpha: 0.94, chaosRotation: -0.14, bloomRotation: 0.05,
      }),
      decal("plaza-ne-cobbles", 1340, 560, "chaos_scribble_loop", "bloom_sunbeam_dew", {
        scale: 0.52, chaosAlpha: 0.92, chaosRotation: -0.16, bloomTint: 0xffefb8,
      }),
      decal("plaza-west-tree-edge", 320, 860, "chaos_crumple_patch", "bloom_meadow_sprig", {
        scale: 0.52, chaosAlpha: 0.92, chaosRotation: 0.09, bloomRotation: -0.04,
      }),
      decal("plaza-ne-tree-edge", 1490, 500, "chaos_fizzy_doodle", "bloom_wildflowers", {
        scale: 0.5, chaosAlpha: 0.92, chaosRotation: 0.12, bloomRotation: -0.04,
      }),
    ],
  },
  park: {
    id: "park",
    anchor: { x: 760, y: 610 },
    ringColor: 0xdc8ee6,
    ringAccent: 0x6ed4a4,
    decals: [
      decal("park-meadow-center", 665, 575, "chaos_crumple_patch", "bloom_sunbeam_dew", {
        scale: 0.56, chaosAlpha: 0.94, chaosRotation: 0.06, bloomTint: 0xfff0b8,
      }),
      decal("park-pup-den", 915, 630, "chaos_scribble_loop", "bloom_wildflowers", {
        scale: 0.5, chaosAlpha: 0.96, chaosRotation: -0.12, bloomRotation: 0.05,
      }),
      decal("park-sw-meadow", 540, 675, "chaos_scribble_zigzag", "bloom_clover_tuft", {
        scale: 0.48, chaosAlpha: 0.94, chaosRotation: 0.14, bloomRotation: -0.04,
      }),
      decal("park-lower-meadow", 705, 695, "chaos_fizzy_doodle", "bloom_meadow_sprig", {
        scale: 0.46, chaosAlpha: 0.96, chaosRotation: -0.1, bloomRotation: 0.04,
      }),
      decal("park-upper-east-grass", 835, 525, "chaos_scribble_loop", "bloom_wildflowers", {
        scale: 0.46, chaosAlpha: 0.94, chaosRotation: 0.15, bloomRotation: -0.04,
      }),
    ],
  },
  bay: {
    id: "bay",
    anchor: { x: 960, y: 690 },
    ringColor: 0xdc8ee6,
    ringAccent: 0x74d4f8,
    decals: [
      decal("bay-west-sand", 470, 740, "chaos_scribble_loop", "bloom_sunbeam_dew", {
        scale: 0.54, chaosAlpha: 0.94, chaosRotation: -0.14, bloomTint: 0xfff0c8,
      }),
      decal("bay-mid-shore", 650, 770, "chaos_fizzy_doodle", "bloom_meadow_sprig", {
        scale: 0.5, chaosAlpha: 0.94, chaosRotation: 0.12, bloomRotation: -0.04,
      }),
      decal("bay-cove-center", 800, 830, "chaos_crumple_patch", "bloom_sunbeam_dew", {
        scale: 0.54, chaosAlpha: 0.92, chaosRotation: -0.06, bloomTint: 0xdff6ff,
      }),
      decal("bay-shell-bank", 980, 860, "chaos_scribble_zigzag", "bloom_wildflowers", {
        scale: 0.5, chaosAlpha: 0.94, chaosRotation: 0.15, bloomRotation: 0.05,
      }),
      decal("bay-east-beach", 1340, 860, "chaos_scribble_loop", "bloom_sunbeam_dew", {
        scale: 0.52, chaosAlpha: 0.94, chaosRotation: -0.11, bloomTint: 0xffeec0,
      }),
      decal("bay-west-dunes", 440, 920, "chaos_crumple_patch", "bloom_clover_tuft", {
        scale: 0.48, chaosAlpha: 0.9, chaosRotation: 0.09, bloomRotation: -0.05,
      }),
      decal("bay-south-cove", 1190, 920, "chaos_fizzy_doodle", "bloom_meadow_sprig", {
        scale: 0.48, chaosAlpha: 0.92, chaosRotation: -0.15, bloomRotation: 0.03,
      }),
    ],
  },
  pass: {
    id: "pass",
    anchor: { x: 1010, y: 650 },
    ringColor: 0xd492eb,
    ringAccent: 0x86d8ff,
    decals: [
      decal("pass-center-snow", 830, 650, "chaos_scribble_loop", "bloom_sunbeam_dew", {
        scale: 0.54, chaosAlpha: 0.94, chaosRotation: 0.1, bloomTint: 0xfff5d4,
      }),
      decal("pass-west-clearing", 680, 710, "chaos_crumple_patch", "bloom_meadow_sprig", {
        scale: 0.52, chaosAlpha: 0.92, chaosRotation: -0.12, bloomRotation: 0.04,
      }),
      decal("pass-lodge-approach", 1010, 620, "chaos_fizzy_doodle", "bloom_sunbeam_dew", {
        scale: 0.52, chaosAlpha: 0.94, chaosRotation: 0.14, bloomTint: 0xffe9be,
      }),
      decal("pass-south-drift", 1100, 770, "chaos_scribble_zigzag", "bloom_clover_tuft", {
        scale: 0.48, chaosAlpha: 0.94, chaosRotation: -0.16, bloomRotation: -0.04,
      }),
      decal("pass-west-drift", 500, 740, "chaos_scribble_loop", "bloom_meadow_sprig", {
        scale: 0.48, chaosAlpha: 0.92, chaosRotation: 0.08, bloomRotation: 0.05,
      }),
      decal("pass-north-path", 770, 500, "chaos_crumple_patch", "bloom_sunbeam_dew", {
        scale: 0.48, chaosAlpha: 0.92, chaosRotation: -0.09, bloomTint: 0xdff4ff,
      }),
      decal("pass-trail-bend", 1370, 770, "chaos_fizzy_doodle", "bloom_clover_tuft", {
        scale: 0.48, chaosAlpha: 0.92, chaosRotation: 0.13, bloomRotation: -0.03,
      }),
    ],
  },
  woods: {
    id: "woods",
    anchor: { x: 1070, y: 710 },
    ringColor: 0xdc8ee6,
    ringAccent: 0x76d89e,
    decals: [
      decal("woods-owl-glade", 1070, 710, "chaos_scribble_loop", "bloom_wildflowers", {
        scale: 0.52, chaosAlpha: 0.96, chaosRotation: -0.12, bloomRotation: 0.04,
      }),
      decal("woods-stream-clearing", 830, 740, "chaos_crumple_patch", "bloom_clover_tuft", {
        scale: 0.54, chaosAlpha: 0.94, chaosRotation: 0.08, bloomRotation: -0.05,
      }),
      decal("woods-east-glade", 1250, 710, "chaos_fizzy_doodle", "bloom_sunbeam_dew", {
        scale: 0.52, chaosAlpha: 0.96, chaosRotation: 0.16, bloomTint: 0xfff3c8,
      }),
      decal("woods-mid-west", 650, 740, "chaos_scribble_zigzag", "bloom_meadow_sprig", {
        scale: 0.5, chaosAlpha: 0.94, chaosRotation: -0.14, bloomRotation: 0.05,
      }),
      decal("woods-south-moss", 950, 860, "chaos_scribble_loop", "bloom_wildflowers", {
        scale: 0.48, chaosAlpha: 0.94, chaosRotation: 0.11, bloomRotation: -0.04,
      }),
      decal("woods-west-oak", 470, 740, "chaos_crumple_patch", "bloom_clover_tuft", {
        scale: 0.48, chaosAlpha: 0.92, chaosRotation: -0.07, bloomRotation: 0.04,
      }),
      decal("woods-east-trail", 1400, 620, "chaos_fizzy_doodle", "bloom_sunbeam_dew", {
        scale: 0.5, chaosAlpha: 0.94, chaosRotation: -0.1, bloomTint: 0xfff2c2,
      }),
    ],
  },
  school: {
    id: "school",
    anchor: { x: 560, y: 650 },
    ringColor: 0xdc8ee6,
    ringAccent: 0xffd28a,
    // Indoor tiled school hallway: chaos crayons/crumples peel back into warm sunlit
    // window sunbeam & dew flourishes (no outdoor grass growing on indoor tiles!).
    decals: [
      decal("school-hall-west", 350, 650, "chaos_fizzy_doodle", "bloom_sunbeam_dew", {
        scale: 0.5, chaosAlpha: 0.94, bloomAlpha: 0.62, chaosRotation: -0.1, bloomTint: 0xfff1c4,
      }),
      decal("school-hall-center", 500, 590, "chaos_scribble_loop", "bloom_sunbeam_dew", {
        scale: 0.54, chaosAlpha: 0.96, bloomAlpha: 0.66, chaosRotation: 0.14, bloomTint: 0xfff4cf,
      }),
      decal("school-hall-mid", 680, 560, "chaos_crumple_patch", "bloom_sunbeam_dew", {
        scale: 0.52, chaosAlpha: 0.92, bloomAlpha: 0.62, chaosRotation: -0.08, bloomTint: 0xffeec2,
      }),
      decal("school-hall-east", 830, 620, "chaos_scribble_zigzag", "bloom_sunbeam_dew", {
        scale: 0.5, chaosAlpha: 0.94, bloomAlpha: 0.62, chaosRotation: 0.12, bloomTint: 0xfff2c8,
      }),
      decal("school-lockers-turn", 980, 680, "chaos_fizzy_doodle", "bloom_sunbeam_dew", {
        scale: 0.48, chaosAlpha: 0.92, bloomAlpha: 0.6, chaosRotation: -0.14, bloomTint: 0xfff4d2,
      }),
    ],
  },
  hills: {
    id: "hills",
    anchor: { x: 960, y: 680 },
    ringColor: 0xdc8ee6,
    ringAccent: 0x76db98,
    decals: [
      decal("hills-west-meadow", 530, 620, "chaos_scribble_loop", "bloom_wildflowers", {
        scale: 0.54, chaosAlpha: 0.94, chaosRotation: -0.12, bloomRotation: 0.04,
      }),
      decal("hills-center-slope", 710, 620, "chaos_crumple_patch", "bloom_clover_tuft", {
        scale: 0.54, chaosAlpha: 0.92, chaosRotation: 0.09, bloomRotation: -0.05,
      }),
      decal("hills-mid-ridge", 860, 560, "chaos_scribble_zigzag", "bloom_sunbeam_dew", {
        scale: 0.54, chaosAlpha: 0.94, chaosRotation: -0.15, bloomTint: 0xfff3c6,
      }),
      decal("hills-east-ridge", 1160, 680, "chaos_fizzy_doodle", "bloom_wildflowers", {
        scale: 0.52, chaosAlpha: 0.96, chaosRotation: 0.13, bloomRotation: 0.05,
      }),
      decal("hills-south-slope", 830, 740, "chaos_scribble_loop", "bloom_meadow_sprig", {
        scale: 0.5, chaosAlpha: 0.94, chaosRotation: -0.1, bloomRotation: -0.04,
      }),
      decal("hills-taco-meadow", 1310, 740, "chaos_crumple_patch", "bloom_clover_tuft", {
        scale: 0.52, chaosAlpha: 0.94, chaosRotation: 0.07, bloomRotation: 0.04,
      }),
      decal("hills-park-entry", 410, 740, "chaos_fizzy_doodle", "bloom_meadow_sprig", {
        scale: 0.5, chaosAlpha: 0.92, chaosRotation: 0.11, bloomRotation: -0.03,
      }),
    ],
  },
  cavern: {
    id: "cavern",
    anchor: { x: 860, y: 580 },
    ringColor: 0xc292f2,
    ringAccent: 0x7ce0ff,
    decals: [
      decal("cavern-west-bank", 620, 620, "chaos_scribble_loop", "bloom_sunbeam_dew", {
        scale: 0.52, chaosAlpha: 0.94, bloomAlpha: 0.72, chaosRotation: -0.14, bloomTint: 0xd4f2ff,
      }),
      decal("cavern-west-grotto", 320, 650, "chaos_fizzy_doodle", "bloom_meadow_sprig", {
        scale: 0.48, chaosAlpha: 0.92, bloomAlpha: 0.8, chaosRotation: 0.12, bloomTint: 0xe2f5ff,
      }),
      decal("cavern-south-entry", 680, 770, "chaos_crumple_patch", "bloom_clover_tuft", {
        scale: 0.5, chaosAlpha: 0.92, bloomAlpha: 0.78, chaosRotation: -0.08, bloomTint: 0xdef7ec,
      }),
      decal("cavern-crossing-stone", 920, 530, "chaos_scribble_zigzag", "bloom_sunbeam_dew", {
        scale: 0.5, chaosAlpha: 0.94, bloomAlpha: 0.74, chaosRotation: 0.15, bloomTint: 0xffeec4,
      }),
      decal("cavern-east-grotto", 1130, 560, "chaos_scribble_loop", "bloom_sunbeam_dew", {
        scale: 0.52, chaosAlpha: 0.94, bloomAlpha: 0.74, chaosRotation: -0.11, bloomTint: 0xcceeff,
      }),
      decal("cavern-spring-edge", 1280, 650, "chaos_fizzy_doodle", "bloom_meadow_sprig", {
        scale: 0.48, chaosAlpha: 0.92, bloomAlpha: 0.8, chaosRotation: 0.1, bloomTint: 0xe0f5ff,
      }),
    ],
  },
  enchanted: {
    id: "enchanted",
    anchor: { x: 960, y: 710 },
    ringColor: 0xd48cf2,
    ringAccent: 0xffe07c,
    decals: [
      decal("enchanted-tree-front", 950, 740, "chaos_scribble_loop", "bloom_sunbeam_dew", {
        scale: 0.56, chaosAlpha: 0.96, bloomAlpha: 0.76, chaosRotation: -0.12, bloomTint: 0xfff2bf,
      }),
      decal("enchanted-mid-clearing", 710, 560, "chaos_crumple_patch", "bloom_wildflowers", {
        scale: 0.52, chaosAlpha: 0.94, chaosRotation: 0.1, bloomRotation: -0.04,
      }),
      decal("enchanted-pond-north", 530, 560, "chaos_fizzy_doodle", "bloom_clover_tuft", {
        scale: 0.5, chaosAlpha: 0.94, chaosRotation: -0.14, bloomRotation: 0.05,
      }),
      decal("enchanted-entry-glade", 350, 440, "chaos_scribble_zigzag", "bloom_meadow_sprig", {
        scale: 0.5, chaosAlpha: 0.94, chaosRotation: 0.16, bloomRotation: -0.03,
      }),
      decal("enchanted-east-roots", 1220, 800, "chaos_fizzy_doodle", "bloom_wildflowers", {
        scale: 0.52, chaosAlpha: 0.96, chaosRotation: -0.09, bloomRotation: 0.04,
      }),
    ],
  },
};

export function isRestorationZoneId(areaId: string): areaId is RestorationZoneId {
  return Object.prototype.hasOwnProperty.call(RESTORATION_ZONES, areaId);
}

function inkTrue(world: World, state: State, name: string): boolean {
  return world.storyVariable(state.ink, name) === true;
}

/**
 * Projects an area's deterministic chaos-vs-restored state solely from existing
 * core `state.critters`, `state.calms`, `state.stickers`, and `state.ink` facts
 * (zero new core fields or save-version changes).
 */
export function evaluateAreaRestoration(
  world: World,
  state: State,
  areaId = state.area,
): RestorationStatus | null {
  if (!isRestorationZoneId(areaId)) return null;
  const spec = RESTORATION_ZONES[areaId];
  let restored = false;

  switch (areaId) {
    case "plaza":
      restored = calmedFact(world, state, "fountain-frog");
      break;
    case "park":
      restored = isSpeciesCalmed(world, state, "pup");
      break;
    case "bay": {
      const bluebirdCalm =
        isSpeciesCalmed(world, state, "bluebird") || inkTrue(world, state, "bluebird_calmed");
      const lifeguardChaotic =
        inkTrue(world, state, "lifeguard_back") && !calmedFact(world, state, "lifeguard");
      restored = bluebirdCalm && !lifeguardChaotic;
      break;
    }
    case "pass": {
      const hamsterCalm =
        isSpeciesCalmed(world, state, "hamster") || inkTrue(world, state, "lodge_open");
      const keeperChaotic =
        inkTrue(world, state, "keeper_back") && !calmedFact(world, state, "lodge-keeper");
      restored = hamsterCalm && !keeperChaotic;
      break;
    }
    case "woods": {
      const owlCalm =
        isSpeciesCalmed(world, state, "owl") || inkTrue(world, state, "clubhouse_claimed");
      const moonOwlChaotic =
        inkTrue(world, state, "moon_owl_out") && !calmedFact(world, state, "moon-owl");
      restored = owlCalm && !moonOwlChaotic;
      break;
    }
    case "school":
      restored = calmedFact(world, state, "principal");
      break;
    case "hills": {
      const wildCalm =
        isSpeciesCalmed(world, state, "lamb") ||
        isSpeciesCalmed(world, state, "hedgehog") ||
        calmedFact(world, state, "taco-chef");
      const chefChaotic =
        inkTrue(world, state, "taco_chef_out") && !calmedFact(world, state, "taco-chef");
      restored = wildCalm && !chefChaotic;
      break;
    }
    case "cavern":
      restored =
        (isSpeciesCalmed(world, state, "bat") && isSpeciesCalmed(world, state, "crystal-mole")) ||
        inkTrue(world, state, "cavern_chime_rung");
      break;
    case "enchanted":
      restored =
        world.storyVariable(state.ink, "forest_fizzy") === false ||
        calmedFact(world, state, "hooded-kid");
      break;
  }

  return {
    zone: spec.id,
    anchor: spec.anchor,
    restored,
    ringColor: spec.ringColor,
    ringAccent: spec.ringAccent,
    decals: spec.decals,
  };
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function smoothstep(t: number): number {
  const c = clamp01(t);
  return c * c * (3 - 2 * c);
}

function easeOutCubic(t: number): number {
  const c = clamp01(t);
  const inv = 1 - c;
  return 1 - inv * inv * inv;
}

function easeOutBack(t: number): number {
  const c = clamp01(t);
  const c1 = 1.45;
  const c3 = c1 + 1;
  const inv = c - 1;
  return 1 + c3 * inv * inv * inv + c1 * inv * inv;
}

function hashSeed(text: string, index: number): number {
  let hash = Math.imul(index + 1, 2654435761) >>> 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = Math.imul(hash ^ text.charCodeAt(i), 16777619) >>> 0;
  }
  return hash / 0x100000000;
}

/**
 * Pure state-transition step for the 90-frame Watercolor Wash-Bloom Wipe (`calmPulse`).
 * - Instant (`calmPulse` snaps to 0 or 1, zero wipe) under Reduced Motion, paused
 *   harness mode, fresh arrival, area switch, or harness reset/rewind.
 * - Holds state untouched while battle/arcade hides the overworld so the wash-bloom
 *   wipe plays cleanly the moment Fae returns to the overworld after calming chaos.
 */
export function advanceRestorationPulse(
  previous: RestorationPulseState | null,
  areaId: string,
  restored: boolean,
  tick: number,
  options: { instant: boolean; overworldVisible: boolean },
): RestorationPulseStep {
  if (
    !options.overworldVisible &&
    previous !== null &&
    previous.areaId === areaId &&
    tick >= previous.lastTick
  ) {
    const settled = previous.wasRestored ? 1 : 0;
    return {
      next: { ...previous, lastTick: tick },
      calmPulse: previous.pulseStartTick !== null
        ? clamp01((tick - previous.pulseStartTick) / RESTORATION_PULSE_TICKS)
        : settled,
      wiping: false,
    };
  }

  const resetContext =
    previous === null || previous.areaId !== areaId || tick < previous.lastTick;

  if (options.instant || resetContext) {
    return {
      next: { areaId, wasRestored: restored, pulseStartTick: null, lastTick: tick },
      calmPulse: restored ? 1 : 0,
      wiping: false,
    };
  }

  if (!restored) {
    return {
      next: { areaId, wasRestored: false, pulseStartTick: null, lastTick: tick },
      calmPulse: 0,
      wiping: false,
    };
  }

  // Live transition from chaotic -> restored in the same area: begin the 90-frame wipe!
  if (!previous.wasRestored) {
    return {
      next: { areaId, wasRestored: true, pulseStartTick: tick, lastTick: tick },
      calmPulse: 0,
      wiping: true,
    };
  }

  if (previous.pulseStartTick !== null) {
    const elapsed = tick - previous.pulseStartTick;
    if (elapsed >= RESTORATION_PULSE_TICKS) {
      return {
        next: { areaId, wasRestored: true, pulseStartTick: null, lastTick: tick },
        calmPulse: 1,
        wiping: false,
      };
    }
    return {
      next: { areaId, wasRestored: true, pulseStartTick: previous.pulseStartTick, lastTick: tick },
      calmPulse: clamp01(elapsed / RESTORATION_PULSE_TICKS),
      wiping: true,
    };
  }

  return {
    next: { areaId, wasRestored: true, pulseStartTick: null, lastTick: tick },
    calmPulse: 1,
    wiping: false,
  };
}

/** Computes the furthest decal distance from the zone anchor so the wipe clears every patch. */
export function restorationMaxRadius(status: RestorationStatus): number {
  let furthest = 320;
  for (const item of status.decals) {
    const dist = Math.hypot(item.x - status.anchor.x, item.y - status.anchor.y);
    if (dist > furthest) furthest = dist;
  }
  return furthest + 180;
}

/**
 * Evaluates all per-decal transforms, the expanding watercolor wash-bloom ring,
 * and the drifting petal/sparkle burst for the current frame.
 */
export function evaluateRestorationFrame(
  status: RestorationStatus,
  calmPulse: number,
  wiping: boolean,
  tick: number,
  steadyVisuals: boolean,
): RestorationFrame {
  const pulse = clamp01(calmPulse);
  const maxRadius = restorationMaxRadius(status);
  const waveBand = 160;
  const waveRadius = easeOutCubic(pulse) * (maxRadius + waveBand);

  const decals: DecalVisual[] = status.decals.map((spec, index) => {
    const phase = hashSeed(spec.id, index) * Math.PI * 2;
    const liveBreath = steadyVisuals ? 0 : Math.sin(tick * 0.045 + phase);
    const liveTilt = steadyVisuals ? 0 : Math.sin(tick * 0.032 + phase) * 0.025;

    if (!status.restored) {
      const shimmer = spec.chaosFrame === "chaos_fizzy_doodle" ? 1 + liveBreath * 0.04 : 1;
      return {
        id: spec.id,
        x: spec.x,
        y: spec.y,
        chaosFrame: spec.chaosFrame,
        chaosAlpha: clamp01(spec.chaosAlpha * shimmer),
        chaosScale: spec.scale * (1 + liveBreath * 0.015),
        chaosRotation: spec.chaosRotation + liveTilt * 0.5,
        chaosBlend: spec.chaosBlend,
        chaosTint: spec.chaosTint,
        bloomFrame: spec.bloomFrame,
        bloomAlpha: 0,
        bloomScale: 0,
        bloomRotation: spec.bloomRotation,
        bloomBlend: spec.bloomBlend,
        bloomTint: spec.bloomTint,
      };
    }

    if (!wiping || pulse >= 1) {
      const dewShimmer =
        spec.bloomFrame === "bloom_sunbeam_dew" ? 1 + liveBreath * 0.09 : 1;
      const sway = spec.bloomFrame === "bloom_sunbeam_dew" ? 0 : liveTilt;
      return {
        id: spec.id,
        x: spec.x,
        y: spec.y,
        chaosFrame: spec.chaosFrame,
        chaosAlpha: 0,
        chaosScale: 0,
        chaosRotation: spec.chaosRotation,
        chaosBlend: spec.chaosBlend,
        chaosTint: spec.chaosTint,
        bloomFrame: spec.bloomFrame,
        bloomAlpha: clamp01(spec.bloomAlpha * dewShimmer),
        bloomScale: spec.scale * (1 + liveBreath * 0.015),
        bloomRotation: spec.bloomRotation + sway,
        bloomBlend: spec.bloomBlend,
        bloomTint: spec.bloomTint,
      };
    }

    const dist = Math.hypot(spec.x - status.anchor.x, spec.y - status.anchor.y);
    const localT = clamp01((waveRadius - dist) / waveBand);
    const peel = clamp01(localT / 0.55);
    const unfurl = clamp01((localT - 0.25) / 0.75);

    return {
      id: spec.id,
      x: spec.x,
      y: spec.y,
      chaosFrame: spec.chaosFrame,
      chaosAlpha: spec.chaosAlpha * (1 - smoothstep(peel)),
      chaosScale: spec.scale * (1 - 0.18 * peel),
      chaosRotation: spec.chaosRotation + peel * 0.12,
      chaosBlend: spec.chaosBlend,
      chaosTint: spec.chaosTint,
      bloomFrame: spec.bloomFrame,
      bloomAlpha: spec.bloomAlpha * smoothstep(unfurl),
      bloomScale: unfurl <= 0 ? 0 : spec.scale * (0.45 + 0.55 * easeOutBack(unfurl)),
      bloomRotation: spec.bloomRotation + (1 - smoothstep(unfurl)) * 0.08,
      bloomBlend: spec.bloomBlend,
      bloomTint: spec.bloomTint,
    };
  });

  const showFx = wiping && !steadyVisuals && pulse > 0 && pulse < 1;
  const envelope = Math.sin(pulse * Math.PI);
  const ring: RestorationRingVisual = {
    visible: showFx,
    x: status.anchor.x,
    y: status.anchor.y,
    radius: Math.max(24, waveRadius),
    thickness: 46 + 26 * envelope,
    alpha: showFx ? envelope * 0.78 : 0,
    outerColor: status.ringColor,
    innerColor: status.ringAccent,
    glowRadius: Math.max(70, waveRadius * 0.85),
    glowAlpha: showFx ? envelope * 0.34 : 0,
  };

  const petals: RestorationPetalVisual[] = [];
  if (showFx) {
    for (let i = 0; i < RESTORATION_PETAL_COUNT; i += 1) {
      const stagger = (i % 8) * 0.032;
      const local = clamp01((pulse - stagger) / Math.max(0.2, 1 - stagger));
      if (local <= 0 || local >= 1) continue;
      const angle = (i / RESTORATION_PETAL_COUNT) * Math.PI * 2 + hashSeed(status.zone, i) * 0.42;
      const bandFactor = i % 2 === 0
        ? 0.78 + hashSeed(`${status.zone}:spd`, i) * 0.24
        : 0.46 + hashSeed(`${status.zone}:spd`, i) * 0.34;
      const radius = waveRadius * bandFactor + 20;
      const flutter = Math.sin(local * Math.PI * 3 + i * 1.3) * 22;
      const perpX = -Math.sin(angle);
      const perpY = Math.cos(angle);
      const isSparkle = i % 4 === 0;
      const fade = Math.sin(local * Math.PI);
      petals.push({
        texture: isSparkle ? "sparkle" : "petal",
        x: status.anchor.x + Math.cos(angle) * radius + perpX * flutter,
        y: status.anchor.y + Math.sin(angle) * radius + perpY * flutter - local * 34,
        scale: (isSparkle ? 0.72 : 1.18) + hashSeed(`${status.zone}:sc`, i) * 0.52,
        alpha: fade * (isSparkle ? 0.95 : 0.96),
        rotation: angle + local * (isSparkle ? 1.5 : 3.6),
        tint: PETAL_TINTS[i % PETAL_TINTS.length] ?? 0xf2a83c,
        blend: isSparkle ? "add" : "normal",
      });
    }
  }

  return {
    zone: status.zone,
    restored: status.restored,
    calmPulse: pulse,
    wiping: showFx,
    decals,
    ring,
    petals,
  };
}
