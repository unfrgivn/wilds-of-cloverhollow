import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";
import {
  bunFindReplayTick,
  longFlowTimeout,
  openHarness,
  queueScript,
  readState,
  recording,
  resetPaused,
  step,
} from "./helpers";

type Rect = { x: number; y: number; width: number; height: number };

function rectsOverlap(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

async function boxIfVisible(locator: Locator): Promise<Rect | null> {
  if (!(await locator.isVisible())) return null;
  return await locator.boundingBox();
}

async function tapKey(page: Page, key: string): Promise<void> {
  await page.keyboard.down(key);
  await step(page, 1);
  await page.keyboard.up(key);
  await step(page, 1);
}

async function captureReview(
  page: Page,
  testInfo: TestInfo,
  name: string,
): Promise<void> {
  if (process.env.CLOVERHOLLOW_REVIEW_SHOTS !== "1" || testInfo.project.name !== "chromium") {
    return;
  }
  await page.screenshot({
    path: `art/review/${name}.jpg`,
    type: "jpeg",
    quality: 90,
    animations: "disabled",
  });
}

test.describe("Milestone 163: Cloverhollow Jubilee OST & Taco Truck Personal Best", () => {
  test.setTimeout(longFlowTimeout);

  test(
    "post-finale Sanctuary Festival plays Cloverhollow Jubilee; pre-reveal plays Meadow of Friends",
    { tag: "@smoke" },
    async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      await page.setViewportSize({ width: 1280, height: 720 });
      await openHarness(page);

      // Post-finale festival fixture -> "festival" ("Cloverhollow Jubilee") over "forest".
      await resetPaused(page, "festival");
      await step(page, 2);
      const festivalMusic = await page.evaluate(() => window.__cloverhollow?.sound.music());
      expect(festivalMusic).toMatchObject({
        track: "festival",
        ambience: "forest",
        duck: false,
        title: "Cloverhollow Jubilee",
      });

      // Pre-reveal sanctuary fixture -> "sanctuary" ("Meadow of Friends") over "forest".
      await resetPaused(page, "sanctuary");
      await step(page, 2);
      const sanctuaryMusic = await page.evaluate(() => window.__cloverhollow?.sound.music());
      expect(sanctuaryMusic).toMatchObject({
        track: "sanctuary",
        ambience: "forest",
        duck: false,
        title: "Meadow of Friends",
      });

      expect(errors).toEqual([]);
    },
  );

  test(
    "live Taco Truck shift shows golden NEW BEST! badge cleanly, persists, and renders in Journal",
    { tag: "@smoke" },
    async ({ page }, testInfo) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      await page.setViewportSize({ width: 1280, height: 720 });
      await openHarness(page);
      await page.evaluate(() => {
        localStorage.removeItem("CapacitorStorage.cloverhollow-records");
      });
      await page.reload();
      await page.waitForFunction(() => Boolean(window.__cloverhollow));
      await resetPaused(page, "new-game");

      // Fast-forward to Chef Mateo's Taco Truck ready screen cleanly.
      const tacoPath = "tests/sim/scripts/new-game/taco.json";
      const targetTicks = bunFindReplayTick(tacoPath, "new-game", "taco-ready");
      const upTo: ReturnType<typeof recording> = [];
      let ticks = 0;
      for (const segment of recording(tacoPath)) {
        if (ticks >= targetTicks) break;
        const take = Math.min(segment.ticks, targetTicks - ticks);
        upTo.push({ frame: segment.frame, ticks: take });
        ticks += take;
      }
      await queueScript(page, upTo);
      await step(page, targetTicks);

      const readyState = await readState(page);
      if (readyState.arcade?.game !== "taco") {
        throw new Error("Expected Taco Truck ready state");
      }
      expect(readyState.arcade.phase).toBe("ready");
      const badge = page.locator(".taco-overlay .arcade-best-badge");
      await expect(badge).toBeHidden();

      // Start the lunch shift by clicking .taco-stage.
      const stageBox = await page.locator(".taco-stage").boundingBox();
      if (stageBox === null) throw new Error("Missing .taco-stage box");
      await page.mouse.click(stageBox.x + stageBox.width / 2, stageBox.y + stageBox.height / 2);
      await step(page, 2);

      // Complete all 3 orders cleanly via direct bowl clicks.
      for (let orderIdx = 0; orderIdx < 3; orderIdx += 1) {
        const current = await readState(page);
        if (current.arcade?.game !== "taco" || current.arcade.phase !== "serving") {
          throw new Error(`Expected taco serving on order ${orderIdx}`);
        }
        const recipe = current.arcade.orders[orderIdx]?.recipe ?? [];
        for (const topping of recipe) {
          const bowl = page.locator(`.taco-bowl[data-topping="${topping}"]`);
          await expect(bowl).toBeVisible();
          const bowlBox = await bowl.boundingBox();
          if (bowlBox === null) throw new Error(`Missing bowl box for ${topping}`);
          await page.mouse.click(bowlBox.x + bowlBox.width / 2, bowlBox.y + bowlBox.height / 2);
          await step(page, 2);
        }
        // Step through order-clear (42 ticks) into next order or final result.
        await step(page, 46);
      }

      // Finish typing result dialogue so the screen is settled.
      const resultState = await readState(page);
      if (resultState.arcade?.game !== "taco") throw new Error("Expected taco result state");
      expect(resultState.arcade.phase).toBe("result");
      const finalScore = resultState.arcade.score;
      expect(finalScore).toBeGreaterThan(0);
      await tapKey(page, "Enter");

      // Golden NEW BEST! badge visible with crisp #47321f ink and zero overlaps on both sizes.
      await expect(badge).toBeVisible();
      await expect(badge).toHaveText(`★ NEW BEST! ${finalScore}`);
      await expect(badge).toHaveClass(/is-new-best/);
      const badgeColor = await badge.evaluate((node) => getComputedStyle(node).color);
      expect(badgeColor).toBe("rgb(71, 50, 31)");

      const checkNoOverlaps = async (labelPrefix: string): Promise<void> => {
        const badgeBox = await boxIfVisible(badge);
        expect(badgeBox, `${labelPrefix} badge box`).not.toBeNull();
        const stageRect = await boxIfVisible(page.locator(".taco-stage"));
        expect(stageRect, `${labelPrefix} stage box`).not.toBeNull();
        if (badgeBox !== null && stageRect !== null) {
          expect(badgeBox.x, `${labelPrefix} inside left`).toBeGreaterThanOrEqual(stageRect.x);
          expect(badgeBox.y, `${labelPrefix} inside top`).toBeGreaterThanOrEqual(stageRect.y);
          expect(
            badgeBox.x + badgeBox.width,
            `${labelPrefix} inside right`,
          ).toBeLessThanOrEqual(stageRect.x + stageRect.width);
          expect(
            badgeBox.y + badgeBox.height,
            `${labelPrefix} inside bottom`,
          ).toBeLessThanOrEqual(stageRect.y + stageRect.height);
        }
        const obstacles = [
          [".taco-ticket", page.locator(".taco-ticket")],
          [".taco-hud", page.locator(".taco-hud")],
          [".taco-order-banner", page.locator(".taco-order-banner")],
          [".taco-shell", page.locator(".taco-shell")],
          [".taco-front", page.locator(".taco-front")],
          [".sticker-dialogue", page.locator(".sticker-dialogue")],
        ] as const;
        if (badgeBox !== null) {
          for (const [selector, loc] of obstacles) {
            const other = await boxIfVisible(loc);
            if (other === null) continue;
            expect(
              rectsOverlap(badgeBox, other),
              `${labelPrefix} badge must not overlap ${selector}`,
            ).toBe(false);
          }
        }
      };

      await checkNoOverlaps("1280x720");
      await captureReview(page, testInfo, "m163-taco-best-1280");

      await page.setViewportSize({ width: 874, height: 402 });
      await step(page, 1);
      await checkNoOverlaps("874x402");
      await page.setViewportSize({ width: 1280, height: 720 });
      await step(page, 1);

      // Dismiss result and verify persistence across reload + Journal BESTS strip.
      await tapKey(page, "Enter");
      await expect
        .poll(() => page.evaluate(() => window.__cloverhollow?.settings.minigameRecords().taco))
        .toBe(finalScore);

      await page.reload();
      await page.waitForFunction(() => Boolean(window.__cloverhollow));
      await resetPaused(page, "plaza");
      await expect
        .poll(() => page.evaluate(() => window.__cloverhollow?.settings.minigameRecords().taco))
        .toBe(finalScore);

      await tapKey(page, "j");
      await expect(page.locator(".journal-book")).toBeVisible();
      const strip = page.locator(".journal-records-strip");
      await expect(strip).toBeVisible();
      const tacoPill = strip.locator('[data-record="taco"]');
      await expect(tacoPill).toBeVisible();
      await expect(tacoPill).toHaveText(`★ Taco Truck · ${finalScore} pts`);

      // Clean up test storage before leaving.
      await page.evaluate(() => {
        localStorage.removeItem("CapacitorStorage.cloverhollow-records");
      });
      expect(errors).toEqual([]);
    },
  );
});
