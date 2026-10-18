import { expect, test } from "@playwright/test";
import {
  bunHash, longFlowTimeout, openHarness, playAfter, readHash, readState,
  renderInfo, resetPaused,
} from "./helpers";

test.describe.configure({ timeout: longFlowTimeout });

test("real keys explore the Enchanted Forest", async ({ page }) => {
  const path = "tests/sim/scripts/pass-party/forest.json";
  await page.setViewportSize({ width: 1280, height: 720 });
  await openHarness(page);
  await resetPaused(page, "pass-party");

  const shot = new Set<string>();
  const take = async (name: string): Promise<void> => {
    if (shot.has(name)) return;
    shot.add(name);
    await expect(page).toHaveScreenshot(`${name}-1280.png`);
    await page.setViewportSize({ width: 874, height: 402 });
    await expect(page).toHaveScreenshot(`${name}-874.png`);
    await page.setViewportSize({ width: 1280, height: 720 });
  };
  let arrived = false;
  let lore = false;
  await playAfter(page, "tests/sim/scripts/pass-party/mist.json", path, async () => {
    const state = await readState(page);
    const info = await renderInfo(page);
    if (!arrived && state.area === "enchanted" && state.transition === null) {
      arrived = true;
      expect(info.ambient).toHaveLength(7);
      expect(info.npcs.map((npc) => npc.id)).toEqual(expect.arrayContaining([
        "fairy-lavender", "fairy-mint", "fairy-sky", "fairy-peach",
      ]));
      expect(info.critters.map((critter) => critter.kind)).toContain("hooded-kid");
      expect(info.props.find((prop) => prop.id === "tree-scribbles"))
        .toMatchObject({ state: "fizzy", hidden: false });
      expect(info.props.find((prop) => prop.id === "pond-fizz"))
        .toMatchObject({ state: "fizzy", hidden: false });
      await take("forest-arrival");
    }
    if (!lore && state.dialogue?.knot === "fairy_lavender" &&
      state.dialogue.revealed >= state.dialogue.text.length) {
      lore = true;
      expect(info.area).toBe("enchanted");
      expect(state.dialogue.text).toContain("Ancient Tree dreams");
      await take("forest-lavender-lore");
    }
  });
  expect({ arrived, lore }).toEqual({ arrived: true, lore: true });
  expect(await readHash(page)).toBe(bunHash(path, "pass-party"));
});
