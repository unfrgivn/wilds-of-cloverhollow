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
  "complete journal shows Fish Catch Book, 6 Keepsakes Gallery, ribbons, pills & wreath",
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
    await expect(page.locator(".journal-keepsakes-heading")).toContainText("6/6");
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

    // Verify all 6 keepsake charms render inline SVG with zero <text> nodes.
    const keepsakeSlots = page.locator('.journal-keepsakes .journal-slot[data-owned="true"]');
    await expect(keepsakeSlots).toHaveCount(6);
    await expect(page.locator('.journal-keepsakes .journal-slot[data-keepsake="clover-wreath"]'))
      .toContainText("Sanctuary Clover Wreath");
    const svgCheck = await page.evaluate(() => {
      const svgs = [...document.querySelectorAll("svg.journal-keepsake-icon")];
      return {
        count: svgs.length,
        textNodes: svgs.reduce((sum, svg) => sum + svg.querySelectorAll("text").length, 0),
      };
    });
    expect(svgCheck).toEqual({ count: 6, textNodes: 0 });

    // Scroll to the bottom so both Fish Catch Book and 6 Keepsakes Gallery fit cleanly in view.
    await page.evaluate(() => {
      const container = document.querySelector<HTMLElement>(".journal-stickers-page");
      if (container !== null) {
        container.scrollTop = container.scrollHeight - container.clientHeight;
      }
    });
    await step(page, 2);
    await captureReview(page, testInfo, "m95-journal-collections-1280");

    // Verify >= 8.5:1 dark-ink contrast on all collection headings, counts, ribbons, and labels.
    const shelfContrast = await measureCollectionContrast(
      page,
      ".journal-fish-heading, .journal-keepsakes-heading, .journal-section-count, " +
        ".journal-complete-ribbon, .journal-fish .journal-name, .journal-keepsakes .journal-name",
    );
    expect(shelfContrast.length).toBeGreaterThanOrEqual(16);
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

    // Switch to MAP tab and verify Fish 6/6 & Keepsakes 6/6 footer pills fit at 1280x720 & 874x402.
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.locator(".journal-map-tab").click();
    await expect(page.locator(".journal-book")).toHaveAttribute("data-journal-page", "map");
    await expect(page.locator('.journal-map-pill[data-stat="fish"]')).toHaveText("Fish 6/6");
    await expect(page.locator('.journal-map-pill[data-stat="keepsakes"]'))
      .toHaveText("Keepsakes 6/6");

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

    // Load Clubhouse with all 13 prizes + all 6 keepsakes (including Sanctuary Clover Wreath).
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("./?qa=clubhouse");
    await page.waitForFunction(() => Boolean(window.__cloverhollow));
    await page.evaluate(() => window.__cloverhollow?.pause());
    await step(page, 1);
    await runQaCommands(page, ["prizes all", "stickers all", "keepsakes on"]);

    const clubInfo = await renderInfo(page);
    expect(clubInfo.clubhouseDisplay).toBeGreaterThanOrEqual(19);
    expect(
      clubInfo.drawOrder.some((item) => item.label === "clubhouse:keepsake:clover-wreath"),
    ).toBe(true);
    await captureReview(page, testInfo, "m95-clubhouse-wreath");

    expect(errors).toEqual([]);
  },
);
