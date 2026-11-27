import { expect, test } from "@playwright/test";
import { openHarness, readState, resetPaused, step } from "./helpers";

test.describe("Milestone 129: Overworld Mouse Press-and-Hold Steering", () => {
  test(
    "strolls Fae with mouse hold, stops cleanly on release, and ignores holds during dialogue",
    { tag: "@smoke" },
    async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      await page.setViewportSize({ width: 1280, height: 720 });
      await openHarness(page);
      await resetPaused(page, "new-game");

      const canvas = page.locator("#app canvas");
      await expect(canvas).toBeVisible();
      const box = await canvas.boundingBox();
      if (box === null) throw new Error("Missing game canvas bounding box");

      const start = await readState(page);
      expect(start.area).toBe("bedroom");

      // Zero keyboard presses: hold primary mouse button well to the right of Fae on canvas.
      await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.57);
      await page.mouse.down();
      await step(page, 24);

      const walkedRight = await readState(page);
      expect(walkedRight.player.x).toBeGreaterThan(start.player.x + 40);
      expect(walkedRight.facing).toBe("right");

      // Releasing the mouse stops Fae cleanly without drift.
      await page.mouse.up();
      await step(page, 12);
      const afterRelease = await readState(page);
      expect(afterRelease.player.x).toBe(walkedRight.player.x);
      expect(afterRelease.player.y).toBe(walkedRight.player.y);

      // Steer left with the mouse back toward the pillow journal until the LOOK prompt shows.
      await page.mouse.move(box.x + box.width * 0.25, box.y + box.height * 0.57);
      await page.mouse.down();
      const prompt = page.locator(".sticker-prompt");
      for (let tries = 0; tries < 25; tries += 1) {
        await step(page, 4);
        if (await prompt.isVisible()) break;
      }
      await page.mouse.up();
      await expect(prompt).toBeVisible();

      // Click the LOOK prompt with the mouse (still zero keyboard presses) to open dialogue.
      await prompt.click();
      await step(page, 2);
      const dialogueStart = await readState(page);
      expect(dialogueStart.dialogue).not.toBeNull();
      await expect(page.locator(".sticker-dialogue")).toBeVisible();

      // Holding the mouse on open canvas while dialogue is open must NOT steer or move Fae.
      await page.mouse.move(box.x + box.width * 0.85, box.y + box.height * 0.35);
      await page.mouse.down();
      await step(page, 20);
      await page.mouse.up();

      const duringDialogue = await readState(page);
      expect(duringDialogue.dialogue).not.toBeNull();
      expect(duringDialogue.player.x).toBe(dialogueStart.player.x);
      expect(duringDialogue.player.y).toBe(dialogueStart.player.y);
      expect(errors).toEqual([]);
    },
  );
});
