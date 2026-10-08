import { expect, test, type Page } from "@playwright/test";
import {
  bunHash,
  longFlowTimeout,
  openHarness,
  playAfter,
  readHash,
  readState,
  renderInfo,
  resetPaused,
  step,
} from "./helpers";

// Milestone 29: the arcade, and Mr. Pip, the first person under the chaos
// spell. The arcade's door in the plaza is locked until the clubhouse in the
// Whispering Woods is claimed. The recorded run (`tools/sim/record-arcade.ts`)
// replays the woods run, then plays the rest with real keys: back over the
// old trail, the bus home, into the arcade, Mr. Pip's battle, and his talk.
// The end state must hash the same as Bun's replay of the same run.

test.describe.configure({ timeout: longFlowTimeout });

// Only what the watcher reads; the whole state is too heavy to fetch often.
async function probe(page: Page): Promise<{
  area: string;
  fading: boolean;
  battle: { phase: string; shown: boolean } | null;
  dialogue: { speaker: string | null; text: string; shown: boolean } | null;
}> {
  return page.evaluate(() => {
    const state = window.__cloverhollow?.getState();
    if (state === undefined) throw new Error("hook unavailable");
    const { battle, dialogue } = state;
    return {
      area: state.area,
      fading: state.transition !== null,
      battle: battle === null ? null
        : { phase: battle.phase, shown: battle.revealed >= battle.message.length },
      dialogue: dialogue === null ? null : { speaker: dialogue.speaker, text: dialogue.text,
        shown: dialogue.revealed >= dialogue.text.length },
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

test("the arcade's door is locked until the clubhouse is claimed", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await openHarness(page);
  await resetPaused(page, "plaza");
  // From the fountain (1200, 550): right to the arcade's door, then up into it.
  await page.keyboard.down("ArrowRight");
  await step(page, 53);
  await page.keyboard.up("ArrowRight");
  await page.keyboard.down("ArrowUp");
  for (let tick = 0; tick < 40 && (await readState(page)).dialogue === null; tick += 1)
    await step(page, 1);
  await page.keyboard.up("ArrowUp");
  await step(page, 90);
  const state = await readState(page);
  expect({ area: state.area, knot: state.dialogue?.knot })
    .toEqual({ area: "plaza", knot: "arcade_closed" });
  await expect(page.locator(".sticker-text-revealed"))
    .toHaveText("The arcade's door is locked. A sign says BACK SOON!");
});

test("real keys: home from the woods, into the arcade, and Mr. Pip calmed", async ({ page }) => {
  const path = "tests/sim/scripts/pass-party/arcade.json";
  await page.setViewportSize({ width: 1280, height: 720 });
  await openHarness(page);
  await resetPaused(page, "pass-party");
  let arrived = false;
  let battleShot = false;
  let rewardShot = false;
  const talk: string[] = [];
  await playAfter(page, "tests/sim/scripts/pass-party/woods.json", path, async () => {
    const state = await probe(page);
    if (!arrived && state.area === "arcade" && !state.fading) {
      arrived = true;
      const info = await renderInfo(page);
      expect(info.critters.map((critter) => [critter.id, critter.frame]))
        .toEqual([["arcade-keeper", "chaos_idle_01"]]);
      await shoot(page, "arcade-arrival");
    }
    if (!battleShot && state.battle?.phase === "command" && state.battle.shown) {
      battleShot = true;
      await expect(page.locator(".battle-meter-label").last())
        .toHaveText("FIZZY MR. PIP", { useInnerText: true });
      await shoot(page, "arcade-keeper-battle");
    }
    if (!rewardShot && state.battle?.phase === "reward" && state.battle.shown) {
      rewardShot = true;
      await expect(page.locator(".battle-reward-name")).toHaveText("Mr. Pip");
      await shoot(page, "arcade-keeper-reward");
    }
    const dialogue = state.dialogue;
    if (dialogue?.speaker === "Mr. Pip" && dialogue.shown && talk.at(-1) !== dialogue.text)
      talk.push(dialogue.text);
  });
  expect({ arrived, battleShot, rewardShot })
    .toEqual({ arrived: true, battleShot: true, rewardShot: true });
  expect(talk[0]).toBe("Whoa... what happened? My head was all fizzy, like a shaken-up soda!");
  const end = await readState(page);
  expect({ area: end.area, keeper: end.critters["arcade-keeper"] })
    .toEqual({ area: "arcade", keeper: "calm" });
  expect(end.stickers).toContain("arcade-keeper");
  expect(await readHash(page)).toBe(bunHash(path, "pass-party"));
});
