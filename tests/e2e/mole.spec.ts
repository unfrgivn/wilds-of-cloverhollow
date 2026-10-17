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

// Milestone 46: Boop-a-Mole, played with real keys. The recorded run
// (tools/sim/record-mole.ts) calms Mr. Pip, then plays a round with the arrows
// and Z: fourteen of sixteen moles booped, two let go, and two squeaks. The
// end state must hash the same as Bun's replay of the same run.

test.describe.configure({ timeout: longFlowTimeout });

// Only what the watcher reads; the whole state is too heavy to fetch often.
async function probe(page: Page): Promise<{
  phase: string | null;
  stage: string | null;
  mole: number;
  hole: string | null;
  booped: number;
  typed: boolean;
}> {
  return page.evaluate(() => {
    const state = window.__cloverhollow?.getState();
    if (state === undefined) throw new Error("hook unavailable");
    const game = state.arcade;
    const round = game?.game === "mole" ? game : null;
    return {
      phase: game?.phase ?? null,
      stage: round?.stage ?? null,
      mole: round?.mole ?? -1,
      hole: round?.order[round.mole] ?? null,
      booped: round?.booped ?? 0,
      typed: game?.phase === "result" && game.revealed >= game.message.length,
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

test("real keys: Mr. Pip calmed, then a round of Boop-a-Mole", async ({ page }) => {
  const path = "tests/sim/scripts/arcade/mole.json";
  await page.setViewportSize({ width: 1280, height: 720 });
  await openHarness(page);
  await resetPaused(page, "arcade");
  const shots = new Set<string>();
  await playWithKeys(page, recording(path), 10, async () => {
    const now = await probe(page);
    if (now.phase === "playing" && now.stage === "up" && !shots.has("up")) {
      shots.add("up");
      // The close-up over the room: a mole up in its hole, the keys beside
      // the holes, the hint on the marquee, and the overworld hidden.
      const info = await renderInfo(page);
      if (info.arcade?.game !== "mole") throw new Error("Boop-a-Mole isn't drawn");
      expect(info.arcade.holes.filter((hole) => hole.mole !== null).map((hole) => hole.hole))
        .toEqual([now.hole]);
      expect(info.battle.overworldVisible).toBe(false);
      await expect(page.locator(".mole-plate-text")).toHaveText("Boop the moles before they duck!");
      await expect(page.locator(".mole-key")).toHaveText(["↑", "←", "Z", "→", "↓"]);
      await expect(page.locator(".touch-stick")).toBeHidden();
      await shoot(page, "mole-up");
    }
    if (now.stage === "booped" && now.booped === 1 && !shots.has("booped")) {
      shots.add("booped");
      await expect(page.locator(".mole-pop")).toHaveText("Boop!");
      const info = await renderInfo(page);
      if (info.arcade?.game !== "mole") throw new Error("Boop-a-Mole isn't drawn");
      expect(info.arcade.score).toBe("BOOPS 1");
      await shoot(page, "mole-booped");
    }
    if (now.typed && !shots.has("result")) {
      shots.add("result");
      await expect(page.locator(".sticker-text-revealed"))
        .toHaveText("You booped 14 of 16 moles! +28 tickets.");
      await shoot(page, "mole-result");
    }
  });
  expect([...shots]).toEqual(["up", "booped", "result"]);
  const end = await readState(page);
  expect({ arcade: end.arcade, tickets: end.tickets, coins: end.coins })
    .toEqual({ arcade: null, tickets: 28, coins: 23 });
  expect(await readHash(page)).toBe(bunHash(path, "arcade"));
});

// On a phone, Fae taps the holes: each tap on the mole's hole boops it.
test("touch: tapping the moles' holes boops them @smoke", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 874, height: 402 },
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.goto("./?touch=1");
  await page.waitForFunction(() => Boolean(window.__cloverhollow));
  await resetPaused(page, "arcade");
  // The recorded run up to its round opening (Mr. Pip calmed, the cabinet
  // talked to), as queued frames.
  for (const segment of recording("tests/sim/scripts/arcade/mole.json")) {
    await queueScript(page, [segment]);
    await step(page, segment.ticks);
    if ((await probe(page)).phase !== null) break;
  }
  // The tap that closed the conversation can't boop: the finger lifts first.
  await step(page, 1);
  for (let count = 0; count < 120 && (await probe(page)).phase !== "playing"; count += 1)
    await step(page, 1);
  // The keys are for keyboards; on touch, the holes themselves are the targets.
  await expect(page.locator(".mole-key").first()).toBeHidden();
  for (let booped = 1; booped <= 2; booped += 1) {
    for (let count = 0; count < 200 && (await probe(page)).stage !== "up"; count += 1)
      await step(page, 1);
    const { hole } = await probe(page);
    if (hole === null) throw new Error("no mole is up");
    const target = page.getByRole("button", { name: `boop the ${hole} hole` });
    // A finger there lands on the hole, nothing drawn over it.
    expect(await target.evaluate((button) => {
      const box = button.getBoundingClientRect();
      return document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2) === button;
    })).toBe(true);
    // A tap quicker than a frame (down and up before the next tick) still
    // boops: the tap is kept for the next frame.
    await target.dispatchEvent("pointerdown", {
      pointerId: 1, pointerType: "touch", isPrimary: true,
    });
    await target.dispatchEvent("pointerup", {
      pointerId: 1, pointerType: "touch", isPrimary: true,
    });
    await step(page, 1);
    await step(page, 1);
    expect(await probe(page)).toMatchObject({ stage: "booped", booped });
    await expect(page.locator(".mole-pop")).toHaveText("Boop!");
  }
  await context.close();
});
