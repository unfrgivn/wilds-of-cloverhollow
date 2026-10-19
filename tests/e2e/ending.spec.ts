import { expect, test, type Page } from "@playwright/test";
import {
  bunHash, longFlowTimeout, openHarness, playAfter, readHash, readState, renderInfo,
  resetPaused, step,
} from "./helpers";

// Milestone 56: Milo's last talk under the restored Ancient Tree, the dream
// saved once, the morning (the bedroom, the kitchen, Milo by the door), the
// credits, the title, and Continue back into the dream, all with real keys.
test.describe.configure({ timeout: longFlowTimeout });

const kid = "tests/sim/scripts/pass-party/kid.json";
const path = "tests/sim/scripts/pass-party/ending.json";

type SaveMark = { tick: number; hash: string } | null;
const lastSave = async (page: Page): Promise<SaveMark> =>
  page.evaluate(() => window.__cloverhollow?.save.last() ?? null);
const titleMode = async (page: Page): Promise<string | null> =>
  page.evaluate(() => window.__cloverhollow?.boot.title() ?? null);

async function screenshots(page: Page, name: string): Promise<void> {
  await expect(page).toHaveScreenshot(`ending-${name}-1280.png`);
  await page.setViewportSize({ width: 874, height: 402 });
  await expect(page).toHaveScreenshot(`ending-${name}-874.png`);
  await page.setViewportSize({ width: 1280, height: 720 });
}

test("real keys wake Fae from the dream, and Continue returns to it",
  { tag: "@smoke" }, async ({ page }) => {
    const expectedHash = bunHash(path, "pass-party");
    await page.setViewportSize({ width: 1280, height: 720 });
    await openHarness(page);
    await page.evaluate(() => window.__cloverhollow?.save.clear());
    await resetPaused(page, "pass-party");
    const shots = new Set<string>();
    const take = async (name: string): Promise<void> => {
      if (shots.has(name)) return;
      shots.add(name);
      await screenshots(page, name);
    };
    // The save slot while Milo's choice is up, and once the ending saved the
    // dream (the slot's only write after the choice).
    const marks: { choice: SaveMark; dream: SaveMark } = { choice: null, dream: null };
    await playAfter(page, kid, path, async () => {
      const state = await readState(page);
      const info = await renderInfo(page);
      // Milo's last talk, its choice on screen: the tree is glowing.
      const dialogue = state.dialogue;
      if (dialogue?.knot === "milo_calm" && dialogue.choices.length > 0 &&
        dialogue.revealed >= dialogue.text.length) {
        expect(dialogue.choices).toEqual(["Watch the tree glow", "Not yet"]);
        marks.choice = await lastSave(page);
        await take("milo-choice");
      }
      // Awake in the bedroom, Mom's wake-up read: Maddie alone, Mom there.
      if (state.finale === "morning" && state.area === "bedroom" &&
        state.dialogue === null && state.transition === null) {
        expect(state.party.map((member) => member.id)).toEqual(["maddie"]);
        expect(info.finale).toBe("morning");
        expect(info.npcs.map((npc) => npc.id)).toContain("mom");
        if (marks.dream === null) {
          await expect.poll(() => lastSave(page)).not.toEqual(marks.choice);
          marks.dream = await lastSave(page);
        }
        await take("morning");
      }
      // Downstairs: Milo by the door, in his purple hoodie.
      if (state.finale === "morning" && state.area === "kitchen" &&
        state.dialogue === null && state.transition === null) {
        expect(info.npcs.map((npc) => npc.id)).toContain("milo-hoodie");
        await take("kitchen");
      }
    });
    expect(await readHash(page)).toBe(await expectedHash);
    expect(shots).toEqual(new Set(["milo-choice", "morning", "kitchen"]));

    // The credits: the dream's friends and everyone Fae met, as stickers.
    // (This chain's fixture puts Sue in the party without her joining, so
    // she isn't one of its friends.)
    expect(await readState(page)).toMatchObject({
      area: "kitchen", finale: "credits", dialogue: null,
    });
    const credits = (await renderInfo(page)).credits;
    expect(credits?.entries.filter((entry) => entry.section === "friends")
      .map((entry) => entry.name)).toEqual(["Maddie", "Jordan", "Pond Pup"]);
    expect(credits?.entries.map((entry) => entry.name)).toContain("Milo");
    await expect(page.locator(".credits-screen")).toBeVisible();
    // The stickers show once their atlases are decoded.
    await expect(page.locator(".credits-entry-image").first()).toBeVisible();
    await take("credits");
    // Nothing in the morning or the credits wrote the save slot: it still
    // holds the dream.
    expect(marks.dream).not.toBeNull();
    expect(await lastSave(page)).toEqual(marks.dream);

    // A press as the credits open doesn't skip them; after their short beat,
    // one goes to the title, on the dream that was saved.
    await page.keyboard.press("z");
    await step(page, 2);
    expect(await titleMode(page)).toBeNull();
    await expect(page.locator(".credits-screen")).toBeVisible();
    await step(page, 12);
    await page.keyboard.press("z");
    await step(page, 2);
    expect(await titleMode(page)).toBe("continue");
    await expect(page.locator(".credits-screen")).toBeHidden();
    await expect(page.locator(".title-option-label")).toHaveText(["Continue", "New game"]);
    await expect(page.locator(".title-option-detail"))
      .toHaveText("The Enchanted Forest · 8 stickers");
    await take("title");

    // Continue: the title closes without a core tick, on exactly the dream.
    await page.keyboard.press("z");
    await step(page, 1);
    expect(await titleMode(page)).toBeNull();
    expect(await readHash(page)).toBe(marks.dream?.hash);
    const restored = await readState(page);
    expect(restored).toMatchObject({ area: "enchanted", finale: null, dialogue: null });
    expect(restored.critters["hooded-kid"]).toBe("calm");

    // And the slot itself is the dream: after a relaunch, Continue resumes it.
    await page.reload();
    await page.waitForFunction(() => Boolean(window.__cloverhollow));
    expect(await page.evaluate(() => window.__cloverhollow?.save.loaded() ?? null))
      .toEqual(marks.dream);
    await step(page, 1);
    expect(await titleMode(page)).toBe("continue");
    await page.keyboard.press("z");
    await step(page, 1);
    expect(await titleMode(page)).toBeNull();
    expect(await readHash(page)).toBe(marks.dream?.hash);
    expect(await readState(page)).toMatchObject({ area: "enchanted", finale: null });
  });
