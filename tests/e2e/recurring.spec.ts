import { expect, test, type Page } from "@playwright/test";
import {
  bunHash,
  longFlowTimeout,
  openHarness,
  playBattleCheck,
  playWithKeys,
  queueScript,
  readBattle,
  readHash,
  readState,
  recording,
  renderInfo,
  resetPaused,
  step,
  walk,
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
  pupHome: { x: number; y: number } | null;
  battle: { phase: string; message: string; shown: boolean } | null;
}> {
  return page.evaluate(() => {
    const state = window.__cloverhollow?.getState();
    if (state === undefined) throw new Error("hook unavailable");
    const battle = state.battle;
    const pup = state.wild.find((critter) => critter.kind === "pup");
    return {
      area: state.area,
      fading: state.transition !== null,
      pup: pup?.mood ?? null,
      pupHome: pup?.home === undefined ? null : { x: pup.home.x, y: pup.home.y },
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
    const pupHomes: { x: number; y: number }[] = [];
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
      if (!state.fading && pups.at(-1) !== seen) {
        pups.push(seen);
        if (state.area === "park" && state.pup === "chaos" && state.pupHome !== null) {
          pupHomes.push(state.pupHome);
        }
      }
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
    // Every visit into Meadow Park rolls a fresh randomized spawn location across the area,
    // rather than pinning the pup to the old fixed (880, 600) den point.
    expect(pupHomes).toHaveLength(4);
    const distinctHomes = new Set(pupHomes.map((h) => `${Math.round(h.x)},${Math.round(h.y)}`));
    expect(distinctHomes.size).toBeGreaterThanOrEqual(3);
    expect(pupHomes.every((h) => Math.hypot(h.x - 880, h.y - 600) > 25)).toBe(true);
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
  // Calm the fountain frog via the recorded plaza run, then hop between Meadow
  // Park and Town Plaza with real keys until a Pouncy Cat rolls in the plaza
  // and walk into it to verify its Lv 2 battle HUD and sprite.
  const frogWin = "tests/sim/scripts/plaza/frog-win.json";
  const segments = recording(frogWin);
  const totalTicks = segments.reduce((sum, seg) => sum + seg.ticks, 0);
  await page.setViewportSize({ width: 1280, height: 720 });
  await openHarness(page);
  await resetPaused(page, "plaza");
  await queueScript(page, segments);
  await step(page, totalTicks);
  expect((await readState(page)).critters["fountain-frog"]).toBe("calm");

  const press = async (key = "z"): Promise<void> => {
    await page.keyboard.down(key);
    await step(page, 1);
    await page.keyboard.up(key);
    await step(page, 1);
  };
  const escapeBattle = async (): Promise<void> => {
    for (let i = 0; i < 40; i += 1) {
      const battle = await readBattle(page);
      if (battle === null) break;
      if (battle.phase === "check" && battle.check !== null) await playBattleCheck(page);
      else if (battle.phase === "command" && battle.revealed >= battle.message.length) {
        await press("ArrowUp");
        await press("z");
      } else await press("z");
    }
  };
  const hopPlazaToParkAndBack = async (): Promise<void> => {
    await walk(page, "y", 930);
    if ((await readBattle(page)) !== null) await escapeBattle();
    await walk(page, "x", 1470);
    if ((await readBattle(page)) !== null) await escapeBattle();
    await page.keyboard.down("ArrowDown");
    await step(page, 30);
    await page.keyboard.up("ArrowDown");
    await step(page, 40);
    expect((await readState(page)).area).toBe("park");
    await walk(page, "x", 200);
    if ((await readBattle(page)) !== null) await escapeBattle();
    await page.keyboard.down("ArrowDown");
    await step(page, 40);
    await page.keyboard.up("ArrowDown");
    await step(page, 40);
    expect((await readState(page)).area).toBe("plaza");
  };

  let catFound = false;
  for (let visit = 0; visit < 10; visit += 1) {
    await hopPlazaToParkAndBack();
    if ((await readState(page)).wild.some((c) => c.kind === "cat" && c.mood === "chaos")) {
      catFound = true;
      break;
    }
  }
  expect(catFound).toBe(true);

  for (let tries = 0; tries < 6; tries += 1) {
    const battle = await readBattle(page);
    if (battle?.critterId === "cat") break;
    if (battle !== null) await escapeBattle();
    const cat = (await readState(page)).wild.find((c) => c.kind === "cat" && c.mood === "chaos");
    if (cat === undefined) throw new Error("cat disappeared from plaza");
    await walk(page, "y", cat.y);
    if ((await readBattle(page))?.critterId === "cat") break;
    await walk(page, "x", cat.x);
  }
  expect((await readState(page)).battle).toMatchObject({ critterId: "cat", phase: "intro" });
  for (let action = 0; action < 40; action += 1) {
    const battle = await readBattle(page);
    if (battle?.phase === "command" && battle.revealed >= battle.message.length) break;
    if (battle?.phase === "check" && battle.check !== null) await playBattleCheck(page);
    else await press("z");
  }
  expect((await readState(page)).battle?.phase).toBe("command");
  expect((await renderInfo(page)).battle.critter).toEqual({ id: "cat", frame: "chaos_idle_01" });
  await expect(page.locator(".battle-meter-label").last())
    .toHaveText("LV 2 · POUNCY CAT", { useInnerText: true });
  await shoot(page, "plaza-cat-battle");
});

test("real keys: Meadow Park rolls varied walkable pup locations across repeated visits", {
  tag: "@smoke",
}, async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await openHarness(page);
  await resetPaused(page, "park");

  const homes: { x: number; y: number }[] = [];
  const recordPupHome = async (): Promise<void> => {
    const state = await readState(page);
    expect(state.area).toBe("park");
    const pup = state.wild.find((critter) => critter.den === 0);
    expect(pup?.kind).toBe("pup");
    expect(pup?.home).toBeDefined();
    if (pup?.home !== undefined) homes.push({ x: pup.home.x, y: pup.home.y });
  };

  await recordPupHome();
  for (let trip = 0; trip < 3; trip += 1) {
    // Exit park south-west into plaza, then step right back into park with real keys.
    await walk(page, "x", 200);
    await page.keyboard.down("ArrowDown");
    await step(page, 40);
    await page.keyboard.up("ArrowDown");
    await step(page, 40);
    expect((await readState(page)).area).toBe("plaza");
    await page.keyboard.down("ArrowDown");
    await step(page, 30);
    await page.keyboard.up("ArrowDown");
    await step(page, 40);
    await recordPupHome();
  }

  expect(homes).toHaveLength(4);
  const distinct = new Set(homes.map((h) => `${Math.round(h.x)},${Math.round(h.y)}`));
  expect(distinct.size).toBeGreaterThanOrEqual(3);
  expect(homes.some((h) => Math.hypot(h.x - 880, h.y - 600) > 100)).toBe(true);
});
