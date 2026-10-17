import { expect, test, type Page } from "@playwright/test";
import {
  longFlowTimeout, openHarness, playBattleCheck, readBattle, renderInfo, resetPaused, step,
} from "./helpers";

// Milestone 51: first touch. In Meadow Park (the park fixture, seed 1) the
// pond's Zoomie Pup takes a moment to notice Fae in its sight: "?" over it,
// then "!" as it gives chase. Fae walks up to its row and dashes at it before
// it notices her (a head start), or stands in its sight until it catches her
// (it bursts first). The ticks come from walking these keys; content changes
// to the park or the roaming numbers move them.

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

// Steps a tick at a time until `done`, holding whatever keys are down.
async function until(page: Page, done: () => Promise<boolean>, limit = 200): Promise<void> {
  for (let count = 0; count < limit; count += 1) {
    if (await done()) return;
    await step(page, 1);
  }
  throw new Error("never got there");
}

async function pupMark(page: Page): Promise<string | null> {
  return (await renderInfo(page)).marks.find((item) => item.key === "wild:0")?.mark ?? null;
}

// Presses on to `phase`, then lets its message type out.
async function pressTo(page: Page, phase: string): Promise<void> {
  for (let count = 0; count < 300; count += 1) {
    const battle = await readBattle(page);
    if (battle?.phase === phase && battle.revealed >= battle.message.length) return;
    if (battle?.phase === phase) await step(page, 1);
    else await press(page);
  }
  throw new Error(`never reached ${phase}`);
}

test("real keys: Fae dashes at the pup before it notices her, a head start", { tag: "@smoke" },
  async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await openHarness(page);
    await resetPaused(page, "park");
    await hold(page, "ArrowUp", 62);
    await page.keyboard.down("ArrowRight");
    // In its sight: a "?" over the pup, which hasn't noticed her yet.
    await until(page, async () => (await pupMark(page)) === "?");
    const mark = (await renderInfo(page)).marks[0];
    if (mark === undefined) throw new Error("no mark");
    const sticker = page.locator(".notice-mark");
    await expect(sticker).toHaveText("?");
    const box = await sticker.boundingBox();
    if (box === null) throw new Error("no mark on screen");
    expect(box.x + box.width / 2).toBeCloseTo(mark.x, 0);
    expect(box.y + box.height).toBeCloseTo(mark.y, 0);
    await expect(page).toHaveScreenshot("encounter-wondering.png");
    // On at it: she gets there first.
    await until(page, async () => (await readBattle(page)) !== null);
    await page.keyboard.up("ArrowRight");
    const battle = await readBattle(page);
    expect(battle).toMatchObject({ critterId: "pup", turn: 1, calm: 25 });
    await expect(sticker).toBeHidden();
    await pressTo(page, "intro");
    await expect(page.locator(".sticker-text-revealed"))
      .toHaveText("The Zoomie Pup didn't see Fae coming! It's a little calmer already.");
    await expect(page).toHaveScreenshot("encounter-surprised.png");
  });

test("real keys: standing in the pup's sight, it notices her and pounces first",
  async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await openHarness(page);
    await resetPaused(page, "park");
    await hold(page, "ArrowUp", 62);
    await hold(page, "ArrowRight", 125);
    // She stands still: "?", then "!" as the pup notices her.
    await until(page, async () => (await pupMark(page)) === "?");
    await until(page, async () => (await pupMark(page)) === "!");
    await expect(page.locator(".notice-mark")).toHaveText("!");
    await expect(page).toHaveScreenshot("encounter-alert.png");
    await until(page, async () => (await readBattle(page)) !== null);
    expect(await readBattle(page)).toMatchObject({ critterId: "pup", turn: 0, calm: 0 });
    await pressTo(page, "intro");
    await expect(page.locator(".sticker-text-revealed"))
      .toHaveText("The Zoomie Pup pounces before Fae is ready!");
    // Its burst comes first, before Fae has chosen anything.
    await pressTo(page, "burst");
    await press(page);
    expect((await readBattle(page))?.check?.side).toBe("fae");
    await playBattleCheck(page);
    await pressTo(page, "command");
    const turn = await readBattle(page);
    expect(turn).toMatchObject({ phase: "command", turn: 1, command: null });
    await expect(page.locator(".battle-commands")).toBeVisible();
  });
