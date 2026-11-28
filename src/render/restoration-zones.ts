import type { Point } from "../core";

export const RESTORATION_ZONE_IDS = [
  "plaza", "park", "bay", "pass", "woods", "school", "hills", "cavern", "enchanted",
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
