import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadContent } from "../../src/content/load";
import type { Npc } from "../../src/core";
import { NEUTRAL_POSE } from "../../src/render/motion";
import {
  ADULT_NPCS,
  computeNpcOverworldHeight,
  computeNpcShadow,
  INDOOR_AREAS,
} from "../../src/render/overworld-render";
import { busRoutePath, createJournalMapPage } from "../../src/ui/journal-map";

const { world } = loadContent();

function makeNpc(id: string): Npc {
  return {
    id,
    point: { x: 400, y: 300 },
    facing: "down",
    footprint: [
      [380, 290],
      [420, 290],
      [420, 310],
      [380, 310],
    ],
    knot: `${id}_talk`,
    prompt: "Talk",
  };
}

describe("Milestone 123: Adult NPC & indoor shadow calibration + journal-map extraction", () => {
  it("classifies all 14 indoor rooms in INDOOR_AREAS and excludes all 12 outdoor areas", () => {
    const expectedIndoor = [
      "bedroom",
      "kitchen",
      "school",
      "east-hall",
      "classroom",
      "gym",
      "music",
      "art-room",
      "arcade",
      "lodge",
      "clubhouse",
      "cafe",
      "sue-cottage",
      "jordan-cabin",
    ] as const;

    const expectedOutdoor = [
      "plaza",
      "park",
      "bay",
      "pass",
      "trail",
      "woods",
      "field",
      "mist",
      "enchanted",
      "hills",
      "sanctuary",
      "cavern",
    ] as const;

    expect(INDOOR_AREAS.size).toBe(expectedIndoor.length);
    for (const areaId of expectedIndoor) {
      expect(INDOOR_AREAS.has(areaId)).toBe(true);
      expect(world.areas[areaId]).toBeDefined();
    }
    for (const areaId of expectedOutdoor) {
      expect(INDOOR_AREAS.has(areaId)).toBe(false);
      expect(world.areas[areaId]).toBeDefined();
    }
  });

  it("calibrates all 13 adult NPCs to 132 height and 52 shadow width while preserving kids", () => {
    const adults = [
      "mom",
      "dad",
      "teacher",
      "nurse",
      "coach",
      "music-teacher",
      "fern",
      "chef",
      "barnaby",
      "bree",
      "buster",
      "bay-keeper",
      "pass-keeper",
    ] as const;

    const kids = ["milo", "rosie", "toby", "sue", "jordan"] as const;

    expect(ADULT_NPCS.size).toBe(adults.length);
    for (const npcId of adults) {
      expect(ADULT_NPCS.has(npcId)).toBe(true);
      expect(world.characters[npcId]).toBeDefined();
      expect(computeNpcOverworldHeight(makeNpc(npcId), undefined)).toBe(132);
      const shadow = computeNpcShadow(npcId, { x: 100, y: 200 }, NEUTRAL_POSE, 0.24);
      expect(shadow.width).toBe(52);
      expect(shadow.height).toBeCloseTo(52 * 0.38, 6);
      expect(shadow.alpha).toBe(0.24);
    }

    for (const npcId of kids) {
      expect(ADULT_NPCS.has(npcId)).toBe(false);
      expect(computeNpcOverworldHeight(makeNpc(npcId), undefined)).toBe(114);
      const shadow = computeNpcShadow(npcId, { x: 100, y: 200 }, NEUTRAL_POSE, 0.24);
      expect(shadow.width).toBe(48);
      expect(shadow.height).toBeCloseTo(48 * 0.38, 6);
    }

    expect(computeNpcOverworldHeight(makeNpc("oliver"), undefined)).toBe(72);
    expect(computeNpcShadow("oliver", { x: 100, y: 200 }, NEUTRAL_POSE, 0.24).width).toBe(34);

    // Explicit character scales on Buster, Bay Keeper, and Pass Keeper remain intact.
    expect(world.characters.buster?.scale).toBe(0.48);
    expect(world.characters["bay-keeper"]?.scale).toBe(0.48);
    expect(world.characters["pass-keeper"]?.scale).toBe(0.48);
  });

  it("exports pure journal-map helpers and trims src/ui/journal.ts below 1,000 lines", () => {
    expect(typeof createJournalMapPage).toBe("function");

    const bayRoute = busRoutePath(
      { id: "cloverhollow", x: 1200, y: 800 },
      { id: "bay", x: 2000, y: 900 },
    );
    expect(bayRoute).toBe("M 1200 800 Q 1584 978 2000 900");

    const passRoute = busRoutePath(
      { id: "cloverhollow", x: 1200, y: 800 },
      { id: "pass", x: 1100, y: 200 },
    );
    expect(passRoute).toBe("M 1200 800 Q 958 532 1100 200");

    const genericRoute = busRoutePath(
      { id: "bay", x: 2000, y: 900 },
      { id: "pass", x: 1100, y: 200 },
    );
    expect(genericRoute).toBe("M 2000 900 Q 1648 424 1100 200");

    const journalLines = readFileSync("src/ui/journal.ts", "utf8").split("\n").length;
    expect(journalLines).toBeLessThan(1000);
  });
});
