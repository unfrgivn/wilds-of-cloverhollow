import { expect, test, type Page } from "@playwright/test";
import { serializeSave, setInkVariables } from "../../src/core";
import type { MusicDebugInfo } from "../../src/platform/audio";
import {
  longFlowTimeout,
  openHarness,
  playBattleCheck,
  readBattle,
  readState,
  resetPaused,
  step,
} from "./helpers";

test.describe.configure({ timeout: longFlowTimeout });

async function tapKey(page: Page, key: string): Promise<void> {
  await page.keyboard.down(key);
  await step(page, 1);
  await page.keyboard.up(key);
  await step(page, 1);
}

async function holdKey(page: Page, key: string, ticks: number): Promise<void> {
  await page.keyboard.down(key);
  await step(page, ticks);
  await page.keyboard.up(key);
}

async function readMusic(page: Page): Promise<MusicDebugInfo> {
  const info = await page.evaluate(() => window.__cloverhollow?.sound.music());
  if (info === undefined) throw new Error("hook unavailable");
  return info;
}

async function readSoundLog(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    (window.__cloverhollow?.sound.log() ?? []).map((entry) => entry.cue),
  );
}

async function continueFromSave(page: Page, encodedSave: string): Promise<void> {
  await page.evaluate((encoded) => {
    localStorage.setItem("CapacitorStorage.cloverhollow-save", encoded);
  }, encodedSave);
  await page.goto("./");
  await page.waitForFunction(() => Boolean(window.__cloverhollow));
  await page.keyboard.press("Enter");
  await expect
    .poll(() => page.evaluate(() => window.__cloverhollow?.boot.title()))
    .toBeNull();
  await page.evaluate(() => window.__cloverhollow?.pause());
  await step(page, 2);
}

async function crossDoor(page: Page): Promise<void> {
  for (let count = 0; count < 60; count += 1) {
    const state = await readState(page);
    if (state.transition === null) return;
    await step(page, 2);
  }
}

async function dismissBattleIfAny(page: Page): Promise<void> {
  for (let i = 0; i < 60; i += 1) {
    const cur = await readState(page);
    if (cur.battle === null) return;
    if (cur.battle.phase === "command") {
      await tapKey(page, "ArrowUp");
      await tapKey(page, "Enter");
      await step(page, 6);
    } else {
      await tapKey(page, "Enter");
      await step(page, 8);
    }
  }
}

async function walkTo(page: Page, tx: number, ty: number): Promise<void> {
  for (let iter = 0; iter < 120; iter += 1) {
    const state = await readState(page);
    if (state.transition !== null) {
      await crossDoor(page);
      return;
    }
    if (state.battle !== null) {
      await dismissBattleIfAny(page);
      continue;
    }
    const dx = tx - state.player.x;
    const dy = ty - state.player.y;
    if (Math.abs(dx) <= 10 && Math.abs(dy) <= 10) return;

    const keys: string[] = [];
    if (Math.abs(dx) > 8) keys.push(dx > 0 ? "ArrowRight" : "ArrowLeft");
    if (Math.abs(dy) > 8) keys.push(dy > 0 ? "ArrowDown" : "ArrowUp");
    const dist = Math.max(Math.abs(dx), Math.abs(dy));
    const ticks = Math.max(1, Math.min(18, Math.floor(dist / 4)));

    for (const key of keys) await page.keyboard.down(key);
    await step(page, ticks);
    for (const key of keys) await page.keyboard.up(key);
  }
}

async function walkWaypoints(
  page: Page,
  points: readonly (readonly [number, number])[],
): Promise<void> {
  const startArea = (await readState(page)).area;
  for (const [tx, ty] of points) {
    await walkTo(page, tx, ty);
    if ((await readState(page)).area !== startArea) return;
  }
}

test(
  "real keys: Battle Recover emits rejuvenation VFX & audio, and East Road plays Sunberry Road",
  { tag: "@smoke" },
  async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    await page.setViewportSize({ width: 1280, height: 720 });
    await openHarness(page);

    // 1. Enter Fountain Frog battle in Plaza with real keys.
    await resetPaused(page, "plaza");
    for (const [key, ticks] of [
      ["ArrowDown", 25],
      ["ArrowLeft", 15],
      ["ArrowDown", 50],
      ["ArrowLeft", 35],
    ] as const) {
      await holdKey(page, key, ticks);
    }
    await expect(page.locator("html")).toHaveAttribute("data-battle", "open");

    // Advance intro -> command -> play Soothe (sets lastGrade) -> take a burst so energy < max.
    const initialEnergy = (await readBattle(page))?.energy ?? 5;
    let reachedRecoverTurn = false;
    let playedFirstCommand = false;
    for (let guard = 0; guard < 90; guard += 1) {
      const battle = await readBattle(page);
      if (battle === null) throw new Error("battle ended unexpectedly");
      if (battle.phase === "command") {
        if (playedFirstCommand && battle.energy < initialEnergy) {
          reachedRecoverTurn = true;
          break;
        }
        // Choose Soothe (first command) on turn 1 to establish a prior grade.
        await tapKey(page, "Enter");
        playedFirstCommand = true;
        continue;
      }
      if (battle.phase === "check" && battle.check !== null) {
        if (battle.check.side === "critter") {
          // Score on Fae's soothe check so lastGrade is non-null ("great"/"good").
          await playBattleCheck(page);
          await step(page, 1);
        } else {
          // Let the frog's burst resolve without dodging so Fae spends 1 energy.
          await step(page, 4);
        }
        continue;
      }
      await tapKey(page, "Enter");
    }
    expect(reachedRecoverTurn).toBe(true);

    // Wait for the command prompt to finish revealing so ArrowDown moves the menu cursor.
    for (let wait = 0; wait < 20; wait += 1) {
      const cur = await readBattle(page);
      if (cur !== null && cur.revealed >= cur.message.length) break;
      await step(page, 4);
    }

    const beforeRecover = await readBattle(page);
    if (beforeRecover === null) throw new Error("expected active battle before Recover");
    const energyBefore = beforeRecover.energy;
    const cuesBeforeCount = (await readSoundLog(page)).length;

    // Move cursor with real ArrowDown keys until Recover is selected, then confirm with Enter.
    for (let stepIdx = 0; stepIdx < 10; stepIdx += 1) {
      const selectedLabel = await page
        .locator('.battle-command[aria-selected="true"] .battle-command-label')
        .textContent();
      if (selectedLabel?.trim() === "Recover") break;
      await tapKey(page, "ArrowDown");
    }
    await expect(
      page.locator('.battle-command[aria-selected="true"] .battle-command-label'),
    ).toHaveText("Recover");

    await tapKey(page, "Enter");
    const afterRecover = await readBattle(page);
    expect(afterRecover?.phase).toBe("result");
    expect(afterRecover?.command).toBe("recover");
    expect(afterRecover?.energy).toBe(energyBefore + 1);

    const newCues = (await readSoundLog(page)).slice(cuesBeforeCount);
    expect(newCues).toContain("battle-recover");
    expect(newCues).not.toContain("battle-hit");

    // Step until the Recover message reveals cleanly while the emerald-gold aura is in full bloom.
    await step(page, 14);
    const curPeak = await readBattle(page);
    if (curPeak !== null && curPeak.revealed < curPeak.message.length) {
      await tapKey(page, "Enter");
    }
    const stageInfo = await page.evaluate(() => window.__cloverhollow?.renderInfo().battle ?? null);
    expect(stageInfo?.phase).toBe("result");
    expect(stageInfo?.layout).not.toBeNull();

    // 2. Visit Sunberry Lane (lane) & Willowbrook Crossing (crossing) -> Sunberry Road ("road").
    await resetPaused(page, "plaza");
    const baseState = await readState(page);
    const withEastRoadOpen = serializeSave({
      ...baseState,
      ink: setInkVariables(baseState.ink, { club_open: true }),
    });
    await continueFromSave(page, withEastRoadOpen);

    // Walk east out of Plaza -> Sunberry Lane (lane).
    await walkWaypoints(page, [[1500, 555], [1620, 555]]);
    expect((await readState(page)).area).toBe("lane");
    await expect.poll(async () => await readMusic(page)).toMatchObject({
      track: "road",
      ambience: "town-breeze",
      title: "Sunberry Road",
      duck: false,
    });

    // Walk east across Sunberry Lane -> Willowbrook Crossing (crossing).
    await walkWaypoints(page, [[800, 520], [1400, 560], [2000, 570], [2500, 575]]);
    expect((await readState(page)).area).toBe("crossing");
    await expect.poll(async () => await readMusic(page)).toMatchObject({
      track: "road",
      ambience: "forest",
      title: "Sunberry Road",
      duck: false,
    });

    expect(errors).toEqual([]);
  },
);
