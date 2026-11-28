import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { renderInfo, step } from "./helpers";

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

test.describe("Milestone 164: 13-Keepsake Showcase & 26-Item Living Clubhouse Museum", () => {
  test(
    "renders all 26 Clubhouse treasures, 13/13 Keepsakes Gallery, and Jubilee Ribbon Field Note",
    { tag: "@smoke" },
    async ({ page }, testInfo) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto("./?qa=clubhouse");
      await page.waitForFunction(() => Boolean(window.__cloverhollow));
      await page.evaluate(() => window.__cloverhollow?.pause());
      await step(page, 1);

      await runQaCommands(page, [
        "stickers all",
        "prizes all",
        "fish all",
        "gems all",
        "keepsakes on",
      ]);

      // 1. Verify all 26 Living Clubhouse items (13 prizes + 13 keepsakes) render cleanly.
      const clubInfo = await renderInfo(page);
      expect(clubInfo.area).toBe("clubhouse");
      expect(clubInfo.clubhouseDisplay).toBe(26);
      expect(
        clubInfo.drawOrder.filter((item) => item.label.startsWith("clubhouse:prize:")),
      ).toHaveLength(13);
      expect(
        clubInfo.drawOrder.filter((item) => item.label.startsWith("clubhouse:keepsake:")),
      ).toHaveLength(13);
      for (const label of [
        "clubhouse:keepsake:loft-sketch",
        "clubhouse:keepsake:aurora-rubbing",
        "clubhouse:keepsake:shell-shard",
        "clubhouse:keepsake:festival-ribbon",
      ]) {
        expect(clubInfo.drawOrder.some((item) => item.label === label), label).toBe(true);
      }

      // Enter Photo Mode so the 26-item Clubhouse museum review capture is unobstructed.
      await page.keyboard.press("p");
      await step(page, 2);
      await expect(page.locator("html")).toHaveAttribute("data-photo", "on");
      await captureReview(page, testInfo, "m164-clubhouse-26-items-1280");
      await page.keyboard.press("p");
      await step(page, 1);
      await expect(page.locator("html")).toHaveAttribute("data-photo", "off");

      // 2. Open Journal and inspect the 13/13 Keepsakes Gallery.
      await tapKey(page, "j");
      await expect(page.locator(".journal-book")).toBeVisible();
      await expect(page.locator(".journal-keepsakes-heading")).toContainText("KEEPSAKES");
      await expect(page.locator(".journal-keepsakes-heading")).toContainText("13/13");
      await expect(page.locator(".journal-keepsakes-heading")).toContainText("★ Complete!");

      const keepsakeSlots = page.locator('.journal-keepsakes .journal-slot[data-owned="true"]');
      await expect(keepsakeSlots).toHaveCount(13);
      await expect(page.locator('.journal-keepsakes .journal-slot[data-keepsake="loft-sketch"]'))
        .toContainText("Rocket Doodle & Clover");
      await expect(page.locator('.journal-keepsakes .journal-slot[data-keepsake="aurora-rubbing"]'))
        .toContainText("Alpine Aurora Sketch");
      await expect(page.locator('.journal-keepsakes .journal-slot[data-keepsake="shell-shard"]'))
        .toContainText("Starlight Shell Shard");
      await expect(
        page.locator('.journal-keepsakes .journal-slot[data-keepsake="festival-ribbon"]'),
      ).toContainText("Jubilee Festival Ribbon");

      const svgCheck = await page.evaluate(() => {
        const svgs = [...document.querySelectorAll(".journal-keepsakes svg.journal-keepsake-icon")];
        return {
          count: svgs.length,
          textNodes: svgs.reduce((sum, svg) => sum + svg.querySelectorAll("text").length, 0),
        };
      });
      expect(svgCheck).toEqual({ count: 13, textNodes: 0 });

      // Scroll to the Keepsakes shelf and capture all 13 hand-inked charms.
      await page.locator(".journal-keepsakes-heading").evaluate((heading) => {
        heading.scrollIntoView({ block: "start" });
      });
      await step(page, 2);
      await captureReview(page, testInfo, "m164-journal-13-keepsakes-1280");

      // 3. Click Jubilee Festival Ribbon and verify its Keepsake Field Note Card.
      const ribbonSlot = page.locator(
        '.journal-keepsakes .journal-slot[data-keepsake="festival-ribbon"]',
      );
      await ribbonSlot.scrollIntoViewIfNeeded();
      await ribbonSlot.click();

      const fieldNote = page.locator(".journal-field-note");
      await expect(fieldNote).toBeVisible();
      await expect(fieldNote).toHaveAttribute("data-field-kind", "keepsake");
      await expect(fieldNote.locator(".journal-field-name")).toHaveText("Jubilee Festival Ribbon");
      await expect(fieldNote.locator(".journal-field-sub")).toHaveText("Clubhouse Keepsake");
      await expect(fieldNote.locator(".journal-field-lands")).toHaveText("Sanctuary Festival");
      await expect(fieldNote.locator(".journal-field-calms")).toHaveText("Clubhouse Post");
      await expect(fieldNote.locator(".journal-field-blurb")).toContainText(
        "Wildlife Sanctuary celebration",
      );
      await expect(fieldNote.locator(".journal-field-counter")).toHaveText("13 / 13");

      const cardSvgCheck = await page.evaluate(() => {
        const svgs = [...document.querySelectorAll(".journal-field-charm svg")];
        return {
          count: svgs.length,
          textNodes: svgs.reduce((sum, svg) => sum + svg.querySelectorAll("text").length, 0),
        };
      });
      expect(cardSvgCheck).toEqual({ count: 1, textNodes: 0 });

      // Dismiss Field Note Card, switch to MAP, and check Field Treasures Card 13/13 fit.
      await page.keyboard.press("Escape");
      await step(page, 1);
      await expect(fieldNote).toBeHidden();

      await page.locator(".journal-map-tab").click();
      await expect(page.locator(".journal-book")).toHaveAttribute("data-journal-page", "map");
      await expect(page.locator(".journal-master-crest")).toHaveText("★ 100% Valley Explorer!");
      const treasuresBtn = page.locator(".journal-treasures-btn");
      await expect(treasuresBtn).toHaveText("Treasures · 13/13");
      await treasuresBtn.click();
      await expect(page.locator(".journal-treasures-card")).toBeVisible();
      await expect(page.locator(".journal-keepsake-item.is-unlocked")).toHaveCount(13);

      for (const size of [{ width: 1280, height: 720 }, { width: 874, height: 402 }]) {
        await page.setViewportSize(size);
        await step(page, 1);
        const cardFit = await page.evaluate(() => {
          const modal = document.querySelector<HTMLElement>(".journal-treasures-card");
          if (modal === null) return null;
          const labels = [
            ...modal.querySelectorAll<HTMLElement>(
              ".journal-keepsake-name, .journal-keepsake-detail",
            ),
          ];
          return {
            noHorizontalOverflow: modal.scrollWidth <= modal.clientWidth + 1,
            truncatedLabels: labels
              .filter((el) => el.scrollWidth > el.clientWidth + 1)
              .map((el) => el.textContent ?? ""),
          };
        });
        expect(cardFit, `${size.width}x${size.height} Field Treasures Card`).toEqual({
          noHorizontalOverflow: true,
          truncatedLabels: [],
        });
      }

      expect(errors).toEqual([]);
    },
  );
});
