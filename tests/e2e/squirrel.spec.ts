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

// A second flute friend (Milestone 60), with real keys, on from the kitchen
// run: a trail squirrel calmed and befriended with a chin scratch and a snack,
// the flute offering both friends, the squirrel hopping along behind Fae, and
// the big oak's knothole giving up its golden acorn.
test.describe.configure({ timeout: longFlowTimeout });

async function shoot(page: Page, name: string): Promise<void> {
  await expect(page).toHaveScreenshot(`${name}-1280.png`);
  await page.setViewportSize({ width: 874, height: 402 });
  await expect(page).toHaveScreenshot(`${name}-874.png`);
  await page.setViewportSize({ width: 1280, height: 720 });
}

test("real keys: a squirrel befriended, called by the flute, and up the big oak", async ({
  page,
}) => {
  const path = "tests/sim/scripts/pass-party/squirrel.json";
  const expectedHash = bunHash(path, "pass-party");
  await page.setViewportSize({ width: 1280, height: 720 });
  await openHarness(page);
  await resetPaused(page, "pass-party");
  const moments: [string, string][] = [
    ["I'm saving my acorns for winter now.", "squirrel-bond"],
    ["Fae plays a little tune", "squirrel-flute"],
    ["High up the big oak", "squirrel-knothole"],
  ];
  const shot = new Set<string>();
  // The squirrel's frames while he follows: hop frames, then his sit.
  const hops = new Set<string>();
  await playAfter(page, "tests/sim/scripts/pass-party/kitchen.json", path, async () => {
    const state = await readState(page);
    const following = state.party.some((member) => member.id === "acorn-squirrel") &&
      state.dialogue === null && state.transition === null && state.battle === null;
    // Out in the open meadow, on the way to the oak.
    if (following && state.area === "woods" && state.player.x < 1000) {
      const frame = (await renderInfo(page)).party
        .find((member) => member.id === "acorn-squirrel");
      if (frame !== undefined) hops.add(frame.animation);
      if (!shot.has("squirrel-following") && frame?.animation.startsWith("walk_") === true) {
        shot.add("squirrel-following");
        await shoot(page, "squirrel-following");
      }
    }
    const dialogue = state.dialogue;
    if (dialogue === null || dialogue.revealed < dialogue.text.length) return;
    for (const [start, name] of moments)
      if (!shot.has(name) && dialogue.text.startsWith(start)) {
        shot.add(name);
        await shoot(page, name);
      }
  });
  expect([...shot]).toEqual(["squirrel-bond", "squirrel-flute", "squirrel-following",
    "squirrel-knothole"]);
  expect([...hops].some((animation) => animation.startsWith("walk_"))).toBe(true);
  const end = await readState(page);
  expect([end.area, end.party.map((member) => member.id).at(-1)])
    .toEqual(["woods", "acorn-squirrel"]);
  expect(await readHash(page)).toBe(await expectedHash);
});
