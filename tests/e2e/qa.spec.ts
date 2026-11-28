import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { openHarness, readBattle, readState, resetPaused, step } from "./helpers";

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
  await page.goto("./?qa=jordan");
  await page.waitForFunction(() => Boolean(window.__cloverhollow));
  await expect(page.locator(".qa-badge")).toContainText("Jordan at Pinecone Pass");
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
    await pickPaused(page, "Jordan at Pinecone Pass");
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
  await page.goto("./?qa=breakfast");
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
  await pickPaused(page, "Jordan at Pinecone Pass");
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
  await pickPaused(page, "Jordan at Pinecone Pass");
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

test(
  "hold Q in live gameplay opens GUI console, edits enter Sandbox, and never touch player save",
  async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("CapacitorStorage.cloverhollow-save", "player-save-sentinel");
    });
    await openHarness(page);
    await resetPaused(page, "new-game");
    expect(await page.evaluate(() => window.__cloverhollow?.qa.active())).toBe(false);
    await expect(page.locator(".qa-badge")).toBeHidden();
    // Lazy DOM: no QA console node exists before first open.
    await expect(page.locator(".qa-console")).toHaveCount(0);

    // Quick tap of Q during gameplay does not open console or menu.
    await page.keyboard.press("q");
    await expect(page.locator(".qa-console")).toHaveCount(0);

    // Holding Q >= 500ms opens the QA console with keyboard focus in live mode.
    await page.keyboard.down("q");
    await page.waitForTimeout(560);
    await page.keyboard.up("q");
    await expect(page.locator(".qa-console")).toBeVisible();
    await expect(page.locator(".qa-console-input")).toBeFocused();
    await expect(page.locator(".qa-console-mode")).toHaveText("Live game (edits enter QA)");
    expect(await page.evaluate(() => window.__cloverhollow?.qa.active())).toBe(false);

    // Adjusting GUI sliders and toggles mutates live state and activates QA Sandbox.
    await page.locator('[data-qa-slider="coins"]').fill("250");
    await expect(page.locator(".qa-console-mode")).toHaveText("Sandbox");
    expect(await page.evaluate(() => window.__cloverhollow?.qa.active())).toBe(true);
    await expect(page.locator(".qa-badge")).toContainText("QA · Sandbox");

    await page.locator('[data-qa-slider="snacks"]').fill("15");
    await page.locator('[data-qa-slider="tickets"]').fill("120");
    await page.locator('[data-qa-slider="level"]').fill("5");
    await page.locator('[data-qa-tool="lasso"]').click();
    await expect(page.locator('[data-qa-tool="lasso"]')).toHaveAttribute("aria-pressed", "true");
    await page.locator('[data-qa-toggle="keepsakes"]').click();
    await expect(page.locator('[data-qa-toggle="keepsakes"]'))
      .toHaveAttribute("aria-pressed", "true");
    await page.locator('[data-qa-toggle="gems"]').click();
    await expect(page.locator('[data-qa-toggle="gems"]')).toHaveAttribute("aria-pressed", "true");
    await page.locator('[data-qa-toggle="fish"]').click();
    await expect(page.locator('[data-qa-toggle="fish"]')).toHaveAttribute("aria-pressed", "true");
    await page.locator('[data-qa-action="stickers-all"]').click();

    const state = await readState(page);
    expect(state.coins).toBe(250);
    expect(state.snacks).toBe(15);
    expect(state.tickets).toBe(120);
    expect(state.xp).toBe(thresholds()[4]);
    expect(JSON.parse(state.ink).variablesState.has_lasso).toBe(true);
    expect(state.stickers).toHaveLength(catalogueCount("content/stickers.json", "catalogue"));
    expect(Object.keys(state.caughtFish ?? {}).length).toBeGreaterThan(0);

    // Player save slot remains untouched.
    expect(await page.evaluate(() => localStorage.getItem(
      "CapacitorStorage.cloverhollow-save",
    ))).toBe("player-save-sentinel");
  },
);

test(
  "Saves tab switches QA packs in-game and saves inline QA slots",
  async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("CapacitorStorage.cloverhollow-save", "player-save-sentinel");
    });
    await pickPaused(page, "Jordan at Pinecone Pass");
    const firstArea = (await readState(page)).area;
    await page.keyboard.press("`");
    await expect(page.locator(".qa-console")).toBeVisible();
    await page.locator('[data-qa-tab="saves"]').click();
    await expect(page.locator('[data-qa-panel="saves"]')).toBeVisible();

    // Active pack is marked with aria-current="true".
    await expect(page.locator('.qa-console-pack[aria-current="true"]'))
      .toContainText("Jordan at Pinecone Pass");

    // Save an inline slot and verify it appears in the Saves list immediately.
    await page.locator("[data-qa-slot-input]").fill("inline-slot");
    await page.locator("[data-qa-slot-save]").click();
    await expect(page.locator('.qa-console-pack[data-id="slot:inline-slot"]')).toBeVisible();

    // Load a different QA pack in a different area from inside gameplay.
    const packs = await page.evaluate(() => window.__cloverhollow?.qa.packs() ?? []);
    const target = packs.find((pack) => pack.id !== "jordan" && pack.id !== "sandbox");
    if (target === undefined) throw new Error("Missing second QA pack");
    await page.locator(`.qa-console-pack[data-id="${target.id}"]`).click();
    await expect(page.locator(".qa-console")).toBeHidden();
    await expect(page.locator(".qa-badge")).toContainText(target.label);
    await expect.poll(async () => (await readState(page)).tick, { timeout: 10_000 })
      .toBe(target.tick);
    const loadedState = await readState(page);
    await expect.poll(
      async () => page.evaluate(() => window.__cloverhollow?.renderInfo().area ?? ""),
      { timeout: 10_000 },
    ).toBe(loadedState.area);
    expect(loadedState.area !== firstArea || loadedState.tick === target.tick).toBe(true);
    expect(await page.evaluate(() => localStorage.getItem(
      "CapacitorStorage.cloverhollow-save",
    ))).toBe("player-save-sentinel");
  },
);

test("touch QA trigger opens console during live gameplay on phone", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 874, height: 402 },
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.goto("./?touch=1");
  await page.waitForFunction(() => Boolean(window.__cloverhollow));
  // Hidden on title screen.
  await expect(page.locator(".qa-touch-trigger")).toBeHidden();

  // Visible in live gameplay before any QA pack activates, hidden during Journal & battles.
  await resetPaused(page, "new-game");
  const trigger = page.locator(".qa-touch-trigger");
  await expect(trigger).toBeVisible();
  await page.locator(".touch-menu").click();
  await step(page, 1);
  await expect(page.locator("html")).toHaveAttribute("data-journal", "open");
  await expect(trigger).toBeHidden();
  await page.locator(".journal-close").click();
  await step(page, 1);
  await expect(trigger).toBeVisible();
  await trigger.click();
  await expect(page.locator(".qa-console")).toBeVisible();
  await expect(page.locator(".qa-console-card")).toBeInViewport();
  await expect(trigger).toBeHidden();

  // Editing enters Sandbox so .qa-badge replaces .qa-touch-trigger on close.
  await page.locator('[data-qa-slider="coins"]').fill("77");
  await page.locator(".qa-console-close").click();
  await expect(page.locator(".qa-console")).toBeHidden();
  await expect(page.locator(".qa-badge")).toContainText("QA · Sandbox");
  await expect(trigger).toBeHidden();
  await context.close();
});

test("Settings tab toggles live game settings and Photo Mode", async ({ page }) => {
  await openHarness(page);
  await resetPaused(page, "new-game");
  await page.keyboard.press("`");
  await expect(page.locator(".qa-console")).toBeVisible();
  await page.locator('[data-qa-tab="settings"]').click();
  await expect(page.locator('[data-qa-panel="settings"]')).toBeVisible();

  await page.locator('[data-qa-setting="gentleTiming"]').click();
  await page.locator('[data-qa-setting="keyHints"]').click();
  await page.locator('[data-qa-setting="reducedMotion"]').click();
  await page.locator('[data-qa-setting="muted"]').click();
  await page.locator('[data-qa-text-speed="instant"]').click();

  const settings = await page.evaluate(() => ({
    gentleTiming: window.__cloverhollow?.settings.gentleTiming(),
    keyHints: window.__cloverhollow?.settings.keyHints(),
    reducedMotion: window.__cloverhollow?.settings.reducedMotion(),
    muted: window.__cloverhollow?.sound.muted(),
    textSpeed: window.__cloverhollow?.settings.textSpeed(),
  }));
  expect(settings).toEqual({
    gentleTiming: true,
    keyHints: true,
    reducedMotion: true,
    muted: true,
    textSpeed: "instant",
  });
  await expect(page.locator('[data-qa-text-speed="instant"]'))
    .toHaveAttribute("aria-pressed", "true");

  // Photo Mode button enters Photo Mode and closes the console when in free overworld.
  await expect(page.locator('[data-qa-setting="photoMode"]')).toBeEnabled();
  await page.locator('[data-qa-setting="photoMode"]').click();
  await expect(page.locator(".qa-console")).toBeHidden();
  expect(await page.evaluate(() => window.__cloverhollow?.settings.photoMode())).toBe(true);
});

test(
  "New Game (Clean Reset) clears QA mode, stale runtime state, and saved player slot",
  async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("CapacitorStorage.cloverhollow-save", "stale-player-save");
    });
    await pickPaused(page, "Jordan at Pinecone Pass");
    await page.keyboard.press("`");
    await expect(page.locator(".qa-console")).toBeVisible();
    await page.locator('[data-qa-slider="coins"]').fill("333");
    expect((await readState(page)).coins).toBe(333);

    await page.locator('[data-qa-tab="saves"]').click();
    await expect(page.locator("[data-qa-reset]")).toBeVisible();
    await page.locator("[data-qa-reset]").click();

    await expect(page.locator(".qa-console")).toBeHidden();
    await expect(page.locator(".qa-badge")).toBeHidden();
    expect(await page.evaluate(() => window.__cloverhollow?.qa.active())).toBe(false);
    await expect.poll(
      async () => page.evaluate(() => window.__cloverhollow?.renderInfo().area ?? ""),
      { timeout: 10_000 },
    ).toBe("bedroom");

    const fresh = await readState(page);
    expect(fresh.area).toBe("bedroom");
    expect(fresh.coins).toBe(0);
    expect(fresh.tick).toBe(0);
    await expect.poll(
      async () => page.evaluate(() => localStorage.getItem("CapacitorStorage.cloverhollow-save")),
      { timeout: 5_000 },
    ).toBeNull();

    // Typed `reset` command also clears console log, QA mode, and state.
    await page.keyboard.press("`");
    await expect(page.locator(".qa-console")).toBeVisible();
    await page.keyboard.type("coins 88");
    await page.keyboard.press("Enter");
    expect((await readState(page)).coins).toBe(88);
    expect(await page.evaluate(() => window.__cloverhollow?.qa.active())).toBe(true);
    await page.keyboard.type("reset");
    await page.keyboard.press("Enter");
    await expect(page.locator(".qa-console")).toBeHidden();
    await expect(page.locator(".qa-badge")).toBeHidden();
    expect(await page.evaluate(() => window.__cloverhollow?.qa.active())).toBe(false);
    expect((await readState(page)).coins).toBe(0);
  },
);

test(
  "phone touch QA trigger hides over Journal, Photo Mode, and Battle, then reappears",
  async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 874, height: 402 },
      hasTouch: true,
    });
    const page = await context.newPage();
    await page.goto("./?touch=1");
    await page.waitForFunction(() => Boolean(window.__cloverhollow));
    await resetPaused(page, "plaza");

    const html = page.locator("html");
    const trigger = page.locator(".qa-touch-trigger");
    await expect(trigger).toBeVisible();

    // 1. Journal open hides .qa-touch-trigger; closing restores it.
    await page.locator(".touch-menu").click();
    await step(page, 1);
    await expect(html).toHaveAttribute("data-journal", "open");
    await expect(trigger).toBeHidden();
    await page.locator(".journal-close").click();
    await step(page, 1);
    await expect(html).not.toHaveAttribute("data-journal", "open");
    await expect(trigger).toBeVisible();

    // 2. Photo Mode hides .qa-touch-trigger; exiting restores it.
    await page.keyboard.press("p");
    await step(page, 1);
    await expect(html).toHaveAttribute("data-photo", "on");
    await expect(trigger).toBeHidden();
    await page.keyboard.press("Escape");
    await step(page, 1);
    await expect(html).not.toHaveAttribute("data-photo", "on");
    await expect(trigger).toBeVisible();

    // 3. Battle hides .qa-touch-trigger; running back to overworld restores it.
    for (const [key, ticks] of [
      ["ArrowDown", 25],
      ["ArrowLeft", 15],
      ["ArrowDown", 50],
      ["ArrowLeft", 35],
    ] as const) {
      await page.keyboard.down(key);
      await step(page, ticks);
      await page.keyboard.up(key);
    }
    await expect(html).toHaveAttribute("data-battle", "open");
    await expect(trigger).toBeHidden();

    // Advance intro into command phase, pick Run, and finish the run message.
    const tap = async (selector: string): Promise<void> => {
      const bounds = await page.locator(selector).boundingBox();
      if (bounds === null) throw new Error(`${selector} is not visible`);
      await page.touchscreen.tap(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
      await step(page, 2);
    };
    for (let guard = 0; guard < 16; guard += 1) {
      const battle = await readBattle(page);
      if (battle?.phase === "command" && battle.revealed >= battle.message.length) break;
      await tap(".touch-confirm");
    }
    expect((await readBattle(page))?.phase).toBe("command");
    await expect(trigger).toBeHidden();

    await tap(".battle-command:has-text('Run')");
    expect((await readBattle(page))?.phase).toBe("run");
    for (let guard = 0; guard < 8 && (await readBattle(page)) !== null; guard += 1) {
      await tap(".touch-confirm");
    }
    expect(await readBattle(page)).toBeNull();
    await expect(html).not.toHaveAttribute("data-battle", "open");
    await expect(trigger).toBeVisible();
    await context.close();
  },
);
