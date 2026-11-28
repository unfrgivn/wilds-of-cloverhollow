import { describe, expect, it } from "vitest";
import * as battleModule from "../../src/core/battle";
import * as coreIndex from "../../src/core";
import * as simModule from "../../src/core/sim";
import {
  blankInput,
  createState,
  journalKeepsakes,
  pointInPolygon,
  sceneryArea,
  targetInteractable,
  type State,
} from "../../src/core";
import { setInkVariables } from "../../src/core/ink";
import { loadContent } from "../../src/content/load";
import { evaluateClubhouseDisplay } from "../../src/render/clubhouse-display";
import { findRestSpot, REST_SPOTS } from "../../src/render/companions";

const { world, fixtures } = loadContent();

function stateIn(
  fixtureName: string,
  overrides: Partial<State> = {},
  variables: Record<string, boolean> = {},
): State {
  const fixture = fixtures[fixtureName];
  if (fixture === undefined) throw new Error(`Missing fixture ${fixtureName}`);
  const base = createState(world, fixture, 1);
  const ink = Object.keys(variables).length > 0
    ? setInkVariables(base.ink, variables)
    : base.ink;
  return { ...base, ink, ...overrides };
}

describe("Milestone 96: 8-Keepsake Showcase, 9 Resting Areas & core/battle Extraction", () => {
  it("journalKeepsakes returns all 8 keepsakes including sea-compass and alpine-clover", () => {
    const empty = journalKeepsakes(world, stateIn("plaza"));
    expect(empty).toHaveLength(9);
    expect(empty.map((item) => item.id)).toEqual([
      "star-crystal",
      "star-pin",
      "star-geode",
      "moon-feather",
      "taco-badge",
      "clover-wreath",
      "sea-compass",
      "alpine-clover",
      "star-whistle",
    ]);
    expect(empty.every((item) => !item.owned)).toBe(true);

    const compassOnly = journalKeepsakes(world, stateIn("plaza", {}, { sue_compass: true }));
    expect(compassOnly.filter((item) => item.owned)).toMatchObject([
      {
        id: "sea-compass",
        name: "Sea-Glass Compass",
        source: "Sue's Beach Cottage",
        owned: true,
      },
    ]);

    const cloverOnly = journalKeepsakes(world, stateIn("plaza", {}, { jordan_clover: true }));
    expect(cloverOnly.filter((item) => item.owned)).toMatchObject([
      {
        id: "alpine-clover",
        name: "Pressed Alpine Clover",
        source: "Jordan's Mountain Cabin",
        owned: true,
      },
    ]);
  });

  it("evaluateClubhouseDisplay places all 8 keepsakes + 13 prizes (21) outside walkable", () => {
    const allPrizes = world.arcade.prizes.map((entry) => entry.id);
    const full = stateIn(
      "clubhouse",
      { prizes: allPrizes, stickers: ["starry-owl", "taco-chef"] },
      {
        cavern_chime_rung: true,
        spice_returned: true,
        gem_reward_all: true,
        sanctuary_reward_14: true,
        sue_compass: true,
        jordan_clover: true,
      },
    );
    const display = evaluateClubhouseDisplay(world, full);
    expect(display.prizes).toHaveLength(13);
    expect(display.keepsakes).toHaveLength(8);
    expect(display.prizes.length + display.keepsakes.length).toBe(21);

    expect(display.keepsakes.find((item) => item.id === "sea-compass")).toEqual({
      id: "sea-compass",
      texture: "keepsakeCompass",
      x: 796,
      y: 350,
      zIndex: 414,
      scale: 0.66,
      sparkleTint: 0x7ae2d8,
    });
    expect(display.keepsakes.find((item) => item.id === "alpine-clover")).toEqual({
      id: "alpine-clover",
      texture: "keepsakeClover",
      x: 516,
      y: 308,
      zIndex: 320,
      scale: 0.74,
      sparkleTint: 0xa2ce8f,
    });

    const clubhouse = world.areas.clubhouse;
    if (clubhouse === undefined) throw new Error("Missing clubhouse area");
    for (const keepsake of display.keepsakes) {
      expect(
        pointInPolygon({ x: keepsake.x, y: keepsake.y }, clubhouse.walkable),
        `${keepsake.id} at (${keepsake.x}, ${keepsake.y}) must stay outside walkable floor`,
      ).toBe(false);
    }
  });

  it("every REST_SPOTS entry across all 32 areas sits inside walkable and outside blockers", () => {
    const areas = new Set(REST_SPOTS.map((spot) => spot.area));
    expect([...areas].sort()).toEqual([
      "arcade",
      "art-room",
      "bay",
      "bedroom",
      "cafe",
      "cavern",
      "classroom",
      "clubhouse",
      "east-hall",
      "enchanted",
      "field",
      "gym",
      "hills",
      "island",
      "jordan-cabin",
      "kitchen",
      "lodge",
      "market",
      "milo-house",
      "mist",
      "music",
      "park",
      "parlor",
      "pass",
      "plaza",
      "rosie-cottage",
      "sanctuary",
      "school",
      "sue-cottage",
      "summit",
      "trail",
      "woods",
    ]);

    for (const spot of REST_SPOTS) {
      const area = world.areas[spot.area];
      if (area === undefined) throw new Error(`Unknown rest spot area ${spot.area}`);
      const fixtureKey = fixtures[spot.area] === undefined ? "new-game" : spot.area;
      const base = stateIn(fixtureKey, { area: spot.area });
      const scenery = sceneryArea(world, base.ink, area);

      for (const [label, point] of [
        ["anchor", { x: spot.x, y: spot.y }],
        ["seat", { x: spot.seatX, y: spot.seatY }],
      ] as const) {
        expect(
          pointInPolygon(point, area.walkable),
          `${spot.id} ${label} (${point.x}, ${point.y}) inside ${spot.area}.walkable`,
        ).toBe(true);
        for (const blocker of scenery.blockers) {
          expect(
            pointInPolygon(point, blocker),
            `${spot.id} ${label} (${point.x}, ${point.y}) outside ${spot.area} blockers`,
          ).toBe(false);
        }
        for (const npc of area.npcs) {
          expect(
            pointInPolygon(point, npc.footprint),
            `${spot.id} ${label} outside NPC ${npc.id} footprint`,
          ).toBe(false);
        }
      }

      // Friend homes and Sanctuary rest spots must resolve cleanly with zero interactable conflict.
      if (
        spot.area === "sue-cottage" ||
        spot.area === "jordan-cabin" ||
        spot.area === "sanctuary"
      ) {
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

  it("src/core/battle.ts exports match src/core/sim.ts and src/core/index.ts identically", () => {
    expect(battleModule.CALM_HOOK).toBe(simModule.CALM_HOOK);
    expect(battleModule.CALM_HOOK).toBe(coreIndex.CALM_HOOK);
    expect(battleModule.battleCommands).toBe(simModule.battleCommands);
    expect(battleModule.battleCommands).toBe(coreIndex.battleCommands);
    expect(battleModule.battleView).toBe(simModule.battleView);
    expect(battleModule.battleView).toBe(coreIndex.battleView);
    expect(battleModule.startBattle).toBe(simModule.startBattle);
    expect(battleModule.startBattle).toBe(coreIndex.startBattle);
    expect(battleModule.stepBattle).toBe(simModule.stepBattle);
    expect(battleModule.stepBattle).toBe(coreIndex.stepBattle);
    expect(battleModule.totalTreatCount).toBe(simModule.totalTreatCount);
    expect(battleModule.addTreat).toBe(simModule.addTreat);
    expect(battleModule.consumeTreat).toBe(simModule.consumeTreat);
    expect(battleModule.purchaseTreat).toBe(simModule.purchaseTreat);

    // Smoke-test startBattle + stepBattle directly from src/core/battle.ts.
    const plaza = stateIn("plaza");
    const frog = world.critters["fountain-frog"];
    if (frog === undefined) throw new Error("Missing fountain-frog critter");
    const battle = battleModule.startBattle(world, plaza, frog);
    expect(battle.critterId).toBe("fountain-frog");
    expect(battle.phase).toBe("intro");
    const active: State = { ...plaza, battle };
    expect(battleModule.battleView(world, active)?.critterId).toBe("fountain-frog");
    expect(battleModule.battleCommands(world, active).map((cmd) => cmd.id)).toContain("soothe");
    const ticked = battleModule.stepBattle(world, active, blankInput(), false);
    expect(ticked.tick).toBe(plaza.tick + 1);
    expect(ticked.battle?.phaseTicks).toBe(1);
  });
});
