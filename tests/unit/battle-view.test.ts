import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { BattleTalk } from "../../src/core";
import {
  battleMeterRemaining,
  battleTalkDialogueView,
  talkChoicesShown,
} from "../../src/ui/battle";

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

describe("countdown battle meter", () => {
  it("counts remaining fizz down from 1 to 0 as calm rises, clamped to [0, 1]", () => {
    expect(battleMeterRemaining(0)).toBe(1);
    expect(battleMeterRemaining(0.25)).toBe(0.75);
    expect(battleMeterRemaining(0.5)).toBe(0.5);
    expect(battleMeterRemaining(0.75)).toBe(0.25);
    expect(battleMeterRemaining(1)).toBe(0);
    expect(battleMeterRemaining(-0.4)).toBe(1);
    expect(battleMeterRemaining(1.6)).toBe(0);
  });

  it("initializes .battle-calm-fill at full width and renders fizz countdown attributes", () => {
    const css = readFileSync("src/ui/battle.css", "utf8");
    expect(css).toMatch(/\.battle-calm-fill\s*\{[^}]*width:\s*100%;/);
    const ts = readFileSync("src/ui/battle.ts", "utf8");
    expect(ts).toContain("const remainingFraction = battleMeterRemaining(view.calm);");
    expect(ts).toContain('setAttribute(track, "aria-label", `${view.critterName} fizz`);');
    expect(ts).toContain('calmHeart.classList.toggle("is-warm", calmFraction >= 0.75);');
    expect(ts).toContain("String(Math.round(remainingFraction * 100))");
    expect(ts).toContain("fill.style.width = `${remainingFraction * 100}%`;");
  });
});
