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
  step,
} from "./helpers";

// Milestone 80 (Ribbon Bunny 3rd flute friend & collectible Star Gems), played
// with real keys on from golden-squirrel.json: Ribbon Bunny calmed & befriended
// on Cliffside Trail, called with the flute so she hops behind Fae, hopping into
// the trail-gem burrow for the Citrine Star Gem, assisting in battle for +1
// Together sparkle star + calm, and lighting up the lavender Gems 1/7 pill in
// Fae's journal at both 1280x720 and 874x402.
test.describe.configure({ timeout: longFlowTimeout });

async function shoot(page: Page, name: string): Promise<void> {
  await expect(page).toHaveScreenshot(`${name}-1280.png`);
  await page.setViewportSize({ width: 874, height: 402 });
  await expect(page).toHaveScreenshot(`${name}-874.png`);
  await page.setViewportSize({ width: 1280, height: 720 });
}

test("real keys: Ribbon Bunny, trail Star Gem, battle Flute Assist & Journal pill", async ({
  page,
}) => {
  const path = "tests/sim/scripts/new-game/bunny-gems.json";
  const expectedHash = bunHash(path, "new-game");
  await page.setViewportSize({ width: 1280, height: 720 });
  await openHarness(page);
  await resetPaused(page, "new-game");

  const shot = new Set<string>();
  const bunnyAnims = new Set<string>();
  let assistSparkleSeen = false;

  await playAfter(page, "tests/sim/scripts/new-game/golden-squirrel.json", path, async () => {
    const state = await readState(page);
    const following = state.party.some((member) => member.id === "ribbon-bunny") &&
      state.dialogue === null && state.transition === null && state.battle === null;
    if (following && state.area === "trail") {
      const frame = (await renderInfo(page)).party
        .find((member) => member.id === "ribbon-bunny");
      if (frame !== undefined) bunnyAnims.add(frame.animation);
      if (!shot.has("bunny-following") && frame?.animation.startsWith("walk_") === true) {
        shot.add("bunny-following");
        await shoot(page, "bunny-following");
      }
    }
    const dialogue = state.dialogue;
    if (dialogue !== null && dialogue.revealed >= dialogue.text.length) {
      if (!shot.has("bunny-gem") && dialogue.text.includes("Citrine Star Gem")) {
        shot.add("bunny-gem");
        await shoot(page, "bunny-gem");
      }
    }
    const battle = state.battle;
    if (
      battle !== null &&
      battle.fluteUsed === true &&
      (battle.sparkle ?? 0) >= 1 &&
      battle.revealed >= battle.message.length
    ) {
      assistSparkleSeen = true;
      if (!shot.has("bunny-assist")) {
        shot.add("bunny-assist");
        await expect(page.locator(".battle-sparkle-pill")).toBeVisible();
        await expect(page.locator(".battle-sparkle-pill .battle-sparkle-star.is-full"))
          .toHaveCount(1);
        await shoot(page, "bunny-assist");
      }
    }
  });

  expect([...shot]).toEqual(["bunny-following", "bunny-gem", "bunny-assist"]);
  expect([...bunnyAnims].some((animation) => animation.startsWith("walk_"))).toBe(true);
  expect(assistSparkleSeen).toBe(true);

  const end = await readState(page);
  expect(end.area).toBe("trail");
  expect(end.party.map((member) => member.id)).toContain("ribbon-bunny");
  expect(await readHash(page)).toBe(await expectedHash);

  // Press real J key to open Fae's journal and verify the lavender Gems 1/7 pill
  // fits cleanly inside the notes page at both 1280x720 and 874x402.
  await page.keyboard.down("j");
  await step(page, 2);
  await page.keyboard.up("j");
  await step(page, 2);

  const gemsPill = page.locator(".journal-supply.journal-gems");
  await expect(gemsPill).toBeVisible();
  await expect(gemsPill).toContainText("Gems 1/7");

  for (const size of [{ width: 1280, height: 720 }, { width: 874, height: 402 }]) {
    await page.setViewportSize(size);
    const fits = await page.evaluate(() => {
      const pageEl = document.querySelector<HTMLElement>(".journal-notes-page");
      const pill = document.querySelector<HTMLElement>(".journal-supply.journal-gems");
      if (pageEl === null || pill === null) return false;
      const p = pageEl.getBoundingClientRect();
      const b = pill.getBoundingClientRect();
      return b.width > 0 && b.height > 0 &&
        b.left >= p.left && b.right <= p.right &&
        b.top >= p.top && b.bottom <= p.bottom;
    });
    expect(fits).toBe(true);
  }
  await page.setViewportSize({ width: 1280, height: 720 });
  await shoot(page, "bunny-journal");
});
