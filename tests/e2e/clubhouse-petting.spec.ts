import { expect, test, type Page } from "@playwright/test";
import { readHash, readState, renderInfo, resetPaused, step, walk } from "./helpers";

async function openClubhouseQa(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("./?qa=clubhouse");
  await page.waitForFunction(() => Boolean(window.__cloverhollow));
  await page.evaluate(() => window.__cloverhollow?.pause());
  await step(page, 1);
}

async function runQaCommands(page: Page, commands: readonly string[]): Promise<void> {
  await page.keyboard.press("`");
  await expect(page.locator(".qa-console")).toBeVisible();
  for (const command of commands) {
    await page.keyboard.type(command);
    await page.keyboard.press("Enter");
  }
  await page.keyboard.press("Escape");
  await expect(page.locator(".qa-console")).toBeHidden();
  await step(page, 1);
}

test(
  "clubhouse renders all 13 prizes and 8 keepsakes, pets Maddie cleanly, and rests on beanbag",
  { tag: "@smoke" },
  async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await openClubhouseQa(page);
    await runQaCommands(page, ["prizes all", "stickers all", "keepsakes on"]);

    const displayInfo = await renderInfo(page);
    expect(displayInfo.area).toBe("clubhouse");
    expect(displayInfo.clubhouseDisplay).toBeGreaterThanOrEqual(21);
    expect(
      displayInfo.drawOrder.filter((item) => item.label.startsWith("clubhouse:prize:")),
    ).toHaveLength(13);
    expect(
      displayInfo.drawOrder.filter((item) => item.label.startsWith("clubhouse:keepsake:")),
    ).toHaveLength(8);

    // Clean framing at both desktop (1280x720) and phone landscape (874x402).
    const canvas = page.locator("canvas");
    await expect.poll(async () => (await canvas.boundingBox())?.width).toBe(1280);
    await expect.poll(async () => (await canvas.boundingBox())?.height).toBe(720);
    if (process.env.CLOVERHOLLOW_REVIEW_SHOTS === "1" && testInfo.project.name === "chromium") {
      await page.screenshot({
        path: "art/review/m96-clubhouse-21-items.jpg",
        type: "jpeg",
        quality: 90,
      });
    }

    await page.setViewportSize({ width: 874, height: 402 });
    await expect.poll(async () => (await canvas.boundingBox())?.width).toBe(874);
    await expect.poll(async () => (await canvas.boundingBox())?.height).toBe(402);
    await step(page, 1);
    expect((await renderInfo(page)).clubhouseDisplay).toBeGreaterThanOrEqual(21);

    await page.setViewportSize({ width: 1280, height: 720 });
    await expect.poll(async () => (await canvas.boundingBox())?.width).toBe(1280);
    await step(page, 1);

    // Deterministic fixture reset: turn left toward Maddie, press Z to pet her,
    // and verify the core state hash stays identical to standing idle.
    await resetPaused(page, "clubhouse");
    await page.keyboard.down("ArrowLeft");
    await step(page, 2);
    await page.keyboard.up("ArrowLeft");
    await step(page, 1);

    await page.keyboard.down("z");
    await step(page, 1);
    await page.keyboard.up("z");
    await step(page, 6);

    const petInfo = await renderInfo(page);
    expect(petInfo.petting).toBe("maddie");
    expect(petInfo.dialogue.open).toBe(false);
    const hashAfterPet = await readHash(page);

    await resetPaused(page, "clubhouse");
    await page.keyboard.down("ArrowLeft");
    await step(page, 2);
    await page.keyboard.up("ArrowLeft");
    await step(page, 8);
    expect(await readHash(page)).toBe(hashAfterPet);

    // Walk Fae to the Clubhouse beanbag rest spot, press Z to relax, then move to stand up.
    await walk(page, "y", 470);
    await walk(page, "x", 790);
    await step(page, 2);
    const atBeanbag = await readState(page);
    expect(Math.hypot(atBeanbag.player.x - 790, atBeanbag.player.y - 470)).toBeLessThanOrEqual(24);

    await page.keyboard.down("z");
    await step(page, 1);
    await page.keyboard.up("z");
    await step(page, 8);
    expect((await renderInfo(page)).resting).toBe("clubhouse-beanbag");

    // Moving immediately stands Fae back up.
    await page.keyboard.down("ArrowLeft");
    await step(page, 2);
    await page.keyboard.up("ArrowLeft");
    await step(page, 1);
    expect((await renderInfo(page)).resting).toBeNull();

    expect(errors).toEqual([]);
  },
);
