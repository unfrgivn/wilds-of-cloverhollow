import { expect, test, type Page } from "@playwright/test";
import { longFlowTimeout, openHarness, resetPaused, step } from "./helpers";

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

async function snapTwoPostcards(page: Page): Promise<void> {
  await resetPaused(page, "plaza");
  await step(page, 2);
  await page.keyboard.press("p");
  await step(page, 1);
  await expect(page.locator("html")).toHaveAttribute("data-photo", "on");
  await page.keyboard.press("Space");
  await expect(page.locator(".photo-shutter-flash")).toHaveAttribute("data-shutter-count", "1");
  await page.keyboard.press("Escape");
  await step(page, 1);
  await expect(page.locator("html")).toHaveAttribute("data-photo", "off");

  await resetPaused(page, "bay");
  await step(page, 2);
  await page.keyboard.press("p");
  await step(page, 1);
  await expect(page.locator("html")).toHaveAttribute("data-photo", "on");
  await page.keyboard.press("Space");
  await expect(page.locator(".photo-shutter-flash")).toHaveAttribute("data-shutter-count", "2");
  await page.keyboard.press("Escape");
  await step(page, 1);
  await expect(page.locator("html")).toHaveAttribute("data-photo", "off");
}

async function settleAnimations(page: Page, selector: string): Promise<void> {
  await page.evaluate(async (sel) => {
    const root = document.querySelector(sel);
    if (root === null) return;
    await Promise.all(
      root
        .getAnimations({ subtree: true })
        .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity)
        .map((animation) => animation.finished.catch(() => undefined)),
    );
  }, selector);
}

async function openPostcardLightbox(page: Page): Promise<void> {
  await runQaCommands(page, ["keepsakes on"]);
  await tapKey(page, "j");
  await expect(page.locator(".journal-book")).toBeVisible();
  await page.locator(".journal-map-tab").click();
  await expect(page.locator(".journal-book")).toHaveAttribute("data-journal-page", "map");
  await page.locator(".journal-treasures-btn").click();
  await expect(page.locator(".journal-treasures-card")).toBeVisible();
  await page.locator(".journal-postcards-btn").click();
  const albumCard = page.locator(".journal-postcards-card");
  await expect(albumCard).toBeVisible();
  await expect(albumCard).toHaveAttribute("data-album-mode", "grid");
  await albumCard.locator(".journal-postcard-tile").nth(0).click();
  await expect(albumCard).toHaveAttribute("data-album-mode", "lightbox");
  await expect(albumCard.locator(".journal-lightbox-img")).toBeVisible();
  await settleAnimations(page, ".journal-postcards-overlay");
}

test.describe("Milestone 238: Postcard Lightbox Touch Parity & Keyboard Action Nav", () => {
  test.setTimeout(longFlowTimeout);

  test(
    "enforces >= 44 px touch targets with zero overflow on 874x402 touch phone",
    { tag: "@smoke" },
    async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      await page.setViewportSize({ width: 874, height: 402 });
      await page.goto("./?touch=1");
      await page.waitForFunction(() => Boolean(window.__cloverhollow));
      await page.evaluate(() => {
        localStorage.removeItem("cloverhollow-postcards");
      });
      await expect(page.locator("html")).toHaveAttribute("data-touch", "on");

      await snapTwoPostcards(page);
      await openPostcardLightbox(page);
      await step(page, 2);

      const metrics = await page.evaluate(() => {
        const card = document.querySelector<HTMLElement>(".journal-postcards-card");
        const selectors = [
          ".journal-lightbox-back",
          ".journal-lightbox-prev",
          ".journal-lightbox-next",
          ".journal-lightbox-save",
          ".journal-lightbox-remove",
        ] as const;
        if (card === null) return null;
        const cardRect = card.getBoundingClientRect();
        const buttons = selectors.map((sel) => {
          const el = document.querySelector<HTMLElement>(sel);
          const rect = el?.getBoundingClientRect();
          return {
            sel,
            width: rect?.width ?? 0,
            height: rect?.height ?? 0,
            inside:
              rect !== undefined &&
              rect.left >= cardRect.left - 1 &&
              rect.top >= cardRect.top - 1 &&
              rect.right <= cardRect.right + 1 &&
              rect.bottom <= cardRect.bottom + 1,
          };
        });
        return {
          noHorizontalOverflow: card.scrollWidth <= card.clientWidth + 1,
          noVerticalOverflow: card.scrollHeight <= card.clientHeight + 1,
          buttons,
        };
      });

      expect(metrics).not.toBeNull();
      expect(metrics?.noHorizontalOverflow).toBe(true);
      expect(metrics?.noVerticalOverflow).toBe(true);
      for (const btn of metrics?.buttons ?? []) {
        expect(btn.height, `${btn.sel} height`).toBeGreaterThanOrEqual(44);
        expect(btn.inside, `${btn.sel} inside card`).toBe(true);
        if (btn.sel === ".journal-lightbox-prev" || btn.sel === ".journal-lightbox-next") {
          expect(btn.width, `${btn.sel} width`).toBeGreaterThanOrEqual(44);
        }
      }

      await page.evaluate(() => {
        localStorage.removeItem("cloverhollow-postcards");
      });
      expect(errors).toEqual([]);
    },
  );

  test(
    "cycles Lightbox action buttons with ArrowDown/ArrowUp/End/Home on desktop",
    { tag: "@smoke" },
    async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      await page.setViewportSize({ width: 1280, height: 720 });
      await openHarness(page);
      await page.evaluate(() => {
        localStorage.removeItem("cloverhollow-postcards");
      });

      await snapTwoPostcards(page);
      await openPostcardLightbox(page);

      const albumCard = page.locator(".journal-postcards-card");
      const lbBack = albumCard.locator(".journal-lightbox-back");
      const lbSave = albumCard.locator(".journal-lightbox-save");
      const lbRemove = albumCard.locator(".journal-lightbox-remove");
      const lbClose = albumCard.locator(".journal-postcards-close");
      const lbPos = albumCard.locator(".journal-lightbox-pos");

      await expect(lbBack).toBeFocused();
      await expect(lbPos).toHaveText("1 / 2");

      // ArrowRight / ArrowLeft continue stepping postcards cleanly.
      await page.keyboard.press("ArrowRight");
      await expect(lbPos).toHaveText("2 / 2");
      await page.keyboard.press("ArrowLeft");
      await expect(lbPos).toHaveText("1 / 2");

      // ArrowDown steps cleanly across Back -> Save PNG -> Remove -> Close -> Back.
      await page.keyboard.press("ArrowDown");
      await expect(lbSave).toBeFocused();
      await page.keyboard.press("ArrowDown");
      await expect(lbRemove).toBeFocused();
      await page.keyboard.press("ArrowDown");
      await expect(lbClose).toBeFocused();
      await page.keyboard.press("ArrowDown");
      await expect(lbBack).toBeFocused();

      // ArrowUp wraps backwards, End jumps to Close, Home jumps to Back.
      await page.keyboard.press("ArrowUp");
      await expect(lbClose).toBeFocused();
      await page.keyboard.press("Home");
      await expect(lbBack).toBeFocused();
      await page.keyboard.press("End");
      await expect(lbClose).toBeFocused();

      // ArrowUp from Close reaches Remove, and Escape returns cleanly to Album Grid.
      await page.keyboard.press("ArrowUp");
      await expect(lbRemove).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(albumCard).toHaveAttribute("data-album-mode", "grid");

      await page.evaluate(() => {
        localStorage.removeItem("cloverhollow-postcards");
      });
      expect(errors).toEqual([]);
    },
  );
});
