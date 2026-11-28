import { expect, test, type Page } from "@playwright/test";
import {
  longFlowTimeout,
  openHarness,
  playBattleCheck,
  readBattle,
  resetPaused,
  step,
} from "./helpers";

test.describe.configure({ timeout: longFlowTimeout });

declare global {
  interface Window {
    __m199PadState?: { buttons: boolean[]; axes: number[] };
  }
}

async function installGamepad(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const state = { buttons: Array.from({ length: 16 }, () => false), axes: [0, 0, 0, 0] };
    Object.defineProperty(window, "__m199PadState", { value: state });
    Object.defineProperty(navigator, "getGamepads", {
      configurable: true,
      value: () => [
        {
          mapping: "standard",
          buttons: state.buttons.map((pressed) => ({ pressed, value: pressed ? 1 : 0 })),
          axes: state.axes,
        },
      ],
    });
  });
}

async function setPad(
  page: Page,
  options: { axes?: [number, number, number, number]; buttons?: number[] },
): Promise<void> {
  await page.evaluate((next) => {
    const state = window.__m199PadState;
    if (state === undefined) throw new Error("gamepad unavailable");
    state.axes = next.axes ?? [0, 0, 0, 0];
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
  for (let count = 0; count < 60; count += 1) {
    const battle = await readBattle(page);
    if (predicate(battle)) return;
    await tapKey(page, "Enter");
  }
  throw new Error("timed out advancing battle phase");
}

test(
  "Dual-Friend Synergy Combo spawns SYNERGY! popup and spin-snag adapts to gamepad",
  { tag: "@smoke" },
  async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await installGamepad(page);
    await page.setViewportSize({ width: 1280, height: 720 });
    await openHarness(page);
    await resetPaused(page, "bay-duo");

    await advanceUntil(
      page,
      (battle) => battle?.phase === "command" && battle.revealed >= battle.message.length,
    );

    // Turn 1: Fae Soothe GREAT -> sparkle 1, enemy burst GREAT -> sparkle 2 -> Turn 2 (Sue).
    await tapKey(page, "Enter");
    await playBattleCheck(page);
    await advanceUntil(page, (battle) => battle?.phase === "check");
    await playBattleCheck(page);
    await advanceUntil(
      page,
      (battle) => battle?.phase === "command" && battle.revealed >= battle.message.length,
    );

    const comboBtn = page.locator(".battle-commands .battle-command.is-combo", {
      hasText: "Bubblegum Lasso Spin",
    });
    await expect(comboBtn).toBeVisible();
    for (let presses = 0; presses < 8; presses += 1) {
      if ((await comboBtn.getAttribute("aria-selected")) === "true") break;
      await tapKey(page, "ArrowDown");
    }
    await expect(comboBtn).toHaveAttribute("aria-selected", "true");

    // Launch Dual-Friend Synergy Combo -> verify die-cut .battle-popup-assist "SYNERGY! ★".
    await page.keyboard.down("Enter");
    await step(page, 1);
    await page.keyboard.up("Enter");

    const synergyPopup = page.locator(".battle-popup-assist");
    await expect(synergyPopup).toBeVisible();
    await expect(synergyPopup).toHaveText("SYNERGY! ★");
    await expect(synergyPopup).toHaveAttribute("data-popup-kind", "assist");

    // Spin lasso into snag phase -> keyboard shows "SNAG!", gamepad adapts to "SNAG! [A]".
    for (const key of [
      "ArrowUp",
      "ArrowRight",
      "ArrowDown",
      "ArrowLeft",
      "ArrowUp",
      "ArrowRight",
    ]) {
      await page.keyboard.down(key);
      await step(page, 1);
      await page.keyboard.up(key);
    }

    const snagBtn = page.locator(".battle-spin-snag-btn");
    await expect(snagBtn).toBeVisible();
    await expect(snagBtn).toHaveText("SNAG!");

    await setPad(page, { axes: [0, 0, 0, 0.8] });
    await expect(snagBtn).toHaveText("SNAG! [A]");
    await setPad(page, {});

    expect(errors).toEqual([]);
  },
);

test(
  "whack battle check middle keycap adapts live between keyboard Z and gamepad A",
  { tag: "@smoke" },
  async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await installGamepad(page);
    await page.setViewportSize({ width: 1280, height: 720 });
    await openHarness(page);
    await resetPaused(page, "arcade-encore");

    await advanceUntil(
      page,
      (battle) => battle?.phase === "command" && battle.revealed >= battle.message.length,
    );

    // Complete Turn 1 command -> triggers whack Popping Ticket Slots burst.
    await tapKey(page, "Enter");
    await playBattleCheck(page);
    await advanceUntil(page, (battle) => battle?.phase === "check");

    await step(page, 2);
    const middleKey = page.locator(".battle-whack-slot.is-middle .battle-whack-key");
    await expect(page.locator(".battle-whack")).toBeVisible();
    await expect(middleKey).toHaveText("Z");
    await expect(page.locator(".battle-whack-slot.is-up .battle-whack-key")).toHaveText("↑");

    // Activate gamepad right stick -> middle keycap switches live to "A".
    await setPad(page, { axes: [0, 0, 0, 0.8] });
    await expect(middleKey).toHaveText("A");
    await expect(page.locator(".battle-whack-slot.is-up .battle-whack-key")).toHaveText("↑");
    await setPad(page, {});

    // Keyboard input restores middle keycap back to "Z".
    await page.keyboard.press("Shift");
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    await expect(middleKey).toHaveText("Z");

    expect(errors).toEqual([]);
  },
);
