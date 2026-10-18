import { expect, test } from "@playwright/test";
import { readState, step } from "./helpers";

test("QA menu loads a pack with real keys and never writes the player slot", async ({ page }) => {
  await page.goto("./");
  await page.waitForFunction(() => Boolean(window.__cloverhollow));
  const before = await page.evaluate(() => {
    localStorage.setItem("CapacitorStorage.cloverhollow-save", "player-save-sentinel");
    return localStorage.getItem("CapacitorStorage.cloverhollow-save");
  });
  await page.keyboard.press("q");
  await step(page, 2);
  await expect(page.locator(".qa-menu")).toBeVisible();
  await page.screenshot({ path: "art/review/qa-menu.png" });
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("z");
  await step(page, 2);
  const pack = await page.evaluate(() => window.__cloverhollow?.qa.packs()[1] ?? null);
  if (pack === null) throw new Error("QA pack missing");
  expect(await page.evaluate(() => window.__cloverhollow?.qa.active())).toBe(true);
  expect(await page.locator(".qa-badge")).toContainText(pack.label);
  await page.screenshot({ path: "art/review/qa-badge.png" });
  expect((await readState(page)).tick).toBe(pack.tick);
  const saveLast = await page.evaluate(() => window.__cloverhollow?.save.last() ?? null);
  await page.keyboard.down("ArrowRight");
  await step(page, 20);
  await page.keyboard.up("ArrowRight");
  expect(await page.evaluate(() => localStorage.getItem(
    "CapacitorStorage.cloverhollow-save",
  ))).toBe(before);
  expect(await page.evaluate(() => window.__cloverhollow?.save.last() ?? null)).toEqual(saveLast);
});

test("a QA URL boots the named pack and shows its badge", async ({ page }) => {
  await page.goto("./?qa=shortcut-jordan");
  await page.waitForFunction(() => Boolean(window.__cloverhollow));
  await expect(page.locator(".qa-badge")).toContainText("Jordan shortcut");
  expect(await page.evaluate(() => window.__cloverhollow?.qa.active())).toBe(true);
});
