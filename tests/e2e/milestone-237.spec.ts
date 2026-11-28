import { expect, test, type Page } from "@playwright/test";
import {
  longFlowTimeout,
  openHarness,
  playBattleCheck,
  readBattle,
  readState,
  renderInfo,
  resetPaused,
  step,
  walk,
} from "./helpers";

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

async function runFromBattleIfNeeded(page: Page): Promise<void> {
  for (let guard = 0; guard < 50; guard += 1) {
    const battle = await readBattle(page);
    if (battle === null) return;
    if (battle.phase === "check" && battle.check !== null) {
      await playBattleCheck(page);
    } else if (battle.phase === "command" && battle.revealed >= battle.message.length) {
      await tapKey(page, "ArrowUp");
      await tapKey(page, "z");
    } else {
      await tapKey(page, "z");
    }
  }
}

async function walkSafe(page: Page, axis: "x" | "y", target: number): Promise<void> {
  for (let tries = 0; tries < 6; tries += 1) {
    await walk(page, axis, target);
    const battle = await readBattle(page);
    if (battle !== null) {
      await runFromBattleIfNeeded(page);
      continue;
    }
    const pos = (await readState(page)).player;
    if (Math.abs(pos[axis] - target) <= 18) return;
  }
}

test.describe("Milestone 237: Shoreline SKIP Prompt & Key Hints WCAG aria-pressed Parity", () => {
  test.setTimeout(longFlowTimeout);

  test(
    "Meadow Park pond shoreline reveals floating SKIP prompt & Key Hints Skip pill and skips on Z",
    { tag: "@smoke" },
    async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      await page.setViewportSize({ width: 1280, height: 720 });
      await openHarness(page);
      await resetPaused(page, "park");
      await page.evaluate(() => window.__cloverhollow?.settings.setKeyHints(true));
      await unlockAudio(page);

      // Walk to Meadow Park's west pond shore (park-pond-skip at 765, 785).
      await walkSafe(page, "x", 765);
      await walkSafe(page, "y", 785);
      await step(page, 2);

      const prompt = page.locator(".sticker-prompt");
      await expect(prompt).toBeVisible();
      await expect(prompt).toContainText("SKIP");

      const interactPill = page.locator('.hud-hints [data-hint="interact"]');
      await expect(interactPill).toBeVisible();
      await expect(interactPill).toHaveClass(/is-active/);
      await expect(interactPill).toHaveAttribute("aria-label", "Skip");
      await expect(interactPill.locator(".hud-hint-label")).toHaveText("Skip");

      const beforeSkip = (await recordedEffects(page)).length;
      await tapKey(page, "z");
      await step(page, 4);

      const skipInfo = await renderInfo(page);
      expect(skipInfo.microDelights.activeSkips).toBeGreaterThanOrEqual(1);
      expect((await recordedEffects(page)).slice(beforeSkip)).toContain("pebble-skip");

      await page.evaluate(() => window.__cloverhollow?.settings.setKeyHints(false));
      expect(errors).toEqual([]);
    },
  );

  test(
    "Key Hints Lantern and Mute toggle aria-pressed live on real key presses",
    { tag: "@smoke" },
    async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto("./?qa=flute");
      await page.waitForFunction(() => Boolean(window.__cloverhollow));
      await page.evaluate(() => {
        window.__cloverhollow?.pause();
        window.__cloverhollow?.settings.setKeyHints(true);
      });
      await step(page, 2);

      const ribbon = page.locator(".hud-hints");
      const lanternPill = ribbon.locator('[data-hint="lantern"]');
      const mutePill = ribbon.locator('[data-hint="mute"]');
      await expect(ribbon).toBeVisible();
      await expect(lanternPill).toBeVisible();
      await expect(mutePill).toBeVisible();

      // Lantern aria-pressed flips false -> true -> false on real L presses.
      await expect(lanternPill).toHaveAttribute("aria-pressed", "false");
      await tapKey(page, "l");
      await expect(lanternPill).toHaveAttribute("aria-pressed", "true");
      await expect(lanternPill).toHaveAttribute("aria-label", "Lantern on");
      await tapKey(page, "l");
      await expect(lanternPill).toHaveAttribute("aria-pressed", "false");
      await expect(lanternPill).toHaveAttribute("aria-label", "Lantern");

      // Mute aria-pressed flips false -> true -> false on real M presses.
      await expect(mutePill).toHaveAttribute("aria-pressed", "false");
      await tapKey(page, "m");
      await expect(mutePill).toHaveAttribute("aria-pressed", "true");
      await expect(mutePill).toHaveAttribute("aria-label", "Muted");
      await tapKey(page, "m");
      await expect(mutePill).toHaveAttribute("aria-pressed", "false");
      await expect(mutePill).toHaveAttribute("aria-label", "Mute");

      await page.evaluate(() => window.__cloverhollow?.settings.setKeyHints(false));
      expect(errors).toEqual([]);
    },
  );
});
