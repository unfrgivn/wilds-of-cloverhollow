import { describe, expect, it } from "vitest";
import { createState } from "../../src/core";
import { loadContent } from "../../src/content/load";
import {
  continueDetail,
  titleFlow,
  type TitleInput,
  type TitleMode,
} from "../../src/shell/title-flow";
import type { TitleChoiceId } from "../../src/ui/title";

const none: TitleInput = {
  up: false, down: false, left: false, right: false, confirm: false, cancel: false,
};

type Case = [string, TitleMode, TitleChoiceId, Partial<TitleInput>,
  { mode: TitleMode | null; selected?: TitleChoiceId; action: "continue" | "new-game" | null }];

// [what, mode, selected, input, expected]
const cases: Case[] = [
  ["fresh: directions stay on New game", "fresh", "new-game", { down: true },
    { mode: "fresh", selected: "new-game", action: null }],
  ["fresh: up stays on New game", "fresh", "new-game", { up: true },
    { mode: "fresh", selected: "new-game", action: null }],
  ["fresh: confirm starts a new game", "fresh", "new-game", { confirm: true },
    { mode: null, action: "new-game" }],
  ["fresh: a New game tap starts it", "fresh", "new-game", { choose: "new-game" },
    { mode: null, action: "new-game" }],
  ["fresh: there is no Continue to tap", "fresh", "new-game", { choose: "continue" },
    { mode: "fresh", selected: "new-game", action: null }],
  ["continue: down moves to New game", "continue", "continue", { down: true },
    { mode: "continue", selected: "new-game", action: null }],
  ["continue: up moves back to Continue", "continue", "new-game", { up: true },
    { mode: "continue", selected: "continue", action: null }],
  ["continue: confirm on Continue resumes", "continue", "continue", { confirm: true },
    { mode: null, action: "continue" }],
  ["continue: confirm on New game asks first, No selected", "continue", "new-game",
    { confirm: true }, { mode: "confirm", selected: "confirm-no", action: null }],
  ["continue: a Continue tap resumes", "continue", "new-game", { choose: "continue" },
    { mode: null, action: "continue" }],
  ["continue: a New game tap asks first", "continue", "continue", { choose: "new-game" },
    { mode: "confirm", selected: "confirm-no", action: null }],
  ["continue: cancel does nothing", "continue", "continue", { cancel: true },
    { mode: "continue", selected: "continue", action: null }],
  ["confirm: left picks Yes", "confirm", "confirm-no", { left: true },
    { mode: "confirm", selected: "confirm-yes", action: null }],
  ["confirm: right picks No", "confirm", "confirm-yes", { right: true },
    { mode: "confirm", selected: "confirm-no", action: null }],
  ["confirm: Yes starts a new game", "confirm", "confirm-yes", { confirm: true },
    { mode: null, action: "new-game" }],
  ["confirm: No goes back to Continue", "confirm", "confirm-no", { confirm: true },
    { mode: "continue", selected: "continue", action: null }],
  ["confirm: cancel goes back to Continue", "confirm", "confirm-yes", { cancel: true },
    { mode: "continue", selected: "continue", action: null }],
  ["confirm: a Yes tap starts a new game", "confirm", "confirm-no", { choose: "confirm-yes" },
    { mode: null, action: "new-game" }],
  ["confirm: a No tap goes back", "confirm", "confirm-yes", { choose: "confirm-no" },
    { mode: "continue", selected: "continue", action: null }],
  ["confirm: the hidden options ignore taps", "confirm", "confirm-no", { choose: "continue" },
    { mode: "confirm", selected: "confirm-no", action: null }],
  ["confirm: nothing pressed keeps the question", "confirm", "confirm-no", {},
    { mode: "confirm", selected: "confirm-no", action: null }],
];

describe("title flow", () => {
  for (const [what, mode, selected, input, expected] of cases) {
    it(what, () => {
      expect(titleFlow(mode, selected, { ...none, ...input })).toMatchObject(expected);
    });
  }
});

describe("the Continue detail", () => {
  it("names the area and counts stickers with the right plural", () => {
    const content = loadContent();
    const fixture = content.fixtures.plaza;
    if (fixture === undefined) throw new Error("plaza fixture missing");
    const state = createState(content.world, fixture);
    expect(continueDetail(content.world, state)).toBe("Town plaza · 0 stickers");
    expect(continueDetail(content.world, { ...state, stickers: ["fountain-frog"] }))
      .toBe("Town plaza · 1 sticker");
    expect(continueDetail(content.world, { ...state, stickers: ["a", "b"] }))
      .toBe("Town plaza · 2 stickers");
  });
});
