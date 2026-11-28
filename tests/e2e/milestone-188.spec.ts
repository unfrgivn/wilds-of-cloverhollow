import { expect, test, type Page } from "@playwright/test";
import {
  longFlowTimeout,
  openHarness,
  playBattleCheck,
  readBattle,
  readState,
  renderInfo,
  resetPaused,
  step,
  walk,
} from "./helpers";

async function tapKey(page: Page, key: string): Promise<void> {
  await page.keyboard.down(key);
  await step(page, 1);
  await page.keyboard.up(key);
  await step(page, 2);
}

async function unlockAudio(page: Page): Promise<void> {
  await tapKey(page, "ArrowRight");
  await expect
    .poll(() => page.evaluate(() => window.__cloverhollow?.sound.state()))
    .toBe("running");
}

async function recordedEffects(page: Page): Promise<string[]> {
  return page.evaluate(() => [...(window.__cloverhollow?.sound.effects() ?? [])]);
}

async function runFromBattleIfNeeded(page: Page): Promise<void> {
  for (let guard = 0; guard < 50; guard += 1) {
    const battle = await readBattle(page);
    if (battle === null) return;
    if (battle.phase === "check" && battle.check !== null) {
      await playBattleCheck(page);
    } else if (battle.phase === "command" && battle.revealed >= battle.message.length) {
      await tapKey(page, "ArrowUp");
      await tapKey(page, "z");
    } else {
      await tapKey(page, "z");
    }
  }
}

async function walkSafe(page: Page, axis: "x" | "y", target: number): Promise<void> {
  for (let tries = 0; tries < 6; tries += 1) {
    await walk(page, axis, target);
    const battle = await readBattle(page);
    if (battle !== null) {
      await runFromBattleIfNeeded(page);
      continue;
    }
    const pos = (await readState(page)).player;
    if (Math.abs(pos[axis] - target) <= 18) return;
  }
}

test.describe("Milestone 188: Track E16 Overworld Micro-Delights", () => {
  test.setTimeout(longFlowTimeout);

  test(
    "Bubblegum Bay beach ball kicks with boop foley and captures review screenshot",
    { tag: "@smoke" },
    async ({ page }, testInfo) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      await page.setViewportSize({ width: 1280, height: 720 });
      await openHarness(page);
      await resetPaused(page, "bay");
      await unlockAudio(page);

      const before = await renderInfo(page);
      expect(before.microDelights.beachBall).toEqual({ x: 1465, y: 946, z: 0, kicks: 0 });

      // Walk across Bubblegum Bay to the sunlit SE sand just west of the beach ball.
      await walkSafe(page, "y", 910);
      await walkSafe(page, "x", 1415);
      await walkSafe(page, "y", 946);
      await step(page, 2);
      expect(await readBattle(page)).toBeNull();

      const beforeEffects = (await recordedEffects(page)).length;
      // Kick right into the beach ball with real ArrowRight key!
      await page.keyboard.down("ArrowRight");
      await step(page, 14);
      await page.keyboard.up("ArrowRight");
      await step(page, 4);

      const afterKick = await renderInfo(page);
      expect(afterKick.microDelights.beachBall?.kicks ?? 0).toBeGreaterThanOrEqual(1);
      expect(afterKick.microDelights.beachBall?.x ?? 0).toBeGreaterThan(1470);
      expect((await recordedEffects(page)).slice(beforeEffects)).toContain("beach-ball-boop");

      if (process.env.CLOVERHOLLOW_REVIEW_SHOTS === "1" && testInfo.project.name === "chromium") {
        await page.screenshot({
          path: "art/review/m188-beach-ball-bay.jpg",
          type: "jpeg",
          quality: 90,
        });
      }

      expect(errors).toEqual([]);
    },
  );

  test(
    "Meadow Park pond pebble skipping and scenic bench camera pullback + warm party chatter",
    { tag: "@smoke" },
    async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      await page.setViewportSize({ width: 1280, height: 720 });
      await openHarness(page);
      await resetPaused(page, "park");
      await unlockAudio(page);

      // 1. Walk to Meadow Park's west pond shore (765, 785) and press Z to skip a pebble.
      await walkSafe(page, "x", 765);
      await walkSafe(page, "y", 785);
      await step(page, 2);

      const beforeSkip = (await recordedEffects(page)).length;
      await tapKey(page, "z");
      await step(page, 4);

      const skipInfo = await renderInfo(page);
      expect(skipInfo.microDelights.activeSkips).toBeGreaterThanOrEqual(1);
      expect((await recordedEffects(page)).slice(beforeSkip)).toContain("pebble-skip");

      // 2. Walk to park-bench (740, 480) from the west, face right away from tree-house & Maddie.
      await walkSafe(page, "x", 660);
      await walkSafe(page, "y", 482);
      await walkSafe(page, "x", 740);
      await tapKey(page, "ArrowRight");
      await tapKey(page, "z");
      await step(page, 52);

      const benchInfo = await renderInfo(page);
      expect(benchInfo.resting).toBe("park-bench");
      expect(benchInfo.microDelights.scenicZoom).toBeLessThan(0.96);

      const chatter = page.locator(".npc-chatter");
      await expect(chatter).toBeVisible();
      const chatterText = (await chatter.innerText()).toLowerCase();
      expect(chatterText.length).toBeGreaterThan(8);
      expect(chatterText).not.toContain("milo");

      expect(errors).toEqual([]);
    },
  );

  test(
    "live shop entry into Bon Appetit Cafe rings shop-bell and Sanctuary critters do pet hops",
    { tag: "@smoke" },
    async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      await page.setViewportSize({ width: 1280, height: 720 });
      await openHarness(page);
      await resetPaused(page, "plaza");
      await unlockAudio(page);

      // 1. Walk up right below Bon Appetit Cafe's doorway, then cross live so shop-bell rings.
      await walk(page, "y", 435);
      await walk(page, "x", 1068);
      await step(page, 2);

      const beforeBell = (await recordedEffects(page)).length;
      await page.evaluate(() => window.__cloverhollow?.resume());
      await page.keyboard.down("ArrowUp");
      await expect
        .poll(async () => (await readState(page)).area, { timeout: 6000 })
        .toBe("cafe");
      await page.keyboard.up("ArrowUp");
      await page.evaluate(() => window.__cloverhollow?.pause());
      await step(page, 2);

      expect((await recordedEffects(page)).slice(beforeBell)).toContain("shop-bell");

      // 2. Sanctuary calm critter hop: walk up to calm sanctuary-frog, pet through dialogue close.
      await resetPaused(page, "sanctuary");
      await unlockAudio(page);

      await walk(page, "y", 495);
      await walk(page, "x", 365);
      await tapKey(page, "ArrowUp");
      await step(page, 2);

      const beforeHop = (await recordedEffects(page)).length;
      for (let guard = 0; guard < 12; guard += 1) {
        await tapKey(page, "z");
        const state = await readState(page);
        const info = await renderInfo(page);
        if (state.dialogue === null && info.microDelights.activeHopNpc !== null) break;
      }

      const hopInfo = await renderInfo(page);
      expect(hopInfo.microDelights.activeHopNpc).toBe("sanctuary-frog");
      expect((await recordedEffects(page)).slice(beforeHop)).toContain("sanctuary-hop");

      expect(errors).toEqual([]);
    },
  );
});
