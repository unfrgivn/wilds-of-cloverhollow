import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadContent } from "../../src/content/load";
import { ambientFor } from "../../src/content/ambient";
import { areaConnectionErrors } from "../../src/content/area-checks";
import {
  createState,
  pointInPolygon,
  sceneryArea,
  surfaceAt,
  targetInteractable,
  type Direction,
  type State,
} from "../../src/core";
import {
  shouldFlushSaveOnHide,
  shouldFreezeLiveLoop,
  type SaveFlushContext,
} from "../../src/shell/lifecycle";
import { evaluateAtmosphere as evaluateFromRenderer } from "../../src/render/atmosphere";
import { evaluateAtmosphere as evaluateFromRecipes } from "../../src/render/atmosphere-recipes";
import { findRestSpot, REST_SPOTS } from "../../src/render/companions";

const { world, fixtures } = loadContent();

function stateForArea(areaId: string): State {
  const fixture = fixtures[areaId] ?? fixtures["new-game"];
  if (fixture === undefined) throw new Error("Missing new-game fixture");
  return { ...createState(world, fixture), area: areaId };
}

function ambientAtlasAnimations(): Record<string, unknown> {
  const raw: unknown = JSON.parse(readFileSync("public/assets/ambient/ambient.json", "utf8"));
  if (typeof raw !== "object" || raw === null || !("animations" in raw)) {
    throw new Error("Invalid ambient atlas");
  }
  const { animations } = raw;
  if (typeof animations !== "object" || animations === null || Array.isArray(animations)) {
    throw new Error("Missing ambient animations");
  }
  return Object.fromEntries(Object.entries(animations));
}

describe("Milestone 119: Resilient Background Lifecycle & pagehide Autosave Flush", () => {
  it("freezes live loop on loading or hidden unpaused tab without affecting paused mode", () => {
    expect(shouldFreezeLiveLoop({ documentHidden: false, paused: false, areaLoading: false }))
      .toBe(false);
    expect(shouldFreezeLiveLoop({ documentHidden: true, paused: false, areaLoading: false }))
      .toBe(true);
    expect(shouldFreezeLiveLoop({ documentHidden: false, paused: true, areaLoading: false }))
      .toBe(false);
    expect(shouldFreezeLiveLoop({ documentHidden: true, paused: true, areaLoading: false }))
      .toBe(false);
    expect(shouldFreezeLiveLoop({ documentHidden: false, paused: false, areaLoading: true }))
      .toBe(true);
    expect(shouldFreezeLiveLoop({ documentHidden: true, paused: false, areaLoading: true }))
      .toBe(true);
    expect(shouldFreezeLiveLoop({ documentHidden: false, paused: true, areaLoading: true }))
      .toBe(true);
    expect(shouldFreezeLiveLoop({ documentHidden: true, paused: true, areaLoading: true }))
      .toBe(true);
  });

  it("flushes quiet autosave on hide/pagehide only in eligible live overworld states", () => {
    const eligible: SaveFlushContext = {
      qaActive: false,
      titleOpen: false,
      area: "plaza",
      inFinale: false,
      inBattle: false,
      inArcade: false,
      autosaveNeeded: true,
    };
    expect(shouldFlushSaveOnHide(eligible)).toBe(true);
    expect(shouldFlushSaveOnHide({ ...eligible, area: "trail" })).toBe(true);
    expect(shouldFlushSaveOnHide({ ...eligible, qaActive: true })).toBe(false);
    expect(shouldFlushSaveOnHide({ ...eligible, titleOpen: true })).toBe(false);
    expect(shouldFlushSaveOnHide({ ...eligible, area: "harness" })).toBe(false);
    expect(shouldFlushSaveOnHide({ ...eligible, inFinale: true })).toBe(false);
    expect(shouldFlushSaveOnHide({ ...eligible, inBattle: true })).toBe(false);
    expect(shouldFlushSaveOnHide({ ...eligible, inArcade: true })).toBe(false);
    expect(shouldFlushSaveOnHide({ ...eligible, autosaveNeeded: false })).toBe(false);
  });
});

describe("Milestone 119: 16-Area Cozy Resting & Coastal Trail Butterflies", () => {
  it("keeps all 22 resting areas inside walkable and clear of blockers and triggers", () => {
    const areas = new Set(REST_SPOTS.map((spot) => spot.area));
    expect(areas.size).toBe(22);
    expect(areas.has("kitchen")).toBe(true);
    expect(areas.has("trail")).toBe(true);

    const directions: readonly Direction[] = ["up", "down", "left", "right"];
    for (const spot of REST_SPOTS) {
      const area = world.areas[spot.area];
      if (area === undefined) throw new Error(`Missing area ${spot.area}`);
      const base = stateForArea(spot.area);
      const scenery = sceneryArea(world, base.ink, area);

      const points: readonly { label: string; x: number; y: number }[] = [
        { label: "anchor", x: spot.x, y: spot.y },
        { label: "seat", x: spot.seatX, y: spot.seatY },
      ];
      for (const pt of points) {
        expect(
          pointInPolygon(pt, area.walkable),
          `${spot.id} ${pt.label} inside ${spot.area}.walkable`,
        ).toBe(true);
        for (const blocker of scenery.blockers) {
          expect(
            pointInPolygon(pt, blocker),
            `${spot.id} ${pt.label} outside ${spot.area} blockers`,
          ).toBe(false);
        }
        for (const trigger of area.triggers) {
          expect(
            pointInPolygon(pt, trigger.polygon),
            `${spot.id} ${pt.label} outside trigger ${trigger.id}`,
          ).toBe(false);
        }
        for (const npc of area.npcs) {
          expect(
            pointInPolygon(pt, npc.footprint),
            `${spot.id} ${pt.label} outside NPC ${npc.id} footprint`,
          ).toBe(false);
        }
        for (const prop of area.props ?? []) {
          for (const propState of Object.values(prop.states)) {
            for (const polygon of propState.footprint ?? []) {
              expect(
                pointInPolygon(pt, polygon),
                `${spot.id} ${pt.label} outside prop ${prop.id} footprint`,
              ).toBe(false);
            }
          }
        }
      }

      if (spot.area === "kitchen" || spot.area === "trail") {
        for (const facing of directions) {
          const atSpot: State = {
            ...base,
            player: { x: spot.x, y: spot.y },
            facing,
            party: [],
          };
          expect(
            targetInteractable(world, atSpot),
            `${spot.id} facing ${facing} has no interactable conflict`,
          ).toBeUndefined();
          expect(findRestSpot(world, atSpot)?.id).toBe(spot.id);
        }
      }
    }

    // Kitchen rest spot sits squarely on the living-room oval rug beside the sofa.
    const kitchenSpot = REST_SPOTS.find((spot) => spot.id === "kitchen-sofa-rug");
    if (kitchenSpot === undefined) throw new Error("Missing kitchen-sofa-rug");
    const kitchenSurface = world.surfaces.kitchen;
    if (kitchenSurface === undefined) throw new Error("Missing kitchen surface map");
    expect(surfaceAt(kitchenSurface, { x: kitchenSpot.x, y: kitchenSpot.y })).toBe("carpet");
  });

  it("gives Coastal Trail two bounded ambient butterflies with clean area connections", () => {
    const trail = world.areas.trail;
    if (trail === undefined) throw new Error("Missing trail area");
    const animations = ambientAtlasAnimations();
    const flyers = ambientFor(trail);
    expect(flyers).toHaveLength(2);
    expect(flyers.map((flyer) => flyer.animation).sort()).toEqual([
      "butterfly_blue",
      "butterfly_pink",
    ]);

    for (const flyer of flyers) {
      expect(animations, `${flyer.id} animation`).toHaveProperty(flyer.animation);
      expect(flyer.size).toBeGreaterThanOrEqual(18);
      expect(flyer.size).toBeLessThanOrEqual(19);
      expect(flyer.path.length).toBeGreaterThanOrEqual(3);
      for (const [px, py] of flyer.path) {
        expect(px, `${flyer.id} x`).toBeGreaterThanOrEqual(80);
        expect(px, `${flyer.id} x`).toBeLessThanOrEqual(trail.width - 80);
        expect(py, `${flyer.id} y`).toBeGreaterThanOrEqual(80);
        expect(py, `${flyer.id} y`).toBeLessThanOrEqual(trail.height - 80);
      }
    }

    expect(
      areaConnectionErrors(world.areas, world.tunables, world.critters, world.party),
    ).toEqual([]);
  });
});

describe("Milestone 119: Biome Atmosphere Parity & Full-Biome Reduced Motion Calm", () => {
  it("matches across all areas and freezes every biome cleanly under reducedMotion", () => {
    const allAreas = Object.values(world.areas);
    expect(allAreas.length).toBeGreaterThanOrEqual(26);

    for (const area of allAreas) {
      const fromRecipes = evaluateFromRecipes(area.id, area.width, area.height, 120);
      const fromRenderer = evaluateFromRenderer(area.id, area.width, area.height, 120);
      expect(fromRecipes, `${area.id} parity`).toEqual(fromRenderer);

      const calm0 = evaluateFromRecipes(area.id, area.width, area.height, 0, {
        reducedMotion: true,
      });
      const calm240 = evaluateFromRecipes(area.id, area.width, area.height, 240, {
        reducedMotion: true,
      });
      expect(calm240, `${area.id} reducedMotion freezes across ticks`).toEqual(calm0);
    }
  });
});
