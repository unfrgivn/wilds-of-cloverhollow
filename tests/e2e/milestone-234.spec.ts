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

async function holdKey(page: Page, key: string, ticks: number): Promise<void> {
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

async function advanceUntilCommand(page: Page): Promise<void> {
  for (let count = 0; count < 60; count += 1) {
    const battle = await readBattle(page);
    if (battle?.phase === "command" && battle.revealed >= battle.message.length) return;
    await tapKey(page, "Enter");
  }
  throw new Error("timed out advancing battle to command phase");
}

async function recordedEffects(page: Page): Promise<string[]> {
  return page.evaluate(() => [...(window.__cloverhollow?.sound.effects() ?? [])]);
}

async function walkToFrogCommand(page: Page): Promise<void> {
  for (const [key, ticks] of [
    ["ArrowDown", 25],
    ["ArrowLeft", 15],
    ["ArrowDown", 50],
    ["ArrowLeft", 35],
    ["ArrowUp", 38],
  ] as const) {
    await holdKey(page, key, ticks);
  }
  await expect(page.locator("html")).toHaveAttribute("data-battle", "open");
  await advanceUntilCommand(page);
}

test.describe("Milestone 234: In-Peek Multi-Foe Field Guide Flipper", () => {
  test.setTimeout(longFlowTimeout);

  test(
    "flips multi-foe Peek live via › click, ArrowLeft, and Gamepad RB with atlas-pin foley",
    { tag: "@smoke" },
    async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      await installGamepad(page);
      await page.setViewportSize({ width: 1280, height: 720 });
      await openHarness(page);
      await resetPaused(page, "bay-duo");
      await advanceUntilCommand(page);

      const peekCard = page.locator(".battle-peek-card");
      const pager = peekCard.locator(".battle-peek-pager");
      const count = pager.locator(".battle-peek-count");
      const nextBtn = pager.locator('button[aria-label="Next foe"]');

      // Open Peek via KeyI on foe 0 (Zoomie Pup).
      await page.keyboard.press("i");
      await expect(peekCard).toBeVisible();
      await expect(pager).toBeVisible();
      await expect(count).toHaveText("1 / 2");
      await expect(peekCard.locator(".battle-peek-name")).toHaveText("Zoomie Pup");
      await expect(peekCard.locator(".battle-peek-badge.is-check")).toHaveText("Toy Catch");

      // Click › inside Peek: flips directly to foe 2 (Snappy Crab) with atlas-pin foley.
      const beforeClick = (await recordedEffects(page)).length;
      await nextBtn.click();
      await step(page, 1);
      await expect(peekCard).toBeVisible();
      await expect(count).toHaveText("2 / 2");
      await expect(peekCard.locator(".battle-peek-name")).toHaveText("Snappy Crab");
      await expect(peekCard.locator(".battle-peek-badge.is-check")).toHaveText("Rhythm Chain");
      expect((await readBattle(page))?.targetIndex).toBe(1);
      expect((await recordedEffects(page)).slice(beforeClick)).toContain("atlas-pin");

      // Press real ArrowLeft: flips back to foe 1 (Zoomie Pup) without closing Peek.
      const beforeLeft = (await recordedEffects(page)).length;
      await page.keyboard.press("ArrowLeft");
      await step(page, 1);
      await expect(peekCard).toBeVisible();
      await expect(count).toHaveText("1 / 2");
      await expect(peekCard.locator(".battle-peek-name")).toHaveText("Zoomie Pup");
      await expect(peekCard.locator(".battle-peek-badge.is-check")).toHaveText("Toy Catch");
      expect((await readBattle(page))?.targetIndex).toBe(0);
      expect((await recordedEffects(page)).slice(beforeLeft)).toContain("atlas-pin");

      // Press Gamepad RB (button 5): flips to foe 2 (Snappy Crab) without triggering Flute!
      const beforeRb = (await recordedEffects(page)).length;
      await pressPad(page, 5);
      await expect(peekCard).toBeVisible();
      await expect(count).toHaveText("2 / 2");
      await expect(peekCard.locator(".battle-peek-name")).toHaveText("Snappy Crab");
      await expect(peekCard.locator(".battle-peek-badge.is-check")).toHaveText("Rhythm Chain");
      const afterRbBattle = await readBattle(page);
      expect(afterRbBattle?.targetIndex).toBe(1);
      expect(afterRbBattle?.fluteUsed).not.toBe(true);
      expect((await recordedEffects(page)).slice(beforeRb)).toContain("atlas-pin");

      expect(errors).toEqual([]);
    },
  );

  test(
    "hides .battle-peek-pager cleanly in a single-foe battle (Fountain Frog)",
    { tag: "@smoke" },
    async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      await page.setViewportSize({ width: 1280, height: 720 });
      await openHarness(page);
      await resetPaused(page, "plaza-party");
      await walkToFrogCommand(page);

      const peekCard = page.locator(".battle-peek-card");
      await page.keyboard.press("i");
      await expect(peekCard).toBeVisible();
      await expect(peekCard.locator(".battle-peek-name")).toHaveText("Fizzy Frog");
      await expect(peekCard.locator(".battle-peek-pager")).toBeHidden();

      expect(errors).toEqual([]);
    },
  );
});
