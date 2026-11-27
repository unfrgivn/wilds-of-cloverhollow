import { describe, expect, it } from "vitest";
import { createRewardSticker } from "../../src/ui/battle";
import { createCredits } from "../../src/ui/credits";
import {
  createDialogueBox,
  createPrompt,
  shouldAdvanceDialogueClick,
  type DialogueClickState,
} from "../../src/ui/sticker";

function state(overrides: Partial<DialogueClickState> = {}): DialogueClickState {
  return {
    visible: true,
    text: "Hello Cloverhollow!",
    revealed: 19,
    choices: [],
    canAdvance: true,
    ...overrides,
  };
}

describe("Milestone 126: Universal Pointer & Touch Click-to-Advance Ergonomics", () => {
  it("evaluates shouldAdvanceDialogueClick across hidden, typing, choice, and idle states", () => {
    // Hidden box never advances on click, even when typing or marked advanceable.
    expect(shouldAdvanceDialogueClick(state({ visible: false }))).toBe(false);
    expect(shouldAdvanceDialogueClick(state({ visible: false, revealed: 3 }))).toBe(false);

    // Visible and still typing always accepts click-to-reveal (with or without choices queued).
    expect(shouldAdvanceDialogueClick(state({ revealed: 0, canAdvance: false }))).toBe(true);
    expect(shouldAdvanceDialogueClick(state({ revealed: 5, canAdvance: true }))).toBe(true);
    expect(
      shouldAdvanceDialogueClick(
        state({
          revealed: 4,
          canAdvance: false,
          choices: [{ text: "Yes" }, { text: "No" }],
        }),
      ),
    ).toBe(true);

    // Fully revealed non-choice line advances only when canAdvance is true.
    expect(shouldAdvanceDialogueClick(state({ revealed: 19, canAdvance: true }))).toBe(true);
    expect(shouldAdvanceDialogueClick(state({ revealed: 99, canAdvance: true }))).toBe(true);
    expect(shouldAdvanceDialogueClick(state({ revealed: 19, canAdvance: false }))).toBe(false);

    // Fully revealed line with open choices must never accidentally pick an option on box click.
    expect(
      shouldAdvanceDialogueClick(
        state({
          revealed: 19,
          canAdvance: false,
          choices: [{ text: "Go see right now!" }, { text: "School first." }],
        }),
      ),
    ).toBe(false);
    expect(
      shouldAdvanceDialogueClick(
        state({
          revealed: 19,
          canAdvance: true,
          choices: [{ text: "Go see right now!" }],
        }),
      ),
    ).toBe(false);
  });

  it("exposes verified callback APIs on dialogue, prompt, reward card, and credits modules", () => {
    expect(typeof createDialogueBox).toBe("function");
    expect(typeof createPrompt).toBe("function");
    expect(typeof createRewardSticker).toBe("function");
    expect(typeof createCredits).toBe("function");

    type DialogueApi = ReturnType<typeof createDialogueBox>;
    type PromptApi = ReturnType<typeof createPrompt>;
    type RewardApi = ReturnType<typeof createRewardSticker>;
    type CreditsApi = ReturnType<typeof createCredits>;

    const verifyDialogue: (api: DialogueApi) => void = (api) => {
      api.onAdvance(() => undefined);
    };
    const verifyPrompt: (api: PromptApi) => void = (api) => {
      api.onActivate(() => undefined);
    };
    const verifyReward: (api: RewardApi) => void = (api) => {
      api.onConfirm(() => undefined);
    };
    const verifyCredits: (api: CreditsApi) => void = (api) => {
      api.onClose(() => undefined);
    };

    expect(typeof verifyDialogue).toBe("function");
    expect(typeof verifyPrompt).toBe("function");
    expect(typeof verifyReward).toBe("function");
    expect(typeof verifyCredits).toBe("function");
  });
});
