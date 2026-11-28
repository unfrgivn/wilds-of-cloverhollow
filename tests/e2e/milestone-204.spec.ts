import { expect, test, type Page } from "@playwright/test";
import { longFlowTimeout, openHarness, readState, resetPaused, step } from "./helpers";

test.describe.configure({ timeout: longFlowTimeout });

async function tapKey(page: Page, key: string): Promise<void> {
  await page.keyboard.down(key);
  await step(page, 1);
  await page.keyboard.up(key);
  await step(page, 2);
}

async function patchJournalData(page: Page): Promise<void> {
  const backup = await page.evaluate(() => {
    const raw = window.__cloverhollow?.save.exportBackup?.();
    if (raw === undefined) return null;
    const isObj = (v: unknown): v is Record<string, unknown> =>
      typeof v === "object" && v !== null && !Array.isArray(v);
    const env: unknown = JSON.parse(raw);
    if (!isObj(env) || typeof env.save !== "string") return null;
    const payload: unknown = JSON.parse(env.save);
    if (!isObj(payload) || !isObj(payload.state)) return null;
    const st = payload.state;
    if (typeof st.ink !== "string") return null;
    const inkObj: unknown = JSON.parse(st.ink);
    if (!isObj(inkObj) || !isObj(inkObj.variablesState)) return null;
    inkObj.variablesState.gem_park = true;
    inkObj.variablesState.gem_bay = true;
    inkObj.variablesState.gem_pass = true;
    inkObj.variablesState.buster_quest = true;
    inkObj.variablesState.stamp_bay = true;
    inkObj.variablesState.clubhouse_claimed = true;
    inkObj.variablesState.sanctuary_reward_14 = true;
    st.ink = JSON.stringify(inkObj);
    st.stickers = ["fountain-frog", "pond-pup", "ribbon-bunny"];
    st.caughtFish = { minnow: 2, perch: 1 };
    return JSON.stringify(payload);
  });
  expect(backup).not.toBeNull();
  const imported = await page.evaluate(async (saveJson) => {
    const hook = window.__cloverhollow;
    if (hook?.save.importBackup === undefined || saveJson === null) return false;
    return hook.save.importBackup(saveJson);
  }, backup);
  expect(imported).toBe(true);
  await step(page, 2);
}

async function scrollMetrics(page: Page, selector: string): Promise<{
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
}> {
  return page.evaluate((sel) => {
    const node = document.querySelector<HTMLElement>(sel);
    if (node === null) throw new Error(`Missing element ${sel}`);
    return {
      scrollTop: node.scrollTop,
      scrollHeight: node.scrollHeight,
      clientHeight: node.clientHeight,
    };
  }, selector);
}

test.describe("Milestone 204: Full Keyboard Scrolling Across Journal Modal Cards", () => {
  test(
    "scrolls Grand 16-Ribbon Tapestry & Field Treasures with keyboard keys without moving Fae",
    { tag: "@smoke" },
    async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      // 667x375 compact phone landscape triggers the 2-col x 8-row scrollable Merit Tapestry.
      await page.setViewportSize({ width: 667, height: 375 });
      await openHarness(page);
      await resetPaused(page, "plaza");
      await patchJournalData(page);

      const startPos = (await readState(page)).player;

      await tapKey(page, "j");
      const book = page.locator(".journal-book");
      await expect(book).toBeVisible();

      const banner = page.locator(".journal-ribbons-banner");
      await banner.scrollIntoViewIfNeeded();
      await expect(banner).toBeVisible();
      await banner.click();

      const ribbonsOverlay = page.locator(".journal-ribbons-overlay");
      await expect(ribbonsOverlay).toBeVisible();

      const initial = await scrollMetrics(page, ".journal-ribbons-card");
      expect(initial.scrollHeight).toBeGreaterThan(initial.clientHeight + 1);
      expect(initial.scrollTop).toBe(0);

      await page.keyboard.press("ArrowDown");
      const afterArrowDown = await scrollMetrics(page, ".journal-ribbons-card");
      expect(afterArrowDown.scrollTop).toBeGreaterThan(0);

      await page.keyboard.press("PageDown");
      const afterPageDown = await scrollMetrics(page, ".journal-ribbons-card");
      expect(afterPageDown.scrollTop).toBeGreaterThan(afterArrowDown.scrollTop);
      // PageDown stays inside the modal and never flips the Journal page behind it.
      await expect(ribbonsOverlay).toBeVisible();
      await expect(book).toHaveAttribute("data-journal-page", "notes");

      await page.keyboard.press("End");
      const atEnd = await scrollMetrics(page, ".journal-ribbons-card");
      const maxScroll = Math.max(0, atEnd.scrollHeight - atEnd.clientHeight);
      expect(atEnd.scrollTop).toBeGreaterThanOrEqual(Math.max(1, maxScroll - 2));

      await page.keyboard.press("Home");
      const atHome = await scrollMetrics(page, ".journal-ribbons-card");
      expect(atHome.scrollTop).toBe(0);

      // Step ticks and confirm Fae never moved while scrolling the modal.
      await step(page, 2);
      const afterPos = (await readState(page)).player;
      expect(afterPos.x).toBe(startPos.x);
      expect(afterPos.y).toBe(startPos.y);

      await page.keyboard.press("Escape");
      await expect(ribbonsOverlay).toBeHidden();
      await expect(book).toBeVisible();

      // Switch to 874x402 phone landscape and verify Field Treasures Card keyboard scrolling.
      await page.setViewportSize({ width: 874, height: 402 });
      await page.keyboard.press("ArrowRight");
      await expect(book).toHaveAttribute("data-journal-page", "map");

      const treasuresBtn = page.locator(".journal-treasures-btn");
      await expect(treasuresBtn).toBeVisible();
      await treasuresBtn.click();

      const treasuresBackdrop = page.locator(".journal-treasures-backdrop");
      await expect(treasuresBackdrop).toBeVisible();

      const trInit = await scrollMetrics(page, ".journal-treasures-card");
      expect(trInit.scrollHeight).toBeGreaterThan(trInit.clientHeight + 1);
      expect(trInit.scrollTop).toBe(0);

      await page.keyboard.press("ArrowDown");
      const trDown = await scrollMetrics(page, ".journal-treasures-card");
      expect(trDown.scrollTop).toBeGreaterThan(0);

      await page.keyboard.press("Home");
      const trHome = await scrollMetrics(page, ".journal-treasures-card");
      expect(trHome.scrollTop).toBe(0);

      await page.keyboard.press("Escape");
      await expect(treasuresBackdrop).toBeHidden();
      await expect(book).toBeVisible();
      expect(errors).toEqual([]);
    },
  );

  test(
    "scrolls Star Gem Field Ledger with ArrowDown/Home on compact phone and closes with Escape",
    { tag: "@smoke" },
    async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      // 540x360 compact viewport triggers the 1-col x 7-row scrollable Star Gem Field Ledger.
      await page.setViewportSize({ width: 540, height: 360 });
      await openHarness(page);
      await resetPaused(page, "plaza");
      await patchJournalData(page);

      const startPos = (await readState(page)).player;

      await tapKey(page, "j");
      const book = page.locator(".journal-book");
      await expect(book).toBeVisible();

      const gemsPill = page.locator("button.journal-supply.journal-gems");
      await expect(gemsPill).toBeVisible();
      await gemsPill.click();

      const overlay = page.locator(".journal-gems-overlay");
      await expect(overlay).toBeVisible();

      const initial = await scrollMetrics(page, ".journal-gems-card");
      expect(initial.scrollHeight).toBeGreaterThan(initial.clientHeight + 1);
      expect(initial.scrollTop).toBe(0);

      await page.keyboard.press("ArrowDown");
      const afterArrowDown = await scrollMetrics(page, ".journal-gems-card");
      expect(afterArrowDown.scrollTop).toBeGreaterThan(0);

      await page.keyboard.press("PageDown");
      const afterPageDown = await scrollMetrics(page, ".journal-gems-card");
      expect(afterPageDown.scrollTop).toBeGreaterThan(afterArrowDown.scrollTop);
      await expect(overlay).toBeVisible();
      await expect(book).toHaveAttribute("data-journal-page", "notes");

      await page.keyboard.press("Home");
      const atHome = await scrollMetrics(page, ".journal-gems-card");
      expect(atHome.scrollTop).toBe(0);

      await step(page, 2);
      const afterPos = (await readState(page)).player;
      expect(afterPos.x).toBe(startPos.x);
      expect(afterPos.y).toBe(startPos.y);

      await page.keyboard.press("Escape");
      await expect(overlay).toBeHidden();
      await expect(book).toBeVisible();

      // Also verify 874x402 phone landscape keeps PageDown/ArrowDown trapped cleanly in modal.
      await page.setViewportSize({ width: 874, height: 402 });
      await gemsPill.click();
      await expect(overlay).toBeVisible();
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("PageDown");
      await page.keyboard.press("Home");
      await expect(overlay).toBeVisible();
      await expect(book).toHaveAttribute("data-journal-page", "notes");
      await page.keyboard.press("Escape");
      await expect(overlay).toBeHidden();
      expect(errors).toEqual([]);
    },
  );
});
