import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadContent } from "../../src/content/load";
import {
  createState,
  landAtlasSummaries,
  matchesAtlasFilter,
  setInkVariables,
  storySoFar,
  type AtlasFilter,
  type AtlasPinSummary,
  type State,
} from "../../src/core";

const { world, fixtures } = loadContent();
const rawNewGame = fixtures["new-game"];
const rawPlaza = fixtures.plaza;
if (rawNewGame === undefined || rawPlaza === undefined) {
  throw new Error("Missing new-game or plaza fixture");
}
const newGameFixture = rawNewGame;
const plazaFixture = rawPlaza;

function withStory(
  base: State,
  variables: Record<string, boolean | number>,
  overrides: Partial<State> = {},
): State {
  return {
    ...base,
    ...overrides,
    ink: setInkVariables(base.ink, variables),
  };
}

function pinById(pins: readonly AtlasPinSummary[], landId: string): AtlasPinSummary {
  const found = pins.find((pin) => pin.landId === landId);
  if (found === undefined) throw new Error(`Missing Atlas pin for land ${landId}`);
  return found;
}

describe("E15 Slice B: Valley Atlas storySoFar", () => {
  it("tracks early, mid, late, and post-finale beats with zero Milo spoilers pre-reveal", () => {
    const bedroom = createState(world, newGameFixture, 1);
    const plaza = createState(world, plazaFixture, 1);

    const preRevealStages: readonly {
      label: string;
      state: State;
      chapter: string;
      goalIncludes: string;
    }[] = [
      {
        label: "new-game bedroom before breakfast",
        state: bedroom,
        chapter: "Act 1",
        goalIncludes: "breakfast",
      },
      {
        label: "ate_breakfast in bedroom",
        state: withStory(bedroom, { ate_breakfast: true }),
        chapter: "Act 1",
        goalIncludes: "fountain in town plaza",
      },
      {
        label: "plaza",
        state: plaza,
        chapter: "Act 1",
        goalIncludes: "fountain in town plaza",
      },
      {
        label: "calmed fountain-frog",
        state: { ...plaza, critters: { ...plaza.critters, "fountain-frog": "calm" } },
        chapter: "Act 1",
        goalIncludes: "Meadow Park and school",
      },
      {
        label: "hall_pass",
        state: withStory(plaza, { hall_pass: true }),
        chapter: "Act 1",
        goalIncludes: "purple thread",
      },
      {
        label: "knows_password",
        state: withStory(plaza, { hall_pass: true, knows_password: true }),
        chapter: "Act 1",
        goalIncludes: "password at the tree house",
      },
      {
        label: "club_open",
        state: withStory(plaza, { club_open: true }),
        chapter: "Act 1",
        goalIncludes: "Bubblegum Bay",
      },
      {
        label: "sue_joined",
        state: withStory(plaza, { club_open: true, sue_joined: true }),
        chapter: "Act 2",
        goalIncludes: "Pinecone Pass",
      },
      {
        label: "visited_pass",
        state: withStory(plaza, { visited_pass: true }),
        chapter: "Act 2",
        goalIncludes: "Jordan",
      },
      {
        label: "rode_bus",
        state: withStory(plaza, { rode_bus: true }),
        chapter: "Act 2",
        goalIncludes: "Jordan",
      },
      {
        label: "has_lantern",
        state: withStory(plaza, { visited_pass: true, has_lantern: true }),
        chapter: "Act 2",
        goalIncludes: "blacklight lantern",
      },
      {
        label: "found_old_trail",
        state: withStory(plaza, { has_lantern: true, found_old_trail: true }),
        chapter: "Act 2",
        goalIncludes: "Whispering Woods",
      },
      {
        label: "clubhouse_claimed",
        state: withStory(plaza, { clubhouse_claimed: true }),
        chapter: "Act 2",
        goalIncludes: "plaza arcade",
      },
      {
        label: "calmed arcade-keeper",
        state: withStory(
          plaza,
          { clubhouse_claimed: true },
          { critters: { ...plaza.critters, "arcade-keeper": "calm" } },
        ),
        chapter: "Act 2",
        goalIncludes: "Cloverhollow School",
      },
      {
        label: "story_time",
        state: withStory(plaza, { story_time: true }),
        chapter: "Act 2",
        goalIncludes: "story time",
      },
      {
        label: "pe_time before coach_thanked",
        state: withStory(plaza, { story_time: true, pe_time: true }),
        chapter: "Act 2",
        goalIncludes: "Coach Ash",
      },
      {
        label: "music_time before has_flute",
        state: withStory(plaza, { pe_time: true, coach_thanked: true, music_time: true }),
        chapter: "Act 2",
        goalIncludes: "Ms. Willow",
      },
      {
        label: "recess before tools complete",
        state: withStory(plaza, { recess: true }),
        chapter: "Act 3",
        goalIncludes: "playing field",
      },
      {
        label: "recess with flute and lasso",
        state: withStory(plaza, { recess: true, has_flute: true, coach_thanked: true }),
        chapter: "Act 3",
        goalIncludes: "Misty Path",
      },
      {
        label: "found_mist_way",
        state: withStory(plaza, { found_mist_way: true }),
        chapter: "Act 3",
        goalIncludes: "Cross the Misty Path",
      },
      {
        label: "seal_open",
        state: withStory(plaza, { found_mist_way: true, seal_open: true }),
        chapter: "Finale",
        goalIncludes: "Enchanted Forest",
      },
      {
        label: "heard_wish",
        state: withStory(plaza, { seal_open: true, heard_wish: true }),
        chapter: "Finale",
        goalIncludes: "Ancient Tree",
      },
    ];

    for (const stage of preRevealStages) {
      const summary = storySoFar(world, stage.state);
      expect(summary.chapter, stage.label).toBe(stage.chapter);
      expect(summary.goal, stage.label).toContain(stage.goalIncludes);
      expect(summary.goal.length, `${stage.label} length`).toBeLessThanOrEqual(64);
      expect(summary.chapter, `${stage.label} chapter secrecy`).not.toMatch(/milo/i);
      expect(summary.goal, `${stage.label} goal secrecy`).not.toMatch(/milo/i);
    }

    // Celebration triggers on milo_revealed, calmed hooded-kid, or forest_fizzy === false.
    const celebrationVariants: readonly State[] = [
      withStory(plaza, { heard_wish: true, milo_revealed: true }),
      withStory(
        plaza,
        { heard_wish: true },
        { critters: { ...plaza.critters, "hooded-kid": "calm" } },
      ),
      withStory(plaza, { heard_wish: true, forest_fizzy: false }),
    ];
    for (const variant of celebrationVariants) {
      const summary = storySoFar(world, variant);
      expect(summary.chapter).toBe("Celebration");
      expect(summary.goal).toContain("Wildlife Sanctuary");
      expect(summary.goal.length).toBeLessThanOrEqual(64);
    }

    // Post-Finale after Jubilee toast.
    const postFinale = storySoFar(
      world,
      withStory(plaza, { milo_revealed: true, festival_toast_done: true }),
    );
    expect(postFinale.chapter).toBe("Post-Finale");
    expect(postFinale.goal).toContain("valley is calm");
    expect(postFinale.goal.length).toBeLessThanOrEqual(64);

    // Epilogue via awake flag or finale state ("morning" / "credits").
    for (const epilogueState of [
      withStory(plaza, { awake: true }),
      { ...plaza, finale: "morning" as const },
      { ...plaza, finale: "credits" as const },
    ]) {
      const summary = storySoFar(world, epilogueState);
      expect(summary.chapter).toBe("Epilogue");
      expect(summary.goal).toContain("Milo");
      expect(summary.goal.length).toBeLessThanOrEqual(64);
    }
  });
});

describe("E15 Slice B: Valley Atlas landAtlasSummaries & matchesAtlasFilter", () => {
  it("reports revealed vs hidden lands on a fresh plaza state without leaking counts", () => {
    const plaza = createState(world, plazaFixture, 1);
    const pins = landAtlasSummaries(world, plaza);
    expect(pins).toHaveLength(world.lands.length);

    const revealedIds = pins.filter((pin) => pin.revealed).map((pin) => pin.landId);
    const hiddenIds = pins.filter((pin) => !pin.revealed).map((pin) => pin.landId);
    expect(revealedIds).toEqual(["cloverhollow", "bay", "pass", "trail", "forest"]);
    expect(hiddenIds).toEqual(["enchanted", "hills"]);

    for (const id of hiddenIds) {
      const hidden = pinById(pins, id);
      expect(hidden.name).toBe("???");
      expect(hidden.revealed).toBe(false);
      expect(hidden.gemsFound).toBe(0);
      expect(hidden.gemsTotal).toBe(0);
      expect(hidden.gemsRemaining).toBe(0);
      expect(hidden.activeBosses).toEqual([]);
      expect(hidden.hasUncalmedBoss).toBe(false);
      expect(hidden.gardenNote).toBeNull();
      expect(hidden.stickersComplete).toBe(false);
      expect(hidden.landComplete).toBe(false);
      expect(hidden.objectives).toEqual([]);
    }

    const clover = pinById(pins, "cloverhollow");
    expect(clover.isCurrent).toBe(true);
    expect(clover.busStop).toBe("unlocked");
    expect(clover.gemsTotal).toBe(1);
    expect(clover.gemsRemaining).toBe(1);
    expect(clover.activeBosses).toEqual([]);
    expect(clover.objectives).toContain("1 Star Gem hidden");
    expect(clover.objectives).toContain("Bus stop unlocked");

    const pass = pinById(pins, "pass");
    expect(pass.gemsTotal).toBe(2);
    expect(pass.gemsRemaining).toBe(2);
    expect(pass.busStop).toBe("on-foot");
    expect(pass.objectives).toContain("2 Star Gems hidden");
    expect(pass.objectives).toContain("Bus stop (visit on foot)");

    const trail = pinById(pins, "trail");
    expect(trail.busStop).toBe("none");
    expect(trail.hasUncalmedBoss).toBe(true);
    expect(trail.activeBosses).toEqual([{ id: "gull", name: "Grumpy Gull" }]);
    expect(trail.objectives[0]).toBe("Grumpy Gull waiting");
  });

  it("tracks Star Gem counts across all 7 lands and decrements cleanly as gems are found", () => {
    const base = createState(world, plazaFixture, 1);
    const allRevealed = withStory(base, { visited_hills: true, found_mist_way: true });
    const pinsBefore = landAtlasSummaries(world, allRevealed);

    expect(pinById(pinsBefore, "cloverhollow").gemsRemaining).toBe(1);
    expect(pinById(pinsBefore, "bay").gemsRemaining).toBe(1);
    expect(pinById(pinsBefore, "trail").gemsRemaining).toBe(1);
    expect(pinById(pinsBefore, "pass").gemsRemaining).toBe(2);
    expect(pinById(pinsBefore, "forest").gemsRemaining).toBe(1);
    expect(pinById(pinsBefore, "hills").gemsRemaining).toBe(1);
    expect(pinById(pinsBefore, "enchanted").gemsTotal).toBe(0);
    expect(pinById(pinsBefore, "enchanted").gemsRemaining).toBe(0);

    const partial = withStory(base, {
      visited_hills: true,
      found_mist_way: true,
      gem_park: true,
      gem_pass: true,
      gem_hills: true,
    });
    const pinsPartial = landAtlasSummaries(world, partial);
    expect(pinById(pinsPartial, "cloverhollow").gemsFound).toBe(1);
    expect(pinById(pinsPartial, "cloverhollow").gemsRemaining).toBe(0);
    expect(pinById(pinsPartial, "cloverhollow").objectives).toContain("Star Gems found ✓");

    expect(pinById(pinsPartial, "pass").gemsFound).toBe(1);
    expect(pinById(pinsPartial, "pass").gemsRemaining).toBe(1);
    expect(pinById(pinsPartial, "pass").objectives).toContain("1 Star Gem hidden");

    expect(pinById(pinsPartial, "hills").gemsFound).toBe(1);
    expect(pinById(pinsPartial, "hills").gemsRemaining).toBe(0);

    const passBoth = withStory(partial, { gem_cavern: true });
    const passPin = pinById(landAtlasSummaries(world, passBoth), "pass");
    expect(passPin.gemsFound).toBe(2);
    expect(passPin.gemsRemaining).toBe(0);
    expect(passPin.objectives).toContain("Star Gems found ✓");
  });

  it("gates all Chaos Bosses accurately and keeps Hooded Kid spoiler-free", () => {
    const base = createState(world, plazaFixture, 1);

    // Before gating flags: only gull on trail is active; arcade-keeper awaits clubhouse_claimed.
    const initial = landAtlasSummaries(world, base);
    expect(pinById(initial, "cloverhollow").activeBosses).toEqual([]);
    expect(pinById(initial, "bay").activeBosses).toEqual([]);
    expect(pinById(initial, "pass").activeBosses).toEqual([]);
    expect(pinById(initial, "forest").activeBosses).toEqual([]);
    expect(pinById(initial, "trail").activeBosses).toEqual([{ id: "gull", name: "Grumpy Gull" }]);

    // Standing inside the arcade itself also exposes arcade-keeper.
    const inArcade = landAtlasSummaries(world, { ...base, area: "arcade" });
    expect(pinById(inArcade, "cloverhollow").activeBosses.map((b) => b.id)).toEqual([
      "arcade-keeper",
    ]);

    // Flip every boss visibility gate and reveal hills + enchanted.
    const allBossesOpen = withStory(base, {
      clubhouse_claimed: true,
      art_teacher_out: true,
      principal_out: true,
      lifeguard_back: true,
      keeper_back: true,
      moon_owl_out: true,
      visited_hills: true,
      taco_chef_out: true,
      found_mist_way: true,
    });
    const openPins = landAtlasSummaries(world, allBossesOpen);

    expect(pinById(openPins, "cloverhollow").activeBosses.map((b) => b.id).sort()).toEqual([
      "arcade-keeper",
      "art-teacher",
      "principal",
    ]);
    expect(pinById(openPins, "bay").activeBosses.map((b) => b.id)).toEqual(["lifeguard"]);
    expect(pinById(openPins, "pass").activeBosses.map((b) => b.id)).toEqual(["lodge-keeper"]);
    expect(pinById(openPins, "trail").activeBosses.map((b) => b.id)).toEqual(["gull"]);
    expect(pinById(openPins, "forest").activeBosses.map((b) => b.id)).toEqual(["moon-owl"]);
    expect(pinById(openPins, "hills").activeBosses.map((b) => b.id)).toEqual(["taco-chef"]);

    const enchantedPin = pinById(openPins, "enchanted");
    expect(enchantedPin.activeBosses).toEqual([{ id: "hooded-kid", name: "Hooded Kid" }]);
    expect(enchantedPin.objectives).toContain("Hooded Kid waiting");
    for (const line of enchantedPin.objectives) {
      expect(line).not.toMatch(/milo/i);
    }

    // Calming every boss clears activeBosses across all lands.
    const allCalmed: State = {
      ...allBossesOpen,
      critters: {
        ...allBossesOpen.critters,
        gull: "calm",
        "arcade-keeper": "calm",
        "art-teacher": "calm",
        principal: "calm",
        lifeguard: "calm",
        "lodge-keeper": "calm",
        "moon-owl": "calm",
        "taco-chef": "calm",
        "hooded-kid": "calm",
      },
    };
    const calmedPins = landAtlasSummaries(world, allCalmed);
    for (const pin of calmedPins) {
      expect(pin.activeBosses, pin.landId).toEqual([]);
      expect(pin.hasUncalmedBoss, pin.landId).toBe(false);
    }
  });

  it("tracks bus unlocks, clubhouse garden states, and stickersComplete vs landComplete", () => {
    const base = createState(world, plazaFixture, 1);

    // Bus stop unlocks.
    const startPins = landAtlasSummaries(world, base);
    expect(pinById(startPins, "cloverhollow").busStop).toBe("unlocked");
    expect(pinById(startPins, "bay").busStop).toBe("on-foot");
    expect(pinById(startPins, "pass").busStop).toBe("on-foot");
    expect(pinById(startPins, "trail").busStop).toBe("none");

    const visitedBay = landAtlasSummaries(world, withStory(base, { visited_bay: true }));
    expect(pinById(visitedBay, "bay").busStop).toBe("unlocked");
    const sueJoined = landAtlasSummaries(world, withStory(base, { sue_joined: true }));
    expect(pinById(sueJoined, "bay").busStop).toBe("unlocked");
    const visitedPass = landAtlasSummaries(world, withStory(base, { visited_pass: true }));
    expect(pinById(visitedPass, "pass").busStop).toBe("unlocked");
    const rodeBus = landAtlasSummaries(world, withStory(base, { rode_bus: true }));
    expect(pinById(rodeBus, "pass").busStop).toBe("unlocked");

    // Clubhouse garden progression on The Forest.
    expect(pinById(startPins, "forest").gardenNote).toBeNull();
    const planted = pinById(
      landAtlasSummaries(world, withStory(base, { garden_planted: true })),
      "forest",
    );
    expect(planted.gardenNote).toBe("Garden growing");
    expect(planted.objectives).toContain("Garden growing");

    const blooming = pinById(
      landAtlasSummaries(world, withStory(base, { garden_planted: true, sunberry_harvests: 2 })),
      "forest",
    );
    expect(blooming.gardenNote).toBe("Sunberries blooming");
    expect(blooming.objectives).toContain("Sunberries blooming");

    const ripe = pinById(
      landAtlasSummaries(
        world,
        withStory(base, { garden_planted: true, garden_ripe: true, sunberry_harvests: 2 }),
      ),
      "forest",
    );
    expect(ripe.gardenNote).toBe("Garden strawberries ripe!");
    expect(ripe.objectives).toContain("Garden strawberries ripe!");

    // stickersComplete vs landComplete on Cliffside Trail (has gull boss + gem_trail + 5 stickers).
    const allStickerIds = world.stickers.catalogue.map((entry) => entry.id);
    const stickersOnly: State = { ...base, stickers: allStickerIds };
    const trailStickersOnly = pinById(landAtlasSummaries(world, stickersOnly), "trail");
    expect(trailStickersOnly.stickersComplete).toBe(true);
    expect(trailStickersOnly.landComplete).toBe(false);
    expect(trailStickersOnly.objectives).toContain("All stickers found ✓");
    expect(trailStickersOnly.objectives).not.toContain("Calm & 100% complete ★");

    // Clearing only the gem while gull is still active still keeps landComplete false.
    const gemClearedOnly = withStory(stickersOnly, { gem_trail: true });
    const trailStillBoss = pinById(landAtlasSummaries(world, gemClearedOnly), "trail");
    expect(trailStillBoss.stickersComplete).toBe(true);
    expect(trailStillBoss.landComplete).toBe(false);

    // Calming gull + finding gem_trail + all stickers -> landComplete true!
    const trailCompleteState: State = {
      ...gemClearedOnly,
      critters: { ...gemClearedOnly.critters, gull: "calm" },
    };
    const trailDone = pinById(landAtlasSummaries(world, trailCompleteState), "trail");
    expect(trailDone.stickersComplete).toBe(true);
    expect(trailDone.landComplete).toBe(true);
    expect(trailDone.objectives).toContain("Calm & 100% complete ★");
  });

  it("filters revealed vs hidden pins accurately across all four AtlasFilter modes", () => {
    const plaza = createState(world, plazaFixture, 1);
    const pins = landAtlasSummaries(world, plaza);
    const filters: readonly AtlasFilter[] = ["all", "gems", "bosses", "bus"];

    // Hidden lands NEVER match any filter.
    for (const hiddenId of ["enchanted", "hills"]) {
      const pin = pinById(pins, hiddenId);
      for (const filter of filters) {
        expect(matchesAtlasFilter(pin, filter), `${hiddenId}:${filter}`).toBe(false);
      }
    }

    expect(pins.filter((p) => matchesAtlasFilter(p, "all")).map((p) => p.landId)).toEqual([
      "cloverhollow",
      "bay",
      "pass",
      "trail",
      "forest",
    ]);
    expect(pins.filter((p) => matchesAtlasFilter(p, "gems")).map((p) => p.landId)).toEqual([
      "cloverhollow",
      "bay",
      "pass",
      "trail",
      "forest",
    ]);
    expect(pins.filter((p) => matchesAtlasFilter(p, "bosses")).map((p) => p.landId)).toEqual([
      "trail",
    ]);
    expect(pins.filter((p) => matchesAtlasFilter(p, "bus")).map((p) => p.landId)).toEqual([
      "cloverhollow",
      "bay",
      "pass",
    ]);

    // After finding Cloverhollow's gem, it drops out of the "gems" filter.
    const afterParkGem = landAtlasSummaries(world, withStory(plaza, { gem_park: true }));
    expect(matchesAtlasFilter(pinById(afterParkGem, "cloverhollow"), "gems")).toBe(false);
    expect(matchesAtlasFilter(pinById(afterParkGem, "cloverhollow"), "bus")).toBe(true);
  });

  it("preserves core purity, journal.ts line budget, and SVG zero-<text> invariant", () => {
    const coreJournal = readFileSync("src/core/journal.ts", "utf8");
    const forbiddenCore = [
      /\bwindow\b/,
      /\bdocument\b/,
      /\bPIXI\b/i,
      /\bDate\b/,
      /\bMath\.random\b/,
      /\bMath\.(sin|cos|tan|atan2|pow|exp|log|hypot)\b/,
      /\bsetTimeout\b/,
      /\bsetInterval\b/,
      /\brequestAnimationFrame\b/,
    ];
    for (const pattern of forbiddenCore) {
      expect(coreJournal, `src/core/journal.ts matched ${pattern}`).not.toMatch(pattern);
    }

    const journalLines = readFileSync("src/ui/journal.ts", "utf8").trimEnd().split("\n").length;
    expect(journalLines).toBeLessThan(1000);

    const mapSource = readFileSync("src/ui/journal-map.ts", "utf8");
    expect(mapSource).not.toMatch(/<text\b/i);
  });
});
