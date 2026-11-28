import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ambientChatterSegments,
  extractBlipChar,
  resolveCueRecipe,
  scaleChoiceRecipe,
  scaleRecipePitch,
  voiceBlipSegments,
} from "../../src/platform/audio-playback";
import * as inputShortcuts from "../../src/shell/input-shortcuts";
import * as overlayGates from "../../src/shell/overlay-gates";
import { chunkGroups } from "../../vite.config";

function lineCount(filePath: string): number {
  return readFileSync(filePath, "utf8").trimEnd().split("\n").length;
}

function routeModule(modulePath: string): string | null {
  const ordered = [...chunkGroups].sort((a, b) => b.priority - a.priority);
  const match = ordered.find((group) => group.test.test(modulePath));
  return match?.name ?? null;
}

describe("Milestone 229: Chunk Diet, Credits Dialog & Modular Splits (Track E19Q)", () => {
  it("routes all pure audio modules into audio-scores while leaving core and main unrouted", () => {
    const audioGroup = chunkGroups.find((group) => group.name === "audio-scores");
    expect(audioGroup).toBeDefined();
    expect(audioGroup?.priority).toBe(18);
    expect(audioGroup?.includeDependenciesRecursively).toBe(false);

    const routedAudioModules = [
      "/repo/src/platform/audio-cue-recipes.ts",
      "/repo/src/platform/audio-effects.ts",
      "/repo/src/platform/audio-playback.ts",
      "/repo/src/platform/audio-settings.ts",
      "/repo/src/platform/voice-catalog.ts",
      "/repo/src/platform/music-synth.ts",
      "/repo/src/platform/music-mix.ts",
      "/repo/src/platform/weather-ambience.ts",
      "/repo/src/platform/scores-school.ts",
      "/repo/src/platform/audio-recipes.ts",
      "/repo/src/platform/voices.ts",
      "/repo/src/platform/ambience.ts",
    ] as const;

    for (const modulePath of routedAudioModules) {
      expect(routeModule(modulePath), modulePath).toBe("audio-scores");
    }

    expect(routeModule("/repo/src/core/music.ts")).toBeNull();
    expect(routeModule("/repo/src/main.ts")).toBeNull();
    expect(routeModule("/repo/src/platform/audio.ts")).toBeNull();
    expect(routeModule("/repo/src/platform/music.ts")).toBeNull();
  });

  it("re-exports overlay-gates identically from input-shortcuts with zero DOM globals", () => {
    expect(inputShortcuts.QA_HOLD_MS).toBe(overlayGates.QA_HOLD_MS);
    expect(inputShortcuts.photoKeyAction).toBe(overlayGates.photoKeyAction);
    expect(inputShortcuts.canPhotoMode).toBe(overlayGates.canPhotoMode);
    expect(inputShortcuts.canPhotoFromJournal).toBe(overlayGates.canPhotoFromJournal);
    expect(inputShortcuts.canBattlePeek).toBe(overlayGates.canBattlePeek);
    expect(inputShortcuts.canOverworldSteer).toBe(overlayGates.canOverworldSteer);
    expect(inputShortcuts.isJournalShortcutActive).toBe(overlayGates.isJournalShortcutActive);
    expect(inputShortcuts.isOverworldFree).toBe(overlayGates.isOverworldFree);
    expect(inputShortcuts.isBannerEligible).toBe(overlayGates.isBannerEligible);
    expect(inputShortcuts.matchesClosest).toBe(overlayGates.matchesClosest);

    expect(
      overlayGates.matchesClosest({ closest: (sel) => (sel === "input" ? {} : null) }, "input"),
    ).toBe(true);
    expect(
      overlayGates.matchesClosest({ closest: () => null }, "input"),
    ).toBe(false);
    expect(overlayGates.matchesClosest(null, "input")).toBe(false);

    const gatesSource = readFileSync("src/shell/overlay-gates.ts", "utf8");
    expect(gatesSource).not.toMatch(/\b(window|document|HTMLElement|navigator|localStorage)\b/);

    expect(lineCount("src/shell/input-shortcuts.ts")).toBeLessThan(510);
    expect(lineCount("src/shell/overlay-gates.ts")).toBeLessThan(220);
    expect(lineCount("src/platform/audio.ts")).toBeLessThan(440);
    expect(lineCount("src/platform/audio-playback.ts")).toBeLessThan(290);
  });

  it("declares WCAG dialog, focus, and keyboard-close semantics on Credits", () => {
    const creditsTs = readFileSync("src/ui/credits.ts", "utf8");
    expect(creditsTs).toContain('screen.setAttribute("role", "dialog")');
    expect(creditsTs).toContain('screen.setAttribute("aria-modal", "true")');
    expect(creditsTs).toContain('screen.setAttribute("aria-label", "Credits")');
    expect(creditsTs).toContain("screen.tabIndex = -1;");
    expect(creditsTs).toContain("screen.focus({ preventScroll: true })");
    expect(creditsTs).toContain('event.key === "Escape"');
    expect(creditsTs).toContain('event.key === "Enter"');
    expect(creditsTs).toContain('event.key === " "');

    const creditsCss = readFileSync("src/ui/credits.css", "utf8");
    expect(creditsCss).toContain(".credits-screen:focus,");
    expect(creditsCss).toContain(".credits-screen:focus-visible { outline: none; }");
  });

  it("preserves deterministic audio-playback recipe & voice synthesis helpers", () => {
    expect(extractBlipChar("Hi!", 3)).toBe("i");
    expect(extractBlipChar("Hi!", 2)).toBe("i");
    expect(extractBlipChar("Hi!", 0)).toBeUndefined();

    const blipSegments = voiceBlipSegments(
      {
        wave: "triangle",
        frequency: 440,
        endFrequency: 480,
        duration: 0.05,
        gain: 0.1,
        harmonic: 2,
      },
      0.05,
      0.1,
      0.002,
      0.28,
    );
    expect(blipSegments).toHaveLength(2);
    const harmonic = blipSegments[1];
    expect(harmonic?.wave).toBe("sine");
    expect(harmonic !== undefined && harmonic.wave !== "noise" ? harmonic.frequency : 0)
      .toBe(880);

    const chatter = ambientChatterSegments("Maddie");
    expect(chatter).not.toBeNull();
    expect(chatter?.[0]?.duration).toBe(0.038);

    const choice = scaleChoiceRecipe("home", "choice-move", 2, 1);
    expect(choice).toHaveLength(2);
    const footstep = resolveCueRecipe("footstep-grass", "home", 12);
    expect(footstep.length).toBeGreaterThan(0);
    const pitched = scaleRecipePitch(
      [{ wave: "noise", lowpass: 1000, offset: 0, duration: 0.04, gain: 0.05 }],
      1.05,
    );
    expect(pitched[0]?.wave === "noise" ? pitched[0].lowpass : 0).toBeCloseTo(1050, 5);
  });
});
