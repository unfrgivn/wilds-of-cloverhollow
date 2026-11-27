import { expect, test, type Page, type TestInfo } from "@playwright/test";
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

async function captureReview(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  if (process.env.CLOVERHOLLOW_REVIEW_SHOTS !== "1" || testInfo.project.name !== "chromium")
    return;
  await page.screenshot({
    path: `art/review/${name}.jpg`,
    type: "jpeg",
    quality: 90,
  });
}

async function measurePagerContrast(
  page: Page,
): Promise<{ label: string; ratio: number }[]> {
  return page.evaluate(() => {
    const channel = (value: number): number => {
      const part = value / 255;
      return part <= 0.03928 ? part / 12.92 : ((part + 0.055) / 1.055) ** 2.4;
    };
    const parse = (colour: string): number[] =>
      colour.match(/\d+(?:\.\d+)?/g)?.map(Number) ?? [];
    const luminance = (colour: string): number => {
      const [red = 0, green = 0, blue = 0] = parse(colour);
      return 0.2126 * channel(red) + 0.7152 * channel(green) + 0.0722 * channel(blue);
    };
    const background = (node: Element): string | null => {
      for (let current: Element | null = node; current !== null; current = current.parentElement) {
        const colour = getComputedStyle(current).backgroundColor;
        const alpha = parse(colour)[3] ?? 1;
        if (alpha === 0) continue;
        return alpha === 1 ? colour : null;
      }
      return null;
    };
    const selector = ".journal-field-pager .journal-field-nav, .journal-field-counter";
    return [...document.querySelectorAll(selector)]
      .filter((node) => node.getClientRects().length > 0)
      .map((node) => {
        const text = luminance(getComputedStyle(node).color);
        const back = background(node);
        const behind = back === null ? text : luminance(back);
        return {
          label: `${node.className} "${(node.textContent ?? "").trim()}"`,
          ratio: (Math.max(text, behind) + 0.05) / (Math.min(text, behind) + 0.05),
        };
      });
  });
}

test.describe("Milestone 146: Interactive Scrapbook Specimen Browser", () => {
  test(
    "flips owned specimens with ArrowLeft/ArrowRight and pager clicks, hiding pager at 1 item",
    { tag: "@smoke" },
    async ({ page }, testInfo) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto("./?qa=fountain-frog");
      await page.waitForFunction(() => Boolean(window.__cloverhollow));
      await page.evaluate(() => window.__cloverhollow?.pause());
      await step(page, 1);

      // Unlock Web Audio with a real key press so page-turn foley records cleanly.
      await tapKey(page, "ArrowRight");

      // 1. With only 1 owned sticker (Fountain Frog), the specimen pager stays hidden.
      await tapKey(page, "j");
      const book = page.locator(".journal-book");
      await expect(book).toBeVisible();

      const frogSticker = page.locator(
        '.journal-stickers:not(.journal-prizes) .journal-slot[aria-label="Inspect Fountain Frog"]',
      );
      await frogSticker.click();

      const fieldNote = page.locator(".journal-field-note");
      const pager = fieldNote.locator(".journal-field-pager");
      const counter = fieldNote.locator(".journal-field-counter");
      await expect(fieldNote).toBeVisible();
      await expect(fieldNote.locator(".journal-field-name")).toHaveText("Fountain Frog");
      await expect(pager).toBeHidden();

      const beforeSingleArrow = await page.evaluate(
        () => (window.__cloverhollow?.sound.effects() ?? []).length,
      );
      await page.keyboard.press("ArrowRight");
      await step(page, 1);
      await expect(fieldNote.locator(".journal-field-name")).toHaveText("Fountain Frog");
      const singleArrowEffects = await page.evaluate(
        (start) => [...(window.__cloverhollow?.sound.effects() ?? [])].slice(start),
        beforeSingleArrow,
      );
      expect(singleArrowEffects).toEqual([]);

      await page.keyboard.press("Escape");
      await step(page, 1);
      await expect(fieldNote).toBeHidden();
      await tapKey(page, "j");
      await expect(book).toBeHidden();

      // 2. Grant all 13 Arcade Prizes and open Frog Plush (1 / 13).
      await runQaCommands(page, ["prizes all"]);
      await tapKey(page, "j");
      await expect(book).toBeVisible();

      const frogPlush = page.locator('.journal-prizes .journal-slot[data-prize="frog-plush"]');
      await frogPlush.scrollIntoViewIfNeeded();
      await frogPlush.click();

      await expect(fieldNote).toBeVisible();
      await expect(fieldNote.locator(".journal-field-name")).toHaveText("Frog Plush");
      await expect(pager).toBeVisible();
      await expect(counter).toHaveText("1 / 13");

      // 3. ArrowRight advances to Pup Plush (2 / 13) with page-turn foley.
      const beforeFlip = await page.evaluate(
        () => (window.__cloverhollow?.sound.effects() ?? []).length,
      );
      await page.keyboard.press("ArrowRight");
      await step(page, 1);
      await expect(fieldNote.locator(".journal-field-name")).toHaveText("Pup Plush");
      await expect(counter).toHaveText("2 / 13");

      const flipEffects = await page.evaluate(
        (start) => [...(window.__cloverhollow?.sound.effects() ?? [])].slice(start),
        beforeFlip,
      );
      expect(flipEffects).toEqual(["page-turn"]);

      const contrast = await measurePagerContrast(page);
      expect(contrast).toHaveLength(3);
      for (const entry of contrast) {
        expect(entry.ratio, entry.label).toBeGreaterThanOrEqual(9);
      }

      await captureReview(page, testInfo, "m146-specimen-browser");

      for (const size of [{ width: 1280, height: 720 }, { width: 874, height: 402 }]) {
        await page.setViewportSize(size);
        await step(page, 1);
        const geom = await page.evaluate(() => {
          const bookRect = document.querySelector(".journal-book")?.getBoundingClientRect();
          const card = document.querySelector<HTMLElement>(".journal-field-note");
          const pagerEl = document.querySelector<HTMLElement>(".journal-field-pager");
          const close = document.querySelector(".journal-field-close")?.getBoundingClientRect();
          if (!bookRect || !card || !pagerEl || !close) return null;
          const rect = card.getBoundingClientRect();
          const pagerRect = pagerEl.getBoundingClientRect();
          return {
            inside:
              rect.left >= bookRect.left &&
              rect.right <= bookRect.right &&
              rect.top >= bookRect.top &&
              rect.bottom <= bookRect.bottom,
            pagerInside:
              pagerRect.left >= rect.left &&
              pagerRect.right <= rect.right &&
              pagerRect.top >= rect.top &&
              pagerRect.bottom <= rect.bottom &&
              pagerEl.scrollWidth <= pagerEl.clientWidth + 1,
            noScroll: card.scrollHeight <= card.clientHeight + 1,
            closeSize: Math.min(close.width, close.height),
          };
        });
        expect(geom, `specimen browser ${size.width}x${size.height}`).toEqual({
          inside: true,
          pagerInside: true,
          noScroll: true,
          closeSize: 44,
        });
      }

      await page.setViewportSize({ width: 1280, height: 720 });
      await step(page, 1);

      // 4. ArrowLeft returns to 1 / 13, then wraps cleanly to 13 / 13 (Star Racer Keychain).
      await page.keyboard.press("ArrowLeft");
      await step(page, 1);
      await expect(fieldNote.locator(".journal-field-name")).toHaveText("Frog Plush");
      await expect(counter).toHaveText("1 / 13");

      await page.keyboard.press("ArrowLeft");
      await step(page, 1);
      await expect(fieldNote.locator(".journal-field-name")).toHaveText("Star Racer Keychain");
      await expect(counter).toHaveText("13 / 13");

      // 5. Clicking .journal-field-next wraps back to 1 / 13 (Frog Plush).
      await fieldNote.locator(".journal-field-next").click();
      await step(page, 1);
      await expect(fieldNote.locator(".journal-field-name")).toHaveText("Frog Plush");
      await expect(counter).toHaveText("1 / 13");

      await page.keyboard.press("Escape");
      await step(page, 1);
      await expect(fieldNote).toBeHidden();
      await expect(book).toBeVisible();
      expect(errors).toEqual([]);
    },
  );
});
