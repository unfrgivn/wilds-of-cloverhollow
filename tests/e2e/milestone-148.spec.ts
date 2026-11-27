import { expect, test, type Page } from "@playwright/test";
import { longFlowTimeout, readState, renderInfo, step, walk } from "./helpers";

async function tapKey(page: Page, key: string): Promise<void> {
  await page.keyboard.down(key);
  await step(page, 1);
  await page.keyboard.up(key);
  await step(page, 2);
}

test.describe("Milestone 148: NOTES Column Scrolling & Chatter Overlay Guard", () => {
  test.setTimeout(longFlowTimeout);

  test(
    "Shift+Arrows and focused NOTES page scroll left column while Fae stays frozen",
    { tag: "@smoke" },
    async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto("./?qa=forest");
      await page.waitForFunction(() => Boolean(window.__cloverhollow));
      await page.evaluate(() => window.__cloverhollow?.pause());
      await step(page, 1);

      const beforePlayer = (await readState(page)).player;

      await tapKey(page, "j");
      const book = page.locator(".journal-book");
      const notesPage = page.locator(".journal-notes-page");
      const stickersPage = page.locator(".journal-stickers-page");
      await expect(book).toBeVisible();
      await expect(book).toHaveAttribute("data-journal-page", "notes");
      await expect(notesPage).toHaveAttribute("tabindex", "0");
      await expect(notesPage).toHaveAttribute("aria-label", "Journal notes");

      const initialMetrics = await notesPage.evaluate((node) => ({
        scrollTop: node.scrollTop,
        maxScroll: node.scrollHeight - node.clientHeight,
      }));
      expect(initialMetrics.scrollTop).toBe(0);
      expect(initialMetrics.maxScroll).toBeGreaterThan(20);

      // 1. Shift+ArrowDown scrolls .journal-notes-page directly without leaking to stickers.
      for (let count = 0; count < 3; count += 1) {
        await page.keyboard.press("Shift+ArrowDown");
        await step(page, 1);
      }
      const afterShiftDown = await notesPage.evaluate((node) => node.scrollTop);
      const stickersAfterShift = await stickersPage.evaluate((node) => node.scrollTop);
      expect(afterShiftDown).toBeGreaterThan(0);
      expect(stickersAfterShift).toBe(0);
      expect((await readState(page)).player).toEqual(beforePlayer);

      // Shift+ArrowUp scrolls .journal-notes-page cleanly back to the top.
      for (let count = 0; count < 4; count += 1) {
        await page.keyboard.press("Shift+ArrowUp");
        await step(page, 1);
      }
      expect(await notesPage.evaluate((node) => node.scrollTop)).toBe(0);

      // 2. Focusing .journal-notes-page lets plain ArrowDown / ArrowUp scroll it directly.
      await notesPage.focus();
      await expect(notesPage).toBeFocused();
      for (let count = 0; count < 2; count += 1) {
        await page.keyboard.press("ArrowDown");
        await step(page, 1);
      }
      const afterFocusedDown = await notesPage.evaluate((node) => node.scrollTop);
      expect(afterFocusedDown).toBeGreaterThan(0);
      expect(await stickersPage.evaluate((node) => node.scrollTop)).toBe(0);

      for (let count = 0; count < 3; count += 1) {
        await page.keyboard.press("ArrowUp");
        await step(page, 1);
      }
      expect(await notesPage.evaluate((node) => node.scrollTop)).toBe(0);
      expect((await readState(page)).player).toEqual(beforePlayer);
      expect(errors).toEqual([]);
    },
  );

  test(
    "Photo Mode (KeyP) in Town Plaza defensively hides .npc-chatter",
    { tag: "@smoke" },
    async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto("./?qa=fountain-frog");
      await page.waitForFunction(() => Boolean(window.__cloverhollow));
      await page.evaluate(() => window.__cloverhollow?.pause());
      await step(page, 2);

      const initialState = await readState(page);
      expect(initialState.area).toBe("plaza");
      const npcIds = (await renderInfo(page)).npcs.map((npc) => npc.id);
      expect(npcIds).toEqual(expect.arrayContaining(["flora", "gus", "sammy"]));

      // Walk near Sammy so living NPC chatter is active before opening Photo Mode.
      await walk(page, "y", 890);
      await walk(page, "x", 1430);
      let sawChatter = false;
      for (let tick = 0; tick < 360; tick += 4) {
        const info = await renderInfo(page);
        if (info.npcLife.chatter !== null) {
          sawChatter = true;
          break;
        }
        await step(page, 4);
      }
      expect(sawChatter).toBe(true);
      const chatter = page.locator(".npc-chatter");
      await expect(chatter).toBeVisible();

      // Enter Photo Mode with real KeyP -> html[data-photo="on"] hides .npc-chatter defensively.
      await page.keyboard.press("p");
      await step(page, 2);
      await expect(page.locator("html")).toHaveAttribute("data-photo", "on");
      await expect(chatter).toBeHidden();

      const photoDisplay = await chatter.evaluate((node) => {
        if (!(node instanceof HTMLElement)) return "";
        const wasHidden = node.hidden;
        node.hidden = false;
        const display = getComputedStyle(node).display;
        node.hidden = wasHidden;
        return display;
      });
      expect(photoDisplay).toBe("none");

      await page.keyboard.press("Escape");
      await step(page, 2);
      await expect(page.locator("html")).not.toHaveAttribute("data-photo", "on");
      expect(errors).toEqual([]);
    },
  );
});
