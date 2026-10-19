import { expect, test, type Page } from "@playwright/test";
import {
  bunHash,
  longFlowTimeout,
  openHarness,
  playWithKeys,
  queueScript,
  readHash,
  readState,
  recording,
  renderInfo,
  resetPaused,
  step,
} from "./helpers";

// Milestone 28: recurring critters, with real keys. The recorded run
// (`tools/sim/record-recurring.ts`) is played as key presses: a fizzy pup in
// Meadow Park is calmed (its sticker and 8 coins), Fae steps out to the plaza
// and back, a fresh fizzy pup is out by the pond, and calming it pays 8 more
// coins with no sticker card (the pups' sticker came the first time). Twice
// more (Milestone 51): a third pup calmed, and the fourth remembers Fae and
// calms on touch. The end state must hash the same as Bun's replay of the
// same run.

test.describe.configure({ timeout: longFlowTimeout });

// Only what the watcher reads; the whole state is too heavy to fetch often.
async function probe(page: Page): Promise<{
  area: string;
  fading: boolean;
  pup: string | null;
  battle: { phase: string; message: string; shown: boolean } | null;
}> {
  return page.evaluate(() => {
    const state = window.__cloverhollow?.getState();
    if (state === undefined) throw new Error("hook unavailable");
    const battle = state.battle;
    return {
      area: state.area,
      fading: state.transition !== null,
      pup: state.wild.find((critter) => critter.kind === "pup")?.mood ?? null,
      battle: battle === null ? null : {
        phase: battle.phase,
        message: battle.message,
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

test("real keys: a calmed pup is gone after a trip out, a fresh one pays, the fourth is a friend",
  async ({ page }) => {
    const path = "tests/sim/scripts/park/recurring.json";
    const expectedHash = bunHash(path, "park");
    await page.setViewportSize({ width: 1280, height: 720 });
    await openHarness(page);
    await resetPaused(page, "park");
    const rewards: string[] = [];
    const pups: string[] = [];
    // Battles met so far, and the last one whose reward was read: every
    // reward after the first says "+8 coins!", so the battle tells them apart.
    let battles = 0;
    let inBattle = false;
    let rewarded = 0;
    let friend = false;
    let back = false;
    let left = false;
    await playWithKeys(page, recording(path), 10, async () => {
      const state = await probe(page);
      const seen = `${state.area}: ${state.pup ?? "no"} pup`;
      if (!state.fading && pups.at(-1) !== seen) pups.push(seen);
      if (state.area === "plaza") left = true;
      if (left && !back && state.area === "park" && !state.fading) {
        back = true;
        // A fresh, fizzy pup by the pond, where the calm one was.
        await shoot(page, "park-return");
      }
      const battle = state.battle;
      if (battle !== null && !inBattle) battles += 1;
      inBattle = battle !== null;
      if (battle?.phase === "soothed" && battle.shown && battles === 4 && !friend) {
        // The fourth pup: no battle, it calms as Fae touches it.
        friend = true;
        await expect(page.locator(".sticker-text-revealed"))
          .toHaveText("The Zoomie Pup remembers Fae and calms right down!");
        await shoot(page, "pup-old-friend");
      }
      if (battle?.phase === "reward" && battle.shown && rewarded !== battles) {
        rewarded = battles;
        rewards.push(battle.message);
        const card = page.locator(".battle-reward");
        if (rewards.length === 1) await expect(card).toBeVisible();
        else {
          await expect(card, "no new sticker, so no card").toBeHidden();
          await expect(page.locator(".sticker-text-revealed")).toHaveText("+8 coins, +20 XP!");
          if (rewards.length === 2) await shoot(page, "pup-coins-only");
        }
      }
    });
    expect({ back, friend, battles }).toEqual({ back: true, friend: true, battles: 4 });
    // The plaza is quiet until its fountain frog is calm.
    const visit = ["plaza: no pup", "park: chaos pup", "park: calm pup"];
    expect(pups).toEqual(["park: chaos pup", "park: calm pup", ...visit, ...visit, ...visit]);
    expect(rewards).toEqual(["New sticker: Pond Pup! +8 coins, +20 XP!", "+8 coins, +20 XP!",
      "+8 coins, +20 XP!", "+8 coins, +20 XP!"]);
    const end = await readState(page);
    expect({ coins: end.coins, stickers: end.stickers, calms: end.calms })
      .toEqual({ coins: 32, stickers: ["pond-pup"], calms: { pup: 4 } });
    expect(await readHash(page)).toBe(await expectedHash);
  });

test("the town's cats: one comes out in the plaza once the fountain frog is calm", async ({
  page,
}) => {
  // The bus-line run (tools/sim/record-bus-line.ts, which starts with chapter
  // one's) meets fizzy cats in the plaza: replay it to the moment it meets the
  // first, in its chapter-one stretch, then read the battle in with real keys.
  // `met` is the tick its intro starts (re-recording moves it: find it with
  // `bun tools/sim/run.ts tests/sim/scripts/new-game/bus-line.json --trace`).
  const path = "tests/sim/scripts/new-game/bus-line.json";
  const met = 5553;
  const upTo: ReturnType<typeof recording> = [];
  let ticks = 0;
  for (const segment of recording(path)) {
    if (ticks >= met) break;
    const take = Math.min(segment.ticks, met - ticks);
    upTo.push({ frame: segment.frame, ticks: take });
    ticks += take;
  }
  await page.setViewportSize({ width: 1280, height: 720 });
  await openHarness(page);
  await resetPaused(page, "new-game");
  await queueScript(page, upTo);
  await step(page, met);
  expect((await readState(page)).battle).toMatchObject({ critterId: "cat", phase: "intro" });
  for (const _press of [0, 1]) {
    await page.keyboard.press("z");
    await step(page, 2);
  }
  await step(page, 40);
  expect((await readState(page)).battle?.phase).toBe("command");
  expect((await renderInfo(page)).battle.critter).toEqual({ id: "cat", frame: "chaos_idle_01" });
  await expect(page.locator(".battle-meter-label").last())
    .toHaveText("LV 2 · POUNCY CAT", { useInnerText: true });
  await shoot(page, "plaza-cat-battle");
});
