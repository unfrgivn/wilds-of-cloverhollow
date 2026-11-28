import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadContent } from "../../src/content/load";
import { createState } from "../../src/core";
import {
  createAreaBannerTracker,
  resolveAreaBannerContext,
} from "../../src/shell/overworld-feedback";
import { areaBannerInfo } from "../../src/ui/area-banner";
import { chunkGroups } from "../../vite.config";

const { world, fixtures } = loadContent();

function routeModule(modulePath: string): string | null {
  const ordered = [...chunkGroups].sort((a, b) => b.priority - a.priority);
  const match = ordered.find((group) => group.test.test(modulePath));
  return match?.name ?? null;
}

function lineCount(filePath: string): number {
  return readFileSync(filePath, "utf8").trimEnd().split("\n").length;
}

describe("Milestone 229: Weather & Home-Record Enriched Area Arrival Banners", () => {
  it("preserves exact legacy output when options are omitted or clear + null", () => {
    expect(areaBannerInfo(world, "harness")).toBeNull();
    expect(areaBannerInfo(world, "plaza")).toEqual({
      title: "Town plaza",
      region: "Cloverhollow",
    });
    expect(areaBannerInfo(world, "plaza", { weather: "clear", homeRecord: null })).toEqual({
      title: "Town plaza",
      region: "Cloverhollow",
    });
    expect(areaBannerInfo(world, "bay")).toEqual({
      title: "Bubblegum Bay",
      region: null,
    });
    expect(areaBannerInfo(world, "bay", { weather: "clear", homeRecord: null })).toEqual({
      title: "Bubblegum Bay",
      region: null,
    });
    expect(areaBannerInfo(world, "clubhouse")).toEqual({
      title: "Clubhouse",
      region: "The Forest",
    });
    expect(areaBannerInfo(world, "clubhouse", { weather: "clear", homeRecord: null })).toEqual({
      title: "Clubhouse",
      region: "The Forest",
    });
  });

  it("weaves outdoor Cozy Weather into outdoor eyebrows while sheltering indoor rooms", () => {
    expect(areaBannerInfo(world, "plaza", { weather: "sunshower" })).toEqual({
      title: "Town plaza",
      region: "Cloverhollow · Rainbow Sunshower",
    });
    expect(areaBannerInfo(world, "bay", { weather: "sunshower" })).toEqual({
      title: "Bubblegum Bay",
      region: "Rainbow Sunshower",
    });
    expect(areaBannerInfo(world, "pass", { weather: "snow-flurry" })).toEqual({
      title: "Pinecone Pass",
      region: "Snow Flurry",
    });
    expect(areaBannerInfo(world, "woods", { weather: "twilight-fireflies" })).toEqual({
      title: "The Whispering Woods",
      region: "The Forest · Twilight Fireflies",
    });

    // Sheltered indoor rooms ignore outdoor weather kinds cleanly.
    expect(areaBannerInfo(world, "bedroom", { weather: "sunshower" })).toEqual({
      title: "Fae's bedroom",
      region: "Cloverhollow",
    });
    expect(areaBannerInfo(world, "gym", { weather: "sunshower" })).toEqual({
      title: "School Gym",
      region: "Cloverhollow",
    });
    expect(areaBannerInfo(world, "clubhouse", { weather: "breeze-petals" })).toEqual({
      title: "Clubhouse",
      region: "The Forest",
    });
  });

  it("weaves pinned Home Record into Bedroom & Clubhouse and ignores non-home areas", () => {
    expect(areaBannerInfo(world, "clubhouse", { homeRecord: "festival" })).toEqual({
      title: "Clubhouse",
      region: "The Forest · ♪ Cloverhollow Jubilee",
    });
    expect(areaBannerInfo(world, "bedroom", { homeRecord: "festival" })).toEqual({
      title: "Fae's bedroom",
      region: "Cloverhollow · ♪ Cloverhollow Jubilee",
    });
    expect(areaBannerInfo(world, "plaza", { homeRecord: "festival" })).toEqual({
      title: "Town plaza",
      region: "Cloverhollow",
    });
    expect(
      areaBannerInfo(world, "plaza", { weather: "sunshower", homeRecord: "festival" }),
    ).toEqual({
      title: "Town plaza",
      region: "Cloverhollow · Rainbow Sunshower",
    });
    expect(
      areaBannerInfo(world, "clubhouse", { weather: "sunshower", homeRecord: "festival" }),
    ).toEqual({
      title: "Clubhouse",
      region: "The Forest · ♪ Cloverhollow Jubilee",
    });
  });

  it("forwards optional AreaBannerContext through createAreaBannerTracker.view()", () => {
    const kitchenFixture = fixtures.kitchen;
    const plazaFixture = fixtures.plaza;
    if (kitchenFixture === undefined || plazaFixture === undefined) {
      throw new Error("Missing kitchen or plaza fixtures");
    }
    const prev = createState(world, kitchenFixture);
    const arrived = { ...createState(world, plazaFixture), tick: prev.tick + 20 };

    const tracker = createAreaBannerTracker(150);
    tracker.update(world, prev, arrived);

    const legacy = tracker.view(world, arrived, true, false);
    expect(legacy.visible).toBe(true);
    expect(legacy.title).toBe("Town plaza");
    expect(legacy.region).toBe("Cloverhollow");

    const enriched = tracker.view(
      world,
      arrived,
      true,
      false,
      resolveAreaBannerContext(arrived, "sunshower", "festival"),
    );
    expect(enriched.visible).toBe(true);
    expect(enriched.title).toBe("Town plaza");
    expect(enriched.region).toBe("Cloverhollow · Rainbow Sunshower");

    expect(resolveAreaBannerContext({ area: "bedroom", tick: 0 }, "sunshower", "festival")).toEqual(
      { weather: "clear", homeRecord: "festival" },
    );
  });
});

describe("Milestone 229: Vite audio-scores Chunk Alignment & File Budgets", () => {
  it("routes all split audio/voice/music-synthesis modules cleanly into audio-scores", () => {
    const audioGroup = chunkGroups.find((item) => item.name === "audio-scores");
    expect(audioGroup?.priority).toBe(18);
    expect(audioGroup?.includeDependenciesRecursively).toBe(false);

    for (const modulePath of [
      "/repo/src/platform/scores.ts",
      "/repo/src/platform/scores-town.ts",
      "/repo/src/platform/audio-recipes.ts",
      "/repo/src/platform/audio-cue-recipes.ts",
      "/repo/src/platform/audio-effects.ts",
      "/repo/src/platform/voices.ts",
      "/repo/src/platform/voice-catalog.ts",
      "/repo/src/platform/ambience.ts",
      "/repo/src/platform/weather-ambience.ts",
      "/repo/src/platform/music-synth.ts",
      "/repo/src/platform/music-mix.ts",
    ]) {
      expect(routeModule(modulePath), modulePath).toBe("audio-scores");
    }

    // Platform entry controllers stay out of audio-scores.
    expect(routeModule("/repo/src/platform/audio.ts")).toBeNull();
    expect(routeModule("/repo/src/platform/music.ts")).toBeNull();
    expect(routeModule("/repo/src/platform/home-record-prefs.ts")).toBe("audio-scores");
  });

  it("keeps all touched implementation files cleanly under line budgets", () => {
    expect(lineCount("src/main.ts")).toBeLessThan(880);
    expect(lineCount("src/ui/area-banner.ts")).toBeLessThan(900);
    expect(lineCount("src/shell/overworld-feedback.ts")).toBeLessThan(900);
  });
});
