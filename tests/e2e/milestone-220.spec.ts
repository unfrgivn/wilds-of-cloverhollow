import { expect, test, type Page } from "@playwright/test";
import { longFlowTimeout, step } from "./helpers";

async function tapKey(page: Page, key: string): Promise<void> {
  await page.keyboard.down(key);
  await step(page, 1);
  await page.keyboard.up(key);
  await step(page, 2);
}

async function recordedEffects(page: Page): Promise<string[]> {
  return page.evaluate(() => [...(window.__cloverhollow?.sound.effects() ?? [])]);
}

async function openAtlasMap(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("./?qa=flute");
  await page.waitForFunction(() => Boolean(window.__cloverhollow));
  await page.evaluate(() => window.__cloverhollow?.pause());
  await step(page, 1);

  // Unlock Web Audio with a real user key press before testing Atlas foley.
  await tapKey(page, "ArrowRight");
  await expect
    .poll(() => page.evaluate(() => window.__cloverhollow?.sound.state()))
    .toBe("running");

  await tapKey(page, "j");
  const book = page.locator(".journal-book");
  await expect(book).toBeVisible();
  await page.locator(".journal-map-tab").click();
  await expect(book).toHaveAttribute("data-journal-page", "map");
}

test.describe("Milestone 220: Smart Valley Atlas Filter & Pin Keyboard Parity", () => {
  test.setTimeout(longFlowTimeout);

  test(
    "Atlas filter toolbar supports ArrowRight/ArrowLeft wrap, Home/End, and Enter with paper-flip",
    { tag: "@smoke" },
    async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      await openAtlasMap(page);
      const book = page.locator(".journal-book");
      const allBtn = page.locator('.journal-atlas-filter[data-filter="all"]');
      const gemsBtn = page.locator('.journal-atlas-filter[data-filter="gems"]');
      const bossesBtn = page.locator('.journal-atlas-filter[data-filter="bosses"]');
      const busBtn = page.locator('.journal-atlas-filter[data-filter="bus"]');

      await allBtn.focus();
      await expect(allBtn).toBeFocused();

      // ArrowRight steps cleanly across all 4 pills and wraps back to All without leaving MAP.
      await page.keyboard.press("ArrowRight");
      await expect(gemsBtn).toBeFocused();
      await expect(book).toHaveAttribute("data-journal-page", "map");

      await page.keyboard.press("ArrowRight");
      await expect(bossesBtn).toBeFocused();

      await page.keyboard.press("ArrowRight");
      await expect(busBtn).toBeFocused();

      await page.keyboard.press("ArrowRight");
      await expect(allBtn).toBeFocused();

      // ArrowLeft wraps backward from All -> Bus -> Bosses without flipping tabs.
      await page.keyboard.press("ArrowLeft");
      await expect(busBtn).toBeFocused();
      await expect(book).toHaveAttribute("data-journal-page", "map");

      await page.keyboard.press("ArrowLeft");
      await expect(bossesBtn).toBeFocused();

      // End and Home jump cleanly to the last and first filter pills.
      await page.keyboard.press("End");
      await expect(busBtn).toBeFocused();

      await page.keyboard.press("Home");
      await expect(allBtn).toBeFocused();

      // Step to Gems and activate with real Enter -> filters pins and plays paper-flip.
      await page.keyboard.press("ArrowRight");
      await expect(gemsBtn).toBeFocused();

      const beforeFilter = (await recordedEffects(page)).length;
      await page.keyboard.press("Enter");
      await expect(gemsBtn).toHaveAttribute("aria-pressed", "true");
      await expect(page.locator(".journal-map")).toHaveAttribute("data-atlas-filter", "gems");
      expect(await page.locator(".journal-map-land.is-filter-match").count()).toBeGreaterThan(0);
      expect((await recordedEffects(page)).slice(beforeFilter)).toContain("paper-flip");

      expect(errors).toEqual([]);
    },
  );

  test(
    "revealed Valley Map land pins jump cleanly between first and last pins with End and Home",
    { tag: "@smoke" },
    async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      await openAtlasMap(page);
      const revealedPins = page.locator(".journal-map-land.is-revealed");
      const pinCount = await revealedPins.count();
      expect(pinCount).toBeGreaterThanOrEqual(3);

      const firstPin = revealedPins.first();
      const lastPin = revealedPins.last();
      const firstLand = await firstPin.getAttribute("data-land");
      const lastLand = await lastPin.getAttribute("data-land");
      expect(firstLand).not.toBeNull();
      expect(lastLand).not.toBeNull();
      expect(firstLand).not.toBe(lastLand);

      const firstName = (await firstPin.innerText()).trim();
      const lastName = (await lastPin.innerText()).trim();

      // Focus the first revealed pin and press End -> jumps cleanly to the last revealed pin.
      await firstPin.focus();
      await expect(firstPin).toBeFocused();

      const beforeEnd = (await recordedEffects(page)).length;
      await page.keyboard.press("End");
      await expect(lastPin).toBeFocused();
      await expect(lastPin).toHaveClass(/is-selected/);
      await expect(page.locator(".journal-map-detail")).toContainText(lastName);
      await expect(page.locator(".journal-atlas-inspector")).toContainText(lastName);
      expect((await recordedEffects(page)).slice(beforeEnd)).toContain("atlas-pin");

      // Press Home -> jumps cleanly back to the first revealed pin and updates detail + inspector.
      const beforeHome = (await recordedEffects(page)).length;
      await page.keyboard.press("Home");
      await expect(firstPin).toBeFocused();
      await expect(firstPin).toHaveClass(/is-selected/);
      await expect(page.locator(".journal-map-detail")).toContainText(firstName);
      await expect(page.locator(".journal-atlas-inspector")).toContainText(firstName);
      expect((await recordedEffects(page)).slice(beforeHome)).toContain("atlas-pin");

      // Existing Enter toggle still deselects cleanly and plays sticker-peel.
      const beforeToggle = (await recordedEffects(page)).length;
      await page.keyboard.press("Enter");
      await expect(firstPin).not.toHaveClass(/is-selected/);
      expect((await recordedEffects(page)).slice(beforeToggle)).toContain("sticker-peel");

      expect(errors).toEqual([]);
    },
  );
});
