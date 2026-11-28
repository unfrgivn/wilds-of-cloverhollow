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
} from "./helpers";

test.describe.configure({ timeout: longFlowTimeout });

type Rect = { x: number; y: number; width: number; height: number };

function intersects(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width &&
    b.x < a.x + a.width &&
    a.y < b.y + b.height &&
    b.y < a.y + a.height
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
  for (let count = 0; count < 45; count += 1) {
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

async function visibleRects(page: Page, selector: string): Promise<Rect[]> {
  return page.locator(selector).evaluateAll((nodes) =>
    nodes
      .filter((node) => node.getClientRects().length > 0)
      .map((node) => {
        const rect = node.getBoundingClientRect();
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
      }),
  );
}

async function portraitMoods(page: Page): Promise<Record<string, string>> {
  return page.locator(".battle-portrait").evaluateAll((nodes) => {
    const result: Record<string, string> = {};
    for (const node of nodes) {
      const id = node.getAttribute("data-member") ?? "";
      const mood = node.getAttribute("data-mood") ?? "";
      if (id.length > 0) result[id] = mood;
    }
    return result;
  });
}

test(
  "battle portraits sit clear of HUD on desktop, track live moods, and hide on phones",
  { tag: "@smoke" },
  async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await openHarness(page);
    await resetPaused(page, "plaza-party");
    await walkToFrogCommand(page);

    const portraits = page.locator(".battle-portraits");
    await expect(portraits).toBeVisible();
    await expect(page.locator(".battle-portrait")).toHaveCount(3);

    const backgrounds = await page.locator(".battle-portrait-img").evaluateAll((nodes) =>
      nodes.map((node) => getComputedStyle(node).backgroundImage),
    );
    for (const bg of backgrounds) {
      expect(bg).toContain("url(");
    }

    // Verify zero overlap between .battle-portraits and all other HUD / battle chrome.
    const [portraitRect] = await visibleRects(page, ".battle-portraits");
    expect(portraitRect).toBeTruthy();
    const blockers = await visibleRects(
      page,
      ".battle-energy, .battle-calm, .battle-actions-left, " +
        ".battle-feeling, .battle-windup, .battle-commands, .sticker-dialogue",
    );
    if (portraitRect !== undefined) {
      for (const blocker of blockers) {
        expect(
          intersects(portraitRect, blocker),
          `portraits ${JSON.stringify(portraitRect)} vs ${JSON.stringify(blocker)}`,
        ).toBe(false);
      }
    }

    const activeMembers = async (): Promise<string[]> =>
      page.locator('.battle-portrait[data-active="true"]').evaluateAll((nodes) =>
        nodes.map((node) => node.getAttribute("data-member") ?? ""),
      );

    // Per-member turns: Fae is eager & active throughout her Turn 1 command menu.
    expect(await portraitMoods(page)).toEqual({ fae: "eager", sue: "cozy", maddie: "cozy" });
    expect(await activeMembers()).toEqual(["fae"]);
    await tapKey(page, "ArrowDown");
    expect(await portraitMoods(page)).toEqual({ fae: "eager", sue: "cozy", maddie: "cozy" });
    expect(await activeMembers()).toEqual(["fae"]);
    await tapKey(page, "ArrowUp");
    expect(await portraitMoods(page)).toEqual({ fae: "eager", sue: "cozy", maddie: "cozy" });

    // Charge 3 GREAT checks to make Together! ready -> all medallions turn radiant,
    // while Turn 2 hands the eager/active medallion to Sue and Turn 3 to Maddie.
    await tapKey(page, "Enter");
    await playBattleCheck(page);
    expect(await portraitMoods(page)).toEqual({
      fae: "cheering",
      sue: "cheering",
      maddie: "cheering",
    });
    await advanceUntil(page, (battle) => battle?.phase === "check");
    await playBattleCheck(page);
    await advanceUntil(
      page,
      (battle) => battle?.phase === "command" && battle.revealed >= battle.message.length,
    );

    // Turn 2 is Sue's turn: Sue's medallion shifts to eager/active.
    expect(await portraitMoods(page)).toEqual({ fae: "cozy", sue: "eager", maddie: "cozy" });
    expect(await activeMembers()).toEqual(["sue"]);

    await tapKey(page, "Enter");
    await playBattleCheck(page);
    await advanceUntil(page, (battle) => battle?.phase === "check");
    await playBattleCheck(page);
    await advanceUntil(
      page,
      (battle) => battle?.phase === "command" && battle.revealed >= battle.message.length,
    );

    await expect(page.locator(".battle-together-btn")).toBeVisible();
    expect(await portraitMoods(page)).toEqual({
      fae: "radiant",
      sue: "radiant",
      maddie: "radiant",
    });
    expect(await activeMembers()).toEqual(["maddie"]);

    // Check clearance again while Together! button is visible below ENERGY.
    const [readyPortraitRect] = await visibleRects(page, ".battle-portraits");
    const readyBlockers = await visibleRects(
      page,
      ".battle-energy, .battle-calm, .battle-actions-left, " +
        ".battle-feeling, .battle-windup, .battle-commands, .sticker-dialogue",
    );
    if (readyPortraitRect !== undefined) {
      for (const blocker of readyBlockers) {
        expect(intersects(readyPortraitRect, blocker)).toBe(false);
      }
    }

    if (process.env.CLOVERHOLLOW_REVIEW_SHOTS === "1" && testInfo.project.name === "chromium") {
      await page.screenshot({
        path: "art/review/m90-battle-portraits.jpg",
        type: "jpeg",
        quality: 90,
      });
    }

    // Phone viewport hides .battle-portraits so compact HUD stays unobstructed.
    await page.setViewportSize({ width: 874, height: 402 });
    await expect(portraits).toBeHidden();

    // Verify flustered state at 1 energy in a fresh battle (miss enemy bursts).
    await page.setViewportSize({ width: 1280, height: 720 });
    await resetPaused(page, "plaza");
    await walkToFrogCommand(page);
    for (let turn = 0; turn < 6; turn += 1) {
      const battle = await readBattle(page);
      if (battle !== null && battle.phase === "command" && battle.energy <= 1) break;
      // Pick Soothe and let its check miss so calm stays low.
      await tapKey(page, "Enter");
      await step(page, 180);
      await advanceUntil(page, (state) => state?.phase === "check");
      // Let the frog's burst miss so energy drops.
      await step(page, 220);
      const afterBurst = await readBattle(page);
      if (afterBurst?.phase === "burstResult" && afterBurst.lastGrade !== "great") {
        expect((await portraitMoods(page)).fae).toBe("flustered");
      }
      await advanceUntil(
        page,
        (state) =>
          state === null ||
          state.phase === "rest" ||
          (state.phase === "command" && state.revealed >= state.message.length),
      );
    }
    const lowBattle = await readBattle(page);
    expect(lowBattle?.phase).toBe("command");
    expect(lowBattle?.energy).toBe(1);
    expect(await portraitMoods(page)).toEqual({ fae: "flustered", maddie: "flustered" });
  },
);

test(
  "storyTimeOfDay transitions across story arc and P toggles Photo Showcase Mode",
  { tag: "@smoke" },
  async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await openHarness(page);
    await resetPaused(page, "new-game");
    expect((await renderInfo(page)).timeOfDay).toBe("morning");

    // Post-lantern Whispering Woods QA pack: turn lantern off to reveal golden-hour.
    await page.goto("./?qa=woods");
    await page.waitForFunction(() => Boolean(window.__cloverhollow));
    await page.evaluate(() => {
      window.__cloverhollow?.pause();
      window.__cloverhollow?.settings.setKeyHints(true);
    });
    await step(page, 1);
    if ((await readState(page)).lantern) {
      await tapKey(page, "l");
    }
    const goldenInfo = await renderInfo(page);
    expect(goldenInfo.area).toBe("woods");
    expect(goldenInfo.timeOfDay).toBe("golden-hour");
    expect(goldenInfo.photoMode).toBe(false);
    await expect(page.locator("html")).toHaveAttribute("data-photo", "off");
    await expect(page.locator(".hud-hints")).toBeVisible();
    await expect(page.locator(".qa-badge")).toBeVisible();

    // Press P to enter Photo Mode: hides HUD hints, QA badge, prompts, and debug label.
    await page.keyboard.press("p");
    await step(page, 1);
    await expect(page.locator("html")).toHaveAttribute("data-photo", "on");
    expect((await renderInfo(page)).photoMode).toBe(true);
    await expect(page.locator(".hud-hints")).toBeHidden();
    await expect(page.locator(".qa-badge")).toBeHidden();
    await expect(page.locator(".sticker-prompt")).toBeHidden();
    await expect(page.locator(".area-banner")).toBeHidden();

    if (process.env.CLOVERHOLLOW_REVIEW_SHOTS === "1" && testInfo.project.name === "chromium") {
      await page.screenshot({
        path: "art/review/m90-golden-hour.jpg",
        type: "jpeg",
        quality: 90,
      });
    }

    // Space in Photo Mode captures a postcard download and flashes the shutter cleanly.
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.keyboard.press("Space"),
    ]);
    expect(download.suggestedFilename()).toBe("cloverhollow-postcard-woods.png");
    await expect(page.locator(".photo-shutter-flash")).toHaveAttribute("data-shutter-count", "1");

    // Escape exits Photo Mode cleanly and hides any active shutter flash.
    await page.keyboard.press("Escape");
    await step(page, 1);
    await expect(page.locator("html")).toHaveAttribute("data-photo", "off");
    await expect(page.locator(".photo-shutter-flash")).toBeHidden();
    expect((await renderInfo(page)).photoMode).toBe(false);
    await expect(page.locator(".hud-hints")).toBeVisible();

    // P also toggles off cleanly.
    await page.keyboard.press("p");
    await step(page, 1);
    expect((await renderInfo(page)).photoMode).toBe(true);
    await page.keyboard.press("p");
    await step(page, 1);
    expect((await renderInfo(page)).photoMode).toBe(false);

    // Enchanted Forest before calming shows enchanted-twilight.
    await page.goto("./?qa=forest");
    await page.waitForFunction(() => Boolean(window.__cloverhollow));
    await page.evaluate(() => window.__cloverhollow?.pause());
    await step(page, 1);
    if ((await readState(page)).lantern) {
      await tapKey(page, "l");
    }
    const forestInfo = await renderInfo(page);
    expect(forestInfo.area).toBe("enchanted");
    expect(forestInfo.timeOfDay).toBe("enchanted-twilight");
  },
);
