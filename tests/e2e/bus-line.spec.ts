import { expect, test, type Page } from "@playwright/test";
import {
  longFlowTimeout,
  openHarness,
  playAfter,
  readState,
  resetPaused,
  step,
} from "./helpers";

test.describe.configure({ timeout: longFlowTimeout });

async function hold(page: Page, key: string, ticks: number): Promise<void> {
  await page.keyboard.down(key);
  await step(page, ticks);
  await page.keyboard.up(key);
}

async function press(page: Page, key = "z"): Promise<void> {
  await page.keyboard.press(key);
  await step(page, 2);
}

async function talk(page: Page, choice: number): Promise<string[]> {
  const lines: string[] = [];
  for (let count = 0; count < 120; count += 1) {
    const dialogue = (await readState(page)).dialogue;
    if (dialogue === null) return lines;
    if (dialogue.revealed < dialogue.text.length) {
      await press(page);
      continue;
    }
    if (lines.at(-1) !== dialogue.text) lines.push(dialogue.text);
    for (let down = 0; down < choice; down += 1) await press(page, "ArrowDown");
    await press(page);
  }
  throw new Error("conversation did not close");
}

async function openMap(page: Page): Promise<void> {
  await page.keyboard.press("j");
  await step(page, 2);
  await page.keyboard.press("ArrowRight");
  await step(page, 2);
}

test("the bus line carries Fae from Cloverhollow to the bay and home", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await openHarness(page);
  await resetPaused(page, "new-game");
  // Chapter one's run, then the recorded walk to the plaza's stop
  // (tools/sim/record-bus-line.ts: out of the park, the plaza's critters
  // calmed, up to the stop) played with real keys.
  await playAfter(page, "tests/sim/scripts/new-game/chapter-one.json",
    "tests/sim/scripts/new-game/bus-line.json");
  let state = await readState(page);
  expect(state.area).toBe("plaza");
  expect(Math.abs(state.player.x - 878)).toBeLessThan(8);
  expect(Math.abs(state.player.y - 985)).toBeLessThan(8);
  expect(state.facing).toBe("up");

  await press(page);
  state = await readState(page);
  expect(state.dialogue?.choices).toEqual(["Bubblegum Bay!", "Not yet."]);
  const lines = await talk(page, 0);
  expect(lines).toContain("To the beach!");
  await step(page, 40);
  state = await readState(page);
  expect(state.area).toBe("bay");
  expect(state.player).toEqual({ x: 355, y: 545 });
  await expect(page).toHaveScreenshot("bus-line-bay-arrival-1280.png");

  await openMap(page);
  await expect(page.locator(".journal-book")).toHaveAttribute("data-journal-page", "map");
  await expect(page.locator(".journal-map-star")).toHaveAttribute("data-land", "bay");
  await page.keyboard.press("x");
  await step(page, 2);

  await hold(page, "ArrowUp", 1);
  await press(page);
  state = await readState(page);
  expect(state.dialogue?.choices).toContain("Cloverhollow!");
  await talk(page, 0);
  await step(page, 40);
  state = await readState(page);
  expect(state.area).toBe("plaza");
  expect(Math.abs(state.player.x - 878)).toBeLessThan(8);
  expect(Math.abs(state.player.y - 985)).toBeLessThan(8);
});
