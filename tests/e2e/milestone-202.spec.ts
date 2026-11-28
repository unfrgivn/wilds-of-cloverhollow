import { expect, test, type Page } from "@playwright/test";
import {
  longFlowTimeout,
  openHarness,
  readState,
  renderInfo,
  resetPaused,
  step,
} from "./helpers";
import type { State } from "../../src/core";

test.describe.configure({ timeout: longFlowTimeout });

declare global {
  interface Window {
    __m201PadState?: { buttons: boolean[]; axes: number[] };
  }
}

async function installGamepad(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const state = { buttons: Array.from({ length: 16 }, () => false), axes: [0, 0, 0, 0] };
    Object.defineProperty(window, "__m201PadState", { value: state });
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
    const state = window.__m201PadState;
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
  await step(page, 2);
}

async function patchState(page: Page, mutate: (state: State) => State): Promise<State> {
  const current = await readState(page);
  const nextState = mutate(current);
  const payload = JSON.stringify({ version: 10, state: nextState });
  const imported = await page.evaluate(async (raw) => {
    const hook = window.__cloverhollow;
    if (hook?.save.importBackup === undefined) return false;
    return hook.save.importBackup(raw);
  }, payload);
  expect(imported, "importBackup should accept valid v10 state").toBe(true);
  await step(page, 2);
  return readState(page);
}

async function activeDecorButtonAttr(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const active = document.activeElement;
    if (!(active instanceof HTMLButtonElement)) return null;
    if (active.dataset.decorClose !== undefined) return "close";
    if (active.dataset.swatchBuyCoins !== undefined) {
      return `buy-coins:${active.dataset.swatchBuyCoins}`;
    }
    if (active.dataset.swatchBuyTickets !== undefined) {
      return `buy-tickets:${active.dataset.swatchBuyTickets}`;
    }
    if (active.dataset.swatchEquip !== undefined) {
      return `equip:${active.dataset.swatchEquip}`;
    }
    if (active.dataset.pedestalBuyCoins !== undefined) return "pedestal-coins";
    if (active.dataset.pedestalBuyTickets !== undefined) return "pedestal-tickets";
    if (active.dataset.shelfPrize !== undefined) return `prize:${active.dataset.shelfPrize}`;
    if (active.dataset.cycleVisitor !== undefined) return "cycle-visitor";
    return active.textContent ?? "";
  });
}

async function openSanctuaryShrine(page: Page): Promise<void> {
  await page.keyboard.down("ArrowUp");
  await step(page, 60);
  await page.keyboard.up("ArrowUp");
  await page.keyboard.down("ArrowRight");
  await step(page, 30);
  await page.keyboard.up("ArrowRight");
  for (let guard = 0; guard < 18; guard += 1) {
    if ((await readState(page)).player.x >= 764) break;
    await page.keyboard.down("ArrowRight");
    await step(page, 10);
    await page.keyboard.up("ArrowRight");
  }
  for (let guard = 0; guard < 24; guard += 1) {
    const st = await readState(page);
    const info = await renderInfo(page);
    if (st.player.y <= 442 && info.prompt.visible) break;
    await page.keyboard.down("ArrowUp");
    await step(page, 10);
    await page.keyboard.up("ArrowUp");
  }
  await page.keyboard.down("ArrowUp");
  await step(page, 2);
  await page.keyboard.up("ArrowUp");
  await step(page, 2);
  await page.evaluate(() => window.__cloverhollow?.settings.setTextSpeed("instant"));
  for (let guard = 0; guard < 12; guard += 1) {
    if (await page.locator(".encore-shrine").isVisible()) return;
    await tapKey(page, "KeyZ");
  }
}

test(
  "Room Decor Picker supports full keyboard Arrow/Home/End navigation, Enter activation & Escape",
  { tag: "@smoke" },
  async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await page.setViewportSize({ width: 1280, height: 720 });
    await openHarness(page);
    await resetPaused(page, "clubhouse");
    await patchState(page, (state) => ({
      ...state,
      coins: 220,
      tickets: 95,
      prizes: ["frog-plush"],
    }));

    // Open Decor Picker via KeyB and verify modal receives focus.
    await page.keyboard.press("KeyB");
    const picker = page.locator('[data-decor-picker="open"]');
    await expect(picker).toBeVisible();
    const modalFocused = await page.evaluate(
      () => document.activeElement?.classList.contains("decor-picker-modal") === true,
    );
    expect(modalFocused).toBe(true);

    // Home focuses first button (Done), End focuses last enabled button, arrows wrap cleanly.
    await page.keyboard.press("Home");
    expect(await activeDecorButtonAttr(page)).toBe("close");

    await page.keyboard.press("End");
    const lastBtn = await activeDecorButtonAttr(page);
    expect(lastBtn).not.toBeNull();
    expect(lastBtn).not.toBe("close");

    await page.keyboard.press("ArrowRight");
    expect(await activeDecorButtonAttr(page)).toBe("close");

    await page.keyboard.press("ArrowLeft");
    expect(await activeDecorButtonAttr(page)).toBe(lastBtn);

    // Step with ArrowRight to Starlight Cozy coin purchase button and activate with Enter!
    await page.keyboard.press("Home");
    for (let guard = 0; guard < 20; guard += 1) {
      if ((await activeDecorButtonAttr(page)) === "buy-coins:starlight-cozy") break;
      await page.keyboard.press("ArrowRight");
    }
    expect(await activeDecorButtonAttr(page)).toBe("buy-coins:starlight-cozy");

    await page.keyboard.press("Enter");
    await expect(
      picker.locator('[data-swatch="starlight-cozy"] [data-swatch-state="equipped"]'),
    ).toBeVisible();
    await expect(picker.locator('[data-decor-coins="165"]')).toBeVisible();
    await expect(picker.locator(".decor-picker-status")).toHaveText(
      "Starlight Cozy unlocked and equipped.",
    );

    // Escape closes cleanly and persists equipped swatch.
    await page.keyboard.press("Escape");
    await expect(picker).toBeHidden();
    expect((await readState(page)).decor?.swatch).toBe("starlight-cozy");
    expect(errors).toEqual([]);
  },
);

test(
  "Dream Memory Shrine footer hint adapts live between gamepad and keyboard",
  { tag: "@smoke" },
  async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await installGamepad(page);
    await page.setViewportSize({ width: 1280, height: 720 });
    await openHarness(page);
    await resetPaused(page, "festival");
    await step(page, 2);

    await openSanctuaryShrine(page);
    const shrine = page.locator(".encore-shrine");
    const footHint = page.locator(".encore-foot-hint");
    await expect(shrine).toBeVisible();
    await expect(footHint).toHaveText(
      "Arrows/WASD pick a memory · 1/2/3 toggle Star Challenges · Enter/Z launch · Esc close",
    );

    // Activate gamepad -> footer hint updates live to gamepad prompt.
    await setPad(page, { axes: [0, 0, 0, 0.8] });
    await expect(footHint).toHaveText(
      "D-Pad pick a memory · L/R toggle Star Challenges · A launch · B close",
    );
    await setPad(page, {});

    // Keyboard input restores keyboard footer hint live.
    await page.keyboard.press("Shift");
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    await expect(footHint).toHaveText(
      "Arrows/WASD pick a memory · 1/2/3 toggle Star Challenges · Enter/Z launch · Esc close",
    );

    await page.keyboard.press("Escape");
    await expect(shrine).toBeHidden();
    expect(errors).toEqual([]);
  },
);
