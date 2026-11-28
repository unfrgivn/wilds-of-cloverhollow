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
  countDecorCustomizations,
  countEncoreTrophies,
  countSolvedPuzzles,
  evaluateMeritRibbons,
  evaluateMeritRibbonsFromJournal,
  MERIT_RIBBON_IDS,
  newlyEarnedRibbons,
  type MeritRibbonId,
} from "../../src/core/ribbons";
import { effectRecipe } from "../../src/platform/audio-effects";
import { defaultMinigameRecords, type MinigameRecords } from "../../src/platform/minigame-records";
import { buildJournalView } from "../../src/shell/view-models";
import { meritRibbonEmblemMarkup } from "../../src/ui/journal-ribbons";
import { importErrors, stripComments } from "../../tools/purity";

describe("Milestone 200: Grand 16-Ribbon Tapestry & Live Stitched Toast", () => {
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
      art: { stickerArt: () => null, prizeArt: () => null, fishArt: () => null },
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

  const allHeartVars: Record<string, boolean> = {
    h2h_fae_maddie_done: true,
    h2h_fae_sue_done: true,
    h2h_fae_jordan_done: true,
    h2h_sue_jordan_done: true,
    h2h_clubhouse_trio_done: true,
    h2h_sanctuary_encore_done: true,
  };

  const allFish = Object.fromEntries(world.arcade.fish.catches.map((item) => [item.id, 1]));
  const allGems = Object.fromEntries(STAR_GEM_VARIABLES.map((id) => [id, true]));

  it("places the 4 new Elevation ribbons before valley-legend with twin parity at 0, 8, and 16",
    () => {
      expect(MERIT_RIBBON_IDS).toHaveLength(16);
      expect(MERIT_RIBBON_IDS[11]).toBe("heart-collector");
      expect(MERIT_RIBBON_IDS[12]).toBe("encore-star");
      expect(MERIT_RIBBON_IDS[13]).toBe("cozy-decorator");
      expect(MERIT_RIBBON_IDS[14]).toBe("puzzle-solver");
      expect(MERIT_RIBBON_IDS[15]).toBe("valley-legend");

      // 1. Empty fresh journey: 0/16
      const emptyCore = evaluateMeritRibbons(world, baseState);
      const emptyJournal = evaluateMeritRibbonsFromJournal(buildOpenView(baseState));
      expect(emptyCore).toEqual(emptyJournal);
      expect(emptyCore.earned).toBe(0);
      expect(emptyCore.total).toBe(16);
      expect(emptyCore.complete).toBe(false);

      // 2. Mid-journey 8/16 (includes cozy-decorator & puzzle-solver earned,
      //    heart-collector 3/6 & encore-star 0/1 locked)
      const midState: State = withVars(
        {
          ...baseState,
          stickers: ["fountain-frog", "pond-pup", "ribbon-bunny"],
          prizes: world.arcade.prizes.slice(0, 4).map((p) => p.id),
          caughtFish: { minnow: 2, perch: 1 },
          party: [makeMember("maddie"), makeMember("sue"), makeMember("jordan")],
          decor: { swatch: "sunlit-meadow", unlockedSwatches: ["sunlit-meadow"] },
          puzzles: { "cavern-prism": true },
        },
        {
          buster_reward: true,
          summit_aurora_read: true,
          sanctuary_reward_14: true,
          gem_park: true,
          gem_bay: true,
          gem_pass: true,
          h2h_fae_maddie_done: true,
          h2h_fae_sue_done: true,
          h2h_fae_jordan_done: true,
        },
      );
      const midRecords: MinigameRecords = { ...defaultMinigameRecords(), taco: 450 };
      const midCore = evaluateMeritRibbons(world, midState, midRecords);
      const midJournal = evaluateMeritRibbonsFromJournal(buildOpenView(midState, midRecords));
      expect(midCore).toEqual(midJournal);
      expect(midCore.earned).toBe(8);
      expect(midCore.total).toBe(16);
      expect(midCore.complete).toBe(false);
      const byId = new Map(midCore.ribbons.map((r) => [r.id, r]));
      expect(byId.get("heart-collector")).toMatchObject({ earned: false, progressText: "3/6" });
      expect(byId.get("encore-star")).toMatchObject({ earned: false, progressText: "0/1" });
      expect(byId.get("cozy-decorator")).toMatchObject({ earned: true, progressText: "★ Earned" });
      expect(byId.get("puzzle-solver")).toMatchObject({ earned: true, progressText: "★ Earned" });

      // 3. Complete 16/16 Grand Tapestry
      const fullState: State = withVars(
        {
          ...baseState,
          stickers: world.stickers.catalogue.map((s) => s.id),
          prizes: world.arcade.prizes.map((p) => p.id),
          caughtFish: allFish,
          party: [makeMember("maddie"), makeMember("sue"), makeMember("jordan")],
          encore: { bosses: {}, trophies: ["trophy-gull"] },
          decor: { swatch: "starlight-cozy", unlockedSwatches: ["starlight-cozy"] },
          puzzles: { "gym-supply-puzzle": true },
        },
        { ...allKeepsakeVars, ...allGems, ...allHeartVars },
      );
      const fullRecords: MinigameRecords = { ...defaultMinigameRecords(), taco: 620 };
      const fullCore = evaluateMeritRibbons(world, fullState, fullRecords);
      const fullJournal = evaluateMeritRibbonsFromJournal(buildOpenView(fullState, fullRecords));
      expect(fullCore).toEqual(fullJournal);
      expect(fullCore.earned).toBe(16);
      expect(fullCore.total).toBe(16);
      expect(fullCore.complete).toBe(true);
      expect(fullCore.ribbons.every((r) => r.earned && r.progressText === "★ Earned")).toBe(true);
    },
  );

  it("evaluates individual unlock rules for all 4 new Elevation ribbons cleanly", () => {
    const pick = (state: State, id: MeritRibbonId) =>
      evaluateMeritRibbons(world, state).ribbons.find((r) => r.id === id)!;

    // heart-collector: 0/6 -> 4/6 -> 6/6
    expect(pick(baseState, "heart-collector")).toMatchObject({
      earned: false,
      progressText: "0/6",
    });
    expect(
      pick(
        withVars(baseState, {
          h2h_fae_maddie_done: true,
          h2h_fae_sue_done: true,
          h2h_fae_jordan_done: true,
          h2h_sue_jordan_done: true,
        }),
        "heart-collector",
      ),
    ).toMatchObject({ earned: false, progressText: "4/6" });
    expect(pick(withVars(baseState, allHeartVars), "heart-collector")).toMatchObject({
      earned: true,
      progressText: "★ Earned",
    });
    expect(
      evaluateMeritRibbonsFromJournal({ heartToHeartsCompleted: 6 }).ribbons.find(
        (r) => r.id === "heart-collector",
      ),
    ).toMatchObject({ earned: true, progressText: "★ Earned" });

    // encore-star: 0/1 -> earned when >= 1 trophy
    expect(countEncoreTrophies(undefined)).toBe(0);
    expect(pick(baseState, "encore-star")).toMatchObject({ earned: false, progressText: "0/1" });
    const withTrophy: State = {
      ...baseState,
      encore: { bosses: {}, trophies: ["trophy-gull", "trophy-gull"] },
    };
    expect(countEncoreTrophies(withTrophy.encore)).toBe(1);
    expect(pick(withTrophy, "encore-star")).toMatchObject({
      earned: true,
      progressText: "★ Earned",
    });

    // cozy-decorator: fishTraded/visitorOffset stay locked; swatch/pedestals/bedroomSlots unlock
    expect(countDecorCustomizations(undefined)).toBe(0);
    expect(countDecorCustomizations({ visitorOffset: 2, fishTraded: 3 })).toBe(0);
    expect(
      pick({ ...baseState, decor: { visitorOffset: 1, fishTraded: 2 } }, "cozy-decorator"),
    ).toMatchObject({ earned: false, progressText: "0/1" });
    expect(
      pick({ ...baseState, decor: { swatch: "bubblegum-beach" } }, "cozy-decorator"),
    ).toMatchObject({ earned: true, progressText: "★ Earned" });
    expect(
      pick({ ...baseState, decor: { pedestals: true } }, "cozy-decorator"),
    ).toMatchObject({ earned: true, progressText: "★ Earned" });
    expect(
      pick({ ...baseState, decor: { bedroomSlots: ["frog-plush"] } }, "cozy-decorator"),
    ).toMatchObject({ earned: true, progressText: "★ Earned" });

    // puzzle-solver: false/empty stays locked; any solved spatial puzzle unlocks
    expect(countSolvedPuzzles(undefined)).toBe(0);
    expect(countSolvedPuzzles({ "gym-supply-puzzle": false })).toBe(0);
    expect(
      pick({ ...baseState, puzzles: { "gym-supply-puzzle": false } }, "puzzle-solver"),
    ).toMatchObject({ earned: false, progressText: "0/1" });
    expect(
      pick({ ...baseState, puzzles: { "woods-vine-harmony": true } }, "puzzle-solver"),
    ).toMatchObject({ earned: true, progressText: "★ Earned" });
  });

  it("diffs newlyEarnedRibbons safely on null prev, unchanged state, and simultaneous unlocks",
    () => {
      const empty = evaluateMeritRibbons(world, baseState);
      expect(newlyEarnedRibbons(null, empty)).toEqual([]);
      expect(newlyEarnedRibbons(empty, empty)).toEqual([]);

      const multiState: State = {
        ...baseState,
        stickers: ["fountain-frog"],
        decor: { swatch: "sunlit-meadow", unlockedSwatches: ["sunlit-meadow"] },
        puzzles: { "cavern-prism": true },
      };
      const unlocked = evaluateMeritRibbons(world, multiState);
      expect(newlyEarnedRibbons(null, unlocked)).toEqual([]);
      expect(newlyEarnedRibbons(empty, unlocked).map((r) => r.id)).toEqual([
        "first-friend",
        "cozy-decorator",
        "puzzle-solver",
      ]);

      // Adding one more ribbon yields only that new ribbon.
      const withTrophy = evaluateMeritRibbons(world, {
        ...multiState,
        encore: { bosses: {}, trophies: ["trophy-gull"] },
      });
      expect(newlyEarnedRibbons(unlocked, withTrophy).map((r) => r.id)).toEqual(["encore-star"]);
      expect(newlyEarnedRibbons(withTrophy, withTrophy)).toEqual([]);
    },
  );

  it("keeps ribbon-earned recipe gentle, emblems zero-<text>, and all touched files under cap",
    () => {
      const recipe = effectRecipe("ribbon-earned");
      expect(recipe).toHaveLength(5);
      const totalDuration = Math.max(...recipe.map((s) => s.offset + s.duration));
      expect(totalDuration).toBeLessThanOrEqual(0.5);
      expect(totalDuration).toBeCloseTo(0.42, 2);
      for (const seg of recipe) {
        expect(seg.wave).not.toBe("square");
        expect(seg.gain).toBeGreaterThan(0);
        expect(seg.gain).toBeLessThanOrEqual(0.09);
        expect(seg.attack ?? 0).toBeGreaterThanOrEqual(0.003);
      }

      const newIds: readonly MeritRibbonId[] = [
        "heart-collector",
        "encore-star",
        "cozy-decorator",
        "puzzle-solver",
      ];
      const allRibbons = evaluateMeritRibbons(world, baseState).ribbons;
      for (const id of newIds) {
        const ribbon = allRibbons.find((r) => r.id === id)!;
        const svg = meritRibbonEmblemMarkup({ ...ribbon, earned: true });
        expect(svg.toLowerCase()).not.toContain("<text");
        expect(svg).toContain(ribbon.color);
      }

      const ribbonsCore = stripComments(readFileSync("src/core/ribbons.ts", "utf8"));
      expect(importErrors("src/core/ribbons.ts", ribbonsCore)).toEqual([]);

      const lineCount = (path: string): number =>
        readFileSync(path, "utf8").trimEnd().split("\n").length;
      expect(lineCount("src/ui/ribbon-toast.ts")).toBeLessThan(140);
      expect(lineCount("src/ui/ribbon-toast.css")).toBeLessThan(120);
      expect(lineCount("src/main.ts")).toBeLessThan(880);
      for (const file of [
        "src/core/ribbons.ts",
        "src/ui/journal-ribbons.ts",
        "src/ui/journal-field-note-data.ts",
        "src/ui/ribbon-toast.ts",
        "src/shell/view-models.ts",
        "src/shell/feedback.ts",
        "src/platform/audio-effects.ts",
        "src/main.ts",
      ]) {
        expect(lineCount(file), `${file} line cap`).toBeLessThan(1000);
      }
    },
  );
});
