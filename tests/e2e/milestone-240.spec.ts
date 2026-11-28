import { mkdirSync } from "node:fs";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { longFlowTimeout, openHarness, renderInfo, resetPaused, step } from "./helpers";

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

async function seedFullClubhouse(page: Page): Promise<void> {
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
        "clubhouse_claimed", "cavern_chime_rung", "spice_returned", "gem_reward_all",
        "sanctuary_reward_14", "sue_compass", "jordan_clover", "buster_reward",
        "milo_loft_visited", "rosie_cottage_visited", "summit_aurora_read",
        "island_shells_solved", "festival_toast_done", "milo_revealed",
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

async function openPostcardAlbum(page: Page): Promise<void> {
  await tapKey(page, "j");
  await expect(page.locator(".journal-book")).toBeVisible();
  await page.locator(".journal-map-tab").click();
  await expect(page.locator(".journal-book")).toHaveAttribute("data-journal-page", "map");
  await page.locator(".journal-treasures-btn").click();
  await expect(page.locator(".journal-treasures-card")).toBeVisible();
  await page.locator(".journal-postcards-btn").click();
  await expect(page.locator(".journal-postcards-card")).toBeVisible();
}

test.describe("Milestone 237: Pinned Wall Memory Postcards in Bedroom & Clubhouse", () => {
  test.setTimeout(longFlowTimeout);

  test(
    "pins a Bubblegum Bay postcard onto Bedroom & Clubhouse walls and unpins cleanly",
    { tag: "@smoke" },
    async ({ page }, testInfo) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      await page.setViewportSize({ width: 1280, height: 720 });
      await openHarness(page);
      await page.evaluate(() => {
        localStorage.removeItem("cloverhollow-postcards");
        localStorage.removeItem("cloverhollow-pinned-postcard");
      });

      // 1. Snap a Bubblegum Bay postcard in Photo Mode.
      await resetPaused(page, "bay");
      await step(page, 2);
      await page.keyboard.press("p");
      await step(page, 1);
      await expect(page.locator("html")).toHaveAttribute("data-photo", "on");

      await page.keyboard.press("Space");
      await expect(page.locator(".photo-shutter-flash")).toHaveAttribute("data-shutter-count", "1");
      await expect(page.locator(".photo-toast")).toContainText("Postcard saved · Bubblegum Bay");
      await page.keyboard.press("Escape");
      await step(page, 1);
      await expect(page.locator("html")).toHaveAttribute("data-photo", "off");

      // Unlock keepsakes so Field Treasures opens cleanly on MAP.
      await runQaCommands(page, ["keepsakes on"]);

      // 2. Open Postcard Album -> Lightbox -> Pin to Room!
      await openPostcardAlbum(page);
      const albumCard = page.locator(".journal-postcards-card");
      await expect(page.locator(".journal-postcards-btn")).toHaveText("📷 Photos · 1");
      const tile = albumCard.locator(".journal-postcard-tile").first();
      await expect(tile.locator(".journal-postcard-pinned-tag")).toHaveCount(0);
      await tile.click();

      const pinBtn = albumCard.locator(".journal-postcard-pin-btn");
      await expect(pinBtn).toBeVisible();
      await expect(pinBtn).toHaveAttribute("aria-pressed", "false");
      await expect(pinBtn).toHaveText("☆ Pin to Room");

      await pinBtn.click();
      await expect(pinBtn).toHaveAttribute("aria-pressed", "true");
      await expect(pinBtn).toHaveText("★ Pinned in Room");

      // Back to Album grid shows the golden "★ In Room" badge on the pinned tile.
      await albumCard.locator(".journal-lightbox-back").click();
      await expect(albumCard).toHaveAttribute("data-album-mode", "grid");
      await expect(
        albumCard.locator(".journal-postcard-tile.is-pinned .journal-postcard-pinned-tag"),
      ).toHaveText("★ In Room");

      // Close Postcard Album -> Treasures -> Journal.
      await page.keyboard.press("Escape");
      await step(page, 1);
      await page.keyboard.press("Escape");
      await step(page, 1);
      await tapKey(page, "j");
      await expect(page.locator(".journal-book")).toBeHidden();

      // 3. Visit Fae's Bedroom and verify the framed wall postcard loads & renders cleanly.
      await resetPaused(page, "new-game");
      await expect
        .poll(async () => (await renderInfo(page)).pinnedPostcard, { timeout: 5000 })
        .toMatchObject({
          area: "bedroom",
          ready: true,
          caption: "Bubblegum Bay · Wilds of Cloverhollow",
        });
      await step(page, 2);
      const bedInfo = await renderInfo(page);
      expect(
        bedInfo.drawOrder.some((item) => item.label === "clubhouse:pinned-postcard"),
      ).toBe(true);
      await captureReview(page, testInfo, "m237-bedroom-pinned-postcard-1280");

      // 4. Visit the Living Clubhouse with all 26 items + 9/9 Dream Encore Star Trophy!
      await resetPaused(page, "clubhouse");
      const trophyResponse = page.waitForResponse(
        (res) => res.url().includes("star-trophy.webp") && res.status() === 200,
      );
      await seedFullClubhouse(page);
      await trophyResponse;
      await expect
        .poll(async () => (await renderInfo(page)).pinnedPostcard, { timeout: 5000 })
        .toMatchObject({
          area: "clubhouse",
          ready: true,
          caption: "Bubblegum Bay · Wilds of Cloverhollow",
        });
      await step(page, 3);
      const clubInfo = await renderInfo(page);
      expect(clubInfo.clubhouseDisplay).toBe(27);
      expect(
        clubInfo.drawOrder.some((item) => item.label === "clubhouse:pinned-postcard"),
      ).toBe(true);
      await captureReview(page, testInfo, "m237-clubhouse-pinned-postcard-1280");

      // 5. Unpin from Album and verify renderInfo().pinnedPostcard returns null immediately!
      await openPostcardAlbum(page);
      await albumCard.locator(".journal-postcard-tile").first().click();
      await expect(pinBtn).toHaveAttribute("aria-pressed", "true");
      await pinBtn.click();
      await expect(pinBtn).toHaveAttribute("aria-pressed", "false");
      await expect(pinBtn).toHaveText("☆ Pin to Room");

      await step(page, 1);
      expect((await renderInfo(page)).pinnedPostcard).toBeNull();

      await page.evaluate(() => {
        localStorage.removeItem("cloverhollow-postcards");
        localStorage.removeItem("cloverhollow-pinned-postcard");
        return window.__cloverhollow?.save.clear();
      });
      expect(errors).toEqual([]);
    },
  );
});
