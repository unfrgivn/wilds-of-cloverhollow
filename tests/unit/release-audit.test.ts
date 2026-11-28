import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  areaConnectionErrors,
  hiddenPositions,
  propBlockerErrors,
  propDrawingErrors,
} from "../../src/content/area-checks";
import { loadContent } from "../../src/content/load";
import { createState, soundtrackFor } from "../../src/core";
import { REST_SPOTS } from "../../src/render/companions";

function collectSourceTs(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectSourceTs(full));
    else if (full.endsWith(".ts")) out.push(full);
  }
  return out;
}

describe("Release Readiness & World Expansion Audit", () => {
  const { world, fixtures } = loadContent();

  it("all 32 playable areas pass geometry, prop, resting, surface, and audio checks", () => {
    const playable = Object.keys(world.areas)
      .filter((id) => id !== "harness")
      .sort();
    expect(playable.length).toBeGreaterThanOrEqual(32);

    expect(
      areaConnectionErrors(world.areas, world.tunables, world.critters, world.party),
    ).toEqual([]);

    const baseState = createState(world, fixtures["new-game"]!);
    const restAreas = new Set(REST_SPOTS.map((spot) => spot.area));
    for (const id of playable) {
      const area = world.areas[id]!;
      expect(propDrawingErrors(area), `${id} propDrawingErrors`).toEqual([]);
      expect(propBlockerErrors(area), `${id} propBlockerErrors`).toEqual([]);
      expect(
        hiddenPositions(area, world.tunables.playerRadius),
        `${id} hiddenPositions`,
      ).toEqual([]);
      expect(restAreas.has(id), `${id} missing Cozy Resting spot`).toBe(true);
      expect(world.surfaces[id], `${id} missing surface map`).toBeDefined();
      const audio = soundtrackFor(world, { ...baseState, area: id }, { titleOpen: false });
      expect(audio.track, `${id} missing soundtrack`).toBeTruthy();
      expect(audio.ambience, `${id} missing ambience`).toBeTruthy();
    }
  });

  it("every registered fixture initializes cleanly with valid area and party", () => {
    const names = Object.keys(fixtures).sort();
    expect(names).toEqual(
      expect.arrayContaining([
        "new-game",
        "milo-house",
        "rosie-cottage",
        "summit",
        "island",
        "festival",
      ]),
    );
    for (const name of names) {
      const state = createState(world, fixtures[name]!);
      expect(world.areas[state.area], `fixture ${name} area`).toBeDefined();
      expect(state.party.length, `fixture ${name} party`).toBeGreaterThanOrEqual(1);
    }
  });

  it("all world-expansion review captures and recipes exist on disk", () => {
    const required = [
      "art/recipes/milo-rosie-houses.json",
      "art/recipes/summit.json",
      "art/recipes/island.json",
      "art/recipes/taco.json",
      "art/review/milo-house-overlay.jpg",
      "art/review/milo-house-depth.jpg",
      "art/review/rosie-cottage-overlay.jpg",
      "art/review/rosie-cottage-depth.jpg",
      "art/review/milo-rosie-gameplay.jpg",
      "art/review/summit-overlay.jpg",
      "art/review/summit-depth.jpg",
      "art/review/summit-gameplay.jpg",
      "art/review/island-overlay.jpg",
      "art/review/island-depth.jpg",
      "art/review/island-gameplay.jpg",
      "art/review/taco-ingredients-cream.jpg",
      "art/review/taco-ingredients-dark.jpg",
      "art/review/taco-gameplay.jpg",
      "art/review/sanctuary-festival-overlay.jpg",
      "art/review/sunny-festival-gameplay.jpg",
      "art/review/world-expansion-showcase.jpg",
    ];
    for (const file of required) {
      expect(existsSync(file), `missing review/recipe artifact ${file}`).toBe(true);
    }
  });

  it("keeps every implementation file in src/ cleanly under 1,000 lines", () => {
    const offenders = collectSourceTs("src")
      .filter((file) => file !== "src/core/types.ts")
      .map((file) => ({ file, lines: readFileSync(file, "utf8").trimEnd().split("\n").length }))
      .filter(({ lines }) => lines >= 1000);
    expect(offenders).toEqual([]);
  });
});
