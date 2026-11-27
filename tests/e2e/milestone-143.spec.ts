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

async function measureFieldNoteContrast(
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
    // Worst-case (darkest) cream stop of .journal-field-note linear-gradient (#f6eed8).
    const cardCream = luminance("rgb(246, 238, 216)");
    const selector =
      ".journal-field-note .journal-field-name, .journal-field-note .journal-field-sub, " +
      ".journal-field-note .journal-field-key, .journal-field-note .journal-field-val, " +
      ".journal-field-note .journal-field-blurb";
    return [...document.querySelectorAll(selector)]
      .filter((node) => node.getClientRects().length > 0)
      .map((node) => {
        const text = luminance(getComputedStyle(node).color);
        return {
          label: `${node.className} "${(node.textContent ?? "").trim()}"`,
          ratio: (Math.max(text, cardCream) + 0.05) / (Math.min(text, cardCream) + 0.05),
        };
      });
  });
}

test.describe("Milestone 143: Interactive Arcade Prize Field Note Cards", () => {
  test(
    "owned Arcade Prizes open Field Note Cards with zoomed art, lore, foley, and KeyX dismissal",
    { tag: "@smoke" },
    async ({ page }, testInfo) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto("./?qa=fountain-frog");
      await page.waitForFunction(() => Boolean(window.__cloverhollow));
      await page.evaluate(() => window.__cloverhollow?.pause());
      await step(page, 1);

      // Unlock Web Audio with a real key press so card-open / card-close foley records cleanly.
      await tapKey(page, "ArrowRight");

      // 1. Unowned prizes stay non-inspectable ? slots and do not open a card.
      await tapKey(page, "j");
      const book = page.locator(".journal-book");
      await expect(book).toBeVisible();

      const lockedKeychain = page.locator(
        '.journal-prizes .journal-slot[data-prize="star-racer-keychain"]',
      );
      await expect(lockedKeychain).toHaveAttribute("data-owned", "false");
      await expect(lockedKeychain).not.toHaveClass(/is-inspectable/);
      await lockedKeychain.scrollIntoViewIfNeeded();
      await lockedKeychain.click();
      await expect(page.locator(".journal-field-note")).toBeHidden();

      await tapKey(page, "j");
      await expect(book).toBeHidden();

      // 2. Grant all 13 Arcade Prizes and reopen Journal.
      await runQaCommands(page, ["prizes all"]);
      await tapKey(page, "j");
      await expect(book).toBeVisible();

      const ownedPrizes = page.locator('.journal-prizes .journal-slot[data-owned="true"]');
      await expect(ownedPrizes).toHaveCount(13);

      // 3. Inspect a Claw Machine plush (Frog Plush) via click, then dismiss with Escape.
      const frogPlush = page.locator('.journal-prizes .journal-slot[data-prize="frog-plush"]');
      await expect(frogPlush).toHaveAttribute("role", "button");
      await expect(frogPlush).toHaveAttribute("tabindex", "0");
      await expect(frogPlush).toHaveAttribute("aria-label", "Inspect Frog Plush prize note");
      await frogPlush.scrollIntoViewIfNeeded();
      await frogPlush.click();

      const fieldNote = page.locator(".journal-field-note");
      await expect(fieldNote).toBeVisible();
      await expect(fieldNote).toHaveAttribute("role", "dialog");
      await expect(fieldNote).toHaveAttribute("aria-modal", "true");
      await expect(fieldNote).toHaveAttribute("data-field-kind", "prize");
      await expect(fieldNote.locator(".journal-field-name")).toHaveText("Frog Plush");
      await expect(fieldNote.locator(".journal-field-sub")).toHaveText("Arcade Prize");
      await expect(fieldNote.locator(".journal-field-lands")).toHaveText(
        "Claw Machine · Mr. Pip's Arcade",
      );
      await expect(fieldNote.locator(".journal-field-calms")).toHaveText("Clubhouse Shelf");
      await expect(fieldNote.locator(".journal-field-portrait")).toBeVisible();
      await expect(fieldNote.locator(".journal-field-charm")).toBeHidden();
      await expect(fieldNote.locator(".journal-field-blurb")).toContainText("Maddie");

      await page.keyboard.press("Escape");
      await step(page, 1);
      await expect(fieldNote).toBeHidden();
      await expect(book).toBeVisible();

      // 4. Inspect Ticket Counter prize (Star Racer Keychain), check art, contrast, geometry,
      // foley, capture review JPEG, and dismiss ONLY the card with KeyX.
      const beforeCard = await page.evaluate(
        () => (window.__cloverhollow?.sound.effects() ?? []).length,
      );
      const keychainSlot = page.locator(
        '.journal-prizes .journal-slot[data-prize="star-racer-keychain"]',
      );
      await expect(keychainSlot).toHaveAttribute(
        "aria-label",
        "Inspect Star Racer Keychain prize note",
      );
      await keychainSlot.scrollIntoViewIfNeeded();
      await keychainSlot.click();

      await expect(fieldNote).toBeVisible();
      await expect(fieldNote).toHaveAttribute("data-field-kind", "prize");
      await expect(fieldNote.locator(".journal-field-name")).toHaveText("Star Racer Keychain");
      await expect(fieldNote.locator(".journal-field-sub")).toHaveText("Arcade Prize");
      await expect(fieldNote.locator(".journal-field-key").nth(0)).toHaveText("Found");
      await expect(fieldNote.locator(".journal-field-lands")).toHaveText(
        "Ticket Counter · Mr. Pip's Arcade",
      );
      await expect(fieldNote.locator(".journal-field-key").nth(1)).toHaveText("Home");
      await expect(fieldNote.locator(".journal-field-calms")).toHaveText("Clubhouse Shelf");
      await expect(fieldNote.locator(".journal-field-blurb")).toContainText("Milo");

      const portraitBg = await fieldNote
        .locator(".journal-field-portrait")
        .evaluate((node) => (node instanceof HTMLElement ? node.style.backgroundImage : ""));
      expect(portraitBg).toContain("prizes");

      const contrast = await measureFieldNoteContrast(page);
      expect(contrast.length).toBeGreaterThanOrEqual(7);
      for (const entry of contrast) {
        expect(entry.ratio, entry.label).toBeGreaterThanOrEqual(7);
      }

      await captureReview(page, testInfo, "m143-prize-field-note");

      for (const size of [{ width: 1280, height: 720 }, { width: 874, height: 402 }]) {
        await page.setViewportSize(size);
        await step(page, 1);
        const geom = await page.evaluate(() => {
          const bookRect = document.querySelector(".journal-book")?.getBoundingClientRect();
          const card = document.querySelector<HTMLElement>(".journal-field-note");
          const close = document.querySelector(".journal-field-close")?.getBoundingClientRect();
          if (!bookRect || !card || !close) return null;
          const rect = card.getBoundingClientRect();
          return {
            inside:
              rect.left >= bookRect.left &&
              rect.right <= bookRect.right &&
              rect.top >= bookRect.top &&
              rect.bottom <= bookRect.bottom,
            noScroll: card.scrollHeight <= card.clientHeight + 1,
            closeSize: Math.min(close.width, close.height),
          };
        });
        expect(geom, `prize field note ${size.width}x${size.height}`).toEqual({
          inside: true,
          noScroll: true,
          closeSize: 44,
        });
      }

      await page.setViewportSize({ width: 1280, height: 720 });
      await step(page, 1);

      // KeyX dismisses ONLY the Field Note Card; Journal stays open.
      await tapKey(page, "x");
      await expect(fieldNote).toBeHidden();
      await expect(book).toBeVisible();

      const cardEffects = await page.evaluate(
        (start) => [...(window.__cloverhollow?.sound.effects() ?? [])].slice(start),
        beforeCard,
      );
      expect(cardEffects).toEqual(["card-open", "card-close"]);

      // Keyboard Enter on a focused prize slot also opens its Field Note Card cleanly.
      await keychainSlot.focus();
      await page.keyboard.press("Enter");
      await step(page, 1);
      await expect(fieldNote).toBeVisible();
      await expect(fieldNote.locator(".journal-field-name")).toHaveText("Star Racer Keychain");

      await page.locator(".journal-field-close").click();
      await expect(fieldNote).toBeHidden();
      await expect(book).toBeVisible();

      expect(errors).toEqual([]);
    },
  );
});
