import { expect, test, type Page } from "@playwright/test";
import {
  longFlowTimeout, openHarness, readBattle, readState, renderInfo, resetPaused, step, walk,
} from "./helpers";

// Milestone 13 contract: Meadow Park. The plaza's lower-right cobbled path
// leads to the park (spawn `plaza-path`, (360, 850) facing up) and the park's
// exit path back (plaza spawn `park-path`, (1470, 930) facing up). A Zoomie
// Pup is out by the pond (its den at (880, 600)) every time Fae arrives
// (Milestone 28): walking into it starts a battle with the pups' own content
// (content/critters/pup.json) and atlas.

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
  expect(park.wild.find((critter) => critter.den === 0))
    .toMatchObject({ kind: "pup", mood: "chaos" });
  const info = await renderInfo(page);
  expect(info.area).toBe("park");
  const pup = info.critters.find((critter) => critter.id === "wild:0");
  expect(pup).toMatchObject({ kind: "pup", frame: "chaos_idle_01" });
  // It has wandered a little since Fae arrived, within its den.
  expect(Math.hypot((pup?.x ?? 0) - 880, (pup?.y ?? 0) - 600)).toBeLessThanOrEqual(90);
  expect(info.drawOrder.map((item) => item.label))
    .toEqual(expect.arrayContaining(["critter:wild:0", "critter:wild:0:aura", "maddie"]));
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
  const met = await readBattle(page);
  expect(met).toMatchObject({ critterId: "pup", den: 0 });
  expect((await renderInfo(page)).battle.critter).toEqual({ id: "pup", frame: "chaos_idle_01" });
  await step(page, 120);
  await expect(page.locator(".sticker-text-revealed")).toHaveText(
    "A puppy in a red cap zooms out of nowhere, barking at everything!");
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
    "Fae backs away slowly. The pup keeps zooming in circles.");
  for (let count = 0; count < 10 && (await readBattle(page)) !== null; count += 1)
    await press(page);
  await expect(page.locator("html")).not.toHaveAttribute("data-battle", "open");
  const after = await readState(page);
  expect(after.wild.find((critter) => critter.den === 0)?.mood).toBe("chaos");
  expect(after.stickers).toEqual([]);
  // Back where she was the tick before they met.
  expect(after.player).toEqual(met?.entry);
});
