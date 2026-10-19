import { expect, test, type Page } from "@playwright/test";
import {
  bunHash,
  longFlowTimeout,
  openHarness,
  playAfter,
  readHash,
  readState,
  resetPaused,
} from "./helpers";

// The lodge keeper (Milestone 57), with real keys, on from Jordan's run: the
// lodge's note leads on and a snowball whizzes past; Mrs. Flurry, fizzy on
// her porch, is calmed in battle; and in through her open door, the lodge.
test.describe.configure({ timeout: longFlowTimeout });

async function shoot(page: Page, name: string): Promise<void> {
  await expect(page).toHaveScreenshot(`${name}-1280.png`);
  await page.setViewportSize({ width: 874, height: 402 });
  await expect(page).toHaveScreenshot(`${name}-874.png`);
  await page.setViewportSize({ width: 1280, height: 720 });
}

test("real keys: the lodge keeper home and fizzy, calmed, and her lodge", async ({ page }) => {
  const path = "tests/sim/scripts/pass-party/lodge.json";
  const expectedHash = bunHash(path, "pass-party");
  await page.setViewportSize({ width: 1280, height: 720 });
  await openHarness(page);
  await resetPaused(page, "pass-party");
  const moments: [string, string][] = [
    ["WHOOSH! A snowball", "lodge-snowball"],
    ["How can Fae calm Mrs. Flurry?", "lodge-battle"],
    ["Then come in, come in", "lodge-calm"],
    ["The fire crackles", "lodge-inside"],
  ];
  const shot = new Set<string>();
  await playAfter(page, "tests/sim/scripts/pass-party/jordan.json", path, async () => {
    const state = await readState(page);
    // The battle at its first command menu: its scene has faded in by then.
    const battle = state.battle;
    const line = battle !== null
      ? battle.phase === "command" && battle.revealed >= battle.message.length
        ? battle.message : null
      : state.dialogue !== null && state.dialogue.revealed >= state.dialogue.text.length
        ? state.dialogue.text : null;
    if (line === null) return;
    for (const [start, name] of moments)
      if (!shot.has(name) && line.startsWith(start)) {
        shot.add(name);
        await shoot(page, name);
      }
  });
  expect([...shot]).toEqual(moments.map(([, name]) => name));
  const end = await readState(page);
  expect([end.area, end.critters["lodge-keeper"]]).toEqual(["lodge", "calm"]);
  expect(await readHash(page)).toBe(await expectedHash);
});
