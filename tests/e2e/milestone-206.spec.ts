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
    inkObj.variablesState.cavern_chime_rung = true;
    inkObj.variablesState.spice_returned = true;
    inkObj.variablesState.ate_breakfast = true;
    inkObj.variablesState.h2h_fae_maddie_done = true;
    inkObj.variablesState.sue_joined = true;
    inkObj.variablesState.bluebird_calmed = true;
    inkObj.variablesState.h2h_fae_sue_done = true;
    inkObj.variablesState.jordan_joined = true;
    inkObj.variablesState.has_lantern = true;
    st.ink = JSON.stringify(inkObj);
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

test.describe("Milestone 206: Hearts Album Scroll & Harmony Flute Wheel Focus", () => {
  test(
    "scrolls Heart-to-Heart Album with PageDown/ArrowDown/Home and closes cleanly with Escape",
    { tag: "@smoke" },
    async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      // Compact landscape viewport where the 2x3 Heart-to-Heart album overflows vertically.
      await page.setViewportSize({ width: 568, height: 320 });
      await openHarness(page);
      await resetPaused(page, "plaza");
      await patchJournalData(page);

      const startPos = (await readState(page)).player;

      await tapKey(page, "j");
      const book = page.locator(".journal-book");
      await expect(book).toBeVisible();
      await page.locator(".journal-map-tab").click();
      await expect(book).toHaveAttribute("data-journal-page", "map");
      await page.locator(".journal-treasures-btn").click();
      await expect(page.locator(".journal-treasures-card")).toBeVisible();

      const heartsBtn = page.locator(".journal-hearts-btn");
      await expect(heartsBtn).toBeVisible();
      await heartsBtn.click();

      const album = page.locator(".journal-hearts-card");
      await expect(album).toBeVisible();

      const initial = await scrollMetrics(page, ".journal-hearts-card");
      expect(initial.scrollHeight).toBeGreaterThan(initial.clientHeight + 1);
      expect(initial.scrollTop).toBe(0);

      await page.keyboard.press("PageDown");
      const afterPageDown = await scrollMetrics(page, ".journal-hearts-card");
      expect(afterPageDown.scrollTop).toBeGreaterThan(0);

      await page.keyboard.press("PageUp");
      const afterPageUp = await scrollMetrics(page, ".journal-hearts-card");
      expect(afterPageUp.scrollTop).toBeLessThan(afterPageDown.scrollTop);

      // ArrowDown focuses tiles and scrolls lower rows cleanly into view.
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("ArrowDown");
      const afterArrowDown = await scrollMetrics(page, ".journal-hearts-card");
      expect(afterArrowDown.scrollTop).toBeGreaterThan(0);

      await page.keyboard.press("Home");
      const atHome = await scrollMetrics(page, ".journal-hearts-card");
      expect(atHome.scrollTop).toBe(0);
      await expect(album.locator('.journal-heart-tile[data-heart="fae-maddie"]')).toBeFocused();

      // Switch to 874x402 phone viewport and confirm PageDown/ArrowDown/Home stay trapped cleanly.
      await page.setViewportSize({ width: 874, height: 402 });
      await page.keyboard.press("PageDown");
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("Home");
      await expect(album).toBeVisible();
      await expect(book).toHaveAttribute("data-journal-page", "map");

      await step(page, 2);
      const afterPos = (await readState(page)).player;
      expect(afterPos.x).toBe(startPos.x);
      expect(afterPos.y).toBe(startPos.y);

      await page.keyboard.press("Escape");
      await expect(album).toBeHidden();
      await expect(page.locator(".journal-treasures-card")).toBeVisible();
      await expect(heartsBtn).toBeFocused();
      expect(errors).toEqual([]);
    },
  );

  test(
    "moves focus into aria-modal Harmony Flute Wheel, plays notes, and restores focus on close",
    { tag: "@smoke" },
    async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      await page.setViewportSize({ width: 1280, height: 720 });
      await openHarness(page);
      await resetPaused(page, "island");

      // Walk north-west into the Starlight Island seashell bell radius (matching island-flute sim).
      await page.keyboard.down("Shift");
      await page.keyboard.down("ArrowLeft");
      await step(page, 14);
      await page.keyboard.up("ArrowLeft");
      await page.keyboard.down("ArrowUp");
      await step(page, 27);
      await page.keyboard.up("ArrowUp");
      await page.keyboard.up("Shift");

      // Focus a connected sentinel button to verify deterministic focus restoration on close.
      await page.evaluate(() => {
        const sentinel = document.createElement("button");
        sentinel.id = "m205-flute-return-sentinel";
        sentinel.type = "button";
        sentinel.textContent = "Sentinel";
        sentinel.style.position = "fixed";
        sentinel.style.left = "-9999px";
        document.body.append(sentinel);
        sentinel.focus();
      });
      await expect(page.locator("#m205-flute-return-sentinel")).toBeFocused();

      // Open Harmony Flute Wheel with real 'f' key.
      await tapKey(page, "f");
      const wheel = page.locator(".flute-wheel");
      await expect(wheel).toBeVisible();
      await expect(wheel).toHaveAttribute("role", "dialog");
      await expect(wheel).toHaveAttribute("aria-modal", "true");
      await expect(wheel).toBeFocused();

      // Play a note via real directional key and via direct compass button click.
      await tapKey(page, "ArrowUp");
      await expect(wheel.locator(".flute-wheel-orb.is-filled")).toHaveCount(1);
      await wheel.locator('.flute-wheel-btn[data-note="right"]').click();
      await step(page, 2);
      await expect(wheel.locator(".flute-wheel-orb.is-filled")).toHaveCount(2);

      // Close Harmony Flute Wheel via its close button and verify focus returns cleanly.
      await wheel.locator(".flute-wheel-close").click();
      await step(page, 2);
      await expect(wheel).toBeHidden();
      await expect(page.locator("#m205-flute-return-sentinel")).toBeFocused();

      await page.evaluate(() => {
        document.getElementById("m205-flute-return-sentinel")?.remove();
      });
      expect(errors).toEqual([]);
    },
  );
});
