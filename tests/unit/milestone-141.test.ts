import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadContent } from "../../src/content/load";
import {
  blankInput,
  createState,
  openArcade,
  step,
  type ActionFrame,
  type ArcadeGame,
  type ArcadeGameId,
  type State,
} from "../../src/core";
import {
  bindWebGlRecovery,
  renderBootError,
  shouldFreezeLiveLoop,
} from "../../src/shell/lifecycle";

const { world, fixtures } = loadContent();
const baseFixture = fixtures.plaza ?? fixtures["new-game"];
if (baseFixture === undefined) throw new Error("Missing plaza/new-game fixture");
const baseState: State = { ...createState(world, baseFixture), coins: 50 };

function cancelPress(): ActionFrame {
  return { ...blankInput(), cancel: true };
}

function intoResult(game: ArcadeGame, revealed: number): ArcadeGame {
  const message = "All done!";
  return { ...game, phase: "result", phaseTicks: 0, message, revealed };
}

describe("Milestone 141: WebGL Context-Loss Lifecycle & Recovery", () => {
  it("freezes live loop when contextLost is true even while visible and unpaused", () => {
    expect(
      shouldFreezeLiveLoop({
        documentHidden: false,
        paused: false,
        areaLoading: false,
        contextLost: true,
      }),
    ).toBe(true);

    expect(
      shouldFreezeLiveLoop({
        documentHidden: false,
        paused: true,
        areaLoading: false,
        contextLost: true,
      }),
    ).toBe(true);

    expect(
      shouldFreezeLiveLoop({
        documentHidden: false,
        paused: false,
        areaLoading: false,
        contextLost: false,
      }),
    ).toBe(false);

    expect(
      shouldFreezeLiveLoop({
        documentHidden: false,
        paused: false,
        areaLoading: false,
      }),
    ).toBe(false);
  });

  it("prevents default on webglcontextlost, fires callbacks, and disposes cleanly", () => {
    const target = new EventTarget();
    let lostCount = 0;
    let restoredCount = 0;

    const binding = bindWebGlRecovery(target, {
      onLost: () => {
        lostCount += 1;
      },
      onRestored: () => {
        restoredCount += 1;
      },
    });

    const lostEvent = new Event("webglcontextlost", { cancelable: true });
    target.dispatchEvent(lostEvent);
    expect(lostEvent.defaultPrevented).toBe(true);
    expect(lostCount).toBe(1);
    expect(restoredCount).toBe(0);

    target.dispatchEvent(new Event("webglcontextrestored"));
    expect(lostCount).toBe(1);
    expect(restoredCount).toBe(1);

    binding.dispose();

    const afterDisposeLost = new Event("webglcontextlost", { cancelable: true });
    target.dispatchEvent(afterDisposeLost);
    target.dispatchEvent(new Event("webglcontextrestored"));
    expect(afterDisposeLost.defaultPrevented).toBe(false);
    expect(lostCount).toBe(1);
    expect(restoredCount).toBe(1);

    // Boot error renderer must safely no-op when #app is absent.
    expect(() => renderBootError(null, new Error("WebGL init failed"))).not.toThrow();
  });
});

describe("Milestone 141: Minigame Cancel Exit Ergonomics", () => {
  const allGames: readonly ArcadeGameId[] = [
    "claw",
    "skee",
    "mole",
    "comet",
    "cook-nuggets",
    "fish",
  ];

  it("dismisses result phase on cancel edge across all six minigames", () => {
    for (const gameId of allGames) {
      const opened = openArcade(world, baseState, gameId, 0);
      if (opened.arcade === null) throw new Error(`Expected ${gameId} to open`);

      // While text is still typing, cancel finishes revealing before closing.
      const revealingState: State = {
        ...opened,
        previousInput: blankInput(),
        arcade: intoResult(opened.arcade, 2),
      };
      const afterReveal = step(world, revealingState, cancelPress()).state;
      expect(afterReveal.arcade, `${gameId} stays open after first reveal cancel`).not.toBeNull();
      expect(afterReveal.arcade?.revealed).toBe(afterReveal.arcade?.message.length);

      // Holding cancel without releasing must not immediately close on the next tick.
      const stillHeld = step(world, afterReveal, cancelPress()).state;
      expect(stillHeld.arcade, `${gameId} requires fresh cancel edge`).not.toBeNull();

      // Releasing and pressing cancel again closes the finished result cleanly.
      const released = step(world, stillHeld, blankInput()).state;
      const closed = step(world, released, cancelPress()).state;
      expect(closed.arcade, `${gameId} closes result on cancel edge`).toBeNull();
    }
  });

  it("lets free Clubhouse Microwave exit ready on cancel while paid arcade games stay open", () => {
    for (const dishId of ["cook-nuggets", "cook-mac"] as const) {
      const opened = openArcade(world, baseState, dishId, 0);
      expect(opened.arcade?.game).toBe("cook");
      expect(opened.arcade?.phase).toBe("ready");
      const exited = step(world, { ...opened, previousInput: blankInput() }, cancelPress()).state;
      expect(exited.arcade, `${dishId} exits ready on cancel`).toBeNull();
      expect(exited.snacks).toBe(opened.snacks);
    }

    const paidGames: readonly ArcadeGameId[] = ["claw", "skee", "mole", "comet"];
    for (const gameId of paidGames) {
      const opened = openArcade(world, baseState, gameId, 1);
      expect(opened.arcade).not.toBeNull();
      const afterCancel = step(
        world,
        { ...opened, previousInput: blankInput() },
        cancelPress(),
      ).state;
      expect(afterCancel.arcade, `paid ${gameId} stays open on ready cancel`).not.toBeNull();
      expect(afterCancel.arcade?.game).toBe(gameId);
    }
  });
});

describe("Milestone 141: PWA Icon & Mobile Web App Metadata", () => {
  it("declares mobile-web-app-capable and icon-512.png fallback in index.html and manifest", () => {
    const html = readFileSync("index.html", "utf8");
    expect(html).toContain('<meta name="mobile-web-app-capable" content="yes">');
    expect(html).toContain(
      '<link rel="icon" type="image/png" sizes="512x512" href="./icons/icon-512.png">',
    );

    const manifestRaw: unknown = JSON.parse(readFileSync("public/manifest.webmanifest", "utf8"));
    expect(typeof manifestRaw === "object" && manifestRaw !== null).toBe(true);
    if (typeof manifestRaw !== "object" || manifestRaw === null || !("icons" in manifestRaw)) {
      throw new Error("Missing icons in manifest");
    }
    const icons = manifestRaw.icons;
    expect(Array.isArray(icons)).toBe(true);
    if (!Array.isArray(icons)) throw new Error("Manifest icons must be an array");
    const pngIcon = icons.find(
      (entry: unknown) =>
        typeof entry === "object" &&
        entry !== null &&
        "src" in entry &&
        entry.src === "icons/icon-512.png",
    );
    expect(pngIcon).toEqual({
      src: "icons/icon-512.png",
      sizes: "512x512",
      type: "image/png",
      purpose: "any",
    });
  });
});
