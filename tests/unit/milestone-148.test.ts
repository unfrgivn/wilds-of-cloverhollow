import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  endingContentErrors as endingFromLoad,
  loadContent,
  parseStoryJson as parseStoryFromLoad,
  storyTagErrors as tagErrorsFromLoad,
  storyTags as storyTagsFromLoad,
} from "../../src/content/load";
import {
  endingContentErrors as endingFromChecks,
  parseStoryJson as parseStoryFromChecks,
  storyTagErrors as tagErrorsFromChecks,
  storyTags as storyTagsFromChecks,
} from "../../src/content/story-checks";
import { pickNotesScrollTarget } from "../../src/ui/journal-nav";

describe("Milestone 148: Living NPC Chatter Overlay Guard & Safari Hygiene", () => {
  it("hides .npc-chatter under all 6 root overlay flags with Safari & reduced-motion CSS", () => {
    const css = readFileSync("src/ui/npc-chatter.css", "utf8");
    const overlaySelectors = [
      ':root[data-photo="on"] .npc-chatter',
      ':root[data-battle="open"] .npc-chatter',
      ':root[data-journal="open"] .npc-chatter',
      ':root[data-title="open"] .npc-chatter',
      ':root[data-credits="open"] .npc-chatter',
      ':root[data-arcade="open"] .npc-chatter',
    ];
    for (const selector of overlaySelectors) {
      expect(css, `missing defensive selector ${selector}`).toContain(selector);
    }
    expect(css).toContain("user-select: none;");
    expect(css).toContain("-webkit-user-select: none;");
    expect(css).toContain("-webkit-touch-callout: none;");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain(':root[data-reduced-motion="on"] .npc-chatter');
  });
});

describe("Milestone 148: Keyboard & Gamepad Left-Column NOTES Scrolling", () => {
  it("returns null for zero deltaY or when neither column can scroll in that direction", () => {
    expect(
      pickNotesScrollTarget({
        deltaY: 0,
        notesFocused: true,
        notesScrollTop: 10,
        notesMaxScroll: 200,
        stickersScrollTop: 10,
        stickersMaxScroll: 200,
      }),
    ).toBeNull();

    expect(
      pickNotesScrollTarget({
        deltaY: 72,
        notesFocused: false,
        notesScrollTop: 120,
        notesMaxScroll: 120,
        stickersScrollTop: 300,
        stickersMaxScroll: 300,
      }),
    ).toBeNull();

    expect(
      pickNotesScrollTarget({
        deltaY: -72,
        notesFocused: true,
        notesScrollTop: 0,
        notesMaxScroll: 120,
        stickersScrollTop: 0.5,
        stickersMaxScroll: 300,
      }),
    ).toBeNull();
  });

  it("prioritizes notes when focused and falls over to stickers at notes limits", () => {
    expect(
      pickNotesScrollTarget({
        deltaY: 72,
        notesFocused: true,
        notesScrollTop: 0,
        notesMaxScroll: 180,
        stickersScrollTop: 0,
        stickersMaxScroll: 240,
      }),
    ).toBe("notes");

    expect(
      pickNotesScrollTarget({
        deltaY: -72,
        notesFocused: true,
        notesScrollTop: 90,
        notesMaxScroll: 180,
        stickersScrollTop: 90,
        stickersMaxScroll: 240,
      }),
    ).toBe("notes");

    expect(
      pickNotesScrollTarget({
        deltaY: 72,
        notesFocused: true,
        notesScrollTop: 179.5,
        notesMaxScroll: 180,
        stickersScrollTop: 40,
        stickersMaxScroll: 240,
      }),
    ).toBe("stickers");

    expect(
      pickNotesScrollTarget({
        deltaY: -72,
        notesFocused: true,
        notesScrollTop: 0,
        notesMaxScroll: 180,
        stickersScrollTop: 60,
        stickersMaxScroll: 240,
      }),
    ).toBe("stickers");
  });

  it("scrolls stickers first unfocused and continues into notes at limits or no overflow", () => {
    expect(
      pickNotesScrollTarget({
        deltaY: 72,
        notesFocused: false,
        notesScrollTop: 0,
        notesMaxScroll: 180,
        stickersScrollTop: 40,
        stickersMaxScroll: 240,
      }),
    ).toBe("stickers");

    expect(
      pickNotesScrollTarget({
        deltaY: 72,
        notesFocused: false,
        notesScrollTop: 0,
        notesMaxScroll: 180,
        stickersScrollTop: 239.4,
        stickersMaxScroll: 240,
      }),
    ).toBe("notes");

    expect(
      pickNotesScrollTarget({
        deltaY: -72,
        notesFocused: false,
        notesScrollTop: 80,
        notesMaxScroll: 180,
        stickersScrollTop: 0.4,
        stickersMaxScroll: 240,
      }),
    ).toBe("notes");

    expect(
      pickNotesScrollTarget({
        deltaY: 72,
        notesFocused: false,
        notesScrollTop: 0,
        notesMaxScroll: 180,
        stickersScrollTop: 0,
        stickersMaxScroll: 0,
      }),
    ).toBe("notes");
  });
});

describe("Milestone 148: src/content/story-checks.ts Modular Extraction", () => {
  it("re-exports all 4 story check helpers identically and trims load.ts under 860 lines", () => {
    expect(parseStoryFromLoad).toBe(parseStoryFromChecks);
    expect(storyTagsFromLoad).toBe(storyTagsFromChecks);
    expect(tagErrorsFromLoad).toBe(tagErrorsFromChecks);
    expect(endingFromLoad).toBe(endingFromChecks);

    const { world } = loadContent();
    expect(parseStoryFromChecks(world.story, "story.json")).toBe(world.story);
    const tags = storyTagsFromChecks(world.story);
    expect(tags.length).toBeGreaterThan(20);
    expect(endingFromChecks(world.story, world.areas)).toEqual([]);
    expect(tagErrorsFromChecks(["travel: missing.spawn"], world.areas)).toEqual([
      'unknown travel target in "travel: missing.spawn"',
    ]);

    const loadLines = readFileSync("src/content/load.ts", "utf8").trimEnd().split("\n").length;
    expect(loadLines).toBeLessThan(860);
  });
});
