import { expect, test, type Page } from "@playwright/test";
import {
  longFlowTimeout,
  openHarness,
  queueScript,
  readBattle,
  readState,
  recording,
  resetPaused,
  step,
} from "./helpers";

async function holdKey(page: Page, key: string, ticks: number): Promise<void> {
  await page.keyboard.down(key);
  await step(page, ticks);
  await page.keyboard.up(key);
}

async function centerOf(page: Page, selector: string): Promise<{ x: number; y: number }> {
  const box = await page.locator(selector).boundingBox();
  if (box === null) throw new Error(`Missing bounding box for ${selector}`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

test.describe("Milestone 127: Direct Mouse & Touch Pointer Play", () => {
  test.setTimeout(longFlowTimeout);

  test(
    "plays a Fountain Frog ring timing check with mouse clicks only (zero keyboard presses)",
    { tag: "@smoke" },
    async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      await page.setViewportSize({ width: 1280, height: 720 });
      await openHarness(page);
      await resetPaused(page, "plaza");

      // Walk into the Fountain Frog to enter battle (overworld setup only).
      for (const [key, ticks] of [
        ["ArrowDown", 25],
        ["ArrowLeft", 15],
        ["ArrowDown", 50],
        ["ArrowLeft", 35],
      ] as const) {
        await holdKey(page, key, ticks);
      }

      const dialogue = page.locator(".sticker-dialogue");
      const tapStage = page.locator(".battle-check-tap");
      await expect(page.locator("html")).toHaveAttribute("data-battle", "open");
      await expect(dialogue).toBeVisible();
      await expect(tapStage).toBeHidden();

      // From here on, zero keyboard presses are used: advance intro by clicking the dialogue box.
      await dialogue.click();
      await step(page, 2);
      await dialogue.click();
      await step(page, 60);
      expect((await readBattle(page))?.phase).toBe("command");

      // Click the Soothe command button with the mouse to start the ring timing check.
      const calmBefore = (await readBattle(page))?.calm ?? 0;
      await page.locator(".battle-command").first().click();
      await step(page, 2);

      const started = await readBattle(page);
      expect(started?.phase).toBe("check");
      expect(started?.check?.kind).toBe("ring");
      await expect(tapStage).toBeVisible();

      if (started?.check?.kind !== "ring") throw new Error("Expected active ring check");
      const waitTicks = Math.max(0, started.check.spec.targetTick - started.check.tick - 1);
      if (waitTicks > 0) await step(page, waitTicks);

      // Click directly on the battle stage (.battle-check-tap) with real mouse pointerdown/up.
      const point = await centerOf(page, ".battle-check-tap");
      await page.mouse.move(point.x, point.y);
      await page.mouse.down();
      await step(page, 1);
      await page.mouse.up();
      await step(page, 1);

      const graded = await readBattle(page);
      expect(graded?.phase).toBe("result");
      expect(graded?.lastGrade).toBe("great");
      expect(graded?.calm ?? 0).toBeGreaterThan(calmBefore);
      await expect(page.locator(".battle-grade")).toHaveText("GREAT!");
      // Tap stage hides immediately once graded so confirm never sticks into result phase.
      await expect(tapStage).toBeHidden();
      expect(errors).toEqual([]);
    },
  );

  test(
    "casts, hooks, and reels in Bubblegum Bay Fishing with mouse press-and-hold only",
    { tag: "@smoke" },
    async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      await page.setViewportSize({ width: 1280, height: 720 });
      await openHarness(page);
      await resetPaused(page, "new-game");

      // Arrive at Bubblegum Bay and walk onto Sue's dock (before opening fishing).
      const bayScript = recording("tests/sim/scripts/new-game/golden-bay.json");
      const fishScript = recording("tests/sim/scripts/new-game/fish.json");
      const talkIndex = fishScript.findIndex(
        (segment, index) => index >= bayScript.length && segment.frame.confirm,
      );
      const arriveAtDock = fishScript.slice(0, talkIndex > 0 ? talkIndex : bayScript.length + 8);
      const arriveTicks = arriveAtDock.reduce((total, segment) => total + segment.ticks, 0);
      await queueScript(page, arriveAtDock);
      await step(page, arriveTicks);

      // Open fishing via mouse clicks on the floating prompt, dialogue, and choice (zero keys!).
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
      // Advance Sue's final dock line with mouse clicks so fishing opens.
      await dialogue.click();
      await step(page, 2);
      await dialogue.click();
      await step(page, 2);

      await expect(page.locator(".fish-overlay")).toBeVisible();
      const atAim = await readState(page);
      expect(atAim.arcade?.game).toBe("fish");
      if (atAim.arcade?.game !== "fish") throw new Error("Expected fish minigame");
      expect(atAim.arcade.phase).toBe("aim");

      // Click directly on the fishing close-up stage to cast.
      const point = await centerOf(page, ".fish-stage");
      await page.mouse.click(point.x, point.y);
      await step(page, 2);
      const casting = await readState(page);
      expect(casting.arcade?.game === "fish" ? casting.arcade.phase : null).toBe("casting");

      // Wait for a bite without touching the keyboard.
      let sawBite = false;
      for (let tries = 0; tries < 240; tries += 1) {
        await step(page, 5);
        const current = await readState(page);
        if (current.arcade?.game === "fish" && current.arcade.phase === "bite") {
          sawBite = true;
          break;
        }
      }
      expect(sawBite).toBe(true);

      // Click directly on the fishing stage to hook the biting fish.
      await page.mouse.click(point.x, point.y);
      await step(page, 2);
      const reelStart = await readState(page);
      if (reelStart.arcade?.game !== "fish") throw new Error("Expected fish reeling state");
      expect(reelStart.arcade.phase).toBe("reeling");
      const startHook = reelStart.arcade.hookPos;

      // Press and hold the mouse button on the fishing stage: the bobber bar must rise!
      await page.mouse.move(point.x, point.y);
      await page.mouse.down();
      await step(page, 20);
      const whileHeld = await readState(page);
      if (whileHeld.arcade?.game !== "fish") throw new Error("Expected fish while holding");
      expect(whileHeld.arcade.phase).toBe("reeling");
      expect(whileHeld.arcade.hookPos).toBeGreaterThan(startHook + 0.15);
      const peakHook = whileHeld.arcade.hookPos;

      // Release the mouse button: confirm must release cleanly so the bobber bar drops!
      await page.mouse.up();
      await step(page, 20);
      const afterRelease = await readState(page);
      if (afterRelease.arcade?.game !== "fish") throw new Error("Expected fish after release");
      expect(afterRelease.arcade.hookPos).toBeLessThan(peakHook - 0.1);
      expect(errors).toEqual([]);
    },
  );
});
