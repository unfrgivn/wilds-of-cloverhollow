import { mkdirSync } from "node:fs";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { openHarness, readState, resetPaused, step, walk } from "./helpers";

async function tapKey(page: Page, key: string): Promise<void> {
  await page.keyboard.down(key);
  await step(page, 1);
  await page.keyboard.up(key);
  await step(page, 2);
}

async function setInkFlags(
  page: Page,
  flags: Record<string, boolean | number | string>,
): Promise<void> {
  const backup = await page.evaluate((nextFlags) => {
    const isObj = (value: unknown): value is Record<string, unknown> =>
      typeof value === "object" && value !== null && !Array.isArray(value);
    const raw = window.__cloverhollow?.save.exportBackup?.();
    if (raw === undefined) return null;
    const env: unknown = JSON.parse(raw);
    if (!isObj(env) || typeof env.save !== "string") return null;
    const payload: unknown = JSON.parse(env.save);
    if (!isObj(payload) || !isObj(payload.state)) return null;
    const st = payload.state;
    if (typeof st.ink !== "string") return null;
    const inkObj: unknown = JSON.parse(st.ink);
    if (!isObj(inkObj) || !isObj(inkObj.variablesState)) return null;
    for (const [key, value] of Object.entries(nextFlags)) {
      inkObj.variablesState[key] = value;
    }
    st.ink = JSON.stringify(inkObj);
    return JSON.stringify(payload);
  }, flags);
  expect(backup).not.toBeNull();
  const imported = await page.evaluate(async (saveJson) => {
    const hook = window.__cloverhollow;
    if (hook?.save.importBackup === undefined || saveJson === null) return false;
    return hook.save.importBackup(saveJson);
  }, backup);
  expect(imported).toBe(true);
  await step(page, 2);
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

async function readHeartsGeometry(page: Page): Promise<{
  insideBook: boolean;
  noHorizontalOverflow: boolean;
  noVerticalScroll: boolean;
  closeSize: number;
  tileCount: number;
  svgCount: number;
  svgTextNodes: number;
} | null> {
  return page.evaluate(() => {
    const book = document.querySelector(".journal-book")?.getBoundingClientRect();
    const card = document.querySelector<HTMLElement>(".journal-hearts-card");
    const close = document.querySelector(".journal-hearts-close")?.getBoundingClientRect();
    const tiles = [...document.querySelectorAll(".journal-heart-tile")];
    const svgs = [...document.querySelectorAll(".journal-hearts-card svg")];
    if (!book || !card || !close) return null;
    const rect = card.getBoundingClientRect();
    return {
      insideBook:
        rect.left >= book.left - 1 &&
        rect.right <= book.right + 1 &&
        rect.top >= book.top - 1 &&
        rect.bottom <= book.bottom + 1,
      noHorizontalOverflow: card.scrollWidth <= card.clientWidth + 1,
      noVerticalScroll: card.scrollHeight <= card.clientHeight + 1,
      closeSize: Math.min(close.width, close.height),
      tileCount: tiles.length,
      svgCount: svgs.length,
      svgTextNodes: svgs.reduce((sum, svg) => sum + svg.querySelectorAll("text").length, 0),
    };
  });
}

test.describe("Milestone 191: Party Heart-to-Heart Scrapbook Album & Warm Hearth Hearts", () => {
  test(
    "scores live Heart-to-Heart with Warm Hearth Hearts and renders 2/6 & 6/6 Scrapbook Album",
    { tag: "@smoke" },
    async ({ page }, testInfo) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      // 1. Trigger a live Heart-to-Heart in Fae's bedroom -> soundtrack switches to "hearts".
      await page.setViewportSize({ width: 1280, height: 720 });
      await openHarness(page);
      await page.keyboard.press("Enter");
      await expect.poll(() => page.evaluate(() => window.__cloverhollow?.boot.title())).toBeNull();
      await resetPaused(page, "new-game");
      await setInkFlags(page, { ate_breakfast: true });

      const beforeMusic = await page.evaluate(() => window.__cloverhollow?.sound.music());
      expect(beforeMusic?.track).toBe("home");

      await walk(page, "y", 485);
      await walk(page, "x", 700);
      await tapKey(page, "ArrowLeft");
      await expect(page.locator(".sticker-prompt")).toHaveAttribute("data-tone", "heart");

      await tapKey(page, "Enter");
      expect((await readState(page)).dialogue?.knot).toBe("h2h_fae_maddie");
      await expect
        .poll(() => page.evaluate(() => window.__cloverhollow?.sound.music()))
        .toMatchObject({
          track: "hearts",
          title: "Warm Hearth Hearts",
          ambience: "none",
          duck: true,
        });

      // 2. Mid-journey Scrapbook Album at 1280x720 (2 done, 2 ready, 2 locked, zero Milo spoilers).
      await resetPaused(page, "plaza");
      await setInkFlags(page, {
        cavern_chime_rung: true,
        spice_returned: true,
        ate_breakfast: true,
        h2h_fae_maddie_done: true,
        sue_joined: true,
        bluebird_calmed: true,
        h2h_fae_sue_done: true,
        jordan_joined: true,
        has_lantern: true,
        h2h_fae_jordan_done: false,
        h2h_sue_jordan_done: false,
        clubhouse_claimed: false,
        h2h_clubhouse_trio_done: false,
        milo_revealed: false,
        h2h_sanctuary_encore_done: false,
      });

      await tapKey(page, "j");
      await expect(page.locator(".journal-book")).toBeVisible();
      await page.locator(".journal-map-tab").click();
      await expect(page.locator(".journal-book")).toHaveAttribute("data-journal-page", "map");
      await page.locator(".journal-treasures-btn").click();
      await expect(page.locator(".journal-treasures-card")).toBeVisible();

      const heartsBtn = page.locator(".journal-hearts-btn");
      await expect(heartsBtn).toBeVisible();
      await expect(heartsBtn).toHaveText("♥ Hearts · 2/6");
      await heartsBtn.click();

      const album = page.locator(".journal-hearts-card");
      await expect(album).toBeVisible();
      await settleAnimations(page, ".journal-hearts-overlay");
      await expect(album.locator(".journal-hearts-title")).toHaveText("HEART-TO-HEARTS");
      await expect(album.locator(".journal-hearts-count")).toHaveText("2/6");
      await expect(album.locator(".journal-heart-tile.is-done")).toHaveCount(2);
      await expect(album.locator(".journal-heart-tile.is-ready")).toHaveCount(2);
      await expect(album.locator(".journal-heart-tile.is-locked")).toHaveCount(2);

      // Spoiler guard on locked sanctuary-encore: zero Milo text anywhere in modal.
      const encoreTile = album.locator('.journal-heart-tile[data-heart="sanctuary-encore"]');
      await expect(encoreTile).toContainText("Secret Meadow Gathering");
      await expect(encoreTile).toContainText("Whole Crew");
      await expect(encoreTile).toContainText(
        "Calm the Enchanted Forest to gather everyone at the Wildlife Sanctuary.",
      );
      expect(await album.innerText()).not.toMatch(/milo/i);

      // Verify crisp 1280x720 geometry & zero <text> SVG nodes.
      expect(await readHeartsGeometry(page)).toEqual({
        insideBook: true,
        noHorizontalOverflow: true,
        noVerticalScroll: true,
        closeSize: 44,
        tileCount: 6,
        svgCount: 7,
        svgTextNodes: 0,
      });

      // Capture 1280x720 review shot before testing keyboard focus rings.
      await captureReview(page, testInfo, "m191-hearts-album-1280");

      // Verify 2D arrow/Home/End keyboard navigation across the 2x3 card grid.
      const tile0 = album.locator('.journal-heart-tile[data-heart="fae-maddie"]');
      const tile1 = album.locator('.journal-heart-tile[data-heart="fae-sue"]');
      const tile3 = album.locator('.journal-heart-tile[data-heart="sue-jordan"]');
      const tile5 = album.locator('.journal-heart-tile[data-heart="sanctuary-encore"]');
      await page.keyboard.press("ArrowRight");
      await expect(tile0).toBeFocused();
      await page.keyboard.press("ArrowRight");
      await expect(tile1).toBeFocused();
      await page.keyboard.press("ArrowDown");
      await expect(tile3).toBeFocused();
      await page.keyboard.press("End");
      await expect(tile5).toBeFocused();
      await page.keyboard.press("Home");
      await expect(tile0).toBeFocused();

      // Escape dismisses Heart-to-Hearts, restores Field Treasures, and focuses the trigger button.
      await page.keyboard.press("Escape");
      await step(page, 1);
      await expect(album).toBeHidden();
      await expect(page.locator(".journal-treasures-card")).toBeVisible();
      await expect(heartsBtn).toBeFocused();

      // Close Field Treasures & Journal cleanly.
      await page.keyboard.press("Escape");
      await step(page, 1);
      await tapKey(page, "j");
      await expect(page.locator(".journal-book")).toBeHidden();

      // 3. Complete 6/6 celebration state at 874x402 phone viewport.
      await setInkFlags(page, {
        cavern_chime_rung: true,
        spice_returned: true,
        ate_breakfast: true,
        sue_joined: true,
        bluebird_calmed: true,
        jordan_joined: true,
        has_lantern: true,
        clubhouse_claimed: true,
        milo_revealed: true,
        h2h_fae_maddie_done: true,
        h2h_fae_sue_done: true,
        h2h_fae_jordan_done: true,
        h2h_sue_jordan_done: true,
        h2h_clubhouse_trio_done: true,
        h2h_sanctuary_encore_done: true,
      });

      await page.setViewportSize({ width: 874, height: 402 });
      await step(page, 2);

      await tapKey(page, "j");
      await expect(page.locator(".journal-book")).toBeVisible();
      await page.locator(".journal-map-tab").click();
      await expect(page.locator(".journal-book")).toHaveAttribute("data-journal-page", "map");
      await page.locator(".journal-treasures-btn").click();
      await expect(page.locator(".journal-treasures-card")).toBeVisible();

      await expect(heartsBtn).toHaveClass(/is-complete/);
      await expect(heartsBtn).toHaveText("♥ Hearts · 6/6");
      await heartsBtn.click();

      await expect(album).toBeVisible();
      await settleAnimations(page, ".journal-hearts-overlay");
      await expect(album.locator(".journal-hearts-count")).toHaveClass(/is-complete/);
      await expect(album.locator(".journal-hearts-count")).toHaveText("♥ 6/6 ALL HEARTS SHARED!");
      await expect(album.locator(".journal-heart-tile.is-done")).toHaveCount(6);
      await expect(album.locator(".journal-heart-tile.is-ready")).toHaveCount(0);
      await expect(album.locator(".journal-heart-tile.is-locked")).toHaveCount(0);
      await expect(album.locator(".journal-hearts-footer")).toHaveClass(/is-complete/);
      await expect(album.locator(".journal-hearts-footer")).toHaveText(
        "♥ All 6 Heart-to-Hearts Shared — True Cloverhollow Best Friends!",
      );

      expect(await readHeartsGeometry(page)).toEqual({
        insideBook: true,
        noHorizontalOverflow: true,
        noVerticalScroll: true,
        closeSize: 44,
        tileCount: 6,
        svgCount: 7,
        svgTextNodes: 0,
      });

      await captureReview(page, testInfo, "m191-hearts-album-874");
      expect(errors).toEqual([]);
    },
  );
});
