import { expect, test, type Page } from "@playwright/test";
import {
  longFlowTimeout,
  openHarness,
  readBattle,
  readState,
  renderInfo,
  resetPaused,
  step,
} from "./helpers";

// Milestone 13 contract: Meadow Park. The plaza's lower-right cobbled path
// leads to the park (spawn `plaza-path`, (360, 850) facing up) and the park's
// exit path back (plaza spawn `park-path`, (1470, 930) facing up). The Zoomie
// Pup waits by the pond (880, 628): walking into him starts a battle with his
// own content (content/critters/pup.json) and atlas.

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

async function where(page: Page): Promise<{ x: number; y: number; area: string }> {
  const place = await page.evaluate(() => {
    const state = window.__cloverhollow?.getState();
    return state === undefined ? null : { ...state.player, area: state.area };
  });
  if (place === null) throw new Error("hook unavailable");
  return place;
}

// Walks toward a coordinate on one axis with real keys (Fae walks exactly 4
// units a tick), stopping on arrival, when something blocks the way, or when a
// door takes her to another area.
async function walk(page: Page, axis: "x" | "y", target: number): Promise<void> {
  const start = await where(page);
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const before = await where(page);
    if (before.area !== start.area) return;
    const error = target - before[axis];
    if (Math.abs(error) <= 2) return;
    const key = axis === "x" ? (error > 0 ? "ArrowRight" : "ArrowLeft")
      : (error > 0 ? "ArrowDown" : "ArrowUp");
    await hold(page, key, Math.max(1, Math.min(60, Math.floor(Math.abs(error) / 4))));
    if ((await where(page))[axis] === before[axis]) return;
  }
}

// From the plaza fixture's fountain spawn (1200, 550): right past the lamp
// post, down beside the planter, right along the cobbled path, then down into
// the doorway at the bottom of the painting.
async function toThePark(page: Page): Promise<void> {
  await openHarness(page);
  await resetPaused(page, "plaza");
  await walk(page, "x", 1260);
  await walk(page, "y", 900);
  await walk(page, "x", 1470);
  await hold(page, "ArrowDown", 30);
  await step(page, 40);
}

test("the plaza's lower path leads to Meadow Park, and its exit path leads back", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await toThePark(page);
  const park = await readState(page);
  expect(park.area).toBe("park");
  expect(park.player).toEqual({ x: 360, y: 850 });
  expect(park.facing).toBe("up");
  expect(park.critters.pup).toBe("chaos");
  const info = await renderInfo(page);
  expect(info.area).toBe("park");
  expect(info.critters).toEqual([{ id: "pup", frame: "chaos_idle_01" }]);
  expect(info.drawOrder.map((item) => item.label))
    .toEqual(expect.arrayContaining(["critter:pup", "critter:pup:aura", "maddie"]));
  expect(info.cachedAreaTextures.some((url) => url.includes("plaza"))).toBe(false);
  expect(info.cachedAreaTextures.some((url) => url.includes("park"))).toBe(true);
  await expect(page).toHaveScreenshot("park-arrival.png");

  await walk(page, "x", 200);
  await hold(page, "ArrowDown", 40);
  await step(page, 40);
  const plaza = await readState(page);
  expect(plaza.area).toBe("plaza");
  expect(plaza.player).toEqual({ x: 1470, y: 930 });
  expect(plaza.facing).toBe("up");
});

test("the Zoomie Pup's battle uses his own content, and Fae can run away", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await toThePark(page);
  await walk(page, "x", 480);
  await walk(page, "y", 600);
  await hold(page, "ArrowRight", 90);
  await expect(page.locator("html")).toHaveAttribute("data-battle", "open");
  const entry = (await readState(page)).player;
  expect((await readState(page)).battle?.critterId).toBe("pup");
  expect((await renderInfo(page)).battle.critter).toEqual({ id: "pup", frame: "chaos_idle_01" });
  await step(page, 120);
  await expect(page.locator(".sticker-text-revealed")).toHaveText(
    "A puppy in a red cap zooms out from behind the pond, barking at everything!");
  for (let count = 0; count < 10 && (await readBattle(page))?.phase !== "command"; count += 1)
    await press(page);
  expect((await readBattle(page))?.phase).toBe("command");
  // Messages type at 0.75 characters a tick, and directions wait for them.
  await step(page, 40);
  await expect(page).toHaveScreenshot("pup-battle-command.png");

  for (let count = 0; count < 3; count += 1) await press(page, "ArrowDown");
  await expect(page.locator(".battle-command[aria-selected='true']")).toHaveText("Run");
  await press(page);
  await step(page, 120);
  await expect(page.locator(".sticker-text-revealed")).toHaveText(
    "Fae backs away slowly. The pup keeps zooming around the pond.");
  for (let count = 0; count < 10 && (await readBattle(page)) !== null; count += 1)
    await press(page);
  await expect(page.locator("html")).not.toHaveAttribute("data-battle", "open");
  const after = await readState(page);
  expect(after.critters.pup).toBe("chaos");
  expect(after.stickers).toEqual([]);
  expect(after.player).toEqual(entry);
});
