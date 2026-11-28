import { expect, test } from "@playwright/test";
import { gallery } from "./gallery";
import {
  longFlowTimeout,
  openHarness,
  queueScript,
  readState,
  recording,
  resetPaused,
  step,
} from "./helpers";

test.describe("Milestone 229: Ending Credits WCAG Dialog & Keyboard Focus (Track E19Q)", () => {
  test.setTimeout(longFlowTimeout);

  test(
    "exposes dialog semantics and moves focus cleanly onto credits in ui-gallery",
    { tag: "@smoke" },
    async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      for (const state of ["credits", "credits-short"] as const) {
        await gallery(page, state, false, "0,0,0,0", { width: 1280, height: 720 });
        const credits = page.locator(".credits-screen");
        await expect(credits).toBeVisible();
        await expect(credits).toHaveAttribute("role", "dialog");
        await expect(credits).toHaveAttribute("aria-modal", "true");
        await expect(credits).toHaveAttribute("aria-label", "Credits");
        await expect(credits).toHaveAttribute("tabindex", "-1");

        const focusInfo = await page.evaluate(() => {
          const el = document.querySelector<HTMLElement>(".credits-screen");
          if (el === null) return null;
          const style = getComputedStyle(el);
          return {
            focused: document.activeElement === el,
            outlineStyle: style.outlineStyle,
          };
        });
        expect(focusInfo?.focused, `${state} focused`).toBe(true);
        expect(focusInfo?.outlineStyle, `${state} outlineStyle`).toBe("none");
      }

      expect(errors).toEqual([]);
    },
  );

  test(
    "returns cleanly to Title Screen on Escape and Enter after the credits grace window",
    { tag: "@smoke" },
    async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      await page.setViewportSize({ width: 1280, height: 720 });
      await openHarness(page);

      const endingScript = recording("tests/sim/scripts/new-game/golden-ending.json");
      const totalTicks = endingScript.reduce((total, segment) => total + segment.ticks, 0);
      const titleMode = async (): Promise<string | null> =>
        page.evaluate(() => window.__cloverhollow?.boot.title() ?? null);

      for (const key of ["Escape", "Enter"] as const) {
        await resetPaused(page, "new-game");
        await queueScript(page, endingScript);
        await step(page, totalTicks);

        const credits = page.locator(".credits-screen");
        await expect(credits).toBeVisible();
        await expect(credits).toHaveAttribute("role", "dialog");
        await expect(credits).toHaveAttribute("aria-modal", "true");
        expect((await readState(page)).finale).toBe("credits");
        expect(
          await page.evaluate(
            () => document.activeElement === document.querySelector(".credits-screen"),
          ),
        ).toBe(true);

        // Premature key press before the beat guard must not skip the credits.
        await page.keyboard.press(key);
        await step(page, 2);
        expect(await titleMode()).toBeNull();
        await expect(credits).toBeVisible();

        // After the grace window, pressing the key returns cleanly to the Title Screen.
        await step(page, 12);
        await page.keyboard.press(key);
        await step(page, 2);
        expect(await titleMode()).toBe("continue");
        await expect(credits).toBeHidden();
        await expect(page.locator(".title-option-label")).toHaveText(["Continue", "New game"]);
      }

      expect(errors).toEqual([]);
    },
  );
});
