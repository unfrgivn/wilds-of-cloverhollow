import { expect, test, type Page } from "@playwright/test";
import { longFlowTimeout, readState, step } from "./helpers";

declare global {
  interface Window {
    __m214GamepadState?: { buttons: boolean[]; axes: number[] };
  }
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
    Object.defineProperty(window, "__m214GamepadState", { value: state });
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
    const state = window.__m214GamepadState;
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

async function holdRightStickDown(page: Page, frames = 8): Promise<void> {
  await setPad(page, { axes: [0, 0, 0, 0.9] });
  await page.evaluate(
    (count) =>
      new Promise<void>((resolve) => {
        let remaining = count;
        const tickFrame = (): void => {
          remaining -= 1;
          if (remaining <= 0) resolve();
          else requestAnimationFrame(tickFrame);
        };
        requestAnimationFrame(tickFrame);
      }),
    frames,
  );
  await setPad(page, {});
  await step(page, 1);
}

test.describe("Milestone 215: Steam Deck / Gamepad Journal Overlay Nav & Isolation", () => {
  test.setTimeout(longFlowTimeout);

  test(
    "isolates tabs behind Field Treasures, drives Sky Almanac with gamepad, and scrolls Ribbons",
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
      const beforePlayer = (await readState(page)).player;

      // 1. Open Journal with Gamepad Y (3), flip to MAP with RB (5), open Field Treasures.
      await pressPad(page, 3);
      const book = page.locator(".journal-book");
      await expect(book).toBeVisible();
      await pressPad(page, 5);
      await expect(book).toHaveAttribute("data-journal-page", "map");

      await page.locator(".journal-treasures-btn").click();
      const treasuresCard = page.locator(".journal-treasures-card");
      await expect(treasuresCard).toBeVisible();

      // Pressing LB (4), RB (5), [ or ] must NOT flip the Journal tab behind Field Treasures.
      await pressPad(page, 4);
      await pressPad(page, 5);
      await page.keyboard.press("[");
      await page.keyboard.press("]");
      await step(page, 1);
      await expect(treasuresCard).toBeVisible();
      await expect(book).toHaveAttribute("data-journal-page", "map");

      // 2. Gamepad-only D-Pad Right (15) + A (0) inside Field Treasures -> Valley Sky Almanac.
      const ribbonsBtn = page.locator(".journal-ribbons-btn");
      const weatherBtn = page.locator(".journal-weather-btn");
      await pressPad(page, 15);
      await expect(ribbonsBtn).toBeFocused();
      await pressPad(page, 15);
      await expect(weatherBtn).toBeFocused();
      await pressPad(page, 0);

      const almanac = page.locator(".journal-weather-card");
      await expect(almanac).toBeVisible();
      await expect(book).toHaveAttribute("data-journal-page", "map");

      // Step to Rainbow Sunshower (clear -> auto -> sunshower) using D-Pad Right (15), press A (0).
      const clearBtn = almanac.locator('.journal-weather-option[data-weather-mode="clear"]');
      const autoBtn = almanac.locator('.journal-weather-option[data-weather-mode="auto"]');
      const sunBtn = almanac.locator('.journal-weather-option[data-weather-mode="sunshower"]');
      await pressPad(page, 15);
      await expect(clearBtn).toBeFocused();
      await pressPad(page, 15);
      await expect(autoBtn).toBeFocused();
      await pressPad(page, 15);
      await expect(sunBtn).toBeFocused();
      await pressPad(page, 0);

      await expect(sunBtn).toHaveAttribute("aria-pressed", "true");
      await expect(page.locator("html")).toHaveAttribute("data-weather", "sunshower");
      await expect
        .poll(() => page.evaluate(() => window.__cloverhollow?.sound.music().weather))
        .toBe("sunshower");

      // Press Gamepad B (1) -> closes Valley Sky Almanac and returns cleanly to Field Treasures.
      await pressPad(page, 1);
      await expect(almanac).toBeHidden();
      await expect(treasuresCard).toBeVisible();
      await expect(weatherBtn).toBeFocused();

      // 3. Switch to compact viewport, open Grand 16-Ribbon Merit Tapestry with D-Pad + A,
      // and scroll with Gamepad Right Stick down.
      await page.setViewportSize({ width: 667, height: 375 });
      await step(page, 2);

      // Focus is currently on weatherBtn; D-Pad Left (14) steps back to ribbonsBtn, A (0) opens it.
      await pressPad(page, 14);
      await expect(ribbonsBtn).toBeFocused();
      await pressPad(page, 0);

      const ribbonsCard = page.locator(".journal-ribbons-card");
      await expect(ribbonsCard).toBeVisible();
      const beforeScroll = await ribbonsCard.evaluate((node) => ({
        scrollTop: node.scrollTop,
        scrollHeight: node.scrollHeight,
        clientHeight: node.clientHeight,
      }));
      expect(beforeScroll.scrollHeight).toBeGreaterThan(beforeScroll.clientHeight + 1);
      expect(beforeScroll.scrollTop).toBe(0);

      await holdRightStickDown(page, 10);
      const afterStickScroll = await ribbonsCard.evaluate((node) => node.scrollTop);
      expect(afterStickScroll).toBeGreaterThan(0);

      // Also verify 874x402 compact phone Field Treasures right-stick scrolling.
      await pressPad(page, 1);
      await expect(ribbonsCard).toBeHidden();
      await expect(treasuresCard).toBeVisible();
      await page.setViewportSize({ width: 874, height: 402 });
      await step(page, 2);
      const trBefore = await treasuresCard.evaluate((node) => node.scrollTop);
      await holdRightStickDown(page, 10);
      const trAfter = await treasuresCard.evaluate((node) => node.scrollTop);
      expect(trAfter).toBeGreaterThan(trBefore);

      // Reset weather preference cleanly and confirm Fae never moved.
      await page.evaluate(() => {
        localStorage.removeItem("cloverhollow:weather-mode");
      });
      expect((await readState(page)).player).toEqual(beforePlayer);
      expect(errors).toEqual([]);
    },
  );
});
