import { expect, test, type Page } from "@playwright/test";
import { openHarness, readHash, readState, resetPaused, step, walk } from "./helpers";

async function hold(page: Page, key: string, ticks: number): Promise<void> {
  await page.keyboard.down(key);
  await step(page, ticks);
  await page.keyboard.up(key);
}

async function enterKitchen(page: Page): Promise<void> {
  await hold(page, "ArrowUp", 30);
  for (let i = 0; i < 60; i += 1) {
    const state = await readState(page);
    if (state.area === "kitchen" && state.transition === null) break;
    await step(page, 1);
  }
}

function relativeLuminance(rgb: [number, number, number]): number {
  const channel = (value: number): number => {
    const s = value / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2]);
}

function contrastRatio(fg: [number, number, number], bg: [number, number, number]): number {
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

function parseRgb(color: string): [number, number, number] {
  const match = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(color);
  if (match === null) throw new Error(`Could not parse color: ${color}`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

test(
  "area banner appears on arrival, clears touch controls, meets contrast, and hides cleanly",
  { tag: "@smoke" },
  async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("./?touch=1");
    await page.waitForFunction(() => Boolean(window.__cloverhollow));
    await resetPaused(page, "new-game");

    const banner = page.locator(".area-banner");
    await expect(banner).toBeHidden();

    await enterKitchen(page);
    await step(page, 24);

    await expect(banner).toBeVisible();
    await expect(banner.locator(".area-banner-title")).toHaveText("Kitchen");
    await expect(banner.locator(".area-banner-region")).toHaveText("Cloverhollow");

    const styles = await banner.evaluate((node) => {
      const title = node.querySelector(".area-banner-title");
      const region = node.querySelector(".area-banner-region");
      const bannerStyle = getComputedStyle(node);
      return {
        bg: bannerStyle.backgroundColor,
        opacity: Number.parseFloat(bannerStyle.opacity),
        titleColor: title === null ? "" : getComputedStyle(title).color,
        regionColor: region === null ? "" : getComputedStyle(region).color,
      };
    });
    expect(styles.opacity).toBeGreaterThan(0.95);
    const bgRgb = parseRgb(styles.bg);
    expect(contrastRatio(parseRgb(styles.titleColor), bgRgb)).toBeGreaterThanOrEqual(8.5);
    expect(contrastRatio(parseRgb(styles.regionColor), bgRgb)).toBeGreaterThanOrEqual(8.5);

    const checkClearance = async (viewportWidth: number): Promise<void> => {
      const bannerBox = await banner.boundingBox();
      const menuBox = await page.locator(".touch-menu").boundingBox();
      if (bannerBox === null || menuBox === null) {
        throw new Error("Expected both .area-banner and .touch-menu bounding boxes");
      }
      expect(bannerBox.x).toBeGreaterThanOrEqual(0);
      expect(bannerBox.x + bannerBox.width).toBeLessThanOrEqual(viewportWidth);
      const overlaps =
        bannerBox.x < menuBox.x + menuBox.width &&
        bannerBox.x + bannerBox.width > menuBox.x &&
        bannerBox.y < menuBox.y + menuBox.height &&
        bannerBox.y + bannerBox.height > menuBox.y;
      expect(overlaps, `banner overlaps .touch-menu at width ${viewportWidth}`).toBe(false);
    };

    await checkClearance(1280);
    await page.setViewportSize({ width: 874, height: 402 });
    await checkClearance(874);
    await page.setViewportSize({ width: 1280, height: 720 });

    // Opening the journal hides the banner immediately.
    await page.keyboard.press("j");
    await step(page, 2);
    await expect(page.locator(".journal-book")).toBeVisible();
    await expect(banner).toBeHidden();
    await page.keyboard.press("Escape");
    await step(page, 2);
    await expect(page.locator(".journal-book")).toBeHidden();
    await expect(banner).toBeVisible();

    // Opening dialogue hides the banner immediately.
    await walk(page, "x", 615);
    await walk(page, "y", 590);
    await page.keyboard.press("z");
    await step(page, 2);
    await expect(page.locator(".sticker-dialogue")).toBeVisible();
    await expect(banner).toBeHidden();

    // Fresh arrival fades out naturally after 150 ticks.
    await resetPaused(page, "new-game");
    await expect(banner).toBeHidden();
    await enterKitchen(page);
    await step(page, 24);
    await expect(banner).toBeVisible();
    await step(page, 132);
    await expect(banner).toBeHidden();
  },
);

test(
  "Maddie idle nap and emote layer run cleanly after 260 still ticks with stable core hash",
  { tag: "@smoke" },
  async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await page.setViewportSize({ width: 1280, height: 720 });
    await openHarness(page);
    await resetPaused(page, "new-game");
    await step(page, 260);

    const state = await readState(page);
    expect(state.area).toBe("bedroom");
    expect(state.party[0]?.id).toBe("maddie");
    expect(state.party[0]?.stillTicks ?? 0).toBeGreaterThanOrEqual(240);
    await expect(page.locator(".area-banner")).toBeHidden();

    const firstHash = await readHash(page);
    await resetPaused(page, "new-game");
    await step(page, 260);
    expect(await readHash(page)).toBe(firstHash);
    expect(errors).toEqual([]);
  },
);
