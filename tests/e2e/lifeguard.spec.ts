import { expect, test, type Page } from "@playwright/test";
import {
  bunHash,
  longFlowTimeout,
  openHarness,
  playWithKeys,
  readHash,
  readState,
  resetPaused,
} from "./helpers";
import { readFileSync } from "node:fs";
import { parseScript } from "../../src/content/script";

test.describe.configure({ timeout: longFlowTimeout });

async function shoot(page: Page, name: string): Promise<void> {
  await expect(page).toHaveScreenshot(`${name}-1280.png`);
  await page.setViewportSize({ width: 874, height: 402 });
  await expect(page).toHaveScreenshot(`${name}-874.png`);
  await page.setViewportSize({ width: 1280, height: 720 });
}

test("real keys: the lifeguard returns, throws beach balls, and shares watermelon",
  { tag: "@smoke" }, async ({ page }) => {
  const path = "tests/sim/scripts/bay/lifeguard.json";
  await page.setViewportSize({ width: 1280, height: 720 });
  await openHarness(page);
  await resetPaused(page, "bay");
  // Her whistle and her watermelon are dialogue lines; the catch is shot
  // with a beach ball at least halfway to Fae, drawn at her `toyScale`.
  const moments: [string, string][] = [
    ["A sharp whistle", "lifeguard-whistle"],
    ["Here, share my watermelon", "lifeguard-calm"],
  ];
  const shot: string[] = [];
  const lifeguardScript = parseScript(JSON.parse(readFileSync(path, "utf8")), path);
  await playWithKeys(page, lifeguardScript, 10, async () => {
    const state = await readState(page);
    const check = state.battle?.check;
    if (check?.kind === "catch") {
      const { arrivals, travelTicks } = check.spec;
      const inFlight = arrivals.some((arrival) =>
        arrival - travelTicks / 2 <= check.tick && check.tick < arrival);
      if (inFlight && !shot.includes("lifeguard-catch")) {
        shot.push("lifeguard-catch");
        await shoot(page, "lifeguard-catch");
      }
      return;
    }
    const dialogue = state.dialogue;
    if (state.battle !== null || dialogue === null ||
      dialogue.revealed < dialogue.text.length) return;
    for (const [start, name] of moments)
      if (!shot.includes(name) && dialogue.text.startsWith(start)) {
        shot.push(name);
        await shoot(page, name);
      }
  });
  expect(shot).toEqual(["lifeguard-whistle", "lifeguard-catch", "lifeguard-calm"]);
  const end = await readState(page);
  expect([end.area, end.critters.lifeguard]).toEqual(["bay", "calm"]);
  expect(end.stickers).toContain("lifeguard");
  expect(await readHash(page)).toBe(await bunHash(path, "bay"));
});
