import { expect, test } from "@playwright/test";
import { openHarness, renderInfo, resetPaused, step } from "./helpers";

test("real keys cross bedroom and plaza doors in both directions", async ({ page }) => {
  await openHarness(page);
  await resetPaused(page, "new-game");
  await page.keyboard.down("ArrowUp");
  await step(page, 20);
  await page.keyboard.up("ArrowUp");
  await step(page, 36);
  const plaza = await page.evaluate(() => window.__cloverhollow?.getState());
  expect(plaza?.area).toBe("plaza");
  expect(plaza?.player).toEqual({ x: 450, y: 500 });
  expect(plaza?.maddie).toBeDefined();
  const plazaInfo = await renderInfo(page);
  expect(plazaInfo.area).toBe("plaza");
  expect(plazaInfo.drawOrder.some((item) => item.label === "maddie")).toBe(true);
  expect(plazaInfo.cachedAreaTextures.some((url) => url.includes("bedroom")))
    .toBe(false);
  expect(plazaInfo.cachedAreaTextures.some((url) => url.includes("plaza")))
    .toBe(true);

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
  expect(bedroomInfo.cachedAreaTextures.some((url) => url.includes("plaza")))
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
