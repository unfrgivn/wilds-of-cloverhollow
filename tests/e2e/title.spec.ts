import { expect, test, type Page } from "@playwright/test";
import { readState, resetPaused, step } from "./helpers";

// Milestone 11 contract: a real boot (not a harness fixture) shows the title
// screen. With no save it offers New game; with a save, Continue resumes it
// exactly, and New game asks before replacing it. Keys and taps both work.
// The hook's boot group: `__cloverhollow.boot.{ title(): "fresh" | "continue"
// | "confirm" | null }` (null once the game has started).

type TitleMode = "fresh" | "continue" | "confirm" | null;

async function bootGame(page: Page, query = ""): Promise<void> {
  await page.goto(`./${query}`);
  await page.waitForFunction(() => Boolean(window.__cloverhollow));
}

async function titleMode(page: Page): Promise<TitleMode> {
  return page.evaluate(() => window.__cloverhollow?.boot.title() ?? null);
}

async function press(page: Page, key: string): Promise<void> {
  await page.keyboard.press(key);
  await step(page, 2);
}

// Start a new game from a clean slate and walk downstairs, so the game
// autosaves on arrival in the kitchen.
async function playDownstairs(page: Page): Promise<string> {
  await page.evaluate(() => window.__cloverhollow?.save.clear());
  await resetPaused(page, "new-game");
  await page.keyboard.down("ArrowUp");
  await step(page, 30);
  await page.keyboard.up("ArrowUp");
  await step(page, 60);
  expect((await readState(page)).area).toBe("kitchen");
  await page.waitForFunction(() => window.__cloverhollow?.save.last() !== null);
  const saved = await page.evaluate(() => window.__cloverhollow?.save.last() ?? null);
  if (saved === null) throw new Error("no save");
  return saved.hash;
}

test("with no save, the title offers New game, and Z starts it", async ({ page }) => {
  await bootGame(page);
  await page.evaluate(() => window.__cloverhollow?.save.clear());
  await bootGame(page);
  expect(await titleMode(page)).toBe("fresh");
  await expect(page.locator(".title-screen")).toBeVisible();
  await expect(page.locator(".title-option-label")).toHaveText(["New game"]);
  const before = await readState(page);
  await step(page, 30);
  expect((await readState(page)).tick, "the world waits behind the title").toBe(before.tick);
  await press(page, "z");
  expect(await titleMode(page)).toBeNull();
  await expect(page.locator(".title-screen")).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.dataset.title)).toBeUndefined();
  const started = await readState(page);
  expect(started.area).toBe("bedroom");
  await page.keyboard.down("ArrowRight");
  await step(page, 10);
  await page.keyboard.up("ArrowRight");
  expect((await readState(page)).player.x).toBeGreaterThan(started.player.x);
});

test("with a save, Continue resumes it exactly", async ({ page }) => {
  await bootGame(page);
  const hash = await playDownstairs(page);
  await bootGame(page);
  // Pause the real-time loop first (a step on the title runs no game tick);
  // otherwise the game would run on its own between Continue and the check.
  await step(page, 1);
  expect(await titleMode(page)).toBe("continue");
  await expect(page.locator(".title-option-label")).toHaveText(["Continue", "New game"]);
  await expect(page.locator(".title-option-detail")).toHaveText("Kitchen · 0 stickers");
  await expect(page.locator(".title-option").first()).toHaveAttribute("aria-selected", "true");
  // One tick: the title takes the press and the game is exactly the save.
  await page.keyboard.press("Enter");
  await step(page, 1);
  expect(await titleMode(page)).toBeNull();
  expect(await page.evaluate(() => window.__cloverhollow?.hash())).toBe(hash);
  const resumed = await readState(page);
  expect(resumed.area).toBe("kitchen");
  // The next tick is an ordinary game tick.
  await step(page, 1);
  expect((await readState(page)).tick).toBe(resumed.tick + 1);
});

test("New game over a save asks first; No keeps the save, Yes replaces it", async ({ page }) => {
  await bootGame(page);
  const hash = await playDownstairs(page);
  await bootGame(page);
  await press(page, "ArrowDown");
  await expect(page.locator(".title-option").nth(1)).toHaveAttribute("aria-selected", "true");
  await press(page, "z");
  expect(await titleMode(page)).toBe("confirm");
  await expect(page.locator(".title-confirm-button").nth(1))
    .toHaveAttribute("aria-selected", "true");
  await press(page, "z");
  expect(await titleMode(page), "No, go back returns to the title").toBe("continue");
  expect(await page.evaluate(() => window.__cloverhollow?.save.last()?.hash ?? null))
    .toBe(hash);

  await press(page, "ArrowDown");
  await press(page, "z");
  expect(await titleMode(page)).toBe("confirm");
  await press(page, "x");
  expect(await titleMode(page), "X backs out of the question").toBe("continue");

  await press(page, "ArrowDown");
  await press(page, "z");
  await press(page, "ArrowLeft");
  await expect(page.locator(".title-confirm-button").nth(0))
    .toHaveAttribute("aria-selected", "true");
  await press(page, "z");
  expect(await titleMode(page)).toBeNull();
  expect((await readState(page)).area).toBe("bedroom");
  await bootGame(page);
  expect(await titleMode(page), "the old save is gone").toBe("fresh");
});

test("touch: tap Continue to resume", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 874, height: 402 },
    hasTouch: true });
  const page = await context.newPage();
  await bootGame(page, "?touch=1");
  await playDownstairs(page);
  await bootGame(page, "?touch=1");
  expect(await titleMode(page)).toBe("continue");
  await expect(page.locator(".touch-controls")).toBeHidden();
  const bounds = await page.locator(".title-option").first().boundingBox();
  if (bounds === null) throw new Error("Continue is not visible");
  await page.touchscreen.tap(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await step(page, 2);
  expect(await titleMode(page)).toBeNull();
  await expect(page.locator(".touch-confirm")).toBeVisible();
  expect((await readState(page)).area).toBe("kitchen");
  await context.close();
});

test("harness fixture resets skip the title", async ({ page }) => {
  await bootGame(page);
  await resetPaused(page, "new-game");
  expect(await titleMode(page)).toBeNull();
  await expect(page.locator(".title-screen")).toBeHidden();
});
