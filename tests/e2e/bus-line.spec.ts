import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { parseScript } from "../../src/content/script";
import {
  longFlowTimeout,
  openHarness,
  queueScript,
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

async function where(page: Page): Promise<{ x: number; y: number; area: string }> {
  const place = await page.evaluate(() => {
    const state = window.__cloverhollow?.getState();
    return state === undefined ? null : { ...state.player, area: state.area };
  });
  if (place === null) throw new Error("hook unavailable");
  return place;
}

async function walk(page: Page, axis: "x" | "y", target: number): Promise<void> {
  const start = await where(page);
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const before = await where(page);
    if (before.area !== start.area) return;
    const error = target - before[axis];
    if (Math.abs(error) <= 2) return;
    const key = axis === "x"
      ? (error > 0 ? "ArrowRight" : "ArrowLeft")
      : (error > 0 ? "ArrowDown" : "ArrowUp");
    await hold(page, key, Math.max(1, Math.min(60, Math.floor(Math.abs(error) / 4))));
    const after = await where(page);
    if (after.area === start.area && after[axis] === before[axis]) return;
  }
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

async function openChapterOne(page: Page): Promise<void> {
  const path = "tests/sim/scripts/new-game/chapter-one.json";
  const script = parseScript(JSON.parse(readFileSync(path, "utf8")), path);
  await queueScript(page, script);
  await step(page, script.reduce((total, segment) => total + segment.ticks, 0));
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
  await openChapterOne(page);
  expect((await readState(page)).area).toBe("park");

  // Leave the park by the same route used by the chapter-one bay replay.
  await walk(page, "y", 600);
  await walk(page, "x", 480);
  await walk(page, "y", 850);
  await walk(page, "x", 200);
  await walk(page, "y", 1000);
  await step(page, 40);
  expect((await readState(page)).area).toBe("plaza");

  // Come around the lower-right planter, then approach the stop from above.
  await walk(page, "x", 1250);
  await walk(page, "y", 850);
  await walk(page, "x", 850);
  await walk(page, "x", 800);
  await walk(page, "y", 980);
  await walk(page, "x", 878);
  await walk(page, "y", 985);
  await hold(page, "ArrowUp", 1);
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
