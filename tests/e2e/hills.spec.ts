import { expect, test } from "@playwright/test";
import {
  longFlowTimeout, openHarness, openMap, playBattleCheck, readBattle, readState,
  resetPaused, step, walk,
} from "./helpers";

test.describe.configure({ timeout: longFlowTimeout });

test("real keys: Clover Hills reveals its map label and west door", {
  tag: "@smoke",
}, async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await openHarness(page);
  await resetPaused(page, "hills");
  expect((await readState(page)).area).toBe("hills");
  await openMap(page);
  await expect(page.locator('.journal-map-land[data-land="hills"]')).toHaveText("Clover Hills");
  await page.keyboard.press("Escape");
  await step(page, 2);
  await walk(page, "x", 0);
  await walk(page, "y", 800);
  await step(page, 30);
  await expect.poll(async () => (await readState(page)).area).toBe("park");
});

test("real keys: Meadow Park's northeast gap reaches Clover Hills", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await openHarness(page);
  await resetPaused(page, "park-east");
  await walk(page, "y", 320);
  await step(page, 30);
  await expect.poll(async () => (await readState(page)).area).toBe("hills");
  expect((await readState(page)).player).toMatchObject({ x: 180, y: 650 });
});

test("real keys: the north door returns from the woods", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await openHarness(page);
  await resetPaused(page, "hills-north");
  await walk(page, "y", 0);
  await step(page, 30);
  expect((await readState(page)).area).toBe("woods");
  await walk(page, "x", 750);
  await walk(page, "y", 1065);
  await step(page, 30);
  await expect.poll(async () => (await readState(page)).area).toBe("hills");
  expect((await readState(page)).player).toMatchObject({ x: 1040, y: 180 });
});

test("real keys: a hills lamb pays coins and its sticker once", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await openHarness(page);
  await resetPaused(page, "hills-calm");
  await walk(page, "x", 450);
  await walk(page, "y", 850);
  await expect.poll(async () => (await readBattle(page))?.critterId).toBe("hedgehog");
  for (let count = 0; count < 180 && (await readBattle(page)) !== null; count += 1) {
    const battle = await readBattle(page);
    if (battle?.phase === "check" && battle.check !== null) await playBattleCheck(page);
    else {
      await page.keyboard.down("Enter");
      await step(page, 1);
      await page.keyboard.up("Enter");
      await step(page, 1);
    }
  }
  const state = await readState(page);
  expect(state.coins).toBe(8);
  expect(state.stickers).toEqual(["meadow-hedgehog"]);
});

async function reachLookout(page: import("@playwright/test").Page, qa = false): Promise<void> {
  if (qa) {
    await page.goto("./?qa=hills-lookout");
    await page.waitForFunction(() => Boolean(window.__cloverhollow));
  } else {
    await openHarness(page);
    await resetPaused(page, "hills");
  }
  await walk(page, "y", 345);
  await walk(page, "x", 1160);
  await page.keyboard.down("ArrowLeft");
  await step(page, 1);
  await page.keyboard.up("ArrowLeft");
}

async function reveal(
  page: import("@playwright/test").Page,
): Promise<NonNullable<Awaited<ReturnType<typeof readState>>["dialogue"]>> {
  for (let count = 0; count < 12; count += 1) {
    await step(page, 20);
    const dialogue = (await readState(page)).dialogue;
    if (dialogue !== null && dialogue.revealed >= dialogue.text.length) return dialogue;
    await page.keyboard.press("z");
  }
  throw new Error("dialogue did not reveal");
}

test("real keys: the Acorn Squirrel reaches the lookout cache", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await reachLookout(page, true);
  const before = await readState(page);
  expect(before.party.map((member) => member.id)).toContain("acorn-squirrel");
  const snacks = before.snacks;
  await page.keyboard.press("z");
  const first = await reveal(page);
  expect(first.text).toContain("scampers behind a stone");
  await page.keyboard.press("z");
  const found = await reveal(page);
  expect(found.text).toBe("The lookout cache has two sweet treats!");
  expect(found.revealed).toBeGreaterThanOrEqual(found.text.length);
  expect((await readState(page)).snacks).toBe(snacks + 2);
  await page.keyboard.press("z");
  const already = await reveal(page);
  expect(already.text).toContain("already found");
  expect((await readState(page)).snacks).toBe(snacks + 2);
});

test("real keys: the lookout cache stays closed without the Acorn Squirrel", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await reachLookout(page);
  const snacks = (await readState(page)).snacks;
  await page.keyboard.press("z");
  const quiet = await reveal(page);
  expect(quiet.text).toContain("quiet and sunny");
  expect((await readState(page)).snacks).toBe(snacks);
});
