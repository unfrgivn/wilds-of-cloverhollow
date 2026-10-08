import { expect, test, type Page } from "@playwright/test";
import {
  openHarness, queueScript, readState, recording, resetPaused, step,
} from "./helpers";

declare global {
  interface Window {
    __gamepadState?: { buttons: boolean[]; axes: number[] };
  }
}

async function installGamepad(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const state = { buttons: Array.from({ length: 16 }, () => false), axes: [0, 0] };
    Object.defineProperty(window, "__gamepadState", { value: state });
    Object.defineProperty(navigator, "getGamepads", {
      configurable: true,
      value: () => [{
        mapping: "standard",
        buttons: state.buttons.map((pressed) => ({ pressed, value: pressed ? 1 : 0 })),
        axes: state.axes,
      }],
    });
  });
}

async function setPad(
  page: Page,
  options: { axes?: [number, number]; buttons?: number[] },
): Promise<void> {
  await page.evaluate((next) => {
    const state = window.__gamepadState;
    if (state === undefined) throw new Error("gamepad unavailable");
    state.axes = next.axes ?? [0, 0];
    state.buttons.fill(false);
    for (const button of next.buttons ?? []) state.buttons[button] = true;
  }, options);
  // The game polls the pad on animation frames, not inside harness steps, so
  // let two frames pass for the real poller to see the new device state.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
}

async function pressPad(page: Page, button: number): Promise<void> {
  await setPad(page, { buttons: [button] });
  await step(page, 1);
  await setPad(page, {});
  await step(page, 2);
}

test.describe.configure({ timeout: 120_000 });

test("stick and d-pad movement, including d-pad priority", async ({ page }) => {
  await installGamepad(page);
  await openHarness(page);
  await resetPaused(page, "new-game");
  const start = await readState(page);
  await setPad(page, { axes: [1, 0] });
  await step(page, 8);
  const afterStick = await readState(page);
  expect(afterStick.player.x).toBeGreaterThan(start.player.x);

  await setPad(page, { axes: [1, 0], buttons: [14] });
  await step(page, 2);
  const afterDpad = await readState(page);
  expect(afterDpad.player.x).toBeLessThan(afterStick.player.x);
  await setPad(page, {});
});

test("Start opens the journal and B closes it", async ({ page }) => {
  await installGamepad(page);
  await openHarness(page);
  await resetPaused(page, "harness");
  await pressPad(page, 9);
  await expect(page.locator(".journal-book")).toBeVisible();
  await pressPad(page, 1);
  await expect(page.locator(".journal-book")).toBeHidden();
});

test("A starts the window dialogue and X toggles the lantern", async ({ page }) => {
  await installGamepad(page);
  await openHarness(page);
  await resetPaused(page, "new-game");
  await setPad(page, { axes: [1, 0] });
  await step(page, 28);
  await setPad(page, { axes: [0, -1] });
  await step(page, 18);
  await setPad(page, {});
  await expect(page.locator(".sticker-prompt")).toBeVisible();
  await expect(page.locator(".sticker-dialogue")).toBeHidden();
  await pressPad(page, 0);
  await expect(page.locator(".sticker-dialogue")).toBeVisible();

  await resetPaused(page, "pass-party");
  const jordan = recording("tests/sim/scripts/pass-party/jordan.json");
  await queueScript(page, jordan);
  await step(page, jordan.reduce((ticks, segment) => ticks + segment.ticks, 0));
  const before = await readState(page);
  expect(before.lantern).toBe(false);
  await pressPad(page, 2);
  expect((await readState(page)).lantern).toBe(true);
  await pressPad(page, 2);
  expect((await readState(page)).lantern).toBe(false);
  await expect(page).toHaveScreenshot("gamepad-lantern.png");
});
