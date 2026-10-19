import { expect, test } from "@playwright/test";
import { openHarness, readState, resetPaused, step } from "./helpers";

test(
  "QA menu loads a pack with real keys and never writes the player slot",
  async ({ page }, testInfo) => {
  await page.goto("./");
  await page.waitForFunction(() => Boolean(window.__cloverhollow));
  const before = await page.evaluate(() => {
    localStorage.setItem("CapacitorStorage.cloverhollow-save", "player-save-sentinel");
    return localStorage.getItem("CapacitorStorage.cloverhollow-save");
  });
  await page.keyboard.press("q");
  await step(page, 2);
  await expect(page.locator(".qa-menu")).toBeVisible();
  if (testInfo.project.name === "chromium")
    await expect(page).toHaveScreenshot("qa-menu.png");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("z");
  await step(page, 2);
  const pack = await page.evaluate(() => window.__cloverhollow?.qa.packs()[1] ?? null);
  if (pack === null) throw new Error("QA pack missing");
  expect(await page.evaluate(() => window.__cloverhollow?.qa.active())).toBe(true);
  await expect(page.locator(".qa-menu")).toBeHidden();
  await expect(page.locator(".title-screen")).toBeHidden();
  expect(await page.evaluate(() => window.__cloverhollow?.boot.title())).toBeNull();
  await expect(page.locator(".qa-badge")).toBeVisible();
  await expect(page.locator(".qa-badge")).toContainText(pack.label);
  if (testInfo.project.name === "chromium")
    await expect(page).toHaveScreenshot("qa-badge.png");
  expect((await readState(page)).tick).toBe(pack.tick);
  expect(await page.evaluate(() => window.__cloverhollow?.hash())).toBe(pack.hash);
  const saveLast = await page.evaluate(() => window.__cloverhollow?.save.last() ?? null);
  const beforePosition = (await readState(page)).player;
  await page.keyboard.down("ArrowRight");
  await step(page, 20);
  await page.keyboard.up("ArrowRight");
  expect((await readState(page)).player.x).toBeGreaterThan(beforePosition.x);
  expect(await page.evaluate(() => localStorage.getItem(
    "CapacitorStorage.cloverhollow-save",
  ))).toBe(before);
  expect(await page.evaluate(() => window.__cloverhollow?.save.last() ?? null)).toEqual(saveLast);
  },
);

test("a picked QA pack keeps the real-time loop running", async ({ page }) => {
  await page.goto("./");
  await page.waitForFunction(() => Boolean(window.__cloverhollow));
  await page.keyboard.press("q");
  await expect(page.locator(".qa-menu")).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("z");
  await expect(page.locator(".qa-badge")).toBeVisible();
  const before = await readState(page);
  await page.keyboard.down("ArrowRight");
  await page.waitForTimeout(1500);
  await page.keyboard.up("ArrowRight");
  const after = await readState(page);
  expect(after.tick).toBeGreaterThan(before.tick);
  expect(after.player.x).toBeGreaterThan(before.player.x);
});

test("the QA menu keeps Back to title visible on a phone viewport", async ({ page }) => {
  await page.setViewportSize({ width: 874, height: 402 });
  await page.goto("./");
  await page.waitForFunction(() => Boolean(window.__cloverhollow));
  await page.keyboard.press("q");
  await expect(page.locator(".qa-menu")).toBeVisible();
  await expect(page.locator(".qa-back")).toBeVisible();
  await expect(page.locator(".qa-back")).toBeInViewport();
});

test("a QA URL boots the named pack and shows its badge", async ({ page }) => {
  await page.goto("./?qa=shortcut-jordan");
  await page.waitForFunction(() => Boolean(window.__cloverhollow));
  await expect(page.locator(".qa-badge")).toContainText("Jordan shortcut");
  expect(await page.evaluate(() => window.__cloverhollow?.qa.active())).toBe(true);
});

test("cancel returns to the title and fixture reset clears QA mode", async ({ page }) => {
  await page.goto("./");
  await page.waitForFunction(() => Boolean(window.__cloverhollow));
  await page.keyboard.press("q");
  await step(page, 1);
  await page.keyboard.press("Escape");
  await step(page, 1);
  await expect(page.locator(".qa-menu")).toBeHidden();
  await expect(page.locator(".title-screen")).toBeVisible();
  expect(await page.evaluate(() => window.__cloverhollow?.qa.active())).toBe(false);
  await page.keyboard.press("q");
  await step(page, 1);
  await page.evaluate(async () => {
    await window.__cloverhollow?.reset({ seed: 1, fixture: "harness" });
  });
  await expect(page.locator(".qa-menu")).toBeHidden();
  await expect(page.locator(".qa-badge")).toBeHidden();
  expect(await page.evaluate(() => window.__cloverhollow?.qa.active())).toBe(false);
});

test("touch long press opens QA and touch pick loads a pack", async ({ page }) => {
  await page.goto("./");
  await page.waitForFunction(() => Boolean(window.__cloverhollow));
  const logo = page.locator(".title-logo");
  await logo.dispatchEvent("pointerdown", { pointerType: "touch" });
  await page.waitForTimeout(700);
  await logo.dispatchEvent("pointerup", { pointerType: "touch" });
  await expect(page.locator(".qa-menu")).toBeVisible();
  const option = page.locator(".qa-option").nth(1);
  await option.dispatchEvent("pointerdown", { pointerType: "touch" });
  await option.dispatchEvent("pointerup", { pointerType: "touch" });
  await option.dispatchEvent("click");
  await expect(page.locator(".qa-badge")).toBeVisible();
  expect(await page.evaluate(() => window.__cloverhollow?.qa.active())).toBe(true);
});

test("unknown QA URLs freeze without touching the real slot", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("CapacitorStorage.cloverhollow-save", "player-save-sentinel");
  });
  await page.goto("./?qa=not-a-real-pack");
  await page.waitForFunction(() => Boolean(window.__cloverhollow));
  await expect(page.locator(".qa-error")).toContainText("Known saves");
  const before = await readState(page);
  await step(page, 20);
  expect((await readState(page)).tick).toBe(before.tick);
  expect(await page.evaluate(() => localStorage.getItem(
    "CapacitorStorage.cloverhollow-save",
  ))).toBe("player-save-sentinel");
  expect(await page.evaluate(() => window.__cloverhollow?.save.last())).toBeNull();
});

test("ordinary harness reset has no QA overlay", async ({ page }) => {
  await openHarness(page);
  await resetPaused(page);
  await expect(page.locator(".qa-menu")).toBeHidden();
  expect(await page.evaluate(() => {
    const element = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
    return element?.closest(".qa-menu") !== null;
  })).toBe(false);
});
