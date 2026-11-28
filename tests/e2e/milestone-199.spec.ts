import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { whichOneTargetSlot } from "../../src/core/checks-v2";
import {
  longFlowTimeout,
  openHarness,
  playBattleCheck,
  readBattle,
  resetPaused,
  step,
} from "./helpers";

test.describe.configure({ timeout: longFlowTimeout });

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

test(
  "Milestone 198: live which-one, whack & spin-snag stage VFX choreography (desktop 1280x720)",
  { tag: "@smoke" },
  async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(`console.error: ${msg.text()}`);
    });

    await page.setViewportSize({ width: 1280, height: 720 });
    await openHarness(page);

    // 1. Cup Shuffle (`which-one`) on woods-duo: show -> shuffle -> pick VFX & clean clear.
    await resetPaused(page, "woods-duo");
    await advanceUntil(
      page,
      (battle) => battle?.phase === "command" && battle.revealed >= battle.message.length,
    );
    await tapKey(page, "Enter");
    await playBattleCheck(page);
    await advanceUntil(page, (battle) => battle?.phase === "check");

    const whichStart = await readBattle(page);
    expect(whichStart?.check?.kind).toBe("which-one");
    if (whichStart?.check?.kind !== "which-one") throw new Error("expected which-one check");

    await expect(page.locator(".battle-which-one")).toBeVisible();
    await step(page, Math.floor(whichStart.check.spec.showTicks / 2));
    await expect(page.locator(".battle-which-one")).toHaveAttribute("data-phase", "show");

    // Step into mid-shuffle so the sleight-of-hand mistWisp ribbons & sparkles render clearly.
    const midShow = (await readBattle(page))?.check;
    if (midShow?.kind !== "which-one") throw new Error("expected which-one check");
    const midShuffleTick =
      midShow.spec.showTicks + Math.floor(midShow.spec.swapTicks * 1.5);
    await step(page, Math.max(1, midShuffleTick - midShow.tick));
    await expect(page.locator(".battle-which-one")).toHaveAttribute("data-phase", "shuffle");
    await captureReviewJpeg(page, testInfo, "m198-which-one-vfx-1280.jpg");

    // Step into pick phase and select the winning cup via real keyboard keys.
    const inShuffle = (await readBattle(page))?.check;
    if (inShuffle?.kind !== "which-one") throw new Error("expected which-one check");
    const shuffleEnd =
      inShuffle.spec.showTicks + inShuffle.spec.shuffles * inShuffle.spec.swapTicks;
    await step(page, Math.max(1, shuffleEnd - inShuffle.tick + 1));
    await expect(page.locator(".battle-which-one")).toHaveAttribute("data-phase", "pick");

    const targetSlot = whichOneTargetSlot(inShuffle.hidingCup, inShuffle.swaps);
    for (let moves = 0; moves < 3; moves += 1) {
      const cur = (await readBattle(page))?.check;
      if (cur?.kind !== "which-one" || cur.cursor === targetSlot) break;
      await tapKey(page, "ArrowRight");
    }
    await tapKey(page, "Enter");
    const afterWhich = await readBattle(page);
    expect(afterWhich?.phase).toBe("burstResult");
    expect(afterWhich?.lastGrade).toBe("great");

    // 2. Arcade Ticket Whack (`whack`) on arcade-encore: live hit starburst & clean GREAT.
    await resetPaused(page, "arcade-encore");
    await advanceUntil(
      page,
      (battle) => battle?.phase === "command" && battle.revealed >= battle.message.length,
    );
    await tapKey(page, "Enter");
    await playBattleCheck(page);
    await advanceUntil(page, (battle) => battle?.phase === "check");

    const whackStart = await readBattle(page);
    expect(whackStart?.check?.kind).toBe("whack");
    await step(page, 4);
    await expect(page.locator(".battle-whack")).toBeVisible();
    await playBattleCheck(page);
    const afterWhack = await readBattle(page);
    expect(afterWhack?.phase).toBe("burstResult");
    expect(afterWhack?.lastGrade).toBe("great");

    // 3. Spin & Snag Lasso (`spin-snag`) via bay-duo Bubblegum Lasso Spin Dual Combo.
    await resetPaused(page, "bay-duo");
    await advanceUntil(
      page,
      (battle) => battle?.phase === "command" && battle.revealed >= battle.message.length,
    );
    // Earn 2 Together! stars on Turn 1 (Soothe GREAT + burst GREAT).
    await tapKey(page, "Enter");
    await playBattleCheck(page);
    await advanceUntil(page, (battle) => battle?.phase === "check");
    await playBattleCheck(page);
    await advanceUntil(
      page,
      (battle) => battle?.phase === "command" && battle.revealed >= battle.message.length,
    );

    // Target Snappy Crab (slot 1, unobstructed on right stage) before firing Bubblegum Lasso Spin.
    await tapKey(page, "ArrowRight");
    expect((await readBattle(page))?.targetIndex).toBe(1);

    const comboBtn = page.locator(".battle-commands .battle-command.is-combo", {
      hasText: "Bubblegum Lasso Spin",
    });
    await expect(comboBtn).toBeVisible();
    for (let presses = 0; presses < 8; presses += 1) {
      if ((await comboBtn.getAttribute("aria-selected")) === "true") break;
      await tapKey(page, "ArrowDown");
    }
    await expect(comboBtn).toHaveAttribute("aria-selected", "true");
    await tapKey(page, "Enter");

    const spinStart = await readBattle(page);
    expect(spinStart?.check?.kind).toBe("spin-snag");
    await expect(page.locator(".battle-spin-snag")).toBeVisible();

    // Spin lasso overhead with real arrow keys into snag phase.
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
    await expect(page.locator(".battle-spin-snag")).toHaveAttribute("data-phase", "snag");

    // Step midway into snag so the 7-color rainbow Bézier lasso arc & golden snag ring shine.
    await step(page, 16);
    await captureReviewJpeg(page, testInfo, "m198-spin-snag-vfx-1280.jpg");

    const preSnag = (await readBattle(page))?.check;
    if (preSnag?.kind !== "spin-snag") throw new Error("expected spin-snag check");
    const wait = preSnag.spec.targetTick - 1 - preSnag.snagTick;
    if (wait > 0) await step(page, wait);
    await page.keyboard.down("Enter");
    await step(page, 1);
    await page.keyboard.up("Enter");

    const afterSnag = await readBattle(page);
    expect(afterSnag?.phase).toBe("result");
    expect(afterSnag?.lastGrade).toBe("great");
    expect(errors).toEqual([]);
  },
);
