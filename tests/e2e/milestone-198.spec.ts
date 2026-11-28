import { expect, test, type Page } from "@playwright/test";
import { readState, renderInfo, resetPaused, step } from "./helpers";

async function tapKey(page: Page, key: string): Promise<void> {
  await page.keyboard.down(key);
  await step(page, 1);
  await page.keyboard.up(key);
  await step(page, 2);
}

async function walkToShrine(page: Page): Promise<void> {
  await page.keyboard.down("ArrowUp");
  await step(page, 60);
  await page.keyboard.up("ArrowUp");
  await page.keyboard.down("ArrowRight");
  await step(page, 30);
  await page.keyboard.up("ArrowRight");
  await step(page, 2);

  for (let guard = 0; guard < 18; guard += 1) {
    const st = await readState(page);
    if (st.player.x >= 764) break;
    await page.keyboard.down("ArrowRight");
    await step(page, 10);
    await page.keyboard.up("ArrowRight");
  }
  for (let guard = 0; guard < 24; guard += 1) {
    const st = await readState(page);
    const info = await renderInfo(page);
    if (st.player.y <= 442 && info.prompt.visible) break;
    await page.keyboard.down("ArrowUp");
    await step(page, 10);
    await page.keyboard.up("ArrowUp");
  }
  await page.keyboard.down("ArrowUp");
  await step(page, 2);
  await page.keyboard.up("ArrowUp");
  await step(page, 2);
}

async function openShrineByDialogue(page: Page): Promise<void> {
  await page.evaluate(() => window.__cloverhollow?.settings.setTextSpeed("instant"));
  for (let guard = 0; guard < 12; guard += 1) {
    const visible = await page.locator(".encore-shrine").isVisible();
    if (visible) return;
    await tapKey(page, "KeyZ");
  }
}

async function readOverlayDisplays(page: Page): Promise<{
  qaTrigger: string;
  npcChatter: string;
  stickerPrompt: string;
  saveToast: string;
  hudHints: string;
}> {
  return page.evaluate(() => {
    const check = (selector: string): string => {
      const el = document.querySelector<HTMLElement>(selector);
      return el === null ? "missing" : window.getComputedStyle(el).display;
    };
    return {
      qaTrigger: check(".qa-touch-trigger"),
      npcChatter: check(".npc-chatter"),
      stickerPrompt: check(".sticker-prompt"),
      saveToast: check(".save-toast"),
      hudHints: check(".hud-hints"),
    };
  });
}

test.describe("Milestone 198: Modal Overlay Suppression & 44 px Touch Hygiene", () => {
  test(
    "phone Decor Picker sets data-decor, hides overworld chrome, and keeps >= 44 px buttons",
    { tag: "@smoke" },
    async ({ browser }) => {
      const context = await browser.newContext({
        viewport: { width: 874, height: 402 },
        hasTouch: true,
      });
      const page = await context.newPage();
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      await page.goto("./?touch=1");
      await page.waitForFunction(() => Boolean(window.__cloverhollow));
      await resetPaused(page, "clubhouse");

      const html = page.locator("html");
      const qaTrigger = page.locator(".qa-touch-trigger");
      await expect(html).toHaveAttribute("data-touch", "on");
      await expect(qaTrigger).toBeVisible();

      // Open Room Decor Picker via real KeyB press.
      await page.keyboard.press("KeyB");
      const picker = page.locator('[data-decor-picker="open"]');
      await expect(picker).toBeVisible();
      await expect(html).toHaveAttribute("data-decor", "open");
      await expect(qaTrigger).toBeHidden();
      await expect(page.locator(".npc-chatter")).toBeHidden();
      await expect(page.locator(".sticker-prompt")).toBeHidden();

      expect(await readOverlayDisplays(page)).toEqual({
        qaTrigger: "none",
        npcChatter: "none",
        stickerPrompt: "none",
        saveToast: "none",
        hudHints: "none",
      });

      // Wait for modal pop-in scale animation to settle before measuring hit targets.
      await page.evaluate(async () => {
        const modal = document.querySelector(".decor-picker-modal");
        if (modal === null) return;
        await Promise.all(modal.getAnimations().map((anim) => anim.finished.catch(() => {})));
      });

      const buttonHeights = await page.evaluate(() => {
        const buttons = [
          ...document.querySelectorAll<HTMLElement>(
            ".decor-close-btn, .decor-btn, .decor-prize-pill",
          ),
        ].filter((el) => el.offsetParent !== null);
        return buttons.map((el) => ({
          label: el.textContent?.trim() ?? el.className,
          height: Math.round(el.getBoundingClientRect().height * 10) / 10,
        }));
      });
      expect(buttonHeights.length).toBeGreaterThanOrEqual(4);
      for (const btn of buttonHeights) {
        expect(btn.height, `button "${btn.label}" height >= 44px`).toBeGreaterThanOrEqual(44);
      }

      // Close Decor Picker via Escape -> overworld QA trigger restores cleanly.
      await page.keyboard.press("Escape");
      await expect(picker).toBeHidden();
      await expect(html).not.toHaveAttribute("data-decor", "open");
      await expect(qaTrigger).toBeVisible();

      expect(errors).toEqual([]);
      await context.close();
    },
  );

  test(
    "phone Dream Memory Shrine sets data-shrine, hides chrome, and restores QA pill on close",
    { tag: "@smoke" },
    async ({ browser }) => {
      const context = await browser.newContext({
        viewport: { width: 874, height: 402 },
        hasTouch: true,
      });
      const page = await context.newPage();
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      await page.goto("./?touch=1");
      await page.waitForFunction(() => Boolean(window.__cloverhollow));
      await resetPaused(page, "festival");
      await step(page, 2);

      const html = page.locator("html");
      const qaTrigger = page.locator(".qa-touch-trigger");
      await expect(html).toHaveAttribute("data-touch", "on");
      await expect(qaTrigger).toBeVisible();

      // Walk Fae to Sanctuary Dream Memory Shrine with real keys and open it via KeyZ.
      await walkToShrine(page);
      await openShrineByDialogue(page);

      const shrine = page.locator(".encore-shrine");
      await expect(shrine).toBeVisible();
      await expect(html).toHaveAttribute("data-shrine", "open");
      await expect(qaTrigger).toBeHidden();
      await expect(page.locator(".sticker-prompt")).toBeHidden();

      expect(await readOverlayDisplays(page)).toEqual({
        qaTrigger: "none",
        npcChatter: "none",
        stickerPrompt: "none",
        saveToast: "none",
        hudHints: "none",
      });

      // Close Shrine via Escape -> data-shrine clears and .qa-touch-trigger restores cleanly.
      await page.keyboard.press("Escape");
      await expect(shrine).toBeHidden();
      await expect(html).not.toHaveAttribute("data-shrine", "open");
      await expect(qaTrigger).toBeVisible();

      expect(errors).toEqual([]);
      await context.close();
    },
  );
});
