import { expect, test, type Page } from "@playwright/test";
import { jukeboxTracks, pickShuffleTrack } from "../../src/core/music";
import type { MusicDebugInfo } from "../../src/platform/audio";
import { longFlowTimeout, step } from "./helpers";

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
  if (info === undefined) throw new Error("sound.music hook unavailable");
  return info;
}

async function readPlayerPos(page: Page): Promise<{ x: number; y: number }> {
  const pos = await page.evaluate(() => {
    const p = window.__cloverhollow?.getState().player;
    return p === undefined ? null : { x: p.x, y: p.y };
  });
  if (pos === null) throw new Error("player state unavailable");
  return pos;
}

async function settleAnimations(page: Page, selector: string): Promise<void> {
  await page.evaluate(async (sel) => {
    const root = document.querySelector(sel);
    if (root === null) return;
    await Promise.all(
      root
        .getAnimations({ subtree: true })
        .filter((anim) => anim.effect?.getTiming().iterations !== Number.POSITIVE_INFINITY)
        .map((anim) => anim.finished.catch(() => undefined)),
    );
  }, selector);
}

async function openAlbumFromJournal(page: Page): Promise<void> {
  await tapKey(page, "j");
  const book = page.locator(".journal-book");
  await expect(book).toBeVisible();
  await page.locator(".journal-map-tab").click();
  await expect(book).toHaveAttribute("data-journal-page", "map");
  await page.locator(".journal-treasures-btn").click();
  await expect(page.locator(".journal-treasures-card")).toBeVisible();
  await page.locator(".journal-album-btn").click();
  await expect(page.locator(".journal-jukebox-card")).toBeVisible();
  await settleAnimations(page, ".journal-jukebox-overlay");
}

test.describe("Milestone 230: Soundtrack Album Toolbar Focus & S Shuffle Shortcut", () => {
  test.setTimeout(longFlowTimeout);

  test(
    "shuffles live with S without moving Fae and navigates toolbar with Home/End & disabled skip",
    { tag: "@smoke" },
    async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      try {
        await page.setViewportSize({ width: 1280, height: 720 });
        await page.goto("./?qa=clubhouse");
        await page.waitForFunction(() => Boolean(window.__cloverhollow));
        await page.evaluate(() => window.__cloverhollow?.pause());
        await step(page, 1);

        await runQaCommands(page, ["keepsakes on"]);
        const posBefore = await readPlayerPos(page);

        await openAlbumFromJournal(page);
        const card = page.locator(".journal-jukebox-card");
        const allFilter = card.locator('.journal-album-filter[data-album-category="all"]');
        const shuffleBtn = card.locator(".journal-album-shuffle");
        const homeBtn = card.locator(".journal-album-home-btn");

        // 1. Real S key shuffles live to a different track without closing album or moving Fae.
        const expectedFirst = pickShuffleTrack(jukeboxTracks, "clubhouse", 0);
        if (expectedFirst === null) throw new Error("Expected first shuffle track");
        expect(expectedFirst).not.toBe("clubhouse");

        await page.keyboard.press("s");
        await step(page, 2);
        await expect(card).toBeVisible();
        await expect(card).toHaveAttribute("data-jukebox-active", "true");
        await expect.poll(async () => await readMusic(page)).toMatchObject({
          track: expectedFirst,
          duck: false,
          adaptive: { journalWarm: false },
        });
        expect(await readPlayerPos(page)).toEqual(posBefore);

        const expectedSecond = pickShuffleTrack(jukeboxTracks, expectedFirst, 1);
        if (expectedSecond === null) throw new Error("Expected second shuffle track");
        expect(expectedSecond).not.toBe(expectedFirst);

        await page.keyboard.press("S");
        await step(page, 2);
        await expect(card).toBeVisible();
        await expect.poll(async () => await readMusic(page)).toMatchObject({
          track: expectedSecond,
          duck: false,
          adaptive: { journalWarm: false },
        });
        expect(await readPlayerPos(page)).toEqual(posBefore);

        // 2. Toolbar End/Home/Arrow wrapping across enabled buttons.
        await allFilter.focus();
        await expect(allFilter).toBeFocused();
        await page.keyboard.press("End");
        await expect(homeBtn).toBeFocused();
        await page.keyboard.press("ArrowRight");
        await expect(allFilter).toBeFocused();
        await page.keyboard.press("ArrowLeft");
        await expect(homeBtn).toBeFocused();
        await page.keyboard.press("Home");
        await expect(allFilter).toBeFocused();

        // 3. When Home Record button is disabled, End and ArrowRight skip it cleanly.
        await homeBtn.evaluate((el) => {
          if (el instanceof HTMLButtonElement) el.disabled = true;
        });
        try {
          await allFilter.focus();
          await page.keyboard.press("End");
          await expect(shuffleBtn).toBeFocused();
          await page.keyboard.press("ArrowRight");
          await expect(allFilter).toBeFocused();
          await page.keyboard.press("ArrowLeft");
          await expect(shuffleBtn).toBeFocused();
          await page.keyboard.press("Home");
          await expect(allFilter).toBeFocused();
        } finally {
          await homeBtn.evaluate((el) => {
            if (el instanceof HTMLButtonElement) el.disabled = false;
          });
        }

        expect(errors).toEqual([]);
      } finally {
        await page.evaluate(() => {
          localStorage.removeItem("CapacitorStorage.cloverhollow-home-record");
          return window.__cloverhollow?.save.clear();
        });
      }
    },
  );
});
