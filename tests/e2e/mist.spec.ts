import { expect, test } from "@playwright/test";
import {
  bunHash, longFlowTimeout, openHarness, openMap, playAfter, readHash, readState,
  renderInfo, resetPaused,
} from "./helpers";

test.describe.configure({ timeout: longFlowTimeout });

test("real keys cross the Misty Path and open the seal", async ({ page }) => {
  const path = "tests/sim/scripts/pass-party/mist.json";
  const expectedHash = bunHash(path, "pass-party");
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
  const prop = async (
    id: string,
  ): Promise<Awaited<ReturnType<typeof renderInfo>>["props"][number]> => {
    const item = (await renderInfo(page)).props.find((candidate) => candidate.id === id);
    if (item === undefined) throw new Error(`missing render prop ${id}`);
    return item;
  };

  let arrived = false;
  let lantern = false;
  let stones = false;
  let bridge = false;
  let notes = false;
  let opened = false;
  await playAfter(page, "tests/sim/scripts/pass-party/lasso.json", path, async () => {
    const state = await readState(page);
    const info = await renderInfo(page);
    if (!arrived && state.area === "mist" && state.transition === null) {
      arrived = true;
      await take("mist-arrival");
    }
    if (!lantern && info.lantern.on && info.lantern.glows.length > 0) {
      lantern = true;
      await take("mist-lantern");
    }
    if (state.area === "mist" && !stones) {
      const item = await prop("mist-stones");
      if (item.state === "found" && !item.hidden) {
        stones = true;
        await take("mist-stones");
      }
    }
    if (state.area === "mist" && !bridge) {
      const item = await prop("rope-bridge");
      if (item.state === "across") {
        bridge = true;
        await take("mist-bridge");
      }
    }
    if (state.area === "mist" && !notes && state.dialogue?.knot === "mist_seal" &&
      state.dialogue !== null &&
      state.dialogue.choices.length > 0 &&
      state.dialogue.revealed >= state.dialogue.text.length) {
      expect(await page.locator(".sticker-choice").allTextContents()).toEqual([
        "Red", "Yellow", "Green", "Blue", "Stop",
      ]);
      notes = true;
      await expect(page.locator(".sticker-choice")).not.toHaveCount(0);
      await take("mist-seal-notes");
    }
    if (state.area === "mist" && !opened) {
      const item = await prop("seal-open");
      if (item.state === "open" && !item.hidden) {
        opened = true;
        await take("mist-seal-open");
      }
    }
  });

  expect({ arrived, lantern, stones, bridge, notes, opened }).toEqual({
    arrived: true,
    lantern: true,
    stones: true,
    bridge: true,
    notes: true,
    opened: true,
  });
  expect(await readHash(page)).toBe(await expectedHash);

  // The way through the mist is found, and Fae stands in the Enchanted
  // Forest's land: the map names it now ("???" before, spec 9).
  await openMap(page);
  await expect(page.locator('.journal-map-land[data-land="enchanted"]'))
    .toHaveText("The Enchanted Forest");
});
