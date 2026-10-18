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

// The clubhouse kitchen (Milestone 52), with real keys, on from the lasso run:
// Mom gives the club her microwave and her toy chest, the freezer gives a box
// of dino nuggets, and up at the clubhouse the nuggets cook golden (a press,
// held to the box's minute) and the chest opens on Fae's keepsakes.
test.describe.configure({ timeout: longFlowTimeout });

async function shoot(page: Page, name: string): Promise<void> {
  await expect(page).toHaveScreenshot(`${name}-1280.png`);
  await page.setViewportSize({ width: 874, height: 402 });
  await expect(page).toHaveScreenshot(`${name}-874.png`);
  await page.setViewportSize({ width: 1280, height: 720 });
}

test("real keys: Mom's microwave and chest, the nuggets cooked golden, the keepsakes", async ({
  page,
}) => {
  const path = "tests/sim/scripts/pass-party/kitchen.json";
  await page.setViewportSize({ width: 1280, height: 720 });
  await openHarness(page);
  await resetPaused(page, "pass-party");
  const moments: [string, string][] = [
    ["Every clubhouse needs a kitchen", "kitchen-mom"],
    ["Mom's microwave is up on top of the fridge", "kitchen-clubhouse"],
    ["DING! Golden and perfect!", "kitchen-golden"],
    ["Fae lifts the lid", "kitchen-chest"],
  ];
  const shot = new Set<string>();
  // The close-up as drawn while it cooks, near the box's minute.
  let cooking: { display: string; front: string; light: boolean; wisps: number } | null = null;
  await playAfter(page, "tests/sim/scripts/pass-party/lasso.json", path, async () => {
    const state = await readState(page);
    const open = state.arcade?.game === "cook" ? state.arcade : null;
    if (open !== null && open.phase === "cooking" && open.cooked >= 110 && cooking === null) {
      const info = (await renderInfo(page)).arcade;
      if (info?.game !== "cook") throw new Error("the microwave isn't drawn");
      cooking = { display: info.display, front: info.front, light: info.light,
        wisps: info.wisps };
      shot.add("kitchen-cooking");
      await shoot(page, "kitchen-cooking");
    }
    const dialogue = state.dialogue;
    const result = open !== null && open.phase === "result" &&
      open.revealed >= open.message.length ? open.message : null;
    const text = result ?? (dialogue !== null && dialogue.revealed >= dialogue.text.length
      ? dialogue.text : null);
    if (text === null) return;
    for (const [start, name] of moments)
      if (!shot.has(name) && text.startsWith(start)) {
        shot.add(name);
        await shoot(page, name);
      }
  });
  expect([...shot]).toEqual(["kitchen-mom", "kitchen-clubhouse", "kitchen-cooking",
    "kitchen-golden", "kitchen-chest"]);
  expect(cooking).toMatchObject({ front: "Dino nuggets · Heat 1:00", light: true, wisps: 4 });
  const end = await readState(page);
  expect([end.area, end.snacks]).toEqual(["clubhouse", 5]);
  expect(await readHash(page)).toBe(bunHash(path, "pass-party"));
});
