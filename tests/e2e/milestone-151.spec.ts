import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { longFlowTimeout, openHarness, readState, resetPaused, step, walk } from "./helpers";

async function tapKey(page: Page, key: string): Promise<void> {
  await page.keyboard.down(key);
  await step(page, 1);
  await page.keyboard.up(key);
  await step(page, 2);
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

test.describe("Milestone 151: Desktop Photo Mode Pointer Controls & Baker Portrait", () => {
  test.setTimeout(longFlowTimeout);

  test(
    "Desktop Photo Mode hides touch bar, left-click snaps postcard, and right-click exits",
    { tag: "@smoke" },
    async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      await page.setViewportSize({ width: 1280, height: 720 });
      await openHarness(page);
      await resetPaused(page, "plaza");
      await page.evaluate(() => window.__cloverhollow?.settings.setKeyHints(true));
      await step(page, 2);

      // Click the desktop "P Photo" HUD hint pill to enter Photo Mode cleanly.
      const photoPill = page.locator('.hud-hint[data-hint="photo"]');
      await expect(photoPill).toBeVisible();
      await photoPill.click();
      await step(page, 1);

      await expect(page.locator("html")).toHaveAttribute("data-photo", "on");
      await expect(page.locator(".photo-touch-bar")).toBeHidden();
      // Clicking the P Photo hint pill must not fire an accidental shutter snap.
      await expect(page.locator(".photo-shutter-flash")).toHaveAttribute(
        "data-shutter-count",
        "0",
      );
      await expect
        .poll(() => page.evaluate(() => window.__cloverhollow?.sound.state()))
        .toBe("running");

      // Left-click the canvas -> shutter flash triggers & camera-shutter sound plays.
      const canvas = page.locator("#app canvas");
      await canvas.click({ position: { x: 640, y: 360 } });
      await expect(page.locator(".photo-shutter-flash")).toHaveAttribute(
        "data-shutter-count",
        "1",
      );
      const effects = await page.evaluate(
        () => window.__cloverhollow?.sound.effects() ?? [],
      );
      expect(effects).toContain("camera-shutter");

      // Right-click the canvas -> exits Photo Mode cleanly without browser menu.
      await canvas.click({ button: "right", position: { x: 640, y: 360 } });
      await step(page, 1);
      await expect(page.locator("html")).toHaveAttribute("data-photo", "off");
      expect(errors).toEqual([]);
    },
  );

  test(
    "Plaza Bakery window displays Baker bust portrait without re-popping at line end",
    { tag: "@smoke" },
    async ({ page }, testInfo) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      await page.setViewportSize({ width: 1280, height: 720 });
      await openHarness(page);
      await resetPaused(page, "plaza");
      await step(page, 2);

      // Walk north from the plaza fountain spawn right up to the Bakery window.
      await walk(page, "y", 435);
      await tapKey(page, "Enter");

      const dialogue = page.locator(".sticker-dialogue");
      const speaker = page.locator(".sticker-speaker");
      const portrait = page.locator(".sticker-portrait");
      const portraitImg = page.locator(".sticker-portrait-img");
      await expect(dialogue).toBeVisible();
      await expect(speaker).toHaveText("Baker");

      // Let the line finish revealing and the on-demand Chef Bea atlas decode.
      for (let tick = 0; tick < 120; tick += 4) {
        const state = await readState(page);
        const done =
          state.dialogue !== null && state.dialogue.revealed >= state.dialogue.text.length;
        const hasPortrait = await portrait.isVisible();
        if (done && hasPortrait) break;
        await step(page, 4);
      }

      await expect(portrait).toBeVisible();
      await expect(dialogue).toHaveClass(/has-portrait/);
      await expect(portrait).not.toHaveClass(/is-talking/);

      const bgImage = await portraitImg.evaluate(
        (node) => getComputedStyle(node).backgroundImage,
      );
      expect(bgImage).toContain("assets/characters/chef/");

      await captureReview(page, testInfo, "m151-bakery-portrait");
      expect(errors).toEqual([]);
    },
  );
});
