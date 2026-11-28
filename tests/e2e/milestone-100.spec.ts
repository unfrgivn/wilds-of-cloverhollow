import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { serializeSave } from "../../src/core";
import { openHarness, readState, resetPaused, step } from "./helpers";

async function hold(page: Page, key: string, ticks: number): Promise<void> {
  await page.keyboard.down(key);
  await step(page, ticks);
  await page.keyboard.up(key);
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
    animations: "disabled",
  });
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
  await step(page, 1);
}

test(
  "Journal OPTIONS Text Speed & Reduced Motion work live, persist, and fit cleanly",
  { tag: "@smoke" },
  async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await openHarness(page);
    await resetPaused(page, "new-game");

    // Open Journal -> OPTIONS with real keys.
    await page.keyboard.press("j");
    await step(page, 2);
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await expect(page.locator(".journal-book")).toHaveAttribute("data-journal-page", "options");

    const textSpeedBtn = page.locator(".journal-option-text-speed");
    const reducedMotionBtn = page.locator(".journal-option-reduced-motion");
    await expect(textSpeedBtn).toHaveText("Cozy");
    await expect(reducedMotionBtn).toHaveText("off");
    await expect(reducedMotionBtn).toHaveAttribute("aria-pressed", "false");
    await expect(page.locator("html")).toHaveAttribute("data-reduced-motion", "off");

    // Verify zero overflow / clipping & >= 44px targets at 1280x720, 874x402, and 667x375.
    const viewports = [
      { width: 1280, height: 720, shot: "m93-options-1280" },
      { width: 874, height: 402, shot: "m93-options-874" },
      { width: 667, height: 375, shot: null },
    ] as const;
    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await step(page, 1);
      const geom = await page.evaluate(() => {
        const playPage = document.querySelector<HTMLElement>(".journal-options-play-page");
        const close = document.querySelector(".journal-close")?.getBoundingClientRect();
        const tabs = [...document.querySelectorAll(".journal-tab")].map((node) =>
          node.getBoundingClientRect(),
        );
        const rows = [
          ...document.querySelectorAll(
            ".journal-options-play-page .journal-opt-row, .journal-controls-card",
          ),
        ].map((node) => node.getBoundingClientRect());
        const buttons = [
          ...document.querySelectorAll(".journal-options-play-page .journal-opt-toggle"),
        ].map((node) => node.getBoundingClientRect());
        if (!playPage || !close) return null;
        const pageRect = playPage.getBoundingClientRect();
        const intersects = (a: DOMRect, b: DOMRect): boolean =>
          a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
        return {
          rowCount: rows.length,
          buttonCount: buttons.length,
          touchSized: buttons.every((rect) => rect.width >= 44 && rect.height >= 44),
          noScroll: playPage.scrollHeight <= playPage.clientHeight + 1,
          inside: rows.every(
            (rect) =>
              rect.left >= pageRect.left - 1 &&
              rect.right <= pageRect.right + 1 &&
              rect.top >= pageRect.top - 1 &&
              rect.bottom <= pageRect.bottom + 1,
          ),
          clearOfChrome: rows.every(
            (rect) => !intersects(rect, close) && tabs.every((tab) => !intersects(rect, tab)),
          ),
        };
      });
      expect(geom, `${vp.width}x${vp.height} OPTIONS play page geometry`).toEqual({
        rowCount: 5,
        buttonCount: 4,
        touchSized: true,
        noScroll: true,
        inside: true,
        clearOfChrome: true,
      });
      if (vp.shot !== null) await captureReview(page, testInfo, vp.shot);
    }
    await page.setViewportSize({ width: 1280, height: 720 });
    await step(page, 1);

    // Cycle Text Speed: Cozy -> Brisk -> Instant, and toggle Reduced Motion Off -> On.
    await textSpeedBtn.click();
    await expect(textSpeedBtn).toHaveText("Brisk");
    await textSpeedBtn.click();
    await expect(textSpeedBtn).toHaveText("Instant");
    await expect
      .poll(() => page.evaluate(() => window.__cloverhollow?.settings.textSpeed()))
      .toBe("instant");

    await reducedMotionBtn.click();
    await expect(reducedMotionBtn).toHaveText("on");
    await expect(reducedMotionBtn).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("html")).toHaveAttribute("data-reduced-motion", "on");
    await expect
      .poll(() => page.evaluate(() => window.__cloverhollow?.settings.reducedMotion()))
      .toBe(true);

    // Close Journal, walk to bedroom window with real keys, press Z -> instant full reveal!
    await page.keyboard.press("j");
    await step(page, 2);
    await expect(page.locator(".journal-book")).toBeHidden();
    await hold(page, "ArrowRight", 28);
    await hold(page, "ArrowUp", 18);
    await page.keyboard.down("z");
    await step(page, 1);
    await page.keyboard.up("z");
    const dialogue = (await readState(page)).dialogue;
    expect(dialogue).not.toBeNull();
    expect(dialogue?.text.length ?? 0).toBeGreaterThan(10);
    expect(dialogue?.revealed).toBe(dialogue?.text.length);

    // Reload and verify both preferences + data-reduced-motion persist across reload.
    await page.reload();
    await page.waitForFunction(() => Boolean(window.__cloverhollow));
    await expect
      .poll(() => page.evaluate(() => window.__cloverhollow?.settings.textSpeed()))
      .toBe("instant");
    await expect
      .poll(() => page.evaluate(() => window.__cloverhollow?.settings.reducedMotion()))
      .toBe(true);
    await expect(page.locator("html")).toHaveAttribute("data-reduced-motion", "on");

    // Restore clean defaults.
    await page.evaluate(() => {
      window.__cloverhollow?.settings.setTextSpeed("cozy");
      window.__cloverhollow?.settings.setReducedMotion(false);
    });
    await expect(page.locator("html")).toHaveAttribute("data-reduced-motion", "off");
  },
);

test(
  "Journal MAP Field Treasures Card showcases stamps, keepsakes, and Catch Book",
  { tag: "@smoke" },
  async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await openHarness(page);
    await resetPaused(page, "new-game");

    // Fresh game hides the Treasures pill on MAP so early-game baselines stay untouched.
    await page.keyboard.press("j");
    await step(page, 2);
    await page.keyboard.press("ArrowRight");
    await expect(page.locator(".journal-book")).toHaveAttribute("data-journal-page", "map");
    await expect(page.locator(".journal-treasures-btn")).toBeHidden();

    // Load Clubhouse QA pack, grant stickers/prizes/keepsakes, add Catch Book fish via real save.
    await page.goto("./?qa=clubhouse");
    await page.waitForFunction(() => Boolean(window.__cloverhollow));
    await page.evaluate(() => window.__cloverhollow?.pause());
    await step(page, 1);
    await runQaCommands(page, ["stickers all", "prizes all", "keepsakes on"]);

    const clubhouseState = await readState(page);
    const enrichedSave = serializeSave({
      ...clubhouseState,
      caughtFish: { minnow: 2, perch: 1, koi: 1, starfish: 1 },
    });
    await page.evaluate((encoded) => {
      localStorage.setItem("CapacitorStorage.cloverhollow-save", encoded);
    }, enrichedSave);

    // Reload without QA param and press Enter on title screen to Continue the real save.
    await page.goto("./");
    await page.waitForFunction(() => Boolean(window.__cloverhollow));
    await page.keyboard.press("Enter");
    await expect
      .poll(() => page.evaluate(() => window.__cloverhollow?.boot.title()))
      .toBeNull();
    await page.evaluate(() => window.__cloverhollow?.pause());
    await step(page, 1);

    // Open Journal -> MAP with real keys, open Field Treasures Card.
    await page.keyboard.press("j");
    await step(page, 2);
    await page.keyboard.press("ArrowRight");
    await expect(page.locator(".journal-book")).toHaveAttribute("data-journal-page", "map");

    const treasuresBtn = page.locator(".journal-treasures-btn");
    await expect(treasuresBtn).toBeVisible();
    await expect(treasuresBtn).toHaveText("Treasures · 13/13");
    await treasuresBtn.click();

    const card = page.locator(".journal-treasures-card");
    await expect(card).toBeVisible();
    await expect(card.locator(".journal-treasures-title")).toHaveText("FIELD TREASURES");
    await expect(card.locator(".journal-treasures-stamps")).toContainText("✓ Bay Wave Stamp");
    await expect(card.locator(".journal-treasures-stamps")).toContainText("✓ Pass Pine Stamp");
    await expect(card.locator(".journal-stamp-complete")).toHaveText("★ Star-Line Explorer!");
    await expect(card.locator(".journal-keepsake-item.is-unlocked")).toHaveCount(13);
    await expect(card).toContainText("Golden Star-Line Whistle");
    await expect(card).toContainText("Shimmering Star Crystal");
    await expect(card.locator(".journal-catch-pill.is-caught")).toHaveCount(4);
    await expect(card.locator(".journal-catch-pill.is-rare")).toHaveCount(1);
    await expect(card.locator('.journal-catch-pill[data-fish="starfish"]')).toContainText(
      "Golden Starfish Crown",
    );
    await expect(card.locator(".journal-catch-pill.is-uncaught")).toHaveCount(2);

    // Check responsive geometry & capture desktop + phone review screenshots.
    for (const size of [
      { width: 1280, height: 720, shot: "m93-treasures-1280" },
      { width: 874, height: 402, shot: "m93-treasures-874" },
    ] as const) {
      await page.setViewportSize({ width: size.width, height: size.height });
      await step(page, 1);
      const geom = await page.evaluate(() => {
        const book = document.querySelector(".journal-book")?.getBoundingClientRect();
        const modal = document.querySelector<HTMLElement>(".journal-treasures-card");
        const close = document.querySelector(".journal-treasures-close")?.getBoundingClientRect();
        if (!book || !modal || !close) return null;
        const rect = modal.getBoundingClientRect();
        return {
          inside:
            rect.left >= book.left &&
            rect.right <= book.right &&
            rect.top >= book.top &&
            rect.bottom <= book.bottom,
          noHorizontalOverflow: modal.scrollWidth <= modal.clientWidth + 1,
          closeSize: Math.min(close.width, close.height),
        };
      });
      expect(geom, `${size.width}x${size.height} Field Treasures Card geometry`).toEqual({
        inside: true,
        noHorizontalOverflow: true,
        closeSize: 44,
      });
      await captureReview(page, testInfo, size.shot);
    }
    await page.setViewportSize({ width: 1280, height: 720 });
    await step(page, 1);

    // Escape dismisses ONLY the Field Treasures Card; Journal stays open on MAP!
    await page.keyboard.press("Escape");
    await step(page, 1);
    await expect(card).toBeHidden();
    await expect(page.locator(".journal-book")).toBeVisible();
    await expect(page.locator(".journal-book")).toHaveAttribute("data-journal-page", "map");

    // Closing the Journal and cleaning up saved state.
    await page.keyboard.press("j");
    await step(page, 2);
    await expect(page.locator(".journal-book")).toBeHidden();
    await page.evaluate(() => window.__cloverhollow?.save.clear());
  },
);
