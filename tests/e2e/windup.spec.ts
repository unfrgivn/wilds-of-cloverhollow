import { expect, test, type Page } from "@playwright/test";
import {
  longFlowTimeout, openHarness, playBattleCheck, queueScript, readBattle, recording, renderInfo,
  resetPaused, step,
} from "./helpers";

// Milestone 50: the gull winds up. The lookout's recorded run
// (tools/sim/record-lookout.ts) is replayed to its second turn's menu, the
// first wind-up, where the gull is grumpy and hungry at once; Fae pops both
// on real keys, Soothe then Snack, and the gust fizzles. `windingUp` is that
// tick (re-recording the run moves it: find it with `bun tools/sim/run.ts
// tests/sim/scripts/trail/lookout.json --fixture trail --trace`).
const path = "tests/sim/scripts/trail/lookout.json";
const windingUp = 428;

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

// Presses on to `phase`, then lets its message type out (a press there
// could choose a command).
async function until(page: Page, phase: string): Promise<void> {
  for (let count = 0; count < 200; count += 1) {
    const battle = await readBattle(page);
    if (battle?.phase === phase && battle.revealed >= battle.message.length) return;
    if (battle?.phase === phase) await step(page, 1);
    else await press(page);
  }
  throw new Error(`never reached ${phase}`);
}

async function toTheWindUp(page: Page): Promise<void> {
  const upTo: ReturnType<typeof recording> = [];
  let ticks = 0;
  for (const segment of recording(path)) {
    if (ticks >= windingUp) break;
    const take = Math.min(segment.ticks, windingUp - ticks);
    upTo.push({ frame: segment.frame, ticks: take });
    ticks += take;
  }
  await resetPaused(page, "trail");
  await queueScript(page, upTo);
  await step(page, windingUp);
  const battle = await readBattle(page);
  expect(battle?.critterId).toBe("gull");
  expect(battle?.phase).toBe("command");
  expect(battle?.turn).toBe(2);
  expect(battle?.windUp).toEqual({ feelings: ["grumpy", "hungry"], popped: [false, false],
    left: 2 });
}

// The commands wearing a badge, by label.
async function badged(page: Page): Promise<string[]> {
  return page.locator(".battle-command:has(.battle-command-badge:not([hidden])) " +
    ".battle-command-label").allTextContents();
}

test("real keys: Fae pops the gull's puffs, Soothe then Snack, and its gust fizzles",
  { tag: "@smoke" }, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await openHarness(page);
    await toTheWindUp(page);
    const start = await readBattle(page);
    if (start === null) throw new Error("no battle");
    await expect(page.locator(".sticker-text-revealed"))
      .toHaveText("The gull puffs up bigger and bigger! It's feeling everything at once!");
    // Two bubbles where the thought cloud would float, below the HUD and
    // between Fae and the gull; Soothe and Snack wear their badges.
    const row = page.locator(".battle-windup");
    await expect(row).toBeVisible();
    await expect(page.locator(".battle-windup-label")).toHaveText(["Grumpy", "Hungry"]);
    await expect(page.locator(".battle-feeling")).toBeHidden();
    expect(await badged(page)).toEqual(["Soothe", "Snack"]);
    const layout = (await renderInfo(page)).battle.layout;
    const box = await row.boundingBox();
    const hud = await page.locator(".battle-energy").boundingBox();
    if (layout === null || box === null || hud === null) throw new Error("no layout");
    expect(box.x + box.width / 2).toBeGreaterThan(layout.fae.x);
    expect(box.x + box.width / 2).toBeLessThan(layout.critter.x);
    expect(box.y).toBeGreaterThan(hud.y + hud.height);
    await expect(page).toHaveScreenshot("windup-menu.png");

    // Soothe answers grumpy: its bubble pops as it's chosen, then the ring.
    expect(start.selected).toBe(0);
    await press(page);
    const soothing = await readBattle(page);
    expect(soothing?.command).toBe("soothe");
    expect(soothing?.windUp?.popped).toEqual([true, false]);
    await expect(row).toBeHidden();
    await playBattleCheck(page);
    expect((await readBattle(page))?.phase).toBe("result");
    await expect(page.locator(".battle-windup-bubble.is-popped")).toHaveCount(1);
    await step(page, 60);
    await expect(page).toHaveScreenshot("windup-popped.png");

    // No burst: the gull puffs on into turn three, where only Snack is left.
    await until(page, "command");
    const puffing = await readBattle(page);
    expect(puffing?.turn).toBe(3);
    expect(puffing?.energy).toBe(start.energy);
    expect(puffing?.check).toBeNull();
    await expect(page.locator(".sticker-text-revealed"))
      .toHaveText("The gull puffs up even bigger!");
    expect(await badged(page)).toEqual(["Snack"]);

    // Down twice (past Play) to Snack: the last bubble pops, and the gust
    // fizzles out with no burst at all.
    await hold(page, "ArrowDown", 1);
    await step(page, 1);
    await hold(page, "ArrowDown", 1);
    expect((await readBattle(page))?.selected).toBe(2);
    await press(page);
    const snacked = await readBattle(page);
    expect(snacked?.phase).toBe("result");
    expect(snacked?.windUp?.popped).toEqual([true, true]);
    await until(page, "fizzle");
    const fizzled = await readBattle(page);
    expect(fizzled?.windUp).toBeNull();
    expect(fizzled?.energy).toBe(start.energy);
    await expect(page.locator(".sticker-text-revealed"))
      .toHaveText("Pfft! The gull's big gust fizzles into a tiny breeze.");
    await expect(row).toBeHidden();
    await until(page, "command");
    const after = await readBattle(page);
    expect(after?.turn).toBe(4);
    expect(after?.message).toBe("How can Fae calm the gull?");
  });

// The bubbles float in the open ground the battle layout leaves: on a notched
// phone and on the narrowest iPhone (an SE, 667 px) they clear the HUD, the
// commands, the message, and the touch buttons.
for (const size of [
  { width: 874, height: 402, insets: [0, 62, 21, 62] },
  { width: 667, height: 375, insets: [0, 0, 0, 0] },
]) {
  test(`the wind-up's bubbles clear everything at ${size.width}x${size.height}`,
    async ({ browser }) => {
      const context = await browser.newContext({
        viewport: { width: size.width, height: size.height }, hasTouch: true });
      const page = await context.newPage();
      await page.goto("./?touch=1");
      await page.waitForFunction(() => Boolean(window.__cloverhollow));
      await page.evaluate((insets) => {
        ["top", "right", "bottom", "left"].forEach((side, index) =>
          document.documentElement.style.setProperty(`--safe-${side}`, `${insets[index] ?? 0}px`));
      }, size.insets);
      await toTheWindUp(page);
      await step(page, 2);
      const bubbles = await page.locator(".battle-windup-bubble").evaluateAll((items) =>
        items.map((item) => {
          const rect = item.getBoundingClientRect();
          return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
        }));
      expect(bubbles).toHaveLength(2);
      const others = [".battle-energy", ".battle-calm", ".sticker-dialogue", ".touch-confirm",
        ".touch-cancel", ".touch-menu", ".battle-command"];
      for (const selector of others)
        for (const box of await page.locator(selector).evaluateAll((items) =>
          items.filter((item) => item.getClientRects().length > 0).map((item) => {
            const rect = item.getBoundingClientRect();
            return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
          })))
          for (const bubble of bubbles) {
            const overlaps = bubble.x < box.x + box.width && box.x < bubble.x + bubble.width &&
              bubble.y < box.y + box.height && box.y < bubble.y + bubble.height;
            expect(overlaps, `a bubble clears ${selector}`).toBe(false);
          }
      for (const bubble of bubbles) {
        expect(bubble.x).toBeGreaterThanOrEqual(0);
        expect(bubble.x + bubble.width).toBeLessThanOrEqual(size.width);
      }
      await expect(page).toHaveScreenshot(`windup-${size.width}.png`);
      await context.close();
    });
}
