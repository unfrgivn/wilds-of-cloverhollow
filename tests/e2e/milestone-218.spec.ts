import { expect, test, type Page } from "@playwright/test";
import {
  bunFindReplayTick,
  longFlowTimeout,
  openHarness,
  queueScript,
  readState,
  recording,
  resetPaused,
  step,
} from "./helpers";

test.describe.configure({ timeout: longFlowTimeout });

declare global {
  interface Window {
    __m217PadState?: { buttons: boolean[]; axes: number[] };
  }
}

async function installGamepad(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const state = { buttons: Array.from({ length: 16 }, () => false), axes: [0, 0, 0, 0] };
    Object.defineProperty(window, "__m217PadState", { value: state });
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
    const state = window.__m217PadState;
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

async function fastForwardTo(
  page: Page,
  scriptPath: string,
  targetTicks: number,
): Promise<void> {
  const upTo: ReturnType<typeof recording> = [];
  let ticks = 0;
  for (const segment of recording(scriptPath)) {
    if (ticks >= targetTicks) break;
    const take = Math.min(segment.ticks, targetTicks - ticks);
    upTo.push({ frame: segment.frame, ticks: take });
    ticks += take;
  }
  await queueScript(page, upTo);
  await step(page, targetTicks);
}

test.describe("Milestone 218: Adaptive Gamepad Hint Copy in Fishing & Taco Truck", () => {
  test(
    "Bubblegum Bay Fishing aim hint switches live between Confirm and A on gamepad",
    { tag: "@smoke" },
    async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      await installGamepad(page);
      await page.setViewportSize({ width: 1280, height: 720 });
      await openHarness(page);
      await resetPaused(page, "new-game");

      const fishPath = "tests/sim/scripts/new-game/fish.json";
      const dockTick = bunFindReplayTick(fishPath, "new-game", "fish-dock-ready");
      await fastForwardTo(page, fishPath, dockTick);

      // Open fishing via clicks on the dock prompt, dialogue, and choice.
      const prompt = page.locator(".sticker-prompt");
      const dialogue = page.locator(".sticker-dialogue");
      await expect(prompt).toBeVisible();
      await prompt.click();
      await step(page, 2);
      await expect(dialogue).toBeVisible();
      await dialogue.click();
      await step(page, 2);
      const goFishing = page.locator(".sticker-choice").first();
      await expect(goFishing).toBeVisible();
      await goFishing.click();
      await step(page, 2);
      await dialogue.click();
      await step(page, 2);
      await dialogue.click();
      await step(page, 2);

      await expect(page.locator(".fish-overlay")).toBeVisible();
      const atAim = await readState(page);
      expect(atAim.arcade?.game).toBe("fish");
      if (atAim.arcade?.game !== "fish") throw new Error("Expected fish minigame");
      expect(atAim.arcade.phase).toBe("aim");

      const front = page.locator(".fish-front-text");
      await expect(front).toHaveText(
        "Press Confirm to cast! Farther casts reach rare lake treasures.",
      );

      // Activate gamepad right stick -> Fishing hint adapts live to "Press A to cast!...".
      await setPad(page, { axes: [0, 0, 0, 0.8] });
      await expect(front).toHaveText(
        "Press A to cast! Farther casts reach rare lake treasures.",
      );
      await setPad(page, {});

      // Keyboard press restores the original keyboard copy cleanly.
      await page.keyboard.press("Shift");
      await page.evaluate(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
          ),
      );
      await expect(front).toHaveText(
        "Press Confirm to cast! Farther casts reach rare lake treasures.",
      );

      expect(errors).toEqual([]);
    },
  );

  test(
    "Chef Mateo's Taco Truck ready and serving hints adapt live on gamepad",
    { tag: "@smoke" },
    async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      await installGamepad(page);
      await page.setViewportSize({ width: 1280, height: 720 });
      await openHarness(page);
      await resetPaused(page, "new-game");

      const tacoPath = "tests/sim/scripts/new-game/taco.json";
      const targetTicks = bunFindReplayTick(tacoPath, "new-game", "taco-ready");
      await fastForwardTo(page, tacoPath, targetTicks);

      const readyState = await readState(page);
      if (readyState.arcade?.game !== "taco") {
        throw new Error(`Expected Taco Truck ready state at tick ${targetTicks}`);
      }
      expect(readyState.arcade.phase).toBe("ready");
      await expect(page.locator(".taco-stage")).toBeVisible();

      const front = page.locator(".taco-front-text");
      await expect(front).toHaveText(
        "Chef Mateo's Taco Truck! Press Confirm to start the lunch rush!",
      );

      // Gamepad input switches ready hint to "Press A to start...".
      await setPad(page, { axes: [0, 0, 0, 0.8] });
      await expect(front).toHaveText(
        "Chef Mateo's Taco Truck! Press A to start the lunch rush!",
      );
      await setPad(page, {});

      // Start the lunch rush via stage click so gamepad mode stays active into serving!
      const stageBox = await page.locator(".taco-stage").boundingBox();
      if (stageBox === null) throw new Error("Missing .taco-stage box");
      await page.mouse.click(stageBox.x + stageBox.width / 2, stageBox.y + stageBox.height / 2);
      await step(page, 2);

      const servingState = await readState(page);
      if (servingState.arcade?.game !== "taco") throw new Error("Expected taco serving state");
      expect(servingState.arcade.phase).toBe("serving");

      await expect(front).toHaveText(
        "Match the order ticket! D-Pad ↑ Beans · → Cheese · ↓ Salsa · ← Avocado.",
      );

      // Keyboard press switches serving hint right back to keyboard copy.
      await page.keyboard.press("Shift");
      await page.evaluate(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
          ),
      );
      await expect(front).toHaveText(
        "Match the order ticket! Up Beans · Right Cheese · Down Salsa · Left Avocado.",
      );

      expect(errors).toEqual([]);
    },
  );
});
