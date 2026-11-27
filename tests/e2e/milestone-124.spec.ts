import { expect, test, type Page } from "@playwright/test";
import { longFlowTimeout, readState, step } from "./helpers";

declare global {
  interface Window {
    __m124GamepadState?: { buttons: boolean[]; axes: number[] };
  }
}

async function tapKey(page: Page, key: string): Promise<void> {
  await page.keyboard.down(key);
  await step(page, 1);
  await page.keyboard.up(key);
  await step(page, 2);
}

async function runQaCommands(page: Page, commands: readonly string[]): Promise<void> {
  await page.keyboard.press("`");
  await expect(page.locator(".qa-console")).toBeVisible();
  for (const command of commands) {
    await page.keyboard.type(command);
    await page.keyboard.press("Enter");
  }
  await page.keyboard.press("Escape");
  await expect(page.locator(".qa-console")).toBeHidden();
  await step(page, 2);
}

async function installGamepad(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const state = {
      buttons: Array.from({ length: 16 }, () => false),
      axes: [0, 0, 0, 0],
    };
    Object.defineProperty(window, "__m124GamepadState", { value: state });
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
    const state = window.__m124GamepadState;
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

async function pressPad(page: Page, button: number): Promise<void> {
  await setPad(page, { buttons: [button] });
  await step(page, 1);
  await setPad(page, {});
  await step(page, 2);
}

test.describe("Milestone 124: Full Keyboard & Gamepad Journal Navigation", () => {
  test.setTimeout(longFlowTimeout);

  test(
    "keyboard scrolls full Journal, controls OPTIONS, and steps MAP Land Guide without mouse",
    { tag: "@smoke" },
    async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto("./?qa=fountain-frog");
      await page.waitForFunction(() => Boolean(window.__cloverhollow));
      await page.evaluate(() => window.__cloverhollow?.pause());
      await step(page, 1);

      await runQaCommands(page, [
        "stickers all",
        "prizes all",
        "fish all",
        "keepsakes on",
        "gems all",
      ]);

      const beforePlayer = (await readState(page)).player;
      await tapKey(page, "j");
      const book = page.locator(".journal-book");
      await expect(book).toBeVisible();
      await expect(book).toHaveAttribute("data-journal-page", "notes");

      // 1. ArrowDown scrolls .journal-stickers-page cleanly while Fae remains frozen.
      const startScroll = await page
        .locator(".journal-stickers-page")
        .evaluate((node) => node.scrollTop);
      expect(startScroll).toBe(0);

      for (let count = 0; count < 4; count += 1) {
        await page.keyboard.press("ArrowDown");
        await step(page, 1);
      }
      const afterDownScroll = await page
        .locator(".journal-stickers-page")
        .evaluate((node) => node.scrollTop);
      expect(afterDownScroll).toBeGreaterThan(0);
      expect((await readState(page)).player).toEqual(beforePlayer);

      await page.keyboard.press("ArrowUp");
      await step(page, 1);
      const afterUpScroll = await page
        .locator(".journal-stickers-page")
        .evaluate((node) => node.scrollTop);
      expect(afterUpScroll).toBeLessThan(afterDownScroll);

      // 2. Switch to OPTIONS via ], navigate focus with ArrowDown, toggle via Enter/Space.
      await page.keyboard.press("]");
      await expect(book).toHaveAttribute("data-journal-page", "map");
      await page.keyboard.press("]");
      await expect(book).toHaveAttribute("data-journal-page", "options");

      const optSfx = page.locator(".journal-opt-sfx");
      await expect(optSfx).toHaveText("on");
      // Focus order on OPTIONS: prev, nowPlaying, next, optSfx (4th control).
      for (let count = 0; count < 4; count += 1) {
        await page.keyboard.press("ArrowDown");
      }
      await expect(optSfx).toBeFocused();
      await page.keyboard.press("Enter");
      await step(page, 1);
      await expect(optSfx).toHaveText("off");
      await page.keyboard.press("Space");
      await step(page, 1);
      await expect(optSfx).toHaveText("on");

      // 3. Switch to MAP via [, focus first Land Guide pin, step with ArrowRight/ArrowLeft.
      await page.keyboard.press("[");
      await expect(book).toHaveAttribute("data-journal-page", "map");
      const detail = page.locator(".journal-map-detail");

      await page.keyboard.press("ArrowDown");
      await expect(page.locator('.journal-map-land[data-land="cloverhollow"]')).toBeFocused();
      await expect(detail).toContainText("Here: Cloverhollow");
      await expect(detail).toContainText("Shops, Café & Arcade");

      await page.keyboard.press("ArrowRight");
      await expect(book).toHaveAttribute("data-journal-page", "map");
      await expect(page.locator('.journal-map-land[data-land="bay"]')).toBeFocused();
      await expect(detail).toContainText("Bubblegum Bay");
      await expect(detail).toContainText("Fishing, Boats & Cottage");

      await page.keyboard.press("ArrowRight");
      await expect(book).toHaveAttribute("data-journal-page", "map");
      await expect(page.locator('.journal-map-land[data-land="pass"]')).toBeFocused();
      await expect(detail).toContainText("Pinecone Pass");

      await page.keyboard.press("ArrowLeft");
      await expect(book).toHaveAttribute("data-journal-page", "map");
      await expect(page.locator('.journal-map-land[data-land="bay"]')).toBeFocused();
      await expect(detail).toContainText("Bubblegum Bay");

      expect((await readState(page)).player).toEqual(beforePlayer);
      expect(errors).toEqual([]);
    },
  );

  test(
    "gamepad scrolls Journal with right stick, steps MAP pins, and toggles OPTIONS with A",
    { tag: "@smoke" },
    async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      await installGamepad(page);
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto("./?qa=fountain-frog");
      await page.waitForFunction(() => Boolean(window.__cloverhollow));
      await page.evaluate(() => window.__cloverhollow?.pause());
      await step(page, 1);

      await runQaCommands(page, ["stickers all", "prizes all", "fish all", "keepsakes on"]);

      // Open Journal with Gamepad Y (button 3).
      await pressPad(page, 3);
      const book = page.locator(".journal-book");
      await expect(book).toBeVisible();
      await expect(book).toHaveAttribute("data-journal-page", "notes");

      // Scroll smoothly with right stick down.
      await setPad(page, { axes: [0, 0, 0, 0.9] });
      await page.evaluate(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() =>
              requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
            ),
          ),
      );
      await setPad(page, {});
      const stickScroll = await page
        .locator(".journal-stickers-page")
        .evaluate((node) => node.scrollTop);
      expect(stickScroll).toBeGreaterThan(0);

      // Flip to MAP with RB (button 5) and step Land Guide pins directly with D-Pad Right (15).
      await pressPad(page, 5);
      await expect(book).toHaveAttribute("data-journal-page", "map");
      await pressPad(page, 15);
      await expect(page.locator(".journal-map-detail")).toContainText("Cloverhollow");
      await pressPad(page, 15);
      await expect(page.locator(".journal-map-detail")).toContainText("Bubblegum Bay");

      // Flip to OPTIONS with RB (button 5), step to SFX toggle via D-Pad Down (13), toggle with A.
      await pressPad(page, 5);
      await expect(book).toHaveAttribute("data-journal-page", "options");
      for (let count = 0; count < 4; count += 1) {
        await pressPad(page, 13);
      }
      const optSfx = page.locator(".journal-opt-sfx");
      await expect(optSfx).toBeFocused();
      await expect(optSfx).toHaveText("on");
      await pressPad(page, 0);
      await expect(optSfx).toHaveText("off");
      await pressPad(page, 0);
      await expect(optSfx).toHaveText("on");

      expect(errors).toEqual([]);
    },
  );
});
