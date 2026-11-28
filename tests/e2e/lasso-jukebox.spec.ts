import { expect, test, type Page } from "@playwright/test";
import type { MusicDebugInfo } from "../../src/platform/audio";
import {
  bunFindReplayTick,
  longFlowTimeout,
  openHarness,
  queueScript,
  readBattle,
  readState,
  recording,
  resetPaused,
  step,
} from "./helpers";

test.describe.configure({ timeout: longFlowTimeout });

const fluteScript = "tests/sim/scripts/new-game/golden-flute.json";
const kidScript = "tests/sim/scripts/new-game/golden-kid.json";

async function replayTo(page: Page, path: string, targetTick: number): Promise<void> {
  const upTo: ReturnType<typeof recording> = [];
  let ticks = 0;
  for (const segment of recording(path)) {
    if (ticks >= targetTick) break;
    const take = Math.min(segment.ticks, targetTick - ticks);
    upTo.push({ frame: segment.frame, ticks: take });
    ticks += take;
  }
  await queueScript(page, upTo);
  await step(page, targetTick);
}

async function tapKey(page: Page, key: string): Promise<void> {
  await page.keyboard.down(key);
  await step(page, 1);
  await page.keyboard.up(key);
  await step(page, 1);
}

async function soundCuesSince(page: Page, tick: number): Promise<string[]> {
  return page.evaluate((since) =>
    (window.__cloverhollow?.sound.log() ?? [])
      .filter((entry) => entry.tick > since)
      .map((entry) => entry.cue),
  tick);
}

async function readMusic(page: Page): Promise<MusicDebugInfo> {
  const info = await page.evaluate(() => window.__cloverhollow?.sound.music());
  if (info === undefined) throw new Error("hook unavailable");
  return info;
}

test(
  "real keys: Coach Ash's rainbow lasso snags coins, adds calm, and steadies burst",
  { tag: "@smoke" },
  async ({ page }) => {
    const fluteBattleMenuTick = bunFindReplayTick(fluteScript, "new-game", "lasso-steady-command");
    await page.setViewportSize({ width: 1280, height: 720 });
    await openHarness(page);
    await resetPaused(page, "new-game");
    await replayTo(page, fluteScript, fluteBattleMenuTick);

    const beforeState = await readState(page);
    const beforeBattle = await readBattle(page);
    expect(beforeBattle?.phase).toBe("command");

    const lassoBtn = page.locator(".battle-lasso-btn");
    await expect(lassoBtn).toBeVisible();
    await expect(lassoBtn.locator(".battle-action-label")).toHaveText("Lasso");
    await expect(lassoBtn.locator(".battle-action-key")).toHaveText("R");
    await expect(page.locator(".battle-steady-pill")).toBeHidden();

    const tickBefore = beforeState.tick;
    await tapKey(page, "r");

    const afterState = await readState(page);
    const afterBattle = await readBattle(page);
    expect(afterBattle?.phase).toBe("command");
    expect(afterBattle?.calm).toBe((beforeBattle?.calm ?? 0) + 15);
    expect(afterState.coins).toBe(beforeState.coins + 4);
    expect(afterBattle?.lassoUsed).toBe(true);
    expect(afterBattle?.lassoSteady).toBe(true);
    expect(afterBattle?.message).toBe(
      "Fae twirls her rainbow lasso! Snagged +4 coins and steadied the next burst!",
    );

    await expect(lassoBtn).toBeHidden();
    const steadyPill = page.locator(".battle-steady-pill");
    await expect(steadyPill).toBeVisible();
    await expect(steadyPill).toHaveText("✦ Steady");

    const cues = await soundCuesSince(page, tickBefore);
    expect(cues).toContain("lasso-twirl");
    expect(cues).toContain("coin");
  },
);

test(
  "real keys: Coach Ash's rainbow lasso pops a mini-boss wind-up bubble",
  { tag: "@smoke" },
  async ({ page }) => {
    const kidWindUpTick = bunFindReplayTick(kidScript, "new-game", "kid-lasso-windup");
    await page.setViewportSize({ width: 1280, height: 720 });
    await openHarness(page);
    await resetPaused(page, "new-game");
    await replayTo(page, kidScript, kidWindUpTick);
    await step(page, 120);

    const beforeState = await readState(page);
    const beforeBattle = await readBattle(page);
    expect(beforeBattle?.critterId).toBe("hooded-kid");
    expect(beforeBattle?.phase).toBe("command");
    expect(beforeBattle?.windUp?.popped).toEqual([false, false]);

    const lassoBtn = page.locator(".battle-lasso-btn");
    await expect(lassoBtn).toBeVisible();
    await expect(lassoBtn.locator(".battle-action-label")).toHaveText("Pop Bubble!");
    await expect(lassoBtn).toHaveAttribute("aria-label", "Lasso: Pop Bubble!");

    const tickBefore = beforeState.tick;
    await tapKey(page, "r");

    const afterState = await readState(page);
    const afterBattle = await readBattle(page);
    expect(afterBattle?.phase).toBe("command");
    expect(afterBattle?.windUp?.popped).toEqual([true, false]);
    expect(afterBattle?.calm).toBe((beforeBattle?.calm ?? 0) + 15);
    expect(afterState.coins).toBe(beforeState.coins);
    expect(afterBattle?.lassoUsed).toBe(true);
    expect(afterBattle?.lassoSteady).toBeUndefined();
    expect(afterBattle?.message).toBe(
      "Fae twirls her rainbow lasso and pops a fizzy wind-up bubble!",
    );

    await expect(lassoBtn).toBeHidden();
    await expect(page.locator(".battle-steady-pill")).toBeHidden();
    expect(await soundCuesSince(page, tickBefore)).toContain("lasso-twirl");
  },
);

test(
  "Journal Music Box cycles themes unducked and returns to the live area theme on close",
  { tag: "@smoke" },
  async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await openHarness(page);
    await resetPaused(page, "plaza");

    await expect.poll(async () => (await readMusic(page)).track).toBe("home");
    expect((await readMusic(page)).duck).toBe(false);

    // Open journal -> OPTIONS spread.
    await tapKey(page, "j");
    await expect(page.locator(".journal-book")).toHaveAttribute("data-journal-page", "notes");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await expect(page.locator(".journal-book")).toHaveAttribute("data-journal-page", "options");

    const nowPlaying = page.locator(".journal-now-playing");
    await expect(nowPlaying).toHaveText("♫ Cloverhollow Town");
    expect((await readMusic(page)).duck).toBe(true);

    // Step forward: home -> cafe ("Cinnamon Waltz"), unducked.
    await page.locator(".journal-jukebox-next").click();
    await expect.poll(async () => (await readMusic(page)).track).toBe("cafe");
    expect((await readMusic(page)).duck).toBe(false);
    await expect(nowPlaying).toHaveText("♫ Cinnamon Waltz");

    // Step backward: cafe -> home -> title -> morning (wraps cleanly around all 33 themes).
    const prevBtn = page.locator(".journal-jukebox-prev");
    await prevBtn.click();
    await expect.poll(async () => (await readMusic(page)).track).toBe("home");
    expect((await readMusic(page)).duck).toBe(false);
    await expect(nowPlaying).toHaveText("♫ Cloverhollow Town");

    await prevBtn.click();
    await expect.poll(async () => (await readMusic(page)).track).toBe("title");
    await expect(nowPlaying).toHaveText("♫ Watercolor Morning");

    await prevBtn.click();
    await expect.poll(async () => (await readMusic(page)).track).toBe("morning");
    await expect(nowPlaying).toHaveText("♫ Waking Up");

    // Closing the journal clears the jukebox override and returns smoothly to the area theme.
    await tapKey(page, "j");
    await expect(page.locator(".journal-book")).toBeHidden();
    await expect.poll(async () => await readMusic(page)).toMatchObject({
      track: "home",
      ambience: "town-breeze",
      duck: false,
      title: "Cloverhollow Town",
    });
  },
);
