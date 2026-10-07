import { expect, test, type Page } from "@playwright/test";
import { longFlowTimeout, openHarness, readBattle, readState, resetPaused, step } from "./helpers";

// Milestone 10 contract: the journal is the pause menu (J or the journal
// button; X, J, or its close button shut it), its notes come from Ink and its
// album from the stickers Fae owns, and the game saves when Fae arrives
// somewhere and resumes there after a reload.

async function hold(page: Page, key: string, ticks: number): Promise<void> {
  await page.keyboard.down(key);
  await step(page, ticks);
  await page.keyboard.up(key);
}

// One press, then one released tick, so the next press is a new edge.
async function press(page: Page, key = "z"): Promise<void> {
  await page.keyboard.press(key);
  await step(page, 2);
}

async function journalAttribute(page: Page): Promise<string | undefined> {
  return page.evaluate(() => document.documentElement.dataset.journal);
}

test("J opens the journal over a frozen world, and X or J closes it", async ({ page }) => {
  await openHarness(page);
  await resetPaused(page, "new-game");
  // At the window, choose "School first" so the journal has a note.
  await hold(page, "ArrowRight", 28);
  await hold(page, "ArrowUp", 18);
  await press(page);
  await press(page);
  await press(page);
  await press(page);
  await hold(page, "ArrowDown", 1);
  await press(page);
  await press(page);
  await press(page);
  expect((await readState(page)).dialogue).toBeNull();

  const before = (await readState(page)).player;
  await press(page, "j");
  await expect(page.locator(".journal-book")).toBeVisible();
  expect(await journalAttribute(page)).toBe("open");
  await expect(page.locator(".journal-note")).toHaveText([
    "Check the fizzing fountain after school.",
  ]);
  await expect(page.locator('.journal-slot[data-owned="false"]')).toHaveCount(10);
  await hold(page, "ArrowRight", 12);
  expect((await readState(page)).player, "the world is frozen while the journal is open")
    .toEqual(before);
  await press(page, "x");
  await expect(page.locator(".journal-book")).toBeHidden();
  expect(await journalAttribute(page)).toBeUndefined();

  await press(page, "j");
  await expect(page.locator(".journal-book")).toBeVisible();
  await press(page, "j");
  await expect(page.locator(".journal-book")).toBeHidden();
  await hold(page, "ArrowRight", 12);
  expect((await readState(page)).player.x).toBeGreaterThan(before.x);
});

test("touch: the journal button opens the book and its close button shuts it", async ({
  browser,
}) => {
  const context = await browser.newContext({ viewport: { width: 874, height: 402 },
    hasTouch: true });
  const page = await context.newPage();
  await page.goto("./?touch=1");
  await page.waitForFunction(() => Boolean(window.__cloverhollow));
  await resetPaused(page, "new-game");
  const tap = async (selector: string): Promise<void> => {
    const bounds = await page.locator(selector).boundingBox();
    if (bounds === null) throw new Error(`${selector} is not visible`);
    await page.touchscreen.tap(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    await step(page, 2);
  };
  await tap(".touch-menu");
  await expect(page.locator(".journal-book")).toBeVisible();
  await expect(page.locator(".journal-empty")).toHaveText("Nothing yet. Look around!");
  await expect(page.locator(".touch-controls")).toBeHidden();
  await tap(".journal-close");
  await expect(page.locator(".journal-book")).toBeHidden();
  await expect(page.locator(".touch-confirm")).toBeVisible();
  await context.close();
});

test("after calming the frog, the journal shows his sticker and his note", async ({ page }) => {
  test.setTimeout(longFlowTimeout);
  await openHarness(page);
  await resetPaused(page, "plaza");
  for (const [key, ticks] of [["ArrowDown", 25], ["ArrowLeft", 15], ["ArrowDown", 50],
    ["ArrowLeft", 35]] as const) await hold(page, key, ticks);
  expect((await readBattle(page))).not.toBeNull();
  for (let action = 0; action < 150; action += 1) {
    const battle = (await readBattle(page));
    if (battle === null) break;
    // Press on every aim's target tick.
    if (battle.phase === "aim" && battle.aim !== null)
      await step(page, battle.aim.targetTick - battle.aimTick - 1);
    await page.keyboard.down("Enter");
    await step(page, 1);
    await page.keyboard.up("Enter");
    await step(page, 1);
  }
  expect((await readState(page)).critters["fountain-frog"]).toBe("calm");
  await press(page, "j");
  await expect(page.locator('.journal-slot[data-owned="true"] .journal-name'))
    .toHaveText("Fountain Frog");
  await expect(page.locator('.journal-slot[data-owned="false"]')).toHaveCount(9);
  await expect(page.locator(".journal-note")).toHaveText([
    "Purple fizz drips lead out of the plaza to Meadow Park.",
    "I have coins! The bakery in the plaza sells snacks for 5 coins.",
    "The Fountain Frog is calm. Something purple fizzed into his fountain.",
  ]);
  await expect(page.locator(".journal-supply")).toHaveText(["Coins 8", "Snacks 2"]);
});

test("the game saves when Fae arrives somewhere and resumes there after a reload", async ({
  page,
}) => {
  await openHarness(page);
  await page.evaluate(() => window.__cloverhollow?.save.clear());
  await resetPaused(page, "new-game");
  await hold(page, "ArrowUp", 30);
  await step(page, 60);
  expect((await readState(page)).area, "the bedroom door leads downstairs").toBe("kitchen");
  await page.waitForFunction(() => window.__cloverhollow?.save.last() !== null);
  const saved = await page.evaluate(() => window.__cloverhollow?.save.last() ?? null);
  expect(saved?.hash).toMatch(/^[0-9a-f]{8}$/);

  await page.reload();
  await page.waitForFunction(() => Boolean(window.__cloverhollow));
  const loaded = await page.evaluate(() => window.__cloverhollow?.save.loaded() ?? null);
  expect(loaded, "the reload resumes from the save, with an identical hash").toEqual(saved);
  expect((await readState(page)).area).toBe("kitchen");

  await page.evaluate(() => window.__cloverhollow?.save.clear());
  await page.reload();
  await page.waitForFunction(() => Boolean(window.__cloverhollow));
  expect(await page.evaluate(() => window.__cloverhollow?.save.loaded() ?? null)).toBeNull();
  expect((await readState(page)).area).toBe("bedroom");
});
