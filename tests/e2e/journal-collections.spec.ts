import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { openHarness, renderInfo, resetPaused, step } from "./helpers";

async function press(page: Page, key: string): Promise<void> {
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

async function measureCollectionContrast(
  page: Page,
  selector: string,
): Promise<{ label: string; ratio: number }[]> {
  return page.evaluate((query) => {
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
    const background = (element: Element): string | null => {
      for (let node: Element | null = element; node !== null; node = node.parentElement) {
        const colour = getComputedStyle(node).backgroundColor;
        const alpha = parse(colour)[3] ?? 1;
        if (alpha === 0) continue;
        return alpha === 1 ? colour : null;
      }
      return null;
    };
    return [...document.querySelectorAll(query)]
      .filter((element) => element.getClientRects().length > 0)
      .map((element) => {
        const back = background(element);
        const text = luminance(getComputedStyle(element).color);
        const behind = back === null ? text : luminance(back);
        return {
          label: `${element.className} "${(element.textContent ?? "").trim()}"`,
          ratio: (Math.max(text, behind) + 0.05) / (Math.min(text, behind) + 0.05),
        };
      });
  }, selector);
}

test(
  "fresh journal hides empty Fish & Keepsakes shelves and completion ribbons",
  { tag: "@smoke" },
  async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await openHarness(page);
    await resetPaused(page, "plaza");

    await press(page, "j");
    await expect(page.locator(".journal-book")).toBeVisible();
    await expect(page.locator(".journal-fish-heading")).toHaveCount(0);
    await expect(page.locator(".journal-fish")).toHaveCount(0);
    await expect(page.locator(".journal-keepsakes-heading")).toHaveCount(0);
    await expect(page.locator(".journal-keepsakes")).toHaveCount(0);
    await expect(page.locator(".journal-complete-ribbon")).toHaveCount(0);

    await page.locator(".journal-map-tab").click();
    await expect(page.locator(".journal-book")).toHaveAttribute("data-journal-page", "map");
    await expect(page.locator('.journal-map-pill[data-stat="fish"]')).toHaveCount(0);
    await expect(page.locator('.journal-map-pill[data-stat="keepsakes"]')).toHaveCount(0);
  },
);

test(
  "complete journal shows Fish Catch Book, 8 Keepsakes Gallery, ribbons, pills & display",
  { tag: "@smoke" },
  async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("./?qa=fountain-frog");
    await page.waitForFunction(() => Boolean(window.__cloverhollow));
    await page.evaluate(() => window.__cloverhollow?.pause());
    await step(page, 1);

    await runQaCommands(page, ["fish all", "keepsakes on", "stickers all", "prizes all"]);

    await press(page, "j");
    await expect(page.locator(".journal-book")).toBeVisible();

    // Completion ribbons on Stickers, Prizes, Fish, and Keepsakes headings.
    await expect(page.locator(".journal-stickers-page .journal-complete-ribbon")).toHaveCount(4);
    await expect(page.locator(".journal-fish-heading")).toContainText("FISH");
    await expect(page.locator(".journal-fish-heading")).toContainText("6/6");
    await expect(page.locator(".journal-fish-heading")).toContainText("★ Complete!");
    await expect(page.locator(".journal-keepsakes-heading")).toContainText("KEEPSAKES");
    await expect(page.locator(".journal-keepsakes-heading")).toContainText("9/9");
    await expect(page.locator(".journal-keepsakes-heading")).toContainText("★ Complete!");

    // Wait for lazily decoded fish atlas to paint on all 6 fish slots.
    const fishSlots = page.locator('.journal-fish .journal-slot[data-owned="true"]');
    await expect(fishSlots).toHaveCount(6);
    await expect.poll(() =>
      page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>(".journal-fish .journal-sticker-image")]
          .every((node) => node.style.backgroundImage.includes("fish-catches")),
      ),
    ).toBe(true);
    await expect(page.locator('.journal-fish .journal-slot[data-fish="starfish"]'))
      .toHaveClass(/is-rare/);
    await expect(page.locator('.journal-fish .journal-slot[data-fish="jelly"]'))
      .toHaveClass(/is-rare/);

    // Verify all 9 keepsake charms render inline SVG with zero <text> nodes.
    const keepsakeSlots = page.locator('.journal-keepsakes .journal-slot[data-owned="true"]');
    await expect(keepsakeSlots).toHaveCount(9);
    await expect(page.locator('.journal-keepsakes .journal-slot[data-keepsake="clover-wreath"]'))
      .toContainText("Sanctuary Clover Wreath");
    await expect(page.locator('.journal-keepsakes .journal-slot[data-keepsake="sea-compass"]'))
      .toContainText("Sea-Glass Compass");
    await expect(page.locator('.journal-keepsakes .journal-slot[data-keepsake="alpine-clover"]'))
      .toContainText("Pressed Alpine Clover");
    await expect(page.locator('.journal-keepsakes .journal-slot[data-keepsake="star-whistle"]'))
      .toContainText("Golden Star-Line Whistle");
    const svgCheck = await page.evaluate(() => {
      const svgs = [...document.querySelectorAll("svg.journal-keepsake-icon")];
      return {
        count: svgs.length,
        textNodes: svgs.reduce((sum, svg) => sum + svg.querySelectorAll("text").length, 0),
      };
    });
    expect(svgCheck).toEqual({ count: 9, textNodes: 0 });

    // Scroll to the Keepsakes heading so all 8 keepsakes & pill borders fit cleanly in view.
    await page.locator(".journal-keepsakes-heading").evaluate((heading) => {
      heading.scrollIntoView({ block: "start" });
    });
    await step(page, 2);
    await captureReview(page, testInfo, "m96-journal-8-keepsakes");

    // Verify >= 8.5:1 dark-ink contrast on all collection headings, counts, ribbons, and labels.
    const shelfContrast = await measureCollectionContrast(
      page,
      ".journal-fish-heading, .journal-keepsakes-heading, .journal-section-count, " +
        ".journal-complete-ribbon, .journal-fish .journal-name, .journal-keepsakes .journal-name",
    );
    expect(shelfContrast.length).toBeGreaterThanOrEqual(18);
    for (const entry of shelfContrast) {
      expect(entry.ratio, entry.label).toBeGreaterThanOrEqual(8.5);
    }

    // Verify zero horizontal clipping/overflow at both 1280x720 and 874x402.
    for (const size of [{ width: 1280, height: 720 }, { width: 874, height: 402 }]) {
      await page.setViewportSize(size);
      await step(page, 1);
      await page.locator(".journal-keepsakes").scrollIntoViewIfNeeded();
      const layout = await page.evaluate(() => {
        const container = document.querySelector<HTMLElement>(".journal-stickers-page");
        if (container === null) return null;
        const box = container.getBoundingClientRect();
        const items = [
          ...container.querySelectorAll<HTMLElement>(
            ".journal-fish .journal-slot, .journal-keepsakes .journal-slot",
          ),
        ];
        return {
          noHorizontalOverflow: container.scrollWidth <= container.clientWidth + 1,
          allInsideX: items.every((item) => {
            const rect = item.getBoundingClientRect();
            return rect.left >= box.left - 1 && rect.right <= box.right + 1;
          }),
        };
      });
      expect(layout, `${size.width}x${size.height} stickers page`).toEqual({
        noHorizontalOverflow: true,
        allInsideX: true,
      });
    }

    // Switch to MAP tab and verify Fish 6/6 & Keepsakes 8/8 footer pills fit at 1280x720 & 874x402.
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.locator(".journal-map-tab").click();
    await expect(page.locator(".journal-book")).toHaveAttribute("data-journal-page", "map");
    await expect(page.locator('.journal-map-pill[data-stat="fish"]')).toHaveText("Fish 6/6");
    await expect(page.locator('.journal-map-pill[data-stat="keepsakes"]'))
      .toHaveText("Keepsakes 9/9");

    const mapContrast = await measureCollectionContrast(page, ".journal-map-pill");
    expect(mapContrast).toHaveLength(4);
    for (const entry of mapContrast) {
      expect(entry.ratio, entry.label).toBeGreaterThanOrEqual(8.5);
    }

    for (const size of [{ width: 1280, height: 720 }, { width: 874, height: 402 }]) {
      await page.setViewportSize(size);
      await step(page, 1);
      const footerFits = await page.evaluate(() => {
        const footer = document.querySelector<HTMLElement>(".journal-map-footer");
        const pills = [...document.querySelectorAll<HTMLElement>(".journal-map-pill")];
        if (footer === null) return false;
        const box = footer.getBoundingClientRect();
        return footer.scrollWidth <= footer.clientWidth + 1 &&
          pills.every((pill) => {
            const rect = pill.getBoundingClientRect();
            return rect.left >= box.left - 1 && rect.right <= box.right + 1 &&
              rect.top >= box.top - 1 && rect.bottom <= box.bottom + 1;
          });
      });
      expect(footerFits, `${size.width}x${size.height} map footer`).toBe(true);
    }

    // Load Clubhouse with all 13 prizes + all 8 keepsakes (21 total items).
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("./?qa=clubhouse");
    await page.waitForFunction(() => Boolean(window.__cloverhollow));
    await page.evaluate(() => window.__cloverhollow?.pause());
    await step(page, 1);
    await runQaCommands(page, ["prizes all", "stickers all", "keepsakes on"]);

    const clubInfo = await renderInfo(page);
    expect(clubInfo.clubhouseDisplay).toBeGreaterThanOrEqual(22);
    for (const label of [
      "clubhouse:keepsake:clover-wreath",
      "clubhouse:keepsake:sea-compass",
      "clubhouse:keepsake:alpine-clover",
      "clubhouse:keepsake:star-whistle",
    ]) {
      expect(clubInfo.drawOrder.some((item) => item.label === label), label).toBe(true);
    }
    await captureReview(page, testInfo, "m96-clubhouse-21-items");

    expect(errors).toEqual([]);
  },
);

test(
  "interactive Fish & Keepsake Field Note Cards and dynamic Lasso tool controls",
  { tag: "@smoke" },
  async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("./?qa=fountain-frog");
    await page.waitForFunction(() => Boolean(window.__cloverhollow));
    await page.evaluate(() => window.__cloverhollow?.pause());
    await step(page, 1);

    await runQaCommands(page, ["fish all", "keepsakes on", "lantern on", "flute on", "lasso on"]);

    await press(page, "j");
    await expect(page.locator(".journal-book")).toBeVisible();

    // Wait for lazily decoded fish atlas to paint on caught fish slots.
    await expect.poll(() =>
      page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>(".journal-fish .journal-sticker-image")]
          .every((node) => node.style.backgroundImage.includes("fish-catches")),
      ),
    ).toBe(true);

    const checkFieldNoteGeometry = async (label: string): Promise<void> => {
      for (const size of [{ width: 1280, height: 720 }, { width: 874, height: 402 }]) {
        await page.setViewportSize(size);
        await step(page, 1);
        const geom = await page.evaluate(() => {
          const book = document.querySelector(".journal-book")?.getBoundingClientRect();
          const card = document.querySelector<HTMLElement>(".journal-field-note");
          const close = document.querySelector(".journal-field-close")?.getBoundingClientRect();
          if (!book || !card || !close) return null;
          const rect = card.getBoundingClientRect();
          return {
            inside: rect.left >= book.left && rect.right <= book.right &&
              rect.top >= book.top && rect.bottom <= book.bottom,
            noScroll: card.scrollHeight <= card.clientHeight + 1,
            closeSize: Math.min(close.width, close.height),
          };
        });
        expect(geom, `${label} ${size.width}x${size.height}`).toEqual({
          inside: true,
          noScroll: true,
          closeSize: 44,
        });
      }
      await page.setViewportSize({ width: 1280, height: 720 });
      await step(page, 1);
    };

    // 1. Inspect Golden Starfish Crown in the Fish Catch Book.
    const starfishSlot = page.locator(
      '.journal-fish .journal-slot[aria-label="Inspect Golden Starfish Crown"]',
    );
    await starfishSlot.scrollIntoViewIfNeeded();
    await starfishSlot.click();

    const fieldNote = page.locator(".journal-field-note");
    await expect(fieldNote).toBeVisible();
    await expect(fieldNote).toHaveAttribute("data-field-kind", "fish");
    await expect(fieldNote.locator(".journal-field-name")).toHaveText("Golden Starfish Crown");
    await expect(fieldNote.locator(".journal-field-sub")).toHaveText("Bubblegum Bay · Rare Catch");
    await expect(fieldNote.locator(".journal-field-lands")).toHaveText("Bubblegum Bay Dock");
    await expect(fieldNote.locator(".journal-field-calms")).toContainText("+20 coins");
    await expect(fieldNote.locator(".journal-field-specimen")).toHaveClass(/is-rare/);
    await expect(fieldNote.locator(".journal-field-portrait")).toBeVisible();
    await expect(fieldNote.locator(".journal-field-charm")).toBeHidden();
    await expect(fieldNote.locator(".journal-field-blurb")).toContainText("golden starfish");

    await captureReview(page, testInfo, "m104-fish-field-note");
    await checkFieldNoteGeometry("fish field note");

    // Escape closes ONLY the Field Note Card; Journal remains open.
    await page.keyboard.press("Escape");
    await step(page, 1);
    await expect(fieldNote).toBeHidden();
    await expect(page.locator(".journal-book")).toBeVisible();

    // 2. Inspect Sea-Glass Compass in the Keepsakes Gallery.
    const compassSlot = page.locator(
      '.journal-keepsakes .journal-slot[aria-label="Inspect Sea-Glass Compass"]',
    );
    await compassSlot.scrollIntoViewIfNeeded();
    await compassSlot.click();

    await expect(fieldNote).toBeVisible();
    await expect(fieldNote).toHaveAttribute("data-field-kind", "keepsake");
    await expect(fieldNote.locator(".journal-field-name")).toHaveText("Sea-Glass Compass");
    await expect(fieldNote.locator(".journal-field-sub")).toHaveText("Clubhouse Keepsake");
    await expect(fieldNote.locator(".journal-field-lands")).toHaveText("Sue's Beach Cottage");
    await expect(fieldNote.locator(".journal-field-calms")).toHaveText("Clubhouse Crate");
    await expect(fieldNote.locator(".journal-field-portrait")).toBeHidden();
    await expect(fieldNote.locator(".journal-field-charm")).toBeVisible();
    await expect(fieldNote.locator(".journal-field-charm svg.journal-keepsake-icon"))
      .toHaveCount(1);
    await expect(fieldNote.locator(".journal-field-blurb")).toContainText("Bubblegum Bay");

    await captureReview(page, testInfo, "m104-keepsake-field-note");
    await checkFieldNoteGeometry("keepsake field note");

    // Escape closes ONLY the Field Note Card; Journal remains open.
    await page.keyboard.press("Escape");
    await step(page, 1);
    await expect(fieldNote).toBeHidden();
    await expect(page.locator(".journal-book")).toBeVisible();

    // 3. Re-open Keepsake Field Note and verify X (cancel) closes ONLY the card, then closes
    // the Journal on a second X press (Milestone 117).
    await compassSlot.scrollIntoViewIfNeeded();
    await compassSlot.click();
    await expect(fieldNote).toBeVisible();
    await press(page, "x");
    await expect(fieldNote).toBeHidden();
    await expect(page.locator(".journal-book")).toBeVisible();

    // 4. Switch to OPTIONS tab and verify Lantern, Flute, and Lasso tool controls appear.
    await page.locator(".journal-options-tab").click();
    await expect(page.locator(".journal-book")).toHaveAttribute("data-journal-page", "options");
    await expect(page.locator(".journal-controls-tools")).toHaveText(
      "Lantern: L · Flute: F · Lasso: R",
    );

    // Pressing X again with no overlay open closes Fae's Journal cleanly.
    await press(page, "x");
    await expect(page.locator(".journal-book")).toBeHidden();

    expect(errors).toEqual([]);
  },
);
