import { expect, test, type Page } from "@playwright/test";
import { openHarness, readState, resetPaused, renderInfo, step } from "./helpers";

// Whether the bed prop is drawn over Fae (spec 6.2): of its strips across her
// body, the one sorted last is above her.
async function bedOverFae(page: Page): Promise<boolean> {
  const info = await renderInfo(page);
  const { x } = (await readState(page)).player;
  const fae = info.drawOrder.find((item) => item.label === "fae");
  const strips = info.props.find((item) => item.id === "bed")?.strips
    .filter((strip) => strip.left < x + 25 && strip.right > x - 25) ?? [];
  if (fae === undefined || strips.length === 0) throw new Error("no Fae or bed near her");
  return Math.max(...strips.map((strip) => strip.zIndex)) > fae.zIndex;
}

test.describe("bedroom", () => {
  test("renders Fae in the painted room", async ({ page }) => {
    await openHarness(page);
    await resetPaused(page, "new-game");
    const state = await page.evaluate(() => window.__cloverhollow?.getState());
    expect(state?.area).toBe("bedroom");
    expect((await renderInfo(page)).party).toMatchObject([{ id: "maddie", hidden: 0 }]);
    await expect(page).toHaveScreenshot("bedroom.png");
  });

  test("walk animation follows real movement and stops on idle", { tag: "@smoke" },
    async ({ page }) => {
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

  test("collides with the bed and sorts the bed prop", async ({ page }) => {
    await openHarness(page);
    await resetPaused(page, "new-game");
    // Up into the bed's foot: its footprint stops her a collider's radius
    // (20 units) short of the painted foot, at y ~378 there.
    await page.keyboard.down("ArrowLeft");
    await step(page, 25);
    await page.keyboard.up("ArrowLeft");
    await page.keyboard.down("ArrowUp");
    await step(page, 30);
    await page.keyboard.up("ArrowUp");
    const stopped = await readState(page);
    expect(stopped.player.y).toBeCloseTo(398, 0);

    // Beside its footboard, north of its front, the bed is drawn over her;
    // south of it, she's drawn over the bed.
    await resetPaused(page, "new-game");
    await page.keyboard.down("ArrowLeft");
    await step(page, 10);
    await page.keyboard.up("ArrowLeft");
    await page.keyboard.down("ArrowUp");
    await step(page, 12);
    await page.keyboard.up("ArrowUp");
    expect(await bedOverFae(page)).toBe(true);
    await page.keyboard.down("ArrowDown");
    await step(page, 15);
    await page.keyboard.up("ArrowDown");
    expect(await bedOverFae(page)).toBe(false);
  });

  test("Maddie follows, sits after stopping, and y-sorts behind Fae", async ({ page }) => {
    await openHarness(page);
    await resetPaused(page, "new-game");
    await page.keyboard.down("ArrowRight");
    await step(page, 120);
    await page.keyboard.up("ArrowRight");
    const moving = await page.evaluate(() => window.__cloverhollow?.getState());
    if (moving === undefined) throw new Error("hook unavailable");
    const [maddie] = moving.party;
    if (maddie === undefined) throw new Error("Maddie missing from the party");
    const dx = moving.player.x - maddie.x;
    const dy = moving.player.y - maddie.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    expect(distance).toBeGreaterThanOrEqual(50);
    expect(distance).toBeLessThanOrEqual(140);
    await step(page, 60);
    const stopped = await page.evaluate(() => window.__cloverhollow?.getState());
    if (stopped === undefined) throw new Error("hook unavailable");
    const info = await renderInfo(page);
    expect(info.party[0]?.animation.startsWith("idle_")).toBe(true);
    expect(stopped.party[0]?.stillTicks).toBeGreaterThanOrEqual(30);
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
    expect(settled.party[0]?.hidden).toBeLessThanOrEqual(0.25);
    expect(settled.party[0]?.animation.startsWith("idle_")).toBe(true);
  });

  test("reloads areas without duplicate props", async ({ page }) => {
    await openHarness(page);
    for (let index = 0; index < 2; index += 1) {
      await resetPaused(page, "harness");
      expect((await renderInfo(page)).props).toEqual([]);
      await resetPaused(page, "new-game");
      expect((await renderInfo(page)).props.map((prop) => prop.id))
        .toEqual(["bed", "desk", "desk-chair", "shelf", "cat-bed"]);
    }
  });
});
