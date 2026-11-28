import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { longFlowTimeout, openHarness, resetPaused, step } from "./helpers";

async function tapKey(page: Page, key: string): Promise<void> {
  await page.keyboard.down(key);
  await step(page, 1);
  await page.keyboard.up(key);
  await step(page, 2);
}

async function settleAnimations(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await Promise.all(
      document.getAnimations().map((animation) => animation.finished.catch(() => undefined)),
    );
  });
}

async function captureReview(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  if (process.env.CLOVERHOLLOW_REVIEW_SHOTS !== "1" || testInfo.project.name !== "chromium") {
    return;
  }
  await page.screenshot({
    path: `art/review/${name}.jpg`,
    type: "jpeg",
    quality: 90,
  });
}

async function setStarGems(page: Page, gemFlags: Record<string, boolean>): Promise<void> {
  const backup = await page.evaluate((flags) => {
    const raw = window.__cloverhollow?.save.exportBackup?.();
    if (raw === undefined) return null;
    const isObj = (v: unknown): v is Record<string, unknown> =>
      typeof v === "object" && v !== null && !Array.isArray(v);
    const env: unknown = JSON.parse(raw);
    if (!isObj(env) || typeof env.save !== "string") return null;
    const payload: unknown = JSON.parse(env.save);
    if (!isObj(payload) || !isObj(payload.state)) return null;
    const st = payload.state;
    if (typeof st.ink !== "string") return null;
    const inkObj: unknown = JSON.parse(st.ink);
    if (!isObj(inkObj) || !isObj(inkObj.variablesState)) return null;
    for (const [key, value] of Object.entries(flags)) {
      inkObj.variablesState[key] = value;
    }
    st.ink = JSON.stringify(inkObj);
    return JSON.stringify(payload);
  }, gemFlags);
  expect(backup).not.toBeNull();
  const imported = await page.evaluate(async (saveJson) => {
    const hook = window.__cloverhollow;
    if (hook?.save.importBackup === undefined || saveJson === null) return false;
    return hook.save.importBackup(saveJson);
  }, backup);
  expect(imported).toBe(true);
  await step(page, 2);
}

test.describe("Milestone 171: Interactive Star Gem Field Ledger", () => {
  test.setTimeout(longFlowTimeout);

  test(
    "partial 3/7 ledger shows found gems & Barnaby hints, restores focus, and fits 7/7 on phone",
    { tag: "@smoke" },
    async ({ page }, testInfo) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      await page.setViewportSize({ width: 1280, height: 720 });
      await openHarness(page);
      await resetPaused(page, "plaza");

      await setStarGems(page, {
        gem_park: true,
        gem_bay: true,
        gem_trail: false,
        gem_pass: true,
        gem_cavern: false,
        gem_woods: false,
        gem_hills: false,
      });

      await tapKey(page, "j");
      const book = page.locator(".journal-book");
      await expect(book).toBeVisible();

      const gemsPill = page.locator("button.journal-supply.journal-gems");
      await expect(gemsPill).toBeVisible();
      await expect(gemsPill).toContainText("Gems 3/7");
      await expect(gemsPill).toHaveAttribute(
        "aria-label",
        "Inspect Star Gem Ledger, 3 of 7 found",
      );

      await gemsPill.click();
      const overlay = page.locator(".journal-gems-overlay");
      const card = page.locator(".journal-gems-card");
      await expect(overlay).toBeVisible();
      await expect(card).toBeFocused();
      await settleAnimations(page);
      await expect(card.locator(".journal-gems-title")).toHaveText("STAR GEM LEDGER");
      await expect(card.locator(".journal-gems-count")).toHaveText("3/7");
      await expect(card.locator(".journal-gems-count")).not.toHaveClass(/is-complete/);

      const foundTiles = card.locator(".journal-gem-tile.is-found");
      const missingTiles = card.locator(".journal-gem-tile.is-missing");
      await expect(foundTiles).toHaveCount(3);
      await expect(missingTiles).toHaveCount(4);

      await expect(card.locator('.journal-gem-tile[data-gem="gem_park"]')).toContainText(
        "Amethyst Star Gem",
      );
      await expect(card.locator('.journal-gem-tile[data-gem="gem_bay"]')).toContainText(
        "Aqua Star Gem",
      );
      await expect(card.locator('.journal-gem-tile[data-gem="gem_pass"]')).toContainText(
        "Frost Star Gem",
      );
      await expect(card.locator('.journal-gem-tile[data-gem="gem_trail"]')).toContainText(
        "Undiscovered · Cliffside Trail",
      );
      await expect(card.locator('.journal-gem-tile[data-gem="gem_cavern"]')).toContainText(
        "blacklight lantern on the east crystal grotto floor",
      );
      await expect(card.locator('.journal-gem-tile[data-gem="gem_woods"]')).toContainText(
        "Acorn Squirrel",
      );
      await expect(card.locator('.journal-gem-tile[data-gem="gem_hills"]')).toContainText(
        "clover burrow by the boulders",
      );
      await expect(card.locator(".journal-gems-footer")).toHaveText(
        "Bring all 7 Star Gems to Grandpa Barnaby at the Mountain Lodge!",
      );

      const desktopCheck = await page.evaluate(() => {
        const bookEl = document.querySelector<HTMLElement>(".journal-book");
        const cardEl = document.querySelector<HTMLElement>(".journal-gems-card");
        const closeEl = document.querySelector<HTMLElement>(".journal-gems-close");
        const svgs = [...document.querySelectorAll(".journal-gems-overlay svg")];
        const tiles = [...document.querySelectorAll<HTMLElement>(".journal-gem-tile")];
        if (bookEl === null || cardEl === null || closeEl === null) return null;
        const bookRect = bookEl.getBoundingClientRect();
        const cardRect = cardEl.getBoundingClientRect();
        const closeRect = closeEl.getBoundingClientRect();
        return {
          svgCount: svgs.length,
          svgTextNodes: svgs.reduce((sum, node) => sum + node.querySelectorAll("text").length, 0),
          insideBook:
            cardRect.left >= bookRect.left - 1 &&
            cardRect.right <= bookRect.right + 1 &&
            cardRect.top >= bookRect.top - 1 &&
            cardRect.bottom <= bookRect.bottom + 1,
          noHorizontalOverflow: cardEl.scrollWidth <= cardEl.clientWidth + 1,
          noVerticalOverflow: cardEl.scrollHeight <= cardEl.clientHeight + 1,
          closeSize: Math.round(Math.min(closeRect.width, closeRect.height)),
          allTilesInsideX: tiles.every((tile) => {
            const rect = tile.getBoundingClientRect();
            return rect.left >= cardRect.left - 1 && rect.right <= cardRect.right + 1;
          }),
        };
      });
      expect(desktopCheck).toEqual({
        svgCount: 8,
        svgTextNodes: 0,
        insideBook: true,
        noHorizontalOverflow: true,
        noVerticalOverflow: true,
        closeSize: 44,
        allTilesInsideX: true,
      });

      await captureReview(page, testInfo, "m171-gems-ledger-1280");

      // Escape closes ONLY the ledger and restores focus directly to .journal-gems.
      await page.keyboard.press("Escape");
      await step(page, 1);
      await expect(overlay).toBeHidden();
      await expect(book).toBeVisible();
      await expect(gemsPill).toBeFocused();

      // Re-open via keyboard Enter and dismiss via X key without closing Journal.
      await page.keyboard.press("Enter");
      await step(page, 1);
      await expect(overlay).toBeVisible();
      await tapKey(page, "x");
      await expect(overlay).toBeHidden();
      await expect(book).toBeVisible();
      await expect(gemsPill).toBeFocused();

      // Complete 7/7 Star Gems on 874x402 phone viewport.
      await tapKey(page, "j");
      await expect(book).toBeHidden();

      await setStarGems(page, {
        gem_park: true,
        gem_bay: true,
        gem_trail: true,
        gem_pass: true,
        gem_cavern: true,
        gem_woods: true,
        gem_hills: true,
      });

      await page.setViewportSize({ width: 874, height: 402 });
      await step(page, 1);
      await tapKey(page, "j");
      await expect(book).toBeVisible();
      await expect(gemsPill).toContainText("Gems 7/7");

      await gemsPill.click();
      await expect(overlay).toBeVisible();
      await settleAnimations(page);
      await expect(card.locator(".journal-gems-count")).toHaveText("★ 7/7 COMPLETE!");
      await expect(card.locator(".journal-gems-count")).toHaveClass(/is-complete/);
      await expect(card.locator(".journal-gem-tile.is-found")).toHaveCount(7);
      await expect(card.locator(".journal-gem-tile.is-missing")).toHaveCount(0);
      await expect(card.locator(".journal-gems-footer")).toHaveText(
        "★ All 7 Valley Star Gems found — Grandpa Barnaby's Rainbow Geode shines!",
      );

      const phoneCheck = await page.evaluate(() => {
        const bookEl = document.querySelector<HTMLElement>(".journal-book");
        const cardEl = document.querySelector<HTMLElement>(".journal-gems-card");
        const tiles = [...document.querySelectorAll<HTMLElement>(".journal-gem-tile")];
        if (bookEl === null || cardEl === null) return null;
        const bookRect = bookEl.getBoundingClientRect();
        const cardRect = cardEl.getBoundingClientRect();
        return {
          insideBook:
            cardRect.left >= bookRect.left - 1 &&
            cardRect.right <= bookRect.right + 1 &&
            cardRect.top >= bookRect.top - 1 &&
            cardRect.bottom <= bookRect.bottom + 1,
          noHorizontalOverflow: cardEl.scrollWidth <= cardEl.clientWidth + 1,
          allTilesInsideViewport: tiles.every((tile) => {
            const rect = tile.getBoundingClientRect();
            return (
              rect.left >= cardRect.left - 1 &&
              rect.right <= cardRect.right + 1 &&
              rect.top >= 0 &&
              rect.bottom <= window.innerHeight + 1
            );
          }),
        };
      });
      expect(phoneCheck).toEqual({
        insideBook: true,
        noHorizontalOverflow: true,
        allTilesInsideViewport: true,
      });

      await captureReview(page, testInfo, "m171-gems-ledger-874");

      await card.locator(".journal-gems-close").click();
      await expect(overlay).toBeHidden();
      await expect(gemsPill).toBeFocused();
      expect(errors).toEqual([]);
    },
  );
});
