import { expect, test, type Page } from "@playwright/test";
import {
  longFlowTimeout,
  openHarness,
  readBattle,
  readState,
  renderInfo,
  resetPaused,
  step,
} from "./helpers";

async function hold(page: Page, key: string, ticks: number): Promise<void> {
  await page.keyboard.down(key);
  await step(page, ticks);
  await page.keyboard.up(key);
}

async function tapKey(page: Page, key: string): Promise<void> {
  await page.keyboard.down(key);
  await step(page, 1);
  await page.keyboard.up(key);
  await step(page, 1);
}

async function walkToFrogCommand(page: Page): Promise<void> {
  for (const [key, ticks] of [
    ["ArrowDown", 25],
    ["ArrowLeft", 15],
    ["ArrowDown", 50],
    ["ArrowLeft", 35],
    ["ArrowUp", 38],
  ] as const) {
    await hold(page, key, ticks);
  }
  await expect(page.locator("html")).toHaveAttribute("data-battle", "open");
  for (let count = 0; count < 50; count += 1) {
    const battle = await readBattle(page);
    if (battle?.phase === "command" && battle.revealed >= battle.message.length) return;
    await tapKey(page, "Enter");
  }
  throw new Error("timed out advancing battle to command phase");
}

test.describe("Milestone 131: Clickable Key Hints Ribbon & Overworld Click-to-Pet", () => {
  test.setTimeout(longFlowTimeout);

  test(
    "clicks Key Hints ribbon pills directly for Journal, Mute, and Photo Mode",
    { tag: "@smoke" },
    async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      await page.setViewportSize({ width: 1280, height: 720 });
      await openHarness(page);
      await resetPaused(page, "plaza-party");

      // Turn Key Hints ON via harness settings.
      await page.evaluate(() => window.__cloverhollow?.settings.setKeyHints(true));
      await step(page, 1);

      const ribbon = page.locator(".hud-hints");
      const journalPill = ribbon.locator('[data-hint="journal"]');
      const mutePill = ribbon.locator('[data-hint="mute"]');
      const photoPill = ribbon.locator('[data-hint="photo"]');

      await expect(ribbon).toBeVisible();
      await expect(journalPill).toBeVisible();
      await expect(mutePill).toBeVisible();
      await expect(photoPill).toBeVisible();

      // Click Journal pill directly with mouse (no J key) -> Journal opens cleanly.
      await journalPill.click();
      await step(page, 2);
      expect((await readState(page)).journalOpen).toBe(true);
      await expect(page.locator(".journal-book")).toBeVisible();

      // Close Journal with its mouse close button.
      await page.locator(".journal-close").click();
      await step(page, 2);
      expect((await readState(page)).journalOpen).toBe(false);
      await expect(ribbon).toBeVisible();

      // Click Mute pill directly -> toggles sound muted state and pill label.
      const initiallyMuted = await page.evaluate(() => window.__cloverhollow?.sound.muted());
      await mutePill.click();
      await step(page, 1);
      const afterMuteClick = await page.evaluate(() => window.__cloverhollow?.sound.muted());
      expect(afterMuteClick).toBe(!initiallyMuted);
      await expect(mutePill.locator(".hud-hint-label")).toHaveText(
        afterMuteClick ? "Muted" : "Mute",
      );

      // Click Mute pill again to restore initial audio state.
      await mutePill.click();
      await step(page, 1);
      expect(await page.evaluate(() => window.__cloverhollow?.sound.muted())).toBe(initiallyMuted);

      // Click Photo pill directly -> enters Photo Mode cleanly.
      await photoPill.click();
      await step(page, 1);
      await expect(page.locator("html")).toHaveAttribute("data-photo", "on");
      await expect(ribbon).toBeHidden();

      // Exit Photo Mode cleanly and turn Key Hints back off.
      await page.keyboard.press("Escape");
      await step(page, 1);
      await expect(page.locator("html")).toHaveAttribute("data-photo", "off");
      await page.evaluate(() => window.__cloverhollow?.settings.setKeyHints(false));
      await step(page, 1);
      expect(errors).toEqual([]);
    },
  );

  test(
    "clicks near Fae/Maddie on canvas to pet Maddie and clicks battle hint to open Field Guide",
    { tag: "@smoke" },
    async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      await page.setViewportSize({ width: 1280, height: 720 });
      await openHarness(page);
      await resetPaused(page, "plaza-party");

      const canvas = page.locator("#app canvas");
      await expect(canvas).toBeVisible();
      const box = await canvas.boundingBox();
      if (box === null) throw new Error("Missing game canvas bounding box");

      // In plaza-party at 1280x720 (fountain spawn 1200,550; camera 470,190),
      // Fae sits at screen (730, 360) with Maddie right behind her at (730, ~402).
      // Click directly near Fae/Maddie with ZERO keyboard presses.
      await page.mouse.click(box.x + 730, box.y + 380);
      await step(page, 4);

      const petInfo = await renderInfo(page);
      expect(petInfo.petting).toBe("maddie");
      expect(petInfo.dialogue.open).toBe(false);

      // Turn Key Hints ON and walk into Fizzy Frog battle command phase.
      await page.evaluate(() => window.__cloverhollow?.settings.setKeyHints(true));
      await step(page, 1);
      await walkToFrogCommand(page);

      const battleHint = page.locator(".hud-battle-hint");
      const peekCard = page.locator(".battle-peek-card");
      await expect(battleHint).toBeVisible();
      await expect(peekCard).toBeHidden();

      // Click .hud-battle-hint directly -> opens .battle-peek-card cleanly.
      await battleHint.click();
      await expect(peekCard).toBeVisible();

      // Clicking .hud-battle-hint again toggles .battle-peek-card closed cleanly.
      await battleHint.click();
      await expect(peekCard).toBeHidden();

      await page.evaluate(() => window.__cloverhollow?.settings.setKeyHints(false));
      await step(page, 1);
      expect(errors).toEqual([]);
    },
  );
});
