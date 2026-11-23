import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { openHarness, readState, resetPaused, step } from "./helpers";

// Picks a QA pack from the paused title and freezes the game at a
// deterministic tick, so screenshots over the console hold still.
async function pickPaused(page: Page, label: string): Promise<void> {
  await page.goto("./");
  await page.waitForFunction(() => Boolean(window.__cloverhollow));
  await page.keyboard.press("q");
  await step(page, 2);
  await page.locator(".qa-option", { hasText: label }).click();
  await step(page, 2);
  await expect(page.locator(".qa-badge")).toContainText(label);
}

function thresholds(): number[] {
  const parsed: unknown = JSON.parse(readFileSync("content/levels.json", "utf8"));
  if (typeof parsed !== "object" || parsed === null)
    throw new Error("levels.json is not an object");
  const record: Record<string, unknown> =
    Object.fromEntries(Object.entries(parsed));
  const list: unknown = record.thresholds;
  if (!Array.isArray(list)) throw new Error("content/levels.json has no thresholds");
  const numbers = list.filter((entry): entry is number => typeof entry === "number");
  if (numbers.length !== list.length) throw new Error("levels.json thresholds are not numbers");
  return numbers;
}

function catalogueCount(file: string, field: string): number {
  const parsed: unknown = JSON.parse(readFileSync(file, "utf8"));
  if (typeof parsed !== "object" || parsed === null) throw new Error(`${file} is not an object`);
  const record: Record<string, unknown> = Object.fromEntries(Object.entries(parsed));
  const list: unknown = record[field];
  if (!Array.isArray(list)) throw new Error(`${file} has no ${field}`);
  return list.length;
}

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
  // Ticks wait while the picked pack's area loads, so wait for the loop itself
  // to run before walking: a fixed hold could end before the area is ready.
  const picked = await readState(page);
  await expect.poll(async () => (await readState(page)).tick, { timeout: 10_000 })
    .toBeGreaterThan(picked.tick);
  const before = await readState(page);
  await page.keyboard.down("ArrowRight");
  await expect.poll(async () => (await readState(page)).player.x, { timeout: 10_000 })
    .toBeGreaterThan(before.player.x);
  await page.keyboard.up("ArrowRight");
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
  // A tap is not a long press: its release leaves the title as it is.
  await page.evaluate(async () => {
    const title = document.querySelector(".title-logo");
    if (title === null) throw new Error("The title has no logo");
    title.dispatchEvent(new PointerEvent("pointerdown", { pointerType: "touch", bubbles: true }));
    title.dispatchEvent(new PointerEvent("pointerup", { pointerType: "touch", bubbles: true }));
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  await expect(page.locator(".qa-menu")).toBeHidden();
  await logo.dispatchEvent("pointerdown", { pointerType: "touch" });
  // A long task across the press's 650 ms mark, like the first frame after the
  // area art loads on a slow GPU: the release can run before the overdue
  // timer, so the release itself has to count as the long press.
  await page.evaluate(() => {
    window.setTimeout(() => {
      const end = performance.now() + 200;
      while (performance.now() < end) continue;
    }, 600);
  });
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

test(
  "the console sets state with real keys and never writes the player slot",
  async ({ page }, testInfo) => {
    await page.addInitScript(() => {
      localStorage.setItem("CapacitorStorage.cloverhollow-save", "player-save-sentinel");
    });
    await pickPaused(page, "Jordan shortcut");
    const saveLast = await page.evaluate(() => window.__cloverhollow?.save.last() ?? null);
    await page.keyboard.press("`");
    await expect(page.locator(".qa-console")).toBeVisible();
    await expect(page.locator(".qa-console-input")).toBeFocused();
    if (testInfo.project.name === "chromium")
      await expect(page).toHaveScreenshot("qa-console.png");
    const before = await readState(page);
    await page.keyboard.type("coins 99");
    await page.keyboard.press("Enter");
    await page.keyboard.type("level fae 6");
    await page.keyboard.press("Enter");
    await page.keyboard.type("snacks 7");
    await page.keyboard.press("Enter");
    await page.keyboard.type("stickers all");
    await page.keyboard.press("Enter");
    await page.keyboard.type("prizes all");
    await page.keyboard.press("Enter");
    await page.keyboard.type("lasso on");
    await page.keyboard.press("Enter");
    await expect(page.locator(".qa-console-log")).toContainText("has_lasso = true.");
    // Errors answer in the log, not by guessing.
    await page.keyboard.type("level fae 100");
    await page.keyboard.press("Enter");
    await expect(page.locator(".qa-console-log")).toContainText("Levels run from 1 to 99.");
    await page.keyboard.type("frobnicate");
    await page.keyboard.press("Enter");
    await expect(page.locator(".qa-console-log")).toContainText("Unknown command");
    // While the console is open the world is frozen: steps hold the tick.
    await step(page, 5);
    const state = await readState(page);
    expect(state.tick, "the console holds the world still").toBe(before.tick);
    expect(state.coins).toBe(99);
    expect(state.snacks).toBe(7);
    expect(state.xp).toBe(thresholds()[5]);
    expect(state.stickers).toHaveLength(catalogueCount("content/stickers.json", "catalogue"));
    expect(state.prizes).toHaveLength(catalogueCount("content/prizes.json", "catalogue"));
    expect(JSON.parse(state.ink).variablesState.has_lasso).toBe(true);
    await page.keyboard.press("Escape");
    await expect(page.locator(".qa-console")).toBeHidden();
    // The journal reads what the console set.
    await page.keyboard.press("j");
    await step(page, 2);
    await expect(page.locator(".journal-book")).toBeVisible();
    await expect(page.locator(".journal-member-level").first()).toHaveText("Lv 6");
    await expect(page.locator(".journal-supply")).toHaveText(["Coins 99", "Snacks 7"]);
    await page.keyboard.press("j");
    await step(page, 2);
    await expect(page.locator(".journal-book")).toBeHidden();
    expect(await page.evaluate(() => localStorage.getItem(
      "CapacitorStorage.cloverhollow-save",
    ))).toBe("player-save-sentinel");
    expect(await page.evaluate(() => window.__cloverhollow?.save.last() ?? null))
      .toEqual(saveLast);
  },
);

test("the console saves QA-only slots the QA menu lists and reloads", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("CapacitorStorage.cloverhollow-save", "player-save-sentinel");
  });
  await page.goto("./?qa=shortcut-jordan");
  await page.waitForFunction(() => Boolean(window.__cloverhollow));
  await page.keyboard.press("`");
  await expect(page.locator(".qa-console")).toBeVisible();
  await expect(page.locator(".qa-console-input")).toBeFocused();
  await page.keyboard.type("coins 42");
  await page.keyboard.press("Enter");
  await page.keyboard.type("save evening");
  await page.keyboard.press("Enter");
  await expect(page.locator(".qa-console-log")).toContainText(`Saved QA slot "evening"`);
  // The backtick closes the console again.
  await page.keyboard.press("`");
  await expect(page.locator(".qa-console")).toBeHidden();
  // Back to the plain URL: the title shows the save library again.
  await page.goto("./");
  await page.waitForFunction(() => Boolean(window.__cloverhollow));
  await page.keyboard.press("q");
  await step(page, 2);
  const saved = page.locator(".qa-option", { hasText: "Saved: evening" });
  await expect(saved).toBeVisible();
  await saved.click();
  await step(page, 2);
  await expect(page.locator(".qa-badge")).toContainText("Saved: evening");
  expect((await readState(page)).coins).toBe(42);
  expect(await page.evaluate(() => localStorage.getItem(
    "CapacitorStorage.cloverhollow-save",
  ))).toBe("player-save-sentinel");
  expect(await page.evaluate(() => localStorage.getItem(
    "CapacitorStorage.cloverhollow-qa-save:evening",
  ))).not.toBeNull();
});

test("tapping the QA badge opens the console on a phone", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 874, height: 402 });
  await pickPaused(page, "Jordan shortcut");
  await expect(page.locator(".qa-badge")).toBeVisible();
  await page.evaluate(() => {
    const badge = document.querySelector(".qa-badge");
    if (badge === null) throw new Error("The page has no QA badge");
    badge.dispatchEvent(new PointerEvent("pointerdown", { pointerType: "touch", bubbles: true }));
    badge.dispatchEvent(new PointerEvent("pointerup", { pointerType: "touch", bubbles: true }));
    badge.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await expect(page.locator(".qa-console")).toBeVisible();
  await expect(page.locator(".qa-console-card")).toBeInViewport();
  if (testInfo.project.name === "chromium")
    await expect(page).toHaveScreenshot("qa-console-phone.png");
  await page.click(".qa-console-close");
  await expect(page.locator(".qa-console")).toBeHidden();
});

test("export shows the save file in the console", async ({ page }, testInfo) => {
  await pickPaused(page, "Jordan shortcut");
  await page.keyboard.press("`");
  await expect(page.locator(".qa-console")).toBeVisible();
  await expect(page.locator(".qa-console-input")).toBeFocused();
  await page.keyboard.type("export");
  await page.keyboard.press("Enter");
  const block = page.locator("[data-qa-export]");
  await expect(block).toBeVisible();
  await expect(block).toContainText('"version"');
  if (testInfo.project.name === "chromium")
    await expect(page).toHaveScreenshot("qa-console-export.png");
});
