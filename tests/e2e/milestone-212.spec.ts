import { mkdirSync } from "node:fs";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { openHarness, renderInfo, resetPaused, step } from "./helpers";

const ALL_PRIZES = [
  "frog-plush", "pup-plush", "raccoon-plush", "cat-plush", "bunny-plush",
  "bluebird-plush", "hamster-plush", "squirrel-plush", "owl-plush",
  "pinwheel", "bouncy-ball", "toy-rocket", "star-racer-keychain",
];

const ALL_ENCORE_BOSSES = [
  { id: "gull", trophy: "gull-weathervane" },
  { id: "arcade-keeper", trophy: "pip-star-token" },
  { id: "lifeguard", trophy: "coral-shell-whistle" },
  { id: "lodge-keeper", trophy: "flurry-cocoa-cup" },
  { id: "art-teacher", trophy: "rowan-palette-star" },
  { id: "principal", trophy: "bell-morning-chime" },
  { id: "moon-owl", trophy: "owl-crescent-lantern" },
  { id: "taco-chef", trophy: "mateo-golden-spoon" },
  { id: "hooded-kid", trophy: "ancient-tree-prism" },
] as const;

const ALL_MODIFIERS = ["brisk-breeze", "windup-surge", "pure-heart"];

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
  mkdirSync("art/review", { recursive: true });
  await page.screenshot({
    path: `art/review/${name}.jpg`,
    type: "jpeg",
    quality: 90,
  });
}

async function seedClubhouseEncoreState(page: Page): Promise<void> {
  const backup = await page.evaluate(
    ({ prizes, bosses, mods }) => {
      const isObj = (v: unknown): v is Record<string, unknown> =>
        typeof v === "object" && v !== null && !Array.isArray(v);
      const raw = window.__cloverhollow?.save.exportBackup?.();
      if (raw === undefined) return null;
      const env: unknown = JSON.parse(raw);
      if (!isObj(env) || typeof env.save !== "string") return null;
      const payload: unknown = JSON.parse(env.save);
      if (!isObj(payload) || !isObj(payload.state)) return null;
      const st = payload.state;
      if (typeof st.ink !== "string") return null;
      const inkObj: unknown = JSON.parse(st.ink);
      if (!isObj(inkObj) || !isObj(inkObj.variablesState)) return null;
      for (const flag of [
        "clubhouse_claimed",
        "cavern_chime_rung",
        "spice_returned",
        "gem_reward_all",
        "sanctuary_reward_14",
        "sue_compass",
        "jordan_clover",
        "buster_reward",
        "milo_loft_visited",
        "rosie_cottage_visited",
        "summit_aurora_read",
        "island_shells_solved",
        "festival_toast_done",
        "milo_revealed",
      ]) {
        inkObj.variablesState[flag] = true;
      }
      st.ink = JSON.stringify(inkObj);
      st.prizes = [...prizes];
      st.stickers = ["starry-owl", "taco-chef"];
      const bossMap: Record<string, unknown> = {};
      for (const entry of bosses) {
        bossMap[entry.id] = { clears: 2, bestStars: 3, modifiersCleared: [...mods] };
      }
      st.encore = {
        bosses: bossMap,
        trophies: bosses.map((entry) => entry.trophy).sort(),
      };
      return JSON.stringify(payload);
    },
    { prizes: ALL_PRIZES, bosses: ALL_ENCORE_BOSSES, mods: ALL_MODIFIERS },
  );
  expect(backup).not.toBeNull();
  const imported = await page.evaluate(async (saveJson) => {
    const hook = window.__cloverhollow;
    if (hook?.save.importBackup === undefined || saveJson === null) return false;
    return hook.save.importBackup(saveJson);
  }, backup);
  expect(imported).toBe(true);
  await step(page, 2);
}

async function readEncoreCaseGeometry(page: Page): Promise<{
  insideBook: boolean;
  noHorizontalOverflow: boolean;
  noVerticalScroll: boolean;
  closeSize: number;
  cols: number;
  rows: number;
  tileCount: number;
  svgCount: number;
  svgTextNodes: number;
  allTilesInside: boolean;
} | null> {
  return page.evaluate(() => {
    const book = document.querySelector(".journal-book")?.getBoundingClientRect();
    const card = document.querySelector<HTMLElement>(".journal-encore-card");
    const close = document.querySelector(".journal-encore-close")?.getBoundingClientRect();
    const tiles = [...document.querySelectorAll<HTMLElement>(".journal-encore-tile")];
    const svgs = [...document.querySelectorAll(".journal-encore-overlay svg")];
    if (book === undefined || card === null || close === undefined || tiles.length === 0) {
      return null;
    }
    const rect = card.getBoundingClientRect();
    const cols = new Set(tiles.map((t) => Math.round(t.getBoundingClientRect().left / 12))).size;
    const rows = new Set(tiles.map((t) => Math.round(t.getBoundingClientRect().top / 12))).size;
    return {
      insideBook:
        rect.left >= book.left - 1 &&
        rect.right <= book.right + 1 &&
        rect.top >= book.top - 1 &&
        rect.bottom <= book.bottom + 1,
      noHorizontalOverflow: card.scrollWidth <= card.clientWidth + 1,
      noVerticalScroll: card.scrollHeight <= card.clientHeight + 1,
      closeSize: Math.round(Math.min(close.width, close.height)),
      cols,
      rows,
      tileCount: tiles.length,
      svgCount: svgs.length,
      svgTextNodes: svgs.reduce((sum, node) => sum + node.querySelectorAll("text").length, 0),
      allTilesInside: tiles.every((tile) => {
        const tr = tile.getBoundingClientRect();
        return (
          tr.left >= rect.left - 1 &&
          tr.right <= rect.right + 1 &&
          tr.top >= rect.top - 1 &&
          tr.bottom <= rect.bottom + 1
        );
      }),
    };
  });
}

test.describe("Milestone 211: Clubhouse Star Trophy & Journal Dream Encore Trophy Case", () => {
  test(
    "renders star-trophy in Clubhouse and interactive 9/9 Encore Trophy Case on desktop & phone",
    { tag: "@smoke" },
    async ({ page }, testInfo) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      await page.setViewportSize({ width: 1280, height: 720 });
      await openHarness(page);
      await resetPaused(page, "clubhouse");

      // 0 trophies: no Encore Star Trophy rendered in Clubhouse.
      const beforeInfo = await renderInfo(page);
      expect(
        beforeInfo.drawOrder.some((item) => item.label === "clubhouse:encore:star-trophy"),
      ).toBe(false);

      // Seed all 26 Clubhouse treasures + 9/9 Boss Encore Star Trophies.
      const trophyResponse = page.waitForResponse(
        (res) => res.url().includes("star-trophy.webp") && res.status() === 200,
      );
      await seedClubhouseEncoreState(page);
      await trophyResponse;
      // Step a few frames so Pixi binds the lazily loaded WebP texture and renders cleanly.
      await step(page, 4);

      const clubInfo = await renderInfo(page);
      expect(clubInfo.area).toBe("clubhouse");
      expect(clubInfo.clubhouseDisplay).toBe(27);
      expect(
        clubInfo.drawOrder.filter((item) => item.label.startsWith("clubhouse:prize:")),
      ).toHaveLength(13);
      expect(
        clubInfo.drawOrder.filter((item) => item.label.startsWith("clubhouse:keepsake:")),
      ).toHaveLength(13);
      expect(
        clubInfo.drawOrder.some((item) => item.label === "clubhouse:encore:star-trophy"),
      ).toBe(true);

      // Photo Mode review shot of the Clubhouse with all 26 items + radiant Star Trophy!
      await page.keyboard.press("p");
      await step(page, 2);
      await expect(page.locator("html")).toHaveAttribute("data-photo", "on");
      await captureReview(page, testInfo, "m211-clubhouse-trophy-1280");
      await page.keyboard.press("p");
      await step(page, 1);
      await expect(page.locator("html")).toHaveAttribute("data-photo", "off");

      // Open Journal -> MAP -> Treasures -> ★ Encore · 9/9.
      await tapKey(page, "j");
      const book = page.locator(".journal-book");
      await expect(book).toBeVisible();
      await page.locator(".journal-map-tab").click();
      await expect(book).toHaveAttribute("data-journal-page", "map");
      await page.locator(".journal-treasures-btn").click();
      await expect(page.locator(".journal-treasures-card")).toBeVisible();

      const encoreBtn = page.locator(".journal-encore-btn");
      await expect(encoreBtn).toBeVisible();
      await expect(encoreBtn).toHaveText("★ Encore · 9/9");
      await expect(encoreBtn).toHaveClass(/is-complete/);
      await encoreBtn.click();

      const overlay = page.locator(".journal-encore-overlay");
      const card = page.locator(".journal-encore-card");
      await expect(overlay).toBeVisible();
      await settleAnimations(page, ".journal-encore-overlay");

      await expect(card.locator(".journal-encore-title")).toHaveText("DREAM ENCORE TROPHIES");
      await expect(card.locator(".journal-encore-count")).toHaveText("★ 9/9 ENCORE MASTER!");
      await expect(card.locator(".journal-encore-count")).toHaveClass(/is-complete/);
      await expect(card.locator(".journal-encore-tile.is-won")).toHaveCount(9);
      await expect(card.locator(".journal-encore-tile.is-open")).toHaveCount(0);
      await expect(card.locator(".journal-encore-footer")).toHaveText(
        "★ All 9 Dream Encore Trophies Claimed — Radiant Trophy Gleams in the Clubhouse!",
      );

      expect(await readEncoreCaseGeometry(page)).toEqual({
        insideBook: true,
        noHorizontalOverflow: true,
        noVerticalScroll: true,
        closeSize: 44,
        cols: 3,
        rows: 3,
        tileCount: 9,
        svgCount: 10,
        svgTextNodes: 0,
        allTilesInside: true,
      });

      await captureReview(page, testInfo, "m211-encore-case-1280");

      // 2D keyboard navigation across the 3x3 grid.
      const tile0 = card.locator('.journal-encore-tile[data-encore-boss="gull"]');
      const tile1 = card.locator('.journal-encore-tile[data-encore-boss="arcade-keeper"]');
      const tile4 = card.locator('.journal-encore-tile[data-encore-boss="art-teacher"]');
      const tile8 = card.locator('.journal-encore-tile[data-encore-boss="hooded-kid"]');
      await page.keyboard.press("ArrowRight");
      await expect(tile0).toBeFocused();
      await page.keyboard.press("ArrowRight");
      await expect(tile1).toBeFocused();
      await page.keyboard.press("ArrowDown");
      await expect(tile4).toBeFocused();
      await page.keyboard.press("End");
      await expect(tile8).toBeFocused();
      await page.keyboard.press("Home");
      await expect(tile0).toBeFocused();

      // Switch to 874x402 phone viewport and verify zero clipping/overflow + capture review shot.
      await card.focus();
      await page.setViewportSize({ width: 874, height: 402 });
      await step(page, 2);

      expect(await readEncoreCaseGeometry(page)).toEqual({
        insideBook: true,
        noHorizontalOverflow: true,
        noVerticalScroll: true,
        closeSize: 44,
        cols: 3,
        rows: 3,
        tileCount: 9,
        svgCount: 10,
        svgTextNodes: 0,
        allTilesInside: true,
      });

      await captureReview(page, testInfo, "m211-encore-case-874");

      // Escape closes Dream Encore Trophies, restores Field Treasures, and focuses trigger button.
      await page.keyboard.press("Escape");
      await step(page, 1);
      await expect(overlay).toBeHidden();
      await expect(page.locator(".journal-treasures-card")).toBeVisible();
      await expect(encoreBtn).toBeFocused();

      await page.evaluate(() => window.__cloverhollow?.save.clear());
      expect(errors).toEqual([]);
    },
  );
});
