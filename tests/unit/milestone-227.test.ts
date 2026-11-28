import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as arcadeParsers from "../../src/content/arcade-parsers";
import * as minigameParsers from "../../src/content/minigame-parsers";
import * as audioCueRecipes from "../../src/platform/audio-cue-recipes";
import * as audioRecipes from "../../src/platform/audio-recipes";

function lineCount(filePath: string): number {
  return readFileSync(filePath, "utf8").trimEnd().split("\n").length;
}

describe("Milestone 227: Battle & Title WCAG 4.1.3 Parity + Modular Splits (Track E19P)", () => {
  it("declares polite atomic live regions across battle check feedback and phase callouts", () => {
    const checks = readFileSync("src/ui/battle-checks.ts", "utf8");
    expect(checks).toContain('peekabooStatusLabel.setAttribute("role", "status")');
    expect(checks).toContain('peekabooStatusLabel.setAttribute("aria-live", "polite")');
    expect(checks).toContain('peekabooStatusLabel.setAttribute("aria-atomic", "true")');
    expect(checks).toContain('echoPhase.setAttribute("role", "status")');
    expect(checks).toContain('echoPhase.setAttribute("aria-live", "polite")');
    expect(checks).toContain('echoPhase.setAttribute("aria-atomic", "true")');
    expect(checks).toContain('hint.setAttribute("aria-live", "polite")');
    expect(checks).toContain('hint.setAttribute("aria-atomic", "true")');
    expect(checks).toContain('grade.setAttribute("role", "status")');
    expect(checks).toContain('grade.setAttribute("aria-live", "polite")');
    expect(checks).toContain('grade.setAttribute("aria-atomic", "true")');

    const checksV2 = readFileSync("src/ui/battle-checks-v2.ts", "utf8");
    expect(checksV2).toContain('whichPhase.setAttribute("role", "status")');
    expect(checksV2).toContain('whichPhase.setAttribute("aria-live", "polite")');
    expect(checksV2).toContain('whichPhase.setAttribute("aria-atomic", "true")');

    const overlays = readFileSync("src/ui/battle-overlays.ts", "utf8");
    expect(overlays).toContain('turnHeader.setAttribute("aria-live", "polite")');
    expect(overlays).toContain('turnHeader.setAttribute("aria-atomic", "true")');

    const foes = readFileSync("src/ui/battle-foes.ts", "utf8");
    expect(foes).toContain('banner.setAttribute("role", "status")');
    expect(foes).toContain('banner.setAttribute("aria-live", "polite")');
    expect(foes).toContain('banner.setAttribute("aria-atomic", "true")');

    const title = readFileSync("src/ui/title.ts", "utf8");
    expect(title).toContain('confirm.setAttribute("role", "alertdialog")');
    expect(title).toContain('confirm.setAttribute("aria-modal", "true")');
    expect(title).toContain('confirmText.id = "title-confirm-text"');
    expect(title).toContain('confirm.setAttribute("aria-labelledby", "title-confirm-text")');
    expect(title).toContain('if (event.target === confirm) chooseLater("confirm-no")');
  });

  it("re-exports soundCueRecipes and minigame parsers identically within line budgets", () => {
    expect(audioRecipes.soundCueRecipes).toBe(audioCueRecipes.soundCueRecipes);
    const cueSource = readFileSync("src/platform/audio-cue-recipes.ts", "utf8");
    expect(cueSource).toContain('import type { AudioRecipe } from "./audio-recipes";');
    expect(cueSource).not.toMatch(/^import\s+\{[^}]*\}\s+from\s+"\.\/audio-recipes"/m);

    expect(arcadeParsers.parseCook).toBe(minigameParsers.parseCook);
    expect(arcadeParsers.parseFish).toBe(minigameParsers.parseFish);
    expect(arcadeParsers.parseTaco).toBe(minigameParsers.parseTaco);
    expect(arcadeParsers.parseCookCalibration).toBe(minigameParsers.parseCookCalibration);
    expect(arcadeParsers.parseFishCalibration).toBe(minigameParsers.parseFishCalibration);
    expect(arcadeParsers.parseTacoCalibration).toBe(minigameParsers.parseTacoCalibration);

    expect(lineCount("src/platform/audio-recipes.ts")).toBeLessThan(400);
    expect(lineCount("src/platform/audio-cue-recipes.ts")).toBeLessThan(420);
    expect(lineCount("src/content/arcade-parsers.ts")).toBeLessThan(420);
    expect(lineCount("src/content/minigame-parsers.ts")).toBeLessThan(300);
    expect(lineCount("src/ui/battle.ts")).toBeLessThan(700);
  });
});
