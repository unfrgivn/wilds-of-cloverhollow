import { expect, test, type Page } from "@playwright/test";
import { openHarness, readState, renderInfo, resetPaused, step } from "./helpers";

// Canopies (spec 6): walking under a palm's crown in Bubblegum Bay, Fae is
// drawn behind it and the crown fades so she can still be seen; stepping out,
// it eases back.

async function hold(page: Page, key: string, ticks: number): Promise<void> {
  await page.keyboard.down(key);
  await step(page, ticks);
  await page.keyboard.up(key);
}

async function canopy(page: Page, id: string): Promise<number> {
  const found = (await renderInfo(page)).canopies.find((item) => item.id === id);
  if (found === undefined) throw new Error(`no canopy ${id}`);
  return found.alpha;
}

test("a palm's crown fades while Fae walks under it", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await openHarness(page);
  await resetPaused(page, "bay");
  await step(page, 20);
  expect(await canopy(page, "palm-top-left")).toBe(1);
  // From the plaza road (180, 545): right past the sign, up the beach behind
  // it, and left under the top-left palm's crown.
  await hold(page, "ArrowRight", 30);
  await hold(page, "ArrowUp", 74);
  await hold(page, "ArrowLeft", 25);
  await step(page, 20);
  const feet = (await readState(page)).player;
  expect(Math.abs(feet.x - 200)).toBeLessThan(12);
  expect(Math.abs(feet.y - 250)).toBeLessThan(12);
  expect(await canopy(page, "palm-top-left")).toBeLessThanOrEqual(0.45);
  const order = (await renderInfo(page)).drawOrder;
  const z = (label: string): number => order.find((item) => item.label === label)?.zIndex ?? -1;
  expect(z("occluder:palm-top-left"), "the palm is drawn over Fae").toBeGreaterThan(z("fae"));
  await expect(page).toHaveScreenshot("bay-under-palm.png");
  await hold(page, "ArrowRight", 25);
  await hold(page, "ArrowDown", 74);
  await step(page, 20);
  expect(await canopy(page, "palm-top-left")).toBe(1);
});
