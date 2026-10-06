import { expect, test, type Locator, type Page } from "@playwright/test";
import { openHarness, readState, resetPaused, step } from "./helpers";

const firstLine = "Morning sun... and something sparkly over the plaza.";
const secondLine = "The fountain is fizzing pink bubbles. That's not normal.";
const laterLine = "Backpack, socks, teeth. Then I'll investigate.";
const walkPerTick = 4;
// From the bed spawn (500, 410), this lands at (612, 338): under the window.
const underWindow = { x: 612, y: 338 };

async function hold(page: Page, key: string, ticks: number): Promise<void> {
  await page.keyboard.down(key);
  await step(page, ticks);
  await page.keyboard.up(key);
}

// One press, then one released tick, so the next press is a new edge.
async function press(page: Page): Promise<void> {
  await page.keyboard.press("z");
  await step(page, 2);
}

async function walkToWindow(page: Page): Promise<void> {
  const start = await readState(page);
  await hold(page, "ArrowRight", Math.round((underWindow.x - start.player.x) / walkPerTick));
  const below = await readState(page);
  await hold(page, "ArrowUp", Math.round((below.player.y - underWindow.y) / walkPerTick));
}

function parts(page: Page): {
  box: Locator;
  speaker: Locator;
  text: Locator;
  choices: Locator;
  prompt: Locator;
} {
  return {
    box: page.locator(".sticker-dialogue"),
    speaker: page.locator(".sticker-speaker"),
    text: page.locator(".sticker-text-revealed"),
    choices: page.locator(".sticker-choice"),
    prompt: page.locator(".sticker-prompt"),
  };
}

async function dialogueAttribute(page: Page): Promise<string | undefined> {
  return page.evaluate(() => document.documentElement.dataset.dialogue);
}

test("real keys: the window, a choice, the journal, and the window again", async ({ page }) => {
  const { box, speaker, text, choices, prompt } = parts(page);
  await openHarness(page);
  await resetPaused(page, "new-game");
  await walkToWindow(page);
  await expect(prompt).toBeVisible();
  await expect(prompt.locator("span")).toHaveText("LOOK");

  await press(page);
  await expect(box).toBeVisible();
  expect(await dialogueAttribute(page)).toBe("open");
  await expect(speaker).toHaveText("FAE", { useInnerText: true });
  await step(page, 10);
  await expect(text).not.toHaveText(firstLine);
  await press(page);
  await expect(text, "one press shows the whole line").toHaveText(firstLine);

  await press(page);
  await step(page, 10);
  await expect(choices, "no choices while the line types").toHaveCount(0);
  await step(page, 100);
  await expect(text).toHaveText(secondLine);
  await expect(choices).toHaveText(["Go see right now!", "School first, then investigate."]);
  await expect(choices.nth(0)).toHaveAttribute("aria-selected", "true");
  await expect(page).toHaveScreenshot("dialogue-choices.png");
  await hold(page, "ArrowDown", 1);
  await expect(choices.nth(1)).toHaveAttribute("aria-selected", "true");
  await press(page);
  await step(page, 100);
  await expect(text).toHaveText(laterLine);
  await expect(choices).toHaveCount(0);
  await press(page);
  await expect(box).toBeHidden();
  expect(await dialogueAttribute(page)).toBeUndefined();

  const before = await readState(page);
  await hold(page, "ArrowDown", 12);
  await hold(page, "ArrowLeft", 48);
  const after = await readState(page);
  expect(after.player.x, "Fae walks again after the dialogue").toBeLessThan(before.player.x);
  await expect(prompt).toBeVisible();
  await press(page);
  await step(page, 100);
  await expect(text).toHaveText("My journal, right under my pillow where it belongs.");
  await press(page);
  await step(page, 100);
  await expect(box).toBeVisible();
  await expect(text).toHaveText("Note to self: fizzing fountain. Check after school.");
  await press(page);
  await expect(box).toBeHidden();

  await walkToWindow(page);
  await press(page);
  await step(page, 100);
  await expect(text).toHaveText("The fountain is still fizzing. I'll check it after school.");
  await expect(choices).toHaveCount(0);
  await press(page);
  await expect(box).toBeHidden();
});

test("touch: confirm taps open the window and a choice sticker picks its branch", async ({
  browser,
}) => {
  const context = await browser.newContext({ viewport: { width: 874, height: 402 },
    hasTouch: true });
  const page = await context.newPage();
  const { box, text, choices } = parts(page);
  await page.goto("./?touch=1");
  await page.waitForFunction(() => Boolean(window.__cloverhollow));
  await resetPaused(page, "new-game");
  await walkToWindow(page);
  const tap = async (target: Locator): Promise<void> => {
    const bounds = await target.boundingBox();
    if (bounds === null) throw new Error("tap target is not visible");
    await page.touchscreen.tap(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    await step(page, 2);
  };
  const confirm = page.locator(".touch-confirm");
  await tap(confirm);
  await expect(box).toBeVisible();
  await tap(confirm);
  await expect(text).toHaveText(firstLine);
  await tap(confirm);
  await step(page, 10);
  await expect(choices, "no choice stickers to tap while the line types").toHaveCount(0);
  await step(page, 100);
  await expect(choices).toHaveCount(2);
  await tap(choices.nth(1));
  await step(page, 100);
  await expect(text).toHaveText(laterLine);
  await context.close();
});
