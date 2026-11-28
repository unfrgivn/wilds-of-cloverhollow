import { mkdirSync } from "node:fs";
import { expect, test } from "@playwright/test";
import {
  bunHash,
  longFlowTimeout,
  openHarness,
  playWithKeys,
  readHash,
  readState,
  recording,
  renderInfo,
  resetPaused,
  step,
  walk,
} from "./helpers";

test.describe.configure({ timeout: longFlowTimeout });

const captureReview = process.env.CAPTURE_E5_REVIEW === "1";

test.describe("Elevation Track E5: Cozy Dash, Overworld Tools & Spatial Puzzles", () => {
  test("real Shift key dashes at ~1.45x speed with dust puffs and touch dash toggles", {
    tag: "@smoke",
  }, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await openHarness(page);
    await resetPaused(page, "plaza");

    const startWalk = await readState(page);
    await page.keyboard.down("ArrowRight");
    await step(page, 20);
    await page.keyboard.up("ArrowRight");
    const afterWalk = await readState(page);
    const walkDelta = afterWalk.player.x - startWalk.player.x;

    await resetPaused(page, "plaza");
    const startDash = await readState(page);
    await page.keyboard.down("ShiftLeft");
    await page.keyboard.down("ArrowRight");
    for (let i = 0; i < 4; i += 1) {
      await step(page, 5);
    }
    const midDashInfo = await renderInfo(page);
    await page.keyboard.up("ArrowRight");
    await page.keyboard.up("ShiftLeft");
    const afterDash = await readState(page);
    const dashDelta = afterDash.player.x - startDash.player.x;

    expect(walkDelta).toBeGreaterThan(60);
    expect(dashDelta / walkDelta).toBeCloseTo(1.45, 1);
    expect(midDashInfo.puzzles.dashing).toBe(true);
    expect(midDashInfo.footstepPuffs).toBeGreaterThan(0);

    // Subtle touch dash toggle works cleanly on phone layout.
    await page.setViewportSize({ width: 874, height: 402 });
    await page.goto("./?touch=1");
    await page.waitForFunction(() => Boolean(window.__cloverhollow));
    await resetPaused(page, "cavern");
    const dashBtn = page.locator(".touch-dash");
    const lassoBtn = page.locator(".touch-lasso");
    await expect(dashBtn).toBeVisible();
    await expect(lassoBtn).toBeVisible();
    await expect(dashBtn).toHaveAttribute("aria-pressed", "false");
    await dashBtn.click();
    await expect(dashBtn).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.down("ArrowRight");
    await step(page, 10);
    await page.keyboard.up("ArrowRight");
    const touchDashInfo = await renderInfo(page);
    expect(touchDashInfo.puzzles.dashing).toBe(true);
    await dashBtn.click();
    await expect(dashBtn).toHaveAttribute("aria-pressed", "false");
  });

  test("real keys solve Crystal Cavern blacklight prism beam puzzle matching Bun hash", {
    tag: "@smoke",
  }, async ({ page }) => {
    const path = "tests/sim/scripts/cavern/cavern-prism.json";
    const expectedHash = bunHash(path, "cavern");
    await page.setViewportSize({ width: 1280, height: 720 });
    await openHarness(page);
    await resetPaused(page, "cavern");

    const beforeInfo = await renderInfo(page);
    const beforeSteps = beforeInfo.props.find((prop) => prop.id === "crystal-steps");
    expect(beforeSteps?.hidden).toBe(true);
    expect(beforeInfo.puzzles.solved).not.toContain("cavern-prism");
    if (captureReview) {
      mkdirSync("art/scratch/e5-shots", { recursive: true });
      await page.screenshot({ path: "art/scratch/e5-shots/cavern-before.png" });
    }

    let sawBeams = false;
    await playWithKeys(page, recording(path), 8, async () => {
      const info = await renderInfo(page);
      if (info.puzzles.activeBeams >= 3) sawBeams = true;
    });

    const afterState = await readState(page);
    const afterInfo = await renderInfo(page);
    const afterSteps = afterInfo.props.find((prop) => prop.id === "crystal-steps");
    expect(sawBeams).toBe(true);
    expect(afterState.puzzles?.["cavern-prism"]).toBe(true);
    expect(afterInfo.puzzles.solved).toContain("cavern-prism");
    expect(afterInfo.puzzles.activeBeams).toBeGreaterThanOrEqual(3);
    expect(afterSteps?.state).toBe("lit");
    expect(afterSteps?.hidden).toBe(false);
    expect(await readHash(page)).toBe(await expectedHash);
    if (captureReview) {
      await page.screenshot({ path: "art/scratch/e5-shots/cavern-after.png" });
    }
  });

  test("real keys perform Enchanted Forest 3-tool seal ritual matching Bun hash", {
    tag: "@smoke",
  }, async ({ page }) => {
    const path = "tests/sim/scripts/mist/mist-3tool-seal.json";
    const expectedHash = bunHash(path, "mist");
    await page.setViewportSize({ width: 1280, height: 720 });
    await openHarness(page);
    await resetPaused(page, "mist");

    const beforeInfo = await renderInfo(page);
    expect(beforeInfo.props.find((prop) => prop.id === "seal-open")?.hidden).toBe(true);
    if (captureReview) {
      mkdirSync("art/scratch/e5-shots", { recursive: true });
      await page.screenshot({ path: "art/scratch/e5-shots/mist-before.png" });
    }

    let sawLasso = false;
    let sawFluteWheel = false;
    let lassoTicks = 0;
    let capturedLasso = false;
    let capturedWheel = false;
    await playWithKeys(page, recording(path), 1, async () => {
      const info = await renderInfo(page);
      if (info.puzzles.lassoActive) {
        sawLasso = true;
        lassoTicks += 1;
        if (captureReview && !capturedLasso && lassoTicks === 4) {
          capturedLasso = true;
          await page.screenshot({ path: "art/scratch/e5-shots/mist-lasso.png" });
        }
      }
      if (info.puzzles.fluteWheelOpen) {
        sawFluteWheel = true;
        await expect(page.locator(".flute-wheel")).toBeVisible();
        if (captureReview && !capturedWheel) {
          capturedWheel = true;
          await page.screenshot({ path: "art/scratch/e5-shots/mist-flute-wheel.png" });
        }
      }
    });

    const afterState = await readState(page);
    const afterInfo = await renderInfo(page);
    expect(sawLasso).toBe(true);
    expect(sawFluteWheel).toBe(true);
    expect(afterState.puzzles?.["mist-lantern-ritual"]).toBe(true);
    expect(afterState.puzzles?.["mist-lasso-ritual"]).toBe(true);
    expect(afterState.puzzles?.["mist-flute-ritual"]).toBe(true);
    expect(afterState.puzzles?.["mist-forest-seal"]).toBe(true);
    expect(afterInfo.props.find((prop) => prop.id === "rope-bridge")?.state).toBe("across");
    expect(afterInfo.props.find((prop) => prop.id === "seal-open")?.state).toBe("open");
    expect(afterInfo.props.find((prop) => prop.id === "seal-open")?.hidden).toBe(false);
    expect(await readHash(page)).toBe(await expectedHash);
    if (captureReview) {
      await page.screenshot({ path: "art/scratch/e5-shots/mist-after.png" });
    }
  });

  test("real keys solve Starlight Island seashell flute harmony and Pinecone Pass snowball co-op",
    async ({ page }) => {
      const islandPath = "tests/sim/scripts/island/island-flute-harmony.json";
      const expectedIslandHash = bunHash(islandPath, "island");
      await page.setViewportSize({ width: 1280, height: 720 });
      await openHarness(page);
      await resetPaused(page, "island");
      await playWithKeys(page, recording(islandPath), 4, async () => undefined);
      expect((await readState(page)).puzzles?.["island-seashell-harmony"]).toBe(true);
      expect(await readHash(page)).toBe(await expectedIslandHash);

      // Pinecone Pass: command Jordan to hold plate 1 + slide snowball onto plate 2.
      await resetPaused(page, "pass-party");
      await walk(page, "x", 1175);
      await walk(page, "y", 970);
      await page.keyboard.down("z");
      await step(page, 1);
      await page.keyboard.up("z");
      await step(page, 4);
      const heldState = await readState(page);
      expect(Object.keys(heldState.puzzleArea?.heldPlates ?? {})).toContain("pass-plate-jordan");

      // Walk to the left of the snowball at (1160, 1005) and nudge it right onto plate 2!
      await walk(page, "x", 1122);
      await walk(page, "y", 1005);
      await page.keyboard.down("ArrowRight");
      await step(page, 18);
      await page.keyboard.up("ArrowRight");
      await step(page, 20);
      const passState = await readState(page);
      expect(passState.puzzles?.["pass-snowball-coop"]).toBe(true);
      if (captureReview) {
        mkdirSync("art/scratch/e5-shots", { recursive: true });
        await page.screenshot({ path: "art/scratch/e5-shots/pass-coop-after.png" });
      }
    });
});
