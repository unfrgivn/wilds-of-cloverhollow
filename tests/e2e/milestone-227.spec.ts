import { expect, test, type Page } from "@playwright/test";
import { gallery } from "./gallery";
import { readState, resetPaused, step } from "./helpers";

async function bootGame(page: Page): Promise<void> {
  await page.goto("./");
  await page.waitForFunction(() => Boolean(window.__cloverhollow));
}

async function createKitchenSave(page: Page): Promise<string> {
  await page.evaluate(() => window.__cloverhollow?.save.clear());
  await resetPaused(page, "new-game");
  await page.keyboard.down("ArrowUp");
  await step(page, 30);
  await page.keyboard.up("ArrowUp");
  await step(page, 60);
  expect((await readState(page)).area).toBe("kitchen");
  await page.waitForFunction(() => window.__cloverhollow?.save.last() !== null);
  const saved = await page.evaluate(() => window.__cloverhollow?.save.last() ?? null);
  if (saved === null) throw new Error("expected kitchen autosave");
  return saved.hash;
}

test.describe("Milestone 227: Battle & Title WCAG 4.1.3 Parity + Backdrop Cancel", () => {
  test(
    "Title confirm alertdialog exposes modal semantics and backdrop click cancels cleanly",
    { tag: "@smoke" },
    async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      await bootGame(page);
      const savedHash = await createKitchenSave(page);
      await bootGame(page);
      await step(page, 1);

      expect(await page.evaluate(() => window.__cloverhollow?.boot.title() ?? null))
        .toBe("continue");

      await page.locator('.title-option[data-id="new-game"]').click();
      await step(page, 2);

      const confirm = page.locator(".title-confirm");
      await expect(confirm).toBeVisible();
      await expect(confirm).toHaveAttribute("role", "alertdialog");
      await expect(confirm).toHaveAttribute("aria-modal", "true");
      await expect(confirm).toHaveAttribute("aria-labelledby", "title-confirm-text");
      await expect(page.locator("#title-confirm-text")).toHaveText(
        "Start a new game? Your saved game will be replaced.",
      );

      const confirmBox = await confirm.boundingBox();
      const cardBox = await page.locator(".title-confirm-card").boundingBox();
      if (confirmBox === null || cardBox === null) {
        throw new Error("expected title confirm modal and card bounds");
      }
      const clickX = confirmBox.x + 16;
      const clickY = confirmBox.y + 16;
      expect(clickX < cardBox.x || clickY < cardBox.y).toBe(true);

      await page.mouse.click(clickX, clickY);
      await step(page, 2);

      await expect(confirm).toBeHidden();
      expect(await page.evaluate(() => window.__cloverhollow?.boot.title() ?? null))
        .toBe("continue");
      expect(await page.evaluate(() => window.__cloverhollow?.save.last()?.hash ?? null))
        .toBe(savedHash);
      expect(errors).toEqual([]);
    },
  );

  test(
    "renders polite atomic live regions across battle check states and turn header",
    { tag: "@smoke" },
    async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      await gallery(page, "battle-grade", false, "0,0,0,0", { width: 1280, height: 720 });
      const grade = page.locator(".battle-grade");
      await expect(grade).toBeVisible();
      await expect(grade).toHaveAttribute("role", "status");
      await expect(grade).toHaveAttribute("aria-live", "polite");
      await expect(grade).toHaveAttribute("aria-atomic", "true");

      await gallery(page, "battle-peekaboo", false, "0,0,0,0", { width: 1280, height: 720 });
      const peekabooStatus = page.locator(".battle-peekaboo-status");
      await expect(peekabooStatus).toBeVisible();
      await expect(peekabooStatus).toHaveAttribute("role", "status");
      await expect(peekabooStatus).toHaveAttribute("aria-live", "polite");
      await expect(peekabooStatus).toHaveAttribute("aria-atomic", "true");

      await gallery(page, "battle-echo", false, "0,0,0,0", { width: 1280, height: 720 });
      const echoPhase = page.locator(".battle-echo-phase");
      await expect(echoPhase).toBeVisible();
      await expect(echoPhase).toHaveAttribute("role", "status");
      await expect(echoPhase).toHaveAttribute("aria-live", "polite");
      await expect(echoPhase).toHaveAttribute("aria-atomic", "true");

      const hint = page.locator(".battle-check-hint");
      await expect(hint).toBeVisible();
      await expect(hint).toHaveAttribute("aria-live", "polite");
      await expect(hint).toHaveAttribute("aria-atomic", "true");

      await gallery(page, "battle-command", false, "0,0,0,0", { width: 1280, height: 720 });
      const turnHeader = page.locator(".battle-turn-header");
      await expect(turnHeader).toHaveAttribute("aria-live", "polite");
      await expect(turnHeader).toHaveAttribute("aria-atomic", "true");

      expect(errors).toEqual([]);
    },
  );
});
