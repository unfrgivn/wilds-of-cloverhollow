import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";
import { longFlowTimeout, openHarness, readState, resetPaused, step } from "./helpers";

type Rect = { x: number; y: number; width: number; height: number };

function rectsOverlap(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

async function boxIfVisible(locator: Locator): Promise<Rect | null> {
  if (!(await locator.isVisible())) return null;
  return await locator.boundingBox();
}

async function hold(page: Page, key: string, ticks: number): Promise<void> {
  await page.keyboard.down(key);
  await step(page, ticks);
  await page.keyboard.up(key);
}

async function tapKey(page: Page, key: string): Promise<void> {
  await page.keyboard.down(key);
  await step(page, 1);
  await page.keyboard.up(key);
  await step(page, 1);
}

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

test.describe("Milestone 118: Touch Photo Controls & Golden Chef Microwave Records", () => {
  test.setTimeout(longFlowTimeout);

  test(
    "Touch Photo Mode bar hides outside Photo Mode, snaps clean postcard, and exits cleanly",
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
        await openHarness(page);
        await resetPaused(page, "plaza");

        const bar = page.locator(".photo-touch-bar");
        const snapBtn = page.locator(".photo-touch-snap");
        const closeBtn = page.locator(".photo-touch-close");
        const touchControls = page.locator(".touch-controls");

        await expect(page.locator("html")).toHaveAttribute("data-touch", "on");
        await expect(page.locator("html")).toHaveAttribute("data-photo", "off");
        await expect(bar).toBeHidden();
        await expect(touchControls).toBeVisible();

        // Enter Photo Mode: regular touch chrome hides and .photo-touch-bar appears.
        await page.evaluate(() => window.__cloverhollow?.settings.setPhotoMode(true));
        await step(page, 1);
        await expect(page.locator("html")).toHaveAttribute("data-photo", "on");
        await expect(touchControls).toBeHidden();
        await expect(bar).toBeVisible();
        await expect(bar).toHaveAttribute("role", "group");
        await expect(bar).toHaveAttribute("aria-label", "Photo mode controls");
        await expect(snapBtn).toBeVisible();
        await expect(snapBtn).toHaveAttribute("aria-label", "Snap postcard");
        await expect(closeBtn).toBeVisible();
        await expect(closeBtn).toHaveAttribute("aria-label", "Exit photo mode");
        await expect(closeBtn).toHaveText("×");

        // Crisp hand-inked SVG camera icon with zero <text> nodes.
        await expect(snapBtn.locator("svg")).toHaveCount(1);
        await expect(snapBtn.locator("svg text")).toHaveCount(0);

        // Verify >= 44x44 px hit targets fully inside 874x402 viewport and non-overlapping.
        const snapBox = await snapBtn.boundingBox();
        const closeBox = await closeBtn.boundingBox();
        expect(snapBox).not.toBeNull();
        expect(closeBox).not.toBeNull();
        if (snapBox !== null && closeBox !== null) {
          for (const box of [snapBox, closeBox]) {
            expect(box.width).toBeGreaterThanOrEqual(44);
            expect(box.height).toBeGreaterThanOrEqual(44);
            expect(box.x).toBeGreaterThanOrEqual(0);
            expect(box.y).toBeGreaterThanOrEqual(0);
            expect(box.x + box.width).toBeLessThanOrEqual(874.5);
            expect(box.y + box.height).toBeLessThanOrEqual(402.5);
          }
          expect(rectsOverlap(snapBox, closeBox)).toBe(false);
        }

        // Capture touch Photo Mode review screenshot cleanly before tapping shutter.
        await captureReview(page, testInfo, "m118-touch-photo-874");

        // Tap .photo-touch-snap: shutter fires (data-shutter-count="1").
        await snapBtn.tap();
        await expect(page.locator(".photo-shutter-flash")).toHaveAttribute(
          "data-shutter-count",
          "1",
        );

        // Verify Postcard capture extracts Pixi WebGL stage without DOM chrome.
        const capture = await page.evaluate(() =>
          window.__cloverhollow?.settings.snapPostcard({ download: false }) ?? null,
        );
        expect(capture).not.toBeNull();
        expect(capture?.filename).toBe("cloverhollow-postcard-plaza.png");
        expect(capture?.dataUrl.startsWith("data:image/png;base64,")).toBe(true);
        const barOutsideCanvas = await page.evaluate(() => {
          const canvas = document.querySelector("#app canvas");
          const touchBar = document.querySelector(".photo-touch-bar");
          return canvas !== null && touchBar !== null && !canvas.contains(touchBar);
        });
        expect(barOutsideCanvas).toBe(true);

        // Tap .photo-touch-close: Photo Mode exits cleanly.
        await closeBtn.tap();
        await step(page, 1);
        await expect(page.locator("html")).toHaveAttribute("data-photo", "off");
        await expect(bar).toBeHidden();
        await expect(touchControls).toBeVisible();
        expect(errors).toEqual([]);
      } finally {
        await context.close();
      }
    },
  );

  test(
    "Clubhouse Microwave spawns ★ GOLDEN! popup, shows NEW BEST! 1, and persists across reload",
    { tag: "@smoke" },
    async ({ page }, testInfo) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto("./?qa=kitchen");
      await page.waitForFunction(() => Boolean(window.__cloverhollow));
      await page.evaluate(() => {
        localStorage.removeItem("CapacitorStorage.cloverhollow-records");
        window.__cloverhollow?.pause();
      });
      await page.reload();
      await page.waitForFunction(() => Boolean(window.__cloverhollow));
      await page.evaluate(() => window.__cloverhollow?.pause());
      await step(page, 1);

      // Desktop Photo Mode must NEVER reveal .photo-touch-bar.
      await page.keyboard.press("p");
      await step(page, 1);
      await expect(page.locator("html")).toHaveAttribute("data-photo", "on");
      await expect(page.locator(".photo-touch-bar")).toBeHidden();
      await page.keyboard.press("Escape");
      await step(page, 1);
      await expect(page.locator("html")).toHaveAttribute("data-photo", "off");

      // Walk to the clubhouse fridge/microwave at (585, 390) from (687, 493).
      await page.keyboard.down("ArrowLeft");
      await page.keyboard.down("ArrowUp");
      await step(page, 20);
      await page.keyboard.up("ArrowUp");
      await step(page, 10);
      await page.keyboard.up("ArrowLeft");
      await hold(page, "ArrowUp", 1);
      await step(page, 1);
      await expect(page.locator(".sticker-prompt")).toBeVisible();

      // Open the microwave via real Enter presses through the dialogue prompt.
      for (let count = 0; count < 20; count += 1) {
        const current = await readState(page);
        if (current.arcade?.game === "cook") break;
        await tapKey(page, "Enter");
      }
      const opened = await readState(page);
      expect(opened.arcade?.game).toBe("cook");
      await expect(page.locator(".cook-overlay .arcade-popup")).toHaveCount(0);
      await expect(page.locator(".cook-overlay .arcade-best-badge")).toBeHidden();

      // Hold Enter for 120 ticks (60s = exact golden target for Dino nuggets), then release.
      await hold(page, "Enter", 120);
      // Step through the ding into result so the popup spawns live.
      let sawPopup = false;
      for (let count = 0; count < 60; count += 1) {
        await step(page, 1);
        const snap = await readState(page);
        if (snap.arcade?.game === "cook" && snap.arcade.phase === "result") {
          const popup = page.locator(".cook-overlay .arcade-popup.is-rare").first();
          await expect(popup).toBeVisible();
          await expect(popup).toHaveText("★ GOLDEN!");
          sawPopup = true;
          break;
        }
      }
      expect(sawPopup).toBe(true);

      // Finish typing the result line while the popup is still live or check badge clearance.
      await tapKey(page, "Enter");

      const badge = page.locator(".cook-overlay .arcade-best-badge");
      await expect(badge).toBeVisible();
      await expect(badge).toHaveText("★ NEW BEST! 1");
      await expect(badge).toHaveClass(/is-new-best/);

      // Verify badge and popup sit cleanly clear of glass, display, button, and dialogue.
      const badgeBox = await boxIfVisible(badge);
      expect(badgeBox).not.toBeNull();
      const obstacles = [
        [".cook-glass", page.locator(".cook-glass")],
        [".cook-display", page.locator(".cook-display")],
        [".cook-button", page.locator(".cook-button")],
        [".sticker-dialogue", page.locator(".sticker-dialogue")],
      ] as const;
      if (badgeBox !== null) {
        for (const [label, loc] of obstacles) {
          const other = await boxIfVisible(loc);
          if (other === null) continue;
          expect(rectsOverlap(badgeBox, other), `badge must not overlap ${label}`).toBe(false);
        }
      }

      const livePopupBox = await boxIfVisible(page.locator(".cook-overlay .arcade-popup").first());
      if (livePopupBox !== null && badgeBox !== null) {
        expect(rectsOverlap(livePopupBox, badgeBox), "popup must not overlap badge").toBe(false);
      }
      if (livePopupBox !== null) {
        for (const [label, loc] of [
          [".cook-display", page.locator(".cook-display")],
          [".cook-button", page.locator(".cook-button")],
          [".sticker-dialogue", page.locator(".sticker-dialogue")],
        ] as const) {
          const other = await boxIfVisible(loc);
          if (other === null) continue;
          expect(rectsOverlap(livePopupBox, other), `popup must not overlap ${label}`).toBe(false);
        }
      }

      await captureReview(page, testInfo, "m118-cook-golden-1280");

      // Dismiss microwave result and verify cook record persists across reload & Journal strip.
      await tapKey(page, "Enter");
      await expect
        .poll(() => page.evaluate(() => window.__cloverhollow?.settings.minigameRecords().cook))
        .toBe(1);

      await page.reload();
      await page.waitForFunction(() => Boolean(window.__cloverhollow));
      await page.evaluate(() => window.__cloverhollow?.pause());
      await expect
        .poll(() => page.evaluate(() => window.__cloverhollow?.settings.minigameRecords().cook))
        .toBe(1);

      await tapKey(page, "j");
      const cookPill = page.locator('.journal-records-strip [data-record="cook"]');
      await expect(cookPill).toBeVisible();
      await expect(cookPill).toHaveText("★ Golden Dishes · 1");

      await page.evaluate(() => {
        localStorage.removeItem("CapacitorStorage.cloverhollow-records");
      });
      expect(errors).toEqual([]);
    },
  );
});
