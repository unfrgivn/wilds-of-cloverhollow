import { expect, test, type Page } from "@playwright/test";
import { openHarness, readState, resetPaused, step } from "./helpers";

async function crossDoor(page: Page): Promise<void> {
  for (let count = 0; count < 60; count += 1) {
    const state = await readState(page);
    if (state.transition === null) return;
    await step(page, 2);
  }
}

async function dismissBattleIfAny(page: Page): Promise<void> {
  for (let i = 0; i < 60; i += 1) {
    const cur = await readState(page);
    if (cur.battle === null) return;
    if (cur.battle.phase === "command") {
      // Battle commands are a 1D list; ArrowUp from index 0 wraps to Run.
      await page.keyboard.press("ArrowUp");
      await step(page, 2);
      await page.keyboard.press("z");
      await step(page, 8);
    } else {
      await page.keyboard.press("z");
      await step(page, 10);
    }
  }
}

async function walkTo(page: Page, tx: number, ty: number): Promise<void> {
  for (let iter = 0; iter < 120; iter += 1) {
    const state = await readState(page);
    if (state.transition !== null) {
      await crossDoor(page);
      return;
    }
    if (state.battle !== null) {
      await dismissBattleIfAny(page);
      continue;
    }
    const dx = tx - state.player.x;
    const dy = ty - state.player.y;
    if (Math.abs(dx) <= 10 && Math.abs(dy) <= 10) return;

    const keys: string[] = [];
    if (Math.abs(dx) > 8) keys.push(dx > 0 ? "ArrowRight" : "ArrowLeft");
    if (Math.abs(dy) > 8) keys.push(dy > 0 ? "ArrowDown" : "ArrowUp");
    const dist = Math.max(Math.abs(dx), Math.abs(dy));
    const ticks = Math.max(1, Math.min(18, Math.floor(dist / 4)));

    for (const key of keys) await page.keyboard.down(key);
    await step(page, ticks);
    for (const key of keys) await page.keyboard.up(key);
  }
}

async function walkWaypoints(
  page: Page,
  points: readonly [number, number][],
): Promise<void> {
  const startArea = (await readState(page)).area;
  for (const [tx, ty] of points) {
    await walkTo(page, tx, ty);
    if ((await readState(page)).area !== startArea) return;
  }
}

test.describe.configure({ timeout: 120_000 });

test("real keys walk from Bay across Boardwalk, Crossing, and Lane to Plaza", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await openHarness(page);
  await resetPaused(page, "bay");

  // 1. Leave Bubblegum Bay westward -> Salt-Marsh Boardwalk (not Plaza directly).
  await walkWaypoints(page, [[20, 545]]);
  expect((await readState(page)).area).toBe("boardwalk");

  // Step straight left onto the boardwalk deck and capture an in-game review shot.
  await walkWaypoints(page, [[2050, 515], [1880, 440], [1560, 480]]);
  expect((await readState(page)).area).toBe("boardwalk");
  await page.screenshot({
    path: "art/review/east-road-ingame-boardwalk.jpg",
    type: "jpeg",
    quality: 90,
  });

  // Continue west across the boardwalk into Willowbrook Crossing.
  await walkWaypoints(page, [
    [1340, 610],
    [1100, 650],
    [820, 530],
    [620, 460],
    [400, 260],
    [20, 210],
  ]);
  const afterBoardwalk = await readState(page);
  expect(
    afterBoardwalk.area,
    JSON.stringify({
      player: afterBoardwalk.player,
      battle: afterBoardwalk.battle?.phase ?? null,
    }),
  ).toBe("crossing");

  // Walk onto the wooden bridge over the brook and capture an in-game review shot.
  await walkWaypoints(page, [[1900, 580], [1580, 580], [1360, 520]]);
  expect((await readState(page)).area).toBe("crossing");
  await page.screenshot({
    path: "art/review/east-road-ingame-crossing.jpg",
    type: "jpeg",
    quality: 90,
  });

  // Continue west across the bridge and meadow into Sunberry Lane.
  await walkWaypoints(page, [[1050, 500], [600, 440], [20, 415]]);
  expect((await readState(page)).area).toBe("lane");

  // Walk to the middle of Sunberry Lane by the bench & signpost and capture a shot.
  await walkWaypoints(page, [[1900, 600], [1400, 560]]);
  expect((await readState(page)).area).toBe("lane");
  await page.screenshot({
    path: "art/review/east-road-ingame-lane.jpg",
    type: "jpeg",
    quality: 90,
  });

  // Continue west into Cloverhollow Town Plaza.
  await walkWaypoints(page, [[800, 520], [20, 490]]);
  expect((await readState(page)).area).toBe("plaza");
});

test("plaza bus stop stays locked until Fae discovers a town on foot", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await openHarness(page);
  await resetPaused(page, "plaza");

  // Walk around the fountain/frog to the Star-Line bus stop sign at (878, 945).
  await walkWaypoints(page, [[1450, 550], [1450, 975], [878, 975], [878, 955]]);
  await page.keyboard.down("ArrowUp");
  await step(page, 2);
  await page.keyboard.up("ArrowUp");
  await page.keyboard.press("z");
  await step(page, 4);

  const state = await readState(page);
  expect(state.dialogue?.knot).toBe("bus_stop");
  expect(state.dialogue?.choices ?? []).toEqual([]);
});
