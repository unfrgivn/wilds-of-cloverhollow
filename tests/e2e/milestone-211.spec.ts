import { expect, test, type Page } from "@playwright/test";
import type { MusicDebugInfo } from "../../src/platform/audio";
import { longFlowTimeout, resetPaused, step } from "./helpers";

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

async function readMusic(page: Page): Promise<MusicDebugInfo> {
  const info = await page.evaluate(() => window.__cloverhollow?.sound.music());
  if (info === undefined) throw new Error("hook unavailable");
  return info;
}

async function openSkyAlmanac(page: Page): Promise<void> {
  await tapKey(page, "j");
  await expect(page.locator(".journal-book")).toBeVisible();
  await page.locator(".journal-map-tab").click();
  await expect(page.locator(".journal-book")).toHaveAttribute("data-journal-page", "map");
  await page.locator(".journal-treasures-btn").click();
  await expect(page.locator(".journal-treasures-card")).toBeVisible();
  await page.locator(".journal-weather-btn").click();
  await expect(page.locator(".journal-weather-card")).toBeVisible();
}

async function closeAlmanacAndJournal(page: Page): Promise<void> {
  await page.keyboard.press("Escape");
  await step(page, 1);
  await page.keyboard.press("Escape");
  await step(page, 1);
  await tapKey(page, "j");
  await expect(page.locator(".journal-book")).toBeHidden();
  await step(page, 2);
}

test.describe("Milestone 211: Cozy Weather Soundscapes & Weather-Stamped Postcards", () => {
  test.setTimeout(longFlowTimeout);

  test(
    "drives live weather audio with Journal warm filter, indoor hush, and weather-stamped postcard",
    { tag: "@smoke" },
    async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto("./?qa=fountain-frog");
      await page.waitForFunction(() => Boolean(window.__cloverhollow));
      await page.evaluate(() => window.__cloverhollow?.pause());
      await step(page, 1);
      await runQaCommands(page, ["keepsakes on"]);

      // Baseline Clear Skies in Cloverhollow Plaza.
      expect(await readMusic(page)).toMatchObject({
        track: "home",
        ambience: "town-breeze",
        weather: "clear",
      });

      // Open Valley Sky Almanac and switch to Rainbow Sunshower.
      await openSkyAlmanac(page);
      const sunshowerBtn = page.locator(
        '.journal-weather-option[data-weather-mode="sunshower"]',
      );
      await sunshowerBtn.click();
      await expect(sunshowerBtn).toHaveAttribute("aria-pressed", "true");

      // While Journal is open, weather audio is live AND Journal warm low-pass filter muffles it.
      await expect.poll(async () => (await readMusic(page)).weather).toBe("sunshower");
      const journalOpenMusic = await readMusic(page);
      expect(journalOpenMusic.adaptive.journalWarm).toBe(true);
      expect(journalOpenMusic.adaptive.filterCutoffHz).toBe(1400);

      // Close Almanac & Journal -> outdoors in Plaza runs bright sunshower soundscape.
      await closeAlmanacAndJournal(page);
      expect(await readMusic(page)).toMatchObject({
        track: "home",
        ambience: "town-breeze",
        weather: "sunshower",
      });
      expect((await readMusic(page)).adaptive.journalWarm).toBe(false);

      // Enter Photo Mode via real P key and snap a weather-stamped postcard.
      await page.keyboard.press("p");
      await step(page, 2);
      await expect(page.locator("html")).toHaveAttribute("data-photo", "on");

      const rainyCapture = await page.evaluate(async () =>
        window.__cloverhollow?.settings.snapPostcard({ download: false }) ?? null,
      );
      expect(rainyCapture).not.toBeNull();
      expect(rainyCapture?.filename).toBe("cloverhollow-postcard-plaza.png");
      expect(rainyCapture?.subcaption).toContain("Cloverhollow");
      expect(rainyCapture?.subcaption).toContain("Rainbow Sunshower");
      expect(rainyCapture?.dataUrl.startsWith("data:image/png;base64,")).toBe(true);

      await page.keyboard.press("Escape");
      await step(page, 1);
      await expect(page.locator("html")).toHaveAttribute("data-photo", "off");

      // Stepping indoors into Bon Appétit Café hushes weather audio cleanly to "clear".
      await resetPaused(page, "cafe");
      await step(page, 2);
      expect(await readMusic(page)).toMatchObject({
        track: "cafe",
        ambience: "cafe-murmur",
        weather: "clear",
      });

      // Returning outdoors to Plaza resumes Rainbow Sunshower soundscape.
      await resetPaused(page, "plaza");
      await step(page, 2);
      expect(await readMusic(page)).toMatchObject({
        track: "home",
        ambience: "town-breeze",
        weather: "sunshower",
      });

      // Restore Clear Skies in Sky Almanac -> weather soundscape & postcard clear cleanly.
      await runQaCommands(page, ["keepsakes on"]);
      await openSkyAlmanac(page);
      await page.locator('.journal-weather-option[data-weather-mode="clear"]').click();
      await expect.poll(async () => (await readMusic(page)).weather).toBe("clear");
      await closeAlmanacAndJournal(page);
      expect((await readMusic(page)).weather).toBe("clear");

      await page.keyboard.press("p");
      await step(page, 1);
      const clearCapture = await page.evaluate(async () =>
        window.__cloverhollow?.settings.snapPostcard({ download: false }) ?? null,
      );
      expect(clearCapture).not.toBeNull();
      expect(clearCapture?.subcaption).not.toContain("Rainbow Sunshower");
      await page.keyboard.press("Escape");
      await step(page, 1);

      expect(errors).toEqual([]);
    },
  );
});
