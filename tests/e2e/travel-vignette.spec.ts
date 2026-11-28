import { expect, test, type Page } from "@playwright/test";
import { openHarness, readState, resetPaused, resume, step, walk } from "./helpers";

const REVIEW_SHOTS = process.env.CLOVERHOLLOW_REVIEW_SHOTS === "1";

async function pressZ(page: Page): Promise<void> {
  await page.keyboard.press("z");
  await step(page, 2);
}

async function advanceToFinalTravelLine(page: Page, choice = 0): Promise<void> {
  for (let count = 0; count < 80; count += 1) {
    const dialogue = (await readState(page)).dialogue;
    if (dialogue === null) throw new Error("dialogue closed before travel line");
    if (dialogue.revealed < dialogue.text.length) {
      await pressZ(page);
      continue;
    }
    if (dialogue.choices.length > 0) {
      for (let down = 0; down < choice; down += 1) {
        await page.keyboard.press("ArrowDown");
        await step(page, 1);
      }
      await pressZ(page);
      continue;
    }
    // Final travel line is fully revealed; caller resumes and presses real Z.
    return;
  }
  throw new Error("timed out reaching final travel line");
}

async function waitForVignetteOpen(
  page: Page,
  expectedId: string,
  expectedCaption: string,
): Promise<void> {
  const overlay = page.locator(".travel-overlay");
  await expect(page.locator("html")).toHaveAttribute("data-travel-vignette", "open", {
    timeout: 8000,
  });
  await expect(overlay).toHaveAttribute("data-vignette-id", expectedId);
  await expect(overlay.locator(".travel-caption")).toHaveText(expectedCaption);
  await page.waitForFunction(() => {
    const img = document.querySelector(".travel-art");
    if (!(img instanceof HTMLImageElement)) return false;
    return img.complete && img.naturalWidth === 800 && img.naturalHeight === 450;
  });
}

async function assertVignetteLayoutFits(
  page: Page,
  viewportWidth: number,
  viewportHeight: number,
  expectTouchButton = false,
): Promise<void> {
  const metrics = await page.evaluate(() => {
    const card = document.querySelector(".travel-card")?.getBoundingClientRect();
    const caption = document.querySelector(".travel-caption")?.getBoundingClientRect();
    const skip = document.querySelector(".travel-skip-btn")?.getBoundingClientRect();
    const art = document.querySelector(".travel-art")?.getBoundingClientRect();
    const touchEl = document.querySelector(".touch-controls");
    const touchDisplay = touchEl === null ? "none" : getComputedStyle(touchEl).display;
    return { card, caption, skip, art, touchDisplay };
  });
  expect(metrics.card).not.toBeNull();
  expect(metrics.caption).not.toBeNull();
  expect(metrics.skip).not.toBeNull();
  expect(metrics.art).not.toBeNull();
  if (
    metrics.card === undefined ||
    metrics.caption === undefined ||
    metrics.skip === undefined ||
    metrics.art === undefined
  ) {
    throw new Error("Missing vignette layout elements");
  }
  expect(metrics.card.left).toBeGreaterThanOrEqual(0);
  expect(metrics.card.top).toBeGreaterThanOrEqual(0);
  expect(metrics.card.right).toBeLessThanOrEqual(viewportWidth + 1);
  expect(metrics.card.bottom).toBeLessThanOrEqual(viewportHeight + 1);
  expect(metrics.caption.right).toBeLessThanOrEqual(metrics.skip.left + 1);
  expect(metrics.art.width).toBeGreaterThan(240);
  expect(metrics.art.height).toBeGreaterThan(135);
  expect(metrics.touchDisplay).toBe("none");
  if (expectTouchButton) {
    expect(metrics.skip.height).toBeGreaterThanOrEqual(44);
  }
}

async function waitForStableOpacity(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const el = document.querySelector(".travel-overlay");
    if (!(el instanceof HTMLElement)) return false;
    const opacity = Number.parseFloat(getComputedStyle(el).opacity);
    return opacity >= 0.999;
  });
}

test(
  "Star-Line Bus live vignette plays, fits 1280x720, and skips cleanly on Z @smoke",
  async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await openHarness(page);
  await resetPaused(page, "pass");

  // Walk right next to Pinecone Pass bus stop (1017, 930) from spawn (930, 1015).
  await walk(page, "x", 1017);
  await walk(page, "y", 970);
  await page.keyboard.down("ArrowUp");
  await step(page, 2);
  await page.keyboard.up("ArrowUp");

  await pressZ(page);
  expect((await readState(page)).dialogue?.knot).toBe("pass_bus_stop");
  await advanceToFinalTravelLine(page, 0);

  // Resume live loop and press real Z to board Star-Line Bus back to Cloverhollow.
  await resume(page);
  await page.keyboard.press("z");

  await waitForVignetteOpen(page, "bus-hills", "Next stop: Cloverhollow!");
  await expect(page.locator(".travel-badge-label")).toHaveText("Star-Line Bus");
  await waitForStableOpacity(page);
  await assertVignetteLayoutFits(page, 1280, 720);

  if (REVIEW_SHOTS) {
    await page.screenshot({
      path: "art/review/e14-travel-bus-1280.jpg",
      type: "jpeg",
      quality: 90,
    });
  }

  // Wait for vignette to complete naturally and arrive cleanly in Plaza.
  await expect(page.locator("html")).not.toHaveAttribute("data-travel-vignette", "open", {
    timeout: 6000,
  });
  await page.waitForFunction(() => {
    const state = window.__cloverhollow?.getState();
    return state?.area === "plaza" && state.transition === null;
  });

  // Board Star-Line Bus again and verify real Z key skips cleanly with no dialogue leak.
  await resetPaused(page, "pass");
  await walk(page, "x", 1017);
  await walk(page, "y", 970);
  await page.keyboard.down("ArrowUp");
  await step(page, 2);
  await page.keyboard.up("ArrowUp");
  await pressZ(page);
  expect((await readState(page)).dialogue?.knot).toBe("pass_bus_stop");
  await advanceToFinalTravelLine(page, 0);

  await resume(page);
  await page.keyboard.press("z");
  await waitForVignetteOpen(page, "bus-hills", "Next stop: Cloverhollow!");

  const beforeSkip = Date.now();
  await page.keyboard.press("z");
  await expect(page.locator("html")).not.toHaveAttribute("data-travel-vignette", "open", {
    timeout: 3000,
  });
  expect(Date.now() - beforeSkip).toBeLessThan(1200);
  await page.waitForFunction(() => {
    const state = window.__cloverhollow?.getState();
    return state?.area === "plaza" && state.transition === null;
  });
  // Confirm-skip must not accidentally re-open bus dialogue on arrival.
  expect((await readState(page)).dialogue).toBeNull();
});

test(
  "Rowboat vignette fits 874x402 phone touch, tap-skips, and honors Reduced Motion @smoke",
  async ({ page }) => {
  await page.setViewportSize({ width: 874, height: 402 });
  await page.goto("./?touch=1");
  await page.waitForFunction(() => Boolean(window.__cloverhollow));
  await resetPaused(page, "island");

  // Walk from pier spawn (560, 700) to island-boat (365, 830).
  await walk(page, "y", 830);
  await walk(page, "x", 405);
  await page.keyboard.down("ArrowLeft");
  await step(page, 2);
  await page.keyboard.up("ArrowLeft");

  await pressZ(page);
  expect((await readState(page)).dialogue?.knot).toBe("island_boat");
  await advanceToFinalTravelLine(page, 0);

  await resume(page);
  await page.keyboard.press("z");

  await waitForVignetteOpen(page, "boat-island", "Next stop: Bubblegum Bay!");
  await expect(page.locator(".travel-badge-label")).toHaveText("Bay Rowboat");
  await expect(page.locator(".travel-skip-btn")).toHaveText("Skip");
  await waitForStableOpacity(page);
  await assertVignetteLayoutFits(page, 874, 402, true);

  if (REVIEW_SHOTS) {
    await page.screenshot({
      path: "art/review/e14-travel-boat-874.jpg",
      type: "jpeg",
      quality: 90,
    });
  }

  // Pointer tap skips immediately and arrives in Bubblegum Bay.
  await page.locator(".travel-overlay").click();
  await expect(page.locator("html")).not.toHaveAttribute("data-travel-vignette", "open", {
    timeout: 3000,
  });
  await page.waitForFunction(() => {
    const state = window.__cloverhollow?.getState();
    return state?.area === "bay" && state.transition === null;
  });

  // Reduced Motion bypasses travel vignettes immediately with zero delay.
  await page.evaluate(() => {
    window.__cloverhollow?.settings.setReducedMotion(true);
  });
  await resetPaused(page, "summit");
  await walk(page, "y", 875);
  await walk(page, "x", 465);
  await page.keyboard.down("ArrowLeft");
  await step(page, 2);
  await page.keyboard.up("ArrowLeft");
  await pressZ(page);
  expect((await readState(page)).dialogue?.knot).toBe("summit_lift");
  await advanceToFinalTravelLine(page, 0);

  await page.evaluate(() => {
    delete document.documentElement.dataset.sawTravelVignette;
    const observer = new MutationObserver(() => {
      if (document.documentElement.dataset.travelVignette === "open") {
        document.documentElement.dataset.sawTravelVignette = "yes";
        observer.disconnect();
      }
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-travel-vignette"],
    });
  });

  await resume(page);
  await page.keyboard.press("z");
  await page.waitForFunction(() => {
    const state = window.__cloverhollow?.getState();
    return state?.area === "pass" && state.transition === null;
  });
  const sawVignette = await page.evaluate(
    () => document.documentElement.dataset.sawTravelVignette === "yes",
  );
  expect(sawVignette).toBe(false);
});

test(
  "Ski Lift live vignette skips on Escape and paused harness steps bypass instantly",
  async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await openHarness(page);
  await resetPaused(page, "summit");

  await walk(page, "y", 875);
  await walk(page, "x", 465);
  await page.keyboard.down("ArrowLeft");
  await step(page, 2);
  await page.keyboard.up("ArrowLeft");
  await pressZ(page);
  expect((await readState(page)).dialogue?.knot).toBe("summit_lift");
  await advanceToFinalTravelLine(page, 0);

  await resume(page);
  await page.keyboard.press("z");
  await waitForVignetteOpen(page, "lift-summit", "Next stop: Pinecone Pass!");
  await expect(page.locator(".travel-badge-label")).toHaveText("Alpine Ski Lift");

  await page.keyboard.press("Escape");
  await expect(page.locator("html")).not.toHaveAttribute("data-travel-vignette", "open", {
    timeout: 3000,
  });
  await page.waitForFunction(() => {
    const state = window.__cloverhollow?.getState();
    return state?.area === "pass" && state.transition === null;
  });

  // Paused harness step must bypass vignette immediately without holding.
  await resetPaused(page, "summit");
  await walk(page, "y", 875);
  await walk(page, "x", 465);
  await page.keyboard.down("ArrowLeft");
  await step(page, 2);
  await page.keyboard.up("ArrowLeft");
  await pressZ(page);
  await advanceToFinalTravelLine(page, 0);
  await page.keyboard.press("z");
  await step(page, 40);
  expect((await readState(page)).area).toBe("pass");
  expect((await readState(page)).transition).toBeNull();
  await expect(page.locator("html")).not.toHaveAttribute("data-travel-vignette", "open");
});
