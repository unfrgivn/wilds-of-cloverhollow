import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { whichOneTargetSlot } from "../../src/core/checks-v2";
import {
  longFlowTimeout,
  openHarness,
  playBattleCheck,
  readBattle,
  readState,
  resetPaused,
  step,
} from "./helpers";

test.describe.configure({ timeout: longFlowTimeout });

type Box = { x: number; y: number; width: number; height: number };

function rectsOverlap(a: Box, b: Box): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x &&
    a.y < b.y + b.height && a.y + a.height > b.y;
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
  for (let count = 0; count < 60; count += 1) {
    const battle = await readBattle(page);
    if (predicate(battle)) return;
    await tapKey(page, "Enter");
  }
  throw new Error("timed out advancing battle phase");
}

async function captureReviewJpeg(page: Page, info: TestInfo, filename: string): Promise<void> {
  if (info.project.name !== "chromium") return;
  await page.screenshot({
    type: "jpeg",
    quality: 90,
    path: `art/review/${filename}`,
  });
}

async function clearRemainingBattle(page: Page): Promise<void> {
  for (let count = 0; count < 120; count += 1) {
    const battle = await readBattle(page);
    if (battle === null) return;
    if (battle.phase === "check") {
      await playBattleCheck(page);
      continue;
    }
    await tapKey(page, "Enter");
  }
  const stuck = await readBattle(page);
  throw new Error(`battle did not clear within 120 steps (phase=${stuck?.phase ?? "null"})`);
}

test(
  "desktop 1280x720 bay-duo: formation targeting, Dual Combo spin-snag, Flute Chorus, clear",
  { tag: "@smoke" },
  async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await openHarness(page);
    await resetPaused(page, "bay-duo");

    await advanceUntil(
      page,
      (battle) => battle?.phase === "command" && battle.revealed >= battle.message.length,
    );

    const plates = page.locator(".battle-foe-plate");
    await expect(plates).toHaveCount(2);
    await expect(plates.nth(0)).toBeVisible();
    await expect(plates.nth(1)).toBeVisible();
    await expect(page.locator(".battle-foe-track")).toHaveCount(2);
    await expect(page.locator(".battle-foe-plate .battle-intent-sticker")).toHaveCount(2);
    await expect(page.locator(".battle-foe-plate .battle-intent-sticker").nth(0)).toBeVisible();
    await expect(page.locator(".battle-foe-plate .battle-intent-sticker").nth(1)).toBeVisible();

    await captureReviewJpeg(page, testInfo, "e7-bay-duo-formation-desktop.jpg");

    // Target cycling with real ArrowRight / ArrowLeft keys.
    expect((await readBattle(page))?.targetIndex).toBe(0);
    await tapKey(page, "ArrowRight");
    const afterRight = await readBattle(page);
    expect(afterRight?.targetIndex).toBe(1);
    expect(afterRight?.critterId).toBe("crab");

    await tapKey(page, "ArrowLeft");
    const afterLeft = await readBattle(page);
    expect(afterLeft?.targetIndex).toBe(0);
    expect(afterLeft?.critterId).toBe("pup");

    // Turn 1: Fae Soothe GREAT -> sparkle 1, enemy burst GREAT -> sparkle 2 -> Turn 2 (Sue).
    await tapKey(page, "Enter");
    await playBattleCheck(page);
    expect((await readBattle(page))?.sparkle).toBe(1);
    await advanceUntil(page, (battle) => battle?.phase === "check");
    await playBattleCheck(page);
    expect((await readBattle(page))?.sparkle).toBe(2);
    await advanceUntil(
      page,
      (battle) => battle?.phase === "command" && battle.revealed >= battle.message.length,
    );

    const comboBtn = page.locator(".battle-commands .battle-command.is-combo", {
      hasText: "Bubblegum Lasso Spin",
    });
    await expect(comboBtn).toBeVisible();
    await captureReviewJpeg(page, testInfo, "e7-dual-combo-menu-desktop.jpg");

    // Navigate down with real ArrowDown keys until Bubblegum Lasso Spin is selected.
    for (let presses = 0; presses < 8; presses += 1) {
      const selected = await comboBtn.getAttribute("aria-selected");
      if (selected === "true") break;
      await tapKey(page, "ArrowDown");
    }
    await expect(comboBtn).toHaveAttribute("aria-selected", "true");

    const beforeComboState = await readState(page);
    const coinsBeforeCombo = beforeComboState.coins;
    const pupCalmBefore = beforeComboState.battle?.foes?.[0]?.calm ?? 0;
    const crabCalmBefore = beforeComboState.battle?.foes?.[1]?.calm ?? 0;

    await tapKey(page, "Enter");
    const spinStart = await readBattle(page);
    expect(spinStart?.phase).toBe("check");
    expect(spinStart?.command).toBe("combo:bubblegum-lasso-spin");
    expect(spinStart?.check?.kind).toBe("spin-snag");
    await expect(page.locator(".battle-spin-snag")).toBeVisible();

    // Spin lasso with real arrow keys into "snag" phase.
    for (const key of [
      "ArrowUp",
      "ArrowRight",
      "ArrowDown",
      "ArrowLeft",
      "ArrowUp",
      "ArrowRight",
    ]) {
      await page.keyboard.down(key);
      await step(page, 1);
      await page.keyboard.up(key);
    }

    const inSnag = await readBattle(page);
    expect(inSnag?.check?.kind).toBe("spin-snag");
    if (inSnag?.check?.kind !== "spin-snag") throw new Error("expected spin-snag");
    expect(inSnag.check.turns).toBeGreaterThanOrEqual(inSnag.check.spec.spinsNeeded);
    await expect(page.locator(".battle-spin-snag")).toHaveAttribute("data-phase", "snag");
    await expect(page.locator(".battle-spin-snag-btn")).toBeVisible();

    // Step partway into the closing snag ring so the review screenshot shows it clearly.
    await step(page, 10);
    await captureReviewJpeg(page, testInfo, "e7-spin-snag-check.jpg");

    // Press Enter right on target tick -> GREAT!
    const preSnag = (await readBattle(page))?.check;
    if (preSnag?.kind !== "spin-snag") throw new Error("expected spin-snag");
    const wait = preSnag.spec.targetTick - 1 - preSnag.snagTick;
    if (wait > 0) await step(page, wait);
    await page.keyboard.down("Enter");
    await step(page, 1);
    await page.keyboard.up("Enter");

    const afterComboState = await readState(page);
    expect(afterComboState.battle?.phase).toBe("result");
    expect(afterComboState.battle?.lastGrade).toBe("great");
    expect(afterComboState.coins - coinsBeforeCombo).toBe(4);
    expect(afterComboState.battle?.foes?.[0]?.calm ?? 0).toBeGreaterThan(pupCalmBefore);
    expect(afterComboState.battle?.foes?.[1]?.calm ?? 0).toBeGreaterThan(crabCalmBefore);

    // Advance to next command turn, trigger Flute Chorus via F key, and finish the formation.
    await advanceUntil(
      page,
      (battle) =>
        battle === null ||
        battle.phase === "check" ||
        (battle.phase === "command" && battle.revealed >= battle.message.length),
    );
    if ((await readBattle(page))?.phase === "check") {
      await playBattleCheck(page);
      await advanceUntil(
        page,
        (battle) =>
          battle === null ||
          (battle.phase === "command" && battle.revealed >= battle.message.length),
      );
    }
    const preFlute = await readBattle(page);
    if (preFlute !== null && preFlute.phase === "command") {
      await tapKey(page, "f");
      const postFlute = await readBattle(page);
      expect(postFlute?.fluteUsed).toBe(true);
    }

    await clearRemainingBattle(page);
    const endState = await readState(page);
    expect(endState.battle).toBeNull();
    expect(endState.calms.pup).toBeGreaterThanOrEqual(1);
    expect(endState.calms.crab).toBeGreaterThanOrEqual(1);
  },
);

test(
  "phone 874x402 touch woods-duo: non-overlapping foe plates, tap target, which-one cups, clear",
  { tag: "@smoke" },
  async ({ browser }, testInfo) => {
    const context = await browser.newContext({
      viewport: { width: 874, height: 402 },
      hasTouch: true,
    });
    const page = await context.newPage();
    try {
      await page.goto("./?touch=1");
      await page.waitForFunction(() => Boolean(window.__cloverhollow));
      await resetPaused(page, "woods-duo");
      await advanceUntil(
        page,
        (battle) => battle?.phase === "command" && battle.revealed >= battle.message.length,
      );

      const plates = page.locator(".battle-foe-plate");
      await expect(plates).toHaveCount(2);
      const plate0 = await plates.nth(0).boundingBox();
      const plate1 = await plates.nth(1).boundingBox();
      const commandsBox = await page.locator(".battle-commands").boundingBox();
      const dialogueBox = await page.locator(".sticker-dialogue").boundingBox();
      if (
        plate0 === null ||
        plate1 === null ||
        commandsBox === null ||
        dialogueBox === null
      ) {
        throw new Error("Missing expected bounding boxes on phone battle HUD");
      }
      expect(plate0.height).toBeGreaterThanOrEqual(44);
      expect(plate1.height).toBeGreaterThanOrEqual(44);
      expect(rectsOverlap(plate0, commandsBox)).toBe(false);
      expect(rectsOverlap(plate1, commandsBox)).toBe(false);
      expect(rectsOverlap(plate0, dialogueBox)).toBe(false);
      expect(rectsOverlap(plate1, dialogueBox)).toBe(false);

      await captureReviewJpeg(page, testInfo, "e7-woods-duo-phone.jpg");

      // Tap/click the 2nd foe plate to switch target to squirrel (index 1).
      expect((await readBattle(page))?.targetIndex).toBe(0);
      await plates.nth(1).click();
      await step(page, 1);
      const targeted = await readBattle(page);
      expect(targeted?.targetIndex).toBe(1);
      expect(targeted?.critterId).toBe("squirrel");

      // Execute Turn 1 command -> triggers which-one 3-Cup Shuffle burst.
      await tapKey(page, "Enter");
      await playBattleCheck(page);
      await advanceUntil(page, (battle) => battle?.phase === "check");

      const whichStart = await readBattle(page);
      expect(whichStart?.check?.kind).toBe("which-one");
      if (whichStart?.check?.kind !== "which-one") throw new Error("expected which-one");
      const energyBefore = whichStart.energy;

      await expect(page.locator(".battle-which-one")).toBeVisible();
      await expect(page.locator(".battle-which-one-cup")).toHaveCount(3);

      // Step to mid-"show" phase so the hiding cup lifts and reveals the golden star clearly.
      await step(page, Math.floor(whichStart.check.spec.showTicks / 2));
      await expect(page.locator(".battle-which-one")).toHaveAttribute("data-phase", "show");
      await captureReviewJpeg(page, testInfo, "e7-which-one-cups.jpg");

      // Step into "pick" phase and click the winning cup directly.
      const midCheck = (await readBattle(page))?.check;
      if (midCheck?.kind !== "which-one") throw new Error("expected which-one");
      const shuffleEnd =
        midCheck.spec.showTicks + midCheck.spec.shuffles * midCheck.spec.swapTicks;
      await step(page, shuffleEnd - midCheck.tick + 1);
      await expect(page.locator(".battle-which-one")).toHaveAttribute("data-phase", "pick");

      const targetSlot = whichOneTargetSlot(midCheck.hidingCup, midCheck.swaps);
      const winningCup = page.locator(
        `.battle-which-one-cup[aria-label="Pick cup ${targetSlot + 1}"]`,
      );
      await expect(winningCup).toBeVisible();
      await winningCup.click();
      await step(page, 1);

      const afterPick = await readBattle(page);
      expect(afterPick?.phase).toBe("burstResult");
      expect(afterPick?.lastGrade).toBe("great");
      expect(afterPick?.energy).toBe(energyBefore);

      // Finish calming both woodland foes.
      await clearRemainingBattle(page);
      const endState = await readState(page);
      expect(endState.battle).toBeNull();
      expect(endState.calms.raccoon).toBeGreaterThanOrEqual(1);
      expect(endState.calms.squirrel).toBeGreaterThanOrEqual(1);
    } finally {
      await context.close();
    }
  },
);

test(
  "desktop 1280x720 arcade-encore: whack 5-slot popping tickets and Mr. Pip Boss Phase-2 shift",
  { tag: "@smoke" },
  async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await openHarness(page);
    await resetPaused(page, "arcade-encore");
    await advanceUntil(
      page,
      (battle) => battle?.phase === "command" && battle.revealed >= battle.message.length,
    );

    // Complete Turn 1 command -> triggers whack Popping Ticket Slots burst.
    await tapKey(page, "Enter");
    await playBattleCheck(page);
    await advanceUntil(page, (battle) => battle?.phase === "check");

    const whackStart = await readBattle(page);
    expect(whackStart?.check?.kind).toBe("whack");
    const energyBefore = whackStart?.energy ?? 0;

    // Step a few ticks so slot #1 visibly pops up.
    await step(page, 4);
    await expect(page.locator(".battle-whack")).toBeVisible();
    await expect(page.locator(".battle-whack-slot")).toHaveCount(5);
    await expect(page.locator(".battle-whack-slot.is-active")).toHaveCount(1);
    await captureReviewJpeg(page, testInfo, "e7-whack-tickets.jpg");

    // Play all 5 popping tickets with real key presses -> GREAT and 0 energy lost.
    await playBattleCheck(page);
    const afterWhack = await readBattle(page);
    expect(afterWhack?.phase).toBe("burstResult");
    expect(afterWhack?.lastGrade).toBe("great");
    expect(afterWhack?.energy).toBe(energyBefore);

    // Continue calming Mr. Pip until calm >= 80 (>= 50% of 160) -> Boss Phase-2 activates!
    for (let round = 0; round < 6; round += 1) {
      await advanceUntil(
        page,
        (battle) =>
          battle === null ||
          battle.phase === "check" ||
          (battle.phase === "command" && battle.revealed >= battle.message.length),
      );
      const cur = await readBattle(page);
      if (cur === null) break;
      const pipCalm = cur.foes?.[0]?.calm ?? cur.calm;
      if (cur.phase === "command" && cur.targetIndex === 0 && pipCalm >= 80 && pipCalm < 160) {
        break;
      }
      if (cur.phase === "check") {
        await playBattleCheck(page);
      } else if (cur.phase === "command") {
        await tapKey(page, "Enter");
        await playBattleCheck(page);
      }
    }

    const phase2Battle = await readBattle(page);
    const pipCalm = phase2Battle?.foes?.[0]?.calm ?? phase2Battle?.calm ?? 0;
    expect(pipCalm).toBeGreaterThanOrEqual(80);
    expect(pipCalm).toBeLessThan(160);

    const banner = page.locator(".battle-phase2-banner");
    await expect(banner).toBeVisible();
    await expect(banner).toContainText("Jackpot Fever!");
    await expect(banner).toContainText(
      "Bonus round! Mr. Pip's ticket slots light up in neon gold!",
    );
    await captureReviewJpeg(page, testInfo, "e7-boss-phase2-pip.jpg");
  },
);
