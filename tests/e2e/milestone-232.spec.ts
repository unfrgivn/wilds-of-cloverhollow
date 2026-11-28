import { expect, test, type Page } from "@playwright/test";
import { longFlowTimeout, openHarness, readBattle, resetPaused, step } from "./helpers";

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

async function tapKey(page: Page, key: string): Promise<void> {
  await page.keyboard.down(key);
  await step(page, 1);
  await page.keyboard.up(key);
  await step(page, 1);
}

async function advanceUntilCommand(page: Page): Promise<void> {
  for (let count = 0; count < 60; count += 1) {
    const battle = await readBattle(page);
    if (battle?.phase === "command" && battle.revealed >= battle.message.length) return;
    await tapKey(page, "Enter");
  }
  throw new Error("timed out advancing battle to command phase");
}

test.describe("Milestone 232: Target-Aware & Gamepad-Adapted Battle Field Guide Peek", () => {
  test.setTimeout(longFlowTimeout);

  test(
    "updates Peek name, check mechanic, and live NEXT MOVE intent when switching bay-duo targets",
    { tag: "@smoke" },
    async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      await page.setViewportSize({ width: 1280, height: 720 });
      await openHarness(page);
      await resetPaused(page, "bay-duo");
      await advanceUntilCommand(page);

      const plates = page.locator(".battle-foe-plate");
      await expect(plates).toHaveCount(2);

      const peekCard = page.locator(".battle-peek-card");
      await expect(peekCard).toBeHidden();

      // Target 0 (Zoomie Pup): open Peek via KeyI.
      await page.keyboard.press("i");
      await expect(peekCard).toBeVisible();
      await expect(peekCard).toHaveAttribute("data-critter", "pup");
      await expect(peekCard.locator(".battle-peek-name")).toHaveText("Zoomie Pup");
      await expect(peekCard.locator(".battle-peek-badge.is-check")).toHaveText("Toy Catch");
      await expect(peekCard.locator(".battle-peek-intent")).toBeVisible();
      await expect(peekCard.locator(".battle-peek-intent")).toContainText("NEXT MOVE");
      await expect(peekCard.locator(".battle-peek-intent")).toContainText("Sharing Fizz");
      await expect(peekCard.locator(".battle-peek-phase2")).toBeHidden();

      // Close Peek, click foe plate #2 (Snappy Crab), and reopen Peek via KeyI.
      await page.keyboard.press("Escape");
      await expect(peekCard).toBeHidden();

      await plates.nth(1).click();
      await step(page, 1);
      expect((await readBattle(page))?.targetIndex).toBe(1);

      await page.keyboard.press("i");
      await expect(peekCard).toBeVisible();
      await expect(peekCard).toHaveAttribute("data-critter", "crab");
      await expect(peekCard.locator(".battle-peek-name")).toHaveText("Snappy Crab");
      await expect(peekCard.locator(".battle-peek-badge.is-check")).toHaveText("Rhythm Chain");
      await expect(peekCard.locator(".battle-peek-intent")).toBeVisible();
      await expect(peekCard.locator(".battle-peek-intent")).toContainText("NEXT MOVE");
      await expect(peekCard.locator(".battle-peek-intent")).toContainText("Calling Cheer");
      await expect(peekCard.locator(".battle-peek-tip")).toContainText("confirm");

      expect(errors).toEqual([]);
    },
  );

  test(
    "adapts Peek Card tip copy live from confirm to A when switching to synthetic Gamepad",
    { tag: "@smoke" },
    async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      await installGamepad(page);
      await page.setViewportSize({ width: 1280, height: 720 });
      await openHarness(page);
      await resetPaused(page, "bay-duo");
      await advanceUntilCommand(page);

      // Switch target to foe 1 (Snappy Crab), whose Rhythm Chain tip says "Tap confirm...".
      await page.locator(".battle-foe-plate").nth(1).click();
      await step(page, 1);
      expect((await readBattle(page))?.targetIndex).toBe(1);

      const peekCard = page.locator(".battle-peek-card");
      await page.keyboard.press("i");
      await expect(peekCard).toBeVisible();
      await expect(peekCard.locator(".battle-peek-tip")).toContainText("confirm");

      // Dismiss with gamepad B (button 1) and reopen with gamepad Select (button 8):
      // inputMode switches to "gamepad" and adapts "confirm" -> "A" live.
      await pressPad(page, 1);
      await expect(peekCard).toBeHidden();
      await pressPad(page, 8);
      await expect(peekCard).toBeVisible();
      await expect(peekCard.locator(".battle-peek-name")).toHaveText("Snappy Crab");
      await expect(peekCard.locator(".battle-peek-tip")).not.toContainText("confirm");
      await expect(peekCard.locator(".battle-peek-tip")).toContainText("Tap A right as");

      expect(errors).toEqual([]);
    },
  );
});
