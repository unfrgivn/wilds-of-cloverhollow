import { expect, test, type Page } from "@playwright/test";
import { longFlowTimeout, openHarness, readState, resetPaused, step } from "./helpers";

test.describe.configure({ timeout: longFlowTimeout });

async function tapKey(page: Page, key: string): Promise<void> {
  await page.keyboard.down(key);
  await step(page, 1);
  await page.keyboard.up(key);
  await step(page, 2);
}

async function patchJournalCollections(page: Page): Promise<void> {
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

async function activeTileIndex(page: Page, selector: string): Promise<number> {
  return page.evaluate((sel) => {
    const active = document.activeElement;
    if (!(active instanceof HTMLElement)) return -1;
    const tiles = [...document.querySelectorAll<HTMLElement>(sel)];
    return tiles.indexOf(active);
  }, selector);
}

test.describe("Milestone 235: Ribbons & Star Gems 2D Keyboard & VoiceOver Tile Parity", () => {
  test(
    "navigates 16-Ribbon Tapestry & Star Gem Ledger tiles via 2D arrows, Home & End",
    { tag: "@smoke" },
    async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      await page.setViewportSize({ width: 1280, height: 720 });
      await openHarness(page);
      await resetPaused(page, "plaza");
      await patchJournalCollections(page);

      const startPos = (await readState(page)).player;

      await tapKey(page, "j");
      const book = page.locator(".journal-book");
      await expect(book).toBeVisible();

      // 1. Grand 16-Ribbon Merit Tapestry (4-column grid at 1280x720)
      const banner = page.locator(".journal-ribbons-banner");
      await banner.scrollIntoViewIfNeeded();
      await expect(banner).toBeVisible();
      await banner.click();

      const ribbonsOverlay = page.locator(".journal-ribbons-overlay");
      await expect(ribbonsOverlay).toBeVisible();
      await expect(page.locator(".journal-ribbons-grid")).toHaveAttribute("role", "list");

      const ribbonSel = '.journal-ribbon-tile[tabindex="0"][role="listitem"]';
      const ribbonTiles = page.locator(ribbonSel);
      await expect(ribbonTiles).toHaveCount(16);

      const ribbonLabelsValid = await page.evaluate((sel) => {
        const nodes = [...document.querySelectorAll<HTMLElement>(sel)];
        return (
          nodes.length === 16 &&
          nodes.every((node) => (node.getAttribute("aria-label") ?? "").trim().length > 10)
        );
      }, ribbonSel);
      expect(ribbonLabelsValid).toBe(true);

      await page.keyboard.press("ArrowRight");
      expect(await activeTileIndex(page, ribbonSel)).toBe(0);

      await page.keyboard.press("ArrowRight");
      expect(await activeTileIndex(page, ribbonSel)).toBe(1);

      await page.keyboard.press("ArrowDown");
      expect(await activeTileIndex(page, ribbonSel)).toBe(5);

      await page.keyboard.press("ArrowUp");
      expect(await activeTileIndex(page, ribbonSel)).toBe(1);

      await page.keyboard.press("ArrowLeft");
      expect(await activeTileIndex(page, ribbonSel)).toBe(0);

      await page.keyboard.press("End");
      expect(await activeTileIndex(page, ribbonSel)).toBe(15);

      await page.keyboard.press("Home");
      expect(await activeTileIndex(page, ribbonSel)).toBe(0);

      await page.keyboard.press("Escape");
      await expect(ribbonsOverlay).toBeHidden();
      await expect(book).toBeVisible();
      await expect(banner).toBeFocused();

      // 2. Star Gem Field Ledger (2-column grid at 1280x720)
      const gemsPill = page.locator("button.journal-supply.journal-gems");
      await expect(gemsPill).toBeVisible();
      await gemsPill.click();

      const gemsOverlay = page.locator(".journal-gems-overlay");
      await expect(gemsOverlay).toBeVisible();
      await expect(page.locator(".journal-gems-grid")).toHaveAttribute("role", "list");

      const gemSel = '.journal-gem-tile[tabindex="0"][role="listitem"]';
      const gemTiles = page.locator(gemSel);
      await expect(gemTiles).toHaveCount(7);

      const gemLabelsValid = await page.evaluate((sel) => {
        const nodes = [...document.querySelectorAll<HTMLElement>(sel)];
        return (
          nodes.length === 7 &&
          nodes.every((node) => (node.getAttribute("aria-label") ?? "").trim().length > 10)
        );
      }, gemSel);
      expect(gemLabelsValid).toBe(true);

      await page.keyboard.press("ArrowRight");
      expect(await activeTileIndex(page, gemSel)).toBe(0);

      await page.keyboard.press("ArrowRight");
      expect(await activeTileIndex(page, gemSel)).toBe(1);

      await page.keyboard.press("ArrowDown");
      expect(await activeTileIndex(page, gemSel)).toBe(3);

      await page.keyboard.press("ArrowUp");
      expect(await activeTileIndex(page, gemSel)).toBe(1);

      await page.keyboard.press("End");
      expect(await activeTileIndex(page, gemSel)).toBe(6);

      await page.keyboard.press("Home");
      expect(await activeTileIndex(page, gemSel)).toBe(0);

      await page.keyboard.press("Escape");
      await expect(gemsOverlay).toBeHidden();
      await expect(book).toBeVisible();
      await expect(gemsPill).toBeFocused();

      await step(page, 2);
      const afterPos = (await readState(page)).player;
      expect(afterPos.x).toBe(startPos.x);
      expect(afterPos.y).toBe(startPos.y);
      expect(errors).toEqual([]);
    },
  );
});
