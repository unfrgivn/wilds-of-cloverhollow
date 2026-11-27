import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import {
  longFlowTimeout,
  openHarness,
  queueScript,
  readState,
  recording,
  resetPaused,
  step,
} from "./helpers";

test.describe.configure({ timeout: longFlowTimeout });

function clawNumbers(): { speed: number; pup: { x: number; z: number } } {
  const record = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null;
  const content: unknown = JSON.parse(readFileSync("content/arcade.json", "utf8"));
  if (
    !record(content) ||
    !record(content.claw) ||
    typeof content.claw.speed !== "number" ||
    !Array.isArray(content.claw.heap)
  ) {
    throw new Error("content/arcade.json has no claw");
  }
  const pup: unknown = content.claw.heap.find(
    (plush) => record(plush) && plush.prize === "pup-plush",
  );
  if (!record(pup) || typeof pup.x !== "number" || typeof pup.z !== "number") {
    throw new Error("the heap has no pup");
  }
  return { speed: content.claw.speed, pup: { x: pup.x, z: pup.z } };
}

async function clawPhase(page: Page): Promise<{ phase: string | null; outcome: string | null }> {
  return page.evaluate(() => {
    const game = window.__cloverhollow?.getState().arcade ?? null;
    if (game?.game !== "claw") return { phase: null, outcome: null };
    return { phase: game.phase, outcome: game.outcome };
  });
}

async function holdConfirm(page: Page, ticks: number): Promise<void> {
  await page.keyboard.down("z");
  await step(page, ticks);
  await page.keyboard.up("z");
  await step(page, 1);
}

test(
  "Claw Machine spawns GOT IT! ★ on lift and ★ PRIZE! on winning grab @smoke",
  async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await page.setViewportSize({ width: 1280, height: 720 });
    await openHarness(page);
    await resetPaused(page, "arcade");

    for (const segment of recording("tests/sim/scripts/arcade/claw.json")) {
      await queueScript(page, [segment]);
      await step(page, segment.ticks);
      if ((await clawPhase(page)).phase === "ready") break;
    }
    await step(page, 1);

    // Silent on initial open.
    await expect(page.locator(".arcade-overlay .arcade-popup")).toHaveCount(0);

    const game = (await readState(page)).arcade;
    if (game?.game !== "claw") throw new Error("claw machine did not open");
    const { speed, pup } = clawNumbers();

    // Two real keyboard holds to position the claw directly over Pup Plush.
    await holdConfirm(page, 1 + Math.ceil((pup.x - game.x) / speed));
    expect((await clawPhase(page)).phase).toBe("aiming");
    await holdConfirm(page, 1 + Math.ceil((pup.z - game.z) / speed));

    // Step until the claw closes and begins lifting the grabbed plush.
    for (let count = 0; count < 120; count += 1) {
      const now = await clawPhase(page);
      if (now.phase === "lifting") break;
      await step(page, 2);
    }
    expect(await clawPhase(page)).toEqual({ phase: "lifting", outcome: "grabbed" });

    const liftPopup = page.locator(".arcade-overlay .arcade-popup.is-star").first();
    await expect(liftPopup).toBeVisible();
    await expect(liftPopup).toHaveText("GOT IT! ★");
    await expect(liftPopup).toHaveAttribute("data-popup-kind", "star");

    // Step until the plush drops down the chute into result.
    for (let count = 0; count < 180; count += 1) {
      const now = await clawPhase(page);
      if (now.phase === "result") break;
      await step(page, 4);
    }
    expect(await clawPhase(page)).toEqual({ phase: "result", outcome: "grabbed" });

    const prizePopup = page.locator(".arcade-overlay .arcade-popup.is-rare").first();
    await expect(prizePopup).toBeVisible();
    await expect(prizePopup).toHaveText("★ PRIZE!");
    await expect(prizePopup).toHaveAttribute("data-popup-kind", "rare");
    await expect(page.locator(".battle-reward-name")).toHaveText("Pup Plush");
    expect((await readState(page)).prizes).toContain("pup-plush");
    expect(errors).toEqual([]);
  },
);
