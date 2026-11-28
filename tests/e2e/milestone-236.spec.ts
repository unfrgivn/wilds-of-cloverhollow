import { expect, test, type Page, type TestInfo } from "@playwright/test";
import {
  longFlowTimeout,
  openHarness,
  queueScript,
  readState,
  recording,
  resetPaused,
  step,
} from "./helpers";

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

test.describe("Milestone 234: Postcard Scrapbook Album & Ending Credits Keepsake Postcard", () => {
  test.setTimeout(longFlowTimeout);

  test(
    "collects snaps in Postcard Album, previews/removes, and saves Credits keepsake",
    { tag: "@smoke" },
    async ({ page }, testInfo) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      await page.setViewportSize({ width: 1280, height: 720 });
      await openHarness(page);
      await page.evaluate(() => {
        localStorage.removeItem("cloverhollow-postcards");
        localStorage.removeItem("CapacitorStorage.cloverhollow-weather");
        localStorage.removeItem("cloverhollow:weather-mode");
      });

      // 1. Snap a Rainbow Sunshower postcard in Town Plaza.
      await resetPaused(page, "plaza");
      await step(page, 2);
      await page.keyboard.press("p");
      await step(page, 1);
      await expect(page.locator("html")).toHaveAttribute("data-photo", "on");

      await page.keyboard.press("w");
      await step(page, 2);
      await expect(page.locator(".photo-toast")).toHaveText("Sky · Rainbow Sunshower");

      await page.keyboard.press("Space");
      await expect(page.locator(".photo-shutter-flash")).toHaveAttribute("data-shutter-count", "1");
      await expect(page.locator(".photo-toast")).toContainText(
        "Postcard saved · Town plaza · Rainbow Sunshower",
      );
      await page.keyboard.press("Escape");
      await step(page, 1);
      await expect(page.locator("html")).toHaveAttribute("data-photo", "off");

      // 2. Visit Bubblegum Bay and snap a second postcard.
      await resetPaused(page, "bay");
      await step(page, 2);
      await page.keyboard.press("p");
      await step(page, 1);
      await expect(page.locator("html")).toHaveAttribute("data-photo", "on");

      await page.keyboard.press("Space");
      await expect(page.locator(".photo-shutter-flash")).toHaveAttribute("data-shutter-count", "2");
      await expect(page.locator(".photo-toast")).toContainText("Postcard saved · Bubblegum Bay");
      await page.keyboard.press("Escape");
      await step(page, 1);
      await expect(page.locator("html")).toHaveAttribute("data-photo", "off");

      // Unlock keepsakes so Field Treasures opens cleanly on MAP.
      await runQaCommands(page, ["keepsakes on"]);

      // 3. Open Journal -> MAP -> Treasures -> Postcard Album ("Photos · 2").
      await tapKey(page, "j");
      await expect(page.locator(".journal-book")).toBeVisible();
      await page.locator(".journal-map-tab").click();
      await expect(page.locator(".journal-book")).toHaveAttribute("data-journal-page", "map");

      await page.locator(".journal-treasures-btn").click();
      const treasuresCard = page.locator(".journal-treasures-card");
      await expect(treasuresCard).toBeVisible();

      const photosBtn = page.locator(".journal-postcards-btn");
      await expect(photosBtn).toBeVisible();
      await expect(photosBtn).toHaveText("📷 Photos · 2");
      await photosBtn.click();

      const albumCard = page.locator(".journal-postcards-card");
      await expect(albumCard).toBeVisible();
      await expect(albumCard).toHaveAttribute("data-album-mode", "grid");
      await expect(albumCard).toHaveAttribute("data-album-count", "2");
      await expect(albumCard.locator(".journal-postcards-count")).toHaveText("2/6");

      const tiles = albumCard.locator(".journal-postcard-tile");
      await expect(tiles).toHaveCount(2);
      await expect(tiles.nth(0)).toContainText("Bubblegum Bay");
      await expect(tiles.nth(1)).toContainText("Town plaza");

      const albumAudit = await page.evaluate(() => {
        const card = document.querySelector<HTMLElement>(".journal-postcards-card");
        const grid = document.querySelector<HTMLElement>(".journal-postcards-grid");
        const imgs = [...document.querySelectorAll<HTMLImageElement>(".journal-postcard-thumb")];
        const svgs = [...document.querySelectorAll(".journal-postcards-card svg")];
        if (card === null || grid === null) return null;
        return {
          imgCount: imgs.length,
          allDecoded: imgs.every((img) => img.complete && img.naturalWidth > 100),
          svgTextNodes: svgs.reduce((sum, svg) => sum + svg.querySelectorAll("text").length, 0),
          cardNoHorizontalOverflow: card.scrollWidth <= card.clientWidth + 1,
          gridNoHorizontalOverflow: grid.scrollWidth <= grid.clientWidth + 1,
        };
      });
      expect(albumAudit).toEqual({
        imgCount: 2,
        allDecoded: true,
        svgTextNodes: 0,
        cardNoHorizontalOverflow: true,
        gridNoHorizontalOverflow: true,
      });

      await captureReview(page, testInfo, "m234-postcard-album-1280");

      // 4. Open Lightbox on the first postcard and inspect compact phone fit (874x402).
      await tiles.nth(0).click();
      await expect(albumCard).toHaveAttribute("data-album-mode", "lightbox");
      await expect(albumCard.locator(".journal-lightbox-img")).toBeVisible();
      await expect(albumCard.locator(".journal-lightbox-caption")).toContainText("Bubblegum Bay");
      await expect(albumCard.locator(".journal-lightbox-save")).toBeVisible();
      await expect(albumCard.locator(".journal-lightbox-remove")).toBeVisible();

      await page.setViewportSize({ width: 874, height: 402 });
      await step(page, 2);
      const lightboxFit = await page.evaluate(() => {
        const card = document.querySelector<HTMLElement>(".journal-postcards-card");
        const img = document.querySelector<HTMLImageElement>(".journal-lightbox-img");
        const saveBtn = document.querySelector<HTMLElement>(".journal-lightbox-save");
        const removeBtn = document.querySelector<HTMLElement>(".journal-lightbox-remove");
        if (card === null || img === null || saveBtn === null || removeBtn === null) return null;
        const cardRect = card.getBoundingClientRect();
        const saveRect = saveBtn.getBoundingClientRect();
        const removeRect = removeBtn.getBoundingClientRect();
        return {
          noHorizontalOverflow: card.scrollWidth <= card.clientWidth + 1,
          imgReady: img.complete && img.naturalWidth > 100,
          buttonsInside:
            saveRect.right <= cardRect.right + 1 &&
            saveRect.bottom <= cardRect.bottom + 1 &&
            removeRect.right <= cardRect.right + 1 &&
            removeRect.bottom <= cardRect.bottom + 1,
        };
      });
      expect(lightboxFit).toEqual({
        noHorizontalOverflow: true,
        imgReady: true,
        buttonsInside: true,
      });
      await captureReview(page, testInfo, "m234-postcard-lightbox-874");

      // 5. Click Remove -> count updates 2 -> 1, Escape restores Field Treasures & focus.
      await albumCard.locator(".journal-lightbox-remove").click();
      await expect(albumCard).toHaveAttribute("data-album-mode", "grid");
      await expect(albumCard).toHaveAttribute("data-album-count", "1");
      await expect(albumCard.locator(".journal-postcards-count")).toHaveText("1/6");
      await expect(albumCard.locator(".journal-postcard-tile")).toHaveCount(1);

      await page.keyboard.press("Escape");
      await step(page, 1);
      await expect(albumCard).toBeHidden();
      await expect(treasuresCard).toBeVisible();
      await expect(photosBtn).toHaveText("📷 Photos · 1");
      await expect(photosBtn).toBeFocused();

      // 6. Open Ending Credits, press P to save commemorative keepsake without closing Credits.
      await page.setViewportSize({ width: 1280, height: 720 });
      const endingScript = recording("tests/sim/scripts/new-game/golden-ending.json");
      const totalTicks = endingScript.reduce((total, segment) => total + segment.ticks, 0);
      await resetPaused(page, "new-game");
      await queueScript(page, endingScript);
      await step(page, totalTicks);

      const credits = page.locator(".credits-screen");
      await expect(credits).toBeVisible();
      await expect(credits).toHaveAttribute("data-stickers", "ready");
      expect((await readState(page)).finale).toBe("credits");

      const postcardFigure = credits.locator("figure.credits-postcard");
      await expect(postcardFigure).toHaveAttribute("role", "button");
      await expect(postcardFigure).toHaveAttribute("tabindex", "0");

      await page.keyboard.press("p");
      await expect(credits).toBeVisible();
      await expect(page.locator(".photo-toast")).toBeVisible();
      await expect(page.locator(".photo-toast")).toHaveText("Keepsake postcard saved!");

      const stored = await page.evaluate(() => {
        const raw = localStorage.getItem("cloverhollow-postcards");
        if (raw === null) return [];
        const parsed: unknown = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      });
      expect(stored.length).toBe(2);
      expect(stored[0]).toMatchObject({
        filename: "cloverhollow-keepsake-ending.png",
        caption: "Wilds of Cloverhollow",
      });

      // Clicking figure.credits-postcard directly also saves without closing Credits.
      await postcardFigure.click();
      await expect(credits).toBeVisible();
      await expect(page.locator(".photo-toast")).toHaveText("Keepsake postcard saved!");

      // Clean up localStorage & weather cleanly.
      await page.evaluate(() => {
        localStorage.removeItem("cloverhollow-postcards");
        localStorage.removeItem("CapacitorStorage.cloverhollow-weather");
        localStorage.removeItem("cloverhollow:weather-mode");
      });
      expect(errors).toEqual([]);
    },
  );
});
