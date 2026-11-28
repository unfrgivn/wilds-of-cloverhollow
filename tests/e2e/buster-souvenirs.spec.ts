import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { longFlowTimeout, playBattleCheck, readBattle, readState, step, walk } from "./helpers";

async function press(page: Page, key = "z"): Promise<void> {
  await page.keyboard.down(key);
  await step(page, 1);
  await page.keyboard.up(key);
  await step(page, 1);
}

async function pickPaused(page: Page, label: string): Promise<void> {
  await page.goto("./");
  await page.waitForFunction(() => Boolean(window.__cloverhollow));
  await page.evaluate(() => window.__cloverhollow?.pause());
  await page.keyboard.press("q");
  await step(page, 2);
  await page.locator(".qa-option", { hasText: label }).click();
  await step(page, 2);
  await expect(page.locator(".qa-badge")).toContainText(label);
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

async function finishDialogue(
  page: Page,
  choiceIndex = 0,
  onLine?: (text: string) => Promise<void>,
): Promise<string[]> {
  const seen: string[] = [];
  for (let count = 0; count < 80; count += 1) {
    const dialogue = (await readState(page)).dialogue;
    if (dialogue === null) return seen;
    if (dialogue.revealed < dialogue.text.length) {
      await press(page, "z");
      continue;
    }
    if (seen.at(-1) !== dialogue.text) {
      seen.push(dialogue.text);
      if (onLine !== undefined) await onLine(dialogue.text);
    }
    if (dialogue.choices.length > 0) {
      for (let down = 0; down < choiceIndex; down += 1) {
        await press(page, "ArrowDown");
      }
      await press(page, "z");
      continue;
    }
    await press(page, "z");
  }
  throw new Error("dialogue did not close");
}

async function waitTransition(page: Page, targetArea: string): Promise<void> {
  for (let wait = 0; wait < 30; wait += 1) {
    const state = await readState(page);
    if (state.area === targetArea && state.transition === null) return;
    await step(page, 4);
  }
  expect((await readState(page)).area).toBe(targetArea);
}

async function walkSafe(page: Page, axis: "x" | "y", target: number): Promise<void> {
  for (let tries = 0; tries < 5; tries += 1) {
    await walk(page, axis, target);
    const current = await readState(page);
    if (current.battle === null) return;
    // Escape a roaming critter using real keys (advance intro/burst -> Run -> close).
    for (let stepIdx = 0; stepIdx < 40; stepIdx += 1) {
      const battle = await readBattle(page);
      if (battle === null) break;
      if (battle.phase === "check" && battle.check !== null) {
        await playBattleCheck(page);
      } else if (battle.phase === "command" && battle.revealed >= battle.message.length) {
        await press(page, "ArrowUp");
        await press(page, "z");
      } else {
        await press(page, "z");
      }
    }
  }
}

test.describe("Buster the Bus Driver, Star-Line Stamp Card & regional souvenir stands", () => {
  test.setTimeout(longFlowTimeout);

  test(
    "real keys: complete Buster's stamp card loop and buy regional souvenir treats",
    { tag: "@smoke" },
    async ({ page }, testInfo) => {
      await page.setViewportSize({ width: 1280, height: 720 });
      await pickPaused(page, "Mr. Pip's arcade");

      // Exit arcade into Cloverhollow Plaza.
      await page.keyboard.down("ArrowLeft");
      await page.keyboard.down("ArrowUp");
      for (let tries = 0; tries < 20; tries += 1) {
        await step(page, 4);
        if ((await readState(page)).transition !== null) break;
      }
      await page.keyboard.up("ArrowLeft");
      await page.keyboard.up("ArrowUp");
      await waitTransition(page, "plaza");

      const start = await readState(page);
      const startCoins = start.coins;
      const startSnacks = start.snacks;
      expect(startCoins).toBeGreaterThanOrEqual(20);

      // Walk south around the plaza to stand in front of Buster (515, 780).
      await walkSafe(page, "x", 1280);
      await walkSafe(page, "y", 875);
      await walkSafe(page, "x", 515);
      await walkSafe(page, "y", 835);
      await press(page, "ArrowUp");
      await expect(page.locator(".sticker-prompt")).toContainText("TALK");

      // Talk to Buster -> verify portrait, speaker badge, and Star-Line Stamp Card intro.
      await press(page, "z");
      await step(page, 2);
      const introLines = await finishDialogue(page, 0, async (text) => {
        if (!text.includes("All aboard, kiddo!")) return;
        await expect(page.locator(".sticker-speaker")).toHaveText("Buster");
        const portrait = page.locator(".sticker-portrait");
        await expect(portrait).toBeVisible();
        await expect(portrait).toHaveAttribute("data-accent", "town");
        await page.waitForTimeout(150);
        await step(page, 1);
      });
      expect(introLines.some((line) => line.includes("Star-Line Stamp Card"))).toBe(true);

      // Walk to the Plaza bus stop and ride to Bubblegum Bay (choice 1).
      await walkSafe(page, "y", 875);
      await walkSafe(page, "x", 955);
      await walkSafe(page, "y", 965);
      await walkSafe(page, "x", 878);
      await press(page, "ArrowUp");
      await expect(page.locator(".sticker-prompt")).toContainText("LOOK");
      await press(page, "z");
      await finishDialogue(page, 1);
      await waitTransition(page, "bay");

      // Talk to Bay Keeper (785, 455) -> wave stamp + Sea-Salt Taffy (9 coins).
      await walkSafe(page, "x", 785);
      await walkSafe(page, "y", 505);
      await press(page, "ArrowUp");
      await expect(page.locator(".sticker-prompt")).toContainText("TALK");
      await press(page, "z");
      const bayLines = await finishDialogue(page, 0, async (text) => {
        if (!text.includes("Bubblegum Bay wave stamp")) return;
        await expect(page.locator(".sticker-speaker")).toHaveText("Bay keeper");
        const portrait = page.locator(".sticker-portrait");
        await expect(portrait).toBeVisible();
        await expect(portrait).toHaveAttribute("data-accent", "town");
        await page.waitForTimeout(150);
        await step(page, 1);
        await captureReview(page, testInfo, "m92-bay-keeper-1280");
      });
      expect(bayLines.some((line) => line.includes("Bubblegum Bay wave stamp"))).toBe(true);
      expect((await readState(page)).coins).toBe(startCoins - 9);
      expect((await readState(page)).treats).toEqual({ "sea-salt-taffy": 1 });

      // Ride the bus from Bubblegum Bay to Pinecone Pass (choice 1).
      await walkSafe(page, "y", 545);
      await walkSafe(page, "x", 355);
      await press(page, "ArrowUp");
      await press(page, "z");
      await finishDialogue(page, 1);
      await waitTransition(page, "pass");

      // Approach Pass Keeper (1190, 910) from the north so the party clears the
      // pass-snowball-coop plates (1175, 965) & snowball (1160, 1005).
      await walkSafe(page, "x", 1090);
      await walkSafe(page, "y", 865);
      await walkSafe(page, "x", 1190);
      await press(page, "ArrowDown");
      await expect(page.locator(".sticker-prompt")).toContainText("TALK");
      await press(page, "z");
      const passLines = await finishDialogue(page, 0, async (text) => {
        if (!text.includes("Pinecone Pass pine stamp")) return;
        await expect(page.locator(".sticker-speaker")).toHaveText("Pass keeper");
        const portrait = page.locator(".sticker-portrait");
        await expect(portrait).toBeVisible();
        await expect(portrait).toHaveAttribute("data-accent", "town");
        await page.waitForTimeout(150);
        await step(page, 1);
        await captureReview(page, testInfo, "m92-pass-keeper-1280");
      });
      expect(passLines.some((line) => line.includes("Pinecone Pass pine stamp"))).toBe(true);
      expect((await readState(page)).coins).toBe(startCoins - 20);
      expect((await readState(page)).treats).toEqual({
        "sea-salt-taffy": 1,
        "maple-brittle": 1,
      });

      // Ride the bus from Pinecone Pass back to Cloverhollow Plaza (choice 0).
      await walkSafe(page, "x", 1090);
      await walkSafe(page, "y", 965);
      await walkSafe(page, "x", 1017);
      await press(page, "ArrowUp");
      await press(page, "z");
      await finishDialogue(page, 0);
      await waitTransition(page, "plaza");

      // Walk back to Buster and claim the Golden Star-Line Whistle + 25 coins + 2 snacks!
      await walkSafe(page, "x", 955);
      await walkSafe(page, "y", 845);
      await walkSafe(page, "x", 760);
      await walkSafe(page, "y", 645);
      await walkSafe(page, "x", 515);
      await walkSafe(page, "y", 740);
      await press(page, "ArrowDown");
      await expect(page.locator(".sticker-prompt")).toContainText("TALK");
      await press(page, "z");
      const rewardLines = await finishDialogue(page, 0);
      expect(rewardLines.some((line) => line.includes("Golden Star-Line Whistle"))).toBe(true);

      const afterReward = await readState(page);
      expect(afterReward.coins).toBe(startCoins - 20 + 25);
      expect(afterReward.snacks).toBe(startSnacks + 2);

      // Open Journal and verify both Buster's completion note and regional treats strip.
      await press(page, "j");
      await expect(page.locator(".journal-book")).toBeVisible();
      await expect(page.locator(".journal-book")).toContainText("Golden Star-Line Whistle");
      const treatsStrip = page.locator(".journal-treats-strip");
      await expect(treatsStrip).toContainText("Sea-Salt Taffy ×1");
      await expect(treatsStrip).toContainText("Maple Pine Brittle ×1");
    },
  );
});
