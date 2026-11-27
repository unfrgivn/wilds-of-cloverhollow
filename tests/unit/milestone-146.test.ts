import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { AtlasImage } from "../../src/ui/atlas";
import {
  inspectableShelfIds,
  stepInspectedItem,
  type JournalFieldNoteSource,
} from "../../src/ui/journal-field-note";
import {
  formatJukeboxLabel as formatFromJournal,
  journalControlsLines as controlsFromJournal,
  type JournalControlsLines,
  type JournalControlsTools,
  type JournalInputMode,
  type JukeboxMeta,
} from "../../src/ui/journal";
import {
  formatJukeboxLabel as formatFromOptions,
  journalControlsLines as controlsFromOptions,
} from "../../src/ui/journal-options";
import { createInputShortcuts, type OverlayGateContext } from "../../src/shell/input-shortcuts";

const sampleImage: AtlasImage = {
  src: "/assets/arcade/prizes.png",
  frame: { x: 0, y: 0, w: 64, h: 64 },
  atlas: { w: 256, h: 256 },
};

function makeStickerNote(id: string, name: string) {
  return {
    stickerId: id,
    name,
    chaosName: `Fizzy ${name}`,
    level: 2,
    calms: 1,
    oldFriend: false,
    lands: ["Cloverhollow"],
    feelings: [{ id: "curious" as const, label: "Curious" }],
    favouriteTreats: ["Fish Cracker"],
  };
}

function makeSource(): JournalFieldNoteSource {
  return {
    stickers: [
      {
        id: "frog",
        name: "Fountain Frog",
        owned: true,
        image: sampleImage,
        fieldNote: makeStickerNote("frog", "Fountain Frog"),
      },
      {
        id: "cat",
        name: "Park Cat",
        owned: false,
        image: sampleImage,
        fieldNote: makeStickerNote("cat", "Park Cat"),
      },
      { id: "no-note", name: "Mystery", owned: true, image: sampleImage, fieldNote: null },
      {
        id: "pup",
        name: "Sidewalk Pup",
        owned: true,
        image: sampleImage,
        fieldNote: makeStickerNote("pup", "Sidewalk Pup"),
      },
    ],
    prizes: [
      { id: "frog-plush", name: "Frog Plush", owned: true, image: sampleImage },
      { id: "pup-plush", name: "Pup Plush", owned: false, image: sampleImage },
      { id: "no-art", name: "No Art", owned: true, image: null },
      { id: "pinwheel", name: "Pinwheel", owned: true, image: sampleImage },
      { id: "star-racer-keychain", name: "Star Racer Keychain", owned: true, image: sampleImage },
    ],
    fish: [
      {
        id: "minnow",
        name: "Bubble Minnow",
        image: sampleImage,
        owned: true,
        rare: false,
        coins: 4,
        snacks: 0,
        blurb: "Quick little minnow.",
      },
      {
        id: "perch",
        name: "Sun Perch",
        image: sampleImage,
        owned: false,
        rare: false,
        coins: 6,
        snacks: 0,
        blurb: "Sunny perch.",
      },
      {
        id: "starfish",
        name: "Golden Starfish Crown",
        image: sampleImage,
        owned: true,
        rare: true,
        coins: 20,
        snacks: 1,
        blurb: "Rare golden starfish.",
      },
    ],
    keepsakes: [
      {
        id: "star-crystal",
        name: "Star Crystal",
        owned: true,
        source: "Clubhouse",
        displaySpot: "Shelf",
        memory: "Glows warmly.",
      },
      {
        id: "star-pin",
        name: "Star Pin",
        owned: false,
        source: "Bay",
        displaySpot: "Board",
        memory: "Bright pin.",
      },
      {
        id: "sea-compass",
        name: "Sea-Glass Compass",
        owned: true,
        source: "Cottage",
        displaySpot: "Crate",
        memory: "Points to the bay.",
      },
    ],
  };
}

describe("Milestone 146: Interactive Scrapbook Specimen Browser", () => {
  it("lists inspectable IDs and wraps forward/backward across all 4 shelves", () => {
    const view = makeSource();

    expect(inspectableShelfIds(view, "sticker")).toEqual(["frog", "pup"]);
    expect(inspectableShelfIds(view, "prize")).toEqual([
      "frog-plush",
      "pinwheel",
      "star-racer-keychain",
    ]);
    expect(inspectableShelfIds(view, "fish")).toEqual(["minnow", "starfish"]);
    expect(inspectableShelfIds(view, "keepsake")).toEqual(["star-crystal", "sea-compass"]);

    expect(stepInspectedItem(view, { kind: "sticker", id: "frog" }, 1)).toEqual({
      next: { kind: "sticker", id: "pup" },
      index: 1,
      total: 2,
    });
    expect(stepInspectedItem(view, { kind: "sticker", id: "frog" }, -1)).toEqual({
      next: { kind: "sticker", id: "pup" },
      index: 1,
      total: 2,
    });

    expect(stepInspectedItem(view, { kind: "prize", id: "frog-plush" }, 1)).toEqual({
      next: { kind: "prize", id: "pinwheel" },
      index: 1,
      total: 3,
    });
    expect(stepInspectedItem(view, { kind: "prize", id: "star-racer-keychain" }, 1)).toEqual({
      next: { kind: "prize", id: "frog-plush" },
      index: 0,
      total: 3,
    });
    expect(stepInspectedItem(view, { kind: "prize", id: "frog-plush" }, -1)).toEqual({
      next: { kind: "prize", id: "star-racer-keychain" },
      index: 2,
      total: 3,
    });

    expect(stepInspectedItem(view, { kind: "fish", id: "minnow" }, 1)).toEqual({
      next: { kind: "fish", id: "starfish" },
      index: 1,
      total: 2,
    });
    expect(stepInspectedItem(view, { kind: "fish", id: "minnow" }, -1)).toEqual({
      next: { kind: "fish", id: "starfish" },
      index: 1,
      total: 2,
    });

    expect(stepInspectedItem(view, { kind: "keepsake", id: "sea-compass" }, 1)).toEqual({
      next: { kind: "keepsake", id: "star-crystal" },
      index: 0,
      total: 2,
    });
    expect(stepInspectedItem(view, { kind: "keepsake", id: "star-crystal" }, -1)).toEqual({
      next: { kind: "keepsake", id: "sea-compass" },
      index: 1,
      total: 2,
    });
  });

  it("returns null when fewer than 2 items are owned or the current ID is missing", () => {
    const singleView: JournalFieldNoteSource = {
      stickers: [
        {
          id: "frog",
          name: "Fountain Frog",
          owned: true,
          image: sampleImage,
          fieldNote: makeStickerNote("frog", "Fountain Frog"),
        },
        {
          id: "cat",
          name: "Park Cat",
          owned: false,
          image: sampleImage,
          fieldNote: makeStickerNote("cat", "Park Cat"),
        },
      ],
      prizes: [{ id: "frog-plush", name: "Frog Plush", owned: true, image: sampleImage }],
      fish: [],
      keepsakes: [],
    };

    expect(stepInspectedItem(singleView, { kind: "sticker", id: "frog" }, 1)).toBeNull();
    expect(stepInspectedItem(singleView, { kind: "prize", id: "frog-plush" }, -1)).toBeNull();
    expect(stepInspectedItem(singleView, { kind: "fish", id: "minnow" }, 1)).toBeNull();
    expect(stepInspectedItem(makeSource(), { kind: "prize", id: "unknown" }, 1)).toBeNull();
  });

  it("routes gamepad Left/Right to journal.stepOverlay when a Field Note overlay is open", () => {
    const overlaySteps: (-1 | 1)[] = [];
    let navCalls = 0;
    let choiceMoves = 0;
    let invalidations = 0;
    let padNav: "up" | "down" | "left" | "right" | null = null;

    const ctx: OverlayGateContext = {
      state: {
        dialogue: null,
        battle: null,
        arcade: null,
        journalOpen: true,
        transition: null,
        finale: null,
      },
      titleMode: null,
      qaMenuOpen: false,
      qaConsoleOpen: false,
      qaBlocked: false,
      photoMode: false,
    };

    const shortcuts = createInputShortcuts({
      getContext: () => ctx,
      getBattlePeekOpen: () => false,
      setBattlePeek: () => undefined,
      setPhotoMode: () => undefined,
      snapPostcard: () => undefined,
      journal: {
        hasOpenOverlay: () => true,
        dismissOverlay: () => true,
        stepOverlay: (delta) => {
          overlaySteps.push(delta);
          return true;
        },
        stepPage: () => undefined,
        scrollActivePage: () => false,
        navigateFocus: () => {
          navCalls += 1;
          return true;
        },
        activateFocused: () => false,
      },
      gamepad: {
        poll: () => [],
        consumeActivity: () => false,
        consumePhotoAction: () => null,
        consumeBumperStep: () => 0,
        consumeNavStep: () => {
          const next = padNav;
          padNav = null;
          return next;
        },
        consumeConfirmEdge: () => false,
        rightStickY: () => 0,
        clearTaps: () => undefined,
      },
      clearKeyboardTaps: () => undefined,
      swallow: () => undefined,
      playChoiceMove: () => {
        choiceMoves += 1;
      },
      invalidate: () => {
        invalidations += 1;
      },
    });

    padNav = "right";
    shortcuts.pollGamepad();
    padNav = "left";
    shortcuts.pollGamepad();
    padNav = "down";
    shortcuts.pollGamepad();

    expect(overlaySteps).toEqual([1, -1]);
    expect(navCalls).toBe(0);
    expect(choiceMoves).toBe(0);
    expect(invalidations).toBe(2);
  });
});

describe("Milestone 146: src/ui/journal-options.ts Modular Extraction", () => {
  it("keeps src/ui/journal.ts re-exports identical and trims journal.ts under 720 lines", () => {
    expect(controlsFromJournal).toBe(controlsFromOptions);
    expect(formatFromJournal).toBe(formatFromOptions);

    const mode: JournalInputMode = "gamepad";
    const tools: JournalControlsTools = { hasLantern: true, hasFlute: false, hasLasso: true };
    const lines: JournalControlsLines = controlsFromJournal(mode, tools);
    expect(lines.primary).toContain("Stick / D-Pad");
    expect(lines.tools).toContain("Lantern: X");
    expect(lines.tools).toContain("Lasso: LB");

    const meta: JukeboxMeta = { active: true, index: 1, total: 20 };
    expect(formatFromJournal("Cloverhollow Town", meta)).toContain("Track 2 of 20");

    const journalLines = readFileSync("src/ui/journal.ts", "utf8").trimEnd().split("\n").length;
    expect(journalLines).toBeLessThan(720);
  });
});
