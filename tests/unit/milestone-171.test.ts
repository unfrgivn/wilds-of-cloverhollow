import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadContent } from "../../src/content/load";
import {
  createState,
  journalStarGems,
  setInkVariables,
  STAR_GEM_VARIABLES,
  starGemsFound,
  type State,
} from "../../src/core";
import { buildJournalView } from "../../src/shell/view-models";

describe("Milestone 171: Interactive Star Gem Field Ledger", () => {
  const { world, fixtures } = loadContent();
  const baseState = createState(world, fixtures["new-game"]!);

  const withVars = (state: State, vars: Record<string, boolean>): State => ({
    ...state,
    ink: setInkVariables(state.ink, vars),
  });

  it("returns all 7 canonical Star Gems with unique names, colors, and lore", () => {
    const empty = journalStarGems(world, baseState);
    expect(empty.map((entry) => entry.id)).toEqual([...STAR_GEM_VARIABLES]);
    expect(empty).toHaveLength(7);
    expect(empty.every((entry) => !entry.found)).toBe(true);
    expect(new Set(empty.map((entry) => entry.name)).size).toBe(7);
    expect(new Set(empty.map((entry) => entry.color)).size).toBe(7);
    for (const entry of empty) {
      expect(entry.areaName.trim().length).toBeGreaterThan(0);
      expect(entry.hint.trim().length).toBeGreaterThan(10);
      expect(entry.foundNote.trim().length).toBeGreaterThan(10);
      expect(entry.color).toMatch(/^#[0-9a-f]{6}$/i);
    }

    const partialState = withVars(baseState, {
      gem_park: true,
      gem_bay: true,
      gem_pass: true,
    });
    const partial = journalStarGems(world, partialState);
    expect(partial.filter((entry) => entry.found).map((entry) => entry.name)).toEqual([
      "Amethyst Star Gem",
      "Aqua Star Gem",
      "Frost Star Gem",
    ]);
    expect(partial.filter((entry) => !entry.found).map((entry) => entry.name)).toEqual([
      "Citrine Star Gem",
      "Prism Star Gem",
      "Amber Star Gem",
      "Clover Star Gem",
    ]);
    expect(starGemsFound(world, partialState)).toEqual({ found: 3, total: 7 });

    const completeState = withVars(
      baseState,
      Object.fromEntries(STAR_GEM_VARIABLES.map((id) => [id, true])),
    );
    const complete = journalStarGems(world, completeState);
    expect(complete.every((entry) => entry.found)).toBe(true);
    expect(starGemsFound(world, completeState)).toEqual({ found: 7, total: 7 });
  });

  it("populates starGems in buildJournalView when Journal is open and omits when closed", () => {
    const partialState = withVars(baseState, {
      gem_park: true,
      gem_bay: true,
      gem_pass: true,
    });
    const common = {
      world,
      notes: [],
      mapCentres: {},
      art: {
        stickerArt: () => null,
        prizeArt: () => null,
        fishArt: () => null,
      },
      muted: false,
      level: 1 as const,
      musicMuted: false,
      musicLevel: 1 as const,
      ambienceMuted: false,
      nowPlaying: "Cloverhollow",
      gentleTiming: false,
      keyHints: true,
      textSpeed: "cozy" as const,
      reducedMotion: false,
      hasLantern: true,
      hasFlute: true,
      hasLasso: true,
    };

    const closedView = buildJournalView({
      ...common,
      state: { ...partialState, journalOpen: false },
    });
    expect(closedView.starGems).toBeUndefined();

    const openView = buildJournalView({
      ...common,
      state: { ...partialState, journalOpen: true },
    });
    expect(openView.gems).toEqual({ found: 3, total: 7 });
    expect(openView.starGems).toHaveLength(7);
    expect(openView.starGems?.filter((entry) => entry.found).map((entry) => entry.id)).toEqual([
      "gem_park",
      "gem_bay",
      "gem_pass",
    ]);
  });

  it("keeps Journal implementation modules cleanly under 1,000 lines", () => {
    for (const file of [
      "src/ui/journal.ts",
      "src/ui/journal-field-note.ts",
      "src/ui/journal-gems-ledger.ts",
    ]) {
      const lines = readFileSync(file, "utf8").trimEnd().split("\n").length;
      expect(lines, `${file} line count`).toBeLessThan(960);
    }
  });
});
