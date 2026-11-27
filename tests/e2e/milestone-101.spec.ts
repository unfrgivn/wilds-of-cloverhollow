import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { serializeSave, setInkVariables } from "../../src/core";
import { longFlowTimeout, openHarness, readState, resetPaused, step, walk } from "./helpers";

async function press(page: Page, key = "z"): Promise<void> {
  await page.keyboard.down(key);
  await step(page, 1);
  await page.keyboard.up(key);
  await step(page, 1);
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

async function walkSafe(page: Page, axis: "x" | "y", target: number): Promise<void> {
  for (let tries = 0; tries < 4; tries += 1) {
    await walk(page, axis, target);
    const current = await readState(page);
    if (current.battle === null) {
      if (Math.abs(current.player[axis] - target) <= 8) return;
      continue;
    }
    // Escape a roaming critter using real keys (advance intro -> Run -> close).
    for (let stepIdx = 0; stepIdx < 24; stepIdx += 1) {
      const phase = (await readState(page)).battle?.phase ?? null;
      if (phase === null) break;
      if (phase === "command") {
        await press(page, "ArrowUp");
        await press(page, "z");
      } else {
        await press(page, "z");
      }
    }
  }
}

async function continueFromSave(page: Page, encodedSave: string): Promise<void> {
  await page.evaluate((encoded) => {
    localStorage.setItem("CapacitorStorage.cloverhollow-save", encoded);
  }, encodedSave);
  await page.goto("./");
  await page.waitForFunction(() => Boolean(window.__cloverhollow));
  await page.keyboard.press("Enter");
  await expect
    .poll(() => page.evaluate(() => window.__cloverhollow?.boot.title()))
    .toBeNull();
  await page.evaluate(() => window.__cloverhollow?.pause());
  await step(page, 2);
}

test.describe("Milestone 94: Living World Landmarks", () => {
  test.setTimeout(longFlowTimeout);

  test(
    "Bubblegum Bay bay-boats cruise awards +10 coins and Sea-Glass Clover Journal note",
    { tag: "@smoke" },
    async ({ page }, testInfo) => {
      await page.setViewportSize({ width: 1280, height: 720 });
      await openHarness(page);
      await resetPaused(page, "bay");

      const start = await readState(page);
      const startCoins = start.coins;

      // Walk with real keys from plaza-road spawn (180, 545) to south pier bay-boats (1350, 650).
      await walkSafe(page, "x", 760);
      await walkSafe(page, "y", 665);
      await walkSafe(page, "x", 1350);
      await press(page, "ArrowUp");
      await expect(page.locator(".sticker-prompt")).toContainText("LOOK");

      // Inspect bay-boats and choose the sunny cove rowboat cruise.
      await press(page, "z");
      await step(page, 2);
      const lines = await finishDialogue(page, 0, async (text) => {
        if (!text.includes("Free community boats")) return;
        await expect(page.locator(".sticker-choice")).toHaveCount(2);
        await step(page, 1);
        await captureReview(page, testInfo, "m94-bay-boats-1280");
      });

      expect(lines.some((line) => line.includes("Sea-Glass Clover"))).toBe(true);
      const after = await readState(page);
      expect(after.coins).toBe(startCoins + 10);

      // Open Journal with real key J and verify the Sea-Glass Clover note appears.
      await page.keyboard.press("j");
      await step(page, 2);
      await expect(page.locator(".journal-book")).toBeVisible();
      await expect(page.locator(".journal-notes")).toContainText("Sea-Glass Clover");
      await page.keyboard.press("j");
      await step(page, 2);
    },
  );

  test(
    "Pinecone Pass pass-sanctuary board tallies calmed species and awards the Ranger Basket at 3+",
    { tag: "@smoke" },
    async ({ page }, testInfo) => {
      await page.setViewportSize({ width: 1280, height: 720 });
      await openHarness(page);
      await resetPaused(page, "pass");

      // Walk with real keys from bus spawn (930, 1015) up to pass-sanctuary (1400, 640),
      // keeping west of the east cliffside trail trigger (x >= 1470).
      await walkSafe(page, "x", 1360);
      await walkSafe(page, "y", 665);
      await walkSafe(page, "x", 1395);
      await press(page, "ArrowUp");
      await expect(page.locator(".sticker-prompt")).toContainText("LOOK");

      // First check with 0 calmed species -> progress hint, no basket.
      await press(page, "z");
      await step(page, 2);
      const beforeLines = await finishDialogue(page);
      expect(beforeLines.some((line) => line.includes("0 of 8"))).toBe(true);
      expect(
        beforeLines.some((line) => line.includes("Calm 3 mountain or woodland critters")),
      ).toBe(true);

      // Save with 3 calmed mountain/woodland species stickers (hamster, penguin, owl) and Continue.
      const midState = await readState(page);
      const enriched = serializeSave({
        ...midState,
        coins: 4,
        snacks: 1,
        stickers: ["hiker-hamster", "waddle-penguin", "whispering-owl"],
      });
      await continueFromSave(page, enriched);

      // Walk with real keys from bus spawn (930, 1015) back up to pass-sanctuary (1400, 640).
      await walkSafe(page, "x", 1360);
      await walkSafe(page, "y", 665);
      await walkSafe(page, "x", 1395);
      await press(page, "ArrowUp");
      await expect(page.locator(".sticker-prompt")).toContainText("LOOK");
      await press(page, "z");
      await step(page, 2);
      const rewardLines = await finishDialogue(page, 0, async (text) => {
        if (!text.includes("Sanctuary Ranger Basket")) return;
        await step(page, 1);
        await captureReview(page, testInfo, "m94-pass-sanctuary-1280");
      });

      expect(rewardLines.some((line) => line.includes("3 of 8"))).toBe(true);
      expect(rewardLines.some((line) => line.includes("twelve shiny coins"))).toBe(true);

      const after = await readState(page);
      expect(after.coins).toBe(16);
      expect(after.snacks).toBe(3);

      // Verify Journal entry for the Sanctuary Ranger Basket.
      await page.keyboard.press("j");
      await step(page, 2);
      await expect(page.locator(".journal-notes")).toContainText(
        "Pinecone Pass Wildlife Sanctuary",
      );
      await page.keyboard.press("j");
      await step(page, 2);
    },
  );

  test(
    "School Nurse Holly clinic gives a free +2 snack top-up after hall_pass when snacks < 2",
    { tag: "@smoke" },
    async ({ page }, testInfo) => {
      await page.setViewportSize({ width: 1280, height: 720 });
      await openHarness(page);
      await resetPaused(page, "school");

      // Save a post-hall_pass state with 0 snacks and Continue via the real save flow.
      const base = await readState(page);
      const lowSnackSave = serializeSave({
        ...base,
        snacks: 0,
        ink: setInkVariables(base.ink, { hall_pass: true }),
      });
      await continueFromSave(page, lowSnackSave);

      // Walk with real keys from front-doors spawn (290, 625) to Nurse Holly (955, 535),
      // stopping with breathing room so Nurse Holly's face and scrubs stay clearly visible.
      await walk(page, "x", 912);
      await walk(page, "y", 550);
      await press(page, "ArrowRight");
      await expect(page.locator(".sticker-prompt")).toContainText("TALK");

      // Talk to Nurse Holly -> verify portrait + free apple juice & cracker pack choice -> accept!
      await press(page, "z");
      await step(page, 2);
      const lines = await finishDialogue(page, 0, async (text) => {
        if (!text.includes("running low on snacks")) return;
        await expect(page.locator(".sticker-speaker")).toHaveText("Nurse Holly");
        await expect(page.locator(".sticker-portrait")).toBeVisible();
        await expect(page.locator(".sticker-choice")).toHaveCount(2);
        await step(page, 1);
        await captureReview(page, testInfo, "m94-nurse-holly-1280");
      });

      expect(lines.some((line) => line.includes("apple-juice snacks"))).toBe(true);
      const after = await readState(page);
      expect(after.snacks).toBe(2);
    },
  );
});
