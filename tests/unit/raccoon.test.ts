import { describe, expect, it } from "vitest";
import { createState, journalNotes } from "../../src/core";
import { createInkState, inkVariable, runInk } from "../../src/core/ink";
import { loadContent } from "../../src/content/load";

const content = loadContent();
const story = content.world.story;

// Plays a knot from `ink`, picking `choice` at the first choice, and returns
// the lines shown and the story state after.
function play(ink: string, knot: string, choice?: number): { lines: string[]; ink: string } {
  const lines: string[] = [];
  let result = runInk(story, ink, { type: "start", knot });
  for (let count = 0; count < 20; count += 1) {
    if (result.line !== null) lines.push(result.line.text);
    if (result.choices.length > 0) {
      if (choice === undefined) break;
      result = runInk(story, result.ink, { type: "choose", index: choice });
      continue;
    }
    if (result.ended) break;
    result = runInk(story, result.ink, { type: "next" });
  }
  return { lines, ink: result.ink };
}

describe("the raccoon in the purple hood", () => {
  const fresh = createInkState(story, 1);
  const withPass = play(fresh, "nurse", 1).ink;

  it("waits only once Fae has the hall pass, and leaves after blabbing", () => {
    expect(inkVariable(story, fresh, "raccoon_waiting")).toBe(false);
    expect(inkVariable(story, withPass, "raccoon_waiting")).toBe(true);
    for (const choice of [0, 1]) {
      const met = play(withPass, "raccoon", choice);
      expect(met.lines.at(-1)).toBe("With a puff of purple fizz, the raccoon is gone!");
      expect(met.lines.join(" ")).toContain("\"Fizzlesticks\"! ...Oops.");
      expect(inkVariable(story, met.ink, "raccoon_waiting")).toBe(false);
      expect(inkVariable(story, met.ink, "knows_password")).toBe(true);
    }
  });

  it("the tree house opens with the password and holds a school name tag", () => {
    expect(play(fresh, "tree_house").lines).toEqual([
      "A tree house with a round door and a little sign: CLUB MEMBERS ONLY.",
      "I wonder what the password is.",
    ]);
    const met = play(withPass, "raccoon", 0).ink;
    const opened = play(met, "tree_house");
    expect(opened.lines.at(-1))
      .toBe("There's a name tag sewn inside the hood. It's from Cloverhollow School!");
    expect(inkVariable(story, opened.ink, "club_open")).toBe(true);
    expect(play(opened.ink, "tree_house").lines)
      .toEqual(["The club is empty. That purple hood belongs to someone at my school..."]);
  });

  it("the journal notes the password, then the hood", () => {
    const fixture = content.fixtures.plaza;
    if (fixture === undefined) throw new Error("plaza fixture missing");
    const base = createState(content.world, fixture);
    const met = play(withPass, "raccoon", 1).ink;
    const password =
      "The raccoon's club password is \"Fizzlesticks\". A club... like the tree house in the park?";
    expect(journalNotes(content.world, { ...base, ink: met })[0]).toBe(password);
    const opened = play(met, "tree_house").ink;
    const notes = journalNotes(content.world, { ...base, ink: opened });
    expect(notes[0])
      .toBe("The purple hood in the tree house has a Cloverhollow School name tag. Whose is it?");
    expect(notes.join(" ")).not.toContain("Fizzlesticks");
  });
});
