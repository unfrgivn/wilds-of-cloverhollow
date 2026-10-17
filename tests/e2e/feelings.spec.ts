import { expect, test, type Page } from "@playwright/test";
import {
  longFlowTimeout, openHarness, playBattleCheck, queueScript, readBattle, readState, recording,
  renderInfo, resetPaused, step,
} from "./helpers";

// Milestone 42: feelings. With Maddie and Sue (the plaza-party fixture, seed
// 1) the fountain frog's first turns feel curious, curious, then zoomy: Cast
// wears the badge, and answering it adds the feeling bonus on top of Cast's
// own calm.

test.describe.configure({ timeout: longFlowTimeout });

async function hold(page: Page, key: string, ticks: number): Promise<void> {
  await page.keyboard.down(key);
  await step(page, ticks);
  await page.keyboard.up(key);
}

async function press(page: Page): Promise<void> {
  await page.keyboard.down("Enter");
  await step(page, 1);
  await page.keyboard.up("Enter");
  await step(page, 1);
}

// From the fountain spawn into the frog's touch circle, then through the
// intro to the typed-out command menu.
async function toTheMenu(page: Page): Promise<void> {
  for (const [key, ticks] of [["ArrowDown", 25], ["ArrowLeft", 15], ["ArrowDown", 50],
    ["ArrowLeft", 35]] as const)
    await hold(page, key, ticks);
  for (let count = 0; count < 20; count += 1) {
    const battle = await readBattle(page);
    if (battle?.phase === "command" && battle.revealed >= battle.message.length) return;
    await press(page);
  }
  throw new Error("never reached the command menu");
}

test("real keys: the frog is curious, Cast answers it, and the bonus lands", { tag: "@smoke" },
  async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await openHarness(page);
    await resetPaused(page, "plaza-party");
    await toTheMenu(page);
    const battle = await readBattle(page);
    expect(battle?.feelings).toEqual(["curious", "curious", "zoomy"]);
    const cloud = page.locator(".battle-feeling");
    await expect(cloud).toBeVisible();
    await expect(page.locator(".battle-feeling-label")).toHaveText("Curious");
    // The next turn's feeling rides in the trail; the lantern's dot is empty.
    await expect(page.locator(".battle-feeling-next .battle-icon")).toHaveCount(1);
    await expect(page.locator(".battle-feeling-later .battle-icon")).toHaveCount(0);
    // Cast wears the badge; nothing else does.
    const badged = page.locator(".battle-command:has(.battle-command-badge:not([hidden]))");
    await expect(badged).toHaveCount(1);
    await expect(badged.locator(".battle-command-label")).toHaveText("Cast");
    // The cloud floats between the party and the frog, below the HUD.
    const info = (await renderInfo(page)).battle.layout;
    const box = await cloud.boundingBox();
    if (info === null || box === null) throw new Error("no layout or cloud");
    expect(box.x + box.width / 2).toBeGreaterThan(info.fae.x);
    expect(box.x + box.width / 2).toBeLessThan(info.critter.x);
    const hud = await page.locator(".battle-energy").boundingBox();
    if (hud === null) throw new Error("no HUD");
    expect(box.y).toBeGreaterThan(hud.y + hud.height);
    await expect(page).toHaveScreenshot("feelings-menu.png");

    // Down twice to Cast, choose it, and wind up on a real held key.
    await hold(page, "ArrowDown", 1);
    await step(page, 1);
    await hold(page, "ArrowDown", 1);
    expect((await readBattle(page))?.selected).toBe(2);
    await press(page);
    const charging = await readBattle(page);
    expect(charging?.command).toBe("cast");
    expect(charging?.answered).toBe(true);
    // The cloud steps aside for the check.
    await expect(cloud).toBeHidden();
    await playBattleCheck(page);
    const result = await readBattle(page);
    expect(result?.phase).toBe("result");
    expect(result?.lastGrade).toBe("great");
    // Cast's 35 and its GREAT 10, and the answered feeling's 15.
    expect(result?.calm).toBe(60);
    await expect(cloud).toBeVisible();
    await expect(page.locator(".battle-feeling-heart")).toBeVisible();
    await step(page, 60);
    await expect(page).toHaveScreenshot("feelings-answered.png");
  });

// The cloud floats in the open ground the battle layout leaves: on a notched
// phone and on the narrowest iPhone (an SE, 667 px) it clears the HUD, the
// commands, the message, and the touch buttons.
for (const size of [
  { width: 874, height: 402, insets: [0, 62, 21, 62] },
  { width: 667, height: 375, insets: [0, 0, 0, 0] },
]) {
  test(`the cloud clears everything at ${size.width}x${size.height}`, async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: size.width, height: size.height }, hasTouch: true });
    const page = await context.newPage();
    await page.goto("./?touch=1");
    await page.waitForFunction(() => Boolean(window.__cloverhollow));
    await page.evaluate((insets) => {
      ["top", "right", "bottom", "left"].forEach((side, index) =>
        document.documentElement.style.setProperty(`--safe-${side}`, `${insets[index] ?? 0}px`));
    }, size.insets);
    await resetPaused(page, "plaza-party");
    await toTheMenu(page);
    await step(page, 2);
    // The cloud and its trail of thought dots, which hang outside its box.
    const cloud = await page.evaluate(() => {
      const rects = [...document.querySelectorAll<HTMLElement>(
        ".battle-feeling-cloud, .battle-feeling-dot")]
        .filter((item) => item.getClientRects().length > 0)
        .map((item) => item.getBoundingClientRect());
      if (rects.length === 0) return null;
      const left = Math.min(...rects.map((rect) => rect.left));
      const top = Math.min(...rects.map((rect) => rect.top));
      const right = Math.max(...rects.map((rect) => rect.right));
      const bottom = Math.max(...rects.map((rect) => rect.bottom));
      return { x: left, y: top, width: right - left, height: bottom - top };
    });
    if (cloud === null) throw new Error("no cloud");
    const others = [".battle-energy", ".battle-calm", ".sticker-dialogue", ".touch-confirm",
      ".touch-cancel", ".touch-menu", ".touch-lantern:not([hidden])", ".battle-command"];
    for (const selector of others)
      for (const box of await page.locator(selector).evaluateAll((items) =>
        items.filter((item) => item.getClientRects().length > 0).map((item) => {
          const rect = item.getBoundingClientRect();
          return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
        }))) {
        const overlaps = cloud.x < box.x + box.width && box.x < cloud.x + cloud.width &&
          cloud.y < box.y + box.height && box.y < cloud.y + cloud.height;
        expect(overlaps, `the cloud clears ${selector}`).toBe(false);
      }
    expect(cloud.x).toBeGreaterThanOrEqual(0);
    expect(cloud.x + cloud.width).toBeLessThanOrEqual(size.width);
    await expect(page).toHaveScreenshot(`feelings-cloud-${size.width}.png`);
    await context.close();
  });
}

test("Maddie alone: no feelings, no badges", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await openHarness(page);
  await resetPaused(page, "plaza");
  const rng = (await readState(page)).rng;
  await toTheMenu(page);
  expect((await readBattle(page))?.feelings).toEqual([]);
  // Nothing was drawn: the PRNG is where the walk left it.
  expect((await readState(page)).rng).toBe(rng);
  await expect(page.locator(".battle-feeling")).toBeHidden();
  await expect(page.locator(".battle-command-badge:not([hidden])")).toHaveCount(0);
});

// The woods run (tools/sim/record-woods.ts) meets the owl with Jordan's
// lantern in Fae's backpack. `menu` is the tick the owl's command line has
// typed out (re-recording moves it: find it with `bun tools/sim/run.ts
// tests/sim/scripts/pass-party/woods.json --fixture pass-party --trace`).
const woods = "tests/sim/scripts/pass-party/woods.json";
const menu = 1057;

test("real keys: L peeks at the owl's turn-after feeling", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await openHarness(page);
  await resetPaused(page, "pass-party");
  const upTo: ReturnType<typeof recording> = [];
  let ticks = 0;
  for (const segment of recording(woods)) {
    if (ticks >= menu) break;
    const take = Math.min(segment.ticks, menu - ticks);
    upTo.push({ frame: segment.frame, ticks: take });
    ticks += take;
  }
  await queueScript(page, upTo);
  await step(page, menu);
  await step(page, 1);
  const before = await readState(page);
  expect(before.battle?.critterId).toBe("owl");
  expect(before.battle?.phase).toBe("command");
  expect(before.battle?.lanternPeek).toBe(false);
  await expect(page.locator(".battle-feeling-later .battle-icon")).toHaveCount(0);

  await page.keyboard.down("l");
  await step(page, 1);
  await page.keyboard.up("l");
  await step(page, 1);
  const after = await readState(page);
  expect(after.battle?.lanternPeek).toBe(true);
  // The peek draws nothing and leaves the overworld lantern as it was.
  expect(after.rng).toBe(before.rng);
  expect(after.lantern).toBe(before.lantern);
  await expect(page.locator(".battle-feeling-later")).toHaveClass(/is-peeked/);
  await expect(page.locator(".battle-feeling-later .battle-icon")).toHaveCount(1);
  await expect(page).toHaveScreenshot("feelings-lantern-peek.png");
});
