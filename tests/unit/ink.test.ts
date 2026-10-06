import { describe, expect, it } from "vitest";
import { loadContent } from "../../src/content/load";
import { createInkState, createStoryReader, inkVariable, runInk } from "../../src/core/ink";

describe("Ink adapter", () => {
  const content = loadContent();

  it("is deterministic and exposes every interactable knot", () => {
    const first = createInkState(content.world.story, 7);
    const second = createInkState(content.world.story, 7);
    expect(first).toBe(second);
    for (const area of Object.values(content.world.areas))
      for (const item of area.interactables) {
        const result = runInk(content.world.story, first, {
          type: "start",
          knot: item.knot,
        });
        expect(result.line).not.toBeNull();
      }
  });

  it("reads story variables, and every locked door names a real variable and knot", () => {
    const story = content.world.story;
    const fresh = createInkState(story, 1);
    expect(inkVariable(story, fresh, "plan")).toBe("none");
    expect(inkVariable(story, fresh, "ate_breakfast")).toBe(false);
    expect(inkVariable(story, fresh, "no_such_variable")).toBeUndefined();
    const greeting = runInk(story, fresh, { type: "start", knot: "mom" });
    const fed = runInk(story, greeting.ink, { type: "choose", index: 0 }).ink;
    expect(inkVariable(story, fed, "ate_breakfast")).toBe(true);
    for (const area of Object.values(content.world.areas))
      for (const trigger of area.triggers) {
        if (trigger.requires === undefined) continue;
        const where = `${area.id}/${trigger.id}`;
        expect(inkVariable(story, fresh, trigger.requires.variable), where).toBeDefined();
        const result = runInk(story, fresh, { type: "start", knot: trigger.requires.knot });
        expect(result.line, where).not.toBeNull();
      }
  });

  it("the reused reader reads each state on its own, as a fresh Story would", () => {
    const story = content.world.story;
    const read = createStoryReader(story);
    const fresh = createInkState(story, 1);
    const greeting = runInk(story, fresh, { type: "start", knot: "mom" });
    const fed = runInk(story, greeting.ink, { type: "choose", index: 0 }).ink;
    for (const ink of [fed, fresh, fed, fresh])
      for (const name of ["ate_breakfast", "plan", "hall_pass", "no_such_variable"])
        expect(read(ink, name), name).toEqual(inkVariable(story, ink, name));
    expect(read(fed, "ate_breakfast")).toBe(true);
    expect(read(fresh, "ate_breakfast"), "nothing left over from the last read").toBe(false);
  });

  it("carries a choice into the journal branch", () => {
    let ink = createInkState(content.world.story, 1);
    ink = runInk(content.world.story, ink, { type: "start", knot: "window" }).ink;
    ink = runInk(content.world.story, ink, { type: "next" }).ink;
    const choice = runInk(content.world.story, ink, { type: "choose", index: 1 });
    expect(choice.line?.text).toContain("Backpack");
    ink = choice.ink;
    const journal = runInk(content.world.story, ink, {
      type: "start",
      knot: "pillow_journal",
    });
    const journalNext = runInk(content.world.story, journal.ink, { type: "next" });
    expect(journalNext.line?.text).toContain("Check after school");
  });
});
