import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";
import {
  longFlowTimeout,
  openHarness,
  openMap,
  playBattleCheck,
  readBattle,
  resetPaused,
  step,
} from "./helpers";

type Rect = { x: number; y: number; width: number; height: number };

function rectsOverlap(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

async function hold(page: Page, key: string, ticks: number): Promise<void> {
  await page.keyboard.down(key);
  await step(page, ticks);
  await page.keyboard.up(key);
}

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
  for (let count = 0; count < 50; count += 1) {
    const battle = await readBattle(page);
    if (predicate(battle)) return;
    await tapKey(page, "Enter");
  }
  throw new Error("timed out advancing battle phase");
}

async function walkToFrogCommand(page: Page): Promise<void> {
  for (const [key, ticks] of [
    ["ArrowDown", 25],
    ["ArrowLeft", 15],
    ["ArrowDown", 50],
    ["ArrowLeft", 35],
    ["ArrowUp", 38],
  ] as const) {
    await hold(page, key, ticks);
  }
  await expect(page.locator("html")).toHaveAttribute("data-battle", "open");
  await advanceUntil(
    page,
    (battle) => battle?.phase === "command" && battle.revealed >= battle.message.length,
  );
}

async function captureReview(
  page: Page,
  testInfo: TestInfo,
  name: string,
): Promise<void> {
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

async function boxIfVisible(locator: Locator): Promise<Rect | null> {
  if (!(await locator.isVisible())) return null;
  return await locator.boundingBox();
}

async function assertPeekGeometry(
  page: Page,
  width: number,
  height: number,
): Promise<void> {
  const card = page.locator(".battle-peek-card");
  await expect(card).toBeVisible();
  const cardBox = await card.boundingBox();
  expect(cardBox, `card box at ${width}x${height}`).not.toBeNull();
  if (cardBox === null) return;

  expect(cardBox.x, `left >= 0 at ${width}x${height}`).toBeGreaterThanOrEqual(0);
  expect(cardBox.y, `top >= 0 at ${width}x${height}`).toBeGreaterThanOrEqual(0);
  expect(cardBox.x + cardBox.width, `right <= ${width}`).toBeLessThanOrEqual(width + 1);
  expect(cardBox.y + cardBox.height, `bottom <= ${height}`).toBeLessThanOrEqual(height + 1);

  const clipped = await card.evaluate((node) => node.scrollWidth > node.clientWidth + 1);
  expect(clipped, `no horizontal clip at ${width}x${height}`).toBe(false);

  const obstacles = [
    [".battle-energy", page.locator(".battle-energy")],
    [".battle-calm", page.locator(".battle-calm")],
    [".battle-portraits", page.locator(".battle-portraits")],
    [".battle-commands", page.locator(".battle-commands")],
    [".sticker-dialogue", page.locator(".sticker-dialogue")],
    [".touch-buttons", page.locator(".touch-buttons")],
  ] as const;

  for (const [label, locator] of obstacles) {
    const other = await boxIfVisible(locator);
    if (other === null) continue;
    expect(
      rectsOverlap(cardBox, other),
      `peek card must not overlap ${label} at ${width}x${height} ` +
        `(card=${JSON.stringify(cardBox)}, ${label}=${JSON.stringify(other)})`,
    ).toBe(false);
  }
}

test.describe("Milestone 110: Battle Field Guide Peek & Interactive Map Land Guide", () => {
  test.setTimeout(longFlowTimeout);

  test(
    "Battle Field Guide Peek toggles via I, foe plate click, Escape, and × across viewports",
    { tag: "@smoke" },
    async ({ page }, testInfo) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      await page.setViewportSize({ width: 1280, height: 720 });
      await openHarness(page);
      await resetPaused(page, "plaza-party");
      await walkToFrogCommand(page);

      const peekCard = page.locator(".battle-peek-card");
      await expect(peekCard).toBeHidden();

      // Press I to open the Battle Field Guide Peek card.
      await page.keyboard.press("i");
      await expect(peekCard).toBeVisible();
      await expect(peekCard.locator(".battle-peek-name")).toHaveText("Fizzy Frog");
      await expect(peekCard.locator(".battle-peek-fam")).toHaveText("New Friend");
      await expect(peekCard.locator(".battle-peek-badge.is-land")).toHaveText("Cloverhollow");
      await expect(peekCard.locator(".battle-peek-badge.is-check")).toHaveText("Rhythm Chain");
      await expect(peekCard).toContainText("Calm once or carry the lantern to spot feelings.");
      await expect(peekCard).toContainText("Try treats in battle to discover favourites!");
      await expect(peekCard.locator(".battle-peek-tip")).toContainText("beat");

      await assertPeekGeometry(page, 1280, 720);
      await captureReview(page, testInfo, "m110-battle-peek-1280");

      // Check landscape phone (874x402) geometry and capture review shot.
      await page.setViewportSize({ width: 874, height: 402 });
      await step(page, 1);
      await assertPeekGeometry(page, 874, 402);
      await captureReview(page, testInfo, "m110-battle-peek-874");

      // Check compact phone (667x375) geometry.
      await page.setViewportSize({ width: 667, height: 375 });
      await step(page, 1);
      await assertPeekGeometry(page, 667, 375);

      // Return to desktop size and verify Escape dismisses ONLY the peek card.
      await page.setViewportSize({ width: 1280, height: 720 });
      await step(page, 1);
      await page.keyboard.press("Escape");
      await expect(peekCard).toBeHidden();
      await step(page, 2);
      await expect(page.locator("html")).toHaveAttribute("data-battle", "open");
      await expect(page.locator(".battle-commands")).toBeVisible();
      expect((await readBattle(page))?.phase).toBe("command");

      // Click the top-right foe meter plate to reopen, then click × to close.
      await page.locator(".battle-calm").click();
      await expect(peekCard).toBeVisible();
      await peekCard.locator(".battle-peek-close").click();
      await expect(peekCard).toBeHidden();

      expect(errors).toEqual([]);
    },
  );

  test(
    "KeyX while Battle Field Guide Peek is open closes only Peek without triggering Together!",
    { tag: "@smoke" },
    async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      await page.setViewportSize({ width: 1280, height: 720 });
      await openHarness(page);
      await resetPaused(page, "plaza-party");
      await walkToFrogCommand(page);

      // Charge 3 GREAT checks so Together! is armed and listening on cancel (KeyX).
      await tapKey(page, "Enter");
      await playBattleCheck(page);
      await advanceUntil(page, (battle) => battle?.phase === "check");
      await playBattleCheck(page);
      await advanceUntil(
        page,
        (battle) => battle?.phase === "command" && battle.revealed >= battle.message.length,
      );
      await tapKey(page, "Enter");
      await playBattleCheck(page);
      await advanceUntil(page, (battle) => battle?.phase === "check");
      await playBattleCheck(page);
      await advanceUntil(
        page,
        (battle) => battle?.phase === "command" && battle.revealed >= battle.message.length,
      );

      expect((await readBattle(page))?.sparkle).toBe(3);
      await expect(page.locator(".battle-together-btn")).toBeVisible();

      const peekCard = page.locator(".battle-peek-card");
      await page.keyboard.press("i");
      await expect(peekCard).toBeVisible();

      // Press real KeyX: must close ONLY Peek and leave Together! charged & unlaunched.
      await tapKey(page, "x");
      await expect(peekCard).toBeHidden();
      const afterClose = await readBattle(page);
      expect(afterClose?.phase).toBe("command");
      expect(afterClose?.sparkle).toBe(3);
      await expect(page.locator(".battle-together-btn")).toBeVisible();

      // A second real KeyX now that Peek is closed launches Together! normally.
      await tapKey(page, "x");
      const launched = await readBattle(page);
      expect(launched?.phase).toBe("check");
      expect(launched?.command).toBe("together");
      expect(launched?.sparkle).toBeUndefined();

      expect(errors).toEqual([]);
    },
  );

  test(
    "Journal MAP preserves default footer and enriches selected land with Land Field Guide",
    { tag: "@smoke" },
    async ({ page }, testInfo) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      await page.setViewportSize({ width: 1280, height: 720 });
      await openHarness(page);
      await resetPaused(page, "plaza");
      await openMap(page);

      const detail = page.locator(".journal-map-detail");
      await expect(detail).toHaveText(/^Here: Cloverhollow · 0\/\d+ stickers$/);

      // Click Bubblegum Bay pin to reveal its Land Field Guide line.
      await page.locator('.journal-map-land[data-land="bay"]').click();
      await expect(detail).toContainText("Bubblegum Bay");
      await expect(detail).toContainText("stickers");
      await expect(detail).toContainText("Star-Line stop");
      await expect(detail).toContainText("Fishing, Boats & Cottage");

      // Verify clean fit inside .journal-map-footer with zero overflow.
      const detailOverflow = await detail.evaluate(
        (node) => node.scrollWidth > node.clientWidth + 1,
      );
      expect(detailOverflow).toBe(false);
      const footerBox = await page.locator(".journal-map-footer").boundingBox();
      const detailBox = await detail.boundingBox();
      const summaryBox = await page.locator(".journal-map-summary").boundingBox();
      expect(footerBox).not.toBeNull();
      expect(detailBox).not.toBeNull();
      expect(summaryBox).not.toBeNull();
      if (footerBox !== null && detailBox !== null && summaryBox !== null) {
        expect(detailBox.x + detailBox.width).toBeLessThanOrEqual(summaryBox.x + 1);
        expect(summaryBox.x + summaryBox.width).toBeLessThanOrEqual(
          footerBox.x + footerBox.width + 1,
        );
      }

      await captureReview(page, testInfo, "m110-map-guide-1280");

      // Clicking Cloverhollow shows Here: prefix + guide; clicking again clears selection.
      const cloverPin = page.locator('.journal-map-land[data-land="cloverhollow"]');
      await cloverPin.click();
      await expect(detail).toContainText("Here: Cloverhollow");
      await expect(detail).toContainText("Shops, Café & Arcade");
      await cloverPin.click();
      await page.mouse.move(10, 10);
      await expect(detail).toHaveText(/^Here: Cloverhollow · 0\/\d+ stickers$/);

      expect(errors).toEqual([]);
    },
  );
});
