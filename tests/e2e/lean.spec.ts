import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  longFlowTimeout, openHarness, playBattleCheck, queueScript, readBattle, recording, renderInfo,
  resetPaused, step,
} from "./helpers";

// Milestone 48: a gust burst is a lean. The bay's recorded bluebird battle
// (tools/sim/record-bay.ts) is replayed to the tick its first burst starts, a
// normal lean (a gentle puff, then a strong one), then the lean is played
// with real arrow keys, or on touch with the arrow stickers. `leaning` is
// that tick (re-recording the run moves it: find it with
// `bun tools/sim/run.ts tests/sim/scripts/bay/bay.json --fixture bay --trace`).
const path = "tests/sim/scripts/bay/bay.json";
const leaning = 652;

test.describe.configure({ timeout: longFlowTimeout });

async function toTheLean(page: Page): Promise<void> {
  const upTo: ReturnType<typeof recording> = [];
  let ticks = 0;
  for (const segment of recording(path)) {
    if (ticks >= leaning) break;
    const take = Math.min(segment.ticks, leaning - ticks);
    upTo.push({ frame: segment.frame, ticks: take });
    ticks += take;
  }
  await resetPaused(page, "bay");
  await queueScript(page, upTo);
  await step(page, leaning);
  const battle = await readBattle(page);
  expect(battle?.critterId).toBe("bluebird");
  expect(battle?.phase).toBe("check");
  const check = battle?.check;
  if (check?.kind !== "lean") throw new Error("no lean");
  expect(check.tick).toBe(0);
  expect(check.big).toBe(false);
  expect(check.strengths).toEqual([2, 3]);
}

async function leanCheck(page: Page): Promise<{ tick: number; balance: number;
  results: string[] }> {
  const check = (await readBattle(page))?.check;
  if (check?.kind !== "lean") throw new Error("no lean");
  return { tick: check.tick, balance: check.balance, results: check.results };
}

async function overlaps(a: Locator, b: Locator): Promise<boolean> {
  const first = await a.boundingBox();
  const second = await b.boundingBox();
  if (first === null || second === null) throw new Error("not on screen");
  return first.x < second.x + second.width && second.x < first.x + first.width &&
    first.y < second.y + second.height && second.y < first.y + first.height;
}

test("real keys: a puff left alone pushes Fae back, and leaning with it tips her over",
  { tag: "@smoke" }, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await openHarness(page);
    await toTheLean(page);
    const start = await readBattle(page);
    if (start === null) throw new Error("no battle");
    await expect(page.locator(".battle-check-hint")).toHaveText("Hold left or right to balance!");

    // The track rides over Fae's head with the star in the middle.
    const info = (await renderInfo(page)).battle;
    const layout = info.layout;
    if (info.check?.kind !== "lean" || layout === null) throw new Error("no lean geometry");
    const { track } = info.check;
    expect(track.x).toBe(layout.fae.x);
    expect(track.y + track.height / 2).toBeLessThan(layout.fae.baseline - 1.3 * layout.fae.height);
    expect(info.check.x).toBe(track.x);

    // The first puff blows from tick 44: left alone, it pushes her back 2 a
    // tick, and the hint goes.
    await step(page, 70);
    expect(await leanCheck(page)).toEqual({ tick: 70, balance: -54,
      results: ["pending", "pending"] });
    const pushed = (await renderInfo(page)).battle.check;
    expect(pushed?.x).toBeCloseTo(track.x - 0.54 * track.width / 2, 5);
    await expect(page.locator(".battle-check-hint")).toBeHidden();
    await expect(page.locator(".battle-lean-swoosh:visible")).toHaveCount(3);
    await expect(page.locator(".battle-lean-puff").first()).toHaveClass(/is-blowing/);
    await expect(page).toHaveScreenshot("lean-mid.png");

    // Leaning back with the wind on a real arrow: 7 a tick, over in 7.
    await page.keyboard.down("ArrowLeft");
    await step(page, 6);
    expect((await leanCheck(page)).balance).toBe(-96);
    await step(page, 1);
    await page.keyboard.up("ArrowLeft");
    expect(await leanCheck(page)).toEqual({ tick: 77, balance: 0,
      results: ["miss", "pending"] });
    await expect(page.locator(".battle-lean-puff").first()).toHaveClass(/is-miss/);
    await expect(page.locator(".battle-lean-swoosh:visible")).toHaveCount(0);

    // Leaning back toward straight on the arrows holds the second puff.
    await playBattleCheck(page);
    const done = await readBattle(page);
    expect(done?.check).toMatchObject({ results: ["miss", "hit"] });
    expect(done?.phase).toBe("burstResult");
    expect(done?.lastGrade).toBe("good");
    expect(done?.energy).toBe(start.energy - 1);
    // GOOD hangs over Fae's head, the lost puff's dot grey and the held one
    // green.
    await expect(page.locator(".battle-grade")).toHaveText("GOOD!");
    await expect(page).toHaveScreenshot("lean-good.png");
    await step(page, 80);
    await expect(page.locator(".sticker-text-revealed"))
      .toHaveText("Fae wobbles in the swirl, but keeps her feet.");
  });

test("touch: the arrow stickers lean Fae back and forward", async ({ browser }) => {
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
  await toTheLean(page);
  await expect(page.locator(".touch-lean")).toBeVisible();
  await expect(page.locator(".touch-reach")).toBeHidden();
  await expect(page.locator(".touch-stick")).toBeHidden();
  const hint = page.locator(".battle-check-hint");
  await expect(hint).toBeVisible();
  const meters = page.locator(".battle-meter");
  for (const arrow of [".touch-lean-back", ".touch-lean-forward"]) {
    expect(await overlaps(hint, page.locator(arrow)), `the hint clears ${arrow}`).toBe(false);
    for (const button of [".touch-confirm", ".touch-cancel"])
      expect(await overlaps(page.locator(arrow), page.locator(button))).toBe(false);
  }
  // The track and its puff dots stay under the HUD.
  for (const part of [".battle-lean-track", ".battle-lean-puff >> nth=0"])
    for (const meter of await meters.all())
      expect(await overlaps(page.locator(part), meter), `${part} clears the HUD`).toBe(false);
  await expect(page).toHaveScreenshot("lean-touch-hint-874.png");

  // Each tick, hold the sticker that leans her back toward straight.
  const pointer = { pointerId: 1, pointerType: "touch", isPrimary: true };
  let held: string | null = null;
  for (let check = await leanCheck(page); check.results.includes("pending");
    check = await leanCheck(page)) {
    const sticker = check.balance <= -5 ? ".touch-lean-forward"
      : check.balance >= 5 ? ".touch-lean-back" : null;
    if (sticker !== held) {
      if (held !== null) await page.locator(held).dispatchEvent("pointerup", pointer);
      if (sticker !== null) await page.locator(sticker).dispatchEvent("pointerdown", pointer);
      held = sticker;
    }
    await step(page, 1);
    if (check.tick === 69) await expect(page).toHaveScreenshot("lean-touch-874.png");
  }
  if (held !== null) await page.locator(held).dispatchEvent("pointerup", pointer);
  const done = await readBattle(page);
  expect(done?.check).toMatchObject({ results: ["hit", "hit"] });
  expect(done?.lastGrade).toBe("great");
  // GREAT hangs over Fae's head, clear of the HUD.
  const grade = page.locator(".battle-grade");
  await expect(grade).toHaveText("GREAT!");
  for (const meter of await meters.all())
    expect(await overlaps(grade, meter), "the grade clears the HUD").toBe(false);
  // The lean is over: its stickers step aside.
  await step(page, 1);
  await expect(page.locator(".touch-lean")).toBeHidden();
  await context.close();
});
