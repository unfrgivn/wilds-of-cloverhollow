import { expect, test } from "@playwright/test";
import { longFlowTimeout, openHarness, readState, resetPaused, step } from "./helpers";

test.describe("Milestone 202: Elevation Document Titles & Clickable Lasso Key Hint Pill", () => {
  test.setTimeout(longFlowTimeout);

  test(
    "shows clickable Lasso [R] pill when unlocked, throws lasso on click, and updates tab titles",
    { tag: "@smoke" },
    async ({ page }) => {
      const pageErrors: string[] = [];
      const consoleErrors: string[] = [];
      page.on("pageerror", (error) => pageErrors.push(error.message));
      page.on("console", (msg) => {
        if (msg.type() === "error") consoleErrors.push(msg.text());
      });

      await page.setViewportSize({ width: 1280, height: 720 });
      await openHarness(page);
      await resetPaused(page, "plaza");
      await expect(page).toHaveTitle("Town plaza · Wilds of Cloverhollow");

      // Turn Key Hints ON; Lasso pill stays hidden until has_lasso is unlocked.
      await page.evaluate(() => window.__cloverhollow?.settings.setKeyHints(true));
      await step(page, 1);

      const ribbon = page.locator(".hud-hints");
      const lassoPill = ribbon.locator('[data-hint="lasso"]');
      await expect(ribbon).toBeVisible();
      await expect(lassoPill).toBeHidden();

      // Grant has_lasso = true via QA console using real key presses.
      await page.keyboard.press("`");
      await expect(page.locator(".qa-console")).toBeVisible();
      await page.keyboard.type("lasso on");
      await page.keyboard.press("Enter");
      await expect(page.locator(".qa-console-log")).toContainText("has_lasso = true.");
      await page.keyboard.press("Escape");
      await expect(page.locator(".qa-console")).toBeHidden();
      await step(page, 1);

      // Verify clickable Lasso [R] pill renders beside Flute in .hud-hints.
      await expect(lassoPill).toBeVisible();
      await expect(lassoPill).toHaveAttribute("aria-label", "Throw Rainbow Lasso");
      await expect(lassoPill.locator(".hud-hint-key")).toHaveText("R");
      await expect(lassoPill.locator(".hud-hint-label")).toHaveText("Lasso");

      // Click the Lasso pill directly -> overworld Rainbow Lasso fires cleanly.
      await lassoPill.click();
      await step(page, 1);
      const afterLasso = await readState(page);
      expect(afterLasso.puzzleArea?.lasso).toBeDefined();

      // Let lasso arc finish cleanly.
      await step(page, 25);

      // Toggle Photo Mode with real P press -> tab title updates and restores cleanly.
      await page.keyboard.press("KeyP");
      await step(page, 1);
      await expect(page.locator("html")).toHaveAttribute("data-photo", "on");
      await expect(page).toHaveTitle("Photo Mode · Town plaza · Wilds of Cloverhollow");

      await page.keyboard.press("Escape");
      await step(page, 1);
      await expect(page.locator("html")).toHaveAttribute("data-photo", "off");
      await expect(page).toHaveTitle("Town plaza · Wilds of Cloverhollow");

      // Open Bedroom Decor Picker -> tab title updates and restores cleanly.
      await resetPaused(page, "new-game");
      await expect(page).toHaveTitle("Fae's bedroom · Wilds of Cloverhollow");

      await page.keyboard.press("KeyB");
      await expect(page.locator('[data-decor-picker="open"]')).toBeVisible();
      await expect(page).toHaveTitle("Decorating Fae's bedroom · Wilds of Cloverhollow");

      await page.keyboard.press("Escape");
      await expect(page.locator('[data-decor-picker="open"]')).toBeHidden();
      await expect(page).toHaveTitle("Fae's bedroom · Wilds of Cloverhollow");

      await page.evaluate(() => window.__cloverhollow?.settings.setKeyHints(false));
      await step(page, 1);
      expect(pageErrors).toEqual([]);
      expect(consoleErrors).toEqual([]);
    },
  );
});
