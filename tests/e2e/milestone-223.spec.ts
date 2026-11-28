import { expect, test, type Page } from "@playwright/test";
import { longFlowTimeout, openHarness, readBattle, resetPaused, step } from "./helpers";

async function tapKey(page: Page, key: string): Promise<void> {
  await page.keyboard.down(key);
  await step(page, 1);
  await page.keyboard.up(key);
  await step(page, 1);
}

async function advanceUntilCommand(page: Page): Promise<void> {
  for (let count = 0; count < 60; count += 1) {
    const battle = await readBattle(page);
    if (battle?.phase === "command" && battle.revealed >= battle.message.length) return;
    await tapKey(page, "Enter");
  }
  throw new Error("timed out advancing battle to command phase");
}

async function recordedEffects(page: Page): Promise<string[]> {
  return page.evaluate(() => [...(window.__cloverhollow?.sound.effects() ?? [])]);
}

test.describe("Milestone 223: Multi-Foe Target-Switch Tactile Foley (Track E19N)", () => {
  test.setTimeout(longFlowTimeout);

  test(
    "switches multi-foe battle targets via plate click and keyboard with atlas-pin foley",
    { tag: "@smoke" },
    async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      await page.setViewportSize({ width: 1280, height: 720 });
      await openHarness(page);
      await resetPaused(page, "bay-duo");
      await advanceUntilCommand(page);

      // Real Enter key presses above unlock Web Audio; confirm audio is running.
      await expect
        .poll(() => page.evaluate(() => window.__cloverhollow?.sound.state()))
        .toBe("running");

      const plates = page.locator(".battle-foe-plate");
      await expect(plates).toHaveCount(2);
      await expect(plates.nth(0)).toHaveAttribute("aria-pressed", "true");
      await expect(plates.nth(1)).toHaveAttribute("aria-pressed", "false");
      expect((await readBattle(page))?.targetIndex).toBe(0);

      // Clicking the second foe plate switches target to crab and records "atlas-pin".
      const beforeClick = (await recordedEffects(page)).length;
      await plates.nth(1).click();
      await step(page, 1);

      const afterClick = await readBattle(page);
      expect(afterClick?.targetIndex).toBe(1);
      expect(afterClick?.critterId).toBe("crab");
      await expect(plates.nth(1)).toHaveAttribute("aria-pressed", "true");
      await expect(plates.nth(0)).toHaveAttribute("aria-pressed", "false");

      const clickEffects = (await recordedEffects(page)).slice(beforeClick);
      expect(clickEffects).toContain("atlas-pin");

      // Re-clicking the already-targeted plate stays silent (no duplicate pin click).
      const beforeRepeat = (await recordedEffects(page)).length;
      await plates.nth(1).click();
      await step(page, 1);
      const repeatEffects = (await recordedEffects(page)).slice(beforeRepeat);
      expect(repeatEffects).not.toContain("atlas-pin");

      // Switching back via real ArrowLeft key updates target to pup and records "atlas-pin".
      const beforeKey = (await recordedEffects(page)).length;
      await tapKey(page, "ArrowLeft");

      const afterKey = await readBattle(page);
      expect(afterKey?.targetIndex).toBe(0);
      expect(afterKey?.critterId).toBe("pup");
      await expect(plates.nth(0)).toHaveAttribute("aria-pressed", "true");

      const keyEffects = (await recordedEffects(page)).slice(beforeKey);
      expect(keyEffects).toContain("atlas-pin");

      expect(errors).toEqual([]);
    },
  );
});
