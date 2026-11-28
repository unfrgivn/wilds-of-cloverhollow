import { expect, test, type Page } from "@playwright/test";
import { openHarness, readHash, readState, renderInfo, resetPaused, step } from "./helpers";

async function holdPaused(page: Page, key: string, ticks: number): Promise<void> {
  await page.keyboard.down(key);
  await step(page, ticks);
  await page.keyboard.up(key);
}

async function readPresentation(page: Page): Promise<{
  paperGrain: string | undefined;
  paperGrainCss: string;
  cameraZoom: number;
  cameraFraming: string | undefined;
  cameraShake: number;
  grassTufts: number;
  footstepKind: string | undefined;
}> {
  return page.evaluate(() => {
    const root = document.documentElement;
    const ds = root.dataset;
    return {
      paperGrain: ds.paperGrain,
      paperGrainCss: root.style.getPropertyValue("--cloverhollow-paper-grain").trim(),
      cameraZoom: Number(ds.cameraZoom ?? "1"),
      cameraFraming: ds.cameraFraming,
      cameraShake: Number(ds.cameraShake ?? "0"),
      grassTufts: Number(ds.grassTufts ?? "0"),
      footstepKind: ds.footstepKind,
    };
  });
}

test(
  "E1 dialogue camera frames partner with subtle zoom, Reduced Motion safety, and paper grain",
  { tag: "@smoke" },
  async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await openHarness(page);
    await page.evaluate(() => window.__cloverhollow?.settings.setReducedMotion(false));
    await resetPaused(page, "park");

    // Walk Fae cleanly beside Hazel in Meadow Park via real keys (side-by-side framing).
    await holdPaused(page, "ArrowRight", 10);
    await holdPaused(page, "ArrowUp", 96);
    await holdPaused(page, "ArrowLeft", 6);
    await holdPaused(page, "ArrowRight", 1);
    const prompt = page.locator(".sticker-prompt");
    await expect(prompt).toBeVisible();

    await page.evaluate(() => window.__cloverhollow?.resume());
    await expect
      .poll(async () => (await readPresentation(page)).paperGrain)
      .toBe("live");
    const liveIdle = await readPresentation(page);
    expect(liveIdle.paperGrainCss.startsWith('url("data:image/png;base64,')).toBe(true);
    expect(liveIdle.cameraFraming).toBe("follow");
    expect(liveIdle.cameraZoom).toBeCloseTo(1, 2);

    // Open dialogue using a real key press.
    await page.keyboard.press("z");
    await expect(page.locator(".sticker-dialogue")).toBeVisible();

    // Smooth camera director frames both characters with subtle ~1.07x dialogue zoom.
    await expect
      .poll(async () => (await readPresentation(page)).cameraFraming)
      .toBe("dialogue");
    await expect
      .poll(async () => (await readPresentation(page)).cameraZoom, { timeout: 5000 })
      .toBeGreaterThanOrEqual(1.055);
    const zoomed = await readPresentation(page);
    expect(zoomed.cameraZoom).toBeLessThanOrEqual(1.085);

    if (process.env.CLOVERHOLLOW_REVIEW_SHOTS === "1" && testInfo.project.name === "chromium") {
      await page.waitForTimeout(260);
      await page.screenshot({
        path: "art/review/e1-dialogue-camera.jpg",
        type: "jpeg",
        quality: 90,
      });
    }

    // Enabling Reduced Motion immediately calms dialogue zoom back to 1.000 and clamps shake to 0.
    await page.evaluate(() => window.__cloverhollow?.settings.setReducedMotion(true));
    await expect
      .poll(async () => (await readPresentation(page)).cameraZoom)
      .toBe(1);
    expect((await readPresentation(page)).cameraShake).toBe(0);

    // Restoring Reduced Motion off resumes gentle dialogue framing.
    await page.evaluate(() => window.__cloverhollow?.settings.setReducedMotion(false));
    await expect
      .poll(async () => (await readPresentation(page)).cameraZoom, { timeout: 5000 })
      .toBeGreaterThanOrEqual(1.05);

    // Close dialogue (press cancel/confirm cleanly); camera eases back to follow / 1.000.
    for (let i = 0; i < 16; i += 1) {
      const open = (await readState(page)).dialogue !== null;
      if (!open) break;
      await page.keyboard.press("x");
      await page.waitForTimeout(60);
      if ((await readState(page)).dialogue !== null) {
        await page.keyboard.press("z");
        await page.waitForTimeout(80);
      }
    }
    await expect(page.locator(".sticker-dialogue")).toBeHidden({ timeout: 5000 });
    await expect
      .poll(async () => (await readPresentation(page)).cameraFraming)
      .toBe("follow");
    await expect
      .poll(async () => (await readPresentation(page)).cameraZoom, { timeout: 5000 })
      .toBeLessThanOrEqual(1.01);
  },
);

test(
  "E1 living ground reactivity emits surface-aware footsteps and grass-tuft sway across biomes",
  { tag: "@smoke" },
  async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await openHarness(page);
    await page.evaluate(() => window.__cloverhollow?.settings.setReducedMotion(false));

    // 1. Meadow Park: grass-fleck footsteps + reactive grass tufts on open central lawn.
    await resetPaused(page, "park");
    await holdPaused(page, "ArrowRight", 10);
    await holdPaused(page, "ArrowUp", 70);
    await holdPaused(page, "ArrowRight", 35);
    await page.evaluate(() => window.__cloverhollow?.resume());

    await expect
      .poll(async () => (await readPresentation(page)).grassTufts, { timeout: 5000 })
      .toBeGreaterThan(0);

    await page.keyboard.down("ArrowRight");
    await expect
      .poll(async () => (await readPresentation(page)).footstepKind, { timeout: 5000 })
      .toBe("grass-fleck");
    await page.waitForTimeout(320);
    expect((await renderInfo(page)).footstepPuffs).toBeGreaterThan(0);
    if (process.env.CLOVERHOLLOW_REVIEW_SHOTS === "1" && testInfo.project.name === "chromium") {
      await page.screenshot({
        path: "art/review/e1-park-grass-footsteps.jpg",
        type: "jpeg",
        quality: 90,
      });
    }
    await page.keyboard.up("ArrowRight");

    // Reduced Motion hides reactive grass tufts and suppresses footsteps cleanly.
    await page.evaluate(() => window.__cloverhollow?.settings.setReducedMotion(true));
    await expect
      .poll(async () => (await readPresentation(page)).grassTufts)
      .toBe(0);
    await expect
      .poll(async () => (await renderInfo(page)).footstepPuffs)
      .toBe(0);
    await page.evaluate(() => window.__cloverhollow?.settings.setReducedMotion(false));

    // 2. Pinecone Pass: snow-sparkle footsteps across open snowy clearing.
    await resetPaused(page, "pass");
    await holdPaused(page, "ArrowLeft", 50);
    await holdPaused(page, "ArrowUp", 55);
    await page.evaluate(() => window.__cloverhollow?.resume());
    await page.keyboard.down("ArrowRight");
    await expect
      .poll(async () => (await readPresentation(page)).footstepKind, { timeout: 5000 })
      .toBe("snow-sparkle");
    await page.waitForTimeout(260);
    expect((await renderInfo(page)).footstepPuffs).toBeGreaterThan(0);
    if (process.env.CLOVERHOLLOW_REVIEW_SHOTS === "1" && testInfo.project.name === "chromium") {
      await page.screenshot({
        path: "art/review/e1-pass-snow-sparkles.jpg",
        type: "jpeg",
        quality: 90,
      });
    }
    await page.keyboard.up("ArrowRight");

    // 3. Bubblegum Bay: sand-fleck footsteps on dry beach, then water-ripple along wet shore.
    await resetPaused(page, "bay");
    await page.evaluate(() => window.__cloverhollow?.resume());
    await page.keyboard.down("ArrowRight");
    await expect
      .poll(async () => (await readPresentation(page)).footstepKind, { timeout: 5000 })
      .toBe("sand-fleck");
    await page.keyboard.up("ArrowRight");

    await resetPaused(page, "bay");
    await holdPaused(page, "ArrowRight", 136);
    await holdPaused(page, "ArrowUp", 58);
    await page.evaluate(() => window.__cloverhollow?.resume());
    await page.keyboard.down("ArrowUp");
    await expect
      .poll(async () => (await readPresentation(page)).footstepKind, { timeout: 5000 })
      .toBe("water-ripple");
    await page.keyboard.up("ArrowUp");
    await page.keyboard.down("ArrowRight");
    await page.waitForTimeout(360);
    expect((await renderInfo(page)).footstepPuffs).toBeGreaterThan(0);
    if (process.env.CLOVERHOLLOW_REVIEW_SHOTS === "1" && testInfo.project.name === "chromium") {
      await page.screenshot({
        path: "art/review/e1-bay-ripples-sand.jpg",
        type: "jpeg",
        quality: 90,
      });
    }
    await page.keyboard.up("ArrowRight");
  },
);

test(
  "E1 preserves exact paused-step determinism, zero shake/tufts, and stable core hash",
  { tag: "@smoke" },
  async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await openHarness(page);
    await page.evaluate(() => window.__cloverhollow?.settings.setReducedMotion(false));

    const runPausedSequence = async (): Promise<string> => {
      await resetPaused(page, "plaza");
      const arrival = await readPresentation(page);
      expect(arrival.paperGrain).toBe("paused");
      expect(arrival.cameraZoom).toBe(1);
      expect(arrival.cameraFraming).toBe("follow");
      expect(arrival.cameraShake).toBe(0);
      expect(arrival.grassTufts).toBe(0);

      await holdPaused(page, "ArrowDown", 108);
      await page.keyboard.press("z");
      await step(page, 24);
      const duringTalk = await readPresentation(page);
      expect(duringTalk.paperGrain).toBe("paused");
      expect(duringTalk.cameraZoom).toBe(1);
      expect(duringTalk.cameraFraming).toBe("follow");
      expect(duringTalk.cameraShake).toBe(0);
      expect(duringTalk.grassTufts).toBe(0);
      return readHash(page);
    };

    const firstHash = await runPausedSequence();
    const secondHash = await runPausedSequence();
    expect(secondHash).toBe(firstHash);
  },
);
