import { expect, test } from "@playwright/test";
import {
  bunHash, longFlowTimeout, openHarness, playWithKeys, queueScript, readHash,
  readState, recording, renderInfo, resetPaused, step,
} from "./helpers";

test.describe.configure({ timeout: longFlowTimeout });

test("real keys switch on the blacklight and reveal the pass trail", async ({ page }) => {
  const path = "tests/sim/scripts/pass-party/lantern.json";
  await page.setViewportSize({ width: 1280, height: 720 });
  await openHarness(page);
  await resetPaused(page, "pass-party");
  const jordanPath = "tests/sim/scripts/pass-party/jordan.json";
  const jordan = recording(jordanPath);
  await queueScript(page, jordan);
  await step(page, jordan.reduce((sum, segment) => sum + segment.ticks, 0));
  const lanternStart = recording(path).findIndex((segment) => segment.frame.lantern === true);
  if (lanternStart < 0) throw new Error("lantern press missing");
  let sawOn = false;
  let markerShot = false;
  const lines: string[] = [];
  await playWithKeys(page, recording(path).slice(lanternStart), 24, async () => {
    const info = await renderInfo(page);
    const state = await readState(page);
    if (info.lantern.on) {
      expect(info.lantern.glows.length).toBeGreaterThan(0);
      if (!sawOn) {
        await expect(page).toHaveScreenshot("pass-lantern-on-1280.png");
        await page.setViewportSize({ width: 874, height: 402 });
        await expect(page).toHaveScreenshot("pass-lantern-on-874.png");
        await page.setViewportSize({ width: 1280, height: 720 });
      }
      sawOn = true;
    }
    if (state.dialogue !== null && state.dialogue.revealed >= state.dialogue.text.length) {
      lines.push(state.dialogue.text);
      if (state.dialogue.knot === "old_trail_marker" && !markerShot) {
        markerShot = true;
        await expect(page).toHaveScreenshot("pass-trail-marker.png");
      }
    }
  });
  expect(sawOn).toBe(true);
  expect(markerShot).toBe(true);
  expect(lines).toEqual(expect.arrayContaining([
    "Glowing doodles on the lift tower! A masked face, a swirl, and a star.",
    "A glowing arrow, painted on a tree! It points west, deep into the pines.",
  ]));
  const end = await readState(page);
  expect(end.lantern).toBe(false);
  expect(await renderInfo(page)).toMatchObject({ lantern: { on: false, glows: [] } });
  expect(await readHash(page)).toBe(bunHash(path, "pass-party"));
  await page.keyboard.press("j");
  await step(page, 1);
  await expect(page.locator(".journal-note").filter({ hasText: "Whispering Woods" }))
    .toBeVisible();
});

test("touch lantern button toggles at the phone layout", async ({ page }) => {
  await page.setViewportSize({ width: 874, height: 402 });
  await page.goto("./?touch=1");
  await page.waitForFunction(() => Boolean(window.__cloverhollow));
  await resetPaused(page, "pass-party");
  const jordan = recording("tests/sim/scripts/pass-party/jordan.json");
  await queueScript(page, jordan);
  await step(page, jordan.reduce((sum, segment) => sum + segment.ticks, 0));
  const button = page.locator(".touch-lantern");
  await expect(button).toBeVisible();
  await button.click();
  await step(page, 1);
  expect((await renderInfo(page)).lantern.on).toBe(true);
  await step(page, 30);
  await expect(page).toHaveScreenshot("touch-lantern-on-874.png");
  await button.click();
  await step(page, 1);
  expect((await renderInfo(page)).lantern.on).toBe(false);
});
