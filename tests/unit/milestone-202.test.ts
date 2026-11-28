import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  classifyFootstepEffect as directClassify,
  computeGrassTuftSway as directSway,
  FOOTSTEP_POOL_SIZE as directFootstepPool,
  FOOTSTEP_VFX_STYLES as directStyles,
  GRASS_TUFT_POOL_SIZE as directGrassPool,
  isNearWaterShore as directShore,
  sampleNearbyGrassTufts as directSample,
} from "../../src/render/ground-reactivity-math";
import {
  classifyFootstepEffect,
  computeGrassTuftSway,
  FOOTSTEP_POOL_SIZE,
  FOOTSTEP_VFX_STYLES,
  GRASS_TUFT_POOL_SIZE,
  isNearWaterShore,
  sampleNearbyGrassTufts,
} from "../../src/render/ground-reactivity";
import {
  createInputShortcuts,
  type OverlayGateContext,
  type ShortcutGamepadSource,
} from "../../src/shell/input-shortcuts";
import { encoreFooterHint } from "../../src/ui/encore-shrine";
import { travelSkipButtonLabel } from "../../src/ui/travel-overlay";
import { chunkGroups } from "../../vite.config";

function lineCount(path: string): number {
  return readFileSync(path, "utf8").trimEnd().split("\n").length;
}

function routeModule(modulePath: string): string | null {
  const ordered = [...chunkGroups].sort((a, b) => b.priority - a.priority);
  const match = ordered.find((group) => group.test.test(modulePath));
  return match?.name ?? null;
}

describe("Milestone 202: Track E19C Decor Nav, Adaptive Hints & Ground Reactivity Split", () => {
  it("adapts travelSkipButtonLabel across keyboard, gamepad, and touch", () => {
    expect(travelSkipButtonLabel({})).toBe("Skip · Z");
    expect(travelSkipButtonLabel({ inputMode: "keyboard" })).toBe("Skip · Z");
    expect(travelSkipButtonLabel({ inputMode: "gamepad" })).toBe("Skip · A");
    expect(travelSkipButtonLabel({ touchActive: true })).toBe("Skip");
    expect(travelSkipButtonLabel({ touchActive: true, inputMode: "gamepad" })).toBe("Skip");
  });

  it("adapts encoreFooterHint across keyboard, gamepad, and touch", () => {
    expect(encoreFooterHint()).toBe(
      "Arrows/WASD pick a memory · 1/2/3 toggle Star Challenges · Enter/Z launch · Esc close",
    );
    expect(encoreFooterHint("keyboard", false)).toBe(
      "Arrows/WASD pick a memory · 1/2/3 toggle Star Challenges · Enter/Z launch · Esc close",
    );
    expect(encoreFooterHint("gamepad", false)).toBe(
      "D-Pad pick a memory · L/R toggle Star Challenges · A launch · B close",
    );
    expect(encoreFooterHint("keyboard", true)).toBe(
      "Tap a memory · Tap Star Challenges · Tap Begin Encore",
    );
    expect(encoreFooterHint("gamepad", true)).toBe(
      "Tap a memory · Tap Star Challenges · Tap Begin Encore",
    );
  });

  it("preserves ground-reactivity-math identity, Pixi-free purity, and strict line budgets", () => {
    expect(FOOTSTEP_POOL_SIZE).toBe(directFootstepPool);
    expect(GRASS_TUFT_POOL_SIZE).toBe(directGrassPool);
    expect(FOOTSTEP_VFX_STYLES).toBe(directStyles);
    expect(isNearWaterShore).toBe(directShore);
    expect(classifyFootstepEffect).toBe(directClassify);
    expect(computeGrassTuftSway).toBe(directSway);
    expect(sampleNearbyGrassTufts).toBe(directSample);

    const mathSource = readFileSync("src/render/ground-reactivity-math.ts", "utf8");
    expect(mathSource).not.toMatch(/from\s+["']pixi\.js["']/);
    expect(mathSource).not.toContain("CanvasRenderingContext2D");
    expect(routeModule("/repo/src/render/ground-reactivity-math.ts")).toBe("render-engine");

    expect(lineCount("src/render/ground-reactivity.ts")).toBeLessThan(520);
    expect(lineCount("src/render/ground-reactivity-math.ts")).toBeLessThan(460);
    expect(lineCount("src/main.ts")).toBeLessThan(885);
  });

  it("routes gamepad D-Pad, A confirm, and B cancel to Decor Picker while open", () => {
    let decorOpen = true;
    const events: string[] = [];
    const baseCtx: OverlayGateContext = {
      state: {
        dialogue: null,
        battle: null,
        arcade: null,
        journalOpen: false,
        transition: null,
        finale: null,
        area: "clubhouse",
      },
      titleMode: null,
      qaMenuOpen: false,
      qaConsoleOpen: false,
      qaBlocked: false,
      photoMode: false,
    };

    let nextNav: "up" | "down" | "left" | "right" | null = null;
    let nextConfirm = false;
    let nextPhoto: "toggle" | "snap" | "exit" | null = null;

    const gamepad: ShortcutGamepadSource = {
      poll: () => [],
      consumeActivity: () => false,
      consumePhotoAction: () => {
        const value = nextPhoto;
        nextPhoto = null;
        return value;
      },
      consumeBumperStep: () => 0,
      consumeNavStep: () => {
        const value = nextNav;
        nextNav = null;
        return value;
      },
      consumeConfirmEdge: () => {
        const value = nextConfirm;
        nextConfirm = false;
        return value;
      },
      rightStickY: () => 0,
      clearTaps: () => {},
    };

    const shortcuts = createInputShortcuts({
      getContext: () => ({ ...baseCtx, decorPickerOpen: decorOpen }),
      getBattlePeekOpen: () => false,
      setBattlePeek: () => {},
      setPhotoMode: () => {},
      snapPostcard: () => {},
      journal: {
        hasOpenOverlay: () => false,
        dismissOverlay: () => false,
        stepOverlay: () => false,
        stepPage: () => {},
        scrollActivePage: () => false,
        navigateFocus: () => false,
        activateFocused: () => false,
      },
      gamepad,
      clearKeyboardTaps: () => {},
      swallow: (btn) => { events.push(`swallow:${btn}`); },
      playChoiceMove: () => { events.push("choice-move"); },
      invalidate: () => {},
      decorPicker: {
        isOpen: () => decorOpen,
        openForArea: () => true,
        close: () => {
          decorOpen = false;
          events.push("close");
        },
        stepFocus: (delta) => { events.push(`step:${delta}`); },
        activateFocused: () => { events.push("activate"); },
        handleKeydown: () => false,
      },
    });

    nextNav = "right";
    shortcuts.pollGamepad();
    nextNav = "up";
    shortcuts.pollGamepad();
    nextConfirm = true;
    shortcuts.pollGamepad();
    nextPhoto = "exit";
    shortcuts.pollGamepad();

    expect(decorOpen).toBe(false);
    expect(events).toEqual([
      "step:1",
      "choice-move",
      "step:-1",
      "choice-move",
      "swallow:confirm",
      "activate",
      "close",
      "swallow:cancel",
    ]);
  });
});
