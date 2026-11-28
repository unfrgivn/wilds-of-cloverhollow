import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createState } from "../../src/core";
import {
  COZY_WEATHER_MODES,
  PHOTO_WEATHER_CYCLE,
  nextPhotoWeatherMode,
  stepPhotoWeatherMode,
  type CozyWeatherKind,
} from "../../src/core/weather";
import { loadContent } from "../../src/content/load";
import { runConsoleCommand, type ConsoleContext } from "../../src/dev/console";
import { getCozyWeatherMode, setCozyWeatherMode } from "../../src/platform/weather-prefs";
import {
  createInputShortcuts,
  type OverlayGateContext,
  type ShortcutKeyEvent,
} from "../../src/shell/input-shortcuts";

function makeKeyEvent(
  code: string,
  options: { repeat?: boolean; shiftKey?: boolean } = {},
): ShortcutKeyEvent & { prevented: boolean } {
  const event = {
    code,
    repeat: options.repeat ?? false,
    shiftKey: options.shiftKey ?? false,
    target: null,
    prevented: false,
    preventDefault: () => {
      event.prevented = true;
    },
    stopPropagation: () => undefined,
  };
  return event;
}

function makeContext(options: {
  photoMode: boolean;
  journalOpen?: boolean;
  area?: string;
}): OverlayGateContext {
  return {
    state: {
      area: options.area ?? "plaza",
      dialogue: null,
      battle: null,
      arcade: null,
      journalOpen: options.journalOpen ?? false,
      transition: null,
      finale: null,
      cutscene: undefined,
    },
    titleMode: null,
    qaMenuOpen: false,
    qaConsoleOpen: false,
    qaBlocked: false,
    photoMode: options.photoMode,
  };
}

describe("Milestone 220: Gamepad/Shift+W Sky Cycler, Postcard Stamp & QA Weather Command", () => {
  it("steps PHOTO_WEATHER_CYCLE forward and backward cleanly across all 5 skies and auto", () => {
    expect(stepPhotoWeatherMode("auto", 1)).toBe("sunshower");
    expect(stepPhotoWeatherMode("auto", -1)).toBe("twilight-fireflies");

    const forwardExpected: readonly CozyWeatherKind[] = [
      "sunshower",
      "breeze-petals",
      "snow-flurry",
      "twilight-fireflies",
      "clear",
    ];
    let current: CozyWeatherKind = "clear";
    const visitedForward: CozyWeatherKind[] = [];
    for (let index = 0; index < PHOTO_WEATHER_CYCLE.length; index += 1) {
      current = stepPhotoWeatherMode(current, 1);
      visitedForward.push(current);
    }
    expect(visitedForward).toEqual(forwardExpected);

    const backwardExpected: readonly CozyWeatherKind[] = [
      "twilight-fireflies",
      "snow-flurry",
      "breeze-petals",
      "sunshower",
      "clear",
    ];
    current = "clear";
    const visitedBackward: CozyWeatherKind[] = [];
    for (let index = 0; index < PHOTO_WEATHER_CYCLE.length; index += 1) {
      current = stepPhotoWeatherMode(current, -1);
      visitedBackward.push(current);
    }
    expect(visitedBackward).toEqual(backwardExpected);

    for (const mode of COZY_WEATHER_MODES) {
      expect(nextPhotoWeatherMode(mode)).toBe(stepPhotoWeatherMode(mode, 1));
    }
  });

  it("handles gamepad LB/RB and Shift+W in Photo Mode without leaking to Journal", () => {
    let photoMode = false;
    let journalOpen = false;
    let pendingBumper: -1 | 0 | 1 = 0;
    const weatherDeltas: (-1 | 1 | undefined)[] = [];
    const journalSteps: (-1 | 1)[] = [];
    let gamepadClears = 0;
    let keyboardClears = 0;

    const shortcuts = createInputShortcuts({
      getContext: () => makeContext({ photoMode, journalOpen }),
      getBattlePeekOpen: () => false,
      setBattlePeek: () => undefined,
      setPhotoMode: (open) => {
        photoMode = open;
      },
      snapPostcard: () => undefined,
      onCyclePhotoWeather: (delta) => {
        weatherDeltas.push(delta);
      },
      journal: {
        hasOpenOverlay: () => false,
        dismissOverlay: () => false,
        stepOverlay: () => false,
        stepPage: (delta) => {
          journalSteps.push(delta);
        },
        scrollActivePage: () => false,
        navigateFocus: () => false,
        activateFocused: () => false,
      },
      gamepad: {
        poll: () => [],
        consumeActivity: () => false,
        consumePhotoAction: () => null,
        consumeBumperStep: () => {
          const next = pendingBumper;
          pendingBumper = 0;
          return next;
        },
        consumeNavStep: () => null,
        consumeConfirmEdge: () => false,
        rightStickY: () => 0,
        clearTaps: () => {
          gamepadClears += 1;
        },
      },
      clearKeyboardTaps: () => {
        keyboardClears += 1;
      },
      swallow: () => undefined,
      playChoiceMove: () => undefined,
      invalidate: () => undefined,
    });

    // Outside Photo Mode: bumpers and Shift+W never cycle weather.
    pendingBumper = 1;
    shortcuts.pollGamepad();
    const outsideShiftW = makeKeyEvent("KeyW", { shiftKey: true });
    shortcuts.handleKeydown(outsideShiftW);
    expect(weatherDeltas).toEqual([]);
    expect(outsideShiftW.prevented).toBe(false);

    // Inside Photo Mode: RB (+1) and LB (-1) cycle sky and never step Journal pages.
    photoMode = true;
    pendingBumper = 1;
    shortcuts.pollGamepad();
    pendingBumper = -1;
    shortcuts.pollGamepad();
    expect(weatherDeltas).toEqual([1, -1]);
    expect(journalSteps).toEqual([]);
    expect(gamepadClears).toBe(2);

    // Inside Photo Mode: keyboard W passes +1, Shift+W passes -1, repeats ignored.
    const wForward = makeKeyEvent("KeyW");
    shortcuts.handleKeydown(wForward);
    const wBackward = makeKeyEvent("KeyW", { shiftKey: true });
    shortcuts.handleKeydown(wBackward);
    const wRepeat = makeKeyEvent("KeyW", { shiftKey: true, repeat: true });
    shortcuts.handleKeydown(wRepeat);
    expect(weatherDeltas).toEqual([1, -1, 1, -1]);
    expect(wForward.prevented).toBe(true);
    expect(wBackward.prevented).toBe(true);
    expect(keyboardClears).toBe(2);

    // When Journal is open (not Photo Mode), bumpers step Journal tabs normally.
    photoMode = false;
    journalOpen = true;
    pendingBumper = 1;
    shortcuts.pollGamepad();
    pendingBumper = -1;
    shortcuts.pollGamepad();
    expect(journalSteps).toEqual([1, -1]);
    expect(weatherDeltas).toEqual([1, -1, 1, -1]);
  });

  it("supports QA console weather query, mode switching, help listing, and invalid error", () => {
    const content = loadContent();
    const fixture = content.fixtures["new-game"];
    if (fixture === undefined) throw new Error("new-game fixture missing");
    const state = createState(content.world, fixture, 1);
    const context: ConsoleContext = {
      story: content.world.story,
      stickerIds: content.world.stickers.catalogue.map((sticker) => sticker.id),
      prizeIds: content.world.arcade.prizes.map((prize) => prize.id),
      treatIds: content.world.treats.map((treat) => treat.id),
      fishIds: content.world.arcade.fish.catches.map((item) => item.id),
      thresholds: content.world.levels.thresholds,
    };

    const previousMode = getCozyWeatherMode();
    try {
      setCozyWeatherMode("clear");

      const help = runConsoleCommand(context, state, "help");
      expect(help.kind).toBe("help");
      if (help.kind === "help") expect(help.message).toContain("weather");

      const query = runConsoleCommand(context, state, "weather");
      expect(query.kind).toBe("applied");
      if (query.kind === "applied") {
        expect(query.state).toBe(state);
        expect(query.message).toContain("clear");
        expect(query.message).toContain("Clear Skies");
      }

      const rainy = runConsoleCommand(context, state, "weather sunshower");
      expect(rainy.kind).toBe("applied");
      expect(getCozyWeatherMode()).toBe("sunshower");
      if (rainy.kind === "applied") {
        expect(rainy.message).toContain("sunshower");
        expect(rainy.message).toContain("Rainbow Sunshower");
      }

      const cleared = runConsoleCommand(context, state, "weather CLEAR");
      expect(cleared.kind).toBe("applied");
      expect(getCozyWeatherMode()).toBe("clear");

      const invalid = runConsoleCommand(context, state, "weather tornado");
      expect(invalid.kind).toBe("error");
      if (invalid.kind === "error") {
        expect(invalid.message).toContain("tornado");
        expect(invalid.message).toContain("sunshower");
      }
      expect(getCozyWeatherMode()).toBe("clear");
    } finally {
      setCozyWeatherMode(previousMode);
    }
  });

  it("keeps every modified implementation file strictly under line caps", () => {
    const caps: readonly [string, number][] = [
      ["src/main.ts", 900],
      ["src/core/weather.ts", 1000],
      ["src/shell/input-shortcuts.ts", 1000],
      ["src/shell/shell-bindings.ts", 1000],
      ["src/shell/overworld-feedback.ts", 1000],
      ["src/ui/postcard.ts", 1000],
      ["src/dev/console.ts", 1000],
    ];
    for (const [file, cap] of caps) {
      const lines = readFileSync(file, "utf8").split("\n").length;
      expect(lines, `${file} (${lines} lines) must stay < ${cap}`).toBeLessThan(cap);
    }
  });
});
