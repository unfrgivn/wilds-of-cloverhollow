import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadContent } from "../../src/content/load";
import {
  createState,
  pointInPolygon,
  runInk,
  sceneryArea,
  setInkVariables,
  targetInteractable,
  type Direction,
  type Point,
  type State,
} from "../../src/core";
import { evaluateAtmosphere } from "../../src/render/atmosphere";
import { evaluateAtmosphere as evaluateFromRecipes } from "../../src/render/atmosphere-recipes";
import {
  ART_PALETTE_TINTS,
  CAVERN_CHIME_TINTS,
  MARKET_ORCHARD_TINTS,
  MUSIC_HARMONY_TINTS,
  PARLOR_SUNDAE_TINTS,
} from "../../src/render/atmosphere-shared";
import { findRestSpot, REST_SPOTS } from "../../src/render/companions";
import { chunkGroups } from "../../vite.config";

const { world, fixtures } = loadContent();

function stateForArea(areaId: string): State {
  const fixture = fixtures[areaId] ?? fixtures["new-game"];
  if (fixture === undefined) throw new Error(`Missing base fixture for ${areaId}`);
  return { ...createState(world, fixture, 1), area: areaId };
}

function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function lineCount(path: string): number {
  return readFileSync(path, "utf8").trimEnd().split("\n").length;
}

function routeModule(modulePath: string): string | null {
  const ordered = [...chunkGroups].sort((a, b) => b.priority - a.priority);
  const match = ordered.find((group) => group.test.test(modulePath));
  return match?.name ?? null;
}

function runKnot(
  ink: string,
  knot: string,
  options?: {
    choices?: number[];
    calmed?: string[];
    coins?: number;
  },
): { ink: string; lines: string[]; speakers: (string | null)[]; tags: string[] } {
  const calmed: Record<string, boolean> = {};
  for (const id of options?.calmed ?? []) {
    calmed[id] = true;
    const critter = world.critters[id];
    if (critter !== undefined) calmed[critter.species] = true;
  }
  const facts = {
    calmed,
    coins: options?.coins ?? 0,
    snacks: 2,
    prizes: [],
    plushesLeft: 0,
    tickets: 0,
  };
  let result = runInk(world.story, ink, { type: "start", knot }, facts);
  const lines: string[] = [];
  const speakers: (string | null)[] = [];
  const tags: string[] = [];
  const collect = (): void => {
    if (result.line !== null) {
      lines.push(result.line.text);
      speakers.push(result.line.speaker);
      tags.push(...result.line.tags);
    }
  };
  collect();
  let choiceIndex = 0;
  for (let guard = 0; guard < 40 && !result.ended; guard += 1) {
    if (result.choices.length > 0) {
      const pick = options?.choices?.[choiceIndex] ?? result.choices.length - 1;
      choiceIndex += 1;
      result = runInk(world.story, result.ink, { type: "choose", index: pick }, facts);
    } else {
      result = runInk(world.story, result.ink, { type: "next" }, facts);
    }
    collect();
  }
  return { ink: result.ink, lines, speakers, tags };
}

function assertTwoLineFit(line: string | undefined, label: string): void {
  expect(line, `${label} missing line`).toBeDefined();
  expect((line ?? "").length, `${label}: "${line ?? ""}"`).toBeLessThanOrEqual(105);
}

describe("Milestone 159: 100% Complete World Cozy Resting (All 32/32 Playable Areas)", () => {
  const addedSpotIds: readonly string[] = [
    "cavern-crystal-bank",
    "mist-bellflower-glade",
    "field-oak-shade",
    "music-room-rug",
    "art-room-skylight",
    "arcade-lounge",
    "school-hall-bench",
    "east-hall-sunbeam",
    "classroom-reading-rug",
    "gym-sideline-mat",
  ];

  it("covers all 32 playable areas with zero blocker, trigger, prop, or NPC conflicts", () => {
    const playableAreas = Object.keys(world.areas)
      .filter((id) => id !== "harness")
      .sort();
    expect(playableAreas).toHaveLength(32);

    const restAreas = [...new Set(REST_SPOTS.map((spot) => spot.area))].sort();
    expect(restAreas).toEqual(playableAreas);
    expect(REST_SPOTS).toHaveLength(33);

    const addedSet = new Set(addedSpotIds);
    const directions: readonly Direction[] = ["up", "down", "left", "right"];

    for (const spot of REST_SPOTS) {
      const area = world.areas[spot.area];
      if (area === undefined) throw new Error(`Unknown area ${spot.area}`);
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

      if (addedSet.has(spot.id)) {
        // Keep >= 60 px clear of every static and strolling NPC in the area.
        for (const npc of area.npcs) {
          const homeDist = Math.hypot(npc.point.x - spot.x, npc.point.y - spot.y);
          expect(
            homeDist,
            `${spot.id} clearance from NPC ${npc.id} home`,
          ).toBeGreaterThanOrEqual(60);
          if (npc.stroll !== undefined) {
            const wps = npc.stroll.waypoints;
            for (let i = 0; i < wps.length; i += 1) {
              const a = wps[i];
              const b = wps[(i + 1) % wps.length];
              if (a === undefined || b === undefined) continue;
              expect(
                distanceToSegment({ x: spot.x, y: spot.y }, a, b),
                `${spot.id} clearance from strolling NPC ${npc.id} segment ${i}`,
              ).toBeGreaterThanOrEqual(60);
            }
          }
        }

        // Verify clean findRestSpot resolution with zero interactable conflict.
        const atSpot: State = {
          ...base,
          player: { x: spot.x, y: spot.y },
          facing: spot.facing,
          party: [],
        };
        expect(
          targetInteractable(world, atSpot),
          `${spot.id} facing ${spot.facing}`,
        ).toBeUndefined();
        expect(findRestSpot(world, atSpot)?.id, spot.id).toBe(spot.id);

        for (const facing of directions) {
          const turned: State = { ...atSpot, facing };
          expect(
            targetInteractable(world, turned),
            `${spot.id} default-state facing ${facing}`,
          ).toBeUndefined();
          expect(findRestSpot(world, turned)?.id, `${spot.id} facing ${facing}`).toBe(spot.id);
        }
      }
    }
  });
});

describe("Milestone 159: Story-Reactive Interior & Cavern Atmosphere", () => {
  const cases = [
    {
      areaId: "market",
      optionKey: "marketOrchardGlow" as const,
      addedCount: 5,
      blend: "normal" as const,
      tints: MARKET_ORCHARD_TINTS,
      minX: 420,
      maxX: 680,
      minY: 260,
      maxY: 390,
    },
    {
      areaId: "parlor",
      optionKey: "parlorSundaeSparkle" as const,
      addedCount: 5,
      blend: "normal" as const,
      tints: PARLOR_SUNDAE_TINTS,
      minX: 460,
      maxX: 760,
      minY: 250,
      maxY: 380,
    },
    {
      areaId: "cavern",
      optionKey: "cavernChimeShimmer" as const,
      addedCount: 6,
      blend: "add" as const,
      tints: CAVERN_CHIME_TINTS,
      minX: 580,
      maxX: 1180,
      minY: 360,
      maxY: 660,
    },
    {
      areaId: "music",
      optionKey: "musicRoomHarmony" as const,
      addedCount: 5,
      blend: "normal" as const,
      tints: MUSIC_HARMONY_TINTS,
      minX: 420,
      maxX: 860,
      minY: 240,
      maxY: 420,
    },
    {
      areaId: "art-room",
      optionKey: "artRoomPaletteGlow" as const,
      addedCount: 5,
      blend: "normal" as const,
      tints: ART_PALETTE_TINTS,
      minX: 360,
      maxX: 860,
      minY: 230,
      maxY: 440,
    },
  ];

  it("verifies default-off parity, bounds, tints, and reducedMotion freeze for 5 accents", () => {
    for (const entry of cases) {
      const area = world.areas[entry.areaId];
      if (area === undefined) throw new Error(`Missing area ${entry.areaId}`);

      const base = evaluateAtmosphere(area.id, area.width, area.height, 90);
      const explicitOff = evaluateAtmosphere(area.id, area.width, area.height, 90, {
        [entry.optionKey]: false,
      });
      expect(explicitOff, `${entry.areaId} default-off parity`).toEqual(base);
      expect(
        evaluateFromRecipes(area.id, area.width, area.height, 90, { [entry.optionKey]: true }),
      ).toEqual(
        evaluateAtmosphere(area.id, area.width, area.height, 90, { [entry.optionKey]: true }),
      );

      const enriched = evaluateAtmosphere(area.id, area.width, area.height, 90, {
        [entry.optionKey]: true,
      });
      expect(enriched.length - base.length, `${entry.areaId} added count`).toBe(entry.addedCount);

      const added = enriched.slice(base.length);
      for (const particle of added) {
        expect(particle.layer).toBe("over");
        expect(particle.texture).toBe("sparkle");
        expect(particle.blend).toBe(entry.blend);
        expect(entry.tints).toContain(particle.tint);
        expect(particle.x).toBeGreaterThanOrEqual(entry.minX);
        expect(particle.x).toBeLessThanOrEqual(entry.maxX);
        expect(particle.y).toBeGreaterThanOrEqual(entry.minY);
        expect(particle.y).toBeLessThanOrEqual(entry.maxY);
        expect(particle.alpha).toBeGreaterThan(0);
        expect(particle.alpha).toBeLessThanOrEqual(1);
      }

      const calm0 = evaluateAtmosphere(area.id, area.width, area.height, 0, {
        [entry.optionKey]: true,
        reducedMotion: true,
      });
      const calm240 = evaluateAtmosphere(area.id, area.width, area.height, 240, {
        [entry.optionKey]: true,
        reducedMotion: true,
      });
      expect(calm240, `${entry.areaId} reducedMotion freeze`).toEqual(calm0);
    }
  });
});

describe("Milestone 159: Valley Epilogue Heart (16 Knots, Zero Drift, Spoiler-Safe)", () => {
  const baseInk = (): string => {
    const fixture = fixtures["new-game"];
    if (fixture === undefined) throw new Error("Missing new-game fixture");
    return createState(world, fixture, 1).ink;
  };

  it("keeps default and pre-reveal shopkeeper chatter spoiler-free and milestone-aware", () => {
    // bay_souvenirs
    const bayBase = runKnot(baseInk(), "bay_souvenirs");
    expect(bayBase.lines[0]).toContain("Bubblegum Bay seaside stand");
    const bayWhistle = runKnot(
      setInkVariables(baseInk(), { buster_reward: true }),
      "bay_souvenirs",
    );
    expect(bayWhistle.lines[0]).toContain("Star-Line Explorer");
    expect(bayWhistle.lines[0]).not.toMatch(/milo/i);
    assertTwoLineFit(bayWhistle.lines[0], "bay_souvenirs buster_reward");

    const bayBoat = runKnot(
      setInkVariables(baseInk(), { buster_reward: true, bay_boat_charm: true }),
      "bay_souvenirs",
    );
    expect(bayBoat.lines[0]).toContain("sea-glass clover");
    expect(bayBoat.lines[0]).not.toMatch(/milo/i);
    assertTwoLineFit(bayBoat.lines[0], "bay_souvenirs boat");

    // pass_souvenirs
    const passBase = runKnot(baseInk(), "pass_souvenirs");
    expect(passBase.lines[0]).toContain("Pinecone Pass mountain stand");
    const passWhistle = runKnot(
      setInkVariables(baseInk(), { buster_reward: true }),
      "pass_souvenirs",
    );
    expect(passWhistle.lines[0]).toContain("Star-Line Explorer");
    expect(passWhistle.lines[0]).not.toMatch(/milo/i);
    assertTwoLineFit(passWhistle.lines[0], "pass_souvenirs buster_reward");

    const passGift = runKnot(
      setInkVariables(baseInk(), { buster_reward: true, sanctuary_gift: true }),
      "pass_souvenirs",
    );
    expect(passGift.lines[0]).toContain("Wildlife Sanctuary");
    expect(passGift.lines[0]).not.toMatch(/milo/i);
    assertTwoLineFit(passGift.lines[0], "pass_souvenirs sanctuary_gift");

    // grocer_pippin.again
    const pippinBase = runKnot(
      setInkVariables(baseInk(), { market_visited: true }),
      "grocer_pippin",
    );
    expect(pippinBase.lines[0]).toContain("Welcome back to Cloverhollow Grocery Market");
    for (const [label, vars, expected] of [
      ["pippin buster", { market_visited: true, buster_reward: true }, "Golden Whistle"],
      ["pippin sanctuary", { market_visited: true, sanctuary_reward_14: true }, "Ranger Fern"],
      ["pippin sunberry", { market_visited: true, sunberry_harvests: 1 }, "Golden Sunberry"],
    ] as const) {
      const res = runKnot(setInkVariables(baseInk(), vars), "grocer_pippin");
      expect(res.lines[0]).toContain(expected);
      expect(res.lines[0]).not.toMatch(/milo/i);
      assertTwoLineFit(res.lines[0], label);
    }
    const pippinMilo = runKnot(
      setInkVariables(baseInk(), { market_visited: true, milo_revealed: true }),
      "grocer_pippin",
    );
    expect(pippinMilo.lines[0]).toContain("Milo");
    assertTwoLineFit(pippinMilo.lines[0], "pippin milo_revealed");

    // scooper_penny.again
    const pennyBase = runKnot(
      setInkVariables(baseInk(), { parlor_visited: true }),
      "scooper_penny",
    );
    expect(pennyBase.lines[0]).toContain("Welcome back to Sweet Scoop Ice Cream Parlor");
    for (const [label, vars, expected] of [
      ["penny buster", { parlor_visited: true, buster_reward: true }, "Star-Line Whistle"],
      ["penny boat", { parlor_visited: true, bay_boat_charm: true }, "rowboat"],
      [
        "penny homes",
        { parlor_visited: true, sue_compass: true, jordan_clover: true },
        "mountain cabin",
      ],
    ] as const) {
      const res = runKnot(setInkVariables(baseInk(), vars), "scooper_penny");
      expect(res.lines[0]).toContain(expected);
      expect(res.lines[0]).not.toMatch(/milo/i);
      assertTwoLineFit(res.lines[0], label);
    }
    const pennyMilo = runKnot(
      setInkVariables(baseInk(), { parlor_visited: true, milo_revealed: true }),
      "scooper_penny",
    );
    expect(pennyMilo.lines[0]).toContain("Milo");
    assertTwoLineFit(pennyMilo.lines[0], "penny milo_revealed");
  });

  it("gates school faculty and classmate epilogues with zero pre-reveal Milo spoilers", () => {
    // classroom_teacher (Ms. Maple)
    const mapleFirst = runKnot(baseInk(), "classroom_teacher");
    expect(mapleFirst.lines[0]).toContain("dragon who sneezes bubbles");
    const mapleBase = runKnot(mapleFirst.ink, "classroom_teacher");
    expect(mapleBase.lines[0]).toBe("Remember, Fae: a kind word can calm almost anything.");

    for (const [label, vars, expected] of [
      ["maple gems", { gem_reward_all: true }, "seven valley Star Gems"],
      ["maple sanctuary", { sanctuary_reward_14: true }, "Sanctuary Clover Wreath"],
    ] as const) {
      const res = runKnot(setInkVariables(mapleFirst.ink, vars), "classroom_teacher");
      expect(res.lines[0]).toContain(expected);
      expect(res.lines[0]).not.toMatch(/milo/i);
      assertTwoLineFit(res.lines[0], label);
    }
    const mapleMilo = runKnot(
      setInkVariables(baseInk(), { milo_revealed: true }),
      "classroom_teacher",
    );
    expect(mapleMilo.lines[0]).toContain("Milo");
    assertTwoLineFit(mapleMilo.lines[0], "maple milo_revealed");

    // rosie.again
    const rosieFirst = runKnot(baseInk(), "rosie");
    const rosieDefault = runKnot(rosieFirst.ink, "rosie");
    expect(rosieDefault.lines[0]).toBe("Hurry, Fae! They went down the hall!");
    for (const [label, vars, expected] of [
      ["rosie homes", { sue_compass: true, jordan_clover: true }, "Jordan's cabin"],
      ["rosie kite", { kite_returned: true, buster_reward: true }, "Golden Star-Line Whistle"],
    ] as const) {
      const res = runKnot(setInkVariables(rosieFirst.ink, vars), "rosie");
      expect(res.lines[0]).toContain(expected);
      expect(res.lines[0]).not.toMatch(/milo/i);
      assertTwoLineFit(res.lines[0], label);
    }
    const rosieMilo = runKnot(
      setInkVariables(rosieFirst.ink, { milo_revealed: true }),
      "rosie",
    );
    expect(rosieMilo.lines[0]).toContain("Milo");
    assertTwoLineFit(rosieMilo.lines[0], "rosie milo_revealed");

    // coach.again
    const coachBase = runKnot(setInkVariables(baseInk(), { coach_thanked: true }), "coach");
    expect(coachBase.lines.join(" ")).toContain("Keep that lasso handy");
    for (const [label, vars, expected] of [
      ["coach buster", { coach_thanked: true, buster_reward: true }, "Star-Line Explorer"],
      ["coach cavern", { coach_thanked: true, cavern_chime_rung: true }, "Rainbow Lasso"],
    ] as const) {
      const res = runKnot(setInkVariables(baseInk(), vars), "coach");
      expect(res.lines[0]).toContain(expected);
      expect(res.lines[0]).not.toMatch(/milo/i);
      assertTwoLineFit(res.lines[0], label);
    }
    const coachMilo = runKnot(
      setInkVariables(baseInk(), { coach_thanked: true, milo_revealed: true }),
      "coach",
    );
    expect(coachMilo.lines[0]).toContain("Milo");
    assertTwoLineFit(coachMilo.lines[0], "coach milo_revealed");

    // art_teacher.again
    const rowanFirst = runKnot(baseInk(), "art_teacher");
    const rowanBase = runKnot(rowanFirst.ink, "art_teacher");
    expect(rowanBase.lines[0]).toBe("Welcome back, Fae! The easels are ready for you.");
    for (const [label, vars, expected] of [
      ["rowan sunberry", { sunberry_harvests: 1 }, "Golden Sunberry"],
      ["rowan sanctuary", { sanctuary_reward_14: true }, "Ranger Fern's meadow"],
    ] as const) {
      const res = runKnot(setInkVariables(rowanFirst.ink, vars), "art_teacher");
      expect(res.lines[0]).toContain(expected);
      expect(res.lines[0]).not.toMatch(/milo/i);
      assertTwoLineFit(res.lines[0], label);
    }
    const rowanMilo = runKnot(
      setInkVariables(rowanFirst.ink, { milo_revealed: true }),
      "art_teacher",
    );
    expect(rowanMilo.lines[0]).toContain("Milo");
    assertTwoLineFit(rowanMilo.lines[0], "rowan milo_revealed");

    // music_teacher.again
    const willowBase = runKnot(setInkVariables(baseInk(), { has_flute: true }), "music_teacher");
    expect(willowBase.lines[0]).toContain("Play that flute");
    for (const [label, vars, expected] of [
      ["willow gems", { has_flute: true, gem_reward_all: true }, "Ribbon Bunny"],
      ["willow sanctuary", { has_flute: true, sanctuary_reward_14: true }, "Ranger Fern"],
    ] as const) {
      const res = runKnot(setInkVariables(baseInk(), vars), "music_teacher");
      expect(res.lines[0]).toContain(expected);
      expect(res.lines[0]).not.toMatch(/milo/i);
      assertTwoLineFit(res.lines[0], label);
    }
    const willowMilo = runKnot(
      setInkVariables(baseInk(), { has_flute: true, milo_revealed: true }),
      "music_teacher",
    );
    expect(willowMilo.lines[0]).toContain("Milo");
    assertTwoLineFit(willowMilo.lines[0], "willow milo_revealed");
  });

  it("gives Mom, Oliver, Milo, and all 4 Enchanted Fairies spoiler-safe epilogues", () => {
    // oliver
    const oliverBase = runKnot(baseInk(), "oliver");
    expect(oliverBase.lines[0]).toBe('Oliver shakes his rattle. "Ba!"');
    const oliverWhistle = runKnot(
      setInkVariables(baseInk(), { buster_reward: true }),
      "oliver",
    );
    expect(oliverWhistle.lines[0]).toContain("Golden Whistle");
    expect(oliverWhistle.lines[0]).not.toMatch(/milo/i);
    assertTwoLineFit(oliverWhistle.lines[0], "oliver buster");

    const oliverMilo = runKnot(setInkVariables(baseInk(), { milo_revealed: true }), "oliver");
    expect(oliverMilo.lines[0]).toContain("Maddie");
    expect(oliverMilo.lines[1]).toContain("valley is calm again");
    assertTwoLineFit(oliverMilo.lines[0], "oliver milo 0");
    assertTwoLineFit(oliverMilo.lines[1], "oliver milo 1");

    // mom.again
    const momBase = runKnot(setInkVariables(baseInk(), { ate_breakfast: true }), "mom");
    expect(momBase.lines[0]).toBe("Have a good day, sweetie. Stay curious!");
    for (const [label, vars, expected] of [
      ["mom sunberry", { ate_breakfast: true, sunberry_harvests: 1 }, "Golden Sunberry"],
      ["mom buster", { ate_breakfast: true, buster_reward: true }, "Golden Star-Line Whistle"],
      ["mom gems", { ate_breakfast: true, gem_reward_all: true }, "Rainbow Geode"],
      ["mom sanctuary", { ate_breakfast: true, sanctuary_reward_14: true }, "Sanctuary Clover"],
    ] as const) {
      const res = runKnot(setInkVariables(baseInk(), vars), "mom");
      expect(res.lines[0]).toContain(expected);
      expect(res.lines[0]).not.toMatch(/milo/i);
      assertTwoLineFit(res.lines[0], label);
    }
    const momMilo = runKnot(
      setInkVariables(baseInk(), { ate_breakfast: true, milo_revealed: true }),
      "mom",
    );
    expect(momMilo.lines[0]).toContain("Milo");
    assertTwoLineFit(momMilo.lines[0], "mom milo_revealed");

    // milo.epilogue
    const miloFirst = runKnot(baseInk(), "milo");
    expect(miloFirst.lines[0]).toContain("Star Racer high score");
    const miloEpilogue = runKnot(
      setInkVariables(baseInk(), { milo_revealed: true, buster_reward: true }),
      "milo",
    );
    expect(miloEpilogue.lines[0]).toContain("No more purple fizz");
    expect(miloEpilogue.lines[1]).toContain("Golden Star-Line Whistle");
    assertTwoLineFit(miloEpilogue.lines[0], "milo epilogue 0");
    assertTwoLineFit(miloEpilogue.lines[1], "milo epilogue buster");

    const miloSanctuary = runKnot(
      setInkVariables(baseInk(), { milo_revealed: true, sanctuary_reward_14: true }),
      "milo",
    );
    expect(miloSanctuary.lines[1]).toContain("Sanctuary Clover Wreath");
    assertTwoLineFit(miloSanctuary.lines[1], "milo epilogue sanctuary");

    // Four Enchanted Forest Fairies
    const lavPre = runKnot(baseInk(), "fairy_lavender");
    expect(lavPre.lines[1]).toContain("kid in a purple hood");
    expect(lavPre.lines.join(" ")).not.toMatch(/milo/i);

    const lavPost = runKnot(
      setInkVariables(baseInk(), { milo_revealed: true, sanctuary_reward_14: true }),
      "fairy_lavender",
    );
    expect(lavPost.lines[0]).toContain("golden dreams again");
    expect(lavPost.lines[1]).toContain("Sanctuary Clover Wreath");
    assertTwoLineFit(lavPost.lines[0], "fairy_lavender post 0");
    assertTwoLineFit(lavPost.lines[1], "fairy_lavender post 1");

    const lavSunberry = runKnot(
      setInkVariables(baseInk(), { milo_revealed: true, sunberry_harvests: 1 }),
      "fairy_lavender",
    );
    expect(lavSunberry.lines[1]).toContain("Golden Sunberries");
    assertTwoLineFit(lavSunberry.lines[1], "fairy_lavender sunberry");

    const mintPre = runKnot(baseInk(), "fairy_mint");
    expect(mintPre.lines[0]).toContain("tickling my wings");
    const mintPost = runKnot(
      setInkVariables(baseInk(), { milo_revealed: true }),
      "fairy_mint",
    );
    expect(mintPost.lines[0]).toContain("No more purple fizz");
    assertTwoLineFit(mintPost.lines[0], "fairy_mint post");

    const mintWreath = runKnot(
      setInkVariables(baseInk(), { milo_revealed: true, sanctuary_reward_14: true }),
      "fairy_mint",
    );
    expect(mintWreath.lines[0]).toContain("Sanctuary Clover Wreath");
    assertTwoLineFit(mintWreath.lines[0], "fairy_mint wreath");

    const skyPre = runKnot(baseInk(), "fairy_sky");
    expect(skyPre.lines[0]).toContain("older than every tree");
    const skyPost = runKnot(setInkVariables(baseInk(), { milo_revealed: true }), "fairy_sky");
    expect(skyPost.lines[0]).toContain("Ancient Tree remembers");
    assertTwoLineFit(skyPost.lines[0], "fairy_sky post");

    const skyGems = runKnot(
      setInkVariables(baseInk(), { milo_revealed: true, gem_reward_all: true }),
      "fairy_sky",
    );
    expect(skyGems.lines[0]).toContain("seven Star Gems");
    assertTwoLineFit(skyGems.lines[0], "fairy_sky gems");

    const peachPre = runKnot(baseInk(), "fairy_peach");
    expect(peachPre.lines[0]).toContain("shoes go squeak");
    const peachPost = runKnot(setInkVariables(baseInk(), { milo_revealed: true }), "fairy_peach");
    expect(peachPost.lines[0]).toContain("gentle stardust again");
    assertTwoLineFit(peachPost.lines[0], "fairy_peach post");
  });
});

describe("Milestone 159: Production render-engine Chunk Split & File Budgets", () => {
  it("routes /src/render/ into render-engine without swallowing core or content chunks", () => {
    const group = chunkGroups.find((item) => item.name === "render-engine");
    expect(group).toBeDefined();
    expect(group?.priority).toBe(16);
    expect(group?.includeDependenciesRecursively).toBe(false);

    expect(routeModule("/repo/src/render/view.ts")).toBe("render-engine");
    expect(routeModule("/repo/src/render/atmosphere-indoor.ts")).toBe("render-engine");
    expect(routeModule("/repo/src/render/companions.ts")).toBe("render-engine");
    expect(routeModule("/repo/src/core/sim.ts")).toBeNull();
    expect(routeModule("/repo/src/main.ts")).toBeNull();
    expect(routeModule("/repo/content/npc-profiles.json")).toBe("world-content");
    expect(routeModule("/repo/content/qa/saves.json")).toBeNull();
  });

  it("keeps every modified implementation file cleanly under 1,000 lines", () => {
    expect(lineCount("src/render/companions.ts")).toBeLessThan(1000);
    expect(lineCount("src/render/atmosphere-shared.ts")).toBeLessThan(1000);
    expect(lineCount("src/render/atmosphere-indoor.ts")).toBeLessThan(1000);
    expect(lineCount("src/render/atmosphere-outdoor.ts")).toBeLessThan(1000);
    expect(lineCount("src/render/view.ts")).toBeLessThan(1000);
  });
});
