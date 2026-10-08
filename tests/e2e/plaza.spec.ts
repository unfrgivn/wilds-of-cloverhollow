import { expect, test } from "@playwright/test";
import { openHarness, renderInfo, resetPaused, step } from "./helpers";

test("real keys cross the bedroom and kitchen doors in both directions", async ({ page }) => {
  await openHarness(page);
  await resetPaused(page, "new-game");
  await page.keyboard.down("ArrowUp");
  await step(page, 20);
  await page.keyboard.up("ArrowUp");
  await step(page, 36);
  const kitchen = await page.evaluate(() => window.__cloverhollow?.getState());
  expect(kitchen?.area).toBe("kitchen");
  expect(kitchen?.player).toEqual({ x: 600, y: 650 });
  expect(kitchen?.party.map((member) => member.id)).toEqual(["maddie"]);
  const kitchenInfo = await renderInfo(page);
  expect(kitchenInfo.area).toBe("kitchen");
  expect(kitchenInfo.drawOrder.some((item) => item.label === "maddie")).toBe(true);
  expect(kitchenInfo.cachedAreaTextures.some((url) => url.includes("bedroom")))
    .toBe(false);
  expect(kitchenInfo.cachedAreaTextures.some((url) => url.includes("kitchen")))
    .toBe(true);

  // Down and left onto the first step of the stairs, back up to the bedroom.
  await page.keyboard.down("ArrowDown");
  await step(page, 5);
  await page.keyboard.up("ArrowDown");
  await page.keyboard.down("ArrowLeft");
  await step(page, 46);
  await page.keyboard.up("ArrowLeft");
  await step(page, 36);
  const bedroom = await page.evaluate(() => window.__cloverhollow?.getState());
  expect(bedroom?.area).toBe("bedroom");
  expect(bedroom?.player).toEqual({ x: 525, y: 380 });
  const bedroomInfo = await renderInfo(page);
  expect(bedroomInfo.area).toBe("bedroom");
  expect(bedroomInfo.cachedAreaTextures.some((url) => url.includes("kitchen")))
    .toBe(false);
  expect(bedroomInfo.cachedAreaTextures.some((url) => url.includes("bedroom")))
    .toBe(true);
});

test("plaza screenshot and lamp arch depth", async ({ page }) => {
  await openHarness(page);
  await resetPaused(page, "plaza");
  // The south-east lamp arch is a prop (spec 6.2): it draws over Fae in her
  // column while her feet are north of its front edge there, under her after.
  const archOverFae = async (): Promise<boolean> => {
    const info = await renderInfo(page);
    const state = await page.evaluate(() => window.__cloverhollow?.getState());
    const x = state?.player.x ?? 0;
    const fae = info.drawOrder.find((item) => item.label === "fae");
    const strip = info.props.find((prop) => prop.id === "arch-se")?.strips
      .find((item) => item.left <= x && x < item.right);
    if (fae === undefined || strip === undefined) throw new Error("no fae or arch strip");
    return strip.zIndex > fae.zIndex;
  };
  await page.keyboard.down("ArrowDown");
  await step(page, 38);
  await page.keyboard.up("ArrowDown");
  await step(page, 60);
  expect(await archOverFae()).toBe(true);
  await page.keyboard.down("ArrowDown");
  await step(page, 10);
  await page.keyboard.up("ArrowDown");
  expect(await archOverFae()).toBe(false);
  await expect(page).toHaveScreenshot("plaza.png");
});

test("plaza props are solid where they meet the ground", async ({ page }) => {
  await openHarness(page);
  await resetPaused(page, "plaza");
  // West from the fountain spawn into the east bench: its footprint, not a box
  // round its whole picture, stops her at the bench's painted edge (spec 6.2).
  await page.keyboard.down("ArrowLeft");
  await step(page, 40);
  await page.keyboard.up("ArrowLeft");
  const state = await page.evaluate(() => window.__cloverhollow?.getState());
  expect(state?.player.x).toBeCloseTo(1159, 0);
  expect(state?.player.y).toBe(550);
});
