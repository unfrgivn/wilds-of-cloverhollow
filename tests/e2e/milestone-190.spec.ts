import { expect, test, type Page } from "@playwright/test";
import { readState, resetPaused, step } from "./helpers";

async function tapKey(page: Page, key: string): Promise<void> {
  await page.keyboard.down(key);
  await step(page, 1);
  await page.keyboard.up(key);
  await step(page, 2);
}

async function unlockAudio(page: Page): Promise<void> {
  await tapKey(page, "ArrowRight");
  await expect
    .poll(() => page.evaluate(() => window.__cloverhollow?.sound.state()))
    .toBe("running");
}

async function recordedEffects(page: Page): Promise<string[]> {
  return page.evaluate(() => [...(window.__cloverhollow?.sound.effects() ?? [])]);
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

test.describe("Milestone 190: Cutscene Overlay Hygiene & Valley Sky Almanac Polish", () => {
  test(
    "Valley Sky Almanac supports 2D arrow/Home/End nav, aria-live forecast, and tactile foley",
    { tag: "@smoke" },
    async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto("./?qa=fountain-frog");
      await page.waitForFunction(() => Boolean(window.__cloverhollow));
      await page.evaluate(() => window.__cloverhollow?.pause());
      await step(page, 1);
      await unlockAudio(page);
      await runQaCommands(page, ["keepsakes on"]);

      // Open Journal -> MAP -> Field Treasures -> Valley Sky Almanac.
      await tapKey(page, "j");
      await expect(page.locator(".journal-book")).toBeVisible();
      await page.locator(".journal-map-tab").click();
      await expect(page.locator(".journal-book")).toHaveAttribute("data-journal-page", "map");
      await page.locator(".journal-treasures-btn").click();
      await expect(page.locator(".journal-treasures-card")).toBeVisible();
      await page.locator(".journal-weather-btn").click();

      const almanac = page.locator(".journal-weather-card");
      await expect(almanac).toBeVisible();
      await expect(almanac.locator(".journal-weather-effects")).toHaveAttribute(
        "aria-live",
        "polite",
      );

      // Focus first weather button ("clear") and step across grid with ArrowRight/End/Home/Left.
      const clearBtn = almanac.locator('.journal-weather-option[data-weather-mode="clear"]');
      const autoBtn = almanac.locator('.journal-weather-option[data-weather-mode="auto"]');
      const sunBtn = almanac.locator('.journal-weather-option[data-weather-mode="sunshower"]');
      const firefliesBtn = almanac.locator(
        '.journal-weather-option[data-weather-mode="twilight-fireflies"]',
      );

      await clearBtn.focus();
      await expect(clearBtn).toBeFocused();

      await page.keyboard.press("ArrowRight");
      await expect(autoBtn).toBeFocused();

      await page.keyboard.press("ArrowDown");
      await expect(sunBtn).toBeFocused();

      await page.keyboard.press("End");
      await expect(firefliesBtn).toBeFocused();

      // Forward wrap from last mode returns to first mode ("clear").
      await page.keyboard.press("ArrowRight");
      await expect(clearBtn).toBeFocused();

      // Backward wrap from first mode jumps to last mode ("twilight-fireflies").
      await page.keyboard.press("ArrowLeft");
      await expect(firefliesBtn).toBeFocused();

      await page.keyboard.press("Home");
      await expect(clearBtn).toBeFocused();

      // Move to "sunshower" via ArrowRight x2, press Enter -> selects mode & plays tool-sparkle.
      await page.keyboard.press("ArrowRight");
      await page.keyboard.press("ArrowRight");
      await expect(sunBtn).toBeFocused();

      const beforeCozy = (await recordedEffects(page)).length;
      await page.keyboard.press("Enter");
      await expect(sunBtn).toHaveAttribute("aria-pressed", "true");
      await expect(page.locator("html")).toHaveAttribute("data-weather", "sunshower");
      expect((await recordedEffects(page)).slice(beforeCozy)).toContain("tool-sparkle");

      // Re-selecting the already active mode must not replay selection foley.
      const beforeSame = (await recordedEffects(page)).length;
      await page.keyboard.press("Enter");
      expect((await recordedEffects(page)).slice(beforeSame)).not.toContain("tool-sparkle");

      // Return to Clear via Home + Enter -> plays toggle-off and resets persisted weather cleanly.
      await page.keyboard.press("Home");
      await expect(clearBtn).toBeFocused();
      const beforeClear = (await recordedEffects(page)).length;
      await page.keyboard.press("Enter");
      await expect(clearBtn).toHaveAttribute("aria-pressed", "true");
      await expect(page.locator("html")).toHaveAttribute("data-weather", "clear");
      expect((await recordedEffects(page)).slice(beforeClear)).toContain("toggle-off");

      expect(errors).toEqual([]);
    },
  );

  test(
    "phone cutscene hides .qa-touch-trigger, .npc-chatter, and .sticker-prompt cleanly",
    { tag: "@smoke" },
    async ({ browser }) => {
      const context = await browser.newContext({
        viewport: { width: 874, height: 402 },
        hasTouch: true,
      });
      const page = await context.newPage();
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      await page.goto("./?touch=1");
      await page.waitForFunction(() => Boolean(window.__cloverhollow));
      await resetPaused(page, "plaza");

      const html = page.locator("html");
      const qaTrigger = page.locator(".qa-touch-trigger");
      await expect(qaTrigger).toBeVisible();

      // Start choreographed plaza cutscene and step into live choreography.
      const started = await page.evaluate(
        () => window.__cloverhollow?.cutscene?.play("plaza-hood-sighting") ?? false,
      );
      expect(started).toBe(true);
      await step(page, 6);

      await expect(html).toHaveAttribute("data-cutscene", "open");
      await expect(qaTrigger).toBeHidden();
      await expect(page.locator(".npc-chatter")).toBeHidden();
      await expect(page.locator(".sticker-prompt")).toBeHidden();

      // Verify defensive display:none rules actively suppress overworld chrome even if unhidden.
      const displays = await page.evaluate(() => {
        const check = (selector: string): string => {
          const el = document.querySelector<HTMLElement>(selector);
          return el === null ? "missing" : window.getComputedStyle(el).display;
        };
        return {
          qaTrigger: check(".qa-touch-trigger"),
          npcChatter: check(".npc-chatter"),
          stickerPrompt: check(".sticker-prompt"),
          saveToast: check(".save-toast"),
          hudHints: check(".hud-hints"),
        };
      });
      expect(displays).toEqual({
        qaTrigger: "none",
        npcChatter: "none",
        stickerPrompt: "none",
        saveToast: "none",
        hudHints: "none",
      });

      // Hold Cancel ('x') for 35 ticks to skip cutscene -> overworld QA trigger restores cleanly.
      await page.keyboard.down("x");
      await step(page, 35);
      await page.keyboard.up("x");
      await step(page, 2);

      const after = await readState(page);
      expect(after.cutscene).toBeUndefined();
      await expect(html).not.toHaveAttribute("data-cutscene", "open");
      await expect(qaTrigger).toBeVisible();

      expect(errors).toEqual([]);
      await context.close();
    },
  );
});
