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

// The clubhouse fix-up (Milestone 43), with real keys, on from the woods run:
// up the ladder; Sue fixes the fridge and Jordan plants the garden; calms in
// the woods grow it; the strawberries go into the fridge and three snacks
// come out. The fridge and the garden are props whose states follow the story.
test.describe.configure({ timeout: longFlowTimeout });

async function shoot(page: Page, name: string): Promise<void> {
  await expect(page).toHaveScreenshot(`${name}-1280.png`);
  await page.setViewportSize({ width: 874, height: 402 });
  await expect(page).toHaveScreenshot(`${name}-874.png`);
  await page.setViewportSize({ width: 1280, height: 720 });
}

test("real keys: the fridge, the garden, the calms, and the snacks", async ({ page }) => {
  const path = "tests/sim/scripts/pass-party/clubhouse.json";
  const expectedHash = bunHash(path, "pass-party");
  await page.setViewportSize({ width: 1280, height: 720 });
  await openHarness(page);
  await resetPaused(page, "pass-party");
  const states: string[] = [];
  let arrived = false;
  let fixedShot = false;
  let growingShot = false;
  let ripeShot = false;
  let snacksShot = false;
  await playAfter(page, "tests/sim/scripts/pass-party/woods.json", path, async () => {
    const state = await readState(page);
    if (state.area !== "clubhouse" || state.transition !== null) return;
    const props = (await renderInfo(page)).props;
    const fridge = props.find((prop) => prop.id === "fridge")?.state ?? "";
    const garden = props.find((prop) => prop.id === "garden")?.state ?? "";
    const seen = `${fridge}/${garden}`;
    if (states.at(-1) !== seen) states.push(seen);
    if (!arrived) {
      arrived = true;
      await shoot(page, "clubhouse-arrival");
    }
    const dialogue = state.dialogue;
    const shown = dialogue !== null && dialogue.revealed >= dialogue.text.length;
    if (!fixedShot && shown && dialogue.text.startsWith("Hummmm!")) {
      fixedShot = true;
      await shoot(page, "clubhouse-fridge-fixed");
    }
    if (!growingShot && garden === "growing" && dialogue === null) {
      growingShot = true;
      await shoot(page, "clubhouse-garden-growing");
    }
    if (!ripeShot && garden === "ripe" && dialogue === null) {
      ripeShot = true;
      await shoot(page, "clubhouse-garden-ripe");
    }
    if (!snacksShot && shown && dialogue.text.startsWith("Fae packs three strawberry snacks")) {
      snacksShot = true;
      await shoot(page, "clubhouse-snacks");
    }
  });
  expect({ arrived, fixedShot, growingShot, ripeShot, snacksShot }).toEqual({
    arrived: true, fixedShot: true, growingShot: true, ripeShot: true, snacksShot: true,
  });
  // The fridge and the garden as the story went, in the clubhouse.
  expect(states).toEqual([
    "default/default", "fixed/default", "fixed/planted", "fixed/growing", "fixed/ripe",
    "fixed/growing",
  ]);
  const end = await readState(page);
  expect({ area: end.area, snacks: end.snacks }).toEqual({ area: "clubhouse", snacks: 5 });
  expect(await readHash(page)).toBe(await expectedHash);
});
