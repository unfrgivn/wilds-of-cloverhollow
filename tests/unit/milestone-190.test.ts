import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { AtlasImage } from "../../src/ui/atlas";
import {
  fieldNoteBlurb,
  fishFieldNote,
  focusRestoreSelector,
  inspectableShelfIds,
  keepsakeFieldNote,
  prizeFieldNote,
  prizeFieldNoteData,
  resolveFieldNote,
  stepInspectedItem,
  stickerFieldNote,
  treasuresSignature,
  type FieldNoteData,
  type JournalFieldNoteSource,
} from "../../src/ui/journal-field-note";
import * as fieldNoteData from "../../src/ui/journal-field-note-data";
import { stripComments, stripStringLiterals } from "../../tools/purity";

const sampleImage: AtlasImage = {
  src: "/assets/arcade/prizes.webp",
  frame: { x: 0, y: 0, w: 64, h: 64 },
  atlas: { w: 256, h: 256 },
};

describe("Milestone 190: Cutscene Overlay Hygiene, Modular Relief & Size Gates", () => {
  it("declares defensive :root[data-cutscene=\"open\"] display: none guards across UI CSS", () => {
    const cssChecks: readonly { file: string; selectors: readonly string[] }[] = [
      {
        file: "src/ui/qa.css",
        selectors: [':root[data-cutscene="open"] .qa-touch-trigger:not([hidden])'],
      },
      {
        file: "src/ui/npc-chatter.css",
        selectors: [':root[data-cutscene="open"] .npc-chatter'],
      },
      {
        file: "src/ui/save-toast.css",
        selectors: [':root[data-cutscene="open"] .save-toast'],
      },
      {
        file: "src/ui/hud-hints.css",
        selectors: [':root[data-cutscene="open"] .hud-hints'],
      },
      {
        file: "src/ui/sticker.css",
        selectors: [
          ':root[data-cutscene="open"] .save-toast',
          ':root[data-cutscene="open"] .sticker-prompt',
          ':root[data-cutscene="open"] .hud-hints',
          ':root[data-cutscene="open"] .notice-marks',
        ],
      },
    ];

    for (const { file, selectors } of cssChecks) {
      const css = readFileSync(file, "utf8");
      for (const selector of selectors) {
        expect(css, `${file} missing ${selector}`).toContain(selector);
      }
      // Every cutscene guard block must apply display: none.
      const guardPattern = /:root\[data-cutscene="open"\][^{]*\{[^}]*display:\s*none;/;
      expect(css, `${file} cutscene rule must hide with display: none`).toMatch(guardPattern);
    }
  });

  it("re-exports pure journal-field-note-data helpers identically with zero DOM references", () => {
    expect(stickerFieldNote).toBe(fieldNoteData.stickerFieldNote);
    expect(prizeFieldNote).toBe(fieldNoteData.prizeFieldNote);
    expect(prizeFieldNoteData).toBe(fieldNoteData.prizeFieldNoteData);
    expect(fishFieldNote).toBe(fieldNoteData.fishFieldNote);
    expect(keepsakeFieldNote).toBe(fieldNoteData.keepsakeFieldNote);
    expect(resolveFieldNote).toBe(fieldNoteData.resolveFieldNote);
    expect(inspectableShelfIds).toBe(fieldNoteData.inspectableShelfIds);
    expect(stepInspectedItem).toBe(fieldNoteData.stepInspectedItem);
    expect(focusRestoreSelector).toBe(fieldNoteData.focusRestoreSelector);
    expect(fieldNoteBlurb).toBe(fieldNoteData.fieldNoteBlurb);
    expect(treasuresSignature).toBe(fieldNoteData.treasuresSignature);

    const dataSource = stripStringLiterals(
      stripComments(readFileSync("src/ui/journal-field-note-data.ts", "utf8")),
    );
    expect(dataSource).not.toMatch(/\b(document|window|HTMLElement|Element)\b/);

    const view: JournalFieldNoteSource = {
      stickers: [
        {
          id: "fountain-frog",
          name: "Fountain Frog",
          owned: true,
          image: sampleImage,
          fieldNote: {
            stickerId: "fountain-frog",
            name: "Fountain Frog",
            chaosName: "Fizzy Frog",
            level: 1,
            calms: 2,
            oldFriend: false,
            lands: ["Cloverhollow"],
            feelings: [{ id: "zoomy", label: "Zoomy" }],
            favouriteTreats: ["Pond Waffle"],
          },
        },
        { id: "locked-cat", name: "Park Cat", owned: false, image: sampleImage, fieldNote: null },
      ],
      prizes: [{ id: "frog-plush", name: "Frog Plush", owned: true, image: sampleImage }],
      fish: [
        {
          id: "starfish",
          name: "Golden Starfish Crown",
          image: sampleImage,
          owned: true,
          rare: true,
          coins: 20,
          snacks: 1,
          blurb: "A rare golden bay catch.",
        },
      ],
      keepsakes: [
        {
          id: "star-crystal",
          name: "Star Crystal",
          owned: true,
          source: "Starlight Cavern",
          displaySpot: "Clubhouse Desk",
          memory: "Hums softly in the dark.",
        },
      ],
    };

    const stickerData: FieldNoteData | null = resolveFieldNote(view, {
      kind: "sticker",
      id: "fountain-frog",
    });
    expect(stickerData?.kind).toBe("sticker");
    expect(stickerData?.detailValue).toBe("2 times");
    expect(resolveFieldNote(view, { kind: "sticker", id: "locked-cat" })).toBeNull();

    const prizeData = resolveFieldNote(view, { kind: "prize", id: "frog-plush" });
    expect(prizeData?.kind).toBe("prize");
    expect(prizeData?.foundValue).toBe("Claw Machine · Mr. Pip's Arcade");

    const fishData = resolveFieldNote(view, { kind: "fish", id: "starfish" });
    expect(fishData?.rare).toBe(true);
    expect(fishData?.detailValue).toBe("+20 coins, +1 snack");

    const keepsakeData = resolveFieldNote(view, { kind: "keepsake", id: "star-crystal" });
    expect(keepsakeData?.charmId).toBe("star-crystal");
    expect(keepsakeData?.blessingId).toBe("star-crystal");
  });

  it("enforces modular relief line budgets across Journal, View, and Main", () => {
    const lineCount = (path: string): number =>
      readFileSync(path, "utf8").trimEnd().split("\n").length;

    expect(lineCount("src/ui/journal-field-note.ts")).toBeLessThan(650);
    expect(lineCount("src/ui/journal-field-note-data.ts")).toBeLessThan(420);
    expect(lineCount("src/render/view.ts")).toBeLessThan(670);
    expect(lineCount("src/render/view-loader.ts")).toBeLessThan(180);
    expect(lineCount("src/render/view-projections.ts")).toBeLessThan(520);
    expect(lineCount("src/main.ts")).toBeLessThan(880);
    expect(readFileSync("src/render/view-projections.ts", "utf8")).not.toContain("pixi.js");
  });
});
