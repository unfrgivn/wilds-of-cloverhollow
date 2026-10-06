import { expect, test, type Page } from "@playwright/test";
import { longFlowTimeout, readBattle, readState, renderInfo, resetPaused, step } from "./helpers";

// One press of Enter, then a released tick so the next press is a new edge.
async function press(page: Page): Promise<void> {
  await page.keyboard.down("Enter");
  await step(page, 1);
  await page.keyboard.up("Enter");
  await step(page, 1);
}

async function hold(page: Page, key: string, ticks: number): Promise<void> {
  await page.keyboard.down(key);
  await step(page, ticks);
  await page.keyboard.up(key);
}

// From the plaza fixture (the fountain spawn) to beside the frog; walking
// left from there enters his touch circle at (1062, 855).
const approach = [["ArrowDown", 25], ["ArrowLeft", 15], ["ArrowDown", 50]] as const;

async function shown(page: Page): Promise<boolean> {
  const battle = (await readBattle(page));
  return battle !== null && battle.revealed >= battle.message.length;
}

test.describe("frog battle", () => {
  test.setTimeout(longFlowTimeout);

  test("real keys: calm the frog, win his sticker, and talk with him", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("./");
    await page.waitForFunction(() => Boolean(window.__cloverhollow));
    await resetPaused(page, "plaza");
    for (const [key, ticks] of approach) await hold(page, key, ticks);
    const before = await renderInfo(page);
    expect(before.critters).toEqual([{ id: "frog", frame: "chaos_idle_01" }]);
    expect(before.drawOrder.map((item) => item.label))
      .toEqual(expect.arrayContaining(["critter:frog", "critter:frog:aura"]));
    await expect(page).toHaveScreenshot("overworld-frog-chaos.png");
    await hold(page, "ArrowLeft", 35);
    await expect(page.locator("html")).toHaveAttribute("data-battle", "open");
    const entry = (await readState(page)).player;

    const seen = new Set<string>();
    for (let action = 0; action < 120; action += 1) {
      const battle = (await readBattle(page));
      if (battle === null) break;
      if (battle.phase === "intro" && !seen.has("intro") && await shown(page)) {
        seen.add("intro");
        await expect(page.locator(".sticker-text-revealed")).toHaveText(
          "A fizzy frog hops out of the fountain, puffing pink bubbles!");
        await expect(page).toHaveScreenshot("battle-intro.png");
      }
      if (battle.phase === "aim" && battle.aim !== null) {
        const side = battle.aim.side;
        if (side === "fae" && !seen.has("burst")) {
          seen.add("burst");
          await step(page, 20);
          const ring = (await renderInfo(page)).battle.ring;
          const layout = (await renderInfo(page)).battle.layout;
          expect(ring && layout, "a ring and a layout during the burst").toBeTruthy();
          if (ring && layout) {
            expect(Math.abs(ring.x - layout.fae.x)).toBeLessThanOrEqual(1);
            expect(Math.abs(ring.y - (layout.fae.baseline - layout.fae.height / 2)))
              .toBeLessThanOrEqual(1);
          }
          await expect(page).toHaveScreenshot("battle-burst.png");
        }
        // Press exactly on the target tick: GREAT every time.
        const current = (await readBattle(page));
        if (current?.aim) await step(page, current.aim.targetTick - current.aimTick - 1);
        await page.keyboard.down("Enter");
        await step(page, 1);
        await page.keyboard.up("Enter");
        await expect(page.locator(".battle-grade")).toHaveText("GREAT!");
        if (side === "critter" && !seen.has("great")) {
          seen.add("great");
          // Let the result line start typing before the picture.
          await step(page, 40);
          await expect(page.locator(".battle-grade")).toHaveText("GREAT!");
          await expect(page).toHaveScreenshot("battle-aim.png");
        }
        await step(page, 1);
        continue;
      }
      if (battle.phase === "reward" && await shown(page)) {
        await expect(page.locator(".battle-reward")).toBeVisible();
        await expect(page.locator(".battle-reward-name")).toHaveText("Fountain Frog");
        await expect(page.locator(".battle-hud")).toBeHidden();
        await expect(page).toHaveScreenshot("battle-reward.png");
      }
      await press(page);
    }

    const after = await readState(page);
    expect(after.battle, "the battle ends").toBeNull();
    expect(after.critters.frog).toBe("calm");
    expect(after.stickers).toEqual(["fountain-frog"]);
    expect(after.player).toEqual(entry);
    await expect(page.locator("html")).not.toHaveAttribute("data-battle", "open");
    expect([...seen].sort()).toEqual(["burst", "great", "intro"]);
    await step(page, 2);
    expect((await renderInfo(page)).critters).toEqual([{ id: "frog", frame: "calm_idle_01" }]);
    await expect(page).toHaveScreenshot("overworld-frog-calm.png");

    // Walking into the calm frog starts no battle; he talks instead.
    await hold(page, "ArrowLeft", 4);
    expect((await readBattle(page))).toBeNull();
    const prompt = page.locator(".sticker-prompt");
    await expect(prompt).toBeVisible();
    await expect(prompt.locator("span")).toHaveText("TALK");
    await press(page);
    await step(page, 120);
    await expect(page.locator(".sticker-speaker")).toHaveText("FOUNTAIN FROG", {
      useInnerText: true });
    await expect(page.locator(".sticker-text-revealed")).toHaveText(
      "Ribbit! Thank you for the song, Fae. My head feels all clear now.");
    await press(page);
    await step(page, 120);
    await expect(page.locator(".sticker-text-revealed")).toHaveText(
      "Something purple fizzed into my fountain last night. It tasted like trouble!");
    await press(page);
    await expect(page.locator(".sticker-dialogue")).toBeHidden();
    await press(page);
    await step(page, 120);
    await expect(page.locator(".sticker-text-revealed")).toHaveText(
      "Ribbit! The fountain is singing again.");
  });

  test("touch: run away by tapping the Run sticker", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 874, height: 402 },
      hasTouch: true });
    const page = await context.newPage();
    await page.goto("./?touch=1");
    await page.waitForFunction(() => Boolean(window.__cloverhollow));
    await resetPaused(page, "plaza");
    for (const [key, ticks] of approach) await hold(page, key, ticks);
    await hold(page, "ArrowLeft", 35);
    await expect(page.locator("html")).toHaveAttribute("data-battle", "open");
    const entry = (await readState(page)).player;
    const tap = async (selector: string): Promise<void> => {
      const bounds = await page.locator(selector).boundingBox();
      if (bounds === null) throw new Error(`${selector} is not visible`);
      await page.touchscreen.tap(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
      await step(page, 2);
    };
    for (let taps = 0; taps < 8; taps += 1) {
      const battle = (await readBattle(page));
      if (battle?.phase === "command" && await shown(page)) break;
      await tap(".touch-confirm");
    }
    await expect(page.locator(".battle-command")).toHaveCount(4);
    await tap(".battle-command:has-text('Run')");
    expect((await readBattle(page))?.phase).toBe("run");
    for (let taps = 0; taps < 4 && (await readBattle(page)) !== null; taps += 1)
      await tap(".touch-confirm");
    const after = await readState(page);
    expect(after.battle).toBeNull();
    expect(after.critters.frog).toBe("chaos");
    expect(after.player).toEqual(entry);
    await expect(page.locator("html")).not.toHaveAttribute("data-battle", "open");
    await context.close();
  });
});
