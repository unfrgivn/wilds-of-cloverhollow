import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { longFlowTimeout, openHarness, readState, resetPaused, step } from "./helpers";

async function captureReview(
  page: Page,
  testInfo: TestInfo,
  name: string,
): Promise<void> {
  if (process.env.CLOVERHOLLOW_REVIEW_SHOTS !== "1" || testInfo.project.name !== "chromium") {
    return;
  }
  await page.screenshot({
    path: `art/review/${name}.jpg`,
    type: "jpeg",
    quality: 90,
  });
}

test.describe("Milestone 154: Touch-Device Photo Mode Launcher in Journal OPTIONS", () => {
  test.setTimeout(longFlowTimeout);

  test(
    "touch phone launches Photo Mode from Journal OPTIONS, snaps postcard, and exits cleanly",
    { tag: "@smoke" },
    async ({ browser }, testInfo) => {
      const context = await browser.newContext({
        viewport: { width: 874, height: 402 },
        hasTouch: true,
      });
      const page = await context.newPage();
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      try {
        await page.goto("./?touch=1");
        await page.waitForFunction(() => Boolean(window.__cloverhollow));
        await resetPaused(page, "plaza");
        await page.evaluate(() => {
          document.documentElement.style.setProperty("--safe-right", "62px");
          document.documentElement.style.setProperty("--safe-bottom", "21px");
          document.documentElement.style.setProperty("--safe-left", "62px");
        });

        await expect(page.locator("html")).toHaveAttribute("data-touch", "on");
        await expect(page.locator("html")).toHaveAttribute("data-photo", "off");

        // Open Journal via the real touch menu button (100% keyboard-free).
        const touchMenu = page.locator(".touch-menu");
        await expect(touchMenu).toBeVisible();
        await touchMenu.tap();
        await step(page, 2);

        const book = page.locator(".journal-book");
        await expect(book).toBeVisible();
        await expect(page.locator("html")).toHaveAttribute("data-journal", "open");

        // Switch to OPTIONS via a real touch tap on the OPTIONS tab.
        const optionsTab = page.locator(".journal-options-tab");
        await optionsTab.tap();
        await expect(book).toHaveAttribute("data-journal-page", "options");

        // Verify .journal-photo-btn is visible, >= 44 px tall, dark-ink contrast, unclipped.
        const photoBtn = page.locator(".journal-photo-btn");
        const controlsCard = page.locator(".journal-controls-card");
        await expect(controlsCard).toHaveClass(/has-photo/);
        await expect(photoBtn).toBeVisible();
        await expect(photoBtn).toHaveAttribute("aria-label", "Enter Photo Mode");
        await expect(photoBtn).toContainText("Photo Mode");
        await expect(photoBtn.locator("svg")).toHaveCount(1);
        await expect(photoBtn.locator("svg text")).toHaveCount(0);
        await expect(page.locator(".journal-controls-line").first()).toBeHidden();

        const metrics = await page.evaluate(() => {
          const btn = document.querySelector<HTMLElement>(".journal-photo-btn");
          const bookEl = document.querySelector<HTMLElement>(".journal-book");
          const soundPage = document.querySelector<HTMLElement>(".journal-options-sound-page");
          const playPage = document.querySelector<HTMLElement>(".journal-options-play-page");
          if (btn === null || bookEl === null || soundPage === null || playPage === null) {
            return null;
          }
          const style = getComputedStyle(btn);
          const btnRect = btn.getBoundingClientRect();
          const bookRect = bookEl.getBoundingClientRect();
          return {
            height: btnRect.height,
            width: btnRect.width,
            insideBook:
              btnRect.left >= bookRect.left - 1 &&
              btnRect.right <= bookRect.right + 1 &&
              btnRect.top >= bookRect.top - 1 &&
              btnRect.bottom <= bookRect.bottom + 1,
            insideViewport:
              btnRect.left >= 0 &&
              btnRect.top >= 0 &&
              btnRect.right <= window.innerWidth + 0.5 &&
              btnRect.bottom <= window.innerHeight + 0.5,
            color: style.color,
            backgroundColor: style.backgroundColor,
            borderColor: style.borderTopColor,
            soundOverflowY: soundPage.scrollHeight - soundPage.clientHeight,
            soundOverflowX: soundPage.scrollWidth - soundPage.clientWidth,
            playOverflowY: playPage.scrollHeight - playPage.clientHeight,
            playOverflowX: playPage.scrollWidth - playPage.clientWidth,
          };
        });
        expect(metrics).not.toBeNull();
        if (metrics !== null) {
          expect(metrics.height).toBeGreaterThanOrEqual(44);
          expect(metrics.width).toBeGreaterThanOrEqual(110);
          expect(metrics.insideBook).toBe(true);
          expect(metrics.insideViewport).toBe(true);
          expect(metrics.color).toBe("rgb(71, 50, 31)");
          expect(metrics.backgroundColor).toBe("rgb(251, 246, 232)");
          expect(metrics.borderColor).toBe("rgb(71, 50, 31)");
          expect(metrics.soundOverflowY).toBeLessThanOrEqual(1);
          expect(metrics.soundOverflowX).toBeLessThanOrEqual(1);
          expect(metrics.playOverflowY).toBeLessThanOrEqual(1);
          expect(metrics.playOverflowX).toBeLessThanOrEqual(1);
        }

        await captureReview(page, testInfo, "m154-touch-options-photo-874");

        // Tap .journal-photo-btn: Journal closes and Photo Mode activates cleanly.
        await photoBtn.tap();
        await step(page, 1);

        await expect(book).toBeHidden();
        await expect(page.locator("html")).not.toHaveAttribute("data-journal", "open");
        await expect(page.locator("html")).toHaveAttribute("data-photo", "on");
        expect((await readState(page)).journalOpen).toBe(false);

        const photoBar = page.locator(".photo-touch-bar");
        const snapBtn = page.locator(".photo-touch-snap");
        const closeBtn = page.locator(".photo-touch-close");
        await expect(photoBar).toBeVisible();
        await expect(page.locator(".touch-controls")).toBeHidden();

        // Tap .photo-touch-snap: shutter fires (data-shutter-count="1").
        await snapBtn.tap();
        await expect(page.locator(".photo-shutter-flash")).toHaveAttribute(
          "data-shutter-count",
          "1",
        );

        // Tap .photo-touch-close: Photo Mode exits cleanly back to overworld touch chrome.
        await closeBtn.tap();
        await step(page, 1);
        await expect(page.locator("html")).toHaveAttribute("data-photo", "off");
        await expect(photoBar).toBeHidden();
        await expect(page.locator(".touch-controls")).toBeVisible();
        expect(errors).toEqual([]);
      } finally {
        await context.close();
      }
    },
  );

  test(
    "desktop Journal OPTIONS keeps .journal-photo-btn hidden and desktop Controls lines intact",
    { tag: "@smoke" },
    async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      await page.setViewportSize({ width: 1280, height: 720 });
      await openHarness(page);
      await resetPaused(page, "plaza");

      await expect(page.locator("html")).not.toHaveAttribute("data-touch", "on");
      await page.keyboard.press("j");
      await step(page, 2);

      const book = page.locator(".journal-book");
      await expect(book).toBeVisible();
      await page.keyboard.press("]");
      await page.keyboard.press("]");
      await expect(book).toHaveAttribute("data-journal-page", "options");

      await expect(page.locator(".journal-photo-btn")).toBeHidden();
      const primaryLine = page.locator(".journal-controls-line").first();
      await expect(primaryLine).toBeVisible();
      await expect(primaryLine).toContainText("Move: Arrows / WASD");
      await expect(primaryLine).toContainText("Journal: J");

      // ArrowUp wraps to Reduced Motion, skipping the CSS-hidden .journal-photo-btn.
      await page.keyboard.press("ArrowUp");
      await expect(page.locator(".journal-option-reduced-motion")).toBeFocused();
      expect(errors).toEqual([]);
    },
  );
});
