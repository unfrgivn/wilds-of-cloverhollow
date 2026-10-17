import { expect, test, type Page } from "@playwright/test";
import { openHarness, resetPaused, step } from "./helpers";

async function hold(page: Page, key: string, ticks: number): Promise<void> {
  await page.keyboard.down(key);
  await step(page, ticks);
  await page.keyboard.up(key);
}

test("real walking changes footsteps from sand to dock wood", async ({ page }) => {
  await openHarness(page);
  await resetPaused(page, "bay");
  await hold(page, "ArrowRight", 90);
  await hold(page, "ArrowUp", 75);
  await hold(page, "ArrowRight", 50);
  const cues = await page.evaluate(() => window.__cloverhollow?.sound.log()
    .map((entry) => entry.cue).filter((cue) => cue.startsWith("footstep-")) ?? []);
  expect(cues).toContain("footstep-sand");
  expect(cues).toContain("footstep-wood");
});
