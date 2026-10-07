import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { parseScript } from "../../src/content/script";
import {
  longFlowTimeout,
  openHarness,
  queueScript,
  readState,
  renderInfo,
  resetPaused,
  step,
} from "./helpers";

test.describe.configure({ timeout: longFlowTimeout });
async function hold(page: Page, key: string, ticks: number): Promise<void> {
  await page.keyboard.down(key); await step(page, ticks); await page.keyboard.up(key);
}
async function press(page: Page): Promise<void> {
  await page.keyboard.press("z"); await step(page, 2);
}
async function talk(page: Page, choice = 0): Promise<void> {
  for (let count = 0; count < 120; count += 1) {
    const dialogue = (await readState(page)).dialogue;
    if (dialogue === null) return;
    if (dialogue.revealed < dialogue.text.length) { await press(page); continue; }
    if (dialogue.choices.length > 0) {
      for (let down = 0; down < choice; down += 1) {
        await page.keyboard.press("ArrowDown"); await step(page, 1);
      }
    }
    await press(page);
  }
  throw new Error("conversation did not close");
}
async function bayRun(page: Page): Promise<void> {
  const path = "tests/sim/scripts/bay/bay.json";
  const script = parseScript(JSON.parse(readFileSync(path, "utf8")), path);
  await queueScript(page, script);
  await step(page, script.reduce((total, segment) => total + segment.ticks, 0));
}
async function leaveBay(page: Page): Promise<void> {
  await hold(page, "ArrowLeft", 272); await hold(page, "ArrowUp", 41); await step(page, 36);
}
async function diagonal(page: Page, first: string, second: string, ticks: number): Promise<void> {
  await page.keyboard.down(first); await page.keyboard.down(second);
  await step(page, ticks); await page.keyboard.up(second); await page.keyboard.up(first);
}
async function walkFromRoadToStop(page: Page): Promise<void> {
  await hold(page, "ArrowUp", 1); await step(page, 1);
  await diagonal(page, "ArrowLeft", "ArrowUp", 25); await hold(page, "ArrowLeft", 50);
  await diagonal(page, "ArrowLeft", "ArrowUp", 35); await hold(page, "ArrowLeft", 135);
  await diagonal(page, "ArrowLeft", "ArrowDown", 25); await hold(page, "ArrowDown", 40);
  await diagonal(page, "ArrowRight", "ArrowDown", 55); await hold(page, "ArrowDown", 5);
  await diagonal(page, "ArrowRight", "ArrowDown", 25); await hold(page, "ArrowDown", 10);
  await diagonal(page, "ArrowRight", "ArrowDown", 10); await hold(page, "ArrowRight", 5);
  await diagonal(page, "ArrowRight", "ArrowDown", 10); await hold(page, "ArrowUp", 1);
}

test("the bus stop stays put while the bluebird is in chaos", async ({ page }) => {
  await openHarness(page); await resetPaused(page, "bay");
  await hold(page, "ArrowLeft", 40); await step(page, 40); await walkFromRoadToStop(page);
  expect((await readState(page)).critters.bluebird).toBe("chaos");
  await press(page);
  expect((await readState(page)).dialogue?.knot).toBe("bus_stop");
  await expect(page).toHaveScreenshot("bus-stop-plaza.png");
  await talk(page); expect((await readState(page)).area).toBe("plaza");
});

test("real keys ride to Pinecone Pass and back home", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await openHarness(page); await resetPaused(page, "bay"); await bayRun(page); await leaveBay(page);
  expect((await readState(page)).area).toBe("plaza");
  await walkFromRoadToStop(page); expect((await readState(page)).dialogue).toBeNull();
  await press(page); await talk(page, 0);
  await step(page, 40);
  expect((await readState(page)).area).toBe("pass");
  await expect(page).toHaveScreenshot("pass-arrival-1280.png");
  await page.setViewportSize({ width: 874, height: 402 });
  await expect(page).toHaveScreenshot("pass-arrival-874.png");
  await page.setViewportSize({ width: 1280, height: 720 });
  await hold(page, "ArrowLeft", 65); await hold(page, "ArrowUp", 131);
  await hold(page, "ArrowLeft", 16); await press(page); await talk(page);
  const lodgePath = [["ArrowRight", "", 35], ["ArrowRight", "ArrowDown", 5],
    ["ArrowRight", "", 45], ["ArrowRight", "ArrowUp", 5], ["ArrowRight", "", 5],
    ["ArrowRight", "ArrowDown", 10], ["ArrowRight", "", 35],
    ["ArrowRight", "ArrowDown", 10]] as const;
  for (const [first, second, ticks] of lodgePath) {
    if (second === "") await hold(page, first, ticks);
    else await diagonal(page, first, second, ticks);
  }
  await expect(page).toHaveScreenshot("pass-lodge-porch.png");
  await hold(page, "ArrowRight", 50); await hold(page, "ArrowDown", 60);
  await hold(page, "ArrowDown", 40); await hold(page, "ArrowLeft", 70);
  await press(page); await talk(page, 0); await step(page, 40);
  expect((await readState(page)).area).toBe("plaza");
});


test("Fae walks behind the snowman, and it's drawn over her", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await openHarness(page);
  await resetPaused(page, "pass");
  // From the bus stop (930, 1015): right past the stop's sign, up beside the
  // snowman, then right along its back (north of its base at y 660).
  await hold(page, "ArrowRight", 38);
  await hold(page, "ArrowUp", 94);
  await hold(page, "ArrowRight", 18);
  await step(page, 60);
  const state = await readState(page);
  expect(state.player.y).toBeLessThan(660);
  expect(Math.abs(state.player.x - 1152)).toBeLessThan(12);
  const order = (await renderInfo(page)).drawOrder;
  const z = (label: string): number => order.find((item) => item.label === label)?.zIndex ?? -1;
  expect(z("occluder:snowman"), "the snowman is drawn over Fae").toBeGreaterThan(z("fae"));
  await expect(page).toHaveScreenshot("pass-snowman-behind.png");
});
