import { expect, test } from "@playwright/test";
import { playBattleCheck, readBattle, readState, resetPaused, step } from "./helpers";

async function press(page: Parameters<typeof step>[0]): Promise<void> {
  await page.keyboard.down("Enter");
  await step(page, 1);
  await page.keyboard.up("Enter");
  await step(page, 1);
}

test("real keys: calm payout shows XP and journal member stats", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("./");
  await page.waitForFunction(() => Boolean(window.__cloverhollow));
  await resetPaused(page, "plaza");
  const route = [["ArrowDown", 25], ["ArrowLeft", 15], ["ArrowDown", 50],
    ["ArrowLeft", 35]] as const;
  for (const [key, ticks] of route) {
    await page.keyboard.down(key); await step(page, ticks); await page.keyboard.up(key);
  }
  const before = (await readState(page)).xp;
  for (let turns = 0; turns < 100 && (await readBattle(page)) !== null; turns += 1) {
    const battle = await readBattle(page);
    if (battle?.phase === "check") await playBattleCheck(page);
    else await press(page);
  }
  const after = await readState(page);
  expect(after.xp - before).toBe(20);
  await expect(page.locator(".sticker-text-revealed")).toContainText("reached level 2");
  await page.keyboard.press("j");
  await step(page, 2);
  await expect(page.locator(".journal-member").first()).toContainText("Fae");
  await expect(page.locator(".journal-member-level").first()).toHaveText("Lv 2");
  await expect(page.locator(".journal-xp").first()).toContainText("20 XP");
  await expect(page.locator(".journal-member-stats").first()).toContainText("Power 22");
});

test("real keys: level-up line names the member and stat deltas", async ({ page }) => {
  await page.setViewportSize({ width: 874, height: 402 });
  await page.goto("./ui-gallery.html?state=battle-level-up&touch=1");
  await page.waitForFunction(() => document.querySelector("#gallery[data-ready='true']") !== null);
  await page.keyboard.press("Enter");
  await expect(page.locator(".sticker-text-revealed")).toHaveText(
    "Fae reached level 5! Power +2, Magic +1, Life +1.",
  );
});
