import { describe, expect, it } from "vitest";
import { jukeboxTracks, trackTitles } from "../../src/core";
import {
  defaultMinigameRecords,
  formatArcadeRecordPills,
  type MinigameRecords,
} from "../../src/platform/minigame-records";
import {
  resolveHudHintVisibility,
  type HudHintsView,
} from "../../src/ui/hud-hints";
import { formatJukeboxLabel, stepJournalPage } from "../../src/ui/journal";

describe("Milestone 116: Journal Arcade Records Strip", () => {
  it("returns an empty array when all records are zero or invalid", () => {
    expect(formatArcadeRecordPills(defaultMinigameRecords())).toEqual([]);
    expect(
      formatArcadeRecordPills({
        skee: -10,
        mole: Number.NaN,
        comet: 0,
        fish: Infinity,
        cook: -1,
      }),
    ).toEqual([]);
  });

  it("formats partial records in canonical order and skips zero scores", () => {
    const partial: MinigameRecords = { skee: 0, mole: 14, comet: 0, fish: 5, cook: 0 };
    expect(formatArcadeRecordPills(partial)).toEqual([
      { id: "mole", label: "Boop-a-Mole", value: "14 boops" },
      { id: "fish", label: "Fishing Streak", value: "5" },
    ]);
  });

  it("formats all five records in canonical order with exact labels and integer flooring", () => {
    const full: MinigameRecords = { skee: 220.9, mole: 14.4, comet: 18, fish: 5.2, cook: 3.8 };
    expect(formatArcadeRecordPills(full)).toEqual([
      { id: "skee", label: "Skee-Ball", value: "220" },
      { id: "mole", label: "Boop-a-Mole", value: "14 boops" },
      { id: "comet", label: "Comet Cruise", value: "18 stars" },
      { id: "fish", label: "Fishing Streak", value: "5" },
      { id: "cook", label: "Golden Dishes", value: "3" },
    ]);
  });
});

describe("Milestone 116: Keyboard-Accessible 29-Track Music Box Jukebox", () => {
  it("formats accessible track labels for live area themes and active jukebox browsing", () => {
    const fishingIndex = jukeboxTracks.indexOf("fishing");
    expect(jukeboxTracks).toHaveLength(29);
    expect(fishingIndex).toBe(9);
    expect(trackTitles.fishing).toBe("Docked by the Tide");

    expect(
      formatJukeboxLabel(trackTitles.fishing, {
        active: true,
        index: fishingIndex,
        total: jukeboxTracks.length,
      }),
    ).toBe(
      "Track 10 of 29: Docked by the Tide — press Left or Right to browse, " +
        "Enter to return to area theme",
    );

    expect(
      formatJukeboxLabel(trackTitles.home, {
        active: false,
        index: jukeboxTracks.indexOf("home"),
        total: jukeboxTracks.length,
      }),
    ).toBe("Now playing: Cloverhollow Town — press Left or Right to browse Music Box");

    expect(formatJukeboxLabel("Cloverhollow Town")).toBe(
      "Now playing: Cloverhollow Town — press Left or Right to browse Music Box",
    );
  });

  it("keeps Journal tab stepping wrap-around intact", () => {
    expect(stepJournalPage("notes", 1)).toBe("map");
    expect(stepJournalPage("map", 1)).toBe("options");
    expect(stepJournalPage("options", 1)).toBe("notes");
    expect(stepJournalPage("notes", -1)).toBe("options");
  });
});

describe("Milestone 116: Discoverable Photo & Battle Field Guide Key Hints", () => {
  const baseView: HudHintsView = {
    visible: false,
    canInteract: false,
    interactLabel: "Talk",
    hasLantern: false,
    lanternOn: false,
    hasFlute: false,
    muted: false,
  };

  it("hides both overworld ribbon and battle hint by default", () => {
    expect(resolveHudHintVisibility(baseView)).toEqual({
      showRibbon: false,
      showPhoto: false,
      showBattleGuide: false,
    });
  });

  it("shows P Photo only when overworld ribbon is visible and canPhoto is true", () => {
    expect(
      resolveHudHintVisibility({ ...baseView, visible: true, canPhoto: true }),
    ).toEqual({
      showRibbon: true,
      showPhoto: true,
      showBattleGuide: false,
    });

    expect(
      resolveHudHintVisibility({ ...baseView, visible: true, canPhoto: false }),
    ).toEqual({
      showRibbon: true,
      showPhoto: false,
      showBattleGuide: false,
    });

    expect(
      resolveHudHintVisibility({ ...baseView, visible: false, canPhoto: true }),
    ).toEqual({
      showRibbon: false,
      showPhoto: false,
      showBattleGuide: false,
    });
  });

  it("shows I Field Guide only during battle command phase when ribbon is hidden", () => {
    expect(
      resolveHudHintVisibility({ ...baseView, visible: false, battlePeekHint: true }),
    ).toEqual({
      showRibbon: false,
      showPhoto: false,
      showBattleGuide: true,
    });

    // Overworld ribbon and battle hint are mutually exclusive.
    expect(
      resolveHudHintVisibility({
        ...baseView,
        visible: true,
        canPhoto: true,
        battlePeekHint: true,
      }),
    ).toEqual({
      showRibbon: true,
      showPhoto: true,
      showBattleGuide: false,
    });
  });
});
