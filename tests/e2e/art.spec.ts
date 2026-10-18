import { expect, test, type Page } from "@playwright/test";
import { bunHash, longFlowTimeout, openHarness, playAfter, readHash, readState,
  renderInfo, resetPaused } from "./helpers";

test.describe.configure({ timeout: longFlowTimeout });

async function shoot(page: Page, name: string): Promise<void> {
  await expect(page).toHaveScreenshot(`${name}-1280.png`);
  await page.setViewportSize({ width: 874, height: 402 });
  await expect(page).toHaveScreenshot(`${name}-874.png`);
  await page.setViewportSize({ width: 1280, height: 720 });
}

test("real keys: paint under the door, Trace, and the open art room", { tag: "@smoke" },
  async ({ page }) => {
  const path = "tests/sim/scripts/pass-party/art.json";
  await page.setViewportSize({ width: 1280, height: 720 });
  await openHarness(page);
  await resetPaused(page, "pass-party");
  const moments: [string, string][] = [
    ["Purple paint seeps under the door.", "art-paint"],
    ["How can Fae calm", "art-battle"],
    ["art_room", "art-open"],
  ];
  const shot = new Set<string>();
  let roomShot = false;
  let markerRead = false;
  let tableShot = false;
  await playAfter(page, "tests/sim/scripts/pass-party/field.json", path, async () => {
    const state = await readState(page);
    const dialogue = state.dialogue;
    if (dialogue?.knot === "art_markers") markerRead = true;
    const shown = dialogue !== null && dialogue.revealed >= dialogue.text.length;
    const battle = state.battle;
    const line = shown && dialogue !== null ? dialogue.text : null;
    if (!shot.has("art-battle") && battle?.phase === "check" && battle.check?.kind === "trace") {
      shot.add("art-battle");
      await shoot(page, "art-battle");
    }
    if (line !== null)
      for (const [start, name] of moments)
        if (!shot.has(name) && ((name === "art-open" && dialogue?.knot === start) ||
          (name !== "art-open" && line.startsWith(start)))) {
          shot.add(name);
          await shoot(page, name);
        }
    if (!roomShot && state.area === "art-room" && state.dialogue === null &&
        state.battle === null && state.transition === null) {
      const info = await renderInfo(page);
      expect(info.party.find((member) => member.id === "maddie")).toBeDefined();
      roomShot = true;
      await shoot(page, "art-room");
    }
    if (markerRead && !tableShot && state.area === "art-room" && state.dialogue === null &&
        state.battle === null && state.transition === null) {
      tableShot = true;
      await shoot(page, "art-table");
    }
  });
  expect([...shot].sort()).toEqual(moments.map(([, name]) => name).sort());
  expect(roomShot).toBe(true);
  expect(tableShot).toBe(true);
  const end = await readState(page);
  expect(end.area).toBe("art-room");
  expect(await readHash(page)).toBe(await bunHash(path, "pass-party"));
});
