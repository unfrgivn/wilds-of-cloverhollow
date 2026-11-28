import { expect, test, type Page } from "@playwright/test";
import { serializeSave, setInkVariables } from "../../src/core";
import {
  longFlowTimeout,
  openHarness,
  readState,
  renderInfo,
  resetPaused,
  step,
  walk,
} from "./helpers";

async function press(page: Page, key = "z"): Promise<void> {
  await page.keyboard.down(key);
  await step(page, 1);
  await page.keyboard.up(key);
  await step(page, 1);
}

async function continueFromSave(page: Page, encodedSave: string): Promise<void> {
  await page.evaluate((encoded) => {
    localStorage.setItem("CapacitorStorage.cloverhollow-save", encoded);
  }, encodedSave);
  await page.goto("./");
  await page.waitForFunction(() => Boolean(window.__cloverhollow));
  await page.keyboard.press("Enter");
  await expect
    .poll(() => page.evaluate(() => window.__cloverhollow?.boot.title()))
    .toBeNull();
  await page.evaluate(() => window.__cloverhollow?.pause());
  await step(page, 2);
}

test.describe(
  "Milestone 159: 32/32 Cozy Resting, Story Atmosphere & Valley Epilogue Heart",
  () => {
    test.setTimeout(longFlowTimeout);

    test(
      "Market & Parlor: story-reactive sparkles boost atmosphere counts and shopkeepers react",
      { tag: "@smoke" },
      async ({ page }) => {
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        page.on("console", (msg) => {
          if (msg.type() === "error") errors.push(msg.text());
        });

        await page.setViewportSize({ width: 1280, height: 720 });
        await openHarness(page);

        // Market baseline vs story-reactive marketOrchardGlow (+5 sparkles) + Pippin Sunberry.
        await resetPaused(page, "market");
        await step(page, 4);
        const marketBaseCount = (await renderInfo(page)).atmosphereParticles;
        const marketBaseState = await readState(page);
        await continueFromSave(
          page,
          serializeSave({
            ...marketBaseState,
            ink: setInkVariables(marketBaseState.ink, {
              market_visited: true,
              market_note_read: true,
              sunberry_harvests: 1,
            }),
          }),
        );
        await step(page, 4);
        expect((await renderInfo(page)).atmosphereParticles).toBe(marketBaseCount + 5);

        // Walk around produce island (668, 496) to stand down-left of Pippin (825, 520).
        await walk(page, "y", 590);
        await walk(page, "x", 776);
        await walk(page, "y", 556);
        await press(page, "ArrowRight");
        await step(page, 2);
        await press(page, "z");
        await step(page, 200);
        expect((await renderInfo(page)).dialogue.speaker).toBe("Grocer Pippin");
        expect((await readState(page)).dialogue?.text).toContain("Golden Sunberry");

        // Parlor baseline vs parlorSundaeSparkle (+5 sparkles) + Scooper Penny Whistle line.
        await resetPaused(page, "parlor");
        await step(page, 4);
        const parlorBaseCount = (await renderInfo(page)).atmosphereParticles;
        const parlorBaseState = await readState(page);
        await continueFromSave(
          page,
          serializeSave({
            ...parlorBaseState,
            ink: setInkVariables(parlorBaseState.ink, {
              parlor_visited: true,
              parlor_note_read: true,
              buster_reward: true,
            }),
          }),
        );
        await step(page, 4);
        expect((await renderInfo(page)).atmosphereParticles).toBe(parlorBaseCount + 5);

        // Walk from the parlor door (280, 555) to Scooper Penny (545, 505).
        await walk(page, "x", 545);
        await walk(page, "y", 550);
        await press(page, "ArrowUp");
        await step(page, 2);
        await press(page, "z");
        await step(page, 200);
        expect((await renderInfo(page)).dialogue.speaker).toBe("Scooper Penny");
        expect((await readState(page)).dialogue?.text).toContain("Star-Line Whistle");

        expect(errors).toEqual([]);
      },
    );

    test(
      "Cavern & Music Room: story-reactive shimmer/harmony and Cozy Resting spots work cleanly",
      { tag: "@smoke" },
      async ({ page }) => {
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        page.on("console", (msg) => {
          if (msg.type() === "error") errors.push(msg.text());
        });

        await page.setViewportSize({ width: 1280, height: 720 });
        await openHarness(page);

        // Cavern baseline vs cavernChimeShimmer (+6 sparkles) + cavern-crystal-bank rest spot.
        await resetPaused(page, "cavern");
        await step(page, 4);
        const cavernBaseCount = (await renderInfo(page)).atmosphereParticles;
        const cavernBaseState = await readState(page);
        await continueFromSave(
          page,
          serializeSave({
            ...cavernBaseState,
            party: [],
            ink: setInkVariables(cavernBaseState.ink, {
              cavern_chime_rung: true,
              buster_reward: true,
            }),
          }),
        );
        await step(page, 4);
        expect((await renderInfo(page)).atmosphereParticles).toBe(cavernBaseCount + 6);

        await walk(page, "x", 720);
        await walk(page, "y", 760);
        await press(page, "z");
        await step(page, 6);
        expect((await renderInfo(page)).resting).toBe("cavern-crystal-bank");

        // Music Room baseline vs musicRoomHarmony (+5 sparkles) + music-room-rug rest spot.
        await resetPaused(page, "music");
        await step(page, 4);
        const musicBaseCount = (await renderInfo(page)).atmosphereParticles;
        const musicBaseState = await readState(page);
        await continueFromSave(
          page,
          serializeSave({
            ...musicBaseState,
            party: [],
            critters: { ...musicBaseState.critters, "music-bird": "calm" },
            ink: setInkVariables(musicBaseState.ink, {
              has_flute: true,
              buster_reward: true,
            }),
          }),
        );
        await step(page, 4);
        expect((await renderInfo(page)).atmosphereParticles).toBe(musicBaseCount + 5);

        await walk(page, "x", 480);
        await walk(page, "y", 640);
        await press(page, "z");
        await step(page, 6);
        expect((await renderInfo(page)).resting).toBe("music-room-rug");

        expect(errors).toEqual([]);
      },
    );

    test(
      "Gym, Classroom, Kitchen & Enchanted Forest: epilogue heart and cozy resting work live",
      { tag: "@smoke" },
      async ({ page }) => {
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        page.on("console", (msg) => {
          if (msg.type() === "error") errors.push(msg.text());
        });

        await page.setViewportSize({ width: 1280, height: 720 });
        await openHarness(page);

        // Gym: Coach Ash epilogue + gym-sideline-mat resting.
        await resetPaused(page, "gym");
        const gymBase = await readState(page);
        await continueFromSave(
          page,
          serializeSave({
            ...gymBase,
            party: [],
            critters: { ...gymBase.critters, "gym-pup": "calm" },
            ink: setInkVariables(gymBase.ink, {
              coach_thanked: true,
              cavern_chime_rung: true,
            }),
          }),
        );
        await walk(page, "y", 720);
        await walk(page, "x", 500);
        await press(page, "ArrowRight");
        await step(page, 2);
        await press(page, "z");
        await step(page, 200);
        expect((await renderInfo(page)).dialogue.speaker).toBe("Coach Ash");
        expect((await readState(page)).dialogue?.text).toContain("Rainbow Lasso");
        await press(page, "z");
        await step(page, 4);

        await walk(page, "y", 510);
        await walk(page, "x", 760);
        await press(page, "z");
        await step(page, 6);
        expect((await renderInfo(page)).resting).toBe("gym-sideline-mat");

        // Classroom: Ms. Maple Milo epilogue + classroom-reading-rug resting.
        await resetPaused(page, "classroom");
        const classBase = await readState(page);
        await continueFromSave(
          page,
          serializeSave({
            ...classBase,
            party: [],
            ink: setInkVariables(classBase.ink, { milo_revealed: true }),
          }),
        );
        await walk(page, "x", 360);
        await walk(page, "y", 460);
        await walk(page, "x", 795);
        await walk(page, "y", 480);
        await walk(page, "x", 825);
        await press(page, "ArrowRight");
        await step(page, 2);
        await press(page, "z");
        await step(page, 200);
        expect((await renderInfo(page)).dialogue.speaker).toBe("Ms. Maple");
        expect((await readState(page)).dialogue?.text).toContain("Milo");
        await press(page, "z");
        await step(page, 4);

        await walk(page, "x", 795);
        await walk(page, "y", 460);
        await walk(page, "x", 540);
        await walk(page, "y", 428);
        await walk(page, "x", 710);
        await walk(page, "y", 435);
        await press(page, "ArrowRight");
        await step(page, 2);
        await press(page, "z");
        await step(page, 6);
        expect((await renderInfo(page)).resting).toBe("classroom-reading-rug");

        // Kitchen: Mom post-reveal epilogue.
        await resetPaused(page, "kitchen");
        const kitchenBase = await readState(page);
        await continueFromSave(
          page,
          serializeSave({
            ...kitchenBase,
            ink: setInkVariables(kitchenBase.ink, {
              ate_breakfast: true,
              milo_revealed: true,
            }),
          }),
        );
        await walk(page, "x", 615);
        await walk(page, "y", 575);
        await press(page, "ArrowUp");
        await step(page, 2);
        await press(page, "z");
        await step(page, 200);
        expect((await renderInfo(page)).dialogue.speaker).toBe("Mom");
        expect((await readState(page)).dialogue?.text).toContain("Milo");

        // Enchanted Forest: Sky Fairy + Lavender Fairy post-reveal epilogues.
        await continueFromSave(
          page,
          serializeSave({
            ...kitchenBase,
            area: "enchanted",
            player: { x: 440, y: 500 },
            facing: "right",
            party: [],
            critters: { ...kitchenBase.critters, "hooded-kid": "calm" },
            ink: setInkVariables(kitchenBase.ink, {
              milo_revealed: true,
              forest_fizzy: false,
              gem_reward_all: true,
            }),
          }),
        );
        await walk(page, "x", 605);
        await press(page, "ArrowRight");
        await step(page, 2);
        await press(page, "z");
        await step(page, 200);
        expect((await renderInfo(page)).dialogue.speaker).toBe("Sky Fairy");
        expect((await readState(page)).dialogue?.text).toContain("seven Star Gems");
        await press(page, "z");
        await step(page, 4);

        await walk(page, "y", 560);
        await walk(page, "x", 785);
        await walk(page, "y", 620);
        await walk(page, "x", 805);
        await press(page, "ArrowRight");
        await step(page, 2);
        await press(page, "z");
        await step(page, 200);
        expect((await renderInfo(page)).dialogue.speaker).toBe("Lavender Fairy");
        expect((await readState(page)).dialogue?.text).toContain("golden dreams again");

        expect(errors).toEqual([]);
      },
    );
  },
);
