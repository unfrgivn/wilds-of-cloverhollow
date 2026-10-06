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
  expect(kitchen?.player).toEqual({ x: 500, y: 650 });
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
  await step(page, 21);
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

test("plaza screenshot and lamppost depth", async ({ page }) => {
  await openHarness(page);
  await resetPaused(page, "plaza");
  await page.keyboard.down("ArrowDown");
  await step(page, 38);
  await page.keyboard.up("ArrowDown");
  await step(page, 60);
  const north = await renderInfo(page);
  const faeNorth = north.drawOrder.findIndex((item) => item.label === "fae");
  const lamp = north.drawOrder.findIndex((item) =>
    item.label === "occluder:lamp-lower-right");
  expect(lamp).toBeGreaterThan(faeNorth);
  await page.keyboard.down("ArrowDown");
  await step(page, 10);
  await page.keyboard.up("ArrowDown");
  const south = await renderInfo(page);
  const southFae = south.drawOrder.findIndex((item) => item.label === "fae");
  const southLamp = south.drawOrder.findIndex((item) =>
    item.label === "occluder:lamp-lower-right");
  expect(southFae).toBeGreaterThan(southLamp);
  await expect(page).toHaveScreenshot("plaza.png");
});
