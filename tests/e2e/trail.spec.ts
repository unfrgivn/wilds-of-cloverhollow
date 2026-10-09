import { expect, test, type Page } from "@playwright/test";
import {
  bunHash,
  longFlowTimeout,
  openHarness,
  playWithKeys,
  readHash,
  readState,
  recording,
  renderInfo,
  resetPaused,
} from "./helpers";

// Milestone 21: the Cliffside Trail, with real keys. Each recorded run
// (`tools/sim/record-trail.ts`, `tools/sim/record-lookout.ts`) is played as key
// presses through the game's own keyboard input: arrows for a frame's move, Z
// for its confirm, held for the frame's ticks. The moments that matter are
// checked as they happen, and the end state must hash the same as Bun's replay
// of the same run.

test.describe.configure({ timeout: longFlowTimeout });

// A light look at the game: only what the first test reads. The whole state
// (with the story's Ink JSON) is too heavy to fetch hundreds of times a run.
async function probe(page: Page): Promise<{
  area: string;
  fading: boolean;
  facing: string;
  player: { x: number; y: number };
  bunny: string | undefined;
  bunnyAt: { x: number; y: number } | null;
  battle: { critterId: string; phase: string; shown: boolean } | null;
}> {
  return page.evaluate(() => {
    const state = window.__cloverhollow?.getState();
    if (state === undefined) throw new Error("hook unavailable");
    const battle = state.battle;
    const bunny = state.wild.find((critter) => critter.kind === "bunny");
    return {
      area: state.area,
      fading: state.transition !== null,
      facing: state.facing,
      player: { x: state.player.x, y: state.player.y },
      bunny: bunny?.mood,
      bunnyAt: bunny === undefined ? null : { x: bunny.x, y: bunny.y },
      battle: battle === null ? null : {
        critterId: battle.critterId,
        phase: battle.phase,
        shown: battle.revealed >= battle.message.length,
      },
    };
  });
}

test("real keys from Pinecone Pass down the Cliffside Trail to Bubblegum Bay", async ({
  page,
}) => {
  const path = "tests/sim/scripts/pass/trail.json";
  await page.setViewportSize({ width: 1280, height: 720 });
  await openHarness(page);
  await resetPaused(page, "pass");
  let arrived = false;
  let bunnyGap: number[] = [];
  let bunnyShot = false;
  let ranFromSquirrel = false;
  let afterRun = false;
  await playWithKeys(page, recording(path), 24, async () => {
    const state = await probe(page);
    if (state.area === "trail" && !state.fading && !arrived) {
      arrived = true;
      expect(state.facing).toBe("right");
      await expect(page).toHaveScreenshot("trail-arrival-1280.png");
      await page.setViewportSize({ width: 874, height: 402 });
      await expect(page).toHaveScreenshot("trail-arrival-874.png");
      await page.setViewportSize({ width: 1280, height: 720 });
    }
    const battle = state.battle;
    const bunny = state.bunnyAt;
    if (arrived && battle === null && state.bunny === "chaos" && bunny !== null)
      bunnyGap.push(Math.hypot(bunny.x - state.player.x, bunny.y - state.player.y));
    if (battle?.critterId === "bunny" && battle.phase === "command" && !bunnyShot &&
      battle.shown) {
      bunnyShot = true;
      await expect(page.locator(".battle-command-label"))
        .toHaveText(["Soothe", "Play", "Snack", "Run"]);
      await page.setViewportSize({ width: 874, height: 402 });
      await expect(page).toHaveScreenshot("trail-bunny-battle.png");
      await page.setViewportSize({ width: 1280, height: 720 });
    }
    if (battle?.critterId === "squirrel" && battle.phase === "run") ranFromSquirrel = true;
    if (ranFromSquirrel && battle === null) afterRun = true;
    if (afterRun && state.area === "trail")
      expect(battle, "the squirrel leaves Fae alone after she runs").toBeNull();
  });
  expect(arrived).toBe(true);
  // The bunny came after Fae: the gap closed over the last steps before it
  // touched her.
  bunnyGap = bunnyGap.slice(-6);
  expect(bunnyGap.length).toBeGreaterThan(2);
  expect(bunnyGap.at(-1) ?? Infinity).toBeLessThan(bunnyGap[0] ?? 0);
  expect(bunnyShot).toBe(true);
  expect(ranFromSquirrel).toBe(true);
  const end = await readState(page);
  expect({ area: end.area, knot: end.dialogue?.knot })
    .toEqual({ area: "bay", knot: "bay_cliff_path" });
  // She left the trail, so its critters are gone; the bunny's sticker stays.
  expect(end.stickers).toEqual(["ribbon-bunny"]);
  expect(await readHash(page)).toBe(bunHash(path, "pass"));
});

test("real keys over the footbridge to the lookout, and down into the bay", async ({
  page,
}) => {
  const path = "tests/sim/scripts/trail/lookout.json";
  await page.setViewportSize({ width: 1280, height: 720 });
  await openHarness(page);
  await resetPaused(page, "trail");
  let bridgeShot = false;
  const lines: string[] = [];
  let heldInBay = 0;
  let gullShot = false;
  await playWithKeys(page, recording(path), 10, async () => {
    const state = await readState(page);
    const onBridge = state.area === "trail" && Math.abs(state.player.x - 1265) < 12 &&
      Math.abs(state.player.y - 560) < 12;
    if (onBridge && !bridgeShot) {
      bridgeShot = true;
      const info = await renderInfo(page);
      const fae = info.drawOrder.find((item) => item.label === "fae")?.zIndex ?? Infinity;
      const rail = info.props.find((prop) => prop.id === "bridge-rail")?.strips
        .filter((strip) => strip.left < state.player.x + 25 && strip.right > state.player.x - 25)
        ?? [];
      expect(rail.length).toBeGreaterThan(0);
      expect(rail.some((item) => item.zIndex > fae), "the near rail is drawn over her")
        .toBe(true);
      await expect(page).toHaveScreenshot("trail-bridge.png");
    }
    const dialogue = state.dialogue;
    if (state.battle?.critterId === "gull" && state.battle.phase === "command" &&
      state.battle.revealed >= state.battle.message.length && !gullShot) {
      gullShot = true;
      await expect(page.locator(".battle-command-label"))
        .toHaveText(["Soothe", "Play", "Snack", "Run"]);
      // The mini-boss is drawn 260 units tall (the critters, 190): check it
      // clears the HUD and the menu on a desktop and on a phone.
      await expect(page).toHaveScreenshot("trail-gull-battle-1280.png");
      await page.setViewportSize({ width: 874, height: 402 });
      await expect(page).toHaveScreenshot("trail-gull-battle.png");
      await page.setViewportSize({ width: 1280, height: 720 });
    }
    if (dialogue !== null && dialogue.revealed >= dialogue.text.length &&
      lines.at(-1) !== dialogue.text) lines.push(dialogue.text);
    if (state.area === "bay") {
      expect(state.transition?.target.area ?? "bay", "holding down doesn't send her back")
        .toBe("bay");
      if (state.transition === null && state.dialogue === null) heldInBay += 1;
    }
  });
  expect(bridgeShot).toBe(true);
  expect(gullShot).toBe(true);
  expect(lines).toEqual(expect.arrayContaining([
    "What a view! The sea sparkles all the way to the sky.",
    "I can see Sue's dock way down there. It looks tiny!",
  ]));
  expect(heldInBay).toBeGreaterThan(5);
  const end = await readState(page);
  expect({ area: end.area, knot: end.dialogue?.knot })
    .toEqual({ area: "bay", knot: "bay_cliff_path" });
  expect((await readState(page)).critters.gull).toBe("calm");
  expect((await readState(page)).stickers).toContain("lookout-gull");
});
