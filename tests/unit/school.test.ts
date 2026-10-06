import { describe, expect, it } from "vitest";
import { createState, journalNotes } from "../../src/core";
import { createInkState, runInk } from "../../src/core/ink";
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

describe("school day story", () => {
  const fresh = createInkState(story, 1);

  it("gives the hall pass for an offer of help, not for a fib", () => {
    const fib = play(fresh, "nurse", 0);
    expect(fib.lines.at(-1))
      .toBe("Hmm. Your tummy sounds happy to me. Fibbing isn't very kind, Fae.");
    expect(play(fib.ink, "nurse").lines, "she asks again")
      .toEqual(["Hi Fae! Is everything all right?"]);
    const help = play(fib.ink, "nurse", 1);
    expect(help.lines.slice(-2)).toEqual([
      "Oh, you're a star! Could you take this note to the front office?",
      "Here's a hall pass, so nobody stops you on the way.",
    ]);
    expect(play(help.ink, "nurse").lines).toEqual(["Thanks for helping, Fae!"]);
    expect(play(help.ink, "teacher").lines)
      .toEqual(["A hall pass? All right. Be back in time for story time!"]);
  });

  it("the teacher points Fae to the nurse, and the journal notes the pass", () => {
    expect(play(fresh, "teacher", 0).lines).toEqual([
      "Good morning, Fae! Class starts when the bell rings.",
      "Not without a hall pass, I'm afraid.",
      "Nurse Holly sometimes needs a helper...",
    ]);
    const fixture = content.fixtures.school;
    if (fixture === undefined) throw new Error("school fixture missing");
    const before = createState(content.world, fixture);
    expect(journalNotes(content.world, before)).not.toContain(
      "I have a hall pass! Time to follow the raccoon's trail.");
    const withPass = { ...before, ink: play(fresh, "nurse", 1).ink };
    expect(journalNotes(content.world, withPass)[0])
      .toBe("I have a hall pass! Time to follow the raccoon's trail.");
  });
});
