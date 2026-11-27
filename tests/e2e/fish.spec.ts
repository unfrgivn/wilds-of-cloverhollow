import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import {
  bunHash,
  longFlowTimeout,
  openHarness,
  playAfter,
  readHash,
  readState,
  renderInfo,
  resetPaused,
} from "./helpers";

// Bubblegum Bay Fishing Minigame e2e (spec 8.2): chains from golden-bay.json,
// walks out to Sue's dock with real keyboard keys, opens fishing, aims, casts,
// waits for the splash bite, reels in a Sunny Perch, celebrates the catch card,
// matches Bun's exact state hash, and captures desktop & phone baselines.
test.describe.configure({ timeout: longFlowTimeout });

async function shoot(page: Page, name: string): Promise<void> {
  await expect(page).toHaveScreenshot(`${name}-1280.png`);
  await page.setViewportSize({ width: 874, height: 402 });
  await expect(page).toHaveScreenshot(`${name}-874.png`);
  await page.setViewportSize({ width: 1280, height: 720 });
}

test("real keys: Bubblegum Bay fishing dock aim, bite, reel, and catch", async ({ page }) => {
  const path = "tests/sim/scripts/new-game/fish.json";
  const expectedHash = bunHash(path, "new-game");
  await page.setViewportSize({ width: 1280, height: 720 });
  await openHarness(page);
  await resetPaused(page, "new-game");

  const captureMontage = process.env.CAPTURE_FISH_REVIEW === "1";
  if (captureMontage) mkdirSync("art/scratch/fish-review", { recursive: true });

  const phasesSeen: string[] = [];
  let aimShot = false;
  let biteShot = false;
  let reelShot = false;
  let catchShot = false;

  await playAfter(page, "tests/sim/scripts/new-game/golden-bay.json", path, async () => {
    const state = await readState(page);
    if (state.arcade?.game !== "fish") return;
    const info = await renderInfo(page);
    const arcade = info.arcade;
    if (arcade?.game !== "fish") return;
    if (phasesSeen.at(-1) !== arcade.phase) phasesSeen.push(arcade.phase);

    if (!aimShot && arcade.phase === "aim" && arcade.power >= 0.7) {
      aimShot = true;
      if (captureMontage) {
        await page.screenshot({
          path: "art/scratch/fish-review/01-aim.png",
          animations: "disabled",
        });
      }
      await shoot(page, "fish-aim");
    }
    if (!biteShot && arcade.phase === "bite") {
      biteShot = true;
      if (captureMontage) {
        await page.screenshot({
          path: "art/scratch/fish-review/02-bite.png",
          animations: "disabled",
        });
      }
    }
    if (!reelShot && arcade.phase === "reeling" && arcade.reelProgress >= 0.65) {
      reelShot = true;
      if (captureMontage) {
        await page.screenshot({
          path: "art/scratch/fish-review/03-reeling.png",
          animations: "disabled",
        });
      }
      await shoot(page, "fish-reeling");
    }
    if (!catchShot && arcade.phase === "result" && arcade.caught !== null &&
      state.arcade.revealed >= state.arcade.message.length) {
      catchShot = true;
      expect(arcade.catchCard).not.toBeNull();
      expect(arcade.caughtSpecies).toBe(1);
      expect(arcade.totalSpecies).toBe(6);
      if (captureMontage) {
        await page.screenshot({
          path: "art/scratch/fish-review/04-catch.png",
          animations: "disabled",
        });
      }
      await shoot(page, "fish-catch");
    }
  });

  expect({ aimShot, biteShot, reelShot, catchShot }).toEqual({
    aimShot: true,
    biteShot: true,
    reelShot: true,
    catchShot: true,
  });
  expect(phasesSeen).toContain("aim");
  expect(phasesSeen).toContain("bite");
  expect(phasesSeen).toContain("reeling");
  expect(phasesSeen).toContain("result");

  const end = await readState(page);
  expect(end.area).toBe("bay");
  expect(end.arcade).toBeNull();
  expect(end.caughtFish).toEqual({ perch: 1 });
  expect(await readHash(page)).toBe(await expectedHash);
});
