import { mkdirSync } from "node:fs";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { readBattle, renderInfo, resetPaused, step } from "./helpers";

const PLAZA_FROG_APPROACH = [
  ["ArrowDown", 25],
  ["ArrowLeft", 15],
  ["ArrowDown", 50],
  ["ArrowLeft", 35],
] as const;

async function tapKey(page: Page, key: string): Promise<void> {
  await page.keyboard.down(key);
  await step(page, 1);
  await page.keyboard.up(key);
  await step(page, 2);
}

async function holdKey(page: Page, key: string, ticks: number): Promise<void> {
  await page.keyboard.down(key);
  await step(page, ticks);
  await page.keyboard.up(key);
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

async function selectWeatherInAlmanac(page: Page, mode: string): Promise<void> {
  await tapKey(page, "j");
  await expect(page.locator(".journal-book")).toBeVisible();
  await page.locator(".journal-map-tab").click();
  await expect(page.locator(".journal-book")).toHaveAttribute("data-journal-page", "map");
  await page.locator(".journal-treasures-btn").click();
  await expect(page.locator(".journal-treasures-card")).toBeVisible();
  await page.locator(".journal-weather-btn").click();
  await expect(page.locator(".journal-weather-card")).toBeVisible();
  const option = page.locator(`.journal-weather-option[data-weather-mode="${mode}"]`);
  await option.click();
  await expect(option).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Escape");
  await step(page, 1);
  await page.keyboard.press("Escape");
  await step(page, 1);
  await tapKey(page, "j");
  await expect(page.locator(".journal-book")).toBeHidden();
  await step(page, 2);
}

async function startPlazaFrogBattle(page: Page): Promise<void> {
  for (const [key, ticks] of PLAZA_FROG_APPROACH) {
    await holdKey(page, key, ticks);
  }
  await expect(page.locator("html")).toHaveAttribute("data-battle", "open");
  // Advance intro text and confirm into command phase for clean battle staging.
  for (let i = 0; i < 12; i += 1) {
    const battle = await readBattle(page);
    if (battle?.phase === "command") break;
    await step(page, 30);
    await tapKey(page, "Enter");
  }
  await expect.poll(async () => (await readBattle(page))?.phase).toBe("command");
  await step(page, 45);
  await expect(page.locator(".sticker-text-revealed")).toHaveText("What should Fae do?");
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

test.describe("Milestone 215: Live Dynamic Cozy Weather on the Battle Stage", () => {
  test(
    "carries sunshower & twilight fireflies into outdoor battles and shelters indoors",
    { tag: "@smoke" },
    async ({ page }, testInfo) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto("./");
      await page.waitForFunction(() => Boolean(window.__cloverhollow));
      await resetPaused(page, "plaza");
      await runQaCommands(page, ["keepsakes on"]);

      // 1. Set Rainbow Sunshower -> enter Plaza Fountain Frog battle -> 28 weather particles!
      await selectWeatherInAlmanac(page, "sunshower");
      await expect(page.locator("html")).toHaveAttribute("data-weather", "sunshower");
      await startPlazaFrogBattle(page);

      const sunBattle = await renderInfo(page);
      expect(sunBattle.area).toBe("plaza");
      expect(sunBattle.battle.phase).toBe("command");
      expect(sunBattle.battle.weather).toEqual({ kind: "sunshower", count: 28 });
      await captureReview(page, testInfo, "m215-battle-sunshower-1280");

      // 2. Switch to Twilight Fireflies -> enter Plaza battle -> 14 glowing lanterns!
      await resetPaused(page, "plaza");
      await runQaCommands(page, ["keepsakes on"]);
      await selectWeatherInAlmanac(page, "twilight-fireflies");
      await expect(page.locator("html")).toHaveAttribute("data-weather", "twilight-fireflies");
      await startPlazaFrogBattle(page);

      const fireflyBattle = await renderInfo(page);
      expect(fireflyBattle.area).toBe("plaza");
      expect(fireflyBattle.battle.phase).toBe("command");
      expect(fireflyBattle.battle.weather).toEqual({ kind: "twilight-fireflies", count: 14 });
      await captureReview(page, testInfo, "m215-battle-fireflies-1280");

      // 3. Switch back to Sunshower -> enter sheltered indoor Gym battle -> 0 particles!
      await resetPaused(page, "plaza");
      await runQaCommands(page, ["keepsakes on"]);
      await selectWeatherInAlmanac(page, "sunshower");
      await expect(page.locator("html")).toHaveAttribute("data-weather", "sunshower");

      await resetPaused(page, "gym");
      await expect(page.locator("html")).toHaveAttribute("data-active-weather", "clear");
      for (let i = 0; i < 8; i += 1) {
        if ((await readBattle(page)) !== null) break;
        await holdKey(page, "ArrowRight", 35);
      }
      await expect(page.locator("html")).toHaveAttribute("data-battle", "open");
      await step(page, 20);
      const gymBattle = await renderInfo(page);
      expect(gymBattle.area).toBe("gym");
      expect(gymBattle.battle.weather).toEqual({ kind: "clear", count: 0 });

      // 4. Cleanly reset weather back to Clear Skies -> confirm 0 particles in Plaza battle!
      await resetPaused(page, "plaza");
      await runQaCommands(page, ["keepsakes on"]);
      await selectWeatherInAlmanac(page, "clear");
      await expect(page.locator("html")).toHaveAttribute("data-weather", "clear");
      await startPlazaFrogBattle(page);
      const clearBattle = await renderInfo(page);
      expect(clearBattle.area).toBe("plaza");
      expect(clearBattle.battle.weather).toEqual({ kind: "clear", count: 0 });

      await page.evaluate(() => window.__cloverhollow?.save.clear());
      expect(errors).toEqual([]);
    },
  );
});
