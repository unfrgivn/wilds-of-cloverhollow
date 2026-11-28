import { mkdirSync } from "node:fs";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { longFlowTimeout, readState, resetPaused, step, walk } from "./helpers";

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

async function hold(page: Page, key: string, ticks: number): Promise<void> {
  await page.keyboard.down(key);
  await step(page, ticks);
  await page.keyboard.up(key);
}

async function waitForArea(page: Page, areaId: string, maxSteps = 90): Promise<void> {
  for (let i = 0; i < maxSteps; i += 1) {
    const state = await readState(page);
    if (state.area === areaId && state.transition === null) return;
    await step(page, 1);
  }
  const finalState = await readState(page);
  throw new Error(`Expected area ${areaId}, ended in ${finalState.area}`);
}

async function settleAnimations(page: Page, selector: string): Promise<void> {
  await page.evaluate(async (sel) => {
    const root = document.querySelector(sel);
    if (root === null) return;
    await Promise.all(
      root
        .getAnimations({ subtree: true })
        .filter((anim) => anim.effect?.getTiming().iterations !== Number.POSITIVE_INFINITY)
        .map((anim) => anim.finished.catch(() => undefined)),
    );
  }, selector);
}

async function openTreasures(page: Page): Promise<void> {
  await tapKey(page, "j");
  const book = page.locator(".journal-book");
  await expect(book).toBeVisible();
  await page.locator(".journal-map-tab").click();
  await expect(book).toHaveAttribute("data-journal-page", "map");
  await page.locator(".journal-treasures-btn").click();
  await expect(page.locator(".journal-treasures-card")).toBeVisible();
}

async function closeSubmodalAndJournal(page: Page, submodalSelector: string): Promise<void> {
  await page.keyboard.press("Escape");
  await expect(page.locator(submodalSelector)).toBeHidden();
  await page.keyboard.press("Escape");
  await expect(page.locator(".journal-treasures-card")).toBeHidden();
  await tapKey(page, "j");
  await expect(page.locator(".journal-book")).toBeHidden();
}

async function setWeatherViaAlmanac(page: Page, mode: "sunshower" | "clear"): Promise<void> {
  await openTreasures(page);
  await page.locator(".journal-weather-btn").click();
  await expect(page.locator(".journal-weather-card")).toBeVisible();
  await settleAnimations(page, ".journal-weather-overlay");
  const btn = page.locator(`.journal-weather-option[data-weather-mode="${mode}"]`);
  await btn.click();
  await expect(btn).toHaveAttribute("aria-pressed", "true");
  await closeSubmodalAndJournal(page, ".journal-weather-overlay");
}

async function toggleFestivalHomeRecord(
  page: Page,
  expectedPressed: "true" | "false",
): Promise<void> {
  await openTreasures(page);
  await page.locator(".journal-album-btn").click();
  const card = page.locator(".journal-jukebox-card");
  await expect(card).toBeVisible();
  await settleAnimations(page, ".journal-jukebox-overlay");
  if (expectedPressed === "true") {
    await card.locator('.journal-album-filter[data-album-category="festive"]').click();
    const festivalTrack = card.locator('.journal-album-track[data-track="festival"]');
    await expect(festivalTrack).toBeVisible();
    await festivalTrack.click();
  }
  const homeBtn = card.locator(".journal-album-home-btn");
  await homeBtn.click();
  await expect(homeBtn).toHaveAttribute("aria-pressed", expectedPressed);
  if (expectedPressed === "true") {
    await card.locator(".journal-album-reset").click();
  }
  await closeSubmodalAndJournal(page, ".journal-jukebox-overlay");
}

async function assertBannerUnclipped(page: Page): Promise<void> {
  const metrics = await page.locator(".area-banner").evaluate((node) => {
    const region = node.querySelector<HTMLElement>(".area-banner-region");
    const title = node.querySelector<HTMLElement>(".area-banner-title");
    const rect = node.getBoundingClientRect();
    const style = getComputedStyle(node);
    return {
      opacity: Number.parseFloat(style.opacity),
      inViewport: rect.left >= 0 && rect.right <= window.innerWidth && rect.top >= 0,
      regionUnclipped: region !== null && region.scrollWidth <= region.clientWidth + 1,
      titleUnclipped: title !== null && title.scrollWidth <= title.clientWidth + 1,
    };
  });
  expect(metrics.opacity).toBeGreaterThan(0.95);
  expect(metrics.inViewport).toBe(true);
  expect(metrics.regionUnclipped).toBe(true);
  expect(metrics.titleUnclipped).toBe(true);
}

async function captureReview(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  if (process.env.CLOVERHOLLOW_REVIEW_SHOTS !== "1" || testInfo.project.name !== "chromium") {
    return;
  }
  mkdirSync("art/review", { recursive: true });
  await page.screenshot({
    path: `art/review/${name}.jpg`,
    type: "jpeg",
    quality: 90,
  });
}

test.describe("Milestone 229: Weather & Home-Record Enriched Area Arrival Banners", () => {
  test.setTimeout(longFlowTimeout);

  test(
    "shows outdoor Cozy Weather on plaza arrival and Home Record on clubhouse arrival, unclipped",
    { tag: "@smoke" },
    async ({ page }, testInfo) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      try {
        // 1. Set Cozy Weather "sunshower" in kitchen -> walk out into Town plaza!
        await page.setViewportSize({ width: 1280, height: 720 });
        await page.goto("./");
        await page.waitForFunction(() => Boolean(window.__cloverhollow));
        await resetPaused(page, "kitchen");
        await runQaCommands(page, ["keepsakes on"]);

        await setWeatherViaAlmanac(page, "sunshower");

        // Walk out Kitchen's front door into Cloverhollow Town plaza.
        await walk(page, "y", 560);
        await walk(page, "x", 1045);
        await waitForArea(page, "plaza");
        await step(page, 24);

        const banner = page.locator(".area-banner");
        await expect(banner).toBeVisible();
        await expect(banner.locator(".area-banner-region")).toHaveText(
          "Cloverhollow · Rainbow Sunshower",
        );
        await expect(banner.locator(".area-banner-title")).toHaveText("Town plaza");
        await assertBannerUnclipped(page);

        await captureReview(page, testInfo, "m229-banner-sunshower-1280");

        // Reset weather cleanly back to "clear".
        await setWeatherViaAlmanac(page, "clear");

        // 2. Pin Home Record "festival" (Cloverhollow Jubilee) -> enter Clubhouse from Woods!
        await page.goto("./?qa=clubhouse");
        await page.waitForFunction(() => Boolean(window.__cloverhollow));
        await page.evaluate(() => window.__cloverhollow?.pause());
        await step(page, 1);
        await runQaCommands(page, ["keepsakes on"]);

        await toggleFestivalHomeRecord(page, "true");

        // Climb down ladder into Whispering Woods, then climb straight back up into Clubhouse.
        await hold(page, "ArrowDown", 24);
        await waitForArea(page, "woods");
        await step(page, 4);
        await hold(page, "ArrowUp", 24);
        await waitForArea(page, "clubhouse");
        await step(page, 24);

        await expect(banner).toBeVisible();
        await expect(banner.locator(".area-banner-region")).toHaveText(
          "The Forest · ♪ Cloverhollow Jubilee",
        );
        await expect(banner.locator(".area-banner-title")).toHaveText("Clubhouse");
        await assertBannerUnclipped(page);

        await captureReview(page, testInfo, "m229-banner-home-record-1280");

        // Reset Home Record cleanly back to null.
        await toggleFestivalHomeRecord(page, "false");
        expect(errors).toEqual([]);
      } finally {
        await page.evaluate(() => {
          localStorage.removeItem("CapacitorStorage.cloverhollow-weather");
          localStorage.removeItem("CapacitorStorage.cloverhollow-home-record");
          return window.__cloverhollow?.save.clear();
        });
      }
    },
  );
});
