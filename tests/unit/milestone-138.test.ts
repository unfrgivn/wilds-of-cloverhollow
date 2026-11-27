import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadContent } from "../../src/content/load";
import {
  createState,
  openArcade,
  type ArcadeGameId,
  type Area,
  type Battle,
  type State,
} from "../../src/core";
import { createAreaLoader } from "../../src/shell/area-loader";
import { formatDocumentTitle } from "../../src/shell/document-title";

function collectTsFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = join(directory, entry.name);
    if (entry.isDirectory()) return collectTsFiles(full);
    return full.endsWith(".ts") ? [full] : [];
  });
}

function makeBattle(critterId: string): Battle {
  return {
    critterId,
    den: null,
    entry: { x: 800, y: 600 },
    phase: "command",
    message: "",
    revealed: 0,
    selected: 0,
    command: null,
    energy: 5,
    calm: 0,
    rest: {},
    check: null,
    lastGrade: null,
    feelings: [],
    answered: false,
    lanternPeek: false,
    turn: 0,
    windUp: null,
    talkMode: false,
    talk: null,
    talkTurns: 0,
    rewardSticker: null,
    phaseTicks: 0,
  };
}

describe("Milestone 138: Dynamic Storybook Document Title", () => {
  const content = loadContent();
  const plazaFixture = content.fixtures.plaza;
  if (plazaFixture === undefined) throw new Error("Missing plaza fixture");
  const baseState = createState(content.world, plazaFixture);

  it("formats Title, Credits, harness, and overworld areas", () => {
    expect(
      formatDocumentTitle(content.world, baseState, { titleOpen: true, creditsOpen: false }),
    ).toBe("Wilds of Cloverhollow");

    expect(
      formatDocumentTitle(
        content.world,
        { ...baseState, area: "harness" },
        { titleOpen: false, creditsOpen: false },
      ),
    ).toBe("Wilds of Cloverhollow");

    expect(
      formatDocumentTitle(content.world, baseState, { titleOpen: false, creditsOpen: true }),
    ).toBe("Thank You for Playing · Wilds of Cloverhollow");

    expect(
      formatDocumentTitle(
        content.world,
        { ...baseState, area: "plaza" },
        { titleOpen: false, creditsOpen: false },
      ),
    ).toBe(`${content.world.areas.plaza?.name} · Wilds of Cloverhollow`);

    expect(
      formatDocumentTitle(
        content.world,
        { ...baseState, area: "bay" },
        { titleOpen: false, creditsOpen: false },
      ),
    ).toBe("Bubblegum Bay · Wilds of Cloverhollow");

    expect(
      formatDocumentTitle(
        content.world,
        { ...baseState, area: "market" },
        { titleOpen: false, creditsOpen: false },
      ),
    ).toBe("Cloverhollow Grocery Market · Wilds of Cloverhollow");

    expect(
      formatDocumentTitle(
        content.world,
        { ...baseState, area: "sanctuary" },
        { titleOpen: false, creditsOpen: false },
      ),
    ).toBe("Wildlife Sanctuary · Wilds of Cloverhollow");

    expect(
      formatDocumentTitle(
        content.world,
        { ...baseState, area: "missing-area" },
        { titleOpen: false, creditsOpen: false },
      ),
    ).toBe("Wilds of Cloverhollow");
  });

  it("formats active calm-down battles and falls back cleanly for unknown critters", () => {
    const frogBattle: State = { ...baseState, battle: makeBattle("fountain-frog") };
    expect(
      formatDocumentTitle(content.world, frogBattle, { titleOpen: false, creditsOpen: false }),
    ).toBe("Calming Fizzy Frog · Wilds of Cloverhollow");

    const unknownBattle: State = { ...baseState, battle: makeBattle("unknown-critter") };
    expect(
      formatDocumentTitle(content.world, unknownBattle, { titleOpen: false, creditsOpen: false }),
    ).toBe("Wilds of Cloverhollow");
  });

  it("formats all six minigames cleanly", () => {
    const cases: readonly [ArcadeGameId, string][] = [
      ["claw", "Claw Machine · Wilds of Cloverhollow"],
      ["skee", "Skee-Ball · Wilds of Cloverhollow"],
      ["mole", "Boop-a-Mole · Wilds of Cloverhollow"],
      ["comet", "Comet Cruise · Wilds of Cloverhollow"],
      ["cook-nuggets", "Clubhouse Microwave · Wilds of Cloverhollow"],
      ["fish", "Bubblegum Bay Fishing · Wilds of Cloverhollow"],
    ];
    for (const [gameId, expected] of cases) {
      const opened = openArcade(content.world, { ...baseState, coins: 20 }, gameId, 0);
      expect(
        formatDocumentTitle(content.world, opened, { titleOpen: false, creditsOpen: false }),
      ).toBe(expected);
    }
  });
});

describe("Milestone 138: Serialized Area Loader", () => {
  const content = loadContent();
  const bedroom = content.world.areas.bedroom;
  const plaza = content.world.areas.plaza;
  if (bedroom === undefined || plaza === undefined) {
    throw new Error("Missing bedroom or plaza area");
  }

  it("serializes concurrent ensureArea calls without duplicate loads", async () => {
    let loadedId: string | null = bedroom.id;
    let currentState: Pick<State, "area" | "battle"> = { area: plaza.id, battle: null };
    const setAreaCalls: string[] = [];
    const loadedCallbacks: string[] = [];
    let invalidations = 0;
    const pendingLoads: (() => void)[] = [];

    const loader = createAreaLoader({
      getArea: (id): Area | undefined => content.world.areas[id],
      getState: () => currentState,
      loadedAreaId: () => loadedId,
      setArea: (area) => {
        setAreaCalls.push(area.id);
        return new Promise<void>((resolve) => {
          pendingLoads.push(() => {
            loadedId = area.id;
            resolve();
          });
        });
      },
      prefetchArea: () => undefined,
      warmAreaOverlays: async () => undefined,
      cacheAreaNpcPortraits: () => undefined,
      warmAreaMedia: async () => undefined,
      warmBattlePortraits: async () => undefined,
      onLoaded: (loadedState) => {
        loadedCallbacks.push(loadedState.area);
      },
      invalidate: () => {
        invalidations += 1;
      },
    });

    expect(loader.isLoading()).toBe(false);
    const first = loader.ensureArea();
    const second = loader.ensureArea();
    expect(loader.isLoading()).toBe(true);
    expect(setAreaCalls).toEqual([plaza.id]);

    const releaseFirst = pendingLoads.shift();
    if (releaseFirst === undefined) throw new Error("Expected setArea to be in flight");
    releaseFirst();
    await Promise.all([first, second]);

    expect(loader.isLoading()).toBe(false);
    expect(setAreaCalls).toEqual([plaza.id]);
    expect(loadedCallbacks).toEqual([plaza.id]);
    expect(invalidations).toBe(1);

    // A follow-up ensureArea for the already-loaded area avoids reloading.
    await loader.ensureArea();
    expect(setAreaCalls).toEqual([plaza.id]);

    // Switching areas triggers a new load cleanly.
    currentState = { area: bedroom.id, battle: null };
    const third = loader.ensureArea();
    expect(loader.isLoading()).toBe(true);
    const releaseSecond = pendingLoads.shift();
    if (releaseSecond === undefined) throw new Error("Expected second setArea to be in flight");
    releaseSecond();
    await third;
    expect(loader.isLoading()).toBe(false);
    expect(setAreaCalls).toEqual([plaza.id, bedroom.id]);
  });

  it("deduplicates door-fade prefetch calls until cleared or reset", () => {
    const prefetched: string[] = [];
    const warmedOverlays: string[] = [];

    const loader = createAreaLoader({
      getArea: (id) => content.world.areas[id],
      getState: () => ({ area: bedroom.id, battle: null }),
      loadedAreaId: () => bedroom.id,
      setArea: async () => undefined,
      prefetchArea: (area) => {
        prefetched.push(area.id);
      },
      warmAreaOverlays: async (areaId) => {
        warmedOverlays.push(areaId);
      },
      cacheAreaNpcPortraits: () => undefined,
      warmAreaMedia: async () => undefined,
      warmBattlePortraits: async () => undefined,
      onLoaded: () => undefined,
      invalidate: () => undefined,
    });

    loader.prefetch("plaza");
    loader.prefetch("plaza");
    expect(prefetched).toEqual(["plaza"]);
    expect(warmedOverlays).toEqual(["plaza"]);

    loader.clearPrefetch();
    loader.prefetch("plaza");
    expect(prefetched).toEqual(["plaza", "plaza"]);

    loader.reset();
    const bayTransition: State["transition"] = {
      phase: "out",
      elapsed: 3,
      target: { area: "bay", spawn: "from-plaza" },
    };
    loader.syncTransition(bayTransition, true);
    expect(prefetched).toEqual(["plaza", "plaza"]);

    loader.syncTransition(bayTransition, false);
    loader.syncTransition(bayTransition, false);
    expect(prefetched).toEqual(["plaza", "plaza", "bay"]);
  });
});

describe("Milestone 138: Modular src/ Size Budget", () => {
  it("keeps every implementation .ts file in src/ under 1,000 lines", () => {
    const files = collectTsFiles("src").filter((file) => file !== "src/core/types.ts");
    const overLimit = files
      .map((file) => ({
        file,
        lines: readFileSync(file, "utf8").trimEnd().split("\n").length,
      }))
      .filter((entry) => entry.lines >= 1000);
    expect(overLimit).toEqual([]);

    const mainLines = readFileSync("src/main.ts", "utf8").trimEnd().split("\n").length;
    expect(mainLines).toBeLessThan(950);
  });
});
