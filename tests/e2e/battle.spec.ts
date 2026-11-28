import { expect, test, type Page } from "@playwright/test";
import {
  longFlowTimeout,
  playBattleCheck,
  readBattle,
  readState,
  renderInfo,
  resetPaused,
  step,
} from "./helpers";

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

  test("real keys: calm the frog, win his sticker, and talk with him", { tag: "@smoke" },
    async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("./");
    await page.waitForFunction(() => Boolean(window.__cloverhollow));
    await resetPaused(page, "plaza");
    for (const [key, ticks] of approach) await hold(page, key, ticks);
    const before = await renderInfo(page);
    expect(before.critters).toEqual([
      { id: "fountain-frog", kind: "fountain-frog", frame: "chaos_idle_01", x: 1000, y: 820 },
    ]);
    expect(before.drawOrder.map((item) => item.label))
      .toEqual(expect.arrayContaining(["critter:fountain-frog", "critter:fountain-frog:aura"]));
    await expect(page).toHaveScreenshot("overworld-frog-chaos.png");
    await hold(page, "ArrowLeft", 35);
    await expect(page.locator("html")).toHaveAttribute("data-battle", "open");
    const entry = (await readState(page)).player;

    const seen = new Set<string>();
    const track = page.locator(".battle-calm-track");
    const fill = page.locator(".battle-calm-fill");
    const meterValues: number[] = [];
    for (let action = 0; action < 120; action += 1) {
      const battle = (await readBattle(page));
      if (battle === null) break;
      if (battle.phase === "intro" && !seen.has("intro") && await shown(page)) {
        seen.add("intro");
        // Countdown battle meter starts full (100% fizz remaining).
        await expect(track).toHaveAttribute("aria-label", "Lv 2 · Fizzy Frog fizz");
        await expect(track).toHaveAttribute("aria-valuenow", "100");
        expect(await fill.evaluate((node) => node.getAttribute("style"))).toContain("width: 100%");
        meterValues.push(100);
        await expect(page.locator(".sticker-text-revealed")).toHaveText(
          "A fizzy frog hops out of the fountain, puffing pink bubbles!");
        await expect(page).toHaveScreenshot("battle-intro.png");
      }
      if (battle.phase === "check" && battle.check !== null) {
        const side = battle.check?.side;
        if (side === "fae" && !seen.has("burst")) {
          seen.add("burst");
          await step(page, 20);
           const check = (await renderInfo(page)).battle.check;
           const layout = (await renderInfo(page)).battle.layout;
           expect(check?.kind).toBe("chain");
           expect(check?.side).toBe("fae");
           expect(check && layout, "a chain and a layout during the burst").toBeTruthy();
           if (check?.kind === "chain" && layout) {
             expect(Math.abs(check.to.x - layout.fae.x)).toBeLessThanOrEqual(1);
             expect(Math.abs(check.to.y - (layout.fae.baseline - layout.fae.height / 2)))
               .toBeLessThanOrEqual(1);
             expect(check.from.x).toBeCloseTo(layout.critter.x, 0);
             expect(check.from.y).toBeCloseTo(
               layout.critter.baseline - layout.critter.height / 2, 0);
           }
           await expect(page).toHaveScreenshot("battle-burst.png");
        }
        // Press exactly on the target tick: GREAT every time.
         await playBattleCheck(page);
        await expect(page.locator(".battle-grade")).toHaveText("GREAT!");
        if (side === "critter") {
          const hit = await readBattle(page);
          const expectedPct = Math.round((1 - (hit?.calm ?? 0) / 100) * 100);
          await expect(track).toHaveAttribute("aria-valuenow", String(expectedPct));
          expect(expectedPct).toBeLessThan(meterValues.at(-1) ?? 101);
          meterValues.push(expectedPct);
        }
        if (side === "critter" && !seen.has("great")) {
          seen.add("great");
          // Let the result line start typing before the picture.
          await step(page, 40);
          await expect(page.locator(".battle-grade")).toHaveText("GREAT!");
           await expect(page).toHaveScreenshot("battle-check.png");
        }
        await step(page, 1);
        continue;
      }
      if (battle.phase === "soothed" && !seen.has("soothed")) {
        seen.add("soothed");
        await expect(track).toHaveAttribute("aria-valuenow", "0");
        expect(await fill.evaluate((node) => node.getAttribute("style"))).toContain("width: 0%");
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
    expect(after.critters["fountain-frog"]).toBe("calm");
    expect(after.stickers).toEqual(["fountain-frog"]);
    expect(after.player).toEqual(entry);
    await expect(page.locator("html")).not.toHaveAttribute("data-battle", "open");
    expect(meterValues[0]).toBe(100);
    expect(meterValues.at(-1)).toBe(0);
    expect(meterValues.length).toBeGreaterThanOrEqual(3);
    expect([...seen].sort()).toEqual(["burst", "great", "intro", "soothed"]);
    await step(page, 2);
    // Dismiss any post-battle level-up notices (e.g. Maddie leveling up after Play).
    for (let notices = 0; notices < 6; notices += 1) {
      if (!(await page.locator(".sticker-dialogue").isVisible())) break;
      await press(page);
    }
    expect((await renderInfo(page)).critters)
      .toEqual([
        { id: "fountain-frog", kind: "fountain-frog", frame: "calm_idle_01", x: 1000, y: 820 },
      ]);
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
    expect(after.critters["fountain-frog"]).toBe("chaos");
    expect(after.player).toEqual(entry);
    await expect(page.locator("html")).not.toHaveAttribute("data-battle", "open");
    await context.close();
  });

  test("real keys: enemy battle meter starts at 100% fizz and counts down to 0%", {
    tag: "@smoke",
  }, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("./");
    await page.waitForFunction(() => Boolean(window.__cloverhollow));
    await resetPaused(page, "plaza");
    for (const [key, ticks] of approach) await hold(page, key, ticks);
    await hold(page, "ArrowLeft", 35);
    await expect(page.locator("html")).toHaveAttribute("data-battle", "open");

    const track = page.locator(".battle-calm-track");
    const fill = page.locator(".battle-calm-fill");
    await expect(track).toHaveAttribute("aria-label", /fizz$/);
    await expect(track).toHaveAttribute("aria-valuenow", "100");
    expect(await fill.evaluate((node) => node.getAttribute("style"))).toContain("width: 100%");

    const meterValues: number[] = [100];
    let sawSoothedZero = false;
    for (let action = 0; action < 120; action += 1) {
      const battle = await readBattle(page);
      if (battle === null) break;
      if (battle.phase === "check" && battle.check !== null) {
        const side = battle.check.side;
        await playBattleCheck(page);
        if (side === "critter") {
          const hit = await readBattle(page);
          const expectedPct = Math.round((1 - (hit?.calm ?? 0) / 100) * 100);
          await expect(track).toHaveAttribute("aria-valuenow", String(expectedPct));
          expect(expectedPct).toBeLessThan(meterValues.at(-1) ?? 101);
          meterValues.push(expectedPct);
        }
        await step(page, 1);
        continue;
      }
      if (battle.phase === "soothed" && !sawSoothedZero) {
        sawSoothedZero = true;
        await expect(track).toHaveAttribute("aria-valuenow", "0");
        expect(await fill.evaluate((node) => node.getAttribute("style"))).toContain("width: 0%");
      }
      await press(page);
    }
    expect(sawSoothedZero).toBe(true);
    expect(meterValues[0]).toBe(100);
    expect(meterValues.at(-1)).toBe(0);
    expect(meterValues.length).toBeGreaterThanOrEqual(4);
  });

  test("real keys: missing Soothe deals 0 calm and losing plays rest faint + dark blackout respawn",
    { tag: "@smoke" }, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto("./");
      await page.waitForFunction(() => Boolean(window.__cloverhollow));
      await resetPaused(page, "plaza");
      const fountainSpawn = (await readState(page)).player;
      for (const [key, ticks] of approach) await hold(page, key, ticks);
      await hold(page, "ArrowLeft", 35);
      await expect(page.locator("html")).toHaveAttribute("data-battle", "open");

      const track = page.locator(".battle-calm-track");
      const fill = page.locator(".battle-calm-fill");

      // Advance through intro to command, pick Soothe, and let the ring time out to MISS.
      for (let i = 0; i < 20; i += 1) {
        const battle = await readBattle(page);
        if (battle?.phase === "command" && await shown(page)) break;
        await press(page);
      }
      await press(page);
      expect((await readBattle(page))?.phase).toBe("check");
      for (let i = 0; i < 90; i += 1) {
        if ((await readBattle(page))?.phase === "result") break;
        await step(page, 1);
      }
      const missed = await readBattle(page);
      expect(missed?.phase).toBe("result");
      expect(missed?.lastGrade).toBe("miss");
      expect(missed?.calm).toBe(0);
      await expect(page.locator(".battle-grade")).toHaveText("MISS");
      await expect(track).toHaveAttribute("aria-valuenow", "100");
      expect(await fill.evaluate((node) => node.getAttribute("style"))).toContain("width: 100%");
      await expect(page.locator(".battle-popup")).toHaveCount(0);

      // Keep missing Soothe checks and frog bursts until energy hits 0 -> phase === "rest".
      for (let action = 0; action < 120; action += 1) {
        const battle = await readBattle(page);
        if (battle === null || battle.phase === "rest") break;
        if (battle.phase === "check") {
          for (let tick = 0; tick < 200; tick += 1) {
            if ((await readBattle(page))?.phase !== "check") break;
            await step(page, 1);
          }
          continue;
        }
        await press(page);
      }
      // Let Fae finish the dizzy sway + sideways slump and let the rest line type out.
      await step(page, 120);
      const resting = await readBattle(page);
      expect(resting?.phase).toBe("rest");
      expect(resting?.energy).toBeLessThanOrEqual(0);
      expect(await shown(page)).toBe(true);

      // Confirm out of rest: dark blackout fade covers the fainted battle stage with zero flash.
      await press(page);
      const fadeOutStart = await readState(page);
      expect(fadeOutStart.battle).toBeNull();
      expect(fadeOutStart.transition).toMatchObject({
        target: { area: "plaza", spawn: "fountain" },
        phase: "out",
        tone: "dark",
      });
      expect((await renderInfo(page)).battle.overworldVisible).toBe(false);

      // By tick 12 of "out", blackout reaches 1.0 while the fainted stage still stays up.
      await step(page, 11);
      const blackoutOut = await renderInfo(page);
      expect(blackoutOut.fade).toBe(1);
      expect(blackoutOut.battle.overworldVisible).toBe(false);

      // Cross into "in": blackout holds at 1.0 as the respawned safe spot swaps in behind it.
      await step(page, 8);
      const fadingInState = await readState(page);
      expect(fadingInState.transition).toMatchObject({
        target: { area: "plaza", spawn: "fountain" },
        phase: "in",
        tone: "dark",
      });
      const blackoutIn = await renderInfo(page);
      expect(blackoutIn.fade).toBe(1);
      expect(blackoutIn.battle.overworldVisible).toBe(true);

      // Finish fading in: cleanly respawned at plaza.fountain with the frog still in chaos.
      await step(page, 20);
      const after = await readState(page);
      expect(after.transition).toBeNull();
      expect(after.area).toBe("plaza");
      expect(after.player).toEqual(fountainSpawn);
      expect(after.critters["fountain-frog"]).toBe("chaos");
      expect((await renderInfo(page)).fade).toBe(0);
      await expect(page.locator("html")).not.toHaveAttribute("data-battle", "open");
    });
});
