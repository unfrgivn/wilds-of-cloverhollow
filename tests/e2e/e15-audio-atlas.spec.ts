import { expect, test, type Page, type TestInfo } from "@playwright/test";
import type { MusicDebugInfo } from "../../src/platform/audio";
import { longFlowTimeout, openMap, step } from "./helpers";

async function tapKey(page: Page, key: string): Promise<void> {
  await page.keyboard.down(key);
  await step(page, 1);
  await page.keyboard.up(key);
  await step(page, 2);
}

async function readMusic(page: Page): Promise<MusicDebugInfo> {
  const info = await page.evaluate(() => window.__cloverhollow?.sound.music());
  if (info === undefined) throw new Error("sound.music hook unavailable");
  return info;
}

async function recordedEffects(page: Page): Promise<string[]> {
  return page.evaluate(() => [...(window.__cloverhollow?.sound.effects() ?? [])]);
}

async function settleAnimations(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await Promise.all(
      document
        .getAnimations()
        .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity)
        .map((animation) => animation.finished.catch(() => undefined)),
    );
  });
}

async function captureReview(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  if (process.env.CLOVERHOLLOW_REVIEW_SHOTS !== "1" || testInfo.project.name !== "chromium") {
    return;
  }
  await settleAnimations(page);
  await page.screenshot({
    path: `art/review/${name}.jpg`,
    type: "jpeg",
    quality: 90,
  });
}

type AtlasGeometry = {
  storyClearOfClose: boolean;
  storyNotTruncated: boolean;
  storyInsideBook: boolean;
  railClearOfMap: boolean;
  railInsideBook: boolean;
  mapInsideBook: boolean;
  footerInsideBook: boolean;
  footerNoOverflow: boolean;
  detailNotTruncated: boolean;
  filterTargetsAtLeast44: boolean;
  minFilterWidth: number;
  minFilterHeight: number;
  traysInsideMap: boolean;
  inspectorNoHorizOverflow: boolean;
  inspectorTitleNotTruncated: boolean;
  landLabelsNoOverlap: boolean;
};

async function measureAtlasGeometry(page: Page): Promise<AtlasGeometry> {
  const result = await page.evaluate((): AtlasGeometry | null => {
    const book = document.querySelector<HTMLElement>(".journal-book");
    const close = document.querySelector<HTMLElement>(".journal-close");
    const story = document.querySelector<HTMLElement>(".journal-atlas-story");
    const goal = document.querySelector<HTMLElement>(".journal-atlas-goal");
    const rail = document.querySelector<HTMLElement>(".journal-atlas-rail");
    const inspector = document.querySelector<HTMLElement>(".journal-atlas-inspector");
    const inspectorTitle = document.querySelector<HTMLElement>(".journal-atlas-inspector-title");
    const map = document.querySelector<HTMLElement>(".journal-map");
    const footer = document.querySelector<HTMLElement>(".journal-map-footer");
    const detail = document.querySelector<HTMLElement>(".journal-map-detail");
    const filters = [...document.querySelectorAll<HTMLElement>(".journal-atlas-filter")];
    const trays = [...document.querySelectorAll<HTMLElement>(".journal-atlas-pin-tray")];
    const landLabels = [...document.querySelectorAll<HTMLElement>(".journal-map-land")];
    if (
      book === null ||
      close === null ||
      story === null ||
      goal === null ||
      rail === null ||
      inspector === null ||
      inspectorTitle === null ||
      map === null ||
      footer === null ||
      detail === null ||
      filters.length !== 4
    ) {
      return null;
    }

    const bookRect = book.getBoundingClientRect();
    const closeRect = close.getBoundingClientRect();
    const storyRect = story.getBoundingClientRect();
    const railRect = rail.getBoundingClientRect();
    const mapRect = map.getBoundingClientRect();
    const footerRect = footer.getBoundingClientRect();

    const inside = (child: DOMRect, parent: DOMRect): boolean =>
      child.left >= parent.left - 1 &&
      child.right <= parent.right + 1 &&
      child.top >= parent.top - 1 &&
      child.bottom <= parent.bottom + 1;

    const overlaps = (a: DOMRect, b: DOMRect): boolean =>
      a.left < b.right - 1 &&
      a.right > b.left + 1 &&
      a.top < b.bottom - 1 &&
      a.bottom > b.top + 1;

    const filterRects = filters.map((btn) => btn.getBoundingClientRect());
    const minFilterWidth = Math.min(...filterRects.map((rect) => rect.width));
    const minFilterHeight = Math.min(...filterRects.map((rect) => rect.height));
    const labelRects = landLabels.map((node) => node.getBoundingClientRect());
    let landLabelsNoOverlap = true;
    for (let i = 0; i < labelRects.length; i += 1) {
      for (let j = i + 1; j < labelRects.length; j += 1) {
        const a = labelRects[i];
        const b = labelRects[j];
        if (a !== undefined && b !== undefined && overlaps(a, b)) {
          landLabelsNoOverlap = false;
        }
      }
    }

    return {
      storyClearOfClose: !overlaps(storyRect, closeRect),
      storyNotTruncated: goal.scrollWidth <= goal.clientWidth + 1,
      storyInsideBook: inside(storyRect, bookRect),
      railClearOfMap: !overlaps(railRect, mapRect) && !overlaps(railRect, footerRect),
      railInsideBook: inside(railRect, bookRect),
      mapInsideBook: inside(mapRect, bookRect),
      footerInsideBook: inside(footerRect, bookRect),
      footerNoOverflow: footer.scrollWidth <= footer.clientWidth + 1,
      detailNotTruncated: detail.scrollWidth <= detail.clientWidth + 1,
      filterTargetsAtLeast44: minFilterWidth >= 43.5 && minFilterHeight >= 43.5,
      minFilterWidth: Math.round(minFilterWidth * 10) / 10,
      minFilterHeight: Math.round(minFilterHeight * 10) / 10,
      traysInsideMap: trays.every((tray) => inside(tray.getBoundingClientRect(), mapRect)),
      inspectorNoHorizOverflow: inspector.scrollWidth <= inspector.clientWidth + 1,
      inspectorTitleNotTruncated: inspectorTitle.scrollWidth <= inspectorTitle.clientWidth + 1,
      landLabelsNoOverlap,
    };
  });
  if (result === null) throw new Error("Atlas elements missing from DOM");
  return result;
}

test.describe("Track E15: Adaptive Vertical Audio, Organic Foley & Smart Valley Atlas", () => {
  test.setTimeout(longFlowTimeout);

  test(
    "adaptive audio warms in Journal, layers Lantern shimmer, and fires Atlas foley",
    { tag: "@smoke" },
    async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto("./?qa=lantern");
      await page.waitForFunction(() => Boolean(window.__cloverhollow));
      await page.evaluate(() => window.__cloverhollow?.pause());
      await step(page, 1);

      // Unlock Web Audio with a real user key press.
      await tapKey(page, "ArrowRight");
      await expect
        .poll(() => page.evaluate(() => window.__cloverhollow?.sound.state()))
        .toBe("running");

      const initialMusic = await readMusic(page);
      expect(initialMusic.adaptive.journalWarm).toBe(false);
      expect(initialMusic.adaptive.filterCutoffHz).toBe(18000);

      // Switch Fae's blacklight lantern on via real L key -> lantern shimmer layer engages.
      const lanternBefore = await page.evaluate(() => window.__cloverhollow?.getState().lantern);
      if (!lanternBefore) {
        await tapKey(page, "l");
      }
      await expect
        .poll(() => page.evaluate(() => window.__cloverhollow?.getState().lantern))
        .toBe(true);
      expect((await readMusic(page)).adaptive.lanternLayer).toBe(true);

      // Open Journal via J -> 1400 Hz warm low-pass engages.
      await tapKey(page, "j");
      await expect(page.locator(".journal-book")).toBeVisible();
      const journalMusic = await readMusic(page);
      expect(journalMusic.adaptive.journalWarm).toBe(true);
      expect(journalMusic.adaptive.filterCutoffHz).toBe(1400);

      // Jukebox preview on OPTIONS bypasses warm low-pass for crystal-clear listening.
      await page.locator(".journal-options-tab").click();
      await page.locator(".journal-jukebox-next").click();
      await expect
        .poll(async () => (await readMusic(page)).adaptive.journalWarm)
        .toBe(false);
      expect((await readMusic(page)).adaptive.filterCutoffHz).toBe(18000);
      await page.locator(".journal-now-playing").click();
      await expect
        .poll(async () => (await readMusic(page)).adaptive.journalWarm)
        .toBe(true);

      // Flip to MAP and verify organic Atlas foley: atlas-pin, paper-flip, sticker-peel.
      await page.locator(".journal-map-tab").click();
      await expect(page.locator(".journal-book")).toHaveAttribute("data-journal-page", "map");

      const beforePin = (await recordedEffects(page)).length;
      const trailPin = page.locator('.journal-map-land.is-revealed[data-land="trail"]');
      await trailPin.click();
      expect((await recordedEffects(page)).slice(beforePin)).toContain("atlas-pin");

      const beforeFilter = (await recordedEffects(page)).length;
      await page.locator('.journal-atlas-filter[data-filter="gems"]').click();
      expect((await recordedEffects(page)).slice(beforeFilter)).toContain("paper-flip");

      const beforePeel = (await recordedEffects(page)).length;
      await trailPin.click();
      expect((await recordedEffects(page)).slice(beforePeel)).toContain("sticker-peel");

      // Close Journal -> warm filter restores to 18000 Hz; toggle lantern off -> layer clears.
      await tapKey(page, "j");
      await expect(page.locator(".journal-book")).toBeHidden();
      expect((await readMusic(page)).adaptive.journalWarm).toBe(false);
      expect((await readMusic(page)).adaptive.filterCutoffHz).toBe(18000);

      await tapKey(page, "l");
      await expect
        .poll(() => page.evaluate(() => window.__cloverhollow?.getState().lantern))
        .toBe(false);
      expect((await readMusic(page)).adaptive.lanternLayer).toBe(false);

      expect(errors).toEqual([]);
    },
  );

  test(
    "Valley Atlas shows Story So Far, live die-cut pins, and filters across early/late saves",
    { tag: "@smoke" },
    async ({ page }, testInfo) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      // 1. Early QA save (breakfast): Act 1 banner, on-foot bus stops, Grumpy Gull waiting.
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto("./?qa=breakfast");
      await page.waitForFunction(() => Boolean(window.__cloverhollow));
      await page.evaluate(() => window.__cloverhollow?.pause());
      await step(page, 1);
      await openMap(page);

      const story = page.locator(".journal-atlas-story");
      await expect(story).toBeVisible();
      await expect(page.locator(".journal-atlas-chapter")).toHaveText("Act 1");
      await expect(page.locator(".journal-atlas-goal")).toContainText("fountain");
      const earlyStoryText = await story.innerText();
      expect(earlyStoryText.toLowerCase()).not.toContain("milo");

      // Bus stops reflect unlocked (Cloverhollow) vs on-foot (Bay & Pass).
      await expect(page.locator('.journal-map-stop[data-land="cloverhollow"]')).toHaveAttribute(
        "data-bus-status",
        "unlocked",
      );
      await expect(page.locator('.journal-map-stop[data-land="bay"]')).toHaveAttribute(
        "data-bus-status",
        "on-foot",
      );
      await expect(page.locator('.journal-map-stop[data-land="pass"]')).toHaveAttribute(
        "data-bus-status",
        "on-foot",
      );

      // Live die-cut pin badges: Star Gems hidden + Grumpy Gull waiting on Trail.
      await expect(
        page.locator('.journal-atlas-badge[data-badge="gem"][data-land="cloverhollow"]'),
      ).toBeVisible();
      await expect(
        page.locator('.journal-atlas-badge[data-badge="boss"][data-land="trail"]'),
      ).toBeVisible();
      // Arcade boss is gated until clubhouse_claimed, so no early spoiler on Cloverhollow.
      await expect(
        page.locator('.journal-atlas-badge[data-badge="boss"][data-land="cloverhollow"]'),
      ).toHaveCount(0);

      // Clicking Cliffside Trail highlights exact remaining objectives in the Quick Pin Inspector.
      await page.locator('.journal-map-land[data-land="trail"]').click();
      const inspector = page.locator(".journal-atlas-inspector");
      await expect(inspector).toContainText("Cliffside Trail");
      await expect(inspector).toContainText("Grumpy Gull waiting");
      await expect(inspector).toContainText("1 Star Gem hidden");

      const earlyGeom = await measureAtlasGeometry(page);
      expect(earlyGeom).toMatchObject({
        storyClearOfClose: true,
        storyNotTruncated: true,
        storyInsideBook: true,
        railClearOfMap: true,
        railInsideBook: true,
        mapInsideBook: true,
        footerInsideBook: true,
        footerNoOverflow: true,
        detailNotTruncated: true,
        filterTargetsAtLeast44: true,
        traysInsideMap: true,
        inspectorNoHorizOverflow: true,
        inspectorTitleNotTruncated: true,
        landLabelsNoOverlap: true,
      });

      await captureReview(page, testInfo, "e15-atlas-early-1280");

      // Filter by Bosses -> Trail stays highlighted, non-boss lands dim; toggle Bus -> routes glow.
      const bossFilter = page.locator('.journal-atlas-filter[data-filter="bosses"]');
      await bossFilter.click();
      await expect(bossFilter).toHaveAttribute("aria-pressed", "true");
      await expect(page.locator('.journal-map-land[data-land="trail"]')).toHaveClass(
        /is-filter-match/,
      );
      await expect(page.locator('.journal-map-land[data-land="bay"]')).toHaveClass(/is-filter-dim/);

      const busFilter = page.locator('.journal-atlas-filter[data-filter="bus"]');
      await busFilter.click();
      await expect(busFilter).toHaveAttribute("aria-pressed", "true");
      await expect(page.locator(".journal-map-routes")).toHaveClass(/is-bus-focus/);
      await expect(page.locator('.journal-map-land[data-land="bay"]')).toHaveClass(
        /is-filter-match/,
      );
      await busFilter.click();
      await expect(page.locator('.journal-atlas-filter[data-filter="all"]')).toHaveAttribute(
        "aria-pressed",
        "true",
      );

      // 2. Late QA save (forest): Finale banner (still hides Milo's name!), Enchanted boss pin.
      await page.goto("./?qa=forest");
      await page.waitForFunction(() => Boolean(window.__cloverhollow));
      await page.evaluate(() => window.__cloverhollow?.pause());
      await step(page, 1);
      await openMap(page);

      await expect(page.locator(".journal-atlas-chapter")).toHaveText("Finale");
      const lateStoryText = await page.locator(".journal-atlas-story").innerText();
      expect(lateStoryText.toLowerCase()).not.toContain("milo");
      await expect(page.locator('.journal-map-stop[data-land="bay"]')).toHaveAttribute(
        "data-bus-status",
        "unlocked",
      );
      await expect(page.locator('.journal-map-stop[data-land="pass"]')).toHaveAttribute(
        "data-bus-status",
        "unlocked",
      );
      await expect(
        page.locator('.journal-atlas-badge[data-badge="boss"][data-land="enchanted"]'),
      ).toBeVisible();

      await page.locator('.journal-map-land[data-land="enchanted"]').click();
      await expect(inspector).toContainText("The Enchanted Forest");
      await expect(inspector).toContainText("Hooded Kid waiting");

      const lateGeom = await measureAtlasGeometry(page);
      expect(lateGeom).toMatchObject({
        storyClearOfClose: true,
        storyNotTruncated: true,
        storyInsideBook: true,
        railClearOfMap: true,
        railInsideBook: true,
        mapInsideBook: true,
        footerInsideBook: true,
        footerNoOverflow: true,
        detailNotTruncated: true,
        filterTargetsAtLeast44: true,
        traysInsideMap: true,
        inspectorNoHorizOverflow: true,
        inspectorTitleNotTruncated: true,
        landLabelsNoOverlap: true,
      });

      await captureReview(page, testInfo, "e15-atlas-late-1280");

      // 3. Post-finale QA save (kid): Celebration banner and Enchanted boss pin clears.
      await page.goto("./?qa=kid");
      await page.waitForFunction(() => Boolean(window.__cloverhollow));
      await page.evaluate(() => window.__cloverhollow?.pause());
      await step(page, 1);
      await openMap(page);

      await expect(page.locator(".journal-atlas-chapter")).toHaveText("Celebration");
      await expect(page.locator(".journal-atlas-goal")).toContainText("Wildlife Sanctuary");
      await expect(
        page.locator('.journal-atlas-badge[data-badge="boss"][data-land="enchanted"]'),
      ).toHaveCount(0);

      expect(errors).toEqual([]);
    },
  );

  test(
    "Valley Atlas fits phone landscape (874x402) with >= 44 px touch targets and zero overlap",
    { tag: "@smoke" },
    async ({ browser }, testInfo) => {
      const context = await browser.newContext({
        viewport: { width: 874, height: 402 },
        hasTouch: true,
      });
      const page = await context.newPage();
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      await page.goto("./?qa=flute&touch=1");
      await page.waitForFunction(() => Boolean(window.__cloverhollow));
      await page.evaluate(() => window.__cloverhollow?.pause());
      await step(page, 1);
      await openMap(page);

      const phoneGeom = await measureAtlasGeometry(page);
      expect(phoneGeom).toMatchObject({
        storyClearOfClose: true,
        storyNotTruncated: true,
        storyInsideBook: true,
        railClearOfMap: true,
        railInsideBook: true,
        mapInsideBook: true,
        footerInsideBook: true,
        footerNoOverflow: true,
        detailNotTruncated: true,
        filterTargetsAtLeast44: true,
        traysInsideMap: true,
        inspectorNoHorizOverflow: true,
        inspectorTitleNotTruncated: true,
        landLabelsNoOverlap: true,
      });

      // Real touch tap on Gems filter button toggles filter cleanly.
      const gemsBtn = page.locator('.journal-atlas-filter[data-filter="gems"]');
      const gemsBox = await gemsBtn.boundingBox();
      if (gemsBox === null) throw new Error("gems filter missing bounds");
      expect(gemsBox.width).toBeGreaterThanOrEqual(43.5);
      expect(gemsBox.height).toBeGreaterThanOrEqual(43.5);
      await page.touchscreen.tap(gemsBox.x + gemsBox.width / 2, gemsBox.y + gemsBox.height / 2);
      await expect(gemsBtn).toHaveAttribute("aria-pressed", "true");

      await captureReview(page, testInfo, "e15-atlas-phone-874");

      // Also verify with iPhone safe-area insets active!
      await page.evaluate(() => {
        document.documentElement.style.setProperty("--safe-left", "62px");
        document.documentElement.style.setProperty("--safe-right", "62px");
        document.documentElement.style.setProperty("--safe-bottom", "21px");
      });
      await step(page, 1);
      const insetGeom = await measureAtlasGeometry(page);
      expect(insetGeom).toMatchObject({
        storyClearOfClose: true,
        storyNotTruncated: true,
        storyInsideBook: true,
        railClearOfMap: true,
        railInsideBook: true,
        mapInsideBook: true,
        footerInsideBook: true,
        footerNoOverflow: true,
        detailNotTruncated: true,
        filterTargetsAtLeast44: true,
        traysInsideMap: true,
        inspectorNoHorizOverflow: true,
        inspectorTitleNotTruncated: true,
        landLabelsNoOverlap: true,
      });

      expect(errors).toEqual([]);
      await context.close();
    },
  );
});
