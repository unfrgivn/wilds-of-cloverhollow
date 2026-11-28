import { mkdirSync } from "node:fs";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import type { MusicDebugInfo } from "../../src/platform/audio";
import { step } from "./helpers";

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

async function readAlbumGeometry(page: Page): Promise<{
  insideBook: boolean;
  noHorizontalOverflow: boolean;
  gridNoHorizontalOverflow: boolean;
  closeSize: number;
  cols: number;
  visibleCount: number;
  minTrackHeight: number;
  svgCount: number;
  svgTextNodes: number;
  allVisibleHorizontallyInside: boolean;
} | null> {
  return page.evaluate(() => {
    const book = document.querySelector(".journal-book")?.getBoundingClientRect();
    const card = document.querySelector<HTMLElement>(".journal-jukebox-card");
    const grid = document.querySelector<HTMLElement>(".journal-album-grid");
    const close = document.querySelector(".journal-jukebox-close")?.getBoundingClientRect();
    const tracks = [...document.querySelectorAll<HTMLElement>(".journal-album-track")].filter(
      (btn) => !btn.hidden,
    );
    const svgs = [...document.querySelectorAll(".journal-jukebox-overlay svg")];
    if (book === undefined || card === null || grid === null || close === undefined) return null;
    if (tracks.length === 0) return null;
    const rect = card.getBoundingClientRect();
    const gridRect = grid.getBoundingClientRect();
    const cols = new Set(tracks.map((t) => Math.round(t.getBoundingClientRect().left / 16))).size;
    const minTrackHeight = Math.round(
      Math.min(...tracks.map((t) => t.getBoundingClientRect().height)),
    );
    return {
      insideBook:
        rect.left >= book.left - 1 &&
        rect.right <= book.right + 1 &&
        rect.top >= book.top - 1 &&
        rect.bottom <= book.bottom + 1,
      noHorizontalOverflow: card.scrollWidth <= card.clientWidth + 1,
      gridNoHorizontalOverflow: grid.scrollWidth <= grid.clientWidth + 1,
      closeSize: Math.round(Math.min(close.width, close.height)),
      cols,
      visibleCount: tracks.length,
      minTrackHeight,
      svgCount: svgs.length,
      svgTextNodes: svgs.reduce((sum, node) => sum + node.querySelectorAll("text").length, 0),
      allVisibleHorizontallyInside: tracks.every((track) => {
        const tr = track.getBoundingClientRect();
        return tr.left >= gridRect.left - 1 && tr.right <= gridRect.right + 1;
      }),
    };
  });
}

test.describe("Milestone 213: 35-Track Soundtrack Album & Direct Music Box Jukebox", () => {
  test(
    "filters 35 themes, plays tracks live, resets to Area Theme, and fits desktop + phone",
    { tag: "@smoke" },
    async ({ page }, testInfo) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto("./?qa=clubhouse");
      await page.waitForFunction(() => Boolean(window.__cloverhollow));
      await page.evaluate(() => window.__cloverhollow?.pause());
      await step(page, 1);

      await runQaCommands(page, ["keepsakes on"]);

      // Open Journal -> MAP -> Treasures -> ♫ OST · 35.
      await tapKey(page, "j");
      const book = page.locator(".journal-book");
      await expect(book).toBeVisible();
      await expect.poll(async () => await readMusic(page)).toMatchObject({
        track: "clubhouse",
        title: "Our Secret Treehouse",
        duck: true,
        adaptive: { journalWarm: true },
      });

      await page.locator(".journal-map-tab").click();
      await expect(book).toHaveAttribute("data-journal-page", "map");
      await page.locator(".journal-treasures-btn").click();
      await expect(page.locator(".journal-treasures-card")).toBeVisible();

      const albumBtn = page.locator(".journal-album-btn");
      await expect(albumBtn).toBeVisible();
      await expect(albumBtn).toHaveText("♫ OST · 35");
      await albumBtn.click();

      const overlay = page.locator(".journal-jukebox-overlay");
      const card = page.locator(".journal-jukebox-card");
      await expect(overlay).toBeVisible();
      await settleAnimations(page, ".journal-jukebox-overlay");

      await expect(card.locator(".journal-jukebox-title")).toHaveText("SOUNDTRACK ALBUM");
      await expect(card.locator(".journal-jukebox-count")).toHaveText("35 Themes");
      await expect(card.locator(".journal-album-reset")).toBeHidden();
      await expect(card).toHaveAttribute("data-jukebox-active", "false");
      await expect(card.locator(".journal-album-track")).toHaveCount(35);

      // Verify full 35-track geometry at 1280x720.
      const allGeom = await readAlbumGeometry(page);
      expect(allGeom).not.toBeNull();
      expect(allGeom?.insideBook).toBe(true);
      expect(allGeom?.noHorizontalOverflow).toBe(true);
      expect(allGeom?.gridNoHorizontalOverflow).toBe(true);
      expect(allGeom?.closeSize).toBe(44);
      expect(allGeom?.cols).toBe(2);
      expect(allGeom?.visibleCount).toBe(35);
      expect(allGeom?.minTrackHeight ?? 0).toBeGreaterThanOrEqual(44);
      expect(allGeom?.svgCount).toBe(1);
      expect(allGeom?.svgTextNodes).toBe(0);
      expect(allGeom?.allVisibleHorizontallyInside).toBe(true);

      // Filter to Festive -> click Cloverhollow Jubilee ("festival") -> live playback!
      const festiveBtn = card.locator('.journal-album-filter[data-album-category="festive"]');
      await festiveBtn.click();
      await expect(festiveBtn).toHaveAttribute("aria-pressed", "true");
      await expect(card).toHaveAttribute("data-album-filter", "festive");

      const festivalTrack = card.locator('.journal-album-track[data-track="festival"]');
      await expect(festivalTrack).toBeVisible();
      await festivalTrack.click();

      await expect.poll(async () => await readMusic(page)).toMatchObject({
        track: "festival",
        title: "Cloverhollow Jubilee",
        duck: false,
        adaptive: { journalWarm: false },
      });
      await expect(card).toHaveAttribute("data-jukebox-active", "true");
      await expect(card.locator(".journal-jukebox-count")).toHaveText(
        "♪ Playing: Cloverhollow Jubilee",
      );
      await expect(card.locator(".journal-album-reset")).toBeVisible();
      await expect(festivalTrack).toHaveClass(/is-playing/);
      await expect(festivalTrack).toHaveAttribute("aria-pressed", "true");
      await expect(festivalTrack.locator(".journal-album-playing")).toBeVisible();

      // Return to All · 35 so the desktop review shot shows the full album + gold playing pill.
      const allBtn = card.locator('.journal-album-filter[data-album-category="all"]');
      await allBtn.click();
      await festivalTrack.scrollIntoViewIfNeeded();
      await step(page, 1);
      await captureReview(page, testInfo, "m213-ost-album-1280");

      // Keyboard 2D grid navigation across visible tracks.
      await card.focus();
      const track0 = card.locator('.journal-album-track[data-track="title"]');
      const track1 = card.locator('.journal-album-track[data-track="home"]');
      const track3 = card.locator('.journal-album-track[data-track="market"]');
      const trackLast = card.locator('.journal-album-track[data-track="morning"]');
      await page.keyboard.press("ArrowRight");
      await expect(track0).toBeFocused();
      await page.keyboard.press("ArrowRight");
      await expect(track1).toBeFocused();
      await page.keyboard.press("ArrowDown");
      await expect(track3).toBeFocused();
      await page.keyboard.press("End");
      await expect(trackLast).toBeFocused();
      await page.keyboard.press("Home");
      await expect(track0).toBeFocused();

      // Switch to 874x402 phone viewport -> filter Story & Battle -> play Starlight Encore!
      await page.setViewportSize({ width: 874, height: 402 });
      await step(page, 2);

      const storyBtn = card.locator('.journal-album-filter[data-album-category="story"]');
      await storyBtn.click();
      await expect(storyBtn).toHaveAttribute("aria-pressed", "true");

      const encoreTrack = card.locator('.journal-album-track[data-track="encore"]');
      await expect(encoreTrack).toBeVisible();
      await encoreTrack.click();

      await expect.poll(async () => await readMusic(page)).toMatchObject({
        track: "encore",
        title: "Starlight Encore!",
        duck: false,
        adaptive: { journalWarm: false },
      });
      await expect(card.locator(".journal-jukebox-count")).toHaveText(
        "♪ Playing: Starlight Encore!",
      );
      await expect(encoreTrack).toHaveClass(/is-playing/);

      const phoneGeom = await readAlbumGeometry(page);
      expect(phoneGeom).not.toBeNull();
      expect(phoneGeom?.insideBook).toBe(true);
      expect(phoneGeom?.noHorizontalOverflow).toBe(true);
      expect(phoneGeom?.gridNoHorizontalOverflow).toBe(true);
      expect(phoneGeom?.closeSize).toBe(44);
      expect(phoneGeom?.cols).toBe(2);
      expect(phoneGeom?.visibleCount).toBe(6);
      expect(phoneGeom?.minTrackHeight ?? 0).toBeGreaterThanOrEqual(44);
      expect(phoneGeom?.svgCount).toBe(1);
      expect(phoneGeom?.svgTextNodes).toBe(0);
      expect(phoneGeom?.allVisibleHorizontallyInside).toBe(true);

      await captureReview(page, testInfo, "m213-ost-album-874");

      // Click "Area Theme" -> verify Jukebox resets smoothly back to Clubhouse theme!
      const resetBtn = card.locator(".journal-album-reset");
      await resetBtn.click();
      await expect.poll(async () => await readMusic(page)).toMatchObject({
        track: "clubhouse",
        title: "Our Secret Treehouse",
        duck: true,
        adaptive: { journalWarm: true },
      });
      await expect(card).toHaveAttribute("data-jukebox-active", "false");
      await expect(card.locator(".journal-jukebox-count")).toHaveText("35 Themes");
      await expect(resetBtn).toBeHidden();

      // Escape closes Soundtrack Album, restores Field Treasures, and focuses .journal-album-btn!
      await page.keyboard.press("Escape");
      await step(page, 1);
      await expect(overlay).toBeHidden();
      await expect(page.locator(".journal-treasures-card")).toBeVisible();
      await expect(albumBtn).toBeFocused();

      await page.evaluate(() => window.__cloverhollow?.save.clear());
      expect(errors).toEqual([]);
    },
  );
});
