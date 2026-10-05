import { expect, test } from "@playwright/test";
import { openHarness, resetPaused, renderInfo, step } from "./helpers";

test.describe("bedroom", () => {
  test("renders Fae in the painted room", async ({ page }) => {
    await openHarness(page);
    await resetPaused(page, "new-game");
    const state = await page.evaluate(() => window.__cloverhollow?.getState());
    expect(state?.area).toBe("bedroom");
    expect((await renderInfo(page)).hidden).toBe(0);
    await expect(page).toHaveScreenshot("bedroom.png");
  });

  test("walk animation follows real movement and stops on idle", async ({ page }) => {
    await openHarness(page);
    await resetPaused(page, "new-game");
    await page.keyboard.down("ArrowDown");
    await step(page, 8);
    const moving = await renderInfo(page);
    expect(moving?.animation).toBe("walk_down");
    expect(moving?.frame).toBeGreaterThan(0);
    await page.keyboard.up("ArrowDown");
    await step(page, 1);
    const idle = await renderInfo(page);
    expect(idle?.animation).toBe("idle_down");
    expect(idle?.frame).toBe(0);
    await page.keyboard.down("ArrowRight");
    await step(page, 8);
    expect((await renderInfo(page)).animation).toBe("walk_left");
    await page.keyboard.up("ArrowRight");
  });

  test("collides with the bed and sorts the bed occluder", async ({ page }) => {
    await openHarness(page);
    await resetPaused(page, "new-game");
    await page.keyboard.down("ArrowLeft");
    await step(page, 25);
    await page.keyboard.up("ArrowLeft");
    await page.keyboard.down("ArrowUp");
    await step(page, 30);
    await page.keyboard.up("ArrowUp");
    const stopped = await page.evaluate(() => window.__cloverhollow?.getState());
    expect(stopped?.player.y).toBeGreaterThan(398);

    await resetPaused(page, "new-game");
    await page.keyboard.down("ArrowLeft");
    await step(page, 10);
    await page.keyboard.up("ArrowLeft");
    await page.keyboard.down("ArrowUp");
    await step(page, 12);
    await page.keyboard.up("ArrowUp");
    const info = await renderInfo(page);
    const fae = info.drawOrder.findIndex((item) => item.label === "fae");
    const bed = info.drawOrder.findIndex((item) => item.label === "occluder:bed");
    expect(bed).toBeGreaterThan(fae);
    await page.keyboard.down("ArrowDown");
    await step(page, 15);
    await page.keyboard.up("ArrowDown");
    const south = await renderInfo(page);
    expect(south.drawOrder.findIndex((item) => item.label === "fae"))
      .toBeGreaterThan(south.drawOrder.findIndex((item) => item.label === "occluder:bed"));
  });

  test("Maddie follows, sits after stopping, and y-sorts behind Fae", async ({ page }) => {
    await openHarness(page);
    await resetPaused(page, "new-game");
    await page.keyboard.down("ArrowRight");
    await step(page, 120);
    await page.keyboard.up("ArrowRight");
    const moving = await page.evaluate(() => window.__cloverhollow?.getState());
    if (moving === undefined) throw new Error("hook unavailable");
    const dx = moving.player.x - moving.maddie.x;
    const dy = moving.player.y - moving.maddie.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    expect(distance).toBeGreaterThanOrEqual(50);
    expect(distance).toBeLessThanOrEqual(140);
    await step(page, 60);
    const stopped = await page.evaluate(() => window.__cloverhollow?.getState());
    if (stopped === undefined) throw new Error("hook unavailable");
    const info = await renderInfo(page);
    expect(info.maddie.animation.startsWith("idle_")).toBe(true);
    expect(stopped.maddie.stillTicks).toBeGreaterThanOrEqual(30);
    await resetPaused(page, "new-game");
    await page.keyboard.down("ArrowUp");
    await step(page, 30);
    await page.keyboard.up("ArrowUp");
    const sorted = await renderInfo(page);
    const faeIndex = sorted.drawOrder.findIndex((item) => item.label === "fae");
    const maddieIndex = sorted.drawOrder.findIndex((item) => item.label === "maddie");
    expect(maddieIndex).toBeGreaterThan(faeIndex);
    await resetPaused(page, "new-game");
    await page.keyboard.down("ArrowDown");
    await step(page, 40);
    await page.keyboard.up("ArrowDown");
    await step(page, 90);
    const settled = await renderInfo(page);
    expect(settled.hidden).toBeLessThanOrEqual(0.25);
    expect(settled.maddie.animation.startsWith("idle_")).toBe(true);
  });

  test("reloads areas without duplicate occluders", async ({ page }) => {
    await openHarness(page);
    for (let index = 0; index < 2; index += 1) {
      await resetPaused(page, "harness");
      expect((await renderInfo(page)).drawOrder.filter((item) =>
        item.label.startsWith("occluder:")).length).toBe(0);
      await resetPaused(page, "new-game");
      expect((await renderInfo(page)).drawOrder.filter((item) =>
        item.label.startsWith("occluder:")).length).toBe(4);
    }
  });
});
