import { readFileSync } from "node:fs";
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

// Milestone 45: skee-ball and the ticket counter, played with real keys. The
// recorded run (tools/sim/record-skee.ts) calms Mr. Pip, plays a game with a
// ball for each kind of score (50, a corner's 100, one rolled too hard, 40,
// and 20), and trades 20 of its 22 tickets for the rainbow pinwheel. The end
// state must hash the same as Bun's replay of the same run.

test.describe.configure({ timeout: longFlowTimeout });

// Only what the watcher reads; the whole state is too heavy to fetch often.
async function probe(page: Page): Promise<{
  phase: string | null;
  typed: boolean;
  aim: number | null;
  points: number | null;
}> {
  return page.evaluate(() => {
    const state = window.__cloverhollow?.getState();
    if (state === undefined) throw new Error("hook unavailable");
    const game = state.arcade;
    const skee = game?.game === "skee" ? game : null;
    return {
      phase: game?.phase ?? null,
      typed: game?.phase === "result" && game.revealed >= game.message.length,
      aim: skee?.aim ?? null,
      points: skee?.throws.at(-1)?.points ?? null,
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

// Skee-ball's numbers, from content/arcade.json (Node can't load the
// content's modules; this reads the one file it needs).
function skeeNumbers(): {
  centre: { x: number; y: number };
  powerStep: number;
  fifty: number;
  corner: number;
} {
  const record = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null;
  const number = (value: unknown): number => {
    if (typeof value !== "number") throw new Error("content/arcade.json's skee isn't numbers");
    return value;
  };
  const content: unknown = JSON.parse(readFileSync("content/arcade.json", "utf8"));
  if (!record(content) || !record(content.skee) || !record(content.skee.centre) ||
    !Array.isArray(content.skee.rings) || !record(content.skee.corners))
    throw new Error("content/arcade.json has no skee-ball");
  const ring: unknown = content.skee.rings[0];
  if (!record(ring)) throw new Error("skee-ball has no rings");
  return {
    centre: { x: number(content.skee.centre.x), y: number(content.skee.centre.y) },
    powerStep: number(content.skee.powerStep),
    fifty: number(ring.points),
    corner: number(content.skee.corners.points),
  };
}

test("real keys: Mr. Pip calmed, a game of skee-ball, and a prize for tickets", async ({
  page,
}) => {
  const path = "tests/sim/scripts/arcade/skee.json";
  const { corner } = skeeNumbers();
  await page.setViewportSize({ width: 1280, height: 720 });
  await openHarness(page);
  await resetPaused(page, "arcade");
  const shots = new Set<string>();
  await playWithKeys(page, recording(path), 10, async () => {
    const now = await probe(page);
    if (now.phase === "aiming" && !shots.has("aiming")) {
      shots.add("aiming");
      // The close-up drawn over the room: the hood, the target, the arrow
      // sweeping at the foot of the lane, the aim hint on the marquee, and the
      // overworld hidden.
      const info = await renderInfo(page);
      if (info.arcade?.game !== "skee") throw new Error("skee-ball isn't drawn");
      expect(info.arcade.arrow?.set).toBe(false);
      expect(info.arcade.score).toBe("SCORE 0");
      expect(info.battle.overworldVisible).toBe(false);
      await expect(page.locator(".skee-plate-text")).toHaveText("Press to aim the ball!");
      await expect(page.locator(".touch-stick")).toBeHidden();
      await shoot(page, "skee-aiming");
    }
    if (now.phase === "scored" && now.points === corner && !shots.has("corner")) {
      shots.add("corner");
      // In the right corner hole: it lights, and its points pop up over it.
      const info = await renderInfo(page);
      if (info.arcade?.game !== "skee") throw new Error("skee-ball isn't drawn");
      expect(info.arcade.lit).toEqual({ points: corner, side: 1 });
      expect(info.arcade.pop?.text).toBe(`+${corner}`);
      await shoot(page, "skee-corner");
    }
    if (now.typed && !shots.has("result")) {
      shots.add("result");
      await expect(page.locator(".sticker-text-revealed"))
        .toHaveText("You scored 220! +22 tickets.");
      await expect(page.locator(".skee-hud")).toBeHidden();
      await shoot(page, "skee-result");
    }
  });
  expect([...shots]).toEqual(["aiming", "corner", "result"]);
  const end = await readState(page);
  expect({ arcade: end.arcade, prizes: end.prizes, tickets: end.tickets, coins: end.coins })
    .toEqual({ arcade: null, prizes: ["pinwheel"], tickets: 2, coins: 23 });
  expect(await readHash(page)).toBe(bunHash(path, "arcade"));
});

// On a phone, a tap on the confirm sticker sets the aim and a hold on it rolls
// the ball: into the 50, aimed at the middle and held for its height.
test("touch: a tap and a hold on the confirm sticker roll a 50 @smoke", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 874, height: 402 },
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.goto("./?touch=1");
  await page.waitForFunction(() => Boolean(window.__cloverhollow));
  await resetPaused(page, "arcade");
  // The recorded run up to its game opening (Mr. Pip calmed, the lane talked
  // to), as queued frames.
  for (const segment of recording("tests/sim/scripts/arcade/skee.json")) {
    await queueScript(page, [segment]);
    await step(page, segment.ticks);
    if ((await probe(page)).phase === "aiming") break;
  }
  const { centre, powerStep, fifty } = skeeNumbers();
  const confirm = page.locator(".touch-confirm");
  await expect(confirm).toBeVisible();
  const touch = async (down: boolean): Promise<void> => {
    await confirm.dispatchEvent(down ? "pointerdown" : "pointerup", {
      pointerId: 1, pointerType: "touch", isPrimary: true,
    });
  };
  // The arrow sweeps; tap as it reaches the middle (the tap's own tick doesn't
  // move it).
  for (let count = 0; count < 400 && (await probe(page)).aim !== centre.x; count += 1)
    await step(page, 1);
  expect((await probe(page)).aim).toBe(centre.x);
  await touch(true);
  await step(page, 1);
  await touch(false);
  await step(page, 1);
  expect(await probe(page)).toMatchObject({ phase: "winding", aim: centre.x });
  // Each tick held sends the ball one step further up; letting go rolls it.
  await touch(true);
  await step(page, Math.round(centre.y / powerStep));
  await touch(false);
  await step(page, 1);
  expect((await probe(page)).phase).toBe("rolling");
  for (let count = 0; count < 20 && (await probe(page)).phase !== "scored"; count += 1)
    await step(page, 5);
  expect(await probe(page)).toMatchObject({ phase: "scored", points: fifty });
  const info = await renderInfo(page);
  if (info.arcade?.game !== "skee") throw new Error("skee-ball isn't drawn");
  expect(info.arcade.lit).toEqual({ points: fifty, side: 0 });
  await expect(page.locator(".skee-pop")).toHaveText(`+${fifty}`);
  await context.close();
});
