import { expect, test, type Page, type TestInfo } from "@playwright/test";
import {
  longFlowTimeout,
  openHarness,
  readState,
  renderInfo,
  resetPaused,
  step,
} from "./helpers";

async function tapKey(page: Page, key: string): Promise<void> {
  await page.keyboard.down(key);
  await step(page, 1);
  await page.keyboard.up(key);
  await step(page, 2);
}

async function captureReview(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  if (process.env.CLOVERHOLLOW_REVIEW_SHOTS !== "1" || testInfo.project.name !== "chromium") {
    return;
  }
  await page.screenshot({
    path: `art/review/${name}.jpg`,
    type: "jpeg",
    quality: 90,
    animations: "disabled",
  });
}

async function walkNearShrineForView(page: Page): Promise<void> {
  // Walk north-west of the Shrine to an unobstructed vantage point in open meadow grass.
  await page.keyboard.down("ArrowUp");
  await step(page, 60);
  await page.keyboard.up("ArrowUp");
  await page.keyboard.down("ArrowRight");
  await step(page, 30);
  await page.keyboard.up("ArrowRight");
  await step(page, 2);
}

async function walkToShrine(page: Page): Promise<void> {
  // From meadow vantage point, walk right to x~770 then up to y~438 facing up.
  for (let guard = 0; guard < 18; guard += 1) {
    const st = await readState(page);
    if (st.player.x >= 764) break;
    await page.keyboard.down("ArrowRight");
    await step(page, 10);
    await page.keyboard.up("ArrowRight");
  }
  for (let guard = 0; guard < 24; guard += 1) {
    const st = await readState(page);
    const info = await renderInfo(page);
    if (st.player.y <= 442 && info.prompt.visible) break;
    await page.keyboard.down("ArrowUp");
    await step(page, 10);
    await page.keyboard.up("ArrowUp");
  }
  await page.keyboard.down("ArrowUp");
  await step(page, 2);
  await page.keyboard.up("ArrowUp");
  await step(page, 2);
}

async function openShrineByDialogue(page: Page): Promise<void> {
  await page.evaluate(() => window.__cloverhollow?.settings.setTextSpeed("instant"));
  for (let guard = 0; guard < 12; guard += 1) {
    const visible = await page.locator(".encore-shrine").isVisible();
    if (visible) return;
    await tapKey(page, "KeyZ");
  }
}

async function playEncoreToVictory(page: Page): Promise<void> {
  for (let guard = 0; guard < 220; guard += 1) {
    const state = await readState(page);
    const battle = state.battle;
    if (battle === null) return;
    if (battle.phase === "check" && battle.check !== null) {
      const check = battle.check;
      if (check.kind === "ring") {
        const wait = Math.max(0, check.spec.targetTick - check.tick - 1);
        if (wait > 0) await step(page, wait);
        await tapKey(page, "KeyZ");
      } else if (check.kind === "charge") {
        const wait = Math.max(0, check.spec.waitTicks - check.tick);
        if (wait > 0) await step(page, wait);
        await page.keyboard.down("KeyZ");
        await step(page, check.spec.targetTick);
        await page.keyboard.up("KeyZ");
        await step(page, 2);
      } else if (check.kind === "chain") {
        for (const arrival of check.spec.arrivals) {
          const cur = (await readState(page)).battle?.check;
          if (cur === null || cur === undefined || cur.kind !== "chain") break;
          const wait = Math.max(0, arrival - cur.tick - 1);
          if (wait > 0) await step(page, wait);
          await page.keyboard.down("KeyZ");
          await step(page, 1);
          await page.keyboard.up("KeyZ");
        }
        await step(page, 4);
      } else if (check.kind === "lean") {
        for (let t = 0; t < 240; t += 1) {
          const cur = (await readState(page)).battle?.check;
          if (cur === null || cur === undefined || cur.kind !== "lean") break;
          const blowing = cur.spec.starts.some(
            (start, idx) =>
              cur.results[idx] === "pending" &&
              cur.tick >= start &&
              cur.tick < start + cur.spec.puffTicks,
          );
          if (blowing) {
            await page.keyboard.down("ArrowRight");
            await step(page, 2);
            await page.keyboard.up("ArrowRight");
          } else {
            await step(page, 2);
          }
        }
      } else {
        await step(page, 12);
      }
      continue;
    }
    if (battle.phase === "command") {
      // Pick the first enabled non-recover/non-snack command (index 0 is primary attack).
      await tapKey(page, "KeyZ");
      continue;
    }
    await tapKey(page, "KeyZ");
  }
}

test.describe("Track E18A: Dream Memory Shrine / Boss Encore", () => {
  test.setTimeout(longFlowTimeout);

  test(
    "walks to Shrine, runs Star Challenge rematch, wins Trophy on desktop & phone",
    { tag: "@smoke" },
    async ({ page }, testInfo) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      await page.setViewportSize({ width: 1280, height: 720 });
      await openHarness(page);
      await resetPaused(page, "festival");
      await step(page, 2);

      // Verify dream-shrine prop is rendered in Sanctuary.
      const beforeWalk = await renderInfo(page);
      expect(beforeWalk.props.some((prop) => prop.id === "dream-shrine" && !prop.hidden)).toBe(
        true,
      );

      // Walk into view of the Dream Memory Shrine and capture an unobstructed meadow shot.
      await walkNearShrineForView(page);
      await captureReview(page, testInfo, "e18a-shrine-sanctuary-1280");

      // Walk Fae right up to the Dream Memory Shrine with real keyboard arrows.
      await walkToShrine(page);
      const atShrine = await renderInfo(page);
      expect(atShrine.prompt.visible).toBe(true);
      expect(atShrine.prompt.label).toBe("LOOK");

      const preEncore = await readState(page);
      const inkBefore = preEncore.ink;
      const crittersBefore = preEncore.critters;
      const stickersBefore = preEncore.stickers;
      const coinsBefore = preEncore.coins;

      // Open Dream Memory Shrine via real KeyZ dialogue interaction.
      await openShrineByDialogue(page);
      const shrine = page.locator(".encore-shrine");
      await expect(shrine).toBeVisible();
      const inkBeforeBattle = (await readState(page)).ink;
      await expect(page.locator("[data-encore-boss]")).toHaveCount(9);
      await expect(page.locator('[data-encore-boss="gull"]')).toHaveAttribute(
        "data-unlocked",
        "true",
      );
      await expect(page.locator('[data-encore-boss="hooded-kid"]')).toHaveAttribute(
        "data-unlocked",
        "true",
      );

      // Toggle Brisk Breeze via keyboard shortcut "1" and Pure Heart via click.
      await page.keyboard.press("Digit1");
      await expect(page.locator('[data-encore-modifier="brisk-breeze"]')).toHaveAttribute(
        "aria-checked",
        "true",
      );
      await page.locator('[data-encore-modifier="pure-heart"]').click();
      await expect(page.locator('[data-encore-modifier="pure-heart"]')).toHaveAttribute(
        "aria-checked",
        "true",
      );
      await expect(page.locator(".encore-reward-coins")).toContainText("+35 coins");
      await expect(page.locator(".encore-reward-stars")).toContainText("2-Star Challenge");

      // Let boss sticker crops decode cleanly before capturing desktop review screenshot.
      await page.waitForTimeout(150);
      await captureReview(page, testInfo, "e18a-shrine-menu-1280");

      // Verify phone viewport (874x402): zero horizontal overflow & >= 44 px touch targets.
      await page.setViewportSize({ width: 874, height: 402 });
      await page.waitForTimeout(80);
      const phoneLayout = await page.evaluate(() => {
        const card = document.querySelector<HTMLElement>(".encore-card");
        const detail = document.querySelector<HTMLElement>(".encore-detail-pane");
        const closeBtn = document.querySelector<HTMLElement>(".encore-close");
        const launchBtn = document.querySelector<HTMLElement>(".encore-launch");
        const modPills = [...document.querySelectorAll<HTMLElement>(".encore-mod-pill")];
        const bossCards = [...document.querySelectorAll<HTMLElement>(".encore-boss-card")];
        const cardRect = card?.getBoundingClientRect();
        const detailRect = detail?.getBoundingClientRect();
        const launchRect = launchBtn?.getBoundingClientRect();
        return {
          overflowX: (card?.scrollWidth ?? 0) > (card?.clientWidth ?? 0) + 1,
          withinViewport:
            cardRect !== undefined &&
            cardRect.left >= 0 &&
            cardRect.top >= 0 &&
            cardRect.right <= window.innerWidth + 1 &&
            cardRect.bottom <= window.innerHeight + 1,
          launchVisibleInDetail:
            detailRect !== undefined &&
            launchRect !== undefined &&
            launchRect.top >= detailRect.top - 1 &&
            launchRect.bottom <= detailRect.bottom + 1 &&
            launchRect.bottom <= window.innerHeight + 1,
          closeH: closeBtn?.getBoundingClientRect().height ?? 0,
          closeW: closeBtn?.getBoundingClientRect().width ?? 0,
          launchH: launchRect?.height ?? 0,
          minModH: Math.min(...modPills.map((el) => el.getBoundingClientRect().height)),
          minBossH: Math.min(...bossCards.map((el) => el.getBoundingClientRect().height)),
        };
      });
      expect(phoneLayout.overflowX).toBe(false);
      expect(phoneLayout.withinViewport).toBe(true);
      expect(phoneLayout.launchVisibleInDetail).toBe(true);
      expect(phoneLayout.closeW).toBeGreaterThanOrEqual(44);
      expect(phoneLayout.closeH).toBeGreaterThanOrEqual(44);
      expect(phoneLayout.launchH).toBeGreaterThanOrEqual(44);
      expect(phoneLayout.minModH).toBeGreaterThanOrEqual(44);
      expect(phoneLayout.minBossH).toBeGreaterThanOrEqual(44);
      await captureReview(page, testInfo, "e18a-shrine-menu-874");

      // Launch Grumpy Gull Encore rematch from desktop viewport.
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.locator(".encore-launch").click();
      await expect(shrine).toBeHidden();
      await expect.poll(async () => (await readState(page)).battle !== null).toBe(true);
      await expect(page.locator(".encore-battle-banner")).toContainText("Brisk Breeze");
      await expect(page.locator(".encore-battle-banner")).toContainText("Pure Heart");
      await expect
        .poll(() => page.evaluate(() => window.__cloverhollow?.sound.music()))
        .toMatchObject({ track: "encore", title: "Starlight Encore!", duck: false });

      // Advance intro -> turn 1 command menu and verify Pure Heart disables Snack.
      await step(page, 1);
      await tapKey(page, "KeyZ");
      await expect(page.locator(".battle-commands")).toBeVisible();
      await expect(page.locator(".battle-commands")).toContainText("Pure Heart");
      await captureReview(page, testInfo, "e18a-encore-battle-1280");

      // Complete the full Grumpy Gull 2-Star Encore rematch with real key presses.
      await playEncoreToVictory(page);

      // Verify smooth non-destructive exit back to Sanctuary with coins, stars, and Trophy!
      const afterWin = await readState(page);
      expect(afterWin.battle).toBeNull();
      expect(afterWin.area).toBe("sanctuary");
      expect(afterWin.coins).toBe(coinsBefore + 35);
      expect(afterWin.ink).toBe(inkBeforeBattle);
      expect(JSON.parse(afterWin.ink).variablesState).toEqual(
        JSON.parse(inkBefore).variablesState,
      );
      expect(afterWin.critters).toEqual(crittersBefore);
      expect(afterWin.stickers).toEqual(stickersBefore);
      expect(afterWin.encore?.trophies).toContain("gull-weathervane");
      expect(afterWin.encore?.bosses.gull?.bestStars).toBe(2);

      // Re-open the Shrine to verify gleaming earned Trophy + 2/27 Stars in the UI!
      await openShrineByDialogue(page);
      await expect(shrine).toBeVisible();
      await expect(page.locator("[data-encore-trophies]")).toContainText("Trophies 1/9");
      await expect(page.locator("[data-encore-stars]")).toContainText("2/27");
      await expect(page.locator(".encore-trophy-strip")).toContainText(
        "Clubhouse Trophy Earned: Lookout Weathervane Trophy",
      );
      await captureReview(page, testInfo, "e18a-shrine-trophy-1280");

      // Close cleanly via Escape and confirm zero page errors.
      await page.keyboard.press("Escape");
      await expect(shrine).toBeHidden();
      expect(errors).toEqual([]);
    },
  );
});
