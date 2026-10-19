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

// Milestone 44: the claw machine, played with real keys. The recorded run
// (tools/sim/record-claw.ts) calms Mr. Pip, then plays four games: stuck on
// the buried raccoon, the pup won, a miss in the bare back corner, and the cat
// won. The end state must hash the same as Bun's replay of the same run.

test.describe.configure({ timeout: longFlowTimeout });

// Only what the watcher reads; the whole state is too heavy to fetch often.
async function probe(page: Page): Promise<{
  phase: string | null;
  outcome: string | null;
  typed: boolean;
  prizes: string[];
}> {
  return page.evaluate(() => {
    const state = window.__cloverhollow?.getState();
    if (state === undefined) throw new Error("hook unavailable");
    const game = state.arcade;
    return {
      phase: game?.phase ?? null,
      outcome: game?.game === "claw" ? game.outcome : null,
      // The result line is all shown (the line is empty before the result).
      typed: game?.phase === "result" && game.revealed >= game.message.length,
      prizes: state.prizes,
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

test("real keys: Mr. Pip calmed, then the claw machine's four games", async ({ page }) => {
  const path = "tests/sim/scripts/arcade/claw.json";
  const expectedHash = bunHash(path, "arcade");
  await page.setViewportSize({ width: 1280, height: 720 });
  await openHarness(page);
  await resetPaused(page, "arcade");
  const shots = new Set<string>();
  await playWithKeys(page, recording(path), 10, async () => {
    const now = await probe(page);
    if (now.phase === "ready" && !shots.has("ready")) {
      shots.add("ready");
      // The close-up drawn over the room: the whole heap, the claw home over
      // the chute, the slide hint on the plate, and the overworld hidden.
      const info = await renderInfo(page);
      if (info.arcade?.game !== "claw") throw new Error("the claw machine isn't drawn");
      expect(info.arcade.plushes).toHaveLength(9);
      expect(info.battle.overworldVisible).toBe(false);
      await expect(page.locator(".arcade-plate-text"))
        .toHaveText("Hold to slide the claw. Let go to stop it!");
      await expect(page.locator(".touch-stick")).toBeHidden();
      await shoot(page, "claw-ready");
    }
    if (now.phase === "lifting" && now.outcome === "stuck" && !shots.has("stuck")) {
      shots.add("stuck");
      await expect(page.locator(".arcade-plush.is-tug")).toHaveAttribute("data-id",
        "raccoon-plush");
      await shoot(page, "claw-stuck");
    }
    if (now.typed && now.outcome === "grabbed" &&
      now.prizes.length === 1 && !shots.has("prize")) {
      shots.add("prize");
      await expect(page.locator(".battle-reward-name")).toHaveText("Pup Plush");
      await expect(page.locator(".sticker-text-revealed")).toHaveText("You won the Pup Plush!");
      await shoot(page, "claw-prize");
    }
  });
  expect([...shots]).toEqual(["ready", "stuck", "prize"]);
  const end = await readState(page);
  expect({ arcade: end.arcade, prizes: end.prizes, coins: end.coins })
    .toEqual({ arcade: null, prizes: ["pup-plush", "cat-plush"], coins: 17 });
  expect(await readHash(page)).toBe(await expectedHash);
});

// The claw's numbers and the pup's spot, from content/arcade.json (Node can't
// load the content's modules; this reads the one file it needs).
function clawNumbers(): { speed: number; pup: { x: number; z: number } } {
  const record = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null;
  const content: unknown = JSON.parse(readFileSync("content/arcade.json", "utf8"));
  if (!record(content) || !record(content.claw) || typeof content.claw.speed !== "number" ||
    !Array.isArray(content.claw.heap)) throw new Error("content/arcade.json has no claw");
  const pup: unknown = content.claw.heap.find((plush) =>
    record(plush) && plush.prize === "pup-plush");
  if (!record(pup) || typeof pup.x !== "number" || typeof pup.z !== "number")
    throw new Error("the heap has no pup");
  return { speed: content.claw.speed, pup: { x: pup.x, z: pup.z } };
}

// On a phone, the claw takes the same two holds on the confirm sticker.
test("touch: two holds on the confirm sticker win the pup @smoke", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 874, height: 402 },
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.goto("./?touch=1");
  await page.waitForFunction(() => Boolean(window.__cloverhollow));
  await resetPaused(page, "arcade");
  // The recorded run up to its first game opening (Mr. Pip calmed, the claw
  // machine talked to), as queued frames.
  for (const segment of recording("tests/sim/scripts/arcade/claw.json")) {
    await queueScript(page, [segment]);
    await step(page, segment.ticks);
    if ((await probe(page)).phase === "ready") break;
  }
  // The tap that closed the conversation can't start the claw: the finger
  // lifts first (spec 8.2, only a fresh press starts a hold).
  await step(page, 1);
  const game = (await readState(page)).arcade;
  if (game?.game !== "claw") throw new Error("the claw machine didn't open");
  const { speed, pup } = clawNumbers();
  const confirm = page.locator(".touch-confirm");
  await expect(confirm).toBeVisible();
  const holdFor = async (ticks: number): Promise<void> => {
    await confirm.dispatchEvent("pointerdown", {
      pointerId: 1, pointerType: "touch", isPrimary: true,
    });
    await step(page, ticks);
    await confirm.dispatchEvent("pointerup", {
      pointerId: 1, pointerType: "touch", isPrimary: true,
    });
    await step(page, 1);
  };
  // The press that starts a hold doesn't move the claw; each tick after does.
  await holdFor(1 + Math.ceil((pup.x - game.x) / speed));
  expect((await probe(page)).phase).toBe("aiming");
  await holdFor(1 + Math.ceil((pup.z - game.z) / speed));
  for (let count = 0; count < 90 && !(await probe(page)).typed; count += 1) await step(page, 10);
  expect(await probe(page)).toMatchObject({ phase: "result", outcome: "grabbed",
    prizes: ["pup-plush"] });
  await expect(page.locator(".battle-reward-name")).toHaveText("Pup Plush");
  await context.close();
});
