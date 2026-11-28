import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { longFlowTimeout, openHarness, resetPaused, step } from "./helpers";

async function tapKey(page: Page, key: string): Promise<void> {
  await page.keyboard.down(key);
  await step(page, 1);
  await page.keyboard.up(key);
  await step(page, 2);
}

async function settleAnimations(page: Page, selector: string): Promise<void> {
  await page.evaluate(async (sel) => {
    const root = document.querySelector(sel);
    if (root === null) return;
    await Promise.all(
      root
        .getAnimations({ subtree: true })
        .filter((anim) => anim.effect?.getTiming().iterations !== Number.POSITIVE_INFINITY)
        .map((anim) => anim.finished.catch(() => undefined)),
    );
  }, selector);
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
  coins?: number;
  stickers?: string[];
  prizes?: string[];
  caughtFish?: Record<string, number>;
  partyIds?: string[];
  inkVars?: Record<string, boolean>;
  encoreTrophies?: string[];
  decorSwatch?: string;
  clearDecor?: boolean;
  puzzles?: Record<string, boolean>;
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
    if (next.coins !== undefined) st.coins = next.coins;
    if (next.stickers !== undefined) st.stickers = next.stickers;
    if (next.prizes !== undefined) st.prizes = next.prizes;
    if (next.caughtFish !== undefined) st.caughtFish = next.caughtFish;
    if (next.encoreTrophies !== undefined) {
      st.encore = { bosses: {}, trophies: next.encoreTrophies };
    }
    if (next.clearDecor === true) {
      delete st.decor;
    } else if (next.decorSwatch !== undefined) {
      st.decor = { swatch: next.decorSwatch, unlockedSwatches: [next.decorSwatch] };
    }
    if (next.puzzles !== undefined) st.puzzles = next.puzzles;
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

test.describe("Milestone 200: Grand 16-Ribbon Tapestry & Live Stitched Toast", () => {
  test.setTimeout(longFlowTimeout);

  test(
    "renders 8/16 mid-journey 4x4 tapestry on desktop and 16/16 Valley Legend on 874x402 phone",
    { tag: "@smoke" },
    async ({ page }, testInfo) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      await page.setViewportSize({ width: 1280, height: 720 });
      await openHarness(page);

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

      // 1. Mid-journey 8/16 (cozy-decorator & puzzle-solver earned;
      //    heart-collector 3/6 & encore-star 0/1 locked)
      await applyJourneyPatch(page, {
        stickers: ["fountain-frog", "pond-pup", "ribbon-bunny"],
        prizes: ["frog-plush", "pup-plush", "raccoon-plush", "cat-plush"],
        caughtFish: { minnow: 2, perch: 1 },
        partyIds: ["maddie", "sue", "jordan"],
        decorSwatch: "sunlit-meadow",
        puzzles: { "cavern-prism": true },
        inkVars: {
          buster_reward: true,
          summit_aurora_read: true,
          sanctuary_reward_14: true,
          gem_park: true,
          gem_bay: true,
          gem_pass: true,
          h2h_fae_maddie_done: true,
          h2h_fae_sue_done: true,
          h2h_fae_jordan_done: true,
        },
      });

      await tapKey(page, "j");
      const book = page.locator(".journal-book");
      await expect(book).toBeVisible();

      const banner = page.locator(".journal-ribbons-banner");
      await banner.scrollIntoViewIfNeeded();
      await expect(banner).toBeVisible();
      await expect(banner).toContainText("★ Valley Merit Ribbons · 8/16");

      await banner.click();
      const overlay = page.locator(".journal-ribbons-overlay");
      const card = page.locator(".journal-ribbons-card");
      await expect(overlay).toBeVisible();
      await settleAnimations(page, ".journal-ribbons-overlay");

      await expect(card.locator(".journal-ribbons-count")).toHaveText("8/16");
      await expect(card.locator(".journal-ribbon-tile.is-earned")).toHaveCount(8);
      await expect(card.locator(".journal-ribbon-tile.is-locked")).toHaveCount(8);
      await expect(
        card.locator('.journal-ribbon-tile[data-ribbon="cozy-decorator"]'),
      ).toHaveClass(/is-earned/);
      await expect(
        card.locator('.journal-ribbon-tile[data-ribbon="puzzle-solver"]'),
      ).toHaveClass(/is-earned/);
      await expect(
        card.locator(
          '.journal-ribbon-tile[data-ribbon="heart-collector"] .journal-ribbon-progress',
        ),
      ).toHaveText("3/6");
      await expect(
        card.locator('.journal-ribbon-tile[data-ribbon="encore-star"] .journal-ribbon-progress'),
      ).toHaveText("0/1");

      const desktopMetrics = await page.evaluate(() => {
        const cardEl = document.querySelector<HTMLElement>(".journal-ribbons-card");
        const tiles = [...document.querySelectorAll<HTMLElement>(".journal-ribbon-tile")];
        const svgs = [...document.querySelectorAll(".journal-ribbons-overlay svg")];
        if (cardEl === null || tiles.length !== 16) return null;
        const cardRect = cardEl.getBoundingClientRect();
        const cols = new Set(tiles.map((t) => Math.round(t.getBoundingClientRect().left / 10)));
        const rows = new Set(tiles.map((t) => Math.round(t.getBoundingClientRect().top / 10)));
        return {
          cols: cols.size,
          rows: rows.size,
          svgCount: svgs.length,
          svgTextNodes: svgs.reduce((sum, node) => sum + node.querySelectorAll("text").length, 0),
          noHorizontalOverflow: cardEl.scrollWidth <= cardEl.clientWidth + 1,
          noVerticalOverflow: cardEl.scrollHeight <= cardEl.clientHeight + 1,
          allTilesInside: tiles.every((tile) => {
            const rect = tile.getBoundingClientRect();
            return (
              rect.left >= cardRect.left - 1 &&
              rect.right <= cardRect.right + 1 &&
              rect.top >= cardRect.top - 1 &&
              rect.bottom <= cardRect.bottom + 1
            );
          }),
          lastRibbonId: tiles[15]?.dataset.ribbon ?? "",
        };
      });
      expect(desktopMetrics).toEqual({
        cols: 4,
        rows: 4,
        svgCount: 17,
        svgTextNodes: 0,
        noHorizontalOverflow: true,
        noVerticalOverflow: true,
        allTilesInside: true,
        lastRibbonId: "valley-legend",
      });

      await captureReview(page, testInfo, "m200-grand-ribbons-1280");

      await page.keyboard.press("Escape");
      await step(page, 1);
      await expect(overlay).toBeHidden();
      await tapKey(page, "j");
      await expect(book).toBeHidden();

      // 2. Complete 16/16 Grand Tapestry on 874x402 phone viewport
      await applyJourneyPatch(page, {
        inkVars: {
          h2h_fae_maddie_done: true,
          h2h_fae_sue_done: true,
          h2h_fae_jordan_done: true,
          h2h_sue_jordan_done: true,
          h2h_clubhouse_trio_done: true,
          h2h_sanctuary_encore_done: true,
        },
        encoreTrophies: ["trophy-gull"],
        decorSwatch: "starlight-cozy",
        puzzles: { "cavern-prism": true },
      });
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

      await page.locator(".journal-treasures-btn").click();
      const ribbonsBtn = page.locator(".journal-ribbons-btn");
      await expect(ribbonsBtn).toHaveText("★ Ribbons · 16/16");
      await ribbonsBtn.click();
      await expect(overlay).toBeVisible();
      await settleAnimations(page, ".journal-ribbons-overlay");

      await expect(card.locator(".journal-ribbons-count")).toHaveText("★ 16/16 VALLEY LEGEND!");
      await expect(card.locator(".journal-ribbon-tile.is-earned")).toHaveCount(16);
      await expect(card.locator(".journal-ribbons-footer")).toHaveText(
        "★ All 16 Valley Merit Ribbons Stitched — True Cloverhollow Legend!",
      );

      const phoneMetrics = await page.evaluate(() => {
        const cardEl = document.querySelector<HTMLElement>(".journal-ribbons-card");
        const tiles = [...document.querySelectorAll<HTMLElement>(".journal-ribbon-tile")];
        if (cardEl === null || tiles.length !== 16) return null;
        const cardRect = cardEl.getBoundingClientRect();
        const cols = new Set(tiles.map((t) => Math.round(t.getBoundingClientRect().left / 10)));
        const rows = new Set(tiles.map((t) => Math.round(t.getBoundingClientRect().top / 10)));
        return {
          cols: cols.size,
          rows: rows.size,
          noHorizontalOverflow: cardEl.scrollWidth <= cardEl.clientWidth + 1,
          allTilesInsideX: tiles.every((tile) => {
            const rect = tile.getBoundingClientRect();
            return rect.left >= cardRect.left - 1 && rect.right <= cardRect.right + 1;
          }),
        };
      });
      expect(phoneMetrics).toEqual({
        cols: 4,
        rows: 4,
        noHorizontalOverflow: true,
        allTilesInsideX: true,
      });

      await captureReview(page, testInfo, "m200-grand-ribbons-874");

      await page.evaluate(() => {
        localStorage.removeItem("CapacitorStorage.cloverhollow-records");
        window.__cloverhollow?.save.clear();
      });
      expect(errors).toEqual([]);
    },
  );

  test(
    "pops stitched Ribbon Earned toast and plays ribbon-earned chime during live real-time play",
    { tag: "@smoke" },
    async ({ page }, testInfo) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      await page.setViewportSize({ width: 1280, height: 720 });
      await openHarness(page);
      await resetPaused(page, "clubhouse");

      // Prepare Clubhouse with coins and no decor so cozy-decorator is still locked.
      await applyJourneyPatch(page, {
        coins: 120,
        clearDecor: true,
        inkVars: { clubhouse_claimed: true },
      });

      const toast = page.locator(".ribbon-toast");
      await expect(toast).toBeHidden();

      // Switch to live real-time ticking and let baseline settle for a few live ticks.
      const startTick = await page.evaluate(() => window.__cloverhollow?.getState().tick ?? 0);
      await page.evaluate(() => window.__cloverhollow?.resume());
      await expect
        .poll(() => page.evaluate(() => window.__cloverhollow?.getState().tick ?? 0))
        .toBeGreaterThanOrEqual(startTick + 4);
      await expect(toast).toBeHidden();

      // Open Clubhouse Decor Picker via real KeyB, buy & equip Sunlit Meadow, then close.
      await page.keyboard.press("KeyB");
      const picker = page.locator('[data-decor-picker="open"]');
      await expect(picker).toBeVisible();
      await picker.locator('[data-swatch-buy-coins="sunlit-meadow"]').click();
      await expect(
        picker.locator('[data-swatch="sunlit-meadow"] [data-swatch-state="equipped"]'),
      ).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(picker).toBeHidden();

      // Live tick observes the newly earned cozy-decorator ribbon and pops the toast + chime!
      await expect(toast).toBeVisible();
      await expect(toast).toHaveAttribute("data-ribbon-id", "cozy-decorator");
      await expect(toast.locator(".ribbon-toast-eyebrow")).toHaveText("RIBBON EARNED");
      await expect(toast.locator(".ribbon-toast-title")).toHaveText("Cozy Home Stylist ★");

      // Pause cleanly once toast is settled so review screenshot is razor sharp.
      await settleAnimations(page, ".ribbon-toast");
      await page.evaluate(() => window.__cloverhollow?.pause());

      const toastMetrics = await page.evaluate(() => {
        const el = document.querySelector<HTMLElement>(".ribbon-toast");
        if (el === null) return null;
        const rect = el.getBoundingClientRect();
        const svgs = [...el.querySelectorAll("svg")];
        const effects = window.__cloverhollow?.sound.effects() ?? [];
        return {
          svgCount: svgs.length,
          svgTextNodes: svgs.reduce((sum, node) => sum + node.querySelectorAll("text").length, 0),
          insideViewport:
            rect.left >= 0 &&
            rect.top >= 0 &&
            rect.right <= window.innerWidth &&
            rect.bottom <= window.innerHeight,
          hasRibbonChime: effects.includes("ribbon-earned"),
        };
      });
      expect(toastMetrics).toEqual({
        svgCount: 1,
        svgTextNodes: 0,
        insideViewport: true,
        hasRibbonChime: true,
      });

      await captureReview(page, testInfo, "m200-ribbon-toast-1280");

      await page.evaluate(() => window.__cloverhollow?.save.clear());
      expect(errors).toEqual([]);
    },
  );
});
