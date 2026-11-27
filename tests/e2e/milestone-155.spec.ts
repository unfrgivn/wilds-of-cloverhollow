import { expect, test, type Page } from "@playwright/test";
import { longFlowTimeout, openHarness, renderInfo, resetPaused, step } from "./helpers";

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

test.describe("Milestone 155: Accessible Modal Focus & Tool Micro-Event Sparkle Chime", () => {
  test.setTimeout(longFlowTimeout);

  test(
    "Journal Field Note moves focus into card and restores browse-synced slot on Escape",
    { tag: "@smoke" },
    async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto("./?qa=fountain-frog");
      await page.waitForFunction(() => Boolean(window.__cloverhollow));
      await page.evaluate(() => window.__cloverhollow?.pause());
      await step(page, 1);

      await runQaCommands(page, ["prizes all"]);
      await tapKey(page, "j");
      const book = page.locator(".journal-book");
      await expect(book).toBeVisible();

      const frogPlush = page.locator('.journal-prizes .journal-slot[data-prize="frog-plush"]');
      await frogPlush.scrollIntoViewIfNeeded();
      await frogPlush.focus();
      await expect(frogPlush).toBeFocused();

      // Press Enter to open Frog Plush (1 / 13) -> focus enters .journal-field-note.
      await page.keyboard.press("Enter");
      await step(page, 1);

      const fieldNote = page.locator(".journal-field-note");
      await expect(fieldNote).toBeVisible();
      await expect(fieldNote.locator(".journal-field-name")).toHaveText("Frog Plush");
      await expect(fieldNote.locator(".journal-field-counter")).toHaveText("1 / 13");
      await expect(fieldNote).toBeFocused();

      // Press ArrowRight to flip to Pup Plush (2 / 13).
      await page.keyboard.press("ArrowRight");
      await step(page, 1);
      await expect(fieldNote.locator(".journal-field-name")).toHaveText("Pup Plush");
      await expect(fieldNote.locator(".journal-field-counter")).toHaveText("2 / 13");

      // Press Escape -> card closes and restores focus onto Pup Plush slot directly.
      await page.keyboard.press("Escape");
      await step(page, 1);
      await expect(fieldNote).toBeHidden();
      await expect(book).toBeVisible();

      const pupPlush = page.locator('.journal-prizes .journal-slot[data-prize="pup-plush"]');
      await expect(pupPlush).toBeFocused();
      expect(errors).toEqual([]);
    },
  );

  test(
    "live interactive tool micro-event triggers tool-sparkle celesta chime once",
    { tag: "@smoke" },
    async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      await page.setViewportSize({ width: 1280, height: 720 });
      await openHarness(page);
      await resetPaused(page, "cavern");
      await step(page, 2);

      // Unlock Web Audio with a real pointer gesture before resuming live overworld.
      await page.mouse.click(640, 360);
      await expect
        .poll(() => page.evaluate(() => window.__cloverhollow?.sound.state()))
        .toBe("running");

      await page.evaluate(() => window.__cloverhollow?.resume());

      // Turn on Blacklight Lantern in Crystal Cavern -> triggers cavern-crystal-resonance.
      await page.keyboard.press("l");

      await expect
        .poll(async () => (await renderInfo(page)).npcLife.activeToolEventId, { timeout: 5_000 })
        .toBe("cavern-crystal-resonance");

      await expect
        .poll(
          () => page.evaluate(() => window.__cloverhollow?.sound.effects() ?? []),
          { timeout: 5_000 },
        )
        .toContain("tool-sparkle");

      // Confirm no per-frame spam while the tool event remains active.
      await page.waitForTimeout(250);
      const sparkleCount = await page.evaluate(
        () =>
          (window.__cloverhollow?.sound.effects() ?? []).filter((e) => e === "tool-sparkle")
            .length,
      );
      expect(sparkleCount).toBe(1);

      await page.evaluate(() => window.__cloverhollow?.pause());
      expect(errors).toEqual([]);
    },
  );
});
