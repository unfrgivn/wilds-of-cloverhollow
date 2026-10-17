import { expect, test, type Page } from "@playwright/test";
import { readBattle, renderInfo, resetPaused, step } from "./helpers";

async function hold(page: Page, key: string, ticks: number): Promise<void> {
  await page.keyboard.down(key);
  await step(page, ticks);
  await page.keyboard.up(key);
}

async function press(page: Page): Promise<void> {
  await page.keyboard.down("Enter");
  await step(page, 1);
  await page.keyboard.up("Enter");
  await step(page, 1);
}

const settleTicks = 120;
const approach = [
  ["ArrowDown", 25],
  ["ArrowLeft", 15],
  ["ArrowDown", 50],
] as const;

test.describe("Sue party member", () => {
  test("real keys: Sue walks and Cast appears in the frog battle", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("./");
    await page.waitForFunction(() => Boolean(window.__cloverhollow));
    await resetPaused(page, "plaza-party");

    const initial = await renderInfo(page);
    expect(initial.party.map((member) => member.id)).toEqual(["maddie", "sue"]);
    expect(initial.party.every((member) => member.frame >= 0)).toBe(true);

    for (const [key, ticks] of approach) await hold(page, key, ticks);
    const walking = await renderInfo(page);
    expect(walking.party.map((member) => member.id)).toEqual(["maddie", "sue"]);
    expect(walking.party.some((member) => member.animation.startsWith("walk_"))).toBe(true);
    expect(walking.party.find((member) => member.id === "sue")?.frame).not.toBe(
      initial.party.find((member) => member.id === "sue")?.frame,
    );
    expect(walking.drawOrder.map((item) => item.label)).toEqual(
      expect.arrayContaining(["fae", "maddie", "sue"]),
    );
    // Walking toward the camera, the party trails straight behind Fae, where
    // Maddie is hidden; standing still, everyone settles where they're seen.
    await step(page, settleTicks);
    await expect(page).toHaveScreenshot("sue-plaza-1280.png");

    await hold(page, "ArrowLeft", 35);
    await expect(page.locator("html")).toHaveAttribute("data-battle", "open");
    for (let tick = 0; tick < 20; tick += 1) {
      const battle = await readBattle(page);
      if (battle?.phase === "command" && battle.revealed >= battle.message.length) break;
      await press(page);
    }
    await expect(page.locator(".battle-command-label")).toHaveText([
      "Soothe",
      "Play",
      "Cast",
      "Snack",
      "Run",
    ]);
    const battleLayout = (await renderInfo(page)).battle.layout;
    expect(battleLayout?.party).toHaveLength(2);
    expect(battleLayout?.party[0]?.y).toBe(battleLayout?.fae.baseline);
    expect(battleLayout?.party[1]?.y).toBe(battleLayout?.fae.baseline);
    await expect(page).toHaveScreenshot("sue-battle-1280.png");

    await hold(page, "ArrowDown", 1);
    await step(page, 1);
    await hold(page, "ArrowDown", 1);
    expect((await readBattle(page))?.selected).toBe(2);
    await press(page);
    expect((await readBattle(page))?.phase).toBe("check");
    const check = await readBattle(page);
    if (check?.check?.kind !== "charge") throw new Error("Cast did not start a charge");
    await page.keyboard.down("Enter");
    await step(page, Math.floor(check.check.spec.targetTick / 2));
    await expect(page).toHaveScreenshot("sue-cast-mid-charge.png");
    await step(page, check.check.spec.targetTick - Math.floor(check.check.spec.targetTick / 2));
    await page.keyboard.up("Enter");
    await step(page, 1);
    await expect(page.locator(".battle-grade")).toHaveText("GREAT!");
    await step(page, 60);
    await expect(page.locator(".sticker-text-revealed")).toContainText("Sue");
    await expect(page.locator(".sticker-text-revealed")).toHaveText(
      /Sue's bobber|Sue casts her ribbon bobber/,
    );
    const cast = page.locator(".battle-command").filter({ hasText: "Cast" });
    await expect(cast).toHaveAttribute("aria-disabled", "true");
    await expect(cast).toContainText("reeling in");
  });

  test("touch: Cast holds the confirm sticker through a charge", async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 874, height: 402 },
      hasTouch: true,
    });
    const page = await context.newPage();
    await page.goto("./?touch=1");
    await page.waitForFunction(() => Boolean(window.__cloverhollow));
    await resetPaused(page, "plaza-party");
    for (const [key, ticks] of approach) await hold(page, key, ticks);
    await hold(page, "ArrowLeft", 35);
    const tap = async (selector: string): Promise<void> => {
      const bounds = await page.locator(selector).boundingBox();
      if (bounds === null) throw new Error(`${selector} is not visible`);
      await page.touchscreen.tap(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
      await step(page, 2);
    };
    for (let count = 0; count < 20; count += 1) {
      const battle = await readBattle(page);
      if (battle?.phase === "command" && battle.revealed >= battle.message.length) break;
      await tap(".touch-confirm");
    }
    await tap(".battle-command:has-text('Cast')");
    const check = await readBattle(page);
    if (check?.check?.kind !== "charge") throw new Error("Cast did not start a charge");
    const confirm = page.locator(".touch-confirm");
    await confirm.dispatchEvent("pointerdown", {
      pointerId: 1, pointerType: "touch", isPrimary: true,
    });
    await step(page, check.check.spec.targetTick);
    await confirm.dispatchEvent("pointerup", {
      pointerId: 1, pointerType: "touch", isPrimary: true,
    });
    await step(page, 1);
    await expect(page.locator(".battle-grade")).toHaveText("GREAT!");
    await context.close();
  });

  test("the compact battle composition fits", async ({ page }) => {
    await page.setViewportSize({ width: 874, height: 402 });
    await page.goto("./");
    await page.waitForFunction(() => Boolean(window.__cloverhollow));
    await resetPaused(page, "plaza-party");
    for (const [key, ticks] of approach) await hold(page, key, ticks);
    const walking = await renderInfo(page);
    expect(walking.party.map((member) => member.id)).toEqual(["maddie", "sue"]);
    await step(page, settleTicks);
    await expect(page).toHaveScreenshot("sue-plaza-874.png");
    await hold(page, "ArrowLeft", 35);
    await expect(page.locator("html")).toHaveAttribute("data-battle", "open");
    for (let tick = 0; tick < 20; tick += 1) {
      const battle = await readBattle(page);
      if (battle?.phase === "command" && battle.revealed >= battle.message.length) break;
      await press(page);
    }
    await expect(page.locator(".battle-command-label")).toHaveText([
      "Soothe",
      "Play",
      "Cast",
      "Snack",
      "Run",
    ]);
    await expect(page).toHaveScreenshot("sue-battle-874.png");
  });
});
