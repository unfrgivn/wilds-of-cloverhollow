import { expect, test, type Page } from "@playwright/test";
import { openHarness, readState, resetPaused, step } from "./helpers";

const walkPerTick = 4;
const underWindow = { x: 612, y: 338 };

async function hold(page: Page, key: string, ticks: number): Promise<void> {
  await page.keyboard.down(key);
  await step(page, ticks);
  await page.keyboard.up(key);
}

async function press(page: Page, key = "z"): Promise<void> {
  await page.keyboard.press(key);
  await step(page, 2);
}

test("runtime story asset fetch drives modular Ink dialogue and journal with real keys", {
  tag: "@smoke",
}, async ({ page }) => {
  const storyResponses: { url: string; status: number }[] = [];
  const bundledStoryChunks: string[] = [];

  page.on("response", (response) => {
    const url = response.url();
    if (url.includes("assets/story/main.ink.json")) {
      storyResponses.push({ url, status: response.status() });
    }
    if (/story-content[^/]*\.js/.test(url)) {
      bundledStoryChunks.push(url);
    }
  });

  await openHarness(page);
  expect(storyResponses.length).toBeGreaterThanOrEqual(1);
  expect(storyResponses.every((item) => item.status === 200)).toBe(true);
  expect(bundledStoryChunks).toEqual([]);

  await resetPaused(page, "new-game");
  const start = await readState(page);
  await hold(page, "ArrowRight", Math.round((underWindow.x - start.player.x) / walkPerTick));
  const below = await readState(page);
  await hold(page, "ArrowUp", Math.round((below.player.y - underWindow.y) / walkPerTick));

  const prompt = page.locator(".sticker-prompt");
  await expect(prompt).toBeVisible();
  await expect(prompt.locator("span")).toHaveText("LOOK");

  // Open `window` knot (content/story/chapters/act1_morning.ink) via real Z key.
  await press(page);
  const box = page.locator(".sticker-dialogue");
  const speaker = page.locator(".sticker-speaker");
  const text = page.locator(".sticker-text-revealed");
  const choices = page.locator(".sticker-choice");
  await expect(box).toBeVisible();
  await expect(speaker).toHaveText("FAE", { useInnerText: true });
  await step(page, 100);
  await expect(text).toHaveText("Morning sun... and something sparkly over the plaza.");

  await press(page);
  await step(page, 100);
  await expect(choices).toHaveText(["Go see right now!", "School first, then investigate."]);
  await hold(page, "ArrowDown", 1);
  await expect(choices.nth(1)).toHaveAttribute("aria-selected", "true");
  await press(page);
  await step(page, 100);
  await expect(text).toHaveText("Backpack, socks, teeth. Then I'll investigate.");
  await press(page);
  await expect(box).toBeHidden();

  // Open Journal via real J key (`journal` knot in content/story/systems/journal.ink).
  await press(page, "j");
  await expect(page.locator(".journal-book")).toBeVisible();
  await expect(page.locator(".journal-notes")).toContainText(
    "Check the fizzing fountain after school.",
  );
  await press(page, "j");
  await expect(page.locator(".journal-book")).toBeHidden();
});

test("ui-gallery fetches runtime story asset without bundled story JS chunks", async ({
  page,
}) => {
  const storyResponses: number[] = [];
  const bundledStoryChunks: string[] = [];

  page.on("response", (response) => {
    const url = response.url();
    if (url.includes("assets/story/main.ink.json")) storyResponses.push(response.status());
    if (/story-content[^/]*\.js/.test(url)) bundledStoryChunks.push(url);
  });

  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/cloverhollow/ui-gallery.html?state=three-choices");
  await page.waitForFunction(
    () => document.querySelector("#gallery[data-ready='true']") !== null,
  );
  expect(storyResponses.length).toBeGreaterThanOrEqual(1);
  expect(storyResponses.every((status) => status === 200)).toBe(true);
  expect(bundledStoryChunks).toEqual([]);
  await expect(page.locator(".sticker-dialogue")).toBeVisible();
  await expect(page.locator(".sticker-choice")).toHaveCount(3);
});
