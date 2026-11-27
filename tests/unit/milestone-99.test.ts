import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadContent } from "../../src/content/load";
import {
  createState,
  targetInteractable,
  type Point,
  type Polygon,
  type State,
} from "../../src/core";
import { setInkVariables } from "../../src/core/ink";
import { runConsoleCommand, type ConsoleContext } from "../../src/dev/console";
import { evaluateClubhouseDisplay } from "../../src/render/clubhouse-display";
import { speakerAccent, speakerPortraitSource } from "../../src/ui/portraits";

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

function pointInPolygon(point: Point, polygon: Polygon): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const pi = polygon[i];
    const pj = polygon[j];
    if (pi === undefined || pj === undefined) continue;
    const [xi, yi] = pi;
    const [xj, yj] = pj;
    const crosses = (yi > point.y) !== (yj > point.y) &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

describe("Milestone 95: Living Biome Shopkeepers (Bay Keeper & Pass Keeper)", () => {
  it("registers bay-keeper and pass-keeper with 4-frame atlases and adult portraits", () => {
    const specs = [
      {
        id: "bay-keeper",
        speaker: "Bay keeper",
        idleTicks: [175, 10],
      },
      {
        id: "pass-keeper",
        speaker: "Pass keeper",
        idleTicks: [195, 10],
      },
    ] as const;

    for (const spec of specs) {
      expect(world.characters[spec.id]).toEqual({
        atlas: `assets/characters/${spec.id}/${spec.id}.json`,
        idleTicks: [...spec.idleTicks],
        scale: 0.48,
      });

      const pngPath = `public/assets/characters/${spec.id}/${spec.id}.webp`;
      const jsonPath = `public/assets/characters/${spec.id}/${spec.id}.json`;
      expect(existsSync(pngPath), pngPath).toBe(true);
      expect(existsSync(jsonPath), jsonPath).toBe(true);

      const atlasRaw: unknown = JSON.parse(readFileSync(jsonPath, "utf8"));
      expect(atlasRaw).toMatchObject({
        frames: {
          down_idle_01: { frame: { x: 0, y: 0, w: 448, h: 448 } },
          down_idle_02: { frame: { x: 448, y: 0, w: 448, h: 448 } },
          left_idle_01: { frame: { x: 896, y: 0, w: 448, h: 448 } },
          right_idle_01: { frame: { x: 1344, y: 0, w: 448, h: 448 } },
        },
        animations: {
          idle_down: ["down_idle_01", "down_idle_02"],
          idle_left: ["left_idle_01"],
          idle_right: ["right_idle_01"],
        },
        meta: {
          image: `${spec.id}.webp`,
          size: { w: 1792, h: 448 },
          baseline: 439,
        },
      });

      expect(speakerAccent(spec.speaker)).toBe("town");
      expect(speakerPortraitSource(world, spec.speaker)).toEqual({
        atlas: `assets/characters/${spec.id}/${spec.id}.json`,
        frame: "down_idle_01",
        cropMode: "adult",
      });
    }
  });

  it("places bay-keeper in Bay and pass-keeper in Pass with clean reachability", () => {
    const bay = world.areas.bay;
    const pass = world.areas.pass;
    if (bay === undefined || pass === undefined) {
      throw new Error("missing bay or pass area");
    }

    expect(bay.interactables.find((item) => item.id === "bay-souvenirs")).toBeUndefined();
    expect(bay.npcs.find((npc) => npc.id === "bay-keeper")).toMatchObject({
      point: { x: 785, y: 455 },
      facing: "down",
      knot: "bay_souvenirs",
      prompt: "Talk",
    });

    expect(pass.interactables.find((item) => item.id === "pass-souvenirs")).toBeUndefined();
    expect(pass.npcs.find((npc) => npc.id === "pass-keeper")).toMatchObject({
      point: { x: 1190, y: 910 },
      facing: "down",
      knot: "pass_souvenirs",
      prompt: "Talk",
    });

    const atBay = stateIn("bay", { player: { x: 785, y: 505 }, facing: "up" });
    expect(targetInteractable(world, atBay)?.id).toBe("npc:bay-keeper");

    const atPass = stateIn("pass", { player: { x: 1190, y: 955 }, facing: "up" });
    expect(targetInteractable(world, atPass)?.id).toBe("npc:pass-keeper");
  });
});

describe("Milestone 95: Golden Star-Line Whistle Clubhouse Shelf Keepsake", () => {
  const allPrizeIds = world.arcade.prizes.map((entry) => entry.id);

  it("activates star-whistle via buster_reward on a non-blocking, well-separated perch", () => {
    const before = stateIn("clubhouse");
    expect(evaluateClubhouseDisplay(world, before).keepsakes).toEqual([]);

    const whistleOnly = stateIn("clubhouse", {}, { buster_reward: true });
    expect(evaluateClubhouseDisplay(world, whistleOnly).keepsakes).toEqual([
      {
        id: "star-whistle",
        texture: "keepsakeWhistle",
        x: 805,
        y: 259,
        zIndex: 320,
        scale: 0.78,
        sparkleTint: 0xffd966,
      },
    ]);

    const full = stateIn(
      "clubhouse",
      { prizes: allPrizeIds, stickers: ["starry-owl", "taco-chef"] },
      {
        cavern_chime_rung: true,
        spice_returned: true,
        gem_reward_all: true,
        buster_reward: true,
      },
    );
    const display = evaluateClubhouseDisplay(world, full);
    expect(display.prizes).toHaveLength(13);
    expect(display.keepsakes).toHaveLength(6);

    const whistle = display.keepsakes.find((item) => item.id === "star-whistle");
    if (whistle === undefined) throw new Error("missing star-whistle placement");

    const clubhouse = world.areas.clubhouse;
    if (clubhouse === undefined) throw new Error("missing clubhouse area");
    expect(pointInPolygon({ x: whistle.x, y: whistle.y }, clubhouse.walkable)).toBe(false);

    for (const prize of display.prizes) {
      const distance = Math.hypot(whistle.x - prize.x, whistle.y - prize.y);
      expect(distance, `distance to prize ${prize.id}`).toBeGreaterThanOrEqual(45);
    }
    for (const other of display.keepsakes) {
      if (other.id === whistle.id) continue;
      const distance = Math.hypot(whistle.x - other.x, whistle.y - other.y);
      expect(distance, `distance to keepsake ${other.id}`).toBeGreaterThanOrEqual(45);
    }
  });

  it("toggles buster_reward cleanly via the QA console keepsakes command", () => {
    const context: ConsoleContext = {
      story: world.story,
      stickerIds: world.stickers.catalogue.map((sticker) => sticker.id),
      prizeIds: world.arcade.prizes.map((prize) => prize.id),
      treatIds: world.treats.map((treat) => treat.id),
      fishIds: world.arcade.fish.catches.map((item) => item.id),
      thresholds: world.levels.thresholds,
    };
    const start = stateIn("clubhouse");
    const on = runConsoleCommand(context, start, "keepsakes on");
    expect(on.kind).toBe("applied");
    if (on.kind !== "applied") return;
    expect(world.storyVariable(on.state.ink, "buster_reward")).toBe(true);
    expect(
      evaluateClubhouseDisplay(world, on.state).keepsakes.some(
        (item) => item.id === "star-whistle",
      ),
    ).toBe(true);

    const off = runConsoleCommand(context, on.state, "keepsakes off");
    expect(off.kind).toBe("applied");
    if (off.kind !== "applied") return;
    expect(world.storyVariable(off.state.ink, "buster_reward")).toBe(false);
    expect(
      evaluateClubhouseDisplay(world, off.state).keepsakes.some(
        (item) => item.id === "star-whistle",
      ),
    ).toBe(false);
  });
});
