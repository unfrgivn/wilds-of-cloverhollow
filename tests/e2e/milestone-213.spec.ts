import { expect, test, type Page } from "@playwright/test";
import { readState, resetPaused, resume, step, walk } from "./helpers";

async function tapKey(page: Page, key: string): Promise<void> {
  await page.keyboard.down(key);
  await step(page, 1);
  await page.keyboard.up(key);
  await step(page, 2);
}

async function advanceToFinalTravelLine(page: Page): Promise<void> {
  for (let count = 0; count < 80; count += 1) {
    const dialogue = (await readState(page)).dialogue;
    if (dialogue === null) throw new Error("dialogue closed before travel line");
    if (dialogue.revealed < dialogue.text.length || dialogue.choices.length > 0) {
      await page.keyboard.press("z");
      await step(page, 2);
      continue;
    }
    return;
  }
  throw new Error("timed out reaching final travel line");
}

test.describe("Milestone 213: Phone Touch Cinema Hygiene", () => {
  test(
    "phone cutscene hides stick & menu while keeping cancel visible for hold-skipping",
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
      await resetPaused(page, "plaza");

      const html = page.locator("html");
      const stick = page.locator(".touch-stick");
      const menu = page.locator(".touch-menu");
      const cancel = page.locator(".touch-cancel");

      await expect(html).toHaveAttribute("data-touch", "on");
      await expect(stick).toBeVisible();
      await expect(menu).toBeVisible();
      await expect(cancel).toBeVisible();

      const started = await page.evaluate(
        () => window.__cloverhollow?.cutscene?.play("plaza-hood-sighting") ?? false,
      );
      expect(started).toBe(true);
      await step(page, 6);

      await expect(html).toHaveAttribute("data-cutscene", "open");
      await expect(stick).toBeHidden();
      await expect(menu).toBeHidden();
      await expect(cancel).toBeVisible();

      await page.keyboard.down("x");
      await step(page, 35);
      await page.keyboard.up("x");
      await step(page, 2);

      expect((await readState(page)).cutscene).toBeUndefined();
      await expect(html).not.toHaveAttribute("data-cutscene", "open");
      await expect(stick).toBeVisible();
      await expect(menu).toBeVisible();

      expect(errors).toEqual([]);
      await context.close();
    },
  );

  test(
    "phone Harmony Flute Wheel hides stick, menu, & confirm while petals stay interactive",
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
      await resetPaused(page, "island");

      // Walk Fae to Starlight Island's seashell resonance bell and play the flute.
      await page.keyboard.down("ShiftLeft");
      await page.keyboard.down("ArrowLeft");
      await step(page, 14);
      await page.keyboard.up("ArrowLeft");
      await page.keyboard.down("ArrowUp");
      await step(page, 27);
      await page.keyboard.up("ArrowUp");
      await page.keyboard.up("ShiftLeft");
      await tapKey(page, "KeyF");

      const html = page.locator("html");
      const wheel = page.locator(".flute-wheel");
      await expect(html).toHaveAttribute("data-flute-wheel", "open");
      await expect(wheel).toBeVisible();

      await expect(page.locator(".touch-stick")).toBeHidden();
      await expect(page.locator(".touch-menu")).toBeHidden();
      await expect(page.locator(".touch-confirm")).toBeHidden();
      await expect(page.locator(".touch-cancel")).toBeVisible();

      // Tap a Harmony Flute Wheel petal and verify the entered note registers cleanly.
      const beforeNotes = (await readState(page)).puzzleArea?.fluteWheel?.noteSeq ?? 0;
      await page.locator('.flute-wheel-btn[data-note="up"]').click();
      await step(page, 2);
      const afterNotes = (await readState(page)).puzzleArea?.fluteWheel?.noteSeq ?? 0;
      expect(afterNotes).toBeGreaterThan(beforeNotes);

      // Close the wheel cleanly -> touch stick, menu, and confirm restore.
      await page.locator(".flute-wheel-close").click();
      await step(page, 2);
      await expect(wheel).toBeHidden();
      await expect(html).not.toHaveAttribute("data-flute-wheel", "open");
      await expect(page.locator(".touch-stick")).toBeVisible();
      await expect(page.locator(".touch-menu")).toBeVisible();
      await expect(page.locator(".touch-confirm")).toBeVisible();

      expect(errors).toEqual([]);
      await context.close();
    },
  );

  test(
    "phone Travel Vignette hides qa-touch-trigger and npc-chatter cleanly",
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
      await resetPaused(page, "island");

      const html = page.locator("html");
      const qaTrigger = page.locator(".qa-touch-trigger");
      await expect(html).toHaveAttribute("data-touch", "on");
      await expect(qaTrigger).toBeVisible();

      await walk(page, "y", 830);
      await walk(page, "x", 405);
      await page.keyboard.down("ArrowLeft");
      await step(page, 2);
      await page.keyboard.up("ArrowLeft");

      await page.keyboard.press("z");
      await step(page, 2);
      expect((await readState(page)).dialogue?.knot).toBe("island_boat");
      await advanceToFinalTravelLine(page);

      await resume(page);
      await page.keyboard.press("z");

      await expect(html).toHaveAttribute("data-travel-vignette", "open", { timeout: 8000 });
      await expect(qaTrigger).toBeHidden();
      await expect(page.locator(".npc-chatter")).toBeHidden();
      await expect(page.locator(".ribbon-toast")).toBeHidden();

      const displays = await page.evaluate(() => {
        const check = (selector: string): string => {
          const el = document.querySelector<HTMLElement>(selector);
          return el === null ? "missing" : window.getComputedStyle(el).display;
        };
        return {
          qaTrigger: check(".qa-touch-trigger"),
          npcChatter: check(".npc-chatter"),
          ribbonToast: check(".ribbon-toast"),
          touchControls: check(".touch-controls"),
        };
      });
      expect(displays).toEqual({
        qaTrigger: "none",
        npcChatter: "none",
        ribbonToast: "none",
        touchControls: "none",
      });

      await page.locator(".travel-overlay").click();
      await expect(html).not.toHaveAttribute("data-travel-vignette", "open", { timeout: 3000 });
      await page.waitForFunction(() => {
        const state = window.__cloverhollow?.getState();
        return state?.area === "bay" && state.transition === null;
      });
      await expect(qaTrigger).toBeVisible();

      expect(errors).toEqual([]);
      await context.close();
    },
  );
});
