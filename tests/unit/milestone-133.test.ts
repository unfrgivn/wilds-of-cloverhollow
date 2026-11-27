import { describe, expect, it } from "vitest";
import {
  effectRecipe,
  effectRecipes,
  type CompanionAudioEffect,
} from "../../src/platform/audio-recipes";
import { titleEffectForTransition } from "../../src/shell/title-flow";

const ALL_EFFECTS: readonly CompanionAudioEffect[] = [
  "pet-cat",
  "pet-pup",
  "pet-squirrel",
  "pet-bunny",
  "rest-sit",
  "camera-shutter",
  "title-move",
  "title-start",
  "page-turn",
  "card-open",
  "card-close",
  "toggle-on",
  "toggle-off",
];

const UI_FOLEY_EFFECTS: readonly CompanionAudioEffect[] = [
  "title-move",
  "title-start",
  "page-turn",
  "card-open",
  "card-close",
  "toggle-on",
  "toggle-off",
];

describe("Milestone 133: Tactile Storybook UI Foley & Title Transition Helpers", () => {
  it("defines all 13 CompanionAudioEffect recipes with valid gentle segments", () => {
    expect(Object.keys(effectRecipes).sort()).toEqual([...ALL_EFFECTS].sort());
    for (const effect of ALL_EFFECTS) {
      const recipe = effectRecipe(effect);
      expect(recipe.length, `${effect} must have at least one segment`).toBeGreaterThan(0);
      for (const segment of recipe) {
        expect(segment.offset, `${effect} offset >= 0`).toBeGreaterThanOrEqual(0);
        expect(segment.duration, `${effect} duration > 0`).toBeGreaterThan(0);
        expect(segment.gain, `${effect} gain > 0`).toBeGreaterThan(0);
        expect(segment.gain, `${effect} gain <= 0.14`).toBeLessThanOrEqual(0.14);
        if (segment.wave === "noise") {
          expect(segment.lowpass, `${effect} lowpass > 0`).toBeGreaterThan(0);
        } else {
          expect(segment.frequency, `${effect} frequency > 0`).toBeGreaterThan(0);
        }
      }
    }
    for (const uiEffect of UI_FOLEY_EFFECTS) {
      for (const segment of effectRecipe(uiEffect)) {
        expect(segment.gain, `${uiEffect} gentle gain <= 0.08`).toBeLessThanOrEqual(0.08);
        expect(segment.wave, `${uiEffect} avoids harsh square wave`).not.toBe("square");
      }
    }
  });

  it("maps title transitions to title-move, title-start, card-open, card-close, or null", () => {
    expect(
      titleEffectForTransition(
        { mode: "continue", selected: "continue" },
        { mode: "continue", selected: "new-game", action: null },
      ),
    ).toBe("title-move");

    expect(
      titleEffectForTransition(
        { mode: "confirm", selected: "confirm-no" },
        { mode: "confirm", selected: "confirm-yes", action: null },
      ),
    ).toBe("title-move");

    expect(
      titleEffectForTransition(
        { mode: "continue", selected: "continue" },
        { mode: null, selected: "continue", action: "continue" },
      ),
    ).toBe("title-start");

    expect(
      titleEffectForTransition(
        { mode: "fresh", selected: "new-game" },
        { mode: null, selected: "new-game", action: "new-game" },
      ),
    ).toBe("title-start");

    expect(
      titleEffectForTransition(
        { mode: "confirm", selected: "confirm-yes" },
        { mode: null, selected: "confirm-yes", action: "new-game" },
      ),
    ).toBe("title-start");

    expect(
      titleEffectForTransition(
        { mode: "continue", selected: "new-game" },
        { mode: "confirm", selected: "confirm-no", action: null },
      ),
    ).toBe("card-open");

    expect(
      titleEffectForTransition(
        { mode: "confirm", selected: "confirm-no" },
        { mode: "continue", selected: "continue", action: null },
      ),
    ).toBe("card-close");

    expect(
      titleEffectForTransition(
        { mode: "continue", selected: "continue" },
        { mode: "continue", selected: "continue", action: null },
      ),
    ).toBeNull();
  });
});
