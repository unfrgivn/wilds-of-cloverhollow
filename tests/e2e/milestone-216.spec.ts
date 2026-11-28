import { expect, test, type Page } from "@playwright/test";
import { longFlowTimeout, step } from "./helpers";

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

async function unlockAudio(page: Page): Promise<void> {
  await tapKey(page, "ArrowRight");
  await expect
    .poll(() => page.evaluate(() => window.__cloverhollow?.sound.state()))
    .toBe("running");
}

async function recordedEffects(page: Page): Promise<string[]> {
  return page.evaluate(() => [...(window.__cloverhollow?.sound.effects() ?? [])]);
}

test.describe("Milestone 216: Soundtrack Album Foley, Auto-Scroll & Weather Photo Toast", () => {
  test.setTimeout(longFlowTimeout);

  test(
    "plays paper-flip on album filter, sticker-peel on reset, and auto-scrolls active track",
    { tag: "@smoke" },
    async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto("./?qa=clubhouse");
      await page.waitForFunction(() => Boolean(window.__cloverhollow));
      await page.evaluate(() => window.__cloverhollow?.pause());
      await step(page, 1);

      await unlockAudio(page);
      await runQaCommands(page, ["keepsakes on"]);

      // Open Journal -> MAP -> Field Treasures -> ♫ OST · 35.
      await tapKey(page, "j");
      await expect(page.locator(".journal-book")).toBeVisible();
      await page.locator(".journal-map-tab").click();
      await expect(page.locator(".journal-book")).toHaveAttribute("data-journal-page", "map");
      await page.locator(".journal-treasures-btn").click();
      await expect(page.locator(".journal-treasures-card")).toBeVisible();

      const albumBtn = page.locator(".journal-album-btn");
      await albumBtn.click();
      const card = page.locator(".journal-jukebox-card");
      await expect(card).toBeVisible();

      // Clicking a different category filter plays "paper-flip"; clicking it again does not.
      const beforeFilter = (await recordedEffects(page)).length;
      const storyBtn = card.locator('.journal-album-filter[data-album-category="story"]');
      await storyBtn.click();
      await expect(storyBtn).toHaveAttribute("aria-pressed", "true");
      expect((await recordedEffects(page)).slice(beforeFilter)).toContain("paper-flip");

      const afterFirstFilter = (await recordedEffects(page)).length;
      await storyBtn.click();
      expect((await recordedEffects(page)).slice(afterFirstFilter)).not.toContain("paper-flip");

      // Play "encore" (Starlight Encore!), close & reopen -> auto-scrolls into view.
      const encoreTrack = card.locator('.journal-album-track[data-track="encore"]');
      await encoreTrack.click();
      await expect(card).toHaveAttribute("data-jukebox-active", "true");

      await page.keyboard.press("Escape");
      await expect(card).toBeHidden();
      await albumBtn.click();
      await expect(card).toBeVisible();
      const gridScrollTop = await card
        .locator(".journal-album-grid")
        .evaluate((node) => node.scrollTop);
      expect(gridScrollTop).toBeGreaterThan(0);

      // Clicking "Area Theme" reset plays "sticker-peel".
      const beforeReset = (await recordedEffects(page)).length;
      await card.locator(".journal-album-reset").click();
      await expect(card).toHaveAttribute("data-jukebox-active", "false");
      expect((await recordedEffects(page)).slice(beforeReset)).toContain("sticker-peel");

      await page.evaluate(() => window.__cloverhollow?.save.clear());
      expect(errors).toEqual([]);
    },
  );

  test(
    "stamps active Rainbow Sunshower weather into Photo Mode .photo-toast",
    { tag: "@smoke" },
    async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto("./?qa=fountain-frog");
      await page.waitForFunction(() => Boolean(window.__cloverhollow));
      await page.evaluate(() => window.__cloverhollow?.pause());
      await step(page, 1);

      await runQaCommands(page, ["keepsakes on"]);

      // Activate Rainbow Sunshower via Journal -> MAP -> Treasures -> Sky Almanac.
      await tapKey(page, "j");
      await expect(page.locator(".journal-book")).toBeVisible();
      await page.locator(".journal-map-tab").click();
      await page.locator(".journal-treasures-btn").click();
      await page.locator(".journal-weather-btn").click();
      const sunBtn = page.locator('.journal-weather-option[data-weather-mode="sunshower"]');
      await expect(sunBtn).toBeVisible();
      await sunBtn.click();
      await expect(sunBtn).toHaveAttribute("aria-pressed", "true");
      await expect(page.locator("html")).toHaveAttribute("data-weather", "sunshower");

      // Close Sky Almanac, Field Treasures, and Journal cleanly.
      await page.keyboard.press("Escape");
      await step(page, 1);
      await page.keyboard.press("Escape");
      await step(page, 1);
      await tapKey(page, "j");
      await expect(page.locator(".journal-book")).toBeHidden();

      // Enter Photo Mode (KeyP) and snap (Space) -> .photo-toast displays weather stamp!
      await page.keyboard.press("KeyP");
      await step(page, 2);
      await expect(page.locator("html")).toHaveAttribute("data-photo", "on");

      await page.keyboard.press("Space");
      const toast = page.locator(".photo-toast");
      await expect(toast).toBeVisible();
      await expect(toast).toHaveText("Postcard saved · Town plaza · Rainbow Sunshower");

      await page.keyboard.press("Escape");
      await step(page, 1);
      await expect(toast).toBeHidden();

      await page.evaluate(() => {
        localStorage.removeItem("cloverhollow:weather-mode");
        window.__cloverhollow?.save.clear();
      });
      expect(errors).toEqual([]);
    },
  );
});
