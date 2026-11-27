import { expect, test, type Page } from "@playwright/test";
import {
  longFlowTimeout,
  openHarness,
  readBattle,
  readState,
  resetPaused,
  step,
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

async function advanceUntil(
  page: Page,
  predicate: (battle: Awaited<ReturnType<typeof readBattle>>) => boolean,
): Promise<void> {
  for (let count = 0; count < 50; count += 1) {
    const battle = await readBattle(page);
    if (predicate(battle)) return;
    await tapKey(page, "Enter");
  }
  throw new Error("timed out advancing battle phase");
}

async function walkToFrogCommand(page: Page): Promise<void> {
  const steps: readonly [string, number][] = [
    ["ArrowDown", 25],
    ["ArrowLeft", 15],
    ["ArrowDown", 50],
    ["ArrowLeft", 35],
    ["ArrowUp", 38],
  ];
  for (const [key, ticks] of steps) {
    await holdKey(page, key, ticks);
  }
  await expect(page.locator("html")).toHaveAttribute("data-battle", "open");
  await advanceUntil(
    page,
    (battle) => battle?.phase === "command" && battle.revealed >= battle.message.length,
  );
}

test.describe("Milestone 114: Gamepad Full-Feature Parity", () => {
  test.setTimeout(longFlowTimeout);

  test(
    "Gamepad Select toggles Photo Mode, A snaps Postcard without dialogue, and B exits cleanly",
    { tag: "@smoke" },
    async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      await installGamepad(page);
      await page.setViewportSize({ width: 1280, height: 720 });
      await openHarness(page);
      await resetPaused(page, "new-game");

      // Walk right in front of the bedroom window so an interact prompt is active.
      await setPad(page, { axes: [1, 0] });
      await step(page, 28);
      await setPad(page, { axes: [0, -1] });
      await step(page, 18);
      await setPad(page, {});
      await expect(page.locator(".sticker-prompt")).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute("data-photo", "off");

      // Select (button 8) enters Photo Mode.
      await pressPad(page, 8);
      await expect(page.locator("html")).toHaveAttribute("data-photo", "on");

      // A (button 0) snaps a postcard & triggers shutter flash while swallowing confirm.
      await pressPad(page, 0);
      await expect(page.locator(".photo-shutter-flash")).toHaveAttribute(
        "data-shutter-count",
        "1",
      );
      await expect(page.locator(".sticker-dialogue")).toBeHidden();
      expect((await readState(page)).dialogue).toBeNull();

      // B (button 1) exits Photo Mode cleanly.
      await pressPad(page, 1);
      await expect(page.locator("html")).toHaveAttribute("data-photo", "off");

      // Select also toggles Photo Mode on and off cleanly.
      await pressPad(page, 8);
      await expect(page.locator("html")).toHaveAttribute("data-photo", "on");
      await pressPad(page, 8);
      await expect(page.locator("html")).toHaveAttribute("data-photo", "off");

      // Outside Photo Mode, gamepad A still opens the window dialogue normally.
      await pressPad(page, 0);
      await expect(page.locator(".sticker-dialogue")).toBeVisible();

      expect(errors).toEqual([]);
    },
  );

  test(
    "Gamepad Select toggles Battle Field Guide Peek and B dismisses only the Peek card",
    { tag: "@smoke" },
    async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      await installGamepad(page);
      await page.setViewportSize({ width: 1280, height: 720 });
      await openHarness(page);
      await resetPaused(page, "plaza-party");
      await walkToFrogCommand(page);

      const peekCard = page.locator(".battle-peek-card");
      await expect(peekCard).toBeHidden();

      // Select (button 8) opens the Battle Field Guide Peek card.
      await pressPad(page, 8);
      await expect(peekCard).toBeVisible();
      await expect(peekCard.locator(".battle-peek-name")).toHaveText("Fizzy Frog");

      // B (button 1) dismisses ONLY the Battle Peek card while staying in command phase.
      await pressPad(page, 1);
      await expect(peekCard).toBeHidden();
      await expect(page.locator("html")).toHaveAttribute("data-battle", "open");
      await expect(page.locator(".battle-commands")).toBeVisible();
      expect((await readBattle(page))?.phase).toBe("command");

      // Select also toggles the Battle Peek card on and off cleanly.
      await pressPad(page, 8);
      await expect(peekCard).toBeVisible();
      await pressPad(page, 8);
      await expect(peekCard).toBeHidden();
      expect((await readBattle(page))?.phase).toBe("command");

      expect(errors).toEqual([]);
    },
  );
});
