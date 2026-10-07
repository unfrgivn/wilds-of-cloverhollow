import { expect, test } from "@playwright/test";
import {
  longFlowTimeout,
  openHarness,
  resetPaused,
  step,
} from "./helpers";

test.describe.configure({ timeout: longFlowTimeout });

async function openMap(page: Parameters<typeof openHarness>[0]): Promise<void> {
  await page.keyboard.press("j");
  await step(page, 2);
  await page.keyboard.press("ArrowRight");
  await step(page, 2);
}

test("the journal map names every land and marks Cloverhollow", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await openHarness(page);
  await resetPaused(page, "plaza");
  await openMap(page);

  const journal = page.locator(".journal-book");
  await expect(journal).toHaveAttribute("data-journal-page", "map");
  await expect(page.locator(".journal-map-land")).toHaveText([
    "Cloverhollow",
    "Bubblegum Bay",
    "Pinecone Pass",
    "Cliffside Trail",
    "The Forest",
    "???",
  ]);
  await expect(page.locator(".journal-map-star"))
    .toHaveAttribute("data-land", "cloverhollow");
  await expect(page.locator(".journal-map-star")).toBeVisible();
  const stops = page.locator(".journal-map-stop");
  await expect(stops).toHaveCount(3);
  expect(await stops.evaluateAll((items) => items.map((item) => item.getAttribute("data-land"))))
    .toEqual(["cloverhollow", "bay", "pass"]);
  await expect(page).toHaveScreenshot("journal-map-1280.png");

  await page.keyboard.press("ArrowLeft");
  await step(page, 2);
  await expect(journal).toHaveAttribute("data-journal-page", "notes");
});

test(
  "the map fits the short touch layout and its notes bookmark flips back",
  async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 874, height: 402 },
      hasTouch: true,
    });
    const page = await context.newPage();
    await page.goto("./?touch=1");
    await page.waitForFunction(() => Boolean(window.__cloverhollow));
    await resetPaused(page, "plaza");
    await openMap(page);
    await expect(page.locator(".journal-book")).toHaveAttribute("data-journal-page", "map");
    await expect(page).toHaveScreenshot("journal-map-874.png");

    const notes = page.locator(".journal-notes-tab");
    const bounds = await notes.boundingBox();
    if (bounds === null) throw new Error("notes bookmark has no bounds");
    await page.touchscreen.tap(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    await expect(page.locator(".journal-book")).toHaveAttribute("data-journal-page", "notes");
    await context.close();
  },
);
