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
// coins with no sticker card (the pups' sticker came the first time). The end
// state must hash the same as Bun's replay of the same run.

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

test("real keys: a calmed pup is gone after a trip out, a fresh one pays again", async ({
  page,
}) => {
  const path = "tests/sim/scripts/park/recurring.json";
  await page.setViewportSize({ width: 1280, height: 720 });
  await openHarness(page);
  await resetPaused(page, "park");
  const rewards: string[] = [];
  const pups: string[] = [];
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
    if (battle?.phase === "reward" && battle.shown && rewards.at(-1) !== battle.message) {
      rewards.push(battle.message);
      const card = page.locator(".battle-reward");
      if (rewards.length === 1) await expect(card).toBeVisible();
      else {
        await expect(card, "no new sticker, so no card").toBeHidden();
        await expect(page.locator(".sticker-text-revealed")).toHaveText("+8 coins!");
        await shoot(page, "pup-coins-only");
      }
    }
  });
  expect(back).toBe(true);
  expect(pups).toEqual([
    "park: chaos pup",
    "park: calm pup",
    "plaza: no pup",
    "park: chaos pup",
    "park: calm pup",
  ]);
  expect(rewards).toEqual(["New sticker: Pond Pup! +8 coins.", "+8 coins!"]);
  const end = await readState(page);
  expect({ coins: end.coins, stickers: end.stickers })
    .toEqual({ coins: 16, stickers: ["pond-pup"] });
  expect(await readHash(page)).toBe(bunHash(path, "park"));
});

test("the town's cats: one comes out in the plaza once the fountain frog is calm", async ({
  page,
}) => {
  // Chapter one's recorded run (tools/sim/chapter-one.ts) meets a fizzy cat in
  // the plaza after the school raccoon: replay it to the moment they meet,
  // then read the battle in with real keys. `met` is the tick its intro starts
  // (re-recording chapter one moves it: find it with
  // `bun tools/sim/run.ts tests/sim/scripts/new-game/chapter-one.json --trace`).
  const path = "tests/sim/scripts/new-game/chapter-one.json";
  const met = 2869;
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
    .toHaveText("POUNCY CAT", { useInnerText: true });
  await shoot(page, "plaza-cat-battle");
});
