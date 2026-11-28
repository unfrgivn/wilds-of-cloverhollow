import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadContent } from "../../src/content/load";
import {
  createState,
  openArcade,
  type Battle,
  type BattleFoe,
  type State,
} from "../../src/core";
import { formatDocumentTitle } from "../../src/shell/document-title";
import {
  hudHintKeys,
  shouldShowLassoHint,
  type HudHintsView,
} from "../../src/ui/hud-hints";

function makeFoe(critterId: string, soothed = false): BattleFoe {
  return {
    critterId,
    calm: soothed ? 10 : 0,
    calmMax: 10,
    soothed,
    feelings: [],
    windUp: null,
  };
}

function makeBattle(critterId: string, extra: Partial<Battle> = {}): Battle {
  return {
    critterId,
    den: null,
    entry: { x: 800, y: 600 },
    phase: "command",
    message: "",
    revealed: 0,
    selected: 0,
    command: null,
    energy: 5,
    calm: 0,
    rest: {},
    check: null,
    lastGrade: null,
    feelings: [],
    answered: false,
    lanternPeek: false,
    turn: 1,
    windUp: null,
    talkMode: false,
    talk: null,
    talkTurns: 0,
    rewardSticker: null,
    phaseTicks: 0,
    ...extra,
  };
}

describe("Milestone 202: Complete Elevation Document Titles", () => {
  const content = loadContent();
  const plazaFixture = content.fixtures.plaza;
  if (plazaFixture === undefined) throw new Error("Missing plaza fixture");
  const baseState = createState(content.world, plazaFixture);

  it("formats Boss Encore rematches with Starlight Encore prefix", () => {
    const encoreBattle: State = {
      ...baseState,
      battle: makeBattle("fountain-frog", {
        encore: {
          bossId: "fountain-frog",
          modifiers: ["brisk-breeze"],
          trophyId: "trophy-frog",
          trophyName: "Starlight Frog Trophy",
          bonusCoins: 15,
        },
      }),
    };
    expect(
      formatDocumentTitle(content.world, encoreBattle, { titleOpen: false, creditsOpen: false }),
    ).toBe("Starlight Encore: Fizzy Frog · Wilds of Cloverhollow");
  });

  it("formats multi-critter formations with remaining foe count and collapses at 1 left", () => {
    const duoBattle: State = {
      ...baseState,
      battle: makeBattle("fountain-frog", {
        foes: [makeFoe("fountain-frog", false), makeFoe("pup", false)],
      }),
    };
    expect(
      formatDocumentTitle(content.world, duoBattle, { titleOpen: false, creditsOpen: false }),
    ).toBe("Calming Fizzy Frog +1 · Wilds of Cloverhollow");

    const trioBattle: State = {
      ...baseState,
      battle: makeBattle("fountain-frog", {
        foes: [
          makeFoe("fountain-frog", false),
          makeFoe("pup", false),
          makeFoe("raccoon", false),
        ],
      }),
    };
    expect(
      formatDocumentTitle(content.world, trioBattle, { titleOpen: false, creditsOpen: false }),
    ).toBe("Calming Fizzy Frog +2 · Wilds of Cloverhollow");

    const oneRemaining: State = {
      ...baseState,
      battle: makeBattle("pup", {
        foes: [makeFoe("fountain-frog", true), makeFoe("pup", false)],
      }),
    };
    expect(
      formatDocumentTitle(content.world, oneRemaining, { titleOpen: false, creditsOpen: false }),
    ).toBe("Calming Zoomie Pup · Wilds of Cloverhollow");
  });

  it("formats Encore Shrine, Decor Picker, and Photo Mode with area fallbacks & priority", () => {
    expect(
      formatDocumentTitle(content.world, baseState, {
        titleOpen: false,
        creditsOpen: false,
        encoreShrineOpen: true,
        decorOpen: true,
        photoMode: true,
      }),
    ).toBe("Dream Memory Shrine · Wilds of Cloverhollow");

    expect(
      formatDocumentTitle(
        content.world,
        { ...baseState, area: "bedroom" },
        { titleOpen: false, creditsOpen: false, decorOpen: true, photoMode: true },
      ),
    ).toBe("Decorating Fae's bedroom · Wilds of Cloverhollow");

    expect(
      formatDocumentTitle(
        content.world,
        { ...baseState, area: "missing-area" },
        { titleOpen: false, creditsOpen: false, decorOpen: true },
      ),
    ).toBe("Decorating · Wilds of Cloverhollow");

    expect(
      formatDocumentTitle(content.world, baseState, {
        titleOpen: false,
        creditsOpen: false,
        photoMode: true,
      }),
    ).toBe("Photo Mode · Town plaza · Wilds of Cloverhollow");

    expect(
      formatDocumentTitle(
        content.world,
        { ...baseState, area: "missing-area" },
        { titleOpen: false, creditsOpen: false, photoMode: true },
      ),
    ).toBe("Photo Mode · Wilds of Cloverhollow");

    // Arcade takes precedence over shrine/decor/photo flags.
    const arcadeState = openArcade(content.world, { ...baseState, coins: 20 }, "claw", 0);
    expect(
      formatDocumentTitle(content.world, arcadeState, {
        titleOpen: false,
        creditsOpen: false,
        encoreShrineOpen: true,
        decorOpen: true,
        photoMode: true,
      }),
    ).toBe("Claw Machine · Wilds of Cloverhollow");

    // Backwards compatibility when optional flags are omitted.
    expect(
      formatDocumentTitle(content.world, baseState, { titleOpen: false, creditsOpen: false }),
    ).toBe("Town plaza · Wilds of Cloverhollow");
  });
});

describe("Milestone 202: Overworld Rainbow Lasso Key Hint Pill", () => {
  it("maps lasso keycap cleanly to R on keyboard and LB on gamepad", () => {
    expect(hudHintKeys("keyboard").lasso).toBe("R");
    expect(hudHintKeys("gamepad").lasso).toBe("LB");
  });

  it("hides the lasso hint pill unless ribbon is visible and hasLasso is strictly true", () => {
    const baseView: HudHintsView = {
      visible: true,
      canInteract: false,
      interactLabel: "Talk",
      hasLantern: true,
      lanternOn: false,
      hasFlute: true,
      muted: false,
    };

    expect(shouldShowLassoHint(baseView)).toBe(false);
    expect(shouldShowLassoHint({ ...baseView, hasLasso: false })).toBe(false);
    expect(shouldShowLassoHint({ ...baseView, hasLasso: true })).toBe(true);
    expect(shouldShowLassoHint({ ...baseView, visible: false, hasLasso: true })).toBe(false);
  });
});

describe("Milestone 202: Touched src/ File Line Caps", () => {
  it("keeps all touched src/ files under 1,000 lines and src/main.ts under 950 lines", () => {
    const touched = [
      "src/shell/document-title.ts",
      "src/ui/hud-hints.ts",
      "src/shell/shell-bindings.ts",
      "src/main.ts",
    ] as const;
    for (const file of touched) {
      const lines = readFileSync(file, "utf8").trimEnd().split("\n").length;
      expect(lines, `${file} exceeds 1,000 lines (${lines})`).toBeLessThan(1000);
    }
    const mainLines = readFileSync("src/main.ts", "utf8").trimEnd().split("\n").length;
    expect(mainLines).toBeLessThan(950);
  });
});
