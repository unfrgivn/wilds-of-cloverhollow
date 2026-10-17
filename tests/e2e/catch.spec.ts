import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  longFlowTimeout, openHarness, playBattleCheck, queueScript, readBattle, recording, renderInfo,
  resetPaused, step,
} from "./helpers";

// Milestone 41: the Zoomie Pup's burst is a catch. The park's recorded pup
// battle (tools/sim/record-pup.ts) is replayed to the tick its second catch
// starts, a big one (six toys) over all three lanes, then the catch is played
// with real arrow keys, or on touch with the arrow stickers. `caught` is that
// tick (re-recording the run moves it: find it with
// `bun tools/sim/run.ts tests/sim/scripts/park/pup-win.json --fixture park
// --trace`).
const path = "tests/sim/scripts/park/pup-win.json";
const caught = 364;

test.describe.configure({ timeout: longFlowTimeout });

async function toTheCatch(page: Page): Promise<void> {
  const upTo: ReturnType<typeof recording> = [];
  let ticks = 0;
  for (const segment of recording(path)) {
    if (ticks >= caught) break;
    const take = Math.min(segment.ticks, caught - ticks);
    upTo.push({ frame: segment.frame, ticks: take });
    ticks += take;
  }
  await resetPaused(page, "park");
  await queueScript(page, upTo);
  await step(page, caught);
  const battle = await readBattle(page);
  expect(battle?.phase).toBe("check");
  const check = battle?.check;
  if (check?.kind !== "catch") throw new Error("no catch");
  expect(check.tick).toBe(0);
  // Big: six toys, one or more in each of the three lanes.
  expect(check.big).toBe(true);
  expect(check.spec.arrivals).toHaveLength(6);
  expect(new Set(check.lanes)).toEqual(new Set([0, 1, 2]));
}

// The arrow sticker for a lane, or null for the middle (nothing held).
function reach(lane: number): string | null {
  return lane === 0 ? ".touch-reach-up" : lane === 2 ? ".touch-reach-down" : null;
}

async function overlaps(a: Locator, b: Locator): Promise<boolean> {
  const first = await a.boundingBox();
  const second = await b.boundingBox();
  if (first === null || second === null) throw new Error("not on screen");
  return first.x < second.x + second.width && second.x < first.x + first.width &&
    first.y < second.y + second.height && second.y < first.y + first.height;
}

test("real keys: Fae catches every tennis ball on the arrows", { tag: "@smoke" },
  async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await openHarness(page);
    await toTheCatch(page);
    const start = await readBattle(page);
    const check = start?.check;
    if (start === null || check?.kind !== "catch") throw new Error("no catch");
    await expect(page.locator(".battle-check-hint"))
      .toHaveText("Hold up or down to catch each one!");

    // Three lanes around Fae, high to low, and the catch in front of her,
    // in the middle until an arrow moves it.
    const info = (await renderInfo(page)).battle;
    const layout = info.layout;
    if (info.check?.kind !== "catch" || layout === null) throw new Error("no catch geometry");
    const [high, middle, low] = info.check.lanes;
    expect(high).toBeLessThan(middle);
    expect(middle).toBeLessThan(low);
    expect(info.check.catcherX).toBeGreaterThan(layout.fae.x);
    expect(info.check.catcherX).toBeLessThan(layout.critter.x);
    expect(info.check.y).toBe(middle);

    // Hold the first toy's lane on a real arrow until the next toy is in the
    // air, and look.
    const first = check.lanes[0] ?? 1;
    const key = first === 0 ? "ArrowUp" : first === 2 ? "ArrowDown" : null;
    if (key !== null) await page.keyboard.down(key);
    await step(page, (check.spec.arrivals[0] ?? 0) + 12);
    if (key !== null) await page.keyboard.up(key);
    const mid = await readBattle(page);
    expect(mid?.check?.kind === "catch" ? mid.check.results[0] : null).toBe("hit");
    await expect(page).toHaveScreenshot("catch-mid.png");

    await playBattleCheck(page);
    const done = await readBattle(page);
    expect(done?.phase).toBe("burstResult");
    expect(done?.lastGrade).toBe("great");
    expect(done?.energy).toBe(start.energy);
    await expect(page.locator(".battle-grade")).toHaveText("GREAT!");
    await step(page, 80);
    await expect(page.locator(".sticker-text-revealed"))
      .toHaveText("Boing, boing! Fae catches every single ball!");
  });

test("touch: the arrow stickers hold the catch high and low", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 874, height: 402 },
    hasTouch: true });
  const page = await context.newPage();
  await page.goto("./?touch=1");
  await page.waitForFunction(() => Boolean(window.__cloverhollow));
  // A notched iPhone in landscape (the UI gallery's insets): the arrows stand
  // past the notch, where the hint must still clear them.
  await page.evaluate(() => {
    for (const [side, size] of [["left", 59], ["right", 59], ["bottom", 21]] as const)
      document.documentElement.style.setProperty(`--safe-${side}`, `${size}px`);
  });
  await toTheCatch(page);
  await expect(page.locator(".touch-reach")).toBeVisible();
  await expect(page.locator(".touch-stick")).toBeHidden();
  const hint = page.locator(".battle-check-hint");
  await expect(hint).toBeVisible();
  for (const arrow of [".touch-reach-up", ".touch-reach-down"]) {
    expect(await overlaps(hint, page.locator(arrow)), `the hint clears ${arrow}`).toBe(false);
    for (const button of [".touch-confirm", ".touch-cancel"])
      expect(await overlaps(page.locator(arrow), page.locator(button))).toBe(false);
  }
  await expect(page).toHaveScreenshot("catch-touch-hint-874.png");
  const check = (await readBattle(page))?.check;
  if (check?.kind !== "catch") throw new Error("no catch");
  // Each toy: hold its lane's sticker (nothing for the middle) as it lands.
  for (const [index, arrival] of check.spec.arrivals.entries()) {
    const sticker = reach(check.lanes[index] ?? 1);
    const pointer = { pointerId: 1, pointerType: "touch", isPrimary: true };
    if (sticker !== null) await page.locator(sticker).dispatchEvent("pointerdown", pointer);
    const active = (await readBattle(page))?.check;
    await step(page, arrival - (active?.tick ?? arrival));
    if (sticker !== null) await page.locator(sticker).dispatchEvent("pointerup", pointer);
    if (index === 0) await expect(page).toHaveScreenshot("catch-touch-874.png");
  }
  const done = await readBattle(page);
  expect(done?.lastGrade).toBe("great");
  // The catch is over: its stickers step aside.
  await step(page, 1);
  await expect(page.locator(".touch-reach")).toBeHidden();
  await context.close();
});
