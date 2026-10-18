import { describe, expect, it } from "vitest";
import type { BattleTalk } from "../../src/core";
import { battleTalkDialogueView, talkChoicesShown } from "../../src/ui/battle";

const question: BattleTalk = {
  knot: "kid_talk_2", turn: 2, speaker: "Hooded Kid",
  text: "Nobody ever notices me anyway...", revealed: 100,
  choices: ["I notice you!", "Everybody noticed the scribbles."],
  selected: 1, ended: false, grade: null,
};

describe("battle Talk dialogue projection", () => {
  it("holds choices until the line is fully revealed", () => {
    const view = battleTalkDialogueView({ ...question, revealed: 8 });
    expect(view.speaker).toBe("Hooded Kid");
    expect(view.choices).toEqual([]);
    expect(view.canAdvance).toBe(false);
  });

  it("projects revealed choices and the selected sticker", () => {
    const view = battleTalkDialogueView(question);
    expect(view.choices).toEqual([
      { text: "I notice you!" },
      { text: "Everybody noticed the scribbles." },
    ]);
    expect(view.selected).toBe(1);
    expect(view.canAdvance).toBe(false);
  });

  it("puts the HUD aside only while a question's answers are on screen", () => {
    expect(talkChoicesShown(null)).toBe(false);
    expect(talkChoicesShown({ ...question, revealed: 8 })).toBe(false);
    expect(talkChoicesShown(question)).toBe(true);
    expect(talkChoicesShown({ ...question, text: "You... you saw those?", choices: [] }))
      .toBe(false);
  });
});
