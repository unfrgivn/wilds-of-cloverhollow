import { expect, test, type Page } from "@playwright/test";
import {
  longFlowTimeout,
  openHarness,
  openMap,
  readBattle,
  readState,
  resetPaused,
  step,
} from "./helpers";

async function hold(page: Page, key: string, ticks: number): Promise<void> {
  await page.keyboard.down(key);
  await step(page, ticks);
  await page.keyboard.up(key);
}

async function enterFrogSootheCheck(page: Page): Promise<{ targetTick: number; tick: number }> {
  for (const [key, ticks] of [
    ["ArrowDown", 25],
    ["ArrowLeft", 15],
    ["ArrowDown", 50],
    ["ArrowLeft", 35],
  ] as const) {
    await hold(page, key, ticks);
  }
  expect(await readBattle(page)).not.toBeNull();
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const battle = await readBattle(page);
    if (battle?.phase === "check" && battle.check?.kind === "ring") {
      return { targetTick: battle.check.spec.targetTick, tick: battle.check.tick };
    }
    await page.keyboard.down("Enter");
    await step(page, 1);
    await page.keyboard.up("Enter");
    await step(page, 1);
  }
  throw new Error("Never reached soothe ring check against fountain-frog");
}

test(
  "journal OPTIONS toggles Gentle Timing and Key Hints and persists across reload",
  { tag: "@smoke" },
  async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await openHarness(page);
    await resetPaused(page, "plaza");

    await page.keyboard.press("j");
    await step(page, 2);
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await expect(page.locator(".journal-book")).toHaveAttribute("data-journal-page", "options");

    const gentle = page.locator(".journal-opt-gentle");
    const hints = page.locator(".journal-opt-hints");
    await expect(gentle).toHaveText("off");
    await expect(hints).toHaveText("off");

    await gentle.click();
    await hints.click();
    await expect(gentle).toHaveText("on");
    await expect(hints).toHaveText("on");
    await expect.poll(() =>
      page.evaluate(() => window.__cloverhollow?.settings.gentleTiming()),
    ).toBe(true);
    await expect.poll(() =>
      page.evaluate(() => window.__cloverhollow?.settings.keyHints()),
    ).toBe(true);

    // Reload and verify Capacitor Preferences persisted both toggles.
    await page.reload();
    await page.waitForFunction(() => Boolean(window.__cloverhollow));
    await expect.poll(() =>
      page.evaluate(() => window.__cloverhollow?.settings.gentleTiming()),
    ).toBe(true);
    await expect.poll(() =>
      page.evaluate(() => window.__cloverhollow?.settings.keyHints()),
    ).toBe(true);

    // Restore defaults cleanly.
    await page.evaluate(() => {
      window.__cloverhollow?.settings.setGentleTiming(false);
      window.__cloverhollow?.settings.setKeyHints(false);
    });
  },
);

test(
  "desktop Key Hints ribbon appears while roaming, hides in overlays, and lights up lantern",
  { tag: "@smoke" },
  async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await openHarness(page);
    await resetPaused(page, "new-game");

    const ribbon = page.locator(".hud-hints");
    await expect(ribbon).toBeHidden();

    // Turn Key Hints on via OPTIONS.
    await page.keyboard.press("j");
    await step(page, 2);
    await page.locator(".journal-options-tab").click();
    await page.locator(".journal-opt-hints").click();
    await page.keyboard.press("Escape");
    await step(page, 2);

    // Visible while roaming in bedroom with J, Z, M (no lantern/flute yet).
    await expect(ribbon).toBeVisible();
    await expect(ribbon.locator('[data-hint="journal"]')).toBeVisible();
    await expect(ribbon.locator('[data-hint="interact"]')).toBeVisible();
    await expect(ribbon.locator('[data-hint="mute"]')).toBeVisible();
    await expect(ribbon.locator('[data-hint="lantern"]')).toBeHidden();
    await expect(ribbon.locator('[data-hint="flute"]')).toBeHidden();

    // Hides during journal.
    await page.keyboard.press("j");
    await step(page, 2);
    await expect(ribbon).toBeHidden();
    await page.keyboard.press("j");
    await step(page, 2);
    await expect(ribbon).toBeVisible();

    // Walk to the bedroom window so Z highlights, capture deterministic desktop screenshot,
    // then open dialogue and verify ribbon hides.
    await hold(page, "ArrowRight", 28);
    await hold(page, "ArrowUp", 18);
    await expect(ribbon.locator('[data-hint="interact"]')).toHaveClass(/is-active/);
    await expect(page).toHaveScreenshot("desktop-key-hints-1280.png");
    await page.keyboard.press("z");
    await step(page, 2);
    expect((await readState(page)).dialogue).not.toBeNull();
    await expect(ribbon).toBeHidden();

    // Load the flute QA pack (has lantern + flute) to check L & F hints and lantern glow.
    await page.goto("./?qa=flute");
    await page.waitForFunction(() => Boolean(window.__cloverhollow));
    await page.evaluate(() => {
      window.__cloverhollow?.pause();
      window.__cloverhollow?.settings.setKeyHints(true);
    });
    await step(page, 2);
    await expect(ribbon).toBeVisible();
    const lanternPill = ribbon.locator('[data-hint="lantern"]');
    const flutePill = ribbon.locator('[data-hint="flute"]');
    await expect(lanternPill).toBeVisible();
    await expect(flutePill).toBeVisible();
    await expect(lanternPill).not.toHaveClass(/is-on/);

    // Press L to light the lantern and capture the lit ribbon screenshot.
    await page.keyboard.down("l");
    await step(page, 1);
    await page.keyboard.up("l");
    await step(page, 1);
    await expect(lanternPill).toHaveClass(/is-on/);
    await expect(ribbon).toHaveScreenshot("desktop-key-hints-ribbon.png");

    // Verify ribbon also hides during a real battle.
    await resetPaused(page, "plaza");
    await expect(ribbon).toBeVisible();
    await enterFrogSootheCheck(page);
    await expect(ribbon).toBeHidden();

    // Reset key hints off so subsequent tests stay clean.
    await page.evaluate(() => window.__cloverhollow?.settings.setKeyHints(false));
  },
);

test(
  "Gentle Timing turns an off-center ring press from miss into good in real battle",
  { tag: "@smoke" },
  async ({ page }) => {
    test.setTimeout(longFlowTimeout);
    await page.setViewportSize({ width: 1280, height: 720 });
    await openHarness(page);

    // 1) Standard timing: press 14 ticks after targetTick -> miss.
    await page.evaluate(() => window.__cloverhollow?.settings.setGentleTiming(false));
    await resetPaused(page, "plaza");
    const normal = await enterFrogSootheCheck(page);
    await step(page, normal.targetTick + 14 - normal.tick - 1);
    await page.keyboard.down("Enter");
    await step(page, 1);
    await page.keyboard.up("Enter");
    const normalBattle = await readBattle(page);
    expect(normalBattle?.lastGrade).toBe("miss");

    // 2) Gentle Timing ON: exact same press 14 ticks after targetTick -> good!
    await page.evaluate(() => window.__cloverhollow?.settings.setGentleTiming(true));
    await resetPaused(page, "plaza");
    const gentle = await enterFrogSootheCheck(page);
    await step(page, gentle.targetTick + 14 - gentle.tick - 1);
    await page.keyboard.down("Enter");
    await step(page, 1);
    await page.keyboard.up("Enter");
    const gentleBattle = await readBattle(page);
    expect(gentleBattle?.lastGrade).toBe("good");

    await page.evaluate(() => window.__cloverhollow?.settings.setGentleTiming(false));
  },
);

test(
  "Journal MAP shows SVG bus routes, footer progress strip, and interactive land details",
  { tag: "@smoke" },
  async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("./?qa=flute");
    await page.waitForFunction(() => Boolean(window.__cloverhollow));
    await page.evaluate(() => window.__cloverhollow?.pause());
    await step(page, 1);
    await openMap(page);

    await expect(page.locator(".journal-book")).toHaveAttribute("data-journal-page", "map");
    const routes = page.locator(".journal-map-route");
    await expect(routes).toHaveCount(3);
    // In the flute QA save, both club_open and bay-bluebird are unlocked so all 3 routes are open.
    await expect(page.locator('.journal-map-route[data-open="true"]')).toHaveCount(3);

    const footer = page.locator(".journal-map-footer");
    await expect(footer).toBeVisible();
    await expect(page.locator('.journal-map-pill[data-stat="stickers"]'))
      .toContainText("Stickers");
    await expect(page.locator('.journal-map-pill[data-stat="prizes"]'))
      .toContainText("Prizes");

    // Click Bubblegum Bay to inspect its sticker progress in the footer.
    await page.locator('.journal-map-land[data-land="bay"]').click();
    await expect(page.locator(".journal-map-detail")).toContainText("Bubblegum Bay");
    await expect(page.locator(".journal-map-detail")).toContainText("/4 stickers");
    await expect(page.locator(".journal-book")).toHaveScreenshot("journal-map-routes-1280.png");

    // Click Pinecone Pass to inspect its progress.
    await page.locator('.journal-map-land[data-land="pass"]').click();
    await expect(page.locator(".journal-map-detail")).toContainText("Pinecone Pass");
    await expect(page.locator(".journal-map-detail")).toContainText("/3 stickers");
  },
);
