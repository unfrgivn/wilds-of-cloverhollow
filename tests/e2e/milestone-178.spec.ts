import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { longFlowTimeout, openHarness, resetPaused, step } from "./helpers";

async function tapKey(page: Page, key: string): Promise<void> {
  await page.keyboard.down(key);
  await step(page, 1);
  await page.keyboard.up(key);
  await step(page, 2);
}

async function settleAnimations(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const root = document.querySelector(".journal-ribbons-overlay");
    if (root === null) return;
    await Promise.all(
      root
        .getAnimations({ subtree: true })
        .filter((anim) => anim.effect?.getTiming().iterations !== Number.POSITIVE_INFINITY)
        .map((anim) => anim.finished.catch(() => undefined)),
    );
  });
}

async function captureReview(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  if (process.env.CLOVERHOLLOW_REVIEW_SHOTS !== "1" || testInfo.project.name !== "chromium") {
    return;
  }
  await page.screenshot({
    path: `art/review/${name}.jpg`,
    type: "jpeg",
    quality: 90,
  });
}

type StatePatch = {
  stickers?: string[];
  prizes?: string[];
  caughtFish?: Record<string, number>;
  partyIds?: string[];
  inkVars?: Record<string, boolean>;
};

async function runQaCommands(page: Page, commands: readonly string[]): Promise<void> {
  await page.keyboard.press("`");
  await expect(page.locator(".qa-console")).toBeVisible();
  for (const command of commands) {
    await page.keyboard.type(command);
    await page.keyboard.press("Enter");
  }
  await page.keyboard.press("Escape");
  await expect(page.locator(".qa-console")).toBeHidden();
  await step(page, 2);
}

async function applyJourneyPatch(page: Page, patch: StatePatch): Promise<void> {
  const backup = await page.evaluate((next) => {
    const raw = window.__cloverhollow?.save.exportBackup?.();
    if (raw === undefined) return null;
    const isObj = (v: unknown): v is Record<string, unknown> =>
      typeof v === "object" && v !== null && !Array.isArray(v);
    const env: unknown = JSON.parse(raw);
    if (!isObj(env) || typeof env.save !== "string") return null;
    const payload: unknown = JSON.parse(env.save);
    if (!isObj(payload) || !isObj(payload.state)) return null;
    const st = payload.state;
    if (next.inkVars !== undefined) {
      if (typeof st.ink !== "string") return null;
      const inkObj: unknown = JSON.parse(st.ink);
      if (!isObj(inkObj) || !isObj(inkObj.variablesState)) return null;
      for (const [key, value] of Object.entries(next.inkVars)) {
        inkObj.variablesState[key] = value;
      }
      st.ink = JSON.stringify(inkObj);
    }
    if (next.stickers !== undefined) st.stickers = next.stickers;
    if (next.prizes !== undefined) st.prizes = next.prizes;
    if (next.caughtFish !== undefined) st.caughtFish = next.caughtFish;
    if (next.partyIds !== undefined) {
      const existingParty = Array.isArray(st.party) ? st.party : [];
      const baseMember = existingParty.find(isObj) ?? {
        id: "maddie",
        xp: 0,
        x: 500,
        y: 500,
        facing: "down",
        motion: { distance: 0, moving: false },
        stillTicks: 0,
        trail: [],
      };
      st.party = next.partyIds.map((id) => ({ ...baseMember, id }));
    }
    return JSON.stringify(payload);
  }, patch);
  expect(backup).not.toBeNull();
  const imported = await page.evaluate(async (saveJson) => {
    const hook = window.__cloverhollow;
    if (hook?.save.importBackup === undefined || saveJson === null) return false;
    return hook.save.importBackup(saveJson);
  }, backup);
  expect(imported).toBe(true);
  await step(page, 2);
}

test.describe("Milestone 176: Valley Merit Ribbons", () => {
  test.setTimeout(longFlowTimeout);

  test(
    "mid-journey 5/12 showcase restores focus and 12/12 Valley Legend fits 874x402 via Treasures",
    { tag: "@smoke" },
    async ({ page }, testInfo) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      await page.setViewportSize({ width: 1280, height: 720 });
      await openHarness(page);

      // Persist Taco Truck personal best so Fiesta Taco Chef unlocks cleanly via real Preferences.
      await page.evaluate(() => {
        localStorage.setItem(
          "CapacitorStorage.cloverhollow-records",
          JSON.stringify({ skee: 0, mole: 0, comet: 0, fish: 0, cook: 0, taco: 450 }),
        );
      });
      await page.reload();
      await page.waitForFunction(() => Boolean(window.__cloverhollow));
      await resetPaused(page, "plaza");
      await expect
        .poll(() => page.evaluate(() => window.__cloverhollow?.settings.minigameRecords().taco))
        .toBe(450);

      // 1. Mid-journey state (5/12 ribbons earned).
      await applyJourneyPatch(page, {
        stickers: ["fountain-frog", "pond-pup", "ribbon-bunny"],
        prizes: ["frog-plush", "pup-plush", "raccoon-plush", "cat-plush"],
        caughtFish: { minnow: 2, perch: 1 },
        partyIds: ["maddie", "sue", "jordan"],
        inkVars: {
          buster_reward: true,
          summit_aurora_read: true,
          gem_park: true,
          gem_bay: true,
          gem_pass: true,
        },
      });

      await tapKey(page, "j");
      const book = page.locator(".journal-book");
      await expect(book).toBeVisible();

      const banner = page.locator(".journal-ribbons-banner");
      await banner.scrollIntoViewIfNeeded();
      await expect(banner).toBeVisible();
      await expect(banner).toContainText("★ Valley Merit Ribbons · 5/12");

      await banner.click();
      const overlay = page.locator(".journal-ribbons-overlay");
      const card = page.locator(".journal-ribbons-card");
      await expect(overlay).toBeVisible();
      await expect(card).toBeFocused();
      await settleAnimations(page);

      await expect(card.locator(".journal-ribbons-title")).toHaveText("VALLEY MERIT RIBBONS");
      await expect(card.locator(".journal-ribbons-count")).toHaveText("5/12");
      await expect(card.locator(".journal-ribbons-count")).not.toHaveClass(/is-complete/);
      await expect(card.locator(".journal-ribbon-tile.is-earned")).toHaveCount(5);
      await expect(card.locator(".journal-ribbon-tile.is-locked")).toHaveCount(7);
      await expect(
        card.locator('.journal-ribbon-tile[data-ribbon="gem-scholar"] .journal-ribbon-progress'),
      ).toHaveText("3/7");
      await expect(
        card.locator('.journal-ribbon-tile[data-ribbon="master-angler"] .journal-ribbon-progress'),
      ).toHaveText("2/6");
      await expect(
        card.locator(
          '.journal-ribbon-tile[data-ribbon="arcade-champion"] .journal-ribbon-progress',
        ),
      ).toHaveText("4/13");
      await expect(card.locator(".journal-ribbons-footer")).toHaveText(
        "Earn Merit Ribbons across Cloverhollow's stories, wilds, and arcades!",
      );

      const desktopCheck = await page.evaluate(() => {
        const bookEl = document.querySelector<HTMLElement>(".journal-book");
        const cardEl = document.querySelector<HTMLElement>(".journal-ribbons-card");
        const closeEl = document.querySelector<HTMLElement>(".journal-ribbons-close");
        const svgs = [...document.querySelectorAll(".journal-ribbons-overlay svg")];
        const tiles = [...document.querySelectorAll<HTMLElement>(".journal-ribbon-tile")];
        if (bookEl === null || cardEl === null || closeEl === null) return null;
        const bookRect = bookEl.getBoundingClientRect();
        const cardRect = cardEl.getBoundingClientRect();
        const closeRect = closeEl.getBoundingClientRect();
        return {
          svgCount: svgs.length,
          svgTextNodes: svgs.reduce((sum, node) => sum + node.querySelectorAll("text").length, 0),
          insideBook:
            cardRect.left >= bookRect.left - 1 &&
            cardRect.right <= bookRect.right + 1 &&
            cardRect.top >= bookRect.top - 1 &&
            cardRect.bottom <= bookRect.bottom + 1,
          noHorizontalOverflow: cardEl.scrollWidth <= cardEl.clientWidth + 1,
          noVerticalOverflow: cardEl.scrollHeight <= cardEl.clientHeight + 1,
          closeSize: Math.round(Math.min(closeRect.width, closeRect.height)),
          allTilesInside: tiles.every((tile) => {
            const rect = tile.getBoundingClientRect();
            return (
              rect.left >= cardRect.left - 1 &&
              rect.right <= cardRect.right + 1 &&
              rect.top >= cardRect.top - 1 &&
              rect.bottom <= cardRect.bottom + 1
            );
          }),
        };
      });
      expect(desktopCheck).toEqual({
        svgCount: 13,
        svgTextNodes: 0,
        insideBook: true,
        noHorizontalOverflow: true,
        noVerticalOverflow: true,
        closeSize: 44,
        allTilesInside: true,
      });

      await captureReview(page, testInfo, "m176-merit-ribbons-1280");

      // Escape closes ONLY the ribbons overlay and restores focus to .journal-ribbons-banner.
      await page.keyboard.press("Escape");
      await step(page, 1);
      await expect(overlay).toBeHidden();
      await expect(book).toBeVisible();
      await expect(banner).toBeFocused();

      // Re-open with Enter and dismiss with X key without closing Journal.
      await page.keyboard.press("Enter");
      await step(page, 1);
      await expect(overlay).toBeVisible();
      await tapKey(page, "x");
      await expect(overlay).toBeHidden();
      await expect(book).toBeVisible();
      await expect(banner).toBeFocused();

      // Close Journal before upgrading state to 12/12 Valley Legend.
      await tapKey(page, "j");
      await expect(book).toBeHidden();

      // 2. Complete 12/12 Valley Legend on 874x402 phone viewport via MAP -> Treasures -> Ribbons.
      await runQaCommands(page, [
        "stickers all",
        "prizes all",
        "fish all",
        "gems all",
        "keepsakes on",
      ]);

      await page.setViewportSize({ width: 874, height: 402 });
      await step(page, 1);
      await tapKey(page, "j");
      await expect(book).toBeVisible();

      await page.keyboard.press("ArrowRight");
      await expect(book).toHaveAttribute("data-journal-page", "map");

      const treasuresBtn = page.locator(".journal-treasures-btn");
      await expect(treasuresBtn).toBeVisible();
      await treasuresBtn.click();
      await expect(page.locator(".journal-treasures-card")).toBeVisible();

      const ribbonsBtn = page.locator(".journal-ribbons-btn");
      await expect(ribbonsBtn).toBeVisible();
      await expect(ribbonsBtn).toHaveText("★ Ribbons · 12/12");
      await expect(ribbonsBtn).toHaveClass(/is-complete/);

      await ribbonsBtn.click();
      await expect(overlay).toBeVisible();
      await expect(card).toBeFocused();
      await settleAnimations(page);

      await expect(card.locator(".journal-ribbons-count")).toHaveText("★ 12/12 VALLEY LEGEND!");
      await expect(card.locator(".journal-ribbons-count")).toHaveClass(/is-complete/);
      await expect(card.locator(".journal-ribbon-tile.is-earned")).toHaveCount(12);
      await expect(card.locator(".journal-ribbon-tile.is-locked")).toHaveCount(0);
      await expect(card.locator(".journal-ribbons-footer")).toHaveText(
        "★ All 12 Valley Merit Ribbons Stitched — True Cloverhollow Legend!",
      );

      const phoneCheck = await page.evaluate(() => {
        const bookEl = document.querySelector<HTMLElement>(".journal-book");
        const cardEl = document.querySelector<HTMLElement>(".journal-ribbons-card");
        const tiles = [...document.querySelectorAll<HTMLElement>(".journal-ribbon-tile")];
        if (bookEl === null || cardEl === null) return null;
        const bookRect = bookEl.getBoundingClientRect();
        const cardRect = cardEl.getBoundingClientRect();
        return {
          insideBook:
            cardRect.left >= bookRect.left - 1 &&
            cardRect.right <= bookRect.right + 1 &&
            cardRect.top >= bookRect.top - 1 &&
            cardRect.bottom <= bookRect.bottom + 1,
          noHorizontalOverflow: cardEl.scrollWidth <= cardEl.clientWidth + 1,
          allTilesInsideX: tiles.every((tile) => {
            const rect = tile.getBoundingClientRect();
            return rect.left >= cardRect.left - 1 && rect.right <= cardRect.right + 1;
          }),
        };
      });
      expect(phoneCheck).toEqual({
        insideBook: true,
        noHorizontalOverflow: true,
        allTilesInsideX: true,
      });

      await captureReview(page, testInfo, "m176-merit-ribbons-874");

      // Closing returns smoothly to Field Treasures with focus restored to .journal-ribbons-btn.
      await card.locator(".journal-ribbons-close").click();
      await expect(overlay).toBeHidden();
      await expect(page.locator(".journal-treasures-card")).toBeVisible();
      await expect(ribbonsBtn).toBeFocused();

      // Second Escape closes Field Treasures, leaving Journal open on MAP.
      await page.keyboard.press("Escape");
      await step(page, 1);
      await expect(page.locator(".journal-treasures-card")).toBeHidden();
      await expect(book).toBeVisible();
      await expect(book).toHaveAttribute("data-journal-page", "map");

      await page.evaluate(() => {
        localStorage.removeItem("CapacitorStorage.cloverhollow-records");
        window.__cloverhollow?.save.clear();
      });
      expect(errors).toEqual([]);
    },
  );
});
