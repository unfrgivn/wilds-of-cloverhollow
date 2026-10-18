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

// Milestone 59: Comet Cruise, played with real keys. The recorded run
// (tools/sim/record-comet.ts) calms Mr. Pip, then steers the rocket through a
// run with the arrows: fourteen of sixteen stars caught, two let go, and one
// rock bumped. The end state must hash the same as Bun's replay of the same
// run.

test.describe.configure({ timeout: longFlowTimeout });

// Only what the watcher reads; the whole state is too heavy to fetch often.
async function probe(page: Page): Promise<{
  phase: string | null;
  lane: number;
  caught: number;
  // Each one well on its way down the screen, and the next star to come.
  coming: { kind: string; lane: number }[];
  nextStar: { lane: number; index: number } | null;
  typed: boolean;
}> {
  return page.evaluate(() => {
    const state = window.__cloverhollow?.getState();
    if (state === undefined) throw new Error("hook unavailable");
    const game = state.arcade;
    const run = game?.game === "comet" ? game : null;
    const coming = run === null ? [] : run.objects.filter((item) => item.status === "coming");
    const star = coming.find((item) => item.kind === "star");
    return {
      phase: game?.phase ?? null,
      lane: run?.lane ?? -1,
      caught: run?.caught ?? 0,
      coming: run === null ? [] : coming.filter((item) => run.elapsed - item.spawn >= 30)
        .map((item) => ({ kind: item.kind, lane: item.lane })),
      nextStar: star === undefined ? null : { lane: star.lane, index: star.index },
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

test("real keys: Mr. Pip calmed, then a run of Comet Cruise", async ({ page }) => {
  const path = "tests/sim/scripts/arcade/comet.json";
  await page.setViewportSize({ width: 1280, height: 720 });
  await openHarness(page);
  await resetPaused(page, "arcade");
  const shots = new Set<string>();
  await playWithKeys(page, recording(path), 10, async () => {
    const now = await probe(page);
    if (now.phase === "ready" && !shots.has("ready")) {
      shots.add("ready");
      // The close-up over the room: the hint on the marquee, the keys beside
      // the screen, and the overworld hidden.
      const info = await renderInfo(page);
      if (info.arcade?.game !== "comet") throw new Error("Comet Cruise isn't drawn");
      expect(info.battle.overworldVisible).toBe(false);
      expect(info.arcade.score).toBe("STARS 0");
      await expect(page.locator(".comet-marquee-text")).toHaveText("Get ready!");
      await expect(page.locator(".comet-key")).toHaveText(["←", "→"]);
      await expect(page.locator(".touch-stick")).toBeHidden();
      await shoot(page, "comet-ready");
    }
    if (now.phase === "playing" && !shots.has("coming") &&
      now.coming.some((item) => item.kind === "star") &&
      now.coming.some((item) => item.kind === "rock")) {
      shots.add("coming");
      const info = await renderInfo(page);
      if (info.arcade?.game !== "comet") throw new Error("Comet Cruise isn't drawn");
      const frames = info.arcade.objects.map((item) => item.frame);
      expect(frames).toContain("star");
      expect(frames).toContain("rock");
      await expect(page.locator(".comet-marquee-text"))
        .toHaveText("Catch the stars and slip past the space rocks!");
      await shoot(page, "comet-coming");
    }
    if (now.typed && !shots.has("result")) {
      shots.add("result");
      await expect(page.locator(".sticker-text-revealed"))
        .toHaveText("You caught 14 of 16 stars! +28 tickets.");
      await shoot(page, "comet-result");
    }
  });
  expect([...shots]).toEqual(["ready", "coming", "result"]);
  const end = await readState(page);
  expect({ arcade: end.arcade, tickets: end.tickets, coins: end.coins })
    .toEqual({ arcade: null, tickets: 28, coins: 23 });
  expect(await readHash(page)).toBe(bunHash(path, "arcade"));
});

// On a phone, Fae steers with the arrow stickers where the stick would be:
// quick taps move the rocket a lane each, to a star outside the middle lane,
// and it's caught.
test("touch: the arrow stickers steer the rocket to a star @smoke", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 874, height: 402 },
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.goto("./?touch=1");
  await page.waitForFunction(() => Boolean(window.__cloverhollow));
  await resetPaused(page, "arcade");
  // The recorded run up to its game opening (Mr. Pip calmed, the cabinet
  // talked to), as queued frames.
  for (const segment of recording("tests/sim/scripts/arcade/comet.json")) {
    await queueScript(page, [segment]);
    await step(page, segment.ticks);
    if ((await probe(page)).phase !== null) break;
  }
  for (let count = 0; count < 120 && (await probe(page)).phase !== "playing"; count += 1)
    await step(page, 1);
  // The keys' caps are for keyboards; on touch, the arrows steer, and the
  // stick they stand in for is hidden.
  await expect(page.locator(".comet-key").first()).toBeHidden();
  await expect(page.locator(".touch-stick")).toBeHidden();
  const arrows = { left: page.getByRole("button", { name: "move left" }),
    right: page.getByRole("button", { name: "move right" }) };
  for (const arrow of [arrows.left, arrows.right]) {
    await expect(arrow).toBeVisible();
    // At least 48 px each way, and a finger there lands on it, nothing drawn
    // over it.
    expect(await arrow.evaluate((button) => {
      const box = button.getBoundingClientRect();
      return Math.min(box.width, box.height) >= 48 &&
        document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2) === button;
    })).toBe(true);
  }
  // The first star that isn't in the rocket's lane.
  const start = await probe(page);
  const target = await page.evaluate((lane) => {
    const game = window.__cloverhollow?.getState().arcade;
    if (game?.game !== "comet") throw new Error("no run open");
    const star = game.objects.find((item) => item.kind === "star" && item.lane !== lane);
    if (star === undefined) throw new Error("no star outside the rocket's lane");
    return star.lane;
  }, start.lane);
  const pointer = { pointerId: 1, pointerType: "touch", isPrimary: true };
  while ((await probe(page)).lane !== target) {
    const before = (await probe(page)).lane;
    const arrow = target < before ? arrows.left : arrows.right;
    // A tap quicker than a frame (down and up before the next tick) still
    // moves it: the tap is kept for the next frame.
    await arrow.dispatchEvent("pointerdown", pointer);
    await arrow.dispatchEvent("pointerup", pointer);
    await step(page, 1);
    expect((await probe(page)).lane).toBe(before + (target < before ? -1 : 1));
    await step(page, 1);
  }
  for (let count = 0; count < 400 && (await probe(page)).caught === 0; count += 1)
    await step(page, 1);
  expect((await probe(page)).caught).toBeGreaterThan(0);
  const info = await renderInfo(page);
  if (info.arcade?.game !== "comet") throw new Error("Comet Cruise isn't drawn");
  expect(info.arcade.objects.map((item) => item.frame)).toContain("star-sparkle");
  expect(info.arcade.rocket.frame).toBe("rocket");
  await context.close();
});
