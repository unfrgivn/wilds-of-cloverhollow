import { expect, test, type Page } from "@playwright/test";
import { openHarness, readState, resetPaused, step } from "./helpers";

async function hold(page: Page, key: string, ticks: number): Promise<void> {
  await page.keyboard.down(key);
  await step(page, ticks);
  await page.keyboard.up(key);
}

async function soundLog(page: Page): Promise<{
  tick: number;
  cue: string;
  played: boolean;
}[]> {
  return page.evaluate(() => window.__cloverhollow?.sound.log() ?? []);
}

test("audio waits for a real key in the browser, then cues play", async ({ page }) => {
  // Chromium runs each of Playwright's evaluates as a user gesture, so an audio
  // context made after the first one would start running on its own. Every
  // script comes late here, as from a busy server: sound must start before the
  // page has loaded (spec 3.3), not once the renderer's chunks arrive.
  await page.route("**/*.js", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 200));
    await route.continue();
  });
  await openHarness(page);
  await resetPaused(page, "new-game");
  const state = (): Promise<string | undefined> =>
    page.evaluate(() => window.__cloverhollow?.sound.state());
  // Browsers hold the context until a gesture (WebKit calls it "interrupted");
  // the iOS app's web view doesn't.
  expect(["suspended", "interrupted"]).toContain(await state());
  await hold(page, "ArrowRight", 1);
  await expect.poll(state).toBe("running");
  await hold(page, "ArrowRight", 16);
  expect((await soundLog(page)).some((entry) => entry.cue === "footstep-carpet" && entry.played))
    .toBe(true);
});

test("real dialogue keys emit open, advance, and blip cues", async ({ page }) => {
  await openHarness(page);
  await resetPaused(page, "new-game");
  await hold(page, "ArrowRight", 28);
  await hold(page, "ArrowUp", 18);
  await page.keyboard.press("z");
  await step(page, 1);
  await page.keyboard.press("z");
  await step(page, 12);
  await step(page, 40);
  for (let index = 0; index < 4; index += 1) {
    await page.keyboard.press("z");
    await step(page, 2);
  }
  const cues = (await soundLog(page)).map((entry) => entry.cue);
  expect(cues).toContain("dialogue-open");
  expect(cues).toContain("dialogue-advance");
  expect(cues).toContain("dialogue-blip");
});

test("walking, a door, M mute, and the journal sound control use real input", async ({ page }) => {
  await openHarness(page);
  await resetPaused(page, "new-game");
  await hold(page, "ArrowRight", 16);
  expect((await soundLog(page)).some((entry) => entry.cue === "footstep-carpet")).toBe(true);

  await hold(page, "ArrowUp", 20);
  await hold(page, "ArrowRight", 36);
  await hold(page, "ArrowDown", 5);
  await hold(page, "ArrowLeft", 46);
  await hold(page, "ArrowDown", 36);
  await step(page, 30);
  const doorCues = await soundLog(page);
  expect(doorCues.some((entry) => entry.cue === "door")).toBe(true);
  expect(doorCues.some((entry) => entry.cue === "area-arrive")).toBe(true);

  await page.keyboard.press("m");
  await hold(page, "ArrowRight", 16);
  const mutedCues = await soundLog(page);
  expect(await page.evaluate(() => window.__cloverhollow?.sound.muted())).toBe(true);
  expect(mutedCues.some((entry) => entry.cue === "footstep-carpet" && !entry.played)).toBe(true);

  await page.keyboard.down("j");
  await step(page, 1);
  await page.keyboard.up("j");
  await step(page, 1);
  await expect(page.locator(".journal-book")).toBeVisible();
  await page.locator(".journal-audio").click();
  expect(await page.evaluate(() => window.__cloverhollow?.sound.muted())).toBe(false);
  await expect(page).toHaveScreenshot("journal-sound.png");
  await page.keyboard.down("j");
  await step(page, 1);
  await page.keyboard.up("j");
  await step(page, 1);
  await expect(page.locator(".journal-book")).toBeHidden();
  expect((await readState(page)).journalOpen).toBe(false);
});

test("volume changes, persists, and plays a cue at a lower level", async ({ page }) => {
  await openHarness(page);
  await resetPaused(page, "new-game");
  await page.keyboard.down("j");
  await step(page, 1);
  await page.keyboard.up("j");
  await step(page, 1);
  const slider = page.locator(".journal-volume-slider");
  await expect(slider).toBeVisible();
  await slider.focus();
  await page.keyboard.press("Home");
  expect(await page.evaluate(() => window.__cloverhollow?.sound.level())).toBe(0.25);
  await page.keyboard.press("ArrowRight");
  expect(await page.evaluate(() => window.__cloverhollow?.sound.level())).toBe(0.5);
  await slider.click();
  const selectedLevel = await page.evaluate(() => window.__cloverhollow?.sound.level());
  expect(selectedLevel).toBe(0.75);
  await page.keyboard.press("z");
  await expect.poll(() => page.evaluate(() => window.__cloverhollow?.sound.state()))
    .toBe("running");
  await page.keyboard.down("j");
  await step(page, 1);
  await page.keyboard.up("j");
  await step(page, 1);
  await page.evaluate(() => {
    const active = document.activeElement;
    if (active instanceof HTMLElement) active.blur();
  });
  await hold(page, "ArrowRight", 16);
  expect((await soundLog(page)).some((entry) =>
    entry.cue === "journal-close" && entry.played)).toBe(true);
  await page.keyboard.press("m");
  expect(await page.evaluate(() => window.__cloverhollow?.sound.muted())).toBe(true);
  expect(await page.evaluate(() => window.__cloverhollow?.sound.level())).toBe(selectedLevel);
  await page.keyboard.press("m");
  const restoredLevel = await page.evaluate(() => window.__cloverhollow?.sound.level());
  expect(restoredLevel).toBe(selectedLevel);
  await page.reload();
  await expect.poll(() =>
    page.evaluate(() => window.__cloverhollow?.sound.level())).toBe(restoredLevel);
  await expect.poll(() => page.evaluate(() => window.__cloverhollow?.sound.muted())).toBe(false);
});

test.describe("volume touch", () => {
  test.use({ hasTouch: true });

  test("real taps reach every volume level", async ({ page }) => {
    await openHarness(page);
    await resetPaused(page, "new-game");
    await page.keyboard.down("j");
    await step(page, 1);
    await page.keyboard.up("j");
    await step(page, 1);
    const volume = page.locator(".journal-volume-slider");
    await volume.focus();
    await page.keyboard.press("End");
    for (const expected of [0.25, 0.5, 0.75, 1]) {
      await volume.tap();
      expect(await page.evaluate(() => window.__cloverhollow?.sound.level())).toBe(expected);
    }
  });
});
