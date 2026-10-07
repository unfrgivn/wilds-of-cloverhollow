import { expect, test } from "@playwright/test";
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
    const state = await readState(page);
    if (state.area === "trail" && state.transition === null && !arrived) {
      arrived = true;
      expect(state.facing).toBe("right");
      await expect(page).toHaveScreenshot("trail-arrival-1280.png");
      await page.setViewportSize({ width: 874, height: 402 });
      await expect(page).toHaveScreenshot("trail-arrival-874.png");
      await page.setViewportSize({ width: 1280, height: 720 });
    }
    const battle = state.battle;
    if (arrived && battle === null && state.critters.bunny === "chaos") {
      const bunny = (await renderInfo(page)).critters.find((item) => item.id === "bunny");
      if (bunny !== undefined)
        bunnyGap.push(Math.hypot(bunny.x - state.player.x, bunny.y - state.player.y));
    }
    if (battle?.critterId === "bunny" && battle.phase === "command" && !bunnyShot &&
      battle.revealed >= battle.message.length) {
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
  expect({ bunny: end.critters.bunny, squirrel: end.critters.squirrel })
    .toEqual({ bunny: "calm", squirrel: "chaos" });
  expect(end.stickers).toContain("ribbon-bunny");
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
  await playWithKeys(page, recording(path), 10, async () => {
    const state = await readState(page);
    const onBridge = state.area === "trail" && Math.abs(state.player.x - 1265) < 12 &&
      Math.abs(state.player.y - 560) < 12;
    if (onBridge && !bridgeShot) {
      bridgeShot = true;
      const order = (await renderInfo(page)).drawOrder;
      const fae = order.find((item) => item.label === "fae")?.zIndex ?? Infinity;
      const rail = order.filter((item) => item.label.startsWith("occluder:bridge-rail-"));
      expect(rail.length).toBe(4);
      expect(rail.some((item) => item.zIndex > fae), "the near rail is drawn over her")
        .toBe(true);
      await expect(page).toHaveScreenshot("trail-bridge.png");
    }
    const dialogue = state.dialogue;
    if (dialogue !== null && dialogue.revealed >= dialogue.text.length &&
      lines.at(-1) !== dialogue.text) lines.push(dialogue.text);
    if (state.area === "bay") {
      expect(state.transition?.target.area ?? "bay", "holding down doesn't send her back")
        .toBe("bay");
      if (state.transition === null && state.dialogue === null) heldInBay += 1;
    }
  });
  expect(bridgeShot).toBe(true);
  expect(lines).toEqual(expect.arrayContaining([
    "What a view! The sea sparkles all the way to the sky.",
    "I can see Sue's dock way down there. It looks tiny!",
  ]));
  expect(heldInBay).toBeGreaterThan(5);
  const end = await readState(page);
  expect({ area: end.area, knot: end.dialogue?.knot })
    .toEqual({ area: "bay", knot: "bay_cliff_path" });
  expect(await readHash(page)).toBe(bunHash(path, "trail"));
});
