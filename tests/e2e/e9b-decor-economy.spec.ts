import { expect, test, type Page, type TestInfo } from "@playwright/test";
import {
  openHarness,
  readState,
  renderInfo,
  resetPaused,
  step,
} from "./helpers";
import type { State } from "../../src/core";

async function tapKey(page: Page, key: string): Promise<void> {
  await page.keyboard.down(key);
  await step(page, 1);
  await page.keyboard.up(key);
  await step(page, 2);
}

async function holdKey(page: Page, key: string, ticks: number): Promise<void> {
  await page.keyboard.down(key);
  await step(page, ticks);
  await page.keyboard.up(key);
  await step(page, 2);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function patchState(
  page: Page,
  mutate: (state: State) => State,
  inkVars?: Record<string, boolean | number>,
): Promise<State> {
  const current = await readState(page);
  let nextState = mutate(current);
  if (inkVars !== undefined) {
    const inkObj: unknown = JSON.parse(nextState.ink);
    if (isRecord(inkObj) && isRecord(inkObj.variablesState)) {
      const vars: Record<string, unknown> = { ...inkObj.variablesState };
      for (const [key, value] of Object.entries(inkVars)) {
        vars[key] = value;
      }
      nextState = { ...nextState, ink: JSON.stringify({ ...inkObj, variablesState: vars }) };
    }
  }
  const payload = JSON.stringify({ version: 10, state: nextState });
  const imported = await page.evaluate(async (raw) => {
    const hook = window.__cloverhollow;
    if (hook?.save.importBackup === undefined) return false;
    return hook.save.importBackup(raw);
  }, payload);
  expect(imported, "importBackup should accept valid v10 state").toBe(true);
  await step(page, 2);
  return readState(page);
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

test.describe("Track E9B: Keepsake Blessings, Bedroom & Clubhouse Decor, Economy", () => {
  test(
    "decorates Clubhouse with swatches & pedestals, rotates Visiting Friend, and saves v10",
    { tag: "@smoke" },
    async ({ page }, testInfo) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      await page.setViewportSize({ width: 1280, height: 720 });
      await openHarness(page);
      await resetPaused(page, "clubhouse");

      await patchState(
        page,
        (state) => ({
          ...state,
          coins: 220,
          tickets: 95,
          prizes: [
            "frog-plush",
            "cat-plush",
            "pup-plush",
            "bunny-plush",
            "toy-rocket",
            "star-racer-keychain",
          ],
          stickers: ["starry-owl", "taco-chef"],
        }),
        {
          clubhouse_claimed: true,
          fridge_fixed: true,
          garden_planted: true,
          milo_revealed: true,
          rosie_cottage_visited: true,
          barnaby_gift: true,
          sanctuary_visited: true,
          cavern_chime_rung: true,
          spice_returned: true,
          buster_reward: true,
        },
      );

      // Visiting Friend is rendered deterministically in the Clubhouse.
      const beforeInfo = await renderInfo(page);
      expect(beforeInfo.area).toBe("clubhouse");
      expect(beforeInfo.npcs.length).toBe(1);
      const firstVisitorId = beforeInfo.npcs[0]?.id ?? "";
      expect(["sue", "jordan", "milo", "rosie", "barnaby", "fern"]).toContain(firstVisitorId);

      // Press real KeyB to open the Decor Picker.
      await page.keyboard.press("KeyB");
      const picker = page.locator('[data-decor-picker="open"]');
      await expect(picker).toBeVisible();
      await expect(picker.locator('[data-decor-coins="220"]')).toBeVisible();
      await expect(picker.locator('[data-decor-tickets="95"]')).toBeVisible();

      // Buy & equip Starlight Cozy with Coins (55c), then Velvet Pedestals (50c),
      // then Bubblegum Beach with Tickets (50t), then equip Starlight Cozy.
      await picker.locator('[data-swatch-buy-coins="starlight-cozy"]').click();
      await expect(picker.locator('[data-decor-coins="165"]')).toBeVisible();
      await expect(
        picker.locator('[data-swatch="starlight-cozy"] [data-swatch-state="equipped"]'),
      ).toBeVisible();

      await picker.locator("[data-pedestal-buy-coins]").click();
      await expect(picker.locator('[data-decor-coins="115"]')).toBeVisible();
      await expect(picker.locator('[data-pedestal-state="unlocked"]')).toBeVisible();

      await picker.locator('[data-swatch-buy-tickets="bubblegum-beach"]').click();
      await expect(picker.locator('[data-decor-tickets="45"]')).toBeVisible();
      await expect(
        picker.locator('[data-swatch="bubblegum-beach"] [data-swatch-state="equipped"]'),
      ).toBeVisible();

      // Cycle Visiting Friend to the next befriended neighbor.
      const visitorBefore = await picker.locator("[data-active-visitor]").getAttribute(
        "data-active-visitor",
      );
      await picker.locator("[data-cycle-visitor]").click();
      const visitorAfter = await picker.locator("[data-active-visitor]").getAttribute(
        "data-active-visitor",
      );
      expect(visitorAfter).not.toBe(visitorBefore);

      // Capture desktop & phone Decor Picker review shots.
      await captureReview(page, testInfo, "e9b-decor-picker-clubhouse-1280");
      await page.setViewportSize({ width: 874, height: 402 });
      await expect(picker).toBeVisible();
      await captureReview(page, testInfo, "e9b-decor-picker-phone-874");
      await page.setViewportSize({ width: 1280, height: 720 });

      // Close Decor Picker with real Escape key.
      await page.keyboard.press("Escape");
      await expect(picker).toBeHidden();
      await step(page, 4);

      const decoratedState = await readState(page);
      expect(decoratedState.decor?.swatch).toBe("bubblegum-beach");
      expect(decoratedState.decor?.pedestals).toBe(true);
      expect(decoratedState.decor?.unlockedSwatches).toEqual([
        "starlight-cozy",
        "bubblegum-beach",
      ]);

      // Verify decorated Clubhouse room & rotated visiting friend render cleanly.
      const decoratedInfo = await renderInfo(page);
      expect(decoratedInfo.npcs[0]?.id).toBe(visitorAfter);
      await captureReview(page, testInfo, "e9b-clubhouse-decorated-1280");

      // Walk Fae past the ladder, then slightly south to comfortable talking distance
      // (~46u east of visitor), press Z to chat, and reveal the full line for clean capture!
      await holdKey(page, "ArrowLeft", 62);
      await holdKey(page, "ArrowDown", 4);
      await holdKey(page, "ArrowLeft", 4);
      await tapKey(page, "KeyZ");
      await tapKey(page, "KeyZ");
      await page.evaluate(async () => {
        const box = document.querySelector(".sticker-dialogue");
        if (box === null) return;
        await Promise.all(
          box
            .getAnimations({ subtree: true })
            .filter((anim) => anim.effect?.getTiming().iterations !== Number.POSITIVE_INFINITY)
            .map((anim) => anim.finished.catch(() => undefined)),
        );
      });
      const talkState = await readState(page);
      expect(talkState.dialogue?.knot).toBe(`club_visit_${visitorAfter}`);
      expect(talkState.dialogue?.revealed).toBe(talkState.dialogue?.text.length);
      await captureReview(page, testInfo, "e9b-clubhouse-visitor-dialogue-1280");

      // Dismiss dialogue & verify v10 save export/import preserves decor state!
      for (let i = 0; i < 8; i += 1) {
        const cur = await readState(page);
        if (cur.dialogue === null) break;
        await tapKey(page, "KeyZ");
      }
      const exported = await page.evaluate(
        () => window.__cloverhollow?.save.exportBackup?.() ?? null,
      );
      expect(exported).not.toBeNull();
      await resetPaused(page, "new-game");
      const reloaded = await page.evaluate(async (payload) => {
        const hook = window.__cloverhollow;
        if (hook?.save.importBackup === undefined || payload === null) return false;
        return hook.save.importBackup(payload);
      }, exported);
      expect(reloaded).toBe(true);
      await step(page, 2);
      const restored = await readState(page);
      expect(restored.decor?.swatch).toBe("bubblegum-beach");
      expect(restored.decor?.pedestals).toBe(true);
      expect(errors).toEqual([]);
    },
  );

  test(
    "displays arcade plushes on Fae's Bedroom shelf and opens Decor Picker from the shelf",
    async ({ page }, testInfo) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      await page.setViewportSize({ width: 1280, height: 720 });
      await openHarness(page);
      await resetPaused(page, "new-game");

      await patchState(page, (state) => ({
        ...state,
        coins: 120,
        prizes: [
          "frog-plush",
          "cat-plush",
          "pup-plush",
          "toy-rocket",
          "star-racer-keychain",
        ],
        decor: { pedestals: true },
      }));

      const infoBefore = await renderInfo(page);
      expect(infoBefore.area).toBe("bedroom");
      const bedroomLabels = infoBefore.drawOrder
        .filter((entry) => entry.label.startsWith("bedroom:prize:"))
        .map((entry) => entry.label);
      expect(bedroomLabels).toHaveLength(5);
      expect(infoBefore.clubhouseDisplay).toBe(5);
      await captureReview(page, testInfo, "e9b-bedroom-shelf-1280");

      // Walk Fae with real keys right to the Bedroom shelf at (785, 455) and press Z!
      await holdKey(page, "ArrowRight", 62);
      await holdKey(page, "ArrowDown", 10);
      await holdKey(page, "ArrowRight", 6);
      await tapKey(page, "KeyZ");
      await step(page, 30);
      const shelfDlg = await readState(page);
      expect(shelfDlg.dialogue?.knot).toBe("bedroom_shelf");

      // Advance text and choose "Decorate Bedroom Shelf" (choice 0) -> opens Decor Picker!
      for (let i = 0; i < 8; i += 1) {
        if ((await readState(page)).dialogue === null) break;
        await tapKey(page, "KeyZ");
      }
      const picker = page.locator('[data-decor-picker="open"]');
      await expect(picker).toBeVisible();
      await expect(picker.locator('[data-shelf-count="5/5"]')).toBeVisible();

      // Toggle Frog Plush off and verify live count updates to 4/5 and rendered sprites drop to 4.
      await picker.locator('[data-shelf-prize="frog-plush"]').click();
      await expect(picker.locator('[data-shelf-count="4/5"]')).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(picker).toBeHidden();
      await step(page, 2);
      expect((await renderInfo(page)).clubhouseDisplay).toBe(4);
      expect(errors).toEqual([]);
    },
  );

  test(
    "applies Golden Star-Line Whistle speed perk & Bubblegum Bay fish-to-ticket trade-in",
    async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      await page.setViewportSize({ width: 1280, height: 720 });
      await openHarness(page);

      // 1. Compare 20-tick horizontal walk in Plaza without vs with Golden Star-Line Whistle.
      await resetPaused(page, "plaza");
      const baseStart = (await readState(page)).player.x;
      await holdKey(page, "ArrowRight", 20);
      const baseDelta = (await readState(page)).player.x - baseStart;

      await resetPaused(page, "plaza");
      await patchState(page, (state) => state, { buster_reward: true });
      const boostedStart = (await readState(page)).player.x;
      await holdKey(page, "ArrowRight", 20);
      const boostedDelta = (await readState(page)).player.x - boostedStart;

      expect(boostedDelta).toBeGreaterThan(baseDelta * 1.06);
      expect(boostedDelta).toBeLessThan(baseDelta * 1.1);

      // 2. Trade a caught fish at Bubblegum Bay seaside stand for +12 Arcade Tickets
      //    while preserving Catch Book discovery count in state.caughtFish!
      await resetPaused(page, "bay");
      await patchState(page, (state) => ({
        ...state,
        coins: 5,
        tickets: 10,
        caughtFish: { minnow: 1, starfish: 1 },
        player: { x: 785, y: 495 },
        facing: "up",
      }));

      await tapKey(page, "KeyZ");
      await step(page, 30);
      let state = await readState(page);
      expect(state.dialogue?.knot).toBe("bay_souvenirs");
      // Reveal full line so choices are active, then select choice 0 (12 Arcade Tickets).
      if ((state.dialogue?.choices.length ?? 0) === 0) {
        await tapKey(page, "KeyZ");
        state = await readState(page);
      }
      expect(state.dialogue?.choices.some((c) => c.includes("12 Arcade Tickets"))).toBe(true);
      await tapKey(page, "KeyZ");
      await tapKey(page, "KeyZ");
      await tapKey(page, "KeyZ");

      const afterTrade = await readState(page);
      expect(afterTrade.tickets).toBe(22);
      expect(afterTrade.caughtFish).toEqual({ minnow: 1, starfish: 1 });
      expect(afterTrade.decor?.fishTraded).toBe(1);
      expect(errors).toEqual([]);
    },
  );
});
