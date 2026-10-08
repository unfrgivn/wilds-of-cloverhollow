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

// Milestone 30: story time, the school chapter's start. The recorded run
// (`tools/sim/record-school.ts`) replays the arcade run, then plays the rest
// with real keys: across the plaza to school, Ms. Maple (story time), the
// classroom (Rosie, Milo, the art wall, the story), and back out to the hall,
// where the kid in the purple hood is glimpsed and runs off toward the gym.
// The end state must hash the same as Bun's replay of the same run.

test.describe.configure({ timeout: longFlowTimeout });

// Only what the watcher reads; the whole state is too heavy to fetch often.
async function probe(page: Page): Promise<{
  area: string;
  fading: boolean;
  dialogue: { knot: string; speaker: string | null; text: string; shown: boolean } | null;
}> {
  return page.evaluate(() => {
    const state = window.__cloverhollow?.getState();
    if (state === undefined) throw new Error("hook unavailable");
    const dialogue = state.dialogue;
    return {
      area: state.area,
      fading: state.transition !== null,
      dialogue: dialogue === null ? null : { knot: dialogue.knot, speaker: dialogue.speaker,
        text: dialogue.text, shown: dialogue.revealed >= dialogue.text.length },
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

test("real keys: story time, the classroom, and a glimpse of the purple hood", async ({
  page,
}) => {
  const path = "tests/sim/scripts/pass-party/school.json";
  await page.setViewportSize({ width: 1280, height: 720 });
  await openHarness(page);
  await resetPaused(page, "pass-party");
  let inClassroom = false;
  let hoodShot = false;
  let glimpseShot = false;
  const lines: string[] = [];
  await playAfter(page, "tests/sim/scripts/pass-party/arcade.json", path, async () => {
    const state = await probe(page);
    if (!inClassroom && state.area === "classroom" && !state.fading) {
      inClassroom = true;
      const people = (await renderInfo(page)).npcs.map((npc) => npc.id).sort();
      expect(people).toEqual(["milo", "rosie", "teacher"]);
      await shoot(page, "classroom-arrival");
    }
    if (!hoodShot && state.area === "school" && inClassroom && !state.fading &&
      state.dialogue === null) {
      hoodShot = true;
      expect((await renderInfo(page)).npcs.map((npc) => npc.id)).toContain("hooded-kid");
      await shoot(page, "hall-hooded-kid");
    }
    const dialogue = state.dialogue;
    if (dialogue !== null && dialogue.shown && lines.at(-1) !== dialogue.text) {
      lines.push(dialogue.text);
      if (!glimpseShot && dialogue.knot === "hood_glimpse") {
        glimpseShot = true;
        await shoot(page, "hood-glimpse");
      }
    }
  });
  expect({ inClassroom, hoodShot, glimpseShot })
    .toEqual({ inClassroom: true, hoodShot: true, glimpseShot: true });
  expect(lines).toEqual(expect.arrayContaining([
    "There you are, Fae! Story time is about to start.",
    "Psst, Fae! Somebody in a purple hood just peeked in the door!",
    "The kid zips around the corner, toward the gym. So fast!",
  ]));
  const end = await readState(page);
  expect(end.area).toBe("school");
  expect((await renderInfo(page)).npcs.map((npc) => npc.id)).not.toContain("hooded-kid");
  expect(await readHash(page)).toBe(bunHash(path, "pass-party"));
});
