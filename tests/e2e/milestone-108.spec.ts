import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { serializeSave, setInkVariables } from "../../src/core";
import {
  longFlowTimeout,
  openHarness,
  readState,
  renderInfo,
  resetPaused,
  step,
  walk,
} from "./helpers";

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
    await press(page, "z");
  }
  throw new Error("dialogue did not close");
}

async function walkSafe(page: Page, axis: "x" | "y", target: number): Promise<void> {
  for (let tries = 0; tries < 4; tries += 1) {
    await walk(page, axis, target);
    const current = await readState(page);
    if (current.battle === null) {
      if (Math.abs(current.player[axis] - target) <= 10) return;
      continue;
    }
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

test.describe("Milestone 107: Living Valley Townspeople & Story-Reactive Atmosphere", () => {
  test.setTimeout(longFlowTimeout);

  test(
    "Café: Dad reacts to Star-Line Explorer and cafeCinnamonSteam renders cleanly",
    { tag: "@smoke" },
    async ({ page }, testInfo) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      await page.setViewportSize({ width: 1280, height: 720 });
      await openHarness(page);
      await resetPaused(page, "cafe");

      const baseInfo = await renderInfo(page);
      const baseParticles = baseInfo.atmosphereParticles;
      expect(baseParticles).toBe(14);

      // Load Café with met_dad + spice_returned + buster_reward.
      const baseState = await readState(page);
      const enriched = serializeSave({
        ...baseState,
        ink: setInkVariables(baseState.ink, {
          met_dad: true,
          spice_quest: true,
          spice_found: true,
          spice_returned: true,
          buster_reward: true,
        }),
      });
      await continueFromSave(page, enriched);
      await step(page, 60);

      const activeInfo = await renderInfo(page);
      expect(activeInfo.atmosphereParticles).toBe(baseParticles + 6);

      // Walk with real keys from the Café door spawn (360, 538) to Dad (462, 624).
      await walk(page, "x", 462);
      await walk(page, "y", 580);
      await press(page, "ArrowDown");
      await expect(page.locator(".sticker-prompt")).toContainText("TALK");

      await press(page, "z");
      await step(page, 2);
      const lines = await finishDialogue(page, async (text) => {
        if (!text.includes("Star-Line Explorer")) return;
        await expect(page.locator(".sticker-speaker")).toHaveText("Dad");
        await step(page, 1);
        await captureReview(page, testInfo, "m107-dad-milestone-1280");
      });

      expect(lines.some((line) => line.includes("Star-Line Explorer"))).toBe(true);
      expect(lines.join(" ")).not.toMatch(/\bMilo\b/i);
      expect(errors).toEqual([]);
    },
  );

  test(
    "Plaza: plazaStarGlow sparkles over the fountain and Buster celebrates friend homes",
    { tag: "@smoke" },
    async ({ page }, testInfo) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      await page.setViewportSize({ width: 1280, height: 720 });
      await openHarness(page);
      await resetPaused(page, "plaza");

      const baseInfo = await renderInfo(page);
      const baseParticles = baseInfo.atmosphereParticles;
      expect(baseParticles).toBe(26);

      // Load Plaza with buster_reward + both friend homes visited, standing south of the fountain.
      const baseState = await readState(page);
      const enriched = serializeSave({
        ...baseState,
        critters: { ...baseState.critters, "fountain-frog": "calm" },
        ink: setInkVariables(baseState.ink, {
          buster_quest: true,
          stamp_bay: true,
          stamp_pass: true,
          buster_reward: true,
          sue_cottage_visited: true,
          jordan_cabin_visited: true,
        }),
      });
      await continueFromSave(page, enriched);
      await step(page, 60);

      const activeInfo = await renderInfo(page);
      expect(activeInfo.atmosphereParticles).toBe(baseParticles + 8);

      // Walk with real keys around the south plaza to Buster (515, 780) keeping fountain in frame.
      await walkSafe(page, "x", 1280);
      await walkSafe(page, "y", 875);
      await walkSafe(page, "x", 515);
      await walkSafe(page, "y", 835);
      await press(page, "ArrowUp");
      await expect(page.locator(".sticker-prompt")).toContainText("TALK");

      await press(page, "z");
      await step(page, 2);
      const lines = await finishDialogue(page, async (text) => {
        if (!text.includes("Sue's beach cottage")) return;
        await expect(page.locator(".sticker-speaker")).toHaveText("Buster");
        await step(page, 1);
        await captureReview(page, testInfo, "m107-plaza-starglow-1280");
      });

      expect(lines.some((line) => line.includes("Star-Line Explorer"))).toBe(true);
      expect(lines.some((line) => line.includes("Sue's beach cottage"))).toBe(true);
      expect(errors).toEqual([]);
    },
  );

  test(
    "Pass: passHearthWisps chimney curls rise above Mrs. Flurry's Ski Lodge roof",
    { tag: "@smoke" },
    async ({ page }, testInfo) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      await page.setViewportSize({ width: 1280, height: 720 });
      await openHarness(page);
      await resetPaused(page, "pass");

      const baseInfo = await renderInfo(page);
      const baseParticles = baseInfo.atmosphereParticles;
      expect(baseParticles).toBe(32);

      // Load Pinecone Pass with sanctuary_gift active.
      const baseState = await readState(page);
      const enriched = serializeSave({
        ...baseState,
        ink: setInkVariables(baseState.ink, {
          sanctuary_gift: true,
          lodge_open: true,
        }),
      });
      await continueFromSave(page, enriched);
      await step(page, 60);

      const activeInfo = await renderInfo(page);
      expect(activeInfo.atmosphereParticles).toBe(baseParticles + 6);

      // Walk north around the snowman to (1050, 480) to frame the Ski Lodge roof & chimney cleanly.
      await walkSafe(page, "x", 1360);
      await walkSafe(page, "y", 610);
      await walkSafe(page, "x", 1050);
      await walkSafe(page, "y", 480);
      await press(page, "ArrowRight");
      await step(page, 24);
      const framed = await readState(page);
      expect(framed.player.y).toBeLessThan(520);
      await captureReview(page, testInfo, "m107-pass-hearth-1280");

      expect(errors).toEqual([]);
    },
  );
});
