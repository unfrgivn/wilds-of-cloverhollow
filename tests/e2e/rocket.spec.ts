import { expect, test, type Page } from "@playwright/test";
import {
  bunHash,
  longFlowTimeout,
  openHarness,
  playWithKeys,
  readHash,
  readState,
  recording,
  resetPaused,
} from "./helpers";

// Milestone 58: the arcade nearer its concept, seen with real keys. The
// recorded run (tools/sim/record-rocket.ts) looks at the new rocket cabinet
// while Mr. Pip's spell fizzes on it, calms him, and looks again. The end
// state must hash the same as Bun's replay of the same run.

test.describe.configure({ timeout: longFlowTimeout });

// Only what the watcher reads.
async function probe(page: Page): Promise<{ text: string | null; typed: boolean }> {
  return page.evaluate(() => {
    const state = window.__cloverhollow?.getState();
    if (state === undefined) throw new Error("hook unavailable");
    const line = state.dialogue;
    return {
      text: line?.knot === "rocket_cabinet" ? line.text : null,
      typed: line !== null && line.revealed >= line.text.length,
    };
  });
}

// The same moment on a desktop, then on a phone.
async function shoot(page: Page, name: string): Promise<void> {
  await expect(page).toHaveScreenshot(`${name}-1280.png`);
  await page.setViewportSize({ width: 874, height: 402 });
  await expect(page).toHaveScreenshot(`${name}-874.png`);
  await page.setViewportSize({ width: 1280, height: 720 });
}

test("real keys: the rocket cabinet, fizzy and then calm", async ({ page }) => {
  const path = "tests/sim/scripts/arcade/rocket.json";
  await page.setViewportSize({ width: 1280, height: 720 });
  await openHarness(page);
  await resetPaused(page, "arcade");
  const shots = new Set<string>();
  await playWithKeys(page, recording(path), 10, async () => {
    const now = await probe(page);
    if (now.typed && now.text?.startsWith("A purple cabinet with a neon rocket") === true &&
      !shots.has("calm")) {
      shots.add("calm");
      // The room with its neon signs, the cabinet beside Fae, and its line.
      await expect(page.locator(".sticker-text-revealed")).toHaveText(
        "A purple cabinet with a neon rocket on its side. Stars twinkle across its screen.");
      await shoot(page, "rocket-cabinet");
    }
  });
  expect([...shots]).toEqual(["calm"]);
  const end = await readState(page);
  expect({ dialogue: end.dialogue, keeper: end.critters["arcade-keeper"] })
    .toEqual({ dialogue: null, keeper: "calm" });
  expect(await readHash(page)).toBe(bunHash(path, "arcade"));
});
