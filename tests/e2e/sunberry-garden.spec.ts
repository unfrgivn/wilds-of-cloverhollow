import { expect, test, type Page } from "@playwright/test";
import { readState, renderInfo, step, walk } from "./helpers";

async function press(page: Page, key = "z"): Promise<void> {
  await page.keyboard.down(key);
  await step(page, 1);
  await page.keyboard.up(key);
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
  await step(page, 2);
}

test(
  "clubhouse ripe garden shimmers gold, plucks Golden Sunberry, and records Journal treat & note",
  { tag: "@smoke" },
  async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("./?qa=clubhouse");
    await page.waitForFunction(() => Boolean(window.__cloverhollow));
    await page.evaluate(() => window.__cloverhollow?.pause());
    await step(page, 1);

    await runQaCommands(page, ["garden ripe"]);
    await step(page, 4);

    // Golden Sunberry shimmer motes float over the clubhouse planter when ripe.
    const beforeInfo = await renderInfo(page);
    expect(beforeInfo.area).toBe("clubhouse");
    expect(
      beforeInfo.drawOrder.filter((item) => item.label.startsWith("clubhouse:sunberry:")),
    ).toHaveLength(6);

    // Walk Fae to the Clubhouse garden planter with real keys.
    await walk(page, "x", 790);
    await walk(page, "y", 535);
    await press(page, "ArrowDown");
    await expect(page.locator(".sticker-prompt")).toContainText("LOOK");

    // Open the ripe garden dialogue and advance to the Golden Sunberry harvest choice.
    await press(page, "z");
    for (let tries = 0; tries < 20; tries += 1) {
      const dialogue = (await readState(page)).dialogue;
      if (dialogue === null) throw new Error("dialogue closed before choices appeared");
      if (dialogue.choices.length > 0 && dialogue.revealed >= dialogue.text.length) break;
      await press(page, "z");
    }

    const choices = (await readState(page)).dialogue?.choices ?? [];
    expect(choices).toEqual([
      "Pick a strawberry basket",
      "Pluck a magical Golden Sunberry",
    ]);

    // Highlight "Pluck a magical Golden Sunberry" and capture review screenshot.
    await press(page, "ArrowDown");
    if (process.env.CLOVERHOLLOW_REVIEW_SHOTS === "1" && testInfo.project.name === "chromium") {
      await page.evaluate(() =>
        Promise.all(
          document
            .getAnimations()
            .filter((item) => item.effect?.getComputedTiming().iterations !== Infinity)
            .map((item) => item.finished),
        ),
      );
      await page.screenshot({
        path: "art/review/m111-sunberry-garden.jpg",
        type: "jpeg",
        quality: 90,
      });
    }

    // Confirm plucking the Golden Sunberry and finish Jordan's reaction.
    await press(page, "z");
    for (let tries = 0; tries < 20; tries += 1) {
      if ((await readState(page)).dialogue === null) break;
      await press(page, "z");
    }
    expect((await readState(page)).dialogue).toBeNull();
    expect((await readState(page)).treats?.["sunberry-nectar"]).toBe(1);

    // Shimmer motes clear once harvested.
    await step(page, 2);
    const afterInfo = await renderInfo(page);
    expect(
      afterInfo.drawOrder.filter((item) => item.label.startsWith("clubhouse:sunberry:")),
    ).toHaveLength(0);

    // Open Journal (J) and confirm Golden Sunberry ×1 and the Sunberry note appear.
    await press(page, "j");
    await expect(page.locator(".journal-book")).toBeVisible();
    await expect(page.locator(".journal-treats-strip")).toContainText("Golden Sunberry ×1");
    await expect(page.locator(".journal-notes")).toContainText("Golden Sunberries");

    expect(errors).toEqual([]);
  },
);
