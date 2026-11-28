import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { renderInfo, resetPaused, step, walk } from "./helpers";

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

async function selectWeatherInAlmanac(page: Page, mode: string): Promise<void> {
  await tapKey(page, "j");
  await expect(page.locator(".journal-book")).toBeVisible();
  await page.locator(".journal-map-tab").click();
  await expect(page.locator(".journal-book")).toHaveAttribute("data-journal-page", "map");
  await page.locator(".journal-treasures-btn").click();
  await expect(page.locator(".journal-treasures-card")).toBeVisible();
  await page.locator(".journal-weather-btn").click();
  await expect(page.locator(".journal-weather-card")).toBeVisible();
  await page.locator(`.journal-weather-option[data-weather-mode="${mode}"]`).click();
  await expect(
    page.locator(`.journal-weather-option[data-weather-mode="${mode}"]`),
  ).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Escape");
  await step(page, 1);
  await page.keyboard.press("Escape");
  await step(page, 1);
  await tapKey(page, "j");
  await expect(page.locator(".journal-book")).toBeHidden();
  await step(page, 2);
}

test.describe("Milestone 183: Dynamic Cozy Weather Engine & Valley Sky Almanac", () => {
  test(
    "drives Valley Sky Almanac, Rainbow Sunshower in Plaza, Fireflies in Woods & sheltered indoors",
    { tag: "@smoke" },
    async ({ page }, testInfo) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto("./?qa=fountain-frog");
      await page.waitForFunction(() => Boolean(window.__cloverhollow));
      await page.evaluate(() => window.__cloverhollow?.pause());
      await step(page, 1);
      await runQaCommands(page, ["keepsakes on"]);

      // Confirm clean Clear Skies baseline in Plaza before switching weather.
      await expect(page.locator("html")).toHaveAttribute("data-weather", "clear");
      await expect(page.locator("html")).toHaveAttribute("data-active-weather", "clear");
      const basePlaza = await renderInfo(page);
      expect(basePlaza.area).toBe("plaza");
      const basePlazaParticles = basePlaza.atmosphereParticles;

      // 1. Open Journal -> MAP -> Treasures -> Valley Sky Almanac.
      await tapKey(page, "j");
      await expect(page.locator(".journal-book")).toBeVisible();
      await page.locator(".journal-map-tab").click();
      await expect(page.locator(".journal-book")).toHaveAttribute("data-journal-page", "map");
      await page.locator(".journal-treasures-btn").click();
      await expect(page.locator(".journal-treasures-card")).toBeVisible();

      const weatherBtn = page.locator(".journal-weather-btn");
      await expect(weatherBtn).toBeVisible();
      await expect(weatherBtn).toHaveText("☀ Sky Almanac");
      await weatherBtn.click();

      const almanac = page.locator(".journal-weather-card");
      await expect(almanac).toBeVisible();
      await settleAnimations(page, ".journal-weather-overlay");
      await expect(almanac.locator(".journal-weather-title")).toHaveText("VALLEY SKY ALMANAC");
      await expect(almanac.locator(".journal-weather-pill")).toHaveText("Clear Skies");
      await expect(almanac.locator(".journal-weather-option")).toHaveCount(6);

      // Verify crisp geometry, 44px targets, and zero SVG <text> at 1280x720 and 874x402.
      for (const size of [{ width: 1280, height: 720 }, { width: 874, height: 402 }]) {
        await page.setViewportSize(size);
        await step(page, 1);
        const geom = await page.evaluate(() => {
          const book = document.querySelector(".journal-book")?.getBoundingClientRect();
          const card = document.querySelector<HTMLElement>(".journal-weather-card");
          const close = document.querySelector(".journal-weather-close")?.getBoundingClientRect();
          const opts = [...document.querySelectorAll(".journal-weather-option")].map((el) =>
            el.getBoundingClientRect(),
          );
          const svgs = [...document.querySelectorAll(".journal-weather-card svg")];
          if (!book || !card || !close) return null;
          const rect = card.getBoundingClientRect();
          return {
            insideBook:
              rect.left >= book.left - 1 &&
              rect.right <= book.right + 1 &&
              rect.top >= book.top - 1 &&
              rect.bottom <= book.bottom + 1,
            noVerticalScroll: card.scrollHeight <= card.clientHeight + 1,
            noHorizontalOverflow: card.scrollWidth <= card.clientWidth + 1,
            closeSize: Math.min(close.width, close.height),
            optionCount: opts.length,
            allTouchSized: opts.every((r) => r.height >= 44 && r.width >= 44),
            svgCount: svgs.length,
            svgTextNodes: svgs.reduce((sum, s) => sum + s.querySelectorAll("text").length, 0),
          };
        });
        expect(geom, `${size.width}x${size.height} Sky Almanac geometry`).toEqual({
          insideBook: true,
          noVerticalScroll: true,
          noHorizontalOverflow: true,
          closeSize: 44,
          optionCount: 6,
          allTouchSized: true,
          svgCount: 7,
          svgTextNodes: 0,
        });
      }
      await page.setViewportSize({ width: 1280, height: 720 });
      await step(page, 1);

      // Select Rainbow Sunshower, inspect Sky Effects Card, and capture Sky Almanac review shot.
      const sunshowerBtn = almanac.locator(
        '.journal-weather-option[data-weather-mode="sunshower"]',
      );
      await sunshowerBtn.click();
      await expect(sunshowerBtn).toHaveAttribute("aria-pressed", "true");
      await expect(almanac.locator(".journal-weather-pill")).toHaveText("Rainbow Sunshower");
      await expect(almanac.locator(".journal-weather-effects")).toContainText("+15% bite charm");
      await expect(almanac.locator(".journal-weather-effects")).toContainText(
        "+1 Clubhouse Garden Dew",
      );
      await captureReview(page, testInfo, "m183-sky-almanac-1280");

      // Escape closes Sky Almanac, restores Field Treasures, and focuses .journal-weather-btn.
      await page.keyboard.press("Escape");
      await step(page, 1);
      await expect(almanac).toBeHidden();
      await expect(page.locator(".journal-treasures-card")).toBeVisible();
      await expect(weatherBtn).toBeFocused();

      // Dismiss Field Treasures and close Journal -> verify live +42 Rainbow Sunshower in Plaza!
      await page.keyboard.press("Escape");
      await step(page, 1);
      await tapKey(page, "j");
      await expect(page.locator(".journal-book")).toBeHidden();
      await step(page, 4);

      await expect(page.locator("html")).toHaveAttribute("data-weather", "sunshower");
      await expect(page.locator("html")).toHaveAttribute("data-active-weather", "sunshower");
      const plazaSunshower = await renderInfo(page);
      expect(plazaSunshower.atmosphereParticles).toBe(basePlazaParticles + 42);

      // Walk around the fountain to northern Plaza so the upper rainbow arc is framed cleanly.
      await walk(page, "x", 1200);
      await walk(page, "y", 410);
      await walk(page, "x", 948);
      await page.keyboard.press("p");
      await step(page, 2);
      await expect(page.locator("html")).toHaveAttribute("data-photo", "on");
      await captureReview(page, testInfo, "m183-plaza-sunshower-1280");
      await page.keyboard.press("p");
      await step(page, 1);
      await expect(page.locator("html")).toHaveAttribute("data-photo", "off");

      // 2. Switch to Whispering Woods -> verify Twilight Fireflies adds +14 emissive fireflies.
      await resetPaused(page, "woods");
      await step(page, 2);
      await runQaCommands(page, ["keepsakes on"]);
      await selectWeatherInAlmanac(page, "clear");
      const baseWoodsParticles = (await renderInfo(page)).atmosphereParticles;

      await selectWeatherInAlmanac(page, "twilight-fireflies");
      await expect(page.locator("html")).toHaveAttribute("data-weather", "twilight-fireflies");
      await expect(page.locator("html")).toHaveAttribute(
        "data-active-weather",
        "twilight-fireflies",
      );
      const woodsFireflies = await renderInfo(page);
      expect(woodsFireflies.area).toBe("woods");
      expect(woodsFireflies.atmosphereParticles).toBe(baseWoodsParticles + 14);

      // 3. Indoors (bedroom) stays sheltered & clear despite outdoor weather preference.
      await resetPaused(page, "new-game");
      await step(page, 2);
      const bedroomInfo = await renderInfo(page);
      expect(bedroomInfo.area).toBe("bedroom");
      await expect(page.locator("html")).toHaveAttribute("data-weather", "twilight-fireflies");
      await expect(page.locator("html")).toHaveAttribute("data-active-weather", "clear");

      // 4. Cleanly reset persisted weather preference back to "clear".
      await runQaCommands(page, ["keepsakes on"]);
      await selectWeatherInAlmanac(page, "clear");
      await expect(page.locator("html")).toHaveAttribute("data-weather", "clear");
      await expect(page.locator("html")).toHaveAttribute("data-active-weather", "clear");

      expect(errors).toEqual([]);
    },
  );
});
