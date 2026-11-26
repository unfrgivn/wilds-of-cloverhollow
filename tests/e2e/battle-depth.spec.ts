import { expect, test, type Page } from "@playwright/test";
import {
  longFlowTimeout,
  openHarness,
  playBattleCheck,
  queueScript,
  readBattle,
  readState,
  recording,
  resetPaused,
  step,
} from "./helpers";

test.describe.configure({ timeout: longFlowTimeout });

async function hold(page: Page, key: string, ticks: number): Promise<void> {
  await page.keyboard.down(key);
  await step(page, ticks);
  await page.keyboard.up(key);
}

async function tapKey(page: Page, key: string): Promise<void> {
  await page.keyboard.down(key);
  await step(page, 1);
  await page.keyboard.up(key);
  await step(page, 1);
}

async function advanceUntil(
  page: Page,
  predicate: (battle: Awaited<ReturnType<typeof readBattle>>) => boolean,
): Promise<void> {
  for (let count = 0; count < 40; count += 1) {
    const battle = await readBattle(page);
    if (predicate(battle)) return;
    await tapKey(page, "Enter");
  }
  throw new Error("timed out advancing battle phase");
}

async function walkToFrogCommand(page: Page): Promise<void> {
  for (const [key, ticks] of [
    ["ArrowDown", 25],
    ["ArrowLeft", 15],
    ["ArrowDown", 50],
    ["ArrowLeft", 35],
  ] as const)
    await hold(page, key, ticks);
  await advanceUntil(
    page,
    (battle) => battle?.phase === "command" && battle.revealed >= battle.message.length,
  );
}

async function soundCuesSince(page: Page, tick: number): Promise<string[]> {
  return page.evaluate((since) =>
    (window.__cloverhollow?.sound.log() ?? [])
      .filter((entry) => entry.tick > since)
      .map((entry) => entry.cue),
  tick);
}

async function chargeSparkleToFull(page: Page): Promise<void> {
  // Turn 1: Soothe GREAT -> sparkle 1.
  expect((await readBattle(page))?.selected).toBe(0);
  await tapKey(page, "Enter");
  await playBattleCheck(page);
  expect((await readBattle(page))?.sparkle).toBe(1);
  await expect(page.locator(".battle-sparkle-pill")).toBeVisible();
  await expect(page.locator(".battle-sparkle-pill"))
    .toHaveAttribute("aria-label", "Sparkle 1 of 3");

  // Enemy burst 1: bubble chain GREAT -> sparkle 2.
  await advanceUntil(page, (battle) => battle?.phase === "check");
  await playBattleCheck(page);
  expect((await readBattle(page))?.sparkle).toBe(2);
  await advanceUntil(
    page,
    (battle) => battle?.phase === "command" && battle.revealed >= battle.message.length,
  );
  await expect(page.locator(".battle-sparkle-pill"))
    .toHaveAttribute("aria-label", "Sparkle 2 of 3");

  // Turn 2: Soothe GREAT -> sparkle 3 (full!).
  await tapKey(page, "Enter");
  await playBattleCheck(page);
  expect((await readBattle(page))?.sparkle).toBe(3);

  // Enemy burst 2: bubble chain GREAT -> sparkle stays 3.
  await advanceUntil(page, (battle) => battle?.phase === "check");
  await playBattleCheck(page);
  expect((await readBattle(page))?.sparkle).toBe(3);
  await advanceUntil(
    page,
    (battle) => battle?.phase === "command" && battle.revealed >= battle.message.length,
  );
}

test("real keys: charge 3 sparkle stars and unleash Together! finisher", {
  tag: "@smoke",
}, async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await openHarness(page);
  await resetPaused(page, "plaza-party");
  const startState = await readState(page);
  const startMaddieXp = startState.party.find((m) => m.id === "maddie")?.xp ?? 0;
  const startSueXp = startState.party.find((m) => m.id === "sue")?.xp ?? 0;

  await walkToFrogCommand(page);
  await chargeSparkleToFull(page);

  await expect(page.locator(".battle-sparkle-pill")).toBeHidden();
  const togetherBtn = page.locator(".battle-together-btn");
  await expect(togetherBtn).toBeVisible();
  await expect(togetherBtn).toContainText("Together!");
  await expect(page).toHaveScreenshot("battle-together-ready-1280.png");
  await page.setViewportSize({ width: 874, height: 402 });
  await expect(page).toHaveScreenshot("battle-together-ready-874.png");
  await page.setViewportSize({ width: 1280, height: 720 });

  const tickBefore = (await readState(page)).tick;
  await page.keyboard.down("x");
  await step(page, 1);
  await page.keyboard.up("x");

  const launched = await readBattle(page);
  expect(launched?.phase).toBe("check");
  expect(launched?.command).toBe("together");
  expect(launched?.sparkle).toBeUndefined();
  expect(launched?.check?.kind).toBe("chain");
  expect(launched?.check?.kind === "chain" ? launched.check.spec.look : "").toBe("star");
  await expect(page.locator(".battle-check-hint")).toHaveText("Press together for each star!");
  expect(await soundCuesSince(page, tickBefore)).toContain("battle-together");

  // Step until the first star is clearly in flight and capture the star chain overlay.
  await step(page, 24);
  await expect(page.locator(".battle-chain-beat:visible .battle-icon-star").first()).toBeVisible();
  await expect(page).toHaveScreenshot("battle-together-stars-1280.png");

  // Hit every star beat with real Enter presses.
  await playBattleCheck(page);
  const result = await readBattle(page);
  expect(result?.phase).toBe("result");
  expect(result?.lastGrade).toBe("great");
  expect(result?.calm).toBe(100);
  expect(result?.message).toBe(
    "Fae and her friends shine together in a dazzling watercolor swirl!",
  );

  // Advance through soothed -> reward -> overworld and verify XP sharing.
  await advanceUntil(page, (battle) => battle === null);
  const endState = await readState(page);
  expect(endState.party.find((m) => m.id === "maddie")?.xp ?? 0).toBeGreaterThan(startMaddieXp);
  expect(endState.party.find((m) => m.id === "sue")?.xp ?? 0).toBeGreaterThan(startSueXp);
});

test("clicking the Together! sticker button launches the finisher on touch phone", {
  tag: "@smoke",
}, async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 874, height: 402 },
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.goto("./?touch=1");
  await page.waitForFunction(() => Boolean(window.__cloverhollow));
  await resetPaused(page, "plaza-party");
  await walkToFrogCommand(page);
  await chargeSparkleToFull(page);

  const togetherBtn = page.locator(".battle-together-btn");
  await expect(togetherBtn).toBeVisible();
  await togetherBtn.click();
  await step(page, 1);
  const launched = await readBattle(page);
  expect(launched?.phase).toBe("check");
  expect(launched?.command).toBe("together");
  await context.close();
});

const fluteScript = "tests/sim/scripts/new-game/golden-flute.json";
const fluteBattleMenuTick = 20438;

test("real keys: Flute Friends assist in battle via F key", {
  tag: "@smoke",
}, async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await openHarness(page);
  await resetPaused(page, "new-game");
  const upTo: ReturnType<typeof recording> = [];
  let ticks = 0;
  for (const segment of recording(fluteScript)) {
    if (ticks >= fluteBattleMenuTick) break;
    const take = Math.min(segment.ticks, fluteBattleMenuTick - ticks);
    upTo.push({ frame: segment.frame, ticks: take });
    ticks += take;
  }
  await queueScript(page, upTo);
  await step(page, fluteBattleMenuTick);

  const before = await readBattle(page);
  expect(before?.phase).toBe("command");
  expect(before?.calm).toBe(25);
  expect(before?.fluteUsed).toBeUndefined();
  const fluteBtn = page.locator(".battle-flute-btn");
  await expect(fluteBtn).toBeVisible();
  await expect(fluteBtn).toContainText("Pond Pup");
  await expect(page).toHaveScreenshot("battle-flute-ready-1280.png");

  const tickBefore = (await readState(page)).tick;
  await tapKey(page, "f");
  const called = await readBattle(page);
  expect(called?.phase).toBe("command");
  expect(called?.fluteUsed).toBe(true);
  expect(called?.calm).toBe(50);
  expect(called?.message).toBe(
    "Fae plays her flute! Pond Pup dashes in with a happy bark, calming the air!",
  );
  expect(await soundCuesSince(page, tickBefore)).toContain("flute");
  await expect(fluteBtn).toBeHidden();

  // Let the message finish revealing and capture the battle HUD after the assist.
  await step(page, 140);
  await expect(page).toHaveScreenshot("battle-flute-called-1280.png");
});
