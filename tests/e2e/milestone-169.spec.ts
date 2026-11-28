import { expect, test, type Page } from "@playwright/test";
import { longFlowTimeout, step } from "./helpers";

async function tapKey(page: Page, key: string): Promise<void> {
  await page.keyboard.down(key);
  await step(page, 1);
  await page.keyboard.up(key);
  await step(page, 2);
}

async function recordedEffects(page: Page): Promise<string[]> {
  return page.evaluate(() => [...(window.__cloverhollow?.sound.effects() ?? [])]);
}

test.describe("Milestone 169: World Map Pin Foley & WCAG 2.4.7 :focus-visible", () => {
  test.setTimeout(longFlowTimeout);

  test(
    "clicking and stepping Valley Map pins updates Land Guide and plays atlas-pin foley",
    { tag: "@smoke" },
    async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto("./?qa=flute");
      await page.waitForFunction(() => Boolean(window.__cloverhollow));
      await page.evaluate(() => window.__cloverhollow?.pause());
      await step(page, 1);

      // Unlock Web Audio with a real user key press before testing map pin foley.
      await tapKey(page, "ArrowRight");
      await expect
        .poll(() => page.evaluate(() => window.__cloverhollow?.sound.state()))
        .toBe("running");

      // Open Journal and flip to MAP tab.
      await tapKey(page, "j");
      const book = page.locator(".journal-book");
      await expect(book).toBeVisible();
      await page.locator(".journal-map-tab").click();
      await expect(book).toHaveAttribute("data-journal-page", "map");
      await expect(page.locator(".journal-map-tab")).toHaveAttribute("aria-selected", "true");
      await expect(page.locator(".journal-notes-tab")).toHaveAttribute("aria-selected", "false");

      // Click Cloverhollow revealed land pin and verify Land Field Guide footer + atlas-pin foley.
      const beforePin = (await recordedEffects(page)).length;
      const cloverPin = page.locator('.journal-map-land.is-revealed[data-land="cloverhollow"]');
      await expect(cloverPin).toBeVisible();
      await cloverPin.click();

      await expect(cloverPin).toHaveClass(/is-selected/);
      await expect(page.locator(".journal-map-detail")).toContainText("Cloverhollow");
      expect((await recordedEffects(page)).slice(beforePin)).toContain("atlas-pin");

      // Keyboard-step to the next revealed land pin and verify foley + footer update.
      const beforeStep = (await recordedEffects(page)).length;
      await page.keyboard.press("ArrowDown");
      await step(page, 1);
      await expect(page.locator(".journal-map-detail")).toContainText("Bubblegum Bay");
      expect((await recordedEffects(page)).slice(beforeStep)).toContain("atlas-pin");

      expect(errors).toEqual([]);
    },
  );

  test(
    "keyboard focus renders crisp WCAG 2.4.7 :focus-visible outlines on primary controls",
    { tag: "@smoke" },
    async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      await page.setViewportSize({ width: 1280, height: 720 });

      // 1. Title screen: keyboard-focused .title-option gets a crisp non-none :focus-visible ring.
      await page.goto("./");
      await page.waitForFunction(() => Boolean(window.__cloverhollow));
      const firstTitleOption = page.locator(".title-option").first();
      await expect(firstTitleOption).toBeVisible();

      // Trigger keyboard modality first so :focus-visible engages consistently across engines.
      await page.keyboard.press("Tab");
      const titleFocus = await firstTitleOption.evaluate((el) => {
        if (document.activeElement !== el && el instanceof HTMLElement) el.focus();
        const style = getComputedStyle(el);
        return {
          focused: document.activeElement === el,
          matchesFocusVisible: el.matches(":focus-visible"),
          outlineStyle: style.outlineStyle,
          outlineWidth: parseFloat(style.outlineWidth),
        };
      });
      expect(titleFocus.focused).toBe(true);
      expect(titleFocus.matchesFocusVisible).toBe(true);
      expect(titleFocus.outlineStyle).not.toBe("none");
      expect(titleFocus.outlineWidth).toBeGreaterThanOrEqual(3);

      // 2. Journal OPTIONS: real ArrowDown navigation focuses .journal-opt-toggle with ring.
      await page.goto("./?qa=flute");
      await page.waitForFunction(() => Boolean(window.__cloverhollow));
      await page.evaluate(() => window.__cloverhollow?.pause());
      await step(page, 1);

      await tapKey(page, "j");
      await expect(page.locator(".journal-book")).toBeVisible();
      await page.keyboard.press("BracketLeft");
      await expect(page.locator(".journal-book")).toHaveAttribute("data-journal-page", "options");

      // Step via ArrowDown until a .journal-opt-toggle receives keyboard focus.
      let toggleFocus: {
        matched: boolean;
        outlineStyle: string;
        outlineWidth: number;
      } | null = null;
      for (let attempt = 0; attempt < 8; attempt += 1) {
        await page.keyboard.press("ArrowDown");
        toggleFocus = await page.evaluate(() => {
          const active = document.activeElement;
          if (
            !(active instanceof HTMLElement) ||
            !active.classList.contains("journal-opt-toggle")
          ) {
            return null;
          }
          const style = getComputedStyle(active);
          return {
            matched: active.matches(":focus-visible"),
            outlineStyle: style.outlineStyle,
            outlineWidth: parseFloat(style.outlineWidth),
          };
        });
        if (toggleFocus !== null) break;
      }
      expect(toggleFocus).not.toBeNull();
      expect(toggleFocus?.matched).toBe(true);
      expect(toggleFocus?.outlineStyle).not.toBe("none");
      expect(toggleFocus?.outlineWidth).toBeGreaterThanOrEqual(3);

      expect(errors).toEqual([]);
    },
  );
});
