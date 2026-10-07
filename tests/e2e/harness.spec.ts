import { expect, test, type Page } from "@playwright/test";
import type { ActionFrame, State } from "../../src/core";
import { readFileSync } from "node:fs";
import { parseScript } from "../../src/content/script";
import {
  longFlowTimeout,
  openHarness,
  resetPaused,
  resume,
  step,
  queueScript,
  readState,
  readHash,
  bunHash,
  pixelAt,
} from "./helpers";

test("stepping with a held real key moves 4 units per tick", async ({
  page,
}) => {
  await openHarness(page);
  await resetPaused(page);
  await page.keyboard.down("ArrowRight");
  await step(page, 30);
  await page.keyboard.up("ArrowRight");
  expect((await readState(page)).player.x).toBe(420);
  await expect(page).toHaveScreenshot("harness.png");
});

test("a real key tap shorter than one tick still moves one tick", async ({
  page,
}) => {
  await openHarness(page);
  await resetPaused(page);
  // keydown and keyup both arrive before the next tick samples the keyboard.
  await page.keyboard.press("ArrowRight");
  await step(page, 10);
  const state = await readState(page);
  expect(state.player.x).toBe(304);
  expect(state.facing).toBe("right");
});

test("holding a real key moves the player in real time", async ({ page }) => {
  await openHarness(page);
  await resetPaused(page);
  await resume(page);
  const before = (await readState(page)).player.x;
  await page.keyboard.down("ArrowRight");
  await page.waitForTimeout(500);
  await page.keyboard.up("ArrowRight");
  expect((await readState(page)).player.x).toBeGreaterThan(before);
});

test("real keys stop at the room wall, radius respected", async ({ page }) => {
  await openHarness(page);
  await resetPaused(page);
  // 120 ticks at 4 units per tick is far more than the 240 units to the wall.
  await page.keyboard.down("ArrowLeft");
  await step(page, 120);
  await page.keyboard.up("ArrowLeft");
  const x = (await readState(page)).player.x;
  expect(x).toBeGreaterThanOrEqual(60);
  expect(x).toBeLessThan(60.01);
});

test("real keys stop at a blocker, radius respected", async ({ page }) => {
  await openHarness(page);
  await resetPaused(page);
  await page.keyboard.down("ArrowRight");
  await step(page, 150);
  await page.keyboard.up("ArrowRight");
  const x = (await readState(page)).player.x;
  expect(x).toBeLessThanOrEqual(830.01);
  expect(x).toBeGreaterThan(800);
});

for (const item of [
  { name: "harness-600", fixture: "harness" },
  { name: "concave-corners", fixture: "harness" },
  { name: "door-round-trip", fixture: "new-game" },
  { name: "morning", fixture: "new-game" },
  { name: "frog-win", fixture: "plaza" },
  { name: "pup-win", fixture: "park" },
  { name: "hall-pass", fixture: "school" },
  { name: "raccoon", fixture: "school" },
  { name: "chapter-one", fixture: "new-game" },
  { name: "bay", fixture: "bay" },
  { name: "bus", fixture: "bay" },
  { name: "trail", fixture: "pass" },
  { name: "lookout", fixture: "trail" },
]) {
  const { name, fixture } = item;
  test(`browser (V8) and Bun (JavaScriptCore) agree on ${name}`, async ({
    page,
  }) => {
    // Replays a whole script in the browser and in Bun (chapter-one is the
    // whole story so far).
    test.setTimeout(longFlowTimeout);
    // Scripts live in tests/sim/scripts/<fixture>/ (tools/sim/run-all.ts).
    const path = `tests/sim/scripts/${fixture}/${name}.json`;
    const script = parseScript(JSON.parse(readFileSync(path, "utf8")), path);
    await openHarness(page);
    await resetPaused(page, fixture);
    await queueScript(page, script);
    await step(
      page,
      script.reduce((total, segment) => total + segment.ticks, 0),
    );
    const browserHash = await readHash(page);
    expect(browserHash).toBe(bunHash(path, fixture));
    console.log(`${name}: browser and Bun hash ${browserHash}`);
  });
}

test("nothing renders inside wide letterbox bars", async ({ page }) => {
  await page.setViewportSize({ width: 2400, height: 720 });
  await openHarness(page);
  // A fixture reset skips the title, which (correctly) covers the bars.
  await resetPaused(page);
  const png = await page.screenshot();
  const background = [248, 237, 207];
  expect(await pixelAt(page, png, 0, 360)).toEqual(background);
  expect(await pixelAt(page, png, 2399, 360)).toEqual(background);
});

test("touch stick moves and confirm taps for one tick", async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== "chromium", "CDP touch dispatch is Chromium-only");
  await page.goto("./?touch=1");
  await page.waitForFunction(() => Boolean(window.__cloverhollow));
  await resetPaused(page);
  const client = await page.context().newCDPSession(page);
  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: 120, y: 360, id: 7 }],
  });
  await client.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: 180, y: 360, id: 7 }],
  });
  await step(page, 30);
  const moved = await readState(page);
  expect(moved.player.x).toBeGreaterThan(300);
  await client.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: 1160, y: 650, id: 8 }],
  });
  await client.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await step(page, 1);
  expect((await readState(page)).previousInput.confirm).toBe(true);
  await step(page, 1);
  expect((await readState(page)).previousInput.confirm).toBe(false);
});

test.describe("touchscreen taps", () => {
  test.use({ hasTouch: true });

  test("a touchscreen confirm tap is held for one tick", async ({ page }) => {
    await page.goto("./?touch=1");
    await page.waitForFunction(() => Boolean(window.__cloverhollow));
    await resetPaused(page);
    await page.touchscreen.tap(1160, 650);
    await step(page, 1);
    expect((await readState(page)).previousInput.confirm).toBe(true);
    await step(page, 1);
    expect((await readState(page)).previousInput.confirm).toBe(false);
  });
});

test("touch controls are opt-in on desktop", async ({ page }) => {
  await openHarness(page);
  expect(await page.locator(".touch-controls").count()).toBe(0);
  await page.goto("./?touch=1");
  await page.waitForFunction(() => Boolean(window.__cloverhollow));
  expect(await page.locator(".touch-controls").count()).toBe(1);
});

test("WebKit keeps touch controls in separate safe-area regions", async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== "webkit", "WebKit layout coverage");
  await page.setViewportSize({ width: 874, height: 402 });
  await page.goto("/?touch=1");
  await page.waitForFunction(() => Boolean(window.__cloverhollow));
  // The title hides the touch controls; a fixture reset skips it.
  await resetPaused(page);
  const menu = await page.locator(".touch-menu").boundingBox();
  const confirm = await page.locator(".touch-confirm").boundingBox();
  const cancel = await page.locator(".touch-cancel").boundingBox();
  const stick = await page.locator(".touch-stick").boundingBox();
  expect(menu).not.toBeNull();
  expect(confirm).not.toBeNull();
  expect(cancel).not.toBeNull();
  expect(stick).not.toBeNull();
  if (menu === null || confirm === null || cancel === null || stick === null)
    return;
  expect(menu.x + menu.width).toBeGreaterThan(800);
  expect(menu.y).toBeLessThan(80);
  expect(menu.x + menu.width).toBeLessThanOrEqual(874);
  expect(menu.y + menu.height).toBeLessThan(confirm.y);
  expect(menu.y + menu.height).toBeLessThanOrEqual(cancel.y);
  expect(stick.x).toBeGreaterThanOrEqual(20);
});

test.describe("high-density screens", () => {
  // iPhones report devicePixelRatio 3; the backing store is capped at 2x.
  test.use({ deviceScaleFactor: 3 });

  test("the canvas fills the viewport with a 2x backing store", async ({
    page,
  }) => {
    await openHarness(page);
    const size = await page.evaluate(() => {
      const canvas = document.querySelector("canvas");
      if (canvas === null) throw new Error("canvas missing");
      const box = canvas.getBoundingClientRect();
      return {
        cssWidth: box.width,
        cssHeight: box.height,
        backingWidth: canvas.width,
        backingHeight: canvas.height,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      };
    });
    expect(size.cssWidth).toBe(size.viewportWidth);
    expect(size.cssHeight).toBe(size.viewportHeight);
    expect(size.backingWidth).toBe(size.viewportWidth * 2);
    expect(size.backingHeight).toBe(size.viewportHeight * 2);
  });
});
