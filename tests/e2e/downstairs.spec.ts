import { expect, test, type Page } from "@playwright/test";
import { openHarness, readState, renderInfo, resetPaused, step } from "./helpers";

// Milestone 12 contract: downstairs at home. The bedroom door leads down to
// the kitchen, where Mom and Oliver are (area `npcs`); Mom talks, turns to
// face Fae while she does, and blocks the way; the front door leads to the
// plaza and the plaza's house door back in; the stairs lead up to the bedroom.
// renderInfo() gains `npcs: { id, frame, facing }[]`, and the draw order
// labels them `npc:<id>`.

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

// Walks toward a coordinate on one axis with real keys, stopping on arrival or
// when something blocks the way.
async function position(page: Page): Promise<{ x: number; y: number }> {
  const player = await page.evaluate(() => window.__cloverhollow?.getState().player);
  if (player === undefined) throw new Error("hook unavailable");
  return player;
}

async function walk(page: Page, axis: "x" | "y", target: number): Promise<void> {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const before = (await position(page))[axis];
    const error = target - before;
    if (Math.abs(error) <= 2) return;
    const key = axis === "x" ? (error > 0 ? "ArrowRight" : "ArrowLeft")
      : (error > 0 ? "ArrowDown" : "ArrowUp");
    // Fae walks exactly 4 units a tick, so this lands on the target.
    await hold(page, key, Math.max(1, Math.min(60, Math.floor(Math.abs(error) / 4))));
    if ((await position(page))[axis] === before) return;
  }
}

// Long real-key walks; CI's software-rendered browsers are about 6x slower.
test.describe.configure({ timeout: process.env.CI ? 180_000 : 60_000 });

async function goDownstairs(page: Page): Promise<void> {
  await openHarness(page);
  await resetPaused(page, "new-game");
  await hold(page, "ArrowUp", 30);
  await step(page, 40);
}

async function momFacing(page: Page): Promise<string | undefined> {
  return (await renderInfo(page)).npcs.find((npc) => npc.id === "mom")?.facing;
}

const text = (page: Page) => page.locator(".sticker-text-revealed");

test("the bedroom door leads down to the kitchen, where Mom and Oliver are", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await goDownstairs(page);
  const state = await readState(page);
  expect(state.area).toBe("kitchen");
  expect(state.player).toEqual({ x: 500, y: 650 });
  expect(state.facing).toBe("right");
  expect(Math.hypot(state.maddie.x - state.player.x, state.maddie.y - state.player.y))
    .toBeLessThan(80);
  const info = await renderInfo(page);
  expect(info.npcs.map((npc) => npc.id).sort()).toEqual(["mom", "oliver"]);
  expect(info.npcs.find((npc) => npc.id === "mom")?.facing).toBe("down");
  expect(info.drawOrder.map((item) => item.label))
    .toEqual(expect.arrayContaining(["npc:mom", "npc:oliver"]));
  await expect(page).toHaveScreenshot("kitchen-arrival.png");
});

test("Mom talks, turns to face Fae, remembers breakfast, and blocks the way", async ({
  page,
}) => {
  await goDownstairs(page);
  await walk(page, "x", 615);
  await walk(page, "y", 590);
  const prompt = page.locator(".sticker-prompt");
  await expect(prompt).toBeVisible();
  await expect(prompt.locator("span")).toHaveText("TALK");
  await press(page);
  await expect(page.locator(".sticker-speaker")).toHaveText("MOM", { useInnerText: true });
  await press(page);
  await expect(text(page)).toHaveText("Morning, sleepyhead! Blueberry pancakes are almost ready.");
  expect(await momFacing(page), "Fae is below Mom").toBe("down");
  // With no plan yet, her plan lines are skipped and the choices come with
  // her greeting (no empty step in between).
  await expect(page.locator(".sticker-choice")).toHaveText(["Eat a pancake", "Give Mom a hug"]);
  await press(page);
  await press(page);
  await expect(text(page)).toHaveText("Mmm. Perfect. Thanks, Mom!");
  await press(page);
  await expect(page.locator(".sticker-dialogue")).toBeHidden();

  await press(page);
  await press(page);
  await expect(text(page)).toHaveText("Have a good day, sweetie. Stay curious!");
  await press(page);
  await expect(page.locator(".sticker-dialogue")).toBeHidden();

  // From her right-hand side she turns to face Fae.
  await walk(page, "x", 675);
  await walk(page, "y", 535);
  await hold(page, "ArrowLeft", 1);
  await press(page);
  expect(await momFacing(page), "Fae is to Mom's right").toBe("right");
  await press(page);
  await press(page);
  await expect(page.locator(".sticker-dialogue")).toBeHidden();
  await hold(page, "ArrowLeft", 20);
  expect((await readState(page)).player.x, "Mom is solid").toBeGreaterThanOrEqual(645);
});

test("the front door leads to the plaza and back, and the stairs lead up", async ({ page }) => {
  await goDownstairs(page);
  await walk(page, "x", 655);
  await walk(page, "y", 510);
  await walk(page, "x", 1040);
  await step(page, 40);
  let state = await readState(page);
  expect(state.area).toBe("plaza");
  expect(state.player).toEqual({ x: 450, y: 500 });

  await walk(page, "y", 545);
  await walk(page, "x", 330);
  await step(page, 40);
  state = await readState(page);
  expect(state.area).toBe("kitchen");
  expect(state.player).toEqual({ x: 965, y: 560 });
  expect(state.facing).toBe("left");

  await walk(page, "y", 510);
  await walk(page, "x", 655);
  await walk(page, "y", 650);
  await walk(page, "x", 420);
  await step(page, 40);
  state = await readState(page);
  expect(state.area).toBe("bedroom");
  expect(state.player).toEqual({ x: 525, y: 380 });
});
