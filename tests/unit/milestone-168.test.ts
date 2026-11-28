import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadContent } from "../../src/content/load";
import {
  createState,
  journalKeepsakes,
  journalProgress,
  STAR_GEM_VARIABLES,
  valleyCompletion,
  type Fixture,
  type State,
} from "../../src/core";
import { setInkVariables } from "../../src/core/ink";
import {
  KEEPSAKE_VARIABLES,
  readQaCheatSnapshot,
  runConsoleCommand,
  type ConsoleContext,
} from "../../src/dev/console";
import { computeStoryAtmosphereOptions } from "../../src/render/view-projections";
import { continueDetail } from "../../src/shell/title-flow";

const content = loadContent();
const { world } = content;

function fixtureOf(name: string): Fixture {
  const fixture = content.fixtures[name];
  if (fixture === undefined) throw new Error(`missing fixture ${name}`);
  return fixture;
}

function consoleContext(): ConsoleContext {
  return {
    story: world.story,
    stickerIds: world.stickers.catalogue.map((s) => s.id),
    prizeIds: world.arcade.prizes.map((p) => p.id),
    treatIds: world.treats.map((t) => t.id),
    fishIds: world.arcade.fish.catches.map((f) => f.id),
    thresholds: world.levels.thresholds,
  };
}

function fullValleyState(fixtureName = "clubhouse"): State {
  const base = createState(world, fixtureOf(fixtureName));
  const flags: Record<string, boolean> = {};
  for (const variable of STAR_GEM_VARIABLES) flags[variable] = true;
  for (const variable of KEEPSAKE_VARIABLES) flags[variable] = true;
  const caughtFish: Record<string, number> = {};
  for (const fish of world.arcade.fish.catches) caughtFish[fish.id] = 1;
  return {
    ...base,
    stickers: world.stickers.catalogue.map((entry) => entry.id),
    prizes: world.arcade.prizes.map((entry) => entry.id),
    caughtFish,
    ink: setInkVariables(base.ink, flags),
  };
}

describe("Milestone 166: Title Screen 100% Valley Explorer Crown", () => {
  it("crowns Continue detail when all 63 valley collectibles are complete", () => {
    const complete = fullValleyState("clubhouse");
    const progress = journalProgress(world, complete);
    expect(progress).toEqual({
      stickers: { owned: 24, total: 24 },
      prizes: { owned: 13, total: 13 },
      fish: { owned: 6, total: 6 },
      keepsakes: { owned: 13, total: 13 },
      gems: { owned: 7, total: 7 },
    });
    expect(valleyCompletion(progress)).toEqual({
      owned: 63,
      total: 63,
      percent: 100,
      complete: true,
    });
    expect(continueDetail(world, complete)).toBe("Clubhouse · ★ 100% Valley Explorer");

    const plazaComplete = fullValleyState("plaza");
    expect(continueDetail(world, plazaComplete)).toBe("Town plaza · ★ 100% Valley Explorer");
  });

  it("keeps standard detail format when even 1 item is missing from any collection", () => {
    const complete = fullValleyState("clubhouse");

    const missingOneSticker: State = {
      ...complete,
      stickers: complete.stickers.filter((id) => id !== "fountain-frog"),
    };
    expect(continueDetail(world, missingOneSticker)).toBe(
      "Clubhouse · 23 stickers · 7/7 gems · 13 keepsakes",
    );

    const missingOnePrize: State = {
      ...complete,
      prizes: complete.prizes.slice(1),
    };
    expect(continueDetail(world, missingOnePrize)).toBe(
      "Clubhouse · 24 stickers · 7/7 gems · 13 keepsakes",
    );

    const missingOneFish: State = {
      ...complete,
      caughtFish: { ...complete.caughtFish, starfish: 0 },
    };
    expect(continueDetail(world, missingOneFish)).toBe(
      "Clubhouse · 24 stickers · 7/7 gems · 13 keepsakes",
    );

    const missingOneKeepsake: State = {
      ...complete,
      ink: setInkVariables(complete.ink, { festival_toast_done: false }),
    };
    expect(continueDetail(world, missingOneKeepsake)).toBe(
      "Clubhouse · 24 stickers · 7/7 gems · 12 keepsakes",
    );

    const missingOneGem: State = {
      ...complete,
      ink: setInkVariables(complete.ink, { gem_hills: false }),
    };
    expect(continueDetail(world, missingOneGem)).toBe(
      "Clubhouse · 24 stickers · 6/7 gems · 13 keepsakes",
    );
  });
});

describe("Milestone 168: Pure computeStoryAtmosphereOptions Coverage", () => {
  it("returns undefined on default state and reducedMotion alone when reduced", () => {
    const base = createState(world, fixtureOf("plaza"));
    for (const areaId of [
      "clubhouse",
      "cafe",
      "plaza",
      "pass",
      "market",
      "parlor",
      "cavern",
      "music",
      "art-room",
      "sanctuary",
    ]) {
      expect(computeStoryAtmosphereOptions(world, base, areaId, false), areaId).toBeUndefined();
      expect(computeStoryAtmosphereOptions(world, base, areaId, true), areaId).toEqual({
        reducedMotion: true,
      });
    }
  });

  it("resolves all 10 story-reactive atmosphere flags cleanly", () => {
    const base = createState(world, fixtureOf("plaza"));
    const withInk = (vars: Record<string, boolean | number>): State => ({
      ...base,
      ink: setInkVariables(base.ink, vars),
    });

    // 1. clubhouseBloom (garden_sprouted or garden_ripe)
    expect(
      computeStoryAtmosphereOptions(world, withInk({ garden_sprouted: true }), "clubhouse", false),
    ).toEqual({ clubhouseBloom: true });
    expect(
      computeStoryAtmosphereOptions(world, withInk({ garden_ripe: true }), "clubhouse", false),
    ).toEqual({ clubhouseBloom: true });

    // 2. cafeCinnamonSteam (spice_returned + buster_reward | taco-chef calm | taco-chef sticker)
    expect(
      computeStoryAtmosphereOptions(world, withInk({ spice_returned: true }), "cafe", false),
    ).toBeUndefined();
    expect(
      computeStoryAtmosphereOptions(
        world,
        withInk({ spice_returned: true, buster_reward: true }),
        "cafe",
        false,
      ),
    ).toEqual({ cafeCinnamonSteam: true });
    expect(
      computeStoryAtmosphereOptions(
        world,
        { ...withInk({ spice_returned: true }), critters: { "taco-chef": "calm" } },
        "cafe",
        false,
      ),
    ).toEqual({ cafeCinnamonSteam: true });
    expect(
      computeStoryAtmosphereOptions(
        world,
        { ...withInk({ spice_returned: true }), stickers: ["taco-chef"] },
        "cafe",
        false,
      ),
    ).toEqual({ cafeCinnamonSteam: true });

    // 3. plazaStarGlow
    expect(
      computeStoryAtmosphereOptions(world, withInk({ buster_reward: true }), "plaza", false),
    ).toEqual({ plazaStarGlow: true });

    // 4. passHearthWisps
    expect(
      computeStoryAtmosphereOptions(world, withInk({ sanctuary_gift: true }), "pass", false),
    ).toEqual({ passHearthWisps: true });

    // 5. marketOrchardGlow (market_note_read + sunberry_harvests > 0)
    expect(
      computeStoryAtmosphereOptions(
        world,
        withInk({ market_note_read: true, sunberry_harvests: 0 }),
        "market",
        false,
      ),
    ).toBeUndefined();
    expect(
      computeStoryAtmosphereOptions(
        world,
        withInk({ market_note_read: false, sunberry_harvests: 2 }),
        "market",
        false,
      ),
    ).toBeUndefined();
    expect(
      computeStoryAtmosphereOptions(
        world,
        withInk({ market_note_read: true, sunberry_harvests: 1 }),
        "market",
        false,
      ),
    ).toEqual({ marketOrchardGlow: true });

    // 6. parlorSundaeSparkle
    expect(
      computeStoryAtmosphereOptions(
        world,
        withInk({ parlor_note_read: true, buster_reward: true }),
        "parlor",
        false,
      ),
    ).toEqual({ parlorSundaeSparkle: true });

    // 7. cavernChimeShimmer
    expect(
      computeStoryAtmosphereOptions(
        world,
        withInk({ cavern_chime_rung: true, buster_reward: true }),
        "cavern",
        false,
      ),
    ).toEqual({ cavernChimeShimmer: true });

    // 8. musicRoomHarmony
    expect(
      computeStoryAtmosphereOptions(
        world,
        withInk({ has_flute: true, buster_reward: true }),
        "music",
        false,
      ),
    ).toEqual({ musicRoomHarmony: true });

    // 9. artRoomPaletteGlow
    expect(
      computeStoryAtmosphereOptions(
        world,
        withInk({ art_open: true, buster_reward: true }),
        "art-room",
        false,
      ),
    ).toEqual({ artRoomPaletteGlow: true });

    // 10. sanctuaryFestival (+ reducedMotion combination)
    expect(
      computeStoryAtmosphereOptions(world, withInk({ milo_revealed: true }), "sanctuary", true),
    ).toEqual({ sanctuaryFestival: true, reducedMotion: true });
  });

  it("keeps src/render/view.ts comfortably under 930 lines", () => {
    const viewLines = readFileSync("src/render/view.ts", "utf8").split("\n").length;
    expect(viewLines).toBeLessThan(930);
    expect(viewLines).toBeLessThan(915);
  });
});

describe("Milestone 166: 13-Keepsake QA Console Sync Verification", () => {
  it("syncs keepsakesOn across all 12 story variables (all 11 story-variable keepsakes)", () => {
    const context = consoleContext();
    const partyNames = Object.fromEntries(
      Object.entries(world.party).map(([id, member]) => [id, member.name]),
    );
    const start = createState(world, fixtureOf("clubhouse"));

    expect(KEEPSAKE_VARIABLES).toHaveLength(12);
    expect(readQaCheatSnapshot(context, start, partyNames).keepsakesOn).toBe(false);

    const enabled = runConsoleCommand(context, start, "keepsakes on");
    expect(enabled.kind).toBe("applied");
    if (enabled.kind !== "applied") return;

    expect(readQaCheatSnapshot(context, enabled.state, partyNames).keepsakesOn).toBe(true);
    // All 11 story-variable keepsakes are owned (the other 2 come from stickers).
    const keepsakes = journalKeepsakes(world, enabled.state);
    expect(keepsakes.filter((item) => item.owned)).toHaveLength(11);

    // Clearing any single one of the 12 story variables flips keepsakesOn to false.
    for (const variable of KEEPSAKE_VARIABLES) {
      const partial: State = {
        ...enabled.state,
        ink: setInkVariables(enabled.state.ink, { [variable]: false }),
      };
      expect(readQaCheatSnapshot(context, partial, partyNames).keepsakesOn, variable).toBe(false);
    }

    const disabled = runConsoleCommand(context, enabled.state, "keepsakes off");
    expect(disabled.kind).toBe("applied");
    if (disabled.kind !== "applied") return;
    expect(readQaCheatSnapshot(context, disabled.state, partyNames).keepsakesOn).toBe(false);
    expect(journalKeepsakes(world, disabled.state).filter((item) => item.owned)).toHaveLength(0);
  });
});
