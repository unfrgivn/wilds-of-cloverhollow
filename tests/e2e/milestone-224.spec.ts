import { expect, test, type Page } from "@playwright/test";
import {
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
    __m222PadState?: { buttons: boolean[]; axes: number[] };
  }
}

async function installGamepad(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const state = { buttons: Array.from({ length: 16 }, () => false), axes: [0, 0, 0, 0] };
    Object.defineProperty(window, "__m222PadState", { value: state });
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
    const state = window.__m222PadState;
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

async function pressKeyboardRestore(page: Page): Promise<void> {
  await page.keyboard.press("Shift");
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
}

async function centerOf(page: Page, selector: string): Promise<{ x: number; y: number }> {
  const box = await page.locator(selector).boundingBox();
  if (box === null) throw new Error(`Expected visible ${selector}`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

test.describe("Milestone 222: 7-of-7 Minigame Steam Deck / Gamepad Adaptive Hints", () => {
  test(
    "Claw Machine slide and push hints adapt live between keyboard and gamepad",
    { tag: "@smoke" },
    async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      await installGamepad(page);
      await page.setViewportSize({ width: 1280, height: 720 });
      await openHarness(page);
      await resetPaused(page, "arcade");

      for (const segment of recording("tests/sim/scripts/arcade/claw.json")) {
        await queueScript(page, [segment]);
        await step(page, segment.ticks);
        const state = await readState(page);
        if (state.arcade?.game === "claw" && state.arcade.phase === "ready") break;
      }
      await step(page, 1);

      const plate = page.locator(".arcade-plate-text");
      await expect(plate).toHaveText("Hold to slide the claw. Let go to stop it!");

      await setPad(page, { axes: [0, 0, 0, 0.8] });
      await expect(plate).toHaveText("Hold A to slide the claw. Let go to stop it!");
      await setPad(page, {});

      await pressKeyboardRestore(page);
      await expect(plate).toHaveText("Hold to slide the claw. Let go to stop it!");

      // Slide and release via mouse so we enter aiming phase and check the push hint too.
      const point = await centerOf(page, ".arcade-machine");
      await page.mouse.move(point.x, point.y);
      await page.mouse.down();
      await step(page, 12);
      await page.mouse.up();
      await step(page, 2);

      await expect(plate).toHaveText("Hold to push it back. Let go to drop it!");
      await setPad(page, { axes: [0, 0, 0, 0.8] });
      await expect(plate).toHaveText("Hold A to push it back. Let go to drop it!");
      await setPad(page, {});

      await pressKeyboardRestore(page);
      await expect(plate).toHaveText("Hold to push it back. Let go to drop it!");
      expect(errors).toEqual([]);
    },
  );

  test(
    "Skee-Ball aim and power hints adapt live between keyboard and gamepad",
    { tag: "@smoke" },
    async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      await installGamepad(page);
      await page.setViewportSize({ width: 1280, height: 720 });
      await openHarness(page);
      await resetPaused(page, "arcade");

      for (const segment of recording("tests/sim/scripts/arcade/skee.json")) {
        await queueScript(page, [segment]);
        await step(page, segment.ticks);
        const state = await readState(page);
        if (state.arcade?.game === "skee" && state.arcade.phase === "aiming") break;
      }
      await step(page, 1);

      const plate = page.locator(".skee-plate-text");
      await expect(plate).toHaveText("Press to aim the ball!");

      await setPad(page, { axes: [0, 0, 0, 0.8] });
      await expect(plate).toHaveText("Press A to aim the ball!");
      await setPad(page, {});

      // Lock aim via mouse click while gamepad mode remains active -> winding hint adapts.
      const point = await centerOf(page, ".skee-frame");
      await page.mouse.click(point.x, point.y);
      await step(page, 2);
      await expect(plate).toHaveText("Hold A to wind up. Let go to roll!");

      await pressKeyboardRestore(page);
      await expect(plate).toHaveText("Hold to wind up. Let go to roll!");
      expect(errors).toEqual([]);
    },
  );

  test(
    "Comet Cruise marquee hint and lane keycaps adapt live between keyboard and gamepad",
    { tag: "@smoke" },
    async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      await installGamepad(page);
      await page.setViewportSize({ width: 1280, height: 720 });
      await openHarness(page);
      await resetPaused(page, "arcade");

      for (const segment of recording("tests/sim/scripts/arcade/comet.json")) {
        await queueScript(page, [segment]);
        await step(page, segment.ticks);
        const state = await readState(page);
        if (state.arcade?.game === "comet") break;
      }
      // Advance past ready into playing so the marquee shows the steering hint.
      for (let tries = 0; tries < 70; tries += 1) {
        const current = await readState(page);
        if (current.arcade?.game === "comet" && current.arcade.phase === "playing") break;
        await step(page, 2);
      }

      const marquee = page.locator(".comet-marquee-text");
      const keys = page.locator(".comet-key");
      await expect(marquee).toHaveText("Catch the stars and slip past the space rocks!");
      await expect(keys).toHaveText(["←", "→"]);

      await setPad(page, { axes: [0, 0, 0, 0.8] });
      await expect(marquee).toHaveText(
        "Catch the stars with Stick / D-Pad and dodge space rocks!",
      );
      await expect(keys).toHaveText(["◀", "▶"]);
      await setPad(page, {});

      await pressKeyboardRestore(page);
      await expect(marquee).toHaveText("Catch the stars and slip past the space rocks!");
      await expect(keys).toHaveText(["←", "→"]);
      expect(errors).toEqual([]);
    },
  );

  test(
    "Clubhouse Microwave ready hint adapts live between keyboard and gamepad",
    { tag: "@smoke" },
    async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      await installGamepad(page);
      await page.setViewportSize({ width: 1280, height: 720 });
      await openHarness(page);
      await resetPaused(page, "new-game");

      const before = recording("tests/sim/scripts/new-game/golden-lasso.json");
      const all = recording("tests/sim/scripts/new-game/golden-kitchen.json");
      const last = before.length - 1;
      const joined = all[last];
      if (joined === undefined) throw new Error("Missing golden-kitchen continuation");
      const carried = joined.ticks - (before[last]?.ticks ?? 0);

      await queueScript(page, before);
      await step(page, before.reduce((total, segment) => total + segment.ticks, 0));

      const rest = [
        ...(carried > 0 ? [{ frame: joined.frame, ticks: carried }] : []),
        ...all.slice(last + 1),
      ];
      for (const segment of rest) {
        await queueScript(page, [segment]);
        await step(page, segment.ticks);
        const state = await readState(page);
        if (state.arcade?.game === "cook" && state.arcade.phase === "ready") break;
      }
      await step(page, 1);

      const front = page.locator(".cook-front-text");
      await expect(front).toHaveText(
        "The box says 1:00. Hold to cook, and let go when it's golden!",
      );

      await setPad(page, { axes: [0, 0, 0, 0.8] });
      await expect(front).toHaveText(
        "The box says 1:00. Hold A to cook, and let go when it's golden!",
      );
      await setPad(page, {});

      await pressKeyboardRestore(page);
      await expect(front).toHaveText(
        "The box says 1:00. Hold to cook, and let go when it's golden!",
      );
      expect(errors).toEqual([]);
    },
  );
});
