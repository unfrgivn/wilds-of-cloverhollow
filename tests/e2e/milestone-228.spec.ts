import { mkdirSync } from "node:fs";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { jukeboxTracks, pickShuffleTrack } from "../../src/core/music";
import type { MusicDebugInfo } from "../../src/platform/audio";
import { longFlowTimeout, resetPaused, step } from "./helpers";

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

async function closeAlbumAndJournal(page: Page): Promise<void> {
  await page.keyboard.press("Escape");
  await expect(page.locator(".journal-jukebox-overlay")).toBeHidden();
  await page.keyboard.press("Escape");
  await expect(page.locator(".journal-treasures-card")).toBeHidden();
  await tapKey(page, "j");
  await expect(page.locator(".journal-book")).toBeHidden();
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

test.describe("Milestone 227: Clubhouse & Bedroom Home Record Player + Album Shuffle", () => {
  test.setTimeout(longFlowTimeout);

  test(
    "shuffles deterministically, pins Home Record across bedroom/clubhouse/reload, and unpins",
    { tag: "@smoke" },
    async ({ page }, testInfo) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      try {
        await page.setViewportSize({ width: 1280, height: 720 });
        await page.goto("./?qa=clubhouse");
        await page.waitForFunction(() => Boolean(window.__cloverhollow));
        await page.evaluate(() => window.__cloverhollow?.pause());
        await step(page, 1);

        // Unlock Web Audio with a real key tap so toggle foley is recorded.
        await tapKey(page, "ArrowRight");
        await runQaCommands(page, ["keepsakes on"]);

        await openAlbumFromJournal(page);
        const card = page.locator(".journal-jukebox-card");
        const shuffleBtn = card.locator(".journal-album-shuffle");
        const homeBtn = card.locator(".journal-album-home-btn");
        await expect(shuffleBtn).toHaveText("↻ Shuffle");
        await expect(homeBtn).toHaveText("☆ Home Record");
        await expect(homeBtn).toHaveAttribute("aria-pressed", "false");

        // Click ↻ Shuffle twice -> deterministic non-repeating Jukebox playback!
        const expectedFirst = pickShuffleTrack(jukeboxTracks, "clubhouse", 0);
        if (expectedFirst === null) throw new Error("Expected first shuffle pick");
        await shuffleBtn.click();
        await expect(card).toHaveAttribute("data-jukebox-active", "true");
        await expect.poll(async () => await readMusic(page)).toMatchObject({
          track: expectedFirst,
          duck: false,
          adaptive: { journalWarm: false },
        });

        const expectedSecond = pickShuffleTrack(jukeboxTracks, expectedFirst, 1);
        if (expectedSecond === null) throw new Error("Expected second shuffle pick");
        expect(expectedSecond).not.toBe(expectedFirst);
        await shuffleBtn.click();
        await expect.poll(async () => await readMusic(page)).toMatchObject({
          track: expectedSecond,
          duck: false,
          adaptive: { journalWarm: false },
        });

        // Filter Festive -> click Cloverhollow Jubilee -> click ☆ Home Record!
        await card.locator('.journal-album-filter[data-album-category="festive"]').click();
        const festivalTrack = card.locator('.journal-album-track[data-track="festival"]');
        await expect(festivalTrack).toBeVisible();
        await festivalTrack.click();
        await expect.poll(async () => await readMusic(page)).toMatchObject({
          track: "festival",
          title: "Cloverhollow Jubilee",
          duck: false,
        });

        await homeBtn.click();
        await expect(homeBtn).toHaveAttribute("aria-pressed", "true");
        await expect(homeBtn).toHaveText("★ Home Record");
        await expect(card).toHaveAttribute("data-home-record", "festival");
        await expect(festivalTrack.locator(".journal-album-home-tag")).toBeVisible();
        await expect(festivalTrack.locator(".journal-album-home-tag")).toHaveText("★ Home");
        await expect(card.locator(".journal-album-home-tag:visible")).toHaveCount(1);

        // Return to All · 35 and scroll festival into view for a clean 1280x720 review shot.
        await card.locator('.journal-album-filter[data-album-category="all"]').click();
        await festivalTrack.scrollIntoViewIfNeeded();
        await step(page, 1);

        const layout = await page.evaluate(() => {
          const book = document.querySelector(".journal-book")?.getBoundingClientRect();
          const c = document.querySelector<HTMLElement>(".journal-jukebox-card");
          const g = document.querySelector<HTMLElement>(".journal-album-grid");
          if (book === undefined || c === null || g === null) return null;
          const r = c.getBoundingClientRect();
          return {
            insideBook:
              r.left >= book.left - 1 && r.right <= book.right + 1 &&
              r.top >= book.top - 1 && r.bottom <= book.bottom + 1,
            noHorizontalOverflow: c.scrollWidth <= c.clientWidth + 1,
            gridNoHorizontalOverflow: g.scrollWidth <= g.clientWidth + 1,
            svgCount: document.querySelectorAll(".journal-jukebox-overlay svg").length,
          };
        });
        expect(layout).toEqual({
          insideBook: true,
          noHorizontalOverflow: true,
          gridNoHorizontalOverflow: true,
          svgCount: 1,
        });

        await captureReview(page, testInfo, "m227-home-record-album-1280");

        // Verify >= 44 px touch target size when touch mode is active.
        const touchHeights = await page.evaluate(() => {
          const prev = document.documentElement.dataset.touch;
          document.documentElement.dataset.touch = "on";
          const s = document.querySelector(".journal-album-shuffle")?.getBoundingClientRect();
          const h = document.querySelector(".journal-album-home-btn")?.getBoundingClientRect();
          if (prev === undefined) delete document.documentElement.dataset.touch;
          else document.documentElement.dataset.touch = prev;
          return {
            shuffle: Math.round(s?.height ?? 0),
            home: Math.round(h?.height ?? 0),
          };
        });
        expect(touchHeights.shuffle).toBeGreaterThanOrEqual(44);
        expect(touchHeights.home).toBeGreaterThanOrEqual(44);

        // Reset Jukebox (Area Theme) + close Journal -> Clubhouse plays festival live!
        await card.locator(".journal-album-reset").click();
        await expect(card).toHaveAttribute("data-jukebox-active", "false");
        await closeAlbumAndJournal(page);
        await expect.poll(async () => await readMusic(page)).toMatchObject({
          track: "festival",
          title: "Cloverhollow Jubilee",
          duck: false,
        });

        // Visit bedroom -> plays festival live!
        await resetPaused(page, "new-game");
        await expect.poll(async () => await readMusic(page)).toMatchObject({
          track: "festival",
          title: "Cloverhollow Jubilee",
          ambience: "none",
          duck: false,
        });

        // Visit plaza -> keeps town theme ("home" / "Cloverhollow Town")!
        await resetPaused(page, "plaza");
        await expect.poll(async () => await readMusic(page)).toMatchObject({
          track: "home",
          title: "Cloverhollow Town",
          ambience: "town-breeze",
          duck: false,
        });

        // Reload page -> Home Record persists in both clubhouse and bedroom!
        await page.reload();
        await page.waitForFunction(() => Boolean(window.__cloverhollow));
        await page.evaluate(() => window.__cloverhollow?.pause());
        await step(page, 1);
        await expect.poll(async () => await readMusic(page)).toMatchObject({
          track: "festival",
          title: "Cloverhollow Jubilee",
        });

        await resetPaused(page, "new-game");
        await expect.poll(async () => await readMusic(page)).toMatchObject({
          track: "festival",
          title: "Cloverhollow Jubilee",
          ambience: "none",
          duck: false,
        });

        // Unpin Home Record via UI click -> bedroom returns immediately to Cloverhollow Town!
        await runQaCommands(page, ["keepsakes on"]);
        await openAlbumFromJournal(page);
        await expect(homeBtn).toHaveAttribute("aria-pressed", "true");
        await expect(homeBtn).toHaveText("★ Home Record");
        await homeBtn.click();
        await expect(homeBtn).toHaveAttribute("aria-pressed", "false");
        await expect(homeBtn).toHaveText("☆ Home Record");
        await expect(card.locator(".journal-album-home-tag:visible")).toHaveCount(0);

        await closeAlbumAndJournal(page);
        await expect.poll(async () => await readMusic(page)).toMatchObject({
          track: "home",
          title: "Cloverhollow Town",
          ambience: "none",
          duck: false,
        });

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
