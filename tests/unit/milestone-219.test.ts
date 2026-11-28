import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  PHOTO_WEATHER_CYCLE,
  nextPhotoWeatherMode,
  type CozyWeatherKind,
} from "../../src/core/weather";
import {
  createInputShortcuts,
  photoKeyAction,
  type OverlayGateContext,
  type ShortcutKeyEvent,
} from "../../src/shell/input-shortcuts";
import { minigameWeatherFlavor } from "../../src/ui/minigame-weather";

function makeKeyEvent(code: string, repeat = false): ShortcutKeyEvent & { prevented: boolean } {
  const event = {
    code,
    repeat,
    target: null,
    prevented: false,
    preventDefault: () => {
      event.prevented = true;
    },
    stopPropagation: () => undefined,
  };
  return event;
}

function makeOverworldContext(photoMode: boolean, area = "plaza"): OverlayGateContext {
  return {
    state: {
      area,
      dialogue: null,
      battle: null,
      arcade: null,
      journalOpen: false,
      transition: null,
      finale: null,
      cutscene: undefined,
    },
    titleMode: null,
    qaMenuOpen: false,
    qaConsoleOpen: false,
    qaBlocked: false,
    photoMode,
  };
}

describe("Milestone 218: Photo Mode Live Sky Cycler & Outdoor Minigame Cozy Weather", () => {
  it("cycles PHOTO_WEATHER_CYCLE cleanly from auto and across all 5 cozy weather kinds", () => {
    expect(PHOTO_WEATHER_CYCLE).toEqual([
      "clear",
      "sunshower",
      "breeze-petals",
      "snow-flurry",
      "twilight-fireflies",
    ]);

    expect(nextPhotoWeatherMode("auto")).toBe("sunshower");
    expect(nextPhotoWeatherMode("clear")).toBe("sunshower");
    expect(nextPhotoWeatherMode("sunshower")).toBe("breeze-petals");
    expect(nextPhotoWeatherMode("breeze-petals")).toBe("snow-flurry");
    expect(nextPhotoWeatherMode("snow-flurry")).toBe("twilight-fireflies");
    expect(nextPhotoWeatherMode("twilight-fireflies")).toBe("clear");

    // Full 5-step loop starting from clear returns to clear.
    let current: CozyWeatherKind = "clear";
    const visited: CozyWeatherKind[] = [];
    for (let stepIndex = 0; stepIndex < PHOTO_WEATHER_CYCLE.length; stepIndex += 1) {
      current = nextPhotoWeatherMode(current);
      visited.push(current);
    }
    expect(visited).toEqual([
      "sunshower",
      "breeze-petals",
      "snow-flurry",
      "twilight-fireflies",
      "clear",
    ]);
  });

  it("maps photoKeyAction('KeyW') to 'weather' strictly while Photo Mode is active", () => {
    expect(photoKeyAction("KeyW")).toBe("weather");
    expect(photoKeyAction("KeyP")).toBe("toggle");
    expect(photoKeyAction("Space")).toBe("snap");
    expect(photoKeyAction("Enter")).toBe("snap");
    expect(photoKeyAction("Escape")).toBe("exit");
    expect(photoKeyAction("KeyA")).toBeNull();
    expect(photoKeyAction("ArrowUp")).toBeNull();

    let photoMode = false;
    let cycles = 0;
    let clearedTaps = 0;
    const shortcuts = createInputShortcuts({
      getContext: () => makeOverworldContext(photoMode),
      getBattlePeekOpen: () => false,
      setBattlePeek: () => undefined,
      setPhotoMode: (open) => {
        photoMode = open;
      },
      snapPostcard: () => undefined,
      onCyclePhotoWeather: () => {
        cycles += 1;
      },
      journal: {
        hasOpenOverlay: () => false,
        dismissOverlay: () => false,
        stepOverlay: () => false,
        stepPage: () => undefined,
        scrollActivePage: () => false,
        navigateFocus: () => false,
        activateFocused: () => false,
      },
      gamepad: {
        poll: () => [],
        consumeActivity: () => false,
        consumePhotoAction: () => null,
        consumeBumperStep: () => 0,
        consumeNavStep: () => null,
        consumeConfirmEdge: () => false,
        rightStickY: () => 0,
        clearTaps: () => undefined,
      },
      clearKeyboardTaps: () => {
        clearedTaps += 1;
      },
      swallow: () => undefined,
      playChoiceMove: () => undefined,
      invalidate: () => undefined,
    });

    // Outside Photo Mode: KeyW must NEVER trigger weather cycling or prevent WASD movement.
    const outsideEvent = makeKeyEvent("KeyW");
    shortcuts.handleKeydown(outsideEvent);
    expect(cycles).toBe(0);
    expect(outsideEvent.prevented).toBe(false);
    expect(clearedTaps).toBe(0);

    // Inside Photo Mode: KeyW triggers weather cycling cleanly and clears keyboard taps.
    photoMode = true;
    const insideEvent = makeKeyEvent("KeyW");
    shortcuts.handleKeydown(insideEvent);
    expect(cycles).toBe(1);
    expect(insideEvent.prevented).toBe(true);
    expect(clearedTaps).toBe(1);

    // Key repeat is ignored so holding W never spams cycles.
    const repeatEvent = makeKeyEvent("KeyW", true);
    shortcuts.handleKeydown(repeatEvent);
    expect(cycles).toBe(1);
  });

  it("provides cozy outdoor minigame flavor tags and returns empty string on clear skies", () => {
    expect(minigameWeatherFlavor("fish", "clear")).toBe("");
    expect(minigameWeatherFlavor("taco", "clear")).toBe("");
    expect(minigameWeatherFlavor("fish", "sunshower")).toBe("+15% bite charm");
    expect(minigameWeatherFlavor("taco", "sunshower")).toBe("Cozy awning");
    expect(minigameWeatherFlavor("fish", "breeze-petals")).toBe("+8% gentle charm");
    expect(minigameWeatherFlavor("taco", "breeze-petals")).toBe("Breezy window");
    expect(minigameWeatherFlavor("fish", "snow-flurry")).toBe("+5% crisp clarity");
    expect(minigameWeatherFlavor("taco", "snow-flurry")).toBe("Warm griddle");
    expect(minigameWeatherFlavor("fish", "twilight-fireflies")).toBe("+12% dusk charm");
    expect(minigameWeatherFlavor("taco", "twilight-fireflies")).toBe("Lantern shift");
  });

  it("keeps weather SVGs free of <text> nodes and touched source files under line caps", () => {
    const stripComments = (src: string): string =>
      src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    const minigameSrc = stripComments(readFileSync("src/ui/minigame-weather.ts", "utf8"));
    expect(minigameSrc).not.toMatch(/<text\b|svgElement\(\s*["']text["']|\["text"/i);
    expect(minigameSrc).not.toMatch(/pixi\.js/);

    const postcardSrc = readFileSync("src/ui/postcard.ts", "utf8");
    const weatherIconMatch = postcardSrc.match(
      /export function weatherSkyIcon[\s\S]*?return icon;\n\}/,
    );
    expect(weatherIconMatch).not.toBeNull();
    expect(stripComments(weatherIconMatch?.[0] ?? "")).not.toMatch(
      /<text\b|svgElement\(\s*["']text["']/i,
    );

    const caps: readonly [string, number][] = [
      ["src/main.ts", 900],
      ["src/core/weather.ts", 1000],
      ["src/shell/input-shortcuts.ts", 1000],
      ["src/ui/postcard.ts", 1000],
      ["src/ui/touch-controls.css", 1000],
      ["src/ui/minigame-weather.ts", 160],
      ["src/ui/minigame-weather.css", 220],
      ["src/ui/fish.ts", 1000],
      ["src/ui/taco.ts", 1000],
    ];
    for (const [file, cap] of caps) {
      const lines = readFileSync(file, "utf8").split("\n").length;
      expect(lines, `${file} (${lines} lines) must stay < ${cap}`).toBeLessThan(cap);
    }
  });
});
