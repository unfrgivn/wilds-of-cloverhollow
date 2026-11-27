import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  longFlowTimeout,
  openHarness,
  playBattleCheck,
  queueScript,
  readBattle,
  readState,
  recording,
  resetPaused,
  step,
} from "./helpers";

const firstLine = "Morning sun... and something sparkly over the plaza.";
const secondLine = "The fountain is fizzing pink bubbles. That's not normal.";
const laterLine = "Backpack, socks, teeth. Then I'll investigate.";
const walkPerTick = 4;
const underWindow = { x: 612, y: 338 };

async function hold(page: Page, key: string, ticks: number): Promise<void> {
  await page.keyboard.down(key);
  await step(page, ticks);
  await page.keyboard.up(key);
}

async function clickAndStep(page: Page, target: Locator): Promise<void> {
  await target.click();
  await step(page, 2);
}

async function walkToWindow(page: Page): Promise<void> {
  const start = await readState(page);
  await hold(
    page,
    "ArrowRight",
    Math.round((underWindow.x - start.player.x) / walkPerTick),
  );
  const below = await readState(page);
  await hold(
    page,
    "ArrowUp",
    Math.round((below.player.y - underWindow.y) / walkPerTick),
  );
}

test.describe("Milestone 126: Universal Pointer & Touch Click-to-Advance Ergonomics", () => {
  test.setTimeout(longFlowTimeout);

  test(
    "clicks overworld LOOK prompt pill and dialogue box to reveal, advance, and keep choices safe",
    { tag: "@smoke" },
    async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      await page.setViewportSize({ width: 1280, height: 720 });
      await openHarness(page);
      await resetPaused(page, "new-game");
      await walkToWindow(page);

      const prompt = page.locator(".sticker-prompt");
      const box = page.locator(".sticker-dialogue");
      const text = page.locator(".sticker-text-revealed");
      const choices = page.locator(".sticker-choice");

      await expect(prompt).toBeVisible();
      await expect(prompt).toHaveAttribute("role", "button");
      await expect(prompt).toHaveAttribute("aria-label", "LOOK");
      await expect(prompt.locator("span")).toHaveText("LOOK");

      // Click the floating LOOK pill directly without pressing Z.
      await clickAndStep(page, prompt);
      await expect(box).toBeVisible();
      await expect(box).toHaveClass(/is-clickable/);
      await step(page, 8);
      await expect(text).not.toHaveText(firstLine);

      // Clicking the dialogue card while typing finishes revealing the line.
      await clickAndStep(page, box);
      await expect(text).toHaveText(firstLine);
      await expect(box).toHaveClass(/is-clickable/);

      // Clicking the dialogue card again advances to the second line.
      await clickAndStep(page, box);
      await step(page, 8);
      await expect(choices).toHaveCount(0);
      await expect(box).toHaveClass(/is-clickable/);

      // Click to finish revealing the second line so choices open.
      await clickAndStep(page, box);
      await expect(text).toHaveText(secondLine);
      await expect(choices).toHaveText([
        "Go see right now!",
        "School first, then investigate.",
      ]);
      await expect(box).not.toHaveClass(/is-clickable/);

      // Clicking the dialogue box while choices are open must not pick a choice.
      await clickAndStep(page, box);
      await expect(text).toHaveText(secondLine);
      await expect(choices).toHaveCount(2);

      // Clicking a choice picks the branch; clicking the dialogue box finishes & closes it.
      await clickAndStep(page, choices.nth(1));
      await expect(choices).toHaveCount(0);
      await expect(box).toHaveClass(/is-clickable/);
      await clickAndStep(page, box);
      await expect(text).toHaveText(laterLine);
      await clickAndStep(page, box);
      await expect(box).toBeHidden();

      expect(errors).toEqual([]);
    },
  );

  test(
    "clicks battle dialogue box to advance intro and clicks battle reward sticker card to confirm",
    { tag: "@smoke" },
    async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      await page.setViewportSize({ width: 1280, height: 720 });
      await openHarness(page);
      await resetPaused(page, "plaza");

      // Walk to the Fountain Frog to enter battle.
      for (const [key, ticks] of [
        ["ArrowDown", 25],
        ["ArrowLeft", 15],
        ["ArrowDown", 50],
        ["ArrowLeft", 35],
      ] as const) {
        await hold(page, key, ticks);
      }

      const box = page.locator(".sticker-dialogue");
      const reward = page.locator(".battle-reward");
      await expect(page.locator("html")).toHaveAttribute("data-battle", "open");
      await expect(box).toBeVisible();
      await expect(box).toHaveClass(/is-clickable/);

      // Click the dialogue box directly to finish typing and advance intro into command phase.
      await clickAndStep(page, box);
      expect((await readBattle(page))?.phase).toBe("intro");
      await clickAndStep(page, box);
      expect((await readBattle(page))?.phase).toBe("command");

      // Finish revealing the command prompt; clicking the box in command phase must not confirm.
      await step(page, 60);
      await expect(box).not.toHaveClass(/is-clickable/);
      await clickAndStep(page, box);
      expect((await readBattle(page))?.phase).toBe("command");

      // Calm the Fountain Frog using real checks + dialogue box clicks until the reward card shows.
      let reachedReward = false;
      for (let turn = 0; turn < 120; turn += 1) {
        const battle = await readBattle(page);
        if (battle === null) break;
        if (battle.phase === "check" && battle.check !== null) {
          await playBattleCheck(page);
          await step(page, 1);
          continue;
        }
        if (battle.phase === "command") {
          await clickAndStep(page, page.locator(".battle-command").first());
          continue;
        }
        if (battle.phase === "reward") {
          await step(page, 80);
          await expect(reward).toBeVisible();
          await expect(page.locator(".battle-reward-name")).toHaveText("Fountain Frog");
          reachedReward = true;
          // Click the reward sticker card itself to collect the sticker and close the battle.
          await clickAndStep(page, reward);
          break;
        }
        await clickAndStep(page, box);
      }

      expect(reachedReward).toBe(true);
      const after = await readState(page);
      expect(after.battle).toBeNull();
      expect(after.stickers).toContain("fountain-frog");
      await expect(reward).toBeHidden();
      expect(errors).toEqual([]);
    },
  );

  test(
    "clicks ending credits screen after grace window to return cleanly to the Title Screen",
    { tag: "@smoke" },
    async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      await page.setViewportSize({ width: 1280, height: 720 });
      await openHarness(page);
      await resetPaused(page, "new-game");

      const endingScript = recording("tests/sim/scripts/new-game/golden-ending.json");
      const totalTicks = endingScript.reduce((total, segment) => total + segment.ticks, 0);
      await queueScript(page, endingScript);
      await step(page, totalTicks);

      const credits = page.locator(".credits-screen");
      await expect(credits).toBeVisible();
      expect((await readState(page)).finale).toBe("credits");

      const titleMode = async (): Promise<string | null> =>
        page.evaluate(() => window.__cloverhollow?.boot.title() ?? null);

      // Premature click before the beat guard must not skip the ending credits.
      await clickAndStep(page, credits);
      expect(await titleMode()).toBeNull();
      await expect(credits).toBeVisible();

      // After the grace beat, clicking the credits screen returns cleanly to the Title Screen.
      await step(page, 12);
      await clickAndStep(page, credits);
      expect(await titleMode()).toBe("continue");
      await expect(credits).toBeHidden();
      await expect(page.locator(".title-option-label")).toHaveText(["Continue", "New game"]);
      expect(errors).toEqual([]);
    },
  );
});
