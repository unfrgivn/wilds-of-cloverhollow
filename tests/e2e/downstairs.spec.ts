import { expect, test, type Page } from "@playwright/test";
import {
  longFlowTimeout, openHarness, readState, renderInfo, resetPaused, step, walk,
} from "./helpers";

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

test.describe.configure({ timeout: longFlowTimeout });

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
  expect(state.player).toEqual({ x: 600, y: 650 });
  expect(state.facing).toBe("right");
  const [maddie] = state.party;
  if (maddie === undefined) throw new Error("Maddie missing from the party");
  expect(Math.hypot(maddie.x - state.player.x, maddie.y - state.player.y)).toBeLessThan(80);
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
  await hold(page, "ArrowLeft", 9);
  expect((await readState(page)).player.x, "Mom is solid").toBeGreaterThanOrEqual(644);
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
  // Texture residency (spec 4, texture budget): the areas the game keeps are
  // the one it's in and the one just left. The bedroom, two crossings back,
  // has unloaded.
  let info = await renderInfo(page);
  expect(info.cachedAreaTextures.some((url) => url.includes("bedroom"))).toBe(false);
  expect(info.cachedAreaTextures.some((url) => url.includes("kitchen"))).toBe(true);
  expect(info.cachedAreaTextures.some((url) => url.includes("plaza"))).toBe(true);

  await walk(page, "y", 545);
  await walk(page, "x", 330);
  await step(page, 40);
  state = await readState(page);
  expect(state.area).toBe("kitchen");
  expect(state.player).toEqual({ x: 965, y: 560 });
  expect(state.facing).toBe("left");
  // The way back through the house door found the kitchen still resident.
  info = await renderInfo(page);
  expect(info.cachedAreaTextures.some((url) => url.includes("plaza"))).toBe(true);
  expect(info.cachedAreaTextures.some((url) => url.includes("kitchen"))).toBe(true);

  await walk(page, "y", 510);
  await walk(page, "x", 655);
  await walk(page, "y", 650);
  await walk(page, "x", 420);
  await step(page, 40);
  state = await readState(page);
  expect(state.area).toBe("bedroom");
  expect(state.player).toEqual({ x: 525, y: 380 });
  // The plaza, two crossings back now, unloaded on the stairs' arrival.
  info = await renderInfo(page);
  expect(info.cachedAreaTextures.some((url) => url.includes("plaza"))).toBe(false);
  expect(info.cachedAreaTextures.some((url) => url.includes("kitchen"))).toBe(true);
  expect(info.cachedAreaTextures.some((url) => url.includes("bedroom"))).toBe(true);
});

test("a door's fade-out warms the area it leads to before the swap", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await openHarness(page);
  await resetPaused(page, "new-game");
  // Walk to the bedroom door a tick at a time, so the fade-out is caught on
  // its first tick with the world frozen.
  await page.keyboard.down("ArrowUp");
  let transitioning = false;
  for (let attempt = 0; attempt < 40 && !transitioning; attempt += 1) {
    await step(page, 1);
    transitioning = (await readState(page)).transition !== null;
  }
  await page.keyboard.up("ArrowUp");
  expect(transitioning).toBe(true);
  const frozen = (await readState(page)).transition?.elapsed ?? 0;
  // The warm-up belongs to the real-time loop (spec 11), so run just long
  // enough for the fade to tick once more, then freeze again. The pause lands
  // in the same task as the tick that moved the fade, and a resume can drain
  // at most a capped burst before the next frame, so the crossing cannot run
  // past the fade's own ticks.
  const mid = await page.evaluate(async (frozenElapsed: number) => {
    const hook = window.__cloverhollow;
    if (hook === undefined) throw new Error("hook unavailable");
    hook.resume();
    await new Promise<void>((resolve) => {
      const watch = (): void => {
        if ((hook.getState().transition?.elapsed ?? 0) > frozenElapsed) resolve();
        else requestAnimationFrame(watch);
      };
      watch();
    });
    hook.pause();
    const state = hook.getState();
    return { area: state.area, phase: state.transition?.phase ?? null };
  }, frozen);
  // The kitchen's art arrives in the Assets cache while the fade-out still
  // covers the bedroom: the world is frozen again, so nothing else could
  // have loaded it.
  await page.waitForFunction(() => {
    const hook = window.__cloverhollow;
    if (hook === undefined) return false;
    return hook.renderInfo().cachedAreaTextures.some((url) => url.includes("kitchen"));
  });
  expect(mid.area).toBe("bedroom");
  expect(mid.phase).toBe("out");
  await step(page, 40);
  const kitchen = await readState(page);
  expect(kitchen.area).toBe("kitchen");
});
