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

test.describe("Milestone 133: Tactile Storybook UI Foley", () => {
  test.setTimeout(longFlowTimeout);

  test(
    "plays page-turn, option toggles, field note card open/close, and photo mode foley",
    { tag: "@smoke" },
    async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto("./?qa=fountain-frog");
      await page.waitForFunction(() => Boolean(window.__cloverhollow));
      await page.evaluate(() => window.__cloverhollow?.pause());
      await step(page, 1);

      // Unlock Web Audio with a real user key press before exercising UI foley.
      await tapKey(page, "ArrowRight");
      await expect
        .poll(() => page.evaluate(() => window.__cloverhollow?.sound.state()))
        .toBe("running");

      const startCount = (await recordedEffects(page)).length;

      // 1. Open Journal and flip NOTES -> MAP (click) -> OPTIONS (] key).
      await tapKey(page, "j");
      const book = page.locator(".journal-book");
      await expect(book).toBeVisible();
      await expect(book).toHaveAttribute("data-journal-page", "notes");

      await page.locator(".journal-map-tab").click();
      await expect(book).toHaveAttribute("data-journal-page", "map");

      await page.keyboard.press("BracketRight");
      await step(page, 1);
      await expect(book).toHaveAttribute("data-journal-page", "options");

      const afterTabs = (await recordedEffects(page)).slice(startCount);
      expect(afterTabs).toEqual(["page-turn", "page-turn"]);

      // 2. Toggle Gentle Timing ON then OFF in OPTIONS.
      const beforeToggle = (await recordedEffects(page)).length;
      const gentle = page.locator(".journal-opt-gentle");
      await expect(gentle).toBeVisible();
      await gentle.click();
      await step(page, 1);
      await expect(gentle).toHaveAttribute("aria-pressed", "true");
      await gentle.click();
      await step(page, 1);
      await expect(gentle).toHaveAttribute("aria-pressed", "false");

      const afterToggle = (await recordedEffects(page)).slice(beforeToggle);
      expect(afterToggle).toEqual(["toggle-on", "toggle-off"]);

      // 3. Return to NOTES, open and close Fountain Frog Field Note Card.
      await page.locator(".journal-notes-tab").click();
      await expect(book).toHaveAttribute("data-journal-page", "notes");

      const beforeCard = (await recordedEffects(page)).length;
      const frogSlot = page.locator(
        '.journal-stickers:not(.journal-prizes) .journal-slot[aria-label="Inspect Fountain Frog"]',
      );
      await expect(frogSlot).toBeVisible();
      await frogSlot.click();
      await expect(page.locator(".journal-field-note")).toBeVisible();

      await page.locator(".journal-field-close").click();
      await expect(page.locator(".journal-field-note")).toBeHidden();

      const afterCard = (await recordedEffects(page)).slice(beforeCard);
      expect(afterCard).toEqual(["card-open", "card-close"]);

      // 4. Close Journal, then enter & exit Photo Mode (KeyP -> Escape).
      await tapKey(page, "j");
      await expect(book).toBeHidden();

      const beforePhoto = (await recordedEffects(page)).length;
      await page.keyboard.press("KeyP");
      await step(page, 1);
      await expect(page.locator("html")).toHaveAttribute("data-photo", "on");

      await page.keyboard.press("Escape");
      await step(page, 1);
      await expect(page.locator("html")).toHaveAttribute("data-photo", "off");

      const afterPhoto = (await recordedEffects(page)).slice(beforePhoto);
      expect(afterPhoto).toEqual(["toggle-on", "toggle-off"]);
      expect(errors).toEqual([]);
    },
  );
});
