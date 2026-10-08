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
} from "./helpers";

// Milestone 31: the gym and the lasso. The recorded run
// (`tools/sim/record-gym.ts`) replays the school run (ending at the gym doors,
// locked during story time), then plays the rest with real keys: back to
// Ms. Maple (time for PE), down the hall into the gym, Coach Ash's story, the
// fizzy pup with his stopwatch, the clipboard on the hoop, his lasso, and the
// back door the kid in the purple hood ran out of. The end state must hash
// the same as Bun's replay of the same run.

test.describe.configure({ timeout: longFlowTimeout });

// Only what the watcher reads; the whole state is too heavy to fetch often.
async function probe(page: Page): Promise<{
  area: string;
  fading: boolean;
  battle: { phase: string; shown: boolean } | null;
  dialogue: { knot: string; text: string; shown: boolean } | null;
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
      dialogue: dialogue === null ? null : { knot: dialogue.knot, text: dialogue.text,
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

test("real keys: PE, Coach Ash's stopwatch and clipboard, and the lasso", async ({ page }) => {
  const path = "tests/sim/scripts/pass-party/gym.json";
  await page.setViewportSize({ width: 1280, height: 720 });
  await openHarness(page);
  await resetPaused(page, "pass-party");
  let arrived = false;
  let battleShot = false;
  let lassoShot = false;
  const lines: string[] = [];
  await playAfter(page, "tests/sim/scripts/pass-party/school.json", path, async () => {
    const state = await probe(page);
    if (!arrived && state.area === "gym" && !state.fading) {
      arrived = true;
      const info = await renderInfo(page);
      expect(info.npcs.map((npc) => npc.id)).toEqual(["coach"]);
      expect(info.critters.map((critter) => [critter.id, critter.frame]))
        .toEqual([["gym-pup", "chaos_idle_01"]]);
      await shoot(page, "gym-arrival");
    }
    if (!battleShot && state.battle?.phase === "command" && state.battle.shown) {
      battleShot = true;
      await expect(page.locator(".battle-meter-label").last())
        .toHaveText("ZOOMIE PUP", { useInnerText: true });
      await shoot(page, "gym-pup-battle");
    }
    const dialogue = state.dialogue;
    if (dialogue !== null && dialogue.shown && lines.at(-1) !== dialogue.text) {
      lines.push(dialogue.text);
      if (!lassoShot && dialogue.text.startsWith("Coach Ash hands Fae a lasso")) {
        lassoShot = true;
        await shoot(page, "gym-lasso");
      }
    }
  });
  expect({ arrived, battleShot, lassoShot })
    .toEqual({ arrived: true, battleShot: true, lassoShot: true });
  expect(lines).toEqual(expect.arrayContaining([
    "That's the end of our story! Time for PE, everyone.",
    "A kid in a purple hood dashed through here and knocked over my equipment cart!",
    "I've got Coach Ash's stopwatch back. Good pup!",
    "There's Coach Ash's clipboard, hooked on the rim! It's way too high to reach.",
    "Fae twirls the lasso once, twice... and loops it right over the clipboard!",
    "Keep the lasso. It can pull down things that are up high, and swing you across gaps, too!",
    "It only opens from outside. Purple footprints lead right up to it...",
  ]));
  const end = await readState(page);
  expect({ area: end.area, pup: end.critters["gym-pup"] }).toEqual({ area: "gym", pup: "calm" });
  expect(end.stickers).toContain("pond-pup");
  expect(await readHash(page)).toBe(bunHash(path, "pass-party"));
});
