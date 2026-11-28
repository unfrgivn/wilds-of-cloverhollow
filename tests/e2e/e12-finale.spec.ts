import { expect, test, type Page, type TestInfo } from "@playwright/test";
import {
  longFlowTimeout,
  openHarness,
  playAfter,
  readState,
  renderInfo,
  resetPaused,
  step,
  walk,
} from "./helpers";

test.describe.configure({ timeout: longFlowTimeout });

const forest = "tests/sim/scripts/new-game/golden-forest.json";
const kid = "tests/sim/scripts/new-game/golden-kid.json";

async function tapConfirm(page: Page): Promise<void> {
  await page.keyboard.down("z");
  await step(page, 1);
  await page.keyboard.up("z");
  await step(page, 1);
}

async function settleAnimations(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await Promise.all(
      document
        .getAnimations()
        .filter((anim) => anim.effect?.getComputedTiming().iterations !== Infinity)
        .map((anim) => anim.finished.catch(() => undefined)),
    );
  });
}

async function captureReview(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  if (process.env.CLOVERHOLLOW_REVIEW_SHOTS !== "1" || testInfo.project.name !== "chromium") {
    return;
  }
  await settleAnimations(page);
  await page.screenshot({
    path: `art/review/${name}.jpg`,
    type: "jpeg",
    quality: 90,
  });
}

async function waitForTransitionEnd(page: Page): Promise<void> {
  for (let guard = 0; guard < 40; guard += 1) {
    if ((await readState(page)).transition === null) return;
    await step(page, 4);
  }
  throw new Error("area transition did not finish");
}

test(
  "E12 finale plays hood-drop, golden bloom, morning desk & Milo doorway into credits postcard",
  { tag: "@smoke" },
  async ({ page }, testInfo) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => {
      pageErrors.push(error.message);
    });

    await page.setViewportSize({ width: 1280, height: 720 });
    await openHarness(page);
    await page.evaluate(() => window.__cloverhollow?.save.clear());
    await resetPaused(page, "new-game");

    // 1. Replay the Enchanted Forest boss into milo_calm and capture the hood-drop moment.
    let capturedHoodDrop = false;
    await playAfter(page, forest, kid, async () => {
      if (capturedHoodDrop) return;
      const dialogue = (await readState(page)).dialogue;
      if (dialogue === null || dialogue.knot !== "milo_calm") return;
      if (dialogue.revealed < dialogue.text.length) return;
      const isHoodDrop =
        dialogue.text.includes("pulls back the purple hood") ||
        dialogue.text.includes("I always notice you, Milo");
      if (!isHoodDrop) return;

      capturedHoodDrop = true;
      await expect(page.locator(".sticker-portrait")).toBeVisible();
      await expect(page.locator(".sticker-speaker")).toHaveText(/^(Milo|Fae)$/);
      await captureReview(page, testInfo, "e12-hood-drop");
    });
    expect(capturedHoodDrop).toBe(true);

    // 2. Talk to calm Milo with real keys, watch the golden bloom, and wake up in the bedroom.
    const afterKid = await readState(page);
    expect(afterKid.area).toBe("enchanted");
    expect(afterKid.critters["hooded-kid"]).toBe("calm");

    await tapConfirm(page);
    const miloChoice = (await readState(page)).dialogue;
    expect(miloChoice?.knot).toBe("milo_calm");
    expect(miloChoice?.choices).toContain("Watch the tree glow");

    let sawMomWhisper = false;
    for (let guard = 0; guard < 40; guard += 1) {
      const state = await readState(page);
      const dialogue = state.dialogue;
      if (dialogue?.speaker === "Mom" && dialogue.text.includes("Time to wake up")) {
        sawMomWhisper = true;
      }
      if (state.finale === "morning" && state.area === "bedroom") break;
      await tapConfirm(page);
    }
    expect(sawMomWhisper).toBe(true);

    // Advance Mom's bedroom wake-up lines with real keys.
    for (let guard = 0; guard < 30; guard += 1) {
      if ((await readState(page)).dialogue === null) break;
      await tapConfirm(page);
    }

    // 3. Awake in the bedroom: Maddie alone in party, Mom visible, walk to desk with arrows.
    const awakeBedroom = await readState(page);
    expect(awakeBedroom.area).toBe("bedroom");
    expect(awakeBedroom.finale).toBe("morning");
    expect(awakeBedroom.party.map((member) => member.id)).toEqual(["maddie"]);
    expect((await renderInfo(page)).npcs.map((npc) => npc.id)).toContain("mom");

    await walk(page, "y", 500);
    await walk(page, "x", 355);
    await tapConfirm(page);

    const deskLines: string[] = [];
    expect((await readState(page)).dialogue?.knot).toBe("desk");
    for (let guard = 0; guard < 20; guard += 1) {
      const dialogue = (await readState(page)).dialogue;
      if (dialogue === null) break;
      if (!deskLines.includes(dialogue.text)) deskLines.push(dialogue.text);
      await tapConfirm(page);
    }
    const deskText = deskLines.join(" ");
    expect(deskText).toContain("sketchbook");
    expect(deskText).toContain("glowing golden tree");
    expect((await readState(page)).dialogue).toBeNull();

    // 4. Walk downstairs to the kitchen, verify Milo in his purple hoodie, and talk to him.
    await walk(page, "x", 485);
    await walk(page, "y", 300);
    await waitForTransitionEnd(page);

    const inKitchen = await readState(page);
    expect(inKitchen.area).toBe("kitchen");
    expect(inKitchen.finale).toBe("morning");
    expect((await renderInfo(page)).npcs.map((npc) => npc.id)).toContain("milo-hoodie");

    await walk(page, "x", 890);
    await walk(page, "y", 500);
    await walk(page, "x", 896);
    await tapConfirm(page);

    // Reveal the full opening doorway line before asserting and capturing the review shot.
    let doorway = (await readState(page)).dialogue;
    expect(doorway?.knot).toBe("front_door_morning");
    if (doorway !== null && doorway.revealed < doorway.text.length) {
      await tapConfirm(page);
      doorway = (await readState(page)).dialogue;
    }
    expect(doorway?.text).toContain("purple hoodie");
    expect(doorway?.text).toContain("rocket sketchbook");
    await captureReview(page, testInfo, "e12-morning-doorway");

    // 5. Advance through Milo's doorway scene into the credits postcard.
    for (let guard = 0; guard < 40; guard += 1) {
      const state = await readState(page);
      if (state.finale === "credits" && state.dialogue === null) break;
      await tapConfirm(page);
    }
    expect((await readState(page)).finale).toBe("credits");

    const creditsScreen = page.locator(".credits-screen");
    await expect(creditsScreen).toBeVisible();
    await expect(creditsScreen).toHaveAttribute("data-stickers", "ready");
    await expect(page.locator(".credits-entry-image").first()).toBeVisible();
    await expect(page.locator(".credits-postcard-img")).toBeVisible();
    await expect(page.locator(".credits-postcard-caption")).toHaveText(
      "Morning walk to school · Cloverhollow",
    );
    await expect(page.locator(".credits-postcard-stamp")).toBeVisible();

    const postcardSize = await page.evaluate(() => {
      const img = document.querySelector(".credits-postcard-img");
      if (!(img instanceof HTMLImageElement)) return null;
      return { width: img.naturalWidth, height: img.naturalHeight };
    });
    expect(postcardSize).toEqual({ width: 960, height: 540 });

    await captureReview(page, testInfo, "e12-credits-postcard-1280");
    await page.setViewportSize({ width: 874, height: 402 });
    await step(page, 2);
    await captureReview(page, testInfo, "e12-credits-postcard-874");
    await page.setViewportSize({ width: 1280, height: 720 });

    // 6. Confirm zero uncaught runtime errors across the whole finale run.
    expect(pageErrors).toEqual([]);
  },
);
