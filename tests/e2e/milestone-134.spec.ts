import { expect, test, type Page } from "@playwright/test";
import {
  longFlowTimeout,
  openHarness,
  queueScript,
  readBattle,
  recording,
  resetPaused,
  step,
} from "./helpers";

test.describe.configure({ timeout: longFlowTimeout });

declare global {
  interface Window {
    __m134PadState?: { buttons: boolean[]; axes: number[] };
  }
}

async function installGamepad(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const state = { buttons: Array.from({ length: 16 }, () => false), axes: [0, 0, 0, 0] };
    Object.defineProperty(window, "__m134PadState", { value: state });
    Object.defineProperty(navigator, "getGamepads", {
      configurable: true,
      value: () => [
        {
          mapping: "standard",
          buttons: state.buttons.map((pressed) => ({ pressed, value: pressed ? 1 : 0 })),
          axes: state.axes,
        },
      ],
    });
  });
}

async function setPad(
  page: Page,
  options: { axes?: [number, number, number, number]; buttons?: number[] },
): Promise<void> {
  await page.evaluate((next) => {
    const state = window.__m134PadState;
    if (state === undefined) throw new Error("gamepad unavailable");
    state.axes = next.axes ?? [0, 0, 0, 0];
    state.buttons.fill(false);
    for (const button of next.buttons ?? []) state.buttons[button] = true;
  }, options);
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
}

async function tapKey(page: Page, key: string): Promise<void> {
  await page.keyboard.down(key);
  await step(page, 1);
  await page.keyboard.up(key);
  await step(page, 1);
}

async function replayToTick(page: Page, scriptPath: string, targetTick: number): Promise<void> {
  const upTo: ReturnType<typeof recording> = [];
  let ticks = 0;
  for (const segment of recording(scriptPath)) {
    if (ticks >= targetTick) break;
    const take = Math.min(segment.ticks, targetTick - ticks);
    upTo.push({ frame: segment.frame, ticks: take });
    ticks += take;
  }
  await queueScript(page, upTo);
  await step(page, targetTick);
}

test(
  "Lantern Mood Peek (KeyL) spawns die-cut .battle-popup-peek and cleans up cleanly",
  { tag: "@smoke" },
  async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await page.setViewportSize({ width: 1280, height: 720 });
    await openHarness(page);
    await resetPaused(page, "new-game");
    await replayToTick(page, "tests/sim/scripts/new-game/golden-woods.json", 8791);
    await step(page, 1);

    const before = await readBattle(page);
    expect(before?.critterId).toBe("owl");
    expect(before?.phase).toBe("command");
    expect(before?.lanternPeek).toBe(false);
    await expect(page.locator(".battle-popup")).toHaveCount(0);

    await tapKey(page, "l");
    const after = await readBattle(page);
    expect(after?.lanternPeek).toBe(true);

    const peekPopup = page.locator(".battle-popup-peek");
    await expect(peekPopup).toBeVisible();
    const styleInfo = await peekPopup.evaluate((node) => {
      const style = getComputedStyle(node);
      return {
        text: node.textContent ?? "",
        kind: node.getAttribute("data-popup-kind") ?? "",
        color: style.color,
        backgroundColor: style.backgroundColor,
      };
    });
    expect(styleInfo.text).toBe("MOOD PEEK! ✦");
    expect(styleInfo.kind).toBe("peek");
    expect(styleInfo.color).toBe("rgb(71, 50, 31)");
    expect(styleInfo.backgroundColor).toBe("rgb(237, 224, 255)");

    await step(page, 40);
    await expect(page.locator(".battle-popup")).toHaveCount(0);
    expect(errors).toEqual([]);
  },
);

test(
  "Flute Friends (KeyF) spawns .battle-popup-assist and battle key badges adapt to gamepad",
  { tag: "@smoke" },
  async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await installGamepad(page);
    await page.setViewportSize({ width: 1280, height: 720 });
    await openHarness(page);
    await resetPaused(page, "new-game");
    await replayToTick(page, "tests/sim/scripts/new-game/cavern.json", 21531);

    const fluteBtn = page.locator(".battle-flute-btn");
    const fluteKey = page.locator(".battle-flute-btn .battle-action-key");
    const calmPlate = page.locator(".battle-calm");
    await expect(fluteBtn).toBeVisible();
    await expect(fluteKey).toHaveText("F");
    await expect(calmPlate).toHaveAttribute("title", "Inspect critter field guide (I)");

    // Right-stick gamepad activity switches battle key badges live without altering state.
    await setPad(page, { axes: [0, 0, 0, 0.8] });
    await step(page, 1);
    await expect(fluteKey).toHaveText("RB");
    await expect(calmPlate).toHaveAttribute("title", "Inspect critter field guide (View)");
    await setPad(page, {});

    // Pressing F switches badges back to keyboard and fires the Flute Friends assist popup.
    await tapKey(page, "f");
    const after = await readBattle(page);
    expect(after?.fluteUsed).toBe(true);
    await expect(calmPlate).toHaveAttribute("title", "Inspect critter field guide (I)");

    const assistPopup = page.locator(".battle-popup-assist");
    await expect(assistPopup).toBeVisible();
    const styleInfo = await assistPopup.evaluate((node) => {
      const style = getComputedStyle(node);
      return {
        text: node.textContent ?? "",
        kind: node.getAttribute("data-popup-kind") ?? "",
        color: style.color,
        backgroundColor: style.backgroundColor,
      };
    });
    expect(styleInfo.text).toBe("FLUTE! ♪");
    expect(styleInfo.kind).toBe("assist");
    expect(styleInfo.color).toBe("rgb(71, 50, 31)");
    expect(styleInfo.backgroundColor).toBe("rgb(199, 240, 232)");

    await step(page, 40);
    await expect(page.locator(".battle-popup")).toHaveCount(0);
    expect(errors).toEqual([]);
  },
);
