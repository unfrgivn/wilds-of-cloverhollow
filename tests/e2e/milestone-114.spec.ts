import { expect, test, type Page } from "@playwright/test";
import {
  longFlowTimeout,
  openHarness,
  playWithKeys,
  recording,
  resetPaused,
} from "./helpers";

test.describe.configure({ timeout: longFlowTimeout });

async function readMinigameRecords(
  page: Page,
): Promise<{ skee: number; mole: number; comet: number; fish: number; cook: number }> {
  const records = await page.evaluate(() =>
    window.__cloverhollow?.settings.minigameRecords() ?? null,
  );
  if (records === null) throw new Error("hook unavailable");
  return records;
}

async function boxesClear(page: Page, selectorA: string, selectorB: string): Promise<boolean> {
  return page.evaluate(
    ([a, b]) => {
      const nodeA = document.querySelector<HTMLElement>(a);
      const nodeB = document.querySelector<HTMLElement>(b);
      if (nodeA === null || nodeB === null) return true;
      const boxA = nodeA.getBoundingClientRect();
      const boxB = nodeB.getBoundingClientRect();
      if (boxA.width === 0 || boxB.width === 0) return true;
      return (
        boxA.right <= boxB.left ||
        boxA.left >= boxB.right ||
        boxA.bottom <= boxB.top ||
        boxA.top >= boxB.bottom
      );
    },
    [selectorA, selectorB] as const,
  );
}

test(
  "Boop-a-Mole spawns live BOOP! +2 popups and persists NEW BEST across reload @smoke",
  async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await page.setViewportSize({ width: 1280, height: 720 });
    await openHarness(page);
    await resetPaused(page, "arcade");

    let checkedIdle = false;
    let sawPopup = false;
    let sawBestBadge = false;

    await playWithKeys(page, recording("tests/sim/scripts/arcade/mole.json"), 10, async () => {
      const snap = await page.evaluate(() => {
        const game = window.__cloverhollow?.getState().arcade;
        if (game?.game !== "mole") return null;
        return {
          phase: game.phase,
          stage: game.stage,
          booped: game.booped,
          typed: game.phase === "result" && game.revealed >= game.message.length,
        };
      });
      if (snap === null) return;

      if (!checkedIdle && snap.phase === "playing" && snap.stage === "up" && snap.booped === 0) {
        checkedIdle = true;
        await expect(page.locator(".mole-overlay .arcade-popup")).toHaveCount(0);
        await expect(page.locator(".mole-overlay .arcade-best-badge")).toBeHidden();
      }

      if (!sawPopup && snap.stage === "booped" && snap.booped === 1) {
        sawPopup = true;
        const popup = page.locator(".mole-overlay .arcade-popup").first();
        await expect(popup).toBeVisible();
        const details = await popup.evaluate((node) => ({
          text: node.textContent ?? "",
          kind: node.getAttribute("data-popup-kind") ?? "",
          color: getComputedStyle(node).color,
        }));
        expect(details).toEqual({
          text: "BOOP! +2",
          kind: "boop",
          color: "rgb(71, 50, 31)",
        });
        expect(await boxesClear(page, ".mole-overlay .arcade-popup", ".mole-plate")).toBe(true);
        expect(await boxesClear(page, ".mole-overlay .arcade-popup", ".mole-hud")).toBe(true);

        if (process.env.CLOVERHOLLOW_REVIEW_SHOTS === "1" && testInfo.project.name === "chromium") {
          await page.screenshot({
            path: "art/review/m112-mole-popup-1280.jpg",
            type: "jpeg",
            quality: 90,
          });
        }
      }

      if (!sawBestBadge && snap.typed) {
        sawBestBadge = true;
        const badge = page.locator(".mole-overlay .arcade-best-badge");
        await expect(badge).toBeVisible();
        await expect(badge).toHaveText("★ NEW BEST! 14");
        await expect(badge).toHaveClass(/is-new-best/);
        expect(await boxesClear(page, ".mole-overlay .arcade-best-badge", ".mole-plate")).toBe(
          true,
        );
        expect(
          await boxesClear(page, ".mole-overlay .arcade-best-badge", ".sticker-dialogue"),
        ).toBe(true);
      }
    });

    expect({ checkedIdle, sawPopup, sawBestBadge }).toEqual({
      checkedIdle: true,
      sawPopup: true,
      sawBestBadge: true,
    });
    expect(await readMinigameRecords(page)).toEqual({
      skee: 0,
      mole: 14,
      comet: 0,
      fish: 0,
      cook: 0,
      taco: 0,
    });

    // Reload the page and verify Personal Best persists via Capacitor Preferences.
    await page.reload();
    await page.waitForFunction(() => Boolean(window.__cloverhollow));
    await expect.poll(() => readMinigameRecords(page)).toEqual({
      skee: 0,
      mole: 14,
      comet: 0,
      fish: 0,
      cook: 0,
      taco: 0,
    });
    expect(errors).toEqual([]);
  },
);

test(
  "Skee-Ball spawns +100 rare popup, displays NEW BEST! 220 badge, and persists @smoke",
  async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await page.setViewportSize({ width: 1280, height: 720 });
    await openHarness(page);
    await resetPaused(page, "arcade");

    let sawCornerPopup = false;
    let sawBestBadge = false;

    await playWithKeys(page, recording("tests/sim/scripts/arcade/skee.json"), 10, async () => {
      const snap = await page.evaluate(() => {
        const game = window.__cloverhollow?.getState().arcade;
        if (game?.game !== "skee") return null;
        return {
          phase: game.phase,
          lastPoints: game.throws.at(-1)?.points ?? 0,
          typed: game.phase === "result" && game.revealed >= game.message.length,
        };
      });
      if (snap === null) return;

      if (!sawCornerPopup && snap.phase === "scored" && snap.lastPoints === 100) {
        sawCornerPopup = true;
        const popup = page.locator(".skee-overlay .arcade-popup").last();
        await expect(popup).toBeVisible();
        const details = await popup.evaluate((node) => ({
          text: node.textContent ?? "",
          kind: node.getAttribute("data-popup-kind") ?? "",
          color: getComputedStyle(node).color,
        }));
        expect(details).toEqual({
          text: "+100 ★!",
          kind: "rare",
          color: "rgb(71, 50, 31)",
        });
      }

      if (!sawBestBadge && snap.typed) {
        sawBestBadge = true;
        const badge = page.locator(".skee-overlay .arcade-best-badge");
        await expect(badge).toBeVisible();
        await expect(badge).toHaveText("★ NEW BEST! 220");
        await expect(badge).toHaveClass(/is-new-best/);
        expect(await boxesClear(page, ".skee-overlay .arcade-best-badge", ".skee-plate")).toBe(
          true,
        );
        expect(
          await boxesClear(page, ".skee-overlay .arcade-best-badge", ".sticker-dialogue"),
        ).toBe(true);

        if (process.env.CLOVERHOLLOW_REVIEW_SHOTS === "1" && testInfo.project.name === "chromium") {
          await page.screenshot({
            path: "art/review/m112-skee-best-1280.jpg",
            type: "jpeg",
            quality: 90,
            animations: "disabled",
          });
        }
      }
    });

    expect({ sawCornerPopup, sawBestBadge }).toEqual({
      sawCornerPopup: true,
      sawBestBadge: true,
    });
    expect(await readMinigameRecords(page)).toEqual({
      skee: 220,
      mole: 0,
      comet: 0,
      fish: 0,
      cook: 0,
      taco: 0,
    });

    await page.reload();
    await page.waitForFunction(() => Boolean(window.__cloverhollow));
    await expect.poll(() => readMinigameRecords(page)).toEqual({
      skee: 220,
      mole: 0,
      comet: 0,
      fish: 0,
      cook: 0,
      taco: 0,
    });
    expect(errors).toEqual([]);
  },
);
