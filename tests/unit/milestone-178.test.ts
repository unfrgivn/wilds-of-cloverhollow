import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadContent } from "../../src/content/load";
import {
  createState,
  setInkVariables,
  STAR_GEM_VARIABLES,
  type PartyMember,
  type State,
} from "../../src/core";
import {
  evaluateMeritRibbons,
  evaluateMeritRibbonsFromJournal,
  MERIT_RIBBON_IDS,
  type MeritRibbonId,
} from "../../src/core/ribbons";
import { defaultMinigameRecords, type MinigameRecords } from "../../src/platform/minigame-records";
import { buildJournalView } from "../../src/shell/view-models";
import { createMeritRibbonEmblem, meritRibbonEmblemMarkup } from "../../src/ui/journal-ribbons";
import { importErrors, stripComments } from "../../tools/purity";

describe("Milestone 176: Valley Merit Ribbons (Track E18B)", () => {
  const { world, fixtures } = loadContent();
  const baseState = createState(world, fixtures["new-game"]!);

  const makeMember = (id: string): PartyMember => ({
    id,
    xp: 0,
    x: 0,
    y: 0,
    facing: "down",
    motion: { distance: 0, moving: false },
    stillTicks: 0,
    trail: [],
  });

  const withVars = (state: State, vars: Record<string, boolean>): State => ({
    ...state,
    ink: setInkVariables(state.ink, vars),
  });

  const buildOpenView = (state: State, arcadeRecords?: MinigameRecords) =>
    buildJournalView({
      world,
      state: { ...state, journalOpen: true },
      notes: [],
      mapCentres: {},
      art: {
        stickerArt: () => null,
        prizeArt: () => null,
        fishArt: () => null,
      },
      muted: false,
      level: 1,
      musicMuted: false,
      musicLevel: 1,
      ambienceMuted: false,
      nowPlaying: "Cloverhollow",
      arcadeRecords,
      gentleTiming: false,
      keyHints: true,
      textSpeed: "cozy",
      reducedMotion: false,
      hasLantern: true,
      hasFlute: true,
      hasLasso: true,
    });

  const allKeepsakeVars: Record<string, boolean> = {
    cavern_chime_rung: true,
    spice_returned: true,
    gem_reward_all: true,
    sanctuary_reward_14: true,
    sue_compass: true,
    jordan_clover: true,
    buster_reward: true,
    milo_loft_visited: true,
    rosie_cottage_visited: true,
    summit_aurora_read: true,
    island_shells_solved: true,
    festival_toast_done: true,
  };

  const allFish = Object.fromEntries(world.arcade.fish.catches.map((item) => [item.id, 1]));
  const allGems = Object.fromEntries(STAR_GEM_VARIABLES.map((id) => [id, true]));

  it("keeps core and JournalView evaluators identical at 0/12, 5/12, and 12/12", () => {
    // 1. Empty fresh journey: 0/12
    const emptyCore = evaluateMeritRibbons(world, baseState);
    const emptyJournal = evaluateMeritRibbonsFromJournal(buildOpenView(baseState));
    expect(emptyCore).toEqual(emptyJournal);
    expect(emptyCore.earned).toBe(0);
    expect(emptyCore.total).toBe(12);
    expect(emptyCore.complete).toBe(false);
    expect(emptyCore.ribbons.map((r) => r.id)).toEqual([...MERIT_RIBBON_IDS]);

    // 2. Mid-journey: 5/12 (first-friend, party-reunited, star-line-explorer, taco-fiesta,
    //    alpine-stargazer) + partial counts for gems (3/7), fish (2/6), prizes (4/13).
    const midState: State = withVars(
      {
        ...baseState,
        stickers: ["fountain-frog", "pond-pup", "ribbon-bunny"],
        prizes: world.arcade.prizes.slice(0, 4).map((p) => p.id),
        caughtFish: { minnow: 2, perch: 1 },
        party: [makeMember("maddie"), makeMember("sue"), makeMember("jordan")],
      },
      {
        buster_reward: true,
        summit_aurora_read: true,
        gem_park: true,
        gem_bay: true,
        gem_pass: true,
      },
    );
    const midRecords: MinigameRecords = { ...defaultMinigameRecords(), taco: 450 };
    const midCore = evaluateMeritRibbons(world, midState, midRecords);
    const midJournal = evaluateMeritRibbonsFromJournal(buildOpenView(midState, midRecords));
    expect(midCore).toEqual(midJournal);
    expect(midCore.earned).toBe(5);
    expect(midCore.total).toBe(12);
    expect(midCore.complete).toBe(false);
    expect(midCore.ribbons.filter((r) => r.earned).map((r) => r.id)).toEqual([
      "first-friend",
      "party-reunited",
      "star-line-explorer",
      "taco-fiesta",
      "alpine-stargazer",
    ]);
    const byId = new Map(midCore.ribbons.map((r) => [r.id, r]));
    expect(byId.get("gem-scholar")?.progressText).toBe("3/7");
    expect(byId.get("master-angler")?.progressText).toBe("2/6");
    expect(byId.get("arcade-champion")?.progressText).toBe("4/13");
    expect(byId.get("valley-legend")?.progressText).toBe("14/63");

    // 3. Complete 100% Valley Legend: 12/12
    const fullState: State = withVars(
      {
        ...baseState,
        stickers: world.stickers.catalogue.map((s) => s.id),
        prizes: world.arcade.prizes.map((p) => p.id),
        caughtFish: allFish,
        party: [makeMember("maddie"), makeMember("sue"), makeMember("jordan")],
      },
      { ...allKeepsakeVars, ...allGems },
    );
    const fullRecords: MinigameRecords = { ...defaultMinigameRecords(), taco: 620 };
    const fullCore = evaluateMeritRibbons(world, fullState, fullRecords);
    const fullJournal = evaluateMeritRibbonsFromJournal(buildOpenView(fullState, fullRecords));
    expect(fullCore).toEqual(fullJournal);
    expect(fullCore.earned).toBe(12);
    expect(fullCore.total).toBe(12);
    expect(fullCore.complete).toBe(true);
    expect(fullCore.ribbons.every((r) => r.earned && r.progressText === "★ Earned")).toBe(true);
  });

  it("evaluates individual unlock rules and progress text for all 12 Valley Merit Ribbons", () => {
    const pick = (
      state: State,
      id: MeritRibbonId,
      records?: { taco?: number },
    ) => evaluateMeritRibbons(world, state, records).ribbons.find((r) => r.id === id)!;

    // 1. first-friend
    expect(pick(baseState, "first-friend")).toMatchObject({ earned: false, progressText: "0/1" });
    expect(pick({ ...baseState, stickers: ["fountain-frog"] }, "first-friend")).toMatchObject({
      earned: true,
      progressText: "★ Earned",
    });

    // 2. party-reunited
    expect(pick(baseState, "party-reunited")).toMatchObject({ earned: false, progressText: "0/2" });
    const withSue = { ...baseState, party: [makeMember("maddie"), makeMember("sue")] };
    expect(pick(withSue, "party-reunited")).toMatchObject({ earned: false, progressText: "1/2" });
    const withBoth = {
      ...baseState,
      party: [makeMember("maddie"), makeMember("sue"), makeMember("jordan")],
    };
    expect(pick(withBoth, "party-reunited")).toMatchObject({
      earned: true,
      progressText: "★ Earned",
    });

    // 3. star-line-explorer
    expect(pick(baseState, "star-line-explorer")).toMatchObject({
      earned: false,
      progressText: "0/1",
    });
    expect(pick(withVars(baseState, { buster_reward: true }), "star-line-explorer")).toMatchObject({
      earned: true,
      progressText: "★ Earned",
    });

    // 4. gem-scholar
    expect(pick(withVars(baseState, { gem_park: true, gem_bay: true }), "gem-scholar"))
      .toMatchObject({ earned: false, progressText: "2/7" });
    expect(pick(withVars(baseState, allGems), "gem-scholar")).toMatchObject({
      earned: true,
      progressText: "★ Earned",
    });

    // 5. master-angler
    expect(pick({ ...baseState, caughtFish: { minnow: 3 } }, "master-angler")).toMatchObject({
      earned: false,
      progressText: "1/6",
    });
    expect(pick({ ...baseState, caughtFish: allFish }, "master-angler")).toMatchObject({
      earned: true,
      progressText: "★ Earned",
    });

    // 6. arcade-champion
    const sixPrizes = { ...baseState, prizes: world.arcade.prizes.slice(0, 6).map((p) => p.id) };
    expect(pick(sixPrizes, "arcade-champion")).toMatchObject({
      earned: false,
      progressText: "6/13",
    });
    const allPrizes = { ...baseState, prizes: world.arcade.prizes.map((p) => p.id) };
    expect(pick(allPrizes, "arcade-champion")).toMatchObject({
      earned: true,
      progressText: "★ Earned",
    });

    // 7. taco-fiesta
    expect(pick(baseState, "taco-fiesta", { taco: 0 })).toMatchObject({
      earned: false,
      progressText: "0/1",
    });
    expect(pick(baseState, "taco-fiesta", { taco: 280 })).toMatchObject({
      earned: true,
      progressText: "★ Earned",
    });

    // 8. sanctuary-guardian
    expect(pick(baseState, "sanctuary-guardian")).toMatchObject({
      earned: false,
      progressText: "0/1",
    });
    expect(
      pick(withVars(baseState, { sanctuary_reward_14: true }), "sanctuary-guardian"),
    ).toMatchObject({ earned: true, progressText: "★ Earned" });

    // 9. neighborhood-hearts (requires BOTH milo_loft_visited AND rosie_cottage_visited)
    expect(
      pick(withVars(baseState, { milo_loft_visited: true }), "neighborhood-hearts"),
    ).toMatchObject({ earned: false, progressText: "0/1" });
    expect(
      pick(
        withVars(baseState, { milo_loft_visited: true, rosie_cottage_visited: true }),
        "neighborhood-hearts",
      ),
    ).toMatchObject({ earned: true, progressText: "★ Earned" });

    // 10. alpine-stargazer
    expect(pick(baseState, "alpine-stargazer")).toMatchObject({
      earned: false,
      progressText: "0/1",
    });
    expect(
      pick(withVars(baseState, { summit_aurora_read: true }), "alpine-stargazer"),
    ).toMatchObject({ earned: true, progressText: "★ Earned" });

    // 11. starlight-keeper
    expect(pick(baseState, "starlight-keeper")).toMatchObject({
      earned: false,
      progressText: "0/1",
    });
    expect(
      pick(withVars(baseState, { island_shells_solved: true }), "starlight-keeper"),
    ).toMatchObject({ earned: true, progressText: "★ Earned" });

    // 12. valley-legend (63/63 collectibles; 62/63 stays locked!)
    const almostFull: State = withVars(
      {
        ...baseState,
        stickers: world.stickers.catalogue.map((s) => s.id),
        prizes: world.arcade.prizes.map((p) => p.id),
        caughtFish: allFish,
      },
      { ...allKeepsakeVars, ...allGems, gem_hills: false },
    );
    expect(pick(almostFull, "valley-legend")).toMatchObject({
      earned: false,
      progressText: "62/63",
    });
    const full = withVars(almostFull, { gem_hills: true });
    expect(pick(full, "valley-legend")).toMatchObject({
      earned: true,
      progressText: "★ Earned",
    });
  });

  it("keeps src/core/ribbons.ts pure, enforces line budgets, and renders zero-<text> SVGs", () => {
    const coreSource = readFileSync("src/core/ribbons.ts", "utf8");
    const stripped = stripComments(coreSource);
    expect(importErrors("src/core/ribbons.ts", stripped)).toEqual([]);
    expect(stripped).not.toMatch(
      /\b(?:window|document|Date|performance|setTimeout|setInterval|Math\.random)\b/,
    );

    const journalLines = readFileSync("src/ui/journal.ts", "utf8").trimEnd().split("\n").length;
    expect(journalLines).toBeLessThan(680);

    const ribbonsUiLines = readFileSync("src/ui/journal-ribbons.ts", "utf8")
      .trimEnd()
      .split("\n").length;
    expect(ribbonsUiLines).toBeLessThan(320);

    for (const file of [
      "src/core/ribbons.ts",
      "src/ui/journal-field-note.ts",
      "src/ui/journal-ribbons.ts",
    ]) {
      const lines = readFileSync(file, "utf8").trimEnd().split("\n").length;
      expect(lines, `${file} line count`).toBeLessThan(1000);
    }

    expect(typeof createMeritRibbonEmblem).toBe("function");
    const uiSource = stripComments(readFileSync("src/ui/journal-ribbons.ts", "utf8"));
    expect(uiSource.toLowerCase()).not.toContain("<text");

    const allRibbons = evaluateMeritRibbons(world, baseState).ribbons;
    expect(new Set(allRibbons.map((r) => r.title)).size).toBe(12);
    expect(new Set(allRibbons.map((r) => r.color)).size).toBe(12);
    for (const ribbon of allRibbons) {
      const lockedSvg = meritRibbonEmblemMarkup(ribbon);
      const earnedSvg = meritRibbonEmblemMarkup({ ...ribbon, earned: true });
      expect(lockedSvg.toLowerCase(), `${ribbon.id} locked zero-<text>`).not.toContain("<text");
      expect(earnedSvg.toLowerCase(), `${ribbon.id} earned zero-<text>`).not.toContain("<text");
      expect(earnedSvg, `${ribbon.id} earned uses ribbon color`).toContain(ribbon.color);
    }
  });
});
