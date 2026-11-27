import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as arcadeParsers from "../../src/content/arcade-parsers";
import * as contentLoad from "../../src/content/load";
import type { CritterFieldNote } from "../../src/core/journal";
import { fieldNoteBlurb } from "../../src/ui/journal-field-note";
import { postcardMetadata } from "../../src/ui/postcard";

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}

function makeFieldNote(overrides: Partial<CritterFieldNote> = {}): CritterFieldNote {
  return {
    stickerId: "frog",
    name: "Fountain Frog",
    chaosName: "Splishy Chaos Frog",
    level: 2,
    lands: ["Cloverhollow"],
    feelings: [],
    favouriteTreats: ["Pond Berry"],
    calms: 1,
    oldFriend: false,
    ...overrides,
  };
}

describe("Milestone 110: arcade-parsers extraction", () => {
  it("re-exports identical parser references from src/content/load.ts", () => {
    expect(contentLoad.parseArcade).toBe(arcadeParsers.parseArcade);
    expect(contentLoad.parseClawCalibration).toBe(arcadeParsers.parseClawCalibration);
    expect(contentLoad.parseCookCalibration).toBe(arcadeParsers.parseCookCalibration);
    expect(contentLoad.parseFishCalibration).toBe(arcadeParsers.parseFishCalibration);
    expect(contentLoad.parseMoleCalibration).toBe(arcadeParsers.parseMoleCalibration);
    expect(contentLoad.parseCometCalibration).toBe(arcadeParsers.parseCometCalibration);
    expect(contentLoad.parseSkeeCalibration).toBe(arcadeParsers.parseSkeeCalibration);
  });

  it("parses live arcade content and all six calibration files identically", () => {
    const arcadeRaw = readJson("content/arcade.json");
    const prizesRaw = readJson("content/prizes.json");
    expect(arcadeParsers.parseArcade(arcadeRaw, prizesRaw)).toEqual(
      contentLoad.parseArcade(arcadeRaw, prizesRaw),
    );

    const calibrations: readonly [
      string,
      (value: unknown, file: string) => unknown,
      (value: unknown, file: string) => unknown,
    ][] = [
      [
        "public/assets/arcade/claw-machine.json",
        arcadeParsers.parseClawCalibration,
        contentLoad.parseClawCalibration,
      ],
      [
        "public/assets/arcade/microwave.json",
        arcadeParsers.parseCookCalibration,
        contentLoad.parseCookCalibration,
      ],
      [
        "public/assets/arcade/fishing-dock.json",
        arcadeParsers.parseFishCalibration,
        contentLoad.parseFishCalibration,
      ],
      [
        "public/assets/arcade/mole-cabinet.json",
        arcadeParsers.parseMoleCalibration,
        contentLoad.parseMoleCalibration,
      ],
      [
        "public/assets/arcade/comet-cabinet.json",
        arcadeParsers.parseCometCalibration,
        contentLoad.parseCometCalibration,
      ],
      [
        "public/assets/arcade/skee-lane.json",
        arcadeParsers.parseSkeeCalibration,
        contentLoad.parseSkeeCalibration,
      ],
    ];

    for (const [file, direct, reexported] of calibrations) {
      const raw = readJson(file);
      expect(direct(raw, file)).toEqual(reexported(raw, file));
    }
  });
});

describe("Milestone 110: journal-field-note fieldNoteBlurb", () => {
  it("prioritizes old-friend, repeat-calm, and multi-land blurbs cleanly", () => {
    expect(fieldNoteBlurb(makeFieldNote({ oldFriend: true, calms: 4 }))).toBe(
      "An old friend! Waves happily whenever Fae walks by.",
    );
    expect(fieldNoteBlurb(makeFieldNote({ calms: 2 }))).toBe(
      "Brightens up fast for a gentle song and a favorite snack.",
    );
    expect(
      fieldNoteBlurb(makeFieldNote({ calms: 1, lands: ["Cloverhollow", "Bubblegum Bay"] })),
    ).toBe("Loves wandering between sunny spots across the valley.");
  });

  it("formats feeling-specific and fallback blurbs for first-time catches", () => {
    expect(
      fieldNoteBlurb(makeFieldNote({ calms: 0, feelings: [{ id: "bored", label: "Bored" }] })),
    ).toBe("A curious soul who just needed a playful friend.");
    expect(
      fieldNoteBlurb(makeFieldNote({ calms: 0, feelings: [{ id: "hungry", label: "Hungry" }] })),
    ).toBe("Follows its nose straight to warm snacks and treats.");
    expect(
      fieldNoteBlurb(makeFieldNote({ calms: 0, feelings: [{ id: "grumpy", label: "Grumpy" }] })),
    ).toBe("A little prickly at first, then soft as moss once calm.");
    expect(
      fieldNoteBlurb(makeFieldNote({ calms: 0, feelings: [{ id: "zoomy", label: "Zoomy" }] })),
    ).toBe("Full of bouncy energy until a gentle rhythm settles it.");
    expect(
      fieldNoteBlurb(
        makeFieldNote({ calms: 0, feelings: [{ id: "curious", label: "Curious" }] }),
      ),
    ).toBe("Watches every sparkle and sound with bright, eager eyes.");
    expect(fieldNoteBlurb(makeFieldNote({ calms: 0, feelings: [] }))).toBe(
      "A cozy valley friend sketched right into Fae's notebook.",
    );
  });
});

describe("Milestone 110: postcardMetadata sanitization", () => {
  it("sanitizes area names and produces deterministic postcard filenames", () => {
    expect(postcardMetadata("  East_Hall!! ", "East Hall", "Cloverhollow")).toEqual({
      filename: "cloverhollow-postcard-east-hall.png",
      caption: "East Hall · Wilds of Cloverhollow",
      subcaption: "Cloverhollow",
    });
    expect(postcardMetadata("///", "   ", "")).toEqual({
      filename: "cloverhollow-postcard-cloverhollow.png",
      caption: "Cloverhollow · Wilds of Cloverhollow",
      subcaption: "",
    });
  });
});
