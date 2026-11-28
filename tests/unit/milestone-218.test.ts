import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as atmosphereBiomes from "../../src/render/atmosphere-biomes";
import * as atmosphereOutdoor from "../../src/render/atmosphere-outdoor";
import * as battleChecks from "../../src/ui/battle-checks";
import * as battleChecksHelpers from "../../src/ui/battle-checks-helpers";
import { adaptHintForInputMode } from "../../src/ui/battle-checks";

describe("Milestone 218: Adaptive Gamepad Hints & Modular Splits", () => {
  it("adapts Fishing, Taco Truck, and Battle Check hints on gamepad while leaving keyboard exact",
    () => {
      const cases: readonly [string, string][] = [
        [
          "Press Confirm to cast! Farther casts reach rare lake treasures.",
          "Press A to cast! Farther casts reach rare lake treasures.",
        ],
        [
          "BITE! Press Confirm NOW!",
          "BITE! Press A NOW!",
        ],
        [
          "Hold or tap Confirm to keep the bobber on the fish!",
          "Hold or tap A to keep the bobber on the fish!",
        ],
        [
          "Chef Mateo's Taco Truck! Press Confirm to start the lunch rush!",
          "Chef Mateo's Taco Truck! Press A to start the lunch rush!",
        ],
        [
          "Match the order ticket! Up Beans · Right Cheese · Down Salsa · Left Avocado.",
          "Match the order ticket! D-Pad ↑ Beans · → Cheese · ↓ Salsa · ← Avocado.",
        ],
        [
          "Press confirm as the lullaby ring meets the star!",
          "Press A as the lullaby ring meets the star!",
        ],
        [
          "Tap confirm on each rainbow star beat!",
          "Tap A on each rainbow star beat!",
        ],
        [
          "Circle directions to spin the lasso, then press confirm to snag!",
          "Circle directions to spin the lasso, then press A to snag!",
        ],
        [
          "Tap confirm together for the Cloverhollow Harmony!",
          "Tap A together for the Cloverhollow Harmony!",
        ],
      ];

      for (const [keyboardHint, gamepadHint] of cases) {
        // Default 1-arg and explicit "keyboard" stay 100% byte-identical.
        expect(adaptHintForInputMode(keyboardHint)).toBe(keyboardHint);
        expect(adaptHintForInputMode(keyboardHint, "keyboard")).toBe(keyboardHint);
        expect(adaptHintForInputMode(keyboardHint, "gamepad")).toBe(gamepadHint);
      }

      // Word boundaries protect words that merely contain "confirm" as a substring.
      expect(adaptHintForInputMode("Unconfirmed catch confirmed!", "gamepad")).toBe(
        "Unconfirmed catch confirmed!",
      );
      expect(adaptHintForInputMode("Tap the matching topping bowl!", "gamepad")).toBe(
        "Tap the matching topping bowl!",
      );
    });

  it("re-exports battle-checks-helpers and atmosphere-biomes identically with purity & budgets",
    () => {
      // Reference-identical re-exports through src/ui/battle-checks.ts.
      expect(battleChecks.adaptHintForInputMode).toBe(battleChecksHelpers.adaptHintForInputMode);
      expect(battleChecks.chainIcon).toBe(battleChecksHelpers.chainIcon);
      expect(battleChecks.clamp01).toBe(battleChecksHelpers.clamp01);
      expect(battleChecks.echoChimeMeta).toBe(battleChecksHelpers.echoChimeMeta);
      expect(battleChecks.GRADE_GAP).toBe(battleChecksHelpers.GRADE_GAP);
      expect(battleChecks.gradeLabels).toBe(battleChecksHelpers.gradeLabels);
      expect(battleChecks.peekabooEyesIcon).toBe(battleChecksHelpers.peekabooEyesIcon);
      expect(battleChecks.peekabooLabels).toBe(battleChecksHelpers.peekabooLabels);
      expect(battleChecks.peekabooStarIcon).toBe(battleChecksHelpers.peekabooStarIcon);
      expect(battleChecks.PUFF_GAP).toBe(battleChecksHelpers.PUFF_GAP);
      expect(battleChecks.PUFF_SPACING).toBe(battleChecksHelpers.PUFF_SPACING);
      expect(battleChecks.renderGrade).toBe(battleChecksHelpers.renderGrade);
      expect(battleChecks.resolveCheckPointerDirection).toBe(
        battleChecksHelpers.resolveCheckPointerDirection,
      );
      expect(battleChecks.starIcon).toBe(battleChecksHelpers.starIcon);
      expect(battleChecks.SWOOSH_CYCLES).toBe(battleChecksHelpers.SWOOSH_CYCLES);
      expect(battleChecks.swooshIcon).toBe(battleChecksHelpers.swooshIcon);
      expect(battleChecks.tracePathData).toBe(battleChecksHelpers.tracePathData);

      // Reference-identical re-exports through src/render/atmosphere-outdoor.ts.
      expect(atmosphereOutdoor.evaluateWildsBiomeAtmosphere).toBe(
        atmosphereBiomes.evaluateWildsBiomeAtmosphere,
      );
      expect(atmosphereOutdoor.WILDS_BIOME_AREAS).toBe(atmosphereBiomes.WILDS_BIOME_AREAS);

      // Delegation parity across all wilds biomes.
      for (const areaId of atmosphereBiomes.WILDS_BIOME_AREAS) {
        const fromOutdoor = atmosphereOutdoor.evaluateOutdoorAtmosphere(areaId, 1600, 960, 42);
        const fromBiomes = atmosphereBiomes.evaluateWildsBiomeAtmosphere(areaId, 1600, 960, 42);
        expect(fromOutdoor).not.toBeNull();
        expect(fromOutdoor).toEqual(fromBiomes);
      }

      // Pixi-free and DOM-free purity for src/render/atmosphere-biomes.ts.
      const biomesSrc = readFileSync("src/render/atmosphere-biomes.ts", "utf8");
      expect(biomesSrc).not.toMatch(/from\s+["']pixi\.js["']/);
      expect(biomesSrc).not.toMatch(/\b(document|window|HTMLElement)\b/);

      // Strict modular line budgets.
      const lineCount = (path: string): number =>
        readFileSync(path, "utf8").trimEnd().split("\n").length;

      expect(lineCount("src/ui/battle-checks.ts")).toBeLessThan(540);
      expect(lineCount("src/ui/battle-checks-helpers.ts")).toBeLessThan(360);
      expect(lineCount("src/render/atmosphere-outdoor.ts")).toBeLessThan(480);
      expect(lineCount("src/render/atmosphere-biomes.ts")).toBeLessThan(420);
      expect(lineCount("src/main.ts")).toBeLessThan(890);
    });
});
