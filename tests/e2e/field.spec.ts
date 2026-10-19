import { expect, test, type Page } from "@playwright/test";
import {
  bunHash,
  longFlowTimeout,
  openHarness,
  playAfter,
  readHash,
  readState,
  renderInfo,
  resetPaused,
} from "./helpers";

// Recess (Milestone 39), with real keys: out the gym's back door, the oak
// squirrel's battle, the swing across the creek on the lasso, the hooded
// kid's stash, and the lever that lays the old footbridge down, then back
// over it. The bridge is a prop with a flat state: lowered, it's drawn under
// Fae, never over her.
test.describe.configure({ timeout: longFlowTimeout });

async function shoot(page: Page, name: string): Promise<void> {
  await expect(page).toHaveScreenshot(`${name}-1280.png`);
  await page.setViewportSize({ width: 874, height: 402 });
  await expect(page).toHaveScreenshot(`${name}-874.png`);
  await page.setViewportSize({ width: 1280, height: 720 });
}

test("real keys: the squirrel, the swing, the stash, and the footbridge", async ({ page }) => {
  const path = "tests/sim/scripts/pass-party/field.json";
  const expectedHash = bunHash(path, "pass-party");
  await page.setViewportSize({ width: 1280, height: 720 });
  await openHarness(page);
  await resetPaused(page, "pass-party");
  let arrived = false;
  let battleShot = false;
  let landed = false;
  let leverShot = false;
  let crossing = false;
  let swungFrom = Infinity;
  await playAfter(page, "tests/sim/scripts/pass-party/music.json", path, async () => {
    const state = await readState(page);
    if (state.area !== "field") return;
    if (!arrived && state.transition === null) {
      arrived = true;
      await shoot(page, "field-arrival");
    }
    const battle = state.battle;
    if (!battleShot && battle?.phase === "command" &&
        battle.revealed >= battle.message.length) {
      battleShot = true;
      await expect(page.locator(".battle-meter-label").last())
        .toHaveText("LV 6 · FIZZY SQUIRREL", { useInnerText: true });
      await shoot(page, "field-squirrel-battle");
    }
    if (state.dialogue?.knot === "oak_branch") swungFrom = Math.min(swungFrom, state.player.x);
    if (!landed && swungFrom < 1100 && state.transition === null && state.player.x > 1250) {
      landed = true;
      await shoot(page, "field-far-bank");
    }
    const dialogue = state.dialogue;
    if (!leverShot && dialogue !== null && dialogue.revealed >= dialogue.text.length &&
        dialogue.text.startsWith("CLUNK!")) {
      leverShot = true;
      const info = await renderInfo(page);
      const bridge = info.props.find((prop) => prop.id === "bridge");
      expect({ state: bridge?.state, flat: bridge?.flat, strips: bridge?.strips.length })
        .toEqual({ state: "lowered", flat: true, strips: 0 });
      expect(info.props.find((prop) => prop.id === "lever")?.state).toBe("pulled");
      await shoot(page, "field-bridge-down");
    }
    // Over the lowered footbridge, in the middle of the creek.
    if (leverShot && !crossing && state.dialogue === null && state.player.x < 1200 &&
        state.player.x > 1100) {
      crossing = true;
      await shoot(page, "field-on-the-bridge");
    }
  });
  expect({ arrived, battleShot, landed, leverShot, crossing })
    .toEqual({ arrived: true, battleShot: true, landed: true, leverShot: true, crossing: true });
  const end = await readState(page);
  expect(end.area).toBe("field");
  expect(end.player.x).toBeLessThan(1000);
  expect(await readHash(page)).toBe(await expectedHash);
});
