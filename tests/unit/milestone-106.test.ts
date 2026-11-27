import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  createState,
  pointInPolygon,
  sceneryArea,
  targetInteractable,
  type State,
} from "../../src/core";
import { areaConnectionErrors } from "../../src/content/area-checks";
import { ambientFor } from "../../src/content/ambient";
import { loadContent } from "../../src/content/load";
import { voiceForSpeaker } from "../../src/platform/voices";
import { findRestSpot, REST_SPOTS } from "../../src/render/companions";
import { cropCreditFrame } from "../../src/shell/assets";
import { speakerAccent } from "../../src/ui/portraits";

const { world, fixtures } = loadContent();

function stateForArea(areaId: string): State {
  const fixture = fixtures[areaId] ?? fixtures["new-game"];
  if (fixture === undefined) throw new Error(`Missing base fixture for ${areaId}`);
  const base = createState(world, fixture, 1);
  return { ...base, area: areaId };
}

function ambientAtlasAnimations(): Record<string, unknown> {
  const parsed: unknown = JSON.parse(
    readFileSync(new URL("../../public/assets/ambient/ambient.json", import.meta.url), "utf8"),
  );
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("ambient atlas missing");
  }
  const animations = Reflect.get(parsed, "animations");
  if (typeof animations !== "object" || animations === null || Array.isArray(animations)) {
    throw new Error("ambient animations missing");
  }
  return Object.fromEntries(Object.entries(animations));
}

describe("Milestone 106: Wildlife Flyers, Credits Scaling, Shop Voices & 14-Area Resting", () => {
  it("gives park, hills, field, woods, mist, and plaza bounded valid ambient flyers", () => {
    const animations = ambientAtlasAnimations();
    const expected: Record<string, { count: number; allowed: readonly string[] }> = {
      park: { count: 3, allowed: ["butterfly_pink", "butterfly_blue"] },
      hills: { count: 3, allowed: ["butterfly_pink", "butterfly_blue"] },
      field: { count: 2, allowed: ["butterfly_pink", "butterfly_blue"] },
      woods: { count: 3, allowed: ["fairy_light"] },
      mist: { count: 4, allowed: ["fairy_light"] },
      plaza: { count: 2, allowed: ["butterfly_pink", "butterfly_blue"] },
    };

    for (const [areaId, rule] of Object.entries(expected)) {
      const area = world.areas[areaId];
      if (area === undefined) throw new Error(`Missing area ${areaId}`);
      const flyers = ambientFor(area);
      expect(flyers, `${areaId} flyer count`).toHaveLength(rule.count);
      for (const flyer of flyers) {
        expect(animations, `${areaId}:${flyer.id} animation`).toHaveProperty(flyer.animation);
        expect(rule.allowed, `${areaId}:${flyer.id} kind`).toContain(flyer.animation);
        expect(flyer.size, `${areaId}:${flyer.id} size`).toBeGreaterThanOrEqual(16);
        expect(flyer.size, `${areaId}:${flyer.id} size`).toBeLessThanOrEqual(20);
        for (const [px, py] of flyer.path) {
          expect(px, `${areaId}:${flyer.id} x`).toBeGreaterThanOrEqual(80);
          expect(px, `${areaId}:${flyer.id} x`).toBeLessThanOrEqual(area.width - 80);
          expect(py, `${areaId}:${flyer.id} y`).toBeGreaterThanOrEqual(80);
          expect(py, `${areaId}:${flyer.id} y`).toBeLessThanOrEqual(area.height - 80);
        }
      }
    }

    expect(
      areaConnectionErrors(world.areas, world.tunables, world.critters, world.party),
    ).toEqual([]);
  });

  it("cropCreditFrame crops small 256x256 animal sheets inside bounds and keeps larger", () => {
    const small = { x: 256, y: 512, w: 256, h: 256 };
    const cropped = cropCreditFrame(small);
    expect(cropped.x).toBeGreaterThanOrEqual(small.x);
    expect(cropped.y).toBeGreaterThanOrEqual(small.y);
    expect(cropped.x + cropped.w).toBeLessThanOrEqual(small.x + small.w);
    expect(cropped.y + cropped.h).toBeLessThanOrEqual(small.y + small.h);
    expect(cropped.w).toBeLessThan(small.w);
    expect(cropped.h).toBeLessThan(small.h);
    expect(cropped).toEqual({ x: 302, y: 614, w: 164, h: 148 });

    const kid = { x: 0, y: 0, w: 384, h: 384 };
    const tall = { x: 0, y: 0, w: 448, h: 448 };
    const critter = { x: 512, y: 0, w: 512, h: 512 };
    expect(cropCreditFrame(kid)).toEqual(kid);
    expect(cropCreditFrame(tall)).toEqual(tall);
    expect(cropCreditFrame(critter)).toEqual(critter);
  });

  it("assigns distinct warm voices and town accents to regional shopkeepers", () => {
    const speakers = ["Baker", "Grocer", "Scoops", "Cocoa seller"] as const;
    const fallback = voiceForSpeaker("Unknown Townsfolk");
    const serialized = new Set<string>();

    for (const speaker of speakers) {
      const voice = voiceForSpeaker(speaker);
      expect(voice, `${speaker} should not fall back`).not.toEqual(fallback);
      expect(speakerAccent(speaker), `${speaker} accent`).toBe("town");
      serialized.add(JSON.stringify(voice));
    }
    expect(serialized.size).toBe(speakers.length);

    expect(voiceForSpeaker("Sanctuary Board")).toEqual(voiceForSpeaker(null));
    expect(voiceForSpeaker("Flyer")).toEqual(voiceForSpeaker(null));
    expect(voiceForSpeaker("Glow Note")).toEqual(voiceForSpeaker(null));
    expect(voiceForSpeaker("Trail Note")).toEqual(voiceForSpeaker(null));
  });

  it("validates all 18 resting areas strictly inside walkable floor and clear of obstacles", () => {
    const areas = new Set(REST_SPOTS.map((spot) => spot.area));
    expect(areas.size).toBe(18);
    expect([...areas].sort()).toEqual([
      "bay",
      "bedroom",
      "cafe",
      "clubhouse",
      "enchanted",
      "hills",
      "jordan-cabin",
      "kitchen",
      "lodge",
      "market",
      "park",
      "parlor",
      "pass",
      "plaza",
      "sanctuary",
      "sue-cottage",
      "trail",
      "woods",
    ]);

    const newAreas = new Set(["bedroom", "pass", "woods", "hills", "enchanted"]);
    for (const spot of REST_SPOTS) {
      const area = world.areas[spot.area];
      if (area === undefined) throw new Error(`Missing area ${spot.area}`);
      const base = stateForArea(spot.area);
      const scenery = sceneryArea(world, base.ink, area);

      for (const [label, pt] of [
        ["anchor", { x: spot.x, y: spot.y }],
        ["seat", { x: spot.seatX, y: spot.seatY }],
      ] as const) {
        expect(
          pointInPolygon(pt, area.walkable),
          `${spot.id} ${label} inside ${spot.area}.walkable`,
        ).toBe(true);
        for (const blocker of scenery.blockers) {
          expect(
            pointInPolygon(pt, blocker),
            `${spot.id} ${label} outside ${spot.area} blockers`,
          ).toBe(false);
        }
        for (const trigger of area.triggers) {
          expect(
            pointInPolygon(pt, trigger.polygon),
            `${spot.id} ${label} outside trigger ${trigger.id}`,
          ).toBe(false);
        }
        for (const npc of area.npcs) {
          expect(
            pointInPolygon(pt, npc.footprint),
            `${spot.id} ${label} outside NPC ${npc.id}`,
          ).toBe(false);
        }
        for (const prop of area.props ?? []) {
          for (const state of Object.values(prop.states)) {
            if (state.footprint === undefined) continue;
            for (const polygon of state.footprint) {
              expect(
                pointInPolygon(pt, polygon),
                `${spot.id} ${label} outside prop ${prop.id} footprint`,
              ).toBe(false);
            }
          }
        }
      }

      if (newAreas.has(spot.area)) {
        const atSpot: State = {
          ...base,
          player: { x: spot.x, y: spot.y },
          facing: spot.facing,
          party: [],
        };
        expect(targetInteractable(world, atSpot), `${spot.id} interactable`).toBeUndefined();
        expect(findRestSpot(world, atSpot)?.id, spot.id).toBe(spot.id);
      }
    }
  });
});
