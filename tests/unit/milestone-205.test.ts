import { describe, expect, it } from "vitest";
import { loadContent } from "../../src/content/load";
import {
  createState,
  creditsSummary,
  HEART_TO_HEARTS,
  journalProgress,
  setInkVariables,
  STAR_GEM_VARIABLES,
  type PartyMember,
  type State,
} from "../../src/core";
import {
  defaultMinigameRecords,
  type MinigameRecords,
} from "../../src/platform/minigame-records";
import { buildCreditsView, type AtlasFrameResolver } from "../../src/shell/view-models";

const { world, fixtures } = loadContent();

const newGameFixture = fixtures["new-game"];
if (newGameFixture === undefined) throw new Error("Missing new-game fixture");
const baseState = createState(world, newGameFixture, 1);

const emptyAtlasResolver: AtlasFrameResolver = {
  atlasFrame: () => null,
};

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

const allHeartVars: Record<string, boolean> = Object.fromEntries(
  HEART_TO_HEARTS.map((spec) => [spec.doneVariable, true]),
);

const allFish = Object.fromEntries(world.arcade.fish.catches.map((item) => [item.id, 1]));
const allGems = Object.fromEntries(STAR_GEM_VARIABLES.map((key) => [key, true]));

function fullPostElevationState(): State {
  const allEncoreTrophies = (world.encore?.bosses ?? []).map((boss) => boss.trophyId);
  return withVars(
    {
      ...baseState,
      finale: "credits",
      stickers: world.stickers.catalogue.map((entry) => entry.id),
      prizes: world.arcade.prizes.map((entry) => entry.id),
      caughtFish: allFish,
      party: [makeMember("maddie"), makeMember("sue"), makeMember("jordan")],
      encore: { bosses: {}, trophies: allEncoreTrophies },
      decor: { swatch: "starlight-cozy", unlockedSwatches: ["starlight-cozy"] },
      puzzles: { "gym-supply-puzzle": true },
    },
    { ...allKeepsakeVars, ...allGems, ...allHeartVars },
  );
}

describe("Milestone 204: Enriched Ending Credits Journey Summary", () => {
  it("stays 100% unchanged when Hearts, Encore trophies, and full 16/16 ribbons are absent", () => {
    expect(creditsSummary(world, baseState)).toEqual([]);

    const partialClassic = withVars(
      {
        ...baseState,
        stickers: ["fountain-frog", "cozy-cat"],
        caughtFish: { minnow: 1 },
      },
      { gem_park: true },
    );
    const progress = journalProgress(world, partialClassic);
    expect(creditsSummary(world, partialClassic)).toEqual([
      `2/${progress.stickers.total} Stickers`,
      `1/${progress.gems.total} Star Gems`,
      `1/${progress.fish.total} Fish`,
    ]);

    // 15/16 ribbons must NOT trigger the golden all-ribbons pill.
    expect(
      creditsSummary(world, partialClassic, { ribbonsEarned: 15, ribbonsTotal: 16 }),
    ).toEqual([
      `2/${progress.stickers.total} Stickers`,
      `1/${progress.gems.total} Star Gems`,
      `1/${progress.fish.total} Fish`,
    ]);
  });

  it("appends Hearts, Encore, and golden 16/16 Ribbons pills cleanly when earned", () => {
    const partialElevation = withVars(
      {
        ...baseState,
        stickers: ["fountain-frog"],
        encore: {
          bosses: {},
          trophies: ["gull-weathervane", "pip-star-token", "gull-weathervane"],
        },
      },
      {
        h2h_fae_maddie_done: true,
        h2h_fae_sue_done: true,
      },
    );
    const progress = journalProgress(world, partialElevation);
    expect(creditsSummary(world, partialElevation)).toEqual([
      `1/${progress.stickers.total} Stickers`,
      "2/6 Hearts",
      "2/9 Encore",
    ]);

    const complete = fullPostElevationState();
    const summary = creditsSummary(world, complete, {
      ribbonsEarned: 16,
      ribbonsTotal: 16,
    });
    expect(summary).toEqual([
      "★ 100% Valley Explorer!",
      `${world.stickers.catalogue.length}/${world.stickers.catalogue.length} Stickers`,
      `${STAR_GEM_VARIABLES.length}/${STAR_GEM_VARIABLES.length} Star Gems`,
      `${world.arcade.fish.catches.length}/${world.arcade.fish.catches.length} Fish`,
      "13/13 Keepsakes",
      `${world.arcade.prizes.length}/${world.arcade.prizes.length} Prizes`,
      "6/6 Hearts",
      "9/9 Encore",
      "★ 16/16 Ribbons!",
    ]);
  });

  it("projects all 3 new Elevation celebration pills in buildCreditsView on a 100% save", () => {
    const complete = fullPostElevationState();
    const fullRecords: MinigameRecords = { ...defaultMinigameRecords(), taco: 620 };

    // Hidden outside credits finale.
    const hiddenView = buildCreditsView(
      world,
      { ...complete, finale: null },
      emptyAtlasResolver,
      fullRecords,
    );
    expect(hiddenView.visible).toBe(false);
    expect(hiddenView.summary).toEqual([]);

    // Fresh credits save stays pixel-identical (no Elevation pills).
    const freshView = buildCreditsView(
      world,
      { ...baseState, finale: "credits" },
      emptyAtlasResolver,
    );
    expect(freshView.visible).toBe(true);
    expect(freshView.summary).toEqual([]);

    // Without Taco record, 15/16 ribbons are earned so Hearts + Encore show, not Ribbons.
    const withoutTacoView = buildCreditsView(world, complete, emptyAtlasResolver);
    expect(withoutTacoView.summary).toContain("6/6 Hearts");
    expect(withoutTacoView.summary).toContain("9/9 Encore");
    expect(withoutTacoView.summary).not.toContain("★ 16/16 Ribbons!");

    // With full post-Elevation save + Taco record, all 3 celebration pills appear!
    const fullView = buildCreditsView(world, complete, emptyAtlasResolver, fullRecords);
    expect(fullView.visible).toBe(true);
    expect(fullView.summary).toEqual([
      "★ 100% Valley Explorer!",
      `${world.stickers.catalogue.length}/${world.stickers.catalogue.length} Stickers`,
      `${STAR_GEM_VARIABLES.length}/${STAR_GEM_VARIABLES.length} Star Gems`,
      `${world.arcade.fish.catches.length}/${world.arcade.fish.catches.length} Fish`,
      "13/13 Keepsakes",
      `${world.arcade.prizes.length}/${world.arcade.prizes.length} Prizes`,
      "6/6 Hearts",
      "9/9 Encore",
      "★ 16/16 Ribbons!",
    ]);
  });
});
