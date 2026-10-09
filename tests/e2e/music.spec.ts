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

test.describe.configure({ timeout: longFlowTimeout });

async function shoot(page: Page, name: string): Promise<void> {
  await expect(page).toHaveScreenshot(`${name}-1280.png`);
  await page.setViewportSize({ width: 874, height: 402 });
  await expect(page).toHaveScreenshot(`${name}-874.png`);
  await page.setViewportSize({ width: 1280, height: 720 });
}

test("real keys: Ms. Willow, the music bird, the song, and the flute", async ({ page }) => {
  const path = "tests/sim/scripts/pass-party/music.json";
  await page.setViewportSize({ width: 1280, height: 720 });
  await openHarness(page);
  await resetPaused(page, "pass-party");
  let hallShot = false;
  let musicShot = false;
  let xylophoneShot = false;
  let fluteShot = false;
  await playAfter(page, "tests/sim/scripts/pass-party/gym.json", path, async () => {
    const state = await readState(page);
    if (!hallShot && state.area === "east-hall" && state.transition === null) {
      hallShot = true;
      await shoot(page, "music-east-hall-arrival");
    }
    if (!musicShot && state.area === "music" && state.transition === null) {
      musicShot = true;
      expect((await renderInfo(page)).npcs.map((npc) => npc.id)).toContain("music-teacher");
      await shoot(page, "music-room-arrival");
    }
    const dialogue = state.dialogue;
    if (dialogue === null || dialogue.revealed < dialogue.text.length) return;
    if (!xylophoneShot && dialogue.knot === "xylophone") {
      xylophoneShot = true;
      await shoot(page, "music-xylophone");
    }
    if (!fluteShot && dialogue.text.startsWith("Fae plays a soft little tune")) {
      fluteShot = true;
      await shoot(page, "music-flute");
    }
  });
  expect({ hallShot, musicShot, xylophoneShot, fluteShot })
    .toEqual({ hallShot: true, musicShot: true, xylophoneShot: true, fluteShot: true });
  const cues = await page.evaluate(() => window.__cloverhollow?.sound.log() ?? []);
  const storyCues = cues
    .filter((entry) => ["chime-red", "chime-yellow", "chime-blue", "flute"].includes(entry.cue))
    .map((entry) => ({ cue: entry.cue, played: entry.played }));
  expect(storyCues).toEqual([
    { cue: "chime-red", played: true },
    { cue: "chime-red", played: true },
    { cue: "chime-yellow", played: true },
    { cue: "chime-blue", played: true },
    { cue: "chime-red", played: true },
    { cue: "flute", played: true },
  ]);
  const end = await readState(page);
  expect(end.area).toBe("music");
  expect(await readHash(page)).toBe(bunHash(path, "pass-party"));
});
