import { expect, test, type Page } from "@playwright/test";
import {
  bunHash,
  longFlowTimeout,
  openHarness,
  playWithKeys,
  readHash,
  readState,
  recording,
  resetPaused,
  step,
} from "./helpers";

// Milestone 27: coins and shops, with real keys. The recorded run
// (`tools/sim/record-bakery.ts`) is played as key presses: the fountain frog
// is calmed for 8 coins, the plaza bakery sells Fae a snack for 5, and she
// eats it in the park pup's battle before soothing him for 8 more. The end
// state must hash the same as Bun's replay of the same run.

test.describe.configure({ timeout: longFlowTimeout });

// Only what the watcher reads; the whole state is too heavy to fetch often.
async function probe(page: Page): Promise<{
  coins: number;
  snacks: number;
  dialogue: { knot: string; choices: number; shown: boolean } | null;
  battle: { critterId: string; phase: string; shown: boolean } | null;
}> {
  return page.evaluate(() => {
    const state = window.__cloverhollow?.getState();
    if (state === undefined) throw new Error("hook unavailable");
    const { dialogue, battle } = state;
    return {
      coins: state.coins,
      snacks: state.snacks,
      dialogue: dialogue === null ? null : {
        knot: dialogue.knot,
        choices: dialogue.choices.length,
        shown: dialogue.revealed >= dialogue.text.length,
      },
      battle: battle === null ? null : {
        critterId: battle.critterId,
        phase: battle.phase,
        shown: battle.revealed >= battle.message.length,
      },
    };
  });
}

// The same moment on a desktop, then on a phone.
async function shoot(page: Page, name: string): Promise<void> {
  await expect(page).toHaveScreenshot(`${name}-1280.png`);
  await page.setViewportSize({ width: 874, height: 402 });
  await expect(page).toHaveScreenshot(`${name}-874.png`);
  await page.setViewportSize({ width: 1280, height: 720 });
}

test("real keys: the frog's coins buy a bakery snack, eaten in the pup's battle", async ({
  page,
}) => {
  const path = "tests/sim/scripts/plaza/bakery.json";
  await page.setViewportSize({ width: 1280, height: 720 });
  await openHarness(page);
  await resetPaused(page, "plaza");
  let shopShot = false;
  let snackShot = false;
  await playWithKeys(page, recording(path), 10, async () => {
    const state = await probe(page);
    if (!shopShot && state.dialogue?.knot === "bakery" && state.dialogue.shown &&
      state.dialogue.choices > 0) {
      shopShot = true;
      expect({ coins: state.coins, snacks: state.snacks }).toEqual({ coins: 8, snacks: 2 });
      await expect(page.locator(".sticker-choice"))
        .toHaveText(["Buy a snack for 5 coins", "Not now"]);
      await shoot(page, "bakery-choice");
    }
    if (!snackShot && state.battle?.critterId === "pup" && state.battle.phase === "command" &&
      state.battle.shown) {
      const selected = page.locator('.battle-command[aria-selected="true"]');
      if (await selected.locator(".battle-command-label").textContent() === "Snack") {
        snackShot = true;
        expect({ coins: state.coins, snacks: state.snacks }).toEqual({ coins: 3, snacks: 3 });
        await expect(selected.locator(".battle-command-detail")).toHaveText("×3");
        await shoot(page, "pup-snack");
      }
    }
  });
  expect(shopShot).toBe(true);
  expect(snackShot).toBe(true);
  const end = await readState(page);
  expect({ area: end.area, coins: end.coins, snacks: end.snacks,
    pup: end.wild.find((critter) => critter.kind === "pup")?.mood })
    .toEqual({ area: "park", coins: 11, snacks: 2, pup: "calm" });
  expect(await readHash(page)).toBe(bunHash(path, "plaza"));
  await page.keyboard.press("j");
  await step(page, 1);
  await expect(page.locator(".journal-supply")).toHaveText(["Coins 11", "Snacks 2"]);
  await expect(page.locator(".journal-note"))
    .toContainText(["I have coins! The bakery in the plaza sells snacks for 5 coins."]);
  await shoot(page, "journal-supplies");
});
