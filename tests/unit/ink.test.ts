import { describe, expect, it } from "vitest";
import { loadContent } from "../../src/content/load";
import { createInkState, runInk } from "../../src/core/ink";

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
