import { expect, test, type Page } from "@playwright/test";
import {
  bunHash,
  longFlowTimeout,
  openHarness,
  playAfter,
  readHash,
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
// From the east road's spawn (1550, 550) to the bus stop, facing it: a route
// the core found (tools/sim/recorder.ts `approach`, round the plaza's props and
// the frog's reach).
const roadToStop: [string[], number][] = [
  [["ArrowLeft", "ArrowUp"], 5], [["ArrowLeft"], 25], [["ArrowLeft", "ArrowDown"], 125],
  [["ArrowLeft"], 5], [["ArrowLeft", "ArrowDown"], 10], [["ArrowLeft"], 10],
  [["ArrowLeft", "ArrowDown"], 15], [["ArrowLeft"], 5], [["ArrowLeft", "ArrowDown"], 10],
  [["ArrowLeft"], 5], [["ArrowUp"], 1], [[], 1],
];
async function walkFromRoadToStop(page: Page): Promise<void> {
  for (const [keys, ticks] of roadToStop) {
    for (const key of keys) await page.keyboard.down(key);
    await step(page, ticks);
    for (const key of keys) await page.keyboard.up(key);
  }
}

test("the bus stop stays put while the bluebird is in chaos", async ({ page }) => {
  await openHarness(page); await resetPaused(page, "bay");
  await hold(page, "ArrowLeft", 40); await step(page, 40); await walkFromRoadToStop(page);
  expect((await readState(page)).stickers).not.toContain("bay-bluebird");
  await press(page);
  expect((await readState(page)).dialogue?.knot).toBe("bus_stop");
  await expect(page).toHaveScreenshot("bus-stop-plaza.png");
  await talk(page); expect((await readState(page)).area).toBe("plaza");
});

test("real keys ride to Pinecone Pass and back home", async ({ page }) => {
  // The bay run (Sue joins, a bluebird calmed), then the recorded ride
  // (tools/sim/record-bus.ts: into town, the plaza's stop to the pass, its
  // sign, the lodge's porch, and the bus home) played with real keys.
  const path = "tests/sim/scripts/bay/bus.json";
  await page.setViewportSize({ width: 1280, height: 720 });
  await openHarness(page); await resetPaused(page, "bay");
  let arrived = false;
  let porch = false;
  await playAfter(page, "tests/sim/scripts/bay/bay.json", path, async () => {
    const state = await readState(page);
    if (state.area !== "pass" || state.transition !== null) return;
    if (!arrived) {
      arrived = true;
      await expect(page).toHaveScreenshot("pass-arrival-1280.png");
      await page.setViewportSize({ width: 874, height: 402 });
      await expect(page).toHaveScreenshot("pass-arrival-874.png");
      await page.setViewportSize({ width: 1280, height: 720 });
    }
    if (!porch && Math.hypot(state.player.x - 1180, state.player.y - 556) < 10) {
      porch = true;
      await expect(page).toHaveScreenshot("pass-lodge-porch.png");
    }
  });
  expect({ arrived, porch }).toEqual({ arrived: true, porch: true });
  const end = await readState(page);
  expect({ area: end.area, player: end.player }).toEqual({ area: "plaza",
    player: { x: 878, y: 985 } });
  expect(await readHash(page)).toBe(bunHash(path, "bay"));
});


test("Fae walks behind the snowman, and it's drawn over her", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await openHarness(page);
  await resetPaused(page, "pass");
  // From the bus stop (930, 1015): right past the stop's sign, up, a step
  // left round Jordan (he stands beside the snowman, watching the hamster), up
  // past him, then right along the snowman's back (north of its base at 660).
  await hold(page, "ArrowRight", 34);
  await hold(page, "ArrowUp", 54);
  await hold(page, "ArrowLeft", 3);
  await hold(page, "ArrowUp", 41);
  await hold(page, "ArrowRight", 24);
  await step(page, 60);
  const state = await readState(page);
  expect(state.player.y).toBeLessThan(660);
  expect(Math.abs(state.player.x - 1152)).toBeLessThan(12);
  const order = (await renderInfo(page)).drawOrder;
  const z = (label: string): number => order.find((item) => item.label === label)?.zIndex ?? -1;
  expect(z("occluder:snowman"), "the snowman is drawn over Fae").toBeGreaterThan(z("fae"));
  await expect(page).toHaveScreenshot("pass-snowman-behind.png");
});
