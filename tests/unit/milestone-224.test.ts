import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseCometCalibration } from "../../src/content/load";
import { adaptHintForInputMode } from "../../src/ui/battle-checks-helpers";
import { layoutComet } from "../../src/ui/comet-layout";
import type { CometView } from "../../src/core";
import arcadeData from "../../content/arcade.json";
import cometCalibrationData from "../../public/assets/arcade/comet-cabinet.json";

const cometCalibration = parseCometCalibration(
  cometCalibrationData,
  "public/assets/arcade/comet-cabinet.json",
);

const sampleCometView = (patch: Partial<CometView> = {}): CometView => ({
  game: "comet",
  phase: "playing",
  rocket: { lane: 1, position: 1, lean: 0, wobble: 0 },
  objects: [],
  caught: 0,
  total: 16,
  left: 16,
  hint: arcadeData.comet.lines.play,
  message: "",
  revealed: 0,
  ...patch,
});

describe(
  "Milestone 222: Complete 7-of-7 Minigame Steam Deck / Gamepad Adaptive Hint Parity",
  () => {
  it("adapts claw, skee, comet, cook, and escape/keycap hints cleanly for gamepad", () => {
    const cases: readonly [string, string][] = [
      // Claw Machine
      [
        arcadeData.claw.lines.slide,
        "Hold A to slide the claw. Let go to stop it!",
      ],
      [
        arcadeData.claw.lines.push,
        "Hold A to push it back. Let go to drop it!",
      ],
      // Skee-Ball
      [
        arcadeData.skee.lines.aim,
        "Press A to aim the ball!",
      ],
      [
        arcadeData.skee.lines.power,
        "Hold A to wind up. Let go to roll!",
      ],
      // Comet Cruise
      [
        arcadeData.comet.lines.ready,
        "Get ready!",
      ],
      [
        arcadeData.comet.lines.play,
        "Catch the stars with Stick / D-Pad and dodge space rocks!",
      ],
      // Clubhouse Microwave (Cook)
      [
        arcadeData.cook.lines.start.replace("{time}", "1:00"),
        "The box says 1:00. Hold A to cook, and let go when it's golden!",
      ],
      [
        arcadeData.cook.lines.frozen,
        "Still frozen in the middle! Hold A to cook it some more.",
      ],
      // Escape / leave pills & generic control labels
      ["Esc · Leave", "B · Leave"],
      ["Esc · Pack up", "B · Pack up"],
      ["Esc", "B"],
      ["Hold Confirm to charge!", "Hold A to charge!"],
      ["Press Confirm to cast!", "Press A to cast!"],
      ["Tap Confirm to boop!", "Tap A to boop!"],
      ["Tap to jump!", "Tap A to jump!"],
      ["Use Left / Right to steer!", "Use Stick / D-Pad to steer!"],
      ["Steer with Arrows!", "Steer with Stick / D-Pad!"],
      ["Press Space to start!", "Press A to start!"],
      ["Press Z to talk!", "Press A to talk!"],
    ];

    for (const [keyboardHint, gamepadHint] of cases) {
      expect(adaptHintForInputMode(keyboardHint)).toBe(keyboardHint);
      expect(adaptHintForInputMode(keyboardHint, "keyboard")).toBe(keyboardHint);
      const adapted = adaptHintForInputMode(keyboardHint, "gamepad");
      expect(adapted).toBe(gamepadHint);
      expect(adapted).not.toMatch(/\bConfirm\b/i);
      expect(adapted).not.toMatch(/\bEsc\b/);
    }
  });

  it("adapts Comet Cruise lane keycaps between keyboard arrows and gamepad D-Pad glyphs", () => {
    const keyboardDefault = layoutComet(sampleCometView(), cometCalibration, 0.42);
    const keyboardExplicit = layoutComet(sampleCometView(), cometCalibration, 0.42, "keyboard");
    const gamepad = layoutComet(sampleCometView(), cometCalibration, 0.42, "gamepad");

    expect(keyboardDefault.keys.map((key) => key.label)).toEqual(["←", "→"]);
    expect(keyboardExplicit.keys.map((key) => key.label)).toEqual(["←", "→"]);
    expect(gamepad.keys.map((key) => key.label)).toEqual(["◀", "▶"]);
  });

  it("wires inputMode across all 7 minigames, createArcade, and renderOverlays", () => {
    const minigameFiles = [
      "src/ui/claw.ts",
      "src/ui/skee.ts",
      "src/ui/mole.ts",
      "src/ui/comet.ts",
      "src/ui/cook.ts",
      "src/ui/fish.ts",
      "src/ui/taco.ts",
    ] as const;

    for (const file of minigameFiles) {
      const src = readFileSync(file, "utf8");
      expect(src, `${file} should accept inputMode`).toMatch(/inputMode\??:/);
      expect(src, `${file} should default inputMode to "keyboard"`).toMatch(
        /inputMode\s*=\s*"keyboard"/,
      );
      expect(src, `${file} should use adaptHintForInputMode`).toMatch(/adaptHintForInputMode/);
    }

    const arcadeSrc = readFileSync("src/ui/arcade.ts", "utf8");
    for (const name of ["clawUp", "skeeUp", "moleUp", "cometUp", "cookUp", "fishUp", "tacoUp"]) {
      const pattern = new RegExp(`${name}\\??\\.render\\([\\s\\S]*?inputMode`);
      expect(arcadeSrc, `src/ui/arcade.ts should forward inputMode to ${name}`).toMatch(pattern);
    }

    const assetsSrc = readFileSync("src/shell/assets.ts", "utf8");
    for (const name of [
      "clawOverlay",
      "skeeOverlay",
      "moleOverlay",
      "cometOverlay",
      "cookOverlay",
      "fishOverlay",
      "tacoOverlay",
    ]) {
      const pattern = new RegExp(`${name}(?:\\.get\\(\\))?\\?\\.render\\([\\s\\S]*?inputMode`);
      expect(
        assetsSrc,
        `src/shell/assets.ts should forward inputMode to ${name}`,
      ).toMatch(pattern);
    }
  });
});
