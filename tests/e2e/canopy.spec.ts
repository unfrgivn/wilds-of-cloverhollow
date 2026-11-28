import { expect, test, type Page } from "@playwright/test";
import {
  openHarness, playBattleCheck, readBattle, readState, renderInfo, resetPaused, step,
} from "./helpers";

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
  // From the plaza road (180, 545): right past the bus stop, up between it
  // and the umbrella, left behind it, up the beach behind the sign, and left
  // under the top-left palm's crown.
  await hold(page, "ArrowRight", 63);
  await hold(page, "ArrowUp", 29);
  await hold(page, "ArrowLeft", 23);
  await hold(page, "ArrowUp", 45);
  await hold(page, "ArrowLeft", 35);
  await step(page, 20);
  const feet = (await readState(page)).player;
  expect(Math.abs(feet.x - 200)).toBeLessThan(12);
  expect(Math.abs(feet.y - 250)).toBeLessThan(12);
  expect(await canopy(page, "palm-top-left")).toBeLessThanOrEqual(0.45);
  const info = await renderInfo(page);
  const fae = info.drawOrder.find((item) => item.label === "fae")?.zIndex ?? Infinity;
  const palm = info.props.find((prop) => prop.id === "palm-top-left")?.strips
    .filter((strip) => strip.left < feet.x + 25 && strip.right > feet.x - 25) ?? [];
  expect(palm.some((strip) => strip.zIndex > fae), "the palm is drawn over Fae").toBe(true);
  await expect(page).toHaveScreenshot("bay-under-palm.png");
  // Back out the way she came, escaping any roaming bay critter that chased her in.
  const holdSafe = async (key: string, ticks: number): Promise<void> => {
    let remaining = ticks;
    while (remaining > 0) {
      const chunk = Math.min(remaining, 10);
      await hold(page, key, chunk);
      remaining -= chunk;
      if ((await readBattle(page)) !== null) {
        for (let stepIdx = 0; stepIdx < 40; stepIdx += 1) {
          const battle = await readBattle(page);
          if (battle === null) break;
          if (battle.phase === "check" && battle.check !== null) await playBattleCheck(page);
          else if (battle.phase === "command" && battle.revealed >= battle.message.length) {
            await hold(page, "ArrowUp", 1);
            await step(page, 1);
            await page.keyboard.press("z");
            await step(page, 2);
          } else {
            await page.keyboard.press("z");
            await step(page, 2);
          }
        }
      }
    }
  };
  await holdSafe("ArrowRight", 35);
  await holdSafe("ArrowDown", 45);
  await holdSafe("ArrowRight", 23);
  await step(page, 20);
  expect(await canopy(page, "palm-top-left")).toBe(1);
});
