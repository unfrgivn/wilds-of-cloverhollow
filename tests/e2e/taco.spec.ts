import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import {
  bunFindReplayTick,
  bunHash,
  longFlowTimeout,
  openHarness,
  playAfter,
  queueScript,
  readHash,
  readState,
  recording,
  renderInfo,
  resetPaused,
  step,
} from "./helpers";

// Chef Mateo's Taco Truck Kitchen e2e (spec 8.2):
// 1. Replays tests/sim/scripts/new-game/taco.json with real keys after
//    m81-festival.json, matches Bun's exact state hash, captures 1280x720 and
//    874x402 baselines across ready, serving, order-clear, and result.
// 2. Plays a full taco order using direct mouse clicks on the painted topping
//    bowls (zero keyboard presses!).
test.describe.configure({ timeout: longFlowTimeout });

async function shoot(page: Page, name: string): Promise<void> {
  await expect(page).toHaveScreenshot(`${name}-1280.png`);
  await page.setViewportSize({ width: 874, height: 402 });
  await expect(page).toHaveScreenshot(`${name}-874.png`);
  await page.setViewportSize({ width: 1280, height: 720 });
}

test("real keys: Chef Mateo's Taco Truck ready, serving, order-clear, and spotless result",
  async ({ page }) => {
    const path = "tests/sim/scripts/new-game/taco.json";
    const expectedHash = bunHash(path, "new-game");
    await page.setViewportSize({ width: 1280, height: 720 });
    await openHarness(page);
    await resetPaused(page, "new-game");

    const captureMontage = process.env.CAPTURE_TACO_REVIEW === "1";
    if (captureMontage) mkdirSync("art/scratch/taco-review", { recursive: true });

    const phasesSeen: string[] = [];
    let readyShot = false;
    let servingShot = false;
    let clearShot = false;
    let resultShot = false;

    await playAfter(page, "tests/sim/scripts/new-game/m81-festival.json", path, async () => {
      const state = await readState(page);
      if (state.arcade?.game !== "taco") return;
      const info = await renderInfo(page);
      const arcade = info.arcade;
      if (arcade?.game !== "taco") return;
      if (phasesSeen.at(-1) !== arcade.phase) phasesSeen.push(arcade.phase);

      if (!readyShot && arcade.phase === "ready") {
        readyShot = true;
        if (captureMontage) {
          await page.screenshot({
            path: "art/scratch/taco-review/01-ready.png",
            animations: "disabled",
          });
        }
        await shoot(page, "taco-ready");
      }
      if (!servingShot && arcade.phase === "serving" && arcade.stepIndex >= 2) {
        servingShot = true;
        expect(arcade.bowls).toHaveLength(4);
        if (captureMontage) {
          await page.screenshot({
            path: "art/scratch/taco-review/02-serving.png",
            animations: "disabled",
          });
        }
        await shoot(page, "taco-serving");
      }
      if (!clearShot && arcade.phase === "order-clear") {
        clearShot = true;
        expect(arcade.orderBanner).not.toBeNull();
        if (captureMontage) {
          await page.screenshot({
            path: "art/scratch/taco-review/03-order-clear.png",
            animations: "disabled",
          });
        }
        await shoot(page, "taco-order-clear");
      }
      if (
        !resultShot &&
        arcade.phase === "result" &&
        state.arcade.revealed >= state.arcade.message.length
      ) {
        resultShot = true;
        expect(arcade.served).toBe(3);
        if (captureMontage) {
          await page.screenshot({
            path: "art/scratch/taco-review/04-result.png",
            animations: "disabled",
          });
        }
        await shoot(page, "taco-result");
      }
    });

    expect({ readyShot, servingShot, clearShot, resultShot }).toEqual({
      readyShot: true,
      servingShot: true,
      clearShot: true,
      resultShot: true,
    });
    expect(phasesSeen).toContain("ready");
    expect(phasesSeen).toContain("serving");
    expect(phasesSeen).toContain("order-clear");
    expect(phasesSeen).toContain("result");

    const end = await readState(page);
    expect(end.area).toBe("hills");
    expect(end.arcade).toBeNull();
    expect(end.coins).toBe(186);
    expect(end.snacks).toBe(9);
    expect(await readHash(page)).toBe(await expectedHash);
  });

test(
  "direct mouse clicks on painted topping bowls stack a complete taco order (zero keyboard)",
  { tag: "@smoke" },
  async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await page.setViewportSize({ width: 1280, height: 720 });
    await openHarness(page);
    await resetPaused(page, "new-game");

    // Fast-forward the recorded run directly to Chef Mateo's Taco Truck ready screen
    // (1 tick past open so dialogue confirm is released).
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
      throw new Error(`Expected Taco Truck ready state at tick ${targetTicks}`);
    }
    expect(readyState.arcade.phase).toBe("ready");
    await expect(page.locator(".taco-stage")).toBeVisible();
    const tacoMusic = await page.evaluate(() => window.__cloverhollow?.sound.music());
    expect(tacoMusic).toMatchObject({
      track: "taco",
      ambience: "town-breeze",
      duck: false,
      title: "Mateo's Fiesta Truck",
    });

    // Click the center of .taco-stage to start the lunch rush (zero keyboard!).
    const stageBox = await page.locator(".taco-stage").boundingBox();
    if (stageBox === null) throw new Error("Missing .taco-stage box");
    await page.mouse.click(stageBox.x + stageBox.width / 2, stageBox.y + stageBox.height / 2);
    await step(page, 2);

    const servingState = await readState(page);
    if (servingState.arcade?.game !== "taco") throw new Error("Expected taco serving state");
    expect(servingState.arcade.phase).toBe("serving");

    // Complete the entire first order exclusively by clicking each painted bowl button!
    const recipe = servingState.arcade.orders[0]?.recipe ?? [];
    expect(recipe.length).toBe(3);
    for (let index = 0; index < recipe.length; index += 1) {
      const topping = recipe[index];
      if (topping === undefined) throw new Error("Missing topping");
      const bowl = page.locator(`.taco-bowl[data-topping="${topping}"]`);
      await expect(bowl).toBeVisible();
      const bowlBox = await bowl.boundingBox();
      if (bowlBox === null) throw new Error(`Missing bowl box for ${topping}`);
      await page.mouse.click(bowlBox.x + bowlBox.width / 2, bowlBox.y + bowlBox.height / 2);
      await step(page, 2);
    }

    const cleared = await readState(page);
    if (cleared.arcade?.game !== "taco") throw new Error("Expected taco order-clear state");
    expect(cleared.arcade.phase).toBe("order-clear");
    expect(cleared.arcade.served).toBe(1);
    expect(cleared.arcade.mistakes).toBe(0);
    await expect(page.locator(".taco-order-banner")).toBeVisible();
    await expect(page.locator(".taco-order-banner")).toContainText("ORDER UP!");
    expect(errors).toEqual([]);
  },
);
