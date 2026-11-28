import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";
import {
  bunFindReplayTick,
  longFlowTimeout,
  openHarness,
  queueScript,
  readState,
  recording,
  renderInfo,
  resetPaused,
  step,
  walk,
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
  await step(page, 2);
}

async function captureReview(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  if (process.env.CLOVERHOLLOW_REVIEW_SHOTS !== "1" || testInfo.project.name !== "chromium") {
    return;
  }
  await page.screenshot({
    path: `art/review/${name}.jpg`,
    type: "jpeg",
    quality: 90,
  });
}

async function fastForwardScript(
  page: Page,
  scriptPath: string,
  targetTicks: number,
): Promise<void> {
  const upTo: ReturnType<typeof recording> = [];
  let ticks = 0;
  for (const segment of recording(scriptPath)) {
    if (ticks >= targetTicks) break;
    const take = Math.min(segment.ticks, targetTicks - ticks);
    upTo.push({ frame: segment.frame, ticks: take });
    ticks += take;
  }
  await queueScript(page, upTo);
  await step(page, targetTicks);
}

async function assertPillClearOf(
  page: Page,
  pillSelector: string,
  obstacles: readonly string[],
): Promise<void> {
  const pill = page.locator(pillSelector);
  await expect(pill).toBeVisible();
  const pillBox = await pill.boundingBox();
  expect(pillBox).not.toBeNull();
  if (pillBox === null) return;
  for (const selector of obstacles) {
    const items = page.locator(selector);
    const count = await items.count();
    for (let index = 0; index < count; index += 1) {
      const box = await boxIfVisible(items.nth(index));
      if (box === null) continue;
      expect(rectsOverlap(pillBox, box), `${pillSelector} must not overlap ${selector}`).toBe(
        false,
      );
    }
  }
}

test.describe("Milestone 218: Photo Mode Live Sky Cycler & Outdoor Minigame Weather", () => {
  test.setTimeout(longFlowTimeout);

  test(
    "cycles live sky via W in desktop Photo Mode, stamps postcard, and flows into Fishing & Taco",
    { tag: "@smoke" },
    async ({ page }, testInfo) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      await page.setViewportSize({ width: 1280, height: 720 });
      await openHarness(page);
      await page.evaluate(() => {
        localStorage.removeItem("CapacitorStorage.cloverhollow-weather");
      });
      await resetPaused(page, "plaza");
      await step(page, 2);

      const basePlaza = await renderInfo(page);
      expect(basePlaza.area).toBe("plaza");
      const basePlazaParticles = basePlaza.atmosphereParticles;
      await expect(page.locator("html")).toHaveAttribute("data-active-weather", "clear");

      // Enter Photo Mode via real P key and press W to cycle to Rainbow Sunshower.
      await page.keyboard.press("p");
      await step(page, 1);
      await expect(page.locator("html")).toHaveAttribute("data-photo", "on");

      await page.keyboard.press("w");
      await step(page, 2);
      await expect(page.locator("html")).toHaveAttribute("data-active-weather", "sunshower");
      const toast = page.locator(".photo-toast");
      await expect(toast).toBeVisible();
      await expect(toast).toHaveText("Sky · Rainbow Sunshower");

      const rainyPlaza = await renderInfo(page);
      expect(rainyPlaza.atmosphereParticles).toBe(basePlazaParticles + 42);

      // Snap postcard via Space -> weather-stamped toast matches live Rainbow Sunshower.
      await page.keyboard.press("Space");
      await expect(page.locator(".photo-shutter-flash")).toHaveAttribute("data-shutter-count", "1");
      await expect(toast).toBeVisible();
      await expect(toast).toHaveText("Postcard saved · Town plaza · Rainbow Sunshower");

      // Step W through the remaining full sky cycle and wrap back to sunshower for Fishing.
      const cycleExpectations: readonly [string, string][] = [
        ["breeze-petals", "Sky · Blossom Breeze"],
        ["snow-flurry", "Sky · Snow Flurry"],
        ["twilight-fireflies", "Sky · Twilight Fireflies"],
        ["clear", "Sky · Clear Skies"],
        ["sunshower", "Sky · Rainbow Sunshower"],
      ];
      for (const [kind, label] of cycleExpectations) {
        await page.keyboard.press("w");
        await step(page, 2);
        await expect(page.locator("html")).toHaveAttribute("data-active-weather", kind);
        await expect(toast).toHaveText(label);
      }

      // Exit Photo Mode cleanly with Escape.
      await page.keyboard.press("Escape");
      await step(page, 1);
      await expect(page.locator("html")).toHaveAttribute("data-photo", "off");

      // Launch Bubblegum Bay Fishing while weather is "sunshower".
      await resetPaused(page, "new-game");
      const fishPath = "tests/sim/scripts/new-game/fish.json";
      const fishReadyTicks = bunFindReplayTick(fishPath, "new-game", "fish-dock-ready");
      await fastForwardScript(page, fishPath, fishReadyTicks);

      // Open fishing dock with real Enter presses.
      for (let count = 0; count < 20; count += 1) {
        const current = await readState(page);
        if (current.arcade?.game === "fish") break;
        await tapKey(page, "Enter");
      }
      const fishingState = await readState(page);
      expect(fishingState.arcade?.game).toBe("fish");
      await expect(page.locator(".fish-stage")).toBeVisible();

      const fishFx = page.locator('.fish-stage .minigame-weather-fx[data-weather="sunshower"]');
      const fishPill = page.locator('.fish-stage .minigame-weather-pill[data-weather="sunshower"]');
      await expect(fishFx).toBeVisible();
      await expect(fishPill).toBeVisible();
      await expect(fishPill).toContainText("Rainbow Sunshower");
      await expect(fishPill).toContainText("+15% bite charm");
      await expect(fishPill.locator("svg")).toHaveCount(1);
      await expect(fishPill.locator("svg text")).toHaveCount(0);

      const fishObstacles = [".fish-book", ".fish-escape", ".fish-power", ".fish-front"];
      await assertPillClearOf(page, ".fish-stage .minigame-weather-pill", fishObstacles);
      await captureReview(page, testInfo, "m218-fish-sunshower-1280");

      await page.setViewportSize({ width: 874, height: 402 });
      await step(page, 1);
      await assertPillClearOf(page, ".fish-stage .minigame-weather-pill", fishObstacles);
      await page.setViewportSize({ width: 1280, height: 720 });
      await step(page, 1);

      // Switch sky to "twilight-fireflies" via Photo Mode W in Plaza (3 steps from sunshower).
      await resetPaused(page, "plaza");
      await step(page, 1);
      await page.keyboard.press("p");
      await step(page, 1);
      for (let count = 0; count < 3; count += 1) {
        await page.keyboard.press("w");
        await step(page, 1);
      }
      await expect(page.locator("html")).toHaveAttribute(
        "data-active-weather",
        "twilight-fireflies",
      );
      await page.keyboard.press("Escape");
      await step(page, 1);

      // Launch Chef Mateo's Taco Truck while weather is "twilight-fireflies".
      await resetPaused(page, "new-game");
      const tacoPath = "tests/sim/scripts/new-game/taco.json";
      const tacoReadyTicks = bunFindReplayTick(tacoPath, "new-game", "taco-ready");
      await fastForwardScript(page, tacoPath, tacoReadyTicks);

      const tacoReady = await readState(page);
      expect(tacoReady.arcade?.game).toBe("taco");
      await expect(page.locator(".taco-stage")).toBeVisible();

      // Click stage center to enter serving so bowls, order ticket, and HUD are all visible.
      const stageBox = await page.locator(".taco-stage").boundingBox();
      if (stageBox === null) throw new Error("Missing .taco-stage box");
      await page.mouse.click(stageBox.x + stageBox.width / 2, stageBox.y + stageBox.height / 2);
      await step(page, 2);

      const tacoFx = page.locator(
        '.taco-stage .minigame-weather-fx[data-weather="twilight-fireflies"]',
      );
      const tacoPill = page.locator(
        '.taco-stage .minigame-weather-pill[data-weather="twilight-fireflies"]',
      );
      await expect(tacoFx).toBeVisible();
      await expect(tacoPill).toBeVisible();
      await expect(tacoPill).toContainText("Twilight Fireflies");
      await expect(tacoPill).toContainText("Lantern shift");
      await expect(tacoPill.locator("svg")).toHaveCount(1);
      await expect(tacoPill.locator("svg text")).toHaveCount(0);

      const tacoObstacles = [
        ".taco-ticket",
        ".taco-hud",
        ".taco-escape",
        ".taco-bowl",
        ".taco-shell",
        ".taco-front",
        ".taco-best-badge",
      ];
      await assertPillClearOf(page, ".taco-stage .minigame-weather-pill", tacoObstacles);
      await captureReview(page, testInfo, "m218-taco-fireflies-1280");

      await page.setViewportSize({ width: 874, height: 402 });
      await step(page, 1);
      await assertPillClearOf(page, ".taco-stage .minigame-weather-pill", tacoObstacles);
      await page.setViewportSize({ width: 1280, height: 720 });
      await step(page, 1);

      // Reset weather cleanly back to "clear".
      await resetPaused(page, "plaza");
      await step(page, 1);
      await page.keyboard.press("p");
      await step(page, 1);
      await page.keyboard.press("w");
      await step(page, 2);
      await expect(page.locator("html")).toHaveAttribute("data-active-weather", "clear");
      await page.keyboard.press("Escape");
      await step(page, 1);
      await page.evaluate(() => {
        localStorage.removeItem("CapacitorStorage.cloverhollow-weather");
      });

      expect(errors).toEqual([]);
    },
  );

  test(
    "touch Photo Mode shows >= 44px sky cycler button outdoors and hides it indoors in bedroom",
    { tag: "@smoke" },
    async ({ browser }, testInfo) => {
      const context = await browser.newContext({
        viewport: { width: 874, height: 402 },
        hasTouch: true,
      });
      const page = await context.newPage();
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      try {
        await page.goto("./?touch=1");
        await page.waitForFunction(() => Boolean(window.__cloverhollow));
        await page.evaluate(() => {
          localStorage.removeItem("CapacitorStorage.cloverhollow-weather");
        });
        await resetPaused(page, "plaza");
        await step(page, 2);
        await walk(page, "x", 948);
        await step(page, 2);

        await expect(page.locator("html")).toHaveAttribute("data-touch", "on");
        await page.evaluate(() => window.__cloverhollow?.settings.setPhotoMode(true));
        await step(page, 2);
        await expect(page.locator("html")).toHaveAttribute("data-photo", "on");

        const weatherBtn = page.locator(".photo-touch-weather");
        const snapBtn = page.locator(".photo-touch-snap");
        const closeBtn = page.locator(".photo-touch-close");
        await expect(weatherBtn).toBeVisible();
        await expect(weatherBtn).toHaveAttribute("aria-label", "Cycle Cozy Weather");
        await expect(weatherBtn.locator("svg")).toHaveCount(1);
        await expect(weatherBtn.locator("svg text")).toHaveCount(0);

        const weatherBox = await weatherBtn.boundingBox();
        const snapBox = await snapBtn.boundingBox();
        const closeBox = await closeBtn.boundingBox();
        expect(weatherBox).not.toBeNull();
        expect(snapBox).not.toBeNull();
        expect(closeBox).not.toBeNull();
        if (weatherBox !== null && snapBox !== null && closeBox !== null) {
          expect(weatherBox.width).toBeGreaterThanOrEqual(44);
          expect(weatherBox.height).toBeGreaterThanOrEqual(44);
          expect(weatherBox.x + weatherBox.width).toBeLessThanOrEqual(snapBox.x + 0.5);
          expect(rectsOverlap(weatherBox, snapBox)).toBe(false);
          expect(rectsOverlap(weatherBox, closeBox)).toBe(false);
        }

        // Tap the touch sky pill to cycle Plaza into Rainbow Sunshower live.
        await weatherBtn.tap();
        await step(page, 2);
        await expect(page.locator("html")).toHaveAttribute("data-active-weather", "sunshower");
        await expect(page.locator(".photo-toast")).toHaveText("Sky · Rainbow Sunshower");
        await page.evaluate(async () => {
          const toast = document.querySelector(".photo-toast");
          if (toast === null) return;
          await Promise.all(toast.getAnimations().map((anim) => anim.finished.catch(() => {})));
        });

        await captureReview(page, testInfo, "m218-photo-touch-sky-874");

        // Switch indoors to bedroom (new-game) -> .photo-touch-weather hides cleanly!
        await resetPaused(page, "new-game");
        await step(page, 2);
        const bedroomState = await readState(page);
        expect(bedroomState.area).toBe("bedroom");
        await page.evaluate(() => window.__cloverhollow?.settings.setPhotoMode(true));
        await step(page, 2);
        await expect(page.locator("html")).toHaveAttribute("data-photo", "on");
        await expect(snapBtn).toBeVisible();
        await expect(closeBtn).toBeVisible();
        await expect(weatherBtn).toBeHidden();

        // Reset weather cleanly back to clear before finishing.
        await closeBtn.tap();
        await step(page, 1);
        await page.evaluate(() => {
          localStorage.removeItem("CapacitorStorage.cloverhollow-weather");
        });
        expect(errors).toEqual([]);
      } finally {
        await context.close();
      }
    },
  );
});
